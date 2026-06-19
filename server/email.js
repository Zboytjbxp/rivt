import { ApiError } from "./api.js";

const capturedEmails = [];

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
    purpose: "Account verification and recovery",
    mode: missing.length ? "setup_required" : mode,
    missing,
  };
}

export async function sendTransactionalEmail({ to, subject, text, html }) {
  const status = emailProviderStatus();
  if (!status.ok) {
    throw new ApiError(503, "EMAIL_PROVIDER_UNAVAILABLE", "Email delivery is temporarily unavailable.");
  }

  if (status.mode === "capture") {
    capturedEmails.push({ to, subject, text, html, sentAt: new Date().toISOString() });
    return { provider: "capture", id: `capture-${capturedEmails.length}` };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
  });

  if (!response.ok) {
    await response.text();
    throw new ApiError(502, "EMAIL_DELIVERY_FAILED", "RIVT could not send the email. Try again shortly.");
  }

  const body = await response.json().catch(() => ({}));
  return { provider: "resend", id: body.id ?? null };
}

export function capturedEmailMessages() {
  if (process.env.NODE_ENV !== "test") return [];
  return capturedEmails.map((message) => ({ ...message }));
}

export function clearCapturedEmailMessages() {
  if (process.env.NODE_ENV === "test") capturedEmails.length = 0;
}
