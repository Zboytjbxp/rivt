import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedCommit = process.env.EXPECTED_SOURCE_COMMIT?.trim() || process.env.SOURCE_COMMIT?.trim();
const smokeRun = `packet83-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(value) {
  return String(value).trim().toLowerCase();
}

function sessionCookie(response) {
  return String(response.headers.get("set-cookie") ?? "").split(";", 1)[0];
}

async function requestJson(path, { body, cookie, idempotencyKey, method = "GET", expected } = {}) {
  const headers = { Origin: baseUrl };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${path} returned ${response.status}: ${text}`);
  }
  return { response, payload };
}

async function createInvite(email, role) {
  const code = `rivt_${randomBytes(24).toString("base64url")}`;
  const result = await pool.query(
    `INSERT INTO signup_invites (code_hash, email_hash, allowed_role, max_uses, expires_at)
     VALUES ($1, $2, $3, 1, now() + interval '1 day')
     RETURNING id`,
    [sha256(code), sha256(normalizeEmail(email)), role],
  );
  return { code, id: result.rows[0].id };
}

async function signupAndOnboard(role, label) {
  const email = `${smokeRun}-${role}-${randomBytes(2).toString("hex")}@example.test`;
  const password = `Continuity!${randomBytes(10).toString("base64url")}1a`;
  const invite = await createInvite(email, role);
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
  await pool.query(
    "UPDATE auth_users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE email_hash = $1",
    [sha256(normalizeEmail(email))],
  );
  await requestJson("/api/v1/onboarding/complete", {
    method: "POST",
    cookie,
    expected: 200,
    body: {
      role,
      displayName: `${label} ${smokeRun}`,
      headline: "Temporary RIVT continuity verification account",
      bio: "Temporary Packet 83 production verification account.",
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
    accountId: me.payload.data.id,
    cookie,
    email,
    inviteId: invite.id,
    password,
    role,
  };
}

async function closeSmokeArtifacts(accounts) {
  const accountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (!accountIds.length) return;
  await pool.query("DELETE FROM trade_news_saved_articles WHERE account_id = ANY($1::uuid[])", [accountIds]);
  await pool.query("DELETE FROM trade_news_preferences WHERE account_id = ANY($1::uuid[])", [accountIds]);
  await pool.query("DELETE FROM shop_talk_posts WHERE author_account_id = ANY($1::uuid[])", [accountIds]);
  await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
  await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
  await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
  await pool.query(
    "UPDATE organizations SET status = 'closed', updated_at = now() WHERE created_by_account_id = ANY($1::uuid[]) AND status <> 'closed'",
    [accountIds],
  );
}

const accounts = [];
let postId = null;

try {
  const author = await signupAndOnboard("tradesperson", "Continuity Author");
  accounts.push(author);
  const peer = await signupAndOnboard("contractor", "Continuity Peer");
  accounts.push(peer);

  const readiness = await requestJson("/api/readiness", { cookie: author.cookie, expected: 200 });
  assert.equal(readiness.payload.migrations.pending.length, 0);
  assert.ok(readiness.payload.migrations.applied.some((migration) => migration.version === 41));
  if (expectedCommit) assert.equal(readiness.payload.build.commit, expectedCommit);

  const anonymous = await requestJson("/api/v1/trade-news/preferences");
  assert.equal(anonymous.response.status, 401);

  const initial = await requestJson("/api/v1/trade-news/preferences", { cookie: author.cookie, expected: 200 });
  assert.equal(initial.payload.data.preference, null);
  assert.deepEqual(initial.payload.data.savedArticles, []);

  const preference = await requestJson("/api/v1/trade-news/preferences", {
    method: "PUT",
    cookie: author.cookie,
    expected: 200,
    body: {
      scope: "local",
      location: "Jacksonville, FL",
      category: "Safety",
      trade: "Electrical",
      followedTrades: ["Electrical"],
      followedTopics: ["Jobsite safety"],
      expectedVersion: 0,
    },
  });
  assert.equal(preference.payload.data.preference.version, 1);

  const articlePath = `packet83/${smokeRun}`;
  const canonicalUrl = `https://example.com/${articlePath}`;
  const saved = await requestJson("/api/v1/trade-news/saved-articles", {
    method: "PUT",
    cookie: author.cookie,
    expected: 200,
    body: {
      url: `https://www.example.com/${articlePath}/?utm_source=rivt#details`,
      headline: "Temporary Jacksonville electrical safety verification",
      source: "RIVT production verification",
      publishedAt: new Date().toISOString(),
      category: "Safety",
      trades: ["Electrical"],
      topics: ["Jobsite safety"],
      thumbnailUrl: null,
    },
  });
  assert.equal(saved.payload.data.savedArticle.canonicalUrl, canonicalUrl);

  const ownerView = await requestJson("/api/v1/trade-news/preferences", { cookie: author.cookie, expected: 200 });
  assert.equal(ownerView.payload.data.preference.location, "Jacksonville, FL");
  assert.equal(ownerView.payload.data.savedArticles.length, 1);
  const isolatedView = await requestJson("/api/v1/trade-news/preferences", { cookie: peer.cookie, expected: 200 });
  assert.equal(isolatedView.payload.data.preference, null);
  assert.deepEqual(isolatedView.payload.data.savedArticles, []);

  const created = await requestJson("/api/v1/shop-talk/posts", {
    method: "POST",
    cookie: author.cookie,
    idempotencyKey: randomUUID(),
    expected: 201,
    body: {
      title: "Temporary Packet 83 article discussion",
      body: "Confirm the enforcement date before planning the work.",
      trade: "Electrical",
      flair: "Discussion",
      postType: "general",
      communitySlug: "electrical-talk",
      article: {
        url: `${canonicalUrl}?utm_campaign=discussion`,
        source: "RIVT production verification",
        publishedAt: new Date().toISOString(),
      },
    },
  });
  postId = created.payload.data.post.id;
  assert.equal(created.payload.data.post.body.includes("https://"), false);
  assert.equal(created.payload.data.post.articleCanonicalUrl, canonicalUrl);

  const lookup = await requestJson("/api/v1/shop-talk/article-discussions/lookup", {
    method: "POST",
    cookie: peer.cookie,
    expected: 200,
    body: { urls: [`${canonicalUrl}?fbclid=peer`] },
  });
  assert.equal(lookup.payload.data.discussions.length, 1);
  assert.equal(lookup.payload.data.discussions[0].post.id, postId);

  const duplicate = await requestJson("/api/v1/shop-talk/posts", {
    method: "POST",
    cookie: peer.cookie,
    idempotencyKey: randomUUID(),
    body: {
      title: "Temporary duplicate Packet 83 discussion",
      body: "This must resolve to the existing conversation.",
      trade: "Electrical",
      flair: "Discussion",
      postType: "general",
      communitySlug: "electrical-talk",
      article: { url: `${canonicalUrl}/?gclid=duplicate`, source: "Another label" },
    },
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.payload.error.code, "SHOP_TALK_ARTICLE_DISCUSSION_EXISTS");
  assert.equal(duplicate.payload.error.details.postId, postId);

  const answer = await requestJson(`/api/v1/shop-talk/posts/${postId}/answers`, {
    method: "POST",
    cookie: peer.cookie,
    idempotencyKey: randomUUID(),
    expected: 201,
    body: { body: "Temporary cross-role answer proving the shared discussion remains reachable." },
  });
  const answerId = answer.payload.data.answer.id;
  const answers = await requestJson(`/api/v1/shop-talk/posts/${postId}/answers`, {
    cookie: author.cookie,
    expected: 200,
  });
  assert.ok(answers.payload.data.answers.some((entry) => entry.id === answerId));

  const removedSaved = await requestJson(`/api/v1/trade-news/saved-articles?url=${encodeURIComponent(canonicalUrl)}`, {
    method: "DELETE",
    cookie: author.cookie,
    expected: 200,
  });
  assert.equal(removedSaved.payload.data.removed, true);

  const deletedPost = await requestJson(`/api/v1/shop-talk/posts/${postId}`, {
    method: "DELETE",
    cookie: author.cookie,
    idempotencyKey: randomUUID(),
    expected: 200,
  });
  assert.equal(deletedPost.payload.data.deleted, true);
  postId = null;

  console.log(JSON.stringify({
    ok: true,
    run: smokeRun,
    buildCommit: readiness.payload.build.commit,
    latestMigration: readiness.payload.migrationVersion,
    ownerContinuity: true,
    ownerIsolation: true,
    structuredCleanBody: true,
    indexedCrossRoleLookup: true,
    duplicatePostIdReturned: true,
    answerVisibleCrossRole: true,
    temporaryPostDeleted: true,
    smokeAccountsClosed: accounts.length,
  }, null, 2));
} finally {
  await closeSmokeArtifacts(accounts);
  await pool.end();
}
