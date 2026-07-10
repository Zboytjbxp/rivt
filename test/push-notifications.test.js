import assert from "node:assert/strict";
import test from "node:test";
import { pushNotificationInternals, pushProviderStatus } from "../server/push-notifications.js";

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
