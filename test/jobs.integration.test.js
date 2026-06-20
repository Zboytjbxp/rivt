import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("canonical job lifecycle and discovery", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "jobs-integration-test-pepper";
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
    const email = `${label}-${randomUUID()}@example.test`;
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: { email, password: "SafePassword!1234", displayName: label, role },
    });
    assert.equal(signup.response.status, 201);
    const account = { email, cookie: sessionCookie(signup.response) };
    assert.equal((await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: tokenFor(email) },
    })).response.status, 200);
    const onboarding = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
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
    assert.equal(onboarding.response.status, 200);
    const me = await requestJson(baseUrl, "/api/v1/me", { cookie: account.cookie });
    account.id = me.payload.data.id;
    account.organizationId = me.payload.data.organizations[0]?.id;
    return account;
  }

  test("canonical job lifecycle and discovery", async (context) => {
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

    const contractor = await createAccount(baseUrl, "contractor", "Job Owner");
    const otherContractor = await createAccount(baseUrl, "contractor", "Other Contractor");
    const tradesperson = await createAccount(baseUrl, "tradesperson", "Field Electrician");
    const createBody = {
      organizationId: contractor.organizationId,
      title: "Commercial panel rough-in",
      tradeCode: "electrical",
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
    };
    const createKey = `create-${randomUUID()}`;
    const created = await requestJson(baseUrl, "/api/v1/jobs", {
      method: "POST", cookie: contractor.cookie, idempotencyKey: createKey, body: createBody,
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.data.job.status, "draft");
    assert.ok(created.payload.data.job.privateLocation);
    const jobId = created.payload.data.job.id;

    const duplicateCreate = await requestJson(baseUrl, "/api/v1/jobs", {
      method: "POST", cookie: contractor.cookie, idempotencyKey: createKey, body: createBody,
    });
    assert.equal(duplicateCreate.payload.data.job.id, jobId);
    assert.equal(duplicateCreate.response.headers.get("idempotent-replayed"), "true");
    assert.equal((await database.query("SELECT count(*)::int AS count FROM jobs WHERE id = $1", [jobId])).rows[0].count, 1);

    const incompletePublish = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/publish`, {
      method: "POST", cookie: contractor.cookie, idempotencyKey: `publish-incomplete-${randomUUID()}`,
      body: { expectedVersion: 1, consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(incompletePublish.response.status, 422);
    assert.equal(incompletePublish.payload.error.code, "JOB_NOT_READY");

    const updated = await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, {
      method: "PATCH", cookie: contractor.cookie, idempotencyKey: `update-${randomUUID()}`,
      body: {
        expectedVersion: 1,
        summary: "Support a commercial panel rough-in in downtown Jacksonville.",
        scopeDescription: "Install feeders, terminate circuits, label the panel, and leave the work inspection ready.",
        difficulty: "advanced",
        workType: "side_work",
        budgetCents: 125000,
        durationHours: 8,
        insuranceRequired: true,
        tools: ["Multimeter", "Conduit bender"],
        materials: ["Provided by contractor"],
        deliverables: ["Inspection-ready panel", "Circuit schedule"],
        publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
        privateLocation: {
          addressLine1: "100 Private Test Street",
          addressLine2: "Suite 200",
          city: "Jacksonville",
          region: "FL",
          postalCode: "32202",
          countryCode: "US",
          accessNotes: "Use the south service entrance.",
        },
      },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.job.version, 2);

    const stale = await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, {
      method: "PATCH", cookie: contractor.cookie, idempotencyKey: `stale-${randomUUID()}`,
      body: { expectedVersion: 1, title: "Stale update" },
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.payload.error.code, "JOB_VERSION_CONFLICT");

    const foreignMutation = await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, {
      method: "PATCH", cookie: otherContractor.cookie, idempotencyKey: `foreign-${randomUUID()}`,
      body: { expectedVersion: 2, title: "Unauthorized update" },
    });
    assert.equal(foreignMutation.response.status, 403);

    const publishKey = `publish-${randomUUID()}`;
    const published = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/publish`, {
      method: "POST", cookie: contractor.cookie, idempotencyKey: publishKey,
      body: { expectedVersion: 2, consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.payload.data.job.status, "open");
    const publishedVersion = published.payload.data.job.version;
    const duplicatePublish = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/publish`, {
      method: "POST", cookie: contractor.cookie, idempotencyKey: publishKey,
      body: { expectedVersion: 2, consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(duplicatePublish.payload.data.job.id, jobId);
    assert.equal(duplicatePublish.response.headers.get("idempotent-replayed"), "true");
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM job_status_events WHERE job_id = $1 AND event_type = 'published'",
      [jobId],
    )).rows[0].count, 1);

    const discovery = await requestJson(baseUrl, "/api/v1/jobs?trade=electrical&region=FL", { cookie: tradesperson.cookie });
    assert.equal(discovery.response.status, 200);
    const discovered = discovery.payload.data.jobs.find((job) => job.id === jobId);
    assert.ok(discovered);
    assert.equal(discovered.matchScore, 100);
    assert.equal("privateLocation" in discovered, false);
    assert.equal(JSON.stringify(discovered).includes("Private Test Street"), false);

    const publicDetail = await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, { cookie: tradesperson.cookie });
    assert.equal(publicDetail.response.status, 200);
    assert.equal("privateLocation" in publicDetail.payload.data.job, false);
    const ownerDetail = await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, { cookie: contractor.cookie });
    assert.equal(ownerDetail.payload.data.job.privateLocation.addressLine1, "100 Private Test Street");
    assert.ok(ownerDetail.payload.data.job.events.length >= 3);

    const paused = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/pause`, {
      method: "POST", cookie: contractor.cookie, idempotencyKey: `pause-${randomUUID()}`,
      body: { expectedVersion: publishedVersion, reason: "Schedule changed" },
    });
    assert.equal(paused.payload.data.job.status, "paused");
    assert.equal((await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, { cookie: tradesperson.cookie })).response.status, 404);

    const resumed = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/resume`, {
      method: "POST", cookie: contractor.cookie, idempotencyKey: `resume-${randomUUID()}`,
      body: { expectedVersion: paused.payload.data.job.version, reason: "Schedule confirmed" },
    });
    assert.equal(resumed.payload.data.job.status, "open");
    assert.equal((await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, { cookie: tradesperson.cookie })).response.status, 200);

    const closed = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/close`, {
      method: "POST", cookie: contractor.cookie, idempotencyKey: `close-${randomUUID()}`,
      body: { expectedVersion: resumed.payload.data.job.version, reason: "Crew filled offline" },
    });
    assert.equal(closed.payload.data.job.status, "closed");
    assert.equal((await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, { cookie: tradesperson.cookie })).response.status, 404);
    const ownerJobs = await requestJson(baseUrl, "/api/v1/jobs?status=closed", { cookie: contractor.cookie });
    assert.ok(ownerJobs.payload.data.jobs.some((job) => job.id === jobId));
  });
}
