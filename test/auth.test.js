import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  assertPasswordNotBreached,
  assertStrongPassword,
  buildAppleAuthorizationUrl,
  buildGoogleAuthorizationUrl,
  deviceLabelFromUserAgent,
  pkceChallenge,
  safeRedirectPath,
  verifyLoginPassword,
} from "../server/auth.js";

test("password policy accepts strong passwords and rejects incomplete passwords", () => {
  assert.equal(assertStrongPassword("A-strong-pass9"), "A-strong-pass9");
  assert.equal(assertStrongPassword("Goodpass1!"), "Goodpass1!");
  assert.throws(() => assertStrongPassword("alllowercase9!"), /uppercase/i);
  assert.throws(() => assertStrongPassword("Short9!"), /8 characters/i);
});

test("breached-password screening sends only a padded five-character hash prefix", async () => {
  const password = "Unique-enough-passphrase!942";
  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  let requestUrl = "";
  let requestOptions;
  const fetchImpl = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => `${digest.slice(5)}:4\r\n${"0".repeat(35)}:0`,
    };
  };

  await assert.rejects(
    () => assertPasswordNotBreached(password, { enabled: true, fetchImpl }),
    (error) => error.code === "PASSWORD_COMPROMISED",
  );
  assert.equal(requestUrl.endsWith(digest.slice(0, 5)), true);
  assert.equal(requestUrl.includes(password), false);
  assert.equal(requestUrl.includes(digest), false);
  assert.equal(requestOptions.headers["Add-Padding"], "true");
});

test("breached-password provider failure is explicit and does not block signup availability", async () => {
  const result = await assertPasswordNotBreached("Unique-enough-passphrase!943", {
    enabled: true,
    fetchImpl: async () => {
      throw new Error("provider unavailable");
    },
  });
  assert.deepEqual(result, {
    checked: false,
    breached: false,
    count: 0,
    reason: "provider_unavailable",
  });
});

test("invalid login still performs password verification work", async () => {
  const calls = [];
  const verifyPassword = async (...args) => {
    calls.push(args);
    return false;
  };
  assert.equal(await verifyLoginPassword("NotThePassword!1", null, verifyPassword), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].length, 32);
  assert.equal(calls[0][2].length, 128);
});

test("Google authorization URL includes OIDC, nonce, state, and PKCE controls", () => {
  const url = new URL(buildGoogleAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "https://rivt.pro/api/auth/google/callback",
    state: "state-value",
    nonce: "nonce-value",
    codeChallenge: "challenge-value",
  }));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.equal(url.searchParams.get("nonce"), "nonce-value");
  assert.equal(url.searchParams.get("code_challenge"), "challenge-value");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.has("login_hint"), false);
});

test("Apple authorization URL uses OIDC form-post response with state and nonce", () => {
  const url = new URL(buildAppleAuthorizationUrl({
    clientId: "com.rivt.web",
    redirectUri: "https://rivt.pro/api/auth/apple/callback",
    state: "state-value",
    nonce: "nonce-value",
  }));
  assert.equal(url.origin, "https://appleid.apple.com");
  assert.equal(url.searchParams.get("client_id"), "com.rivt.web");
  assert.equal(url.searchParams.get("redirect_uri"), "https://rivt.pro/api/auth/apple/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("response_mode"), "form_post");
  assert.equal(url.searchParams.get("scope"), "name email");
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.equal(url.searchParams.get("nonce"), "nonce-value");
});

test("PKCE challenge follows the RFC 7636 SHA-256 example", () => {
  assert.equal(
    pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
});

test("redirects remain local to RIVT and device labels avoid raw user agents", () => {
  assert.equal(safeRedirectPath("/work?status=open#top"), "/work?status=open#top");
  assert.equal(safeRedirectPath("https://evil.example/steal"), "/");
  assert.equal(
    deviceLabelFromUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/125.0"),
    "Chrome on Windows",
  );
});
