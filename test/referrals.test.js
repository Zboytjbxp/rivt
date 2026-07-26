import assert from "node:assert/strict";
import test from "node:test";

import {
  createReferralToken,
  referralLinksConfigured,
  verifyReferralToken,
} from "../server/referrals.js";

test("referral tokens are signed, expire, and cannot be altered", () => {
  const previousSecret = process.env.REFERRAL_SIGNING_SECRET;
  process.env.REFERRAL_SIGNING_SECRET = "test-referral-signing-secret-at-least-32-characters";
  const now = Date.UTC(2026, 6, 26);
  assert.equal(referralLinksConfigured(), true);
  const token = createReferralToken("account-123", now);
  assert.ok(token);
  assert.equal(verifyReferralToken(token, now + 1_000)?.accountId, "account-123");
  assert.equal(verifyReferralToken(`${token.slice(0, -1)}x`, now + 1_000), null);
  assert.equal(verifyReferralToken(token, now + 31 * 24 * 60 * 60 * 1000), null);
  if (previousSecret === undefined) delete process.env.REFERRAL_SIGNING_SECRET;
  else process.env.REFERRAL_SIGNING_SECRET = previousSecret;
});
