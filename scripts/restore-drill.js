import "dotenv/config";
import assert from "node:assert/strict";
import {
  aggregateTableDigest,
  assertBackupCatalogComplete,
  assertBackupDatabaseRoleReadOnly,
  assertDifferentDatabases,
  beginReadOnlyBackupSnapshot,
  canonicalTableColumns,
  countTableRows,
  databaseTableDigests,
  diffCounts,
  diffTableDigests,
  enforceRecoveryRto,
  isDirectExecution,
  poolFor,
  publicTables,
  recoveryRtoMinutesFromEnv,
  requireConfiguredEnv,
  sanitizedFailure,
  sanitizedSuccess,
  sequenceStates,
  tableColumns,
} from "./logical-backup-utils.js";
import { restoreLogicalBackupArtifact } from "./restore-logical-backup-artifact.js";

export async function completeInventory(pool, { requireReadOnlyRole = false } = {}) {
  const client = await pool.connect();
  try {
    await beginReadOnlyBackupSnapshot(client);
    try {
      if (requireReadOnlyRole) await assertBackupDatabaseRoleReadOnly(client);
      await assertBackupCatalogComplete(client);
      const tableNames = await publicTables(client);
      const tables = [];
      for (const tableName of tableNames) {
        tables.push({
          name: tableName,
          columns: canonicalTableColumns(await tableColumns(client, tableName)),
        });
      }
      const inventory = {
        tableNames,
        tables,
        counts: await countTableRows(client, tableNames),
        tableDigests: await databaseTableDigests(client, tables),
        sequences: await sequenceStates(client),
      };
      await client.query("COMMIT");
      return inventory;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

export async function verifyRestoreDrill({
  env = process.env,
  applyMigrations = process.argv.includes("--apply-migrations"),
  poolFactory = poolFor,
  s3ClientFactory,
} = {}) {
  const drillStartedAt = Date.now();
  const targetUrl = requireConfiguredEnv("RESTORE_DATABASE_URL", env);
  const sourceUrl = requireConfiguredEnv("RESTORE_SOURCE_DATABASE_URL", env);
  assertDifferentDatabases(sourceUrl, targetUrl);
  const rtoMinutes = recoveryRtoMinutesFromEnv(env);

  const restoreResult = await restoreLogicalBackupArtifact({
    env,
    applyMigrations,
    requireActiveKey: true,
    poolFactory,
    ...(s3ClientFactory ? { s3ClientFactory } : {}),
  });
  const verificationStartedAt = Date.now();
  const targetPool = poolFactory(targetUrl);
  const sourcePool = poolFactory(sourceUrl);
  try {
    const [sourceInventory, targetInventory] = await Promise.all([
      completeInventory(sourcePool, { requireReadOnlyRole: true }),
      completeInventory(targetPool),
    ]);
    assert.deepEqual(
      targetInventory.tableNames,
      sourceInventory.tableNames,
      "Restore target public table inventory differs from source.",
    );
    assert.deepEqual(
      targetInventory.tables,
      sourceInventory.tables,
      "Restore target public table definitions differ from source.",
    );
    const countDiffs = diffCounts(sourceInventory.counts, targetInventory.counts);
    assert.deepEqual(countDiffs, [], `Restore target row counts differ from source: ${JSON.stringify(countDiffs)}`);
    const contentDiffs = diffTableDigests(sourceInventory.tableDigests, targetInventory.tableDigests);
    assert.deepEqual(contentDiffs, [], `Restore target content differs from source: ${JSON.stringify(contentDiffs)}`);
    assert.deepEqual(
      targetInventory.sequences,
      sourceInventory.sequences,
      "Restore target sequence state differs from source.",
    );

    const verificationDurationMs = Date.now() - verificationStartedAt;
    const restoreDurationMs = verificationStartedAt - drillStartedAt;
    const recoveryDurations = enforceRecoveryRto(
      restoreDurationMs,
      verificationDurationMs,
      rtoMinutes,
    );
    return {
      ...restoreResult,
      mode: applyMigrations ? "migrate-restore-and-verify" : "restore-and-verify",
      countDiffs,
      contentDigest: aggregateTableDigest(targetInventory.tableDigests),
      contentDiffCount: contentDiffs.length,
      strictCompare: true,
      ...recoveryDurations,
      durationMs: recoveryDurations.combinedDurationMs,
    };
  } finally {
    await targetPool.end();
    await sourcePool.end();
  }
}

async function main() {
  try {
    console.log(JSON.stringify(sanitizedSuccess(await verifyRestoreDrill()), null, 2));
  } catch (error) {
    console.error(JSON.stringify(sanitizedFailure(error, "restore-drill"), null, 2));
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) await main();
