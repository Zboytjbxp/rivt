import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("Stripe payment-link retries converge on one durable provider session", {
    skip: "TEST_DATABASE_URL is not configured",
  }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "stripe-link-retry-test-pepper";
  process.env.REQUIRE_PILOT_INVITE = "false";
  process.env.AUTH_RATE_LIMIT = "10000";
  process.env.RIVT_DB_MAX_CONNECTIONS = "90";
  process.env.S3_BUCKET = "";
  process.env.S3_ACCESS_KEY_ID = "";
  process.env.S3_SECRET_ACCESS_KEY = "";
  process.env.STRIPE_SECRET_KEY = "sk_test_stripe_link_retry";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_stripe_link_retry";
  process.env.STRIPE_CONNECT_WEBHOOK_SCOPE = "connected_accounts";
  process.env.STRIPE_CONNECT_ACH_ENABLED = "true";

  const connectedAccountId = `acct_test_${randomUUID().replaceAll("-", "")}`;
  const originalFetch = globalThis.fetch;
  const checkoutCalls = [];
  const providerAttempts = new Map();
  const providerSessions = new Map();
  const queuedCheckoutModes = [];
  let expireCalls = 0;

  function readyV2Account() {
    return {
      id: connectedAccountId,
      dashboard: "full",
      identity: { country: "us" },
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
    };
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  globalThis.fetch = async (input, init = {}) => {
    const url = input instanceof URL
      ? input
      : new URL(typeof input === "string" ? input : input.url);
    if (url.hostname !== "api.stripe.com") return originalFetch(input, init);
    if (url.pathname.startsWith("/v2/core/accounts/")) {
      return jsonResponse(readyV2Account());
    }
    if (url.pathname.endsWith("/expire")) {
      expireCalls += 1;
      return jsonResponse({ id: url.pathname.split("/").at(-2), status: "expired" });
    }
    if (url.pathname !== "/v1/checkout/sessions") {
      throw new Error(`Unexpected Stripe test request: ${url.pathname}`);
    }

    const providerKey = init.headers?.["Idempotency-Key"];
    assert.ok(providerKey, "Checkout creation must carry a provider idempotency key");
    const body = String(init.body ?? "");
    const params = new URLSearchParams(body);
    let attempt = providerAttempts.get(providerKey);
    if (!attempt) {
      const mode = queuedCheckoutModes.shift() ?? "success";
      attempt = { count: 0, mode };
      providerAttempts.set(providerKey, attempt);
      if (mode !== "terminal") {
        const suffix = randomUUID().replaceAll("-", "");
        providerSessions.set(providerKey, {
          id: `cs_test_${suffix}`,
          url: `https://checkout.stripe.com/c/pay/cs_test_${suffix}`,
          expires_at: Math.floor(Date.now() / 1000) + 1800,
        });
      }
    }
    attempt.count += 1;
    checkoutCalls.push({
      providerKey,
      body,
      requestId: params.get("metadata[tool_payment_request_id]")
        ?? params.get("metadata[payment_request_id]"),
    });

    if (attempt.mode === "terminal") {
      return jsonResponse({
        error: { type: "invalid_request_error", code: "parameter_invalid", message: "Rejected fixture" },
      }, 400);
    }
    if (attempt.mode === "lost_then_terminal" && attempt.count === 2) {
      return jsonResponse({
        error: { type: "invalid_request_error", code: "account_invalid", message: "Later terminal-looking fixture" },
      }, 400);
    }
    if (attempt.mode === "idempotency_error" && attempt.count === 1) {
      return jsonResponse({
        error: { type: "idempotency_error", code: "idempotency_key_in_use", message: "Ambiguous fixture" },
      }, 400);
    }
    if (["accepted_response_lost", "lost_then_terminal"].includes(attempt.mode) && attempt.count === 1) {
      throw new DOMException("Stripe accepted the request but the response was lost", "AbortError");
    }
    return jsonResponse(providerSessions.get(providerKey));
  };

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
    const response = await originalFetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  async function sendStripeEvent(baseUrl, event) {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHmac("sha256", process.env.STRIPE_CONNECT_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    const response = await originalFetch(`${baseUrl}/api/stripe/connect/webhook`, {
      method: "POST",
      headers: {
        Origin: "https://rivt.pro",
        "Content-Type": "application/json",
        "Stripe-Signature": `t=${timestamp},v1=${digest}`,
      },
      body,
    });
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
    const account = { email, cookie: sessionCookie(signup.response) };
    assert.equal((await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: tokenFor(email) },
    })).response.status, 200);
    assert.equal((await requestJson(baseUrl, "/api/v1/onboarding/complete", {
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
    })).response.status, 200);
    const me = await requestJson(baseUrl, "/api/v1/me", { cookie: account.cookie });
    account.id = me.payload.data.id;
    account.organizationId = me.payload.data.organizations[0]?.id;
    return account;
  }

  async function makeConnectedMerchant(accountId) {
    await database.query(
      `INSERT INTO stripe_connect_accounts (
         account_id, stripe_account_id, country, currency, charges_enabled,
         payouts_enabled, details_submitted, ach_payments_status, onboarding_status,
         stripe_account_api_version, stripe_dashboard, last_synced_at
       )
       VALUES ($1, $2, 'US', 'usd', true, true, true, 'active', 'ready', 'v2', 'full', now())
       ON CONFLICT (account_id) DO UPDATE SET
         stripe_account_id = EXCLUDED.stripe_account_id,
         charges_enabled = true,
         payouts_enabled = true,
         details_submitted = true,
         ach_payments_status = 'active',
         onboarding_status = 'ready',
         stripe_account_api_version = 'v2',
         stripe_dashboard = 'full'`,
      [accountId, connectedAccountId],
    );
  }

  async function createToolInvoice(baseUrl, merchant, localId, amountCents = 12500) {
    const result = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: merchant.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "invoice_draft",
        localId,
        title: "Retry-safe invoice",
        status: "draft",
        recordDate: "2026-08-02",
        amountCents,
        payload: {
          invoiceNumber: `INV-${localId}`,
          recipientName: "Test Customer",
          recipientEmail: "customer@example.test",
          payTo: "Test Merchant",
          customerLines: [{ description: "Electrical labor", quantity: 1, totalCents: amountCents }],
        },
      },
    });
    assert.equal(result.response.status, 200);
    return result.payload.data.record;
  }

  async function createProjectInvoice(baseUrl, contractor, tradesperson) {
    const created = await requestJson(baseUrl, "/api/v1/jobs", {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: randomUUID(),
      body: {
        organizationId: contractor.organizationId,
        title: "Stripe retry project",
        tradeCode: "electrical",
        summary: "A real workflow fixture for payment-link retry coverage.",
        scopeDescription: "Complete electrical closeout work and invoice the contractor.",
        difficulty: "advanced",
        workType: "side_work",
        budgetCents: 25000,
        durationHours: 4,
        insuranceRequired: false,
        tools: ["Multimeter"],
        deliverables: ["Closeout"],
        publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
        privateLocation: {
          addressLine1: "404 Retry Way",
          city: "Jacksonville",
          region: "FL",
          postalCode: "32202",
          countryCode: "US",
        },
      },
    });
    assert.equal(created.response.status, 201);
    const published = await requestJson(baseUrl, `/api/v1/jobs/${created.payload.data.job.id}/publish`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: randomUUID(),
      body: { expectedVersion: created.payload.data.job.version, consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(published.response.status, 200);
    const application = await requestJson(baseUrl, `/api/v1/jobs/${created.payload.data.job.id}/applications`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: randomUUID(),
      body: {
        message: "Available for this scope.",
        proposedStartDate: "2026-08-03",
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(application.response.status, 201);
    const offer = await requestJson(baseUrl, `/api/v1/applications/${application.payload.data.application.id}/offer`, {
      method: "POST",
      cookie: contractor.cookie,
      idempotencyKey: randomUUID(),
      body: {
        startDate: "2026-08-03",
        scopeSummary: "Electrical closeout",
        message: "Approved.",
        agreedAmountCents: 25000,
        agreedUnit: "fixed",
      },
    });
    assert.equal(offer.response.status, 201);
    const accepted = await requestJson(baseUrl, `/api/v1/offers/${offer.payload.data.offer.id}/accept`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: randomUUID(),
      body: { reason: "Confirmed.", consentAccepted: true, consentVersion: "2026-06-19" },
    });
    assert.equal(accepted.response.status, 200);
    const invoice = await requestJson(baseUrl, `/api/v1/active-work/${accepted.payload.data.activeWork.id}/invoices`, {
      method: "POST",
      cookie: tradesperson.cookie,
      idempotencyKey: randomUUID(),
      body: {
        invoiceNumber: `RETRY-${randomUUID().slice(0, 8)}`,
        billTo: "Stripe Retry Contractor LLC",
        payTo: "Stripe Retry Tradesperson",
        terms: "Due on completion",
        paymentMethod: "Secure bank payment",
        recipientEmail: contractor.email,
        taxCents: 0,
        lineItems: [{ description: "Electrical closeout", quantity: 1, rateCents: 25000, kind: "labor" }],
      },
    });
    assert.equal(invoice.response.status, 201);
    return invoice.payload.data.invoice;
  }

  test("Stripe payment-link retries converge on one durable provider session", async (context) => {
    await ensureDatabaseReady();
    clearCapturedEmailMessages();
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    context.after(async () => {
      globalThis.fetch = originalFetch;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await closeDatabase();
      await database.end();
    });

    const contractor = await createAccount(baseUrl, "contractor", "Stripe Retry Contractor");
    const merchant = await createAccount(baseUrl, "tradesperson", "Stripe Retry Tradesperson");
    await makeConnectedMerchant(merchant.id);

    const toolLocalId = `invoice:lost-${randomUUID()}`;
    await createToolInvoice(baseUrl, merchant, toolLocalId);
    queuedCheckoutModes.push("accepted_response_lost");
    const toolFirstKey = randomUUID();
    const lostToolLink = await requestJson(baseUrl, `/api/v1/tool-invoices/${encodeURIComponent(toolLocalId)}/bank-payment-link`, {
      method: "POST",
      cookie: merchant.cookie,
      idempotencyKey: toolFirstKey,
    });
    assert.equal(lostToolLink.response.status, 504);
    assert.equal(lostToolLink.payload.error.code, "STRIPE_CONNECT_TIMEOUT");
    const toolRowsAfterLoss = await database.query(
      `SELECT tipr.* FROM tool_invoice_payment_requests tipr
       INNER JOIN tool_records tr ON tr.id = tipr.tool_record_id
       WHERE tr.account_id = $1 AND tr.local_id = $2`,
      [merchant.id, toolLocalId],
    );
    assert.equal(toolRowsAfterLoss.rowCount, 1);
    const toolRequest = toolRowsAfterLoss.rows[0];
    assert.equal(toolRequest.status, "created");
    assert.equal(toolRequest.stripe_checkout_session_id, null);

    const publicUnresolved = await originalFetch(`${baseUrl}/pay/${toolRequest.id}`, { redirect: "manual" });
    assert.equal(publicUnresolved.status, 409);
    const cancelUnresolved = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(toolLocalId)}/bank-payment-link/cancel`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(cancelUnresolved.response.status, 409);
    assert.equal(cancelUnresolved.payload.error.code, "BANK_PAYMENT_LINK_RECONCILIATION_REQUIRED");
    assert.equal(expireCalls, 0);

    const toolProviderKey = `rivt-tool-invoice-payment-${toolRequest.id}`;
    const toolProviderSession = providerSessions.get(toolProviderKey);
    assert.ok(toolProviderSession);
    const earlyWebhook = await sendStripeEvent(baseUrl, {
      id: `evt_${randomUUID().replaceAll("-", "")}`,
      type: "checkout.session.completed",
      account: connectedAccountId,
      livemode: false,
      data: {
        object: {
          ...toolProviderSession,
          payment_status: "unpaid",
          payment_intent: `pi_test_${randomUUID().replaceAll("-", "")}`,
          metadata: { tool_payment_request_id: toolRequest.id },
        },
      },
    });
    assert.equal(earlyWebhook.response.status, 200);
    assert.equal((await database.query(
      "SELECT status FROM tool_invoice_payment_requests WHERE id = $1",
      [toolRequest.id],
    )).rows[0].status, "processing");

    await database.query(
      "UPDATE tool_records SET amount_cents = amount_cents + 1 WHERE id = $1",
      [toolRequest.tool_record_id],
    );
    const changedDuringEarlyWebhook = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(toolLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(changedDuringEarlyWebhook.response.status, 409);
    assert.equal(changedDuringEarlyWebhook.payload.error.code, "BANK_PAYMENT_AMOUNT_CHANGED");
    assert.equal(checkoutCalls.filter((call) => call.providerKey === toolProviderKey).length, 1);
    await database.query(
      "UPDATE tool_records SET amount_cents = amount_cents - 1 WHERE id = $1",
      [toolRequest.tool_record_id],
    );

    const toolRetryDifferentKey = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(toolLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(toolRetryDifferentKey.response.status, 200);
    assert.equal(toolRetryDifferentKey.payload.data.paymentRequest.id, toolRequest.id);
    assert.equal(toolRetryDifferentKey.payload.data.paymentRequest.status, "processing");
    const reconciledTool = (await database.query(
      "SELECT * FROM tool_invoice_payment_requests WHERE id = $1",
      [toolRequest.id],
    )).rows[0];
    assert.equal(reconciledTool.status, "processing");
    assert.equal(reconciledTool.stripe_checkout_session_id, toolProviderSession.id);
    assert.equal((await database.query(
      `SELECT count(*)::int AS count FROM tool_invoice_payment_requests tipr
       INNER JOIN tool_records tr ON tr.id = tipr.tool_record_id
       WHERE tr.account_id = $1 AND tr.local_id = $2`,
      [merchant.id, toolLocalId],
    )).rows[0].count, 1);

    const replayTerminalLocalId = `invoice:replay-terminal-${randomUUID()}`;
    await createToolInvoice(baseUrl, merchant, replayTerminalLocalId, 7700);
    queuedCheckoutModes.push("lost_then_terminal");
    const replayTerminalFirst = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(replayTerminalLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(replayTerminalFirst.response.status, 504);
    const replayTerminalRow = (await database.query(
      `SELECT tipr.* FROM tool_invoice_payment_requests tipr
       INNER JOIN tool_records tr ON tr.id = tipr.tool_record_id
       WHERE tr.account_id = $1 AND tr.local_id = $2`,
      [merchant.id, replayTerminalLocalId],
    )).rows[0];
    const laterFourHundred = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(replayTerminalLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(laterFourHundred.response.status, 502);
    assert.equal((await database.query(
      "SELECT status FROM tool_invoice_payment_requests WHERE id = $1",
      [replayTerminalRow.id],
    )).rows[0].status, "created");
    const replayTerminalRecovered = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(replayTerminalLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(replayTerminalRecovered.response.status, 200);
    assert.equal(replayTerminalRecovered.payload.data.paymentRequest.id, replayTerminalRow.id);
    assert.equal(replayTerminalRecovered.payload.data.paymentRequest.status, "open");
    const toolCalls = checkoutCalls.filter((call) => call.providerKey === toolProviderKey);
    assert.equal(toolCalls.length, 2);
    assert.equal(toolCalls[0].body, toolCalls[1].body);
    assert.equal(new Set(toolCalls.map((call) => call.providerKey)).size, 1);

    const toolSameHttpKeyReplay = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(toolLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: toolFirstKey },
    );
    assert.equal(toolSameHttpKeyReplay.response.status, 201);
    assert.equal(toolSameHttpKeyReplay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(toolSameHttpKeyReplay.payload.data.paymentRequest.id, toolRequest.id);
    assert.equal(checkoutCalls.filter((call) => call.providerKey === toolProviderKey).length, 2);

    const projectInvoice = await createProjectInvoice(baseUrl, contractor, merchant);
    queuedCheckoutModes.push("accepted_response_lost");
    const lostProjectLink = await requestJson(baseUrl, `/api/v1/project-invoices/${projectInvoice.id}/bank-payment-link`, {
      method: "POST",
      cookie: merchant.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(lostProjectLink.response.status, 504);
    const projectRowsAfterLoss = await database.query(
      "SELECT * FROM project_invoice_payment_requests WHERE invoice_id = $1",
      [projectInvoice.id],
    );
    assert.equal(projectRowsAfterLoss.rowCount, 1);
    const projectRequest = projectRowsAfterLoss.rows[0];
    assert.equal(projectRequest.status, "created");
    const projectCancel = await requestJson(baseUrl, `/api/v1/project-invoices/${projectInvoice.id}/bank-payment-link/cancel`, {
      method: "POST",
      cookie: merchant.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(projectCancel.response.status, 409);
    assert.equal(projectCancel.payload.error.code, "BANK_PAYMENT_LINK_RECONCILIATION_REQUIRED");
    assert.equal(expireCalls, 0);

    const projectRetry = await requestJson(baseUrl, `/api/v1/project-invoices/${projectInvoice.id}/bank-payment-link`, {
      method: "POST",
      cookie: merchant.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(projectRetry.response.status, 200);
    assert.equal(projectRetry.payload.data.paymentRequest.id, projectRequest.id);
    assert.equal(projectRetry.payload.data.paymentRequest.status, "open");
    const projectProviderKey = `rivt-invoice-payment-${projectRequest.id}`;
    const projectCalls = checkoutCalls.filter((call) => call.providerKey === projectProviderKey);
    assert.equal(projectCalls.length, 2);
    assert.equal(projectCalls[0].body, projectCalls[1].body);
    assert.equal((await database.query(
      "SELECT count(*)::int AS count FROM project_invoice_payment_requests WHERE invoice_id = $1",
      [projectInvoice.id],
    )).rows[0].count, 1);

    const ambiguousLocalId = `invoice:ambiguous-${randomUUID()}`;
    await createToolInvoice(baseUrl, merchant, ambiguousLocalId, 9900);
    queuedCheckoutModes.push("idempotency_error");
    const ambiguousFirst = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(ambiguousLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(ambiguousFirst.response.status, 502);
    const ambiguousRow = (await database.query(
      `SELECT tipr.* FROM tool_invoice_payment_requests tipr
       INNER JOIN tool_records tr ON tr.id = tipr.tool_record_id
       WHERE tr.account_id = $1 AND tr.local_id = $2`,
      [merchant.id, ambiguousLocalId],
    )).rows[0];
    assert.equal(ambiguousRow.status, "created");
    const ambiguousRetry = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(ambiguousLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(ambiguousRetry.response.status, 200);
    assert.equal(ambiguousRetry.payload.data.paymentRequest.id, ambiguousRow.id);
    assert.equal((await database.query(
      `SELECT count(*)::int AS count FROM tool_invoice_payment_requests tipr
       INNER JOIN tool_records tr ON tr.id = tipr.tool_record_id
       WHERE tr.account_id = $1 AND tr.local_id = $2`,
      [merchant.id, ambiguousLocalId],
    )).rows[0].count, 1);

    const terminalLocalId = `invoice:terminal-${randomUUID()}`;
    await createToolInvoice(baseUrl, merchant, terminalLocalId, 8800);
    queuedCheckoutModes.push("terminal");
    const terminalFailure = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(terminalLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(terminalFailure.response.status, 502);
    assert.equal((await database.query(
      `SELECT tipr.status FROM tool_invoice_payment_requests tipr
       INNER JOIN tool_records tr ON tr.id = tipr.tool_record_id
       WHERE tr.account_id = $1 AND tr.local_id = $2`,
      [merchant.id, terminalLocalId],
    )).rows[0].status, "failed");
    queuedCheckoutModes.push("success");
    const afterTerminal = await requestJson(
      baseUrl,
      `/api/v1/tool-invoices/${encodeURIComponent(terminalLocalId)}/bank-payment-link`,
      { method: "POST", cookie: merchant.cookie, idempotencyKey: randomUUID() },
    );
    assert.equal(afterTerminal.response.status, 201);
    assert.equal(afterTerminal.payload.data.paymentRequest.status, "open");
    assert.equal((await database.query(
      `SELECT count(*)::int AS count FROM tool_invoice_payment_requests tipr
       INNER JOIN tool_records tr ON tr.id = tipr.tool_record_id
       WHERE tr.account_id = $1 AND tr.local_id = $2`,
      [merchant.id, terminalLocalId],
    )).rows[0].count, 2);

    assert.equal(providerSessions.size, 5);
  });
}
