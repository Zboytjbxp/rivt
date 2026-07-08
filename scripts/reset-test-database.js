import "dotenv/config";

import pg from "pg";
import { migrateUp } from "../server/migrations.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const confirmed = process.argv.includes("--yes") || process.env.CONFIRM_RESET_TEST_DATABASE === "true";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!testDatabaseUrl) {
  fail("TEST_DATABASE_URL is required. Add it to local .env or inject it in the shell.");
}

let parsed;
try {
  parsed = new URL(testDatabaseUrl);
} catch {
  fail("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
}

const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
if (!/(^|[_-])test($|[_-])|rivt_test/.test(databaseName)) {
  fail(`Refusing to reset database "${databaseName}". TEST_DATABASE_URL must point to an isolated test database.`);
}

if (process.env.DATABASE_URL?.trim() && process.env.DATABASE_URL.trim() === testDatabaseUrl) {
  fail("Refusing to reset because TEST_DATABASE_URL matches DATABASE_URL.");
}

if (!confirmed) {
  fail("Refusing to reset without --yes or CONFIRM_RESET_TEST_DATABASE=true.");
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: testDatabaseUrl,
  ssl: process.env.PGSSL === "disable" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
    ? false
    : { rejectUnauthorized: false },
});

try {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("GRANT ALL ON SCHEMA public TO public");
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  const result = await migrateUp(pool);
  console.log(JSON.stringify({
    ok: true,
    database: databaseName,
    latestVersion: result.latestVersion,
    latestName: result.latestName,
    applied: result.applied.length,
    pending: result.pending.length,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
