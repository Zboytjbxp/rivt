import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("professional identity is account-backed and privacy-safe", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "professional-profile-test-pepper";
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
    return { response, payload: await response.json() };
  }

  function verificationToken(email) {
    const message = [...capturedEmailMessages()].reverse().find((candidate) => candidate.to === email);
    const match = message?.text.match(/verify-email\?token=([^\s]+)/);
    assert.ok(match);
    return decodeURIComponent(match[1]);
  }

  async function createAccount(baseUrl, label, role = "tradesperson") {
    const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}@example.test`;
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: { email, password: "SafePassword!1234", displayName: label, role },
    });
    assert.equal(signup.response.status, 201);
    const cookie = sessionCookie(signup.response);
    const verified = await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: verificationToken(email) },
    });
    assert.equal(verified.response.status, 200);
    const onboarded = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie,
      body: {
        role,
        displayName: label,
        organizationName: role === "contractor" ? `${label} LLC` : "",
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 35,
        tradeCodes: ["electrical"],
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(onboarded.response.status, 200);
    return { accountId: onboarded.payload.data.account.account.id, cookie, email };
  }

  test("professional identity is account-backed and privacy-safe", async (context) => {
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

    const owner = await createAccount(baseUrl, "Professional Owner");
    const viewer = await createAccount(baseUrl, "Professional Viewer", "contractor");
    const published = await requestJson(baseUrl, "/api/v1/profile/publish", {
      method: "POST",
      cookie: owner.cookie,
    });
    assert.equal(published.response.status, 200);

    const unauthenticated = await requestJson(baseUrl, "/api/v1/profile/professional");
    assert.equal(unauthenticated.response.status, 401);

    const privateCredential = await requestJson(baseUrl, "/api/v1/profile/credentials", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        kind: "training",
        name: "Private lift training",
        issuer: "Owner records",
        credentialNumber: "",
        issueDate: "2026-07-01",
        expiryDate: null,
        notes: "Private evidence",
        visibility: "private",
      },
    });
    assert.equal(privateCredential.response.status, 201);
    assert.equal(privateCredential.payload.data.credential.version, 1);

    const sharedCredential = await requestJson(baseUrl, "/api/v1/profile/credentials", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        kind: "license",
        name: "Florida electrical contractor license",
        issuer: "DBPR",
        credentialNumber: "EC-TEST",
        issueDate: "2026-07-01",
        expiryDate: "2027-07-01",
        notes: "",
        visibility: "network",
      },
    });
    assert.equal(sharedCredential.response.status, 201);
    const credential = sharedCredential.payload.data.credential;

    const availability = await requestJson(baseUrl, "/api/v1/profile/availability-windows", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        availability: "limited",
        startsOn: "2026-07-27",
        endsOn: "2026-08-31",
        notes: "Service calls after 3 PM",
        visibility: "network",
      },
    });
    assert.equal(availability.response.status, 201);

    const networkView = await requestJson(baseUrl, `/api/v1/profiles/${owner.accountId}`, {
      cookie: viewer.cookie,
    });
    assert.equal(networkView.response.status, 200);
    assert.deepEqual(networkView.payload.data.profile.credentials.map((item) => item.name), [
      "Florida electrical contractor license",
    ]);
    assert.equal(networkView.payload.data.profile.credentials[0].evidenceUploadId, null);
    assert.equal(networkView.payload.data.profile.credentials[0].evidenceUrl, null);
    assert.equal(networkView.payload.data.profile.availabilityWindows.length, 1);
    assert.equal(JSON.stringify(networkView.payload).includes("Private lift training"), false);
    assert.equal(JSON.stringify(networkView.payload).includes("private@example"), false);

    const updated = await requestJson(baseUrl, `/api/v1/profile/credentials/${credential.id}`, {
      method: "PATCH",
      cookie: owner.cookie,
      body: {
        kind: credential.kind,
        name: credential.name,
        issuer: credential.issuer,
        credentialNumber: credential.credentialNumber,
        issueDate: credential.issueDate,
        expiryDate: credential.expiryDate,
        notes: "Renewal is current",
        visibility: "network",
        expectedVersion: credential.version,
      },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.credential.version, 2);

    const staleUpdate = await requestJson(baseUrl, `/api/v1/profile/credentials/${credential.id}`, {
      method: "PATCH",
      cookie: owner.cookie,
      body: {
        kind: credential.kind,
        name: credential.name,
        issuer: credential.issuer,
        credentialNumber: credential.credentialNumber,
        issueDate: credential.issueDate,
        expiryDate: credential.expiryDate,
        notes: "Stale overwrite",
        visibility: "network",
        expectedVersion: 1,
      },
    });
    assert.equal(staleUpdate.response.status, 409);
    assert.equal(staleUpdate.payload.error.code, "PROFILE_RECORD_CONFLICT");

    const archived = await requestJson(baseUrl, `/api/v1/profile/credentials/${credential.id}`, {
      method: "DELETE",
      cookie: owner.cookie,
      body: { expectedVersion: 2 },
    });
    assert.equal(archived.response.status, 200);

    const hiddenAfterArchive = await requestJson(baseUrl, `/api/v1/profiles/${owner.accountId}`, {
      cookie: viewer.cookie,
    });
    assert.equal(hiddenAfterArchive.payload.data.profile.credentials.length, 0);

    const ownerView = await requestJson(baseUrl, "/api/v1/profile/professional", {
      cookie: owner.cookie,
    });
    assert.equal(ownerView.response.status, 200);
    const archivedRecord = ownerView.payload.data.professionalProfile.credentials.find((item) => item.id === credential.id);
    assert.equal(archivedRecord.status, "archived");
    assert.ok(ownerView.payload.data.professionalProfile.events.length >= 4);

    const restored = await requestJson(baseUrl, `/api/v1/profile/credentials/${credential.id}/restore`, {
      method: "POST",
      cookie: owner.cookie,
      body: { expectedVersion: archivedRecord.version },
    });
    assert.equal(restored.response.status, 200);

    const otherOwnerAttempt = await requestJson(baseUrl, `/api/v1/profile/credentials/${credential.id}`, {
      method: "DELETE",
      cookie: viewer.cookie,
      body: { expectedVersion: archivedRecord.version + 1 },
    });
    assert.equal(otherOwnerAttempt.response.status, 404);
  });
}
