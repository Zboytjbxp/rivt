import assert from "node:assert/strict";
import test from "node:test";
import { captureException, errorMonitoringStatus } from "../server/monitoring.js";

test("error monitoring status is honest and redacts DSN", () => {
  assert.deepEqual(errorMonitoringStatus({ env: {} }), {
    ok: false,
    provider: "sentry",
    mode: "setup_required",
    missing: ["SENTRY_DSN or ERROR_MONITORING_DSN"],
  });

  const configured = errorMonitoringStatus({
    env: { SENTRY_DSN: "https://public-key:secret@sentry.example/12345" },
  });
  assert.equal(configured.ok, true);
  assert.equal(configured.mode, "configured");
  assert.equal(configured.host, "sentry.example");
  assert.equal(configured.projectId, "12345");
  assert.equal(JSON.stringify(configured).includes("secret"), false);
  assert.equal(JSON.stringify(configured).includes("public-key"), false);
});

test("captureException no-ops without configured monitoring", async () => {
  let called = false;
  const result = await captureException(new Error("boom"), {}, {
    env: {},
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 200 };
    },
  });

  assert.equal(called, false);
  assert.deepEqual(result, { ok: false, mode: "setup_required" });
});

test("captureException sends a sanitized Sentry-compatible event", async () => {
  let requestUrl = null;
  let requestBody = null;
  const result = await captureException(new Error("synthetic failure"), {
    requestId: "3e6d1f39-0e46-48f3-9db4-8f7a4fb3a0e7",
    path: "/api/test",
    statusCode: 500,
    password: "should-not-leak",
    nested: { token: "hidden", safe: "visible" },
  }, {
    env: {
      NODE_ENV: "production",
      SOURCE_COMMIT: "abc123",
      SENTRY_DSN: "https://public-key:secret@sentry.example/12345",
    },
    fetchImpl: async (url, options) => {
      requestUrl = String(url);
      requestBody = JSON.parse(options.body);
      return { ok: true, status: 200 };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.host, "sentry.example");
  assert.match(requestUrl, /^https:\/\/sentry\.example\/api\/12345\/store\//);
  assert.equal(requestUrl.includes("public-key"), true);
  assert.equal(requestUrl.includes("secret"), false);
  assert.equal(requestBody.environment, "production");
  assert.equal(requestBody.release, "abc123");
  assert.equal(requestBody.exception.values[0].value, "synthetic failure");
  assert.equal(requestBody.extra.nested.safe, "visible");
  assert.equal("password" in requestBody.extra, false);
  assert.equal("token" in requestBody.extra.nested, false);
});
