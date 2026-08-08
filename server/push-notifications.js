import { createHash } from "node:crypto";
import webpush from "web-push";
import { ApiError, asyncRoute, validate, z } from "./api.js";
import { logError, logInfo, logWarn } from "./logger.js";

const DELIVERY_BATCH_SIZE = 20;
const MAX_DELIVERY_ATTEMPTS = 5;
const WORKER_INTERVAL_MS = 5_000;
const STALE_CLAIM_MINUTES = 5;
const PUSH_DELIVERY_TIMEOUT_MS = 8_000;

const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(16).max(4096),
  expirationTime: z.number().int().positive().nullable().default(null),
  keys: z.object({
    p256dh: z.string().trim().min(16).max(512),
    auth: z.string().trim().min(8).max(256),
  }),
  vapidGeneration: z.string().trim().regex(/^[0-9a-f]{64}$/).nullable().optional().default(null),
});

const pushUnsubscribeSchema = z.object({
  endpoint: z.string().trim().min(16).max(4096),
});

let workerController = null;

function envValue(name, environment = process.env) {
  return String(environment?.[name] ?? "").trim();
}

function boundedRuntimeInterval(value, {
  name,
  fallback,
  minimum,
  maximum,
}) {
  const source = value === null || value === undefined || String(value).trim() === ""
    ? fallback
    : value;
  const parsed = Number(source);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum} milliseconds.`);
  }
  return parsed;
}

function pushDeliveryRequired(environment = process.env) {
  const configured = String(environment?.RIVT_PUSH_REQUIRED ?? "").trim().toLowerCase();
  if (!configured || configured === "false") return false;
  if (configured === "true") return true;
  throw new Error("RIVT_PUSH_REQUIRED must be true or false.");
}

export function pushDeliveryTimeoutMs(environment = process.env) {
  return boundedRuntimeInterval(environment?.PUSH_DELIVERY_TIMEOUT_MS, {
    name: "PUSH_DELIVERY_TIMEOUT_MS",
    fallback: PUSH_DELIVERY_TIMEOUT_MS,
    minimum: 1_000,
    maximum: 10_000,
  });
}

export function assertRequiredPushProvider(
  environment = process.env,
  status = pushProviderStatus(environment),
  { required = false } = {},
) {
  const configuredAsRequired = pushDeliveryRequired(environment);
  if (required && !configuredAsRequired) {
    throw new Error("RIVT_PUSH_REQUIRED=true is required for hosted web and worker services.");
  }
  if (configuredAsRequired && !status.ok) {
    throw new Error("Push delivery is required, but the VAPID provider is not configured.");
  }
  return status;
}

export function vapidGeneration(publicKey) {
  const normalized = String(publicKey ?? "").trim();
  if (!normalized) return null;
  const publicKeyBytes = Buffer.from(normalized, "base64url");
  return createHash("sha256").update(publicKeyBytes).digest("hex");
}

function validVapidBundle(bundle) {
  const validKeys = /^[A-Za-z0-9_-]{40,120}$/;
  const validSubject = /^(mailto:|https:\/\/)/i;
  if (
    !validKeys.test(bundle.publicKey)
    || !validKeys.test(bundle.privateKey)
    || !validSubject.test(bundle.subject)
  ) {
    return false;
  }
  try {
    webpush.setVapidDetails(bundle.subject, bundle.publicKey, bundle.privateKey);
    return true;
  } catch {
    return false;
  }
}

export function vapidProviders(environment = process.env) {
  const active = {
    publicKey: envValue("VAPID_PUBLIC_KEY", environment),
    privateKey: envValue("VAPID_PRIVATE_KEY", environment),
    subject: envValue("VAPID_SUBJECT", environment),
  };
  active.generation = vapidGeneration(active.publicKey);
  const previousPublicKey = envValue("VAPID_PREVIOUS_PUBLIC_KEY", environment);
  const previousPrivateKey = envValue("VAPID_PREVIOUS_PRIVATE_KEY", environment);
  const previous = previousPublicKey || previousPrivateKey
    ? {
        publicKey: previousPublicKey,
        privateKey: previousPrivateKey,
        subject: active.subject,
        generation: vapidGeneration(previousPublicKey),
      }
    : null;
  return { active, previous };
}

export function recognizedVapidGeneration(generation, environment = process.env) {
  if (generation === null || generation === undefined || generation === "") return "unknown";
  const { active, previous } = vapidProviders(environment);
  if (generation === active.generation) return "active";
  if (previous && generation === previous.generation) return "previous";
  return null;
}

export function pushProviderStatus(environment = process.env) {
  const { active, previous } = vapidProviders(environment);
  const missing = [];
  if (!active.publicKey) missing.push("VAPID_PUBLIC_KEY");
  if (!active.privateKey) missing.push("VAPID_PRIVATE_KEY");
  if (!active.subject) missing.push("VAPID_SUBJECT");
  let invalid = false;
  if (missing.length === 0) {
    // Validate the previous pair first, then leave the active pair configured
    // globally for compatibility with any caller that does not pass per-request
    // VAPID details.
    const previousValid = previous === null || validVapidBundle(previous);
    const activeValid = validVapidBundle(active);
    invalid = !previousValid || !activeValid;
  }
  return {
    ok: missing.length === 0 && !invalid,
    provider: "web_push",
    mode: invalid ? "invalid_config" : missing.length === 0 ? "configured" : "setup_required",
    publicKey: missing.length === 0 && !invalid ? active.publicKey : null,
    vapidGeneration: missing.length === 0 && !invalid ? active.generation : null,
    previousConfigured: previous !== null && !invalid,
    missing,
  };
}

function configureWebPush(environment = process.env) {
  const status = pushProviderStatus(environment);
  return status.ok ? status : { ...status, publicKey: null };
}

function assertPushEndpoint(endpoint) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new ApiError(422, "PUSH_ENDPOINT_INVALID", "The browser push endpoint is invalid.");
  }
  if (parsed.protocol !== "https:") {
    throw new ApiError(422, "PUSH_ENDPOINT_INVALID", "The browser push endpoint must use HTTPS.");
  }
}

function expirationTimestamp(expirationTime) {
  if (!expirationTime) return null;
  const value = new Date(expirationTime);
  if (Number.isNaN(value.getTime())) {
    throw new ApiError(422, "PUSH_EXPIRATION_INVALID", "The browser push expiration is invalid.");
  }
  return value.toISOString();
}

export async function queuePushDeliveries(client, { notificationId, accountId, notificationType }) {
  return queuePushDeliveriesForNotifications(client, { notificationIds: [notificationId], notificationType, accountId });
}

export async function queuePushDeliveriesForNotifications(client, { notificationIds, notificationType, accountId = null }) {
  if (!pushProviderStatus().ok) return 0;
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) return 0;
  const result = await client.query(
    `INSERT INTO push_delivery_outbox (notification_id, subscription_id, account_id)
     SELECT notification.id, subscription.id, notification.account_id
     FROM in_app_notifications notification
     INNER JOIN push_subscriptions subscription ON subscription.account_id = notification.account_id
     INNER JOIN auth_sessions session ON session.session_id = subscription.auth_session_id
     WHERE notification.id = ANY($1::uuid[])
       AND ($3::uuid IS NULL OR notification.account_id = $3)
       AND session.revoked_at IS NULL
       AND session.expires_at > now()
       AND COALESCE((
         SELECT preference.enabled
         FROM notification_preferences preference
         WHERE preference.account_id = notification.account_id
           AND preference.notification_type = $2
           AND preference.channel = 'push'
       ), true)
     ON CONFLICT (notification_id, subscription_id) DO NOTHING`,
    [notificationIds, notificationType, accountId],
  );
  return result.rowCount;
}

async function claimDeliveries(database) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM push_delivery_outbox
       WHERE (status = 'sent' AND sent_at < now() - interval '30 days')
          OR (status = 'failed' AND updated_at < now() - interval '90 days')`,
    );
    await client.query(
      `UPDATE push_delivery_outbox
       SET status = 'pending', claimed_at = NULL, updated_at = now()
       WHERE status = 'processing'
         AND claimed_at < now() - ($1 * interval '1 minute')`,
      [STALE_CLAIM_MINUTES],
    );
    const claimed = await client.query(
      `WITH candidates AS (
         SELECT id
         FROM push_delivery_outbox
         WHERE status = 'pending' AND next_attempt_at <= now()
         ORDER BY next_attempt_at, created_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       ), updated AS (
         UPDATE push_delivery_outbox delivery
         SET status = 'processing',
             attempt_count = delivery.attempt_count + 1,
             claimed_at = now(),
             updated_at = now()
         FROM candidates
         WHERE delivery.id = candidates.id
         RETURNING delivery.*
       )
       SELECT updated.*,
              subscription.endpoint,
              subscription.expiration_time,
              subscription.p256dh,
              subscription.auth,
              notification.title,
              notification.body,
              notification.action_href,
              notification.priority
       FROM updated
       INNER JOIN push_subscriptions subscription ON subscription.id = updated.subscription_id
       INNER JOIN in_app_notifications notification ON notification.id = updated.notification_id`,
      [DELIVERY_BATCH_SIZE],
    );
    await client.query("COMMIT");
    return claimed.rows;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function pushPayload(delivery) {
  return JSON.stringify({
    title: delivery.title || "RIVT",
    body: delivery.body || "You have a new notification.",
    url: delivery.action_href || "/app/home",
    tag: `rivt-${delivery.notification_id}`,
  });
}

function retryDelaySeconds(attemptCount) {
  return Math.min(60 * 60, 15 * (2 ** Math.max(0, attemptCount - 1)));
}

async function markDeliveryFailure(database, delivery, error) {
  const statusCode = Number(error?.statusCode ?? 0);
  if (statusCode === 404 || statusCode === 410) {
    const result = await database.query(
      `WITH current_claim AS (
         DELETE FROM push_delivery_outbox
         WHERE id = $1
           AND status = 'processing'
           AND attempt_count = $2
         RETURNING subscription_id
       ), deleted_subscription AS (
         DELETE FROM push_subscriptions subscription
         USING current_claim
         WHERE subscription.id = current_claim.subscription_id
         RETURNING subscription.id
       )
       SELECT EXISTS (SELECT 1 FROM current_claim) AS updated`,
      [delivery.id, delivery.attempt_count],
    );
    if (result.rows[0]?.updated !== true) return false;
    logInfo("push.subscription_pruned", {
      accountId: delivery.account_id,
      statusCode,
    });
    return true;
  }

  const failed = delivery.attempt_count >= MAX_DELIVERY_ATTEMPTS;
  const message = String(error?.message ?? "Web Push delivery failed.")
    .replace(/https?:\/\/\S+/gi, "[push-endpoint]")
    .slice(0, 500);
  const result = await database.query(
    `UPDATE push_delivery_outbox
     SET status = $2,
         next_attempt_at = CASE WHEN $2 = 'pending'
           THEN now() + ($3 * interval '1 second')
           ELSE next_attempt_at
         END,
         claimed_at = NULL,
         last_error = $4,
         updated_at = now()
      WHERE id = $1
        AND status = 'processing'
        AND attempt_count = $5`,
    [
      delivery.id,
      failed ? "failed" : "pending",
      retryDelaySeconds(delivery.attempt_count),
      message,
      delivery.attempt_count,
    ],
  );
  if (!result.rowCount) return false;
  logWarn("push.delivery_failed", {
    accountId: delivery.account_id,
    notificationId: delivery.notification_id,
    attemptCount: delivery.attempt_count,
    statusCode: statusCode || null,
    terminal: failed,
  });
  return true;
}

async function markPushDeliverySuccess(database, delivery, generation) {
  const result = await database.query(
    `WITH delivered AS (
       UPDATE push_delivery_outbox
       SET status = 'sent', sent_at = now(), claimed_at = NULL, last_error = '', updated_at = now()
      WHERE id = $1
          AND status = 'processing'
          AND attempt_count = $2
        RETURNING subscription_id
      ), updated_subscription AS (
        UPDATE push_subscriptions subscription
        SET vapid_generation = $3,
            last_success_at = now(),
            updated_at = now()
        FROM delivered
        WHERE subscription.id = delivered.subscription_id
        RETURNING subscription.id
      )
      SELECT EXISTS (SELECT 1 FROM delivered) AS updated`,
    [delivery.id, delivery.attempt_count, generation],
  );
  return result.rows[0]?.updated === true;
}

function deliveryFailureOutcome(delivery, error) {
  const statusCode = Number(error?.statusCode ?? 0);
  return statusCode === 404
    || statusCode === 410
    || delivery.attempt_count >= MAX_DELIVERY_ATTEMPTS
    ? "failed"
    : "retried";
}

async function deliverClaimed(database, delivery) {
  try {
    const deliveryResult = await sendNotificationWithVapidFallback(webpush.sendNotification.bind(webpush), {
      endpoint: delivery.endpoint,
      expirationTime: delivery.expiration_time ? new Date(delivery.expiration_time).getTime() : null,
      keys: { p256dh: delivery.p256dh, auth: delivery.auth },
    }, pushPayload(delivery), {
      TTL: delivery.priority === "high" ? 60 * 60 : 24 * 60 * 60,
      urgency: delivery.priority === "high" ? "high" : "normal",
      timeout: pushDeliveryTimeoutMs(),
    });
    const updated = await markPushDeliverySuccess(database, delivery, deliveryResult.vapidGeneration);
    if (!updated) return "stale";
    logInfo("push.delivery_sent", {
      accountId: delivery.account_id,
      notificationId: delivery.notification_id,
      attemptCount: delivery.attempt_count,
    });
    return "sent";
  } catch (error) {
    const updated = await markDeliveryFailure(database, delivery, error);
    return updated ? deliveryFailureOutcome(delivery, error) : "stale";
  }
}

export async function sendNotificationWithVapidFallback(
  sendNotification,
  subscription,
  payload,
  options,
  environment = process.env,
  { now = Date.now } = {},
) {
  const { active, previous } = vapidProviders(environment);
  const providers = previous ? [active, previous] : [active];
  const totalTimeoutMs = Number.isSafeInteger(Number(options?.timeout))
    && Number(options.timeout) > 0
    ? Number(options.timeout)
    : pushDeliveryTimeoutMs(environment);
  const deadlineAt = now() + totalTimeoutMs;
  let firstError = null;
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const remainingTimeoutMs = Math.floor(deadlineAt - now());
    if (remainingTimeoutMs <= 0) {
      const timeoutError = new Error("Web Push delivery deadline expired.");
      timeoutError.code = "ETIMEDOUT";
      throw timeoutError;
    }
    try {
      const response = await sendNotification(subscription, payload, {
        ...options,
        timeout: remainingTimeoutMs,
        vapidDetails: {
          subject: provider.subject,
          publicKey: provider.publicKey,
          privateKey: provider.privateKey,
        },
      });
      return { response, vapidGeneration: provider.generation };
    } catch (error) {
      if (index === 0) firstError = error;
      const statusCode = Number(error?.statusCode ?? 0);
      const canTryOtherConfiguredGeneration = index === 0
        && providers.length > 1
        && (statusCode === 401 || statusCode === 403);
      if (!canTryOtherConfiguredGeneration) throw error;
    }
  }
  throw firstError ?? new Error("Web Push delivery failed.");
}

export async function processPushDeliveryBatchMetrics(database) {
  if (!database || !configureWebPush().ok) {
    return {
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      stale: 0,
    };
  }
  const deliveries = await claimDeliveries(database);
  const outcomes = await Promise.all(deliveries.map((delivery) => deliverClaimed(database, delivery)));
  return {
    claimed: deliveries.length,
    sent: outcomes.filter((outcome) => outcome === "sent").length,
    retried: outcomes.filter((outcome) => outcome === "retried").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
    stale: outcomes.filter((outcome) => outcome === "stale").length,
  };
}

export async function processPushDeliveryBatch(database) {
  const result = await processPushDeliveryBatchMetrics(database);
  return result.claimed;
}

export async function readPushDeliveryBacklog(database) {
  const result = await database.query(
    `SELECT
       count(*) FILTER (WHERE status = 'pending')::int AS pending,
       count(*) FILTER (WHERE status = 'processing')::int AS processing,
       count(*) FILTER (WHERE status = 'failed')::int AS failed,
       COALESCE(
         EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status = 'pending'))),
         0
       )::bigint AS oldest_pending_age_seconds
     FROM push_delivery_outbox`,
  );
  return {
    pending: Number(result.rows[0]?.pending ?? 0),
    processing: Number(result.rows[0]?.processing ?? 0),
    failed: Number(result.rows[0]?.failed ?? 0),
    oldestPendingAgeSeconds: Number(result.rows[0]?.oldest_pending_age_seconds ?? 0),
  };
}

export function createPushDeliveryWorker({
  runBatch,
  intervalMs = WORKER_INTERVAL_MS,
  onError = (error) => logError("push.worker_failed", { error }),
  onResult = () => {},
  unref = true,
} = {}) {
  if (typeof runBatch !== "function") throw new TypeError("A push delivery batch function is required.");
  const interval = boundedRuntimeInterval(intervalMs, {
    name: "push worker interval",
    fallback: WORKER_INTERVAL_MS,
    minimum: 100,
    maximum: 5 * 60 * 1_000,
  });
  let timer = null;
  let inFlight = null;
  let stopped = false;

  const run = () => {
    if (stopped || inFlight) return inFlight;
    const startedAt = Date.now();
    inFlight = Promise.resolve()
      .then(runBatch)
      .then((batchResult) => {
        const metrics = batchResult && typeof batchResult === "object"
          ? batchResult
          : { claimed: Number(batchResult) || 0 };
        onResult({
          ...metrics,
          durationMs: Math.max(0, Date.now() - startedAt),
        });
        return batchResult;
      })
      .catch((error) => {
        onError(error);
        return 0;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    start() {
      if (timer || stopped) return;
      void run();
      timer = setInterval(() => {
        void run();
      }, interval);
      if (unref) timer.unref?.();
    },
    async stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      await inFlight;
    },
  };
}

export function startPushDeliveryWorker(database, {
  intervalMs = WORKER_INTERVAL_MS,
  onError,
  onResult,
  unref = true,
  environment = process.env,
  required = false,
} = {}) {
  const status = assertRequiredPushProvider(
    environment,
    configureWebPush(environment),
    { required },
  );
  if (!database || !status.ok || workerController) return status;
  workerController = createPushDeliveryWorker({
    runBatch: () => processPushDeliveryBatchMetrics(database),
    intervalMs,
    onError,
    onResult,
    unref,
  });
  workerController.start();
  logInfo("push.worker_started", { intervalMs });
  return status;
}

export async function stopPushDeliveryWorker() {
  const controller = workerController;
  workerController = null;
  await controller?.stop();
}

export function registerPushNotificationRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  createInAppNotification,
}) {
  app.get("/api/v1/push/config", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const status = pushProviderStatus();
    const count = status.ok
      ? await database.query(
        `SELECT count(*)::int AS count
         FROM push_subscriptions subscription
         INNER JOIN auth_sessions session ON session.session_id = subscription.auth_session_id
         WHERE subscription.account_id = $1
           AND session.revoked_at IS NULL
           AND session.expires_at > now()`,
        [request.actor.account.id],
      )
      : { rows: [{ count: 0 }] };
    response.json({
      data: {
        configured: status.ok,
        publicKey: status.publicKey,
        vapidGeneration: status.vapidGeneration,
        subscriptionCount: count.rows[0].count,
      },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/push-subscriptions", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const status = pushProviderStatus();
    if (!status.ok) throw new ApiError(503, "PUSH_PROVIDER_UNAVAILABLE", "Background device alerts are temporarily unavailable.");
    const input = validate(pushSubscriptionSchema, request.body);
    assertPushEndpoint(input.endpoint);
    if (recognizedVapidGeneration(input.vapidGeneration) === null) {
      throw new ApiError(
        422,
        "PUSH_VAPID_GENERATION_UNRECOGNIZED",
        "This device alert registration uses an unrecognized key generation.",
      );
    }
    const result = await database.query(
      `INSERT INTO push_subscriptions (
         account_id, auth_session_id, endpoint, expiration_time, p256dh, auth, user_agent,
         vapid_generation
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (endpoint)
       DO UPDATE SET account_id = EXCLUDED.account_id,
                     auth_session_id = EXCLUDED.auth_session_id,
                     expiration_time = EXCLUDED.expiration_time,
                     p256dh = EXCLUDED.p256dh,
                     auth = EXCLUDED.auth,
                      user_agent = EXCLUDED.user_agent,
                      last_success_at = CASE
                       WHEN push_subscriptions.p256dh = EXCLUDED.p256dh
                         AND push_subscriptions.auth = EXCLUDED.auth
                         AND (
                           EXCLUDED.vapid_generation IS NULL
                           OR push_subscriptions.vapid_generation IS NOT DISTINCT FROM EXCLUDED.vapid_generation
                         )
                         THEN push_subscriptions.last_success_at
                       ELSE NULL
                      END,
                     vapid_generation = CASE
                       WHEN EXCLUDED.vapid_generation IS NULL
                         AND push_subscriptions.p256dh = EXCLUDED.p256dh
                         AND push_subscriptions.auth = EXCLUDED.auth
                         THEN push_subscriptions.vapid_generation
                       ELSE EXCLUDED.vapid_generation
                     END,
                     updated_at = now()
       RETURNING id, vapid_generation, created_at, updated_at`,
      [
        request.actor.account.id,
        request.authSessionId,
        input.endpoint,
        expirationTimestamp(input.expirationTime),
        input.keys.p256dh,
        input.keys.auth,
        String(request.headers["user-agent"] ?? "").slice(0, 500),
        input.vapidGeneration,
      ],
    );
    response.status(201).json({
      data: {
        subscription: {
          id: result.rows[0].id,
          vapidGeneration: result.rows[0].vapid_generation,
          createdAt: new Date(result.rows[0].created_at).toISOString(),
          updatedAt: new Date(result.rows[0].updated_at).toISOString(),
        },
      },
      meta: { requestId: request.requestId },
    });
  }));

  app.delete("/api/v1/push-subscriptions", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(pushUnsubscribeSchema, request.body);
    const result = await database.query(
      "DELETE FROM push_subscriptions WHERE account_id = $1 AND endpoint = $2",
      [request.actor.account.id, input.endpoint],
    );
    response.json({ data: { removed: result.rowCount > 0 }, meta: { requestId: request.requestId } });
  }));

  app.post("/api/v1/push/test", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    if (!pushProviderStatus().ok) throw new ApiError(503, "PUSH_PROVIDER_UNAVAILABLE", "Background device alerts are temporarily unavailable.");
    const notification = await createInAppNotification(database, {
      accountId: request.actor.account.id,
      type: "system",
      title: "RIVT device alerts are working",
      body: "Tap to open your notification center.",
      actionHref: "/app/home?panel=notifications",
      sourceType: "system",
      priority: "normal",
      metadata: { test: true },
    });
    response.status(202).json({
      data: { queued: Boolean(notification), notificationId: notification?.id ?? null },
      meta: { requestId: request.requestId },
    });
  }));
}

export const pushNotificationInternals = {
  MAX_DELIVERY_ATTEMPTS,
  claimDeliveries,
  deliveryFailureOutcome,
  markDeliveryFailure,
  markPushDeliverySuccess,
  pushDeliveryRequired,
  pushDeliveryTimeoutMs,
  pushSubscriptionSchema,
  recognizedVapidGeneration,
  retryDelaySeconds,
  sendNotificationWithVapidFallback,
  vapidGeneration,
  vapidProviders,
};
