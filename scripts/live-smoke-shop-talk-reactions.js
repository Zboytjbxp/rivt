import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { migrationStatus } from "../server/migrations.js";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedCommit = process.env.EXPECTED_SOURCE_COMMIT?.trim() || process.env.SOURCE_COMMIT?.trim();
const smokeRun = `shop-talk-react-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function sessionCookie(response) {
  return String(response.headers.get("set-cookie") ?? "").split(";", 1)[0];
}

async function requestJson(pathname, { body, cookie, idempotencyKey, method = "GET", expected } = {}) {
  const headers = { Origin: baseUrl };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${pathname} returned ${response.status}: ${text}`);
  }
  return { response, payload };
}

async function createInvite(client, { email, role }) {
  const code = `rivt_${randomBytes(24).toString("base64url")}`;
  const result = await client.query(
    `INSERT INTO signup_invites (code_hash, email_hash, allowed_role, max_uses, expires_at)
     VALUES ($1, $2, $3, 1, now() + interval '1 day')
     RETURNING id`,
    [sha256(code), sha256(normalizeEmail(email)), role],
  );
  return { code, id: result.rows[0].id };
}

async function verifyEmailDirectly(client, email) {
  await client.query(
    "UPDATE auth_users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE email_hash = $1",
    [sha256(normalizeEmail(email))],
  );
}

async function signupAndOnboard(role, label) {
  const email = `${smokeRun}-${role}-${randomBytes(2).toString("hex")}@example.test`;
  const password = `ShopTalk!${randomBytes(10).toString("base64url")}1a`;
  const invite = await createInvite(pool, { email, role });
  const signup = await requestJson("/api/v1/auth/signup", {
    method: "POST",
    expected: 201,
    body: {
      email,
      password,
      displayName: `${label} ${smokeRun}`,
      role,
      inviteCode: invite.code,
    },
  });
  const cookie = sessionCookie(signup.response);
  await verifyEmailDirectly(pool, email);
  await requestJson("/api/v1/onboarding/complete", {
    method: "POST",
    cookie,
    expected: 200,
    body: {
      role,
      displayName: `${label} ${smokeRun}`,
      headline: role === "contractor" ? "RIVT Shop Talk smoke contractor" : "RIVT Shop Talk smoke electrician",
      bio: "Temporary Shop Talk reaction smoke account.",
      serviceAreaCity: "Jacksonville",
      serviceAreaRegion: "FL",
      serviceRadiusMiles: 35,
      availabilityStatus: "available",
      contactEmailVisibility: "private",
      phoneE164: null,
      phoneVisibility: "private",
      tradeCodes: ["electrical"],
      organizationName: role === "contractor" ? `${label} ${smokeRun} LLC` : undefined,
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  const me = await requestJson("/api/v1/me", { cookie, expected: 200 });
  return {
    role,
    email,
    cookie,
    inviteId: invite.id,
    accountId: me.payload.data.id,
  };
}

async function closeSmokeArtifacts(accounts, targetKey) {
  const accountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (accountIds.length > 0) {
    await pool.query(
      "DELETE FROM shop_talk_reactions WHERE actor_account_id = ANY($1::uuid[]) OR target_key = $2",
      [accountIds, targetKey],
    );
    await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
    await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
    await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
  }
}

const accounts = [];
const target = { targetType: "thread", targetKey: `post:${smokeRun.replace(/-/g, "_")}` };

try {
  const actor = await signupAndOnboard("tradesperson", "Shop Talk Reactor");
  accounts.push(actor);
  const secondActor = await signupAndOnboard("contractor", "Shop Talk Contractor");
  accounts.push(secondActor);

  const readiness = await requestJson("/api/readiness", { cookie: actor.cookie, expected: 200 });
  assert.equal(readiness.payload.migrations.pending.length, 0);
  assert.ok(readiness.payload.migrations.applied.some((migration) => migration.version === 11));
  if (expectedCommit) assert.equal(readiness.payload.build.commit, expectedCommit);

  const migrations = await migrationStatus(pool);
  assert.equal(migrations.pending.length, 0);
  assert.ok(migrations.applied.some((migration) => migration.version === 11));

  const anonymous = await requestJson("/api/v1/shop-talk/reactions/batch", {
    method: "POST",
    body: { targets: [target] },
  });
  assert.equal(anonymous.response.status, 401);

  const initial = await requestJson("/api/v1/shop-talk/reactions/batch", {
    method: "POST",
    cookie: actor.cookie,
    expected: 200,
    body: { targets: [target] },
  });
  assert.deepEqual(initial.payload.data.reactions[0], {
    ...target,
    upvotes: 0,
    downvotes: 0,
    score: 0,
    viewerReaction: null,
  });

  const upvote = await requestJson("/api/v1/shop-talk/reactions", {
    method: "POST",
    cookie: actor.cookie,
    idempotencyKey: `shop-talk-up-${smokeRun}`,
    expected: 200,
    body: { ...target, reaction: "up" },
  });
  assert.equal(upvote.payload.data.reaction.upvotes, 1);
  assert.equal(upvote.payload.data.reaction.viewerReaction, "up");

  const replay = await requestJson("/api/v1/shop-talk/reactions", {
    method: "POST",
    cookie: actor.cookie,
    idempotencyKey: `shop-talk-up-${smokeRun}`,
    expected: 200,
    body: { ...target, reaction: "up" },
  });
  assert.equal(replay.response.headers.get("idempotent-replayed"), "true");
  assert.equal(replay.payload.data.reaction.upvotes, 1);

  const switchToDown = await requestJson("/api/v1/shop-talk/reactions", {
    method: "POST",
    cookie: actor.cookie,
    idempotencyKey: `shop-talk-down-${smokeRun}`,
    expected: 200,
    body: { ...target, reaction: "down" },
  });
  assert.equal(switchToDown.payload.data.reaction.upvotes, 0);
  assert.equal(switchToDown.payload.data.reaction.downvotes, 1);
  assert.equal(switchToDown.payload.data.reaction.viewerReaction, "down");

  const secondUpvote = await requestJson("/api/v1/shop-talk/reactions", {
    method: "POST",
    cookie: secondActor.cookie,
    idempotencyKey: `shop-talk-second-up-${smokeRun}`,
    expected: 200,
    body: { ...target, reaction: "up" },
  });
  assert.equal(secondUpvote.payload.data.reaction.upvotes, 1);
  assert.equal(secondUpvote.payload.data.reaction.downvotes, 1);

  const firstActorView = await requestJson("/api/v1/shop-talk/reactions/batch", {
    method: "POST",
    cookie: actor.cookie,
    expected: 200,
    body: { targets: [target] },
  });
  assert.equal(firstActorView.payload.data.reactions[0].upvotes, 1);
  assert.equal(firstActorView.payload.data.reactions[0].downvotes, 1);
  assert.equal(firstActorView.payload.data.reactions[0].viewerReaction, "down");

  const clearFirst = await requestJson("/api/v1/shop-talk/reactions", {
    method: "POST",
    cookie: actor.cookie,
    idempotencyKey: `shop-talk-clear-first-${smokeRun}`,
    expected: 200,
    body: { ...target, reaction: null },
  });
  assert.equal(clearFirst.payload.data.reaction.upvotes, 1);
  assert.equal(clearFirst.payload.data.reaction.downvotes, 0);
  assert.equal(clearFirst.payload.data.reaction.viewerReaction, null);
  assert.equal(clearFirst.payload.data.reputation.reactionsGiven, 0);

  const clearSecond = await requestJson("/api/v1/shop-talk/reactions", {
    method: "POST",
    cookie: secondActor.cookie,
    idempotencyKey: `shop-talk-clear-second-${smokeRun}`,
    expected: 200,
    body: { ...target, reaction: null },
  });
  assert.equal(clearSecond.payload.data.reaction.upvotes, 0);
  assert.equal(clearSecond.payload.data.reaction.downvotes, 0);

  const counts = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM shop_talk_reactions WHERE target_key = $1) AS active_reactions,
       (SELECT count(*)::int FROM shop_talk_reaction_events WHERE target_key = $1) AS reaction_events,
       (SELECT count(*)::int FROM audit_events WHERE subject_type = 'shop_talk_reaction' AND subject_id = $1) AS audit_events`,
    [target.targetKey],
  );
  assert.equal(counts.rows[0].active_reactions, 0);
  assert.equal(counts.rows[0].reaction_events, 4);
  assert.equal(counts.rows[0].audit_events, 4);

  console.log(JSON.stringify({
    ok: true,
    run: smokeRun,
    buildCommit: readiness.payload.build.commit,
    latestMigration: readiness.payload.migrationVersion,
    target,
    idempotencyReplayConfirmed: true,
    activeReactionsAfterClear: counts.rows[0].active_reactions,
    reactionEventsPersisted: counts.rows[0].reaction_events,
    auditEventsPersisted: counts.rows[0].audit_events,
    smokeAccountsClosed: accounts.length,
  }, null, 2));
} finally {
  await closeSmokeArtifacts(accounts, target.targetKey);
  await pool.end();
}
