import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { captureException, errorMonitoringStatus } from "../server/monitoring.js";

const sendFlag = "--send-production-event";
const confirmationFlag = "--confirm=RIVT-SENTRY-ROTATION";
const expectedCommitPrefix = "--expected-commit=";
const commitPattern = /^[a-f0-9]{40}$/i;

function envValue(env, name) {
  const value = env[name]?.trim();
  return value || null;
}

function writeJson(writer, payload) {
  writer(`${JSON.stringify(payload)}\n`);
}

function expectedCommit(args) {
  return args.find((argument) => argument.startsWith(expectedCommitPrefix))
    ?.slice(expectedCommitPrefix.length)
    .trim() || null;
}

function hasInvalidArguments(args) {
  const expectedCommitFlags = args.filter((argument) => argument.startsWith(expectedCommitPrefix));
  return expectedCommitFlags.length > 1
    || args.some((argument) => argument !== sendFlag
      && argument !== confirmationFlag
      && !argument.startsWith(expectedCommitPrefix));
}

export async function runSentryIngestionCheck({
  args = [],
  env = process.env,
  captureExceptionImpl = captureException,
  stdout = (value) => process.stdout.write(value),
  stderr = (value) => process.stderr.write(value),
} = {}) {
  const primaryDsn = envValue(env, "SENTRY_DSN");
  const legacyDsn = envValue(env, "ERROR_MONITORING_DSN");
  const monitoring = errorMonitoringStatus({ env });

  if (!primaryDsn || legacyDsn || !monitoring.ok || monitoring.mode !== "configured") {
    writeJson(stderr, {
      ok: false,
      mode: "invalid_rotation_config",
      provider: monitoring.provider,
      requirements: [
        "SENTRY_DSN must be configured.",
        "ERROR_MONITORING_DSN must be absent.",
      ],
    });
    return 1;
  }

  if (monitoring.provider !== "sentry") {
    writeJson(stderr, {
      ok: false,
      mode: "provider_mismatch",
      requirement: "ERROR_MONITORING_PROVIDER must be sentry.",
    });
    return 1;
  }

  const shouldSend = args.includes(sendFlag);
  const confirmed = args.includes(confirmationFlag);
  const requestedCommit = expectedCommit(args);
  const sourceCommit = envValue(env, "SOURCE_COMMIT");
  const environment = envValue(env, "NODE_ENV");

  if (hasInvalidArguments(args)) {
    writeJson(stderr, {
      ok: false,
      mode: "invalid_arguments",
      requirement: "Use no arguments for a config-only check, or provide the exact documented production-send flags.",
    });
    return 1;
  }

  if (!shouldSend) {
    if (confirmed || requestedCommit) {
      writeJson(stderr, {
        ok: false,
        mode: "incomplete_send_request",
        requirement: `${sendFlag} is required with confirmation and expected commit flags.`,
      });
      return 1;
    }
    writeJson(stdout, {
      ok: true,
      dryRun: true,
      provider: monitoring.provider,
      host: monitoring.host,
      projectId: monitoring.projectId,
      next: `To send one approved event, add ${sendFlag}, ${confirmationFlag}, and ${expectedCommitPrefix}<40-character-production-commit>.`,
    });
    return 0;
  }

  if (!confirmed
    || environment !== "production"
    || !sourceCommit
    || !commitPattern.test(sourceCommit)
    || !requestedCommit
    || !commitPattern.test(requestedCommit)
    || requestedCommit.toLowerCase() !== sourceCommit.toLowerCase()) {
    writeJson(stderr, {
      ok: false,
      mode: "production_proof_required",
      requirements: [
        confirmationFlag,
        "NODE_ENV must equal production.",
        "SOURCE_COMMIT must be the exact 40-character production commit.",
        `${expectedCommitPrefix} must match SOURCE_COMMIT exactly.`,
      ],
    });
    return 1;
  }

  const verificationId = randomUUID();
  const marker = `RIVT Sentry rotation verification ${verificationId}`;
  const sentAt = new Date().toISOString();

  let result;
  try {
    result = await captureExceptionImpl(marker, {
      source: "credential_rotation_verification",
      verificationId,
    }, { env });
  } catch {
    writeJson(stderr, {
      ok: false,
      mode: "provider_request_failed",
      marker,
      environment,
      sourceCommit,
      sentAt,
      next: "Search Sentry for this exact marker before retrying. Do not retire the previous client key unless the event and its alert are confirmed.",
    });
    return 1;
  }

  writeJson(result.ok ? stdout : stderr, {
    accepted: result.ok,
    rotationVerified: false,
    marker,
    eventId: result.eventId,
    status: result.status,
    provider: result.provider,
    host: result.host,
    projectId: result.projectId,
    environment,
    sourceCommit,
    sentAt,
    next: result.ok
      ? "Confirm this exact marker and its alert in Sentry before retiring the previous client key."
      : "Do not retire the previous client key.",
  });

  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runSentryIngestionCheck({ args: process.argv.slice(2) });
}
