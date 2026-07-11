import "dotenv/config";
import assert from "node:assert/strict";

const baseUrl = (process.env.RIVT_MONITOR_BASE_URL ?? "https://rivt.pro").replace(/\/+$/, "");
const expectedCommit = process.env.EXPECTED_SOURCE_COMMIT?.trim();
const expectedMatchingJobAlerts = process.env.EXPECT_MATCHING_JOB_ALERTS_ENABLED?.trim();
const timeoutMs = Number.parseInt(process.env.RIVT_MONITOR_TIMEOUT_MS ?? "10000", 10);
const allowOperationalLockout = process.env.ALLOW_OPERATIONAL_LOCKOUT === "true";

async function request(path, { expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json", Origin: baseUrl },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`${path} returned non-JSON response: ${text.slice(0, 200)}`);
    }
  }
  assert.equal(response.status, expected, `${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return { response, payload };
}

const privateRoutes = [
  "/api/readiness",
  "/api/storage",
  "/api/app-state",
  "/api/v1/me",
  "/api/v1/jobs",
  "/api/v1/conversations",
  "/api/v1/admin/overview",
];

const startedAt = Date.now();

const health = await request("/api/health");
assert.equal(health.payload?.ok, true, "Health endpoint must report ok=true.");
const dependencies = health.payload?.dependencies ?? health.payload?.storage;
const observability = health.payload?.observability ?? {};
assert.ok(dependencies, "Health must expose dependency status.");
if (dependencies.ok !== undefined) assert.equal(dependencies.ok, true, "Managed storage must report healthy.");
assert.equal(dependencies.database, "postgres", "Database mode must be postgres.");
assert.equal(dependencies.objectStorage, "s3-compatible", "Object storage mode must be S3-compatible.");
assert.ok(health.payload?.build?.commit, "Health must expose the deployed source commit.");
if (expectedCommit) {
  assert.equal(health.payload.build.commit, expectedCommit, "Production source commit does not match EXPECTED_SOURCE_COMMIT.");
}
if (expectedMatchingJobAlerts) {
  assert.equal(
    health.payload?.engagement?.matchingJobAlerts?.enabled,
    expectedMatchingJobAlerts === "true",
    "Matching-job alert control does not match EXPECT_MATCHING_JOB_ALERTS_ENABLED.",
  );
}

const providers = await request("/api/auth/providers");
assert.equal(providers.payload?.inviteRequired, true, "Pilot invitation gating must remain enabled.");
assert.equal(providers.payload?.providers?.email?.ok, true, "Email/password auth provider must remain configured.");
assert.ok(providers.payload?.controls, "Provider status must expose operational controls.");
if (!allowOperationalLockout) {
  assert.equal(providers.payload.controls.signupsDisabled, false, "Signups are disabled unexpectedly.");
  assert.equal(providers.payload.controls.mutationsDisabled, false, "Platform mutations are disabled unexpectedly.");
}

for (const route of privateRoutes) {
  await request(route, { expected: 401 });
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  buildCommit: health.payload.build.commit,
  storage: {
    database: dependencies.database,
    objectStorage: dependencies.objectStorage,
  },
  observability,
  engagement: health.payload?.engagement ?? {},
  controls: providers.payload.controls,
  anonymousPrivateChecks: privateRoutes.length,
  durationMs: Date.now() - startedAt,
}, null, 2));
