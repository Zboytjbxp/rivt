import crypto from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

export function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is required.`);
    process.exit(1);
  }
  return value;
}

export function sslFor(url) {
  return process.env.PGSSL === "disable" || url.includes("localhost") ? false : { rejectUnauthorized: false };
}

export function poolFor(url) {
  return new pg.Pool({
    connectionString: url,
    ssl: sslFor(url),
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function databaseIdentity(connectionString) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    username: url.username,
  };
}

export function assertDifferentDatabases(sourceUrl, targetUrl) {
  if (sourceUrl === targetUrl) {
    throw new Error("Source and target database URLs must not match.");
  }
  const source = databaseIdentity(sourceUrl);
  const target = databaseIdentity(targetUrl);
  if (
    source.host === target.host &&
    source.port === target.port &&
    source.database === target.database &&
    source.username === target.username
  ) {
    throw new Error("Source and target database identities match. Refusing to continue.");
  }
}

export function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

export function qualified(tableName) {
  return `${quoteIdentifier("public")}.${quoteIdentifier(tableName)}`;
}

export async function publicTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((row) => row.table_name);
}

export async function tableColumns(client, tableName) {
  const result = await client.query(`
    SELECT column_name, is_generated, identity_generation
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows
    .filter((row) => row.is_generated !== "ALWAYS")
    .map((row) => ({
      name: row.column_name,
      identityGeneration: row.identity_generation,
    }));
}

export async function foreignKeyDependencies(client, tables) {
  const result = await client.query(`
    SELECT
      tc.table_name AS table_name,
      ccu.table_name AS referenced_table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
  `);
  const tableSet = new Set(tables);
  return result.rows
    .filter((row) => tableSet.has(row.table_name) && tableSet.has(row.referenced_table_name))
    .map((row) => ({ tableName: row.table_name, referencedTableName: row.referenced_table_name }))
    .filter((edge) => edge.tableName !== edge.referencedTableName);
}

export function orderedTables(tables, dependencies) {
  const tableSet = new Set(tables);
  const incoming = new Map(tables.map((tableName) => [tableName, new Set()]));
  const outgoing = new Map(tables.map((tableName) => [tableName, new Set()]));

  for (const dependency of dependencies) {
    incoming.get(dependency.tableName)?.add(dependency.referencedTableName);
    outgoing.get(dependency.referencedTableName)?.add(dependency.tableName);
  }

  const ready = tables.filter((tableName) => incoming.get(tableName)?.size === 0).sort();
  const ordered = [];
  while (ready.length) {
    const tableName = ready.shift();
    if (!tableSet.has(tableName)) continue;
    ordered.push(tableName);
    tableSet.delete(tableName);
    for (const dependent of outgoing.get(tableName) ?? []) {
      incoming.get(dependent)?.delete(tableName);
      if (incoming.get(dependent)?.size === 0) ready.push(dependent);
    }
    ready.sort();
  }

  if (tableSet.size) {
    throw new Error(`Cannot determine restore order because foreign keys contain a cycle: ${[...tableSet].join(", ")}`);
  }
  return ordered;
}

export async function rowsForTable(client, tableName, columns) {
  if (!columns.length) return [];
  const selectedColumns = columns.map((column) => quoteIdentifier(column.name)).join(", ");
  const result = await client.query(`SELECT ${selectedColumns} FROM ${qualified(tableName)}`);
  return result.rows;
}

export async function countTableRows(client, tables) {
  const counts = {};
  for (const tableName of tables) {
    const result = await client.query(`SELECT count(*)::integer AS count FROM ${qualified(tableName)}`);
    counts[tableName] = result.rows[0].count;
  }
  return counts;
}

export async function sequenceStates(client) {
  const result = await client.query(`
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);
  const states = [];
  for (const row of result.rows) {
    const sequenceName = row.sequence_name;
    const state = await client.query(`SELECT last_value, is_called FROM ${qualified(sequenceName)}`);
    states.push({
      sequenceName,
      lastValue: state.rows[0].last_value,
      isCalled: state.rows[0].is_called,
    });
  }
  return states;
}

export async function truncateTarget(client, tables) {
  if (!tables.length) return;
  await client.query(`TRUNCATE ${tables.map(qualified).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function setUserTriggers(client, tables, enabled) {
  for (const tableName of tables) {
    await client.query(`ALTER TABLE ${qualified(tableName)} ${enabled ? "ENABLE" : "DISABLE"} TRIGGER USER`);
  }
}

export async function insertBatch(client, tableName, columns, rows) {
  if (!rows.length || !columns.length) return;
  const columnNames = columns.map((column) => column.name);
  const columnSql = columnNames.map(quoteIdentifier).join(", ");
  const hasSystemIdentity = columns.some((column) => column.identityGeneration === "ALWAYS");
  const values = [];
  const tuples = rows.map((row, rowIndex) => {
    const placeholders = columnNames.map((columnName, columnIndex) => {
      values.push(row[columnName]);
      return `$${rowIndex * columnNames.length + columnIndex + 1}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  const overriding = hasSystemIdentity ? " OVERRIDING SYSTEM VALUE" : "";
  await client.query(
    `INSERT INTO ${qualified(tableName)} (${columnSql})${overriding} VALUES ${tuples.join(", ")}`,
    values,
  );
}

export async function restoreSequences(client, states) {
  for (const state of states) {
    await client.query("SELECT setval($1::regclass, $2::bigint, $3::boolean)", [
      `public.${quoteIdentifier(state.sequenceName)}`,
      state.lastValue,
      state.isCalled,
    ]);
  }
}

export function s3ClientFromEnv() {
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
}

export function backupEncryptionSecret() {
  return [
    process.env.BACKUP_ENCRYPTION_KEY,
    process.env.RIVT_BACKUP_ENCRYPTION_KEY,
    process.env.BACKUP_SECRET,
  ].map((value) => value?.trim()).find(Boolean) ?? "";
}

export function previousBackupEncryptionSecret() {
  return [
    process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS,
    process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS,
  ].map((value) => value?.trim()).find(Boolean) ?? "";
}

export function encryptionKeyFromSecret(secret) {
  if (!secret) {
    throw new Error("BACKUP_ENCRYPTION_KEY or RIVT_BACKUP_ENCRYPTION_KEY is required.");
  }
  if (/^[a-f0-9]{64}$/i.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  for (const encoding of ["base64", "base64url"]) {
    try {
      const decoded = Buffer.from(secret, encoding);
      if (decoded.length === 32) return decoded;
    } catch {
      // Try the next supported encoding before deriving from the configured secret.
    }
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptionKeyIdFromSecret(secret) {
  return crypto
    .createHmac("sha256", encryptionKeyFromSecret(secret))
    .update("rivt-backup-key-id-v1")
    .digest("hex")
    .slice(0, 32);
}

export function encryptSnapshot(snapshot, secret) {
  const key = encryptionKeyFromSecret(secret);
  const keyId = encryptionKeyIdFromSecret(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = gzipSync(Buffer.from(JSON.stringify(snapshot)));
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  return {
    format: "rivt-encrypted-logical-backup-v1",
    algorithm: "aes-256-gcm",
    compression: "gzip",
    keyId,
    createdAt: snapshot.createdAt,
    sourceCommit: snapshot.sourceCommit,
    manifest: snapshot.manifest,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptionCandidates(secretOrSecrets) {
  const configured = typeof secretOrSecrets === "string"
    ? [secretOrSecrets]
    : [secretOrSecrets?.active, secretOrSecrets?.previous];
  const candidates = [];
  const seenKeyIds = new Set();
  for (const secret of configured) {
    if (typeof secret !== "string" || !secret) continue;
    const keyId = encryptionKeyIdFromSecret(secret);
    if (seenKeyIds.has(keyId)) continue;
    seenKeyIds.add(keyId);
    candidates.push({ keyId, secret });
  }
  if (candidates.length === 0) {
    throw new Error("BACKUP_ENCRYPTION_KEY or RIVT_BACKUP_ENCRYPTION_KEY is required.");
  }
  return candidates;
}

function keyIdsEqual(left, right) {
  if (!/^[a-f0-9]{32}$/i.test(left) || !/^[a-f0-9]{32}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

class BackupAuthenticationError extends Error {}

function decryptWithSecret(envelope, secret) {
  const key = encryptionKeyFromSecret(secret);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  let compressed;
  try {
    compressed = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]);
  } catch {
    throw new BackupAuthenticationError("Backup authentication failed.");
  }
  return JSON.parse(gunzipSync(compressed).toString("utf8"));
}

export function decryptSnapshot(envelope, secretOrSecrets) {
  if (envelope?.format !== "rivt-encrypted-logical-backup-v1") {
    throw new Error("Unsupported encrypted backup format.");
  }
  if (envelope.algorithm !== "aes-256-gcm" || envelope.compression !== "gzip") {
    throw new Error("Unsupported encrypted backup algorithm or compression.");
  }
  const candidates = decryptionCandidates(secretOrSecrets);
  if (envelope.keyId !== undefined) {
    if (typeof envelope.keyId !== "string" || !/^[a-f0-9]{32}$/i.test(envelope.keyId)) {
      throw new Error("Encrypted backup key identifier is invalid.");
    }
    const matchingCandidate = candidates.find((candidate) => keyIdsEqual(candidate.keyId, envelope.keyId));
    if (!matchingCandidate) {
      throw new Error("Unable to decrypt backup with the configured encryption keys.");
    }
    try {
      return decryptWithSecret(envelope, matchingCandidate.secret);
    } catch (error) {
      if (!(error instanceof BackupAuthenticationError)) throw error;
      throw new Error("Unable to decrypt backup with the configured encryption keys.");
    }
  }

  for (const candidate of candidates) {
    try {
      return decryptWithSecret(envelope, candidate.secret);
    } catch (error) {
      if (!(error instanceof BackupAuthenticationError)) throw error;
      // Older envelopes have no key identifier, so try active then previous.
    }
  }
  throw new Error("Unable to decrypt backup with the configured encryption keys.");
}

export async function putJsonObject(client, bucket, key, value) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(value),
    ContentType: "application/json",
    Metadata: {
      "rivt-artifact": "logical-backup",
    },
  }));
}

export async function getJsonObject(client, bucket, key) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function sumCounts(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

export function diffCounts(expectedCounts, actualCounts) {
  return Object.keys(expectedCounts)
    .sort()
    .map((tableName) => ({
      tableName,
      expected: expectedCounts[tableName],
      actual: actualCounts[tableName],
      delta: (actualCounts[tableName] ?? 0) - expectedCounts[tableName],
    }))
    .filter((entry) => entry.delta !== 0);
}
