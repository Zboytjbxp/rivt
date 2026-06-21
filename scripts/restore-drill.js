import "dotenv/config";
import assert from "node:assert/strict";
import pg from "pg";
import { migrateUp, migrationStatus } from "../server/migrations.js";

const targetUrl = process.env.RESTORE_DATABASE_URL?.trim();
const sourceUrl = process.env.RESTORE_SOURCE_DATABASE_URL?.trim();
const applyMigrations = process.argv.includes("--apply-migrations");
const strictCompare = process.env.RESTORE_STRICT_COMPARE !== "false";
const confirmedIsolated = process.env.CONFIRM_RESTORE_TARGET_ISOLATED === "true";

if (!targetUrl) {
  console.error("RESTORE_DATABASE_URL is required and must point to an isolated nonproduction PostgreSQL target.");
  process.exit(1);
}
if (!confirmedIsolated) {
  console.error("CONFIRM_RESTORE_TARGET_ISOLATED=true is required. Never run a restore drill against production.");
  process.exit(1);
}
if (sourceUrl && sourceUrl === targetUrl) {
  console.error("RESTORE_SOURCE_DATABASE_URL and RESTORE_DATABASE_URL must not point to the same database.");
  process.exit(1);
}

function sslFor(url) {
  return process.env.PGSSL === "disable" || url.includes("localhost") ? false : { rejectUnauthorized: false };
}

function poolFor(url) {
  return new pg.Pool({ connectionString: url, ssl: sslFor(url) });
}

const criticalTables = [
  "schema_migrations",
  "auth_users",
  "accounts",
  "profiles",
  "organizations",
  "organization_memberships",
  "jobs",
  "applications",
  "offers",
  "active_work",
  "conversations",
  "messages",
  "notifications",
  "projects",
  "project_entries",
  "project_media",
  "completion_submissions",
  "work_reviews",
  "support_cases",
  "admin_action_events",
  "rate_limit_windows",
];

async function tableExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1) AS table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

async function inventory(pool) {
  const client = await pool.connect();
  try {
    const counts = {};
    for (const tableName of criticalTables) {
      assert.equal(await tableExists(client, tableName), true, `${tableName} is missing from restore target.`);
      const result = await client.query(`SELECT count(*)::integer AS count FROM ${tableName}`);
      counts[tableName] = result.rows[0].count;
    }
    return counts;
  } finally {
    client.release();
  }
}

function diffCounts(sourceCounts, targetCounts) {
  return criticalTables
    .map((tableName) => ({
      tableName,
      source: sourceCounts[tableName],
      target: targetCounts[tableName],
      delta: targetCounts[tableName] - sourceCounts[tableName],
    }))
    .filter((entry) => entry.delta !== 0);
}

const startedAt = Date.now();
const targetPool = poolFor(targetUrl);
const sourcePool = sourceUrl ? poolFor(sourceUrl) : null;

try {
  if (applyMigrations) await migrateUp(targetPool);
  const status = await migrationStatus(targetPool);
  assert.equal(status.pending.length, 0, `Restore target has pending migrations: ${JSON.stringify(status.pending)}`);
  assert.ok(status.applied.some((migration) => migration.version === 9), "Restore target must include migration 0009.");

  const targetCounts = await inventory(targetPool);
  let sourceCounts = null;
  let countDiffs = [];
  if (sourcePool) {
    sourceCounts = await inventory(sourcePool);
    countDiffs = diffCounts(sourceCounts, targetCounts);
    if (strictCompare) {
      assert.deepEqual(countDiffs, [], `Restore target row counts differ from source: ${JSON.stringify(countDiffs)}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    mode: applyMigrations ? "migrate-and-verify" : "verify-restored-target",
    latestMigration: status.latestVersion
      ? `${String(status.latestVersion).padStart(4, "0")}_${status.latestName}`
      : null,
    appliedMigrations: status.applied.length,
    pendingMigrations: status.pending.length,
    targetCounts,
    sourceCounts,
    countDiffs,
    strictCompare,
    durationMs: Date.now() - startedAt,
  }, null, 2));
} finally {
  await targetPool.end();
  if (sourcePool) await sourcePool.end();
}
