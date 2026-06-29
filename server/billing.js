import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError, asyncRoute } from "./api.js";
import { logInfo, logWarn } from "./logger.js";

const STRIPE_API_VERSION = "2026-02-25.clover";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function envValue(name, fallback = undefined) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function unixToIso(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

function unixToDate(seconds) {
  const iso = unixToIso(seconds);
  return iso ? new Date(iso) : null;
}

function billingConfig(appOrigin) {
  const secretKey = envValue("STRIPE_SECRET_KEY");
  const priceId = envValue("STRIPE_PRO_PRICE_ID", envValue("STRIPE_PRICE_ID"));
  const webhookSecret = envValue("STRIPE_WEBHOOK_SECRET");
  const successUrl = envValue("STRIPE_SUCCESS_URL", `${appOrigin}/app/profile/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`);
  const cancelUrl = envValue("STRIPE_CANCEL_URL", `${appOrigin}/app/profile/settings?billing=cancelled`);
  const portalReturnUrl = envValue("STRIPE_PORTAL_RETURN_URL", `${appOrigin}/app/profile/settings`);
  const missing = [];
  if (!secretKey) missing.push("STRIPE_SECRET_KEY");
  if (!priceId) missing.push("STRIPE_PRO_PRICE_ID");
  if (!webhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
  return {
    secretKey,
    priceId,
    webhookSecret,
    successUrl,
    cancelUrl,
    portalReturnUrl,
    configured: missing.length === 0,
    missing,
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

async function stripeRequest(config, path, params = {}, options = {}) {
  if (!config.secretKey) {
    throw new ApiError(424, "STRIPE_NOT_CONFIGURED", "Stripe is not configured.", { missing: ["STRIPE_SECRET_KEY"] });
  }
  const method = options.method ?? "POST";
  const body = method === "GET" ? undefined : encodeForm(params);
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, "STRIPE_REQUEST_FAILED", "Stripe could not complete the billing request.", {
      providerStatus: response.status,
      type: payload?.error?.type,
      code: payload?.error?.code,
      message: payload?.error?.message,
    });
  }
  return payload;
}

function safeCompareHex(leftHex, rightHex) {
  const left = Buffer.from(String(leftHex), "hex");
  const right = Buffer.from(String(rightHex), "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyStripeSignature(payload, signatureHeader, webhookSecret, toleranceSeconds = 300) {
  if (!signatureHeader || !webhookSecret) return false;
  const parts = String(signatureHeader).split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const timestamp = Number(timestampPart?.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!signatures.length) return false;
  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload)}`)
    .digest("hex");
  return signatures.some((signature) => safeCompareHex(signature, expected));
}

function publicBillingConfig(config) {
  return {
    checkoutConfigured: config.configured,
    webhookConfigured: Boolean(config.webhookSecret),
    portalConfigured: Boolean(config.secretKey),
    missing: config.missing,
  };
}

function mapBillingStatus(row, config) {
  const now = Date.now();
  const activeUntil = row?.active_until ? new Date(row.active_until) : null;
  const active = row?.plan === "pro"
    && ACTIVE_SUBSCRIPTION_STATUSES.has(row.status)
    && (!activeUntil || activeUntil.getTime() > now);
  return {
    active,
    plan: active ? "pro" : "free",
    status: row?.status ?? "inactive",
    source: row?.source ?? "stripe",
    activeUntil: activeUntil ? activeUntil.toISOString() : null,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    stripeSubscriptionId: row?.stripe_subscription_id ?? null,
    provider: publicBillingConfig(config),
  };
}

async function getBillingStatus(database, accountId, config) {
  const result = await database.query(
    `SELECT plan, status, source, stripe_subscription_id, active_until, cancel_at_period_end, updated_at
     FROM billing_entitlements
     WHERE account_id = $1
     LIMIT 1`,
    [accountId],
  );
  return mapBillingStatus(result.rows[0] ?? null, config);
}

async function upsertBillingCustomer(client, { accountId, stripeCustomerId, email }) {
  await client.query(
    `INSERT INTO billing_customers (account_id, stripe_customer_id, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (account_id) DO UPDATE
       SET stripe_customer_id = EXCLUDED.stripe_customer_id,
           email = COALESCE(EXCLUDED.email, billing_customers.email),
           updated_at = now()`,
    [accountId, stripeCustomerId, email ?? null],
  );
}

async function getOrCreateStripeCustomer(database, config, actor) {
  const existing = await database.query(
    "SELECT stripe_customer_id FROM billing_customers WHERE account_id = $1 LIMIT 1",
    [actor.account.id],
  );
  if (existing.rowCount) return existing.rows[0].stripe_customer_id;

  const customer = await stripeRequest(config, "/customers", {
    email: actor.account.email,
    name: actor.profile.displayName || actor.account.email,
    "metadata[account_id]": actor.account.id,
    "metadata[role]": actor.account.primaryRole,
  }, { idempotencyKey: `rivt-customer-${actor.account.id}` });

  await upsertBillingCustomer(database, {
    accountId: actor.account.id,
    stripeCustomerId: customer.id,
    email: actor.account.email,
  });
  return customer.id;
}

function requireBillingReady(config) {
  if (!config.configured) {
    throw new ApiError(424, "BILLING_PROVIDER_UNAVAILABLE", "Subscription billing is not configured yet.", {
      provider: "stripe",
      purpose: "subscription billing",
      mode: "setup_required",
      missing: config.missing,
    });
  }
}

function requireActiveVerifiedBillingActor(actor) {
  if (actor.account.status !== "active") {
    throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "Complete account setup before starting subscription billing.");
  }
  if (!actor.account.emailVerified) {
    throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email before starting subscription billing.");
  }
}

async function updateSubscriptionFromStripeObject(client, subscription, eventId = null) {
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const subscriptionId = subscription.id;
  if (!stripeCustomerId || !subscriptionId) return { accountId: null, updated: false };

  const accountIdFromMetadata = subscription.metadata?.account_id || subscription.metadata?.accountId;
  const accountResult = accountIdFromMetadata
    ? await client.query("SELECT id FROM accounts WHERE id = $1 LIMIT 1", [accountIdFromMetadata])
    : await client.query("SELECT account_id AS id FROM billing_customers WHERE stripe_customer_id = $1 LIMIT 1", [stripeCustomerId]);
  const accountId = accountResult.rows[0]?.id;
  if (!accountId) return { accountId: null, updated: false };

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const status = String(subscription.status ?? "unknown");
  const activeUntil = unixToDate(subscription.current_period_end);
  const trialEnd = unixToDate(subscription.trial_end);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

  await upsertBillingCustomer(client, {
    accountId,
    stripeCustomerId,
    email: null,
  });

  await client.query(
    `INSERT INTO billing_subscriptions (
       account_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
       status, current_period_end, cancel_at_period_end, trial_end, last_event_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (stripe_subscription_id) DO UPDATE
       SET account_id = EXCLUDED.account_id,
           stripe_customer_id = EXCLUDED.stripe_customer_id,
           stripe_price_id = EXCLUDED.stripe_price_id,
           status = EXCLUDED.status,
           current_period_end = EXCLUDED.current_period_end,
           cancel_at_period_end = EXCLUDED.cancel_at_period_end,
           trial_end = EXCLUDED.trial_end,
           last_event_id = EXCLUDED.last_event_id,
           updated_at = now()`,
    [accountId, stripeCustomerId, subscriptionId, priceId, status, activeUntil, cancelAtPeriodEnd, trialEnd, eventId],
  );

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(status);
  await client.query(
    `INSERT INTO billing_entitlements (
       account_id, plan, status, source, stripe_subscription_id, active_until, cancel_at_period_end, updated_at
     )
     VALUES ($1, $2, $3, 'stripe', $4, $5, $6, now())
     ON CONFLICT (account_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = EXCLUDED.status,
           source = EXCLUDED.source,
           stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           active_until = EXCLUDED.active_until,
           cancel_at_period_end = EXCLUDED.cancel_at_period_end,
           updated_at = now()`,
    [accountId, active ? "pro" : "free", status, subscriptionId, activeUntil, cancelAtPeriodEnd],
  );

  return { accountId, updated: true };
}

async function processStripeEvent(database, event) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO billing_events (stripe_event_id, event_type, livemode, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (stripe_event_id) DO NOTHING`,
      [event.id, event.type, Boolean(event.livemode), JSON.stringify(event)],
    );
    if (!inserted.rowCount) {
      await client.query("COMMIT");
      return { processed: false, duplicate: true };
    }

    const object = event.data?.object ?? {};
    let result = { processed: true, duplicate: false };
    if (event.type === "checkout.session.completed") {
      const accountId = object.metadata?.account_id || object.client_reference_id;
      const stripeCustomerId = typeof object.customer === "string" ? object.customer : object.customer?.id;
      if (accountId && stripeCustomerId) {
        await upsertBillingCustomer(client, {
          accountId,
          stripeCustomerId,
          email: object.customer_details?.email ?? object.customer_email ?? null,
        });
        result = { ...result, accountId };
      }
    } else if (event.type?.startsWith("customer.subscription.")) {
      result = { ...result, ...(await updateSubscriptionFromStripeObject(client, object, event.id)) };
    }

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function registerStripeWebhookRoute({
  app,
  express,
  database,
  appOrigin,
  createRequestContext,
  createRequestLogger,
}) {
  app.post(
    "/api/stripe/webhook",
    createRequestContext,
    createRequestLogger(),
    express.raw({ type: "application/json", limit: "2mb" }),
    asyncRoute(async (request, response) => {
      const config = billingConfig(appOrigin);
      if (!config.webhookSecret) {
        throw new ApiError(503, "STRIPE_WEBHOOK_NOT_CONFIGURED", "Stripe webhook signing is not configured.", {
          missing: ["STRIPE_WEBHOOK_SECRET"],
        });
      }
      if (!database) {
        throw new ApiError(503, "ACCOUNT_STORAGE_UNAVAILABLE", "Managed account storage is unavailable.");
      }
      const signature = request.get("stripe-signature");
      if (!verifyStripeSignature(request.body, signature, config.webhookSecret)) {
        throw new ApiError(400, "STRIPE_SIGNATURE_INVALID", "Stripe webhook signature is invalid.");
      }
      const event = JSON.parse(request.body.toString("utf8"));
      const result = await processStripeEvent(database, event);
      logInfo("billing.webhook_processed", {
        requestId: request.requestId,
        stripeEventId: event.id,
        eventType: event.type,
        duplicate: result.duplicate,
        accountId: result.accountId ?? null,
      });
      response.json({ received: true, duplicate: Boolean(result.duplicate) });
    }),
  );
}

export function registerBillingRoutes({
  app,
  database,
  appOrigin,
  requireAuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
}) {
  app.get("/api/v1/billing/status", requireAuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const config = billingConfig(appOrigin);
    const billing = await getBillingStatus(database, request.actor.account.id, config);
    response.json({ data: { billing }, meta: { requestId: request.requestId } });
  }));

  app.post("/api/v1/billing/checkout", requireAuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const config = billingConfig(appOrigin);
    requireBillingReady(config);
    requireActiveVerifiedBillingActor(request.actor);
    const customerId = await getOrCreateStripeCustomer(database, config, request.actor);
    const session = await stripeRequest(config, "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: request.actor.account.id,
      success_url: config.successUrl,
      cancel_url: config.cancelUrl,
      allow_promotion_codes: "true",
      "line_items[0][price]": config.priceId,
      "line_items[0][quantity]": "1",
      "metadata[account_id]": request.actor.account.id,
      "metadata[product]": "rivt_pro",
      "subscription_data[metadata][account_id]": request.actor.account.id,
      "subscription_data[metadata][product]": "rivt_pro",
    });
    await database.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2, 'billing.checkout_created', 'stripe_checkout_session', $3, $4)`,
      [request.requestId, request.actor.account.id, session.id, JSON.stringify({ mode: "subscription", priceId: config.priceId })],
    );
    response.status(201).json({ data: { url: session.url, sessionId: session.id }, meta: { requestId: request.requestId } });
  }));

  app.post("/api/v1/billing/portal", requireAuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const config = billingConfig(appOrigin);
    if (!config.secretKey) {
      throw new ApiError(424, "BILLING_PROVIDER_UNAVAILABLE", "Stripe is not configured yet.", {
        provider: "stripe",
        mode: "setup_required",
        missing: ["STRIPE_SECRET_KEY"],
      });
    }
    requireActiveVerifiedBillingActor(request.actor);
    const customer = await database.query(
      "SELECT stripe_customer_id FROM billing_customers WHERE account_id = $1 LIMIT 1",
      [request.actor.account.id],
    );
    if (!customer.rowCount) {
      throw new ApiError(404, "BILLING_CUSTOMER_NOT_FOUND", "Start a subscription before opening the billing portal.");
    }
    const session = await stripeRequest(config, "/billing_portal/sessions", {
      customer: customer.rows[0].stripe_customer_id,
      return_url: config.portalReturnUrl,
    });
    response.status(201).json({ data: { url: session.url }, meta: { requestId: request.requestId } });
  }));
}

export const billingInternals = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  billingConfig,
  mapBillingStatus,
  verifyStripeSignature,
};
