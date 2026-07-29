import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test, { after } from "node:test";
import { assertWorkerShutdownBudget } from "../server/runtime.js";

const repositoryRoot = resolve(import.meta.dirname, "..");
const runtimePath = resolve(repositoryRoot, "server", "runtime.js");
const isolatedWorkingDirectory = mkdtempSync(join(tmpdir(), "rivt-runtime-entrypoint-"));
const secretMarker = "rivt-test-secret-must-never-appear-92461";

function deploymentConfig(name) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, name), "utf8"));
}

after(() => {
  rmSync(isolatedWorkingDirectory, { recursive: true, force: true });
});

function cleanEnvironment(overrides = {}) {
  const environment = {};
  for (const key of [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "SYSTEMROOT",
    "ComSpec",
    "COMSPEC",
    "TEMP",
    "TMP",
    "WINDIR",
    "windir",
  ]) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  return {
    ...environment,
    NODE_ENV: "production",
    RIVT_TEST_SECRET: secretMarker,
    ...overrides,
  };
}

function healthyConnectionBudget() {
  return {
    RIVT_WEB_REPLICAS: "1",
    RIVT_WORKER_REPLICAS: "1",
    RIVT_WEB_PG_POOL_MAX: "4",
    RIVT_WORKER_PG_POOL_MAX: "2",
    RIVT_MIGRATE_PG_POOL_MAX: "1",
    RIVT_DB_RESERVED_CONNECTIONS: "2",
    RIVT_DB_MAX_CONNECTIONS: "20",
    HTTP_SHUTDOWN_TIMEOUT_MS: "20000",
  };
}

function runRuntime({ environment, timeoutMs = 4_000, requestedRole = null } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const startedAt = Date.now();
    const child = spawn(
      process.execPath,
      [runtimePath, ...(requestedRole ? [requestedRole] : [])],
      {
      cwd: isolatedWorkingDirectory,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", rejectRun);
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolveRun({
        code,
        signal,
        stdout,
        stderr,
        output: `${stdout}\n${stderr}`,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}

async function withReservedPort(run) {
  const sentinel = createServer();
  sentinel.listen(0);
  await once(sentinel, "listening");
  const address = sentinel.address();
  assert.ok(address && typeof address === "object");
  try {
    return await run(address.port);
  } finally {
    sentinel.close();
    await once(sentinel, "close");
  }
}

const hostedRoleFailures = [
  {
    name: "missing hosted process role",
    role: undefined,
    message: /RIVT_PROCESS_ROLE is required/,
  },
  {
    name: "invalid hosted process role",
    role: "sidecar",
    message: /RIVT_PROCESS_ROLE must be web or worker/,
  },
  {
    name: "hosted combined process role",
    role: "combined",
    message: /combined process role is only allowed for local development and tests/,
  },
];

for (const scenario of hostedRoleFailures) {
  test(`${scenario.name} fails before an HTTP listener can bind`, async () => {
    const result = await withReservedPort((port) => runRuntime({
      environment: cleanEnvironment({
        PORT: String(port),
        ...(scenario.role ? { RIVT_PROCESS_ROLE: scenario.role } : {}),
      }),
    }));

    assert.equal(result.timedOut, false);
    assert.notEqual(result.code, 0);
    assert.match(result.output, scenario.message);
    assert.doesNotMatch(result.output, /EADDRINUSE|server\.started|runtime\.configuration_ready/);
    assert.doesNotMatch(result.output, new RegExp(secretMarker));
  });
}

for (const role of ["worker"]) {
  test(`${role} fails closed without DATABASE_URL after validating a safe budget`, async () => {
    const result = await runRuntime({
      environment: cleanEnvironment({
        ...healthyConnectionBudget(),
        RIVT_PROCESS_ROLE: role,
      }),
    });

    assert.equal(result.timedOut, false);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /runtime\.configuration_ready/);
    assert.match(result.output, /DATABASE_URL is required/);
    assert.doesNotMatch(result.output, /server\.started|EADDRINUSE/);
    assert.doesNotMatch(result.output, new RegExp(secretMarker));
  });
}

test("web-owned migrate pre-deploy fails closed without DATABASE_URL after a safe budget", async () => {
  const result = await runRuntime({
    environment: cleanEnvironment({
      ...healthyConnectionBudget(),
      RIVT_PROCESS_ROLE: "web",
    }),
    requestedRole: "migrate",
  });

  assert.equal(result.timedOut, false);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /runtime\.configuration_ready/);
  assert.match(result.output, /DATABASE_URL is required/);
  assert.doesNotMatch(result.output, /server\.started|EADDRINUSE/);
  assert.doesNotMatch(result.output, new RegExp(secretMarker));
});

test("local runtime preserves the combined no-role compatibility path", async () => {
  const result = await withReservedPort((port) => runRuntime({
    environment: cleanEnvironment({
      NODE_ENV: "development",
      PORT: String(port),
    }),
  }));

  assert.equal(result.timedOut, false);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /runtime\.configuration_ready/);
  assert.match(result.output, /"processRole":"combined"/);
  assert.match(result.output, /EADDRINUSE/);
  assert.doesNotMatch(result.output, new RegExp(secretMarker));
});

test("Railway web and worker configs preserve role-specific health and graceful drain", () => {
  const web = deploymentConfig("railway.json");
  const worker = deploymentConfig("railway.worker.json");

  for (const configuration of [web, worker]) {
    assert.equal(configuration.build?.builder, "NIXPACKS");
    assert.equal(configuration.build?.buildCommand, "npm run build");
    assert.equal(configuration.deploy?.restartPolicyType, "ON_FAILURE");
    assert.equal(configuration.deploy?.restartPolicyMaxRetries, 10);
    assert.equal(configuration.deploy?.drainingSeconds, 30);
    assert.equal("numReplicas" in configuration.deploy, false);
    assert.equal("region" in configuration.deploy, false);
    assert.equal("multiRegionConfig" in configuration.deploy, false);
  }

  assert.equal(web.deploy.startCommand, "node server/runtime.js web");
  assert.equal(web.deploy.preDeployCommand, "node server/runtime.js migrate");
  assert.equal(web.deploy.healthcheckPath, "/api/health");
  assert.equal(web.deploy.healthcheckTimeout, 300);
  assert.equal(worker.deploy.startCommand, "node server/runtime.js worker");
  assert.equal(worker.deploy.preDeployCommand, "node server/runtime.js worker-check");
  assert.equal("healthcheckPath" in worker.deploy, false);
  assert.equal("healthcheckTimeout" in worker.deploy, false);
});

test("worker pre-deploy check fails before replacement when readiness cannot be proved", async () => {
  const result = await runRuntime({
    environment: cleanEnvironment({
      ...healthyConnectionBudget(),
      RIVT_PROCESS_ROLE: "worker",
      RIVT_PUSH_REQUIRED: "true",
    }),
    requestedRole: "worker-check",
  });

  assert.equal(result.timedOut, false);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /runtime\.configuration_ready/);
  assert.match(result.output, /DATABASE_URL is required/);
  assert.doesNotMatch(result.output, /worker\.started|server\.started/);
  assert.doesNotMatch(result.output, new RegExp(secretMarker));
});

test("hosted worker shutdown reserves nominal time beyond the push deadline", () => {
  assert.deepEqual(assertWorkerShutdownBudget({
    HTTP_SHUTDOWN_TIMEOUT_MS: "20000",
    PUSH_DELIVERY_TIMEOUT_MS: "8000",
  }), {
    shutdownTimeoutMs: 20_000,
    deliveryTimeoutMs: 8_000,
  });
  assert.throws(
    () => assertWorkerShutdownBudget({
      HTTP_SHUTDOWN_TIMEOUT_MS: "10000",
      PUSH_DELIVERY_TIMEOUT_MS: "8000",
    }),
    /reserve at least 5000 milliseconds/i,
  );
  assert.throws(
    () => assertWorkerShutdownBudget({
      HTTP_SHUTDOWN_TIMEOUT_MS: "30000",
      PUSH_DELIVERY_TIMEOUT_MS: "8000",
    }),
    /HTTP_SHUTDOWN_TIMEOUT_MS/i,
  );
});
