import "dotenv/config";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import cors from "cors";
import { XMLParser } from "fast-xml-parser";
import express from "express";
import multer from "multer";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ApiError, asyncRoute, createRequestContext, sendApiError, z } from "./api.js";
import {
  assertStrongPassword,
  buildGoogleAuthorizationUrl,
  createOpaqueToken,
  hashOpaqueToken,
  pkceChallenge,
  requestMetadata,
  safeRedirectPath,
  verifyGoogleIdToken,
} from "./auth.js";
import { loadActorContext } from "./authorization.js";
import { emailProviderStatus, sendTransactionalEmail } from "./email.js";
import { migrateUp, migrationStatus } from "./migrations.js";
import {
  createOriginGuard,
  createRateLimiter,
  createRequireAuthenticatedUser,
  parseCookies,
  readSessionId,
} from "./security.js";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT ?? 8787);
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 10);
const maxUploadBytes = maxUploadMb * 1024 * 1024;
const signedUrlSeconds = Number(process.env.S3_SIGNED_URL_SECONDS ?? 900);
const appName = envValue("APP_NAME", "RIVT");
const appSlug = envValue("APP_SLUG", "rivt");
const sessionCookieName = `${appSlug}_session`;
const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS ?? 1000 * 60 * 60 * 24 * 30);
const appVersion = envValue("APP_VERSION", "0.1.0");
const sourceCommit = envValue("SOURCE_COMMIT", envValue("RAILWAY_GIT_COMMIT_SHA", "unknown"));
let migrationVersion = envValue("MIGRATION_VERSION", "uninitialized");
const productionOrigin = envValue("APP_ORIGIN", "https://rivt.pro");

function envValue(name, fallback = undefined) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function normalizePhoneNumber(phone) {
  return String(phone ?? "").trim().replace(/[^\d+]/g, "");
}

function getTwilioSmsConfig() {
  const messagingServiceSid = envValue("TWILIO_MESSAGING_SERVICE_SID") || envValue("TWILIO_SERVICE_SID");
  const fromNumber = envValue("TWILIO_FROM_NUMBER") || envValue("TWILIO_PHONE_NUMBER");
  return {
    messagingServiceSid,
    fromNumber,
    hasMessagingService: Boolean(messagingServiceSid),
    hasFromNumber: Boolean(fromNumber),
  };
}

function buildTwilioSmsStatus(purpose) {
  const smsConfig = getTwilioSmsConfig();
  const missing = [];

  if (!process.env.TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!process.env.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
  if (!smsConfig.hasMessagingService && !smsConfig.hasFromNumber) {
    missing.push("TWILIO_MESSAGING_SERVICE_SID", "TWILIO_FROM_NUMBER");
  }

  return {
    ok: missing.length === 0,
    provider: "sms",
    purpose,
    mode: missing.length === 0 ? "configured" : "setup_required",
    missing,
    sender: smsConfig.hasMessagingService
      ? "messaging_service"
      : smsConfig.hasFromNumber
        ? "from_number"
        : "unconfigured",
  };
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(String(password ?? ""), salt, 64).toString("hex");
  return { salt, hash: derived };
}

function verifyPassword(password, salt, hash) {
  const candidate = scryptSync(String(password ?? ""), salt, 64);
  const target = Buffer.from(String(hash ?? ""), "hex");
  return candidate.length === target.length && timingSafeEqual(candidate, target);
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

const databaseUrl = envValue("DATABASE_URL");
const s3Bucket = envValue("S3_BUCKET");
const s3Region = envValue("S3_REGION", "us-east-1");
const s3Endpoint = envValue("S3_ENDPOINT");
const s3PublicBaseUrl = envValue("S3_PUBLIC_BASE_URL");
const s3AccessKeyId = envValue("S3_ACCESS_KEY_ID");
const s3SecretAccessKey = envValue("S3_SECRET_ACCESS_KEY");

const database = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      ssl:
        process.env.PGSSL === "disable" || databaseUrl.includes("localhost")
          ? false
          : { rejectUnauthorized: false },
    })
  : null;

const s3Configured = Boolean(s3Bucket && s3AccessKeyId && s3SecretAccessKey);
const s3Client = s3Configured
  ? new S3Client({
      region: s3Region,
      endpoint: s3Endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
    })
  : null;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    const allowedTypes = new Set([
      "application/pdf",
      "image/gif",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
    ]);

    if (allowedTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    const error = new Error("Unsupported upload type.");
    error.status = 415;
    callback(error);
  },
});

let databaseReadyPromise;

const allowedOrigins = [
  productionOrigin,
  ...(process.env.NODE_ENV === "production"
    ? []
    : ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:4173", "http://localhost:4173"]),
];

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    const error = new Error("Request origin is not allowed.");
    error.status = 403;
    callback(error);
  },
}));
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

app.use("/api/v1", createRequestContext);
app.use("/api", createOriginGuard(allowedOrigins));

function setSessionId(response, sessionId) {
  response.cookie(sessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: sessionMaxAgeMs,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function missingStorageConfig() {
  return [
    !databaseUrl && "DATABASE_URL",
    !s3Bucket && "S3_BUCKET",
    !s3AccessKeyId && "S3_ACCESS_KEY_ID",
    !s3SecretAccessKey && "S3_SECRET_ACCESS_KEY",
  ].filter(Boolean);
}

function storageConfiguration() {
  const missing = missingStorageConfig();

  return {
    ok: missing.length === 0,
    mode: "managed",
    database: database ? "postgres" : "missing",
    objectStorage: s3Configured ? "s3-compatible" : "missing",
    bucket: s3Bucket ?? null,
    region: s3Region,
    endpoint: s3Endpoint ?? null,
    maxUploadMb,
    signedUrlSeconds,
    missing,
  };
}

function requireDatabase(response) {
  if (database) {
    return true;
  }

  response.status(503).json({
    ok: false,
    error: "DATABASE_URL is required. Local app-data fallback is disabled.",
    storage: storageConfiguration(),
  });
  return false;
}

function requireObjectStorage(response) {
  if (s3Client && s3Bucket) {
    return true;
  }

  response.status(503).json({
    ok: false,
    error: "S3-compatible object storage is required. Local upload fallback is disabled.",
    storage: storageConfiguration(),
  });
  return false;
}

async function ensureDatabaseReady() {
  if (!database) {
    throw new Error("DATABASE_URL is required.");
  }

  databaseReadyPromise ??= migrateUp(database).then((status) => {
    migrationVersion = status.latestVersion
      ? `${String(status.latestVersion).padStart(4, "0")}_${status.latestName}`
      : "uninitialized";
    return status;
  });

  return databaseReadyPromise;
}

async function runWithDatabase(response, next, action) {
  if (!requireDatabase(response)) {
    return;
  }

  try {
    await ensureDatabaseReady();
    await action();
  } catch (error) {
    next(error);
  }
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function safeObjectName(name) {
  return String(name || "upload")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "upload";
}

function publicObjectUrl(objectKey) {
  if (!objectKey) {
    return null;
  }

  if (s3PublicBaseUrl) {
    return `${s3PublicBaseUrl.replace(/\/+$/, "")}/${objectKey}`;
  }

  if (!s3Endpoint && s3Bucket) {
    return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${objectKey}`;
  }

  return null;
}

async function signedObjectUrl(objectKey) {
  if (!s3Client || !s3Bucket || !objectKey) {
    return null;
  }

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: s3Bucket,
      Key: objectKey,
    }),
    { expiresIn: signedUrlSeconds },
  );
}

function mapUploadRow(row, signedUrl = null) {
  return {
    id: row.id,
    timestamp: row.created_at,
    kind: row.kind,
    name: row.name,
    jobId: row.job_id,
    notes: row.notes,
    file: row.object_key
      ? {
          originalName: row.original_name,
          key: row.object_key,
          mimeType: row.mime_type,
          size: Number(row.size_bytes ?? 0),
          publicUrl: publicObjectUrl(row.object_key),
          signedUrl,
          signedUrlExpiresIn: signedUrl ? signedUrlSeconds : null,
        }
      : null,
  };
}

async function getUserBySessionId(sessionId) {
  if (!database) {
    return null;
  }

  const result = await database.query(
    `
      SELECT u.id, u.email, u.provider, u.display_name, u.role, u.organization, u.location,
             u.email_verified_at, a.status AS account_status, p.onboarding_status
      FROM auth_sessions s
      INNER JOIN auth_users u ON u.id = s.user_id
      INNER JOIN accounts a ON a.id = u.id
      INNER JOIN profiles p ON p.account_id = u.id
      WHERE s.session_id = $1
        AND s.expires_at > now()
        AND s.revoked_at IS NULL
      LIMIT 1
    `,
    [sessionId],
  );

  if (result.rowCount) {
    await database.query(
      "UPDATE auth_sessions SET last_seen_at = now() WHERE session_id = $1 AND last_seen_at < now() - interval '5 minutes'",
      [sessionId],
    );
  }
  return result.rowCount ? result.rows[0] : null;
}

async function issueAuthSession(request, response, userId, sessionId) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + sessionMaxAgeMs);
  const metadata = requestMetadata(request);
  await database.query(
    `
      INSERT INTO auth_sessions (
        id, session_id, user_id, created_at, updated_at, expires_at, last_seen_at,
        user_agent_hash, ip_hash, device_label
      )
      VALUES ($1, $2, $3, $4, $4, $5, $4, $6, $7, $8)
      ON CONFLICT (session_id)
      DO UPDATE SET user_id = EXCLUDED.user_id,
                    updated_at = EXCLUDED.updated_at,
                    expires_at = EXCLUDED.expires_at,
                    last_seen_at = EXCLUDED.last_seen_at,
                    revoked_at = NULL,
                    user_agent_hash = EXCLUDED.user_agent_hash,
                    ip_hash = EXCLUDED.ip_hash,
                    device_label = EXCLUDED.device_label
    `,
    [randomUUID(), sessionId, userId, now, expiresAt, metadata.userAgentHash, metadata.ipHash, metadata.deviceLabel],
  );
  setSessionId(response, sessionId);
}

async function rotateAuthSession(request, response, userId) {
  const previousSessionId = readSessionId(request, sessionCookieName);
  const nextSessionId = randomUUID();

  if (previousSessionId) {
    await database.query("UPDATE auth_sessions SET revoked_at = now() WHERE session_id = $1", [previousSessionId]);
  }

  await issueAuthSession(request, response, userId, nextSessionId);
  return nextSessionId;
}

const requireAuthenticatedUser = createRequireAuthenticatedUser({
  databaseAvailable: () => Boolean(database),
  findUserBySessionId: getUserBySessionId,
  cookieName: sessionCookieName,
});

const requireV1AuthenticatedUser = asyncRoute(async (request, _response, next) => {
  if (!database) {
    throw new ApiError(503, "ACCOUNT_STORAGE_UNAVAILABLE", "Managed account storage is unavailable.");
  }

  const sessionId = readSessionId(request, sessionCookieName);
  if (!sessionId) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
  const user = await getUserBySessionId(sessionId);
  if (!user) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");

  request.authSessionId = sessionId;
  request.authUser = user;
  next();
});

const requireV1Actor = asyncRoute(async (request, _response, next) => {
  await ensureDatabaseReady();
  request.actor = await loadActorContext(database, request.authUser.id);
  if (["suspended", "closed"].includes(request.actor.account.status)) {
    throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "This account cannot access the current API.");
  }
  next();
});

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT ?? 30),
  namespace: "auth",
});

const writeRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.WRITE_RATE_LIMIT ?? 120),
  namespace: "write",
});

const uploadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT ?? 40),
  namespace: "upload",
});

function integrationStatus(provider, requiredEnv, purpose) {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  return {
    ok: missing.length === 0,
    provider,
    purpose,
    mode: missing.length === 0 ? "configured" : "setup_required",
    missing,
  };
}

function buildUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    provider: user.provider,
    display_name: user.display_name,
    role: user.role,
    organization: user.organization,
    location: user.location,
    email_verified: Boolean(user.email_verified_at),
    account_status: user.account_status ?? null,
    onboarding_status: user.onboarding_status ?? null,
  };
}

async function withTransaction(action) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function verificationUrl(token) {
  return `${productionOrigin}/verify-email?token=${encodeURIComponent(token)}`;
}

function passwordResetUrl(token) {
  return `${productionOrigin}/reset-password?token=${encodeURIComponent(token)}`;
}

async function createVerificationToken(client, accountId, { enforceResendLimit = false } = {}) {
  if (enforceResendLimit) {
    const recent = await client.query(
      "SELECT count(*)::int AS count FROM email_verification_tokens WHERE account_id = $1 AND created_at > now() - interval '1 hour'",
      [accountId],
    );
    if (recent.rows[0].count >= 3) {
      throw new ApiError(429, "VERIFICATION_RATE_LIMITED", "Too many verification emails. Try again later.");
    }
  }
  await client.query(
    "UPDATE email_verification_tokens SET consumed_at = now() WHERE account_id = $1 AND consumed_at IS NULL",
    [accountId],
  );
  const token = createOpaqueToken();
  await client.query(
    `INSERT INTO email_verification_tokens (account_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '24 hours')`,
    [accountId, hashOpaqueToken(token)],
  );
  return token;
}

async function sendVerificationMessage(email, token) {
  const url = verificationUrl(token);
  return sendTransactionalEmail({
    to: email,
    subject: "Verify your RIVT email",
    text: `Verify your RIVT email: ${url}\n\nThis link expires in 24 hours.`,
    html: `<p>Verify your RIVT email to continue setting up your trade profile.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

async function sendPasswordResetMessage(email, token) {
  const url = passwordResetUrl(token);
  return sendTransactionalEmail({
    to: email,
    subject: "Reset your RIVT password",
    text: `Reset your RIVT password: ${url}\n\nThis link expires in 30 minutes.`,
    html: `<p>A password reset was requested for your RIVT account.</p><p><a href="${url}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request it, no action is needed.</p>`,
  });
}

async function consumePilotInvite(client, { inviteCode, email, role }) {
  if (process.env.REQUIRE_PILOT_INVITE !== "true") return null;
  if (!inviteCode) throw new ApiError(403, "INVITATION_REQUIRED", "A valid pilot invitation is required.");
  const result = await client.query(
    `SELECT * FROM signup_invites WHERE code_hash = $1 FOR UPDATE`,
    [hashOpaqueToken(inviteCode)],
  );
  const invite = result.rows[0];
  const invalid = !invite
    || invite.revoked_at
    || new Date(invite.expires_at).getTime() <= Date.now()
    || invite.use_count >= invite.max_uses
    || (invite.email_hash && invite.email_hash !== sha256(email))
    || (invite.allowed_role && invite.allowed_role !== role);
  if (invalid) throw new ApiError(403, "INVITATION_INVALID", "The pilot invitation is invalid or expired.");
  await client.query("UPDATE signup_invites SET use_count = use_count + 1 WHERE id = $1", [invite.id]);
  return invite.id;
}

async function resolveGoogleAccount(identity) {
  return withTransaction(async (client) => {
    const bySubject = await client.query(
      `SELECT account_id FROM auth_identities
       WHERE provider = 'google' AND subject_kind = 'provider_subject' AND provider_subject = $1
       LIMIT 1`,
      [identity.subject],
    );

    let accountId = bySubject.rows[0]?.account_id;
    if (!accountId) {
      const byEmail = await client.query("SELECT id FROM auth_users WHERE email_hash = $1 LIMIT 1", [sha256(identity.email)]);
      accountId = byEmail.rows[0]?.id;
    }

    if (!accountId) {
      accountId = randomUUID();
      const credentials = hashPassword(createOpaqueToken());
      await client.query(
        `INSERT INTO auth_users (
           id, email, email_hash, password_salt, password_hash, provider, display_name,
           role, organization, location, email_verified_at, last_login_at
         ) VALUES ($1, $2, $3, $4, $5, 'google', $6, 'pending', '', '', now(), now())`,
        [accountId, identity.email, sha256(identity.email), credentials.salt, credentials.hash, identity.displayName],
      );
    }

    const existingIdentity = await client.query(
      "SELECT id, provider_subject, subject_kind FROM auth_identities WHERE account_id = $1 AND provider = 'google' LIMIT 1 FOR UPDATE",
      [accountId],
    );
    if (existingIdentity.rowCount
      && existingIdentity.rows[0].subject_kind === "provider_subject"
      && existingIdentity.rows[0].provider_subject !== identity.subject) {
      throw new ApiError(409, "OAUTH_IDENTITY_CONFLICT", "This Google identity requires support review.");
    }

    if (existingIdentity.rowCount) {
      await client.query(
        `UPDATE auth_identities
         SET provider_subject = $2, subject_kind = 'provider_subject', email = $3, email_hash = $4, updated_at = now()
         WHERE id = $1`,
        [existingIdentity.rows[0].id, identity.subject, identity.email, sha256(identity.email)],
      );
    } else {
      await client.query(
        `INSERT INTO auth_identities (account_id, provider, provider_subject, subject_kind, email, email_hash)
         VALUES ($1, 'google', $2, 'provider_subject', $3, $4)`,
        [accountId, identity.subject, identity.email, sha256(identity.email)],
      );
    }

    const updated = await client.query(
      `UPDATE auth_users
       SET provider = 'google', email_verified_at = COALESCE(email_verified_at, now()),
           display_name = CASE WHEN trim(display_name) = '' THEN $2 ELSE display_name END,
           last_login_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, email, provider, display_name, role, organization, location, email_verified_at`,
      [accountId, identity.displayName],
    );
    return updated.rows[0];
  });
}

// ── Trade News Aggregator ────────────────────────────────────────────────────

const newsCache = new Map(); // key → { items, fetchedAt }
const NEWS_TTL_MS = 30 * 60 * 1000;
const _xmlParser = new XMLParser({ ignoreAttributes: false, ignoreDeclaration: true });

function _stripHtml(str) {
  return (str ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function _fmtDate(raw) {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).slice(0, 16);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return String(raw).slice(0, 16); }
}

function _urgency(title) {
  const t = (title ?? "").toLowerCase();
  if (/osha|heat illness|heat rule/.test(t))              return "OSHA Rule";
  if (/permit|permitting/.test(t))                        return "Permit Alert";
  if (/\bnec\b|national electrical code|building code/.test(t)) return "Code Update";
  if (/lien|mechanic.?s lien/.test(t))                   return "Legal Alert";
  if (/law|bill|statute|ordinance|regulation/.test(t))    return "Regulation";
  if (/licens/.test(t))                                   return "Licensing";
  return undefined;
}

function _firstString(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return _firstString(value[0]);
  if (typeof value === "object") {
    return value["@_url"] ?? value["@_href"] ?? value.url ?? value.href ?? null;
  }
  return null;
}

function _thumbnailUrl(link, item) {
  const direct = _firstString(item?.enclosure) ?? _firstString(item?.["media:thumbnail"]) ?? _firstString(item?.["media:content"]);
  if (direct) return direct;

  try {
    const host = new URL(String(link ?? "")).hostname.replace(/^www\./i, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    return null;
  }
}

async function _fetchFeed(url, fallbackSource) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RIVTNews/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = _xmlParser.parse(xml);
    const channel = parsed?.rss?.channel ?? parsed?.feed ?? {};
    const raw = channel.item ?? channel.entry ?? [];
    const items = Array.isArray(raw) ? raw : [raw];
    return items.slice(0, 12).map((item, i) => {
      const link = typeof item.link === "string"
        ? item.link
        : item.link?.["@_href"] ?? item.guid ?? "#";
      const headline = _stripHtml(item.title ?? "");
      return {
        id: Date.now() + i,
        headline,
        source: fallbackSource ?? _stripHtml(channel.title ?? ""),
        date: _fmtDate(item.pubDate ?? item.published ?? item.updated ?? ""),
        summary: _stripHtml(item.description ?? item.summary ?? item["content:encoded"] ?? "").slice(0, 350),
        url: link,
        urgency: _urgency(headline),
        thumbnailUrl: _thumbnailUrl(link, item),
      };
    }).filter((item) => item.headline.length > 10);
  } catch {
    return [];
  }
}

app.get("/api/news", async (request, response) => {
  const location = String(request.query.location ?? "").trim();
  const cacheKey = location || "national";
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < NEWS_TTL_MS) {
    return response.json({ items: cached.items, cached: true });
  }

  const [city, state] = location.split(",").map((s) => s.trim());
  const natQ  = "construction+contractor+subcontractor+building+permit+code+OSHA";
  const localQ = city && state
    ? `construction+contractor+${encodeURIComponent(city)}+${encodeURIComponent(state)}`
    : null;

  const [enr, dive, osha, gnNat, gnLocal] = await Promise.allSettled([
    _fetchFeed("https://www.enr.com/rss/news",                                                         "ENR"),
    _fetchFeed("https://www.constructiondive.com/feeds/news/",                                         "Construction Dive"),
    _fetchFeed("https://www.osha.gov/news/newsreleases/trade/rss",                                    "OSHA"),
    _fetchFeed(`https://news.google.com/rss/search?q=${natQ}&hl=en-US&gl=US&ceid=US:en`,             "Google News"),
    localQ
      ? _fetchFeed(`https://news.google.com/rss/search?q=${localQ}&hl=en-US&gl=US&ceid=US:en`, city ? `${city} News` : "Local News")
      : Promise.resolve([]),
  ]);

  const pick = (r) => r.status === "fulfilled" ? r.value : [];
  const localItems = pick(gnLocal).map((item) => ({ ...item, isLocal: true }));
  const all = [...localItems, ...pick(enr), ...pick(dive), ...pick(osha), ...pick(gnNat)];

  const seen = new Set();
  const deduped = all.filter((item) => {
    const key = item.headline.toLowerCase().slice(0, 55);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    if (a.isLocal && !b.isLocal) return -1;
    if (!a.isLocal && b.isLocal) return 1;
    if (a.urgency && !b.urgency) return -1;
    if (!a.urgency && b.urgency) return 1;
    return 0;
  });

  const items = deduped.slice(0, 30).map((item, i) => ({ ...item, id: i + 1 }));
  newsCache.set(cacheKey, { items, fetchedAt: Date.now() });
  response.json({ items });
});

app.get("/api/health", (_request, response) => {
  const storage = storageConfiguration();

  response.status(storage.ok ? 200 : 503).json({
    ok: storage.ok,
    service: `${appSlug}-api`,
    build: {
      version: appVersion,
      commit: sourceCommit,
    },
    dependencies: {
      database: storage.database,
      objectStorage: storage.objectStorage,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/storage", requireAuthenticatedUser, async (_request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const storage = storageConfiguration();
    const [stateCount, eventCount, uploadCount] = await Promise.all([
      database.query("SELECT count(*)::int AS count FROM app_state"),
      database.query("SELECT count(*)::int AS count FROM app_events"),
      database.query("SELECT count(*)::int AS count FROM uploads"),
    ]);

    response.status(storage.ok ? 200 : 503).json({
      ...storage,
      records: {
        appState: stateCount.rows[0].count,
        events: eventCount.rows[0].count,
        uploads: uploadCount.rows[0].count,
      },
    });
  });
});

app.get("/api/auth/me", async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const sessionId = readSessionId(request, sessionCookieName);
    if (!sessionId) {
      response.json({ user: null });
      return;
    }
    const user = await getUserBySessionId(sessionId);
    response.json({ user });
  });
});

const canonicalAccountSchema = z.object({
  id: z.uuid(),
  status: z.enum(["onboarding", "active", "suspended", "closed"]),
  primaryRole: z.enum(["pending", "contractor", "tradesperson"]),
  email: z.email(),
  provider: z.enum(["email", "google", "facebook", "apple"]),
  emailVerified: z.boolean(),
  profile: z.object({
    displayName: z.string(),
    headline: z.string(),
    bio: z.string(),
    locationText: z.string(),
    visibility: z.enum(["private", "network"]),
    onboardingStatus: z.enum(["draft", "complete"]),
    serviceArea: z.object({
      city: z.string(),
      region: z.string(),
      countryCode: z.string(),
      radiusMiles: z.number().int(),
    }),
    availabilityStatus: z.enum(["available", "limited", "unavailable"]),
    contactEmailVisibility: z.enum(["private", "connections"]),
    phoneE164: z.string().nullable(),
    phoneVisibility: z.enum(["private", "connections"]),
    avatarUploadId: z.uuid().nullable(),
    trades: z.array(z.object({ code: z.string(), name: z.string(), primary: z.boolean() })),
  }),
  organizations: z.array(z.object({
    id: z.uuid(),
    name: z.string(),
    role: z.enum(["owner", "admin", "member"]),
  })),
  capabilities: z.object({
    canCompleteOnboarding: z.boolean(),
    canPostWork: z.boolean(),
    canApplyToWork: z.boolean(),
    canPublishProfile: z.boolean(),
  }),
});

app.get("/api/v1/me", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const { account: actorAccount, profile, memberships } = request.actor;
  const account = canonicalAccountSchema.parse({
    id: actorAccount.id,
    status: actorAccount.status,
    primaryRole: actorAccount.primaryRole,
    email: actorAccount.email,
    provider: actorAccount.provider,
    emailVerified: actorAccount.emailVerified,
    profile,
    organizations: memberships.map((membership) => ({
      id: membership.organizationId,
      name: membership.organizationName,
      role: membership.role,
    })),
    capabilities: {
      canCompleteOnboarding: actorAccount.emailVerified && profile.onboardingStatus === "draft",
      canPostWork: actorAccount.status === "active" && actorAccount.primaryRole === "contractor",
      canApplyToWork: actorAccount.status === "active" && actorAccount.primaryRole === "tradesperson",
      canPublishProfile: actorAccount.status === "active" && profile.onboardingStatus === "complete",
    },
  });

  response.json({ data: account, meta: { requestId: request.requestId } });
}));

const profileFieldsSchema = z.object({
  displayName: z.string().trim().min(2).max(100).optional(),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(1500).optional(),
  serviceAreaCity: z.string().trim().min(2).max(100).optional(),
  serviceAreaRegion: z.string().trim().min(2).max(100).optional(),
  serviceRadiusMiles: z.number().int().min(1).max(250).optional(),
  availabilityStatus: z.enum(["available", "limited", "unavailable"]).optional(),
  contactEmailVisibility: z.enum(["private", "connections"]).optional(),
  phoneE164: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).nullable().optional(),
  phoneVisibility: z.enum(["private", "connections"]).optional(),
  tradeCodes: z.array(z.string().trim().min(1).max(80)).min(1).max(12).optional(),
});

const onboardingSchema = profileFieldsSchema.extend({
  role: z.enum(["contractor", "tradesperson"]),
  displayName: z.string().trim().min(2).max(100),
  serviceAreaCity: z.string().trim().min(2).max(100),
  serviceAreaRegion: z.string().trim().min(2).max(100),
  serviceRadiusMiles: z.number().int().min(1).max(250),
  tradeCodes: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  organizationName: z.string().trim().max(160).optional(),
  consentAccepted: z.literal(true),
  consentVersion: z.string().trim().min(1).max(80),
});

async function saveProfileFields(client, accountId, input) {
  const currentResult = await client.query("SELECT * FROM profiles WHERE account_id = $1 FOR UPDATE", [accountId]);
  if (!currentResult.rowCount) throw new ApiError(409, "PROFILE_MIGRATION_REQUIRED", "Profile setup is unavailable.");
  const current = currentResult.rows[0];
  const next = {
    displayName: input.displayName ?? current.display_name,
    headline: input.headline ?? current.headline,
    bio: input.bio ?? current.bio,
    city: input.serviceAreaCity ?? current.service_area_city,
    region: input.serviceAreaRegion ?? current.service_area_region,
    radius: input.serviceRadiusMiles ?? current.service_radius_miles,
    availability: input.availabilityStatus ?? current.availability_status,
    emailVisibility: input.contactEmailVisibility ?? current.contact_email_visibility,
    phone: input.phoneE164 !== undefined ? input.phoneE164 : current.phone_e164,
    phoneVisibility: input.phoneVisibility ?? current.phone_visibility,
  };
  const locationText = [next.city, next.region].filter(Boolean).join(", ");
  await client.query(
    `UPDATE profiles
     SET display_name = $2, headline = $3, bio = $4,
         service_area_city = $5, service_area_region = $6,
         service_radius_miles = $7, availability_status = $8,
         contact_email_visibility = $9, phone_e164 = $10,
         phone_visibility = $11, location_text = $12, updated_at = now()
     WHERE account_id = $1`,
    [accountId, next.displayName, next.headline, next.bio, next.city, next.region, next.radius,
      next.availability, next.emailVisibility, next.phone, next.phoneVisibility, locationText],
  );
  await client.query(
    "UPDATE auth_users SET display_name = $2, location = $3, updated_at = now() WHERE id = $1",
    [accountId, next.displayName, locationText],
  );

  if (input.tradeCodes) {
    const uniqueCodes = [...new Set(input.tradeCodes)];
    const trades = await client.query("SELECT code FROM trades WHERE code = ANY($1::text[]) AND active = true", [uniqueCodes]);
    if (trades.rowCount !== uniqueCodes.length) {
      throw new ApiError(422, "TRADE_INVALID", "One or more selected trades are unavailable.");
    }
    await client.query("DELETE FROM profile_trades WHERE account_id = $1", [accountId]);
    for (const [index, code] of uniqueCodes.entries()) {
      await client.query(
        "INSERT INTO profile_trades (account_id, trade_code, is_primary) VALUES ($1, $2, $3)",
        [accountId, code, index === 0],
      );
    }
  }
}

app.patch("/api/v1/profile", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const input = validate(profileFieldsSchema, request.body);
  await withTransaction(async (client) => {
    await saveProfileFields(client, request.actor.account.id, input);
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id)
       VALUES ($1, $2, 'profile.draft_updated', 'profile', $2::text)`,
      [request.requestId, request.actor.account.id],
    );
  });
  const actor = await loadActorContext(database, request.actor.account.id);
  response.json({ data: { account: actor }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/onboarding/complete", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const input = validate(onboardingSchema, request.body);
  const expectedConsentVersion = envValue("SIGNUP_CONSENT_VERSION", "2026-06-19");
  if (input.consentVersion !== expectedConsentVersion) {
    throw new ApiError(409, "CONSENT_VERSION_CHANGED", "The consent agreement changed. Review the current version.");
  }
  if (!request.actor.account.emailVerified) {
    throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email before completing onboarding.");
  }
  if (input.role === "contractor" && !input.organizationName) {
    throw new ApiError(422, "ORGANIZATION_REQUIRED", "Contractor accounts require a business or crew name.");
  }

  await withTransaction(async (client) => {
    const accountResult = await client.query("SELECT primary_role FROM accounts WHERE id = $1 FOR UPDATE", [request.actor.account.id]);
    const currentRole = accountResult.rows[0]?.primary_role;
    if (!currentRole || (currentRole !== "pending" && currentRole !== input.role)) {
      throw new ApiError(409, "ROLE_IMMUTABLE", "Account type cannot be changed after selection.");
    }
    await saveProfileFields(client, request.actor.account.id, input);
    await client.query(
      "UPDATE accounts SET primary_role = $2, status = 'active', updated_at = now() WHERE id = $1",
      [request.actor.account.id, input.role],
    );
    await client.query(
      `UPDATE auth_users SET role = $2, organization = $3, updated_at = now() WHERE id = $1`,
      [request.actor.account.id, input.role, input.role === "contractor" ? input.organizationName : ""],
    );
    await client.query(
      "UPDATE profiles SET onboarding_status = 'complete', updated_at = now() WHERE account_id = $1",
      [request.actor.account.id],
    );

    if (input.role === "contractor") {
      const membership = await client.query(
        `SELECT m.organization_id FROM organization_memberships m
         WHERE m.account_id = $1 AND m.status = 'active' AND m.membership_role = 'owner'
         LIMIT 1 FOR UPDATE`,
        [request.actor.account.id],
      );
      if (membership.rowCount) {
        await client.query("UPDATE organizations SET name = $2, updated_at = now() WHERE id = $1", [membership.rows[0].organization_id, input.organizationName]);
      } else {
        const organization = await client.query(
          "INSERT INTO organizations (name, created_by_account_id) VALUES ($1, $2) RETURNING id",
          [input.organizationName, request.actor.account.id],
        );
        await client.query(
          `INSERT INTO organization_memberships (organization_id, account_id, membership_role, status)
           VALUES ($1, $2, 'owner', 'active')`,
          [organization.rows[0].id, request.actor.account.id],
        );
      }
    }

    await client.query(
      `INSERT INTO consent_acceptances (
         account_id, document_key, document_version, context, request_id, metadata
       ) VALUES ($1, 'platform_terms', $2, 'signup', $3, $4::jsonb)
       ON CONFLICT (account_id, document_key, document_version, context) DO NOTHING`,
      [request.actor.account.id, expectedConsentVersion, request.requestId, JSON.stringify({ role: input.role })],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2, 'onboarding.completed', 'account', $2::text, $3::jsonb)`,
      [request.requestId, request.actor.account.id, JSON.stringify({ role: input.role, consentVersion: expectedConsentVersion })],
    );
  });

  const actor = await loadActorContext(database, request.actor.account.id);
  response.json({ data: { account: actor }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/profile/publish", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  if (request.actor.account.status !== "active" || request.actor.profile.onboardingStatus !== "complete") {
    throw new ApiError(409, "PROFILE_NOT_READY", "Complete onboarding before publishing your profile.");
  }
  await database.query("UPDATE profiles SET visibility = 'network', updated_at = now() WHERE account_id = $1", [request.actor.account.id]);
  response.json({ data: { visibility: "network" }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/profile/unpublish", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  await database.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = $1", [request.actor.account.id]);
  response.json({ data: { visibility: "private" }, meta: { requestId: request.requestId } });
}));

app.put("/api/v1/profile/avatar", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const input = validate(z.object({ uploadId: z.uuid().nullable() }), request.body);
  if (input.uploadId) {
    const uploadResult = await database.query(
      `SELECT id FROM uploads
       WHERE id = $1 AND session_id = $2 AND mime_type LIKE 'image/%' AND kind = 'profile-avatar'`,
      [input.uploadId, request.actor.account.id],
    );
    if (!uploadResult.rowCount) throw new ApiError(404, "PROFILE_MEDIA_NOT_FOUND", "Profile image was not found.");
  }
  await database.query("UPDATE profiles SET avatar_upload_id = $2, updated_at = now() WHERE account_id = $1", [request.actor.account.id, input.uploadId]);
  response.json({ data: { avatarUploadId: input.uploadId }, meta: { requestId: request.requestId } });
}));

app.get("/api/readiness", requireAuthenticatedUser, async (_request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const storage = storageConfiguration();
    await database.query("SELECT 1");
    const migrations = await migrationStatus(database);
    migrationVersion = migrations.latestVersion
      ? `${String(migrations.latestVersion).padStart(4, "0")}_${migrations.latestName}`
      : "uninitialized";
    response.status(storage.ok ? 200 : 503).json({
      ok: storage.ok,
      service: `${appSlug}-api`,
      build: { version: appVersion, commit: sourceCommit },
      migrationVersion,
      migrations: {
        applied: migrations.applied.map(({ version, name }) => ({ version, name })),
        pending: migrations.pending,
      },
      dependencies: {
        database: storage.database,
        objectStorage: storage.objectStorage,
      },
      timestamp: new Date().toISOString(),
    });
  });
});

app.get("/api/auth/providers", (_request, response) => {
  const providers = {
    google: integrationStatus("google", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "Google sign-in"),
    facebook: integrationStatus("facebook", ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"], "Facebook sign-in"),
    apple: integrationStatus("apple", ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"], "Apple sign-in"),
    email: emailProviderStatus(),
  };

  response.json({ providers, inviteRequired: process.env.REQUIRE_PILOT_INVITE === "true" });
});

app.get("/api/auth/google/start", authRateLimit, asyncRoute(async (request, response) => {
  const status = integrationStatus("google", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "Google sign-in");
  if (!status.ok) {
    throw new ApiError(503, "OAUTH_PROVIDER_UNAVAILABLE", "Google sign-in is temporarily unavailable.");
  }

  await ensureDatabaseReady();
  const state = createOpaqueToken();
  const nonce = createOpaqueToken();
  const verifier = createOpaqueToken(48);
  const redirectPath = safeRedirectPath(request.query.redirect, "/");
  await database.query("DELETE FROM oauth_transactions WHERE expires_at <= now()");
  await database.query(
    `INSERT INTO oauth_transactions (state_hash, provider, code_verifier, nonce, redirect_path, expires_at)
     VALUES ($1, 'google', $2, $3, $4, now() + interval '10 minutes')`,
    [hashOpaqueToken(state), verifier, nonce, redirectPath],
  );
  response.cookie(`${sessionCookieName}_oauth_state`, state, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 10,
  });

  const redirectUri = envValue("GOOGLE_REDIRECT_URI", "https://rivt.pro/api/auth/google/callback");
  response.redirect(buildGoogleAuthorizationUrl({
    clientId: process.env.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
    nonce,
    codeChallenge: pkceChallenge(verifier),
  }));
}));

app.get("/api/auth/google/callback", authRateLimit, asyncRoute(async (request, response) => {
  await ensureDatabaseReady();
  const state = String(request.query.state ?? "");
  const stateCookie = parseCookies(request)[`${sessionCookieName}_oauth_state`];
  const code = String(request.query.code ?? "");
  if (!state || !stateCookie || stateCookie !== state || !code) {
    throw new ApiError(400, "OAUTH_TRANSACTION_INVALID", "Google sign-in could not be completed.");
  }

  const transactionResult = await database.query(
    `DELETE FROM oauth_transactions
     WHERE state_hash = $1 AND provider = 'google' AND expires_at > now()
     RETURNING code_verifier, nonce, redirect_path`,
    [hashOpaqueToken(state)],
  );
  if (!transactionResult.rowCount) {
    throw new ApiError(400, "OAUTH_TRANSACTION_EXPIRED", "Google sign-in expired. Start again.");
  }
  const transaction = transactionResult.rows[0];
  const redirectUri = envValue("GOOGLE_REDIRECT_URI", "https://rivt.pro/api/auth/google/callback");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: transaction.code_verifier,
    }),
  });
  if (!tokenResponse.ok) {
    await tokenResponse.text();
    throw new ApiError(502, "OAUTH_EXCHANGE_FAILED", "Google sign-in could not be completed.");
  }
  const tokenBody = await tokenResponse.json();
  const identity = await verifyGoogleIdToken(tokenBody.id_token, {
    clientId: process.env.GOOGLE_CLIENT_ID,
    nonce: transaction.nonce,
  });
  const user = await resolveGoogleAccount(identity);
  await rotateAuthSession(request, response, user.id);
  response.clearCookie(`${sessionCookieName}_oauth_state`, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.redirect(safeRedirectPath(transaction.redirect_path, "/"));
}));

const signupSchema = z.object({
  email: z.email().max(320).transform((value) => normalizeEmail(value)),
  password: z.string(),
  role: z.enum(["contractor", "tradesperson"]),
  displayName: z.string().trim().min(2).max(100),
  inviteCode: z.string().trim().min(8).max(256).optional(),
});

const loginSchema = z.object({
  email: z.email().max(320).transform((value) => normalizeEmail(value)),
  password: z.string().min(1).max(1024),
});

async function handleSignup(request, response) {
  const input = validate(signupSchema, request.body);
  assertStrongPassword(input.password);
  if (!emailProviderStatus().ok) {
    throw new ApiError(503, "EMAIL_PROVIDER_UNAVAILABLE", "Email signup is temporarily unavailable.");
  }
  await ensureDatabaseReady();
  const created = await withTransaction(async (client) => {
    const existing = await client.query("SELECT id FROM auth_users WHERE email_hash = $1", [sha256(input.email)]);
    if (existing.rowCount) {
      throw new ApiError(409, "SIGNUP_NOT_AVAILABLE", "An account could not be created with those details.");
    }
    const inviteId = await consumePilotInvite(client, input);
    const credentials = hashPassword(input.password);
    const userId = randomUUID();
    const result = await client.query(
      `INSERT INTO auth_users (
         id, email, email_hash, password_salt, password_hash, provider,
         display_name, role, organization, location
       ) VALUES ($1, $2, $3, $4, $5, 'email', $6, $7, '', '')
       RETURNING id, email, provider, display_name, role, organization, location, email_verified_at`,
      [userId, input.email, sha256(input.email), credentials.salt, credentials.hash, input.displayName, input.role],
    );
    const verificationToken = await createVerificationToken(client, userId);
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2, 'account.signup', 'account', $2::text, $3::jsonb)`,
      [request.requestId ?? null, userId, JSON.stringify({ provider: "email", inviteId })],
    );
    return { user: result.rows[0], verificationToken };
  });

  await rotateAuthSession(request, response, created.user.id);
  let verificationDelivered = true;
  try {
    await sendVerificationMessage(created.user.email, created.verificationToken);
  } catch (error) {
    verificationDelivered = false;
    console.error("Signup verification delivery failed", { code: error.code ?? "unknown" });
  }
  const user = buildUserResponse({ ...created.user, account_status: "onboarding", onboarding_status: "draft" });
  if (request.path.startsWith("/api/v1/")) {
    response.status(201).json({ data: { user, verificationRequired: true, verificationDelivered }, meta: { requestId: request.requestId } });
    return;
  }
  response.status(201).json({ ok: true, user, verificationRequired: true, verificationDelivered });
}

async function handleLogin(request, response) {
  const input = validate(loginSchema, request.body);
  await ensureDatabaseReady();
  const result = await database.query(
    `SELECT u.id, u.email, u.password_salt, u.password_hash, u.provider,
            u.display_name, u.role, u.organization, u.location, u.email_verified_at,
            a.status AS account_status, p.onboarding_status
     FROM auth_users u
     INNER JOIN accounts a ON a.id = u.id
     INNER JOIN profiles p ON p.account_id = u.id
     WHERE u.email_hash = $1
     LIMIT 1`,
    [sha256(input.email)],
  );
  const user = result.rows[0];
  if (!user || !verifyPassword(input.password, user.password_salt, user.password_hash)) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
  if (["suspended", "closed"].includes(user.account_status)) {
    throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "This account cannot sign in. Contact support.");
  }
  await database.query("UPDATE auth_users SET last_login_at = now(), updated_at = now() WHERE id = $1", [user.id]);
  await rotateAuthSession(request, response, user.id);
  const responseUser = buildUserResponse(user);
  if (request.path.startsWith("/api/v1/")) {
    response.json({ data: { user: responseUser }, meta: { requestId: request.requestId } });
    return;
  }
  response.json({ ok: true, user: responseUser });
}

app.post("/api/v1/auth/signup", authRateLimit, asyncRoute(handleSignup));
app.post("/api/auth/signup", authRateLimit, asyncRoute(handleSignup));
app.post("/api/v1/auth/login", authRateLimit, asyncRoute(handleLogin));
app.post("/api/auth/login", authRateLimit, asyncRoute(handleLogin));

const tokenSchema = z.object({ token: z.string().min(32).max(512) });
const forgotPasswordSchema = z.object({
  email: z.email().max(320).transform((value) => normalizeEmail(value)),
});
const resetPasswordSchema = tokenSchema.extend({ password: z.string() });

app.post("/api/v1/auth/email/resend", authRateLimit, requireV1AuthenticatedUser, asyncRoute(async (request, response) => {
  await ensureDatabaseReady();
  const user = await database.query("SELECT id, email, email_verified_at FROM auth_users WHERE id = $1", [request.authUser.id]);
  if (!user.rowCount || user.rows[0].email_verified_at) {
    response.status(202).json({ data: { accepted: true }, meta: { requestId: request.requestId } });
    return;
  }
  if (!emailProviderStatus().ok) {
    throw new ApiError(503, "EMAIL_PROVIDER_UNAVAILABLE", "Verification email is temporarily unavailable.");
  }
  const token = await withTransaction((client) => createVerificationToken(client, request.authUser.id, { enforceResendLimit: true }));
  await sendVerificationMessage(user.rows[0].email, token);
  response.status(202).json({ data: { accepted: true }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/auth/email/verify", authRateLimit, asyncRoute(async (request, response) => {
  const input = validate(tokenSchema, request.body);
  await ensureDatabaseReady();
  const accountId = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id, account_id, expires_at, consumed_at
       FROM email_verification_tokens WHERE token_hash = $1 LIMIT 1 FOR UPDATE`,
      [hashOpaqueToken(input.token)],
    );
    const record = result.rows[0];
    if (!record || record.consumed_at || new Date(record.expires_at).getTime() <= Date.now()) {
      throw new ApiError(400, "VERIFICATION_TOKEN_INVALID", "The verification link is invalid or expired.");
    }
    await client.query(
      "UPDATE email_verification_tokens SET consumed_at = now() WHERE account_id = $1 AND consumed_at IS NULL",
      [record.account_id],
    );
    await client.query("UPDATE auth_users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1", [record.account_id]);
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id)
       VALUES ($1, $2, 'account.email_verified', 'account', $2::text)`,
      [request.requestId, record.account_id],
    );
    return record.account_id;
  });
  response.json({ data: { verified: true, accountId }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/auth/password/forgot", authRateLimit, asyncRoute(async (request, response) => {
  const input = validate(forgotPasswordSchema, request.body);
  await ensureDatabaseReady();
  const result = await database.query(
    "SELECT id, email, email_verified_at FROM auth_users WHERE email_hash = $1 LIMIT 1",
    [sha256(input.email)],
  );
  const user = result.rows[0];
  if (user?.email_verified_at && emailProviderStatus().ok) {
    try {
      const token = await withTransaction(async (client) => {
        const recent = await client.query(
          "SELECT count(*)::int AS count FROM password_reset_tokens WHERE account_id = $1 AND created_at > now() - interval '1 hour'",
          [user.id],
        );
        if (recent.rows[0].count >= 3) return null;
        const raw = createOpaqueToken();
        await client.query(
          "UPDATE password_reset_tokens SET consumed_at = now() WHERE account_id = $1 AND consumed_at IS NULL",
          [user.id],
        );
        await client.query(
          `INSERT INTO password_reset_tokens (account_id, token_hash, expires_at)
           VALUES ($1, $2, now() + interval '30 minutes')`,
          [user.id, hashOpaqueToken(raw)],
        );
        return raw;
      });
      if (token) await sendPasswordResetMessage(user.email, token);
    } catch (error) {
      console.error("Password reset delivery failed", { code: error.code ?? "unknown" });
    }
  }
  response.status(202).json({
    data: { accepted: true, message: "If that account exists, a reset email will arrive shortly." },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/auth/password/reset", authRateLimit, asyncRoute(async (request, response) => {
  const input = validate(resetPasswordSchema, request.body);
  assertStrongPassword(input.password);
  await ensureDatabaseReady();
  await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id, account_id, expires_at, consumed_at
       FROM password_reset_tokens WHERE token_hash = $1 LIMIT 1 FOR UPDATE`,
      [hashOpaqueToken(input.token)],
    );
    const record = result.rows[0];
    if (!record || record.consumed_at || new Date(record.expires_at).getTime() <= Date.now()) {
      throw new ApiError(400, "RESET_TOKEN_INVALID", "The reset link is invalid or expired.");
    }
    const credentials = hashPassword(input.password);
    await client.query(
      `UPDATE auth_users SET password_salt = $2, password_hash = $3, updated_at = now() WHERE id = $1`,
      [record.account_id, credentials.salt, credentials.hash],
    );
    await client.query(
      "UPDATE password_reset_tokens SET consumed_at = now() WHERE account_id = $1 AND consumed_at IS NULL",
      [record.account_id],
    );
    await client.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [record.account_id]);
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id)
       VALUES ($1, $2, 'account.password_reset', 'account', $2::text)`,
      [request.requestId, record.account_id],
    );
  });
  response.json({ data: { reset: true }, meta: { requestId: request.requestId } });
}));

app.patch("/api/auth/profile", requireAuthenticatedUser, (_request, response) => {
  response.status(410).json({ ok: false, error: "This profile endpoint was retired. Refresh RIVT to continue." });
});

app.post("/api/auth/logout", authRateLimit, async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const sessionId = readSessionId(request, sessionCookieName);
    if (sessionId) {
      await database.query("UPDATE auth_sessions SET revoked_at = now() WHERE session_id = $1", [sessionId]);
    }
    response.clearCookie(sessionCookieName, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    response.json({ ok: true });
  });
});

app.post("/api/v1/auth/logout", authRateLimit, requireV1AuthenticatedUser, asyncRoute(async (request, response) => {
  await database.query("UPDATE auth_sessions SET revoked_at = now() WHERE session_id = $1", [request.authSessionId]);
  response.clearCookie(sessionCookieName, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  response.json({ data: { loggedOut: true }, meta: { requestId: request.requestId } });
}));

app.get("/api/v1/sessions", requireV1AuthenticatedUser, asyncRoute(async (request, response) => {
  const result = await database.query(
    `SELECT id, session_id, device_label, created_at, last_seen_at, expires_at
     FROM auth_sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
     ORDER BY last_seen_at DESC, created_at DESC`,
    [request.authUser.id],
  );
  response.json({
    data: {
      sessions: result.rows.map((session) => ({
        id: session.id,
        deviceLabel: session.device_label,
        createdAt: session.created_at,
        lastSeenAt: session.last_seen_at,
        expiresAt: session.expires_at,
        current: session.session_id === request.authSessionId,
      })),
    },
    meta: { requestId: request.requestId },
  });
}));

app.delete("/api/v1/sessions/:id", requireV1AuthenticatedUser, writeRateLimit, asyncRoute(async (request, response) => {
  const sessionId = validate(z.uuid(), request.params.id);
  const result = await database.query(
    `UPDATE auth_sessions SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING session_id`,
    [sessionId, request.authUser.id],
  );
  if (!result.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "Session was not found.");
  const revokedCurrent = result.rows[0].session_id === request.authSessionId;
  if (revokedCurrent) {
    response.clearCookie(sessionCookieName, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  response.json({ data: { revoked: true, current: revokedCurrent }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/sessions/revoke-others", requireV1AuthenticatedUser, writeRateLimit, asyncRoute(async (request, response) => {
  const result = await database.query(
    `UPDATE auth_sessions SET revoked_at = now()
     WHERE user_id = $1 AND session_id <> $2 AND revoked_at IS NULL
     RETURNING id`,
    [request.authUser.id, request.authSessionId],
  );
  response.json({ data: { revokedCount: result.rowCount }, meta: { requestId: request.requestId } });
}));

app.get("/api/app-state", requireAuthenticatedUser, async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const scopeId = request.authUser.id;
    const result = await database.query(
      "SELECT state, updated_at FROM app_state WHERE id = $1",
      [scopeId],
    );

    if (!result.rowCount) {
      response.json({ state: null, updatedAt: null });
      return;
    }

    response.json({
      state: result.rows[0].state,
      updatedAt: result.rows[0].updated_at,
    });
  });
});

app.put("/api/app-state", requireAuthenticatedUser, writeRateLimit, async (request, response, next) => {
  if (!request.body || typeof request.body.state !== "object" || request.body.state === null) {
    response.status(400).json({ ok: false, error: "Expected JSON body with a state object." });
    return;
  }

  await runWithDatabase(response, next, async () => {
    const scopeId = request.authUser.id;
    const result = await database.query(
      `
        INSERT INTO app_state (id, state, updated_at)
        VALUES ($1, $2::jsonb, now())
        ON CONFLICT (id)
        DO UPDATE SET state = EXCLUDED.state, updated_at = now()
        RETURNING updated_at
      `,
      [scopeId, JSON.stringify(request.body.state)],
    );

    response.json({ ok: true, updatedAt: result.rows[0].updated_at });
  });
});

app.post("/api/auth/guest", (_request, response) => {
  response.status(404).json({ ok: false, error: "Guest authentication is not available." });
});

app.post("/api/events", requireAuthenticatedUser, writeRateLimit, async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const scopeId = request.authUser.id;
    const event = {
      id: randomUUID(),
      type: request.body?.type ?? "app_event",
      payload: request.body?.payload ?? request.body ?? {},
    };
    const result = await database.query(
      `
        INSERT INTO app_events (id, session_id, type, payload)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING id, session_id, type, payload, created_at
      `,
      [event.id, scopeId, event.type, JSON.stringify(event.payload)],
    );

    response.status(201).json({ ok: true, event: result.rows[0] });
  });
});

app.get("/api/payments/export.csv", requireAuthenticatedUser, async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const scopeId = request.authUser.id;
    const result = await database.query("SELECT state FROM app_state WHERE id = $1", [scopeId]);
    const paymentRecords = Array.isArray(result.rows[0]?.state?.paymentRecords)
      ? result.rows[0].state.paymentRecords
      : [];
    const headers = ["Job", "Worker", "Amount", "Method", "Status", "Date"];
    const rows = paymentRecords.map((record) => [
      record.jobTitle,
      record.worker,
      record.amount,
      record.method,
      record.status,
      record.date,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

    response.setHeader("Content-Type", "text/csv;charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${appSlug}-payment-history-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    response.send(csv);
  });
});

app.get("/api/uploads", requireAuthenticatedUser, async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const scopeId = request.authUser.id;
    const result = await database.query(
      `
        SELECT *
        FROM uploads
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 200
      `,
      [scopeId],
    );
    const uploads = await Promise.all(
      result.rows.map(async (row) => mapUploadRow(row, await signedObjectUrl(row.object_key))),
    );

    response.json({ uploads });
  });
});

app.get("/api/uploads/:id/url", requireAuthenticatedUser, async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const scopeId = request.authUser.id;
    const result = await database.query(
      "SELECT object_key FROM uploads WHERE id = $1 AND session_id = $2",
      [request.params.id, scopeId],
    );

    if (!result.rowCount || !result.rows[0].object_key) {
      response.status(404).json({ ok: false, error: "Upload not found." });
      return;
    }

    response.json({
      ok: true,
      signedUrl: await signedObjectUrl(result.rows[0].object_key),
      expiresIn: signedUrlSeconds,
    });
  });
});

app.post("/api/uploads", requireAuthenticatedUser, uploadRateLimit, upload.single("file"), async (request, response, next) => {
  if (!requireObjectStorage(response)) {
    return;
  }

  if (!request.file) {
    response.status(400).json({ ok: false, error: "A file field named `file` is required." });
    return;
  }

  await runWithDatabase(response, next, async () => {
    const scopeId = request.authUser.id;
    const id = randomUUID();
    const kind = request.body?.kind ?? "record";
    const jobId = Number(request.body?.jobId);
    const objectKey = `${safeObjectName(scopeId)}/${safeObjectName(kind)}/${new Date().toISOString().slice(0, 10)}/${id}-${safeObjectName(
      request.file.originalname,
    )}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: objectKey,
        Body: request.file.buffer,
        ContentType: request.file.mimetype,
        Metadata: {
          originalName: request.file.originalname.slice(0, 256),
          source: appSlug,
        },
      }),
    );

    const result = await database.query(
      `
        INSERT INTO uploads (
          id, session_id, kind, name, job_id, notes, object_key, original_name, mime_type, size_bytes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        id,
        scopeId,
        kind,
        request.body?.name ?? request.file.originalname,
        Number.isFinite(jobId) ? jobId : null,
        request.body?.notes ?? "",
        objectKey,
        request.file.originalname,
        request.file.mimetype,
        request.file.size,
      ],
    );

    response.status(201).json({
      ok: true,
      upload: mapUploadRow(result.rows[0], await signedObjectUrl(objectKey)),
    });
  });
});

app.post("/api/identity/verify", requireAuthenticatedUser, writeRateLimit, (_request, response) => {
  const status = integrationStatus("identity", ["IDENTITY_PROVIDER_KEY"], "government ID verification");

  if (!status.ok) {
    response.status(424).json({
      ...status,
      message: "Connect Persona, Stripe Identity, or another ID provider before running live verifications.",
    });
    return;
  }

  response.status(501).json({
    ok: false,
    provider: "identity",
    mode: "not_implemented",
    message: "Identity verification is not available until a provider workflow is implemented and tested.",
  });
});

app.post("/api/subscriptions/checkout", requireAuthenticatedUser, writeRateLimit, (_request, response) => {
  const status = integrationStatus("stripe", ["STRIPE_SECRET_KEY"], "subscription billing");

  if (!status.ok) {
    response.status(424).json({
      ...status,
      message: "Add Stripe keys before sending real customers through subscription checkout.",
    });
    return;
  }

  response.status(501).json({
    ok: false,
    provider: "stripe",
    mode: "not_implemented",
    message: "Subscription checkout is not available until the Stripe workflow is implemented and tested.",
  });
});

app.post("/api/notifications/test", requireAuthenticatedUser, writeRateLimit, (request, response) => {
  const email = integrationStatus("email", ["RESEND_API_KEY"], "email notifications");
  const sms = buildTwilioSmsStatus("SMS notifications");
  const ok = email.ok || sms.ok;

  response.status(ok ? 200 : 424).json({
    ok,
    email,
    sms,
    channel: request.body?.channel ?? "email",
    message: ok
      ? "Notification provider is configured."
      : "Add Resend or Twilio account, auth, and a messaging service SID or sending number before sending customer notifications.",
  });
});

app.post("/api/invoices/send", requireAuthenticatedUser, writeRateLimit, async (request, response) => {
  const channel = request.body?.channel === "sms" ? "sms" : "email";
  const recipient = String(request.body?.recipient ?? "").trim();
  const subject = String(request.body?.subject ?? `${appName} invoice`).trim();
  const text = String(request.body?.message ?? "").trim();

  if (!recipient || !text) {
    response.status(400).json({
      ok: false,
      error: "Recipient and invoice text are required.",
    });
    return;
  }

  if (channel === "email") {
    const status = integrationStatus("email", ["RESEND_API_KEY", "RESEND_FROM_EMAIL"], "invoice email delivery");
    if (!status.ok) {
      response.status(424).json({
        ok: false,
        ...status,
        message: "Connect Resend and a verified from address before sending invoice email.",
      });
      return;
    }

    const sendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [recipient],
        subject,
        text,
      }),
    });

  if (!sendResponse.ok) {
      await sendResponse.text();
      response.status(502).json({
        ok: false,
        ...status,
        message: "Resend rejected the invoice email.",
      });
      return;
    }

    const body = await sendResponse.json().catch(() => ({}));
    response.json({
      ok: true,
      provider: "email",
      deliveryId: body.id ?? null,
      recipient,
      message: "Invoice email sent.",
    });
    return;
  }

  const smsConfig = getTwilioSmsConfig();
  const status = buildTwilioSmsStatus("invoice SMS delivery");
  if (!status.ok) {
    response.status(424).json({
      ok: false,
      ...status,
      message: "Connect Twilio and a messaging service SID or sending number before sending invoice text messages.",
    });
    return;
  }

  const twilioBody = new URLSearchParams({
    To: normalizePhoneNumber(recipient),
    Body: text,
  });

  if (smsConfig.hasMessagingService) {
    twilioBody.set("MessagingServiceSid", smsConfig.messagingServiceSid);
  } else {
    twilioBody.set("From", smsConfig.fromNumber);
  }

  const sendResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioBody,
    },
  );

  if (!sendResponse.ok) {
    await sendResponse.text();
    response.status(502).json({
      ok: false,
      ...status,
      message: "Twilio rejected the invoice SMS.",
    });
    return;
  }

  const body = await sendResponse.json().catch(() => ({}));
  response.json({
    ok: true,
    provider: "sms",
    deliveryId: body.sid ?? null,
    recipient: normalizePhoneNumber(recipient),
    message: "Invoice text sent.",
  });
});

if (existsSync(distDir)) {
  app.use(express.static(distDir, {
    index: false,
    setHeaders(response, filePath) {
      if (filePath.endsWith("index.html")) {
        response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      }
    },
  }));
  app.use((request, response, next) => {
    if (request.path.startsWith("/api/")) {
      next();
      return;
    }

    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    response.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((error, request, response, _next) => {
  if (!error.status || error.status >= 500) {
    console.error(error);
  }
  if (request.path.startsWith("/api/v1/")) {
    sendApiError(error, request, response);
    return;
  }
  response.status(error.status ?? 500).json({
    ok: false,
    error: error.status ? error.message : `${appName} API error`,
    detail: process.env.NODE_ENV === "production" ? undefined : error.message,
  });
});

export async function startServer(listenPort = port) {
  if (database) {
    await ensureDatabaseReady();
  }

  return app.listen(listenPort, () => {
    const storage = storageConfiguration();
    console.log(`${appName} API listening on http://127.0.0.1:${listenPort}`);
    if (!storage.ok) {
      console.warn(`Managed storage setup required: ${storage.missing.join(", ")}`);
    }
  });
}

export async function closeDatabase() {
  if (database) {
    await database.end();
  }
}

export { app, ensureDatabaseReady };

if (path.resolve(process.argv[1] ?? "") === __filename) {
  startServer().catch((error) => {
    console.error("Server startup failed", error);
    process.exitCode = 1;
  });
}
