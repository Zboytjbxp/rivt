import { ApiError, asyncRoute, validate, z } from "./api.js";
import { verifyStripeSignature } from "./billing.js";
import { logInfo } from "./logger.js";

const STRIPE_API_VERSION = "2026-02-25.clover";
const SETTLED_PAYMENT_STATUSES = new Set(["paid", "partially_refunded"]);
const ACTIVE_PAYMENT_STATUSES = new Set(["created", "open", "processing"]);
const ACH_MIN_AMOUNT_CENTS = 50;
const ACH_MAX_AMOUNT_CENTS = 99_999_999;
const invoiceIdSchema = z.uuid();
const onboardingInputSchema = z.object({
  activeWorkId: z.uuid().optional(),
});

function envValue(name, fallback = undefined) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function connectConfig(appOrigin) {
  const secretKey = envValue("STRIPE_SECRET_KEY");
  const webhookSecret = envValue("STRIPE_CONNECT_WEBHOOK_SECRET");
  const enabled = envValue("STRIPE_CONNECT_ACH_ENABLED") === "true";
  const missing = [];
  if (!enabled) missing.push("STRIPE_CONNECT_ACH_ENABLED");
  if (!secretKey) missing.push("STRIPE_SECRET_KEY");
  if (!webhookSecret) missing.push("STRIPE_CONNECT_WEBHOOK_SECRET");
  return {
    secretKey,
    webhookSecret,
    enabled,
    appOrigin,
    configured: missing.length === 0,
    missing,
  };
}

export function stripeConnectProviderStatus(appOrigin) {
  const config = connectConfig(appOrigin);
  return {
    provider: "stripe_connect",
    enabled: config.enabled,
    configured: config.configured,
    webhookConfigured: Boolean(config.webhookSecret),
    mode: config.configured ? "configured" : "setup_required",
  };
}

function encodeForm(params) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    form.set(key, String(value));
  }
  return form;
}

async function stripeConnectRequest(config, path, params = {}, options = {}) {
  if (!config.secretKey) {
    throw new ApiError(424, "STRIPE_CONNECT_NOT_CONFIGURED", "Stripe Connect is not configured.", {
      missing: ["STRIPE_SECRET_KEY"],
    });
  }
  const method = options.method ?? "POST";
  const body = method === "GET" ? undefined : encodeForm(params);
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(options.connectedAccountId ? { "Stripe-Account": options.connectedAccountId } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, "STRIPE_CONNECT_REQUEST_FAILED", "Stripe could not complete the bank-payment request.", {
      providerStatus: response.status,
      type: payload?.error?.type,
      code: payload?.error?.code,
      message: payload?.error?.message,
    });
  }
  return payload;
}

function requireVerifiedActor(actor) {
  if (actor.account.status !== "active") {
    throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "Complete account setup before enabling bank payments.");
  }
  if (!actor.account.emailVerified) {
    throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email before enabling bank payments.");
  }
}

function capabilityStatus(account, key) {
  const value = account?.capabilities?.[key];
  return ["active", "pending", "inactive"].includes(value) ? value : "unrequested";
}

function onboardingStatus(account, achStatus = capabilityStatus(account, "us_bank_account_ach_payments")) {
  if (account?.charges_enabled && account?.payouts_enabled && account?.details_submitted && achStatus === "active") {
    return "ready";
  }
  if (account?.requirements?.disabled_reason || account?.charges_enabled === false && account?.details_submitted) {
    return account?.requirements?.disabled_reason ? "restricted" : "pending";
  }
  return account?.details_submitted ? "pending" : "not_started";
}

async function persistConnectAccount(client, accountId, account) {
  const achStatus = capabilityStatus(account, "us_bank_account_ach_payments");
  const status = onboardingStatus(account, achStatus);
  const result = await client.query(
    `INSERT INTO stripe_connect_accounts (
       account_id, stripe_account_id, country, currency, charges_enabled,
       payouts_enabled, details_submitted, ach_payments_status, onboarding_status,
       last_synced_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
     ON CONFLICT (account_id) DO UPDATE
       SET stripe_account_id = EXCLUDED.stripe_account_id,
           country = EXCLUDED.country,
           currency = EXCLUDED.currency,
           charges_enabled = EXCLUDED.charges_enabled,
           payouts_enabled = EXCLUDED.payouts_enabled,
           details_submitted = EXCLUDED.details_submitted,
           ach_payments_status = EXCLUDED.ach_payments_status,
           onboarding_status = EXCLUDED.onboarding_status,
           last_synced_at = now(),
           updated_at = now()
     RETURNING *`,
    [
      accountId,
      account.id,
      String(account.country ?? "US").toUpperCase(),
      String(account.default_currency ?? "usd").toLowerCase(),
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      Boolean(account.details_submitted),
      achStatus,
      status,
    ],
  );
  return result.rows[0];
}

async function syncConnectAccount(database, config, row) {
  if (!row || !config.secretKey) return row ?? null;
  const account = await stripeConnectRequest(
    config,
    `/accounts/${encodeURIComponent(row.stripe_account_id)}`,
    {},
    { method: "GET" },
  );
  return persistConnectAccount(database, row.account_id, account);
}

function mapConnectStatus(row, config) {
  const onboarding = row?.onboarding_status ?? "not_started";
  const achStatus = row?.ach_payments_status ?? "unrequested";
  return {
    provider: "stripe_connect",
    providerConfigured: config.configured,
    webhookConfigured: Boolean(config.webhookSecret),
    missing: config.missing,
    connected: Boolean(row),
    onboardingStatus: onboarding,
    achPaymentsStatus: achStatus,
    chargesEnabled: Boolean(row?.charges_enabled),
    payoutsEnabled: Boolean(row?.payouts_enabled),
    detailsSubmitted: Boolean(row?.details_submitted),
    ready: config.configured && onboarding === "ready" && achStatus === "active",
    lastSyncedAt: row?.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
  };
}

function mapPaymentRequest(row, { includeCheckoutUrl = true } = {}) {
  return {
    id: row.id,
    invoiceId: row.invoice_id ?? row.invoiceId,
    amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
    refundedCents: Number(row.refunded_cents ?? row.refundedCents ?? 0),
    currency: row.currency ?? "usd",
    status: row.status,
    paymentMethodType: row.payment_method_type ?? row.paymentMethodType ?? null,
    checkoutUrl: includeCheckoutUrl ? (row.checkout_url ?? row.checkoutUrl ?? null) : undefined,
    expiresAt: toIso(row.expires_at ?? row.expiresAt),
    paidAt: toIso(row.paid_at ?? row.paidAt),
    failedAt: toIso(row.failed_at ?? row.failedAt),
    disputedAt: toIso(row.disputed_at ?? row.disputedAt),
    refundedAt: toIso(row.refunded_at ?? row.refundedAt),
    createdAt: toIso(row.created_at ?? row.createdAt),
    updatedAt: toIso(row.updated_at ?? row.updatedAt),
  };
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function providerContributionCents(row) {
  if (!SETTLED_PAYMENT_STATUSES.has(row.status)) return 0;
  return Math.max(0, Number(row.amount_cents ?? 0) - Number(row.refunded_cents ?? 0));
}

function assertAchAmount(amountCents) {
  if (amountCents < ACH_MIN_AMOUNT_CENTS) {
    throw new ApiError(422, "BANK_PAYMENT_BELOW_MINIMUM", "Stripe bank payments must be at least $0.50.");
  }
  if (amountCents > ACH_MAX_AMOUNT_CENTS) {
    throw new ApiError(422, "BANK_PAYMENT_ABOVE_MAXIMUM", "A single Stripe bank payment cannot exceed $999,999.99.");
  }
}

async function invoicePaidCents(client, invoiceId) {
  const external = await client.query(
    "SELECT COALESCE(sum(amount_cents), 0)::int AS amount FROM project_invoice_payments WHERE invoice_id = $1",
    [invoiceId],
  );
  const provider = await client.query(
    `SELECT COALESCE(sum(
       CASE WHEN status IN ('paid', 'partially_refunded')
         THEN amount_cents - refunded_cents ELSE 0 END
     ), 0)::int AS amount
     FROM project_invoice_payment_requests
     WHERE invoice_id = $1`,
    [invoiceId],
  );
  return Number(external.rows[0]?.amount ?? 0) + Number(provider.rows[0]?.amount ?? 0);
}

async function syncInvoiceStatus(client, requestRow) {
  const invoiceResult = await client.query(
    "SELECT * FROM project_invoices WHERE id = $1 FOR UPDATE",
    [requestRow.invoice_id],
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice || invoice.status === "void") return invoice ?? null;
  const paidCents = await invoicePaidCents(client, invoice.id);
  const nextStatus = paidCents >= Number(invoice.total_cents) ? "paid" : "sent";
  const updated = await client.query(
    `UPDATE project_invoices
     SET status = $2,
         sent_at = COALESCE(sent_at, now()),
         paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [invoice.id, nextStatus],
  );
  return updated.rows[0];
}

function eventPaymentUpdate(event) {
  const object = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed":
      return {
        lookup: { sessionId: object.id },
        status: object.payment_status === "paid" ? "paid" : "processing",
        paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id,
      };
    case "checkout.session.async_payment_succeeded":
      return {
        lookup: { sessionId: object.id },
        status: "paid",
        paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id,
      };
    case "checkout.session.async_payment_failed":
      return {
        lookup: { sessionId: object.id },
        status: "failed",
        paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id,
      };
    case "checkout.session.expired":
      return { lookup: { sessionId: object.id }, status: "expired" };
    case "payment_intent.processing":
      return { lookup: { paymentIntentId: object.id }, status: "processing" };
    case "payment_intent.succeeded":
      return { lookup: { paymentIntentId: object.id }, status: "paid" };
    case "payment_intent.payment_failed":
      return {
        lookup: { paymentIntentId: object.id },
        status: "failed",
        failureCode: object.last_payment_error?.code ?? "payment_failed",
      };
    case "charge.dispute.created":
      return {
        lookup: {
          paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id,
        },
        status: "disputed",
      };
    case "charge.refunded": {
      const amount = Number(object.amount ?? 0);
      const refundedCents = Math.max(0, Number(object.amount_refunded ?? 0));
      return {
        lookup: {
          paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id,
        },
        status: refundedCents >= amount ? "refunded" : "partially_refunded",
        refundedCents,
      };
    }
    default:
      return null;
  }
}

function nextPaymentStatus(currentStatus, requestedStatus) {
  if (currentStatus === requestedStatus) return currentStatus;
  const allowed = {
    created: new Set(["open", "processing", "paid", "failed", "expired"]),
    open: new Set(["processing", "paid", "failed", "expired"]),
    processing: new Set(["paid", "failed", "disputed"]),
    paid: new Set(["failed", "disputed", "partially_refunded", "refunded"]),
    partially_refunded: new Set(["partially_refunded", "disputed", "refunded"]),
    failed: new Set(),
    expired: new Set(),
    disputed: new Set(["partially_refunded", "refunded"]),
    refunded: new Set(),
  };
  return allowed[currentStatus]?.has(requestedStatus) ? requestedStatus : currentStatus;
}

async function processConnectEvent(database, event, requestId, createInAppNotification) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const object = event.data?.object ?? {};
    const insertedEvent = await client.query(
      `INSERT INTO stripe_connect_events (
         stripe_event_id, event_type, stripe_connected_account_id, provider_object_id, livemode
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING stripe_event_id`,
      [event.id, event.type, event.account ?? null, object.id ?? null, Boolean(event.livemode)],
    );
    if (!insertedEvent.rowCount) {
      await client.query("COMMIT");
      return { processed: false, duplicate: true };
    }

    if (event.type === "account.updated" && object.id) {
      const accountRow = await client.query(
        "SELECT account_id FROM stripe_connect_accounts WHERE stripe_account_id = $1 LIMIT 1",
        [object.id],
      );
      if (accountRow.rowCount) await persistConnectAccount(client, accountRow.rows[0].account_id, object);
      await client.query("COMMIT");
      return { processed: true, duplicate: false, accountUpdated: Boolean(accountRow.rowCount) };
    }

    const update = eventPaymentUpdate(event);
    if (!update) {
      await client.query("COMMIT");
      return { processed: true, duplicate: false, ignored: true };
    }

    const metadataRequestId = typeof object.metadata?.payment_request_id === "string"
      ? object.metadata.payment_request_id
      : null;
    const requestResult = metadataRequestId
      ? await client.query(
        `SELECT * FROM project_invoice_payment_requests
         WHERE id::text = $1
           AND ($2::text IS NULL OR stripe_connected_account_id = $2)
         FOR UPDATE`,
        [metadataRequestId, event.account ?? null],
      )
      : update.lookup.sessionId
        ? await client.query(
          `SELECT * FROM project_invoice_payment_requests
           WHERE stripe_checkout_session_id = $1
             AND ($2::text IS NULL OR stripe_connected_account_id = $2)
           FOR UPDATE`,
          [update.lookup.sessionId, event.account ?? null],
        )
        : update.lookup.paymentIntentId
          ? await client.query(
            `SELECT * FROM project_invoice_payment_requests
             WHERE stripe_payment_intent_id = $1
               AND ($2::text IS NULL OR stripe_connected_account_id = $2)
             FOR UPDATE`,
            [update.lookup.paymentIntentId, event.account ?? null],
          )
          : { rows: [] };
    const paymentRequest = requestResult.rows[0];
    if (!paymentRequest) {
      await client.query("COMMIT");
      return { processed: true, duplicate: false, matched: false };
    }

    const acceptedStatus = nextPaymentStatus(paymentRequest.status, update.status);
    const stateChanged = acceptedStatus !== paymentRequest.status
      || Number(update.refundedCents ?? 0) > Number(paymentRequest.refunded_cents ?? 0);
    const updatedRequest = await client.query(
      `UPDATE project_invoice_payment_requests
       SET status = $2,
           stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
           payment_method_type = COALESCE(payment_method_type, 'us_bank_account'),
           failure_code = COALESCE($4, failure_code),
           refunded_cents = GREATEST(refunded_cents, COALESCE($5, refunded_cents)),
           paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
           failed_at = CASE WHEN $2 = 'failed' THEN COALESCE(failed_at, now()) ELSE failed_at END,
           disputed_at = CASE WHEN $2 = 'disputed' THEN COALESCE(disputed_at, now()) ELSE disputed_at END,
           refunded_at = CASE WHEN $2 IN ('refunded', 'partially_refunded') THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        paymentRequest.id,
        acceptedStatus,
        update.paymentIntentId ?? null,
        update.failureCode ?? null,
        update.refundedCents ?? null,
      ],
    );
    const nextRequest = updatedRequest.rows[0];
    const invoice = await syncInvoiceStatus(client, nextRequest);
    const statusCopy = stateChanged ? {
      paid: "Bank payment settled",
      failed: "Bank payment failed",
      disputed: "Bank payment disputed",
      refunded: "Bank payment refunded",
      partially_refunded: "Bank payment partially refunded",
    }[nextRequest.status] : undefined;
    if (statusCopy) {
      const eventAmountCents = ["refunded", "partially_refunded"].includes(nextRequest.status)
        ? Number(nextRequest.refunded_cents)
        : Number(nextRequest.amount_cents);
      await client.query(
        `INSERT INTO project_entries (project_id, active_work_id, actor_account_id, entry_type, body, metadata)
         VALUES ($1, $2, $3, 'system', $4, $5::jsonb)`,
        [
          nextRequest.project_id,
          nextRequest.active_work_id,
          nextRequest.merchant_account_id,
          `${statusCopy}: $${(eventAmountCents / 100).toFixed(2)}.`,
          JSON.stringify({
            invoiceId: nextRequest.invoice_id,
            paymentRequestId: nextRequest.id,
            status: nextRequest.status,
            source: "stripe_connect",
          }),
        ],
      );
    }
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2, 'project.invoice.bank_payment_updated', 'project_invoice_payment_request', $3, $4::jsonb)`,
      [
        requestId,
        nextRequest.merchant_account_id,
        nextRequest.id,
        JSON.stringify({
          invoiceId: nextRequest.invoice_id,
          stripeEventId: event.id,
          eventType: event.type,
          status: nextRequest.status,
          invoiceStatus: invoice?.status ?? null,
        }),
      ],
    );
    if (statusCopy && createInAppNotification) {
      await createInAppNotification(client, {
        accountId: nextRequest.merchant_account_id,
        type: "work",
        title: statusCopy,
        body: `Invoice payment status: ${nextRequest.status.replaceAll("_", " ")}.`,
        actionHref: `/app/tools?tool=invoice&activeWork=${nextRequest.active_work_id}`,
        sourceType: "project_invoice_payment_request",
        sourceId: nextRequest.id,
        priority: nextRequest.status === "paid" ? "normal" : "high",
        metadata: {
          activeWorkId: nextRequest.active_work_id,
          projectId: nextRequest.project_id,
          invoiceId: nextRequest.invoice_id,
          paymentRequestId: nextRequest.id,
        },
      });
    }

    await client.query("COMMIT");
    return { processed: true, duplicate: false, matched: true, paymentRequestId: nextRequest.id };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function registerStripeConnectWebhookRoute({
  app,
  express,
  database,
  appOrigin,
  createRequestContext,
  createRequestLogger,
  createInAppNotification,
}) {
  app.post(
    "/api/stripe/connect/webhook",
    createRequestContext,
    createRequestLogger(),
    express.raw({ type: "application/json", limit: "2mb" }),
    asyncRoute(async (request, response) => {
      const config = connectConfig(appOrigin);
      if (!config.webhookSecret) {
        throw new ApiError(503, "STRIPE_CONNECT_WEBHOOK_NOT_CONFIGURED", "Stripe Connect webhook signing is not configured.", {
          missing: ["STRIPE_CONNECT_WEBHOOK_SECRET"],
        });
      }
      if (!database) throw new ApiError(503, "ACCOUNT_STORAGE_UNAVAILABLE", "Managed account storage is unavailable.");
      const signature = request.get("stripe-signature");
      if (!verifyStripeSignature(request.body, signature, config.webhookSecret)) {
        throw new ApiError(400, "STRIPE_SIGNATURE_INVALID", "Stripe webhook signature is invalid.");
      }
      const event = JSON.parse(request.body.toString("utf8"));
      const result = await processConnectEvent(database, event, request.requestId, createInAppNotification);
      logInfo("stripe_connect.webhook_processed", {
        requestId: request.requestId,
        stripeEventId: event.id,
        eventType: event.type,
        connectedAccountId: event.account ?? null,
        duplicate: Boolean(result.duplicate),
        matched: result.matched ?? null,
      });
      response.json({ received: true, duplicate: Boolean(result.duplicate) });
    }),
  );
}

export function registerStripeConnectRoutes({
  app,
  database,
  appOrigin,
  requireAuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  publicPaymentRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  app.get("/api/v1/payments/connect/status", requireAuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const config = connectConfig(appOrigin);
    let row = (await database.query(
      "SELECT * FROM stripe_connect_accounts WHERE account_id = $1 LIMIT 1",
      [request.actor.account.id],
    )).rows[0] ?? null;
    if (row && config.secretKey) row = await syncConnectAccount(database, config, row);
    response.json({ data: { connect: mapConnectStatus(row, config) }, meta: { requestId: request.requestId } });
  }));

  app.post("/api/v1/payments/connect/onboarding", requireAuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const config = connectConfig(appOrigin);
    const input = validate(onboardingInputSchema, request.body ?? {});
    requireVerifiedActor(request.actor);
    if (!config.configured) {
      throw new ApiError(424, "STRIPE_CONNECT_PROVIDER_UNAVAILABLE", "Bank-payment onboarding is not configured yet.", {
        provider: "stripe_connect",
        mode: "setup_required",
        missing: config.missing,
      });
    }
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      "stripe_connect.onboarding",
      async (client) => {
        let row = (await client.query(
          "SELECT * FROM stripe_connect_accounts WHERE account_id = $1 FOR UPDATE",
          [request.actor.account.id],
        )).rows[0] ?? null;
        if (!row) {
          const account = await stripeConnectRequest(config, "/accounts", {
            type: "express",
            country: "US",
            email: request.actor.account.email,
            "capabilities[transfers][requested]": "true",
            "capabilities[us_bank_account_ach_payments][requested]": "true",
            "metadata[rivt_account_id]": request.actor.account.id,
          }, { idempotencyKey: `rivt-connect-account-${request.actor.account.id}` });
          row = await persistConnectAccount(client, request.actor.account.id, account);
        } else {
          row = await syncConnectAccount(client, config, row);
        }
        const returnParams = new URLSearchParams({ tool: "invoice", connect: "return" });
        const refreshParams = new URLSearchParams({ tool: "invoice", connect: "refresh" });
        if (input.activeWorkId) {
          returnParams.set("activeWork", input.activeWorkId);
          refreshParams.set("activeWork", input.activeWorkId);
        }
        const returnUrl = `${config.appOrigin}/app/tools?${returnParams}`;
        const refreshUrl = `${config.appOrigin}/app/tools?${refreshParams}`;
        const link = await stripeConnectRequest(config, "/account_links", {
          account: row.stripe_account_id,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: "account_onboarding",
          "collection_options[fields]": "eventually_due",
        });
        await client.query(
          `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
           VALUES ($1, $2, 'stripe_connect.onboarding_opened', 'stripe_connected_account', $3, $4::jsonb)`,
          [
            request.requestId,
            request.actor.account.id,
            row.stripe_account_id,
            JSON.stringify({ onboardingStatus: row.onboarding_status }),
          ],
        );
        return {
          status: 201,
          body: {
            data: {
              url: link.url,
              expiresAt: toIso(Number(link.expires_at) * 1000),
              connect: mapConnectStatus(row, config),
            },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.post("/api/v1/payments/connect/dashboard", requireAuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const config = connectConfig(appOrigin);
    requireVerifiedActor(request.actor);
    if (!config.configured) {
      throw new ApiError(424, "STRIPE_CONNECT_PROVIDER_UNAVAILABLE", "Bank-payment account management is not configured yet.", {
        provider: "stripe_connect",
        mode: "setup_required",
        missing: config.missing,
      });
    }
    const row = (await database.query(
      "SELECT * FROM stripe_connect_accounts WHERE account_id = $1 LIMIT 1",
      [request.actor.account.id],
    )).rows[0];
    if (!row) {
      throw new ApiError(409, "STRIPE_CONNECT_ONBOARDING_REQUIRED", "Set up bank payments before opening the Stripe account.");
    }
    const link = await stripeConnectRequest(
      config,
      `/accounts/${encodeURIComponent(row.stripe_account_id)}/login_links`,
    );
    await database.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2, 'stripe_connect.dashboard_opened', 'stripe_connected_account', $3, '{}'::jsonb)`,
      [request.requestId, request.actor.account.id, row.stripe_account_id],
    );
    response.status(201).json({
      data: { url: link.url },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/project-invoices/:id/bank-payment-link", requireAuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const config = connectConfig(appOrigin);
    requireVerifiedActor(request.actor);
    if (!config.configured) {
      throw new ApiError(424, "STRIPE_CONNECT_PROVIDER_UNAVAILABLE", "Bank payments are not configured yet.", {
        provider: "stripe_connect",
        mode: "setup_required",
        missing: config.missing,
      });
    }
    const invoiceId = validate(invoiceIdSchema, request.params.id);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `stripe_connect.invoice_link:${invoiceId}`,
      async (client) => {
        const invoiceResult = await client.query(
          `SELECT pi.*, pr.organization_id, pr.contractor_account_id, pr.tradesperson_account_id
           FROM project_invoices pi
           INNER JOIN projects pr ON pr.id = pi.project_id
           INNER JOIN work_participants wp ON wp.active_work_id = pi.active_work_id
           WHERE pi.id = $1 AND wp.account_id = $2
           FOR UPDATE OF pi`,
          [invoiceId, request.actor.account.id],
        );
        const invoice = invoiceResult.rows[0];
        if (!invoice) throw new ApiError(404, "PROJECT_INVOICE_NOT_FOUND", "Project invoice not found.");
        if (invoice.created_by_account_id !== request.actor.account.id) {
          throw new ApiError(403, "PROJECT_INVOICE_AUTHOR_REQUIRED", "Only the invoice author can create its bank-payment link.");
        }
        if (invoice.status === "void") throw new ApiError(409, "PROJECT_INVOICE_VOID", "A void invoice cannot accept a bank payment.");
        const paidCents = await invoicePaidCents(client, invoiceId);
        const balanceCents = Math.max(0, Number(invoice.total_cents) - paidCents);
        if (!balanceCents || invoice.status === "paid") {
          throw new ApiError(409, "PROJECT_INVOICE_ALREADY_PAID", "This invoice does not have a remaining balance.");
        }
        assertAchAmount(balanceCents);
        const activeRequest = await client.query(
          `SELECT * FROM project_invoice_payment_requests
           WHERE invoice_id = $1 AND status = ANY($2::text[])
           ORDER BY created_at DESC LIMIT 1`,
          [invoiceId, [...ACTIVE_PAYMENT_STATUSES]],
        );
        if (activeRequest.rowCount) {
          const existing = activeRequest.rows[0];
          return {
            status: 200,
            body: {
              data: { paymentRequest: mapPaymentRequest(existing) },
              meta: { requestId: request.requestId, existing: true },
            },
          };
        }
        let connectRow = (await client.query(
          "SELECT * FROM stripe_connect_accounts WHERE account_id = $1 FOR UPDATE",
          [request.actor.account.id],
        )).rows[0] ?? null;
        if (!connectRow) {
          throw new ApiError(409, "STRIPE_CONNECT_ONBOARDING_REQUIRED", "Finish bank-payment setup before creating a payment link.");
        }
        connectRow = await syncConnectAccount(client, config, connectRow);
        const connectStatus = mapConnectStatus(connectRow, config);
        if (!connectStatus.ready) {
          throw new ApiError(409, "STRIPE_CONNECT_NOT_READY", "Stripe is still reviewing this bank-payment account.", {
            connect: connectStatus,
          });
        }
        const paymentRequest = (await client.query(
          `INSERT INTO project_invoice_payment_requests (
             invoice_id, project_id, active_work_id, merchant_account_id,
             stripe_connected_account_id, amount_cents, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'created')
           RETURNING *`,
          [
            invoice.id,
            invoice.project_id,
            invoice.active_work_id,
            request.actor.account.id,
            connectRow.stripe_account_id,
            balanceCents,
          ],
        )).rows[0];
        let session;
        try {
          session = await stripeConnectRequest(config, "/checkout/sessions", {
            mode: "payment",
            customer_creation: "always",
            success_url: `${config.appOrigin}/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.appOrigin}/payment/complete?cancelled=1`,
            customer_email: invoice.recipient_email || undefined,
            client_reference_id: paymentRequest.id,
            "payment_method_types[0]": "us_bank_account",
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][unit_amount]": balanceCents,
            "line_items[0][price_data][product_data][name]": `Invoice ${invoice.invoice_number}`,
            "line_items[0][price_data][product_data][description]": invoice.pay_to
              ? `Payment to ${invoice.pay_to}`
              : "Invoice bank payment",
            "line_items[0][quantity]": "1",
            "metadata[payment_request_id]": paymentRequest.id,
            "metadata[invoice_id]": invoice.id,
            "metadata[merchant_account_id]": request.actor.account.id,
            "payment_intent_data[metadata][payment_request_id]": paymentRequest.id,
            "payment_intent_data[metadata][invoice_id]": invoice.id,
            "payment_intent_data[metadata][merchant_account_id]": request.actor.account.id,
          }, {
            connectedAccountId: connectRow.stripe_account_id,
            idempotencyKey: `rivt-invoice-payment-${paymentRequest.id}`,
          });
        } catch (error) {
          await client.query(
            `UPDATE project_invoice_payment_requests
             SET status = 'failed', failure_code = 'checkout_create_failed', failed_at = now(), updated_at = now()
             WHERE id = $1`,
            [paymentRequest.id],
          );
          throw error;
        }
        const saved = (await client.query(
          `UPDATE project_invoice_payment_requests
           SET stripe_checkout_session_id = $2,
               checkout_url = $3,
               expires_at = to_timestamp($4),
               status = 'open',
               updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [paymentRequest.id, session.id, session.url, Number(session.expires_at)],
        )).rows[0];
        await client.query(
          `UPDATE project_invoices
           SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
               sent_at = COALESCE(sent_at, now()),
               updated_at = now()
           WHERE id = $1`,
          [invoice.id],
        );
        await client.query(
          `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
           VALUES ($1, $2, $3, 'project.invoice.bank_payment_link_created', 'project_invoice_payment_request', $4, $5::jsonb)`,
          [
            request.requestId,
            request.actor.account.id,
            invoice.organization_id,
            saved.id,
            JSON.stringify({ invoiceId, amountCents: balanceCents, currency: "usd" }),
          ],
        );
        return {
          status: 201,
          body: {
            data: { paymentRequest: mapPaymentRequest(saved) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.post("/api/v1/project-invoices/:id/bank-payment-link/cancel", requireAuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const config = connectConfig(appOrigin);
    requireVerifiedActor(request.actor);
    const invoiceId = validate(invoiceIdSchema, request.params.id);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `stripe_connect.invoice_link.cancel:${invoiceId}`,
      async (client) => {
        const invoice = (await client.query(
          `SELECT pi.*
           FROM project_invoices pi
           INNER JOIN work_participants wp ON wp.active_work_id = pi.active_work_id
           WHERE pi.id = $1 AND wp.account_id = $2
           FOR UPDATE OF pi`,
          [invoiceId, request.actor.account.id],
        )).rows[0];
        if (!invoice) throw new ApiError(404, "PROJECT_INVOICE_NOT_FOUND", "Project invoice not found.");
        if (invoice.created_by_account_id !== request.actor.account.id) {
          throw new ApiError(403, "PROJECT_INVOICE_AUTHOR_REQUIRED", "Only the invoice author can cancel its bank-payment link.");
        }
        const paymentRequest = (await client.query(
          `SELECT * FROM project_invoice_payment_requests
           WHERE invoice_id = $1 AND status = ANY($2::text[])
           ORDER BY created_at DESC LIMIT 1
           FOR UPDATE`,
          [invoiceId, [...ACTIVE_PAYMENT_STATUSES]],
        )).rows[0];
        if (!paymentRequest) {
          throw new ApiError(409, "BANK_PAYMENT_LINK_NOT_ACTIVE", "This invoice has no active bank-payment link.");
        }
        if (paymentRequest.status === "processing") {
          throw new ApiError(409, "BANK_PAYMENT_PROCESSING", "This ACH payment is already processing and cannot be cancelled in RIVT.");
        }
        if (paymentRequest.stripe_checkout_session_id) {
          await stripeConnectRequest(
            config,
            `/checkout/sessions/${encodeURIComponent(paymentRequest.stripe_checkout_session_id)}/expire`,
            {},
            {
              connectedAccountId: paymentRequest.stripe_connected_account_id,
              idempotencyKey: `rivt-expire-payment-${paymentRequest.id}`,
            },
          );
        }
        const expired = (await client.query(
          `UPDATE project_invoice_payment_requests
           SET status = 'expired', updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [paymentRequest.id],
        )).rows[0];
        await client.query(
          `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
           VALUES ($1, $2, 'project.invoice.bank_payment_link_cancelled', 'project_invoice_payment_request', $3, $4::jsonb)`,
          [
            request.requestId,
            request.actor.account.id,
            expired.id,
            JSON.stringify({ invoiceId }),
          ],
        );
        return {
          status: 200,
          body: {
            data: { paymentRequest: mapPaymentRequest(expired) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.get("/api/v1/invoice-payments/:sessionId", publicPaymentRateLimit, asyncRoute(async (request, response) => {
    const sessionId = String(request.params.sessionId ?? "").trim();
    if (!/^cs_(?:test_|live_)?[A-Za-z0-9_]{12,200}$/.test(sessionId)) {
      throw new ApiError(404, "INVOICE_PAYMENT_NOT_FOUND", "Invoice payment not found.");
    }
    const result = await database.query(
      `SELECT pir.*, pi.invoice_number, pi.pay_to
       FROM project_invoice_payment_requests pir
       INNER JOIN project_invoices pi ON pi.id = pir.invoice_id
       WHERE pir.stripe_checkout_session_id = $1
       LIMIT 1`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) throw new ApiError(404, "INVOICE_PAYMENT_NOT_FOUND", "Invoice payment not found.");
    response.json({
      data: {
        payment: {
          invoiceNumber: row.invoice_number,
          payTo: row.pay_to || "Invoice issuer",
          amountCents: Number(row.amount_cents),
          refundedCents: Number(row.refunded_cents),
          currency: row.currency,
          status: row.status,
          paidAt: toIso(row.paid_at),
          failedAt: toIso(row.failed_at),
          disputedAt: toIso(row.disputed_at),
          refundedAt: toIso(row.refunded_at),
          updatedAt: toIso(row.updated_at),
        },
      },
      meta: { requestId: request.requestId },
    });
  }));
}

export const stripeConnectInternals = {
  ACTIVE_PAYMENT_STATUSES,
  ACH_MAX_AMOUNT_CENTS,
  ACH_MIN_AMOUNT_CENTS,
  SETTLED_PAYMENT_STATUSES,
  assertAchAmount,
  connectConfig,
  eventPaymentUpdate,
  mapConnectStatus,
  mapPaymentRequest,
  nextPaymentStatus,
  onboardingStatus,
  providerContributionCents,
};
