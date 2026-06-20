import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const sourceCommit = process.env.SOURCE_COMMIT?.trim();
const smokeRun = `packet04-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

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
      bio: "Temporary Packet 04 production smoke account.",
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

async function closeSmokeArtifacts(accounts) {
  const accountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (accountIds.length > 0) {
    await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
    await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
    await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
  }
  await pool.query(
    `UPDATE active_work
     SET status = 'cancelled', updated_at = now()
     WHERE id IN (
       SELECT aw.id
       FROM active_work aw
       INNER JOIN jobs j ON j.id = aw.job_id
       WHERE j.title LIKE $1
     )
     AND status <> 'cancelled'`,
    [`%${smokeRun}%`],
  );
  await pool.query(
    "UPDATE jobs SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE title LIKE $1 AND status <> 'closed'",
    [`%${smokeRun}%`],
  );
}

async function createPublishedJob(contractor) {
  const created = await requestJson("/api/v1/jobs", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `match-create-${smokeRun}`,
    expected: 201,
    body: {
      organizationId: contractor.organizationId,
      title: `Packet 04 match acceptance ${smokeRun}`,
      tradeCode: "electrical",
      summary: "Temporary production smoke test job for Packet 04.",
      scopeDescription: "Verify application, offer, mutual acceptance, address privacy, and active-work timeline.",
      difficulty: "advanced",
      workType: "side_work",
      budgetCents: 95000,
      budgetUnit: "fixed",
      durationHours: 8,
      insuranceRequired: true,
      tools: ["Multimeter", "Conduit bender"],
      deliverables: ["Accepted work record", "Closeout-ready timeline"],
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
      privateLocation: {
        addressLine1: "404 Acceptance Way",
        addressLine2: "Unit 5",
        city: "Jacksonville",
        region: "FL",
        postalCode: "32202",
        countryCode: "US",
        accessNotes: "Meet at the loading dock.",
      },
    },
  });
  const published = await requestJson(`/api/v1/jobs/${created.payload.data.job.id}/publish`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `match-publish-${smokeRun}`,
    expected: 200,
    body: {
      expectedVersion: created.payload.data.job.version,
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  return published.payload.data.job;
}

const accounts = [];

try {
  const contractor = await signupAndOnboard("contractor", "Packet04 Owner");
  accounts.push(contractor);
  const tradesperson = await signupAndOnboard("tradesperson", "Packet04 Trade");
  accounts.push(tradesperson);
  const otherTradesperson = await signupAndOnboard("tradesperson", "Packet04 Other");
  accounts.push(otherTradesperson);

  const readiness = await requestJson("/api/readiness", { cookie: contractor.cookie, expected: 200 });
  assert.equal(readiness.payload.migrations.pending.length, 0);
  assert.ok(readiness.payload.migrations.applied.some((migration) => migration.version === 5));
  if (sourceCommit) assert.equal(readiness.payload.build.commit, sourceCommit);

  const job = await createPublishedJob(contractor);
  const beforeAcceptance = await requestJson(`/api/v1/jobs/${job.id}`, { cookie: tradesperson.cookie, expected: 200 });
  assert.equal(Object.hasOwn(beforeAcceptance.payload.data.job, "privateLocation"), false);

  const submitted = await requestJson(`/api/v1/jobs/${job.id}/applications`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `match-apply-${smokeRun}`,
    expected: 201,
    body: {
      message: "I can handle this Packet 04 smoke scope.",
      proposedStartDate: "2026-07-01",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  const applicationId = submitted.payload.data.application.id;

  await requestJson(`/api/v1/jobs/${job.id}/applications`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `match-duplicate-apply-${smokeRun}`,
    expected: 409,
    body: {
      message: "Duplicate application should fail.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });

  await requestJson(`/api/v1/jobs/${job.id}/applications`, { cookie: tradesperson.cookie, expected: 403 });
  const applicants = await requestJson(`/api/v1/jobs/${job.id}/applications`, { cookie: contractor.cookie, expected: 200 });
  assert.equal(applicants.payload.data.applications.length, 1);
  assert.equal(applicants.payload.data.applications[0].applicant.accountId, tradesperson.accountId);

  const offer = await requestJson(`/api/v1/applications/${applicationId}/offer`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `match-offer-${smokeRun}`,
    expected: 201,
    body: {
      startDate: "2026-07-02",
      scopeSummary: "Panel scope accepted through Packet 04 smoke.",
      message: "Confirm and the address unlocks.",
    },
  });
  const offerId = offer.payload.data.offer.id;

  const wrongRecipient = await requestJson(`/api/v1/offers/${offerId}/accept`, {
    method: "POST",
    cookie: otherTradesperson.cookie,
    idempotencyKey: `match-wrong-recipient-${smokeRun}`,
    expected: 403,
    body: {
      reason: "Wrong account.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  assert.equal(wrongRecipient.payload.error.code, "OFFER_RECIPIENT_MISMATCH");

  const accepted = await requestJson(`/api/v1/offers/${offerId}/accept`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `match-accept-${smokeRun}`,
    expected: 200,
    body: {
      reason: "Confirmed.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  assert.equal(accepted.payload.data.offer.status, "accepted");
  assert.equal(accepted.payload.data.activeWork.status, "active");
  const activeWorkId = accepted.payload.data.activeWork.id;

  const acceptedAgain = await requestJson(`/api/v1/offers/${offerId}/accept`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `match-accept-again-${smokeRun}`,
    expected: 200,
    body: {
      reason: "Double tap.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  assert.equal(acceptedAgain.payload.data.activeWork.id, activeWorkId);

  const activeWorkCount = await pool.query("SELECT count(*)::int AS count FROM active_work WHERE job_id = $1", [job.id]);
  assert.equal(activeWorkCount.rows[0].count, 1);
  const participantCount = await pool.query("SELECT count(*)::int AS count FROM work_participants WHERE active_work_id = $1", [activeWorkId]);
  assert.equal(participantCount.rows[0].count, 2);

  const afterAcceptance = await requestJson(`/api/v1/jobs/${job.id}`, { cookie: tradesperson.cookie, expected: 200 });
  assert.equal(afterAcceptance.payload.data.job.privateLocation.addressLine1, "404 Acceptance Way");
  await requestJson(`/api/v1/jobs/${job.id}`, { cookie: otherTradesperson.cookie, expected: 404 });

  const contractorWork = await requestJson("/api/v1/active-work", { cookie: contractor.cookie, expected: 200 });
  assert.ok(contractorWork.payload.data.activeWork.some((record) => record.id === activeWorkId));
  const tradespersonWork = await requestJson("/api/v1/active-work", { cookie: tradesperson.cookie, expected: 200 });
  assert.ok(tradespersonWork.payload.data.activeWork.some((record) => record.id === activeWorkId));

  const rescheduled = await requestJson(`/api/v1/active-work/${activeWorkId}/reschedule`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `match-reschedule-${smokeRun}`,
    expected: 200,
    body: { reason: "Move start to afternoon." },
  });
  assert.ok(rescheduled.payload.data.activeWork.events.some((event) => event.type === "reschedule_requested" && event.reason));

  const cancelled = await requestJson(`/api/v1/active-work/${activeWorkId}/cancel`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `match-cancel-${smokeRun}`,
    expected: 200,
    body: { reason: "Mutual schedule conflict." },
  });
  assert.equal(cancelled.payload.data.activeWork.status, "cancelled");

  const eventCounts = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM job_application_events WHERE application_id = $1) AS application_events,
       (SELECT count(*)::int FROM job_offer_events WHERE offer_id = $2) AS offer_events,
       (SELECT count(*)::int FROM work_status_events WHERE active_work_id = $3) AS work_events`,
    [applicationId, offerId, activeWorkId],
  );
  assert.ok(eventCounts.rows[0].application_events >= 2);
  assert.ok(eventCounts.rows[0].offer_events >= 2);
  assert.ok(eventCounts.rows[0].work_events >= 3);

  console.log(JSON.stringify({
    ok: true,
    run: smokeRun,
    buildCommit: readiness.payload.build.commit,
    latestMigration: readiness.payload.migrationVersion,
    jobId: job.id,
    applicationId,
    offerId,
    activeWorkId,
    singleActiveWork: true,
    participantCount: participantCount.rows[0].count,
    privateAddressHiddenBeforeAcceptance: true,
    privateAddressRevealedAfterAcceptance: true,
    wrongRecipientRejected: true,
    activeWorkCancelled: cancelled.payload.data.activeWork.status === "cancelled",
    smokeAccountsClosed: accounts.length,
  }, null, 2));
} finally {
  await closeSmokeArtifacts(accounts);
  await pool.end();
}
