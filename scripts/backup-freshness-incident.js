import { BACKUP_MONITOR_ERROR_CODES } from "./backup-freshness-receipt.js";

export const BACKUP_INCIDENT_TITLE = "Production backup freshness check failing";
export const BACKUP_INCIDENT_MARKER = "<!-- rivt-backup-freshness-incident:v1 -->";
export const BACKUP_INCIDENT_LABEL = "ops:backup-freshness";
export const GITHUB_ACTIONS_BOT_LOGIN = "github-actions[bot]";

const ERROR_CODE_SET = new Set(BACKUP_MONITOR_ERROR_CODES);

export class BackupIncidentOwnershipError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackupIncidentOwnershipError";
    this.code = "BACKUP_INCIDENT_OWNERSHIP_AMBIGUOUS";
  }
}

function issueLabelNames(issue) {
  if (!Array.isArray(issue?.labels)) return [];
  return issue.labels.flatMap((label) => {
    if (typeof label === "string") return [label];
    if (label && typeof label.name === "string") return [label.name];
    return [];
  });
}

export function isOwnedBackupIncident(issue) {
  return Boolean(
    issue
    && typeof issue === "object"
    && !issue.pull_request
    && issue.title === BACKUP_INCIDENT_TITLE
    && typeof issue.body === "string"
    && issue.body.includes(BACKUP_INCIDENT_MARKER)
    && issue.user?.login === GITHUB_ACTIONS_BOT_LOGIN
    && issue.user?.type === "Bot"
    && issueLabelNames(issue).includes(BACKUP_INCIDENT_LABEL),
  );
}

export function selectOwnedBackupIncident(issues) {
  if (!Array.isArray(issues)) {
    throw new BackupIncidentOwnershipError("GitHub issue inventory is invalid.");
  }
  const owned = issues.filter(isOwnedBackupIncident);
  if (owned.length > 1) {
    throw new BackupIncidentOwnershipError("Multiple owned backup incidents were found.");
  }
  return owned[0] ?? null;
}

export function backupIncidentAction({ issues, alertTest = false, monitorSucceeded = false } = {}) {
  if (typeof alertTest !== "boolean" || typeof monitorSucceeded !== "boolean") {
    throw new BackupIncidentOwnershipError("Backup incident state is invalid.");
  }
  const incident = selectOwnedBackupIncident(issues);
  if (alertTest) {
    return Object.freeze({ action: incident ? "update" : "create", incident });
  }
  if (monitorSucceeded) {
    return Object.freeze({ action: incident ? "close" : "none", incident });
  }
  return Object.freeze({ action: incident ? "update" : "create", incident });
}

function safeRunUrl(runUrl) {
  if (typeof runUrl !== "string" || runUrl.length > 300) return "GitHub Actions run unavailable";
  let parsed;
  try {
    parsed = new URL(runUrl);
  } catch {
    return "GitHub Actions run unavailable";
  }
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "github.com"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+$/.test(parsed.pathname)
  ) {
    return "GitHub Actions run unavailable";
  }
  return parsed.href;
}

export function buildBackupIncidentBody({ runUrl, errorCode, alertTest = false } = {}) {
  const normalizedCode = ERROR_CODE_SET.has(errorCode) ? errorCode : "BACKUP_OPERATION_FAILED";
  const signal = alertTest
    ? "The explicit backup freshness alert test was requested."
    : "RIVT's independent production backup freshness check failed.";
  return [
    BACKUP_INCIDENT_MARKER,
    "",
    signal,
    "",
    `Run: ${safeRunUrl(runUrl)}`,
    `Monitor code: ${normalizedCode}`,
    "",
    "Immediate response:",
    "1. Keep the launch hold active.",
    "2. Inspect only the sanitized workflow receipt and private provider configuration.",
    "3. Do not rotate or remove a backup key until a new active-key artifact verifies and restores exactly.",
    "4. Close this issue only through a later normal successful monitor run.",
    "",
  ].join("\n");
}
