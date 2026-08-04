interface ClientErrorContext {
  boundary?: string;
  componentStack?: string | null;
}

function redactSensitiveText(value: unknown) {
  return String(value ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:token|signature|sig|key|code|x-amz-[^=&#\s]+)=)[^&#\s]+/gi, "$1[REDACTED]");
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: redactSensitiveText(error.message || "Unknown client error"),
      stack: redactSensitiveText(error.stack || ""),
    };
  }
  return {
    name: "NonError",
    message: redactSensitiveText(error ?? "Unknown client error"),
    stack: "",
  };
}

export function reportClientError(error: unknown, context: ClientErrorContext = {}) {
  if (typeof window === "undefined") return;
  const details = errorDetails(error);
  const payload = JSON.stringify({
    name: details.name.slice(0, 120),
    message: details.message.slice(0, 500),
    stack: details.stack.slice(0, 8_000),
    componentStack: String(context.componentStack ?? "").slice(0, 8_000),
    boundary: String(context.boundary ?? "window").slice(0, 80),
    path: window.location.pathname.slice(0, 500),
  });

  try {
    if (navigator.sendBeacon?.("/api/client-errors", new Blob([payload], { type: "application/json" }))) {
      return;
    }
  } catch {
    // Fall through to a keepalive request when beacon delivery is unavailable.
  }

  void fetch("/api/client-errors", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function installClientErrorReporting() {
  const onError = (event: ErrorEvent) => {
    reportClientError(event.error ?? event.message, { boundary: "window.error" });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason, { boundary: "window.unhandledrejection" });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
