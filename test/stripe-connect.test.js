import assert from "node:assert/strict";
import test from "node:test";
import { stripeConnectInternals } from "../server/stripe-connect.js";

test("Stripe Connect ACH stays fail-closed until explicitly enabled and signed", () => {
  const previous = {
    key: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    enabled: process.env.STRIPE_CONNECT_ACH_ENABLED,
  };
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_placeholder";
  delete process.env.STRIPE_CONNECT_ACH_ENABLED;
  try {
    const disabled = stripeConnectInternals.connectConfig("https://rivt.example");
    assert.equal(disabled.configured, false);
    assert.ok(disabled.missing.includes("STRIPE_CONNECT_ACH_ENABLED"));
    process.env.STRIPE_CONNECT_ACH_ENABLED = "true";
    assert.equal(stripeConnectInternals.connectConfig("https://rivt.example").configured, true);
  } finally {
    if (previous.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.key;
    if (previous.webhook === undefined) delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    else process.env.STRIPE_CONNECT_WEBHOOK_SECRET = previous.webhook;
    if (previous.enabled === undefined) delete process.env.STRIPE_CONNECT_ACH_ENABLED;
    else process.env.STRIPE_CONNECT_ACH_ENABLED = previous.enabled;
  }
});

test("connected account is ready only with ACH, charges, payouts, and submitted details", () => {
  assert.equal(stripeConnectInternals.onboardingStatus({
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    capabilities: { us_bank_account_ach_payments: "active" },
    requirements: {},
  }), "ready");
  assert.equal(stripeConnectInternals.onboardingStatus({
    charges_enabled: true,
    payouts_enabled: false,
    details_submitted: true,
    capabilities: { us_bank_account_ach_payments: "active" },
    requirements: {},
  }), "pending");
});

test("ACH checkout completion remains processing until asynchronous success", () => {
  const completed = stripeConnectInternals.eventPaymentUpdate({
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_1", payment_status: "unpaid", payment_intent: "pi_1" } },
  });
  assert.deepEqual(completed, {
    lookup: { sessionId: "cs_test_1" },
    status: "processing",
    paymentIntentId: "pi_1",
  });
  const settled = stripeConnectInternals.eventPaymentUpdate({
    type: "checkout.session.async_payment_succeeded",
    data: { object: { id: "cs_test_1", payment_intent: "pi_1" } },
  });
  assert.equal(settled.status, "paid");
});

test("only settled and unrefunded online funds contribute to invoice paid balance", () => {
  assert.equal(stripeConnectInternals.providerContributionCents({
    status: "processing",
    amount_cents: 10_000,
    refunded_cents: 0,
  }), 0);
  assert.equal(stripeConnectInternals.providerContributionCents({
    status: "paid",
    amount_cents: 10_000,
    refunded_cents: 0,
  }), 10_000);
  assert.equal(stripeConnectInternals.providerContributionCents({
    status: "partially_refunded",
    amount_cents: 10_000,
    refunded_cents: 2_500,
  }), 7_500);
  assert.equal(stripeConnectInternals.providerContributionCents({
    status: "disputed",
    amount_cents: 10_000,
    refunded_cents: 0,
  }), 0);
});

test("out-of-order Stripe events cannot regress a settled bank payment", () => {
  assert.equal(stripeConnectInternals.nextPaymentStatus("paid", "processing"), "paid");
  assert.equal(stripeConnectInternals.nextPaymentStatus("paid", "disputed"), "disputed");
  assert.equal(stripeConnectInternals.nextPaymentStatus("processing", "paid"), "paid");
  assert.equal(stripeConnectInternals.nextPaymentStatus("expired", "paid"), "expired");
});

test("Stripe ACH payment links enforce provider amount limits", () => {
  assert.doesNotThrow(() => stripeConnectInternals.assertAchAmount(50));
  assert.doesNotThrow(() => stripeConnectInternals.assertAchAmount(99_999_999));
  assert.throws(() => stripeConnectInternals.assertAchAmount(49), /at least \$0\.50/);
  assert.throws(() => stripeConnectInternals.assertAchAmount(100_000_000), /cannot exceed \$999,999\.99/);
});
