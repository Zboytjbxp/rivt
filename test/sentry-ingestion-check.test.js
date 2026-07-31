import assert from "node:assert/strict";
import test from "node:test";
import { runSentryIngestionCheck } from "../scripts/sentry-ingestion-check.js";

const fakeCommit = "a".repeat(40);
const fakeDsn = "https://nonsecret-public-test-key@sentry.example/12345";

function configuredEnv(overrides = {}) {
  return {
    SENTRY_DSN: fakeDsn,
    ERROR_MONITORING_PROVIDER: "sentry",
    ...overrides,
  };
}

function outputCapture() {
  const stdout = [];
  const stderr = [];
  return {
    stdout,
    stderr,
    options: {
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    },
  };
}

test("Sentry verification defaults to a non-sending config check", async () => {
  const output = outputCapture();
  let captureCalled = false;
  const exitCode = await runSentryIngestionCheck({
    env: configuredEnv(),
    captureExceptionImpl: async () => {
      captureCalled = true;
      return { ok: true };
    },
    ...output.options,
  });

  assert.equal(exitCode, 0);
  assert.equal(captureCalled, false);
  assert.equal(output.stderr.length, 0);
  const result = JSON.parse(output.stdout.join(""));
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.host, "sentry.example");
  assert.equal(result.projectId, "12345");
  assert.equal(output.stdout.join("").includes("nonsecret-public-test-key"), false);
});

test("Sentry verification requires the primary DSN and rejects the legacy alias", async () => {
  for (const env of [
    { ERROR_MONITORING_DSN: fakeDsn, ERROR_MONITORING_PROVIDER: "sentry" },
    configuredEnv({ ERROR_MONITORING_DSN: fakeDsn }),
  ]) {
    const output = outputCapture();
    const exitCode = await runSentryIngestionCheck({ env, ...output.options });
    assert.equal(exitCode, 1);
    assert.equal(JSON.parse(output.stderr.join("")).mode, "invalid_rotation_config");
  }
});

test("Sentry verification requires explicit production proof before sending", async () => {
  const output = outputCapture();
  let captureCalled = false;
  const exitCode = await runSentryIngestionCheck({
    args: ["--send-production-event"],
    env: configuredEnv({ NODE_ENV: "production", SOURCE_COMMIT: fakeCommit }),
    captureExceptionImpl: async () => {
      captureCalled = true;
      return { ok: true };
    },
    ...output.options,
  });

  assert.equal(exitCode, 1);
  assert.equal(captureCalled, false);
  assert.equal(JSON.parse(output.stderr.join("")).mode, "production_proof_required");
});

test("Sentry verification rejects unknown or duplicate send arguments", async () => {
  for (const args of [
    ["--send-producton-event"],
    [`--expected-commit=${fakeCommit}`, `--expected-commit=${fakeCommit}`],
  ]) {
    const output = outputCapture();
    const exitCode = await runSentryIngestionCheck({
      args,
      env: configuredEnv(),
      ...output.options,
    });
    assert.equal(exitCode, 1);
    assert.equal(JSON.parse(output.stderr.join("")).mode, "invalid_arguments");
  }
});

test("Sentry verification sends one event only with matching production proof", async () => {
  const output = outputCapture();
  let capturedMarker = null;
  let capturedContext = null;
  const exitCode = await runSentryIngestionCheck({
    args: [
      "--send-production-event",
      "--confirm=RIVT-SENTRY-ROTATION",
      `--expected-commit=${fakeCommit}`,
    ],
    env: configuredEnv({ NODE_ENV: "production", SOURCE_COMMIT: fakeCommit }),
    captureExceptionImpl: async (marker, context) => {
      capturedMarker = marker;
      capturedContext = context;
      return {
        ok: true,
        eventId: "event-id",
        status: 200,
        provider: "sentry",
        host: "sentry.example",
        projectId: "12345",
      };
    },
    ...output.options,
  });

  assert.equal(exitCode, 0);
  assert.match(capturedMarker, /^RIVT Sentry rotation verification /);
  assert.equal(capturedContext.source, "credential_rotation_verification");
  const result = JSON.parse(output.stdout.join(""));
  assert.equal(result.accepted, true);
  assert.equal(result.rotationVerified, false);
  assert.equal(result.eventId, "event-id");
  assert.equal(result.environment, "production");
  assert.equal(result.sourceCommit, fakeCommit);
  assert.match(result.sentAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("Sentry verification contains provider failures without exposing their errors", async () => {
  const output = outputCapture();
  const secretBearingError = "https://private-key@sentry.example/api/123/store?sentry_key=private-key";
  const exitCode = await runSentryIngestionCheck({
    args: [
      "--send-production-event",
      "--confirm=RIVT-SENTRY-ROTATION",
      `--expected-commit=${fakeCommit}`,
    ],
    env: configuredEnv({ NODE_ENV: "production", SOURCE_COMMIT: fakeCommit }),
    captureExceptionImpl: async () => {
      throw new Error(secretBearingError);
    },
    ...output.options,
  });

  assert.equal(exitCode, 1);
  assert.equal(output.stdout.length, 0);
  assert.equal(JSON.parse(output.stderr.join("")).mode, "provider_request_failed");
  assert.equal(output.stderr.join("").includes("private-key"), false);
});
