"use strict";

const fs = require("node:fs");

const BACKUP_FRESHNESS_INCIDENT_MARKER = "<!-- rivt-backup-freshness-incident -->";
const BACKUP_FRESHNESS_INCIDENT_TITLE = "Production backup freshness check failing";
const PRODUCTION_REPOSITORY = "Zboytjbxp/rivt";
const TRUSTED_AUTOMATION_LOGIN = "github-actions[bot]";
const MAX_BACKUP_AGE_HOURS = 14;
const MIN_RETENTION_DAYS = 30;

function expectedRepositoryUrl(repository) {
  return `https://api.github.com/repos/${repository}`;
}

function hasExactMarker(body) {
  return typeof body === "string"
    && body.split(/\r?\n/, 1)[0] === BACKUP_FRESHNESS_INCIDENT_MARKER;
}

function findOwnedBackupFreshnessIncident(issues, repository = PRODUCTION_REPOSITORY) {
  if (repository !== PRODUCTION_REPOSITORY || !Array.isArray(issues)) return undefined;
  const repositoryUrl = expectedRepositoryUrl(repository);

  return issues.find((issue) => (
    !issue.pull_request
      && issue.title === BACKUP_FRESHNESS_INCIDENT_TITLE
      && hasExactMarker(issue.body)
      && issue.repository_url === repositoryUrl
      && issue.user?.login === TRUSTED_AUTOMATION_LOGIN
      && issue.user?.type === "Bot"
  ));
}

function safeIsoDate(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeNumber(value, minimum, maximum) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? Number(value.toFixed(3))
    : null;
}

function safeErrorCode(value) {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(value)
    ? value
    : "SUMMARY_INVALID";
}

function failedSummary(errorCode = "SUMMARY_INVALID") {
  return {
    ok: false,
    mode: "verify-logical-backup",
    errorCode,
  };
}

function sanitizeBackupFreshnessSummary(raw, now = new Date()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return failedSummary();
  if (raw.ok !== true || raw.mode !== "verify-logical-backup") {
    return failedSummary(safeErrorCode(raw.errorCode));
  }

  const reportedAgeHours = safeNumber(raw.ageHours, 0, 1_000_000);
  const retentionDays = safeNumber(raw.retentionDays, MIN_RETENTION_DAYS, 36_500);
  const createdAt = safeIsoDate(raw.createdAt);
  const uploadedAt = safeIsoDate(raw.uploadedAt);
  const retentionUntil = safeIsoDate(raw.retentionUntil);
  const sourceCommit = typeof raw.sourceCommit === "string" && /^[0-9a-f]{40}$/i.test(raw.sourceCommit)
    ? raw.sourceCommit.toLowerCase()
    : null;
  const checkedAt = now instanceof Date && Number.isFinite(now.getTime())
    ? now.toISOString()
    : null;

  if (!checkedAt || reportedAgeHours === null || retentionDays === null || !createdAt || !uploadedAt || !retentionUntil || !sourceCommit) {
    return failedSummary();
  }

  const nowMs = now.getTime();
  const createdAtMs = Date.parse(createdAt);
  const uploadedAtMs = Date.parse(uploadedAt);
  const retentionUntilMs = Date.parse(retentionUntil);
  const minimumRetentionMs = MIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const computedAgeHours = Math.max(
    0,
    (nowMs - createdAtMs) / (60 * 60 * 1000),
    (nowMs - uploadedAtMs) / (60 * 60 * 1000),
  );
  if (
    computedAgeHours > MAX_BACKUP_AGE_HOURS
      || Math.abs(reportedAgeHours - computedAgeHours) > 0.05
      || createdAtMs > nowMs + (5 * 60 * 1000)
      || uploadedAtMs > nowMs + (5 * 60 * 1000)
      || Math.abs(createdAtMs - uploadedAtMs) > 15 * 60 * 1000
      || retentionUntilMs < uploadedAtMs + minimumRetentionMs
      || retentionUntilMs <= nowMs
  ) {
    return failedSummary("SUMMARY_POLICY_VIOLATION");
  }

  return {
    ok: true,
    mode: "verify-logical-backup",
    checkedAt,
    ageHours: Number(computedAgeHours.toFixed(3)),
    createdAt,
    uploadedAt,
    retentionUntil,
    retentionDays,
    sourceCommit,
  };
}

function parseAndSanitizeBackupFreshnessSummary(text, now = new Date()) {
  try {
    return sanitizeBackupFreshnessSummary(JSON.parse(text), now);
  } catch {
    return failedSummary();
  }
}

function alertTestSummary(now = new Date()) {
  return {
    ok: false,
    mode: "backup-freshness-alert-test",
    errorCode: "ALERT_TEST_REQUESTED",
    checkedAt: now.toISOString(),
  };
}

function sanitizeIncidentSummary(raw, now = new Date()) {
  if (
    raw?.ok === false
      && raw.mode === "backup-freshness-alert-test"
      && raw.errorCode === "ALERT_TEST_REQUESTED"
  ) {
    const checkedAt = safeIsoDate(raw.checkedAt);
    return checkedAt ? {
      ok: false,
      mode: "backup-freshness-alert-test",
      errorCode: "ALERT_TEST_REQUESTED",
      checkedAt,
    } : failedSummary();
  }
  return sanitizeBackupFreshnessSummary(raw, now);
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function runCli(argv) {
  const [command, inputPath, outputPath] = argv;
  if (command === "sanitize" && inputPath && outputPath) {
    let raw = "";
    try {
      raw = fs.readFileSync(inputPath, "utf8");
    } catch {
      // Missing verifier output is represented as a sanitized failure.
    }
    writeJson(outputPath, parseAndSanitizeBackupFreshnessSummary(raw));
    return;
  }
  if (command === "alert-test" && inputPath && !outputPath) {
    writeJson(inputPath, alertTestSummary());
    return;
  }
  throw new Error("Usage: backup-freshness-issue.cjs sanitize <input> <output> | alert-test <output>");
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch {
    process.exitCode = 1;
  }
}

module.exports = {
  BACKUP_FRESHNESS_INCIDENT_MARKER,
  BACKUP_FRESHNESS_INCIDENT_TITLE,
  MAX_BACKUP_AGE_HOURS,
  MIN_RETENTION_DAYS,
  PRODUCTION_REPOSITORY,
  TRUSTED_AUTOMATION_LOGIN,
  alertTestSummary,
  findOwnedBackupFreshnessIncident,
  parseAndSanitizeBackupFreshnessSummary,
  sanitizeIncidentSummary,
  sanitizeBackupFreshnessSummary,
};
