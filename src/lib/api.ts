const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");

export function apiPath(path: string) {
  return `${API_BASE_URL}${path}`;
}
