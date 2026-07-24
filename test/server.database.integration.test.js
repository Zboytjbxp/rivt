import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("database-backed authorization boundaries", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "database-integration-test-pepper";
  process.env.AUTH_RATE_LIMIT = "10000";
  process.env.S3_BUCKET = "";
  process.env.S3_ACCESS_KEY_ID = "";
  process.env.S3_SECRET_ACCESS_KEY = "";

  const { Pool } = pg;
  const database = new Pool({ connectionString: testDatabaseUrl, ssl: false });
  const { app, closeDatabase, ensureDatabaseReady } = await import("../server/index.js");

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

  async function signUp(baseUrl, role, previousSessionId = null) {
    const email = `gate-a-${randomUUID()}@example.test`;
    const result = await requestJson(baseUrl, "/api/auth/signup", {
      method: "POST",
      cookie: previousSessionId ? `rivt_session=${previousSessionId}` : undefined,
      body: {
        email,
        password: "SafePassword!1234",
        displayName: `Gate A ${role}`,
        organization: role === "contractor" ? "Gate A Builders" : "",
        location: "Jacksonville, FL",
        role,
      },
    });
    assert.equal(result.response.status, 201);
    return {
      cookie: sessionCookie(result.response),
      email,
      user: result.payload.user,
    };
  }

  test("database-backed authorization boundaries", async (context) => {
    await ensureDatabaseReady();
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    context.after(async () => {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await closeDatabase();
      await database.end();
    });

    const anonymous = await requestJson(baseUrl, "/api/app-state");
    assert.equal(anonymous.response.status, 401);

    const previousSessionId = randomUUID();
    const contractor = await signUp(baseUrl, "contractor", previousSessionId);
    const tradesperson = await signUp(baseUrl, "tradesperson");
    assert.notEqual(contractor.cookie, `rivt_session=${previousSessionId}`);
    const issuedSessionId = contractor.cookie.split("=")[1];
    const sessions = await database.query(
      "SELECT session_id, user_id FROM auth_sessions WHERE user_id = $1",
      [contractor.user.id],
    );
    assert.equal(sessions.rowCount, 1);
    assert.equal(sessions.rows[0].session_id, issuedSessionId);

    const anonymousV1 = await requestJson(baseUrl, "/api/v1/me");
    assert.equal(anonymousV1.response.status, 401);
    assert.equal(anonymousV1.payload.error.code, "AUTHENTICATION_REQUIRED");
    assert.match(anonymousV1.payload.error.requestId, /^[0-9a-f-]{36}$/);

    const canonicalAccount = await requestJson(baseUrl, "/api/v1/me", { cookie: contractor.cookie });
    assert.equal(canonicalAccount.response.status, 200);
    assert.equal(canonicalAccount.payload.data.id, contractor.user.id);
    assert.equal(canonicalAccount.payload.data.primaryRole, "contractor");
    assert.equal(canonicalAccount.payload.data.profile.visibility, "private");
    assert.equal(canonicalAccount.payload.data.profile.onboardingStatus, "draft");
    assert.deepEqual(canonicalAccount.payload.data.organizations, []);
    assert.equal(canonicalAccount.payload.meta.requestId, canonicalAccount.response.headers.get("x-request-id"));

    const contractorLegacyRead = await requestJson(baseUrl, "/api/app-state", { cookie: contractor.cookie });
    assert.equal(contractorLegacyRead.response.status, 410);
    assert.equal(contractorLegacyRead.payload.code, "LEGACY_APP_STATE_RETIRED");

    const legacyInvoiceSend = await requestJson(baseUrl, "/api/invoices/send", {
      method: "POST",
      cookie: contractor.cookie,
      body: {
        channel: "email",
        recipient: "attacker-controlled@example.com",
        subject: "Untrusted subject",
        message: "Untrusted body",
      },
    });
    assert.equal(legacyInvoiceSend.response.status, 410);
    assert.equal(legacyInvoiceSend.payload.code, "LEGACY_INVOICE_SEND_RETIRED");

    const contractorWrite = await requestJson(baseUrl, "/api/app-state", {
      method: "PUT",
      cookie: contractor.cookie,
      body: { state: { marker: "contractor-private" } },
    });
    assert.equal(contractorWrite.response.status, 410);
    assert.equal(contractorWrite.payload.code, "LEGACY_APP_STATE_RETIRED");

    const tradespersonWrite = await requestJson(baseUrl, "/api/app-state", {
      method: "PUT",
      cookie: tradesperson.cookie,
      body: { state: { marker: "tradesperson-private" } },
    });
    assert.equal(tradespersonWrite.response.status, 410);
    assert.equal(tradespersonWrite.payload.code, "LEGACY_APP_STATE_RETIRED");

    const legacyEvent = await requestJson(baseUrl, "/api/events", {
      method: "POST",
      cookie: contractor.cookie,
      body: { type: "activity", payload: { marker: "legacy-event" } },
    });
    assert.equal(legacyEvent.response.status, 410);
    assert.equal(legacyEvent.payload.code, "LEGACY_EVENTS_RETIRED");

    const legacyPaymentExport = await requestJson(baseUrl, "/api/payments/export.csv", { cookie: contractor.cookie });
    assert.equal(legacyPaymentExport.response.status, 410);
    assert.equal(legacyPaymentExport.payload.code, "LEGACY_PAYMENT_EXPORT_RETIRED");

    const legacyRows = await database.query(
      "SELECT count(*)::int AS count FROM app_state WHERE id = ANY($1::text[])",
      [[contractor.user.id, tradesperson.user.id]],
    );
    assert.equal(legacyRows.rows[0].count, 0);

    const roleChange = await requestJson(baseUrl, "/api/auth/profile", {
      method: "PATCH",
      cookie: contractor.cookie,
      body: {
        displayName: contractor.user.display_name,
        location: contractor.user.location,
        organization: contractor.user.organization,
        role: "tradesperson",
      },
    });
    assert.equal(roleChange.response.status, 410);
    assert.match(roleChange.payload.error, /retired/i);
  });
}
