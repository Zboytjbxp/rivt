import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const baseUrl = (process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro").replace(/\/+$/, "");
const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedCommit = process.env.EXPECTED_SOURCE_COMMIT?.trim() || process.env.SOURCE_COMMIT?.trim();
const smokeRun = `public-discovery-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
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

async function request(pathname, {
  body,
  cookie,
  expected,
  idempotencyKey,
  method = "GET",
} = {}) {
  const headers = { Accept: "application/json", Origin: baseUrl };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${pathname} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return { response, text };
}

async function requestJson(pathname, options) {
  const result = await request(pathname, options);
  return {
    ...result,
    payload: result.text ? JSON.parse(result.text) : null,
  };
}

async function createInvite(email) {
  const code = `rivt_${randomBytes(24).toString("base64url")}`;
  const result = await pool.query(
    `INSERT INTO signup_invites (code_hash, email_hash, allowed_role, max_uses, expires_at)
     VALUES ($1, $2, 'contractor', 1, now() + interval '1 day')
     RETURNING id`,
    [sha256(code), sha256(normalizeEmail(email))],
  );
  return { code, id: result.rows[0].id };
}

async function verifyEmailDirectly(email) {
  await pool.query(
    `UPDATE auth_users
     SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
     WHERE email_hash = $1`,
    [sha256(normalizeEmail(email))],
  );
}

async function closeArtifacts({ accountId, inviteId, jobId, postId }) {
  if (jobId) {
    await pool.query(
      `UPDATE jobs
       SET status = 'closed', public_web_visibility = 'members',
           closed_at = COALESCE(closed_at, now()), updated_at = now()
       WHERE id = $1`,
      [jobId],
    );
  }
  if (postId) {
    await pool.query(
      `UPDATE shop_talk_posts
       SET public_web_visibility = 'members', moderation_status = 'hidden', updated_at = now()
       WHERE id = $1`,
      [postId],
    );
  }
  if (accountId) {
    await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = $1", [accountId]);
    await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [accountId]);
    await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = $1", [accountId]);
    await pool.query(
      `UPDATE organizations
       SET status = 'closed', updated_at = now()
       WHERE created_by_account_id = $1 AND status <> 'closed'`,
      [accountId],
    );
  }
  if (inviteId) await pool.query("DELETE FROM signup_invites WHERE id = $1", [inviteId]);
}

const artifacts = {
  accountId: null,
  inviteId: null,
  jobId: null,
  postId: null,
};

try {
  const email = `${smokeRun}@example.test`;
  const password = `Public!${randomBytes(10).toString("base64url")}1a`;
  const invite = await createInvite(email);
  artifacts.inviteId = invite.id;

  const signup = await requestJson("/api/v1/auth/signup", {
    method: "POST",
    expected: 201,
    body: {
      email,
      password,
      displayName: `RIVT Release QA ${smokeRun}`,
      role: "contractor",
      inviteCode: invite.code,
    },
  });
  const cookie = sessionCookie(signup.response);
  assert.ok(cookie, "Signup must establish a session.");
  await verifyEmailDirectly(email);

  await requestJson("/api/v1/onboarding/complete", {
    method: "POST",
    cookie,
    expected: 200,
    body: {
      role: "contractor",
      displayName: `RIVT Release QA ${smokeRun}`,
      headline: "Temporary RIVT release verification",
      bio: "Temporary account used for automated release verification.",
      serviceAreaCity: "Release QA",
      serviceAreaRegion: "FL",
      serviceRadiusMiles: 5,
      availabilityStatus: "unavailable",
      contactEmailVisibility: "private",
      phoneE164: null,
      phoneVisibility: "private",
      tradeCodes: ["electrical"],
      organizationName: `RIVT Release QA ${smokeRun}`,
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });

  const me = await requestJson("/api/v1/me", { cookie, expected: 200 });
  artifacts.accountId = me.payload.data.id;
  const organizationId = me.payload.data.organizations[0]?.id;
  assert.ok(organizationId, "Temporary contractor must own an organization.");

  const readiness = await requestJson("/api/readiness", { cookie, expected: 200 });
  assert.equal(readiness.payload.migrations.pending.length, 0);
  assert.equal(readiness.payload.migrationVersion, "0035_job_budget_floor");
  if (expectedCommit) assert.equal(readiness.payload.build.commit, expectedCommit);

  const createdJob = await requestJson("/api/v1/jobs", {
    method: "POST",
    cookie,
    expected: 201,
    idempotencyKey: randomUUID(),
    body: {
      organizationId,
      title: `Temporary public job verification ${smokeRun}`,
      tradeCode: "electrical",
      summary: "Temporary release verification record. It will be removed immediately.",
      scopeDescription: "Verify the public job projection, metadata, privacy boundary, and removal path.",
      difficulty: "moderate",
      workType: "side_work",
      budgetCents: 1600,
      budgetUnit: "fixed",
      compensationType: "fixed",
      durationHours: 1,
      insuranceRequired: false,
      tools: ["Release checklist"],
      materials: ["No materials"],
      deliverables: ["Public boundary verified"],
      certificationCodes: [],
      publicLocation: { city: "Release QA", region: "FL", countryCode: "US" },
      privateLocation: {
        addressLine1: "9417 Verification Lane",
        addressLine2: "",
        city: "Jacksonville",
        region: "FL",
        postalCode: "32202",
        countryCode: "US",
        accessNotes: "Private smoke detail must never appear publicly.",
      },
      publicWebVisibility: "members",
    },
  });
  artifacts.jobId = createdJob.payload.data.job.id;

  const openedJob = await requestJson(`/api/v1/jobs/${artifacts.jobId}/publish`, {
    method: "POST",
    cookie,
    expected: 200,
    idempotencyKey: randomUUID(),
    body: {
      expectedVersion: createdJob.payload.data.job.version,
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  await requestJson(`/api/public/jobs/${artifacts.jobId}`, { expected: 404 });

  const publicJobUpdate = await requestJson(`/api/v1/jobs/${artifacts.jobId}`, {
    method: "PATCH",
    cookie,
    expected: 200,
    idempotencyKey: randomUUID(),
    body: {
      expectedVersion: openedJob.payload.data.job.version,
      publicWebVisibility: "public",
    },
  });
  const publicJob = await requestJson(`/api/public/jobs/${artifacts.jobId}`, { expected: 200 });
  assert.equal(publicJob.payload.data.job.location.city, "Release QA");
  assert.doesNotMatch(publicJob.text, /9417 Verification|32202|Private smoke detail/);
  const publicJobHtml = await request(`/jobs/${artifacts.jobId}`, { expected: 200 });
  assert.match(publicJobHtml.text, /application\/ld\+json/);
  assert.doesNotMatch(publicJobHtml.text, /9417 Verification|32202|Private smoke detail/);

  const privateJobUpdate = await requestJson(`/api/v1/jobs/${artifacts.jobId}`, {
    method: "PATCH",
    cookie,
    expected: 200,
    idempotencyKey: randomUUID(),
    body: {
      expectedVersion: publicJobUpdate.payload.data.job.version,
      publicWebVisibility: "members",
    },
  });
  await requestJson(`/api/public/jobs/${artifacts.jobId}`, { expected: 404 });
  await requestJson(`/api/v1/jobs/${artifacts.jobId}/close`, {
    method: "POST",
    cookie,
    expected: 200,
    idempotencyKey: randomUUID(),
    body: {
      expectedVersion: privateJobUpdate.payload.data.job.version,
      reason: "Temporary release verification complete",
    },
  });

  const createdPost = await requestJson("/api/v1/shop-talk/posts", {
    method: "POST",
    cookie,
    expected: 201,
    idempotencyKey: randomUUID(),
    body: {
      title: `Temporary public Shop Talk verification ${smokeRun}`,
      body: "Temporary release verification post. It will be removed immediately.",
      trade: "Electrical",
      flair: "Discussion",
      postType: "general",
      communitySlug: "electrical-talk",
      webVisibility: "public",
    },
  });
  artifacts.postId = createdPost.payload.data.post.id;

  const publicPost = await requestJson(`/api/public/shop-talk/${artifacts.postId}`, { expected: 200 });
  assert.equal(publicPost.payload.data.post.title, `Temporary public Shop Talk verification ${smokeRun}`);
  const publicPostHtml = await request(`/shop-talk/${artifacts.postId}`, { expected: 200 });
  assert.match(publicPostHtml.text, /DiscussionForumPosting/);

  await requestJson(`/api/v1/shop-talk/posts/${artifacts.postId}/visibility`, {
    method: "PATCH",
    cookie,
    expected: 200,
    idempotencyKey: randomUUID(),
    body: { webVisibility: "members" },
  });
  await requestJson(`/api/public/shop-talk/${artifacts.postId}`, { expected: 404 });
  await requestJson(`/api/v1/shop-talk/posts/${artifacts.postId}`, {
    method: "DELETE",
    cookie,
    expected: 200,
    idempotencyKey: randomUUID(),
  });

  console.log(JSON.stringify({
    ok: true,
    run: smokeRun,
    buildCommit: readiness.payload.build.commit,
    migration: readiness.payload.migrationVersion,
    publicJobProjectionProtectedPrivateLocation: true,
    publicJobRemovedAfterUnpublish: true,
    publicShopTalkRendered: true,
    publicShopTalkRemovedAfterUnpublish: true,
  }, null, 2));
} finally {
  await closeArtifacts(artifacts).catch((error) => {
    console.error("cleanup failed", error);
  });
  await pool.end();
}
