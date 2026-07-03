import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("shop talk moderation is server-owned", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "shop-talk-moderation-test-pepper";
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
    const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}@example.test`;
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: { email, password: "SafePassword!1234", displayName: label, role },
    });
    assert.equal(signup.response.status, 201);
    const account = { email, cookie: sessionCookie(signup.response) };
    const verified = await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: tokenFor(email) },
    });
    assert.equal(verified.response.status, 200);
    const onboarded = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
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
    assert.equal(onboarded.response.status, 200);
    const me = await requestJson(baseUrl, "/api/v1/me", { cookie: account.cookie });
    account.id = me.payload.data.id;
    return account;
  }

  async function createPost(baseUrl, account, title, communitySlug = "electrical-talk") {
    const created = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      cookie: account.cookie,
      idempotencyKey: randomUUID(),
      body: {
        title,
        body: "Moderation integration body.",
        trade: "Electrical",
        flair: "Question",
        postType: "question",
        communitySlug,
      },
    });
    assert.equal(created.response.status, 201);
    return created.payload.data.post;
  }

  async function createAnswer(baseUrl, account, postId, body = "Field answer for moderation.") {
    const created = await requestJson(baseUrl, `/api/v1/shop-talk/posts/${postId}/answers`, {
      method: "POST",
      cookie: account.cookie,
      idempotencyKey: randomUUID(),
      body: { body },
    });
    assert.equal(created.response.status, 201);
    return created.payload.data.answer;
  }

  test("shop talk reports, queue actions, and moderation enforcement are server-owned", async (context) => {
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

    const author = await createAccount(baseUrl, "tradesperson", "Moderation Author");
    const answerer = await createAccount(baseUrl, "tradesperson", "Moderation Answerer");
    const admin = await createAccount(baseUrl, "contractor", "Moderation Admin");
    await database.query(
      "INSERT INTO admin_role_grants (account_id, role, reason) VALUES ($1, 'moderator', 'shop talk moderation integration test')",
      [admin.id],
    );

    const post = await createPost(baseUrl, author, `Moderation post ${randomUUID().slice(0, 8)}`);
    const answer = await createAnswer(baseUrl, answerer, post.id, "Unsafe answer text that should be hidden.");

    const nonAdminQueue = await requestJson(baseUrl, "/api/v1/admin/shop-talk/reports", { cookie: answerer.cookie });
    assert.equal(nonAdminQueue.response.status, 403);

    const reportedAnswer = await requestJson(baseUrl, "/api/v1/shop-talk/reports", {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: randomUUID(),
      body: {
        targetType: "answer",
        targetId: answer.id,
        reasonCode: "unsafe_advice",
        note: "This answer suggests unsafe work.",
      },
    });
    assert.equal(reportedAnswer.response.status, 201);
    assert.equal(reportedAnswer.payload.data.report.targetType, "answer");

    const duplicateReport = await requestJson(baseUrl, "/api/v1/shop-talk/reports", {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: randomUUID(),
      body: {
        targetType: "answer",
        targetId: answer.id,
        reasonCode: "unsafe_advice",
        note: "Duplicate report should stay deduped.",
      },
    });
    assert.equal(duplicateReport.response.status, 201);
    assert.equal(duplicateReport.payload.data.report.id, reportedAnswer.payload.data.report.id);

    const queue = await requestJson(baseUrl, "/api/v1/admin/shop-talk/reports", { cookie: admin.cookie });
    assert.equal(queue.response.status, 200);
    assert.ok(queue.payload.data.reports.some((report) => report.id === reportedAnswer.payload.data.report.id));

    const hideAnswer = await requestJson(baseUrl, `/api/v1/admin/shop-talk/reports/${reportedAnswer.payload.data.report.id}/actions`, {
      method: "POST",
      cookie: admin.cookie,
      idempotencyKey: randomUUID(),
      body: {
        action: "hide",
        reasonCode: "unsafe_advice",
        reason: "Unsafe advice hidden from public Shop Talk reads.",
      },
    });
    assert.equal(hideAnswer.response.status, 200);
    assert.equal(hideAnswer.payload.data.report.status, "actioned");
    assert.equal(hideAnswer.payload.data.action.action, "hide");

    const answersAfterHide = await requestJson(baseUrl, `/api/v1/shop-talk/posts/${post.id}/answers`, { cookie: author.cookie });
    assert.equal(answersAfterHide.response.status, 200);
    assert.equal(answersAfterHide.payload.data.answers.some((candidate) => candidate.id === answer.id), false);

    const hiddenVerify = await requestJson(baseUrl, `/api/v1/shop-talk/posts/${post.id}/answers/${answer.id}/verified-fix`, {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(hiddenVerify.response.status, 404);

    const reportPost = await requestJson(baseUrl, "/api/v1/shop-talk/reports", {
      method: "POST",
      cookie: answerer.cookie,
      idempotencyKey: randomUUID(),
      body: {
        targetType: "post",
        targetId: post.id,
        reasonCode: "spam",
        note: "Lock this thread for moderation.",
      },
    });
    assert.equal(reportPost.response.status, 201);

    const lockPost = await requestJson(baseUrl, `/api/v1/admin/shop-talk/reports/${reportPost.payload.data.report.id}/actions`, {
      method: "POST",
      cookie: admin.cookie,
      idempotencyKey: randomUUID(),
      body: {
        action: "lock",
        reasonCode: "thread_review",
        reason: "Thread locked while moderators review it.",
      },
    });
    assert.equal(lockPost.response.status, 200);

    const lockedAnswer = await requestJson(baseUrl, `/api/v1/shop-talk/posts/${post.id}/answers`, {
      method: "POST",
      cookie: answerer.cookie,
      idempotencyKey: randomUUID(),
      body: { body: "This should be blocked while the post is locked." },
    });
    assert.equal(lockedAnswer.response.status, 409);
    assert.equal(lockedAnswer.payload.error.code, "SHOP_TALK_LOCKED");

    const communityName = `Moderation Jax Electrical ${randomUUID().slice(0, 8)}`;
    const createdCommunity = await requestJson(baseUrl, "/api/v1/communities", {
      method: "POST",
      cookie: author.cookie,
      body: { name: communityName, description: "Moderation smoke community." },
    });
    assert.equal(createdCommunity.response.status, 201);

    const reportCommunity = await requestJson(baseUrl, "/api/v1/shop-talk/reports", {
      method: "POST",
      cookie: answerer.cookie,
      idempotencyKey: randomUUID(),
      body: {
        targetType: "community",
        targetId: createdCommunity.payload.data.community.id,
        reasonCode: "duplicate",
        note: "Duplicate local community.",
      },
    });
    assert.equal(reportCommunity.response.status, 201);

    const lockCommunity = await requestJson(baseUrl, `/api/v1/admin/shop-talk/reports/${reportCommunity.payload.data.report.id}/actions`, {
      method: "POST",
      cookie: admin.cookie,
      idempotencyKey: randomUUID(),
      body: {
        action: "lock",
        reasonCode: "duplicate_review",
        reason: "Community locked while duplicate merge is reviewed.",
      },
    });
    assert.equal(lockCommunity.response.status, 200);

    const lockedCommunityPost = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: randomUUID(),
      body: {
        title: "This should not publish in a locked community",
        body: "Locked communities cannot receive new posts.",
        trade: "Electrical",
        flair: "Question",
        postType: "question",
        communitySlug: createdCommunity.payload.data.community.slug,
      },
    });
    assert.equal(lockedCommunityPost.response.status, 409);
    assert.equal(lockedCommunityPost.payload.error.code, "COMMUNITY_LOCKED");

    await assert.rejects(
      database.query("UPDATE shop_talk_moderation_actions SET reason = 'tampered' WHERE report_id = $1", [reportedAnswer.payload.data.report.id]),
      /append-only/,
    );

    const audit = await database.query(
      "SELECT action, reason_code FROM admin_action_events WHERE actor_account_id = $1 AND subject_type LIKE 'shop_talk_%'",
      [admin.id],
    );
    assert.ok(audit.rows.some((row) => row.action === "shop_talk.hide" && row.reason_code === "unsafe_advice"));
    assert.ok(audit.rows.some((row) => row.action === "shop_talk.lock" && row.reason_code === "thread_review"));
  });
}
