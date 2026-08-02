export const DEFAULT_DATABASE_MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
export const DEFAULT_DATABASE_MAINTENANCE_BATCH_SIZE = 500;
const MAX_DATABASE_MAINTENANCE_BATCH_SIZE = 1_000;

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

export function startDatabaseMaintenance(database, {
  intervalMs = DEFAULT_DATABASE_MAINTENANCE_INTERVAL_MS,
  batchSize = DEFAULT_DATABASE_MAINTENANCE_BATCH_SIZE,
  onError = () => {},
} = {}) {
  if (!database?.query) throw new TypeError("A database client is required.");
  const interval = Math.max(60_000, Number(intervalMs) || DEFAULT_DATABASE_MAINTENANCE_INTERVAL_MS);
  let stopped = false;
  let inFlight = null;

  const run = () => {
    if (stopped || inFlight) return inFlight;
    inFlight = pruneExpiredIdempotencyKeys(database, batchSize)
      .catch((error) => {
        onError(error);
        return 0;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  const timer = setInterval(() => {
    void run();
  }, interval);
  timer.unref?.();
  void run();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
