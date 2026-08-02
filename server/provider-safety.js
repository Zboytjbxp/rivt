export const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
export const MIN_PROVIDER_TIMEOUT_MS = 1_000;
export const MAX_PROVIDER_TIMEOUT_MS = 30_000;

export function providerTimeoutMs(rawValue = process.env.PROVIDER_REQUEST_TIMEOUT_MS) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < MIN_PROVIDER_TIMEOUT_MS || value > MAX_PROVIDER_TIMEOUT_MS) {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }
  return value;
}

export function providerAbortSignal(rawValue) {
  return AbortSignal.timeout(providerTimeoutMs(rawValue));
}
