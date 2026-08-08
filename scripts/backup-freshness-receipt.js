import path from "node:path";
import { pathToFileURL } from "node:url";

export const BACKUP_MONITOR_ERROR_CODES = Object.freeze([
  "BACKUP_ALERT_TEST",
  "BACKUP_CONFIG_INVALID",
  "BACKUP_DESTINATION_UNSAFE",
  "BACKUP_NOT_FRESH",
  "BACKUP_OBJECT_INVALID",
  "BACKUP_OPERATION_FAILED",
  "BACKUP_PROVIDER_CHECK_FAILED",
  "BACKUP_SOURCE_MISMATCH",
]);

const ERROR_CODE_SET = new Set(BACKUP_MONITOR_ERROR_CODES);
const SUCCESS_MODES = new Set(["backup-freshness-monitor"]);
const FAILURE_MODES = new Set(["backup-freshness-monitor"]);
const MAX_RECEIPT_BYTES = 16 * 1024;
const MIN_RETENTION_DAYS = 30;
const MAX_FRESHNESS_HOURS = 14;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;
const MAX_CREATE_UPLOAD_SKEW_MS = 15 * 60_000;
const MAX_MONITOR_DURATION_MS = 10 * 60_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

const SUCCESS_KEYS = Object.freeze([
  "ageHours",
  "artifactIdentitySha256",
  "createdAt",
  "destinationIdentitySha256",
  "durationMs",
  "encryptionKeyMode",
  "mode",
  "ok",
  "retentionDays",
  "retentionUntil",
  "rowCount",
  "sourceCommit",
  "tableCount",
  "uploadedAt",
]);
const FAILURE_KEYS = Object.freeze(["errorCode", "message", "mode", "ok"]);

export class BackupMonitorReceiptError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackupMonitorReceiptError";
    this.code = "BACKUP_OPERATION_FAILED";
  }
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, keys) {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function requiredExpectedCommit(expectedSourceCommit) {
  const normalized = typeof expectedSourceCommit === "string"
    ? expectedSourceCommit.trim().toLowerCase()
    : "";
  if (!COMMIT_PATTERN.test(normalized)) {
    throw new BackupMonitorReceiptError("Expected backup source commit is invalid.");
  }
  return normalized;
}

function canonicalTimestamp(value, name) {
  if (typeof value !== "string") {
    throw new BackupMonitorReceiptError(`${name} is invalid.`);
  }
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    throw new BackupMonitorReceiptError(`${name} is invalid.`);
  }
  return timestamp;
}

function finiteNumber(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BackupMonitorReceiptError(`${name} is invalid.`);
  }
  return value;
}

function validateFailureReceipt(receipt) {
  if (!hasExactKeys(receipt, FAILURE_KEYS) || receipt.ok !== false) {
    throw new BackupMonitorReceiptError("Failure receipt shape is invalid.");
  }
  if (!FAILURE_MODES.has(receipt.mode) || !ERROR_CODE_SET.has(receipt.errorCode)) {
    throw new BackupMonitorReceiptError("Failure receipt code is invalid.");
  }
  if (typeof receipt.message !== "string" || receipt.message.length > 512) {
    throw new BackupMonitorReceiptError("Failure receipt message is invalid.");
  }
  return Object.freeze({ ok: false, errorCode: receipt.errorCode });
}

function validateSuccessReceipt(receipt, { expectedSourceCommit, now }) {
  if (!hasExactKeys(receipt, SUCCESS_KEYS) || receipt.ok !== true) {
    throw new BackupMonitorReceiptError("Success receipt shape is invalid.");
  }
  if (!SUCCESS_MODES.has(receipt.mode)) {
    throw new BackupMonitorReceiptError("Success receipt mode is invalid.");
  }

  const expectedCommit = requiredExpectedCommit(expectedSourceCommit);
  if (receipt.sourceCommit !== expectedCommit || !COMMIT_PATTERN.test(receipt.sourceCommit)) {
    throw new BackupMonitorReceiptError("Backup source commit does not match the reviewed commit.");
  }
  if (receipt.encryptionKeyMode !== "active-only") {
    throw new BackupMonitorReceiptError("Backup receipt is not bound to the active encryption key.");
  }
  if (
    !SHA256_PATTERN.test(receipt.destinationIdentitySha256)
    || !SHA256_PATTERN.test(receipt.artifactIdentitySha256)
  ) {
    throw new BackupMonitorReceiptError("Backup object identity is invalid.");
  }

  const ageHours = finiteNumber(receipt.ageHours, "ageHours");
  if (ageHours < 0 || ageHours > MAX_FRESHNESS_HOURS) {
    throw new BackupMonitorReceiptError("Backup receipt is outside the freshness window.");
  }
  if (
    !Number.isSafeInteger(receipt.durationMs)
    || receipt.durationMs < 0
    || receipt.durationMs > MAX_MONITOR_DURATION_MS
  ) {
    throw new BackupMonitorReceiptError("Backup receipt duration is invalid.");
  }
  if (!Number.isSafeInteger(receipt.retentionDays) || receipt.retentionDays < MIN_RETENTION_DAYS) {
    throw new BackupMonitorReceiptError("Backup retention is below policy.");
  }
  if (!Number.isSafeInteger(receipt.tableCount) || receipt.tableCount <= 0) {
    throw new BackupMonitorReceiptError("Backup table count is invalid.");
  }
  if (!Number.isSafeInteger(receipt.rowCount) || receipt.rowCount <= 0) {
    throw new BackupMonitorReceiptError("Backup row count is invalid.");
  }

  const currentTime = typeof now === "function" ? now() : now;
  if (!Number.isFinite(currentTime)) {
    throw new BackupMonitorReceiptError("Receipt validation time is invalid.");
  }
  const createdAt = canonicalTimestamp(receipt.createdAt, "createdAt");
  const uploadedAt = canonicalTimestamp(receipt.uploadedAt, "uploadedAt");
  const retentionUntil = canonicalTimestamp(receipt.retentionUntil, "retentionUntil");
  const createdMs = createdAt.getTime();
  const uploadedMs = uploadedAt.getTime();
  if (
    createdMs > currentTime + MAX_FUTURE_SKEW_MS
    || uploadedMs > currentTime + MAX_FUTURE_SKEW_MS
    || Math.abs(uploadedMs - createdMs) > MAX_CREATE_UPLOAD_SKEW_MS
  ) {
    throw new BackupMonitorReceiptError("Backup timestamps are inconsistent.");
  }
  const calculatedAgeHours = Math.max(currentTime - createdMs, currentTime - uploadedMs) / 3_600_000;
  if (calculatedAgeHours > MAX_FRESHNESS_HOURS) {
    throw new BackupMonitorReceiptError("Backup timestamps are stale.");
  }
  const maximumAgeDriftHours = receipt.durationMs / 3_600_000 + 0.002;
  if (Math.abs(ageHours - Math.max(0, calculatedAgeHours)) > maximumAgeDriftHours) {
    throw new BackupMonitorReceiptError("Reported backup age does not match its timestamps.");
  }
  if (retentionUntil.getTime() < uploadedMs + receipt.retentionDays * 86_400_000) {
    throw new BackupMonitorReceiptError("Backup retention deadline is inconsistent.");
  }

  return Object.freeze({
    ok: true,
    mode: "backup-freshness-monitor",
    sourceCommit: receipt.sourceCommit,
    createdAt: receipt.createdAt,
    uploadedAt: receipt.uploadedAt,
    ageHours,
    retentionDays: receipt.retentionDays,
    retentionUntil: receipt.retentionUntil,
    encryptionKeyMode: "active-only",
    destinationIdentitySha256: receipt.destinationIdentitySha256,
    artifactIdentitySha256: receipt.artifactIdentitySha256,
    tableCount: receipt.tableCount,
    rowCount: receipt.rowCount,
    durationMs: receipt.durationMs,
  });
}

export function validateBackupMonitorReceipt(receipt, {
  expectedSourceCommit,
  now = Date.now(),
} = {}) {
  if (!isPlainRecord(receipt) || typeof receipt.ok !== "boolean") {
    throw new BackupMonitorReceiptError("Backup monitor receipt is not a JSON object.");
  }
  return receipt.ok
    ? validateSuccessReceipt(receipt, { expectedSourceCommit, now })
    : validateFailureReceipt(receipt);
}

export function safeBackupMonitorReceipt(receipt, options = {}) {
  try {
    return validateBackupMonitorReceipt(receipt, options);
  } catch {
    return Object.freeze({ ok: false, errorCode: "BACKUP_OPERATION_FAILED" });
  }
}

export async function readBackupMonitorReceipt(stream = process.stdin, maxBytes = MAX_RECEIPT_BYTES) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new BackupMonitorReceiptError("Backup monitor receipt exceeds the safe input limit.");
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const parsed = JSON.parse(raw);
  if (!isPlainRecord(parsed)) {
    throw new BackupMonitorReceiptError("Backup monitor receipt is not a JSON object.");
  }
  return parsed;
}

export async function runBackupMonitorReceiptCli({
  env = process.env,
  input = process.stdin,
  output = process.stdout,
  now = Date.now(),
} = {}) {
  let safeReceipt;
  try {
    const receipt = await readBackupMonitorReceipt(input);
    safeReceipt = safeBackupMonitorReceipt(receipt, {
      expectedSourceCommit: env.BACKUP_EXPECTED_SOURCE_COMMIT,
      now,
    });
  } catch {
    safeReceipt = { ok: false, errorCode: "BACKUP_OPERATION_FAILED" };
  }
  output.write(`${JSON.stringify(safeReceipt)}\n`);
  return safeReceipt.ok ? 0 : 1;
}

function isDirectExecution(metaUrl) {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === metaUrl;
}

if (isDirectExecution(import.meta.url)) {
  process.exitCode = await runBackupMonitorReceiptCli();
}
