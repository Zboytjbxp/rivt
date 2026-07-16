import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("job-linked conversations and notification state", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "messaging-notifications-test-pepper";
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

  async function createPublishedJob(baseUrl, contractor) {
    const created = await requestJson(baseUrl, "/api/v1/jobs", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `create-${randomUUID()}`,
      body: {
        organizationId: contractor.organizationId,
        title: "Messaging test panel support",
        tradeCode: "electrical",
        summary: "Support a commercial panel scope in Jacksonville for messaging testing.",
        scopeDescription: "Terminate circuits, label the panel, and leave photos for closeout.",
        difficulty: "advanced",
        workType: "side_work",
        budgetCents: 95000,
        durationHours: 8,
        insuranceRequired: true,
        tools: ["Multimeter", "Conduit bender"],
        deliverables: ["Labeled panel", "Closeout photos"],
        publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
        privateLocation: {
          addressLine1: "404 Messaging Way",
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
        message: "You are approved for this one. Confirm and the full address unlocks.",
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

  test("job-linked conversations and notification state", async (context) => {
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

    const contractor = await createAccount(baseUrl, "contractor", "Messaging Contractor");
    const tradesperson = await createAccount(baseUrl, "tradesperson", "Messaging Electrician");
    const outsider = await createAccount(baseUrl, "tradesperson", "Conversation Outsider");
    const job = await createPublishedJob(baseUrl, contractor);
    const activeWork = await createActiveWork(baseUrl, contractor, tradesperson, job);

    const contractorThread = await requestJson(baseUrl, `/api/v1/active-work/${activeWork.id}/conversation`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `open-contractor-${randomUUID()}`,
      body: {},
    });
    assert.equal(contractorThread.response.status, 200);
    const conversationId = contractorThread.payload.data.conversation.id;

    const tradespersonThreads = await requestJson(baseUrl, "/api/v1/conversations", { cookie: tradesperson.cookie });
    assert.equal(tradespersonThreads.response.status, 200);
    assert.ok(tradespersonThreads.payload.data.conversations.some((conversation) => conversation.id === conversationId));

    const outsiderThreads = await requestJson(baseUrl, "/api/v1/conversations", { cookie: outsider.cookie });
    assert.equal(outsiderThreads.response.status, 200);
    assert.equal(outsiderThreads.payload.data.conversations.length, 0);

    const outsiderRead = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/messages`, { cookie: outsider.cookie });
    assert.equal(outsiderRead.response.status, 404);
    const outsiderSend = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      cookie: outsider.cookie,
      idempotencyKey: `outsider-send-${randomUUID()}`,
      body: { body: "I should not be able to post here." },
    });
    assert.equal(outsiderSend.response.status, 404);

    const messageBody = "I am on site and can start after the morning safety brief.";
    const messageKey = `message-${randomUUID()}`;
    const firstMessage = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: messageKey,
      body: { body: messageBody },
    });
    assert.equal(firstMessage.response.status, 201);
    const replayedMessage = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: messageKey,
      body: { body: messageBody },
    });
    assert.equal(replayedMessage.response.status, 201);
    assert.equal(replayedMessage.response.headers.get("idempotent-replayed"), "true");
    assert.equal(replayedMessage.payload.data.message.id, firstMessage.payload.data.message.id);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM conversation_messages WHERE conversation_id = $1 AND body = $2",
      [conversationId, messageBody],
    )).rows[0].count, 1);

    const contractorUnread = await requestJson(baseUrl, "/api/v1/conversations", { cookie: contractor.cookie });
    assert.equal(contractorUnread.response.status, 200);
    assert.equal(contractorUnread.payload.data.conversations.find((conversation) => conversation.id === conversationId).unreadCount, 1);

    const reloginCookie = await login(baseUrl, contractor);
    const afterRelogin = await requestJson(baseUrl, "/api/v1/conversations", { cookie: reloginCookie });
    assert.equal(afterRelogin.response.status, 200);
    assert.equal(afterRelogin.payload.data.conversations.find((conversation) => conversation.id === conversationId).unreadCount, 1);

    const notifications = await requestJson(baseUrl, "/api/v1/notifications", { cookie: reloginCookie });
    assert.equal(notifications.response.status, 200);
    const notificationText = JSON.stringify(notifications.payload.data.notifications);
    assert.match(notificationText, /sent a message|Offer accepted/);
    assert.equal(notificationText.includes("404 Messaging Way"), false);
    assert.equal(notificationText.includes("Unit 5"), false);

    const read = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/read`, {
      method: "POST",
      cookie: reloginCookie,
      body: {},
    });
    assert.equal(read.response.status, 200);
    assert.equal(read.payload.data.conversation.unreadCount, 0);
    await requestJson(baseUrl, "/api/v1/notifications/read", {
      method: "POST",
      cookie: reloginCookie,
      body: { all: true },
    });

    const muted = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/mute`, {
      method: "POST",
      cookie: reloginCookie,
      body: { mutedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
    });
    assert.equal(muted.response.status, 200);

    const mutedMessage = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `muted-message-${randomUUID()}`,
      body: { body: "Sending while muted should not create another notification." },
    });
    assert.equal(mutedMessage.response.status, 201);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM in_app_notifications WHERE account_id = $1 AND source_type = 'message'",
      [contractor.id],
    )).rows[0].count, 1);

    const report = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/report`, {
      method: "POST",
      cookie: reloginCookie,
      idempotencyKey: `report-${randomUUID()}`,
      body: {
        reason: "safety",
        note: "The conversation should be reviewed for safety context.",
        reportedAccountId: tradesperson.id,
      },
    });
    assert.equal(report.response.status, 201);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM conversation_reports WHERE conversation_id = $1 AND reporter_account_id = $2",
      [conversationId, contractor.id],
    )).rows[0].count, 1);

    const block = await requestJson(baseUrl, `/api/v1/accounts/${tradesperson.id}/block`, {
      method: "POST",
      cookie: reloginCookie,
      body: { reason: "Stop test contact." },
    });
    assert.equal(block.response.status, 200);
    const blockedSend = await requestJson(baseUrl, `/api/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `blocked-message-${randomUUID()}`,
      body: { body: "Blocked accounts cannot keep messaging." },
    });
    assert.equal(blockedSend.response.status, 403);
    assert.equal(blockedSend.payload.error.code, "ACCOUNT_BLOCKED");
  });
}
