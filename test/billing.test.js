import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { billingInternals, verifyStripeSignature } from "../server/billing.js";

function stripeSignature(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

test("verifyStripeSignature accepts a current valid signature", () => {
  const payload = JSON.stringify({ id: "evt_test", type: "customer.subscription.updated" });
  assert.equal(verifyStripeSignature(Buffer.from(payload), stripeSignature(payload, "whsec_test"), "whsec_test"), true);
});

test("verifyStripeSignature rejects stale or tampered signatures", () => {
  const payload = JSON.stringify({ id: "evt_test", type: "customer.subscription.updated" });
  assert.equal(verifyStripeSignature(Buffer.from(payload), stripeSignature(payload, "whsec_test", 1), "whsec_test"), false);
  assert.equal(verifyStripeSignature(Buffer.from(`${payload}x`), stripeSignature(payload, "whsec_test"), "whsec_test"), false);
});

test("mapBillingStatus only exposes active pro entitlements", () => {
  const config = { configured: true, webhookSecret: "whsec_test", secretKey: "sk_test", missing: [] };
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const active = billingInternals.mapBillingStatus({
    plan: "pro",
    status: "active",
    active_until: future,
    cancel_at_period_end: false,
    stripe_subscription_id: "sub_test",
    source: "stripe",
  }, config);
  assert.equal(active.active, true);
  assert.equal(active.plan, "pro");

  const inactive = billingInternals.mapBillingStatus({
    plan: "pro",
    status: "past_due",
    active_until: future,
    cancel_at_period_end: false,
    stripe_subscription_id: "sub_test",
    source: "stripe",
  }, config);
  assert.equal(inactive.active, false);
  assert.equal(inactive.plan, "free");
});

test("billing event retention excludes customer PII and full provider payloads", () => {
  const minimized = billingInternals.minimizedBillingEventPayload({
    id: "evt_123",
    type: "checkout.session.completed",
    api_version: "2026-02-25.clover",
    created: 1_722_000_000,
    data: {
      object: {
        id: "cs_123",
        object: "checkout.session",
        client_reference_id: "account-123",
        customer: "cus_123",
        subscription: "sub_123",
        status: "complete",
        payment_status: "paid",
        customer_details: {
          email: "private@example.com",
          name: "Private Customer",
          address: { line1: "123 Private Street" },
        },
      },
    },
  });

  assert.deepEqual(minimized, {
    apiVersion: "2026-02-25.clover",
    created: 1_722_000_000,
    objectId: "cs_123",
    objectType: "checkout.session",
    accountId: "account-123",
    customerId: "cus_123",
    subscriptionId: "sub_123",
    status: "complete",
    paymentStatus: "paid",
  });
  assert.doesNotMatch(JSON.stringify(minimized), /private@example|Private Customer|Private Street/);
});

test("subscription period end supports current Stripe item-level payloads", () => {
  assert.equal(billingInternals.subscriptionPeriodEnd({ current_period_end: 123 }), 123);
  assert.equal(billingInternals.subscriptionPeriodEnd({
    items: { data: [{ current_period_end: 456 }] },
  }), 456);
  assert.equal(billingInternals.subscriptionPeriodEnd({
    items: { data: [{ id: "si_1" }, { current_period_end: 789 }] },
  }), 789);
});

test("checkout success URLs always reopen the mobile billing section", () => {
  assert.equal(
    billingInternals.withBillingSection("https://rivt.example/app/profile/settings?billing=success&session_id={CHECKOUT_SESSION_ID}"),
    "https://rivt.example/app/profile/settings?billing=success&session_id={CHECKOUT_SESSION_ID}&section=billing",
  );
  assert.equal(
    billingInternals.withBillingSection("https://rivt.example/return?section=account&billing=success"),
    "https://rivt.example/return?section=billing&billing=success",
  );
});
