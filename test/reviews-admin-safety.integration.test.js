import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("reviews, admin safety, support, and restriction gates", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "reviews-admin-safety-test-pepper";
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

  async function createPublishedJob(baseUrl, contractor, title) {
    const created = await requestJson(baseUrl, "/api/v1/jobs", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `create-${randomUUID()}`,
      body: {
        organizationId: contractor.organizationId,
        title,
        tradeCode: "electrical",
        summary: "Support a commercial electrical scope in Jacksonville.",
        scopeDescription: "Complete a safe, documented electrical scope with records and closeout notes.",
        difficulty: "advanced",
        workType: "side_work",
        budgetCents: 95000,
        durationHours: 8,
        insuranceRequired: true,
        tools: ["Multimeter", "Conduit bender"],
        deliverables: ["Closeout notes", "Punch list"],
        publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
        privateLocation: {
          addressLine1: "700 Safety Packet Way",
          city: "Jacksonville",
          region: "FL",
          postalCode: "32202",
          countryCode: "US",
          accessNotes: "Meet at the side gate.",
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
        message: "I can safely handle this scope.",
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
        scopeSummary: "Electrical support scope from the accepted job.",
        message: "Approved. Confirm and start the work record.",
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

  async function completeActiveWork(baseUrl, contractor, tradesperson, activeWork) {
    const opened = await requestJson(baseUrl, `/api/v1/active-work/${activeWork.id}/project`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `project-${randomUUID()}`,
      body: {},
    });
    assert.equal(opened.response.status, 200);
    const project = opened.payload.data.project;
    const completion = await requestJson(baseUrl, `/api/v1/projects/${project.id}/completion`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `completion-${randomUUID()}`,
      body: {
        note: "Scope completed and reviewed with the contractor.",
        checklist: { completedOnTime: true, clientApproved: true, photosProvided: false },
      },
    });
    assert.equal(completion.response.status, 201);
    const confirmed = await requestJson(baseUrl, `/api/v1/projects/${project.id}/completion/${completion.payload.data.completion.id}/confirm`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `confirm-${randomUUID()}`,
      body: { reason: "Accepted for review testing." },
    });
    assert.equal(confirmed.response.status, 200);
    return project;
  }

  test("reviews, admin safety, support, and restriction gates", async (context) => {
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

    const contractor = await createAccount(baseUrl, "contractor", "Review Contractor");
    const tradesperson = await createAccount(baseUrl, "tradesperson", "Review Electrician");
    const outsider = await createAccount(baseUrl, "tradesperson", "Review Outsider");
    const admin = await createAccount(baseUrl, "contractor", "Review Admin");
    await database.query(
      "INSERT INTO admin_role_grants (account_id, role, reason) VALUES ($1, 'owner', 'integration test')",
      [admin.id],
    );

    const job = await createPublishedJob(baseUrl, contractor, "Packet 07 completed review scope");
    const activeWork = await createActiveWork(baseUrl, contractor, tradesperson, job);
    await completeActiveWork(baseUrl, contractor, tradesperson, activeWork);

    const adminDenied = await requestJson(baseUrl, "/api/v1/admin/overview", { cookie: contractor.cookie });
    assert.equal(adminDenied.response.status, 403);

    const invalidReview = await requestJson(baseUrl, `/api/v1/active-work/${activeWork.id}/reviews`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `invalid-review-${randomUUID()}`,
      body: { revieweeAccountId: contractor.id, rating: 5, body: "Self-review should fail.", consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(invalidReview.response.status, 422);

    const activeJob = await createPublishedJob(baseUrl, contractor, "Packet 07 active unsafe scope");
    const activeOnlyWork = await createActiveWork(baseUrl, contractor, tradesperson, activeJob);
    const ineligibleReview = await requestJson(baseUrl, `/api/v1/active-work/${activeOnlyWork.id}/reviews`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `ineligible-review-${randomUUID()}`,
      body: { revieweeAccountId: tradesperson.id, rating: 5, body: "Too early.", consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(ineligibleReview.response.status, 409);
    assert.equal(ineligibleReview.payload.error.code, "REVIEW_NOT_ELIGIBLE");

    const review = await requestJson(baseUrl, `/api/v1/active-work/${activeWork.id}/reviews`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `review-${randomUUID()}`,
      body: {
        revieweeAccountId: tradesperson.id,
        rating: 5,
        body: "Showed up prepared, communicated clearly, and closed the scope safely.",
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(review.response.status, 201);
    assert.equal(review.payload.data.review.status, "pending_approval");

    const duplicateReview = await requestJson(baseUrl, `/api/v1/active-work/${activeWork.id}/reviews`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `duplicate-review-${randomUUID()}`,
      body: {
        revieweeAccountId: tradesperson.id,
        rating: 4,
        body: "Duplicate should fail.",
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(duplicateReview.response.status, 409);
    assert.equal(duplicateReview.payload.error.code, "REVIEW_ALREADY_EXISTS");

    const disputed = await requestJson(baseUrl, `/api/v1/reviews/${review.payload.data.review.id}/dispute`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `review-dispute-${randomUUID()}`,
      body: { reason: "Please add that I had to wait for access before starting." },
    });
    assert.equal(disputed.response.status, 200);
    assert.equal(disputed.payload.data.review.status, "disputed");
    const responseNote = await requestJson(baseUrl, `/api/v1/reviews/${review.payload.data.review.id}/responses`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `review-response-${randomUUID()}`,
      body: { note: "Access delay noted. Work quality was strong." },
    });
    assert.equal(responseNote.response.status, 201);
    assert.ok(responseNote.payload.data.review.events.some((event) => event.type === "response_added"));
    await assert.rejects(
      database.query("UPDATE review_events SET note = 'tampered' WHERE review_id = $1", [review.payload.data.review.id]),
      /append-only/,
    );

    const resolved = await requestJson(baseUrl, `/api/v1/admin/reviews/${review.payload.data.review.id}/resolve`, {
      method: "POST",
      cookie: admin.cookie,
      idempotencyKey: `admin-review-${randomUUID()}`,
      body: { status: "resolved", reasonCode: "balanced_context", reason: "Both parties added context and the review can stand." },
    });
    assert.equal(resolved.response.status, 200);
    assert.equal(resolved.payload.data.review.status, "resolved");

    const reputation = await requestJson(baseUrl, `/api/v1/accounts/${tradesperson.id}/reputation`, { cookie: contractor.cookie });
    assert.equal(reputation.response.status, 200);
    assert.equal(reputation.payload.data.reputation.reviews.publishedCount, 1);

    const unsafeReport = await requestJson(baseUrl, `/api/v1/active-work/${activeOnlyWork.id}/unsafe-reports`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `unsafe-${randomUUID()}`,
      body: {
        conditionType: "stop_work",
        severity: "urgent",
        description: "Temporary power path is unsafe; stop-work notice opened without assigning fault.",
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(unsafeReport.response.status, 201);
    assert.equal(unsafeReport.payload.data.unsafeReport.conditionType, "stop_work");
    assert.ok(unsafeReport.payload.data.unsafeReport.events.some((event) => event.type === "opened"));

    const safetyReport = await requestJson(baseUrl, "/api/v1/reports", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `safety-report-${randomUUID()}`,
      body: {
        subjectType: "active_work",
        subjectId: activeOnlyWork.id,
        reason: "safety",
        note: "Review the unsafe condition report and contact both parties.",
      },
    });
    assert.equal(safetyReport.response.status, 201);

    const blocked = await requestJson(baseUrl, `/api/v1/accounts/${tradesperson.id}/block`, {
      method: "POST",
      cookie: contractor.cookie,
      body: { reason: "Stop all direct contact for Packet 07." },
    });
    assert.equal(blocked.response.status, 200);
    const blockedJob = await createPublishedJob(baseUrl, contractor, "Packet 07 hidden after block");
    const blockedDetail = await requestJson(baseUrl, `/api/v1/jobs/${blockedJob.id}`, { cookie: tradesperson.cookie });
    assert.equal(blockedDetail.response.status, 404);
    const blockedList = await requestJson(baseUrl, "/api/v1/jobs", { cookie: tradesperson.cookie });
    assert.equal(blockedList.response.status, 200);
    assert.equal(blockedList.payload.data.jobs.some((candidate) => candidate.id === blockedJob.id), false);
    const blockedReputation = await requestJson(baseUrl, `/api/v1/accounts/${tradesperson.id}/reputation`, { cookie: contractor.cookie });
    assert.equal(blockedReputation.response.status, 404);

    const restriction = await requestJson(baseUrl, `/api/v1/admin/accounts/${outsider.id}/restrictions`, {
      method: "POST",
      cookie: admin.cookie,
      idempotencyKey: `restrict-${randomUUID()}`,
      body: { restrictionType: "suspension", reasonCode: "safety_review", reason: "Account temporarily suspended for support review." },
    });
    assert.equal(restriction.response.status, 201);
    const deniedMutation = await requestJson(baseUrl, `/api/v1/jobs/${blockedJob.id}/applications`, {
      method: "POST",
      cookie: outsider.cookie,
      idempotencyKey: `restricted-apply-${randomUUID()}`,
      body: { message: "This should be blocked.", consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(deniedMutation.response.status, 403);
    assert.equal(deniedMutation.payload.error.code, "ACCOUNT_NOT_ACTIVE");
    const support = await requestJson(baseUrl, "/api/v1/support/cases", {
      method: "POST",
      cookie: outsider.cookie,
      idempotencyKey: `support-${randomUUID()}`,
      body: {
        category: "appeal",
        title: "Appeal account restriction",
        description: "I need support to review the account restriction.",
      },
    });
    assert.equal(support.response.status, 201);

    const supportAdminEvent = await requestJson(baseUrl, `/api/v1/admin/support-cases/${support.payload.data.case.id}/events`, {
      method: "POST",
      cookie: admin.cookie,
      idempotencyKey: `support-admin-${randomUUID()}`,
      body: {
        eventType: "status_changed",
        status: "reviewing",
        visibility: "user",
        note: "Support is reviewing the restriction.",
        reasonCode: "appeal_opened",
        reason: "Responded to restricted account appeal.",
      },
    });
    assert.equal(supportAdminEvent.response.status, 201);

    const lifted = await requestJson(baseUrl, `/api/v1/admin/restrictions/${restriction.payload.data.restriction.id}/lift`, {
      method: "POST",
      cookie: admin.cookie,
      idempotencyKey: `lift-${randomUUID()}`,
      body: { reasonCode: "appeal_resolved", reason: "Restriction lifted after review." },
    });
    assert.equal(lifted.response.status, 200);
    assert.equal(lifted.payload.data.restriction.status, "lifted");

    const adminActions = await database.query(
      "SELECT action, reason_code, reason FROM admin_action_events WHERE actor_account_id = $1 ORDER BY occurred_at DESC",
      [admin.id],
    );
    assert.ok(adminActions.rows.some((row) => row.action === "account.restriction.imposed" && row.reason_code === "safety_review"));
    assert.ok(adminActions.rows.some((row) => row.action === "account.restriction.lifted" && row.reason_code === "appeal_resolved"));
    assert.ok(adminActions.rows.some((row) => row.action === "support_case.event_added" && row.reason_code === "appeal_opened"));
    assert.ok(adminActions.rows.every((row) => row.reason.length > 0));
  });
}
