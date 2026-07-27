import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("public Jobs and Shop Talk publication boundary", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "public-discovery-test-pepper";
  process.env.REQUIRE_PILOT_INVITE = "false";
  process.env.AUTH_RATE_LIMIT = "10000";
  process.env.PUBLIC_DISCOVERY_RATE_LIMIT = "10000";
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

  async function request(baseUrl, pathname, { body, cookie, idempotencyKey, method = "GET" } = {}) {
    const headers = { Origin: "https://rivt.pro" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return fetch(`${baseUrl}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function requestJson(baseUrl, pathname, options) {
    const response = await request(baseUrl, pathname, options);
    return { response, payload: await response.json() };
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
    const cookie = sessionCookie(signup.response);
    assert.equal((await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: tokenFor(email) },
    })).response.status, 200);
    assert.equal((await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie,
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
    })).response.status, 200);
    const me = await requestJson(baseUrl, "/api/v1/me", { cookie });
    return {
      cookie,
      accountId: me.payload.data.id,
      organizationId: me.payload.data.organizations[0]?.id,
    };
  }

  test("public Jobs and Shop Talk publication boundary", async (context) => {
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

    const contractor = await createAccount(baseUrl, "contractor", "Public Job Owner");
    const author = await createAccount(baseUrl, "tradesperson", "Public Shop Author");
    const answerer = await createAccount(baseUrl, "tradesperson", "Public Shop Answerer");

    const jobDraft = await requestJson(baseUrl, "/api/v1/jobs", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: randomUUID(),
      body: {
        organizationId: contractor.organizationId,
        title: "Commercial panel rough-in",
        tradeCode: "electrical",
        summary: "Complete a commercial service panel rough-in in Jacksonville.",
        scopeDescription: "Install raceway and conductors to the approved drawings and leave the work inspection-ready.",
        difficulty: "advanced",
        workType: "multi_day",
        budgetCents: 240000,
        budgetUnit: "fixed",
        compensationType: "fixed",
        durationHours: 24,
        preferredStartDate: "2026-08-10",
        applicationDeadline: null,
        insuranceRequired: true,
        tools: ["Conduit bender"],
        materials: ["Materials provided"],
        deliverables: ["Inspection-ready installation"],
        certificationCodes: [],
        publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
        privateLocation: {
          addressLine1: "123 Private Street",
          addressLine2: "",
          city: "Jacksonville",
          region: "FL",
          postalCode: "32202",
          countryCode: "US",
          accessNotes: "Call the superintendent at the gate.",
        },
        publicWebVisibility: "members",
      },
    });
    assert.equal(jobDraft.response.status, 201);
    const jobId = jobDraft.payload.data.job.id;
    const jobPublished = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/publish`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: randomUUID(),
      body: {
        expectedVersion: jobDraft.payload.data.job.version,
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(jobPublished.response.status, 200);
    assert.equal((await requestJson(baseUrl, `/api/public/jobs/${jobId}`)).response.status, 404);

    const publicJobUpdate = await requestJson(baseUrl, `/api/v1/jobs/${jobId}`, {
      method: "PATCH",
      cookie: contractor.cookie,
      idempotencyKey: randomUUID(),
      body: {
        expectedVersion: jobPublished.payload.data.job.version,
        publicWebVisibility: "public",
      },
    });
    assert.equal(publicJobUpdate.response.status, 200);
    assert.equal(publicJobUpdate.payload.data.job.publicWebVisibility, "public");
    const publicJob = await requestJson(baseUrl, `/api/public/jobs/${jobId}`);
    assert.equal(publicJob.response.status, 200);
    assert.equal(publicJob.payload.data.job.location.city, "Jacksonville");
    assert.equal("privateLocation" in publicJob.payload.data.job, false);
    assert.doesNotMatch(JSON.stringify(publicJob.payload), /123 Private|32202|superintendent/);

    const privatePost = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: randomUUID(),
      body: {
        title: "Best sequence for checking a disconnect?",
        body: "What do you verify before opening the enclosure?",
        trade: "Electrical",
        flair: "Question",
        postType: "question",
        communitySlug: "electrical-talk",
        webVisibility: "members",
      },
    });
    assert.equal(privatePost.response.status, 201);
    const postId = privatePost.payload.data.post.id;
    assert.equal((await requestJson(baseUrl, `/api/public/shop-talk/${postId}`)).response.status, 404);

    const madePublic = await requestJson(baseUrl, `/api/v1/shop-talk/posts/${postId}/visibility`, {
      method: "PATCH",
      cookie: author.cookie,
      idempotencyKey: randomUUID(),
      body: { webVisibility: "public" },
    });
    assert.equal(madePublic.response.status, 200);
    assert.equal(madePublic.payload.data.post.webVisibility, "public");

    const unacknowledgedAnswer = await requestJson(baseUrl, `/api/v1/shop-talk/posts/${postId}/answers`, {
      method: "POST",
      cookie: answerer.cookie,
      idempotencyKey: randomUUID(),
      body: { body: "Verify both load-side legs first." },
    });
    assert.equal(unacknowledgedAnswer.response.status, 422);
    assert.equal(unacknowledgedAnswer.payload.error.code, "SHOP_TALK_PUBLIC_ANSWER_ACKNOWLEDGEMENT_REQUIRED");

    const acknowledgedAnswer = await requestJson(baseUrl, `/api/v1/shop-talk/posts/${postId}/answers`, {
      method: "POST",
      cookie: answerer.cookie,
      idempotencyKey: randomUUID(),
      body: {
        body: "Verify both load-side legs first.",
        publicVisibilityAcknowledged: true,
      },
    });
    assert.equal(acknowledgedAnswer.response.status, 201);
    const publicPost = await requestJson(baseUrl, `/api/public/shop-talk/${postId}`);
    assert.equal(publicPost.response.status, 200);
    assert.equal(publicPost.payload.data.post.answers.length, 1);
    assert.equal(publicPost.payload.data.post.answers[0].body, "Verify both load-side legs first.");

    const unsafePublicPost = await requestJson(baseUrl, "/api/v1/shop-talk/posts", {
      method: "POST",
      cookie: author.cookie,
      idempotencyKey: randomUUID(),
      body: {
        title: "Call me at 904-555-0123",
        body: "Need advice.",
        trade: "Electrical",
        communitySlug: "electrical-talk",
        webVisibility: "public",
      },
    });
    assert.equal(unsafePublicPost.response.status, 422);
    assert.equal(unsafePublicPost.payload.error.code, "PUBLIC_CONTENT_PRIVATE_DETAILS");

    const jobHtml = await request(baseUrl, `/jobs/${jobId}`);
    assert.equal(jobHtml.status, 200);
    const jobHtmlText = await jobHtml.text();
    assert.match(jobHtmlText, /application\/ld\+json/);
    assert.match(jobHtmlText, /Commercial panel rough-in/);
    assert.doesNotMatch(jobHtmlText, /123 Private|superintendent/);

    const postHtml = await request(baseUrl, `/shop-talk/${postId}`);
    assert.equal(postHtml.status, 200);
    const postHtmlText = await postHtml.text();
    assert.match(postHtmlText, /DiscussionForumPosting/);
    assert.match(postHtmlText, /Verify both load-side legs first/);

    const sitemap = await request(baseUrl, "/sitemap.xml");
    assert.equal(sitemap.status, 200);
    const sitemapText = await sitemap.text();
    assert.match(sitemapText, new RegExp(`/jobs/${jobId}`));
    assert.match(sitemapText, new RegExp(`/shop-talk/${postId}`));
  });
}
