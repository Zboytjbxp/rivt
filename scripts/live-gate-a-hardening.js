import "dotenv/config";
import assert from "node:assert/strict";
import pg from "pg";
import { migrationStatus } from "../server/migrations.js";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedCommit = process.env.EXPECTED_SOURCE_COMMIT?.trim() || process.env.SOURCE_COMMIT?.trim();

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

const forbiddenPublicPatterns = [
  "panel trim-out",
  "rough-in pex",
  "mini-split",
  "stair landing",
  "darius chen",
  "maya ortiz",
  "andre malik",
  "nora walsh",
  "harborline builders",
  "keystone mechanical",
  "bluebeam homes",
  "packet0",
  "smoke test",
  "production smoke",
].map((pattern) => `%${pattern}%`);

async function request(path, { method = "GET", expected } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Origin: baseUrl },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${path} returned ${response.status}: ${text}`);
  }
  return { response, payload };
}

async function count(client, sql) {
  const result = await client.query(sql);
  return Number(result.rows[0]?.count ?? 0);
}

async function seedFindings(client) {
  const checks = [
    {
      source: "open_jobs",
      sql: `SELECT id::text, title AS label
            FROM jobs
            WHERE status = 'open'
              AND lower(concat_ws(' ', title, summary, scope_description)) LIKE ANY($1::text[])
            ORDER BY updated_at DESC
            LIMIT 20`,
    },
    {
      source: "network_profiles",
      sql: `SELECT p.account_id::text AS id, p.display_name AS label
            FROM profiles p
            INNER JOIN accounts a ON a.id = p.account_id
            WHERE a.status = 'active'
              AND p.visibility = 'network'
              AND lower(concat_ws(' ', p.display_name, p.headline, p.bio, p.location_text)) LIKE ANY($1::text[])
            ORDER BY p.updated_at DESC
            LIMIT 20`,
    },
    {
      source: "active_organizations",
      sql: `SELECT o.id::text AS id, o.name AS label
            FROM organizations o
            WHERE o.status = 'active'
              AND lower(o.name) LIKE ANY($1::text[])
            ORDER BY o.updated_at DESC
            LIMIT 20`,
    },
    {
      source: "public_reviews",
      sql: `SELECT wr.id::text AS id, left(wr.body, 80) AS label
            FROM work_reviews wr
            INNER JOIN accounts a ON a.id = wr.reviewee_account_id
            INNER JOIN profiles p ON p.account_id = a.id
            WHERE a.status = 'active'
              AND p.visibility = 'network'
              AND wr.status IN ('approved', 'resolved')
              AND lower(wr.body) LIKE ANY($1::text[])
            ORDER BY wr.submitted_at DESC
            LIMIT 20`,
    },
  ];

  const findings = [];
  for (const check of checks) {
    const result = await client.query(check.sql, [forbiddenPublicPatterns]);
    findings.push(...result.rows.map((row) => ({
      source: check.source,
      id: row.id,
      label: row.label,
    })));
  }
  return findings;
}

async function tableExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1) AS table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

try {
  const health = await request("/api/health", { expected: 200 });
  assert.equal(health.payload.ok, true);
  if (expectedCommit) assert.equal(health.payload.build.commit, expectedCommit);

  const providers = await request("/api/auth/providers", { expected: 200 });
  assert.equal(providers.payload.inviteRequired, true, "Pilot invitations must remain required for Gate A.");
  assert.equal(providers.payload.providers.email.ok, true, "Email provider must be configured for Gate A.");
  assert.ok(providers.payload.controls, "Operational controls must be exposed to providers status.");

  const anonymousPrivateChecks = [
    "/api/readiness",
    "/api/storage",
    "/api/app-state",
    "/api/v1/me",
    "/api/v1/jobs",
    "/api/v1/conversations",
    "/api/v1/admin/overview",
  ];
  for (const path of anonymousPrivateChecks) {
    const result = await request(path);
    assert.equal(result.response.status, 401, `${path} must fail closed for anonymous users.`);
  }

  const migrations = await migrationStatus(pool);
  assert.equal(migrations.pending.length, 0);
  assert.ok(migrations.applied.some((migration) => migration.version === 8), "Migration 0008 must be applied.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const findings = await seedFindings(client);
    assert.deepEqual(findings, [], `User-facing seed/demo findings: ${JSON.stringify(findings)}`);

    const legacyAppStateExists = await tableExists(client, "app_state");
    const summary = {
      ok: true,
      buildCommit: health.payload.build.commit,
      migrationVersion: migrations.latestVersion
        ? `${String(migrations.latestVersion).padStart(4, "0")}_${migrations.latestName}`
        : null,
      counts: {
        activeAccounts: await count(client, "SELECT count(*) FROM accounts WHERE status = 'active'"),
        networkProfiles: await count(client, "SELECT count(*) FROM profiles p INNER JOIN accounts a ON a.id = p.account_id WHERE a.status = 'active' AND p.visibility = 'network'"),
        openJobs: await count(client, "SELECT count(*) FROM jobs WHERE status = 'open'"),
        supportCasesOpen: await count(client, "SELECT count(*) FROM support_cases WHERE status <> 'closed'"),
        activeRestrictions: await count(client, "SELECT count(*) FROM account_restrictions WHERE status = 'active' AND (ends_at IS NULL OR ends_at > now())"),
        legacyAppStateRows: legacyAppStateExists ? await count(client, "SELECT count(*) FROM app_state") : 0,
      },
      controls: providers.payload.controls,
      anonymousPrivateChecks: anonymousPrivateChecks.length,
      seedFindings: findings.length,
    };
    await client.query("ROLLBACK");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
