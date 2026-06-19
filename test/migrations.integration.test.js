import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { migrateUp, migrationStatus, rollbackLatest } from "../server/migrations.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("versioned migration lifecycle", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  const { Pool } = pg;

  test("versioned migration lifecycle", async () => {
    const schema = `packet01_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: testDatabaseUrl, ssl: false });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const database = new Pool({
      connectionString: testDatabaseUrl,
      ssl: false,
      options: `-c search_path=${schema},pg_catalog`,
    });

    try {
      const baseline = await migrateUp(database, { targetVersion: 1 });
      assert.equal(baseline.latestVersion, 1);
      assert.equal(baseline.pending.length, 1);

      const existingUserId = randomUUID();
      await database.query(
        `INSERT INTO auth_users (
           id, email, email_hash, password_salt, password_hash, provider,
           display_name, role, organization, location
         ) VALUES ($1, $2, $3, 'salt', 'hash', 'google', 'Existing User', 'contractor', 'Free-form Co', 'Jacksonville, FL')`,
        [existingUserId, `${existingUserId}@example.test`, existingUserId.replaceAll("-", "")],
      );
      await database.query(
        "INSERT INTO app_state (id, state) VALUES ($1, $2::jsonb)",
        [randomUUID(), JSON.stringify({ jobs: [{ id: 1 }], sentMessages: ["legacy"] })],
      );

      const applied = await migrateUp(database);
      assert.equal(applied.latestVersion, 2);
      assert.equal(applied.pending.length, 0);

      const bridged = await database.query(
        `SELECT a.primary_role, p.visibility, p.onboarding_status,
                (SELECT count(*)::int FROM organizations) AS organizations,
                (SELECT count(*)::int FROM trades) AS trades
         FROM accounts a INNER JOIN profiles p ON p.account_id = a.id
         WHERE a.id = $1`,
        [existingUserId],
      );
      assert.equal(bridged.rowCount, 1);
      assert.equal(bridged.rows[0].primary_role, "contractor");
      assert.equal(bridged.rows[0].visibility, "private");
      assert.equal(bridged.rows[0].onboarding_status, "draft");
      assert.equal(bridged.rows[0].organizations, 0);
      assert.equal(bridged.rows[0].trades, 25);
      assert.equal((await database.query("SELECT count(*)::int AS count FROM app_state")).rows[0].count, 1);
      assert.equal((await database.query("SELECT to_regclass('jobs') AS table_name")).rows[0].table_name, null);

      const newUserId = randomUUID();
      await database.query(
        `INSERT INTO auth_users (
           id, email, email_hash, password_salt, password_hash, provider,
           display_name, role, organization, location
         ) VALUES ($1, $2, $3, 'salt', 'hash', 'email', 'New User', 'tradesperson', '', 'Jacksonville, FL')`,
        [newUserId, `${newUserId}@example.test`, newUserId.replaceAll("-", "")],
      );
      const newBridge = await database.query(
        "SELECT primary_role FROM accounts WHERE id = $1",
        [newUserId],
      );
      assert.equal(newBridge.rows[0].primary_role, "tradesperson");

      const rerun = await migrateUp(database);
      assert.equal(rerun.applied.length, 2);

      await database.query(
        "INSERT INTO audit_events (action, subject_type, subject_id) VALUES ('test.created', 'test', 'one')",
      );
      await assert.rejects(
        database.query("UPDATE audit_events SET action = 'test.changed' WHERE subject_id = 'one'"),
        /append-only/,
      );

      const rolledBack = await rollbackLatest(database);
      assert.equal(rolledBack.latestVersion, 1);
      assert.equal((await database.query("SELECT to_regclass('accounts') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT count(*)::int AS count FROM app_state")).rows[0].count, 1);

      const reapplied = await migrateUp(database);
      assert.equal(reapplied.latestVersion, 2);
      assert.equal((await database.query("SELECT count(*)::int AS count FROM accounts")).rows[0].count, 2);

      const stored = await database.query("SELECT checksum FROM schema_migrations WHERE version = 2");
      await database.query("UPDATE schema_migrations SET checksum = 'tampered' WHERE version = 2");
      await assert.rejects(migrationStatus(database), /checksum does not match source/);
      await database.query("UPDATE schema_migrations SET checksum = $1 WHERE version = 2", [stored.rows[0].checksum]);
    } finally {
      await database.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
}
