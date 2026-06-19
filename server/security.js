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
