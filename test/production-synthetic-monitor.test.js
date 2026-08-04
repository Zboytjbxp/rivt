import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const monitorPath = join(repositoryRoot, "scripts", "production-synthetic-monitor.js");
const workflowPath = join(repositoryRoot, ".github", "workflows", "production-synthetic.yml");
const RESPONSE_SECRET = "RIVT_SYNTHETIC_RESPONSE_BODY_MUST_NOT_LEAK";
const BUILD_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const OTHER_COMMIT = "89abcdef0123456789abcdef0123456789abcdef";

function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function validRoute(request, response) {
  if (request.url === "/api/health") {
    json(response, 200, {
      ok: true,
      build: { commit: BUILD_COMMIT, responseSecret: RESPONSE_SECRET },
      dependencies: {
        ok: true,
        database: "postgres",
        objectStorage: "s3-compatible",
        responseSecret: RESPONSE_SECRET,
      },
      observability: {
        errorMonitoring: { ok: true, mode: "configured", responseSecret: RESPONSE_SECRET },
        responseSecret: RESPONSE_SECRET,
      },
      security: { passwordBreachScreening: { mode: "configured", responseSecret: RESPONSE_SECRET } },
      engagement: {
        matchingJobAlerts: { enabled: true, responseSecret: RESPONSE_SECRET },
        responseSecret: RESPONSE_SECRET,
      },
      responseSecret: RESPONSE_SECRET,
    });
    return;
  }
  if (request.url === "/api/auth/providers") {
    json(response, 200, {
      inviteRequired: true,
      providers: {
        email: { ok: true, mode: "configured", responseSecret: RESPONSE_SECRET },
        google: { ok: true, mode: "configured", responseSecret: RESPONSE_SECRET },
        sessionSecurity: { ok: true, mode: "configured", responseSecret: RESPONSE_SECRET },
      },
      controls: {
        signupsDisabled: false,
        mutationsDisabled: false,
        responseSecret: RESPONSE_SECRET,
      },
      responseSecret: RESPONSE_SECRET,
    });
    return;
  }
  json(response, 401, { error: "private", responseSecret: RESPONSE_SECRET });
}

async function runMonitor(routeHandler, {
  expectedSourceCommit = BUILD_COMMIT,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "rivt-monitor-test-"));
  const summaryPath = join(directory, "summary.json");
  const server = createServer(routeHandler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    try {
      const result = await execFileAsync(process.execPath, [monitorPath], {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          RIVT_MONITOR_BASE_URL: baseUrl,
          RIVT_MONITOR_OUTPUT_PATH: summaryPath,
          RIVT_MONITOR_TIMEOUT_MS: "2000",
          EXPECTED_SOURCE_COMMIT: expectedSourceCommit,
          EXPECT_MATCHING_JOB_ALERTS_ENABLED: "true",
        },
        encoding: "utf8",
        timeout: 10_000,
      });
      return {
        code: 0,
        stdout: result.stdout,
        stderr: result.stderr,
        summary: JSON.parse(await readFile(summaryPath, "utf8")),
      };
    } catch (error) {
      let summary = null;
      try {
        summary = JSON.parse(await readFile(summaryPath, "utf8"));
      } catch {
        // A missing summary is itself a regression failure below.
      }
      return {
        code: typeof error.code === "number" ? error.code : 1,
        stdout: String(error.stdout ?? ""),
        stderr: String(error.stderr ?? ""),
        summary,
      };
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

test("successful monitor output contains only allowlisted response metadata", async () => {
  const result = await runMonitor(validRoute);
  const rendered = `${result.stdout}\n${result.stderr}\n${JSON.stringify(result.summary)}`;

  assert.equal(result.code, 0);
  assert.ok(result.summary);
  assert.equal(result.summary.ok, true);
  assert.equal(result.summary.expectedBuildCommit, BUILD_COMMIT);
  assert.equal(result.summary.buildCommit, BUILD_COMMIT);
  assert.deepEqual(result.summary.storage, {
    database: "postgres",
    objectStorage: "s3-compatible",
  });
  assert.deepEqual(result.summary.observability, {
    errorMonitoring: { ok: true, mode: "configured" },
  });
  assert.deepEqual(result.summary.engagement, {
    matchingJobAlerts: { enabled: true },
  });
  assert.deepEqual(result.summary.controls, {
    signupsDisabled: false,
    mutationsDisabled: false,
  });
  assert.doesNotMatch(rendered, new RegExp(RESPONSE_SECRET));
});

test("monitor fails closed when no trusted expected source commit is supplied", async () => {
  let requests = 0;
  const result = await runMonitor((request, response) => {
    requests += 1;
    validRoute(request, response);
  }, { expectedSourceCommit: "" });

  assert.notEqual(result.code, 0);
  assert.equal(requests, 0);
  assert.deepEqual(result.summary, {
    ok: false,
    errorCode: "INVALID_CONFIGURATION",
    check: "expected-commit",
  });
});

test("monitor rejects an abbreviated expected source revision", async () => {
  let requests = 0;
  const result = await runMonitor((request, response) => {
    requests += 1;
    validRoute(request, response);
  }, { expectedSourceCommit: BUILD_COMMIT.slice(0, 12) });

  assert.notEqual(result.code, 0);
  assert.equal(requests, 0);
  assert.deepEqual(result.summary, {
    ok: false,
    errorCode: "INVALID_CONFIGURATION",
    check: "expected-commit",
  });
});

test("trusted expected revision rejects a different deployed revision", async () => {
  const result = await runMonitor(validRoute, {
    expectedSourceCommit: OTHER_COMMIT,
  });

  assert.notEqual(result.code, 0);
  assert.deepEqual(result.summary, {
    ok: false,
    errorCode: "CHECK_FAILED",
    check: "expected-source-commit",
    endpoint: "/api/health",
  });
});

test("monitor requires configured session security mode", async () => {
  const result = await runMonitor((request, response) => {
    if (request.url === "/api/auth/providers") {
      json(response, 200, {
        inviteRequired: true,
        providers: {
          email: { ok: true, mode: "configured" },
          google: { ok: true, mode: "configured" },
          sessionSecurity: { ok: true, mode: "setup_required" },
        },
        controls: { signupsDisabled: false, mutationsDisabled: false },
      });
      return;
    }
    validRoute(request, response);
  });

  assert.notEqual(result.code, 0);
  assert.deepEqual(result.summary, {
    ok: false,
    errorCode: "CHECK_FAILED",
    check: "session-security-mode",
    endpoint: "/api/auth/providers",
  });
});

test("unexpected response status is reported without body content or stack output", async () => {
  const result = await runMonitor((request, response) => {
    if (request.url === "/api/health") {
      json(response, 503, { error: "unavailable", responseSecret: RESPONSE_SECRET });
      return;
    }
    validRoute(request, response);
  });
  const rendered = `${result.stdout}\n${result.stderr}\n${JSON.stringify(result.summary)}`;

  assert.notEqual(result.code, 0);
  assert.deepEqual(result.summary, {
    ok: false,
    errorCode: "UNEXPECTED_STATUS",
    check: "health",
    endpoint: "/api/health",
    expectedStatus: 200,
    actualStatus: 503,
  });
  assert.doesNotMatch(rendered, new RegExp(RESPONSE_SECRET));
  assert.doesNotMatch(rendered, /AssertionError|production-synthetic-monitor\.js:\d+/);
});

test("non-JSON response errors never quote response text", async () => {
  const result = await runMonitor((request, response) => {
    if (request.url === "/api/health") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(RESPONSE_SECRET);
      return;
    }
    validRoute(request, response);
  });
  const rendered = `${result.stdout}\n${result.stderr}\n${JSON.stringify(result.summary)}`;

  assert.notEqual(result.code, 0);
  assert.deepEqual(result.summary, {
    ok: false,
    errorCode: "NON_JSON_RESPONSE",
    check: "health",
    endpoint: "/api/health",
    expectedStatus: 200,
    actualStatus: 200,
  });
  assert.doesNotMatch(rendered, new RegExp(RESPONSE_SECRET));
});

test("workflow artifacts and incident issues use the sanitized summary only", async () => {
  const workflow = (await readFile(workflowPath, "utf8")).replace(/\r\n/g, "\n");
  const reconcileStart = workflow.indexOf("  reconcile-incident:\n");
  assert.notEqual(reconcileStart, -1);
  const monitor = workflow.slice(workflow.indexOf("  monitor:\n"), reconcileStart);
  const reconcile = workflow.slice(reconcileStart);

  assert.match(workflow, /environment:\s*production/);
  assert.match(workflow, /EXPECTED_SOURCE_COMMIT:\s*\$\{\{ vars\.RIVT_PRODUCTION_SOURCE_COMMIT \}\}/);
  assert.doesNotMatch(workflow, /EXPECTED_SOURCE_COMMIT:\s*\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /RIVT_MONITOR_OUTPUT_PATH:\s*production-monitor-summary\.json/);
  assert.match(workflow, /path:\s*production-monitor-summary\.json/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.doesNotMatch(workflow, /uses:\s*actions\/(?:checkout|setup-node|upload-artifact|download-artifact|github-script)@v\d+/);

  assert.match(workflow, /^permissions:\n  contents: read\n$/m);
  assert.match(monitor, /permissions:\n      contents: read\n/);
  assert.doesNotMatch(monitor, /issues:\s*write/);
  assert.match(monitor, /Validate protected production context/);
  assert.match(monitor, /errorCode:\s*"INVALID_CONFIGURATION"/);
  assert.match(monitor, /check:\s*"workflow-context"/);

  assert.match(reconcile, /needs:\s*monitor/);
  assert.match(reconcile, /always\(\)/);
  assert.match(reconcile, /permissions:\n      actions: read\n      issues: write\n/);
  assert.doesNotMatch(reconcile, /contents:\s*(?:read|write)|actions\/checkout|npm ci|npm run/);
  assert.match(reconcile, /actions\/download-artifact@[0-9a-f]{40}/);
  assert.match(reconcile, /continue-on-error:\s*true/);
  assert.match(reconcile, /RIVT_MONITOR_SUMMARY_PATH:\s*monitor-evidence\/production-monitor-summary\.json/);
  assert.match(reconcile, /const allowedErrorCodes = new Set/);
  assert.match(reconcile, /"workflow-context"/);
  assert.match(reconcile, /"session-security-mode"/);
  assert.match(reconcile, /const defaultSummary = \(\) =>/);
  assert.match(reconcile, /const recovered = monitorResult === "success" && monitor\.ok === true/);
  assert.equal(reconcile.match(/findOwnedIncident\(issues\)/g)?.length, 1);
  assert.match(reconcile, /!issue\.pull_request/);
  assert.match(reconcile, /issue\.title === title/);
  assert.match(reconcile, /issue\.body\?\.split\(\/\\r\?\\n\/, 1\)\[0\] === marker/);
  assert.match(reconcile, /issue\.repository_url === productionRepositoryUrl/);
  assert.match(reconcile, /issue\.user\?\.login === trustedAutomationLogin/);
  assert.match(reconcile, /issue\.user\?\.type === "Bot"/);
  assert.doesNotMatch(workflow, /issues\.find\(\(issue\) => !issue\.pull_request && issue\.body\?\.includes\(marker\)\)/);
  assert.doesNotMatch(workflow, /issue\.title === [^\n]+\|\| issue\.body\?\.includes\(marker\)/);
  assert.doesNotMatch(workflow, /production-monitor\.log|Latest monitor output|```text|docs\/operations\/incident-routing/);
});
