import { ApiError } from "./api.js";

const capturedEmails = [];
const EMAIL_REQUEST_TIMEOUT_MS = 8_000;

function envValue(name, fallback = undefined) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export function emailProviderStatus() {
  const mode = envValue("EMAIL_DELIVERY_MODE", process.env.NODE_ENV === "test" ? "capture" : "resend");
  const from = envValue("EMAIL_FROM");
  const missing = [];
  if (mode === "resend" && !process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!from) missing.push("EMAIL_FROM");
  if (mode === "capture" && process.env.NODE_ENV === "production") missing.push("EMAIL_DELIVERY_MODE=resend");
  return {
    ok: missing.length === 0,
    provider: "email",
    purpose: "Account and field communications",
    mode: missing.length ? "setup_required" : mode,
    missing,
  };
}

function isProviderTimeout(error, signal) {
  return error?.name === "TimeoutError"
    || error?.name === "AbortError"
    || (signal?.aborted && signal.reason?.name === "TimeoutError");
}

export async function sendTransactionalEmail(
  { to, subject, text, html, attachments = [], idempotencyKey = null },
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = EMAIL_REQUEST_TIMEOUT_MS,
    signal = AbortSignal.timeout(timeoutMs),
  } = {},
) {
  const status = emailProviderStatus();
  if (!status.ok) {
    throw new ApiError(503, "EMAIL_PROVIDER_UNAVAILABLE", "Email delivery is temporarily unavailable.");
  }

  if (status.mode === "capture") {
    capturedEmails.push({ to, subject, text, html, attachments, idempotencyKey, sentAt: new Date().toISOString() });
    return { provider: "capture", id: `capture-${capturedEmails.length}` };
  }

  const headers = {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject,
        text,
        html,
        ...(attachments.length ? { attachments } : {}),
      }),
    });

    if (!response.ok) {
      await response.text();
      throw new ApiError(502, "EMAIL_DELIVERY_FAILED", "RIVT could not send the email. Try again shortly.");
    }

    const body = await response.json();
    return { provider: "resend", id: body.id ?? null };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isProviderTimeout(error, signal)) {
      throw new ApiError(504, "EMAIL_DELIVERY_TIMEOUT", "RIVT could not confirm email delivery in time. Try again shortly.");
    }
    throw new ApiError(502, "EMAIL_DELIVERY_FAILED", "RIVT could not send the email. Try again shortly.");
  }
}

export function capturedEmailMessages() {
  if (process.env.NODE_ENV !== "test") return [];
  return capturedEmails.map((message) => ({ ...message }));
}

export function clearCapturedEmailMessages() {
  if (process.env.NODE_ENV === "test") capturedEmails.length = 0;
}

export const emailInternals = {
  EMAIL_REQUEST_TIMEOUT_MS,
};
