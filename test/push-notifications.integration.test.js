import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import webpush from "web-push";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("web push subscriptions and durable delivery outbox", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "push-notifications-test-pepper";
  process.env.REQUIRE_PILOT_INVITE = "false";
  process.env.AUTH_RATE_LIMIT = "10000";
  const vapidKeys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:noreply@example.test";
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

  function rawSessionId(cookie) {
    return decodeURIComponent(cookie.split("=", 2)[1]);
  }

  async function requestJson(baseUrl, path, { body, cookie, method = "GET" } = {}) {
    const headers = { Origin: "https://rivt.pro" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  function verificationToken(email) {
    const message = [...capturedEmailMessages()].reverse().find((candidate) => candidate.to === email);
    const match = message?.text.match(/verify-email\?token=([^\s]+)/);
    assert.ok(match);
    return decodeURIComponent(match[1]);
  }

  async function createAccount(baseUrl) {
    const email = `push-${randomUUID()}@example.test`;
    const password = "SafePassword!1234";
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: { email, password, displayName: "Push Test", role: "tradesperson" },
    });
    assert.equal(signup.response.status, 201);
    const cookie = sessionCookie(signup.response);
    assert.equal((await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: verificationToken(email) },
    })).response.status, 200);
    assert.equal((await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie,
      body: {
        role: "tradesperson",
        displayName: "Push Test",
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 35,
        tradeCodes: ["carpentry"],
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    })).response.status, 200);
    return { email, password, cookie };
  }

  async function login(baseUrl, account) {
    const result = await requestJson(baseUrl, "/api/v1/auth/login", {
      method: "POST",
      body: { email: account.email, password: account.password },
    });
    assert.equal(result.response.status, 200);
    return sessionCookie(result.response);
  }

  function subscription(endpoint) {
    return {
      endpoint,
      expirationTime: null,
      keys: {
        p256dh: "test-p256dh-key-material",
        auth: "test-auth-key-material",
      },
    };
  }

  test("web push subscriptions and durable delivery outbox", async (context) => {
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

    const account = await createAccount(baseUrl);
    const endpointOne = `https://push.example.test/${randomUUID()}`;
    const registered = await requestJson(baseUrl, "/api/v1/push-subscriptions", {
      method: "POST",
      cookie: account.cookie,
      body: subscription(endpointOne),
    });
    assert.equal(registered.response.status, 201);

    const repeated = await requestJson(baseUrl, "/api/v1/push-subscriptions", {
      method: "POST",
      cookie: account.cookie,
      body: subscription(endpointOne),
    });
    assert.equal(repeated.response.status, 201);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM push_subscriptions WHERE endpoint = $1",
      [endpointOne],
    )).rows[0].count, 1);

    const testPush = await requestJson(baseUrl, "/api/v1/push/test", {
      method: "POST",
      cookie: account.cookie,
    });
    assert.equal(testPush.response.status, 202);
    assert.equal(testPush.payload.data.queued, true);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM push_delivery_outbox WHERE notification_id = $1 AND status = 'pending'",
      [testPush.payload.data.notificationId],
    )).rows[0].count, 1);

    const secondCookie = await login(baseUrl, account);
    const endpointTwo = `https://push.example.test/${randomUUID()}`;
    assert.equal((await requestJson(baseUrl, "/api/v1/push-subscriptions", {
      method: "POST",
      cookie: secondCookie,
      body: subscription(endpointTwo),
    })).response.status, 201);
    const secondSession = await database.query(
      "SELECT id FROM auth_sessions WHERE session_id = $1",
      [rawSessionId(secondCookie)],
    );
    assert.equal(secondSession.rowCount, 1);

    const revoked = await requestJson(baseUrl, `/api/v1/sessions/${secondSession.rows[0].id}`, {
      method: "DELETE",
      cookie: account.cookie,
    });
    assert.equal(revoked.response.status, 200);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM push_subscriptions WHERE endpoint = $1",
      [endpointTwo],
    )).rows[0].count, 0);

    assert.equal((await requestJson(baseUrl, "/api/v1/auth/logout", {
      method: "POST",
      cookie: account.cookie,
    })).response.status, 200);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM push_subscriptions WHERE endpoint = $1",
      [endpointOne],
    )).rows[0].count, 0);
  });
}
