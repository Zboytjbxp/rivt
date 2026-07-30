import assert from "node:assert/strict";
import test from "node:test";
import { collectPushReadiness, evaluatePushReadiness } from "../scripts/push-readiness-check.js";

function readySnapshot() {
  return {
    schemaReady: true,
    provider: { ok: true, mode: "configured", previousConfigured: false },
    inventory: {
      total: 1,
      eligible: 1,
      inactive: 0,
      active: 1,
      previous: 0,
      unknown: 0,
      retired: 0,
      active_with_success: 1,
    },
    outbox: {
      due_pending: 0,
      stale_pending: 0,
      processing: 0,
      stale_processing: 0,
      recent_terminal_failures: 0,
    },
  };
}

test("push readiness passes only with current-key delivery proof and a clean queue", () => {
  const result = evaluatePushReadiness(readySnapshot());
  assert.equal(result.ready, true);
  assert.deepEqual(result.findings, []);
});

test("push readiness can prove dependencies cleared before the previous key is removed", () => {
  const snapshot = readySnapshot();
  snapshot.provider.previousConfigured = true;

  const result = evaluatePushReadiness(snapshot, { phase: "pre_retirement" });

  assert.equal(result.ready, true);
  assert.equal(result.phase, "pre_retirement");
});

test("push readiness fails closed for unknown, previous, retired, or unproven devices", () => {
  const snapshot = readySnapshot();
  snapshot.provider.previousConfigured = true;
  snapshot.inventory.previous = 1;
  snapshot.inventory.unknown = 1;
  snapshot.inventory.retired = 1;
  snapshot.inventory.active = 2;
  snapshot.inventory.active_with_success = 0;
  snapshot.outbox.stale_pending = 1;
  snapshot.outbox.stale_processing = 1;
  snapshot.outbox.recent_terminal_failures = 1;

  const codes = evaluatePushReadiness(snapshot).findings.map((finding) => finding.code);
  assert.deepEqual(codes, [
    "PUSH_PREVIOUS_KEY_STILL_CONFIGURED",
    "ELIGIBLE_PUSH_SUBSCRIPTIONS_UNCLASSIFIED",
    "ELIGIBLE_PUSH_SUBSCRIPTIONS_ON_PREVIOUS_KEY",
    "ELIGIBLE_PUSH_SUBSCRIPTIONS_UNRECOGNIZED",
    "ACTIVE_PUSH_DELIVERY_UNPROVEN",
    "PUSH_OUTBOX_STALE_CLAIMS",
    "PUSH_OUTBOX_BACKLOG_STALE",
    "PUSH_RECENT_TERMINAL_FAILURES",
  ]);
});

test("push readiness inventory uses a bounded read-only transaction", async () => {
  const queries = [];
  let released = false;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("information_schema.columns")) return { rows: [{ ready: true }] };
      if (sql.includes("FROM push_subscriptions")) {
        return {
          rows: [{
            total: 1,
            eligible: 1,
            inactive: 0,
            active: 1,
            previous: 0,
            unknown: 0,
            retired: 0,
            active_with_success: 1,
          }],
        };
      }
      if (sql.includes("FROM push_delivery_outbox")) {
        return {
          rows: [{
            due_pending: 0,
            stale_pending: 0,
            processing: 0,
            stale_processing: 0,
            recent_terminal_failures: 0,
          }],
        };
      }
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  const database = { async connect() { return client; } };
  const environment = {
    VAPID_PUBLIC_KEY: "A".repeat(60),
    VAPID_PRIVATE_KEY: "B".repeat(60),
    VAPID_SUBJECT: "mailto:alerts@example.test",
  };

  const snapshot = await collectPushReadiness(database, environment);

  assert.equal(snapshot.schemaReady, true);
  assert.equal(queries[0], "BEGIN READ ONLY");
  assert.ok(queries.includes("SET LOCAL statement_timeout = '10s'"));
  assert.ok(queries.includes("SET LOCAL lock_timeout = '2s'"));
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.equal(released, true);
});
