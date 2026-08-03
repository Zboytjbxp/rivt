import "dotenv/config";

import { fileURLToPath } from "node:url";
import {
  createGracefulShutdown,
  DEFAULT_HTTP_SERVER_TIMEOUTS,
} from "./http-server-safety.js";
import { startCapacityRuntime } from "./capacity-runtime.js";
import { createDatabasePool } from "./database-pool.js";
import {
  startDatabaseMaintenance,
} from "./database-maintenance.js";
import { logError, logInfo, logWarn } from "./logger.js";
import { assertMigrationsCurrent, migrateUp } from "./migrations.js";
import { captureException } from "./monitoring.js";
import {
  assertConnectionBudget,
  assertDatabaseConnectionCeiling,
  isHostedRuntime,
  processCapabilities,
  resolveProcessRole,
} from "./process-role.js";
import {
  assertRequiredPushProvider,
  pushDeliveryTimeoutMs,
  pushProviderStatus,
  readPushDeliveryBacklog,
  startPushDeliveryWorker,
  stopPushDeliveryWorker,
} from "./push-notifications.js";
import { boundedRuntimeInterval } from "./runtime-interval.js";

const WORKER_CLEANUP_MARGIN_MS = 5_000;
const MAX_HOSTED_SHUTDOWN_MS = 25_000;

function safePoolErrorCode(error) {
  const candidate = String(error?.code ?? "").trim().toUpperCase();
  return /^[A-Z0-9_]{1,20}$/.test(candidate) ? candidate : "UNKNOWN";
}

export function assertWorkerShutdownBudget(environment) {
  const shutdownTimeoutMs = boundedRuntimeInterval(
    environment.HTTP_SHUTDOWN_TIMEOUT_MS,
    {
      name: "HTTP_SHUTDOWN_TIMEOUT_MS",
      fallback: DEFAULT_HTTP_SERVER_TIMEOUTS.shutdownTimeoutMs,
      minimum: 5_000,
      maximum: MAX_HOSTED_SHUTDOWN_MS,
    },
  );
  const deliveryTimeoutMs = pushDeliveryTimeoutMs(environment);
  if (shutdownTimeoutMs < deliveryTimeoutMs + WORKER_CLEANUP_MARGIN_MS) {
    throw new Error(
      "HTTP_SHUTDOWN_TIMEOUT_MS must reserve at least 5000 milliseconds beyond the push deadline.",
    );
  }
  return { shutdownTimeoutMs, deliveryTimeoutMs };
}

async function startWorkerRuntime(role, environment, budget) {
  const hosted = isHostedRuntime(environment);
  if (hosted) assertWorkerShutdownBudget(environment);
  const database = createDatabasePool({ role, environment });
  let capacity = null;
  let stopMaintenance = null;
  database.on("error", (error) => {
    capacity?.telemetry?.recordPoolError();
    logError("database.pool_error", { errorCode: safePoolErrorCode(error) });
  });
  try {
    const ceiling = await assertDatabaseConnectionCeiling(database, budget);
    const migrations = await assertMigrationsCurrent(database);
    const requiredPushStatus = assertRequiredPushProvider(
      environment,
      pushProviderStatus(environment),
      { required: hosted },
    );
    capacity = startCapacityRuntime({
      role,
      pool: database,
      beforeFlush: async () => ({
        workerBacklog: await readPushDeliveryBacklog(database),
      }),
    });
    const pushStatus = startPushDeliveryWorker(database, {
      unref: false,
      onResult: (result) => capacity.telemetry?.recordWorker(result),
      onError: (error) => {
        capacity.telemetry?.recordWorker({ failed: 1 });
        logError("push.worker_failed", { error });
      },
      environment,
      required: hosted,
    });
    if (pushStatus.mode !== requiredPushStatus.mode) {
      throw new Error("Push provider status changed during worker startup.");
    }
    if (!pushStatus.ok) {
      logWarn("push.setup_required", { missing: pushStatus.missing });
    }
    stopMaintenance = startDatabaseMaintenance(database, {
      intervalMs: Number(environment.DATABASE_MAINTENANCE_INTERVAL_MS ?? 60 * 60 * 1_000),
      batchSize: Number(environment.DATABASE_MAINTENANCE_BATCH_SIZE ?? 500),
      unref: false,
      onResult: (result) => capacity.telemetry?.recordMaintenance(result),
      onError: (error) => logWarn("database.maintenance_failed", { error }),
    });
    logInfo("worker.started", {
      processRole: role,
      migrationVersion: migrations.latestVersion,
      databasePoolMax: database.options.max,
      databaseUsableConnections: ceiling.observedUsableConnections,
      pushMode: pushStatus.mode,
    });
  } catch (error) {
    await stopMaintenance?.();
    await stopPushDeliveryWorker();
    await capacity?.stop();
    await database.end();
    throw error;
  }

  return {
    role,
    getServer: () => null,
    async closeResources() {
      await stopMaintenance?.();
      await stopPushDeliveryWorker();
      await capacity?.stop();
      await database.end();
    },
  };
}

async function runWorkerReadinessRuntime(role, environment, budget) {
  if (isHostedRuntime(environment)) assertWorkerShutdownBudget(environment);
  const database = createDatabasePool({ role, environment });
  database.on("error", (error) => {
    logError("database.pool_error", { errorCode: safePoolErrorCode(error) });
  });
  try {
    const ceiling = await assertDatabaseConnectionCeiling(database, budget);
    const migrations = await assertMigrationsCurrent(database);
    const pushStatus = assertRequiredPushProvider(
      environment,
      pushProviderStatus(environment),
      { required: isHostedRuntime(environment) },
    );
    logInfo("worker.predeploy_ready", {
      processRole: role,
      migrationVersion: migrations.latestVersion,
      databasePoolMax: database.options.max,
      databaseUsableConnections: ceiling.observedUsableConnections,
      pushMode: pushStatus.mode,
    });
    return {
      migrationVersion: migrations.latestVersion,
      databaseUsableConnections: ceiling.observedUsableConnections,
    };
  } finally {
    await database.end();
  }
}

async function runMigrationRuntime(role, environment, budget) {
  const database = createDatabasePool({ role, environment });
  database.on("error", (error) => {
    logError("database.pool_error", { errorCode: safePoolErrorCode(error) });
  });
  try {
    const ceiling = await assertDatabaseConnectionCeiling(database, budget);
    const result = await migrateUp(database);
    logInfo("migrate.complete", {
      processRole: role,
      latestVersion: result.latestVersion,
      pendingCount: result.pending.length,
      databaseUsableConnections: ceiling.observedUsableConnections,
    });
    return result;
  } finally {
    await database.end();
  }
}

async function startHttpRuntime(role, environment) {
  const hosted = isHostedRuntime(environment);
  assertRequiredPushProvider(
    environment,
    pushProviderStatus(environment),
    { required: hosted },
  );
  const serverModule = await import("./index.js");
  serverModule.startCapacityMeasurements({
    includeWorkerBacklog: processCapabilities(role).runsPushWorker,
  });
  const server = await serverModule.startServer();
  if (
    (processCapabilities(role).runsPushWorker || processCapabilities(role).runsMaintenance)
    && process.env.DATABASE_URL?.trim()
  ) {
    serverModule.startBackgroundServices({ unref: true });
  }
  return {
    role,
    getServer: () => serverModule.httpServer ?? server,
    closeResources: serverModule.closeDatabase,
  };
}

export async function startConfiguredRuntime({
  requestedRole = process.argv[2] ?? null,
} = {}) {
  const environment = process.env;
  const workerReadinessCheck = requestedRole === "worker-check";
  const role = resolveProcessRole(environment, {
    requestedRole: workerReadinessCheck ? "worker" : requestedRole,
    allowLocalCombinedDefault: true,
  });
  environment.RIVT_PROCESS_ROLE = role;
  const budget = assertConnectionBudget(environment);
  logInfo("runtime.configuration_ready", {
    processRole: role,
    plannedDatabaseConnections: budget.plannedConnections,
    databaseConnectionHeadroomPercent: budget.headroomPercent,
  });

  if (role === "migrate") {
    await runMigrationRuntime(role, environment, budget);
    return { role, completed: true };
  }
  if (workerReadinessCheck) {
    await runWorkerReadinessRuntime(role, environment, budget);
    return { role, completed: true };
  }
  if (role === "worker") {
    return startWorkerRuntime(role, environment, budget);
  }
  return startHttpRuntime(role, environment);
}

function reportOperationalFailure(error, source) {
  return Promise.resolve(captureException(error, { source }))
    .catch((monitoringError) => {
      logWarn("process.error_monitoring_failed", {
        source,
        error: monitoringError,
      });
    });
}

function installProcessFailureHandlers() {
  let uncaughtFailureActive = false;
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error("Unhandled promise rejection");
    logError("process.unhandled_rejection", { error });
    void reportOperationalFailure(error, "process.unhandled_rejection");
  });
  process.on("uncaughtException", (error) => {
    if (uncaughtFailureActive) {
      process.exit(1);
      return;
    }
    uncaughtFailureActive = true;
    logError("process.uncaught_exception", { error });
    void reportOperationalFailure(error, "process.uncaught_exception")
      .finally(() => process.exit(1));
    setTimeout(() => process.exit(1), 1_000).unref();
  });
}

async function main() {
  installProcessFailureHandlers();
  const runtime = await startConfiguredRuntime();
  if (runtime.completed) return;

  const shutdown = createGracefulShutdown({
    getServer: runtime.getServer,
    closeResources: runtime.closeResources,
    timeoutMs: Number(
      process.env.HTTP_SHUTDOWN_TIMEOUT_MS
      ?? DEFAULT_HTTP_SERVER_TIMEOUTS.shutdownTimeoutMs,
    ),
  });
  let terminationPromise = null;
  const terminate = (signal) => {
    if (terminationPromise) return;
    const startedAt = Date.now();
    logInfo("runtime.shutdown_started", { processRole: runtime.role, signal });
    terminationPromise = shutdown(signal)
      .then(({ forced }) => {
        const durationMs = Math.max(0, Date.now() - startedAt);
        if (forced) {
          logWarn("runtime.shutdown_forced", {
            processRole: runtime.role,
            signal,
            durationMs,
          });
          process.exit(1);
          return;
        }
        logInfo("runtime.shutdown_complete", {
          processRole: runtime.role,
          signal,
          durationMs,
        });
        process.exitCode = 0;
      })
      .catch((error) => {
        logError("runtime.shutdown_failed", {
          processRole: runtime.role,
          signal,
          error,
        });
        process.exit(1);
      });
  };
  process.once("SIGTERM", () => terminate("SIGTERM"));
  process.once("SIGINT", () => terminate("SIGINT"));
}

const isEntrypoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === String(process.argv[1]).toLowerCase();

if (isEntrypoint) {
  main().catch((error) => {
    logError("runtime.startup_failed", { error });
    void reportOperationalFailure(error, "runtime.startup_failed")
      .finally(() => process.exit(1));
    setTimeout(() => process.exit(1), 2_000).unref();
  });
}
