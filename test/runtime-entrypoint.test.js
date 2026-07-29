import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test, { after } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const runtimePath = resolve(repositoryRoot, "server", "runtime.js");
const isolatedWorkingDirectory = mkdtempSync(join(tmpdir(), "rivt-runtime-entrypoint-"));
const secretMarker = "rivt-test-secret-must-never-appear-92461";

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
  };
}

function runRuntime({ environment, timeoutMs = 4_000 } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [runtimePath], {
      cwd: isolatedWorkingDirectory,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
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
    message: /RIVT_PROCESS_ROLE must be web, worker, or migrate/,
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

for (const role of ["worker", "migrate"]) {
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
