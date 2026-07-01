import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("shop talk posts are server-owned", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "shop-talk-posts-test-pepper";
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

  test("shop talk posts are server-owned", async (context) => {
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

    const author = await createAccount(baseUrl, "tradesperson", "Shop Talk Author");

    // Anonymous access is rejected.
    const anonList = await requestJson(baseUrl, "/api/v1/shop-talk/posts");
    assert.equal(anonList.response.status, 401);
    const anonCreate = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      body: { title: "Nope", trade: "Electrical" },
    });
    assert.equal(anonCreate.response.status, 401);

    // Creating requires an idempotency key.
    const missingKey = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      cookie: author.cookie,
      body: { title: "Best conduit bender?", trade: "Electrical", flair: "Question" },
    });
    assert.equal(missingKey.response.status, 400);
    assert.equal(missingKey.payload.error.code, "IDEMPOTENCY_KEY_REQUIRED");

    // Create a post.
    const key = randomUUID();
    const created = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: key,
      body: {
        title: "Best way to bend offsets fast?",
        body: "Looking for a reliable method on 3/4 EMT.",
        trade: "Electrical",
        flair: "Question",
        postType: "question",
      },
    });
    assert.equal(created.response.status, 201);
    const post = created.payload.data.post;
    assert.ok(post.id);
    assert.equal(post.title, "Best way to bend offsets fast?");
    assert.equal(post.trade, "Electrical");
    assert.equal(post.flair, "Question");
    assert.equal(post.type, "question");
    assert.equal(post.author, "Shop Talk Author");
    assert.equal(post.status, "Open");

    // Same idempotency key replays the same result.
    const replay = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: key,
      body: {
        title: "Best way to bend offsets fast?",
        body: "Looking for a reliable method on 3/4 EMT.",
        trade: "Electrical",
        flair: "Question",
        postType: "question",
      },
    });
    assert.equal(replay.response.status, 201);
    assert.equal(replay.payload.data.post.id, post.id);
    assert.equal(replay.response.headers.get("idempotent-replayed"), "true");

    // The post shows up in the list.
    const list = await requestJson(baseUrl, "/api/v1/shop-talk/posts", { cookie: author.cookie });
    assert.equal(list.response.status, 200);
    assert.ok(Array.isArray(list.payload.data.posts));
    assert.ok(list.payload.data.posts.some((entry) => entry.id === post.id));

    // Validation rejects an empty title.
    const invalid = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: randomUUID(),
      body: { title: "", trade: "Electrical" },
    });
    assert.equal(invalid.response.status, 422);
  });
}
