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
