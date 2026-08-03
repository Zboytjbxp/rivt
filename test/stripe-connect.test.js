import assert from "node:assert/strict";
import test from "node:test";
import {
  stripeConnectInternals,
  stripeConnectProviderStatus,
  stripeConnectRuntimeProof,
  verifyStripeConnectRuntimeProof,
} from "../server/stripe-connect.js";

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

test("Stripe runtime proof binds live secrets to a short-lived nonce without publishing a stable fingerprint", () => {
  const input = {
    secretKey: "sk_live_private_value",
    webhookSecret: "whsec_private_value",
    enabled: false,
    webhookScope: undefined,
    sourceCommit: "a".repeat(40),
    timestamp: "1785600000",
    nonce: "A".repeat(43),
  };
  const proof = stripeConnectRuntimeProof(input);
  assert.match(proof, /^[a-f0-9]{64}$/);
  assert.equal(proof.includes(input.secretKey), false);
  assert.notEqual(stripeConnectRuntimeProof({ ...input, secretKey: `${input.secretKey}_rotated` }), proof);
  assert.notEqual(stripeConnectRuntimeProof({ ...input, webhookSecret: `${input.webhookSecret}_rotated` }), proof);
  assert.notEqual(stripeConnectRuntimeProof({ ...input, nonce: "B".repeat(43) }), proof);
  assert.notEqual(stripeConnectRuntimeProof({ ...input, timestamp: "1785600001" }), proof);
});

test("Stripe runtime proof verifier rejects stale, malformed, and mismatched evidence", () => {
  const previous = {
    key: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    enabled: process.env.STRIPE_CONNECT_ACH_ENABLED,
    scope: process.env.STRIPE_CONNECT_WEBHOOK_SCOPE,
  };
  const input = {
    secretKey: "sk_live_runtime_value",
    webhookSecret: "whsec_runtime_value",
    enabled: false,
    webhookScope: undefined,
    sourceCommit: "b".repeat(40),
    timestamp: "1785600000",
    nonce: "C".repeat(43),
  };
  process.env.STRIPE_SECRET_KEY = input.secretKey;
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = input.webhookSecret;
  process.env.STRIPE_CONNECT_ACH_ENABLED = "false";
  delete process.env.STRIPE_CONNECT_WEBHOOK_SCOPE;
  try {
    const proof = stripeConnectRuntimeProof(input);
    const request = {
      authorization: `RIVT-HMAC ${proof}`,
      nonce: input.nonce,
      sourceCommit: input.sourceCommit,
      timestamp: input.timestamp,
      now: Number(input.timestamp) * 1000,
    };
    assert.equal(verifyStripeConnectRuntimeProof(request), true);
    assert.equal(verifyStripeConnectRuntimeProof({ ...request, nonce: "D".repeat(43) }), false);
    assert.equal(verifyStripeConnectRuntimeProof({ ...request, now: request.now + 121_000 }), false);
    assert.equal(verifyStripeConnectRuntimeProof({ ...request, authorization: "RIVT-HMAC invalid" }), false);
  } finally {
    for (const [name, value] of Object.entries({
      STRIPE_SECRET_KEY: previous.key,
      STRIPE_CONNECT_WEBHOOK_SECRET: previous.webhook,
      STRIPE_CONNECT_ACH_ENABLED: previous.enabled,
      STRIPE_CONNECT_WEBHOOK_SCOPE: previous.scope,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("Stripe Connect ACH stays fail-closed until explicitly enabled and signed", () => {
  const previous = {
    key: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    enabled: process.env.STRIPE_CONNECT_ACH_ENABLED,
    scope: process.env.STRIPE_CONNECT_WEBHOOK_SCOPE,
  };
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_placeholder";
  delete process.env.STRIPE_CONNECT_ACH_ENABLED;
  delete process.env.STRIPE_CONNECT_WEBHOOK_SCOPE;
  try {
    const disabled = stripeConnectInternals.connectConfig("https://rivt.example");
    assert.equal(disabled.configured, false);
    assert.ok(disabled.missing.includes("STRIPE_CONNECT_ACH_ENABLED"));
    process.env.STRIPE_CONNECT_ACH_ENABLED = "true";
    const missingScope = stripeConnectInternals.connectConfig("https://rivt.example");
    assert.equal(missingScope.configured, false);
    assert.ok(missingScope.missing.includes("STRIPE_CONNECT_WEBHOOK_SCOPE=connected_accounts"));
    process.env.STRIPE_CONNECT_WEBHOOK_SCOPE = "your_account";
    assert.equal(stripeConnectInternals.connectConfig("https://rivt.example").configured, false);
    process.env.STRIPE_CONNECT_WEBHOOK_SCOPE = "connected_accounts";
    assert.equal(stripeConnectInternals.connectConfig("https://rivt.example").configured, true);
  } finally {
    if (previous.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.key;
    if (previous.webhook === undefined) delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    else process.env.STRIPE_CONNECT_WEBHOOK_SECRET = previous.webhook;
    if (previous.enabled === undefined) delete process.env.STRIPE_CONNECT_ACH_ENABLED;
    else process.env.STRIPE_CONNECT_ACH_ENABLED = previous.enabled;
    if (previous.scope === undefined) delete process.env.STRIPE_CONNECT_WEBHOOK_SCOPE;
    else process.env.STRIPE_CONNECT_WEBHOOK_SCOPE = previous.scope;
  }
});

test("Stripe provider status distinguishes webhook signing from Connected accounts delivery scope", async () => {
  const previous = {
    key: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    enabled: process.env.STRIPE_CONNECT_ACH_ENABLED,
    scope: process.env.STRIPE_CONNECT_WEBHOOK_SCOPE,
  };
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_placeholder";
  process.env.STRIPE_CONNECT_ACH_ENABLED = "true";
  delete process.env.STRIPE_CONNECT_WEBHOOK_SCOPE;
  try {
    const unsignedScope = stripeConnectInternals.connectConfig("https://rivt.example");
    assert.equal(unsignedScope.webhookScopeConfigured, false);
    const readyRow = {
      onboarding_status: "ready",
      ach_payments_status: "active",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    };
    const pausedStatus = stripeConnectInternals.mapConnectStatus(readyRow, unsignedScope);
    assert.equal(pausedStatus.accountReady, true);
    assert.equal(pausedStatus.paymentLinksAvailable, false);
    assert.equal(pausedStatus.managementAvailable, true);
    assert.equal(pausedStatus.ready, false);
    assert.deepEqual(stripeConnectProviderStatus("https://rivt.example"), {
      provider: "stripe_connect",
      accountsApi: "v2",
      enabled: true,
      configured: false,
      webhookConfigured: true,
      webhookScopeConfigured: false,
      mode: "setup_required",
    });
    process.env.STRIPE_CONNECT_WEBHOOK_SCOPE = "connected_accounts";
    const connectedScope = stripeConnectInternals.connectConfig("https://rivt.example");
    assert.equal(connectedScope.webhookScopeConfigured, true);
    assert.equal(connectedScope.configured, true);
    const availableStatus = stripeConnectInternals.mapConnectStatus(readyRow, connectedScope);
    assert.equal(availableStatus.accountReady, true);
    assert.equal(availableStatus.paymentLinksAvailable, true);
    assert.equal(availableStatus.managementAvailable, true);
    assert.equal(availableStatus.ready, true);
  } finally {
    for (const [name, value] of Object.entries({
      STRIPE_SECRET_KEY: previous.key,
      STRIPE_CONNECT_WEBHOOK_SECRET: previous.webhook,
      STRIPE_CONNECT_ACH_ENABLED: previous.enabled,
      STRIPE_CONNECT_WEBHOOK_SCOPE: previous.scope,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("existing Accounts v2 merchants can still reach Stripe while new payment links are paused", () => {
  const row = { stripe_account_api_version: "v2" };
  assert.equal(stripeConnectInternals.connectManagementAvailable(row, { secretKey: null }), true);
  assert.equal(stripeConnectInternals.connectManagementAvailable({ stripe_account_api_version: "v1" }, { secretKey: null }), false);
  assert.equal(stripeConnectInternals.connectManagementAvailable({ stripe_account_api_version: "v1" }, { secretKey: "sk_test_placeholder" }), true);
  assert.equal(stripeConnectInternals.connectManagementAvailable(null, { secretKey: "sk_test_placeholder" }), false);
});

test("Stripe requests fail with a bounded, explicit timeout", async () => {
  assert.equal(stripeConnectInternals.STRIPE_REQUEST_TIMEOUT_MS, 8_000);
  const signal = AbortSignal.abort(new DOMException("deadline", "TimeoutError"));
  const stalledFetch = (_url, options) => Promise.reject(options.signal.reason);
  await assert.rejects(
    () => stripeConnectInternals.stripeConnectRequest(
      { secretKey: "sk_test_placeholder" },
      "/accounts/acct_test",
      {},
      { method: "GET", fetchImpl: stalledFetch, signal },
    ),
    (error) => error.status === 504 && error.code === "STRIPE_CONNECT_TIMEOUT",
  );
});

test("Stripe creates and enforces its default timeout signal", async () => {
  await assert.rejects(
    () => stripeConnectInternals.stripeConnectRequest(
      { secretKey: "sk_test_placeholder" },
      "/accounts/acct_test",
      {},
      {
        method: "GET",
        timeoutMs: 5,
        fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
        }),
      },
    ),
    (error) => error.status === 504 && error.code === "STRIPE_CONNECT_TIMEOUT",
  );
});

test("Stripe response-body timeouts are not mistaken for successful requests", async () => {
  const signal = AbortSignal.abort(new DOMException("deadline", "TimeoutError"));
  await assert.rejects(
    () => stripeConnectInternals.stripeConnectV2Request(
      { secretKey: "sk_test_placeholder" },
      "/core/accounts/acct_test",
      {},
      {
        method: "GET",
        signal,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => { throw signal.reason; },
        }),
      },
    ),
    (error) => error.status === 504 && error.code === "STRIPE_CONNECT_TIMEOUT",
  );
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
  assert.equal("checkoutUrl" in payment, false);
});

test("unreconciled reservations never expose a payable URL", () => {
  const payment = stripeConnectInternals.mapPaymentRequest({
    id: "2c209df4-c27c-4d5d-a38a-140e57c8be94",
    tool_record_id: "6d317040-ffb5-426c-b125-1999753a2763",
    amount_cents: 1249,
    refunded_cents: 0,
    currency: "usd",
    status: "created",
    checkout_url: null,
  }, { appOrigin: "https://rivt.pro" });

  assert.equal(payment.paymentUrl, null);
  assert.equal("checkoutUrl" in payment, false);
});

test("checkout failure classification fails closed for ambiguous provider outcomes", () => {
  const classify = stripeConnectInternals.isAmbiguousCheckoutCreationFailure;
  assert.equal(classify({ code: "STRIPE_CONNECT_TIMEOUT" }), true);
  assert.equal(classify({ code: "STRIPE_CONNECT_UNAVAILABLE" }), true);
  assert.equal(classify({ code: "STRIPE_CONNECT_INVALID_RESPONSE" }), true);
  for (const providerStatus of [408, 409, 429, 500, 503]) {
    assert.equal(classify({
      code: "STRIPE_CONNECT_REQUEST_FAILED",
      details: { providerStatus },
    }), true);
  }
  assert.equal(classify({
    code: "STRIPE_CONNECT_REQUEST_FAILED",
    details: { providerStatus: 400, type: "idempotency_error" },
  }), true);
  assert.equal(classify({
    code: "STRIPE_CONNECT_REQUEST_FAILED",
    details: { providerStatus: 400, code: "idempotency_key_in_use" },
  }), true);
  assert.equal(classify({
    code: "STRIPE_CONNECT_REQUEST_FAILED",
    details: { providerStatus: 400, type: "invalid_request_error", code: "parameter_invalid" },
  }), false);
  assert.equal(classify({
    code: "STRIPE_CONNECT_REQUEST_FAILED",
    details: { providerStatus: 403, type: "invalid_request_error" },
  }), false);
});

test("checkout payload is derived only from the durable reservation identity", () => {
  const reservation = {
    id: "2c209df4-c27c-4d5d-a38a-140e57c8be94",
    tool_record_id: "6d317040-ffb5-426c-b125-1999753a2763",
    merchant_account_id: "05810811-43ac-4f64-ab3f-64b434a0a1f1",
    amount_cents: 1249,
  };
  const original = stripeConnectInternals.checkoutSessionParams({
    ...reservation,
    invoice_number: "INV-ORIGINAL",
    recipient_email: "first@example.test",
    pay_to: "Original Company",
  }, "https://rivt.pro", "tool");
  const afterMutableInvoiceEdits = stripeConnectInternals.checkoutSessionParams({
    ...reservation,
    invoice_number: "INV-EDITED",
    recipient_email: "second@example.test",
    pay_to: "Edited Company",
  }, "https://rivt.pro", "tool");

  assert.deepEqual(afterMutableInvoiceEdits, original);
  assert.equal(original.client_reference_id, reservation.id);
  assert.equal(original["line_items[0][price_data][unit_amount]"], 1249);
  assert.equal(original["metadata[tool_payment_request_id]"], reservation.id);
  assert.equal(original["payment_intent_data[metadata][tool_payment_request_id]"], reservation.id);
  assert.equal(JSON.stringify(original).includes("example.test"), false);
  assert.equal(JSON.stringify(original).includes("Original Company"), false);
});

test("project and tool checkout payloads keep distinct durable metadata", () => {
  const common = {
    id: "2c209df4-c27c-4d5d-a38a-140e57c8be94",
    merchant_account_id: "05810811-43ac-4f64-ab3f-64b434a0a1f1",
    amount_cents: 5000,
  };
  const project = stripeConnectInternals.checkoutSessionParams({
    ...common,
    invoice_id: "bde4a8ba-8514-49d8-a7a0-1f38a3484a91",
  }, "https://rivt.pro", "project");
  const tool = stripeConnectInternals.checkoutSessionParams({
    ...common,
    tool_record_id: "6d317040-ffb5-426c-b125-1999753a2763",
  }, "https://rivt.pro", "tool");

  assert.equal(project["metadata[payment_request_id]"], common.id);
  assert.equal(project["metadata[invoice_id]"], "bde4a8ba-8514-49d8-a7a0-1f38a3484a91");
  assert.equal(tool["metadata[tool_payment_request_id]"], common.id);
  assert.equal(tool["metadata[tool_record_id]"], "6d317040-ffb5-426c-b125-1999753a2763");
});

test("checkout reconciliation validates the Stripe session before finalization", () => {
  const session = {
    id: "cs_test_1234567890abcdef",
    url: "https://checkout.stripe.com/c/pay/cs_test_1234567890abcdef",
    expires_at: 1_800_000_000,
  };
  assert.equal(stripeConnectInternals.assertCheckoutSession(session), session);
  assert.throws(
    () => stripeConnectInternals.assertCheckoutSession({ ...session, url: "https://evil.example/pay" }),
    /incomplete bank-payment response/,
  );
  assert.throws(
    () => stripeConnectInternals.assertCheckoutSession({ ...session, id: "not-a-session" }),
    /incomplete bank-payment response/,
  );
});
