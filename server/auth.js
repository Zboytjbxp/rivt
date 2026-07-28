import { createHash, createHmac, randomBytes } from "node:crypto";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { ApiError } from "./api.js";

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const dummyPasswordSalt = "00000000000000000000000000000000";
const dummyPasswordHash = "0".repeat(128);

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token) {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

export function assertStrongPassword(password) {
  const value = String(password ?? "");
  const valid = value.length >= 8
    && value.length <= 1024
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
  if (!valid) {
    throw new ApiError(
      422,
      "PASSWORD_POLICY_FAILED",
      "Use at least 8 characters (maximum 1,024) with uppercase, lowercase, a number, and a symbol.",
    );
  }
  return value;
}

export function breachedPasswordScreeningStatus() {
  const setting = String(process.env.PASSWORD_BREACH_CHECK_MODE ?? "").trim().toLowerCase();
  const enabled = setting
    ? !["disabled", "off", "false", "0"].includes(setting)
    : process.env.NODE_ENV === "production";
  return {
    ok: enabled,
    provider: "pwned-passwords",
    mode: enabled ? "configured" : "disabled",
  };
}

export async function checkBreachedPassword(password, {
  enabled = breachedPasswordScreeningStatus().ok,
  fetchImpl = globalThis.fetch,
  timeoutMs = 3_000,
} = {}) {
  const value = assertStrongPassword(password);
  if (!enabled) return { checked: false, breached: false, count: 0, reason: "disabled" };

  const digest = createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  try {
    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        Accept: "text/plain",
        "Add-Padding": "true",
        "User-Agent": "RIVT password screening/1.0 (+https://rivt.pro)",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return { checked: false, breached: false, count: 0, reason: `provider_http_${response.status}` };
    }
    const declaredLength = Number(response.headers?.get?.("content-length") ?? 0);
    if (declaredLength > 200_000) {
      return { checked: false, breached: false, count: 0, reason: "provider_response_too_large" };
    }
    const body = await response.text();
    if (Buffer.byteLength(body) > 200_000) {
      return { checked: false, breached: false, count: 0, reason: "provider_response_too_large" };
    }
    const match = body.split(/\r?\n/).find((line) => line.slice(0, 35).toUpperCase() === suffix);
    const count = match ? Number(match.split(":")[1] ?? 0) : 0;
    return {
      checked: true,
      breached: Number.isFinite(count) && count > 0,
      count: Number.isFinite(count) ? count : 0,
      reason: null,
    };
  } catch (error) {
    return {
      checked: false,
      breached: false,
      count: 0,
      reason: error?.name === "TimeoutError" ? "provider_timeout" : "provider_unavailable",
    };
  }
}

export async function assertPasswordNotBreached(password, options) {
  const result = await checkBreachedPassword(password, options);
  if (result.breached) {
    throw new ApiError(
      422,
      "PASSWORD_COMPROMISED",
      "Choose a password that has not appeared in a known data breach.",
    );
  }
  return result;
}

export async function verifyLoginPassword(password, user, verifyPassword) {
  const passwordValid = await verifyPassword(
    password,
    user?.password_salt || dummyPasswordSalt,
    user?.password_hash || dummyPasswordHash,
  );
  return Boolean(user) && passwordValid;
}

export function pkceChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function requestMetadata(request) {
  const pepper = process.env.AUTH_METADATA_PEPPER?.trim();
  const hash = (value) => {
    if (!value) return null;
    return pepper
      ? createHmac("sha256", pepper).update(String(value)).digest("hex")
      : createHash("sha256").update(String(value)).digest("hex");
  };
  const userAgent = String(request.headers["user-agent"] ?? "");
  return {
    ipHash: hash(request.ip ?? request.socket?.remoteAddress),
    userAgentHash: hash(userAgent),
    deviceLabel: deviceLabelFromUserAgent(userAgent),
  };
}

export function deviceLabelFromUserAgent(userAgent) {
  const value = String(userAgent ?? "");
  const browser = /Edg\//.test(value) ? "Edge"
    : /Chrome\//.test(value) ? "Chrome"
      : /Firefox\//.test(value) ? "Firefox"
        : /Safari\//.test(value) ? "Safari"
          : "Browser";
  const platform = /Android/.test(value) ? "Android"
    : /iPhone|iPad/.test(value) ? "iOS"
      : /Windows/.test(value) ? "Windows"
        : /Mac OS/.test(value) ? "macOS"
          : /Linux/.test(value) ? "Linux"
            : "device";
  return `${browser} on ${platform}`;
}

export function safeRedirectPath(value, fallback = "/") {
  try {
    const parsed = new URL(String(value ?? ""), "https://rivt.pro");
    if (parsed.origin !== "https://rivt.pro") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildGoogleAuthorizationUrl({ clientId, redirectUri, state, nonce, codeChallenge }) {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  return authUrl.toString();
}

export function buildAppleAuthorizationUrl({ clientId, redirectUri, state, nonce }) {
  const authUrl = new URL("https://appleid.apple.com/auth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "form_post");
  authUrl.searchParams.set("scope", "name email");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  return authUrl.toString();
}

function normalizedApplePrivateKey(privateKey) {
  return String(privateKey ?? "").replace(/\\n/g, "\n").trim();
}

export async function buildAppleClientSecret({ clientId, teamId, keyId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  try {
    const signingKey = await importPKCS8(normalizedApplePrivateKey(privateKey), "ES256");
    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuer(teamId)
      .setAudience("https://appleid.apple.com")
      .setSubject(clientId)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 24 * 180)
      .sign(signingKey);
  } catch {
    throw new ApiError(503, "OAUTH_PROVIDER_UNAVAILABLE", "Apple sign-in is temporarily unavailable.");
  }
}

export async function verifyGoogleIdToken(idToken, { clientId, nonce }) {
  if (!idToken) throw new ApiError(502, "OAUTH_TOKEN_INVALID", "Google did not return a valid identity token.");
  try {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      audience: clientId,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      algorithms: ["RS256"],
    });
    if (payload.nonce !== nonce || !payload.sub || !payload.email || payload.email_verified !== true) {
      throw new Error("Required Google claims are missing.");
    }
    return {
      subject: payload.sub,
      email: String(payload.email).trim().toLowerCase(),
      displayName: String(payload.name ?? payload.email),
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "OAUTH_IDENTITY_REJECTED", "Google identity verification failed.");
  }
}

export async function verifyAppleIdToken(idToken, { clientId, nonce, displayName }) {
  if (!idToken) throw new ApiError(502, "OAUTH_TOKEN_INVALID", "Apple did not return a valid identity token.");
  try {
    const { payload } = await jwtVerify(idToken, appleJwks, {
      audience: clientId,
      issuer: "https://appleid.apple.com",
      algorithms: ["RS256"],
    });
    if (payload.nonce !== nonce || !payload.sub) {
      throw new Error("Required Apple claims are missing.");
    }
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    if (email && !emailVerified) {
      throw new Error("Apple email claim is not verified.");
    }
    return {
      subject: String(payload.sub),
      email,
      displayName: String(displayName || email || "Apple user"),
      picture: null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "OAUTH_IDENTITY_REJECTED", "Apple identity verification failed.");
  }
}
