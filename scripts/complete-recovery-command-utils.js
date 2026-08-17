import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client } from "@aws-sdk/client-s3";
import {
  RecoveryError,
  parseRecoveryMasterKey,
} from "./recovery-object-utils.js";
import {
  assertRecoveryS3StoreSeparation,
  recoveryS3CoordinateIdentitySha256,
} from "./recovery-s3-store.js";
import {
  assertNodeTlsVerificationEnabled,
  requiredSourceCommit,
} from "./logical-backup-utils.js";

const DAY_MS = 86_400_000;
const MINIMUM_RETENTION_DAYS = 30;
const MAXIMUM_CREATE_RETENTION_DAYS = 31;
const MAXIMUM_WRITE_WINDOW_MS = 60 * 60 * 1000;
const RESTRICTED_RECEIPT_BYTES = 16 * 1024;
const RECOVERY_ROLES = Object.freeze(["source", "destination", "reader", "restore"]);
const RAILWAY_RUNTIME_MARKERS = Object.freeze([
  "RAILWAY_PROJECT_ID",
  "RAILWAY_ENVIRONMENT_ID",
  "RAILWAY_SERVICE_ID",
  "RAILWAY_DEPLOYMENT_ID",
]);
const RECOVERY_RUNTIME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECOVERY_RUNTIME_FIXED_FILES = Object.freeze([
  "package.json",
  "package-lock.json",
]);
const RECOVERY_RUNTIME_DIRECTORIES = Object.freeze(["scripts", "server", "migrations"]);
const RECOVERY_RUNTIME_PATHSPECS = Object.freeze([
  ...RECOVERY_RUNTIME_FIXED_FILES,
  ...RECOVERY_RUNTIME_DIRECTORIES,
]);

export const COMPLETE_RECOVERY_LIMITS = Object.freeze({
  maxObjects: 10_000,
  maxObjectBytes: 10 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
  concurrency: 2,
  maxReadAttempts: 3,
  maximumInventoryPages: 1_000,
  restoreBatchSize: 200,
  rtoMinutes: 240,
});

const FORBIDDEN_LIMIT_OVERRIDES = Object.freeze([
  "COMPLETE_RECOVERY_MAX_OBJECTS",
  "COMPLETE_RECOVERY_MAX_OBJECT_BYTES",
  "COMPLETE_RECOVERY_MAX_TOTAL_BYTES",
  "COMPLETE_RECOVERY_CONCURRENCY",
  "COMPLETE_RECOVERY_MAX_READ_ATTEMPTS",
  "COMPLETE_RECOVERY_MAX_INVENTORY_PAGES",
  "COMPLETE_RECOVERY_RESTORE_BATCH_SIZE",
  "COMPLETE_RECOVERY_RTO_MINUTES",
]);

const PREDECESSOR_KEY_NAMES = Object.freeze([
  "BACKUP_ENCRYPTION_KEY_PREVIOUS",
  "RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS",
  "COMPLETE_RECOVERY_KEY_PREVIOUS",
]);

function commandError(code, message) {
  return new RecoveryError(code, message);
}

function exactConfigured(env, name, { allowEmpty = false } = {}) {
  if (!Object.prototype.hasOwnProperty.call(env, name) || typeof env[name] !== "string") {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", `${name} must be explicitly configured.`);
  }
  const value = env[name];
  if (value !== value.trim() || (!allowEmpty && !value)) {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", `${name} must be an exact configured value.`);
  }
  if (value.includes("\0") || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", `${name} contains a disallowed control character.`);
  }
  return value;
}

function exactProviderVersionConfigured(env, name) {
  if (!Object.prototype.hasOwnProperty.call(env, name) || typeof env[name] !== "string") {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", `${name} must be explicitly configured.`);
  }
  const value = env[name];
  if (
    !value
    || value.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(value)
    || value.toLowerCase() === "null"
    || Buffer.byteLength(value, "utf8") > 1_024
  ) {
    throw commandError("RECOVERY_REFERENCE_INVALID", `${name} is not an exact provider version ID.`);
  }
  return value;
}

function optionalExact(env, name) {
  if (!Object.prototype.hasOwnProperty.call(env, name) || env[name] === undefined) return undefined;
  return exactConfigured(env, name);
}

function exactConfirmation(env, name) {
  let value;
  try {
    value = exactConfigured(env, name);
  } catch {
    value = undefined;
  }
  if (value !== "true") {
    throw commandError("RECOVERY_CONFIRMATION_REQUIRED", `${name}=true is required.`);
  }
}

function exactBoolean(env, name) {
  const value = exactConfigured(env, name);
  if (value !== "true" && value !== "false") {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", `${name} must be true or false.`);
  }
  return value === "true";
}

function exactSha256(env, name) {
  const digest = exactConfigured(env, name);
  if (!/^[a-f0-9]{64}$/u.test(digest)) {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", `${name} must be a lowercase SHA-256 value.`);
  }
  return digest;
}

function equalDigest(left, right) {
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function canonicalTime(value, name) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", `${name} must be a canonical UTC timestamp.`);
  }
  return parsed;
}

function currentDate(now) {
  if (typeof now !== "function") {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", "The recovery clock must be a function.");
  }
  const current = now();
  if (!(current instanceof Date) || !Number.isFinite(current.getTime())) {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", "The recovery clock must return a valid Date.");
  }
  return current;
}

function rejectLimitOverrides(env) {
  const configured = FORBIDDEN_LIMIT_OVERRIDES.filter((name) => (
    Object.prototype.hasOwnProperty.call(env, name)
    && String(env[name] ?? "").trim()
  ));
  if (configured.length) {
    throw commandError(
      "RECOVERY_LIMIT_OVERRIDE_FORBIDDEN",
      "Complete-recovery safety limits are fixed in reviewed source and cannot be overridden.",
    );
  }
}

function strictActiveKey(env) {
  for (const name of PREDECESSOR_KEY_NAMES) {
    if (String(env[name] ?? "").trim()) {
      throw commandError(
        "RECOVERY_PREDECESSOR_KEY_FORBIDDEN",
        "Complete-recovery evidence requires the predecessor key to be absent.",
      );
    }
  }
  const active = exactConfigured(env, "BACKUP_ENCRYPTION_KEY");
  parseRecoveryMasterKey(active);
  return active;
}

function ordinalCompare(left, right) {
  return Buffer.compare(
    Buffer.from(left, "utf8"),
    Buffer.from(right, "utf8"),
  );
}

function ordinalSort(values) {
  return values.sort(ordinalCompare);
}

function recoveryRuntimeRelativeFiles() {
  const files = [...RECOVERY_RUNTIME_FIXED_FILES];
  function visit(directory, relativeDirectory) {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => ordinalCompare(left.name, right.name));
    for (const entry of entries) {
      const { name } = entry;
      if (entry.isSymbolicLink()) {
        throw commandError(
          "RECOVERY_SOURCE_REVISION_MISMATCH",
          "The recovery runtime source tree contains an unsupported entry.",
        );
      }
      const relativePath = `${relativeDirectory}/${name}`;
      const absolutePath = join(directory, name);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else if (entry.isFile()) files.push(relativePath);
      else {
        throw commandError(
          "RECOVERY_SOURCE_REVISION_MISMATCH",
          "The recovery runtime source tree contains an unsupported entry.",
        );
      }
    }
  }
  for (const directory of RECOVERY_RUNTIME_DIRECTORIES) {
    visit(join(RECOVERY_RUNTIME_ROOT, directory), directory);
  }
  return ordinalSort(files);
}

function canonicalRuntimeSourceBytes(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw commandError(
      "RECOVERY_SOURCE_REVISION_MISMATCH",
      "Recovery runtime source files must be valid UTF-8 text.",
    );
  }
  return Buffer.from(text.replace(/\r\n?/gu, "\n"), "utf8");
}

export function recoveryRuntimeSourceIdentitySha256({
  readRuntimeFile = (relativePath) => readFileSync(join(RECOVERY_RUNTIME_ROOT, relativePath)),
} = {}) {
  if (typeof readRuntimeFile !== "function") {
    throw commandError(
      "RECOVERY_SOURCE_REVISION_MISMATCH",
      "The recovery runtime source reader is unavailable.",
    );
  }
  const hash = crypto.createHash("sha256");
  for (const relativePath of recoveryRuntimeRelativeFiles()) {
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(canonicalRuntimeSourceBytes(readRuntimeFile(relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

export function defaultRuntimeSourceProbe({ execute = execFileSync } = {}) {
  try {
    const status = execute(
      "git",
      [
        "-C",
        RECOVERY_RUNTIME_ROOT,
        "status",
        "--porcelain",
        "--untracked-files=all",
        "--",
        ...RECOVERY_RUNTIME_PATHSPECS,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    if (status) throw new Error("tracked changes present");
    const topLevel = execute(
      "git",
      ["-C", RECOVERY_RUNTIME_ROOT, "rev-parse", "--show-toplevel"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (resolve(topLevel) !== RECOVERY_RUNTIME_ROOT) throw new Error("unexpected repository root");
    return execute(
      "git",
      ["-C", RECOVERY_RUNTIME_ROOT, "rev-parse", "HEAD"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim().toLowerCase();
  } catch {
    throw commandError(
      "RECOVERY_SOURCE_REVISION_MISMATCH",
      "The exact clean recovery runtime source could not be attested.",
    );
  }
}

function exactSourceRevision(env, runtimeSourceProbe) {
  const sourceCommit = requiredSourceCommit(env);
  const runtimeCommit = exactConfigured(env, "COMPLETE_RECOVERY_RUNTIME_SOURCE_COMMIT").toLowerCase();
  const reviewedRuntimeIdentity = exactSha256(env, "COMPLETE_RECOVERY_REVIEWED_RUNTIME_SHA256");
  const observedRuntimeIdentity = recoveryRuntimeSourceIdentitySha256();
  if (!equalDigest(reviewedRuntimeIdentity, observedRuntimeIdentity)) {
    throw commandError(
      "RECOVERY_SOURCE_REVISION_MISMATCH",
      "The recovery runtime files differ from the reviewed source identity.",
    );
  }
  const railwayCommit = String(env.RAILWAY_GIT_COMMIT_SHA ?? "").trim().toLowerCase();
  const railwayMarkersPresent = RAILWAY_RUNTIME_MARKERS.filter((name) => (
    typeof env[name] === "string" && env[name].trim()
  ));
  if (railwayMarkersPresent.length && railwayMarkersPresent.length !== RAILWAY_RUNTIME_MARKERS.length) {
    throw commandError(
      "RECOVERY_SOURCE_REVISION_MISMATCH",
      "A partial Railway runtime identity cannot attest recovery source.",
    );
  }
  const railwayRuntimeAttested = railwayMarkersPresent.length === RAILWAY_RUNTIME_MARKERS.length;
  if (railwayRuntimeAttested) {
    for (const name of RAILWAY_RUNTIME_MARKERS) exactConfigured(env, name);
  }
  const attestedCommit = railwayRuntimeAttested
    ? railwayCommit
    : (runtimeSourceProbe ?? defaultRuntimeSourceProbe)();
  if (
    !/^[a-f0-9]{40}$/u.test(runtimeCommit)
    || !/^[a-f0-9]{40}$/u.test(attestedCommit)
    || runtimeCommit !== sourceCommit
    || attestedCommit !== sourceCommit
  ) {
    throw commandError(
      "RECOVERY_SOURCE_REVISION_MISMATCH",
      "The reviewed source commit and exact recovery runtime commit must match.",
    );
  }
  return sourceCommit;
}

export function completeRecoveryCoordinates(env, role) {
  const namespace = `COMPLETE_RECOVERY_${role.toUpperCase()}_S3`;
  const allowEmptyPrefix = role === "source";
  const coordinates = Object.freeze({
    endpoint: exactConfigured(env, `${namespace}_ENDPOINT`),
    region: exactConfigured(env, `${namespace}_REGION`),
    bucket: exactConfigured(env, `${namespace}_BUCKET`),
    basePrefix: exactConfigured(env, `${namespace}_PREFIX`, { allowEmpty: allowEmptyPrefix }),
    forcePathStyle: exactBoolean(env, `${namespace}_FORCE_PATH_STYLE`),
  });
  if (role === "source" && coordinates.basePrefix !== "") {
    throw commandError(
      "RECOVERY_COMMAND_CONFIG_INVALID",
      "The dedicated application-object source must be inventoried from the bucket root.",
    );
  }
  const identitySha256 = recoveryS3CoordinateIdentitySha256(coordinates, { allowEmptyPrefix });
  const expected = exactSha256(env, `${namespace}_COORDINATE_SHA256`);
  if (!equalDigest(identitySha256, expected)) {
    throw commandError(
      "RECOVERY_COORDINATE_BINDING_MISMATCH",
      `The exact ${role} store coordinates do not match their reviewed binding.`,
    );
  }
  return Object.freeze({ coordinates, identitySha256 });
}

function distinctCoordinateBindings([source, destination, restore]) {
  try {
    assertRecoveryS3StoreSeparation({
      sourceStore: source,
      destinationStore: destination,
      restoreStore: restore,
    });
  } catch {
    throw commandError(
      "RECOVERY_STORE_COLLISION",
      "Recovery source, protected destination, and isolated restore namespaces must not overlap.",
    );
  }
}

function reviewedRoleAccessKeyIds(env) {
  const ids = Object.fromEntries(RECOVERY_ROLES.map((role) => [
    role,
    exactConfigured(env, `COMPLETE_RECOVERY_${role.toUpperCase()}_S3_ACCESS_KEY_ID`),
  ]));
  if (new Set(Object.values(ids)).size !== RECOVERY_ROLES.length) {
    throw commandError(
      "RECOVERY_CREDENTIAL_COLLISION",
      "All four recovery roles must use distinct reviewed credential identities.",
    );
  }
  const ambientApplicationId = String(env.S3_ACCESS_KEY_ID ?? "").trim();
  if (ambientApplicationId && Object.values(ids).includes(ambientApplicationId)) {
    throw commandError(
      "RECOVERY_CREDENTIAL_COLLISION",
      "Application storage credentials cannot be reused by recovery roles.",
    );
  }
  return Object.freeze(ids);
}

function reviewedPrincipalIdentities(env) {
  const identities = Object.fromEntries(RECOVERY_ROLES.map((role) => [
    role,
    exactSha256(env, `COMPLETE_RECOVERY_${role.toUpperCase()}_PRINCIPAL_IDENTITY_SHA256`),
  ]));
  const application = exactSha256(
    env,
    "COMPLETE_RECOVERY_APPLICATION_STORAGE_PRINCIPAL_IDENTITY_SHA256",
  );
  if (new Set([...Object.values(identities), application]).size !== RECOVERY_ROLES.length + 1) {
    throw commandError(
      "RECOVERY_PRINCIPAL_COLLISION",
      "Recovery principals must be distinct from each other and the application runtime.",
    );
  }
  const setSha256 = crypto.createHash("sha256")
    .update(JSON.stringify({ application, ...identities }), "utf8")
    .digest("hex");
  return Object.freeze({ ...identities, application, setSha256 });
}

export function completeRecoveryCredentials(env, role) {
  const namespace = `COMPLETE_RECOVERY_${role.toUpperCase()}_S3`;
  const sessionToken = optionalExact(env, `${namespace}_SESSION_TOKEN`);
  return Object.freeze({
    accessKeyId: exactConfigured(env, `${namespace}_ACCESS_KEY_ID`),
    secretAccessKey: exactConfigured(env, `${namespace}_SECRET_ACCESS_KEY`),
    ...(sessionToken ? { sessionToken } : {}),
  });
}

export function assertDistinctCredentials(credentials) {
  if (new Set(credentials.map((entry) => entry.accessKeyId)).size !== credentials.length) {
    throw commandError(
      "RECOVERY_CREDENTIAL_COLLISION",
      "Every active recovery role must use a distinct credential identity.",
    );
  }
}

function retentionFloor(env, operation, now) {
  const name = "COMPLETE_RECOVERY_MINIMUM_RETENTION_UNTIL";
  const floor = canonicalTime(exactConfigured(env, name), name);
  const delta = floor.getTime() - now.getTime();
  if (operation === "create") {
    if (delta < MINIMUM_RETENTION_DAYS * DAY_MS || delta > MAXIMUM_CREATE_RETENTION_DAYS * DAY_MS) {
      throw commandError(
        "RECOVERY_RETENTION_INVALID",
        "A one-shot create must require between 30 and 31 days of remaining COMPLIANCE retention.",
      );
    }
  } else if (delta < 0) {
    throw commandError(
      "RECOVERY_RETENTION_INVALID",
      "Restore verification requires a retention floor that has not elapsed.",
    );
  }
  return floor.toISOString();
}

function exactWriteWindow(env, now) {
  const startName = "COMPLETE_RECOVERY_WRITE_WINDOW_START_AT";
  const endName = "COMPLETE_RECOVERY_WRITE_WINDOW_END_AT";
  const start = canonicalTime(exactConfigured(env, startName), startName);
  const end = canonicalTime(exactConfigured(env, endName), endName);
  if (
    end <= start
    || end.getTime() - start.getTime() > MAXIMUM_WRITE_WINDOW_MS
    || now < start
    || now >= end
  ) {
    throw commandError(
      "RECOVERY_WRITE_WINDOW_CLOSED",
      "The exact one-shot immutable-write window is closed or exceeds one hour.",
    );
  }
  return Object.freeze({ startAt: start.toISOString(), endAt: end.toISOString() });
}

export function completeRecoveryCommandConfig({
  env = process.env,
  operation,
  now = () => new Date(),
  runtimeSourceProbe,
} = {}) {
  if (operation !== "create" && operation !== "restore") {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", "Recovery operation must be create or restore.");
  }
  assertNodeTlsVerificationEnabled(env);
  if (exactConfigured(env, "COMPLETE_RECOVERY_EXECUTION_MODE") !== "one-shot") {
    throw commandError("RECOVERY_CONFIRMATION_REQUIRED", "Only explicit one-shot recovery execution is supported.");
  }
  exactConfirmation(env, "CONFIRM_COMPLETE_RECOVERY_PROVIDER_IO");
  exactConfirmation(env, "CONFIRM_COMPLETE_RECOVERY_PRODUCTION_DATA_READ");
  exactConfirmation(env, "CONFIRM_COMPLETE_RECOVERY_CHARGE_BEARING_ACTION");
  exactConfirmation(env, operation === "create"
    ? "CONFIRM_COMPLETE_RECOVERY_CREATE"
    : "CONFIRM_COMPLETE_RECOVERY_RESTORE");
  if (operation === "create") {
    exactConfirmation(env, "CONFIRM_COMPLETE_RECOVERY_SOURCE_READ_ONLY");
    exactConfirmation(env, "CONFIRM_COMPLETE_RECOVERY_IMMUTABLE_WRITES");
    exactConfigured(env, "DATABASE_URL");
  } else {
    exactConfirmation(env, "CONFIRM_COMPLETE_RECOVERY_TARGETS_ISOLATED");
    exactConfirmation(env, "CONFIRM_RESTORE_TARGET_ISOLATED");
    exactConfirmation(env, "CONFIRM_COMPLETE_RECOVERY_TEMPORARY_DATA_DELETION");
  }
  rejectLimitOverrides(env);
  const current = currentDate(now);
  const source = completeRecoveryCoordinates(env, "source");
  const destination = completeRecoveryCoordinates(env, "destination");
  const restore = completeRecoveryCoordinates(env, "restore");
  distinctCoordinateBindings([source, destination, restore]);
  const accessKeyIds = reviewedRoleAccessKeyIds(env);
  const principalIdentities = reviewedPrincipalIdentities(env);
  return Object.freeze({
    operation,
    sourceCommit: exactSourceRevision(env, runtimeSourceProbe),
    activeKey: strictActiveKey(env),
    minimumRetentionUntil: retentionFloor(env, operation, current),
    ...(operation === "create" ? { writeWindow: exactWriteWindow(env, current) } : {}),
    source,
    destination,
    restore,
    accessKeyIds,
    principalIdentities,
    limits: COMPLETE_RECOVERY_LIMITS,
  });
}

export function exactRecoveryReference(env) {
  const snapshotId = exactConfigured(env, "COMPLETE_RECOVERY_SET_ID");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,79}$/u.test(snapshotId)) {
    throw commandError("RECOVERY_REFERENCE_INVALID", "Recovery set ID is invalid.");
  }
  const versionId = exactProviderVersionConfigured(env, "COMPLETE_RECOVERY_COMPLETION_VERSION_ID");
  const retentionMode = exactConfigured(env, "COMPLETE_RECOVERY_COMPLETION_RETENTION_MODE");
  if (retentionMode !== "COMPLIANCE") {
    throw commandError(
      "RECOVERY_REFERENCE_INVALID",
      "The exact completion reference must record COMPLIANCE retention.",
    );
  }
  return Object.freeze({
    snapshotId,
    completionVersionId: versionId,
    completionSha256: exactSha256(env, "COMPLETE_RECOVERY_COMPLETION_SHA256"),
    completionRetentionMode: retentionMode,
    completionRetentionUntil: canonicalTime(
      exactConfigured(env, "COMPLETE_RECOVERY_COMPLETION_RETENTION_UNTIL"),
      "COMPLETE_RECOVERY_COMPLETION_RETENTION_UNTIL",
    ).toISOString(),
  });
}

export function explicitS3ClientFactory({ coordinates, credentials }) {
  return new S3Client({
    endpoint: coordinates.endpoint,
    region: coordinates.region,
    forcePathStyle: coordinates.forcePathStyle,
    credentials,
  });
}

export function assertExactStoreIdentity(store, binding, role) {
  if (store?.identitySha256 !== binding.identitySha256) {
    throw commandError(
      "RECOVERY_COORDINATE_BINDING_MISMATCH",
      `The constructed ${role} store does not match its reviewed coordinate binding.`,
    );
  }
}

export function destroyRecoveryClients(clients) {
  for (const client of clients.filter(Boolean)) client.destroy?.();
}

export function completeRecoveryClockMilliseconds(clock) {
  if (typeof clock !== "function") {
    throw commandError("RECOVERY_COMMAND_CONFIG_INVALID", "The recovery clock must be a function.");
  }
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw commandError(
      "RECOVERY_COMMAND_CONFIG_INVALID",
      "The recovery clock must return a nonnegative integer timestamp.",
    );
  }
  return value;
}

export function enforceCompleteRecoveryRto(startedAt, completedAt) {
  if (
    !Number.isSafeInteger(startedAt)
    || !Number.isSafeInteger(completedAt)
    || startedAt < 0
    || completedAt < startedAt
    || completedAt - startedAt > COMPLETE_RECOVERY_LIMITS.rtoMinutes * 60_000
  ) {
    throw commandError("RECOVERY_RTO_EXCEEDED", "Complete recovery exceeded the fixed RTO.");
  }
  return completedAt - startedAt;
}

function exactRestrictedCreateReceipt(result) {
  const versionId = String(result?.completionVersionId ?? "");
  const databaseVersionId = String(result?.databaseArtifactVersionId ?? "");
  const archiveVersionId = String(result?.archiveVersionId ?? "");
  const receipt = {
    schemaVersion: "rivt-complete-recovery-create-receipt-v3",
    sourceCommit: String(result?.sourceCommit ?? ""),
    snapshotId: String(result?.snapshotId ?? ""),
    completionKey: String(result?.completionKey ?? ""),
    completionVersionId: versionId,
    completionSha256: String(result?.completionSha256 ?? ""),
    completionRetentionMode: result?.completionRetentionMode,
    completionRetentionUntil: String(result?.completionRetentionUntil ?? ""),
    databaseArtifactVersionId: databaseVersionId,
    databaseArtifactSha256: String(result?.databaseArtifactSha256 ?? ""),
    databaseArtifactRetentionMode: result?.databaseArtifactRetentionMode,
    databaseArtifactRetentionUntil: String(result?.databaseArtifactRetentionUntil ?? ""),
    archiveVersionId,
    archiveSha256: String(result?.archiveSha256 ?? ""),
    archiveRetentionMode: result?.archiveRetentionMode,
    archiveRetentionUntil: String(result?.archiveRetentionUntil ?? ""),
    recoverySetIdentitySha256: String(result?.recoverySetIdentitySha256 ?? ""),
    sourceDatabaseRuntimeIdentitySha256: String(
      result?.sourceDatabaseRuntimeIdentitySha256 ?? "",
    ),
    sourceStoreIdentitySha256: String(result?.sourceStoreIdentitySha256 ?? ""),
    destinationStoreIdentitySha256: String(result?.destinationStoreIdentitySha256 ?? ""),
    restoreStoreIdentitySha256: String(result?.restoreStoreIdentitySha256 ?? ""),
    recoveryPrincipalSetSha256: String(result?.recoveryPrincipalSetSha256 ?? ""),
    writeWindowStartAt: String(result?.writeWindowStartAt ?? ""),
    writeWindowEndAt: String(result?.writeWindowEndAt ?? ""),
    writerPolicySha256: String(result?.writerPolicySha256 ?? ""),
    writerExactKeySetSha256: String(result?.writerExactKeySetSha256 ?? ""),
    writerAuthorizationIdentitySha256: String(result?.writerAuthorizationIdentitySha256 ?? ""),
    writerAuthorizationAt: String(result?.writerAuthorizationAt ?? ""),
    writerAuthorizationExpiresAt: String(result?.writerAuthorizationExpiresAt ?? ""),
    multipartInitiationDenied: result?.multipartInitiationDenied,
    noPreexistingMultipartUploadsVerified: result?.noPreexistingMultipartUploadsVerified,
  };
  if (
    !/^[a-f0-9]{40}$/u.test(receipt.sourceCommit)
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{7,79}$/u.test(receipt.snapshotId)
    || receipt.completionKey !== `snapshots/${receipt.snapshotId}/complete.json`
    || !versionId
    || /[\u0000-\u001f\u007f]/u.test(versionId)
    || versionId.toLowerCase() === "null"
    || Buffer.byteLength(versionId, "utf8") > 1_024
    || !databaseVersionId
    || /[\u0000-\u001f\u007f]/u.test(databaseVersionId)
    || databaseVersionId.toLowerCase() === "null"
    || Buffer.byteLength(databaseVersionId, "utf8") > 1_024
    || !archiveVersionId
    || /[\u0000-\u001f\u007f]/u.test(archiveVersionId)
    || archiveVersionId.toLowerCase() === "null"
    || Buffer.byteLength(archiveVersionId, "utf8") > 1_024
    || !/^[a-f0-9]{64}$/u.test(receipt.completionSha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.databaseArtifactSha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.archiveSha256)
    || receipt.completionRetentionMode !== "COMPLIANCE"
    || receipt.databaseArtifactRetentionMode !== "COMPLIANCE"
    || receipt.archiveRetentionMode !== "COMPLIANCE"
    || !/^[a-f0-9]{64}$/u.test(receipt.recoverySetIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.sourceDatabaseRuntimeIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.sourceStoreIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.destinationStoreIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.restoreStoreIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.recoveryPrincipalSetSha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.writerPolicySha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.writerExactKeySetSha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.writerAuthorizationIdentitySha256)
    || receipt.multipartInitiationDenied !== true
    || receipt.noPreexistingMultipartUploadsVerified !== true
  ) {
    throw commandError(
      "RECOVERY_CREATE_RECEIPT_INVALID",
      "The restricted recovery receipt is incomplete or malformed.",
    );
  }
  canonicalTime(receipt.writeWindowStartAt, "writeWindowStartAt");
  canonicalTime(receipt.writeWindowEndAt, "writeWindowEndAt");
  canonicalTime(receipt.writerAuthorizationAt, "writerAuthorizationAt");
  canonicalTime(receipt.writerAuthorizationExpiresAt, "writerAuthorizationExpiresAt");
  canonicalTime(receipt.completionRetentionUntil, "completionRetentionUntil");
  canonicalTime(receipt.databaseArtifactRetentionUntil, "databaseArtifactRetentionUntil");
  canonicalTime(receipt.archiveRetentionUntil, "archiveRetentionUntil");
  return receipt;
}

function exactRestrictedCreatePlan(value) {
  const plan = {
    schemaVersion: "rivt-complete-recovery-create-plan-v1",
    sourceCommit: String(value?.sourceCommit ?? ""),
    snapshotId: String(value?.snapshotId ?? ""),
    completionKey: String(value?.completionKey ?? ""),
    sourceDatabaseRuntimeIdentitySha256: String(
      value?.sourceDatabaseRuntimeIdentitySha256 ?? "",
    ),
    sourceStoreIdentitySha256: String(value?.sourceStoreIdentitySha256 ?? ""),
    destinationStoreIdentitySha256: String(value?.destinationStoreIdentitySha256 ?? ""),
    restoreStoreIdentitySha256: String(value?.restoreStoreIdentitySha256 ?? ""),
    recoveryPrincipalSetSha256: String(value?.recoveryPrincipalSetSha256 ?? ""),
    writeWindowStartAt: String(value?.writeWindowStartAt ?? ""),
    writeWindowEndAt: String(value?.writeWindowEndAt ?? ""),
  };
  if (
    !/^[a-f0-9]{40}$/u.test(plan.sourceCommit)
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{7,79}$/u.test(plan.snapshotId)
    || plan.completionKey !== `snapshots/${plan.snapshotId}/complete.json`
    || !/^[a-f0-9]{64}$/u.test(plan.sourceDatabaseRuntimeIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(plan.sourceStoreIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(plan.destinationStoreIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(plan.restoreStoreIdentitySha256)
    || !/^[a-f0-9]{64}$/u.test(plan.recoveryPrincipalSetSha256)
  ) {
    throw commandError(
      "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
      "The restricted recovery plan is incomplete or malformed.",
    );
  }
  canonicalTime(plan.writeWindowStartAt, "writeWindowStartAt");
  canonicalTime(plan.writeWindowEndAt, "writeWindowEndAt");
  return Object.freeze(plan);
}

async function writeRestrictedEvidenceRecord(handle, record) {
  const encoded = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
  if (encoded.length > RESTRICTED_RECEIPT_BYTES) {
    throw commandError(
      "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
      "Restricted recovery evidence exceeds its reserved capacity.",
    );
  }
  const reserved = Buffer.alloc(RESTRICTED_RECEIPT_BYTES, 0x20);
  encoded.copy(reserved);
  const writeResult = await handle.write(reserved, 0, reserved.length, 0);
  if (writeResult?.bytesWritten !== reserved.length) {
    throw new Error("short restricted-evidence write");
  }
  await handle.sync();
}

async function syncRestrictedEvidenceParentDirectory(
  directoryPath,
  { openDirectory = open, platform = process.platform } = {},
) {
  let directoryHandle;
  try {
    directoryHandle = await openDirectory(directoryPath, "r");
    await directoryHandle.sync();
  } catch (error) {
    // Node cannot open directory handles for fsync on Windows. On that
    // platform FileHandle.sync() above maps to FlushFileBuffers and is the
    // strongest portable primitive available without a native helper. POSIX
    // must durably sync the new directory entry and every other error remains
    // fail-closed.
    const unsupportedWindowsDirectorySync = platform === "win32"
      && ["EACCES", "EINVAL", "EISDIR", "EPERM", "UNKNOWN"].includes(error?.code);
    if (!unsupportedWindowsDirectorySync) throw error;
  } finally {
    await directoryHandle?.close();
  }
}

export async function createRestrictedRecoveryEvidenceSink(
  env = process.env,
  {
    openFile = open,
    removeFile = rm,
    syncParentDirectory = syncRestrictedEvidenceParentDirectory,
  } = {},
) {
  const configuredPath = exactConfigured(env, "COMPLETE_RECOVERY_RESTRICTED_RECEIPT_PATH");
  const relativeToRuntimeRoot = relative(RECOVERY_RUNTIME_ROOT, configuredPath);
  const insideRuntimeRoot = relativeToRuntimeRoot === ""
    || (relativeToRuntimeRoot !== ".."
      && !relativeToRuntimeRoot.startsWith(`..${sep}`)
      && !isAbsolute(relativeToRuntimeRoot));
  if (
    !isAbsolute(configuredPath)
    || resolve(configuredPath) !== configuredPath
    || insideRuntimeRoot
  ) {
    throw commandError(
      "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
      "Restricted recovery evidence requires an exact absolute path outside the repository.",
    );
  }
  let handle;
  try {
    handle = await openFile(configuredPath, "wx", 0o600);
    await handle.chmod?.(0o600);
    await writeRestrictedEvidenceRecord(handle, {
      schemaVersion: "rivt-complete-recovery-evidence-v1",
      status: "reserved",
    });
    await syncParentDirectory(dirname(configuredPath));
  } catch {
    // An `wx` EEXIST failure means this invocation never owned the path. Never
    // remove a prior complete or ambiguous receipt that we did not create.
    if (handle) {
      await handle.close?.().catch(() => undefined);
      await removeFile(configuredPath, { force: true }).catch(() => undefined);
    }
    throw commandError(
      "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
      "Restricted recovery evidence could not be opened exclusively.",
    );
  }
  let committed = false;
  let state = "reserved";
  let plan;
  let writesStartedAt;
  let writerAuthorization;
  return Object.freeze({
    async plan(value) {
      if (!handle || state !== "reserved") {
        throw commandError(
          "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
          "Restricted recovery evidence cannot accept this plan.",
        );
      }
      plan = exactRestrictedCreatePlan(value);
      try {
        await writeRestrictedEvidenceRecord(handle, { ...plan, status: "planned" });
        state = "planned";
      } catch {
        throw commandError(
          "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
          "Restricted recovery evidence plan could not be committed durably.",
        );
      }
    },
    async markWritesStarted(value) {
      if (!handle || state !== "planned") {
        throw commandError(
          "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
          "Restricted recovery evidence has no durable write plan.",
        );
      }
      writesStartedAt = canonicalTime(
        value?.writesStartedAt,
        "writesStartedAt",
      ).toISOString();
      if (
        value?.multipartInitiationDenied !== true
        || value?.noPreexistingMultipartUploadsVerified !== true
      ) {
        throw commandError(
          "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
          "Restricted recovery evidence requires exact multipart safety attestations.",
        );
      }
      writerAuthorization = {
        writerPolicySha256: exactSha256(value, "writerPolicySha256"),
        writerExactKeySetSha256: exactSha256(value, "writerExactKeySetSha256"),
        writerAuthorizationIdentitySha256: exactSha256(
          value,
          "writerAuthorizationIdentitySha256",
        ),
        writerAuthorizationAt: canonicalTime(
          value?.writerAuthorizationAt,
          "writerAuthorizationAt",
        ).toISOString(),
        writerAuthorizationExpiresAt: canonicalTime(
          value?.writerAuthorizationExpiresAt,
          "writerAuthorizationExpiresAt",
        ).toISOString(),
        multipartInitiationDenied: true,
        noPreexistingMultipartUploadsVerified: true,
      };
      try {
        await writeRestrictedEvidenceRecord(handle, {
          ...plan,
          ...writerAuthorization,
          status: "writes_started",
          writesStartedAt,
        });
        state = "writes_started";
      } catch {
        throw commandError(
          "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
          "Restricted recovery write evidence could not be committed durably.",
        );
      }
    },
    async commit(result) {
      if (!handle || committed || state !== "writes_started") {
        throw commandError(
          "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
          "Restricted recovery evidence sink is not writable.",
        );
      }
      const receipt = exactRestrictedCreateReceipt(result);
      for (const name of [
        "sourceCommit",
        "snapshotId",
        "completionKey",
        "sourceDatabaseRuntimeIdentitySha256",
        "sourceStoreIdentitySha256",
        "destinationStoreIdentitySha256",
        "restoreStoreIdentitySha256",
        "recoveryPrincipalSetSha256",
        "writeWindowStartAt",
        "writeWindowEndAt",
      ]) {
        if (receipt[name] !== plan[name]) {
          throw commandError(
            "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
            "Restricted recovery receipt differs from its durable write plan.",
          );
        }
      }
      for (const name of Object.keys(writerAuthorization)) {
        if (receipt[name] !== writerAuthorization[name]) {
          throw commandError(
            "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
            "Restricted recovery receipt differs from its exact writer authorization.",
          );
        }
      }
      try {
        await writeRestrictedEvidenceRecord(handle, {
          ...receipt,
          status: "complete",
          writesStartedAt,
        });
        state = "complete";
        committed = true;
        await handle.close().catch(() => undefined);
        handle = undefined;
      } catch {
        throw commandError(
          "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
          "Restricted recovery evidence could not be committed durably.",
        );
      }
    },
    async abort() {
      if (handle) {
        if (state === "writes_started") {
          await writeRestrictedEvidenceRecord(handle, {
          ...plan,
          ...writerAuthorization,
            status: "write_failed_or_ambiguous",
            writesStartedAt,
          }).catch(() => undefined);
        }
        await handle.close().catch(() => undefined);
        handle = undefined;
      }
      if (!committed && state !== "writes_started") {
        await removeFile(configuredPath, { force: true }).catch(() => undefined);
      }
    },
  });
}

export function assertCompleteRecoveryWriteWindow(writeWindow, now) {
  const current = currentDate(now);
  const start = canonicalTime(writeWindow?.startAt, "writeWindow.startAt");
  const end = canonicalTime(writeWindow?.endAt, "writeWindow.endAt");
  if (current < start || current >= end) {
    throw commandError(
      "RECOVERY_WRITE_WINDOW_CLOSED",
      "The exact one-shot immutable-write window closed before protected writes began.",
    );
  }
  return current.toISOString();
}
