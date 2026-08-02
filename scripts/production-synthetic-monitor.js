import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;
const ALLOWED_ERROR_CODES = new Set([
  "CHECK_FAILED",
  "INVALID_CONFIGURATION",
  "NON_JSON_RESPONSE",
  "OUTPUT_WRITE_FAILED",
  "REQUEST_FAILED",
  "REQUEST_TIMEOUT",
  "UNEXPECTED_MONITOR_FAILURE",
  "UNEXPECTED_STATUS",
]);
const privateRoutes = [
  "/api/readiness",
  "/api/storage",
  "/api/app-state",
  "/api/v1/me",
  "/api/v1/jobs",
  "/api/v1/conversations",
  "/api/v1/admin/overview",
];
const allowedChecks = new Set([
  "health",
  "health-ok",
  "auth-providers",
  "base-url",
  "timeout",
  "expected-commit",
  "matching-job-alerts-expectation",
  "error-monitoring-ok",
  "error-monitoring-mode",
  "password-breach-screening",
  "dependency-status-present",
  "dependencies-ok",
  "database-mode",
  "object-storage-mode",
  "build-commit",
  "expected-source-commit",
  "matching-job-alerts-shape",
  "matching-job-alerts-state",
  "pilot-invite-required",
  "email-provider",
  "google-provider",
  "session-security",
  "signup-control-shape",
  "mutation-control-shape",
  "signups-enabled",
  "mutations-enabled",
  "summary-output",
  ...privateRoutes.map((endpoint) => `anonymous-private:${endpoint}`),
]);

class MonitorFailure extends Error {
  constructor(errorCode, metadata = {}) {
    super(errorCode);
    this.name = "MonitorFailure";
    this.errorCode = errorCode;
    this.metadata = metadata;
  }
}

function failUnless(condition, errorCode, metadata) {
  if (!condition) throw new MonitorFailure(errorCode, metadata);
}

function normalizeBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new MonitorFailure("INVALID_CONFIGURATION", { check: "base-url" });
  }
  failUnless(
    ["http:", "https:"].includes(parsed.protocol)
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash
      && (parsed.pathname === "/" || parsed.pathname === ""),
    "INVALID_CONFIGURATION",
    { check: "base-url" },
  );
  return parsed.origin;
}

function parseConfiguration(env) {
  const timeoutMs = Number.parseInt(env.RIVT_MONITOR_TIMEOUT_MS ?? "10000", 10);
  failUnless(
    Number.isInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 60_000,
    "INVALID_CONFIGURATION",
    { check: "timeout" },
  );

  const baseUrl = normalizeBaseUrl(env.RIVT_MONITOR_BASE_URL ?? "https://rivt.pro");
  const expectedCommit = env.EXPECTED_SOURCE_COMMIT?.trim() || "";
  failUnless(COMMIT_PATTERN.test(expectedCommit), "INVALID_CONFIGURATION", {
    check: "expected-commit",
  });

  const expectedMatchingJobAlerts = env.EXPECT_MATCHING_JOB_ALERTS_ENABLED?.trim();
  failUnless(
    expectedMatchingJobAlerts === undefined
      || expectedMatchingJobAlerts === "true"
      || expectedMatchingJobAlerts === "false",
    "INVALID_CONFIGURATION",
    { check: "matching-job-alerts-expectation" },
  );

  return {
    baseUrl,
    expectedCommit,
    expectedMatchingJobAlerts,
    timeoutMs,
    allowOperationalLockout: env.ALLOW_OPERATIONAL_LOCKOUT === "true",
  };
}

async function request({ baseUrl, check, endpoint, expectedStatus, timeoutMs, parseJson, fetchFunction }) {
  let response;
  try {
    response = await fetchFunction(`${baseUrl}${endpoint}`, {
      headers: { Accept: "application/json", Origin: baseUrl },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const errorCode = error?.name === "AbortError" || error?.name === "TimeoutError"
      ? "REQUEST_TIMEOUT"
      : "REQUEST_FAILED";
    throw new MonitorFailure(errorCode, { check, endpoint, expectedStatus });
  }

  if (response.status !== expectedStatus) {
    throw new MonitorFailure("UNEXPECTED_STATUS", {
      check,
      endpoint,
      expectedStatus,
      actualStatus: response.status,
    });
  }
  if (!parseJson) return null;

  try {
    return await response.json();
  } catch {
    throw new MonitorFailure("NON_JSON_RESPONSE", {
      check,
      endpoint,
      expectedStatus,
      actualStatus: response.status,
    });
  }
}

function requireCheck(condition, check, endpoint) {
  failUnless(condition, "CHECK_FAILED", { check, endpoint });
}

export async function runProductionMonitor({ env = process.env, fetchFunction = fetch } = {}) {
  const startedAt = Date.now();
  const configuration = parseConfiguration(env);
  const requestOptions = {
    baseUrl: configuration.baseUrl,
    timeoutMs: configuration.timeoutMs,
    fetchFunction,
  };

  const healthEndpoint = "/api/health";
  const health = await request({
    ...requestOptions,
    check: "health",
    endpoint: healthEndpoint,
    expectedStatus: 200,
    parseJson: true,
  });
  requireCheck(health?.ok === true, "health-ok", healthEndpoint);

  const dependencies = health?.dependencies ?? health?.storage;
  const errorMonitoring = health?.observability?.errorMonitoring;
  const matchingJobAlertsEnabled = health?.engagement?.matchingJobAlerts?.enabled;
  const buildCommit = health?.build?.commit;
  requireCheck(errorMonitoring?.ok === true, "error-monitoring-ok", healthEndpoint);
  requireCheck(errorMonitoring?.mode === "configured", "error-monitoring-mode", healthEndpoint);
  requireCheck(
    health?.security?.passwordBreachScreening?.mode === "configured",
    "password-breach-screening",
    healthEndpoint,
  );
  requireCheck(Boolean(dependencies), "dependency-status-present", healthEndpoint);
  if (dependencies?.ok !== undefined) {
    requireCheck(dependencies.ok === true, "dependencies-ok", healthEndpoint);
  }
  requireCheck(dependencies?.database === "postgres", "database-mode", healthEndpoint);
  requireCheck(dependencies?.objectStorage === "s3-compatible", "object-storage-mode", healthEndpoint);
  requireCheck(typeof buildCommit === "string" && COMMIT_PATTERN.test(buildCommit), "build-commit", healthEndpoint);
  requireCheck(buildCommit === configuration.expectedCommit, "expected-source-commit", healthEndpoint);
  requireCheck(typeof matchingJobAlertsEnabled === "boolean", "matching-job-alerts-shape", healthEndpoint);
  if (configuration.expectedMatchingJobAlerts !== undefined) {
    requireCheck(
      matchingJobAlertsEnabled === (configuration.expectedMatchingJobAlerts === "true"),
      "matching-job-alerts-state",
      healthEndpoint,
    );
  }

  const providersEndpoint = "/api/auth/providers";
  const providers = await request({
    ...requestOptions,
    check: "auth-providers",
    endpoint: providersEndpoint,
    expectedStatus: 200,
    parseJson: true,
  });
  requireCheck(providers?.inviteRequired === true, "pilot-invite-required", providersEndpoint);
  requireCheck(providers?.providers?.email?.ok === true, "email-provider", providersEndpoint);
  requireCheck(providers?.providers?.google?.ok === true, "google-provider", providersEndpoint);
  requireCheck(providers?.providers?.sessionSecurity?.ok === true, "session-security", providersEndpoint);
  const signupsDisabled = providers?.controls?.signupsDisabled;
  const mutationsDisabled = providers?.controls?.mutationsDisabled;
  requireCheck(typeof signupsDisabled === "boolean", "signup-control-shape", providersEndpoint);
  requireCheck(typeof mutationsDisabled === "boolean", "mutation-control-shape", providersEndpoint);
  if (!configuration.allowOperationalLockout) {
    requireCheck(signupsDisabled === false, "signups-enabled", providersEndpoint);
    requireCheck(mutationsDisabled === false, "mutations-enabled", providersEndpoint);
  }

  for (const endpoint of privateRoutes) {
    await request({
      ...requestOptions,
      check: `anonymous-private:${endpoint}`,
      endpoint,
      expectedStatus: 401,
      parseJson: false,
    });
  }

  return {
    ok: true,
    baseUrl: configuration.baseUrl,
    expectedBuildCommit: configuration.expectedCommit,
    buildCommit,
    storage: {
      database: "postgres",
      objectStorage: "s3-compatible",
    },
    observability: {
      errorMonitoring: { ok: true, mode: "configured" },
    },
    engagement: {
      matchingJobAlerts: { enabled: matchingJobAlertsEnabled },
    },
    authentication: {
      email: "configured",
      google: "configured",
      sessionSecurity: "configured",
    },
    controls: {
      signupsDisabled,
      mutationsDisabled,
    },
    anonymousPrivateChecks: privateRoutes.length,
    durationMs: Date.now() - startedAt,
  };
}

function safeFailureSummary(error) {
  const errorCode = error instanceof MonitorFailure && ALLOWED_ERROR_CODES.has(error.errorCode)
    ? error.errorCode
    : "UNEXPECTED_MONITOR_FAILURE";
  const metadata = error instanceof MonitorFailure ? error.metadata : {};
  const summary = { ok: false, errorCode };
  if (allowedChecks.has(metadata.check)) {
    summary.check = metadata.check;
  }
  if (typeof metadata.endpoint === "string" && privateRoutes.concat([
    "/api/health",
    "/api/auth/providers",
  ]).includes(metadata.endpoint)) {
    summary.endpoint = metadata.endpoint;
  }
  if (Number.isInteger(metadata.expectedStatus) && metadata.expectedStatus >= 100 && metadata.expectedStatus <= 599) {
    summary.expectedStatus = metadata.expectedStatus;
  }
  if (Number.isInteger(metadata.actualStatus) && metadata.actualStatus >= 100 && metadata.actualStatus <= 599) {
    summary.actualStatus = metadata.actualStatus;
  }
  return summary;
}

async function writeSummary(outputPath, summary) {
  if (!outputPath) return;
  await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, {
    encoding: "utf8",
    flag: "w",
    mode: 0o600,
  });
}

export async function main({ env = process.env } = {}) {
  let summary;
  try {
    summary = await runProductionMonitor({ env });
  } catch (error) {
    summary = safeFailureSummary(error);
  }

  try {
    await writeSummary(env.RIVT_MONITOR_OUTPUT_PATH?.trim(), summary);
  } catch {
    summary = { ok: false, errorCode: "OUTPUT_WRITE_FAILED", check: "summary-output" };
  }

  const rendered = JSON.stringify(summary, null, 2);
  if (summary.ok) console.log(rendered);
  else console.error(rendered);
  return summary.ok ? 0 : 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) process.exitCode = await main();
