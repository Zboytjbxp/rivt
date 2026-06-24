const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");

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

export function requestKey() {
  return globalThis.crypto?.randomUUID?.() ?? `rivt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeRequest<E extends RivtApiError>(
  factory: (status: number, body: ApiErrorBody) => E,
) {
  return async function request<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(apiPath(path), { credentials: "include", ...options });
    const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
    if (!response.ok) throw factory(response.status, body);
    return body;
  };
}
