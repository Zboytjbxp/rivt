import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("billing reconcile updates entitlements when Stripe checkout completes", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Billing Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "billing-reconcile-test-pepper";
  process.env.REQUIRE_PILOT_INVITE = "false";
  process.env.AUTH_RATE_LIMIT = "10000";
  process.env.S3_BUCKET = "";
  process.env.S3_ACCESS_KEY_ID = "";
  process.env.S3_SECRET_ACCESS_KEY = "";
  process.env.STRIPE_SECRET_KEY = "sk_test_rivt";
  process.env.STRIPE_PRO_PRICE_ID = "price_rivt_pro";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_rivt";

  const { Pool } = pg;
  const database = new Pool({ connectionString: testDatabaseUrl, ssl: false });
  const { app, closeDatabase, ensureDatabaseReady } = await import("../server/index.js");
  const { clearCapturedEmailMessages, capturedEmailMessages } = await import("../server/email.js");

  const originalFetch = globalThis.fetch;
  let stripeHandler = null;

  function sessionCookie(response) {
    return String(response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  }

  async function requestJson(baseUrl, route, { body, cookie, method = "GET", userAgent } = {}) {
    const headers = { Origin: "https://rivt.pro" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (userAgent) headers["User-Agent"] = userAgent;
    const response = await originalFetch(`${baseUrl}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  function tokenFromLatestEmail(email, route) {
    const message = [...capturedEmailMessages()].reverse().find((candidate) => candidate.to === email);
    assert.ok(message, `Expected a captured email for ${email}`);
    const match = message.text.match(new RegExp(`${route}\\?token=([^\\s]+)`));
    assert.ok(match, `Expected ${route} token in captured email`);
    return decodeURIComponent(match[1]);
  }

  async function signup(baseUrl, role, label) {
    const email = `${label}-${randomUUID()}@example.test`;
    const result = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/125.0",
      body: {
        email,
        password: "SafePassword!1234",
        displayName: `${label} account`,
        role,
      },
    });
    assert.equal(result.response.status, 201);
    return { id: result.payload.data.user.id, email, cookie: sessionCookie(result.response) };
  }

  async function verifyEmail(baseUrl, account) {
    const token = tokenFromLatestEmail(account.email, "verify-email");
    const verified = await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token },
    });
    assert.equal(verified.response.status, 200);
  }

  async function completeOnboarding(baseUrl, account, role) {
    const result = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie: account.cookie,
      body: {
        role,
        displayName: role === "contractor" ? "River City Electric" : "Alex Torres",
        headline: role === "contractor" ? "Commercial electrical contractor" : "Journeyman electrician",
        bio: "Jacksonville trade professional focused on reliable field work.",
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 35,
        availabilityStatus: "available",
        contactEmailVisibility: "private",
        phoneE164: null,
        phoneVisibility: "private",
        tradeCodes: ["electrical"],
        organizationName: role === "contractor" ? "River City Electric" : undefined,
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(result.response.status, 200);
  }

  function stripeJson(status, payload) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  test("billing reconcile updates entitlements when Stripe checkout completes", async (context) => {
    await ensureDatabaseReady();
    clearCapturedEmailMessages();

    const stripeSuffix = randomUUID().slice(0, 8);
    const ownerSessionId = `cs_owner_${stripeSuffix}`;
    const forbiddenSessionId = `cs_forbidden_${stripeSuffix}`;
    const ownerCustomerId = `cus_owner_${stripeSuffix}`;
    const ownerSubscriptionId = `sub_owner_${stripeSuffix}`;

    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("https://api.stripe.com/v1/")) {
        if (!stripeHandler) throw new Error(`Unexpected Stripe request without handler: ${url}`);
        return stripeHandler(url, init);
      }
      return originalFetch(input, init);
    };

    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    context.after(async () => {
      globalThis.fetch = originalFetch;
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeDatabase();
      await database.end();
    });

    const owner = await signup(baseUrl, "contractor", "billing-owner");
    await verifyEmail(baseUrl, owner);
    await completeOnboarding(baseUrl, owner, "contractor");

    const other = await signup(baseUrl, "contractor", "billing-other");
    await verifyEmail(baseUrl, other);
    await completeOnboarding(baseUrl, other, "contractor");

    const periodEnd = Math.floor(Date.now() / 1000) + 86_400;
    stripeHandler = async (url) => {
      if (url.endsWith(`/checkout/sessions/${ownerSessionId}`)) {
        return stripeJson(200, {
          id: ownerSessionId,
          customer: ownerCustomerId,
          client_reference_id: owner.id,
          metadata: { account_id: owner.id, product: "rivt_pro" },
          subscription: ownerSubscriptionId,
          payment_status: "paid",
          status: "complete",
        });
      }
      if (url.endsWith(`/subscriptions/${ownerSubscriptionId}`)) {
        return stripeJson(200, {
          id: ownerSubscriptionId,
          customer: ownerCustomerId,
          status: "active",
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          metadata: { account_id: owner.id, product: "rivt_pro" },
          items: { data: [{ price: { id: "price_rivt_pro" }, current_period_end: periodEnd }] },
        });
      }
      if (url.endsWith(`/checkout/sessions/${forbiddenSessionId}`)) {
        return stripeJson(200, {
          id: forbiddenSessionId,
          customer: ownerCustomerId,
          client_reference_id: owner.id,
          metadata: { account_id: owner.id, product: "rivt_pro" },
          subscription: ownerSubscriptionId,
          payment_status: "paid",
          status: "complete",
        });
      }
      throw new Error(`Unhandled Stripe URL in test: ${url}`);
    };

    const reconcile = await requestJson(baseUrl, "/api/v1/billing/reconcile", {
      method: "POST",
      cookie: owner.cookie,
      body: { sessionId: ownerSessionId },
    });
    assert.equal(reconcile.response.status, 200);
    assert.equal(reconcile.payload.data.reconciled, true);
    assert.equal(reconcile.payload.data.billing.active, true);
    assert.equal(reconcile.payload.data.billing.plan, "pro");

    const status = await requestJson(baseUrl, "/api/v1/billing/status", {
      cookie: owner.cookie,
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.payload.data.billing.active, true);
    assert.equal(status.payload.data.billing.plan, "pro");

    const reconcileAgain = await requestJson(baseUrl, "/api/v1/billing/reconcile", {
      method: "POST",
      cookie: owner.cookie,
      body: { sessionId: ownerSessionId },
    });
    assert.equal(reconcileAgain.response.status, 200);
    assert.equal(reconcileAgain.payload.data.billing.active, true);

    const forbidden = await requestJson(baseUrl, "/api/v1/billing/reconcile", {
      method: "POST",
      cookie: other.cookie,
      body: { sessionId: forbiddenSessionId },
    });
    assert.equal(forbidden.response.status, 403);
    assert.equal(forbidden.payload.error.code, "BILLING_SESSION_FORBIDDEN");
  });
}
