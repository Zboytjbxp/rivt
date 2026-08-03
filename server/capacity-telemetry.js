const CAPACITY_SCHEMA = "capacity.aggregate.v1";
const PROCESS_ROLES = new Set(["web", "worker", "migrate", "combined"]);
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "OTHER"]);
const STATUS_CLASSES = new Set(["1xx", "2xx", "3xx", "4xx", "5xx", "other"]);
const ROUTE_FAMILIES = new Set([
  "health",
  "readiness",
  "auth",
  "public_discovery",
  "jobs_work",
  "messaging_notifications",
  "shop_talk_news",
  "tools_records",
  "contacts_people",
  "profile_account",
  "billing_payments",
  "uploads_media",
  "other",
]);
const DURATION_LIMITS_MS = Object.freeze([50, 100, 250, 500, 1_000, 2_500, 5_000]);
const DURATION_BUCKET_KEYS = Object.freeze([
  "le50",
  "le100",
  "le250",
  "le500",
  "le1000",
  "le2500",
  "le5000",
  "over5000",
]);

function safeNumber(value, { integer = false, minimum = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return minimum;
  const bounded = Math.max(minimum, parsed);
  return integer ? Math.floor(bounded) : Math.round(bounded * 100) / 100;
}

function safeMethod(method) {
  const normalized = String(method ?? "").trim().toUpperCase();
  return HTTP_METHODS.has(normalized) ? normalized : "OTHER";
}

function statusClass(statusCode) {
  const parsed = Number(statusCode);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 599) return "other";
  return `${Math.floor(parsed / 100)}xx`;
}

function pathOnly(pathValue) {
  return String(pathValue ?? "").split(/[?#]/, 1)[0].toLowerCase();
}

export function capacityRouteFamily(pathValue) {
  const path = pathOnly(pathValue);
  if (path === "/api/health") return "health";
  if (path === "/api/readiness") return "readiness";
  if (path.startsWith("/pay/") || path.startsWith("/api/stripe") || path.startsWith("/api/v1/billing")) {
    return "billing_payments";
  }
  if (/^\/api\/(?:v1\/)?auth(?:\/|$)/.test(path)) return "auth";
  if (path.startsWith("/api/public") || path.startsWith("/api/v1/public")) return "public_discovery";
  if (/^\/api\/v1\/(?:jobs|applications|offers|active-work|projects)(?:\/|$)/.test(path)) return "jobs_work";
  if (/^\/api\/v1\/(?:conversations|messages|notifications|push|push-subscriptions)(?:\/|$)/.test(path)) {
    return "messaging_notifications";
  }
  if (
    path.startsWith("/api/news")
    || /^\/api\/v1\/(?:shop-talk|communities)(?:\/|$)/.test(path)
  ) return "shop_talk_news";
  if (/^\/api\/v1\/(?:tool-records|workspace-records|standalone-projects)(?:\/|$)/.test(path)) {
    return "tools_records";
  }
  if (/^\/api\/v1\/(?:contacts|customers|network-records)(?:\/|$)/.test(path)) {
    return "contacts_people";
  }
  if (/^\/api\/v1\/(?:me|onboarding|profiles|professional-profile|sessions|storage)(?:\/|$)/.test(path)) {
    return "profile_account";
  }
  if (/^\/api\/v1\/(?:albums|uploads|media|document-brand)(?:\/|$)/.test(path)) {
    return "uploads_media";
  }
  return "other";
}

function durationBucketIndex(durationMs) {
  const duration = safeNumber(durationMs);
  const index = DURATION_LIMITS_MS.findIndex((limit) => duration <= limit);
  return index === -1 ? DURATION_BUCKET_KEYS.length - 1 : index;
}

function emptyDuration() {
  return {
    sumMs: 0,
    maxMs: 0,
    buckets: Object.fromEntries(DURATION_BUCKET_KEYS.map((key) => [key, 0])),
  };
}

function recordDuration(target, durationMs) {
  const duration = safeNumber(durationMs);
  target.sumMs = Math.round((target.sumMs + duration) * 100) / 100;
  target.maxMs = Math.max(target.maxMs, duration);
  target.buckets[DURATION_BUCKET_KEYS[durationBucketIndex(duration)]] += 1;
}

function emptyCounters() {
  return {
    requests: {
      total: 0,
      activePeak: 0,
      aborted: 0,
      groups: new Map(),
    },
    uploads: {
      accepted: 0,
      rejected: 0,
      bytes: 0,
      activePeak: 0,
      peakRssBytes: 0,
    },
    worker: {
      batches: 0,
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      stale: 0,
      pending: 0,
      processing: 0,
      oldestPendingAgeSeconds: 0,
      durationMs: emptyDuration(),
    },
    maintenance: {
      runs: 0,
      acquired: 0,
      skipped: 0,
      failures: 0,
      rowsPruned: 0,
      durationMs: emptyDuration(),
    },
    dependencies: {
      probes: 0,
      failures: 0,
      databaseFailures: 0,
      objectStorageFailures: 0,
      durationMs: emptyDuration(),
    },
  };
}

function memorySnapshot(memoryUsage) {
  const memory = typeof memoryUsage === "function" ? memoryUsage() : {};
  return {
    rssBytes: safeNumber(memory?.rss, { integer: true }),
    heapUsedBytes: safeNumber(memory?.heapUsed, { integer: true }),
    heapTotalBytes: safeNumber(memory?.heapTotal, { integer: true }),
    externalBytes: safeNumber(memory?.external, { integer: true }),
    arrayBuffersBytes: safeNumber(memory?.arrayBuffers, { integer: true }),
  };
}

function eventLoopSnapshot(eventLoopStats) {
  const eventLoop = typeof eventLoopStats === "function" ? eventLoopStats() : {};
  return {
    meanMs: safeNumber(eventLoop?.meanMs),
    maxMs: safeNumber(eventLoop?.maxMs),
    p95Ms: safeNumber(eventLoop?.p95Ms),
    p99Ms: safeNumber(eventLoop?.p99Ms),
  };
}

function poolSnapshot(pool) {
  return {
    configuredMax: safeNumber(pool?.options?.max, { integer: true }),
    total: safeNumber(pool?.totalCount, { integer: true }),
    idle: safeNumber(pool?.idleCount, { integer: true }),
    waiting: safeNumber(pool?.waitingCount, { integer: true }),
  };
}

export function createCapacityTelemetry({
  role,
  pool = null,
  now = () => Date.now(),
  memoryUsage = () => process.memoryUsage(),
  eventLoopStats = () => ({ meanMs: 0, maxMs: 0, p95Ms: 0, p99Ms: 0 }),
} = {}) {
  if (!PROCESS_ROLES.has(role)) throw new Error("Capacity telemetry requires an allowlisted process role.");
  let startedAtMs = safeNumber(now(), { integer: true });
  let counters = emptyCounters();
  let activeRequests = 0;
  let activeUploads = 0;
  let poolErrors = 0;

  function beginHttp({ multipart = false } = {}) {
    activeRequests += 1;
    counters.requests.activePeak = Math.max(counters.requests.activePeak, activeRequests);
    if (multipart) {
      activeUploads += 1;
      counters.uploads.activePeak = Math.max(counters.uploads.activePeak, activeUploads);
    }
    let finished = false;
    return (record = {}) => {
      if (finished) return;
      finished = true;
      activeRequests = Math.max(0, activeRequests - 1);
      if (multipart) activeUploads = Math.max(0, activeUploads - 1);
      recordHttp({ ...record, multipart });
    };
  }

  function recordHttp({
    method,
    path,
    routeFamily,
    statusCode,
    durationMs,
    aborted = false,
    multipart = false,
    uploadBytes = 0,
  } = {}) {
    const family = ROUTE_FAMILIES.has(routeFamily) ? routeFamily : capacityRouteFamily(path);
    const normalizedMethod = safeMethod(method);
    const normalizedStatus = statusClass(statusCode);
    const key = `${normalizedMethod}|${family}|${normalizedStatus}`;
    const group = counters.requests.groups.get(key) ?? {
      method: normalizedMethod,
      routeFamily: family,
      statusClass: normalizedStatus,
      count: 0,
      durationMs: emptyDuration(),
    };
    group.count += 1;
    recordDuration(group.durationMs, durationMs);
    counters.requests.groups.set(key, group);
    counters.requests.total += 1;
    if (aborted) counters.requests.aborted += 1;

    if (multipart) {
      if (Number(statusCode) >= 200 && Number(statusCode) < 400) {
        counters.uploads.accepted += 1;
        counters.uploads.bytes += safeNumber(uploadBytes, { integer: true });
      } else {
        counters.uploads.rejected += 1;
      }
      counters.uploads.peakRssBytes = Math.max(
        counters.uploads.peakRssBytes,
        memorySnapshot(memoryUsage).rssBytes,
      );
    }
  }

  function recordWorker({
    claimed = 0,
    sent = 0,
    retried = 0,
    failed = 0,
    stale = 0,
    durationMs = 0,
    pending = 0,
    processing = 0,
    oldestPendingAgeSeconds = 0,
  } = {}) {
    counters.worker.batches += 1;
    counters.worker.claimed += safeNumber(claimed, { integer: true });
    counters.worker.sent += safeNumber(sent, { integer: true });
    counters.worker.retried += safeNumber(retried, { integer: true });
    counters.worker.failed += safeNumber(failed, { integer: true });
    counters.worker.stale += safeNumber(stale, { integer: true });
    counters.worker.pending = safeNumber(pending, { integer: true });
    counters.worker.processing = safeNumber(processing, { integer: true });
    counters.worker.oldestPendingAgeSeconds = safeNumber(oldestPendingAgeSeconds, { integer: true });
    recordDuration(counters.worker.durationMs, durationMs);
  }

  function recordMaintenance({
    acquired = false,
    pruned = 0,
    durationMs = 0,
    failed = false,
  } = {}) {
    counters.maintenance.runs += 1;
    if (acquired) counters.maintenance.acquired += 1;
    else if (!failed) counters.maintenance.skipped += 1;
    if (failed) counters.maintenance.failures += 1;
    counters.maintenance.rowsPruned += safeNumber(pruned, { integer: true });
    recordDuration(counters.maintenance.durationMs, durationMs);
  }

  function recordPoolError() {
    poolErrors += 1;
  }

  function recordWorkerBacklog({
    pending = 0,
    processing = 0,
    oldestPendingAgeSeconds = 0,
  } = {}) {
    counters.worker.pending = safeNumber(pending, { integer: true });
    counters.worker.processing = safeNumber(processing, { integer: true });
    counters.worker.oldestPendingAgeSeconds = safeNumber(oldestPendingAgeSeconds, { integer: true });
  }

  function recordDependencyProbe({
    databaseOk = false,
    objectStorageOk = false,
    durationMs = 0,
  } = {}) {
    counters.dependencies.probes += 1;
    if (!databaseOk || !objectStorageOk) counters.dependencies.failures += 1;
    if (!databaseOk) counters.dependencies.databaseFailures += 1;
    if (!objectStorageOk) counters.dependencies.objectStorageFailures += 1;
    recordDuration(counters.dependencies.durationMs, durationMs);
  }

  function snapshot({ reset = false } = {}) {
    const endedAtMs = safeNumber(now(), { integer: true });
    const result = {
      schema: CAPACITY_SCHEMA,
      role,
      window: {
        startedAtMs,
        endedAtMs,
        durationMs: Math.max(0, endedAtMs - startedAtMs),
      },
      process: {
        ...memorySnapshot(memoryUsage),
        eventLoopDelayMs: eventLoopSnapshot(eventLoopStats),
      },
      pool: {
        ...poolSnapshot(pool),
        errors: poolErrors,
      },
      requests: {
        total: counters.requests.total,
        activePeak: counters.requests.activePeak,
        aborted: counters.requests.aborted,
        groups: [...counters.requests.groups.values()]
          .sort((left, right) => (
            left.routeFamily.localeCompare(right.routeFamily)
            || left.method.localeCompare(right.method)
            || left.statusClass.localeCompare(right.statusClass)
          )),
      },
      uploads: { ...counters.uploads },
      worker: {
        ...counters.worker,
        durationMs: {
          ...counters.worker.durationMs,
          buckets: { ...counters.worker.durationMs.buckets },
        },
      },
      maintenance: {
        ...counters.maintenance,
        durationMs: {
          ...counters.maintenance.durationMs,
          buckets: { ...counters.maintenance.durationMs.buckets },
        },
      },
      dependencies: {
        ...counters.dependencies,
        durationMs: {
          ...counters.dependencies.durationMs,
          buckets: { ...counters.dependencies.durationMs.buckets },
        },
      },
    };
    validateCapacitySnapshot(result);
    if (reset) {
      counters = emptyCounters();
      poolErrors = 0;
      startedAtMs = endedAtMs;
    }
    return result;
  }

  return {
    beginHttp,
    recordDependencyProbe,
    recordHttp,
    recordMaintenance,
    recordPoolError,
    recordWorker,
    recordWorkerBacklog,
    snapshot,
  };
}

function assertExactKeys(value, expectedKeys, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  const unexpected = actual.filter((key) => !expected.includes(key));
  const missing = expected.filter((key) => !actual.includes(key));
  if (unexpected.length) throw new Error(`${location} has an unexpected field: ${unexpected[0]}.`);
  if (missing.length) throw new Error(`${location} is missing field: ${missing[0]}.`);
}

function assertNonNegativeNumbers(value, location) {
  for (const [key, fieldValue] of Object.entries(value)) {
    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue) || fieldValue < 0) {
      throw new Error(`${location}.${key} must be a non-negative number.`);
    }
  }
}

function validateDuration(value, location) {
  assertExactKeys(value, ["sumMs", "maxMs", "buckets"], location);
  assertNonNegativeNumbers({ sumMs: value.sumMs, maxMs: value.maxMs }, location);
  assertExactKeys(value.buckets, DURATION_BUCKET_KEYS, `${location}.buckets`);
  assertNonNegativeNumbers(value.buckets, `${location}.buckets`);
}

export function validateCapacitySnapshot(snapshot) {
  assertExactKeys(snapshot, [
    "schema",
    "role",
    "window",
    "process",
    "pool",
    "requests",
    "uploads",
    "worker",
    "maintenance",
    "dependencies",
  ], "snapshot");
  if (snapshot.schema !== CAPACITY_SCHEMA) throw new Error("snapshot.schema is invalid.");
  if (!PROCESS_ROLES.has(snapshot.role)) throw new Error("snapshot.role is invalid.");

  assertExactKeys(snapshot.window, ["startedAtMs", "endedAtMs", "durationMs"], "snapshot.window");
  assertNonNegativeNumbers(snapshot.window, "snapshot.window");
  assertExactKeys(snapshot.process, [
    "rssBytes",
    "heapUsedBytes",
    "heapTotalBytes",
    "externalBytes",
    "arrayBuffersBytes",
    "eventLoopDelayMs",
  ], "snapshot.process");
  assertNonNegativeNumbers({
    rssBytes: snapshot.process.rssBytes,
    heapUsedBytes: snapshot.process.heapUsedBytes,
    heapTotalBytes: snapshot.process.heapTotalBytes,
    externalBytes: snapshot.process.externalBytes,
    arrayBuffersBytes: snapshot.process.arrayBuffersBytes,
  }, "snapshot.process");
  assertExactKeys(snapshot.process.eventLoopDelayMs, ["meanMs", "maxMs", "p95Ms", "p99Ms"], "snapshot.process.eventLoopDelayMs");
  assertNonNegativeNumbers(snapshot.process.eventLoopDelayMs, "snapshot.process.eventLoopDelayMs");

  assertExactKeys(snapshot.pool, ["configuredMax", "total", "idle", "waiting", "errors"], "snapshot.pool");
  assertNonNegativeNumbers(snapshot.pool, "snapshot.pool");
  assertExactKeys(snapshot.requests, ["total", "activePeak", "aborted", "groups"], "snapshot.requests");
  assertNonNegativeNumbers({
    total: snapshot.requests.total,
    activePeak: snapshot.requests.activePeak,
    aborted: snapshot.requests.aborted,
  }, "snapshot.requests");
  if (!Array.isArray(snapshot.requests.groups) || snapshot.requests.groups.length > HTTP_METHODS.size * ROUTE_FAMILIES.size * STATUS_CLASSES.size) {
    throw new Error("snapshot.requests.groups is invalid.");
  }
  for (const [index, group] of snapshot.requests.groups.entries()) {
    const location = `snapshot.requests.groups[${index}]`;
    assertExactKeys(group, ["method", "routeFamily", "statusClass", "count", "durationMs"], location);
    if (!HTTP_METHODS.has(group.method)) throw new Error(`${location}.method is invalid.`);
    if (!ROUTE_FAMILIES.has(group.routeFamily)) throw new Error(`${location}.routeFamily is invalid.`);
    if (!STATUS_CLASSES.has(group.statusClass)) throw new Error(`${location}.statusClass is invalid.`);
    assertNonNegativeNumbers({ count: group.count }, location);
    validateDuration(group.durationMs, `${location}.durationMs`);
  }

  assertExactKeys(snapshot.uploads, ["accepted", "rejected", "bytes", "activePeak", "peakRssBytes"], "snapshot.uploads");
  assertNonNegativeNumbers(snapshot.uploads, "snapshot.uploads");
  assertExactKeys(snapshot.worker, [
    "batches",
    "claimed",
    "sent",
    "retried",
    "failed",
    "stale",
    "pending",
    "processing",
    "oldestPendingAgeSeconds",
    "durationMs",
  ], "snapshot.worker");
  assertNonNegativeNumbers({
    batches: snapshot.worker.batches,
    claimed: snapshot.worker.claimed,
    sent: snapshot.worker.sent,
    retried: snapshot.worker.retried,
    failed: snapshot.worker.failed,
    stale: snapshot.worker.stale,
    pending: snapshot.worker.pending,
    processing: snapshot.worker.processing,
    oldestPendingAgeSeconds: snapshot.worker.oldestPendingAgeSeconds,
  }, "snapshot.worker");
  validateDuration(snapshot.worker.durationMs, "snapshot.worker.durationMs");
  assertExactKeys(snapshot.maintenance, [
    "runs",
    "acquired",
    "skipped",
    "failures",
    "rowsPruned",
    "durationMs",
  ], "snapshot.maintenance");
  assertNonNegativeNumbers({
    runs: snapshot.maintenance.runs,
    acquired: snapshot.maintenance.acquired,
    skipped: snapshot.maintenance.skipped,
    failures: snapshot.maintenance.failures,
    rowsPruned: snapshot.maintenance.rowsPruned,
  }, "snapshot.maintenance");
  validateDuration(snapshot.maintenance.durationMs, "snapshot.maintenance.durationMs");
  assertExactKeys(snapshot.dependencies, [
    "probes",
    "failures",
    "databaseFailures",
    "objectStorageFailures",
    "durationMs",
  ], "snapshot.dependencies");
  assertNonNegativeNumbers({
    probes: snapshot.dependencies.probes,
    failures: snapshot.dependencies.failures,
    databaseFailures: snapshot.dependencies.databaseFailures,
    objectStorageFailures: snapshot.dependencies.objectStorageFailures,
  }, "snapshot.dependencies");
  validateDuration(snapshot.dependencies.durationMs, "snapshot.dependencies.durationMs");
  return true;
}

export function capacityTelemetryEnabled(environment = process.env) {
  return ["1", "true", "yes", "on"].includes(
    String(environment.RIVT_CAPACITY_TELEMETRY_ENABLED ?? "").trim().toLowerCase(),
  );
}

export const capacityTelemetryInternals = {
  CAPACITY_SCHEMA,
  DURATION_BUCKET_KEYS,
  DURATION_LIMITS_MS,
  HTTP_METHODS,
  ROUTE_FAMILIES,
  STATUS_CLASSES,
  durationBucketIndex,
};
