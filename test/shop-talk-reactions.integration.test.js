import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("shop talk reactions are server-owned", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "shop-talk-reactions-test-pepper";
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
        consentVersion: "2026-06-21",
      },
    });
    assert.equal(onboarded.response.status, 200);
    const me = await requestJson(baseUrl, "/api/v1/me", { cookie: account.cookie });
    account.id = me.payload.data.id;
    return account;
  }

  test("shop talk reactions are server-owned", async (context) => {
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

    const contractor = await createAccount(baseUrl, "contractor", "Shop Talk Contractor");
    const tradesperson = await createAccount(baseUrl, "tradesperson", "Shop Talk Electrician");
    const target = { targetType: "thread", targetKey: "post:integration-thread" };

    const anonymous = await requestJson(baseUrl, "/api/v1/shop-talk/reactions/batch", {
      method: "POST",
      body: { targets: [target] },
    });
    assert.equal(anonymous.response.status, 401);

    const initial = await requestJson(baseUrl, "/api/v1/shop-talk/reactions/batch", {
      method: "POST",
      cookie: contractor.cookie,
      body: { targets: [target] },
    });
    assert.equal(initial.response.status, 200);
    assert.deepEqual(initial.payload.data.reactions[0], {
      ...target,
      upvotes: 0,
      downvotes: 0,
      score: 0,
      viewerReaction: null,
    });

    const missingIdempotency = await requestJson(baseUrl, "/api/v1/shop-talk/reactions", {
      method: "POST",
      cookie: contractor.cookie,
      body: { ...target, reaction: "up" },
    });
    assert.equal(missingIdempotency.response.status, 400);
    assert.equal(missingIdempotency.payload.error.code, "IDEMPOTENCY_KEY_REQUIRED");

    const upvoteKey = `upvote-${randomUUID()}`;
    const upvoted = await requestJson(baseUrl, "/api/v1/shop-talk/reactions", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: upvoteKey,
      body: { ...target, reaction: "up" },
    });
    assert.equal(upvoted.response.status, 200);
    assert.equal(upvoted.payload.data.reaction.upvotes, 1);
    assert.equal(upvoted.payload.data.reaction.downvotes, 0);
    assert.equal(upvoted.payload.data.reaction.viewerReaction, "up");
    assert.equal(upvoted.payload.data.reputation.reactionsGiven, 1);

    const replayed = await requestJson(baseUrl, "/api/v1/shop-talk/reactions", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: upvoteKey,
      body: { ...target, reaction: "up" },
    });
    assert.equal(replayed.response.status, 200);
    assert.equal(replayed.response.headers.get("idempotent-replayed"), "true");
    assert.equal(replayed.payload.data.reaction.upvotes, 1);

    const switched = await requestJson(baseUrl, "/api/v1/shop-talk/reactions", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `downvote-${randomUUID()}`,
      body: { ...target, reaction: "down" },
    });
    assert.equal(switched.response.status, 200);
    assert.equal(switched.payload.data.reaction.upvotes, 0);
    assert.equal(switched.payload.data.reaction.downvotes, 1);
    assert.equal(switched.payload.data.reaction.viewerReaction, "down");

    const secondAccount = await requestJson(baseUrl, "/api/v1/shop-talk/reactions", {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: `other-upvote-${randomUUID()}`,
      body: { ...target, reaction: "up" },
    });
    assert.equal(secondAccount.response.status, 200);
    assert.equal(secondAccount.payload.data.reaction.upvotes, 1);
    assert.equal(secondAccount.payload.data.reaction.downvotes, 1);
    assert.equal(secondAccount.payload.data.reaction.viewerReaction, "up");

    const firstAccountView = await requestJson(baseUrl, "/api/v1/shop-talk/reactions/batch", {
      method: "POST",
      cookie: contractor.cookie,
      body: { targets: [target] },
    });
    assert.equal(firstAccountView.payload.data.reactions[0].upvotes, 1);
    assert.equal(firstAccountView.payload.data.reactions[0].downvotes, 1);
    assert.equal(firstAccountView.payload.data.reactions[0].viewerReaction, "down");

    const cleared = await requestJson(baseUrl, "/api/v1/shop-talk/reactions", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: `clear-${randomUUID()}`,
      body: { ...target, reaction: null },
    });
    assert.equal(cleared.response.status, 200);
    assert.equal(cleared.payload.data.reaction.upvotes, 1);
    assert.equal(cleared.payload.data.reaction.downvotes, 0);
    assert.equal(cleared.payload.data.reaction.viewerReaction, null);
    assert.equal(cleared.payload.data.reputation.reactionsGiven, 0);

    const eventRows = await database.query(
      `SELECT event_type
       FROM shop_talk_reaction_events
       WHERE actor_account_id = $1 AND target_type = $2 AND target_key = $3
       ORDER BY occurred_at, id`,
      [contractor.id, target.targetType, target.targetKey],
    );
    assert.deepEqual(eventRows.rows.map((row) => row.event_type), ["set_up", "set_down", "cleared"]);

    const auditRows = await database.query(
      `SELECT count(*)::int AS count
       FROM audit_events
       WHERE actor_account_id = $1 AND subject_type = 'shop_talk_reaction'`,
      [contractor.id],
    );
    assert.equal(auditRows.rows[0].count, 3);
  });
}
