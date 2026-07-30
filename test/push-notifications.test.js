import assert from "node:assert/strict";
import test from "node:test";
import webpush from "web-push";
import { pushNotificationInternals, pushProviderStatus } from "../server/push-notifications.js";

const validActiveKeys = webpush.generateVAPIDKeys();
const validPreviousKeys = webpush.generateVAPIDKeys();

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

test("web push derives stable opaque generations from public key bytes", () => {
  const first = pushNotificationInternals.vapidGeneration(validActiveKeys.publicKey);
  const repeated = pushNotificationInternals.vapidGeneration(validActiveKeys.publicKey);
  const different = pushNotificationInternals.vapidGeneration(validPreviousKeys.publicKey);

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, repeated);
  assert.notEqual(first, different);
});

test("web push provider bundles carry distinct active and previous generations", () => {
  const providers = pushNotificationInternals.vapidProviders({
    VAPID_PUBLIC_KEY: validActiveKeys.publicKey,
    VAPID_PRIVATE_KEY: validActiveKeys.privateKey,
    VAPID_SUBJECT: "mailto:alerts@example.test",
    VAPID_PREVIOUS_PUBLIC_KEY: validPreviousKeys.publicKey,
    VAPID_PREVIOUS_PRIVATE_KEY: validPreviousKeys.privateKey,
  });

  assert.match(providers.active.generation, /^[0-9a-f]{64}$/);
  assert.match(providers.previous.generation, /^[0-9a-f]{64}$/);
  assert.notEqual(providers.active.generation, providers.previous.generation);
});

test("web push registration generations accept configured keys and reject retired keys", () => {
  const environment = {
    VAPID_PUBLIC_KEY: validActiveKeys.publicKey,
    VAPID_PRIVATE_KEY: validActiveKeys.privateKey,
    VAPID_SUBJECT: "mailto:alerts@example.test",
    VAPID_PREVIOUS_PUBLIC_KEY: validPreviousKeys.publicKey,
    VAPID_PREVIOUS_PRIVATE_KEY: validPreviousKeys.privateKey,
  };
  const providers = pushNotificationInternals.vapidProviders(environment);

  assert.equal(
    pushNotificationInternals.recognizedVapidGeneration(providers.active.generation, environment),
    "active",
  );
  assert.equal(
    pushNotificationInternals.recognizedVapidGeneration(providers.previous.generation, environment),
    "previous",
  );
  assert.equal(pushNotificationInternals.recognizedVapidGeneration("f".repeat(64), environment), null);
  assert.equal(pushNotificationInternals.recognizedVapidGeneration(null, environment), "unknown");
});

test("web push accepts a legacy unclassified registration but rejects malformed generation claims", () => {
  const legacy = pushNotificationInternals.pushSubscriptionSchema.safeParse({
    endpoint: "https://push.example.test/legacy-device",
    expirationTime: null,
    keys: {
      p256dh: "test-p256dh-key-material",
      auth: "test-auth-key-material",
    },
  });
  assert.equal(legacy.success, true);
  assert.equal(legacy.data.vapidGeneration, null);

  const malformed = pushNotificationInternals.pushSubscriptionSchema.safeParse({
    endpoint: "https://push.example.test/malformed-device",
    expirationTime: null,
    keys: {
      p256dh: "test-p256dh-key-material",
      auth: "test-auth-key-material",
    },
    vapidGeneration: "A".repeat(64),
  });
  assert.equal(malformed.success, false);
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

test("web push fails closed when a previous VAPID pair is incomplete", () => {
  const status = pushProviderStatus({
    VAPID_PUBLIC_KEY: validActiveKeys.publicKey,
    VAPID_PRIVATE_KEY: validActiveKeys.privateKey,
    VAPID_SUBJECT: "mailto:alerts@example.test",
    VAPID_PREVIOUS_PUBLIC_KEY: "C".repeat(60),
  });
  assert.equal(status.ok, false);
  assert.equal(status.mode, "invalid_config");
  assert.equal(status.publicKey, null);
});

test("web push rejects regex-shaped but cryptographically invalid VAPID keys", () => {
  const status = pushProviderStatus({
    VAPID_PUBLIC_KEY: "A".repeat(60),
    VAPID_PRIVATE_KEY: "B".repeat(60),
    VAPID_SUBJECT: "mailto:alerts@example.test",
  });
  assert.equal(status.ok, false);
  assert.equal(status.mode, "invalid_config");
  assert.equal(status.publicKey, null);
});

test("web push retries an authentication rejection once with the previous VAPID pair", async () => {
  const attempts = [];
  const sendNotification = async (_subscription, _payload, options) => {
    attempts.push(options.vapidDetails.publicKey);
    if (attempts.length === 1) {
      const error = new Error("VAPID credentials rejected");
      error.statusCode = 403;
      throw error;
    }
    return { statusCode: 201 };
  };
  const environment = {
    VAPID_PUBLIC_KEY: "A".repeat(60),
    VAPID_PRIVATE_KEY: "B".repeat(60),
    VAPID_SUBJECT: "mailto:alerts@example.test",
    VAPID_PREVIOUS_PUBLIC_KEY: "C".repeat(60),
    VAPID_PREVIOUS_PRIVATE_KEY: "D".repeat(60),
  };

  const result = await pushNotificationInternals.sendNotificationWithVapidFallback(
    sendNotification,
    { endpoint: "https://push.example.test/device", keys: { p256dh: "p", auth: "a" } },
    "{}",
    { TTL: 60 },
    environment,
  );

  assert.equal(result.response.statusCode, 201);
  assert.equal(
    result.vapidGeneration,
    pushNotificationInternals.vapidGeneration(environment.VAPID_PREVIOUS_PUBLIC_KEY),
  );
  assert.deepEqual(attempts, [environment.VAPID_PUBLIC_KEY, environment.VAPID_PREVIOUS_PUBLIC_KEY]);
});

test("web push active-key success does not use the previous VAPID pair", async () => {
  const attempts = [];
  const environment = {
    VAPID_PUBLIC_KEY: "A".repeat(60),
    VAPID_PRIVATE_KEY: "B".repeat(60),
    VAPID_SUBJECT: "mailto:alerts@example.test",
    VAPID_PREVIOUS_PUBLIC_KEY: "C".repeat(60),
    VAPID_PREVIOUS_PRIVATE_KEY: "D".repeat(60),
  };
  const result = await pushNotificationInternals.sendNotificationWithVapidFallback(
    async (_subscription, _payload, options) => {
      attempts.push(options.vapidDetails.publicKey);
      return { statusCode: 201 };
    },
    { endpoint: "https://push.example.test/device", keys: { p256dh: "p", auth: "a" } },
    "{}",
    { TTL: 60 },
    environment,
  );
  assert.equal(result.response.statusCode, 201);
  assert.equal(
    result.vapidGeneration,
    pushNotificationInternals.vapidGeneration(environment.VAPID_PUBLIC_KEY),
  );
  assert.deepEqual(attempts, [environment.VAPID_PUBLIC_KEY]);
});

test("web push keeps active-first ordering and records the previous generation only after authentication fallback", async () => {
  const attempts = [];
  const environment = {
    VAPID_PUBLIC_KEY: "A".repeat(60),
    VAPID_PRIVATE_KEY: "B".repeat(60),
    VAPID_SUBJECT: "mailto:alerts@example.test",
    VAPID_PREVIOUS_PUBLIC_KEY: "C".repeat(60),
    VAPID_PREVIOUS_PRIVATE_KEY: "D".repeat(60),
  };
  const previousGeneration = pushNotificationInternals.vapidGeneration(environment.VAPID_PREVIOUS_PUBLIC_KEY);
  const result = await pushNotificationInternals.sendNotificationWithVapidFallback(
    async (_subscription, _payload, options) => {
      attempts.push(options.vapidDetails.publicKey);
      if (attempts.length === 1) {
        const error = new Error("Active VAPID credentials rejected");
        error.statusCode = 403;
        throw error;
      }
      return { statusCode: 201 };
    },
    { endpoint: "https://push.example.test/device", keys: { p256dh: "p", auth: "a" } },
    "{}",
    { TTL: 60 },
    environment,
  );

  assert.deepEqual(attempts, [environment.VAPID_PUBLIC_KEY, environment.VAPID_PREVIOUS_PUBLIC_KEY]);
  assert.equal(result.vapidGeneration, previousGeneration);
});

test("web push records the generation that actually delivered", async () => {
  const calls = [];
  const generation = pushNotificationInternals.vapidGeneration(validActiveKeys.publicKey);
  await pushNotificationInternals.markPushDeliverySuccess({
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      return { rowCount: 1 };
    },
  }, "delivery-id", generation);

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /SET vapid_generation = \$2/);
  assert.match(calls[0].sql, /last_success_at = now\(\)/);
  assert.deepEqual(calls[0].parameters, ["delivery-id", generation]);
});

test("web push does not retry ambiguous or terminal failures with the previous key", async () => {
  const environment = {
    VAPID_PUBLIC_KEY: "A".repeat(60),
    VAPID_PRIVATE_KEY: "B".repeat(60),
    VAPID_SUBJECT: "mailto:alerts@example.test",
    VAPID_PREVIOUS_PUBLIC_KEY: "C".repeat(60),
    VAPID_PREVIOUS_PRIVATE_KEY: "D".repeat(60),
  };
  for (const statusCode of [0, 404, 410, 429, 500, 503]) {
    let attempts = 0;
    const sendNotification = async () => {
      attempts += 1;
      const error = new Error("Push delivery failed");
      if (statusCode) error.statusCode = statusCode;
      throw error;
    };
    await assert.rejects(
      pushNotificationInternals.sendNotificationWithVapidFallback(
        sendNotification,
        { endpoint: "https://push.example.test/device", keys: { p256dh: "p", auth: "a" } },
        "{}",
        { TTL: 60 },
        environment,
      ),
      /failed/,
    );
    assert.equal(attempts, 1, `status ${statusCode || "timeout"} should not fallback`);
  }
});
