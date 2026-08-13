import { capacityRouteFamily } from "./capacity-telemetry.js";

const service = "rivt-api";
const redacted = "[REDACTED]";
const circular = "[Circular]";

const sensitiveKeyNames = new Set([
  "authorization",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "credentials",
  "password",
  "passwordhash",
  "passwd",
  "passphrase",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "verificationtoken",
  "resettoken",
  "sessionid",
  "sessiontoken",
  "csrftoken",
  "secret",
  "clientsecret",
  "webhooksecret",
  "signingsecret",
  "apikey",
  "privatekey",
  "databaseurl",
  "postgresurl",
  "redisurl",
  "connectionstring",
  "dsn",
  "sentrydsn",
  "email",
  "emailaddress",
  "phone",
  "phonenumber",
  "telephone",
  "mobile",
  "mobilenumber",
  "address",
  "addressline1",
  "addressline2",
  "street",
  "streetaddress",
  "postalcode",
  "zipcode",
  "firstname",
  "lastname",
  "fullname",
  "displayname",
  "legalname",
  "username",
  "dateofbirth",
  "dob",
  "ssn",
  "socialsecuritynumber",
  "taxid",
  "cardnumber",
  "accountnumber",
  "bankaccountnumber",
  "routingnumber",
  "iban",
  "ip",
  "ipaddress",
  "remoteaddress",
]);

const sensitiveKeySuffix =
  /(?:password|passphrase|secret|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|api[_-]?key|private[_-]?key|authorization|cookie|credentials|connection[_-]?string|database[_-]?url|postgres[_-]?url|redis[_-]?url|sentry[_-]?dsn)$/i;
const personalKeySuffix =
  /(?:email|emailaddress|phone|phonenumber|telephone|mobilenumber|streetaddress|postalcode|zipcode|firstname|lastname|fullname|displayname|legalname|username|dateofbirth|ssn|socialsecuritynumber|taxid|cardnumber|accountnumber|bankaccountnumber|routingnumber|iban|ipaddress|remoteaddress)$/i;
const contextualNameOrAddress =
  /^(?:customer|contact|recipient|user|owner|person|profile|billing|shipping)(?:(?:first|last|full|display|legal)?name|address)$/i;

function normalizedKey(key) {
  return String(key).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function isSensitiveFieldName(key) {
  const normalized = normalizedKey(key);
  return sensitiveKeyNames.has(normalized)
    || sensitiveKeySuffix.test(String(key))
    || personalKeySuffix.test(String(key))
    || contextualNameOrAddress.test(normalized);
}

export function redactSensitiveString(value) {
  return value
    .replace(
      /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)* PRIVATE KEY-----/g,
      redacted,
    )
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, redacted)
    .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, redacted)
    .replace(/\bwhsec_[A-Za-z0-9]{8,}\b/g, redacted)
    .replace(/\bre_[A-Za-z0-9_-]{8,}\b/g, redacted)
    .replace(/\bGOCSPX-[A-Za-z0-9_-]{16,}\b/g, redacted)
    .replace(/\bAIza[A-Za-z0-9_-]{30,}\b/g, redacted)
    .replace(/\bAKIA[A-Z0-9]{16}\b/g, redacted)
    .replace(
      /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,
      redacted,
    )
    .replace(
      /\b([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+)(?::[^@\s/]+)?@/gi,
      `$1${redacted}@`,
    )
    .replace(
      /(\b(?:password|passwd|passphrase|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?id|session[_-]?token|client[_-]?secret|webhook[_-]?secret|signing[_-]?secret|api[_-]?key|private[_-]?key|sentry[_-]?key|authorization|cookie|dsn|signature|x-amz-signature)\b\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      `$1${redacted}`,
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, redacted);
}

function safeField(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactSensitiveString(value);
  if (value instanceof Error) {
    return {
      name: redactSensitiveString(value.name),
      message: redactSensitiveString(value.message),
      code: safeField(value.code, seen),
      status: safeField(value.status, seen),
      stack: process.env.NODE_ENV === "production" ? undefined : safeField(value.stack, seen),
    };
  }
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return circular;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((fieldValue) => safeField(fieldValue, seen));
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [
          key,
          isSensitiveFieldName(key) ? redacted : safeField(fieldValue, seen),
        ]),
    );
  } finally {
    seen.delete(value);
  }
}

function write(level, event, fields = {}) {
  const safeFields = safeField(fields);
  const record = {
    ...(safeFields && typeof safeFields === "object" && !Array.isArray(safeFields) ? safeFields : {}),
    level,
    event: redactSensitiveString(String(event)),
    service,
    timestamp: new Date().toISOString(),
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

export function createRequestLogger({ onStart = null, onComplete = null } = {}) {
  return function requestLogger(request, response, next) {
    const startedAt = Date.now();
    const multipart = /^multipart\/form-data(?:;|$)/i.test(String(request.headers["content-type"] ?? ""));
    let finishTelemetry = null;
    try {
      finishTelemetry = onStart?.({ multipart }) ?? null;
    } catch {
      // Optional telemetry must never change request handling.
    }
    let completed = false;
    const complete = ({ aborted = false } = {}) => {
      if (completed) return;
      completed = true;
      const routeFamily = capacityRouteFamily(
        `${String(request.baseUrl ?? "")}${String(request.path ?? "")}`,
      );
      const record = {
        method: request.method,
        routeFamily,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        aborted,
        multipart,
        uploadBytes: Number(request.file?.size ?? 0),
      };
      logInfo("http.request", {
        requestId: request.requestId ?? null,
        ...record,
      });
      try {
        if (typeof finishTelemetry === "function") {
          finishTelemetry(record);
        } else {
          onComplete?.(record);
        }
      } catch {
        // Optional telemetry must never change response completion.
      }
    };
    response.once("finish", () => complete());
    response.once("close", () => complete({ aborted: !response.writableEnded }));
    next();
  };
}
