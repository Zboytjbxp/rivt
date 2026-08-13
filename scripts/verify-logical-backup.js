import "dotenv/config";
import {
  BackupConfigurationError,
  assertRestoreUsableSnapshot,
  decryptSnapshot,
  destinationS3Config,
  encryptionKeyIdFromSecret,
  isDirectExecution,
  maxBackupAgeHoursFromEnv,
  newestBackupVersion,
  retentionDaysFromEnv,
  requiredSourceCommit,
  s3ClientForConfig,
  sanitizedFailure,
  sanitizedSuccess,
  strictRestoreEncryptionSecrets,
  verifyBucketProtection,
  verifyProtectedBackupObject,
} from "./logical-backup-utils.js";

export async function verifyLogicalBackup({
  env = process.env,
  now = () => Date.now(),
  s3ClientFactory = s3ClientForConfig,
} = {}) {
  const startedAt = Date.now();
  const destination = destinationS3Config(env);
  const retentionDays = retentionDaysFromEnv(env);
  const maxAgeHours = maxBackupAgeHoursFromEnv(env);
  const expectedSourceCommit = requiredSourceCommit(env, "BACKUP_EXPECTED_SOURCE_COMMIT");
  const encryptionSecrets = strictRestoreEncryptionSecrets(env);
  const activeKeyId = encryptionKeyIdFromSecret(encryptionSecrets.active);
  const currentTime = now();
  const client = s3ClientFactory(destination);
  const protection = await verifyBucketProtection(client, destination, retentionDays);
  const newest = await newestBackupVersion(client, destination);
  if (newest.IsLatest !== true) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "The newest backup object version is not current.");
  }
  const lastModifiedMs = newest.LastModified.getTime();
  const ageHours = (currentTime - lastModifiedMs) / 3_600_000;
  if (ageHours < -5 / 60 || ageHours > maxAgeHours) {
    throw new BackupConfigurationError("BACKUP_NOT_FRESH", "The newest protected backup is outside the freshness window.");
  }
  const verified = await verifyProtectedBackupObject(client, destination, {
    key: newest.Key,
    versionId: newest.VersionId,
  }, {
    expectedKeyId: activeKeyId,
    retentionDays,
    now: currentTime,
  });
  if (verified.sourceCommit !== expectedSourceCommit) {
    throw new BackupConfigurationError(
      "BACKUP_SOURCE_MISMATCH",
      "The newest protected backup source does not match BACKUP_EXPECTED_SOURCE_COMMIT.",
    );
  }
  try {
    const snapshot = decryptSnapshot(verified.envelope, encryptionSecrets.active);
    assertRestoreUsableSnapshot(snapshot, verified);
  } catch (error) {
    if (error instanceof BackupConfigurationError && error.code === "BACKUP_OBJECT_INVALID") throw error;
    const wrapped = new BackupConfigurationError(
      "BACKUP_OBJECT_INVALID",
      "The protected backup payload could not be authenticated and validated.",
    );
    wrapped.cause = error;
    throw wrapped;
  }
  const createdAgeHours = (currentTime - new Date(verified.createdAt).getTime()) / 3_600_000;
  if (createdAgeHours < -5 / 60 || createdAgeHours > maxAgeHours) {
    throw new BackupConfigurationError("BACKUP_NOT_FRESH", "The newest backup creation time is outside the freshness window.");
  }
  if (Math.abs(new Date(verified.createdAt).getTime() - lastModifiedMs) > 15 * 60_000) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Backup creation and provider upload times do not agree.");
  }
  if (Math.abs(new Date(verified.uploadedAt).getTime() - lastModifiedMs) > 1000) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Backup object identity does not match its provider upload time.");
  }
  return {
    ok: true,
    mode: "verify-logical-backup",
    endpoint: destination.endpoint,
    region: destination.region,
    bucket: destination.bucket,
    prefix: destination.prefix,
    forcePathStyle: destination.forcePathStyle,
    key: newest.Key,
    versionId: newest.VersionId,
    sha256: verified.sha256,
    createdAt: verified.createdAt,
    uploadedAt: verified.uploadedAt,
    sourceCommit: verified.sourceCommit,
    ageHours: Number(Math.max(0, ageHours, createdAgeHours).toFixed(3)),
    retentionUntil: verified.retentionUntil,
    retentionDays: verified.retentionDays,
    objectLockMode: protection.objectLockMode,
    defaultRetentionDays: protection.defaultRetentionDays,
    encryptionKeyMode: "active-only",
    durationMs: Date.now() - startedAt,
  };
}

async function main() {
  try {
    console.log(JSON.stringify(sanitizedSuccess(await verifyLogicalBackup()), null, 2));
  } catch (error) {
    console.error(JSON.stringify(sanitizedFailure(error, "verify-logical-backup"), null, 2));
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) await main();
