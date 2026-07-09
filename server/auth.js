import { createHash, createHmac, randomBytes } from "node:crypto";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { ApiError } from "./api.js";

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token) {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

export function assertStrongPassword(password) {
  const value = String(password ?? "");
  const valid = value.length >= 8
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
  if (!valid) {
    throw new ApiError(
      422,
      "PASSWORD_POLICY_FAILED",
      "Use at least 8 characters with uppercase, lowercase, a number, and a symbol.",
    );
  }
  return value;
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
