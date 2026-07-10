const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const UPLOAD_REQUEST_TIMEOUT_MS = 60_000;
const CONNECTION_PROBLEM_MESSAGE = "Connection problem - check your signal and try again.";

export function apiPath(path: string) {
  return `${API_BASE_URL}${path}`;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export class RivtApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, body: ApiErrorBody, fallbackMessage = "RIVT could not complete the request.") {
    super(body.error?.message || fallbackMessage);
    this.name = "RivtApiError";
    this.status = status;
    this.code = body.error?.code || "REQUEST_FAILED";
    this.details = body.error?.details;
  }
}

export const RIVT_SESSION_EXPIRED_EVENT = "rivt:session-expired";

export function notifySessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RIVT_SESSION_EXPIRED_EVENT));
}

export function requestKey() {
  return globalThis.crypto?.randomUUID?.() ?? `rivt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function networkError(code: "NETWORK_ERROR" | "REQUEST_TIMEOUT") {
  return new RivtApiError(0, {
    error: {
      code,
      message: CONNECTION_PROBLEM_MESSAGE,
    },
  });
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) {
  const timeoutController = new AbortController();
  let timedOut = false;
  const externalSignal = options.signal;
  const handleExternalAbort = () => timeoutController.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) handleExternalAbort();
    else externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
  }
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, { ...options, signal: timeoutController.signal });
    if (response.status === 429) {
      throw new RivtApiError(response.status, {
        error: { code: "RATE_LIMITED", message: rateLimitMessage(response) },
      });
    }
    return response;
  } catch (cause) {
    if (externalSignal?.aborted && !timedOut) throw cause;
    if (timedOut || cause instanceof TypeError || (cause instanceof DOMException && cause.name === "AbortError")) {
      throw networkError(timedOut ? "REQUEST_TIMEOUT" : "NETWORK_ERROR");
    }
    throw cause;
  } finally {
    globalThis.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", handleExternalAbort);
  }
}

function rateLimitMessage(response: Response) {
  const retryAfter = response.headers.get("Retry-After")?.trim();
  if (!retryAfter) return "You're doing that too fast - wait a minute and try again.";
  const numericRetry = Number(retryAfter);
  const datedRetry = Date.parse(retryAfter);
  const retrySeconds = Number.isFinite(numericRetry)
    ? numericRetry
    : Number.isFinite(datedRetry) ? Math.max(1, Math.ceil((datedRetry - Date.now()) / 1000)) : Number.NaN;
  if (Number.isFinite(retrySeconds) && retrySeconds > 0) {
    const wait = retrySeconds >= 60
      ? `${Math.ceil(retrySeconds / 60)} ${Math.ceil(retrySeconds / 60) === 1 ? "minute" : "minutes"}`
      : `${Math.ceil(retrySeconds)} seconds`;
    return `You're doing that too fast - try again in ${wait}.`;
  }
  return "You're doing that too fast - wait a minute and try again.";
}

export function makeRequest<E extends RivtApiError>(
  factory: (status: number, body: ApiErrorBody) => E,
) {
  return async function request<T>(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetchWithTimeout(apiPath(path), { credentials: "include", ...options });
    } catch (cause) {
      if (cause instanceof RivtApiError) {
        throw factory(cause.status, {
          error: { code: cause.code, message: cause.message, details: cause.details },
        });
      }
      throw cause;
    }
    const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
    if (!response.ok) {
      if (response.status === 401) notifySessionExpired();
      throw factory(response.status, body);
    }
    return body;
  };
}
