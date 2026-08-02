import "dotenv/config";
import assert from "node:assert/strict";
import {
  assertDifferentDatabases,
  backupEncryptionSecret,
  countTableRows,
  decryptSnapshot,
  diffContentDigests,
  diffCounts,
  foreignKeyDependencies,
  getJsonObject,
  integrityForTables,
  insertBatch,
  orderedTables,
  poolFor,
  previousBackupEncryptionSecret,
  publicTables,
  requiredEnv,
  restoreSequences,
  rowsForTable,
  s3ClientFromEnv,
  setUserTriggers,
  tableColumns,
  truncateTarget,
} from "./logical-backup-utils.js";
import { migrateUp, migrationStatus } from "../server/migrations.js";

const targetUrl = requiredEnv("RESTORE_DATABASE_URL");
const sourceUrl = process.env.RESTORE_SOURCE_DATABASE_URL?.trim();
const bucket = requiredEnv("S3_BUCKET");
const objectKey = requiredEnv("RESTORE_BACKUP_S3_KEY");
const confirmedIsolated = process.env.CONFIRM_RESTORE_TARGET_ISOLATED === "true";
const applyMigrations = process.argv.includes("--apply-migrations");
const batchSize = Number.parseInt(process.env.RESTORE_COPY_BATCH_SIZE ?? "200", 10);
const strictCounts = process.env.RESTORE_SNAPSHOT_STRICT_COUNTS !== "false";
const startedAt = Date.now();
const encryptionSecret = backupEncryptionSecret();
const previousEncryptionSecret = previousBackupEncryptionSecret();

if (!confirmedIsolated) {
  console.error("CONFIRM_RESTORE_TARGET_ISOLATED=true is required. Never run a restore drill against production.");
  process.exit(1);
}
if (!encryptionSecret) {
  console.error("BACKUP_ENCRYPTION_KEY or RIVT_BACKUP_ENCRYPTION_KEY is required.");
  process.exit(1);
}
if (sourceUrl) {
  assertDifferentDatabases(sourceUrl, targetUrl);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
  console.error("RESTORE_COPY_BATCH_SIZE must be an integer from 1 to 1000.");
  process.exit(1);
}

function tableMapFromSnapshot(snapshot) {
  return new Map(snapshot.tables.map((table) => [table.name, table]));
}

async function restoreTable(client, snapshotTable, { canonicalText = false } = {}) {
  const targetColumns = await tableColumns(client, snapshotTable.name);
  const targetColumnNames = targetColumns.map((column) => column.name).sort();
  const snapshotColumnNames = snapshotTable.columns.map((column) => column.name).sort();
  assert.deepEqual(targetColumnNames, snapshotColumnNames, `${snapshotTable.name} columns differ from backup artifact.`);
  if (snapshotTable.columns.every((column) => column.formattedType)) {
    assert.deepEqual(
      targetColumns.map((column) => [column.name, column.formattedType]),
      snapshotTable.columns.map((column) => [column.name, column.formattedType]),
      `${snapshotTable.name} column types differ from backup artifact.`,
    );
  }
  const restoreColumns = canonicalText
    ? targetColumns.map((column) => ({ ...column, canonicalText: true }))
    : targetColumns;

  for (let index = 0; index < snapshotTable.rows.length; index += batchSize) {
    await insertBatch(client, snapshotTable.name, restoreColumns, snapshotTable.rows.slice(index, index + batchSize));
  }
}

const targetPool = poolFor(targetUrl);

try {
  const encrypted = await getJsonObject(s3ClientFromEnv(), bucket, objectKey);
  const snapshot = decryptSnapshot(encrypted, {
    active: encryptionSecret,
    previous: previousEncryptionSecret,
  });
  const isContentVerifiable = snapshot.format === "rivt-logical-backup-v2";
  assert.ok(
    snapshot.format === "rivt-logical-backup-v1" || isContentVerifiable,
    "Unsupported logical backup format.",
  );
  assert.ok(Array.isArray(snapshot.tables), "Backup artifact is missing table data.");
  assert.ok(Array.isArray(snapshot.sequences), "Backup artifact is missing sequence data.");
  if (isContentVerifiable) {
    assert.equal(
      snapshot.integrity?.format,
      "rivt-logical-backup-integrity-v1",
      "Backup artifact is missing supported content integrity data.",
    );
    const artifactIntegrity = integrityForTables(snapshot.tables);
    const artifactDigestDiffs = diffContentDigests(
      snapshot.integrity.tableDigests,
      artifactIntegrity.tableDigests,
    );
    assert.deepEqual(
      artifactDigestDiffs,
      [],
      `Backup artifact content digests do not match its table data: ${JSON.stringify(artifactDigestDiffs)}`,
    );
    assert.equal(
      snapshot.integrity.databaseDigest,
      artifactIntegrity.databaseDigest,
      "Backup artifact aggregate content digest does not match its table data.",
    );
  }

  if (applyMigrations) await migrateUp(targetPool);
  const status = await migrationStatus(targetPool);
  assert.equal(status.pending.length, 0, `Restore target has pending migrations: ${JSON.stringify(status.pending)}`);

  const targetClient = await targetPool.connect();
  try {
    await targetClient.query("SET statement_timeout = '60s'");
    const targetTables = await publicTables(targetClient);
    const snapshotTableNames = snapshot.tables.map((table) => table.name).sort();
    assert.deepEqual([...targetTables].sort(), snapshotTableNames, "Restore target tables differ from backup artifact.");

    const dependencies = await foreignKeyDependencies(targetClient, targetTables);
    const copyOrder = orderedTables(targetTables, dependencies);
    const snapshotTables = tableMapFromSnapshot(snapshot);
    let targetCounts = {};
    let countDiffs = [];
    let contentDigestDiffs = [];

    await targetClient.query("BEGIN");
    try {
      await truncateTarget(targetClient, copyOrder);
      await setUserTriggers(targetClient, copyOrder, false);
      for (const tableName of copyOrder) {
        await restoreTable(targetClient, snapshotTables.get(tableName), {
          canonicalText: isContentVerifiable,
        });
      }
      await restoreSequences(targetClient, snapshot.sequences);
      await setUserTriggers(targetClient, copyOrder, true);
      targetCounts = await countTableRows(targetClient, targetTables);
      countDiffs = diffCounts(snapshot.manifest.counts, targetCounts);
      if (strictCounts) {
        assert.deepEqual(
          countDiffs,
          [],
          `Restore target row counts differ from backup artifact: ${JSON.stringify(countDiffs)}`,
        );
      }
      if (isContentVerifiable) {
        const restoredTables = [];
        for (const tableName of targetTables) {
          const columns = await tableColumns(targetClient, tableName);
          restoredTables.push({
            name: tableName,
            columns,
            rows: await rowsForTable(targetClient, tableName, columns),
          });
        }
        const restoredIntegrity = integrityForTables(restoredTables);
        contentDigestDiffs = diffContentDigests(
          snapshot.integrity.tableDigests,
          restoredIntegrity.tableDigests,
        );
        assert.deepEqual(
          contentDigestDiffs,
          [],
          `Restore target content differs from backup artifact: ${JSON.stringify(contentDigestDiffs)}`,
        );
        assert.equal(
          snapshot.integrity.databaseDigest,
          restoredIntegrity.databaseDigest,
          "Restore target aggregate content digest differs from backup artifact.",
        );
      }
      await targetClient.query("COMMIT");
    } catch (error) {
      await targetClient.query("ROLLBACK");
      throw error;
    }

    console.log(JSON.stringify({
      ok: true,
      mode: applyMigrations ? "migrate-and-restore-logical-backup-artifact" : "restore-logical-backup-artifact",
      bucket,
      key: objectKey,
      backupCreatedAt: snapshot.createdAt,
      backupSourceCommit: snapshot.sourceCommit,
      latestMigration: status.latestVersion
        ? `${String(status.latestVersion).padStart(4, "0")}_${status.latestName}`
        : null,
      appliedMigrations: status.applied.length,
      pendingMigrations: status.pending.length,
      tables: targetTables.length,
      rows: Object.values(targetCounts).reduce((total, count) => total + count, 0),
      countDiffs,
      strictCounts,
      contentVerified: isContentVerifiable,
      contentVerification: isContentVerifiable ? snapshot.integrity.format : "unavailable_legacy",
      contentDigestDiffs,
      durationMs: Date.now() - startedAt,
    }, null, 2));
  } finally {
    targetClient.release();
  }
} finally {
  await targetPool.end();
}
