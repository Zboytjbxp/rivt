import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const sourceCommit = process.env.SOURCE_COMMIT?.trim();
const smokeRun = `packet07-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

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
    body: { email, password, displayName: `${label} ${smokeRun}`, role, inviteCode: invite.code },
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
      bio: "Temporary Packet 07 production smoke account.",
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
    password,
    cookie,
    inviteId: invite.id,
    accountId: me.payload.data.id,
    organizationId: me.payload.data.organizations[0]?.id,
  };
}

async function createPublishedJob(contractor, title) {
  const created = await requestJson("/api/v1/jobs", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `${title}-create-${smokeRun}`,
    expected: 201,
    body: {
      organizationId: contractor.organizationId,
      title: `${title} ${smokeRun}`,
      tradeCode: "electrical",
      summary: "Temporary production smoke test job for Packet 07.",
      scopeDescription: "Verify reviews, safety reports, blocks, support, and restrictions.",
      difficulty: "advanced",
      workType: "side_work",
      budgetCents: 95000,
      budgetUnit: "fixed",
      durationHours: 8,
      insuranceRequired: true,
      tools: ["Multimeter", "Conduit bender"],
      deliverables: ["Closeout notes", "Safety record"],
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
      privateLocation: {
        addressLine1: "707 Packet Smoke Way",
        city: "Jacksonville",
        region: "FL",
        postalCode: "32202",
        countryCode: "US",
        accessNotes: "Meet at the side gate.",
      },
    },
  });
  const published = await requestJson(`/api/v1/jobs/${created.payload.data.job.id}/publish`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `${title}-publish-${smokeRun}`,
    expected: 200,
    body: {
      expectedVersion: created.payload.data.job.version,
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  return published.payload.data.job;
}

async function createActiveWork(contractor, tradesperson, job, label) {
  const submitted = await requestJson(`/api/v1/jobs/${job.id}/applications`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `${label}-apply-${smokeRun}`,
    expected: 201,
    body: {
      message: "I can handle this Packet 07 smoke scope.",
      proposedStartDate: "2026-07-01",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  const offer = await requestJson(`/api/v1/applications/${submitted.payload.data.application.id}/offer`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `${label}-offer-${smokeRun}`,
    expected: 201,
    body: {
      startDate: "2026-07-02",
      scopeSummary: "Packet 07 smoke scope accepted.",
      message: "Confirm and start the work record.",
    },
  });
  const accepted = await requestJson(`/api/v1/offers/${offer.payload.data.offer.id}/accept`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `${label}-accept-${smokeRun}`,
    expected: 200,
    body: { reason: "Confirmed.", consentAccepted: true, consentVersion: "2026-06-19" },
  });
  return accepted.payload.data.activeWork;
}

async function completeWork(contractor, tradesperson, activeWork, label) {
  const project = await requestJson(`/api/v1/active-work/${activeWork.id}/project`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `${label}-project-${smokeRun}`,
    expected: 200,
    body: {},
  });
  const completion = await requestJson(`/api/v1/projects/${project.payload.data.project.id}/completion`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `${label}-completion-${smokeRun}`,
    expected: 201,
    body: {
      note: `Scope complete ${smokeRun}`,
      checklist: { completedOnTime: true, clientApproved: true, photosProvided: false },
    },
  });
  await requestJson(`/api/v1/projects/${project.payload.data.project.id}/completion/${completion.payload.data.completion.id}/confirm`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `${label}-confirm-${smokeRun}`,
    expected: 200,
    body: { reason: "Smoke completion accepted." },
  });
}

async function closeSmokeArtifacts(accounts) {
  const accountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (accountIds.length > 0) {
    await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
    await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
    await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
  }
  await pool.query("UPDATE jobs SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE title LIKE $1", [`%${smokeRun}%`]);
}

const accounts = [];

try {
  const contractor = await signupAndOnboard("contractor", "Packet07 Owner");
  accounts.push(contractor);
  const tradesperson = await signupAndOnboard("tradesperson", "Packet07 Trade");
  accounts.push(tradesperson);
  const outsider = await signupAndOnboard("tradesperson", "Packet07 Outsider");
  accounts.push(outsider);
  const admin = await signupAndOnboard("contractor", "Packet07 Admin");
  accounts.push(admin);
  await pool.query(
    "INSERT INTO admin_role_grants (account_id, role, reason) VALUES ($1, 'owner', $2)",
    [admin.accountId, `Packet 07 smoke ${smokeRun}`],
  );

  const readiness = await requestJson("/api/readiness", { cookie: contractor.cookie, expected: 200 });
  assert.equal(readiness.payload.migrations.pending.length, 0);
  assert.ok(readiness.payload.migrations.applied.some((migration) => migration.version === 8));
  if (sourceCommit) assert.equal(readiness.payload.build.commit, sourceCommit);

  const job = await createPublishedJob(contractor, "Packet 07 completed review");
  const activeWork = await createActiveWork(contractor, tradesperson, job, "complete");
  await completeWork(contractor, tradesperson, activeWork, "complete");

  await requestJson("/api/v1/admin/overview", { cookie: contractor.cookie, expected: 403 });

  const review = await requestJson(`/api/v1/active-work/${activeWork.id}/reviews`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `review-${smokeRun}`,
    expected: 201,
    body: {
      revieweeAccountId: tradesperson.accountId,
      rating: 5,
      body: "Packet 07 smoke review: prepared, communicative, and safe.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  await requestJson(`/api/v1/active-work/${activeWork.id}/reviews`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `review-duplicate-${smokeRun}`,
    expected: 409,
    body: {
      revieweeAccountId: tradesperson.accountId,
      rating: 5,
      body: "Duplicate smoke review.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  await requestJson(`/api/v1/reviews/${review.payload.data.review.id}/dispute`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `review-dispute-${smokeRun}`,
    expected: 200,
    body: { reason: "Smoke dispute context." },
  });
  await requestJson(`/api/v1/admin/reviews/${review.payload.data.review.id}/resolve`, {
    method: "POST",
    cookie: admin.cookie,
    idempotencyKey: `admin-review-${smokeRun}`,
    expected: 200,
    body: { status: "resolved", reasonCode: "smoke_review", reason: "Resolved during Packet 07 smoke." },
  });

  const activeJob = await createPublishedJob(contractor, "Packet 07 unsafe smoke");
  const activeOnlyWork = await createActiveWork(contractor, tradesperson, activeJob, "unsafe");
  await requestJson(`/api/v1/active-work/${activeOnlyWork.id}/unsafe-reports`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `unsafe-${smokeRun}`,
    expected: 201,
    body: {
      conditionType: "stop_work",
      severity: "urgent",
      description: "Packet 07 smoke stop-work report.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  await requestJson("/api/v1/reports", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `report-${smokeRun}`,
    expected: 201,
    body: { subjectType: "active_work", subjectId: activeOnlyWork.id, reason: "safety", note: "Packet 07 smoke safety report." },
  });

  await requestJson(`/api/v1/accounts/${tradesperson.accountId}/block`, {
    method: "POST",
    cookie: contractor.cookie,
    expected: 200,
    body: { reason: "Packet 07 smoke block." },
  });
  const blockedJob = await createPublishedJob(contractor, "Packet 07 blocked smoke");
  await requestJson(`/api/v1/jobs/${blockedJob.id}`, { cookie: tradesperson.cookie, expected: 404 });

  const restriction = await requestJson(`/api/v1/admin/accounts/${outsider.accountId}/restrictions`, {
    method: "POST",
    cookie: admin.cookie,
    idempotencyKey: `restrict-${smokeRun}`,
    expected: 201,
    body: { restrictionType: "suspension", reasonCode: "smoke_safety", reason: "Packet 07 smoke restriction." },
  });
  await requestJson(`/api/v1/jobs/${blockedJob.id}/applications`, {
    method: "POST",
    cookie: outsider.cookie,
    idempotencyKey: `restricted-apply-${smokeRun}`,
    expected: 403,
    body: { message: "Blocked by restriction.", consentAccepted: true, consentVersion: "2026-06-19" },
  });
  const support = await requestJson("/api/v1/support/cases", {
    method: "POST",
    cookie: outsider.cookie,
    idempotencyKey: `support-${smokeRun}`,
    expected: 201,
    body: { category: "appeal", title: "Packet 07 smoke appeal", description: "Appeal remains open while restricted." },
  });
  await requestJson(`/api/v1/admin/support-cases/${support.payload.data.case.id}/events`, {
    method: "POST",
    cookie: admin.cookie,
    idempotencyKey: `support-admin-${smokeRun}`,
    expected: 201,
    body: {
      eventType: "status_changed",
      status: "reviewing",
      visibility: "user",
      note: "Packet 07 support response.",
      reasonCode: "smoke_support",
      reason: "Smoke support case handled.",
    },
  });
  await requestJson(`/api/v1/admin/restrictions/${restriction.payload.data.restriction.id}/lift`, {
    method: "POST",
    cookie: admin.cookie,
    idempotencyKey: `lift-${smokeRun}`,
    expected: 200,
    body: { reasonCode: "smoke_lift", reason: "Smoke restriction lifted." },
  });

  const persisted = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM work_reviews wr INNER JOIN jobs j ON j.id = wr.job_id WHERE j.title LIKE $1) AS reviews,
       (SELECT count(*)::int FROM unsafe_work_reports uwr INNER JOIN active_work aw ON aw.id = uwr.active_work_id INNER JOIN jobs j ON j.id = aw.job_id WHERE j.title LIKE $1) AS unsafe_reports,
       (SELECT count(*)::int FROM admin_action_events WHERE actor_account_id = $2) AS admin_actions`,
    [`%${smokeRun}%`, admin.accountId],
  );
  assert.equal(persisted.rows[0].reviews, 1);
  assert.equal(persisted.rows[0].unsafe_reports, 1);
  assert.ok(persisted.rows[0].admin_actions >= 4);

  console.log(JSON.stringify({
    ok: true,
    smokeRun,
    reviewId: review.payload.data.review.id,
    adminActions: persisted.rows[0].admin_actions,
  }, null, 2));
} finally {
  await closeSmokeArtifacts(accounts).catch((error) => {
    console.error("cleanup failed", error);
  });
  await pool.end();
}
