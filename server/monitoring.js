import { randomUUID } from "node:crypto";

const defaultTimeoutMs = 2500;

function envValue(env, name) {
  const value = env[name]?.trim();
  return value || null;
}

function monitoringDsn(env) {
  return envValue(env, "SENTRY_DSN") || envValue(env, "ERROR_MONITORING_DSN");
}

function parseSentryDsn(dsn) {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (!url.username || !projectId || !/^https?:$/.test(url.protocol)) return null;
    return {
      publicKey: url.username,
      host: url.host,
      projectId,
      storeUrl: `${url.origin}/api/${projectId}/store/?sentry_key=${encodeURIComponent(url.username)}&sentry_version=7`,
    };
  } catch {
    return null;
  }
}

export function errorMonitoringStatus({ env = process.env } = {}) {
  const dsn = monitoringDsn(env);
  const parsed = parseSentryDsn(dsn);
  const provider = envValue(env, "ERROR_MONITORING_PROVIDER") || "sentry";

  if (!dsn) {
    return {
      ok: false,
      provider,
      mode: "setup_required",
      missing: ["SENTRY_DSN or ERROR_MONITORING_DSN"],
    };
  }

  if (!parsed) {
    return {
      ok: false,
      provider,
      mode: "invalid_config",
      missing: [],
    };
  }

  return {
    ok: true,
    provider,
    mode: "configured",
    missing: [],
    host: parsed.host,
    projectId: parsed.projectId,
  };
}

function errorPayload(error) {
  if (error instanceof Error) {
    return {
      type: error.name || "Error",
      value: error.message || "Unknown error",
      stacktrace: error.stack
        ? { frames: error.stack.split("\n").slice(0, 40).map((line) => ({ filename: line.trim() })) }
        : undefined,
    };
  }
  return {
    type: "NonError",
    value: String(error ?? "Unknown error"),
  };
}

function sanitizeContext(value, depth = 0) {
  if (depth > 4) return "[MaxDepth]";
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeContext(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/password|secret|token|authorization|cookie|dsn/i.test(key))
      .map(([key, fieldValue]) => [key, sanitizeContext(fieldValue, depth + 1)]),
  );
}

export async function captureException(error, context = {}, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = defaultTimeoutMs,
} = {}) {
  const dsn = monitoringDsn(env);
  const parsed = parseSentryDsn(dsn);
  if (!parsed || typeof fetchImpl !== "function") {
    return { ok: false, mode: dsn ? "invalid_config" : "setup_required" };
  }

  const eventId = randomUUID().replaceAll("-", "");
  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    logger: "rivt-api",
    environment: env.NODE_ENV || "development",
    release: env.SOURCE_COMMIT || env.RAILWAY_GIT_COMMIT_SHA || env.APP_VERSION || "unknown",
    exception: { values: [errorPayload(error)] },
    extra: sanitizeContext(context),
    tags: {
      service: "rivt-api",
      requestId: context.requestId ?? undefined,
      path: context.path ?? undefined,
      statusCode: context.statusCode ?? undefined,
    },
  };

  const response = await fetchImpl(parsed.storeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    ok: response.ok,
    eventId,
    status: response.status,
    provider: "sentry",
    host: parsed.host,
    projectId: parsed.projectId,
  };
}
