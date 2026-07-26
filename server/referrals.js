import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return process.env.REFERRAL_SIGNING_SECRET?.trim()
    || process.env.SESSION_SECRET?.trim()
    || "";
}

function signature(value, signingSecret) {
  return createHmac("sha256", signingSecret).update(value).digest("base64url");
}

export function referralLinksConfigured() {
  return Boolean(secret());
}

export function createReferralToken(accountId, now = Date.now()) {
  const signingSecret = secret();
  if (!signingSecret) return null;
  const payload = Buffer.from(JSON.stringify({
    account_id: accountId,
    expires_at: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })).toString("base64url");
  return `${payload}.${signature(payload, signingSecret)}`;
}

export function verifyReferralToken(token, now = Date.now()) {
  const signingSecret = secret();
  const [payload, providedSignature, extra] = String(token ?? "").split(".");
  if (!signingSecret || !payload || !providedSignature || extra) return null;
  const expected = signature(payload, signingSecret);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed.account_id !== "string" || !parsed.account_id) return null;
    if (!parsed.expires_at || new Date(parsed.expires_at).getTime() <= now) return null;
    return { accountId: parsed.account_id, expiresAt: parsed.expires_at };
  } catch {
    return null;
  }
}
