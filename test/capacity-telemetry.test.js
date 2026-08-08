import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  capacityRouteFamily,
  createCapacityTelemetry,
  validateCapacitySnapshot,
} from "../server/capacity-telemetry.js";
import { createRequestLogger } from "../server/logger.js";

test("capacity route classification is bounded and discards identifiers", () => {
  assert.equal(capacityRouteFamily("/api/health"), "health");
  assert.equal(capacityRouteFamily("/api/v1/jobs/02b35c59-30d1-46e9-9072-05ddbc55f2e4"), "jobs_work");
  assert.equal(capacityRouteFamily("/api/v1/shop-talk/posts/private-title"), "shop_talk_news");
  assert.equal(capacityRouteFamily("/pay/02b35c59-30d1-46e9-9072-05ddbc55f2e4"), "billing_payments");
  assert.equal(capacityRouteFamily("/api/v1/push-subscriptions"), "messaging_notifications");
  assert.equal(capacityRouteFamily("/api/v1/onboarding/complete"), "profile_account");
  assert.equal(capacityRouteFamily("/unknown/customer@example.test?q=secret"), "other");
});

test("capacity snapshots aggregate fixed fields without retaining private inputs", () => {
  let clock = 1_000;
  const pool = {
    options: { max: 8 },
    totalCount: 4,
    idleCount: 2,
    waitingCount: 1,
  };
  const telemetry = createCapacityTelemetry({
    role: "web",
    pool,
    now: () => clock,
    memoryUsage: () => ({
      rss: 50_000_000,
      heapUsed: 20_000_000,
      heapTotal: 30_000_000,
      external: 2_000_000,
      arrayBuffers: 1_000_000,
    }),
    eventLoopStats: () => ({ meanMs: 1.25, maxMs: 4.5, p95Ms: 2.5, p99Ms: 4 }),
  });

  telemetry.recordHttp({
    method: "POST",
    path: "/api/v1/contacts/02b35c59-30d1-46e9-9072-05ddbc55f2e4?email=private@example.test",
    statusCode: 201,
    durationMs: 73,
    multipart: true,
    uploadBytes: 1_024,
    requestId: "request-private",
    actorId: "account-private",
    body: "Call 904-555-0112 at 6563 Ector Place",
    objectKey: "accounts/private/file.jpg",
  });
  telemetry.recordHttp({
    method: "GET",
    path: "/api/v1/jobs/private-job-id",
    statusCode: 503,
    durationMs: 1_250,
  });
  telemetry.recordWorker({
    claimed: 3,
    sent: 2,
    retried: 1,
    failed: 0,
    stale: 1,
    durationMs: 250,
    pending: 7,
    processing: 1,
    oldestPendingAgeSeconds: 42,
    error: "private provider response",
  });
  telemetry.recordPoolError();
  telemetry.recordMaintenance({
    acquired: true,
    pruned: 5,
    durationMs: 20,
    error: "private database error",
  });
  telemetry.recordMaintenance({
    acquired: false,
    failed: true,
    durationMs: 10,
  });
  telemetry.recordDependencyProbe({
    databaseOk: true,
    objectStorageOk: false,
    durationMs: 30,
    error: "private-bucket",
  });
  clock = 2_000;

  const snapshot = telemetry.snapshot();
  assert.equal(validateCapacitySnapshot(snapshot), true);
  assert.equal(snapshot.schema, "capacity.aggregate.v1");
  assert.equal(snapshot.role, "web");
  assert.deepEqual(snapshot.pool, {
    configuredMax: 8,
    total: 4,
    idle: 2,
    waiting: 1,
    errors: 1,
  });
  assert.equal(snapshot.requests.total, 2);
  assert.equal(snapshot.requests.groups.length, 2);
  assert.equal(snapshot.uploads.accepted, 1);
  assert.equal(snapshot.uploads.bytes, 1_024);
  assert.equal(snapshot.worker.claimed, 3);
  assert.equal(snapshot.worker.stale, 1);
  assert.equal(snapshot.maintenance.rowsPruned, 5);
  assert.equal(snapshot.maintenance.failures, 1);
  assert.equal(snapshot.maintenance.skipped, 0);
  assert.equal(snapshot.dependencies.failures, 1);

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "private@example.test",
    "904-555-0112",
    "6563 Ector Place",
    "request-private",
    "account-private",
    "private-job-id",
    "accounts/private/file.jpg",
    "private provider response",
    "private database error",
    "private-bucket",
    "02b35c59-30d1-46e9-9072-05ddbc55f2e4",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("capacity snapshot validation rejects extra or free-text fields", () => {
  const telemetry = createCapacityTelemetry({ role: "worker" });
  const valid = telemetry.snapshot();
  assert.equal(validateCapacitySnapshot(valid), true);
  assert.throws(
    () => validateCapacitySnapshot({ ...valid, rawPath: "/api/v1/private" }),
    /unexpected field/i,
  );
  assert.throws(
    () => validateCapacitySnapshot({
      ...valid,
      worker: { ...valid.worker, error: "provider private message" },
    }),
    /unexpected field/i,
  );
});

test("mounted API request logging classifies the full base path", () => {
  const records = [];
  const response = new EventEmitter();
  response.statusCode = 200;
  response.writableEnded = true;
  let nextCalled = false;
  const middleware = createRequestLogger({
    onComplete: (record) => records.push(record),
  });

  middleware({
    baseUrl: "/api",
    path: "/v1/jobs/private-job-id",
    method: "GET",
    headers: {},
  }, response, () => {
    nextCalled = true;
  });
  response.emit("finish");

  assert.equal(nextCalled, true);
  assert.equal(records.length, 1);
  assert.equal(records[0].routeFamily, "jobs_work");
  assert.equal(JSON.stringify(records).includes("private-job-id"), false);
});

test("request telemetry hooks cannot interrupt request or response handling", () => {
  const response = new EventEmitter();
  response.statusCode = 200;
  response.writableEnded = true;
  let nextCalled = false;
  const middleware = createRequestLogger({
    onStart: () => {
      throw new Error("telemetry unavailable");
    },
    onComplete: () => {
      throw new Error("telemetry unavailable");
    },
  });

  middleware({
    baseUrl: "/api",
    path: "/health",
    method: "GET",
    headers: {},
  }, response, () => {
    nextCalled = true;
  });
  assert.doesNotThrow(() => response.emit("finish"));
  assert.equal(nextCalled, true);
});
