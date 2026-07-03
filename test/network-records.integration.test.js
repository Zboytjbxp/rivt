import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("network records are server-owned", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "network-records-test-pepper";
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
        tradeCodes: ["carpentry"],
        organizationName: role === "contractor" ? `${label} LLC` : undefined,
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(onboarded.response.status, 200);
    return account;
  }

  test("network records are server-owned", async (context) => {
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

    const owner = await createAccount(baseUrl, "contractor", "Network Records Owner");
    const other = await createAccount(baseUrl, "contractor", "Network Records Other");

    const anonList = await requestJson(baseUrl, "/api/v1/network-records?type=crew_member");
    assert.equal(anonList.response.status, 401);

    const missingKey = await requestJson(baseUrl, "/api/v1/network-records", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        recordType: "crew_member",
        localId: "crew-one",
        title: "Luis Hernandez",
        status: "available",
        recordDate: "2026-07-03",
        payload: { id: "crew-one", name: "Luis Hernandez", type: "crew", trade: "Finish carpentry", availability: "available" },
      },
    });
    assert.equal(missingKey.response.status, 400);
    assert.equal(missingKey.payload.error.code, "IDEMPOTENCY_KEY_REQUIRED");

    const idempotencyKey = randomUUID();
    const created = await requestJson(baseUrl, "/api/v1/network-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey,
      body: {
        recordType: "crew_member",
        localId: "crew-one",
        title: "Luis Hernandez",
        status: "available",
        recordDate: "2026-07-03",
        payload: { id: "crew-one", name: "Luis Hernandez", type: "crew", trade: "Finish carpentry", availability: "available" },
      },
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.data.record.recordType, "crew_member");
    assert.equal(created.payload.data.record.localId, "crew-one");
    assert.equal(created.payload.data.record.payload.name, "Luis Hernandez");

    const replay = await requestJson(baseUrl, "/api/v1/network-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey,
      body: {
        recordType: "crew_member",
        localId: "crew-one",
        title: "Luis Hernandez",
        status: "available",
        recordDate: "2026-07-03",
        payload: { id: "crew-one", name: "Luis Hernandez", type: "crew", trade: "Finish carpentry", availability: "available" },
      },
    });
    assert.equal(replay.response.status, 200);
    assert.equal(replay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(replay.payload.data.record.id, created.payload.data.record.id);

    const updated = await requestJson(baseUrl, "/api/v1/network-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "crew_member",
        localId: "crew-one",
        title: "Luis Hernandez",
        status: "busy",
        recordDate: "2026-07-03",
        payload: { id: "crew-one", name: "Luis Hernandez", type: "crew", trade: "Finish carpentry", availability: "busy" },
      },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.record.id, created.payload.data.record.id);
    assert.equal(updated.payload.data.record.status, "busy");

    const list = await requestJson(baseUrl, "/api/v1/network-records?type=crew_member", { cookie: owner.cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.payload.data.records.length, 1);
    assert.equal(list.payload.data.records[0].localId, "crew-one");

    const isolated = await requestJson(baseUrl, "/api/v1/network-records?type=crew_member", { cookie: other.cookie });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.data.records.length, 0);

    const invalidType = await requestJson(baseUrl, "/api/v1/network-records?type=not-real", { cookie: owner.cookie });
    assert.equal(invalidType.response.status, 422);

    const invalidLocalId = await requestJson(baseUrl, "/api/v1/network-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "crew_member",
        localId: "bad local id!",
        title: "Bad local id",
        status: "active",
        payload: {},
      },
    });
    assert.equal(invalidLocalId.response.status, 422);

    const deleted = await requestJson(baseUrl, "/api/v1/network-records/crew_member/crew-one", {
      method: "DELETE",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.payload.data.deleted, true);

    const afterDelete = await requestJson(baseUrl, "/api/v1/network-records?type=crew_member", { cookie: owner.cookie });
    assert.equal(afterDelete.response.status, 200);
    assert.equal(afterDelete.payload.data.records.length, 0);
  });
}
