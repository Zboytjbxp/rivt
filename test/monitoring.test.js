import assert from "node:assert/strict";
import test from "node:test";
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

test("captureException redacts sensitive strings at the Sentry payload boundary", async () => {
  let requestBody = null;
  const error = new Error(
    "Provider rejected owner@example.com with Bearer secret-bearer-token "
      + "at postgres://dbuser:dbpass@db.example/rivt using "
      + "https://sentry-public-key@errors.example/12345",
  );
  error.stack = [
    error.message,
    "at callback (/app/server.js?access_token=query-secret&x-amz-signature=signed-secret:1:1)",
  ].join("\n");

  const result = await captureException(error, {
    requestId: "req-safe",
    path: "/api/customer/owner@example.com?token=path-secret",
    statusCode: 500,
    nested: {
      customerEmail: "customer@example.com",
      safe: "visible",
      providerMessage:
        "Stripe returned sk_live_1234567890; Resend returned re_secret123456; "
        + "Google returned GOCSPX-secret1234567890; sentry_key=ingestion-secret",
    },
  }, {
    env: {
      NODE_ENV: "production",
      SOURCE_COMMIT: "abc123",
      SENTRY_DSN: "https://public-key:secret@sentry.example/12345",
    },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, status: 200 };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(requestBody.extra.requestId, "req-safe");
  assert.equal(requestBody.extra.nested.safe, "visible");
  assert.equal("customerEmail" in requestBody.extra.nested, false);

  const serialized = JSON.stringify(requestBody);
  for (const unsafeValue of [
    "owner@example.com",
    "customer@example.com",
    "secret-bearer-token",
    "dbuser",
    "dbpass",
    "sentry-public-key",
    "query-secret",
    "signed-secret",
    "path-secret",
    "sk_live_1234567890",
    "re_secret123456",
    "GOCSPX-secret1234567890",
    "ingestion-secret",
  ]) {
    assert.equal(serialized.includes(unsafeValue), false, `Sentry payload contained ${unsafeValue}`);
  }
});
