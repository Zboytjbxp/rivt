import webpush from "web-push";
import { ApiError, asyncRoute, validate, z } from "./api.js";
import { logError, logInfo, logWarn } from "./logger.js";

const DELIVERY_BATCH_SIZE = 20;
const MAX_DELIVERY_ATTEMPTS = 5;
const WORKER_INTERVAL_MS = 5_000;
const STALE_CLAIM_MINUTES = 5;

const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(16).max(4096),
  expirationTime: z.number().int().positive().nullable().default(null),
  keys: z.object({
    p256dh: z.string().trim().min(16).max(512),
    auth: z.string().trim().min(8).max(256),
  }),
});

const pushUnsubscribeSchema = z.object({
  endpoint: z.string().trim().min(16).max(4096),
});

let workerTimer = null;
let workerRunning = false;

function envValue(name) {
  return String(process.env[name] ?? "").trim();
}

export function pushProviderStatus() {
  const publicKey = envValue("VAPID_PUBLIC_KEY");
  const privateKey = envValue("VAPID_PRIVATE_KEY");
  const subject = envValue("VAPID_SUBJECT");
  const missing = [];
  if (!publicKey) missing.push("VAPID_PUBLIC_KEY");
  if (!privateKey) missing.push("VAPID_PRIVATE_KEY");
  if (!subject) missing.push("VAPID_SUBJECT");
  const validKeys = /^[A-Za-z0-9_-]{40,120}$/;
  const validSubject = /^(mailto:|https:\/\/)/i;
  const invalid = missing.length === 0 && (
    !validKeys.test(publicKey)
    || !validKeys.test(privateKey)
    || !validSubject.test(subject)
  );
  return {
    ok: missing.length === 0 && !invalid,
    provider: "web_push",
    mode: invalid ? "invalid_config" : missing.length === 0 ? "configured" : "setup_required",
    publicKey: missing.length === 0 && !invalid ? publicKey : null,
    missing,
  };
}

function configureWebPush() {
  const status = pushProviderStatus();
  if (!status.ok) return status;
  try {
    webpush.setVapidDetails(envValue("VAPID_SUBJECT"), status.publicKey, envValue("VAPID_PRIVATE_KEY"));
    return status;
  } catch {
    return { ...status, ok: false, mode: "invalid_config", publicKey: null };
  }
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
  if (!pushProviderStatus().ok) return 0;
  const result = await client.query(
    `INSERT INTO push_delivery_outbox (notification_id, subscription_id, account_id)
     SELECT $1, subscription.id, $2
     FROM push_subscriptions subscription
     INNER JOIN auth_sessions session ON session.session_id = subscription.auth_session_id
     WHERE subscription.account_id = $2
       AND session.revoked_at IS NULL
       AND session.expires_at > now()
       AND COALESCE((
         SELECT preference.enabled
         FROM notification_preferences preference
         WHERE preference.account_id = $2
           AND preference.notification_type = $3
           AND preference.channel = 'push'
       ), true)
     ON CONFLICT (notification_id, subscription_id) DO NOTHING`,
    [notificationId, accountId, notificationType],
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
    await database.query("DELETE FROM push_subscriptions WHERE id = $1", [delivery.subscription_id]);
    logInfo("push.subscription_pruned", {
      accountId: delivery.account_id,
      statusCode,
    });
    return;
  }

  const failed = delivery.attempt_count >= MAX_DELIVERY_ATTEMPTS;
  const message = String(error?.message ?? "Web Push delivery failed.")
    .replace(/https?:\/\/\S+/gi, "[push-endpoint]")
    .slice(0, 500);
  await database.query(
    `UPDATE push_delivery_outbox
     SET status = $2,
         next_attempt_at = CASE WHEN $2 = 'pending'
           THEN now() + ($3 * interval '1 second')
           ELSE next_attempt_at
         END,
         claimed_at = NULL,
         last_error = $4,
         updated_at = now()
     WHERE id = $1`,
    [delivery.id, failed ? "failed" : "pending", retryDelaySeconds(delivery.attempt_count), message],
  );
  logWarn("push.delivery_failed", {
    accountId: delivery.account_id,
    notificationId: delivery.notification_id,
    attemptCount: delivery.attempt_count,
    statusCode: statusCode || null,
    terminal: failed,
  });
}

async function deliverClaimed(database, delivery) {
  try {
    await webpush.sendNotification({
      endpoint: delivery.endpoint,
      expirationTime: delivery.expiration_time ? new Date(delivery.expiration_time).getTime() : null,
      keys: { p256dh: delivery.p256dh, auth: delivery.auth },
    }, pushPayload(delivery), {
      TTL: delivery.priority === "high" ? 60 * 60 : 24 * 60 * 60,
      urgency: delivery.priority === "high" ? "high" : "normal",
    });
    await database.query(
      `WITH delivered AS (
         UPDATE push_delivery_outbox
         SET status = 'sent', sent_at = now(), claimed_at = NULL, last_error = '', updated_at = now()
         WHERE id = $1
         RETURNING subscription_id
       )
       UPDATE push_subscriptions subscription
       SET last_success_at = now(), updated_at = now()
       FROM delivered
       WHERE subscription.id = delivered.subscription_id`,
      [delivery.id],
    );
    logInfo("push.delivery_sent", {
      accountId: delivery.account_id,
      notificationId: delivery.notification_id,
      attemptCount: delivery.attempt_count,
    });
  } catch (error) {
    await markDeliveryFailure(database, delivery, error);
  }
}

export async function processPushDeliveryBatch(database) {
  if (!database || !configureWebPush().ok || workerRunning) return 0;
  workerRunning = true;
  try {
    const deliveries = await claimDeliveries(database);
    await Promise.all(deliveries.map((delivery) => deliverClaimed(database, delivery)));
    return deliveries.length;
  } finally {
    workerRunning = false;
  }
}

export function startPushDeliveryWorker(database) {
  const status = configureWebPush();
  if (!database || !status.ok || workerTimer) return status;
  const run = () => {
    void processPushDeliveryBatch(database).catch((error) => {
      logError("push.worker_failed", { error });
    });
  };
  run();
  workerTimer = setInterval(run, WORKER_INTERVAL_MS);
  workerTimer.unref?.();
  logInfo("push.worker_started", { intervalMs: WORKER_INTERVAL_MS });
  return status;
}

export function stopPushDeliveryWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
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
    const result = await database.query(
      `INSERT INTO push_subscriptions (
         account_id, auth_session_id, endpoint, expiration_time, p256dh, auth, user_agent
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (endpoint)
       DO UPDATE SET account_id = EXCLUDED.account_id,
                     auth_session_id = EXCLUDED.auth_session_id,
                     expiration_time = EXCLUDED.expiration_time,
                     p256dh = EXCLUDED.p256dh,
                     auth = EXCLUDED.auth,
                     user_agent = EXCLUDED.user_agent,
                     updated_at = now()
       RETURNING id, created_at, updated_at`,
      [
        request.actor.account.id,
        request.authSessionId,
        input.endpoint,
        expirationTimestamp(input.expirationTime),
        input.keys.p256dh,
        input.keys.auth,
        String(request.headers["user-agent"] ?? "").slice(0, 500),
      ],
    );
    response.status(201).json({
      data: {
        subscription: {
          id: result.rows[0].id,
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
  pushSubscriptionSchema,
  retryDelaySeconds,
};
