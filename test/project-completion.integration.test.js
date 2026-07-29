import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
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
  process.env.AUTH_RATE_LIMIT = "10000";
  process.env.S3_BUCKET = "";
  process.env.S3_ACCESS_KEY_ID = "";
  process.env.S3_SECRET_ACCESS_KEY = "";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_project_ach_test";

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

  async function sendStripeConnectEvent(baseUrl, event) {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHmac("sha256", process.env.STRIPE_CONNECT_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    const response = await fetch(`${baseUrl}/api/stripe/connect/webhook`, {
      method: "POST",
      headers: {
        Origin: "https://rivt.pro",
        "Content-Type": "application/json",
        "Stripe-Signature": `t=${timestamp},v1=${digest}`,
      },
      body,
    });
    return { response, payload: await response.json() };
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
        agreedAmountCents: 95000,
        agreedUnit: "fixed",
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

    const checklist = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `workspace-checklist-${randomUUID()}`,
      body: { recordType: "checklist", title: "Label every panel circuit", state: "open" },
    });
    assert.equal(checklist.response.status, 201);
    assert.equal(checklist.payload.data.record.version, 1);

    const privateNote = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `workspace-private-note-${randomUUID()}`,
      body: { recordType: "note", details: "Remember to bring spare directory cards.", visibility: "private", state: "active" },
    });
    assert.equal(privateNote.response.status, 201);

    const sharedNote = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `workspace-shared-note-${randomUUID()}`,
      body: { recordType: "note", details: "Inspector moved final review to Friday.", visibility: "shared", state: "active" },
    });
    assert.equal(sharedNote.response.status, 201);

    const deniedMilestone = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `workspace-denied-milestone-${randomUUID()}`,
      body: { recordType: "milestone", title: "Final", amountCents: 95000, state: "pending" },
    });
    assert.equal(deniedMilestone.response.status, 403);
    assert.equal(deniedMilestone.payload.error.code, "MILESTONE_WRITE_FORBIDDEN");

    const milestone = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `workspace-milestone-${randomUUID()}`,
      body: { recordType: "milestone", title: "Final", amountCents: 95000, dueNote: "After closeout approval", state: "pending" },
    });
    assert.equal(milestone.response.status, 201);

    const changeOrder = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `workspace-change-${randomUUID()}`,
      body: {
        recordType: "change_order",
        title: "Add two labeled spare breakers",
        requestedBy: "Site superintendent",
        amountCents: 12550,
        state: "pending",
      },
    });
    assert.equal(changeOrder.response.status, 201);

    const tradespersonDecision = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records/${changeOrder.payload.data.record.id}`, {
      method: "PATCH",
      cookie: tradesperson.cookie,
      idempotencyKey: `workspace-change-self-approve-${randomUUID()}`,
      body: { expectedVersion: 1, state: "approved" },
    });
    assert.equal(tradespersonDecision.response.status, 403);
    assert.equal(tradespersonDecision.payload.error.code, "CHANGE_ORDER_DECISION_FORBIDDEN");

    const contractorDecision = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records/${changeOrder.payload.data.record.id}`, {
      method: "PATCH",
      cookie: contractor.cookie,
      idempotencyKey: `workspace-change-approve-${randomUUID()}`,
      body: { expectedVersion: 1, state: "approved" },
    });
    assert.equal(contractorDecision.response.status, 200);
    assert.equal(contractorDecision.payload.data.record.version, 2);

    const staleChecklistUpdate = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records/${checklist.payload.data.record.id}`, {
      method: "PATCH",
      cookie: contractor.cookie,
      idempotencyKey: `workspace-checklist-done-${randomUUID()}`,
      body: { expectedVersion: 1, state: "done" },
    });
    assert.equal(staleChecklistUpdate.response.status, 200);
    const conflict = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records/${checklist.payload.data.record.id}`, {
      method: "PATCH",
      cookie: tradesperson.cookie,
      idempotencyKey: `workspace-checklist-conflict-${randomUUID()}`,
      body: { expectedVersion: 1, state: "open" },
    });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.payload.error.code, "WORKSPACE_RECORD_CONFLICT");
    assert.equal(conflict.payload.error.details.current.version, 2);

    const editedChecklist = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records/${checklist.payload.data.record.id}`, {
      method: "PATCH",
      cookie: tradesperson.cookie,
      idempotencyKey: `workspace-checklist-edit-${randomUUID()}`,
      body: { expectedVersion: 2, title: "Label and photograph every panel circuit" },
    });
    assert.equal(editedChecklist.response.status, 200);
    assert.equal(editedChecklist.payload.data.record.version, 3);

    const archivedChecklist = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records/${checklist.payload.data.record.id}`, {
      method: "DELETE",
      cookie: tradesperson.cookie,
      idempotencyKey: `workspace-checklist-archive-${randomUUID()}`,
      body: { expectedVersion: 3 },
    });
    assert.equal(archivedChecklist.response.status, 200);
    assert.equal(archivedChecklist.payload.data.record.version, 4);
    const archivedWorkspace = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, { cookie: contractor.cookie });
    assert.equal(archivedWorkspace.payload.data.records.some((record) => record.id === checklist.payload.data.record.id), false);
    assert.equal(archivedWorkspace.payload.data.archivedRecords.some((record) => record.id === checklist.payload.data.record.id), true);

    const restoredChecklist = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records/${checklist.payload.data.record.id}/restore`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `workspace-checklist-restore-${randomUUID()}`,
      body: { expectedVersion: 4 },
    });
    assert.equal(restoredChecklist.response.status, 200);
    assert.equal(restoredChecklist.payload.data.record.version, 5);

    const contractorWorkspace = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, { cookie: contractor.cookie });
    assert.equal(contractorWorkspace.response.status, 200);
    assert.equal(contractorWorkspace.payload.data.records.some((record) => record.id === privateNote.payload.data.record.id), false);
    assert.equal(contractorWorkspace.payload.data.records.some((record) => record.id === sharedNote.payload.data.record.id), true);
    assert.equal(contractorWorkspace.payload.data.archivedRecords.length, 0);
    assert.ok(contractorWorkspace.payload.data.events.some((event) => event.eventType === "state_changed"));
    assert.ok(contractorWorkspace.payload.data.events.some((event) => event.metadata.action === "restored"));

    const tradespersonWorkspace = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, { cookie: tradesperson.cookie });
    assert.equal(tradespersonWorkspace.response.status, 200);
    assert.equal(tradespersonWorkspace.payload.data.records.some((record) => record.id === privateNote.payload.data.record.id), true);
    const outsiderWorkspace = await requestJson(baseUrl, `/api/v1/projects/${project.id}/workspace-records`, { cookie: outsider.cookie });
    assert.equal(outsiderWorkspace.response.status, 404);
    assert.ok((await database.query(
      `SELECT count(*)::int AS count
       FROM in_app_notifications
       WHERE account_id = $1 AND source_type = 'project_workspace_record'`,
      [contractor.id],
    )).rows[0].count >= 2);

    await assert.rejects(
      database.query("UPDATE project_workspace_events SET event_type = 'updated' WHERE project_id = $1", [project.id]),
      /append-only/,
    );

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
       ) VALUES ($1, $2, $3, $4, 'project-media', 'Stored evidence', '', 'projects/test/evidence.png',
         'evidence.png', 'image/png', 15, 'stored', 'project', $5, now())`,
      [uploadId, randomUUID(), tradesperson.id, activeWork.id, contentHash],
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

    const contractorNotifications = await requestJson(baseUrl, "/api/v1/notifications", { cookie: contractor.cookie });
    const completionNotification = contractorNotifications.payload.data.notifications.find((item) => (
      item.sourceType === "project" && item.sourceId === project.id && item.title === "Completion submitted"
    ));
    assert.equal(completionNotification.actionHref, `/app/work?activeWork=${activeWork.id}&job=${job.id}&project=${project.id}&closeout=1`);
    assert.equal(completionNotification.metadata.projectId, project.id);

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

    const tradespersonNotifications = await requestJson(baseUrl, "/api/v1/notifications", { cookie: tradesperson.cookie });
    const confirmedNotification = tradespersonNotifications.payload.data.notifications.find((item) => (
      item.sourceType === "project" && item.sourceId === project.id && item.title === "Completion confirmed"
    ));
    assert.equal(confirmedNotification.actionHref, `/app/work?activeWork=${activeWork.id}&job=${job.id}&project=${project.id}&closeout=1`);
    assert.equal(confirmedNotification.metadata.projectId, project.id);

    const reviewContext = await requestJson(baseUrl, `/api/v1/active-work/${activeWork.id}/review-context`, { cookie: tradesperson.cookie });
    assert.equal(reviewContext.response.status, 200);
    assert.equal(reviewContext.payload.data.reviewContext.eligible, true);
    assert.equal(reviewContext.payload.data.reviewContext.hasSubmitted, false);
    assert.equal(reviewContext.payload.data.reviewContext.counterparty.accountId, contractor.id);

    const outsiderInvoice = await requestJson(baseUrl, `/api/v1/active-work/${activeWork.id}/invoices`, {
      method: "POST",
      cookie: outsider.cookie,
      idempotencyKey: `invoice-outsider-${randomUUID()}`,
      body: {
        invoiceNumber: "OUTSIDER-1",
        lineItems: [{ description: "Not allowed", quantity: 1, rateCents: 100 }],
      },
    });
    assert.equal(outsiderInvoice.response.status, 404);

    const invoice = await requestJson(baseUrl, `/api/v1/active-work/${activeWork.id}/invoices`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `invoice-create-${randomUUID()}`,
      body: {
        invoiceNumber: "CLOSEOUT-001",
        billTo: "Project Contractor LLC",
        payTo: "Project Electrician",
        terms: "Due on completion",
        paymentMethod: "Direct payment",
        taxCents: 500,
        lineItems: [
          { description: "Panel labor", quantity: 8, rateCents: 8500, kind: "labor" },
          { description: "Labels", quantity: 1, rateCents: 1200, kind: "material" },
        ],
      },
    });
    assert.equal(invoice.response.status, 201);
    assert.equal(invoice.payload.data.invoice.totalCents, 69700);
    assert.equal(invoice.payload.data.invoice.status, "draft");
    const invoiceId = invoice.payload.data.invoice.id;

    const contractorInvoiceStatus = await requestJson(baseUrl, `/api/v1/project-invoices/${invoiceId}`, {
      method: "PATCH",
      cookie: contractor.cookie,
      idempotencyKey: `invoice-contractor-status-${randomUUID()}`,
      body: { status: "sent" },
    });
    assert.equal(contractorInvoiceStatus.response.status, 403);

    const sentInvoice = await requestJson(baseUrl, `/api/v1/project-invoices/${invoiceId}`, {
      method: "PATCH",
      cookie: tradesperson.cookie,
      idempotencyKey: `invoice-sent-${randomUUID()}`,
      body: { status: "sent" },
    });
    assert.equal(sentInvoice.response.status, 200);
    assert.equal(sentInvoice.payload.data.invoice.status, "sent");

    const connectStatus = await requestJson(baseUrl, "/api/v1/payments/connect/status", {
      cookie: tradesperson.cookie,
    });
    assert.equal(connectStatus.response.status, 200);
    assert.equal(connectStatus.payload.data.connect.providerConfigured, false);
    assert.equal(connectStatus.payload.data.connect.ready, false);

    const paymentSessionId = `cs_test_${randomUUID().replaceAll("-", "")}`;
    const paymentIntentId = `pi_test_${randomUUID().replaceAll("-", "")}`;
    const onlinePaymentRequest = (await database.query(
      `INSERT INTO project_invoice_payment_requests (
         invoice_id, project_id, active_work_id, merchant_account_id,
         stripe_connected_account_id, stripe_checkout_session_id,
         amount_cents, status, checkout_url
       )
       VALUES ($1, $2, $3, $4, 'acct_test_rivt', $5, $6, 'open', 'https://checkout.stripe.test/session')
       RETURNING id`,
      [invoiceId, project.id, activeWork.id, tradesperson.id, paymentSessionId, 69700],
    )).rows[0];

    const publicPaymentStatus = await requestJson(baseUrl, `/api/v1/invoice-payments/${paymentSessionId}`);
    assert.equal(publicPaymentStatus.response.status, 200);
    assert.equal(publicPaymentStatus.payload.data.payment.invoiceNumber, "CLOSEOUT-001");
    assert.equal(publicPaymentStatus.payload.data.payment.payTo, "Project Electrician");
    assert.equal(publicPaymentStatus.payload.data.payment.status, "open");
    assert.equal(JSON.stringify(publicPaymentStatus.payload).includes("Project Contractor LLC"), false);
    assert.equal("id" in publicPaymentStatus.payload.data.payment, false);
    assert.equal("invoiceId" in publicPaymentStatus.payload.data.payment, false);
    assert.equal("checkoutUrl" in publicPaymentStatus.payload.data.payment, false);
    assert.equal(publicPaymentStatus.response.headers.get("cache-control"), "no-store");
    assert.equal(publicPaymentStatus.response.headers.get("pragma"), "no-cache");

    const missingPublicPaymentStatus = await requestJson(
      baseUrl,
      `/api/v1/invoice-payments/cs_test_missing_${randomUUID().replaceAll("-", "")}`,
    );
    assert.equal(missingPublicPaymentStatus.response.status, 404);
    assert.equal(missingPublicPaymentStatus.response.headers.get("cache-control"), "no-store");
    assert.equal(missingPublicPaymentStatus.response.headers.get("pragma"), "no-cache");

    const paymentWhileLinkActive = await requestJson(baseUrl, `/api/v1/project-invoices/${invoiceId}/payments`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `invoice-payment-active-link-${randomUUID()}`,
      body: { amountCents: 20000, paymentDate: "2026-07-04", method: "Check", note: "Should be blocked." },
    });
    assert.equal(paymentWhileLinkActive.response.status, 409);
    assert.equal(paymentWhileLinkActive.payload.error.code, "BANK_PAYMENT_LINK_ACTIVE");
    const checkoutCompleted = await sendStripeConnectEvent(baseUrl, {
      id: `evt_${randomUUID().replaceAll("-", "")}`,
      type: "checkout.session.completed",
      account: "acct_test_rivt",
      livemode: false,
      data: {
        object: {
          id: paymentSessionId,
          payment_status: "unpaid",
          payment_intent: paymentIntentId,
          metadata: { payment_request_id: onlinePaymentRequest.id },
        },
      },
    });
    assert.equal(checkoutCompleted.response.status, 200);
    assert.equal(checkoutCompleted.response.headers.get("cache-control"), "no-store");
    assert.equal(checkoutCompleted.response.headers.get("pragma"), "no-cache");
    assert.equal((await database.query(
      "SELECT status FROM project_invoice_payment_requests WHERE id = $1",
      [onlinePaymentRequest.id],
    )).rows[0].status, "processing");
    assert.equal((await database.query("SELECT status FROM project_invoices WHERE id = $1", [invoiceId])).rows[0].status, "sent");

    const succeededEvent = {
      id: `evt_${randomUUID().replaceAll("-", "")}`,
      type: "checkout.session.async_payment_succeeded",
      account: "acct_test_rivt",
      livemode: false,
      data: {
        object: {
          id: paymentSessionId,
          payment_intent: paymentIntentId,
          metadata: { payment_request_id: onlinePaymentRequest.id },
        },
      },
    };
    const achSucceeded = await sendStripeConnectEvent(baseUrl, succeededEvent);
    assert.equal(achSucceeded.response.status, 200);
    assert.equal((await database.query("SELECT status FROM project_invoices WHERE id = $1", [invoiceId])).rows[0].status, "paid");
    const succeededReplay = await sendStripeConnectEvent(baseUrl, succeededEvent);
    assert.equal(succeededReplay.response.status, 200);
    assert.equal(succeededReplay.payload.duplicate, true);

    const achRefunded = await sendStripeConnectEvent(baseUrl, {
      id: `evt_${randomUUID().replaceAll("-", "")}`,
      type: "charge.refunded",
      account: "acct_test_rivt",
      livemode: false,
      data: {
        object: {
          id: "ch_test_rivt_ach",
          payment_intent: paymentIntentId,
          amount: 69700,
          amount_refunded: 69700,
        },
      },
    });
    assert.equal(achRefunded.response.status, 200);
    assert.equal((await database.query(
      "SELECT status FROM project_invoice_payment_requests WHERE id = $1",
      [onlinePaymentRequest.id],
    )).rows[0].status, "refunded");
    assert.equal((await database.query("SELECT status FROM project_invoices WHERE id = $1", [invoiceId])).rows[0].status, "sent");

    const partialPayment = await requestJson(baseUrl, `/api/v1/project-invoices/${invoiceId}/payments`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `invoice-payment-one-${randomUUID()}`,
      body: { amountCents: 20000, paymentDate: "2026-07-04", method: "Check", note: "Deposit handed over." },
    });
    assert.equal(partialPayment.response.status, 201);
    assert.equal(partialPayment.payload.data.invoice.paidCents, 20000);
    assert.equal(partialPayment.payload.data.invoice.balanceCents, 49700);

    const excessPayment = await requestJson(baseUrl, `/api/v1/project-invoices/${invoiceId}/payments`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `invoice-payment-excess-${randomUUID()}`,
      body: { amountCents: 50000, paymentDate: "2026-07-04", method: "Check", note: "Too much." },
    });
    assert.equal(excessPayment.response.status, 422);
    assert.equal(excessPayment.payload.error.code, "PROJECT_PAYMENT_EXCEEDS_INVOICE");

    const finalPayment = await requestJson(baseUrl, `/api/v1/project-invoices/${invoiceId}/payments`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `invoice-payment-two-${randomUUID()}`,
      body: { amountCents: 49700, paymentDate: "2026-07-05", method: "Direct payment", note: "Balance paid." },
    });
    assert.equal(finalPayment.response.status, 201);
    assert.equal(finalPayment.payload.data.invoice.status, "paid");
    assert.equal(finalPayment.payload.data.invoice.balanceCents, 0);

    const firstReport = await requestJson(baseUrl, `/api/v1/projects/${project.id}/report`, { cookie: contractor.cookie });
    assert.equal(firstReport.response.status, 200);
    assert.equal(firstReport.payload.data.report.financialRecords.length, 1);
    assert.equal(firstReport.payload.data.report.financialRecords[0].status, "paid");
    assert.equal(firstReport.payload.data.report.financialRecords[0].payments.length, 2);
    assert.equal(firstReport.payload.data.report.reportVersion, "gate-a-project-closeout-v2");
    assert.equal(firstReport.payload.data.report.workspaceRecords.length, 4);
    assert.equal(firstReport.payload.data.report.workspaceRecords.some((record) => record.id === privateNote.payload.data.record.id), false);
    assert.ok(firstReport.payload.data.report.workspaceHistory.some((event) => event.eventType === "state_changed"));
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
