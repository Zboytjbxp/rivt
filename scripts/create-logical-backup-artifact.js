import "dotenv/config";
import crypto from "node:crypto";
import {
  assertBackupDatabaseRoleReadOnly,
  assertBackupCatalogComplete,
  acquireLogicalBackupLock,
  beginReadOnlyBackupSnapshot,
  countTableRows,
  destinationS3Config,
  ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2,
  encryptSnapshot,
  isDirectExecution,
  LOGICAL_BACKUP_FORMAT_V2,
  LOGICAL_BACKUP_MANIFEST_FORMAT_V2,
  poolFor,
  POSTGRES_TEXT_ROW_ENCODING,
  publicTables,
  putProtectedJsonObject,
  requireConfiguredEnv,
  requireStrictActiveBackupEncryptionSecret,
  requiredSourceCommit,
  retentionDaysFromEnv,
  rowsForTable,
  s3ClientForConfig,
  sanitizedFailure,
  sanitizedSuccess,
  sequenceStates,
  snapshotTableDigests,
  sumCounts,
  tableColumns,
  verifyBucketProtection,
} from "./logical-backup-utils.js";

export async function createLogicalBackupArtifact({
  env = process.env,
  now = () => new Date(),
  poolFactory = poolFor,
  s3ClientFactory = s3ClientForConfig,
} = {}) {
  const startedAt = Date.now();
  const sourceUrl = requireConfiguredEnv("BACKUP_DATABASE_URL", env);
  const destination = destinationS3Config(env);
  const sourceCommit = requiredSourceCommit(env);
  const retentionDays = retentionDaysFromEnv(env);
  const encryptionSecret = requireStrictActiveBackupEncryptionSecret(env);
  const createdAt = now().toISOString();
  const objectTimestamp = createdAt.replaceAll(":", "-");
  const objectKey = `${destination.prefix}/${objectTimestamp}-${sourceCommit}-${crypto.randomUUID()}.json.gz.aes256gcm`;
  const s3 = s3ClientFactory(destination);

  const destinationProtection = await verifyBucketProtection(s3, destination, retentionDays);
  const pool = poolFactory(sourceUrl);
  let client;
  let snapshot;
  try {
    client = await pool.connect();
    await acquireLogicalBackupLock(client);
    await beginReadOnlyBackupSnapshot(client);
    try {
      await assertBackupDatabaseRoleReadOnly(client);
      await assertBackupCatalogComplete(client);
      const tableNames = await publicTables(client);
      const counts = await countTableRows(client, tableNames);
      const tables = [];
      for (const tableName of tableNames) {
        const columns = await tableColumns(client, tableName);
        tables.push({
          name: tableName,
          columns,
          rows: await rowsForTable(client, tableName, columns),
        });
      }
      const manifest = {
        format: LOGICAL_BACKUP_MANIFEST_FORMAT_V2,
        rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
        createdAt,
        sourceCommit,
        tableCount: tableNames.length,
        rowCount: sumCounts(counts),
        counts,
        tableDigests: snapshotTableDigests(tables),
      };
      snapshot = {
        format: LOGICAL_BACKUP_FORMAT_V2,
        rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
        createdAt,
        sourceCommit,
        manifest,
        sequences: await sequenceStates(client),
        tables,
      };
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    const encrypted = encryptSnapshot(snapshot, encryptionSecret);
    if (encrypted.format !== ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2) {
      throw new Error("New backup creation did not produce the lossless encrypted v2 format.");
    }
    const upload = await putProtectedJsonObject(s3, destination, objectKey, encrypted, {
      createdAt,
      sourceCommit,
      retentionDays,
    });

    return {
      ok: true,
      mode: "create-logical-backup-artifact",
      bucket: destination.bucket,
      prefix: destination.prefix,
      key: objectKey,
      versionId: upload.versionId,
      sha256: upload.sha256,
      byteLength: upload.byteLength,
      createdAt,
      uploadedAt: upload.uploadedAt,
      sourceCommit,
      retentionDays,
      retentionUntil: upload.retentionUntil,
      lifecycleRuleId: destinationProtection.lifecycleRuleId,
      tables: snapshot.manifest.tableCount,
      rows: snapshot.manifest.rowCount,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    client?.release();
    await pool.end();
  }
}

async function main() {
  try {
    console.log(JSON.stringify(sanitizedSuccess(await createLogicalBackupArtifact()), null, 2));
  } catch (error) {
    console.error(JSON.stringify(sanitizedFailure(error, "create-logical-backup-artifact"), null, 2));
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) await main();
