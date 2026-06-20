const service = "rivt-api";

function safeField(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: value.code,
      status: value.status,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(safeField);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, safeField(fieldValue)]),
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
