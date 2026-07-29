import assert from "node:assert/strict";
import test from "node:test";
import {
  connectionBudgetStatus,
  poolMaxForRole,
  processCapabilities,
  resolveProcessRole,
} from "../server/process-role.js";
import { databasePoolTimeouts } from "../server/database-pool.js";
import { boundedRuntimeInterval } from "../server/runtime-interval.js";

test("hosted process roles fail closed when missing, invalid, or combined", () => {
  assert.throws(
    () => resolveProcessRole({ NODE_ENV: "production" }),
    /RIVT_PROCESS_ROLE.*required/i,
  );
  assert.throws(
    () => resolveProcessRole({ RAILWAY_ENVIRONMENT_ID: "environment-id" }),
    /RIVT_PROCESS_ROLE.*required/i,
  );
  assert.throws(
    () => resolveProcessRole({ NODE_ENV: "production", RIVT_PROCESS_ROLE: "everything" }),
    /web, worker, or migrate/i,
  );
  assert.throws(
    () => resolveProcessRole({ NODE_ENV: "production", RIVT_PROCESS_ROLE: "combined" }),
    /local development and tests/i,
  );
});

test("local imports preserve an explicit combined compatibility mode", () => {
  assert.equal(resolveProcessRole({ NODE_ENV: "test" }, { allowLocalCombinedDefault: true }), "combined");
  assert.throws(
    () => resolveProcessRole({ NODE_ENV: "test" }),
    /RIVT_PROCESS_ROLE.*required/i,
  );
  assert.equal(
    resolveProcessRole({ NODE_ENV: "development", RIVT_PROCESS_ROLE: "combined" }),
    "combined",
  );
});

test("process capabilities keep HTTP, workers, and migrations separate", () => {
  assert.deepEqual(processCapabilities("web"), {
    servesHttp: true,
    appliesMigrations: false,
    runsPushWorker: false,
    runsMaintenance: false,
  });
  assert.deepEqual(processCapabilities("worker"), {
    servesHttp: false,
    appliesMigrations: false,
    runsPushWorker: true,
    runsMaintenance: true,
  });
  assert.deepEqual(processCapabilities("migrate"), {
    servesHttp: false,
    appliesMigrations: true,
    runsPushWorker: false,
    runsMaintenance: false,
  });
  assert.deepEqual(processCapabilities("combined"), {
    servesHttp: true,
    appliesMigrations: true,
    runsPushWorker: true,
    runsMaintenance: true,
  });
});

test("role-specific pool limits are bounded and legacy defaults stay local-only", () => {
  assert.equal(poolMaxForRole("web", { NODE_ENV: "test" }), 8);
  assert.equal(poolMaxForRole("worker", { NODE_ENV: "test" }), 4);
  assert.equal(poolMaxForRole("migrate", { NODE_ENV: "test" }), 1);
  assert.equal(poolMaxForRole("combined", { NODE_ENV: "test", PG_POOL_MAX: "7" }), 7);
  assert.equal(poolMaxForRole("web", {
    NODE_ENV: "production",
    RIVT_WEB_PG_POOL_MAX: "6",
  }), 6);
  assert.throws(
    () => poolMaxForRole("worker", {
      NODE_ENV: "production",
      RIVT_WORKER_PG_POOL_MAX: "0",
    }),
    /positive integer/i,
  );
  assert.throws(
    () => poolMaxForRole("web", { NODE_ENV: "production" }),
    /RIVT_WEB_PG_POOL_MAX.*required/i,
  );
});

test("production connection budget requires explicit topology and thirty percent reserve", () => {
  const healthy = connectionBudgetStatus({
    NODE_ENV: "production",
    RIVT_WEB_REPLICAS: "2",
    RIVT_WORKER_REPLICAS: "1",
    RIVT_WEB_PG_POOL_MAX: "8",
    RIVT_WORKER_PG_POOL_MAX: "4",
    RIVT_MIGRATE_PG_POOL_MAX: "1",
    RIVT_DB_RESERVED_CONNECTIONS: "4",
    RIVT_DB_MAX_CONNECTIONS: "100",
  });
  assert.deepEqual(healthy, {
    ok: true,
    hosted: true,
    databaseMaxConnections: 100,
    plannedConnections: 25,
    headroomConnections: 75,
    headroomPercent: 75,
    minimumHeadroomPercent: 30,
    topology: {
      webReplicas: 2,
      workerReplicas: 1,
      webPoolMax: 8,
      workerPoolMax: 4,
      migratePoolMax: 1,
      reservedConnections: 4,
    },
    missing: [],
    errors: [],
  });

  const saturated = connectionBudgetStatus({
    NODE_ENV: "production",
    RIVT_WEB_REPLICAS: "2",
    RIVT_WORKER_REPLICAS: "1",
    RIVT_WEB_PG_POOL_MAX: "20",
    RIVT_WORKER_PG_POOL_MAX: "10",
    RIVT_MIGRATE_PG_POOL_MAX: "4",
    RIVT_DB_RESERVED_CONNECTIONS: "6",
    RIVT_DB_MAX_CONNECTIONS: "70",
  });
  assert.equal(saturated.ok, false);
  assert.equal(saturated.plannedConnections, 60);
  assert.equal(saturated.headroomPercent, 14.29);
  assert.match(saturated.errors[0], /30%/);

  const missing = connectionBudgetStatus({ NODE_ENV: "production" });
  assert.equal(missing.ok, false);
  assert.ok(missing.missing.includes("RIVT_DB_MAX_CONNECTIONS"));
  assert.doesNotMatch(JSON.stringify(missing), /undefined|null/);
});

test("database pools use bounded connection and idle timeouts", () => {
  assert.deepEqual(databasePoolTimeouts({}), {
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  assert.deepEqual(databasePoolTimeouts({
    RIVT_DB_CONNECTION_TIMEOUT_MS: "2500",
    RIVT_DB_IDLE_TIMEOUT_MS: "45000",
  }), {
    connectionTimeoutMillis: 2_500,
    idleTimeoutMillis: 45_000,
  });
  assert.throws(
    () => databasePoolTimeouts({ RIVT_DB_CONNECTION_TIMEOUT_MS: "0" }),
    /RIVT_DB_CONNECTION_TIMEOUT_MS/i,
  );
  assert.throws(
    () => databasePoolTimeouts({ RIVT_DB_IDLE_TIMEOUT_MS: "unbounded" }),
    /RIVT_DB_IDLE_TIMEOUT_MS/i,
  );
});

test("runtime intervals reject overflow and operator typos", () => {
  const options = {
    name: "TEST_INTERVAL_MS",
    fallback: 5_000,
    minimum: 100,
    maximum: 60_000,
  };
  assert.equal(boundedRuntimeInterval(undefined, options), 5_000);
  assert.equal(boundedRuntimeInterval("2500", options), 2_500);
  assert.throws(
    () => boundedRuntimeInterval("Infinity", options),
    /TEST_INTERVAL_MS/i,
  );
  assert.throws(
    () => boundedRuntimeInterval("not-a-number", options),
    /TEST_INTERVAL_MS/i,
  );
  assert.throws(
    () => boundedRuntimeInterval("60001", options),
    /TEST_INTERVAL_MS/i,
  );
});
