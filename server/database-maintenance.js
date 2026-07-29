import { boundedRuntimeInterval } from "./runtime-interval.js";

export const DEFAULT_DATABASE_MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
export const DEFAULT_DATABASE_MAINTENANCE_BATCH_SIZE = 500;
const MAX_DATABASE_MAINTENANCE_BATCH_SIZE = 1_000;
const DATABASE_MAINTENANCE_LOCK_NAME = "rivt-database-maintenance-v1";

function boundedBatchSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_DATABASE_MAINTENANCE_BATCH_SIZE;
  return Math.min(MAX_DATABASE_MAINTENANCE_BATCH_SIZE, Math.max(1, Math.floor(parsed)));
}

export async function pruneExpiredIdempotencyKeys(
  database,
  batchSize = DEFAULT_DATABASE_MAINTENANCE_BATCH_SIZE,
) {
  const bounded = boundedBatchSize(batchSize);
  const result = await database.query(
    `DELETE FROM idempotency_keys AS target
     USING (
       SELECT id
       FROM idempotency_keys
       WHERE expires_at <= now()
       ORDER BY expires_at ASC
       LIMIT $1
     ) AS expired
     WHERE target.id = expired.id
       AND target.expires_at <= now()
     RETURNING target.id`,
    [bounded],
  );
  return Number(result.rowCount ?? result.rows?.length ?? 0);
}

export async function runLeasedDatabaseMaintenance(database, {
  batchSize = DEFAULT_DATABASE_MAINTENANCE_BATCH_SIZE,
  prune = pruneExpiredIdempotencyKeys,
  now = () => Date.now(),
} = {}) {
  if (!database?.connect) throw new TypeError("A PostgreSQL pool is required.");
  const startedAt = now();
  const client = await database.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired",
      [DATABASE_MAINTENANCE_LOCK_NAME],
    );
    const acquired = lock.rows[0]?.acquired === true;
    if (!acquired) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return {
        acquired: false,
        pruned: 0,
        durationMs: Math.max(0, now() - startedAt),
      };
    }
    const pruned = await prune(client, batchSize);
    await client.query("COMMIT");
    transactionOpen = false;
    return {
      acquired: true,
      pruned: Number(pruned) || 0,
      durationMs: Math.max(0, now() - startedAt),
    };
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}

export function startDatabaseMaintenance(database, {
  intervalMs = DEFAULT_DATABASE_MAINTENANCE_INTERVAL_MS,
  batchSize = DEFAULT_DATABASE_MAINTENANCE_BATCH_SIZE,
  onError = () => {},
  onResult = () => {},
  runCycle = null,
  unref = true,
} = {}) {
  if (typeof runCycle !== "function" && !database?.connect) {
    throw new TypeError("A PostgreSQL pool is required.");
  }
  const interval = boundedRuntimeInterval(intervalMs, {
    name: "DATABASE_MAINTENANCE_INTERVAL_MS",
    fallback: DEFAULT_DATABASE_MAINTENANCE_INTERVAL_MS,
    minimum: 60_000,
    maximum: 24 * 60 * 60 * 1_000,
  });
  let stopped = false;
  let inFlight = null;

  const run = () => {
    if (stopped || inFlight) return inFlight;
    const execute = typeof runCycle === "function"
      ? runCycle
      : () => runLeasedDatabaseMaintenance(database, { batchSize });
    inFlight = Promise.resolve()
      .then(execute)
      .then((result) => {
        onResult({ ...result, failed: false });
        return result;
      })
      .catch((error) => {
        onError(error);
        const result = {
          acquired: false,
          pruned: 0,
          durationMs: 0,
          failed: true,
        };
        onResult(result);
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  const timer = setInterval(() => {
    void run();
  }, interval);
  if (unref) timer.unref?.();
  void run();

  return async () => {
    stopped = true;
    clearInterval(timer);
    await inFlight;
  };
}

export const databaseMaintenanceInternals = {
  DATABASE_MAINTENANCE_LOCK_NAME,
  MAX_DATABASE_MAINTENANCE_BATCH_SIZE,
  boundedBatchSize,
};
