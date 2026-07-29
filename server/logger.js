const service = "rivt-api";
const sensitiveKeyPattern = /password|secret|token|authorization|cookie|dsn|email|phone|address|signed.?url/i;

export function redactSensitiveText(value) {
  return String(value ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi, "Bearer [REDACTED]")
    .replace(/\b(?:rivt|session)[_-]?session=([^;\s]+)/gi, (match) => `${match.split("=")[0]}=[REDACTED]`)
    .replace(/([?&](?:token|signature|sig|key|code|x-amz-[^=&#\s]+)=)[^&#\s]+/gi, "$1[REDACTED]");
}

function safeField(value, key = "") {
  if (sensitiveKeyPattern.test(key)) return "[REDACTED]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveText(value.message),
      code: value.code,
      status: value.status,
      stack: process.env.NODE_ENV === "production" ? undefined : redactSensitiveText(value.stack),
    };
  }
  if (value === undefined) return undefined;
  if (typeof value === "string") return redactSensitiveText(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => safeField(item, key));
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([fieldKey, fieldValue]) => [fieldKey, safeField(fieldValue, fieldKey)]),
  );
}

function write(level, event, fields = {}) {
  const record = {
    level,
    event,
    service,
    timestamp: new Date().toISOString(),
    ...safeField(fields),
  };
  const line = JSON.stringify(record);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(event, fields) {
  write("info", event, fields);
}

export function logWarn(event, fields) {
  write("warn", event, fields);
}

export function logError(event, fields) {
  write("error", event, fields);
}

export function createRequestLogger() {
  return function requestLogger(request, response, next) {
    const startedAt = Date.now();
    response.on("finish", () => {
      logInfo("http.request", {
        requestId: request.requestId ?? null,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        actorId: request.authUser?.id ?? null,
      });
    });
    next();
  };
}
