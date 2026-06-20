import { createHash, createHmac } from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

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

export function createOriginGuard(allowedOrigins) {
  const allowed = new Set(allowedOrigins.filter(Boolean));

  return function originGuard(request, response, next) {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const origin = request.get("origin");
    if (!origin || allowed.has(origin)) {
      next();
      return;
    }

    response.status(403).json({
      ok: false,
      error: "Request origin is not allowed.",
    });
  };
}

export function createRateLimiter({ windowMs, max, namespace = "default" }) {
  const entries = new Map();

  return function rateLimit(request, response, next) {
    const now = Date.now();
    const actor = request.authUser?.id ?? request.ip ?? request.socket?.remoteAddress ?? "unknown";
    const key = `${namespace}:${actor}`;
    const current = entries.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    entry.count += 1;
    entries.set(key, entry);

    response.setHeader("RateLimit-Limit", String(max));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    response.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      response.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      response.status(429).json({
        ok: false,
        error: "Too many requests. Try again shortly.",
      });
      return;
    }

    if (entries.size > 10_000) {
      for (const [candidateKey, candidate] of entries) {
        if (candidate.resetAt <= now) entries.delete(candidateKey);
      }
    }

    next();
  };
}

function rateLimitSubject(request) {
  const actorId = request.actor?.account?.id ?? request.authUser?.id;
  if (actorId) return `account:${actorId}`;
  return `ip:${request.ip ?? request.socket?.remoteAddress ?? "unknown"}`;
}

function hashRateLimitSubject(value) {
  const pepper = process.env.RATE_LIMIT_PEPPER?.trim() || process.env.AUTH_METADATA_PEPPER?.trim();
  return pepper
    ? createHmac("sha256", pepper).update(String(value)).digest("hex")
    : createHash("sha256").update(String(value)).digest("hex");
}

export function createDurableRateLimiter({
  database,
  databaseAvailable,
  windowMs,
  max,
  namespace = "default",
  subject = rateLimitSubject,
}) {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  return async function durableRateLimit(request, response, next) {
    if (!databaseAvailable() || !database) {
      response.status(503).json({
        ok: false,
        error: "Rate-limit storage is unavailable.",
      });
      return;
    }

    const now = Date.now();
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const windowStartAt = new Date(windowStartMs);
    const resetAt = new Date(windowStartMs + windowMs);
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
      const count = Number(result.rows[0]?.request_count ?? 0);
      const reset = new Date(result.rows[0]?.expires_at ?? resetAt);

      response.setHeader("RateLimit-Limit", String(max));
      response.setHeader("RateLimit-Remaining", String(Math.max(0, max - count)));
      response.setHeader("RateLimit-Reset", String(Math.ceil(reset.getTime() / 1000)));

      if (count > max) {
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
