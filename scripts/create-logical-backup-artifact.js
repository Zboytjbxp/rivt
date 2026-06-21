import "dotenv/config";
import {
  backupEncryptionSecret,
  countTableRows,
  encryptSnapshot,
  poolFor,
  publicTables,
  putJsonObject,
  requiredEnv,
  rowsForTable,
  s3ClientFromEnv,
  sequenceStates,
  sumCounts,
  tableColumns,
} from "./logical-backup-utils.js";

const sourceUrl = process.env.BACKUP_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
const bucket = requiredEnv("S3_BUCKET");
const prefix = (process.env.BACKUP_S3_PREFIX?.trim() || "backups/postgres").replace(/\/+$/, "");
const sourceCommit = process.env.SOURCE_COMMIT?.trim() || "unknown";
const createdAt = new Date().toISOString();
const objectTimestamp = createdAt.replaceAll(":", "-");
const objectKey = process.env.BACKUP_S3_KEY?.trim()
  || `${prefix}/${objectTimestamp}-${sourceCommit.slice(0, 7)}.json.gz.aes256gcm`;
const startedAt = Date.now();
const encryptionSecret = backupEncryptionSecret();

if (!sourceUrl) {
  console.error("BACKUP_DATABASE_URL or DATABASE_URL is required.");
  process.exit(1);
}
if (!encryptionSecret) {
  console.error("BACKUP_ENCRYPTION_KEY or RIVT_BACKUP_ENCRYPTION_KEY is required.");
  process.exit(1);
}

const pool = poolFor(sourceUrl);

try {
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '60s'");

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
      format: "rivt-logical-backup-manifest-v1",
      createdAt,
      sourceCommit,
      tableCount: tableNames.length,
      rowCount: sumCounts(counts),
      counts,
    };
    const snapshot = {
      format: "rivt-logical-backup-v1",
      createdAt,
      sourceCommit,
      manifest,
      sequences: await sequenceStates(client),
      tables,
    };
    const encrypted = encryptSnapshot(snapshot, encryptionSecret);
    await putJsonObject(s3ClientFromEnv(), bucket, objectKey, encrypted);

    console.log(JSON.stringify({
      ok: true,
      mode: "create-logical-backup-artifact",
      bucket,
      key: objectKey,
      createdAt,
      sourceCommit,
      tables: manifest.tableCount,
      rows: manifest.rowCount,
      durationMs: Date.now() - startedAt,
    }, null, 2));
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
