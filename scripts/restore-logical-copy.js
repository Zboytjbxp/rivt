import "dotenv/config";
import assert from "node:assert/strict";
import pg from "pg";
import { migrateUp } from "../server/migrations.js";

const sourceUrl = process.env.RESTORE_SOURCE_DATABASE_URL?.trim();
const targetUrl = process.env.RESTORE_DATABASE_URL?.trim();
const confirmedIsolated = process.env.CONFIRM_RESTORE_TARGET_ISOLATED === "true";
const batchSize = Number.parseInt(process.env.RESTORE_COPY_BATCH_SIZE ?? "200", 10);
const applyMigrations = process.argv.includes("--apply-migrations");

if (!sourceUrl) {
  console.error("RESTORE_SOURCE_DATABASE_URL is required for a logical restore copy.");
  process.exit(1);
}
if (!targetUrl) {
  console.error("RESTORE_DATABASE_URL is required and must point to an isolated nonproduction PostgreSQL target.");
  process.exit(1);
}
if (!confirmedIsolated) {
  console.error("CONFIRM_RESTORE_TARGET_ISOLATED=true is required. Never run a restore drill against production.");
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error("RESTORE_SOURCE_DATABASE_URL and RESTORE_DATABASE_URL must not point to the same database.");
  process.exit(1);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
  console.error("RESTORE_COPY_BATCH_SIZE must be an integer from 1 to 1000.");
  process.exit(1);
}

function parsedDatabaseIdentity(connectionString) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    username: url.username,
  };
}

const sourceIdentity = parsedDatabaseIdentity(sourceUrl);
const targetIdentity = parsedDatabaseIdentity(targetUrl);
if (
  sourceIdentity.host === targetIdentity.host &&
  sourceIdentity.port === targetIdentity.port &&
  sourceIdentity.database === targetIdentity.database &&
  sourceIdentity.username === targetIdentity.username
) {
  console.error("Restore source and target identities match. Refusing to continue.");
  process.exit(1);
}

function sslFor(url) {
  return process.env.PGSSL === "disable" || url.includes("localhost") ? false : { rejectUnauthorized: false };
}

function poolFor(url) {
  return new pg.Pool({
    connectionString: url,
    ssl: sslFor(url),
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

function qualified(tableName) {
  return `${quoteIdentifier("public")}.${quoteIdentifier(tableName)}`;
}

async function publicTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((row) => row.table_name);
}

async function tableColumns(client, tableName) {
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

async function foreignKeyDependencies(client, tables) {
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

function orderedTables(tables, dependencies) {
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

async function truncateTarget(client, tables) {
  if (!tables.length) return;
  await client.query(`TRUNCATE ${tables.map(qualified).join(", ")} RESTART IDENTITY CASCADE`);
}

async function rowsForTable(client, tableName, columns) {
  if (!columns.length) return [];
  const selectedColumns = columns.map((column) => quoteIdentifier(column.name)).join(", ");
  const result = await client.query(`SELECT ${selectedColumns} FROM ${qualified(tableName)}`);
  return result.rows;
}

async function insertBatch(client, tableName, columns, rows) {
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

async function copyTable(sourceClient, targetClient, tableName) {
  const columns = await tableColumns(targetClient, tableName);
  const rows = await rowsForTable(sourceClient, tableName, columns);
  for (let index = 0; index < rows.length; index += batchSize) {
    await insertBatch(targetClient, tableName, columns, rows.slice(index, index + batchSize));
  }
  return rows.length;
}

async function sequenceStates(client) {
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

async function restoreSequences(client, states) {
  for (const state of states) {
    await client.query("SELECT setval($1::regclass, $2::bigint, $3::boolean)", [
      `public.${quoteIdentifier(state.sequenceName)}`,
      state.lastValue,
      state.isCalled,
    ]);
  }
}

const startedAt = Date.now();
const sourcePool = poolFor(sourceUrl);
const targetPool = poolFor(targetUrl);

try {
  if (applyMigrations) await migrateUp(targetPool);

  const sourceClient = await sourcePool.connect();
  const targetClient = await targetPool.connect();
  try {
    await sourceClient.query("SET statement_timeout = '60s'");
    await targetClient.query("SET statement_timeout = '60s'");

    const sourceTables = await publicTables(sourceClient);
    const targetTables = await publicTables(targetClient);
    assert.deepEqual(
      [...sourceTables].sort(),
      [...targetTables].sort(),
      "Restore source and target table sets must match after migrations.",
    );

    const dependencies = await foreignKeyDependencies(targetClient, targetTables);
    const copyOrder = orderedTables(targetTables, dependencies);

    await truncateTarget(targetClient, copyOrder);

    const copiedRows = {};
    for (const tableName of copyOrder) {
      copiedRows[tableName] = await copyTable(sourceClient, targetClient, tableName);
    }
    await restoreSequences(targetClient, await sequenceStates(sourceClient));

    console.log(JSON.stringify({
      ok: true,
      mode: applyMigrations ? "migrate-and-logical-copy" : "logical-copy",
      tables: copyOrder.length,
      rows: Object.values(copiedRows).reduce((total, count) => total + count, 0),
      copiedRows,
      durationMs: Date.now() - startedAt,
    }, null, 2));
  } finally {
    sourceClient.release();
    targetClient.release();
  }
} finally {
  await sourcePool.end();
  await targetPool.end();
}
