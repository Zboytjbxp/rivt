import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("application offer acceptance creates one active work relationship", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "match-acceptance-test-pepper";
  process.env.REQUIRE_PILOT_INVITE = "false";
  process.env.AUTH_RATE_LIMIT = "10000";
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

  function tokenFor(email) {
    const message = [...capturedEmailMessages()].reverse().find((candidate) => candidate.to === email);
    const match = message?.text.match(/verify-email\?token=([^\s]+)/);
    assert.ok(match);
    return decodeURIComponent(match[1]);
  }

  async function createAccount(baseUrl, role, label) {
    const emailLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const email = `${emailLabel}-${randomUUID()}@example.test`;
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: { email, password: "SafePassword!1234", displayName: label, role },
    });
    assert.equal(signup.response.status, 201);
    const account = { email, cookie: sessionCookie(signup.response) };
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

  async function createPublishedJob(baseUrl, contractor) {
    const created = await requestJson(baseUrl, "/api/v1/jobs", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `create-${randomUUID()}`,
      body: {
        organizationId: contractor.organizationId,
        title: "Acceptance test panel support",
        tradeCode: "electrical",
        summary: "Support a commercial panel scope in Jacksonville for acceptance testing.",
        scopeDescription: "Terminate circuits, label panel, clean the work area, and leave photos for closeout.",
        difficulty: "advanced",
        workType: "side_work",
        budgetCents: 95000,
        durationHours: 8,
        insuranceRequired: true,
        tools: ["Multimeter", "Conduit bender"],
        deliverables: ["Labeled panel", "Closeout photos"],
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

  test("application offer acceptance creates one active work relationship", async (context) => {
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

    const contractor = await createAccount(baseUrl, "contractor", "Acceptance Contractor");
    const tradesperson = await createAccount(baseUrl, "tradesperson", "Acceptance Electrician");
    const otherTradesperson = await createAccount(baseUrl, "tradesperson", "Wrong Recipient");
    const job = await createPublishedJob(baseUrl, contractor);

    const beforeAcceptance = await requestJson(baseUrl, `/api/v1/jobs/${job.id}`, { cookie: tradesperson.cookie });
    assert.equal(beforeAcceptance.response.status, 200);
    assert.equal("privateLocation" in beforeAcceptance.payload.data.job, false);

    await database.query(
      "INSERT INTO account_blocks (blocker_account_id, blocked_account_id, reason) VALUES ($1, $2, 'test block')",
      [contractor.id, otherTradesperson.id],
    );
    const blockedApply = await requestJson(baseUrl, `/api/v1/jobs/${job.id}/applications`, {
      method: "POST",
      cookie: otherTradesperson.cookie,
      idempotencyKey: `blocked-apply-${randomUUID()}`,
      body: {
        message: "I should be blocked.",
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(blockedApply.response.status, 403);
    assert.equal(blockedApply.payload.error.code, "ACCOUNT_BLOCKED");

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
    assert.equal(submitted.payload.data.application.status, "submitted");
    const applicationId = submitted.payload.data.application.id;

    const contractorApplicationNotifications = await requestJson(baseUrl, "/api/v1/notifications", { cookie: contractor.cookie });
    const submittedNotification = contractorApplicationNotifications.payload.data.notifications.find((item) => (
      item.sourceType === "application" && item.sourceId === applicationId
    ));
    assert.equal(submittedNotification.actionHref, `/app/work?job=${job.id}&application=${applicationId}`);
    assert.equal(submittedNotification.metadata.jobId, job.id);

    const duplicateApplication = await requestJson(baseUrl, `/api/v1/jobs/${job.id}/applications`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `apply-duplicate-${randomUUID()}`,
      body: {
        message: "Submitting again should not create another active application.",
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(duplicateApplication.response.status, 409);
    assert.equal(duplicateApplication.payload.error.code, "APPLICATION_ALREADY_EXISTS");

    const unauthorizedApplicantList = await requestJson(baseUrl, `/api/v1/jobs/${job.id}/applications`, { cookie: tradesperson.cookie });
    assert.equal(unauthorizedApplicantList.response.status, 403);

    const applicants = await requestJson(baseUrl, `/api/v1/jobs/${job.id}/applications`, { cookie: contractor.cookie });
    assert.equal(applicants.response.status, 200);
    assert.equal(applicants.payload.data.applications.length, 1);
    assert.equal(applicants.payload.data.applications[0].applicant.accountId, tradesperson.id);

    const shortlisted = await requestJson(baseUrl, `/api/v1/applications/${applicationId}/shortlist`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `shortlist-${randomUUID()}`,
      body: { reason: "Strong fit for the scope." },
    });
    assert.equal(shortlisted.response.status, 200);
    assert.equal(shortlisted.payload.data.application.status, "shortlisted");
    const tradespersonApplicationNotifications = await requestJson(baseUrl, "/api/v1/notifications", { cookie: tradesperson.cookie });
    const shortlistNotification = tradespersonApplicationNotifications.payload.data.notifications.find((item) => (
      item.sourceType === "application" && item.sourceId === applicationId
    ));
    assert.equal(shortlistNotification.actionHref, `/app/work?job=${job.id}&application=${applicationId}`);
    assert.equal(shortlistNotification.metadata.status, "shortlisted");

    const offer = await requestJson(baseUrl, `/api/v1/applications/${applicationId}/offer`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `offer-${randomUUID()}`,
      body: {
        startDate: "2026-07-02",
        scopeSummary: "Panel termination and labeling scope from the accepted job.",
        message: "You are approved for this one. Confirm and the full address unlocks.",
      },
    });
    assert.equal(offer.response.status, 201);
    assert.equal(offer.payload.data.offer.status, "pending");
    const offerId = offer.payload.data.offer.id;

    const wrongRecipientAccept = await requestJson(baseUrl, `/api/v1/offers/${offerId}/accept`, {
      method: "POST",
      cookie: otherTradesperson.cookie,
      idempotencyKey: `wrong-recipient-${randomUUID()}`,
      body: { reason: "Wrong account", consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(wrongRecipientAccept.response.status, 403);
    assert.equal(wrongRecipientAccept.payload.error.code, "OFFER_RECIPIENT_MISMATCH");

    const accepted = await requestJson(baseUrl, `/api/v1/offers/${offerId}/accept`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `accept-${randomUUID()}`,
      body: { reason: "Confirmed start.", consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.payload.data.offer.status, "accepted");
    assert.equal(accepted.payload.data.activeWork.status, "active");
    assert.equal(accepted.payload.data.activeWork.job.trade.code, "electrical");
    assert.equal(accepted.payload.data.activeWork.job.trade.name, "Electrical");
    assert.equal(accepted.payload.data.activeWork.job.durationHours, 8);
    assert.equal(accepted.payload.data.activeWork.job.budget.amountCents, 95000);
    const activeWorkId = accepted.payload.data.activeWork.id;

    const contractorAcceptedNotifications = await requestJson(baseUrl, "/api/v1/notifications", { cookie: contractor.cookie });
    const acceptedNotification = contractorAcceptedNotifications.payload.data.notifications.find((item) => (
      item.sourceType === "active_work" && item.sourceId === activeWorkId
    ));
    assert.equal(acceptedNotification.actionHref, `/app/work?activeWork=${activeWorkId}&job=${job.id}`);
    assert.equal(acceptedNotification.metadata.activeWorkId, activeWorkId);

    const acceptedAgain = await requestJson(baseUrl, `/api/v1/offers/${offerId}/accept`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `accept-again-${randomUUID()}`,
      body: { reason: "Double tap.", consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(acceptedAgain.response.status, 200);
    assert.equal(acceptedAgain.payload.data.activeWork.id, activeWorkId);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM active_work WHERE job_id = $1", [job.id])).rows[0].count, 1);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM work_participants WHERE active_work_id = $1", [activeWorkId])).rows[0].count, 2);

    const afterAcceptance = await requestJson(baseUrl, `/api/v1/jobs/${job.id}`, { cookie: tradesperson.cookie });
    assert.equal(afterAcceptance.response.status, 200);
    assert.equal(afterAcceptance.payload.data.job.privateLocation.addressLine1, "404 Acceptance Way");
    const notParticipantDetail = await requestJson(baseUrl, `/api/v1/jobs/${job.id}`, { cookie: otherTradesperson.cookie });
    assert.equal(notParticipantDetail.response.status, 404);

    const rescheduled = await requestJson(baseUrl, `/api/v1/active-work/${activeWorkId}/reschedule`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `reschedule-${randomUUID()}`,
      body: { reason: "Move start to afternoon." },
    });
    assert.equal(rescheduled.response.status, 200);
    assert.ok(rescheduled.payload.data.activeWork.events.some((event) => event.type === "reschedule_requested" && event.reason));

    const cancelled = await requestJson(baseUrl, `/api/v1/active-work/${activeWorkId}/cancel`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `cancel-${randomUUID()}`,
      body: { reason: "Mutual schedule conflict." },
    });
    assert.equal(cancelled.response.status, 200);
    assert.equal(cancelled.payload.data.activeWork.status, "cancelled");
    assert.ok(cancelled.payload.data.activeWork.events.every((event) => event.occurredAt));

    const eventCounts = await database.query(
      `SELECT
         (SELECT count(*)::int FROM job_application_events WHERE application_id = $1) AS application_events,
         (SELECT count(*)::int FROM job_offer_events WHERE offer_id = $2) AS offer_events,
         (SELECT count(*)::int FROM work_status_events WHERE active_work_id = $3) AS work_events`,
      [applicationId, offerId, activeWorkId],
    );
    assert.ok(eventCounts.rows[0].application_events >= 2);
    assert.ok(eventCounts.rows[0].offer_events >= 2);
    assert.ok(eventCounts.rows[0].work_events >= 3);
  });
}
