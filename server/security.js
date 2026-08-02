import { createHash, createHmac } from "node:crypto";
import { logWarn } from "./logger.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const LOCAL_DEV_ORIGIN_PATTERN = /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/i;
const DURABLE_RATE_LIMIT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const DURABLE_RATE_LIMIT_CLEANUP_BATCH_SIZE = 250;
const DURABLE_RATE_LIMIT_CLEANUP_MAX_BATCH_SIZE = 500;
const DURABLE_RATE_LIMIT_CLEANUP_MAX_BATCHES = 8;
const DURABLE_RATE_LIMIT_CLEANUP_MAX_BATCHES_CAP = 16;
const DURABLE_RATE_LIMIT_CLEANUP_TIME_BUDGET_MS = 250;
const DURABLE_RATE_LIMIT_CLEANUP_TIME_BUDGET_CAP_MS = 2_000;
const DURABLE_RATE_LIMIT_CLEANUP_BACKLOG_RETRY_MS = 60_000;
const DEFAULT_IN_MEMORY_RATE_LIMIT_MAX_ENTRIES = 10_000;
const durableRateLimitCleanupState = new WeakMap();

function requestHeader(request, name) {
  return request.get?.(name)
    ?? request.headers?.[name.toLowerCase()]
    ?? request.headers?.[name]
    ?? null;
}

function sourceOriginFromReferer(value) {
  if (!value) return null;
  try {
    return new URL(String(value)).origin;
  } catch {
    return "invalid";
  }
}

function decodeCookiePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie ?? "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        if (separator === -1) return [cookie, ""];
        return [
          decodeCookiePart(cookie.slice(0, separator)),
          decodeCookiePart(cookie.slice(separator + 1)),
        ];
      }),
  );
}

export function readSessionId(request, cookieName) {
  const value = parseCookies(request)[cookieName];
  return SESSION_ID_PATTERN.test(value ?? "") ? value : null;
}

export function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  const allowed = new Set((allowedOrigins ?? []).filter(Boolean));
  if (allowed.has(origin)) return true;
  if (process.env.NODE_ENV !== "production" && LOCAL_DEV_ORIGIN_PATTERN.test(origin)) return true;
  return false;
}

export function createOriginGuard(allowedOrigins, { exemptPaths = [] } = {}) {
  const exemptions = new Set(exemptPaths);
  return function originGuard(request, response, next) {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const requestPath = String(request.originalUrl ?? request.url ?? request.path ?? "").split("?", 1)[0];
    if (exemptions.has(requestPath)) {
      next();
      return;
    }

    const fetchSite = String(requestHeader(request, "sec-fetch-site") ?? "").toLowerCase();
    if (fetchSite === "cross-site" || fetchSite === "same-site") {
      response.status(403).json({
        ok: false,
        error: "Request origin is not allowed.",
      });
      return;
    }

    const origin = requestHeader(request, "origin");
    if (origin) {
      if (isAllowedOrigin(origin, allowedOrigins)) {
        next();
        return;
      }
      response.status(403).json({
        ok: false,
        error: "Request origin is not allowed.",
      });
      return;
    }

    const refererOrigin = sourceOriginFromReferer(requestHeader(request, "referer"));
    if (refererOrigin) {
      if (refererOrigin !== "invalid" && isAllowedOrigin(refererOrigin, allowedOrigins)) {
        next();
        return;
      }
      response.status(403).json({
        ok: false,
        error: "Request origin is not allowed.",
      });
      return;
    }

    // Non-browser clients may omit browser source headers. Browser requests
    // still carry Fetch Metadata and/or Origin in supported clients, while
    // SameSite=Lax remains the legacy-browser defense in depth.
    if (!fetchSite || fetchSite === "same-origin" || fetchSite === "none") {
      next();
      return;
    }

    response.status(403).json({
      ok: false,
      error: "Request origin is not allowed.",
    });
  };
}

function positiveSafeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${name} must be a positive safe integer.`);
  }
  return parsed;
}

export function createRateLimiter({
  windowMs,
  max,
  namespace = "default",
  maxEntries = DEFAULT_IN_MEMORY_RATE_LIMIT_MAX_ENTRIES,
  clock = Date.now,
}) {
  const boundedWindowMs = positiveSafeInteger(windowMs, "windowMs");
  const boundedMax = positiveSafeInteger(max, "max");
  const boundedMaxEntries = positiveSafeInteger(maxEntries, "maxEntries");
  if (typeof clock !== "function") {
    throw new TypeError("clock must be a function.");
  }
  const entries = new Map();

  return function rateLimit(request, response, next) {
    const now = clock();
    const actor = request.authUser?.id ?? request.ip ?? request.socket?.remoteAddress ?? "unknown";
    const key = `${namespace}:${actor}`;
    const current = entries.get(key);

    if (!current && entries.size >= boundedMaxEntries) {
      for (const [candidateKey, candidate] of entries) {
        if (candidate.resetAt <= now) entries.delete(candidateKey);
      }
      while (entries.size >= boundedMaxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }
    }

    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + boundedWindowMs }
      : current;

    entry.count += 1;
    entries.set(key, entry);

    response.setHeader("RateLimit-Limit", String(boundedMax));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, boundedMax - entry.count)));
    response.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > boundedMax) {
      response.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      response.status(429).json({
        ok: false,
        error: "Too many requests. Try again shortly.",
      });
      return;
    }

    next();
  };
}

function rateLimitSubject(request) {
  const actorId = request.actor?.account?.id ?? request.authUser?.id;
  if (actorId) return `account:${actorId}`;
  return `ip:${request.ip ?? request.socket?.remoteAddress ?? "unknown"}`;
}

export function loginEmailRateLimitSubject(request) {
  const rawEmail = typeof request.body?.email === "string" ? request.body.email : "";
  const normalizedEmail = rawEmail.trim().toLowerCase().slice(0, 320);
  return `login-email:${normalizedEmail || "missing"}`;
}

function hashRateLimitSubject(value) {
  const pepper = process.env.RATE_LIMIT_PEPPER?.trim() || process.env.AUTH_METADATA_PEPPER?.trim();
  return pepper
    ? createHmac("sha256", pepper).update(String(value)).digest("hex")
    : createHash("sha256").update(String(value)).digest("hex");
}

function scheduleExpiredRateLimitWindowCleanup(database, {
  now,
  intervalMs,
  batchSize,
  maxBatches,
  timeBudgetMs,
  cleanupClock,
}) {
  let state = durableRateLimitCleanupState.get(database);
  if (!state) {
    state = { nextCleanupAt: 0, inFlight: null };
    durableRateLimitCleanupState.set(database, state);
  }
  if (state.inFlight || now < state.nextCleanupAt) return;

  state.nextCleanupAt = now + intervalMs;
  const cleanupTask = (async () => {
    const startedAt = cleanupClock();
    let batches = 0;
    let backlogLikely = false;

    while (batches < maxBatches) {
      if (batches > 0 && cleanupClock() - startedAt >= timeBudgetMs) break;

      const result = await database.query(
        `DELETE FROM rate_limit_windows AS target
         USING (
           SELECT namespace, subject_hash, window_start_at
           FROM rate_limit_windows
           WHERE expires_at <= now()
           ORDER BY expires_at ASC
           LIMIT $1
         ) AS expired
         WHERE target.namespace = expired.namespace
           AND target.subject_hash = expired.subject_hash
           AND target.window_start_at = expired.window_start_at
           AND target.expires_at <= now()`,
        [batchSize],
      );
      batches += 1;
      backlogLikely = Number(result?.rowCount ?? 0) >= batchSize;
      if (!backlogLikely) break;
    }

    return { backlogLikely };
  })();
  state.inFlight = cleanupTask;
  void cleanupTask
    .then((result) => {
      if (result.backlogLikely) {
        state.nextCleanupAt = Math.min(
          state.nextCleanupAt,
          now + DURABLE_RATE_LIMIT_CLEANUP_BACKLOG_RETRY_MS,
        );
      }
    })
    .catch((error) => {
      logWarn("security.rate_limit_cleanup_failed", { error });
    })
    .finally(() => {
      if (state.inFlight === cleanupTask) state.inFlight = null;
    });
}

export function createDurableRateLimiter({
  database,
  databaseAvailable,
  windowMs,
  max,
  namespace = "default",
  subject = rateLimitSubject,
  cleanupIntervalMs = DURABLE_RATE_LIMIT_CLEANUP_INTERVAL_MS,
  cleanupBatchSize = DURABLE_RATE_LIMIT_CLEANUP_BATCH_SIZE,
  cleanupMaxBatches = DURABLE_RATE_LIMIT_CLEANUP_MAX_BATCHES,
  cleanupTimeBudgetMs = DURABLE_RATE_LIMIT_CLEANUP_TIME_BUDGET_MS,
  cleanupClock = Date.now,
  clock = Date.now,
}) {
  const boundedWindowMs = positiveSafeInteger(windowMs, "windowMs");
  const boundedMax = positiveSafeInteger(max, "max");
  if (typeof clock !== "function") {
    throw new TypeError("clock must be a function.");
  }
  if (typeof cleanupClock !== "function") {
    throw new TypeError("cleanupClock must be a function.");
  }
  const windowSeconds = Math.max(1, Math.ceil(boundedWindowMs / 1000));
  const boundedCleanupIntervalMs = Math.max(
    60_000,
    Number(cleanupIntervalMs) || DURABLE_RATE_LIMIT_CLEANUP_INTERVAL_MS,
  );
  const boundedCleanupBatchSize = Math.min(
    DURABLE_RATE_LIMIT_CLEANUP_MAX_BATCH_SIZE,
    Math.max(1, Math.floor(Number(cleanupBatchSize) || DURABLE_RATE_LIMIT_CLEANUP_BATCH_SIZE)),
  );
  const boundedCleanupMaxBatches = Math.min(
    DURABLE_RATE_LIMIT_CLEANUP_MAX_BATCHES_CAP,
    positiveSafeInteger(cleanupMaxBatches, "cleanupMaxBatches"),
  );
  const boundedCleanupTimeBudgetMs = Math.min(
    DURABLE_RATE_LIMIT_CLEANUP_TIME_BUDGET_CAP_MS,
    positiveSafeInteger(cleanupTimeBudgetMs, "cleanupTimeBudgetMs"),
  );

  return async function durableRateLimit(request, response, next) {
    if (!databaseAvailable() || !database) {
      response.status(503).json({
        ok: false,
        error: "Rate-limit storage is unavailable.",
      });
      return;
    }

    const now = clock();
    const windowStartMs = Math.floor(now / boundedWindowMs) * boundedWindowMs;
    const windowStartAt = new Date(windowStartMs);
    const resetAt = new Date(windowStartMs + boundedWindowMs);
    const subjectHash = hashRateLimitSubject(subject(request));

    try {
      const result = await database.query(
        `INSERT INTO rate_limit_windows (
           namespace, subject_hash, window_start_at, window_seconds, request_count, expires_at
         ) VALUES ($1, $2, $3, $4, 1, $5)
         ON CONFLICT (namespace, subject_hash, window_start_at)
         DO UPDATE SET request_count = rate_limit_windows.request_count + 1,
                       updated_at = now(),
                       expires_at = GREATEST(rate_limit_windows.expires_at, EXCLUDED.expires_at)
         RETURNING request_count, expires_at`,
        [namespace, subjectHash, windowStartAt, windowSeconds, resetAt],
      );
      scheduleExpiredRateLimitWindowCleanup(database, {
        now,
        intervalMs: boundedCleanupIntervalMs,
        batchSize: boundedCleanupBatchSize,
        maxBatches: boundedCleanupMaxBatches,
        timeBudgetMs: boundedCleanupTimeBudgetMs,
        cleanupClock,
      });
      const count = Number(result.rows[0]?.request_count ?? 0);
      const reset = new Date(result.rows[0]?.expires_at ?? resetAt);

      response.setHeader("RateLimit-Limit", String(boundedMax));
      response.setHeader("RateLimit-Remaining", String(Math.max(0, boundedMax - count)));
      response.setHeader("RateLimit-Reset", String(Math.ceil(reset.getTime() / 1000)));

      if (count > boundedMax) {
        response.setHeader("Retry-After", String(Math.max(1, Math.ceil((reset.getTime() - now) / 1000))));
        response.status(429).json({
          ok: false,
          error: "Too many requests. Try again shortly.",
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createRequireAuthenticatedUser({ databaseAvailable, findUserBySessionId, cookieName }) {
  return async function requireAuthenticatedUser(request, response, next) {
    if (!databaseAvailable()) {
      response.status(503).json({
        ok: false,
        error: "Managed account storage is unavailable.",
      });
      return;
    }

    const sessionId = readSessionId(request, cookieName);
    if (!sessionId) {
      response.status(401).json({ ok: false, error: "Authentication required." });
      return;
    }

    try {
      const user = await findUserBySessionId(sessionId);
      if (!user) {
        response.status(401).json({ ok: false, error: "Authentication required." });
        return;
      }

      request.authSessionId = sessionId;
      request.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
