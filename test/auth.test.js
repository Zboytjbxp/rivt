import assert from "node:assert/strict";
import test from "node:test";
import {
  assertStrongPassword,
  buildAppleAuthorizationUrl,
  buildGoogleAuthorizationUrl,
  deviceLabelFromUserAgent,
  pkceChallenge,
  safeRedirectPath,
} from "../server/auth.js";

test("password policy accepts strong passwords and rejects incomplete passwords", () => {
  assert.equal(assertStrongPassword("A-strong-pass9"), "A-strong-pass9");
  assert.equal(assertStrongPassword("Goodpass1!"), "Goodpass1!");
  assert.throws(() => assertStrongPassword("alllowercase9!"), /uppercase/i);
  assert.throws(() => assertStrongPassword("Short9!"), /8 characters/i);
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
