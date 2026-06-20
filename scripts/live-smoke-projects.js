import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const sourceCommit = process.env.SOURCE_COMMIT?.trim();
const smokeRun = `packet06-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

const s3Client = process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
  ? new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    })
  : null;

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

async function requestForm(path, { form, cookie, idempotencyKey, expected } = {}) {
  const headers = { Origin: baseUrl };
  if (cookie) headers.Cookie = cookie;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body: form });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (expected !== undefined) {
    assert.equal(response.status, expected, `POST ${path} returned ${response.status}: ${text}`);
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
      bio: "Temporary Packet 06 production smoke account.",
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

async function login(account) {
  const response = await requestJson("/api/v1/auth/login", {
    method: "POST",
    expected: 200,
    body: { email: account.email, password: account.password },
  });
  return sessionCookie(response.response);
}

async function createPublishedJob(contractor, label) {
  const created = await requestJson("/api/v1/jobs", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `${label}-create-${smokeRun}`,
    expected: 201,
    body: {
      organizationId: contractor.organizationId,
      title: `${label} ${smokeRun}`,
      tradeCode: "electrical",
      summary: "Temporary production smoke test job for Packet 06.",
      scopeDescription: "Verify project records, closeout evidence, completion, dispute, and private file authorization.",
      difficulty: "advanced",
      workType: "side_work",
      budgetCents: 95000,
      budgetUnit: "fixed",
      durationHours: 8,
      insuranceRequired: true,
      tools: ["Multimeter", "Conduit bender"],
      deliverables: ["Closeout evidence", "Completion report"],
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
      privateLocation: {
        addressLine1: "404 Project Smoke Way",
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
    idempotencyKey: `${label}-publish-${smokeRun}`,
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
      message: "I can handle this Packet 06 smoke scope.",
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
      scopeSummary: "Panel scope accepted through Packet 06 smoke.",
      message: "Confirm and start the closeout record.",
    },
  });
  const accepted = await requestJson(`/api/v1/offers/${offer.payload.data.offer.id}/accept`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `${label}-accept-${smokeRun}`,
    expected: 200,
    body: {
      reason: "Confirmed.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  return accepted.payload.data.activeWork;
}

function evidenceForm(contents, filename, type) {
  const form = new FormData();
  form.append("name", filename);
  form.append("notes", `Smoke evidence ${smokeRun}`);
  form.append("file", new Blob([contents], { type }), filename);
  return form;
}

async function closeSmokeArtifacts(accounts) {
  const accountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (accountIds.length > 0) {
    await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
    await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
    await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
  }
  await pool.query("UPDATE jobs SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE title LIKE $1", [`%${smokeRun}%`]);

  if (s3Client && process.env.S3_BUCKET) {
    const objects = await pool.query(
      "SELECT object_key FROM uploads WHERE original_name LIKE $1 AND object_key IS NOT NULL",
      [`%${smokeRun}%`],
    );
    await Promise.all(objects.rows.map((row) => s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: row.object_key,
    })).catch(() => undefined)));
  }
}

const accounts = [];

try {
  const contractor = await signupAndOnboard("contractor", "Packet06 Owner");
  accounts.push(contractor);
  const tradesperson = await signupAndOnboard("tradesperson", "Packet06 Trade");
  accounts.push(tradesperson);
  const outsider = await signupAndOnboard("tradesperson", "Packet06 Outsider");
  accounts.push(outsider);

  const readiness = await requestJson("/api/readiness", { cookie: contractor.cookie, expected: 200 });
  assert.equal(readiness.payload.migrations.pending.length, 0);
  assert.ok(readiness.payload.migrations.applied.some((migration) => migration.version === 7));
  if (sourceCommit) assert.equal(readiness.payload.build.commit, sourceCommit);

  const job = await createPublishedJob(contractor, "Packet 06 project closeout");
  const activeWork = await createActiveWork(contractor, tradesperson, job, "primary");
  const opened = await requestJson(`/api/v1/active-work/${activeWork.id}/project`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `project-open-${smokeRun}`,
    expected: 200,
    body: {},
  });
  const projectId = opened.payload.data.project.id;

  await requestJson(`/api/v1/projects/${projectId}`, { cookie: outsider.cookie, expected: 404 });

  const noteKey = `project-note-${smokeRun}`;
  const note = await requestJson(`/api/v1/projects/${projectId}/entries`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: noteKey,
    expected: 201,
    body: { body: `Smoke note ${smokeRun}` },
  });
  const noteReplay = await requestJson(`/api/v1/projects/${projectId}/entries`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: noteKey,
    expected: 201,
    body: { body: `Smoke note ${smokeRun}` },
  });
  assert.equal(noteReplay.response.headers.get("idempotent-replayed"), "true");
  assert.equal(noteReplay.payload.data.entry.id, note.payload.data.entry.id);

  const badUploadKey = `bad-media-${smokeRun}`;
  const rejected = await requestForm(`/api/v1/projects/${projectId}/media`, {
    cookie: tradesperson.cookie,
    idempotencyKey: badUploadKey,
    expected: 422,
    form: evidenceForm("not a real png", `${smokeRun}-fake.png`, "image/png"),
  });
  assert.equal(rejected.payload.data.media.status, "rejected");
  const rejectedReplay = await requestForm(`/api/v1/projects/${projectId}/media`, {
    cookie: tradesperson.cookie,
    idempotencyKey: badUploadKey,
    expected: 422,
    form: evidenceForm("not a real png", `${smokeRun}-fake.png`, "image/png"),
  });
  assert.equal(rejectedReplay.response.headers.get("idempotent-replayed"), "true");
  assert.equal(rejectedReplay.payload.data.media.id, rejected.payload.data.media.id);

  const stored = await requestForm(`/api/v1/projects/${projectId}/media`, {
    cookie: tradesperson.cookie,
    idempotencyKey: `stored-media-${smokeRun}`,
    expected: 201,
    form: evidenceForm(`panel labelled ${smokeRun}`, `${smokeRun}-evidence.txt`, "text/plain"),
  });
  const mediaId = stored.payload.data.media.id;
  const mediaUrl = await requestJson(`/api/v1/projects/${projectId}/media/${mediaId}/url`, { cookie: contractor.cookie, expected: 200 });
  assert.ok("signedUrl" in mediaUrl.payload.data);
  await requestJson(`/api/v1/projects/${projectId}/media/${mediaId}/url`, { cookie: outsider.cookie, expected: 404 });

  const completion = await requestJson(`/api/v1/projects/${projectId}/completion`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `completion-${smokeRun}`,
    expected: 201,
    body: {
      note: `Scope complete ${smokeRun}`,
      checklist: { completedOnTime: true, clientApproved: true, photosProvided: true },
      evidenceMediaIds: [mediaId],
    },
  });
  const confirmed = await requestJson(`/api/v1/projects/${projectId}/completion/${completion.payload.data.completion.id}/confirm`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `confirm-${smokeRun}`,
    expected: 200,
    body: { reason: "Smoke completion accepted." },
  });
  assert.equal(confirmed.payload.data.completion.status, "confirmed");

  const report = await requestJson(`/api/v1/projects/${projectId}/report`, { cookie: contractor.cookie, expected: 200 });
  const reloginCookie = await login(contractor);
  const reportAgain = await requestJson(`/api/v1/projects/${projectId}/report`, { cookie: reloginCookie, expected: 200 });
  assert.deepEqual(reportAgain.payload.data.report, report.payload.data.report);
  assert.equal(JSON.stringify(report.payload.data.report).includes("404 Project Smoke Way"), false);

  const disputedJob = await createPublishedJob(contractor, "Packet 06 disputed closeout");
  const disputedWork = await createActiveWork(contractor, tradesperson, disputedJob, "dispute");
  const disputedProject = await requestJson(`/api/v1/active-work/${disputedWork.id}/project`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `disputed-project-${smokeRun}`,
    expected: 200,
    body: {},
  });
  const disputedProjectId = disputedProject.payload.data.project.id;
  const disputedCompletion = await requestJson(`/api/v1/projects/${disputedProjectId}/completion`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `disputed-completion-${smokeRun}`,
    expected: 201,
    body: {
      note: "Needs a contractor review.",
      checklist: { completedOnTime: true, clientApproved: false, photosProvided: false },
    },
  });
  const disputed = await requestJson(`/api/v1/projects/${disputedProjectId}/completion/${disputedCompletion.payload.data.completion.id}/dispute`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `dispute-${smokeRun}`,
    expected: 200,
    body: { reason: "Photos missing." },
  });
  assert.equal(disputed.payload.data.completion.status, "disputed");

  const persisted = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM project_entries pe INNER JOIN projects p ON p.id = pe.project_id INNER JOIN jobs j ON j.id = p.job_id WHERE j.title LIKE $1) AS entries,
       (SELECT count(*)::int FROM project_media pm INNER JOIN projects p ON p.id = pm.project_id INNER JOIN jobs j ON j.id = p.job_id WHERE j.title LIKE $1) AS media,
       (SELECT count(*)::int FROM project_completion_resolutions pcr INNER JOIN projects p ON p.id = pcr.project_id INNER JOIN jobs j ON j.id = p.job_id WHERE j.title LIKE $1) AS resolutions`,
    [`%${smokeRun}%`],
  );
  assert.ok(persisted.rows[0].entries >= 6);
  assert.ok(persisted.rows[0].media >= 2);
  assert.ok(persisted.rows[0].resolutions >= 2);

  console.log(JSON.stringify({
    ok: true,
    smokeRun,
    projectId,
    mediaId,
    entries: persisted.rows[0].entries,
    media: persisted.rows[0].media,
    resolutions: persisted.rows[0].resolutions,
  }, null, 2));
} finally {
  await closeSmokeArtifacts(accounts).catch((error) => {
    console.error("cleanup failed", error);
  });
  await pool.end();
}
