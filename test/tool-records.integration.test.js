import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("tool records are server-owned", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "tool-records-test-pepper";
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
    return account;
  }

  test("tool records are server-owned", async (context) => {
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

    const owner = await createAccount(baseUrl, "contractor", "Tool Records Owner");
    const other = await createAccount(baseUrl, "contractor", "Tool Records Other");

    const anonList = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record");
    assert.equal(anonList.response.status, 401);

    const missingKey = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        recordType: "payment_record",
        localId: "invoice-one",
        title: "Panel trim invoice",
        status: "invoiced",
        recordDate: "2026-07-03",
        amountCents: 125000,
        payload: { id: "invoice-one", jobId: "", jobTitle: "Panel trim invoice", invoiceDate: "2026-07-03", invoiceAmount: 1250, status: "invoiced" },
      },
    });
    assert.equal(missingKey.response.status, 400);
    assert.equal(missingKey.payload.error.code, "IDEMPOTENCY_KEY_REQUIRED");

    const idempotencyKey = randomUUID();
    const created = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey,
      body: {
        recordType: "payment_record",
        localId: "invoice-one",
        title: "Panel trim invoice",
        status: "invoiced",
        recordDate: "2026-07-03",
        amountCents: 125000,
        payload: { id: "invoice-one", jobId: "", jobTitle: "Panel trim invoice", invoiceDate: "2026-07-03", invoiceAmount: 1250, status: "invoiced" },
      },
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.data.record.recordType, "payment_record");
    assert.equal(created.payload.data.record.localId, "invoice-one");
    assert.equal(created.payload.data.record.amountCents, 125000);
    assert.equal(created.payload.data.record.payload.jobTitle, "Panel trim invoice");

    const replay = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey,
      body: {
        recordType: "payment_record",
        localId: "invoice-one",
        title: "Panel trim invoice",
        status: "invoiced",
        recordDate: "2026-07-03",
        amountCents: 125000,
        payload: { id: "invoice-one", jobId: "", jobTitle: "Panel trim invoice", invoiceDate: "2026-07-03", invoiceAmount: 1250, status: "invoiced" },
      },
    });
    assert.equal(replay.response.status, 200);
    assert.equal(replay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(replay.payload.data.record.id, created.payload.data.record.id);

    const updated = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "payment_record",
        localId: "invoice-one",
        title: "Panel trim invoice",
        status: "paid",
        recordDate: "2026-07-03",
        amountCents: 125000,
        payload: {
          id: "invoice-one",
          jobId: "",
          jobTitle: "Panel trim invoice",
          invoiceDate: "2026-07-03",
          invoiceAmount: 1250,
          paidDate: "2026-07-03",
          paidAmount: 1250,
          status: "paid",
        },
      },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.record.id, created.payload.data.record.id);
    assert.equal(updated.payload.data.record.status, "paid");

    const list = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record", { cookie: owner.cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.payload.data.records.length, 1);
    assert.equal(list.payload.data.records[0].localId, "invoice-one");

    const isolated = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record", { cookie: other.cookie });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.data.records.length, 0);

    const projectCreated = await requestJson(baseUrl, "/api/v1/standalone-projects", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        title: "Kitchen refresh",
        clientName: "Jordan Client",
        locationText: "Jacksonville, FL",
        tradeCode: "carpentry",
      },
    });
    assert.equal(projectCreated.response.status, 201);
    const standaloneProjectId = projectCreated.payload.data.project.id;
    assert.equal(projectCreated.payload.data.project.title, "Kitchen refresh");

    const ownerProjects = await requestJson(baseUrl, "/api/v1/standalone-projects", { cookie: owner.cookie });
    assert.equal(ownerProjects.response.status, 200);
    assert.equal(ownerProjects.payload.data.projects.some((project) => project.id === standaloneProjectId), true);

    const otherProjects = await requestJson(baseUrl, "/api/v1/standalone-projects", { cookie: other.cookie });
    assert.equal(otherProjects.response.status, 200);
    assert.equal(otherProjects.payload.data.projects.some((project) => project.id === standaloneProjectId), false);

    const otherCannotEdit = await requestJson(baseUrl, `/api/v1/standalone-projects/${standaloneProjectId}`, {
      method: "PATCH",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
      body: { title: "Taken over" },
    });
    assert.equal(otherCannotEdit.response.status, 404);

    const estimateCreated = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: `estimate:standalone:${standaloneProjectId}`,
        title: "Kitchen refresh estimate",
        status: "draft",
        amountCents: 248500,
        payload: { laborHours: 24, materialCost: 900 },
        standaloneProjectId,
      },
    });
    assert.equal(estimateCreated.response.status, 200);
    assert.equal(estimateCreated.payload.data.record.standaloneProjectId, standaloneProjectId);

    const otherCannotAttach = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: `estimate:standalone:${standaloneProjectId}`,
        title: "Unauthorized estimate",
        status: "draft",
        amountCents: 100,
        payload: {},
        standaloneProjectId,
      },
    });
    assert.equal(otherCannotAttach.response.status, 403);
    assert.equal(otherCannotAttach.payload.error.code, "STANDALONE_PROJECT_ACCESS_DENIED");

    const ambiguousContext = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: "estimate:ambiguous",
        title: "Ambiguous estimate",
        status: "draft",
        payload: {},
        standaloneProjectId,
        activeWorkId: randomUUID(),
      },
    });
    assert.equal(ambiguousContext.response.status, 422);

    const projectAlbum = await requestJson(baseUrl, "/api/v1/albums", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Kitchen refresh", standaloneProjectId },
    });
    assert.equal(projectAlbum.response.status, 201);
    assert.equal(projectAlbum.payload.data.album.standaloneProjectId, standaloneProjectId);

    const otherCannotCreateAlbum = await requestJson(baseUrl, "/api/v1/albums", {
      method: "POST",
      cookie: other.cookie,
      body: { name: "Unauthorized album", standaloneProjectId },
    });
    assert.equal(otherCannotCreateAlbum.response.status, 403);
    assert.equal(otherCannotCreateAlbum.payload.error.code, "STANDALONE_PROJECT_ACCESS_DENIED");

    const invalidType = await requestJson(baseUrl, "/api/v1/tool-records?type=not-real", { cookie: owner.cookie });
    assert.equal(invalidType.response.status, 422);

    const invalidLocalId = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "payment_record",
        localId: "bad local id!",
        title: "Bad local id",
        status: "invoiced",
        payload: {},
      },
    });
    assert.equal(invalidLocalId.response.status, 422);

    const deleted = await requestJson(baseUrl, "/api/v1/tool-records/payment_record/invoice-one", {
      method: "DELETE",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.payload.data.deleted, true);

    const afterDelete = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record", { cookie: owner.cookie });
    assert.equal(afterDelete.response.status, 200);
    assert.equal(afterDelete.payload.data.records.length, 0);
  });
}
