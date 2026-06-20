import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const sourceCommit = process.env.SOURCE_COMMIT?.trim();
const smokeRun = `packet03-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
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
  const password = `Smoke!${randomBytes(10).toString("base64url")}1a`;
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
      headline: role === "contractor" ? "RIVT smoke contractor" : "RIVT smoke electrician",
      bio: "Temporary Packet 03 production smoke account.",
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
    email,
    cookie,
    inviteId: invite.id,
    accountId: me.payload.data.id,
    organizationId: me.payload.data.organizations[0]?.id,
  };
}

async function closeSmokeAccounts(accounts) {
  const accountIds = accounts.map((account) => account.accountId);
  await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
  await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
  await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
}

try {
  const contractor = await signupAndOnboard("contractor", "Packet03 Owner");
  const otherContractor = await signupAndOnboard("contractor", "Packet03 Other");
  const tradesperson = await signupAndOnboard("tradesperson", "Packet03 Trade");
  const accounts = [contractor, otherContractor, tradesperson];

  const readiness = await requestJson("/api/readiness", { cookie: contractor.cookie, expected: 200 });
  assert.equal(readiness.payload.migrations.pending.length, 0);
  assert.ok(readiness.payload.migrations.applied.some((migration) => migration.version === 4));
  if (sourceCommit) assert.equal(readiness.payload.build.commit, sourceCommit);

  const title = `Packet 03 smoke electrical rough-in ${smokeRun}`;
  const created = await requestJson("/api/v1/jobs", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `smoke-create-${smokeRun}`,
    expected: 201,
    body: {
      organizationId: contractor.organizationId,
      title,
      tradeCode: "electrical",
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
    },
  });
  const jobId = created.payload.data.job.id;

  await requestJson(`/api/v1/jobs/${jobId}/publish`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `smoke-publish-incomplete-${smokeRun}`,
    expected: 422,
    body: { expectedVersion: 1, consentAccepted: true, consentVersion: "2026-06-19" },
  });

  const updated = await requestJson(`/api/v1/jobs/${jobId}`, {
    method: "PATCH",
    cookie: contractor.cookie,
    idempotencyKey: `smoke-update-${smokeRun}`,
    expected: 200,
    body: {
      expectedVersion: 1,
      summary: "Temporary production smoke test job for Packet 03.",
      scopeDescription: "Exercise job draft, publish, discovery, pause, resume, close, and private-address boundaries.",
      difficulty: "advanced",
      workType: "side_work",
      budgetCents: 125000,
      budgetUnit: "fixed",
      durationHours: 8,
      insuranceRequired: true,
      tools: ["Multimeter", "Conduit bender"],
      materials: ["Provided by contractor"],
      deliverables: ["Smoke result verified"],
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
      privateLocation: {
        addressLine1: "100 Private Smoke Street",
        addressLine2: "Suite 200",
        city: "Jacksonville",
        region: "FL",
        postalCode: "32202",
        countryCode: "US",
        accessNotes: "Smoke test private address.",
      },
    },
  });
  assert.equal(updated.payload.data.job.version, 2);

  await requestJson(`/api/v1/jobs/${jobId}`, {
    method: "PATCH",
    cookie: otherContractor.cookie,
    idempotencyKey: `smoke-foreign-${smokeRun}`,
    expected: 403,
    body: { expectedVersion: 2, title: "Unauthorized smoke mutation" },
  });

  const published = await requestJson(`/api/v1/jobs/${jobId}/publish`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `smoke-publish-${smokeRun}`,
    expected: 200,
    body: { expectedVersion: 2, consentAccepted: true, consentVersion: "2026-06-19" },
  });
  assert.equal(published.payload.data.job.status, "open");
  const publishedVersion = published.payload.data.job.version;

  const duplicatePublish = await requestJson(`/api/v1/jobs/${jobId}/publish`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `smoke-publish-${smokeRun}`,
    expected: 200,
    body: { expectedVersion: 2, consentAccepted: true, consentVersion: "2026-06-19" },
  });
  assert.equal(duplicatePublish.response.headers.get("idempotent-replayed"), "true");

  const discovery = await requestJson("/api/v1/jobs?trade=electrical&region=FL", {
    cookie: tradesperson.cookie,
    expected: 200,
  });
  const discovered = discovery.payload.data.jobs.find((job) => job.id === jobId);
  assert.ok(discovered, "Tradesperson discovery did not return the smoke job.");
  assert.equal(Object.hasOwn(discovered, "privateLocation"), false);
  assert.equal(JSON.stringify(discovered).includes("Private Smoke Street"), false);

  const tradespersonDetail = await requestJson(`/api/v1/jobs/${jobId}`, {
    cookie: tradesperson.cookie,
    expected: 200,
  });
  assert.equal(Object.hasOwn(tradespersonDetail.payload.data.job, "privateLocation"), false);

  const ownerDetail = await requestJson(`/api/v1/jobs/${jobId}`, {
    cookie: contractor.cookie,
    expected: 200,
  });
  assert.equal(ownerDetail.payload.data.job.privateLocation.addressLine1, "100 Private Smoke Street");

  const paused = await requestJson(`/api/v1/jobs/${jobId}/pause`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `smoke-pause-${smokeRun}`,
    expected: 200,
    body: { expectedVersion: publishedVersion, reason: "Smoke pause" },
  });
  assert.equal(paused.payload.data.job.status, "paused");

  await requestJson(`/api/v1/jobs/${jobId}`, {
    cookie: tradesperson.cookie,
    expected: 404,
  });

  const resumed = await requestJson(`/api/v1/jobs/${jobId}/resume`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `smoke-resume-${smokeRun}`,
    expected: 200,
    body: { expectedVersion: paused.payload.data.job.version, reason: "Smoke resume" },
  });
  assert.equal(resumed.payload.data.job.status, "open");

  const closed = await requestJson(`/api/v1/jobs/${jobId}/close`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `smoke-close-${smokeRun}`,
    expected: 200,
    body: { expectedVersion: resumed.payload.data.job.version, reason: "Smoke complete" },
  });
  assert.equal(closed.payload.data.job.status, "closed");

  await requestJson(`/api/v1/jobs/${jobId}`, {
    cookie: tradesperson.cookie,
    expected: 404,
  });

  await closeSmokeAccounts(accounts);

  console.log(JSON.stringify({
    ok: true,
    run: smokeRun,
    buildCommit: readiness.payload.build.commit,
    latestMigration: readiness.payload.migrationVersion,
    deployment: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
    jobId,
    closedStatus: closed.payload.data.job.status,
    privateAddressHiddenFromTradesperson: true,
    smokeAccountsClosed: accounts.length,
  }, null, 2));
} finally {
  await pool.end();
}
