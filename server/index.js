import "dotenv/config";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import compression from "compression";
import cors from "cors";
import express from "express";
import multer from "multer";
import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pg from "pg";
import {
  ApiError,
  asyncRoute,
  createRequestContext,
  decodeCursor,
  encodeCursor,
  sendApiError,
  validate,
  z,
} from "./api.js";
import { registerAlbumRoutes } from "./albums.js";
import { registerBillingRoutes, registerStripeWebhookRoute } from "./billing.js";
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
import { loadActorContext, requireOrganizationRole } from "./authorization.js";
import { emailProviderStatus, sendTransactionalEmail } from "./email.js";
import {
  assertPublishableJob,
  createJobSchema,
  jobListQuerySchema,
  jobSelectSql,
  mapJobRecord,
  publishJobSchema,
  transitionFor,
  transitionJobSchema,
  updateJobSchema,
} from "./jobs.js";
import {
  applicationDecisionSchema,
  applicationDraftSchema,
  applicationSubmitSchema,
  mapActiveWork,
  mapApplication,
  mapOffer,
  offerCreateSchema,
  offerDecisionSchema,
  requireOfferAcceptanceConsent,
  requireTradespersonActor,
  workTransitionSchema,
} from "./matches.js";
import {
  blockAccountSchema,
  conversationMuteSchema,
  mapConversation,
  mapConversationParticipant,
  mapMessage,
  mapNotification,
  mapNotificationPreference,
  messageCreateSchema,
  notificationPreferenceSchema,
  notificationReadSchema,
  reportConversationSchema,
} from "./messaging.js";
import { createRequestLogger, logError, logInfo, logWarn } from "./logger.js";
import { registerLegacyIntegrationRoutes } from "./legacy-integrations.js";
import { captureException, errorMonitoringStatus } from "./monitoring.js";
import { createNewsRouter } from "./news.js";
import { registerShopTalkRoutes } from "./shop-talk.js";
import { registerShopTalkModerationRoutes } from "./shop-talk-moderation.js";
import { registerCommunityRoutes } from "./communities.js";
import { registerNetworkRecordRoutes } from "./network-records.js";
import { registerToolRecordRoutes } from "./tool-records.js";
import {
  buildCloseoutReport,
  completionResolutionSchema,
  completionSubmitSchema,
  detectUploadContent,
  mapCompletionSubmission,
  mapProject,
  mapProjectEntry,
  mapProjectMedia,
  mediaKindForMime,
  projectEntryCreateSchema,
} from "./projects.js";
import {
  adminAccountTypeChangeSchema,
  adminReviewResolveSchema,
  adminSupportCaseEventSchema,
  mapReputation,
  mapRestriction,
  mapReview,
  mapSafetyReport,
  mapSupportCase,
  mapUnsafeWorkReport,
  requireAdminRole,
  restrictionCreateSchema,
  restrictionLiftSchema,
  reviewDisputeSchema,
  reviewResponseSchema,
  reviewSubmitSchema,
  safetyReportSchema,
  supportCaseCreateSchema,
  supportCaseEventSchema,
  unsafeWorkReportSchema,
} from "./reviews-safety.js";
import { migrateUp, migrationStatus } from "./migrations.js";
import {
  createOriginGuard,
  createDurableRateLimiter,
  createRequireAuthenticatedUser,
  isAllowedOrigin,
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
const sourceCommit = envValue("RAILWAY_GIT_COMMIT_SHA", envValue("SOURCE_COMMIT", "unknown"));
let migrationVersion = envValue("MIGRATION_VERSION", "uninitialized");
let migrationState = "pending"; // "pending" | "running" | "ready" | "failed"
let migrationErrorDetail = null;
const productionOrigin = envValue("APP_ORIGIN", "https://rivt.pro");
const scrypt = promisify(scryptCb);

function envValue(name, fallback = undefined) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function envFlag(name) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] ?? "").trim().toLowerCase());
}

function operationalControls() {
  return {
    signupsDisabled: envFlag("RIVT_SIGNUPS_DISABLED") || envFlag("SIGNUPS_DISABLED"),
    mutationsDisabled: envFlag("RIVT_MUTATIONS_DISABLED") || envFlag("PLATFORM_MUTATIONS_DISABLED"),
    reason: envValue("RIVT_CONTROL_REASON", null),
  };
}

function captureOperationalError(error, context = {}) {
  return captureException(error, {
    ...context,
    sourceCommit,
    migrationVersion,
    appVersion,
  }).catch((captureError) => {
    logWarn("monitoring.capture_failed", {
      requestId: context.requestId ?? null,
      error: captureError,
    });
  });
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

async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = (await scrypt(String(password ?? ""), salt, 64)).toString("hex");
  return { salt, hash: derived };
}

async function verifyPassword(password, salt, hash) {
  const candidate = await scrypt(String(password ?? ""), salt, 64);
  const target = Buffer.from(String(hash ?? ""), "hex");
  return candidate.length === target.length && timingSafeEqual(candidate, target);
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
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

app.use(compression());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (isAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }
    const error = new Error("Request origin is not allowed.");
    error.status = 403;
    callback(error);
  },
}));
app.set("trust proxy", 1);
registerStripeWebhookRoute({
  app,
  express,
  database,
  appOrigin: productionOrigin,
  createRequestContext,
  createRequestLogger,
});
app.use(express.json({ limit: "1mb" }));

app.use("/api", createRequestContext);
app.use("/api", createRequestLogger());
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

  databaseReadyPromise ??= (async () => {
    migrationState = "running";
    try {
      const status = await migrateUp(database);
      migrationVersion = status.latestVersion
        ? `${String(status.latestVersion).padStart(4, "0")}_${status.latestName}`
        : "uninitialized";
      migrationState = "ready";
      return status;
    } catch (error) {
      migrationState = "failed";
      migrationErrorDetail = error.message;
      throw error;
    }
  })();

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

const requireV1SupportActor = asyncRoute(async (request, _response, next) => {
  await ensureDatabaseReady();
  request.actor = await loadActorContext(database, request.authUser.id);
  if (request.actor.account.status === "closed") {
    throw new ApiError(403, "ACCOUNT_CLOSED", "Closed accounts cannot access support.");
  }
  next();
});

const requireV1AdminActor = asyncRoute(async (request, _response, next) => {
  await ensureDatabaseReady();
  request.actor = await loadActorContext(database, request.authUser.id);
  if (request.actor.account.status !== "active") {
    throw new ApiError(403, "ADMIN_ACCESS_DENIED", "Admin access requires an active account.");
  }
  const roles = await database.query(
    `SELECT role FROM admin_role_grants
     WHERE account_id = $1 AND status = 'active'
     ORDER BY role`,
    [request.actor.account.id],
  );
  request.admin = { roles: roles.rows.map((row) => row.role) };
  if (!request.admin.roles.length) {
    throw new ApiError(403, "ADMIN_ACCESS_DENIED", "This route requires RIVT staff access.");
  }
  next();
});

const authRateLimit = createDurableRateLimiter({
  database,
  databaseAvailable: () => Boolean(database),
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT ?? 30),
  namespace: "auth",
});

const baseWriteRateLimit = createDurableRateLimiter({
  database,
  databaseAvailable: () => Boolean(database),
  windowMs: 60 * 1000,
  max: Number(process.env.WRITE_RATE_LIMIT ?? 120),
  namespace: "write",
});

const baseUploadRateLimit = createDurableRateLimiter({
  database,
  databaseAvailable: () => Boolean(database),
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT ?? 40),
  namespace: "upload",
});

const baseNewsRateLimit = createDurableRateLimiter({
  database,
  databaseAvailable: () => Boolean(database),
  windowMs: 60 * 1000,
  max: Number(process.env.NEWS_RATE_LIMIT ?? 30),
  namespace: "news",
});

function allowsPendingOnboardingMutation(request) {
  const path = String(request.path ?? request.originalUrl ?? "").split("?", 1)[0];
  return (request.method === "POST" && path === "/api/v1/onboarding/complete")
    || (request.method === "PATCH" && path === "/api/v1/profile");
}

function allowsOperationalMutation(request) {
  const path = String(request.path ?? request.originalUrl ?? "").split("?", 1)[0];
  return path.startsWith("/api/v1/support/") || path.startsWith("/api/v1/admin/");
}

async function assertActorCanMutate(request) {
  const actor = request.actor;
  if (!actor) return;
  const controls = operationalControls();
  if (controls.mutationsDisabled && !allowsOperationalMutation(request)) {
    throw new ApiError(503, "PLATFORM_MUTATIONS_DISABLED", "RIVT is temporarily paused. Existing records are preserved and support remains available.", {
      supportAllowed: true,
      reason: controls.reason,
    });
  }
  if (actor.account.status !== "active" && !allowsPendingOnboardingMutation(request)) {
    throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "This account cannot make changes.");
  }
  const activeRestrictions = await database.query(
    `SELECT id, restriction_type, reason_code, reason, ends_at
     FROM account_restrictions
     WHERE account_id = $1
       AND status = 'active'
       AND restriction_type IN ('mutation_restricted', 'timeout_24h', 'suspension', 'ban')
       AND (ends_at IS NULL OR ends_at > now())
     ORDER BY created_at DESC, id DESC
     LIMIT 5`,
    [actor.account.id],
  );
  if (activeRestrictions.rowCount) {
    throw new ApiError(403, "ACCOUNT_RESTRICTED", "This account is restricted from making changes. Support access remains available.", {
      supportAllowed: true,
      restrictions: activeRestrictions.rows.map((row) => ({
        id: row.id,
        type: row.restriction_type,
        reasonCode: row.reason_code,
        endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
      })),
    });
  }
}

function writeRateLimit(request, response, next) {
  Promise.resolve(assertActorCanMutate(request))
    .then(() => baseWriteRateLimit(request, response, next))
    .catch(next);
}

function uploadRateLimit(request, response, next) {
  Promise.resolve(assertActorCanMutate(request))
    .then(() => baseUploadRateLimit(request, response, next))
    .catch(next);
}

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

function authSecurityStatus() {
  const configured = process.env.NODE_ENV !== "production"
    || String(process.env.AUTH_METADATA_PEPPER ?? "").length >= 32;
  return {
    ok: configured,
    provider: "session_security",
    purpose: "Privacy-safe session metadata",
    mode: configured ? "configured" : "setup_required",
    missing: configured ? [] : ["AUTH_METADATA_PEPPER"],
  };
}

function requireAuthSecurity() {
  if (!authSecurityStatus().ok) {
    throw new ApiError(503, "AUTH_SECURITY_UNAVAILABLE", "Sign-in is temporarily unavailable.");
  }
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
      const credentials = await hashPassword(createOpaqueToken());
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

app.use("/api/news", baseNewsRateLimit);
app.use(createNewsRouter());

app.get("/api/health", (_request, response) => {
  const storage = storageConfiguration();
  const monitoring = errorMonitoringStatus();
  const ok = storage.ok && migrationState !== "failed";

  response.status(ok ? 200 : 503).json({
    ok,
    service: `${appSlug}-api`,
    build: {
      version: appVersion,
      commit: sourceCommit,
    },
    migration: {
      state: migrationState,
      version: migrationVersion,
      error: migrationErrorDetail,
    },
    dependencies: {
      database: storage.database,
      objectStorage: storage.objectStorage,
    },
    observability: {
      errorMonitoring: {
        ok: monitoring.ok,
        provider: monitoring.provider,
        mode: monitoring.mode,
      },
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
    const accountStorageUsage = { usedBytes: 0, objectCount: 0 };
    if (storage.ok && database) {
      const accountStorageResult = await database.query(
        `
          SELECT
            COALESCE(SUM(size_bytes), 0)::bigint AS used_bytes,
            COUNT(*)::int AS upload_count
          FROM uploads
          WHERE account_id = $1 AND size_bytes IS NOT NULL
        `,
        [_request.authUser.id],
      );
      accountStorageUsage.usedBytes = Number(accountStorageResult.rows[0]?.used_bytes ?? 0);
      accountStorageUsage.objectCount = Number(accountStorageResult.rows[0]?.upload_count ?? 0);
    }
    const planStorageLimitGb = Number(process.env.ACCOUNT_STORAGE_GB_LIMIT ?? process.env.STORAGE_GB_LIMIT ?? NaN);
    const planStorageLimitBytes = Number.isFinite(planStorageLimitGb) ? planStorageLimitGb * 1024 * 1024 * 1024 : null;

    response.status(storage.ok ? 200 : 503).json({
      ...storage,
      plan: {
        storageLimitBytes: planStorageLimitBytes,
        storageScope: "account",
      },
      records: {
        appState: stateCount.rows[0].count,
        events: eventCount.rows[0].count,
        uploads: uploadCount.rows[0].count,
      },
      accountStorage: {
        usedBytes: accountStorageUsage.usedBytes,
        objectCount: accountStorageUsage.objectCount,
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
  adminRoles: z.array(z.string()),
  capabilities: z.object({
    canCompleteOnboarding: z.boolean(),
    canPostWork: z.boolean(),
    canApplyToWork: z.boolean(),
    canPublishProfile: z.boolean(),
  }),
});

app.get("/api/v1/me", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const { account: actorAccount, profile, memberships } = request.actor;
  const adminRoles = await database.query(
    `SELECT role FROM admin_role_grants
     WHERE account_id = $1 AND status = 'active'
     ORDER BY role`,
    [actorAccount.id],
  );
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
    adminRoles: adminRoles.rows.map((row) => String(row.role)),
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

const profileSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  limit: z.coerce.number().int().min(1).max(8).default(4),
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
  onboardingGoal: z.string().trim().min(1).max(80).optional(),
  topicInterests: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
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

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

app.patch("/api/v1/profile", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const input = validate(profileFieldsSchema, request.body);
  await withTransaction(async (client) => {
    await saveProfileFields(client, request.actor.account.id, input);
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id)
       VALUES ($1, $2::uuid, 'profile.draft_updated', 'profile', ($2::uuid)::text)`,
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
         account_id, actor_account_id, document_key, document_version, context, request_id, metadata
       ) VALUES ($1, $1, 'platform_terms', $2, 'signup', $3, $4::jsonb)
       ON CONFLICT (account_id, document_key, document_version, context) DO NOTHING`,
      [request.actor.account.id, expectedConsentVersion, request.requestId, JSON.stringify({ role: input.role })],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, 'onboarding.completed', 'account', ($2::uuid)::text, $3::jsonb)`,
      [request.requestId, request.actor.account.id, JSON.stringify({
        role: input.role,
        consentVersion: expectedConsentVersion,
        onboardingGoal: input.onboardingGoal ?? null,
        topicInterests: input.topicInterests ?? [],
      })],
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

app.get("/api/v1/profiles", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const input = validate(profileSearchQuerySchema, request.query);
  if (request.actor.account.status !== "active" || request.actor.profile.onboardingStatus !== "complete") {
    throw new ApiError(403, "ACCOUNT_NOT_READY", "Complete account setup before searching profiles.");
  }

  const escapedQuery = escapeLikePattern(input.q);
  const containsQuery = `%${escapedQuery}%`;
  const prefixQuery = `${escapedQuery}%`;
  const result = await database.query(
    `SELECT
       p.account_id,
       a.primary_role,
       p.display_name,
       p.headline,
       p.location_text,
       p.availability_status,
       p.updated_at,
       COALESCE(
         jsonb_agg(
           jsonb_build_object('code', t.code, 'name', t.name, 'primary', pt.is_primary)
           ORDER BY pt.is_primary DESC, t.sort_order, t.code
         ) FILTER (WHERE t.code IS NOT NULL),
         '[]'::jsonb
       ) AS trades
     FROM profiles p
     INNER JOIN accounts a ON a.id = p.account_id
     LEFT JOIN profile_trades pt ON pt.account_id = p.account_id
     LEFT JOIN trades t ON t.code = pt.trade_code AND t.active = true
     WHERE p.visibility = 'network'
       AND p.onboarding_status = 'complete'
       AND a.status = 'active'
       AND a.primary_role IN ('contractor', 'tradesperson')
       AND p.account_id <> $1::uuid
       AND NOT EXISTS (
         SELECT 1 FROM account_blocks ab
         WHERE (ab.blocker_account_id = $1::uuid AND ab.blocked_account_id = p.account_id)
            OR (ab.blocked_account_id = $1::uuid AND ab.blocker_account_id = p.account_id)
       )
       AND (
         p.display_name ILIKE $2 ESCAPE '\\'
         OR p.headline ILIKE $2 ESCAPE '\\'
         OR p.location_text ILIKE $2 ESCAPE '\\'
         OR EXISTS (
           SELECT 1
           FROM profile_trades search_pt
           INNER JOIN trades search_t ON search_t.code = search_pt.trade_code AND search_t.active = true
           WHERE search_pt.account_id = p.account_id
             AND (search_t.name ILIKE $2 ESCAPE '\\' OR search_t.code ILIKE $2 ESCAPE '\\')
         )
       )
     GROUP BY p.account_id, a.primary_role, p.display_name, p.headline, p.location_text, p.availability_status, p.updated_at
     ORDER BY
       CASE WHEN p.display_name ILIKE $3 ESCAPE '\\' THEN 0 ELSE 1 END,
       p.updated_at DESC,
       p.account_id
     LIMIT $4`,
    [request.actor.account.id, containsQuery, prefixQuery, input.limit],
  );

  const profiles = result.rows.map((row) => ({
    accountId: row.account_id,
    displayName: row.display_name,
    headline: row.headline,
    locationText: row.location_text,
    primaryRole: row.primary_role,
    availabilityStatus: row.availability_status,
    trades: Array.isArray(row.trades) ? row.trades : [],
  }));

  response.json({ data: { profiles }, meta: { requestId: request.requestId, count: profiles.length } });
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

function requireContractorActor(actor) {
  if (actor.account.status !== "active" || actor.profile.onboardingStatus !== "complete") {
    throw new ApiError(403, "ACCOUNT_NOT_READY", "Complete account setup before managing jobs.");
  }
  if (actor.account.primaryRole !== "contractor") {
    throw new ApiError(403, "CONTRACTOR_REQUIRED", "Only contractor accounts can manage jobs.");
  }
}

function requireIdempotencyKey(request) {
  const value = String(request.headers["idempotency-key"] ?? "").trim();
  if (value.length < 8 || value.length > 200) {
    throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Use a valid Idempotency-Key for this request.");
  }
  return value;
}

async function runIdempotentMutation(request, accountId, scope, action) {
  const rawKey = requireIdempotencyKey(request);
  const keyHash = sha256(`${scope}:${rawKey}`);
  const requestHash = sha256(JSON.stringify(request.body ?? {}));

  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO idempotency_keys (
         account_id, scope, key_hash, request_hash, state, locked_until, expires_at
       ) VALUES ($1, $2, $3, $4, 'started', now() + interval '30 seconds', now() + interval '24 hours')
       ON CONFLICT (account_id, scope, key_hash) DO NOTHING
       RETURNING id`,
      [accountId, scope, keyHash, requestHash],
    );

    let recordId = inserted.rows[0]?.id;
    if (!recordId) {
      const existing = await client.query(
        `SELECT id, request_hash, state, response_status, response_body, locked_until
         FROM idempotency_keys
         WHERE account_id = $1 AND scope = $2 AND key_hash = $3
         FOR UPDATE`,
        [accountId, scope, keyHash],
      );
      const record = existing.rows[0];
      if (!record || record.request_hash !== requestHash) {
        throw new ApiError(409, "IDEMPOTENCY_KEY_CONFLICT", "That request key was already used for different data.");
      }
      if (record.state === "completed") {
        return { status: record.response_status, body: record.response_body, replayed: true };
      }
      if (record.locked_until && new Date(record.locked_until).getTime() > Date.now()) {
        throw new ApiError(409, "REQUEST_IN_PROGRESS", "That request is already in progress.");
      }
      recordId = record.id;
      await client.query(
        "UPDATE idempotency_keys SET state = 'started', locked_until = now() + interval '30 seconds', updated_at = now() WHERE id = $1",
        [recordId],
      );
    }

    const result = await action(client);
    await client.query(
      `UPDATE idempotency_keys
       SET state = 'completed', response_status = $2, response_body = $3::jsonb,
           locked_until = NULL, updated_at = now()
       WHERE id = $1`,
      [recordId, result.status, JSON.stringify(result.body)],
    );
    return { ...result, replayed: false };
  });
}

function sendIdempotentResult(response, result) {
  if (result.replayed) response.setHeader("Idempotent-Replayed", "true");
  response.status(result.status).json(result.body);
}

async function replaceJobRequirements(client, jobId, input) {
  const requirementFields = [
    ["tools", "tool"],
    ["materials", "material"],
    ["deliverables", "deliverable"],
    ["certificationCodes", "certification"],
  ];
  for (const [field, kind] of requirementFields) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    await client.query("DELETE FROM job_requirements WHERE job_id = $1 AND kind = $2", [jobId, kind]);
    for (const [index, value] of input[field].entries()) {
      await client.query(
        "INSERT INTO job_requirements (job_id, kind, value, sort_order) VALUES ($1, $2, $3, $4)",
        [jobId, kind, value, index],
      );
    }
  }
}

async function loadJobRequirements(client, jobIds) {
  if (!jobIds.length) return new Map();
  const result = await client.query(
    `SELECT job_id, kind, value, sort_order
     FROM job_requirements
     WHERE job_id = ANY($1::uuid[])
     ORDER BY job_id, kind, sort_order, id`,
    [jobIds],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    const current = grouped.get(row.job_id) ?? [];
    current.push(row);
    grouped.set(row.job_id, current);
  }
  return grouped;
}

async function loadJobEvents(client, jobId) {
  const result = await client.query(
    `SELECT id, event_type, from_status, to_status, reason, occurred_at
     FROM job_status_events WHERE job_id = $1
     ORDER BY occurred_at DESC, id DESC`,
    [jobId],
  );
  return result.rows;
}

async function loadOwnedJobForUpdate(client, actor, jobId) {
  const result = await client.query(`${jobSelectSql({ includePrivateLocation: true })} WHERE j.id = $1 FOR UPDATE OF j`, [jobId]);
  if (!result.rowCount) throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
  const job = result.rows[0];
  requireOrganizationRole(actor, job.organization_id, ["owner", "admin"]);
  return job;
}

function assertExpectedJobVersion(job, expectedVersion) {
  if (job.version !== expectedVersion) {
    throw new ApiError(409, "JOB_VERSION_CONFLICT", "This job changed on another device. Refresh and try again.", {
      currentVersion: job.version,
    });
  }
}

async function mapJobDetail(client, row, actor, includePrivateLocation) {
  const requirements = await loadJobRequirements(client, [row.id]);
  const events = includePrivateLocation ? await loadJobEvents(client, row.id) : [];
  return mapJobRecord(row, {
    actor,
    includePrivateLocation,
    requirements: requirements.get(row.id) ?? [],
    events,
  });
}

const applicationSelectBase = `
  SELECT ja.*, j.title AS job_title, j.status AS job_status, j.organization_id,
         o.name AS organization_name, pl.city AS public_city, pl.region AS public_region,
         pl.country_code AS public_country_code,
         p.account_id AS applicant_account_id, p.display_name AS applicant_display_name,
         p.headline AS applicant_headline, p.service_area_city AS applicant_service_area_city,
         p.service_area_region AS applicant_service_area_region
  FROM job_applications ja
  INNER JOIN jobs j ON j.id = ja.job_id
  INNER JOIN organizations o ON o.id = j.organization_id
  INNER JOIN job_public_locations pl ON pl.job_id = j.id
  INNER JOIN profiles p ON p.account_id = ja.applicant_account_id`;

const offerSelectBase = `
  SELECT jo.*, j.title AS job_title, j.status AS job_status, j.organization_id,
         o.name AS organization_name, pl.city AS public_city, pl.region AS public_region,
         pl.country_code AS public_country_code,
         p.account_id AS recipient_account_id, p.display_name AS recipient_display_name,
         p.headline AS recipient_headline, p.service_area_city AS recipient_service_area_city,
         p.service_area_region AS recipient_service_area_region
  FROM job_offers jo
  INNER JOIN jobs j ON j.id = jo.job_id
  INNER JOIN organizations o ON o.id = j.organization_id
  INNER JOIN job_public_locations pl ON pl.job_id = j.id
  INNER JOIN profiles p ON p.account_id = jo.recipient_account_id`;

const activeWorkSelectBase = `
  SELECT aw.*, j.title AS job_title, j.status AS job_status,
         o.name AS organization_name, pl.city AS public_city, pl.region AS public_region,
         pl.country_code AS public_country_code
  FROM active_work aw
  INNER JOIN jobs j ON j.id = aw.job_id
  INNER JOIN organizations o ON o.id = aw.organization_id
  INNER JOIN job_public_locations pl ON pl.job_id = j.id`;

async function loadApplicationEvents(client, applicationId) {
  const result = await client.query(
    `SELECT id, event_type, from_status, to_status, reason, occurred_at
     FROM job_application_events
     WHERE application_id = $1
     ORDER BY occurred_at DESC, id DESC`,
    [applicationId],
  );
  return result.rows;
}

async function loadOfferEvents(client, offerId) {
  const result = await client.query(
    `SELECT id, event_type, from_status, to_status, reason, occurred_at
     FROM job_offer_events
     WHERE offer_id = $1
     ORDER BY occurred_at DESC, id DESC`,
    [offerId],
  );
  return result.rows;
}

async function loadWorkEvents(client, activeWorkId) {
  const result = await client.query(
    `SELECT id, event_type, from_status, to_status, reason, occurred_at
     FROM work_status_events
     WHERE active_work_id = $1
     ORDER BY occurred_at DESC, id DESC`,
    [activeWorkId],
  );
  return result.rows;
}

async function assertNoAccountBlock(client, leftAccountId, rightAccountId) {
  if (await accountsAreBlocked(client, leftAccountId, rightAccountId)) {
    throw new ApiError(403, "ACCOUNT_BLOCKED", "These accounts cannot interact.");
  }
}

async function accountsAreBlocked(client, leftAccountId, rightAccountId) {
  const result = await client.query(
    `SELECT 1 FROM account_blocks
     WHERE (blocker_account_id = $1 AND blocked_account_id = $2)
        OR (blocker_account_id = $2 AND blocked_account_id = $1)
     LIMIT 1`,
    [leftAccountId, rightAccountId],
  );
  return result.rowCount > 0;
}

async function canViewPrivateJobLocation(client, jobId, actor) {
  const result = await client.query(
    `SELECT 1
     FROM active_work aw
     INNER JOIN work_participants wp ON wp.active_work_id = aw.id
     WHERE aw.job_id = $1 AND wp.account_id = $2 AND aw.status IN ('active', 'completed')
     LIMIT 1`,
    [jobId, actor.account.id],
  );
  return result.rowCount > 0;
}

function applicationLifecycleEvent(status) {
  return status === "shortlisted" ? "shortlisted" : status === "declined" ? "declined" : status;
}

async function loadApplicationById(client, applicationId, { forUpdate = false } = {}) {
  const result = await client.query(
    `${applicationSelectBase} WHERE ja.id = $1 ${forUpdate ? "FOR UPDATE OF ja" : ""}`,
    [applicationId],
  );
  if (!result.rowCount) throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application not found.");
  return result.rows[0];
}

async function loadOfferById(client, offerId, { forUpdate = false } = {}) {
  const result = await client.query(
    `${offerSelectBase} WHERE jo.id = $1 ${forUpdate ? "FOR UPDATE OF jo" : ""}`,
    [offerId],
  );
  if (!result.rowCount) throw new ApiError(404, "OFFER_NOT_FOUND", "Offer not found.");
  return result.rows[0];
}

async function loadActiveWorkById(client, activeWorkId, actor, { forUpdate = false } = {}) {
  const result = await client.query(
    `${activeWorkSelectBase}
     INNER JOIN work_participants wp ON wp.active_work_id = aw.id
     WHERE aw.id = $1 AND wp.account_id = $2
     ${forUpdate ? "FOR UPDATE OF aw" : ""}`,
    [activeWorkId, actor.account.id],
  );
  if (!result.rowCount) throw new ApiError(404, "ACTIVE_WORK_NOT_FOUND", "Active work not found.");
  return result.rows[0];
}

function requireApplicationContractorAccess(actor, application) {
  requireContractorActor(actor);
  requireOrganizationRole(actor, application.organization_id, ["owner", "admin"]);
}

async function mappedApplicationWithEvents(client, row) {
  return mapApplication(row, { events: await loadApplicationEvents(client, row.id) });
}

async function mappedOfferWithEvents(client, row) {
  return mapOffer(row, { events: await loadOfferEvents(client, row.id) });
}

async function mappedActiveWorkWithEvents(client, row) {
  return mapActiveWork(row, { events: await loadWorkEvents(client, row.id) });
}

const conversationSelectBase = `
  SELECT c.*, aw.status AS active_work_status, j.title AS job_title, j.status AS job_status,
         o.name AS organization_name, pl.city AS public_city, pl.region AS public_region,
         pl.country_code AS public_country_code
  FROM conversations c
  INNER JOIN active_work aw ON aw.id = c.active_work_id
  INNER JOIN jobs j ON j.id = c.job_id
  INNER JOIN organizations o ON o.id = c.organization_id
  INNER JOIN job_public_locations pl ON pl.job_id = j.id`;

const messageSelectBase = `
  SELECT cm.*, p.display_name AS sender_display_name, p.headline AS sender_headline
  FROM conversation_messages cm
  INNER JOIN profiles p ON p.account_id = cm.sender_account_id`;

async function loadConversationParticipants(client, conversationIds) {
  if (!conversationIds.length) return new Map();
  const result = await client.query(
    `SELECT cp.*, p.display_name, p.headline, p.service_area_city, p.service_area_region
     FROM conversation_participants cp
     INNER JOIN profiles p ON p.account_id = cp.account_id
     WHERE cp.conversation_id = ANY($1::uuid[])
     ORDER BY cp.conversation_id, cp.participant_role, p.display_name`,
    [conversationIds],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    const list = grouped.get(row.conversation_id) ?? [];
    list.push(row);
    grouped.set(row.conversation_id, list);
  }
  return grouped;
}

async function loadLastMessages(client, conversationIds) {
  if (!conversationIds.length) return new Map();
  const result = await client.query(
    `SELECT DISTINCT ON (cm.conversation_id)
       cm.*, p.display_name AS sender_display_name, p.headline AS sender_headline
     FROM conversation_messages cm
     INNER JOIN profiles p ON p.account_id = cm.sender_account_id
     WHERE cm.conversation_id = ANY($1::uuid[]) AND cm.deleted_at IS NULL
     ORDER BY cm.conversation_id, cm.created_at DESC, cm.id DESC`,
    [conversationIds],
  );
  return new Map(result.rows.map((row) => [row.conversation_id, row]));
}

async function loadUnreadMessageCounts(client, conversationIds, accountId) {
  if (!conversationIds.length) return new Map();
  const result = await client.query(
    `SELECT cm.conversation_id, count(*)::int AS count
     FROM message_receipts mr
     INNER JOIN conversation_messages cm ON cm.id = mr.message_id
     WHERE cm.conversation_id = ANY($1::uuid[])
       AND mr.account_id = $2
       AND mr.read_at IS NULL
       AND cm.sender_account_id <> $2
       AND cm.deleted_at IS NULL
     GROUP BY cm.conversation_id`,
    [conversationIds, accountId],
  );
  return new Map(result.rows.map((row) => [row.conversation_id, row.count]));
}

async function mapConversationsForActor(client, rows, actor) {
  const conversationIds = rows.map((row) => row.id);
  const [participants, lastMessages, unreadCounts] = await Promise.all([
    loadConversationParticipants(client, conversationIds),
    loadLastMessages(client, conversationIds),
    loadUnreadMessageCounts(client, conversationIds, actor.account.id),
  ]);
  return rows.map((row) => mapConversation(row, {
    participants: participants.get(row.id) ?? [],
    lastMessage: lastMessages.get(row.id) ?? null,
    unreadCount: unreadCounts.get(row.id) ?? 0,
  }));
}

async function loadConversationById(client, conversationId, actor, { forUpdate = false } = {}) {
  const result = await client.query(
    `${conversationSelectBase}
     INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.id = $1 AND cp.account_id = $2
     ${forUpdate ? "FOR UPDATE OF c" : ""}`,
    [conversationId, actor.account.id],
  );
  if (!result.rowCount) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  return result.rows[0];
}

async function loadConversationParticipantRows(client, conversationId, { forUpdate = false } = {}) {
  const result = await client.query(
    `SELECT cp.*, p.display_name, p.headline, p.service_area_city, p.service_area_region
     FROM conversation_participants cp
     INNER JOIN profiles p ON p.account_id = cp.account_id
     WHERE cp.conversation_id = $1
     ORDER BY cp.participant_role, p.display_name
     ${forUpdate ? "FOR UPDATE OF cp" : ""}`,
    [conversationId],
  );
  return result.rows;
}

async function ensureConversationForActiveWork(client, activeWorkId, actor) {
  const activeWork = await loadActiveWorkById(client, activeWorkId, actor);
  const existing = await client.query(
    `${conversationSelectBase}
     INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.active_work_id = $1 AND cp.account_id = $2`,
    [activeWorkId, actor.account.id],
  );
  if (existing.rowCount) return existing.rows[0];

  const inserted = await client.query(
    `INSERT INTO conversations (
       active_work_id, job_id, organization_id, created_by_account_id
     ) VALUES ($1, $2, $3, $4)
     ON CONFLICT (active_work_id) DO NOTHING
     RETURNING id`,
    [activeWorkId, activeWork.job_id, activeWork.organization_id, actor.account.id],
  );
  const conversationId = inserted.rows[0]?.id
    ?? (await client.query("SELECT id FROM conversations WHERE active_work_id = $1", [activeWorkId])).rows[0]?.id;
  if (!conversationId) throw new ApiError(500, "CONVERSATION_CREATE_FAILED", "Conversation could not be opened.");

  await client.query(
    `INSERT INTO conversation_participants (conversation_id, account_id, participant_role)
     SELECT $1, account_id, participant_role
     FROM work_participants
     WHERE active_work_id = $2
     ON CONFLICT DO NOTHING`,
    [conversationId, activeWorkId],
  );
  return loadConversationById(client, conversationId, actor);
}

const projectSelectBase = `
  SELECT pr.*, aw.status AS active_work_status, j.title AS job_title, j.status AS job_status,
         pl.city AS public_city, pl.region AS public_region, pl.country_code AS public_country_code
  FROM projects pr
  INNER JOIN active_work aw ON aw.id = pr.active_work_id
  INNER JOIN jobs j ON j.id = pr.job_id
  INNER JOIN job_public_locations pl ON pl.job_id = j.id`;

async function loadProjectById(client, projectId, actor, { forUpdate = false } = {}) {
  const result = await client.query(
    `${projectSelectBase}
     INNER JOIN work_participants wp ON wp.active_work_id = pr.active_work_id
     WHERE pr.id = $1 AND wp.account_id = $2
     ${forUpdate ? "FOR UPDATE OF pr" : ""}`,
    [projectId, actor.account.id],
  );
  if (!result.rowCount) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project record not found.");
  return result.rows[0];
}

async function loadProjectByActiveWorkId(client, activeWorkId, actor) {
  const result = await client.query(
    `${projectSelectBase}
     INNER JOIN work_participants wp ON wp.active_work_id = pr.active_work_id
     WHERE pr.active_work_id = $1 AND wp.account_id = $2`,
    [activeWorkId, actor.account.id],
  );
  if (!result.rowCount) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project record not found.");
  return result.rows[0];
}

async function ensureProjectForActiveWork(client, activeWorkId, actor) {
  const activeWork = await loadActiveWorkById(client, activeWorkId, actor);
  if (activeWork.status === "cancelled") {
    throw new ApiError(409, "ACTIVE_WORK_CANCELLED", "Cancelled work cannot start a new project record.");
  }

  const inserted = await client.query(
    `INSERT INTO projects (
       active_work_id, job_id, organization_id, contractor_account_id, tradesperson_account_id, created_by_account_id
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (active_work_id) DO NOTHING
     RETURNING id`,
    [
      activeWorkId,
      activeWork.job_id,
      activeWork.organization_id,
      activeWork.contractor_account_id,
      activeWork.tradesperson_account_id,
      actor.account.id,
    ],
  );
  const projectId = inserted.rows[0]?.id
    ?? (await client.query("SELECT id FROM projects WHERE active_work_id = $1", [activeWorkId])).rows[0]?.id;
  if (!projectId) throw new ApiError(500, "PROJECT_CREATE_FAILED", "Project record could not be opened.");

  if (inserted.rowCount) {
    await client.query(
      `INSERT INTO project_entries (project_id, active_work_id, actor_account_id, entry_type, body, metadata)
       VALUES ($1, $2, $3, 'system', 'Project record opened.', $4::jsonb)`,
      [projectId, activeWorkId, actor.account.id, JSON.stringify({ source: "active_work" })],
    );
  }

  return loadProjectById(client, projectId, actor);
}

async function loadProjectBundle(client, project, actor) {
  const [entries, media, submissions, resolutions] = await Promise.all([
    client.query(
      `SELECT * FROM project_entries
       WHERE project_id = $1
       ORDER BY created_at ASC, id ASC`,
      [project.id],
    ),
    client.query(
      `SELECT * FROM project_media
       WHERE project_id = $1
       ORDER BY created_at ASC, id ASC`,
      [project.id],
    ),
    client.query(
      `SELECT * FROM project_completion_submissions
       WHERE project_id = $1
       ORDER BY submitted_at ASC, id ASC`,
      [project.id],
    ),
    client.query(
      `SELECT * FROM project_completion_resolutions
       WHERE project_id = $1
       ORDER BY created_at ASC, id ASC`,
      [project.id],
    ),
  ]);
  const resolutionMap = new Map();
  for (const resolution of resolutions.rows) {
    const list = resolutionMap.get(resolution.submission_id) ?? [];
    list.push(resolution);
    resolutionMap.set(resolution.submission_id, list);
  }
  const submissionsWithResolutions = submissions.rows.map((submission) => ({
    ...submission,
    resolutions: resolutionMap.get(submission.id) ?? [],
  }));
  return mapProject(project, {
    entries: entries.rows,
    media: media.rows,
    submissions: submissionsWithResolutions,
    actor,
  });
}

async function loadProjectMediaById(client, projectId, mediaId, actor) {
  await loadProjectById(client, projectId, actor);
  const result = await client.query(
    `SELECT pm.*, u.object_key, u.upload_status
     FROM project_media pm
     INNER JOIN uploads u ON u.id = pm.upload_id
     WHERE pm.project_id = $1 AND pm.id = $2`,
    [projectId, mediaId],
  );
  if (!result.rowCount || result.rows[0].status !== "stored" || !result.rows[0].object_key) {
    throw new ApiError(404, "PROJECT_MEDIA_NOT_FOUND", "Project media was not found.");
  }
  return result.rows[0];
}

async function loadCompletionSubmission(client, projectId, submissionId, { forUpdate = false } = {}) {
  const result = await client.query(
    `SELECT * FROM project_completion_submissions
     WHERE project_id = $1 AND id = $2
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [projectId, submissionId],
  );
  if (!result.rowCount) throw new ApiError(404, "COMPLETION_NOT_FOUND", "Completion submission not found.");
  return result.rows[0];
}

function requireProjectTradesperson(actor, project) {
  requireTradespersonActor(actor);
  if (project.tradesperson_account_id !== actor.account.id) {
    throw new ApiError(403, "PROJECT_ROLE_MISMATCH", "Only the assigned tradesperson can submit completion.");
  }
}

function requireProjectContractor(actor, project) {
  requireContractorActor(actor);
  if (project.contractor_account_id !== actor.account.id) {
    throw new ApiError(403, "PROJECT_ROLE_MISMATCH", "Only the hiring contractor can resolve completion.");
  }
}

async function createInAppNotification(client, {
  accountId,
  type,
  title,
  body = "",
  actionHref = "",
  sourceType = "",
  sourceId = null,
  priority = "normal",
  metadata = {},
}) {
  const preference = await client.query(
    `SELECT enabled FROM notification_preferences
     WHERE account_id = $1 AND notification_type = $2 AND channel = 'in_app'`,
    [accountId, type === "message" ? "messages" : type === "work" ? "work_updates" : "system"],
  );
  if (preference.rowCount && preference.rows[0].enabled === false) return null;
  const inserted = await client.query(
    `INSERT INTO in_app_notifications (
       account_id, type, title, body, action_href, source_type, source_id, priority, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING *`,
    [accountId, type, title, body, actionHref, sourceType, sourceId, priority, JSON.stringify(metadata)],
  );
  return inserted.rows[0];
}

async function notifyConversationParticipants(client, conversation, participants, senderAccountId, messageId, messageBody) {
  const sender = participants.find((participant) => participant.account_id === senderAccountId);
  const now = Date.now();
  const preview = messageBody.length > 140 ? `${messageBody.slice(0, 137)}...` : messageBody;
  const actionHref = `/app/messages?conversation=${conversation.id}`;
  for (const participant of participants) {
    if (participant.account_id === senderAccountId) continue;
    if (participant.muted_until && new Date(participant.muted_until).getTime() > now) continue;
    await createInAppNotification(client, {
      accountId: participant.account_id,
      type: "message",
      title: `${sender?.display_name || "RIVT member"} sent a message`,
      body: `${conversation.job_title} - ${conversation.public_city}, ${conversation.public_region}: ${preview}`,
      actionHref,
      sourceType: "message",
      sourceId: messageId,
      priority: "normal",
      metadata: {
        conversationId: conversation.id,
        jobId: conversation.job_id,
        publicLocation: `${conversation.public_city}, ${conversation.public_region}`,
      },
    });
  }
}

async function assertConversationParticipantsCanInteract(client, participants) {
  for (let index = 0; index < participants.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < participants.length; otherIndex += 1) {
      await assertNoAccountBlock(client, participants[index].account_id, participants[otherIndex].account_id);
    }
  }
}

async function assertSharedConversation(client, actorAccountId, targetAccountId) {
  const result = await client.query(
    `SELECT 1
     FROM conversation_participants actor_cp
     INNER JOIN conversation_participants target_cp
       ON target_cp.conversation_id = actor_cp.conversation_id
     WHERE actor_cp.account_id = $1 AND target_cp.account_id = $2
     LIMIT 1`,
    [actorAccountId, targetAccountId],
  );
  if (!result.rowCount) throw new ApiError(403, "ACCOUNT_RELATIONSHIP_REQUIRED", "You can only take this action for a connected work contact.");
}

async function hasSharedActiveWork(client, actorAccountId, targetAccountId) {
  const result = await client.query(
    `SELECT 1
     FROM work_participants actor_wp
     INNER JOIN work_participants target_wp
       ON target_wp.active_work_id = actor_wp.active_work_id
     WHERE actor_wp.account_id = $1 AND target_wp.account_id = $2
     LIMIT 1`,
    [actorAccountId, targetAccountId],
  );
  return result.rowCount > 0;
}

async function assertConnectedAccount(client, actorAccountId, targetAccountId) {
  const conversation = await client.query(
    `SELECT 1
     FROM conversation_participants actor_cp
     INNER JOIN conversation_participants target_cp
       ON target_cp.conversation_id = actor_cp.conversation_id
     WHERE actor_cp.account_id = $1 AND target_cp.account_id = $2
     LIMIT 1`,
    [actorAccountId, targetAccountId],
  );
  if (conversation.rowCount || await hasSharedActiveWork(client, actorAccountId, targetAccountId)) return;
  throw new ApiError(403, "ACCOUNT_RELATIONSHIP_REQUIRED", "You can only take this action for a connected work contact.");
}

const reviewSelectBase = `
  SELECT wr.*, j.title AS job_title, pl.city AS public_city, pl.region AS public_region,
         reviewer.display_name AS reviewer_display_name,
         reviewer.headline AS reviewer_headline,
         reviewer.service_area_city AS reviewer_service_area_city,
         reviewer.service_area_region AS reviewer_service_area_region,
         reviewee.display_name AS reviewee_display_name,
         reviewee.headline AS reviewee_headline,
         reviewee.service_area_city AS reviewee_service_area_city,
         reviewee.service_area_region AS reviewee_service_area_region
  FROM work_reviews wr
  INNER JOIN jobs j ON j.id = wr.job_id
  INNER JOIN job_public_locations pl ON pl.job_id = j.id
  INNER JOIN profiles reviewer ON reviewer.account_id = wr.reviewer_account_id
  INNER JOIN profiles reviewee ON reviewee.account_id = wr.reviewee_account_id`;

async function loadReviewEvents(client, reviewIds) {
  if (!reviewIds.length) return new Map();
  const result = await client.query(
    `SELECT * FROM review_events
     WHERE review_id = ANY($1::uuid[])
     ORDER BY occurred_at ASC, id ASC`,
    [reviewIds],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    const list = grouped.get(row.review_id) ?? [];
    list.push(row);
    grouped.set(row.review_id, list);
  }
  return grouped;
}

async function loadReviewById(client, reviewId, { forUpdate = false } = {}) {
  const result = await client.query(
    `${reviewSelectBase}
     WHERE wr.id = $1
     ${forUpdate ? "FOR UPDATE OF wr" : ""}`,
    [reviewId],
  );
  if (!result.rowCount) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
  return result.rows[0];
}

async function mapReviewRows(client, rows) {
  const events = await loadReviewEvents(client, rows.map((row) => row.id));
  return rows.map((row) => mapReview(row, { events: events.get(row.id) ?? [] }));
}

async function insertAdminAction(client, actorAccountId, {
  action,
  subjectType,
  subjectId,
  reasonCode,
  reason,
  metadata = {},
}) {
  const inserted = await client.query(
    `INSERT INTO admin_action_events (
       actor_account_id, action, subject_type, subject_id, reason_code, reason, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [actorAccountId, action, subjectType, subjectId, reasonCode, reason, JSON.stringify(metadata)],
  );
  return inserted.rows[0];
}

const adminSupportCasesSelect = `
  SELECT sc.*,
         opened_account.primary_role AS opened_by_primary_role,
         opened_account.status AS opened_by_status,
         opened_profile.display_name AS opened_by_display_name,
         opened_identity.email AS opened_by_email
  FROM support_cases sc
  JOIN accounts opened_account ON opened_account.id = sc.opened_by_account_id
  LEFT JOIN profiles opened_profile ON opened_profile.account_id = opened_account.id
  LEFT JOIN LATERAL (
    SELECT email
    FROM auth_identities
    WHERE account_id = opened_account.id AND email IS NOT NULL AND email <> ''
    ORDER BY CASE WHEN provider = 'email' THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
  ) opened_identity ON true
`;

async function loadSupportCaseEvents(client, supportCaseIds, { includeInternal = false } = {}) {
  if (!supportCaseIds.length) return new Map();
  const result = await client.query(
    `SELECT * FROM support_case_events
     WHERE support_case_id = ANY($1::uuid[])
       ${includeInternal ? "" : "AND visibility = 'user'"}
     ORDER BY occurred_at ASC, id ASC`,
    [supportCaseIds],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    const list = grouped.get(row.support_case_id) ?? [];
    list.push(row);
    grouped.set(row.support_case_id, list);
  }
  return grouped;
}

async function mapSupportCaseRows(client, rows, options = {}) {
  const events = await loadSupportCaseEvents(client, rows.map((row) => row.id), options);
  return rows.map((row) => mapSupportCase(row, { events: events.get(row.id) ?? [] }));
}

async function loadRestrictionEvents(client, restrictionIds) {
  if (!restrictionIds.length) return new Map();
  const result = await client.query(
    `SELECT * FROM account_restriction_events
     WHERE restriction_id = ANY($1::uuid[])
     ORDER BY occurred_at ASC, id ASC`,
    [restrictionIds],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    const list = grouped.get(row.restriction_id) ?? [];
    list.push(row);
    grouped.set(row.restriction_id, list);
  }
  return grouped;
}

async function mapRestrictionRows(client, rows) {
  const events = await loadRestrictionEvents(client, rows.map((row) => row.id));
  return rows.map((row) => mapRestriction(row, { events: events.get(row.id) ?? [] }));
}

async function validateReviewConsent(input) {
  const expectedConsentVersion = envValue("SIGNUP_CONSENT_VERSION", "2026-06-19");
  if (input.consentVersion !== expectedConsentVersion) {
    throw new ApiError(409, "CONSENT_VERSION_OUTDATED", "Review the latest RIVT terms before continuing.", {
      expectedConsentVersion,
    });
  }
}

async function authorizeSafetyReportSubject(client, actor, input) {
  if (input.subjectType === "account") {
    const targetAccountId = validate(z.uuid(), input.subjectId);
    if (targetAccountId === actor.account.id) throw new ApiError(422, "REPORT_TARGET_INVALID", "Report a different account.");
    if (input.reportedAccountId && input.reportedAccountId !== targetAccountId) {
      throw new ApiError(422, "REPORT_TARGET_INVALID", "Reported account must match the account subject.");
    }
    await assertConnectedAccount(client, actor.account.id, targetAccountId);
    return { reportedAccountId: targetAccountId };
  }

  if (input.subjectType === "job") {
    const jobId = validate(z.uuid(), input.subjectId);
    const job = (await client.query(`${jobSelectSql()} WHERE j.id = $1`, [jobId])).rows[0];
    if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
    const ownsJob = actor.memberships.some((membership) => (
      membership.organizationId === job.organization_id && ["owner", "admin"].includes(membership.role)
    ));
    if (!ownsJob && (actor.account.primaryRole !== "tradesperson" || job.status !== "open")) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
    }
    return { reportedAccountId: input.reportedAccountId ?? job.created_by_account_id };
  }

  if (input.subjectType === "conversation") {
    const conversationId = validate(z.uuid(), input.subjectId);
    await loadConversationById(client, conversationId, actor);
    if (input.reportedAccountId) {
      const participant = await client.query(
        "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND account_id = $2",
        [conversationId, input.reportedAccountId],
      );
      if (!participant.rowCount || input.reportedAccountId === actor.account.id) {
        throw new ApiError(422, "REPORT_TARGET_INVALID", "Report a different participant in this conversation.");
      }
    }
    return { reportedAccountId: input.reportedAccountId };
  }

  if (input.subjectType === "message") {
    const messageId = validate(z.uuid(), input.subjectId);
    const message = await client.query(
      `SELECT cm.sender_account_id, cm.conversation_id
       FROM conversation_messages cm
       WHERE cm.id = $1 AND cm.deleted_at IS NULL`,
      [messageId],
    );
    if (!message.rowCount) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    await loadConversationById(client, message.rows[0].conversation_id, actor);
    const reportedAccountId = input.reportedAccountId ?? message.rows[0].sender_account_id;
    if (reportedAccountId === actor.account.id) throw new ApiError(422, "REPORT_TARGET_INVALID", "Report a different account.");
    return { reportedAccountId };
  }

  if (input.subjectType === "active_work") {
    const activeWorkId = validate(z.uuid(), input.subjectId);
    const activeWork = await loadActiveWorkById(client, activeWorkId, actor);
    return {
      reportedAccountId: input.reportedAccountId
        ?? (activeWork.contractor_account_id === actor.account.id ? activeWork.tradesperson_account_id : activeWork.contractor_account_id),
    };
  }

  if (input.subjectType === "project") {
    const projectId = validate(z.uuid(), input.subjectId);
    const project = await loadProjectById(client, projectId, actor);
    return {
      reportedAccountId: input.reportedAccountId
        ?? (project.contractor_account_id === actor.account.id ? project.tradesperson_account_id : project.contractor_account_id),
    };
  }

  return { reportedAccountId: input.reportedAccountId };
}

app.get("/api/v1/reviews", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const rows = await database.query(
    `${reviewSelectBase}
     WHERE wr.reviewer_account_id = $1 OR wr.reviewee_account_id = $1
     ORDER BY wr.submitted_at DESC, wr.id DESC
     LIMIT 100`,
    [request.actor.account.id],
  );
  response.json({
    data: { reviews: await mapReviewRows(database, rows.rows) },
    meta: { requestId: request.requestId },
  });
}));

app.get("/api/v1/accounts/:id/reputation", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const accountId = validate(z.uuid(), request.params.id);
  if (accountId !== request.actor.account.id && await accountsAreBlocked(database, request.actor.account.id, accountId)) {
    throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
  }
  const result = await database.query(
    `SELECT p.account_id, p.display_name, p.headline, p.service_area_city, p.service_area_region,
            COALESCE(review_stats.published_count, 0) AS published_count,
            review_stats.average_rating,
            COALESCE(review_stats.pending_count, 0) AS pending_count,
            COALESCE(review_stats.disputed_count, 0) AS disputed_count
     FROM profiles p
     LEFT JOIN LATERAL (
       SELECT
         count(*) FILTER (WHERE status IN ('approved', 'resolved'))::int AS published_count,
         avg(rating) FILTER (WHERE status IN ('approved', 'resolved')) AS average_rating,
         count(*) FILTER (WHERE status = 'pending_approval')::int AS pending_count,
         count(*) FILTER (WHERE status = 'disputed')::int AS disputed_count
       FROM work_reviews
       WHERE reviewee_account_id = p.account_id
     ) review_stats ON true
     WHERE p.account_id = $1`,
    [accountId],
  );
  if (!result.rowCount) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
  response.json({ data: { reputation: mapReputation(result.rows[0]) }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/active-work/:id/reviews", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const activeWorkId = validate(z.uuid(), request.params.id);
  const input = validate(reviewSubmitSchema, request.body);
  await validateReviewConsent(input);
  const result = await runIdempotentMutation(request, request.actor.account.id, `reviews.submit:${activeWorkId}`, async (client) => {
    const activeWork = await loadActiveWorkById(client, activeWorkId, request.actor, { forUpdate: true });
    if (activeWork.status !== "completed") {
      throw new ApiError(409, "REVIEW_NOT_ELIGIBLE", "Reviews unlock after the work is completed.");
    }
    const reviewerRole = activeWork.contractor_account_id === request.actor.account.id ? "contractor" : "tradesperson";
    const expectedReviewee = reviewerRole === "contractor" ? activeWork.tradesperson_account_id : activeWork.contractor_account_id;
    if (input.revieweeAccountId !== expectedReviewee) {
      throw new ApiError(422, "REVIEWEE_INVALID", "Review the other participant on this completed work.");
    }
    await assertNoAccountBlock(client, request.actor.account.id, input.revieweeAccountId);
    const project = await client.query("SELECT id FROM projects WHERE active_work_id = $1 LIMIT 1", [activeWorkId]);
    await client.query(
      `INSERT INTO consent_acceptances (account_id, actor_account_id, document_key, document_version, context, request_id, metadata)
       VALUES ($1, $1, 'platform_terms', $2, 'review_submission', $3, $4::jsonb)
       ON CONFLICT DO NOTHING`,
      [request.actor.account.id, input.consentVersion, request.requestId, JSON.stringify({ activeWorkId, revieweeAccountId: input.revieweeAccountId })],
    );
    const inserted = await client.query(
      `INSERT INTO work_reviews (
         active_work_id, project_id, job_id, organization_id, reviewer_account_id,
         reviewee_account_id, reviewer_role, rating, body
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (active_work_id, reviewer_account_id, reviewee_account_id) DO NOTHING
       RETURNING id`,
      [
        activeWorkId,
        project.rows[0]?.id ?? null,
        activeWork.job_id,
        activeWork.organization_id,
        request.actor.account.id,
        input.revieweeAccountId,
        reviewerRole,
        input.rating,
        input.body,
      ],
    );
    if (!inserted.rowCount) {
      throw new ApiError(409, "REVIEW_ALREADY_EXISTS", "You already reviewed this participant for this work.");
    }
    const reviewId = inserted.rows[0].id;
    await client.query(
      "INSERT INTO review_events (review_id, actor_account_id, event_type, note) VALUES ($1, $2, 'submitted', $3)",
      [reviewId, request.actor.account.id, input.body],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'review.submitted', 'review', ($4::uuid)::text, $5::jsonb)`,
      [request.requestId, request.actor.account.id, activeWork.organization_id, reviewId,
        JSON.stringify({ activeWorkId, revieweeAccountId: input.revieweeAccountId })],
    );
    await createInAppNotification(client, {
      accountId: input.revieweeAccountId,
      type: "work",
      title: "Review pending approval",
      body: `${activeWork.job_title} - ${activeWork.public_city}, ${activeWork.public_region}`,
      actionHref: "/app/profile",
      sourceType: "review",
      sourceId: reviewId,
      priority: "normal",
      metadata: { activeWorkId },
    });
    const [review] = await mapReviewRows(client, [await loadReviewById(client, reviewId)]);
    return { status: 201, body: { data: { review }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/reviews/:id/approve", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const reviewId = validate(z.uuid(), request.params.id);
  const result = await runIdempotentMutation(request, request.actor.account.id, `reviews.approve:${reviewId}`, async (client) => {
    const review = await loadReviewById(client, reviewId, { forUpdate: true });
    if (review.reviewee_account_id !== request.actor.account.id) {
      throw new ApiError(403, "REVIEW_APPROVAL_FORBIDDEN", "Only the reviewed participant can approve this review.");
    }
    if (review.status !== "pending_approval") {
      throw new ApiError(409, "REVIEW_NOT_PENDING", "Only pending reviews can be approved.");
    }
    await client.query("UPDATE work_reviews SET status = 'approved', approved_at = now(), updated_at = now() WHERE id = $1", [reviewId]);
    await client.query("INSERT INTO review_events (review_id, actor_account_id, event_type) VALUES ($1, $2, 'approved')", [reviewId, request.actor.account.id]);
    await createInAppNotification(client, {
      accountId: review.reviewer_account_id,
      type: "work",
      title: "Review approved",
      body: `${review.job_title} - ${review.public_city}, ${review.public_region}`,
      actionHref: "/app/profile",
      sourceType: "review",
      sourceId: reviewId,
      priority: "normal",
      metadata: { activeWorkId: review.active_work_id },
    });
    const [mapped] = await mapReviewRows(client, [await loadReviewById(client, reviewId)]);
    return { status: 200, body: { data: { review: mapped }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/reviews/:id/dispute", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const reviewId = validate(z.uuid(), request.params.id);
  const input = validate(reviewDisputeSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `reviews.dispute:${reviewId}`, async (client) => {
    const review = await loadReviewById(client, reviewId, { forUpdate: true });
    if (review.reviewee_account_id !== request.actor.account.id) {
      throw new ApiError(403, "REVIEW_DISPUTE_FORBIDDEN", "Only the reviewed participant can dispute this review.");
    }
    if (review.status !== "pending_approval") {
      throw new ApiError(409, "REVIEW_NOT_PENDING", "Only pending reviews can be disputed.");
    }
    await client.query("UPDATE work_reviews SET status = 'disputed', disputed_at = now(), updated_at = now() WHERE id = $1", [reviewId]);
    await client.query(
      "INSERT INTO review_events (review_id, actor_account_id, event_type, note) VALUES ($1, $2, 'disputed', $3)",
      [reviewId, request.actor.account.id, input.reason],
    );
    await createInAppNotification(client, {
      accountId: review.reviewer_account_id,
      type: "work",
      title: "Review disputed",
      body: `${review.job_title} - ${review.public_city}, ${review.public_region}`,
      actionHref: "/app/profile",
      sourceType: "review",
      sourceId: reviewId,
      priority: "normal",
      metadata: { activeWorkId: review.active_work_id },
    });
    const [mapped] = await mapReviewRows(client, [await loadReviewById(client, reviewId)]);
    return { status: 200, body: { data: { review: mapped }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/reviews/:id/responses", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const reviewId = validate(z.uuid(), request.params.id);
  const input = validate(reviewResponseSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `reviews.response:${reviewId}`, async (client) => {
    const review = await loadReviewById(client, reviewId, { forUpdate: true });
    if (![review.reviewer_account_id, review.reviewee_account_id].includes(request.actor.account.id)) {
      throw new ApiError(403, "REVIEW_RESPONSE_FORBIDDEN", "Only review participants can respond.");
    }
    if (review.status === "hidden") throw new ApiError(409, "REVIEW_HIDDEN", "Hidden reviews cannot receive responses.");
    await client.query("UPDATE work_reviews SET updated_at = now() WHERE id = $1", [reviewId]);
    await client.query(
      "INSERT INTO review_events (review_id, actor_account_id, event_type, note) VALUES ($1, $2, 'response_added', $3)",
      [reviewId, request.actor.account.id, input.note],
    );
    const [mapped] = await mapReviewRows(client, [await loadReviewById(client, reviewId)]);
    return { status: 201, body: { data: { review: mapped }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/reports", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const input = validate(safetyReportSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `safety.report:${input.subjectType}:${input.subjectId}`, async (client) => {
    const { reportedAccountId } = await authorizeSafetyReportSubject(client, request.actor, input);
    const inserted = await client.query(
      `INSERT INTO safety_reports (
         reporter_account_id, reported_account_id, subject_type, subject_id, reason, note
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [request.actor.account.id, reportedAccountId, input.subjectType, input.subjectId, input.reason, input.note],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, 'safety.reported', 'safety_report', ($3::uuid)::text, $4::jsonb)`,
      [request.requestId, request.actor.account.id, inserted.rows[0].id,
        JSON.stringify({ subjectType: input.subjectType, subjectId: input.subjectId, reason: input.reason })],
    );
    return {
      status: 201,
      body: { data: { report: mapSafetyReport(inserted.rows[0]) }, meta: { requestId: request.requestId } },
    };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/active-work/:id/unsafe-reports", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const activeWorkId = validate(z.uuid(), request.params.id);
  const input = validate(unsafeWorkReportSchema, request.body);
  if (input.conditionType === "stop_work") {
    if (!input.consentAccepted || !input.consentVersion) {
      throw new ApiError(422, "STOP_WORK_CONSENT_REQUIRED", "Confirm the stop-work acknowledgement before submitting.");
    }
    await validateReviewConsent({ consentVersion: input.consentVersion });
  }
  const result = await runIdempotentMutation(request, request.actor.account.id, `unsafe-work.report:${activeWorkId}`, async (client) => {
    const activeWork = await loadActiveWorkById(client, activeWorkId, request.actor, { forUpdate: true });
    if (activeWork.status === "cancelled") {
      throw new ApiError(409, "ACTIVE_WORK_CANCELLED", "Cancelled work cannot receive new unsafe-work reports.");
    }
    const project = await client.query("SELECT id FROM projects WHERE active_work_id = $1 LIMIT 1", [activeWorkId]);
    if (input.conditionType === "stop_work") {
      await client.query(
        `INSERT INTO consent_acceptances (account_id, actor_account_id, document_key, document_version, context, request_id, metadata)
         VALUES ($1, $1, 'platform_terms', $2, 'stop_work', $3, $4::jsonb)
         ON CONFLICT DO NOTHING`,
        [request.actor.account.id, input.consentVersion, request.requestId, JSON.stringify({ activeWorkId })],
      );
    }
    const inserted = await client.query(
      `INSERT INTO unsafe_work_reports (
         active_work_id, project_id, reporter_account_id, condition_type, severity, description
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [activeWorkId, project.rows[0]?.id ?? null, request.actor.account.id, input.conditionType, input.severity, input.description],
    );
    await client.query(
      "INSERT INTO unsafe_work_report_events (unsafe_report_id, actor_account_id, event_type, note) VALUES ($1, $2, 'opened', $3)",
      [inserted.rows[0].id, request.actor.account.id, input.description],
    );
    const recipientAccountId = activeWork.contractor_account_id === request.actor.account.id
      ? activeWork.tradesperson_account_id
      : activeWork.contractor_account_id;
    await createInAppNotification(client, {
      accountId: recipientAccountId,
      type: "work",
      title: input.conditionType === "stop_work" ? "Stop-work report opened" : "Unsafe-work report opened",
      body: `${activeWork.job_title} - ${activeWork.public_city}, ${activeWork.public_region}`,
      actionHref: "/app/messages",
      sourceType: "unsafe_work_report",
      sourceId: inserted.rows[0].id,
      priority: input.severity === "urgent" || input.conditionType === "stop_work" ? "high" : "normal",
      metadata: { activeWorkId, conditionType: input.conditionType },
    });
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'unsafe_work.reported', 'unsafe_work_report', ($4::uuid)::text, $5::jsonb)`,
      [request.requestId, request.actor.account.id, activeWork.organization_id, inserted.rows[0].id,
        JSON.stringify({ activeWorkId, conditionType: input.conditionType, severity: input.severity })],
    );
    const events = await client.query("SELECT * FROM unsafe_work_report_events WHERE unsafe_report_id = $1 ORDER BY occurred_at ASC", [inserted.rows[0].id]);
    return {
      status: 201,
      body: { data: { unsafeReport: mapUnsafeWorkReport(inserted.rows[0], { events: events.rows }) }, meta: { requestId: request.requestId } },
    };
  });
  sendIdempotentResult(response, result);
}));

app.get("/api/v1/support/cases", requireV1AuthenticatedUser, requireV1SupportActor, asyncRoute(async (request, response) => {
  const rows = await database.query(
    `SELECT * FROM support_cases
     WHERE opened_by_account_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 100`,
    [request.actor.account.id],
  );
  response.json({
    data: { cases: await mapSupportCaseRows(database, rows.rows) },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/support/cases", requireV1AuthenticatedUser, requireV1SupportActor, baseWriteRateLimit, asyncRoute(async (request, response) => {
  const input = validate(supportCaseCreateSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, "support.cases.create", async (client) => {
    if (input.subjectAccountId && input.subjectAccountId !== request.actor.account.id) {
      await assertConnectedAccount(client, request.actor.account.id, input.subjectAccountId);
    }
    if (input.activeWorkId) await loadActiveWorkById(client, input.activeWorkId, request.actor);
    if (input.projectId) await loadProjectById(client, input.projectId, request.actor);
    const inserted = await client.query(
      `INSERT INTO support_cases (
         opened_by_account_id, subject_account_id, active_work_id, project_id, category, title, description
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        request.actor.account.id,
        input.subjectAccountId,
        input.activeWorkId,
        input.projectId,
        input.category,
        input.title,
        input.description,
      ],
    );
    await client.query(
      "INSERT INTO support_case_events (support_case_id, actor_account_id, event_type, visibility, note) VALUES ($1, $2, 'opened', 'user', $3)",
      [inserted.rows[0].id, request.actor.account.id, input.description],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, 'support_case.opened', 'support_case', ($3::uuid)::text, $4::jsonb)`,
      [request.requestId, request.actor.account.id, inserted.rows[0].id, JSON.stringify({ category: input.category })],
    );
    const [supportCase] = await mapSupportCaseRows(client, [inserted.rows[0]]);
    return { status: 201, body: { data: { case: supportCase }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/support/cases/:id/events", requireV1AuthenticatedUser, requireV1SupportActor, baseWriteRateLimit, asyncRoute(async (request, response) => {
  const supportCaseId = validate(z.uuid(), request.params.id);
  const input = validate(supportCaseEventSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `support.cases.event:${supportCaseId}`, async (client) => {
    const supportCase = await client.query("SELECT * FROM support_cases WHERE id = $1 AND opened_by_account_id = $2 FOR UPDATE", [supportCaseId, request.actor.account.id]);
    if (!supportCase.rowCount) throw new ApiError(404, "SUPPORT_CASE_NOT_FOUND", "Support case not found.");
    if (["resolved", "closed"].includes(supportCase.rows[0].status)) {
      throw new ApiError(409, "SUPPORT_CASE_CLOSED", "Closed support cases cannot receive user notes.");
    }
    await client.query(
      "INSERT INTO support_case_events (support_case_id, actor_account_id, event_type, visibility, note) VALUES ($1, $2, 'user_note', 'user', $3)",
      [supportCaseId, request.actor.account.id, input.note],
    );
    await client.query("UPDATE support_cases SET status = 'reviewing', updated_at = now() WHERE id = $1 AND status = 'open'", [supportCaseId]);
    const updated = (await client.query("SELECT * FROM support_cases WHERE id = $1", [supportCaseId])).rows[0];
    const [mapped] = await mapSupportCaseRows(client, [updated]);
    return { status: 201, body: { data: { case: mapped }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.get("/api/v1/admin/overview", requireV1AuthenticatedUser, requireV1AdminActor, asyncRoute(async (request, response) => {
  requireAdminRole(request.admin, ["owner", "support", "moderator"]);
  const [reviews, reports, unsafeReports, supportCases, restrictions] = await Promise.all([
    database.query(`${reviewSelectBase} WHERE wr.status = 'disputed' ORDER BY wr.disputed_at DESC NULLS LAST, wr.submitted_at DESC LIMIT 25`),
    database.query("SELECT * FROM safety_reports WHERE status IN ('open', 'reviewing') ORDER BY created_at DESC, id DESC LIMIT 25"),
    database.query("SELECT * FROM unsafe_work_reports WHERE status IN ('open', 'acknowledged') ORDER BY created_at DESC, id DESC LIMIT 25"),
    database.query(`${adminSupportCasesSelect} WHERE sc.status IN ('open', 'reviewing') ORDER BY sc.created_at DESC, sc.id DESC LIMIT 25`),
    database.query("SELECT * FROM account_restrictions WHERE status = 'active' AND (ends_at IS NULL OR ends_at > now()) ORDER BY created_at DESC, id DESC LIMIT 25"),
  ]);
  response.json({
    data: {
      reviews: await mapReviewRows(database, reviews.rows),
      reports: reports.rows.map(mapSafetyReport),
      unsafeReports: unsafeReports.rows.map((row) => mapUnsafeWorkReport(row)),
      supportCases: await mapSupportCaseRows(database, supportCases.rows, { includeInternal: true }),
      restrictions: await mapRestrictionRows(database, restrictions.rows),
    },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/admin/reviews/:id/resolve", requireV1AuthenticatedUser, requireV1AdminActor, writeRateLimit, asyncRoute(async (request, response) => {
  requireAdminRole(request.admin, ["owner", "support", "moderator"]);
  const reviewId = validate(z.uuid(), request.params.id);
  const input = validate(adminReviewResolveSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `admin.reviews.resolve:${reviewId}`, async (client) => {
    const review = await loadReviewById(client, reviewId, { forUpdate: true });
    if (review.status === input.status) {
      const [mapped] = await mapReviewRows(client, [review]);
      return { status: 200, body: { data: { review: mapped }, meta: { requestId: request.requestId } } };
    }
    await client.query(
      `UPDATE work_reviews
       SET status = $2,
           resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE resolved_at END,
           updated_at = now()
       WHERE id = $1`,
      [reviewId, input.status],
    );
    await client.query(
      "INSERT INTO review_events (review_id, actor_account_id, event_type, note, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)",
      [reviewId, request.actor.account.id, input.status, input.reason, JSON.stringify({ reasonCode: input.reasonCode })],
    );
    await insertAdminAction(client, request.actor.account.id, {
      action: `review.${input.status}`,
      subjectType: "review",
      subjectId: reviewId,
      reasonCode: input.reasonCode,
      reason: input.reason,
      metadata: { previousStatus: review.status },
    });
    const [mapped] = await mapReviewRows(client, [await loadReviewById(client, reviewId)]);
    return { status: 200, body: { data: { review: mapped }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/admin/support-cases/:id/events", requireV1AuthenticatedUser, requireV1AdminActor, writeRateLimit, asyncRoute(async (request, response) => {
  requireAdminRole(request.admin, ["owner", "support"]);
  const supportCaseId = validate(z.uuid(), request.params.id);
  const input = validate(adminSupportCaseEventSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `admin.support.event:${supportCaseId}`, async (client) => {
    const supportCase = await client.query("SELECT * FROM support_cases WHERE id = $1 FOR UPDATE", [supportCaseId]);
    if (!supportCase.rowCount) throw new ApiError(404, "SUPPORT_CASE_NOT_FOUND", "Support case not found.");
    if (input.status) {
      await client.query("UPDATE support_cases SET status = $2, updated_at = now() WHERE id = $1", [supportCaseId, input.status]);
    }
    await client.query(
      `INSERT INTO support_case_events (
         support_case_id, actor_account_id, event_type, visibility, note, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [supportCaseId, request.actor.account.id, input.eventType, input.visibility, input.note, JSON.stringify({ reasonCode: input.reasonCode })],
    );
    await insertAdminAction(client, request.actor.account.id, {
      action: "support_case.event_added",
      subjectType: "support_case",
      subjectId: supportCaseId,
      reasonCode: input.reasonCode,
      reason: input.reason,
      metadata: { eventType: input.eventType, status: input.status ?? null, visibility: input.visibility },
    });
    const updated = await client.query(`${adminSupportCasesSelect} WHERE sc.id = $1`, [supportCaseId]);
    const [mapped] = await mapSupportCaseRows(client, updated.rows, { includeInternal: true });
    return { status: 201, body: { data: { case: mapped }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/admin/support-cases/:id/account-type", requireV1AuthenticatedUser, requireV1AdminActor, writeRateLimit, asyncRoute(async (request, response) => {
  requireAdminRole(request.admin, ["owner", "support"]);
  const supportCaseId = validate(z.uuid(), request.params.id);
  const input = validate(adminAccountTypeChangeSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `admin.support.account-type:${supportCaseId}:${input.targetRole}`, async (client) => {
    const supportCaseResult = await client.query("SELECT * FROM support_cases WHERE id = $1 FOR UPDATE", [supportCaseId]);
    if (!supportCaseResult.rowCount) throw new ApiError(404, "SUPPORT_CASE_NOT_FOUND", "Support case not found.");
    const supportCase = supportCaseResult.rows[0];
    if (supportCase.category !== "account") {
      throw new ApiError(422, "SUPPORT_CASE_NOT_ACCOUNT", "Account type changes require an account support case.");
    }
    if (["resolved", "closed"].includes(supportCase.status)) {
      throw new ApiError(409, "SUPPORT_CASE_CLOSED", "Closed support cases cannot change account type.");
    }

    const targetAccountId = supportCase.subject_account_id ?? supportCase.opened_by_account_id;
    if (targetAccountId === request.actor.account.id) {
      throw new ApiError(422, "ACCOUNT_TYPE_SELF_CHANGE_DENIED", "Staff cannot approve their own account type change.");
    }

    const targetResult = await client.query(
      `SELECT a.id, a.status, a.primary_role, p.display_name, opened_identity.email
       FROM accounts a
       LEFT JOIN profiles p ON p.account_id = a.id
       LEFT JOIN LATERAL (
         SELECT email
         FROM auth_identities
         WHERE account_id = a.id AND email IS NOT NULL AND email <> ''
         ORDER BY CASE WHEN provider = 'email' THEN 0 ELSE 1 END, created_at ASC
         LIMIT 1
       ) opened_identity ON true
       WHERE a.id = $1
       FOR UPDATE OF a`,
      [targetAccountId],
    );
    if (!targetResult.rowCount) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
    const targetAccount = targetResult.rows[0];
    if (targetAccount.status === "closed") {
      throw new ApiError(422, "ACCOUNT_CLOSED", "Closed accounts cannot change account type.");
    }

    const previousRole = targetAccount.primary_role;
    let organizationId = null;
    let organizationName = "";
    if (input.targetRole === "contractor") {
      const existingOrganization = await client.query(
        `SELECT o.id, o.name
         FROM organization_memberships m
         JOIN organizations o ON o.id = m.organization_id
         WHERE m.account_id = $1
           AND m.status = 'active'
           AND m.membership_role = 'owner'
           AND o.status = 'active'
         ORDER BY o.created_at ASC
         LIMIT 1
         FOR UPDATE OF o`,
        [targetAccountId],
      );
      organizationName = input.organizationName?.trim() || existingOrganization.rows[0]?.name || "";
      if (!organizationName) {
        throw new ApiError(422, "ORGANIZATION_NAME_REQUIRED", "Approving contractor access requires a business or crew name.");
      }
      if (existingOrganization.rowCount) {
        organizationId = existingOrganization.rows[0].id;
        if (input.organizationName?.trim()) {
          await client.query("UPDATE organizations SET name = $2, updated_at = now() WHERE id = $1", [organizationId, organizationName]);
        }
      } else {
        const createdOrganization = await client.query(
          "INSERT INTO organizations (name, created_by_account_id) VALUES ($1, $2) RETURNING id",
          [organizationName, targetAccountId],
        );
        organizationId = createdOrganization.rows[0].id;
        await client.query(
          `INSERT INTO organization_memberships (organization_id, account_id, membership_role, status)
           VALUES ($1, $2, 'owner', 'active')`,
          [organizationId, targetAccountId],
        );
      }
    }

    await client.query(
      `UPDATE accounts
       SET primary_role = $2,
           status = CASE WHEN status = 'onboarding' THEN 'active' ELSE status END,
           updated_at = now()
       WHERE id = $1`,
      [targetAccountId, input.targetRole],
    );
    await client.query(
      `UPDATE auth_users
       SET role = $2,
           organization = CASE WHEN $2 = 'contractor' THEN $3 ELSE '' END,
           updated_at = now()
       WHERE id = $1`,
      [targetAccountId, input.targetRole, organizationName],
    );
    await client.query(
      `UPDATE support_cases
       SET status = 'resolved',
           subject_account_id = COALESCE(subject_account_id, opened_by_account_id),
           updated_at = now()
       WHERE id = $1`,
      [supportCaseId],
    );
    await client.query(
      `INSERT INTO support_case_events (
         support_case_id, actor_account_id, event_type, visibility, note, metadata
       ) VALUES ($1, $2, 'status_changed', 'user', $3, $4::jsonb)`,
      [
        supportCaseId,
        request.actor.account.id,
        `Support approved account type change to ${input.targetRole === "contractor" ? "Contractor" : "Tradesperson"}.`,
        JSON.stringify({ previousRole, targetRole: input.targetRole, organizationId, organizationName }),
      ],
    );
    await insertAdminAction(client, request.actor.account.id, {
      action: "account.primary_role_changed",
      subjectType: "account",
      subjectId: targetAccountId,
      reasonCode: input.reasonCode,
      reason: input.reason,
      metadata: {
        supportCaseId,
        previousRole,
        targetRole: input.targetRole,
        organizationId,
      },
    });

    const updatedCase = await client.query(`${adminSupportCasesSelect} WHERE sc.id = $1`, [supportCaseId]);
    const [mapped] = await mapSupportCaseRows(client, updatedCase.rows, { includeInternal: true });
    return { status: 200, body: { data: { case: mapped }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/admin/accounts/:id/restrictions", requireV1AuthenticatedUser, requireV1AdminActor, writeRateLimit, asyncRoute(async (request, response) => {
  requireAdminRole(request.admin, ["owner", "support"]);
  const accountId = validate(z.uuid(), request.params.id);
  const input = validate(restrictionCreateSchema, request.body);
  if (accountId === request.actor.account.id) throw new ApiError(422, "RESTRICTION_TARGET_INVALID", "Admins cannot restrict their own account.");
  const result = await runIdempotentMutation(request, request.actor.account.id, `admin.restrictions.create:${accountId}`, async (client) => {
    const target = await client.query("SELECT id, status FROM accounts WHERE id = $1 FOR UPDATE", [accountId]);
    if (!target.rowCount) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
    const inserted = await client.query(
      `INSERT INTO account_restrictions (
         account_id, imposed_by_account_id, restriction_type, reason_code, reason, ends_at
       ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, CASE WHEN $3 = 'timeout_24h' THEN now() + interval '24 hours' ELSE NULL END))
       RETURNING *`,
      [accountId, request.actor.account.id, input.restrictionType, input.reasonCode, input.reason, input.endsAt],
    );
    await client.query(
      `INSERT INTO account_restriction_events (
         restriction_id, actor_account_id, event_type, reason_code, reason
       ) VALUES ($1, $2, 'imposed', $3, $4)`,
      [inserted.rows[0].id, request.actor.account.id, input.reasonCode, input.reason],
    );
    if (["suspension", "ban"].includes(input.restrictionType)) {
      await client.query("UPDATE accounts SET status = 'suspended', updated_at = now() WHERE id = $1 AND status <> 'closed'", [accountId]);
    }
    await insertAdminAction(client, request.actor.account.id, {
      action: "account.restriction.imposed",
      subjectType: "account",
      subjectId: accountId,
      reasonCode: input.reasonCode,
      reason: input.reason,
      metadata: { restrictionId: inserted.rows[0].id, restrictionType: input.restrictionType },
    });
    const [restriction] = await mapRestrictionRows(client, [inserted.rows[0]]);
    return { status: 201, body: { data: { restriction }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/admin/restrictions/:id/lift", requireV1AuthenticatedUser, requireV1AdminActor, writeRateLimit, asyncRoute(async (request, response) => {
  requireAdminRole(request.admin, ["owner", "support"]);
  const restrictionId = validate(z.uuid(), request.params.id);
  const input = validate(restrictionLiftSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `admin.restrictions.lift:${restrictionId}`, async (client) => {
    const existing = await client.query("SELECT * FROM account_restrictions WHERE id = $1 FOR UPDATE", [restrictionId]);
    if (!existing.rowCount) throw new ApiError(404, "RESTRICTION_NOT_FOUND", "Restriction not found.");
    const restriction = existing.rows[0];
    if (restriction.status === "active") {
      await client.query(
        "UPDATE account_restrictions SET status = 'lifted', lifted_at = now(), updated_at = now() WHERE id = $1",
        [restrictionId],
      );
      await client.query(
        `INSERT INTO account_restriction_events (
           restriction_id, actor_account_id, event_type, reason_code, reason
         ) VALUES ($1, $2, 'lifted', $3, $4)`,
        [restrictionId, request.actor.account.id, input.reasonCode, input.reason],
      );
      const stillSuspended = await client.query(
        `SELECT 1 FROM account_restrictions
         WHERE account_id = $1
           AND id <> $2
           AND status = 'active'
           AND restriction_type IN ('suspension', 'ban')
           AND (ends_at IS NULL OR ends_at > now())
         LIMIT 1`,
        [restriction.account_id, restrictionId],
      );
      if (!stillSuspended.rowCount) {
        await client.query("UPDATE accounts SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'suspended'", [restriction.account_id]);
      }
    }
    await insertAdminAction(client, request.actor.account.id, {
      action: "account.restriction.lifted",
      subjectType: "account_restriction",
      subjectId: restrictionId,
      reasonCode: input.reasonCode,
      reason: input.reason,
      metadata: { accountId: restriction.account_id },
    });
    const updated = (await client.query("SELECT * FROM account_restrictions WHERE id = $1", [restrictionId])).rows[0];
    const [mapped] = await mapRestrictionRows(client, [updated]);
    return { status: 200, body: { data: { restriction: mapped }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/jobs", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  requireContractorActor(request.actor);
  const input = validate(createJobSchema, request.body);
  requireOrganizationRole(request.actor, input.organizationId, ["owner", "admin"]);

  const result = await runIdempotentMutation(request, request.actor.account.id, "jobs.create", async (client) => {
    const recentDrafts = await client.query(
      "SELECT count(*)::int AS count FROM jobs WHERE created_by_account_id = $1 AND created_at > now() - interval '24 hours'",
      [request.actor.account.id],
    );
    const draftLimit = Number(process.env.JOB_DRAFT_DAILY_LIMIT ?? 30);
    if (recentDrafts.rows[0].count >= draftLimit) {
      throw new ApiError(429, "JOB_DRAFT_LIMIT_REACHED", "Daily job draft limit reached.", {
        limit: draftLimit,
        used: recentDrafts.rows[0].count,
      });
    }

    const trade = await client.query("SELECT code FROM trades WHERE code = $1 AND active = true", [input.tradeCode]);
    if (!trade.rowCount) throw new ApiError(422, "TRADE_INVALID", "The selected trade is unavailable.");

    const inserted = await client.query(
      `INSERT INTO jobs (
         organization_id, created_by_account_id, title, trade_code, summary,
         scope_description, difficulty, work_type, budget_cents, budget_unit,
         duration_hours, preferred_start_date, application_deadline, insurance_required
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [input.organizationId, request.actor.account.id, input.title, input.tradeCode, input.summary,
        input.scopeDescription, input.difficulty, input.workType, input.budgetCents, input.budgetUnit,
        input.durationHours, input.preferredStartDate, input.applicationDeadline, input.insuranceRequired],
    );
    const jobId = inserted.rows[0].id;
    await client.query(
      `INSERT INTO job_public_locations (job_id, city, region, country_code, postal_prefix)
       VALUES ($1, $2, $3, $4, $5)`,
      [jobId, input.publicLocation.city, input.publicLocation.region, input.publicLocation.countryCode, input.publicLocation.postalPrefix ?? null],
    );
    if (input.privateLocation) {
      await client.query(
        `INSERT INTO job_private_locations (
           job_id, address_line1, address_line2, city, region, postal_code, country_code, access_notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [jobId, input.privateLocation.addressLine1, input.privateLocation.addressLine2,
          input.privateLocation.city, input.privateLocation.region, input.privateLocation.postalCode,
          input.privateLocation.countryCode, input.privateLocation.accessNotes],
      );
    }
    await replaceJobRequirements(client, jobId, input);
    await client.query(
      `INSERT INTO job_status_events (job_id, actor_account_id, event_type, to_status)
       VALUES ($1, $2, 'draft_created', 'draft')`,
      [jobId, request.actor.account.id],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id)
       VALUES ($1, $2::uuid, $3::uuid, 'job.draft_created', 'job', ($4::uuid)::text)`,
      [request.requestId, request.actor.account.id, input.organizationId, jobId],
    );
    const row = (await client.query(`${jobSelectSql({ includePrivateLocation: true })} WHERE j.id = $1`, [jobId])).rows[0];
    const job = await mapJobDetail(client, row, request.actor, true);
    return { status: 201, body: { data: { job }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.get("/api/v1/jobs", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const input = validate(jobListQuerySchema, request.query);
  const conditions = [];
  const parameters = [];
  const addParameter = (value) => {
    parameters.push(value);
    return `$${parameters.length}`;
  };

  const sortColumn = request.actor.account.primaryRole === "contractor" ? "j.updated_at" : "j.published_at";
  if (request.actor.account.primaryRole === "contractor") {
    const organizationIds = request.actor.memberships
      .filter((membership) => ["owner", "admin"].includes(membership.role))
      .map((membership) => membership.organizationId);
    if (!organizationIds.length) {
      response.json({ data: { jobs: [] }, meta: { requestId: request.requestId, nextCursor: null } });
      return;
    }
    conditions.push(`j.organization_id = ANY(${addParameter(organizationIds)}::uuid[])`);
    if (input.status) conditions.push(`j.status = ${addParameter(input.status)}`);
  } else {
    if (request.actor.account.primaryRole !== "tradesperson" || request.actor.account.status !== "active") {
      throw new ApiError(403, "TRADESPERSON_REQUIRED", "Complete tradesperson setup before discovering work.");
    }
    conditions.push("j.status = 'open'");
    conditions.push("j.published_at IS NOT NULL");
    const actorAccountParameter = addParameter(request.actor.account.id);
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM account_blocks ab
      WHERE (ab.blocker_account_id = ${actorAccountParameter}::uuid AND ab.blocked_account_id = j.created_by_account_id)
         OR (ab.blocked_account_id = ${actorAccountParameter}::uuid AND ab.blocker_account_id = j.created_by_account_id)
    )`);
  }

  if (input.q) {
    const queryParameter = addParameter(`%${input.q}%`);
    conditions.push(`(j.title ILIKE ${queryParameter} OR j.summary ILIKE ${queryParameter} OR j.scope_description ILIKE ${queryParameter} OR o.name ILIKE ${queryParameter})`);
  }
  if (input.trade) conditions.push(`j.trade_code = ${addParameter(input.trade)}`);
  if (input.difficulty) conditions.push(`j.difficulty = ${addParameter(input.difficulty)}`);
  if (input.workType) conditions.push(`j.work_type = ${addParameter(input.workType)}`);
  if (input.city) conditions.push(`pl.city ILIKE ${addParameter(input.city)}`);
  if (input.region) conditions.push(`pl.region ILIKE ${addParameter(input.region)}`);
  if (input.insuranceRequired !== undefined) conditions.push(`j.insurance_required = ${addParameter(input.insuranceRequired)}`);
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    if (!cursor?.sort || !cursor?.id) throw new ApiError(422, "INVALID_CURSOR", "The pagination cursor is invalid.");
    conditions.push(`(${sortColumn}, j.id) < (${addParameter(cursor.sort)}::timestamptz, ${addParameter(cursor.id)}::uuid)`);
  }

  const rows = await database.query(
    `${jobSelectSql()} WHERE ${conditions.join(" AND ")}
     ORDER BY ${sortColumn} DESC, j.id DESC
     LIMIT ${addParameter(input.limit + 1)}`,
    parameters,
  );
  const hasMore = rows.rows.length > input.limit;
  const pageRows = rows.rows.slice(0, input.limit);
  const requirements = await loadJobRequirements(database, pageRows.map((job) => job.id));
  const jobs = pageRows.map((job) => mapJobRecord(job, {
    actor: request.actor,
    requirements: requirements.get(job.id) ?? [],
  }));
  const last = pageRows.at(-1);
  response.json({
    data: { jobs },
    meta: {
      requestId: request.requestId,
      nextCursor: hasMore && last ? encodeCursor({ sort: last[sortColumn === "j.updated_at" ? "updated_at" : "published_at"], id: last.id }) : null,
    },
  });
}));

app.get("/api/v1/jobs/:id", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const jobId = validate(z.uuid(), request.params.id);
  const publicResult = await database.query(`${jobSelectSql()} WHERE j.id = $1`, [jobId]);
  if (!publicResult.rowCount) throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
  let row = publicResult.rows[0];
  const ownsJob = request.actor.memberships.some((membership) => (
    membership.organizationId === row.organization_id && ["owner", "admin"].includes(membership.role)
  ));
  if (!ownsJob && await accountsAreBlocked(database, request.actor.account.id, row.created_by_account_id)) {
    throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
  }
  const activeParticipant = !ownsJob ? await canViewPrivateJobLocation(database, jobId, request.actor) : false;
  if (!ownsJob && !activeParticipant && (request.actor.account.primaryRole !== "tradesperson" || row.status !== "open")) {
    throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
  }
  if (ownsJob || activeParticipant) {
    row = (await database.query(`${jobSelectSql({ includePrivateLocation: true })} WHERE j.id = $1`, [jobId])).rows[0];
  }
  const job = await mapJobDetail(database, row, request.actor, ownsJob || activeParticipant);
  response.json({ data: { job }, meta: { requestId: request.requestId } });
}));

app.patch("/api/v1/jobs/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  requireContractorActor(request.actor);
  const jobId = validate(z.uuid(), request.params.id);
  const input = validate(updateJobSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `jobs.update:${jobId}`, async (client) => {
    const current = await loadOwnedJobForUpdate(client, request.actor, jobId);
    assertExpectedJobVersion(current, input.expectedVersion);
    if (current.status === "closed") throw new ApiError(409, "JOB_CLOSED", "Closed jobs cannot be edited.");
    if (input.tradeCode) {
      const trade = await client.query("SELECT code FROM trades WHERE code = $1 AND active = true", [input.tradeCode]);
      if (!trade.rowCount) throw new ApiError(422, "TRADE_INVALID", "The selected trade is unavailable.");
    }
    const has = (key) => Object.prototype.hasOwnProperty.call(input, key);
    const updated = await client.query(
      `UPDATE jobs SET
         title = $2, trade_code = $3, summary = $4, scope_description = $5,
         difficulty = $6, work_type = $7, budget_cents = $8, budget_unit = $9,
         duration_hours = $10, preferred_start_date = $11, application_deadline = $12,
         insurance_required = $13, version = version + 1, updated_at = now()
       WHERE id = $1 RETURNING version`,
      [jobId, input.title ?? current.title, input.tradeCode ?? current.trade_code,
        input.summary ?? current.summary, input.scopeDescription ?? current.scope_description,
        input.difficulty ?? current.difficulty, input.workType ?? current.work_type,
        has("budgetCents") ? input.budgetCents : current.budget_cents,
        input.budgetUnit ?? current.budget_unit,
        has("durationHours") ? input.durationHours : current.duration_hours,
        has("preferredStartDate") ? input.preferredStartDate : current.preferred_start_date,
        has("applicationDeadline") ? input.applicationDeadline : current.application_deadline,
        input.insuranceRequired ?? current.insurance_required],
    );
    if (input.publicLocation) {
      await client.query(
        `UPDATE job_public_locations SET city = $2, region = $3, country_code = $4,
           postal_prefix = $5, updated_at = now() WHERE job_id = $1`,
        [jobId, input.publicLocation.city, input.publicLocation.region,
          input.publicLocation.countryCode, input.publicLocation.postalPrefix ?? null],
      );
    }
    if (has("privateLocation")) {
      if (input.privateLocation === null) {
        await client.query("DELETE FROM job_private_locations WHERE job_id = $1", [jobId]);
      } else {
        await client.query(
          `INSERT INTO job_private_locations (
             job_id, address_line1, address_line2, city, region, postal_code, country_code, access_notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (job_id) DO UPDATE SET
             address_line1 = EXCLUDED.address_line1, address_line2 = EXCLUDED.address_line2,
             city = EXCLUDED.city, region = EXCLUDED.region, postal_code = EXCLUDED.postal_code,
             country_code = EXCLUDED.country_code, access_notes = EXCLUDED.access_notes, updated_at = now()`,
          [jobId, input.privateLocation.addressLine1, input.privateLocation.addressLine2,
            input.privateLocation.city, input.privateLocation.region, input.privateLocation.postalCode,
            input.privateLocation.countryCode, input.privateLocation.accessNotes],
        );
      }
    }
    await replaceJobRequirements(client, jobId, input);
    await client.query(
      `INSERT INTO job_status_events (job_id, actor_account_id, event_type, from_status, to_status)
       VALUES ($1, $2, 'draft_updated', $3, $3)`,
      [jobId, request.actor.account.id, current.status],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'job.updated', 'job', ($4::uuid)::text, $5::jsonb)`,
      [request.requestId, request.actor.account.id, current.organization_id, jobId,
        JSON.stringify({ version: updated.rows[0].version })],
    );
    const row = (await client.query(`${jobSelectSql({ includePrivateLocation: true })} WHERE j.id = $1`, [jobId])).rows[0];
    const job = await mapJobDetail(client, row, request.actor, true);
    return { status: 200, body: { data: { job }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

async function transitionJob(request, response, action) {
  requireContractorActor(request.actor);
  const jobId = validate(z.uuid(), request.params.id);
  const input = validate(action === "publish" ? publishJobSchema : transitionJobSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `jobs.${action}:${jobId}`, async (client) => {
    const current = await loadOwnedJobForUpdate(client, request.actor, jobId);
    assertExpectedJobVersion(current, input.expectedVersion);
    const nextStatus = transitionFor(current.status, action);
    if (action === "publish") {
      const expectedConsentVersion = envValue("SIGNUP_CONSENT_VERSION", "2026-06-19");
      if (input.consentVersion !== expectedConsentVersion) {
        throw new ApiError(409, "CONSENT_VERSION_CHANGED", "The consent agreement changed. Review the current version.");
      }
      assertPublishableJob(current);
      const publishedToday = await client.query(
        `SELECT count(*)::int AS count FROM job_status_events
         WHERE actor_account_id = $1 AND event_type = 'published' AND occurred_at > now() - interval '24 hours'`,
        [request.actor.account.id],
      );
      const publishLimit = Number(process.env.JOB_PUBLISH_DAILY_LIMIT ?? 10);
      if (publishedToday.rows[0].count >= publishLimit) {
        throw new ApiError(429, "JOB_PUBLISH_LIMIT_REACHED", "Daily job publishing limit reached.", {
          limit: publishLimit,
          used: publishedToday.rows[0].count,
        });
      }
      await client.query(
        `INSERT INTO consent_acceptances (account_id, actor_account_id, document_key, document_version, context, request_id, metadata)
         VALUES ($1, $1, 'platform_terms', $2, 'job_post', $3, $4::jsonb)
         ON CONFLICT (account_id, document_key, document_version, context) DO NOTHING`,
        [request.actor.account.id, expectedConsentVersion, request.requestId, JSON.stringify({ jobId })],
      );
    }

    const eventType = action === "publish" ? "published" : action === "resume" ? "resumed" : `${action}d`;
    await client.query(
      `UPDATE jobs SET status = $2, version = version + 1, updated_at = now(),
         published_at = CASE WHEN $2 = 'open' THEN COALESCE(published_at, now()) ELSE published_at END,
         paused_at = CASE WHEN $2 = 'paused' THEN now() WHEN $2 = 'open' THEN NULL ELSE paused_at END,
         closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE closed_at END
       WHERE id = $1`,
      [jobId, nextStatus],
    );
    await client.query(
      `INSERT INTO job_status_events (job_id, actor_account_id, event_type, from_status, to_status, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [jobId, request.actor.account.id, eventType, current.status, nextStatus, input.reason ?? ""],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, $4, 'job', ($5::uuid)::text, $6::jsonb)`,
      [request.requestId, request.actor.account.id, current.organization_id, `job.${eventType}`, jobId,
        JSON.stringify({ fromStatus: current.status, toStatus: nextStatus })],
    );
    const row = (await client.query(`${jobSelectSql({ includePrivateLocation: true })} WHERE j.id = $1`, [jobId])).rows[0];
    const job = await mapJobDetail(client, row, request.actor, true);
    return { status: 200, body: { data: { job }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}

app.post("/api/v1/jobs/:id/publish", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute((request, response) => transitionJob(request, response, "publish")));
app.post("/api/v1/jobs/:id/pause", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute((request, response) => transitionJob(request, response, "pause")));
app.post("/api/v1/jobs/:id/resume", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute((request, response) => transitionJob(request, response, "resume")));
app.post("/api/v1/jobs/:id/close", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute((request, response) => transitionJob(request, response, "close")));

app.put("/api/v1/jobs/:id/application-draft", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  requireTradespersonActor(request.actor);
  const jobId = validate(z.uuid(), request.params.id);
  const input = validate(applicationDraftSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `applications.draft:${jobId}`, async (client) => {
    const job = (await client.query("SELECT id, status, created_by_account_id FROM jobs WHERE id = $1", [jobId])).rows[0];
    if (!job || job.status !== "open") throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
    await assertNoAccountBlock(client, request.actor.account.id, job.created_by_account_id);
    const existing = await client.query(
      "SELECT id, status FROM job_applications WHERE job_id = $1 AND applicant_account_id = $2 FOR UPDATE",
      [jobId, request.actor.account.id],
    );
    if (existing.rowCount && existing.rows[0].status !== "draft") {
      throw new ApiError(409, "APPLICATION_ALREADY_SUBMITTED", "This application is already in the hiring flow.");
    }
    let applicationId = existing.rows[0]?.id;
    if (applicationId) {
      await client.query(
        `UPDATE job_applications
         SET message = $3, proposed_start_date = $4, updated_at = now()
         WHERE id = $1 AND applicant_account_id = $2`,
        [applicationId, request.actor.account.id, input.message, input.proposedStartDate],
      );
    } else {
      applicationId = (await client.query(
        `INSERT INTO job_applications (job_id, applicant_account_id, status, message, proposed_start_date)
         VALUES ($1, $2, 'draft', $3, $4)
         RETURNING id`,
        [jobId, request.actor.account.id, input.message, input.proposedStartDate],
      )).rows[0].id;
    }
    await client.query(
      `INSERT INTO job_application_events (application_id, actor_account_id, event_type, to_status)
       VALUES ($1, $2, 'draft_saved', 'draft')`,
      [applicationId, request.actor.account.id],
    );
    const row = await loadApplicationById(client, applicationId);
    return {
      status: existing.rowCount ? 200 : 201,
      body: { data: { application: await mappedApplicationWithEvents(client, row) }, meta: { requestId: request.requestId } },
    };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/jobs/:id/applications", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  requireTradespersonActor(request.actor);
  const jobId = validate(z.uuid(), request.params.id);
  const input = validate(applicationSubmitSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `applications.submit:${jobId}`, async (client) => {
    const job = (await client.query(
      `SELECT id, status, created_by_account_id, application_deadline
       FROM jobs WHERE id = $1 FOR UPDATE`,
      [jobId],
    )).rows[0];
    if (!job || job.status !== "open") throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
    if (job.application_deadline && new Date(job.application_deadline).getTime() <= Date.now()) {
      throw new ApiError(409, "APPLICATION_DEADLINE_PASSED", "This job is no longer accepting applications.");
    }
    await assertNoAccountBlock(client, request.actor.account.id, job.created_by_account_id);
    await client.query(
      `INSERT INTO consent_acceptances (account_id, actor_account_id, document_key, document_version, context, request_id, metadata)
       VALUES ($1, $1, 'platform_terms', $2, 'application', $3, $4::jsonb)
       ON CONFLICT (account_id, document_key, document_version, context) DO NOTHING`,
      [request.actor.account.id, input.consentVersion, request.requestId, JSON.stringify({ jobId })],
    );
    const existing = await client.query(
      "SELECT id, status FROM job_applications WHERE job_id = $1 AND applicant_account_id = $2 FOR UPDATE",
      [jobId, request.actor.account.id],
    );
    if (existing.rowCount && !["draft", "withdrawn"].includes(existing.rows[0].status)) {
      throw new ApiError(409, "APPLICATION_ALREADY_EXISTS", "You already have an active application for this job.");
    }
    const fromStatus = existing.rows[0]?.status ?? null;
    let applicationId = existing.rows[0]?.id;
    if (applicationId) {
      await client.query(
        `UPDATE job_applications
         SET status = 'submitted', message = $3, proposed_start_date = $4,
             submitted_at = now(), withdrawn_at = NULL, decided_at = NULL, updated_at = now()
         WHERE id = $1 AND applicant_account_id = $2`,
        [applicationId, request.actor.account.id, input.message, input.proposedStartDate],
      );
    } else {
      applicationId = (await client.query(
        `INSERT INTO job_applications (
           job_id, applicant_account_id, status, message, proposed_start_date, submitted_at
         ) VALUES ($1, $2, 'submitted', $3, $4, now())
         RETURNING id`,
        [jobId, request.actor.account.id, input.message, input.proposedStartDate],
      )).rows[0].id;
    }
    await client.query(
      `INSERT INTO job_application_events (
         application_id, actor_account_id, event_type, from_status, to_status
       ) VALUES ($1, $2, 'submitted', $3, 'submitted')`,
      [applicationId, request.actor.account.id, fromStatus],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, 'application.submitted', 'application', ($3::uuid)::text, $4::jsonb)`,
      [request.requestId, request.actor.account.id, applicationId, JSON.stringify({ jobId })],
    );
    const row = await loadApplicationById(client, applicationId);
    return {
      status: existing.rowCount ? 200 : 201,
      body: { data: { application: await mappedApplicationWithEvents(client, row) }, meta: { requestId: request.requestId } },
    };
  });
  sendIdempotentResult(response, result);
}));

app.get("/api/v1/applications", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  requireTradespersonActor(request.actor);
  const rows = await database.query(
    `${applicationSelectBase}
     WHERE ja.applicant_account_id = $1
     ORDER BY ja.updated_at DESC, ja.id DESC
     LIMIT 100`,
    [request.actor.account.id],
  );
  response.json({
    data: { applications: rows.rows.map((row) => mapApplication(row)) },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/applications/:id/withdraw", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  requireTradespersonActor(request.actor);
  const applicationId = validate(z.uuid(), request.params.id);
  const input = validate(applicationDecisionSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `applications.withdraw:${applicationId}`, async (client) => {
    const application = await loadApplicationById(client, applicationId, { forUpdate: true });
    if (application.applicant_account_id !== request.actor.account.id) {
      throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application not found.");
    }
    if (application.status === "withdrawn") {
      return {
        status: 200,
        body: { data: { application: await mappedApplicationWithEvents(client, application) }, meta: { requestId: request.requestId } },
      };
    }
    if (!["draft", "submitted", "shortlisted"].includes(application.status)) {
      throw new ApiError(409, "APPLICATION_CANNOT_WITHDRAW", "This application can no longer be withdrawn here.");
    }
    await client.query(
      `UPDATE job_applications
       SET status = 'withdrawn', withdrawn_at = now(), updated_at = now()
       WHERE id = $1`,
      [applicationId],
    );
    await client.query(
      `INSERT INTO job_application_events (
         application_id, actor_account_id, event_type, from_status, to_status, reason
       ) VALUES ($1, $2, 'withdrawn', $3, 'withdrawn', $4)`,
      [applicationId, request.actor.account.id, application.status, input.reason],
    );
    const row = await loadApplicationById(client, applicationId);
    return { status: 200, body: { data: { application: await mappedApplicationWithEvents(client, row) }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.get("/api/v1/jobs/:id/applications", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  requireContractorActor(request.actor);
  const jobId = validate(z.uuid(), request.params.id);
  const job = (await database.query("SELECT id, organization_id FROM jobs WHERE id = $1", [jobId])).rows[0];
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Job not found.");
  requireOrganizationRole(request.actor, job.organization_id, ["owner", "admin"]);
  const rows = await database.query(
    `${applicationSelectBase}
     WHERE ja.job_id = $1 AND ja.status <> 'draft'
     ORDER BY ja.submitted_at DESC NULLS LAST, ja.updated_at DESC, ja.id DESC`,
    [jobId],
  );
  response.json({
    data: { applications: rows.rows.map((row) => mapApplication(row)) },
    meta: { requestId: request.requestId },
  });
}));

async function decideApplication(request, response, nextStatus) {
  requireContractorActor(request.actor);
  const applicationId = validate(z.uuid(), request.params.id);
  const input = validate(applicationDecisionSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `applications.${nextStatus}:${applicationId}`, async (client) => {
    const application = await loadApplicationById(client, applicationId, { forUpdate: true });
    requireApplicationContractorAccess(request.actor, application);
    if (!["submitted", "shortlisted"].includes(application.status)) {
      throw new ApiError(409, "APPLICATION_STATE_INVALID", "That application is not ready for this decision.");
    }
    await client.query(
      `UPDATE job_applications
       SET status = $2, decided_at = now(), updated_at = now()
       WHERE id = $1`,
      [applicationId, nextStatus],
    );
    await client.query(
      `INSERT INTO job_application_events (
         application_id, actor_account_id, event_type, from_status, to_status, reason
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [applicationId, request.actor.account.id, applicationLifecycleEvent(nextStatus), application.status, nextStatus, input.reason],
    );
    const row = await loadApplicationById(client, applicationId);
    return { status: 200, body: { data: { application: await mappedApplicationWithEvents(client, row) }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}

app.post("/api/v1/applications/:id/shortlist", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute((request, response) => decideApplication(request, response, "shortlisted")));
app.post("/api/v1/applications/:id/decline", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute((request, response) => decideApplication(request, response, "declined")));

app.post("/api/v1/applications/:id/offer", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  requireContractorActor(request.actor);
  const applicationId = validate(z.uuid(), request.params.id);
  const input = validate(offerCreateSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `offers.create:${applicationId}`, async (client) => {
    const application = await loadApplicationById(client, applicationId, { forUpdate: true });
    requireApplicationContractorAccess(request.actor, application);
    if (!["submitted", "shortlisted"].includes(application.status)) {
      throw new ApiError(409, "APPLICATION_NOT_OFFERABLE", "This application cannot receive an offer.");
    }
    const job = (await client.query("SELECT id, status, created_by_account_id FROM jobs WHERE id = $1 FOR UPDATE", [application.job_id])).rows[0];
    if (!job || job.status !== "open") throw new ApiError(409, "JOB_NOT_OPEN", "This job is not accepting offers.");
    await assertNoAccountBlock(client, request.actor.account.id, application.applicant_account_id);
    const existingOffer = await client.query(
      "SELECT id, status FROM job_offers WHERE job_id = $1 AND status IN ('pending', 'accepted') FOR UPDATE",
      [application.job_id],
    );
    if (existingOffer.rowCount) {
      throw new ApiError(409, "JOB_OFFER_ALREADY_ACTIVE", "This job already has an active offer.");
    }
    const offerId = (await client.query(
      `INSERT INTO job_offers (
         job_id, application_id, contractor_account_id, recipient_account_id,
         start_date, scope_summary, message, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [application.job_id, applicationId, request.actor.account.id, application.applicant_account_id,
        input.startDate, input.scopeSummary, input.message, input.expiresAt],
    )).rows[0].id;
    await client.query(
      "UPDATE job_applications SET status = 'offered', decided_at = now(), updated_at = now() WHERE id = $1",
      [applicationId],
    );
    await client.query(
      `INSERT INTO job_application_events (
         application_id, actor_account_id, event_type, from_status, to_status
       ) VALUES ($1, $2, 'offered', $3, 'offered')`,
      [applicationId, request.actor.account.id, application.status],
    );
    await client.query(
      `INSERT INTO job_offer_events (offer_id, actor_account_id, event_type, to_status)
       VALUES ($1, $2, 'sent', 'pending')`,
      [offerId, request.actor.account.id],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'offer.sent', 'offer', ($4::uuid)::text, $5::jsonb)`,
      [request.requestId, request.actor.account.id, application.organization_id, offerId,
        JSON.stringify({ applicationId, jobId: application.job_id })],
    );
    await createInAppNotification(client, {
      accountId: application.applicant_account_id,
      type: "work",
      title: "Offer received",
      body: `${application.job_title} - ${application.public_city}, ${application.public_region}`,
      actionHref: `/app/work?job=${application.job_id}`,
      sourceType: "offer",
      sourceId: offerId,
      priority: "high",
      metadata: { jobId: application.job_id, applicationId },
    });
    const offer = await loadOfferById(client, offerId);
    const updatedApplication = await loadApplicationById(client, applicationId);
    return {
      status: 201,
      body: {
        data: {
          offer: await mappedOfferWithEvents(client, offer),
          application: await mappedApplicationWithEvents(client, updatedApplication),
        },
        meta: { requestId: request.requestId },
      },
    };
  });
  sendIdempotentResult(response, result);
}));

app.get("/api/v1/offers", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const rows = await database.query(
    `${offerSelectBase}
     WHERE jo.recipient_account_id = $1 OR jo.contractor_account_id = $1
     ORDER BY jo.updated_at DESC, jo.id DESC
     LIMIT 100`,
    [request.actor.account.id],
  );
  response.json({ data: { offers: rows.rows.map((row) => mapOffer(row)) }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/offers/:id/accept", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  requireTradespersonActor(request.actor);
  const offerId = validate(z.uuid(), request.params.id);
  const input = validate(offerDecisionSchema, request.body);
  const expectedConsentVersion = envValue("SIGNUP_CONSENT_VERSION", "2026-06-19");
  requireOfferAcceptanceConsent(input, expectedConsentVersion);
  const result = await runIdempotentMutation(request, request.actor.account.id, `offers.accept:${offerId}`, async (client) => {
    const offer = await loadOfferById(client, offerId, { forUpdate: true });
    if (offer.recipient_account_id !== request.actor.account.id) {
      throw new ApiError(403, "OFFER_RECIPIENT_MISMATCH", "Only the offer recipient can accept this work.");
    }
    if (offer.status === "accepted") {
      const active = (await client.query(`${activeWorkSelectBase} WHERE aw.offer_id = $1`, [offerId])).rows[0];
      return {
        status: 200,
        body: {
          data: {
            offer: await mappedOfferWithEvents(client, offer),
            activeWork: active ? await mappedActiveWorkWithEvents(client, active) : null,
          },
          meta: { requestId: request.requestId },
        },
      };
    }
    if (offer.status !== "pending") throw new ApiError(409, "OFFER_NOT_PENDING", "This offer is no longer pending.");
    if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) {
      await client.query("UPDATE job_offers SET status = 'expired', updated_at = now() WHERE id = $1", [offerId]);
      await client.query(
        `INSERT INTO job_offer_events (offer_id, actor_account_id, event_type, from_status, to_status, reason)
         VALUES ($1, $2, 'expired', 'pending', 'expired', 'Offer expired before acceptance')`,
        [offerId, request.actor.account.id],
      );
      throw new ApiError(409, "OFFER_EXPIRED", "This offer has expired.");
    }
    const job = (await client.query("SELECT id, status, organization_id FROM jobs WHERE id = $1 FOR UPDATE", [offer.job_id])).rows[0];
    if (!job || job.status !== "open") throw new ApiError(409, "JOB_NOT_OPEN", "This job is no longer available.");
    await assertNoAccountBlock(client, offer.contractor_account_id, request.actor.account.id);
    await client.query(
      `INSERT INTO consent_acceptances (account_id, actor_account_id, document_key, document_version, context, request_id, metadata)
       VALUES ($1, $1, 'platform_terms', $2, 'offer_acceptance', $3, $4::jsonb)
       ON CONFLICT (account_id, document_key, document_version, context) DO NOTHING`,
      [request.actor.account.id, expectedConsentVersion, request.requestId, JSON.stringify({ offerId, jobId: offer.job_id })],
    );
    await client.query(
      `UPDATE job_offers
       SET status = 'accepted', accepted_at = now(), updated_at = now()
       WHERE id = $1`,
      [offerId],
    );
    await client.query(
      `INSERT INTO job_offer_events (
         offer_id, actor_account_id, event_type, from_status, to_status, reason
       ) VALUES ($1, $2, 'accepted', 'pending', 'accepted', $3)`,
      [offerId, request.actor.account.id, input.reason],
    );
    await client.query(
      `UPDATE jobs
       SET status = 'closed', closed_at = now(), version = version + 1, updated_at = now()
       WHERE id = $1`,
      [offer.job_id],
    );
    await client.query(
      `INSERT INTO job_status_events (job_id, actor_account_id, event_type, from_status, to_status, reason)
       VALUES ($1, $2, 'closed', 'open', 'closed', 'Offer accepted')`,
      [offer.job_id, request.actor.account.id],
    );
    const activeWorkInsert = await client.query(
      `INSERT INTO active_work (
         job_id, offer_id, organization_id, contractor_account_id, tradesperson_account_id
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (job_id) DO NOTHING
       RETURNING id`,
      [offer.job_id, offerId, job.organization_id, offer.contractor_account_id, request.actor.account.id],
    );
    let activeWorkId = activeWorkInsert.rows[0]?.id;
    if (!activeWorkId) {
      const existing = (await client.query("SELECT id, offer_id FROM active_work WHERE job_id = $1", [offer.job_id])).rows[0];
      if (!existing || existing.offer_id !== offerId) throw new ApiError(409, "JOB_ALREADY_FILLED", "This job already has active work.");
      activeWorkId = existing.id;
    }
    await client.query(
      `INSERT INTO work_participants (active_work_id, account_id, participant_role)
       VALUES ($1, $2, 'contractor'), ($1, $3, 'tradesperson')
       ON CONFLICT DO NOTHING`,
      [activeWorkId, offer.contractor_account_id, request.actor.account.id],
    );
    if (activeWorkInsert.rowCount) {
      await client.query(
        `INSERT INTO work_status_events (
           active_work_id, actor_account_id, event_type, to_status, reason
         ) VALUES ($1, $2, 'active_created', 'active', $3)`,
        [activeWorkId, request.actor.account.id, input.reason],
      );
    }
    await ensureConversationForActiveWork(client, activeWorkId, request.actor);
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'offer.accepted', 'offer', ($4::uuid)::text, $5::jsonb)`,
      [request.requestId, request.actor.account.id, job.organization_id, offerId,
        JSON.stringify({ activeWorkId, jobId: offer.job_id })],
    );
    await createInAppNotification(client, {
      accountId: offer.contractor_account_id,
      type: "work",
      title: "Offer accepted",
      body: `${offer.job_title} - ${offer.public_city}, ${offer.public_region}`,
      actionHref: `/app/messages`,
      sourceType: "active_work",
      sourceId: activeWorkId,
      priority: "high",
      metadata: { jobId: offer.job_id, offerId },
    });
    const acceptedOffer = await loadOfferById(client, offerId);
    const activeWork = (await client.query(`${activeWorkSelectBase} WHERE aw.id = $1`, [activeWorkId])).rows[0];
    return {
      status: 200,
      body: {
        data: {
          offer: await mappedOfferWithEvents(client, acceptedOffer),
          activeWork: await mappedActiveWorkWithEvents(client, activeWork),
        },
        meta: { requestId: request.requestId },
      },
    };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/offers/:id/decline", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  requireTradespersonActor(request.actor);
  const offerId = validate(z.uuid(), request.params.id);
  const input = validate(offerDecisionSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `offers.decline:${offerId}`, async (client) => {
    const offer = await loadOfferById(client, offerId, { forUpdate: true });
    if (offer.recipient_account_id !== request.actor.account.id) {
      throw new ApiError(403, "OFFER_RECIPIENT_MISMATCH", "Only the offer recipient can decline this offer.");
    }
    if (offer.status === "declined") {
      return { status: 200, body: { data: { offer: await mappedOfferWithEvents(client, offer) }, meta: { requestId: request.requestId } } };
    }
    if (offer.status !== "pending") throw new ApiError(409, "OFFER_NOT_PENDING", "This offer is no longer pending.");
    await client.query(
      `UPDATE job_offers
       SET status = 'declined', declined_at = now(), updated_at = now()
       WHERE id = $1`,
      [offerId],
    );
    await client.query(
      `UPDATE job_applications SET status = 'declined', decided_at = now(), updated_at = now()
       WHERE id = $1`,
      [offer.application_id],
    );
    await client.query(
      `INSERT INTO job_offer_events (
         offer_id, actor_account_id, event_type, from_status, to_status, reason
       ) VALUES ($1, $2, 'declined', 'pending', 'declined', $3)`,
      [offerId, request.actor.account.id, input.reason],
    );
    await client.query(
      `INSERT INTO job_application_events (
         application_id, actor_account_id, event_type, from_status, to_status, reason
       ) VALUES ($1, $2, 'declined', 'offered', 'declined', $3)`,
      [offer.application_id, request.actor.account.id, input.reason],
    );
    const declined = await loadOfferById(client, offerId);
    return { status: 200, body: { data: { offer: await mappedOfferWithEvents(client, declined) }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.get("/api/v1/active-work", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const rows = await database.query(
    `${activeWorkSelectBase}
     INNER JOIN work_participants wp ON wp.active_work_id = aw.id
     WHERE wp.account_id = $1
     ORDER BY aw.updated_at DESC, aw.id DESC
     LIMIT 100`,
    [request.actor.account.id],
  );
  response.json({ data: { activeWork: rows.rows.map((row) => mapActiveWork(row)) }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/active-work/:id/cancel", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const activeWorkId = validate(z.uuid(), request.params.id);
  const input = validate(workTransitionSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `active-work.cancel:${activeWorkId}`, async (client) => {
    const activeWork = await loadActiveWorkById(client, activeWorkId, request.actor, { forUpdate: true });
    if (activeWork.status === "cancelled") {
      return { status: 200, body: { data: { activeWork: await mappedActiveWorkWithEvents(client, activeWork) }, meta: { requestId: request.requestId } } };
    }
    if (activeWork.status !== "active") throw new ApiError(409, "ACTIVE_WORK_NOT_CANCELLABLE", "This work cannot be cancelled.");
    await client.query(
      "UPDATE active_work SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1",
      [activeWorkId],
    );
    await client.query(
      `INSERT INTO work_status_events (
         active_work_id, actor_account_id, event_type, from_status, to_status, reason
       ) VALUES ($1, $2, 'cancelled', 'active', 'cancelled', $3)`,
      [activeWorkId, request.actor.account.id, input.reason],
    );
    const recipientAccountId = activeWork.contractor_account_id === request.actor.account.id
      ? activeWork.tradesperson_account_id
      : activeWork.contractor_account_id;
    await createInAppNotification(client, {
      accountId: recipientAccountId,
      type: "work",
      title: "Work cancelled",
      body: `${activeWork.job_title} - ${activeWork.public_city}, ${activeWork.public_region}`,
      actionHref: "/app/messages",
      sourceType: "active_work",
      sourceId: activeWorkId,
      priority: "high",
      metadata: { jobId: activeWork.job_id, reason: input.reason },
    });
    const row = await loadActiveWorkById(client, activeWorkId, request.actor);
    return { status: 200, body: { data: { activeWork: await mappedActiveWorkWithEvents(client, row) }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/active-work/:id/reschedule", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const activeWorkId = validate(z.uuid(), request.params.id);
  const input = validate(workTransitionSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `active-work.reschedule:${activeWorkId}`, async (client) => {
    const activeWork = await loadActiveWorkById(client, activeWorkId, request.actor, { forUpdate: true });
    if (activeWork.status !== "active") throw new ApiError(409, "ACTIVE_WORK_NOT_ACTIVE", "Only active work can be rescheduled.");
    await client.query(
      `INSERT INTO work_status_events (
         active_work_id, actor_account_id, event_type, from_status, to_status, reason
       ) VALUES ($1, $2, 'reschedule_requested', 'active', 'active', $3)`,
      [activeWorkId, request.actor.account.id, input.reason],
    );
    const recipientAccountId = activeWork.contractor_account_id === request.actor.account.id
      ? activeWork.tradesperson_account_id
      : activeWork.contractor_account_id;
    await createInAppNotification(client, {
      accountId: recipientAccountId,
      type: "work",
      title: "Reschedule requested",
      body: `${activeWork.job_title} - ${activeWork.public_city}, ${activeWork.public_region}`,
      actionHref: "/app/messages",
      sourceType: "active_work",
      sourceId: activeWorkId,
      priority: "normal",
      metadata: { jobId: activeWork.job_id, reason: input.reason },
    });
    const row = await loadActiveWorkById(client, activeWorkId, request.actor);
    return { status: 200, body: { data: { activeWork: await mappedActiveWorkWithEvents(client, row) }, meta: { requestId: request.requestId } } };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/active-work/:id/conversation", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const activeWorkId = validate(z.uuid(), request.params.id);
  const result = await runIdempotentMutation(request, request.actor.account.id, `conversations.open:${activeWorkId}`, async (client) => {
    const conversation = await ensureConversationForActiveWork(client, activeWorkId, request.actor);
    const [mapped] = await mapConversationsForActor(client, [conversation], request.actor);
    return {
      status: 200,
      body: { data: { conversation: mapped }, meta: { requestId: request.requestId } },
    };
  });
  sendIdempotentResult(response, result);
}));

async function openProjectResponse(client, activeWorkId, actor, requestId) {
  const project = await ensureProjectForActiveWork(client, activeWorkId, actor);
  return {
    status: 200,
    body: {
      data: { project: await loadProjectBundle(client, project, actor) },
      meta: { requestId },
    },
  };
}

app.get("/api/v1/active-work/:id/project", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const activeWorkId = validate(z.uuid(), request.params.id);
  const project = await loadProjectByActiveWorkId(database, activeWorkId, request.actor);
  response.json({
    data: { project: await loadProjectBundle(database, project, request.actor) },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/active-work/:id/project", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const activeWorkId = validate(z.uuid(), request.params.id);
  request.body = request.body ?? {};
  const result = await runIdempotentMutation(request, request.actor.account.id, `projects.open:${activeWorkId}`, async (client) => (
    openProjectResponse(client, activeWorkId, request.actor, request.requestId)
  ));
  sendIdempotentResult(response, result);
}));

app.get("/api/v1/projects/:id", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const projectId = validate(z.uuid(), request.params.id);
  const project = await loadProjectById(database, projectId, request.actor);
  response.json({
    data: { project: await loadProjectBundle(database, project, request.actor) },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/projects/:id/entries", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const projectId = validate(z.uuid(), request.params.id);
  const input = validate(projectEntryCreateSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `projects.entry:${projectId}`, async (client) => {
    const project = await loadProjectById(client, projectId, request.actor);
    const inserted = await client.query(
      `INSERT INTO project_entries (project_id, active_work_id, actor_account_id, entry_type, body, checklist, metadata)
       VALUES ($1, $2, $3, 'note', $4, $5::jsonb, $6::jsonb)
       RETURNING *`,
      [
        projectId,
        project.active_work_id,
        request.actor.account.id,
        input.body,
        JSON.stringify(input.checklist),
        JSON.stringify(input.metadata),
      ],
    );
    await client.query("UPDATE projects SET updated_at = now() WHERE id = $1", [projectId]);
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'project.entry.created', 'project', ($4::uuid)::text, $5::jsonb)`,
      [request.requestId, request.actor.account.id, project.organization_id, projectId, JSON.stringify({ entryId: inserted.rows[0].id })],
    );
    return {
      status: 201,
      body: { data: { entry: mapProjectEntry(inserted.rows[0]) }, meta: { requestId: request.requestId } },
    };
  });
  sendIdempotentResult(response, result);
}));

app.post(
  "/api/v1/projects/:id/media",
  requireV1AuthenticatedUser,
  requireV1Actor,
  uploadRateLimit,
  upload.single("file"),
  asyncRoute(async (request, response) => {
    const projectId = validate(z.uuid(), request.params.id);
    if (!request.file) throw new ApiError(400, "UPLOAD_REQUIRED", "A file field named `file` is required.");

    const contentHash = sha256Buffer(request.file.buffer);
    const detection = detectUploadContent(request.file);
    const name = String(request.body?.name ?? request.file.originalname ?? "Project upload").trim().slice(0, 240);
    const notes = String(request.body?.notes ?? "").trim().slice(0, 1000);
    request.body = {
      name,
      notes,
      originalName: request.file.originalname,
      mimeType: request.file.mimetype,
      sizeBytes: request.file.size,
      contentSha256: contentHash,
    };

    const result = await runIdempotentMutation(request, request.actor.account.id, `projects.media:${projectId}`, async (client) => {
      const project = await loadProjectById(client, projectId, request.actor);
      const uploadId = randomUUID();
      const mediaId = randomUUID();
      const entryId = randomUUID();

      if (!detection.ok) {
        const uploadRow = await client.query(
          `INSERT INTO uploads (
             id, session_id, account_id, active_work_id, kind, name, notes, original_name, mime_type,
             size_bytes, upload_status, storage_scope, content_sha256, failure_reason
           ) VALUES ($1, $2::text, $2::uuid, $3, 'project-media', $4, $5, $6, $7, $8, 'rejected', 'project', $9, $10)
           RETURNING *`,
          [
            uploadId,
            request.actor.account.id,
            project.active_work_id,
            name || request.file.originalname,
            notes,
            request.file.originalname,
            request.file.mimetype,
            request.file.size,
            contentHash,
            detection.message,
          ],
        );
        await client.query(
          `INSERT INTO project_entries (id, project_id, active_work_id, actor_account_id, entry_type, body, metadata)
           VALUES ($1, $2, $3, $4, 'media', $5, $6::jsonb)`,
          [
            entryId,
            projectId,
            project.active_work_id,
            request.actor.account.id,
            `Rejected upload: ${request.file.originalname}`,
            JSON.stringify({ uploadId, reason: detection.code }),
          ],
        );
        const mediaRow = await client.query(
          `INSERT INTO project_media (
             id, project_id, entry_id, upload_id, uploader_account_id, original_name, mime_type, size_bytes,
             content_sha256, media_kind, status, review_status, failure_reason
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'rejected', 'rejected', $11)
           RETURNING *`,
          [
            mediaId,
            projectId,
            entryId,
            uploadId,
            request.actor.account.id,
            request.file.originalname,
            request.file.mimetype,
            request.file.size,
            contentHash,
            mediaKindForMime(request.file.mimetype),
            detection.message,
          ],
        );
        await client.query("UPDATE projects SET updated_at = now() WHERE id = $1", [projectId]);
        return {
          status: 422,
          body: {
            data: {
              upload: mapUploadRow(uploadRow.rows[0]),
              media: mapProjectMedia(mediaRow.rows[0]),
            },
            error: { code: detection.code, message: detection.message },
            meta: { requestId: request.requestId },
          },
        };
      }

      if (!s3Client || !s3Bucket) {
        throw new ApiError(503, "OBJECT_STORAGE_UNAVAILABLE", "Managed object storage is unavailable.");
      }

      const objectKey = `projects/${safeObjectName(projectId)}/${safeObjectName(request.actor.account.id)}/${new Date().toISOString().slice(0, 10)}/${uploadId}-${safeObjectName(
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
            contentSha256: contentHash,
          },
        }),
      );
      const uploadRow = await client.query(
        `INSERT INTO uploads (
           id, session_id, account_id, active_work_id, kind, name, notes, object_key, original_name,
           mime_type, size_bytes, upload_status, storage_scope, content_sha256, verified_at
         ) VALUES ($1, $2::text, $2::uuid, $3, 'project-media', $4, $5, $6, $7, $8, $9, 'stored', 'project', $10, now())
         RETURNING *`,
        [
          uploadId,
          request.actor.account.id,
          project.active_work_id,
          name || request.file.originalname,
          notes,
          objectKey,
          request.file.originalname,
          request.file.mimetype,
          request.file.size,
          contentHash,
        ],
      );
      const entryRow = await client.query(
        `INSERT INTO project_entries (id, project_id, active_work_id, actor_account_id, entry_type, body, metadata)
         VALUES ($1, $2, $3, $4, 'media', $5, $6::jsonb)
         RETURNING *`,
        [
          entryId,
          projectId,
          project.active_work_id,
          request.actor.account.id,
          notes || `Uploaded ${request.file.originalname}`,
          JSON.stringify({ uploadId, contentSha256: contentHash }),
        ],
      );
      const mediaRow = await client.query(
        `INSERT INTO project_media (
           id, project_id, entry_id, upload_id, uploader_account_id, original_name, mime_type, size_bytes,
           content_sha256, media_kind, status, review_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'stored', 'not_scanned')
         RETURNING *`,
        [
          mediaId,
          projectId,
          entryId,
          uploadId,
          request.actor.account.id,
          request.file.originalname,
          request.file.mimetype,
          request.file.size,
          contentHash,
          mediaKindForMime(request.file.mimetype),
        ],
      );
      await client.query("UPDATE projects SET updated_at = now() WHERE id = $1", [projectId]);
      await client.query(
        `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
         VALUES ($1, $2::uuid, $3::uuid, 'project.media.uploaded', 'project_media', ($4::uuid)::text, $5::jsonb)`,
        [
          request.requestId,
          request.actor.account.id,
          project.organization_id,
          mediaId,
          JSON.stringify({ projectId, uploadId, contentSha256: contentHash }),
        ],
      );
      return {
        status: 201,
        body: {
          data: {
            upload: mapUploadRow(uploadRow.rows[0]),
            entry: mapProjectEntry(entryRow.rows[0]),
            media: mapProjectMedia(mediaRow.rows[0]),
          },
          meta: { requestId: request.requestId },
        },
      };
    });
    sendIdempotentResult(response, result);
  }),
);

app.get("/api/v1/projects/:id/media/:mediaId/url", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const projectId = validate(z.uuid(), request.params.id);
  const mediaId = validate(z.uuid(), request.params.mediaId);
  const media = await loadProjectMediaById(database, projectId, mediaId, request.actor);
  const signedUrl = await signedObjectUrl(media.object_key);
  response.json({
    data: {
      media: mapProjectMedia(media, { signedUrl }),
      signedUrl,
      expiresIn: signedUrlSeconds,
    },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/projects/:id/completion", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const projectId = validate(z.uuid(), request.params.id);
  const input = validate(completionSubmitSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `projects.completion.submit:${projectId}`, async (client) => {
    const project = await loadProjectById(client, projectId, request.actor, { forUpdate: true });
    requireProjectTradesperson(request.actor, project);
    if (project.active_work_status !== "active") {
      throw new ApiError(409, "ACTIVE_WORK_NOT_ACTIVE", "Only active work can be submitted for completion.");
    }
    if (project.status === "confirmed") {
      throw new ApiError(409, "PROJECT_ALREADY_CONFIRMED", "This project is already confirmed.");
    }

    if (input.evidenceMediaIds.length) {
      const mediaResult = await client.query(
        `SELECT id FROM project_media
         WHERE project_id = $1 AND id = ANY($2::uuid[]) AND status = 'stored'`,
        [projectId, input.evidenceMediaIds],
      );
      if (mediaResult.rowCount !== input.evidenceMediaIds.length) {
        throw new ApiError(422, "COMPLETION_EVIDENCE_INVALID", "Completion evidence must belong to this project.");
      }
    }

    const submission = await client.query(
      `INSERT INTO project_completion_submissions (
         project_id, submitted_by_account_id, note, checklist, evidence_media_ids
       ) VALUES ($1, $2, $3, $4::jsonb, $5::uuid[])
       RETURNING *`,
      [
        projectId,
        request.actor.account.id,
        input.note,
        JSON.stringify(input.checklist),
        input.evidenceMediaIds,
      ],
    );
    await client.query(
      `INSERT INTO project_entries (project_id, active_work_id, actor_account_id, entry_type, body, checklist, metadata)
       VALUES ($1, $2, $3, 'completion_submitted', $4, $5::jsonb, $6::jsonb)`,
      [
        projectId,
        project.active_work_id,
        request.actor.account.id,
        input.note,
        JSON.stringify(input.checklist),
        JSON.stringify({ submissionId: submission.rows[0].id, evidenceMediaIds: input.evidenceMediaIds }),
      ],
    );
    await client.query(
      `UPDATE projects
       SET status = 'completion_submitted', completion_submitted_at = now(), updated_at = now()
       WHERE id = $1`,
      [projectId],
    );
    await createInAppNotification(client, {
      accountId: project.contractor_account_id,
      type: "work",
      title: "Completion submitted",
      body: `${project.job_title} - ${project.public_city}, ${project.public_region}`,
      actionHref: "/app/tools",
      sourceType: "project",
      sourceId: projectId,
      priority: "high",
      metadata: { activeWorkId: project.active_work_id, submissionId: submission.rows[0].id },
    });
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'project.completion.submitted', 'project', ($4::uuid)::text, $5::jsonb)`,
      [
        request.requestId,
        request.actor.account.id,
        project.organization_id,
        projectId,
        JSON.stringify({ submissionId: submission.rows[0].id }),
      ],
    );
    return {
      status: 201,
      body: {
        data: { completion: mapCompletionSubmission(submission.rows[0]) },
        meta: { requestId: request.requestId },
      },
    };
  });
  sendIdempotentResult(response, result);
}));

async function resolveCompletion(request, projectId, submissionId, decision) {
  const input = validate(completionResolutionSchema, request.body);
  return runIdempotentMutation(request, request.actor.account.id, `projects.completion.${decision}:${submissionId}`, async (client) => {
    const project = await loadProjectById(client, projectId, request.actor, { forUpdate: true });
    requireProjectContractor(request.actor, project);
    const submission = await loadCompletionSubmission(client, projectId, submissionId, { forUpdate: true });
    if (submission.status === decision) {
      return {
        status: 200,
        body: { data: { completion: mapCompletionSubmission(submission) }, meta: { requestId: request.requestId } },
      };
    }
    if (submission.status !== "submitted") {
      throw new ApiError(409, "COMPLETION_ALREADY_RESOLVED", "This completion submission has already been resolved.");
    }
    if (project.active_work_status !== "active") {
      throw new ApiError(409, "ACTIVE_WORK_NOT_ACTIVE", "Only active work can be resolved for completion.");
    }

    const projectStatus = decision === "confirmed" ? "confirmed" : "disputed";
    await client.query(
      `UPDATE project_completion_submissions
       SET status = $3, resolved_at = now()
       WHERE project_id = $1 AND id = $2`,
      [projectId, submissionId, decision],
    );
    const resolution = await client.query(
      `INSERT INTO project_completion_resolutions (submission_id, project_id, actor_account_id, decision, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [submissionId, projectId, request.actor.account.id, decision, input.reason],
    );
    await client.query(
      `INSERT INTO project_entries (project_id, active_work_id, actor_account_id, entry_type, body, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        projectId,
        project.active_work_id,
        request.actor.account.id,
        decision === "confirmed" ? "completion_confirmed" : "completion_disputed",
        input.reason || (decision === "confirmed" ? "Completion confirmed." : "Completion disputed."),
        JSON.stringify({ submissionId, resolutionId: resolution.rows[0].id }),
      ],
    );
    await client.query(
      `UPDATE projects
       SET status = $2,
           confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE confirmed_at END,
           disputed_at = CASE WHEN $2 = 'disputed' THEN now() ELSE disputed_at END,
           updated_at = now()
       WHERE id = $1`,
      [projectId, projectStatus],
    );

    if (decision === "confirmed") {
      await client.query(
        `UPDATE active_work
         SET status = 'completed', completed_at = now(), updated_at = now()
         WHERE id = $1`,
        [project.active_work_id],
      );
      await client.query(
        `INSERT INTO work_status_events (
           active_work_id, actor_account_id, event_type, from_status, to_status, reason, metadata
         ) VALUES ($1, $2, 'completed', 'active', 'completed', $3, $4::jsonb)`,
        [
          project.active_work_id,
          request.actor.account.id,
          input.reason || "Completion confirmed.",
          JSON.stringify({ projectId, submissionId, resolutionId: resolution.rows[0].id }),
        ],
      );
    }

    await createInAppNotification(client, {
      accountId: project.tradesperson_account_id,
      type: "work",
      title: decision === "confirmed" ? "Completion confirmed" : "Completion disputed",
      body: `${project.job_title} - ${project.public_city}, ${project.public_region}`,
      actionHref: "/app/tools",
      sourceType: "project",
      sourceId: projectId,
      priority: "high",
      metadata: { activeWorkId: project.active_work_id, submissionId, decision },
    });
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, $4, 'project', ($5::uuid)::text, $6::jsonb)`,
      [
        request.requestId,
        request.actor.account.id,
        project.organization_id,
        decision === "confirmed" ? "project.completion.confirmed" : "project.completion.disputed",
        projectId,
        JSON.stringify({ submissionId, resolutionId: resolution.rows[0].id }),
      ],
    );
    const updatedSubmission = await loadCompletionSubmission(client, projectId, submissionId);
    return {
      status: 200,
      body: {
        data: { completion: mapCompletionSubmission(updatedSubmission, { resolutions: [resolution.rows[0]] }) },
        meta: { requestId: request.requestId },
      },
    };
  });
}

app.post("/api/v1/projects/:id/completion/:submissionId/confirm", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const projectId = validate(z.uuid(), request.params.id);
  const submissionId = validate(z.uuid(), request.params.submissionId);
  sendIdempotentResult(response, await resolveCompletion(request, projectId, submissionId, "confirmed"));
}));

app.post("/api/v1/projects/:id/completion/:submissionId/dispute", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const projectId = validate(z.uuid(), request.params.id);
  const submissionId = validate(z.uuid(), request.params.submissionId);
  sendIdempotentResult(response, await resolveCompletion(request, projectId, submissionId, "disputed"));
}));

app.get("/api/v1/projects/:id/report", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const projectId = validate(z.uuid(), request.params.id);
  const project = await loadProjectById(database, projectId, request.actor);
  const [entries, media, submissions, resolutions] = await Promise.all([
    database.query(
      "SELECT * FROM project_entries WHERE project_id = $1 ORDER BY created_at ASC, id ASC",
      [projectId],
    ),
    database.query(
      "SELECT * FROM project_media WHERE project_id = $1 ORDER BY created_at ASC, id ASC",
      [projectId],
    ),
    database.query(
      "SELECT * FROM project_completion_submissions WHERE project_id = $1 ORDER BY submitted_at ASC, id ASC",
      [projectId],
    ),
    database.query(
      "SELECT * FROM project_completion_resolutions WHERE project_id = $1 ORDER BY created_at ASC, id ASC",
      [projectId],
    ),
  ]);
  response.json({
    data: {
      report: buildCloseoutReport(project, entries.rows, media.rows, submissions.rows, resolutions.rows),
    },
    meta: { requestId: request.requestId },
  });
}));

// ─── Photo Albums ────────────────────────────────────────────────────────────

registerAlbumRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  uploadRateLimit,
  upload,
  sha256Buffer,
  detectUploadContent,
  signedObjectUrl,
  s3Client,
  s3Bucket,
});

app.get("/api/v1/conversations", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const rows = await database.query(
    `${conversationSelectBase}
     INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE cp.account_id = $1
     ORDER BY c.updated_at DESC, c.id DESC
     LIMIT 100`,
    [request.actor.account.id],
  );
  response.json({
    data: { conversations: await mapConversationsForActor(database, rows.rows, request.actor) },
    meta: { requestId: request.requestId },
  });
}));

app.get("/api/v1/conversations/:id/messages", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const conversationId = validate(z.uuid(), request.params.id);
  await loadConversationById(database, conversationId, request.actor);
  const rows = await database.query(
    `${messageSelectBase}
     WHERE cm.conversation_id = $1 AND cm.deleted_at IS NULL
     ORDER BY cm.created_at ASC, cm.id ASC
     LIMIT 100`,
    [conversationId],
  );
  const messageIds = rows.rows.map((row) => row.id);
  const receipts = messageIds.length
    ? await database.query(
      `SELECT * FROM message_receipts
       WHERE message_id = ANY($1::uuid[])
       ORDER BY delivered_at ASC`,
      [messageIds],
    )
    : { rows: [] };
  const attachments = messageIds.length
    ? await database.query(
      `SELECT * FROM message_attachments
       WHERE message_id = ANY($1::uuid[])
       ORDER BY created_at ASC, id ASC`,
      [messageIds],
    )
    : { rows: [] };
  const receiptMap = new Map();
  for (const receipt of receipts.rows) {
    const current = receiptMap.get(receipt.message_id) ?? [];
    current.push(receipt);
    receiptMap.set(receipt.message_id, current);
  }
  const attachmentMap = new Map();
  for (const attachment of attachments.rows) {
    const current = attachmentMap.get(attachment.message_id) ?? [];
    current.push(attachment);
    attachmentMap.set(attachment.message_id, current);
  }
  response.json({
    data: {
      messages: rows.rows.map((row) => mapMessage(row, {
        receipts: receiptMap.get(row.id) ?? [],
        attachments: attachmentMap.get(row.id) ?? [],
      })),
    },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/conversations/:id/messages", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const conversationId = validate(z.uuid(), request.params.id);
  const input = validate(messageCreateSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `messages.send:${conversationId}`, async (client) => {
    const conversation = await loadConversationById(client, conversationId, request.actor, { forUpdate: true });
    if (conversation.status !== "open") throw new ApiError(409, "CONVERSATION_CLOSED", "This conversation is closed.");
    const participants = await loadConversationParticipantRows(client, conversationId, { forUpdate: true });
    await assertConversationParticipantsCanInteract(client, participants);
    const messageId = (await client.query(
      `INSERT INTO conversation_messages (conversation_id, sender_account_id, body)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [conversationId, request.actor.account.id, input.body],
    )).rows[0].id;
    for (const participant of participants) {
      await client.query(
        `INSERT INTO message_receipts (message_id, account_id, read_at)
         VALUES ($1, $2, $3)`,
        [messageId, participant.account_id, participant.account_id === request.actor.account.id ? new Date() : null],
      );
    }
    for (const attachment of input.attachments) {
      await client.query(
        `INSERT INTO message_attachments (
           message_id, upload_id, original_name, mime_type, size_bytes, created_by_account_id
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [messageId, attachment.uploadId, attachment.originalName, attachment.mimeType, attachment.sizeBytes, request.actor.account.id],
      );
    }
    await client.query("UPDATE conversations SET updated_at = now() WHERE id = $1", [conversationId]);
    await client.query(
      `UPDATE conversation_participants
       SET updated_at = now(),
           last_read_at = CASE WHEN account_id = $2 THEN now() ELSE last_read_at END,
           last_read_message_id = CASE WHEN account_id = $2 THEN $3 ELSE last_read_message_id END
       WHERE conversation_id = $1`,
      [conversationId, request.actor.account.id, messageId],
    );
    await notifyConversationParticipants(client, conversation, participants, request.actor.account.id, messageId, input.body);
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'message.sent', 'message', ($4::uuid)::text, $5::jsonb)`,
      [request.requestId, request.actor.account.id, conversation.organization_id, messageId,
        JSON.stringify({ conversationId, jobId: conversation.job_id })],
    );
    const messageRow = (await client.query(`${messageSelectBase} WHERE cm.id = $1`, [messageId])).rows[0];
    const receipts = await client.query("SELECT * FROM message_receipts WHERE message_id = $1 ORDER BY delivered_at ASC", [messageId]);
    const attachments = await client.query("SELECT * FROM message_attachments WHERE message_id = $1 ORDER BY created_at ASC, id ASC", [messageId]);
    return {
      status: 201,
      body: {
        data: { message: mapMessage(messageRow, { receipts: receipts.rows, attachments: attachments.rows }) },
        meta: { requestId: request.requestId },
      },
    };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/conversations/:id/read", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const conversationId = validate(z.uuid(), request.params.id);
  const conversation = await loadConversationById(database, conversationId, request.actor);
  await withTransaction(async (client) => {
    const latest = await client.query(
      `SELECT id FROM conversation_messages
       WHERE conversation_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [conversationId],
    );
    await client.query(
      `UPDATE message_receipts
       SET read_at = COALESCE(read_at, now())
       WHERE account_id = $1
         AND message_id IN (SELECT id FROM conversation_messages WHERE conversation_id = $2)`,
      [request.actor.account.id, conversationId],
    );
    await client.query(
      `UPDATE conversation_participants
       SET last_read_at = now(), last_read_message_id = $3, updated_at = now()
       WHERE conversation_id = $1 AND account_id = $2`,
      [conversationId, request.actor.account.id, latest.rows[0]?.id ?? null],
    );
    await client.query(
      `UPDATE in_app_notifications
       SET read_at = COALESCE(read_at, now())
       WHERE account_id = $1
         AND read_at IS NULL
         AND (
           (source_type = 'message' AND metadata->>'conversationId' = $2)
           OR (source_type = 'active_work' AND source_id = $3)
         )`,
      [request.actor.account.id, conversationId, conversation.active_work_id],
    );
  });
  const [mapped] = await mapConversationsForActor(database, [conversation], request.actor);
  response.json({ data: { conversation: mapped }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/conversations/:id/mute", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const conversationId = validate(z.uuid(), request.params.id);
  const input = validate(conversationMuteSchema, request.body);
  await loadConversationById(database, conversationId, request.actor);
  const updated = await database.query(
    `UPDATE conversation_participants
     SET muted_until = $3, updated_at = now()
     WHERE conversation_id = $1 AND account_id = $2
     RETURNING *`,
    [conversationId, request.actor.account.id, input.mutedUntil],
  );
  response.json({
    data: { participant: mapConversationParticipant(updated.rows[0]) },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/conversations/:id/report", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const conversationId = validate(z.uuid(), request.params.id);
  const input = validate(reportConversationSchema, request.body);
  const result = await runIdempotentMutation(request, request.actor.account.id, `conversations.report:${conversationId}`, async (client) => {
    await loadConversationById(client, conversationId, request.actor);
    if (input.reportedAccountId) {
      const participant = await client.query(
        "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND account_id = $2",
        [conversationId, input.reportedAccountId],
      );
      if (!participant.rowCount || input.reportedAccountId === request.actor.account.id) {
        throw new ApiError(422, "REPORT_TARGET_INVALID", "Report a different participant in this conversation.");
      }
    }
    if (input.messageId) {
      const message = await client.query(
        "SELECT 1 FROM conversation_messages WHERE id = $1 AND conversation_id = $2",
        [input.messageId, conversationId],
      );
      if (!message.rowCount) throw new ApiError(422, "REPORT_MESSAGE_INVALID", "That message is not in this conversation.");
    }
    const inserted = await client.query(
      `INSERT INTO conversation_reports (
         conversation_id, reporter_account_id, reported_account_id, message_id, reason, note
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, created_at`,
      [conversationId, request.actor.account.id, input.reportedAccountId, input.messageId, input.reason, input.note],
    );
    await client.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
       VALUES ($1, $2::uuid, 'conversation.reported', 'conversation_report', ($3::uuid)::text, $4::jsonb)`,
      [request.requestId, request.actor.account.id, inserted.rows[0].id, JSON.stringify({ conversationId, reason: input.reason })],
    );
    return {
      status: 201,
      body: { data: { report: inserted.rows[0] }, meta: { requestId: request.requestId } },
    };
  });
  sendIdempotentResult(response, result);
}));

app.post("/api/v1/accounts/:id/block", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const targetAccountId = validate(z.uuid(), request.params.id);
  const input = validate(blockAccountSchema, request.body);
  if (targetAccountId === request.actor.account.id) throw new ApiError(422, "BLOCK_TARGET_INVALID", "You cannot block yourself.");
  await assertSharedConversation(database, request.actor.account.id, targetAccountId);
  await database.query(
    `INSERT INTO account_blocks (blocker_account_id, blocked_account_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (blocker_account_id, blocked_account_id)
     DO UPDATE SET reason = EXCLUDED.reason, created_at = account_blocks.created_at`,
    [request.actor.account.id, targetAccountId, input.reason],
  );
  response.json({ data: { blockedAccountId: targetAccountId }, meta: { requestId: request.requestId } });
}));

app.post("/api/v1/accounts/:id/unblock", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const targetAccountId = validate(z.uuid(), request.params.id);
  await database.query(
    "DELETE FROM account_blocks WHERE blocker_account_id = $1 AND blocked_account_id = $2",
    [request.actor.account.id, targetAccountId],
  );
  response.json({ data: { blockedAccountId: targetAccountId, unblocked: true }, meta: { requestId: request.requestId } });
}));

app.get("/api/v1/notifications", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const rows = await database.query(
    `SELECT * FROM in_app_notifications
     WHERE account_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 100`,
    [request.actor.account.id],
  );
  const unread = rows.rows.filter((row) => !row.read_at).length;
  response.json({
    data: {
      notifications: rows.rows.map(mapNotification),
      unreadCount: unread,
    },
    meta: { requestId: request.requestId },
  });
}));

app.post("/api/v1/notifications/read", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const input = validate(notificationReadSchema, request.body);
  if (!input.all && input.ids.length === 0) {
    throw new ApiError(422, "NOTIFICATION_SELECTION_REQUIRED", "Select notifications to mark read or use all.");
  }
  if (input.all) {
    await database.query(
      "UPDATE in_app_notifications SET read_at = COALESCE(read_at, now()) WHERE account_id = $1 AND read_at IS NULL",
      [request.actor.account.id],
    );
  } else {
    await database.query(
      "UPDATE in_app_notifications SET read_at = COALESCE(read_at, now()) WHERE account_id = $1 AND id = ANY($2::uuid[])",
      [request.actor.account.id, input.ids],
    );
  }
  const unread = await database.query(
    "SELECT count(*)::int AS count FROM in_app_notifications WHERE account_id = $1 AND read_at IS NULL",
    [request.actor.account.id],
  );
  response.json({ data: { unreadCount: unread.rows[0].count }, meta: { requestId: request.requestId } });
}));

app.get("/api/v1/notification-preferences", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
  const rows = await database.query(
    `SELECT * FROM notification_preferences
     WHERE account_id = $1
     ORDER BY notification_type, channel`,
    [request.actor.account.id],
  );
  response.json({
    data: { preferences: rows.rows.map(mapNotificationPreference) },
    meta: { requestId: request.requestId },
  });
}));

app.put("/api/v1/notification-preferences", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
  const input = validate(notificationPreferenceSchema, request.body);
  const result = await database.query(
    `INSERT INTO notification_preferences (
       account_id, notification_type, channel, enabled, quiet_hours_start, quiet_hours_end
     ) VALUES ($1, $2, $3, $4, $5::time, $6::time)
     ON CONFLICT (account_id, notification_type, channel)
     DO UPDATE SET enabled = EXCLUDED.enabled,
                   quiet_hours_start = EXCLUDED.quiet_hours_start,
                   quiet_hours_end = EXCLUDED.quiet_hours_end,
                   updated_at = now()
     RETURNING *`,
    [request.actor.account.id, input.notificationType, input.channel, input.enabled, input.quietHoursStart, input.quietHoursEnd],
  );
  response.json({
    data: { preference: mapNotificationPreference(result.rows[0]) },
    meta: { requestId: request.requestId },
  });
}));

registerShopTalkRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  uploadRateLimit,
  upload,
  s3Client,
  s3Bucket,
  safeObjectName,
  signedObjectUrl,
  runIdempotentMutation,
  sendIdempotentResult,
});

registerCommunityRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
});

registerShopTalkModerationRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  requireV1AdminActor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
  insertAdminAction,
});

registerToolRecordRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
});

registerNetworkRecordRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
});

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
        errorMonitoring: errorMonitoringStatus(),
      },
      controls: operationalControls(),
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
    sessionSecurity: authSecurityStatus(),
  };

  response.json({ providers, inviteRequired: process.env.REQUIRE_PILOT_INVITE === "true", controls: operationalControls() });
});

app.get("/api/auth/google/start", authRateLimit, asyncRoute(async (request, response) => {
  requireAuthSecurity();
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
  inviteCode: z.string().trim().min(5).max(256).optional(),
});

const loginSchema = z.object({
  email: z.email().max(320).transform((value) => normalizeEmail(value)),
  password: z.string().min(1).max(1024),
});

async function handleSignup(request, response) {
  requireAuthSecurity();
  const controls = operationalControls();
  if (controls.signupsDisabled) {
    throw new ApiError(503, "SIGNUPS_DISABLED", "RIVT pilot signups are temporarily closed.", {
      reason: controls.reason,
    });
  }
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
    const credentials = await hashPassword(input.password);
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
       VALUES ($1, $2::uuid, 'account.signup', 'account', ($2::uuid)::text, $3::jsonb)`,
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
    logWarn("email.verification_delivery_failed", { requestId: request.requestId, code: error.code ?? "unknown" });
  }
  const user = buildUserResponse({ ...created.user, account_status: "onboarding", onboarding_status: "draft" });
  if (request.path.startsWith("/api/v1/")) {
    response.status(201).json({ data: { user, verificationRequired: true, verificationDelivered }, meta: { requestId: request.requestId } });
    return;
  }
  response.status(201).json({ ok: true, user, verificationRequired: true, verificationDelivered });
}

async function handleLogin(request, response) {
  requireAuthSecurity();
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
  const passwordValid = user ? await verifyPassword(input.password, user.password_salt, user.password_hash) : false;
  if (!user || !passwordValid) {
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
       VALUES ($1, $2::uuid, 'account.email_verified', 'account', ($2::uuid)::text)`,
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
          `INSERT INTO password_reset_tokens (account_id, token_hash, expires_at)
           VALUES ($1, $2, now() + interval '30 minutes')`,
          [user.id, hashOpaqueToken(raw)],
        );
        return raw;
      });
      if (token) await sendPasswordResetMessage(user.email, token);
    } catch (error) {
      logWarn("email.password_reset_delivery_failed", { requestId: request.requestId, code: error.code ?? "unknown" });
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
    const credentials = await hashPassword(input.password);
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
       VALUES ($1, $2::uuid, 'account.password_reset', 'account', ($2::uuid)::text)`,
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

registerLegacyIntegrationRoutes({
  app,
  appName,
  appSlug,
  database,
  requireAuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  uploadRateLimit,
  upload,
  runWithDatabase,
  mapUploadRow,
  signedObjectUrl,
  signedUrlSeconds,
  requireObjectStorage,
  safeObjectName,
  s3Client,
  s3Bucket,
  integrationStatus,
  buildTwilioSmsStatus,
  getTwilioSmsConfig,
  normalizePhoneNumber,
});

registerBillingRoutes({
  app,
  database,
  appOrigin: productionOrigin,
  requireAuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
});

if (existsSync(distDir)) {
  app.use(express.static(distDir, {
    index: false,
    setHeaders(response, filePath) {
      if (filePath.endsWith("index.html")) {
        response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      } else if (filePath.includes("/assets/")) {
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
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
    void captureOperationalError(error, {
      requestId: request.requestId ?? null,
      method: request.method,
      path: request.path,
      statusCode: error.status ?? 500,
      actorId: request.authUser?.id ?? null,
    });
    logError("http.unhandled_error", {
      requestId: request.requestId ?? null,
      method: request.method,
      path: request.path,
      error,
    });
  }
  if (request.path === "/api/auth/google/callback" && !response.headersSent) {
    response.redirect(`${productionOrigin}/?auth_error=google`);
    return;
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
  await new Promise((resolve, reject) => {
    const srv = app.listen(listenPort, resolve);
    srv.once("error", reject);
  });

  const storage = storageConfiguration();
  logInfo("server.started", {
    appName,
    port: listenPort,
    buildCommit: sourceCommit,
    storageOk: storage.ok,
    errorMonitoring: errorMonitoringStatus().mode,
  });
  if (!storage.ok) {
    logWarn("server.storage_setup_required", { missing: storage.missing });
  }

  if (database) {
    ensureDatabaseReady().then(() => {
      logInfo("server.migrations_ready", { migrationVersion });
    }).catch((error) => {
      logError("server.migration_failed", {
        message: error.message,
        cause: error.cause?.message ?? null,
      });
    });
  }
}

export async function closeDatabase() {
  if (database) {
    await database.end();
  }
}

export { app, ensureDatabaseReady };

if (path.resolve(process.argv[1] ?? "") === __filename) {
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason ?? "Unhandled promise rejection"));
    logError("process.unhandled_rejection", { error });
    void captureOperationalError(error, { source: "process.unhandled_rejection" });
  });

  process.on("uncaughtException", (error) => {
    logError("process.uncaught_exception", { error });
    void captureOperationalError(error, { source: "process.uncaught_exception" })
      .finally(() => {
        process.exit(1);
      });
    setTimeout(() => process.exit(1), 1000).unref();
  });

  startServer().catch((error) => {
    logError("server.startup_failed", { error });
    void captureOperationalError(error, { source: "server.startup_failed" }).finally(() => {
      process.exit(1);
    });
    setTimeout(() => process.exit(1), 2000).unref();
  });
}
