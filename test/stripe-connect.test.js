import assert from "node:assert/strict";
import test from "node:test";
import { stripeConnectInternals } from "../server/stripe-connect.js";

test("public invoice payment responses are marked non-cacheable", () => {
  const headers = new Map();
  let nextCalled = false;
  stripeConnectInternals.preventPaymentResponseCaching(
    {},
    { setHeader: (name, value) => headers.set(name.toLowerCase(), value) },
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, true);
  assert.equal(headers.get("cache-control"), "no-store");
  assert.equal(headers.get("pragma"), "no-cache");
});

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

test("Accounts v2 requests ACH direct debit with Stripe-owned fee and loss responsibility", () => {
  const payload = stripeConnectInternals.createV2ConnectedAccountPayload({
    account: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "contractor@example.com",
    },
    profile: { displayName: "Contractor Test" },
  });
  assert.equal(payload.dashboard, "full");
  assert.equal(payload.configuration.merchant.capabilities.ach_debit_payments.requested, true);
  assert.equal(payload.configuration.merchant.capabilities.card_payments.requested, true);
  assert.equal(payload.defaults.responsibilities.fees_collector, "stripe");
  assert.equal(payload.defaults.responsibilities.losses_collector, "stripe");
  assert.equal(payload.identity.country, "us");
  assert.equal("entity_type" in payload.identity, false);
});

test("Accounts v2 onboarding links target only the merchant configuration", () => {
  const onboarding = stripeConnectInternals.createV2AccountLinkPayload(
    "acct_test",
    "https://rivt.example/app/tools?connect=return",
    "https://rivt.example/app/tools?connect=refresh",
    true,
  );
  assert.equal(onboarding.use_case.type, "account_onboarding");
  assert.deepEqual(onboarding.use_case.account_onboarding.configurations, ["merchant"]);
  assert.equal(onboarding.use_case.account_onboarding.collection_options.fields, "eventually_due");
  assert.equal(onboarding.use_case.account_onboarding.collection_options.future_requirements, "include");

  const update = stripeConnectInternals.createV2AccountLinkPayload(
    "acct_test",
    "https://rivt.example/return",
    "https://rivt.example/refresh",
    false,
  );
  assert.equal(update.use_case.type, "account_update");
  assert.deepEqual(update.use_case.account_update.configurations, ["merchant"]);
});

test("Accounts v2 readiness maps restricted onboarding and active ACH honestly", () => {
  const restricted = stripeConnectInternals.normalizeConnectAccount({
    dashboard: "full",
    identity: { country: "US" },
    defaults: { currency: "usd" },
    configuration: {
      merchant: {
        capabilities: {
          ach_debit_payments: { status: "restricted" },
          stripe_balance: { payouts: { status: "restricted" } },
        },
      },
    },
    requirements: {
      entries: [{
        awaiting_action_from: "user",
        minimum_deadline: { status: "past_due" },
      }],
    },
  }, "v2");
  assert.equal(restricted.achStatus, "restricted");
  assert.equal(restricted.detailsSubmitted, false);
  assert.equal(restricted.onboardingStatus, "not_started");

  const ready = stripeConnectInternals.normalizeConnectAccount({
    dashboard: "full",
    identity: { country: "US" },
    defaults: { currency: "usd" },
    configuration: {
      merchant: {
        capabilities: {
          ach_debit_payments: { status: "active" },
          stripe_balance: { payouts: { status: "active" } },
        },
      },
    },
    requirements: { entries: [] },
  }, "v2");
  assert.equal(ready.chargesEnabled, true);
  assert.equal(ready.payoutsEnabled, true);
  assert.equal(ready.detailsSubmitted, true);
  assert.equal(ready.onboardingStatus, "ready");
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
  assert.equal(stripeConnectInternals.nextPaymentStatus("paid", "failed"), "paid");
  assert.equal(stripeConnectInternals.nextPaymentStatus("paid", "disputed"), "disputed");
  assert.equal(stripeConnectInternals.nextPaymentStatus("processing", "paid"), "paid");
  assert.equal(stripeConnectInternals.nextPaymentStatus("expired", "paid"), "expired");
});

test("consequential refund and dispute events win when Stripe delivers them before success", () => {
  for (const currentStatus of ["created", "open", "processing"]) {
    assert.equal(stripeConnectInternals.nextPaymentStatus(currentStatus, "disputed"), "disputed");
    assert.equal(stripeConnectInternals.nextPaymentStatus(currentStatus, "partially_refunded"), "partially_refunded");
    assert.equal(stripeConnectInternals.nextPaymentStatus(currentStatus, "refunded"), "refunded");
  }
  assert.equal(stripeConnectInternals.nextPaymentStatus("refunded", "paid"), "refunded");
  assert.equal(stripeConnectInternals.nextPaymentStatus("disputed", "paid"), "disputed");
});

test("refund events retain the payment-intent lookup used to find the canonical request", () => {
  assert.deepEqual(stripeConnectInternals.eventPaymentUpdate({
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_refund_1",
        payment_intent: "pi_refund_1",
        amount: 10_000,
        amount_refunded: 10_000,
        metadata: { payment_request_id: "6d317040-ffb5-426c-b125-1999753a2763" },
      },
    },
  }), {
    lookup: { paymentIntentId: "pi_refund_1" },
    status: "refunded",
    refundedCents: 10_000,
  });
});

test("closed disputes remain locked for an explicit operator-reviewed resolution", () => {
  assert.equal(stripeConnectInternals.eventPaymentUpdate({
    type: "charge.dispute.closed",
    data: {
      object: {
        id: "dp_closed_1",
        payment_intent: "pi_disputed_1",
        status: "won",
      },
    },
  }), null);
  assert.equal(stripeConnectInternals.nextPaymentStatus("disputed", "paid"), "disputed");
});

test("settled, refunded, processing, and disputed invoice payments remain immutable", () => {
  for (const status of ["processing", "paid", "partially_refunded", "refunded", "disputed"]) {
    assert.equal(stripeConnectInternals.IMMUTABLE_INVOICE_PAYMENT_STATUSES.has(status), true);
  }
  for (const status of ["created", "open", "failed", "expired"]) {
    assert.equal(stripeConnectInternals.IMMUTABLE_INVOICE_PAYMENT_STATUSES.has(status), false);
  }
});

test("Stripe ACH payment links enforce provider amount limits", () => {
  assert.doesNotThrow(() => stripeConnectInternals.assertAchAmount(50));
  assert.doesNotThrow(() => stripeConnectInternals.assertAchAmount(99_999_999));
  assert.throws(() => stripeConnectInternals.assertAchAmount(49), /at least \$0\.50/);
  assert.throws(() => stripeConnectInternals.assertAchAmount(100_000_000), /cannot exceed \$999,999\.99/);
});

test("tool invoices receive a short RIVT payment URL without exposing Stripe checkout", () => {
  const payment = stripeConnectInternals.mapPaymentRequest({
    id: "2c209df4-c27c-4d5d-a38a-140e57c8be94",
    tool_record_id: "6d317040-ffb5-426c-b125-1999753a2763",
    amount_cents: 1249,
    refunded_cents: 0,
    currency: "usd",
    status: "open",
    checkout_url: "https://checkout.stripe.com/c/pay/cs_live_example",
  }, { appOrigin: "https://rivt.pro" });

  assert.equal(payment.invoiceId, null);
  assert.equal(payment.toolRecordId, "6d317040-ffb5-426c-b125-1999753a2763");
  assert.equal(payment.paymentUrl, "https://rivt.pro/pay/2c209df4-c27c-4d5d-a38a-140e57c8be94");
  assert.match(payment.checkoutUrl, /^https:\/\/checkout\.stripe\.com\//);
});
