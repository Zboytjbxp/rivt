import "dotenv/config";
import assert from "node:assert/strict";
import {
  BackupConfigurationError,
  POSTGRES_TEXT_ROW_ENCODING,
  aggregateTableDigest,
  assertBackupCatalogComplete,
  assertDifferentDatabases,
  assertDifferentRuntimeDatabases,
  assertRestoreUsableSnapshot,
  configureCanonicalTextSession,
  countTableRows,
  databaseTableDigests,
  decryptSnapshot,
  diffCounts,
  diffTableDigests,
  encryptionKeyIdFromSecret,
  enforceRecoveryRto,
  foreignKeyDependencies,
  insertBatch,
  isDirectExecution,
  orderedTables,
  poolFor,
  positiveInteger,
  publicTables,
  recoveryRtoMinutesFromEnv,
  requireConfiguredEnv,
  restoreSequences,
  restoreSourceS3Config,
  retentionDaysFromEnv,
  s3ClientForConfig,
  sanitizedFailure,
  sanitizedSuccess,
  setUserTriggers,
  snapshotTableDigests,
  strictRestoreEncryptionSecrets,
  tableColumns,
  truncateTarget,
  verifyBucketProtection,
  verifyProtectedBackupObject,
  runtimeDatabaseIdentity,
} from "./logical-backup-utils.js";
import { migrateUp, migrationStatus } from "../server/migrations.js";

function tableMapFromSnapshot(snapshot) {
  return new Map(snapshot.tables.map((table) => [table.name, table]));
}

async function restoreTable(client, snapshotTable, batchSize) {
  const targetColumns = await tableColumns(client, snapshotTable.name);
  assert.deepEqual(targetColumns, snapshotTable.columns, `${snapshotTable.name} columns differ from backup artifact.`);

  for (let index = 0; index < snapshotTable.rows.length; index += batchSize) {
    await insertBatch(
      client,
      snapshotTable.name,
      targetColumns,
      snapshotTable.rows.slice(index, index + batchSize),
      { rowEncoding: POSTGRES_TEXT_ROW_ENCODING },
    );
  }
}

export async function applySnapshotToTarget(client, {
  copyOrder,
  snapshotTables,
  sequences,
  batchSize,
}) {
  await client.query("BEGIN");
  try {
    await truncateTarget(client, copyOrder);
    await setUserTriggers(client, copyOrder, false);
    for (const tableName of copyOrder) {
      await restoreTable(client, snapshotTables.get(tableName), batchSize);
    }
    await restoreSequences(client, sequences);
    await setUserTriggers(client, copyOrder, true);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function identityForPool(pool) {
  const client = await pool.connect();
  try {
    return await runtimeDatabaseIdentity(client);
  } finally {
    client.release();
  }
}

async function assertRuntimeRestoreIsolation(targetPool, protectedUrls, poolFactory) {
  const targetIdentity = await identityForPool(targetPool);
  for (const protectedUrl of [...new Set(protectedUrls)]) {
    const protectedPool = poolFactory(protectedUrl);
    try {
      const protectedIdentity = await identityForPool(protectedPool);
      assertDifferentRuntimeDatabases(protectedIdentity, targetIdentity);
    } finally {
      await protectedPool.end();
    }
  }
}

export async function restoreLogicalBackupArtifact({
  env = process.env,
  applyMigrations = process.argv.includes("--apply-migrations"),
  requireActiveKey = false,
  poolFactory = poolFor,
  s3ClientFactory = s3ClientForConfig,
} = {}) {
  const recoveryStartedAt = Date.now();
  const targetUrl = requireConfiguredEnv("RESTORE_DATABASE_URL", env);
  if (env.CONFIRM_RESTORE_TARGET_ISOLATED?.trim() !== "true") {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "CONFIRM_RESTORE_TARGET_ISOLATED=true is required for a destructive restore.",
    );
  }
  const sourceUrl = requireConfiguredEnv("RESTORE_SOURCE_DATABASE_URL", env);
  assertDifferentDatabases(sourceUrl, targetUrl);
  const protectedDatabaseUrls = [
    sourceUrl,
    env.DATABASE_URL?.trim(),
    env.BACKUP_DATABASE_URL?.trim(),
  ].filter(Boolean);
  for (const protectedUrl of protectedDatabaseUrls) assertDifferentDatabases(protectedUrl, targetUrl);
  const source = restoreSourceS3Config(env);
  const objectKey = requireConfiguredEnv("RESTORE_BACKUP_S3_KEY", env);
  const versionId = requireConfiguredEnv("RESTORE_BACKUP_S3_VERSION_ID", env);
  const expectedSha256 = requireConfiguredEnv("RESTORE_BACKUP_SHA256", env).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "RESTORE_BACKUP_SHA256 must be a SHA-256 digest.");
  }
  const batchSize = positiveInteger(env.RESTORE_COPY_BATCH_SIZE, "RESTORE_COPY_BATCH_SIZE", 200);
  if (batchSize > 1000) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "RESTORE_COPY_BATCH_SIZE cannot exceed 1000.");
  }
  const retentionDays = retentionDaysFromEnv(env);
  const rtoMinutes = recoveryRtoMinutesFromEnv(env);
  const encryptionSecrets = strictRestoreEncryptionSecrets(env);
  const expectedKeyId = requireActiveKey
    ? encryptionKeyIdFromSecret(encryptionSecrets.active)
    : undefined;

  const s3 = s3ClientFactory(source);
  await verifyBucketProtection(s3, source, retentionDays);
  const protectedArtifact = await verifyProtectedBackupObject(s3, source, {
    key: objectKey,
    versionId,
  }, {
    ...(expectedKeyId ? { expectedKeyId } : {}),
    expectedSha256,
    retentionDays,
  });
  const snapshot = decryptSnapshot(
    protectedArtifact.envelope,
    requireActiveKey
      ? encryptionSecrets.active
      : { active: encryptionSecrets.active, previous: encryptionSecrets.previous },
  );
  assertRestoreUsableSnapshot(snapshot, protectedArtifact);

  const targetPool = poolFactory(targetUrl);
  let status;
  let targetTables;
  let targetCounts;
  let countDiffs;
  try {
    await assertRuntimeRestoreIsolation(targetPool, protectedDatabaseUrls, poolFactory);
    if (applyMigrations) await migrateUp(targetPool);
    const catalogClient = await targetPool.connect();
    try {
      await assertBackupCatalogComplete(catalogClient);
    } finally {
      catalogClient.release();
    }
    status = await migrationStatus(targetPool);
    assert.equal(status.pending.length, 0, `Restore target has pending migrations: ${JSON.stringify(status.pending)}`);

    const targetClient = await targetPool.connect();
    try {
      await targetClient.query("SET statement_timeout = '60s'");
      await configureCanonicalTextSession(targetClient);
      targetTables = await publicTables(targetClient);
      const snapshotTableNames = snapshot.tables.map((table) => table.name).sort();
      assert.deepEqual([...targetTables].sort(), snapshotTableNames, "Restore target tables differ from backup artifact.");
      const dependencies = await foreignKeyDependencies(targetClient, targetTables);
      const copyOrder = orderedTables(targetTables, dependencies);
      const snapshotTables = tableMapFromSnapshot(snapshot);

      await applySnapshotToTarget(targetClient, {
        copyOrder,
        snapshotTables,
        sequences: snapshot.sequences,
        batchSize,
      });

      const verificationStartedAt = Date.now();
      targetCounts = await countTableRows(targetClient, targetTables);
      countDiffs = diffCounts(snapshot.manifest.counts, targetCounts);
      assert.deepEqual(countDiffs, [], `Restore target row counts differ from backup artifact: ${JSON.stringify(countDiffs)}`);
      const expectedTableDigests = snapshotTableDigests(snapshot.tables);
      if (snapshot.manifest.tableDigests) {
        assert.deepEqual(
          snapshot.manifest.tableDigests,
          expectedTableDigests,
          "Backup manifest table digests do not match the authenticated snapshot.",
        );
      }
      const actualTableDigests = await databaseTableDigests(targetClient, snapshot.tables);
      const contentDiffs = diffTableDigests(expectedTableDigests, actualTableDigests);
      assert.deepEqual(contentDiffs, [], `Restore target content differs from backup artifact: ${JSON.stringify(contentDiffs)}`);
      const contentDigest = aggregateTableDigest(actualTableDigests);
      const completedAt = Date.now();
      const verifyDurationMs = completedAt - verificationStartedAt;
      const restoreDurationMs = completedAt - recoveryStartedAt - verifyDurationMs;
      const recoveryDurations = enforceRecoveryRto(restoreDurationMs, verifyDurationMs, rtoMinutes);
      return {
        ok: true,
        mode: applyMigrations ? "migrate-and-restore-logical-backup-artifact" : "restore-logical-backup-artifact",
        bucket: source.bucket,
        prefix: source.prefix,
        key: objectKey,
        versionId,
        sha256: protectedArtifact.sha256,
        backupCreatedAt: snapshot.createdAt,
        backupSourceCommit: snapshot.sourceCommit,
        retentionUntil: protectedArtifact.retentionUntil,
        latestMigration: status.latestVersion
          ? `${String(status.latestVersion).padStart(4, "0")}_${status.latestName}`
          : null,
        appliedMigrations: status.applied.length,
        pendingMigrations: status.pending.length,
        tables: targetTables.length,
        rows: Object.values(targetCounts).reduce((total, count) => total + count, 0),
        countDiffs,
        contentDigest,
        contentDiffCount: contentDiffs.length,
        strictCounts: true,
        encryptionKeyMode: requireActiveKey ? "active-only" : "active-or-previous",
        ...recoveryDurations,
        durationMs: recoveryDurations.combinedDurationMs,
      };
    } finally {
      targetClient.release();
    }
  } finally {
    await targetPool.end();
  }
}

async function main() {
  try {
    console.log(JSON.stringify(sanitizedSuccess(await restoreLogicalBackupArtifact()), null, 2));
  } catch (error) {
    console.error(JSON.stringify(sanitizedFailure(error, "restore-logical-backup-artifact"), null, 2));
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) await main();
