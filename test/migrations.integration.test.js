import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { migrateUp, migrationStatus, rollbackLatest } from "../server/migrations.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const latestMigrationVersion = Math.max(
  ...readdirSync(new URL("../migrations/", import.meta.url))
    .map((name) => name.match(/^(\d+)_.*[.]up[.]sql$/)?.[1])
    .filter(Boolean)
    .map(Number),
);
const expectedPendingAfter = (version) => latestMigrationVersion - version;

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
      assert.equal(baseline.pending.length, expectedPendingAfter(1));

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

      const applied = await migrateUp(database, { targetVersion: 2 });
      assert.equal(applied.latestVersion, 2);
      assert.equal(applied.pending.length, expectedPendingAfter(2));

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

      const rerun = await migrateUp(database, { targetVersion: 2 });
      assert.equal(rerun.applied.length, 2);

      await database.query(
        "INSERT INTO audit_events (action, subject_type, subject_id) VALUES ('test.created', 'test', 'one')",
      );
      await assert.rejects(
        database.query("UPDATE audit_events SET action = 'test.changed' WHERE subject_id = 'one'"),
        /append-only/,
      );

      const authFoundation = await migrateUp(database, { targetVersion: 3 });
      assert.equal(authFoundation.latestVersion, 3);
      assert.equal(authFoundation.pending.length, expectedPendingAfter(3));
      const authState = await database.query(
        `SELECT u.provider, u.email_verified_at, a.status,
                p.service_radius_miles, p.contact_email_visibility
         FROM auth_users u
         INNER JOIN accounts a ON a.id = u.id
         INNER JOIN profiles p ON p.account_id = u.id
         ORDER BY u.provider`,
      );
      assert.equal(authState.rows[0].provider, "email");
      assert.equal(authState.rows[0].email_verified_at, null);
      assert.equal(authState.rows[0].status, "onboarding");
      assert.equal(authState.rows[1].provider, "google");
      assert.ok(authState.rows[1].email_verified_at instanceof Date);
      assert.equal(authState.rows[1].status, "onboarding");
      assert.equal(authState.rows[1].service_radius_miles, 25);
      assert.equal(authState.rows[1].contact_email_visibility, "private");

      const jobsFoundation = await migrateUp(database, { targetVersion: 4 });
      assert.equal(jobsFoundation.latestVersion, 4);
      assert.equal(jobsFoundation.pending.length, expectedPendingAfter(4));
      assert.notEqual((await database.query("SELECT to_regclass('jobs') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('job_private_locations') AS table_name")).rows[0].table_name, null);

      const matchFoundation = await migrateUp(database, { targetVersion: 5 });
      assert.equal(matchFoundation.latestVersion, 5);
      assert.equal(matchFoundation.pending.length, expectedPendingAfter(5));
      assert.notEqual((await database.query("SELECT to_regclass('job_applications') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('active_work') AS table_name")).rows[0].table_name, null);

      const messagingFoundation = await migrateUp(database, { targetVersion: 6 });
      assert.equal(messagingFoundation.latestVersion, 6);
      assert.equal(messagingFoundation.pending.length, expectedPendingAfter(6));
      assert.notEqual((await database.query("SELECT to_regclass('conversations') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('in_app_notifications') AS table_name")).rows[0].table_name, null);

      const projectFoundation = await migrateUp(database, { targetVersion: 7 });
      assert.equal(projectFoundation.latestVersion, 7);
      assert.equal(projectFoundation.pending.length, expectedPendingAfter(7));
      assert.notEqual((await database.query("SELECT to_regclass('projects') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('project_media') AS table_name")).rows[0].table_name, null);

      const safetyFoundation = await migrateUp(database, { targetVersion: 8 });
      assert.equal(safetyFoundation.latestVersion, 8);
      assert.equal(safetyFoundation.pending.length, expectedPendingAfter(8));
      assert.notEqual((await database.query("SELECT to_regclass('work_reviews') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('admin_role_grants') AS table_name")).rows[0].table_name, null);

      const hardeningFoundation = await migrateUp(database, { targetVersion: 9 });
      assert.equal(hardeningFoundation.latestVersion, 9);
      assert.equal(hardeningFoundation.pending.length, expectedPendingAfter(9));
      assert.notEqual((await database.query("SELECT to_regclass('rate_limit_windows') AS table_name")).rows[0].table_name, null);

      const shopTalkFoundation = await migrateUp(database, { targetVersion: 10 });
      assert.equal(shopTalkFoundation.latestVersion, 10);
      assert.equal(shopTalkFoundation.pending.length, expectedPendingAfter(10));
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_reactions') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_reaction_events') AS table_name")).rows[0].table_name, null);

      const shopTalkModeration = await migrateUp(database);
      assert.equal(shopTalkModeration.latestVersion, latestMigrationVersion);
      assert.equal(shopTalkModeration.pending.length, 0);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_reports') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_moderation_actions') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('tool_records') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('network_records') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_post_media') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'shop_talk_posts' AND column_name = 'moderation_status'")).rowCount, 0);
      const shopTalkRedditBackbone = shopTalkModeration;
      assert.equal(shopTalkRedditBackbone.pending.length, 0);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_reactions') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_reaction_events') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('photo_albums') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('album_photos') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('billing_entitlements') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_answers') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('push_subscriptions') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('push_delivery_outbox') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('project_invoices') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('project_invoice_payments') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('standalone_projects') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query(
        "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'tool_records' AND column_name IN ('standalone_project_id', 'active_work_id')",
      )).rows[0].count, 2);
      assert.equal((await database.query(
        "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'push_subscriptions' AND column_name = 'auth_session_id'",
      )).rows[0].count, 1);

      const smokeReaction = await database.query(
        `INSERT INTO shop_talk_reactions (actor_account_id, target_type, target_key, reaction)
         VALUES ($1, 'thread', 'post:migration_smoke', 'up')
         RETURNING id`,
        [newUserId],
      );
      await database.query(
        `INSERT INTO shop_talk_reaction_events (
           reaction_id, actor_account_id, target_type, target_key, event_type, next_reaction
         ) VALUES ($1, $2, 'thread', 'post:migration_smoke', 'set_up', 'up')`,
        [smokeReaction.rows[0].id, newUserId],
      );
      await database.query("DELETE FROM shop_talk_reactions WHERE id = $1", [smokeReaction.rows[0].id]);
      const reactionEvent = await database.query(
        "SELECT reaction_id FROM shop_talk_reaction_events WHERE target_key = 'post:migration_smoke'",
      );
      assert.equal(reactionEvent.rows[0].reaction_id, smokeReaction.rows[0].id);
      await assert.rejects(
        database.query("UPDATE shop_talk_reaction_events SET next_reaction = 'down' WHERE target_key = 'post:migration_smoke'"),
        /append-only/,
      );

      const rolledBackStandaloneProjects = await rollbackLatest(database);
      assert.equal(rolledBackStandaloneProjects.latestVersion, 25);
      assert.equal((await database.query("SELECT to_regclass('standalone_projects') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query(
        "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'tool_records' AND column_name IN ('standalone_project_id', 'active_work_id')",
      )).rows[0].count, 0);

      const rolledBackProjectFinancials = await rollbackLatest(database);
      assert.equal(rolledBackProjectFinancials.latestVersion, 24);
      assert.equal((await database.query("SELECT to_regclass('project_invoices') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT to_regclass('project_invoice_payments') AS table_name")).rows[0].table_name, null);

      const rolledBackPushSessionBinding = await rollbackLatest(database);
      assert.equal(rolledBackPushSessionBinding.latestVersion, 23);
      assert.equal((await database.query(
        "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'push_subscriptions' AND column_name = 'auth_session_id'",
      )).rows[0].count, 0);
      assert.notEqual((await database.query("SELECT to_regclass('push_subscriptions') AS table_name")).rows[0].table_name, null);

      const rolledBackPushDelivery = await rollbackLatest(database);
      assert.equal(rolledBackPushDelivery.latestVersion, 22);
      assert.equal((await database.query("SELECT to_regclass('push_subscriptions') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT to_regclass('push_delivery_outbox') AS table_name")).rows[0].table_name, null);

      const rolledBackCommunityAudiences = await rollbackLatest(database);
      assert.equal(rolledBackCommunityAudiences.latestVersion, 21);
      assert.equal((await database.query("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'communities' AND column_name = 'audience'")).rowCount, 0);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_post_media') AS table_name")).rows[0].table_name, null);

      const rolledBackShopTalkPostMedia = await rollbackLatest(database);
      assert.equal(rolledBackShopTalkPostMedia.latestVersion, 20);
      assert.equal((await database.query("SELECT to_regclass('shop_talk_post_media') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('network_records') AS table_name")).rows[0].table_name, null);

      const rolledBackNetworkRecords = await rollbackLatest(database);
      assert.equal(rolledBackNetworkRecords.latestVersion, 19);
      assert.equal((await database.query("SELECT to_regclass('network_records') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('tool_records') AS table_name")).rows[0].table_name, null);

      const rolledBackToolRecords = await rollbackLatest(database);
      assert.equal(rolledBackToolRecords.latestVersion, 18);
      assert.equal((await database.query("SELECT to_regclass('tool_records') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_reports') AS table_name")).rows[0].table_name, null);

      const rolledBackShopTalkModeration = await rollbackLatest(database);
      assert.equal(rolledBackShopTalkModeration.latestVersion, 17);
      assert.equal((await database.query("SELECT to_regclass('shop_talk_reports') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_answers') AS table_name")).rows[0].table_name, null);

      const rolledBackShopTalkRedditBackbone = await rollbackLatest(database);
      assert.equal(rolledBackShopTalkRedditBackbone.latestVersion, 16);
      assert.equal((await database.query("SELECT to_regclass('shop_talk_answers') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('communities') AS table_name")).rows[0].table_name, null);

      const rolledBackCommunities = await rollbackLatest(database);
      assert.equal(rolledBackCommunities.latestVersion, 15);
      assert.equal((await database.query("SELECT to_regclass('communities') AS table_name")).rows[0].table_name, null);

      const rolledBackShopTalkPosts = await rollbackLatest(database);
      assert.equal(rolledBackShopTalkPosts.latestVersion, 14);
      assert.equal((await database.query("SELECT to_regclass('shop_talk_posts') AS table_name")).rows[0].table_name, null);

      const rolledBackBilling = await rollbackLatest(database);
      assert.equal(rolledBackBilling.latestVersion, 13);
      assert.equal((await database.query("SELECT to_regclass('billing_entitlements') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('photo_albums') AS table_name")).rows[0].table_name, null);

      const rolledBackAlbumScope = await rollbackLatest(database);
      assert.equal(rolledBackAlbumScope.latestVersion, 12);

      const rolledBackPhotoAlbums = await rollbackLatest(database);
      assert.equal(rolledBackPhotoAlbums.latestVersion, 11);
      assert.equal((await database.query("SELECT to_regclass('photo_albums') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_reaction_events') AS table_name")).rows[0].table_name, null);

      const rolledBackShopTalkImmutabilityFix = await rollbackLatest(database);
      assert.equal(rolledBackShopTalkImmutabilityFix.latestVersion, 10);
      assert.notEqual((await database.query("SELECT to_regclass('shop_talk_reactions') AS table_name")).rows[0].table_name, null);

      const rolledBackShopTalk = await rollbackLatest(database);
      assert.equal(rolledBackShopTalk.latestVersion, 9);
      assert.equal((await database.query("SELECT to_regclass('shop_talk_reactions') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('rate_limit_windows') AS table_name")).rows[0].table_name, null);

      const rolledBackHardening = await rollbackLatest(database);
      assert.equal(rolledBackHardening.latestVersion, 8);
      assert.equal((await database.query("SELECT to_regclass('rate_limit_windows') AS table_name")).rows[0].table_name, null);
      assert.notEqual((await database.query("SELECT to_regclass('work_reviews') AS table_name")).rows[0].table_name, null);

      const rolledBackSafety = await rollbackLatest(database);
      assert.equal(rolledBackSafety.latestVersion, 7);
      assert.notEqual((await database.query("SELECT to_regclass('projects') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT to_regclass('work_reviews') AS table_name")).rows[0].table_name, null);

      const rolledBackProject = await rollbackLatest(database);
      assert.equal(rolledBackProject.latestVersion, 6);
      assert.notEqual((await database.query("SELECT to_regclass('conversations') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT to_regclass('projects') AS table_name")).rows[0].table_name, null);

      const rolledBackMessaging = await rollbackLatest(database);
      assert.equal(rolledBackMessaging.latestVersion, 5);
      assert.notEqual((await database.query("SELECT to_regclass('active_work') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT to_regclass('conversations') AS table_name")).rows[0].table_name, null);

      const rolledBackMatch = await rollbackLatest(database);
      assert.equal(rolledBackMatch.latestVersion, 4);
      assert.notEqual((await database.query("SELECT to_regclass('jobs') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT to_regclass('active_work') AS table_name")).rows[0].table_name, null);

      const rolledBack = await rollbackLatest(database);
      assert.equal(rolledBack.latestVersion, 3);
      assert.notEqual((await database.query("SELECT to_regclass('accounts') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT count(*)::int AS count FROM app_state")).rows[0].count, 1);
      assert.notEqual((await database.query("SELECT to_regclass('email_verification_tokens') AS table_name")).rows[0].table_name, null);
      assert.equal((await database.query("SELECT to_regclass('jobs') AS table_name")).rows[0].table_name, null);

      const reapplied = await migrateUp(database);
      assert.equal(reapplied.latestVersion, latestMigrationVersion);
      assert.equal((await database.query("SELECT count(*)::int AS count FROM accounts")).rows[0].count, 2);

      const stored = await database.query("SELECT checksum FROM schema_migrations WHERE version = 14");
      await database.query("UPDATE schema_migrations SET checksum = 'tampered' WHERE version = 14");
      await migrationStatus(database);
      const repaired = await database.query("SELECT checksum FROM schema_migrations WHERE version = 14");
      assert.equal(repaired.rows[0].checksum, stored.rows[0].checksum);
    } finally {
      await database.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
}
