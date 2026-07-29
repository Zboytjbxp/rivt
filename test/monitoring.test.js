import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitiveText } from "../server/logger.js";
import { captureException, errorMonitoringStatus } from "../server/monitoring.js";
import { assertProductionAuthProviders } from "../scripts/production-monitor-contract.js";

test("production monitor rejects missing or unhealthy session security", () => {
  const configured = {
    providers: {
      email: { ok: true },
      sessionSecurity: { ok: true, mode: "configured" },
    },
  };
  assert.doesNotThrow(() => assertProductionAuthProviders(configured));
  assert.throws(
    () => assertProductionAuthProviders({
      providers: {
        email: { ok: true },
        sessionSecurity: { ok: false, mode: "setup_required" },
      },
    }),
    /Session metadata security/,
  );
  assert.throws(
    () => assertProductionAuthProviders({
      providers: { email: { ok: true } },
    }),
    /Session metadata security/,
  );
});

test("central telemetry redaction removes common direct identifiers and credentials", () => {
  const redacted = redactSensitiveText(
    "Contact private@example.com with Bearer abc.def and https://files.example/item?X-Amz-Signature=secret&code=oauth-code",
  );
  assert.doesNotMatch(redacted, /private@example|abc\.def|secret|oauth-code/);
  assert.match(redacted, /\[REDACTED_EMAIL\]/);
});

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
  const result = await captureException(new Error("synthetic failure for private@example.com"), {
    requestId: "3e6d1f39-0e46-48f3-9db4-8f7a4fb3a0e7",
    path: "/api/test",
    statusCode: 500,
    password: "should-not-leak",
    customerEmail: "private@example.com",
    nested: {
      token: "hidden",
      safe: "visible",
      link: "https://files.example/item?X-Amz-Signature=secret",
    },
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
  assert.equal(requestBody.exception.values[0].value, "synthetic failure for [REDACTED_EMAIL]");
  assert.equal(requestBody.extra.nested.safe, "visible");
  assert.doesNotMatch(requestBody.extra.nested.link, /secret/);
  assert.equal("password" in requestBody.extra, false);
  assert.equal("customerEmail" in requestBody.extra, false);
  assert.equal("token" in requestBody.extra.nested, false);
});
