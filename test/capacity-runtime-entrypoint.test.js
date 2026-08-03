import assert from "node:assert/strict";
import test from "node:test";

import { startCapacityRuntime } from "../server/capacity-runtime.js";
import { validateCapacitySnapshot } from "../server/capacity-telemetry.js";

test("capacity runtime is disabled by default and emits nothing", async () => {
  const emitted = [];
  const runtime = startCapacityRuntime({
    role: "web",
    environment: {},
    emit: (snapshot) => emitted.push(snapshot),
  });

  assert.equal(runtime.enabled, false);
  assert.equal(runtime.telemetry, null);
  assert.equal(await runtime.flush(), null);
  await runtime.stop();
  assert.deepEqual(emitted, []);
});

test("enabled capacity runtime emits a fixed-schema snapshot on an immediate flush", async () => {
  const emitted = [];
  const runtime = startCapacityRuntime({
    role: "worker",
    environment: {
      RIVT_CAPACITY_TELEMETRY_ENABLED: "true",
    },
    intervalMs: 60_000,
    pool: {
      options: { max: 4 },
      totalCount: 2,
      idleCount: 1,
      waitingCount: 0,
    },
    beforeFlush: async () => ({
      workerBacklog: {
        pending: 3,
        processing: 1,
        oldestPendingAgeSeconds: 12,
      },
    }),
    emit: (snapshot) => emitted.push(snapshot),
  });

  assert.equal(runtime.enabled, true);
  runtime.telemetry.recordWorker({
    claimed: 2,
    sent: 1,
    retried: 1,
    durationMs: 18,
  });

  const snapshot = await runtime.flush();
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0], snapshot);
  assert.equal(validateCapacitySnapshot(snapshot), true);
  assert.equal(snapshot.schema, "capacity.aggregate.v1");
  assert.equal(snapshot.role, "worker");
  assert.equal(snapshot.worker.pending, 3);
  assert.equal(snapshot.worker.processing, 1);
  assert.equal(snapshot.worker.oldestPendingAgeSeconds, 12);
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "dependencies",
    "maintenance",
    "pool",
    "process",
    "requests",
    "role",
    "schema",
    "uploads",
    "window",
    "worker",
  ]);

  await runtime.stop();
  assert.equal(emitted.length, 2);
  assert.equal(validateCapacitySnapshot(emitted[1]), true);
});

test("capacity sampling failures never prevent shutdown cleanup", async () => {
  const errors = [];
  const runtime = startCapacityRuntime({
    role: "worker",
    environment: {
      RIVT_CAPACITY_TELEMETRY_ENABLED: "true",
    },
    intervalMs: 60_000,
    beforeFlush: async () => {
      throw new Error("transient database failure");
    },
    emit: () => {
      throw new Error("should not emit after failed sampling");
    },
    onError: (error) => errors.push(error.message),
  });

  await assert.rejects(runtime.flush(), /transient database failure/);
  await runtime.stop();
  assert.deepEqual(errors, ["transient database failure"]);
});
