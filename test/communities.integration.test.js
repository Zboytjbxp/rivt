import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("communities are server-owned", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "communities-test-pepper";
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
    return account;
  }

  test("communities are server-owned", async (context) => {
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

    const member = await createAccount(baseUrl, "tradesperson", "Community Member");

    // Anonymous access is rejected.
    const anon = await requestJson(baseUrl, "/api/v1/communities");
    assert.equal(anon.response.status, 401);

    // Seeded communities are listed, not yet joined.
    const list = await requestJson(baseUrl, "/api/v1/communities", { cookie: member.cookie });
    assert.equal(list.response.status, 200);
    const carpentry = list.payload.data.communities.find((c) => c.slug === "carpentry-talk");
    assert.ok(carpentry, "seeded carpentry-talk community exists");
    assert.equal(carpentry.joined, false);
    assert.ok(carpentry.memberCount >= 124000);
    const baseline = carpentry.memberCount;

    // Join increments the member count and flips joined.
    const joined = await requestJson(baseUrl, "/api/v1/communities/carpentry-talk/join", {
      method: "POST",
      cookie: member.cookie,
    });
    assert.equal(joined.response.status, 200);
    assert.equal(joined.payload.data.joined, true);

    // Joining again is idempotent (no double count).
    await requestJson(baseUrl, "/api/v1/communities/carpentry-talk/join", { method: "POST", cookie: member.cookie });

    const afterJoin = await requestJson(baseUrl, "/api/v1/communities", { cookie: member.cookie });
    const carpentryJoined = afterJoin.payload.data.communities.find((c) => c.slug === "carpentry-talk");
    assert.equal(carpentryJoined.joined, true);
    assert.equal(carpentryJoined.memberCount, baseline + 1);

    // Leaving flips joined back and decrements.
    const left = await requestJson(baseUrl, "/api/v1/communities/carpentry-talk/join", {
      method: "DELETE",
      cookie: member.cookie,
    });
    assert.equal(left.response.status, 200);
    assert.equal(left.payload.data.joined, false);
    const afterLeave = await requestJson(baseUrl, "/api/v1/communities", { cookie: member.cookie });
    const carpentryLeft = afterLeave.payload.data.communities.find((c) => c.slug === "carpentry-talk");
    assert.equal(carpentryLeft.joined, false);
    assert.equal(carpentryLeft.memberCount, baseline);

    // Unknown community 404s.
    const missing = await requestJson(baseUrl, "/api/v1/communities/not-a-real-community/join", {
      method: "POST",
      cookie: member.cookie,
    });
    assert.equal(missing.response.status, 404);
  });
}
