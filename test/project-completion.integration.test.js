import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("project records, closeout evidence, and completion", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "project-completion-test-pepper";
  process.env.REQUIRE_PILOT_INVITE = "false";
  process.env.S3_BUCKET = "";
  process.env.S3_ACCESS_KEY_ID = "";
  process.env.S3_SECRET_ACCESS_KEY = "";

  const { Pool } = pg;
  const database = new Pool({ connectionString: testDatabaseUrl, ssl: false });
  const { app, closeDatabase, ensureDatabaseReady } = await import("../server/index.js");
  const { capturedEmailMessages, clearCapturedEmailMessages } = await import("../server/email.js");

  function sessionCookie(response) {
    return String(response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  }

  async function requestJson(baseUrl, path, { body, cookie, idempotencyKey, method = "GET" } = {}) {
    const headers = { Origin: "https://rivt.pro" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  async function requestForm(baseUrl, path, { form, cookie, idempotencyKey, method = "POST" } = {}) {
    const headers = { Origin: "https://rivt.pro" };
    if (cookie) headers.Cookie = cookie;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const response = await fetch(`${baseUrl}${path}`, { method, headers, body: form });
    const payload = await response.json();
    return { response, payload };
  }

  function tokenFor(email) {
    const message = [...capturedEmailMessages()].reverse().find((candidate) => candidate.to === email);
    const match = message?.text.match(/verify-email\?token=([^\s]+)/);
    assert.ok(match);
    return decodeURIComponent(match[1]);
  }

  async function createAccount(baseUrl, role, label) {
    const emailLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const email = `${emailLabel}-${randomUUID()}@example.test`;
    const password = "SafePassword!1234";
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: { email, password, displayName: label, role },
    });
    assert.equal(signup.response.status, 201);
    const account = { email, password, cookie: sessionCookie(signup.response) };
    assert.equal((await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: tokenFor(email) },
    })).response.status, 200);
    const onboarding = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie: account.cookie,
      body: {
        role,
        displayName: label,
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 35,
        tradeCodes: ["electrical"],
        organizationName: role === "contractor" ? `${label} LLC` : undefined,
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(onboarding.response.status, 200);
    const me = await requestJson(baseUrl, "/api/v1/me", { cookie: account.cookie });
    account.id = me.payload.data.id;
    account.organizationId = me.payload.data.organizations[0]?.id;
    return account;
  }

  async function login(baseUrl, account) {
    const loginResponse = await requestJson(baseUrl, "/api/v1/auth/login", {
      method: "POST",
      body: { email: account.email, password: account.password },
    });
    assert.equal(loginResponse.response.status, 200);
    return sessionCookie(loginResponse.response);
  }

  async function createPublishedJob(baseUrl, contractor, title) {
    const created = await requestJson(baseUrl, "/api/v1/jobs", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `create-${randomUUID()}`,
      body: {
        organizationId: contractor.organizationId,
        title,
        tradeCode: "electrical",
        summary: "Support a commercial panel scope in Jacksonville for closeout testing.",
        scopeDescription: "Terminate circuits, label the panel, upload closeout evidence, and keep records private.",
        difficulty: "advanced",
        workType: "side_work",
        budgetCents: 95000,
        durationHours: 8,
        insuranceRequired: true,
        tools: ["Multimeter", "Conduit bender"],
        deliverables: ["Labeled panel", "Closeout photos"],
        publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
        privateLocation: {
          addressLine1: "404 Closeout Way",
          addressLine2: "Unit 5",
          city: "Jacksonville",
          region: "FL",
          postalCode: "32202",
          countryCode: "US",
          accessNotes: "Meet at the loading dock.",
        },
      },
    });
    assert.equal(created.response.status, 201);
    const published = await requestJson(baseUrl, `/api/v1/jobs/${created.payload.data.job.id}/publish`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `publish-${randomUUID()}`,
      body: { expectedVersion: created.payload.data.job.version, consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(published.response.status, 200);
    return published.payload.data.job;
  }

  async function createActiveWork(baseUrl, contractor, tradesperson, job) {
    const submitted = await requestJson(baseUrl, `/api/v1/jobs/${job.id}/applications`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `apply-${randomUUID()}`,
      body: {
        message: "I can handle this panel scope tomorrow morning.",
        proposedStartDate: "2026-07-01",
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(submitted.response.status, 201);
    const offer = await requestJson(baseUrl, `/api/v1/applications/${submitted.payload.data.application.id}/offer`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `offer-${randomUUID()}`,
      body: {
        startDate: "2026-07-02",
        scopeSummary: "Panel termination and labeling scope from the accepted job.",
        message: "Approved. Confirm and the address unlocks.",
      },
    });
    assert.equal(offer.response.status, 201);
    const accepted = await requestJson(baseUrl, `/api/v1/offers/${offer.payload.data.offer.id}/accept`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `accept-${randomUUID()}`,
      body: { reason: "Confirmed start.", consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(accepted.response.status, 200);
    return accepted.payload.data.activeWork;
  }

  async function openProject(baseUrl, activeWorkId, account) {
    const opened = await requestJson(baseUrl, `/api/v1/active-work/${activeWorkId}/project`, {
      method: "POST",
      cookie: account.cookie,
      idempotencyKey: `project-${randomUUID()}`,
      body: {},
    });
    assert.equal(opened.response.status, 200);
    return opened.payload.data.project;
  }

  function pngForm(buffer, name = "closeout.png") {
    const form = new FormData();
    form.append("name", "Closeout photo");
    form.append("notes", "Panel labelled and area cleaned.");
    form.append("file", new Blob([buffer], { type: "image/png" }), name);
    return form;
  }

  test("project records, closeout evidence, and completion", async (context) => {
    await ensureDatabaseReady();
    clearCapturedEmailMessages();
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    context.after(async () => {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await closeDatabase();
      await database.end();
    });

    const contractor = await createAccount(baseUrl, "contractor", "Project Contractor");
    const tradesperson = await createAccount(baseUrl, "tradesperson", "Project Electrician");
    const outsider = await createAccount(baseUrl, "tradesperson", "Project Outsider");

    const job = await createPublishedJob(baseUrl, contractor, "Closeout record panel support");
    const activeWork = await createActiveWork(baseUrl, contractor, tradesperson, job);
    const project = await openProject(baseUrl, activeWork.id, contractor);
    assert.equal(project.status, "open");
    assert.equal(project.activeWorkId, activeWork.id);

    const participantRead = await requestJson(baseUrl, `/api/v1/projects/${project.id}`, { cookie: tradesperson.cookie });
    assert.equal(participantRead.response.status, 200);
    const outsiderRead = await requestJson(baseUrl, `/api/v1/projects/${project.id}`, { cookie: outsider.cookie });
    assert.equal(outsiderRead.response.status, 404);

    const noteKey = `note-${randomUUID()}`;
    const note = await requestJson(baseUrl, `/api/v1/projects/${project.id}/entries`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: noteKey,
      body: { body: "Panel is labelled. Breaker schedule attached to the door." },
    });
    assert.equal(note.response.status, 201);
    const replayedNote = await requestJson(baseUrl, `/api/v1/projects/${project.id}/entries`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: noteKey,
      body: { body: "Panel is labelled. Breaker schedule attached to the door." },
    });
    assert.equal(replayedNote.response.headers.get("idempotent-replayed"), "true");
    assert.equal(replayedNote.payload.data.entry.id, note.payload.data.entry.id);

    const badFileKey = `bad-upload-${randomUUID()}`;
    const rejected = await requestForm(baseUrl, `/api/v1/projects/${project.id}/media`, {
      cookie: tradesperson.cookie,
      idempotencyKey: badFileKey,
      form: pngForm(Buffer.from("this is not really a png"), "fake.png"),
    });
    assert.equal(rejected.response.status, 422);
    assert.equal(rejected.payload.error.code, "UPLOAD_SIGNATURE_MISMATCH");
    assert.equal(rejected.payload.data.media.status, "rejected");
    const rejectedReplay = await requestForm(baseUrl, `/api/v1/projects/${project.id}/media`, {
      cookie: tradesperson.cookie,
      idempotencyKey: badFileKey,
      form: pngForm(Buffer.from("this is not really a png"), "fake.png"),
    });
    assert.equal(rejectedReplay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(rejectedReplay.payload.data.media.id, rejected.payload.data.media.id);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM project_media WHERE project_id = $1 AND status = 'rejected'",
      [project.id],
    )).rows[0].count, 1);

    const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const outage = await requestForm(baseUrl, `/api/v1/projects/${project.id}/media`, {
      cookie: tradesperson.cookie,
      idempotencyKey: `storage-outage-${randomUUID()}`,
      form: pngForm(validPngHeader, "valid-header.png"),
    });
    assert.equal(outage.response.status, 503);
    assert.equal(outage.payload.error.code, "OBJECT_STORAGE_UNAVAILABLE");

    const uploadId = randomUUID();
    const entryId = randomUUID();
    const mediaId = randomUUID();
    const contentHash = createHash("sha256").update("stored evidence").digest("hex");
    await database.query(
      `INSERT INTO uploads (
         id, session_id, account_id, active_work_id, kind, name, notes, object_key, original_name, mime_type,
         size_bytes, upload_status, storage_scope, content_sha256, verified_at
       ) VALUES ($1, $2, $2::uuid, $3, 'project-media', 'Stored evidence', '', 'projects/test/evidence.png',
         'evidence.png', 'image/png', 15, 'stored', 'project', $4, now())`,
      [uploadId, tradesperson.id, activeWork.id, contentHash],
    );
    await database.query(
      `INSERT INTO project_entries (id, project_id, active_work_id, actor_account_id, entry_type, body, metadata)
       VALUES ($1, $2, $3, $4, 'media', 'Stored evidence uploaded.', $5::jsonb)`,
      [entryId, project.id, activeWork.id, tradesperson.id, JSON.stringify({ uploadId })],
    );
    await database.query(
      `INSERT INTO project_media (
         id, project_id, entry_id, upload_id, uploader_account_id, original_name, mime_type, size_bytes,
         content_sha256, media_kind, status, review_status
       ) VALUES ($1, $2, $3, $4, $5, 'evidence.png', 'image/png', 15, $6, 'photo', 'stored', 'not_scanned')`,
      [mediaId, project.id, entryId, uploadId, tradesperson.id, contentHash],
    );

    const mediaUrl = await requestJson(baseUrl, `/api/v1/projects/${project.id}/media/${mediaId}/url`, { cookie: contractor.cookie });
    assert.equal(mediaUrl.response.status, 200);
    assert.equal(mediaUrl.payload.data.media.id, mediaId);
    const tamperedMediaUrl = await requestJson(baseUrl, `/api/v1/projects/${project.id}/media/${mediaId}/url`, { cookie: outsider.cookie });
    assert.equal(tamperedMediaUrl.response.status, 404);

    const contractorSubmit = await requestJson(baseUrl, `/api/v1/projects/${project.id}/completion`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `contractor-submit-${randomUUID()}`,
      body: { note: "Wrong actor.", checklist: { completedOnTime: true, clientApproved: true, photosProvided: true } },
    });
    assert.equal(contractorSubmit.response.status, 403);

    const completion = await requestJson(baseUrl, `/api/v1/projects/${project.id}/completion`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `completion-${randomUUID()}`,
      body: {
        note: "Scope complete. Breaker labels are installed.",
        checklist: { completedOnTime: true, clientApproved: true, photosProvided: true },
        evidenceMediaIds: [mediaId],
      },
    });
    assert.equal(completion.response.status, 201);
    const completionId = completion.payload.data.completion.id;

    const outsiderConfirm = await requestJson(baseUrl, `/api/v1/projects/${project.id}/completion/${completionId}/confirm`, {
      method: "POST",
      cookie: outsider.cookie,
      idempotencyKey: `outsider-confirm-${randomUUID()}`,
      body: { reason: "I should not resolve this." },
    });
    assert.equal(outsiderConfirm.response.status, 404);

    const confirmed = await requestJson(baseUrl, `/api/v1/projects/${project.id}/completion/${completionId}/confirm`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `confirm-${randomUUID()}`,
      body: { reason: "Work inspected and accepted." },
    });
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.payload.data.completion.status, "confirmed");
    assert.equal(confirmed.payload.data.completion.resolutions[0].reason, "Work inspected and accepted.");
    assert.equal((await database.query("SELECT status FROM active_work WHERE id = $1", [activeWork.id])).rows[0].status, "completed");

    const firstReport = await requestJson(baseUrl, `/api/v1/projects/${project.id}/report`, { cookie: contractor.cookie });
    assert.equal(firstReport.response.status, 200);
    const reloginCookie = await login(baseUrl, contractor);
    const secondReport = await requestJson(baseUrl, `/api/v1/projects/${project.id}/report`, { cookie: reloginCookie });
    assert.deepEqual(secondReport.payload.data.report, firstReport.payload.data.report);
    assert.equal(JSON.stringify(firstReport.payload.data.report).includes("404 Closeout Way"), false);

    const disputedJob = await createPublishedJob(baseUrl, contractor, "Disputed closeout panel support");
    const disputedActiveWork = await createActiveWork(baseUrl, contractor, tradesperson, disputedJob);
    const disputedProject = await openProject(baseUrl, disputedActiveWork.id, tradesperson);
    const disputedCompletion = await requestJson(baseUrl, `/api/v1/projects/${disputedProject.id}/completion`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `disputed-completion-${randomUUID()}`,
      body: {
        note: "Scope complete but contractor needs to review photos.",
        checklist: { completedOnTime: true, clientApproved: false, photosProvided: false },
      },
    });
    assert.equal(disputedCompletion.response.status, 201);
    const disputed = await requestJson(baseUrl, `/api/v1/projects/${disputedProject.id}/completion/${disputedCompletion.payload.data.completion.id}/dispute`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `dispute-${randomUUID()}`,
      body: { reason: "Closeout photos are missing." },
    });
    assert.equal(disputed.response.status, 200);
    assert.equal(disputed.payload.data.completion.status, "disputed");
    assert.equal(disputed.payload.data.completion.resolutions[0].reason, "Closeout photos are missing.");

    const cancelled = await requestJson(baseUrl, `/api/v1/active-work/${disputedActiveWork.id}/cancel`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `cancel-${randomUUID()}`,
      body: { reason: "Testing invalid completion state." },
    });
    assert.equal(cancelled.response.status, 200);
    const invalidCompletion = await requestJson(baseUrl, `/api/v1/projects/${disputedProject.id}/completion`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `invalid-completion-${randomUUID()}`,
      body: {
        note: "Trying to submit after cancellation.",
        checklist: { completedOnTime: true, clientApproved: true, photosProvided: true },
      },
    });
    assert.equal(invalidCompletion.response.status, 409);
    assert.equal(invalidCompletion.payload.error.code, "ACTIVE_WORK_NOT_ACTIVE");
  });
}
