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
  processCapabilities,
  resolveProcessRole,
} from "./process-role.js";
import {
  readPushDeliveryBacklog,
  startPushDeliveryWorker,
  stopPushDeliveryWorker,
} from "./push-notifications.js";

function safePoolErrorCode(error) {
  const candidate = String(error?.code ?? "").trim().toUpperCase();
  return /^[A-Z0-9_]{1,20}$/.test(candidate) ? candidate : "UNKNOWN";
}

async function startWorkerRuntime(role, environment) {
  const database = createDatabasePool({ role, environment });
  let capacity = null;
  let stopMaintenance = null;
  database.on("error", (error) => {
    capacity?.telemetry?.recordPoolError();
    logError("database.pool_error", { errorCode: safePoolErrorCode(error) });
  });
  try {
    const migrations = await assertMigrationsCurrent(database);
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
    });
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

async function runMigrationRuntime(role, environment) {
  const database = createDatabasePool({ role, environment });
  database.on("error", (error) => {
    logError("database.pool_error", { errorCode: safePoolErrorCode(error) });
  });
  try {
    const result = await migrateUp(database);
    logInfo("migrate.complete", {
      processRole: role,
      latestVersion: result.latestVersion,
      pendingCount: result.pending.length,
    });
    return result;
  } finally {
    await database.end();
  }
}

async function startHttpRuntime(role) {
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
  const role = resolveProcessRole(environment, {
    requestedRole,
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
    await runMigrationRuntime(role, environment);
    return { role, completed: true };
  }
  if (role === "worker") {
    return startWorkerRuntime(role, environment);
  }
  return startHttpRuntime(role);
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
