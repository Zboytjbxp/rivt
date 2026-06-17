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
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 365;

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

    if (allowedTypes.has(file.mimetype) || file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    const error = new Error("Unsupported upload type.");
    error.status = 415;
    callback(error);
  },
});

let schemaReadyPromise;

app.use(cors({ origin: true, credentials: true }));
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie ?? "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        if (separator === -1) {
          return [cookie, ""];
        }

        return [
          decodeURIComponent(cookie.slice(0, separator)),
          decodeURIComponent(cookie.slice(separator + 1)),
        ];
      }),
  );
}

function getSessionId(request, response) {
  const cookies = parseCookies(request);
  const existing = cookies[sessionCookieName];
  const sessionId = /^[0-9a-f-]{36}$/i.test(existing ?? "") ? existing : randomUUID();

  response.cookie(sessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: sessionMaxAgeMs,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return sessionId;
}

function setSessionId(response, sessionId) {
  response.cookie(sessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: sessionMaxAgeMs,
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

async function ensureSchema() {
  if (!database) {
    throw new Error("DATABASE_URL is required.");
  }

  schemaReadyPromise ??= database.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id text PRIMARY KEY,
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS app_events (
      id uuid PRIMARY KEY,
      session_id text,
      type text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS app_events_created_at_idx
      ON app_events (created_at DESC);

    CREATE TABLE IF NOT EXISTS uploads (
      id uuid PRIMARY KEY,
      session_id text,
      kind text NOT NULL,
      name text NOT NULL,
      job_id bigint,
      notes text NOT NULL DEFAULT '',
      object_key text,
      original_name text,
      mime_type text,
      size_bytes bigint,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS uploads_created_at_idx
      ON uploads (created_at DESC);

    CREATE INDEX IF NOT EXISTS uploads_job_id_idx
      ON uploads (job_id);

    ALTER TABLE app_events
      ADD COLUMN IF NOT EXISTS session_id text;

    ALTER TABLE uploads
      ADD COLUMN IF NOT EXISTS session_id text;

    CREATE INDEX IF NOT EXISTS app_events_session_id_idx
      ON app_events (session_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS uploads_session_id_idx
      ON uploads (session_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS auth_users (
      id uuid PRIMARY KEY,
      email text NOT NULL UNIQUE,
      email_hash text NOT NULL UNIQUE,
      password_salt text NOT NULL,
      password_hash text NOT NULL,
      provider text NOT NULL DEFAULT 'email',
      display_name text NOT NULL DEFAULT '',
      role text NOT NULL DEFAULT 'contractor',
      organization text NOT NULL DEFAULT '',
      location text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id uuid PRIMARY KEY,
      session_id text NOT NULL UNIQUE,
      user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );

    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
      ON auth_sessions (user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS guest_sessions (
        guest_id text PRIMARY KEY,
          session_token text NOT NULL UNIQUE,
            expires_at timestamptz NOT NULL
            );

            CREATE INDEX IF NOT EXISTS guest_sessions_session_token_idx
            ON guest_sessions (session_token);

            CREATE INDEX IF NOT EXISTS guest_sessions_expires_at_idx
            ON guest_sessions (expires_at);
  `);

  await schemaReadyPromise;
}

async function runWithDatabase(response, next, action) {
  if (!requireDatabase(response)) {
    return;
  }

  try {
    await ensureSchema();
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
      SELECT u.id, u.email, u.provider, u.display_name, u.role, u.organization, u.location
      FROM auth_sessions s
      INNER JOIN auth_users u ON u.id = s.user_id
      WHERE s.session_id = $1 AND s.expires_at > now()
      LIMIT 1
    `,
    [sessionId],
  );

  return result.rowCount ? result.rows[0] : null;
}

async function issueAuthSession(response, userId, sessionId) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + sessionMaxAgeMs);
  await database.query(
    `
      INSERT INTO auth_sessions (id, session_id, user_id, created_at, updated_at, expires_at)
      VALUES ($1, $2, $3, $4, $4, $5)
      ON CONFLICT (session_id)
      DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at
    `,
    [randomUUID(), sessionId, userId, now, expiresAt],
  );
  setSessionId(response, sessionId);
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

function safeRedirectTarget(value, fallback = "/") {
  try {
    const parsed = new URL(String(value ?? ""), "https://rivt.pro");
    if (parsed.origin !== "https://rivt.pro") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
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
  };
}

async function upsertOAuthUser({ email, provider, displayName, role, organization, location }) {
  const emailHash = sha256(email);
  const existing = await database.query(
    "SELECT id, email, provider, display_name, role, organization, location FROM auth_users WHERE email_hash = $1 LIMIT 1",
    [emailHash],
  );

  if (existing.rowCount) {
    const user = await database.query(
      `
        UPDATE auth_users
        SET provider = $2, display_name = $3, role = $4, organization = $5, location = $6, updated_at = now()
        WHERE id = $1
        RETURNING id, email, provider, display_name, role, organization, location
      `,
      [existing.rows[0].id, provider, displayName, role, organization, location],
    );
    return user.rows[0];
  }

  const credentials = hashPassword(randomUUID());
  const inserted = await database.query(
    `
      INSERT INTO auth_users (
        id, email, email_hash, password_salt, password_hash, provider, display_name, role, organization, location
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email, provider, display_name, role, organization, location
    `,
    [
      randomUUID(),
      email,
      emailHash,
      credentials.salt,
      credentials.hash,
      provider,
      displayName,
      role,
      organization,
      location,
    ],
  );
  return inserted.rows[0];
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
    storage,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/storage", async (_request, response, next) => {
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
    const sessionId = getSessionId(request, response);
    const user = await getUserBySessionId(sessionId);
    response.json({ user });
  });
});

app.get("/api/auth/providers", (_request, response) => {
  const providers = {
    google: integrationStatus("google", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "Google sign-in"),
    facebook: integrationStatus("facebook", ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"], "Facebook sign-in"),
    apple: integrationStatus("apple", ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"], "Apple sign-in"),
    email: { ok: true, provider: "email", purpose: "Email/password sign-in", mode: "configured", missing: [] },
  };

  response.json({ providers });
});

app.get("/api/auth/google/start", (request, response) => {
  const status = integrationStatus("google", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "Google sign-in");
  if (!status.ok) {
    response.status(424).json({
      ...status,
      message: "Add Google OAuth credentials before sign-in can start.",
    });
    return;
  }

  const state = randomBytes(16).toString("hex");
  response.cookie(`${sessionCookieName}_oauth_state`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 10,
  });

  const redirectUri = envValue("GOOGLE_REDIRECT_URI", "https://rivt.pro/api/auth/google/callback");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  response.redirect(authUrl.toString());
});

app.get("/api/auth/google/callback", async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const stateCookie = parseCookies(request)[`${sessionCookieName}_oauth_state`];
    if (!stateCookie || stateCookie !== request.query.state) {
      response.status(400).send("Invalid OAuth state.");
      return;
    }

    const code = String(request.query.code ?? "");
    if (!code) {
      response.status(400).send("Missing OAuth code.");
      return;
    }

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
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      response.status(502).send(`Google token exchange failed: ${body}`);
      return;
    }

    const tokenBody = await tokenResponse.json();
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });

    if (!profileResponse.ok) {
      const body = await profileResponse.text();
      response.status(502).send(`Google profile lookup failed: ${body}`);
      return;
    }

    const profile = await profileResponse.json();
    const user = await upsertOAuthUser({
      email: normalizeEmail(profile.email),
      provider: "google",
      displayName: String(profile.name ?? profile.email ?? "RIVT user"),
      role: "contractor",
      organization: `${String(profile.given_name ?? profile.name ?? "Crew")} crew`,
      location: "Jacksonville, FL",
    });

    const sessionId = getSessionId(request, response);
    await issueAuthSession(response, user.id, sessionId);
    response.clearCookie(`${sessionCookieName}_oauth_state`, { sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    response.redirect(`${safeRedirectTarget(request.query.stateFrom ?? "/")}`);
  });
});

app.post("/api/auth/signup", async (request, response, next) => {
  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password ?? "");
  const role = request.body?.role === "tradesperson" ? "tradesperson" : "contractor";
  const displayName = String(request.body?.displayName ?? "").trim();
  const organization = String(request.body?.organization ?? "").trim();
  const location = String(request.body?.location ?? "").trim();

  if (!email || !password || !displayName || !location) {
    response.status(400).json({ ok: false, error: "Email, password, name, and location are required." });
    return;
  }

  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    const existing = await database.query("SELECT id FROM auth_users WHERE email_hash = $1", [sha256(email)]);
    if (existing.rowCount) {
      response.status(409).json({ ok: false, error: "An account with that email already exists." });
      return;
    }

    const credentials = hashPassword(password);
    const userId = randomUUID();
    const result = await database.query(
      `
        INSERT INTO auth_users (
          id, email, email_hash, password_salt, password_hash, provider, display_name, role, organization, location
        )
        VALUES ($1, $2, $3, $4, $5, 'email', $6, $7, $8, $9)
        RETURNING id, email, provider, display_name, role, organization, location
      `,
      [
        userId,
        email,
        sha256(email),
        credentials.salt,
        credentials.hash,
        displayName,
        role,
        organization,
        location,
      ],
    );

    await issueAuthSession(response, userId, sessionId);
    response.status(201).json({ ok: true, user: result.rows[0] });
  });
});

app.post("/api/auth/login", async (request, response, next) => {
  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password ?? "");
  if (!email || !password) {
    response.status(400).json({ ok: false, error: "Email and password are required." });
    return;
  }

  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    const result = await database.query(
      `
        SELECT id, email, password_salt, password_hash, provider, display_name, role, organization, location
        FROM auth_users
        WHERE email_hash = $1
        LIMIT 1
      `,
      [sha256(email)],
    );

    if (!result.rowCount) {
      response.status(401).json({ ok: false, error: "Invalid email or password." });
      return;
    }

    const user = result.rows[0];
    if (!verifyPassword(password, user.password_salt, user.password_hash)) {
      response.status(401).json({ ok: false, error: "Invalid email or password." });
      return;
    }

    await issueAuthSession(response, user.id, sessionId);
    response.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        provider: user.provider,
        display_name: user.display_name,
        role: user.role,
        organization: user.organization,
        location: user.location,
      },
    });
  });
});

app.post("/api/auth/logout", async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    await database.query("DELETE FROM auth_sessions WHERE session_id = $1", [sessionId]);
    response.clearCookie(sessionCookieName, { sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    response.json({ ok: true });
  });
});

app.get("/api/app-state", async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    const result = await database.query(
      "SELECT state, updated_at FROM app_state WHERE id = $1",
      [sessionId],
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

app.put("/api/app-state", async (request, response, next) => {
  if (!request.body || typeof request.body.state !== "object" || request.body.state === null) {
    response.status(400).json({ ok: false, error: "Expected JSON body with a state object." });
    return;
  }

  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    const result = await database.query(
      `
        INSERT INTO app_state (id, state, updated_at)
        VALUES ($1, $2::jsonb, now())
        ON CONFLICT (id)
        DO UPDATE SET state = EXCLUDED.state, updated_at = now()
        RETURNING updated_at
      `,
      [sessionId, JSON.stringify(request.body.state)],
    );

    response.json({ ok: true, updatedAt: result.rows[0].updated_at });
  });
});

// POST /api/auth/guest - Create a guest session
app.post("/api/auth/guest", async (request, response) => {
    try {
          // Generate guest session token
          const guestId = `guest_${randomUUID()}`;
          const guestToken = randomBytes(32).toString('hex');
          const expiryTime = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

          // Set session cookie
          response.setHeader('Set-Cookie', [
                  `${sessionCookieName}=${guestToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${24 * 60 * 60}`
                ]);

          // Store guest session if database is available
          if (database) {
                  await database.query(
                            `INSERT INTO guest_sessions (guest_id, session_token, expires_at) 
                                     VALUES ($1, $2, $3) 
                                              ON CONFLICT (guest_id) DO UPDATE SET session_token = $2, expires_at = $3`,
                            [guestId, guestToken, expiryTime]
                          );
          }

          // Return guest user profile
          response.json({
                  user: {
                            id: guestId,
                            email: null,
                            provider: 'guest',
                            display_name: 'Guest User',
                            role: 'guest',
                            organization: '',
                            location: '',
                            isGuest: true,
                            sessionExpiry: expiryTime.getTime()
                  }
          });
    } catch (error) {
          console.error('Guest login error:', error);
          response.status(500).json({ error: 'Guest login failed' });
    }
});

app.post("/api/events", async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
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
      [event.id, sessionId, event.type, JSON.stringify(event.payload)],
    );

    response.status(201).json({ ok: true, event: result.rows[0] });
  });
});

app.get("/api/payments/export.csv", async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    const result = await database.query("SELECT state FROM app_state WHERE id = $1", [sessionId]);
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

app.get("/api/uploads", async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    const result = await database.query(
      `
        SELECT *
        FROM uploads
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 200
      `,
      [sessionId],
    );
    const uploads = await Promise.all(
      result.rows.map(async (row) => mapUploadRow(row, await signedObjectUrl(row.object_key))),
    );

    response.json({ uploads });
  });
});

app.get("/api/uploads/:id/url", async (request, response, next) => {
  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    const result = await database.query(
      "SELECT object_key FROM uploads WHERE id = $1 AND session_id = $2",
      [request.params.id, sessionId],
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

app.post("/api/uploads", upload.single("file"), async (request, response, next) => {
  if (!requireObjectStorage(response)) {
    return;
  }

  if (!request.file) {
    response.status(400).json({ ok: false, error: "A file field named `file` is required." });
    return;
  }

  await runWithDatabase(response, next, async () => {
    const sessionId = getSessionId(request, response);
    const id = randomUUID();
    const kind = request.body?.kind ?? "record";
    const jobId = Number(request.body?.jobId);
    const objectKey = `${safeObjectName(kind)}/${new Date().toISOString().slice(0, 10)}/${id}-${safeObjectName(
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
        sessionId,
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

app.post("/api/identity/verify", (request, response) => {
  const status = integrationStatus("identity", ["IDENTITY_PROVIDER_KEY"], "government ID verification");

  if (!status.ok) {
    response.status(424).json({
      ...status,
      message: "Connect Persona, Stripe Identity, or another ID provider before running live verifications.",
    });
    return;
  }

  response.json({
    ...status,
    verificationId: `idv_${Date.now()}`,
    userId: request.body?.userId ?? "current-user",
    result: "queued",
  });
});

app.post("/api/subscriptions/checkout", (request, response) => {
  const status = integrationStatus("stripe", ["STRIPE_SECRET_KEY"], "subscription billing");

  if (!status.ok) {
    response.status(424).json({
      ...status,
      message: "Add Stripe keys before sending real customers through subscription checkout.",
    });
    return;
  }

  response.json({
    ...status,
    checkoutUrl: process.env.STRIPE_CHECKOUT_URL ?? "https://dashboard.stripe.com/test/checkouts",
    plan: request.body?.plan ?? "base",
  });
});

app.post("/api/notifications/test", (request, response) => {
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

app.post("/api/invoices/send", async (request, response) => {
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
      const detail = await sendResponse.text();
      response.status(502).json({
        ok: false,
        ...status,
        message: "Resend rejected the invoice email.",
        detail,
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
    const detail = await sendResponse.text();
    response.status(502).json({
      ok: false,
      ...status,
      message: "Twilio rejected the invoice SMS.",
      detail,
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
    setHeaders(response, filePath) {
      if (filePath.endsWith("index.html")) {
        response.setHeader("Cache-Control", "no-store");
      }
    },
  }));
  app.use((request, response, next) => {
    if (request.path.startsWith("/api/")) {
      next();
      return;
    }

    response.setHeader("Cache-Control", "no-store");
    response.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status ?? 500).json({
    ok: false,
    error: error.status ? error.message : `${appName} API error`,
    detail: process.env.NODE_ENV === "production" ? undefined : error.message,
  });
});

if (database) {
  ensureSchema().catch((error) => {
    console.error("Database schema setup failed", error);
  });
}

app.listen(port, () => {
  const storage = storageConfiguration();
  console.log(`${appName} API listening on http://127.0.0.1:${port}`);
  if (!storage.ok) {
    console.warn(`Managed storage setup required: ${storage.missing.join(", ")}`);
  }
});
