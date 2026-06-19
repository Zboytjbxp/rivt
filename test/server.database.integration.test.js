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
    const createdUserIds = [];

    context.after(async () => {
      if (createdUserIds.length) {
        await database.query("DELETE FROM app_events WHERE session_id = ANY($1::text[])", [createdUserIds]);
        await database.query("DELETE FROM uploads WHERE session_id = ANY($1::text[])", [createdUserIds]);
        await database.query("DELETE FROM app_state WHERE id = ANY($1::text[])", [createdUserIds]);
        await database.query("DELETE FROM accounts WHERE id = ANY($1::uuid[])", [createdUserIds]);
        await database.query("DELETE FROM auth_users WHERE id = ANY($1::uuid[])", [createdUserIds]);
      }
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await closeDatabase();
      await database.end();
    });

    const anonymous = await requestJson(baseUrl, "/api/app-state");
    assert.equal(anonymous.response.status, 401);

    const previousSessionId = randomUUID();
    const contractor = await signUp(baseUrl, "contractor", previousSessionId);
    const tradesperson = await signUp(baseUrl, "tradesperson");
    createdUserIds.push(contractor.user.id, tradesperson.user.id);

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

    const contractorWrite = await requestJson(baseUrl, "/api/app-state", {
      method: "PUT",
      cookie: contractor.cookie,
      body: { state: { marker: "contractor-private" } },
    });
    assert.equal(contractorWrite.response.status, 200);

    const tradespersonWrite = await requestJson(baseUrl, "/api/app-state", {
      method: "PUT",
      cookie: tradesperson.cookie,
      body: { state: { marker: "tradesperson-private" } },
    });
    assert.equal(tradespersonWrite.response.status, 200);

    const contractorRead = await requestJson(baseUrl, "/api/app-state", { cookie: contractor.cookie });
    const tradespersonRead = await requestJson(baseUrl, "/api/app-state", { cookie: tradesperson.cookie });
    assert.equal(contractorRead.payload.state.marker, "contractor-private");
    assert.equal(tradespersonRead.payload.state.marker, "tradesperson-private");

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
    assert.equal(roleChange.response.status, 409);
    assert.equal(roleChange.payload.error, "Account type cannot be changed after onboarding.");
  });
}
