import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = (process.env.RIVT_BILLING_SMOKE_BASE_URL ?? process.env.RIVT_MONITOR_BASE_URL ?? "https://rivt.pro").replace(/\/+$/, "");
const email = process.env.RIVT_SMOKE_EMAIL?.trim();
const password = process.env.RIVT_SMOKE_PASSWORD ?? "";
const timeoutMs = Number.parseInt(process.env.RIVT_BILLING_SMOKE_TIMEOUT_MS ?? "15000", 10);
const exerciseRedirects = process.env.RIVT_BILLING_EXERCISE_REDIRECTS === "true";

function requireSmokeCredentials() {
  if (!email || !password) {
    throw new Error("Set RIVT_SMOKE_EMAIL and RIVT_SMOKE_PASSWORD before running the live billing smoke.");
  }
}

function sessionCookie(response) {
  return String(response.headers.get("set-cookie") ?? "").split(";", 1)[0];
}

async function request(path, {
  body,
  cookie,
  expected = 200,
  method = body === undefined ? "GET" : "POST",
  headers = {},
} = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Origin: baseUrl,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`${path} returned non-JSON response: ${text.slice(0, 200)}`);
    }
  }
  assert.equal(response.status, expected, `${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return { response, payload };
}

function assertStripeUrl(value, hostPattern, label) {
  assert.equal(typeof value, "string", `${label} URL must be a string.`);
  const url = new URL(value);
  assert.match(url.hostname, hostPattern, `${label} must point at Stripe.`);
  return url.hostname;
}

requireSmokeCredentials();

const startedAt = Date.now();
const login = await request("/api/v1/auth/login", {
  method: "POST",
  body: { email, password },
});
const cookie = sessionCookie(login.response);
assert.ok(cookie, "Login must set an authenticated session cookie.");

const status = await request("/api/v1/billing/status", { cookie });
const billing = status.payload?.data?.billing;
assert.ok(billing, "Billing status must return data.billing.");
assert.equal(billing.provider.checkoutConfigured, true, "Stripe Checkout must be configured.");
assert.equal(billing.provider.webhookConfigured, true, "Stripe webhook signing secret must be configured.");
assert.equal(billing.provider.portalConfigured, true, "Stripe Customer Portal must be configured enough for portal session creation.");
assert.deepEqual(billing.provider.missing, [], "Billing provider must not report missing required variables.");

const invalidWebhook = await request("/api/stripe/webhook", {
  method: "POST",
  body: { id: `evt_unsigned_${randomUUID()}`, type: "customer.subscription.updated" },
  expected: 400,
});
assert.equal(invalidWebhook.payload?.error?.code, "STRIPE_SIGNATURE_INVALID", "Unsigned webhook must be rejected by signature verification, not setup failure.");

const result = {
  ok: true,
  baseUrl,
  account: email,
  billing: {
    plan: billing.plan,
    active: billing.active,
    status: billing.status,
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
    provider: {
      checkoutConfigured: billing.provider.checkoutConfigured,
      webhookConfigured: billing.provider.webhookConfigured,
      portalConfigured: billing.provider.portalConfigured,
    },
  },
  webhookSignatureCheck: "rejected_unsigned_event",
  redirectsExercised: false,
  durationMs: Date.now() - startedAt,
};

if (exerciseRedirects) {
  const checkout = await request("/api/v1/billing/checkout", {
    cookie,
    headers: { "Idempotency-Key": `billing-smoke-checkout-${randomUUID()}` },
    expected: 201,
    body: {},
  });
  const portal = await request("/api/v1/billing/portal", {
    cookie,
    headers: { "Idempotency-Key": `billing-smoke-portal-${randomUUID()}` },
    expected: 201,
    body: {},
  });
  result.redirectsExercised = true;
  result.checkout = {
    sessionPrefix: String(checkout.payload?.data?.sessionId ?? "").slice(0, 8),
    host: assertStripeUrl(checkout.payload?.data?.url, /(^|\.)stripe\.com$/i, "Checkout"),
  };
  result.portal = {
    host: assertStripeUrl(portal.payload?.data?.url, /(^|\.)stripe\.com$/i, "Customer Portal"),
  };
}

console.log(JSON.stringify(result, null, 2));
