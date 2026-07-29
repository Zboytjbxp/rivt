import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRequiredPushProvider,
  createPushDeliveryWorker,
  pushNotificationInternals,
  pushProviderStatus,
  startPushDeliveryWorker,
} from "../server/push-notifications.js";

test("web push provider fails closed until every VAPID value exists", () => {
  const previous = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
  try {
    const status = pushProviderStatus();
    assert.equal(status.ok, false);
    assert.equal(status.mode, "setup_required");
    assert.deepEqual(status.missing, ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]);
  } finally {
    if (previous.publicKey === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = previous.publicKey;
    if (previous.privateKey === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = previous.privateKey;
    if (previous.subject === undefined) delete process.env.VAPID_SUBJECT;
    else process.env.VAPID_SUBJECT = previous.subject;
  }
});

test("web push retries back off and cap at one hour", () => {
  assert.equal(pushNotificationInternals.retryDelaySeconds(1), 15);
  assert.equal(pushNotificationInternals.retryDelaySeconds(2), 30);
  assert.equal(pushNotificationInternals.retryDelaySeconds(20), 3600);
});

test("required push delivery fails closed and outbound attempts have a hard deadline", () => {
  assert.throws(
    () => assertRequiredPushProvider(
      { RIVT_PUSH_REQUIRED: "true" },
      { ok: false, mode: "setup_required" },
    ),
    /push delivery is required/i,
  );
  assert.equal(
    assertRequiredPushProvider(
      { RIVT_PUSH_REQUIRED: "true" },
      { ok: true, mode: "configured" },
      { required: true },
    ).ok,
    true,
  );
  assert.throws(
    () => assertRequiredPushProvider(
      {},
      { ok: true, mode: "configured" },
      { required: true },
    ),
    /required for a hosted worker/i,
  );
  assert.throws(
    () => assertRequiredPushProvider(
      { RIVT_PUSH_REQUIRED: "false" },
      { ok: true, mode: "configured" },
      { required: true },
    ),
    /required for a hosted worker/i,
  );
  assert.equal(pushNotificationInternals.pushDeliveryTimeoutMs({}), 8_000);
  assert.equal(
    pushNotificationInternals.pushDeliveryTimeoutMs({
      PUSH_DELIVERY_TIMEOUT_MS: "10000",
    }),
    10_000,
  );
  assert.throws(
    () => pushNotificationInternals.pushDeliveryTimeoutMs({
      PUSH_DELIVERY_TIMEOUT_MS: "10001",
    }),
    /1000 through 10000 milliseconds/i,
  );
  assert.throws(
    () => pushNotificationInternals.pushDeliveryRequired({
      RIVT_PUSH_REQUIRED: "yes",
    }),
    /must be true or false/i,
  );
});

test("required worker push configuration is rejected before a delivery batch can start", () => {
  let queries = 0;
  const database = {
    query() {
      queries += 1;
      throw new Error("delivery batch must not start");
    },
  };
  assert.throws(
    () => startPushDeliveryWorker(database, {
      environment: { RIVT_PUSH_REQUIRED: "false" },
      required: true,
      unref: false,
    }),
    /required for a hosted worker/i,
  );
  assert.equal(queries, 0);
});

test("push delivery outcomes distinguish retryable, terminal, and stale work", () => {
  const delivery = { attempt_count: 2 };
  assert.equal(
    pushNotificationInternals.deliveryFailureOutcome(delivery, { statusCode: 500 }),
    "retried",
  );
  assert.equal(
    pushNotificationInternals.deliveryFailureOutcome(delivery, { statusCode: 410 }),
    "failed",
  );
  assert.equal(
    pushNotificationInternals.deliveryFailureOutcome(
      { attempt_count: pushNotificationInternals.MAX_DELIVERY_ATTEMPTS },
      { statusCode: 500 },
    ),
    "failed",
  );
});

test("web push rejects malformed configured keys without exposing them", () => {
  const previous = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };
  process.env.VAPID_PUBLIC_KEY = "not-a-real-key";
  process.env.VAPID_PRIVATE_KEY = "not-a-real-key";
  process.env.VAPID_SUBJECT = "support@example.test";
  try {
    const status = pushProviderStatus();
    assert.equal(status.ok, false);
    assert.equal(status.mode, "invalid_config");
    assert.equal(status.publicKey, null);
  } finally {
    if (previous.publicKey === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = previous.publicKey;
    if (previous.privateKey === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = previous.privateKey;
    if (previous.subject === undefined) delete process.env.VAPID_SUBJECT;
    else process.env.VAPID_SUBJECT = previous.subject;
  }
});

test("push worker shutdown waits for the active batch", async () => {
  let resolveBatch;
  let batchStarted;
  const started = new Promise((resolve) => {
    batchStarted = resolve;
  });
  const batch = new Promise((resolve) => {
    resolveBatch = resolve;
  });
  const worker = createPushDeliveryWorker({
    runBatch: async () => {
      batchStarted();
      return batch;
    },
    intervalMs: 60_000,
    unref: true,
  });
  worker.start();
  await started;

  let stopped = false;
  const stopping = worker.stop().then(() => {
    stopped = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stopped, false);
  resolveBatch(1);
  await stopping;
  assert.equal(stopped, true);
});

test("push worker reports real per-delivery batch outcomes", async () => {
  const results = [];
  const worker = createPushDeliveryWorker({
    runBatch: async () => ({
      claimed: 4,
      sent: 2,
      retried: 1,
      failed: 0,
      stale: 1,
    }),
    intervalMs: 60_000,
    unref: true,
    onResult: (result) => results.push(result),
  });
  worker.start();
  await new Promise((resolve) => setImmediate(resolve));
  await worker.stop();

  assert.equal(results.length, 1);
  assert.deepEqual({
    claimed: results[0].claimed,
    sent: results[0].sent,
    retried: results[0].retried,
    failed: results[0].failed,
    stale: results[0].stale,
  }, {
    claimed: 4,
    sent: 2,
    retried: 1,
    failed: 0,
    stale: 1,
  });
});

test("push delivery state updates are fenced to the claimed attempt", async () => {
  const calls = [];
  const database = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 0, rows: [] };
    },
  };
  const delivery = {
    id: "delivery-id",
    subscription_id: "subscription-id",
    notification_id: "notification-id",
    account_id: "account-id",
    attempt_count: 3,
  };

  assert.equal(await pushNotificationInternals.markDeliverySuccess(database, delivery), false);
  await pushNotificationInternals.markDeliveryFailure(
    database,
    delivery,
    Object.assign(new Error("provider failure"), { statusCode: 500 }),
  );

  assert.match(calls[0].sql, /status = 'processing'/i);
  assert.match(calls[0].sql, /attempt_count = \$2/i);
  assert.deepEqual(calls[0].params, ["delivery-id", 3]);
  assert.match(calls[1].sql, /status = 'processing'/i);
  assert.match(calls[1].sql, /attempt_count = \$5/i);
  assert.equal(calls[1].params[4], 3);
});

test("expired push subscriptions are removed only by the current claimed attempt", async () => {
  const calls = [];
  const database = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 0, rows: [{ updated: false }] };
    },
  };
  const delivery = {
    id: "delivery-id",
    subscription_id: "subscription-id",
    notification_id: "notification-id",
    account_id: "account-id",
    attempt_count: 4,
  };

  const updated = await pushNotificationInternals.markDeliveryFailure(
    database,
    delivery,
    Object.assign(new Error("gone"), { statusCode: 410 }),
  );

  assert.equal(updated, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /delete from push_delivery_outbox/i);
  assert.match(calls[0].sql, /status = 'processing'/i);
  assert.match(calls[0].sql, /attempt_count = \$2/i);
  assert.match(calls[0].sql, /using current_claim/i);
  assert.deepEqual(calls[0].params, ["delivery-id", 4]);
});
