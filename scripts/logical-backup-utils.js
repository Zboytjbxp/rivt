import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetObjectLockConfigurationCommand,
  GetObjectRetentionCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";

export const MIN_BACKUP_RETENTION_DAYS = 30;
export const DEFAULT_BACKUP_MAX_AGE_HOURS = 14;
export const DEFAULT_RECOVERY_RTO_MINUTES = 240;
export const DEFAULT_BACKUP_JOB_TIMEOUT_MINUTES = 45;
export const MAX_BACKUP_JOB_TIMEOUT_MINUTES = 60;
export const MAX_ENCRYPTED_BACKUP_BYTES = 512 * 1024 * 1024;
export const MAX_NEW_LOGICAL_BACKUP_BYTES = 16 * 1024 * 1024;
export const MAX_DECOMPRESSED_BACKUP_BYTES = 1024 * 1024 * 1024;
export const MAX_PROVIDER_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const BACKUP_SLOT_HOURS = 12;
export const MAX_BACKUP_WRITES_PER_UTC_MONTH = 62;
export const LOGICAL_BACKUP_FORMAT_V2 = "rivt-logical-backup-v2";
export const LOGICAL_BACKUP_MANIFEST_FORMAT_V2 = "rivt-logical-backup-manifest-v2";
export const ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2 = "rivt-encrypted-logical-backup-v2";
export const POSTGRES_TEXT_ROW_ENCODING = "postgres-text-v1";

export class BackupConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BackupConfigurationError";
    this.code = code;
  }
}

export function isDirectExecution(metaUrl) {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === metaUrl;
}

export function sanitizedFailure(error, mode) {
  const safeCodes = new Set([
    "BACKUP_CONFIG_INVALID",
    "BACKUP_DATABASE_SCOPE_UNSAFE",
    "BACKUP_DATABASE_ROLE_UNSAFE",
    "BACKUP_DESTINATION_UNSAFE",
    "BACKUP_NOT_FRESH",
    "BACKUP_OBJECT_INVALID",
    "BACKUP_PROVIDER_CHECK_FAILED",
    "BACKUP_SOURCE_MISMATCH",
    "BACKUP_ALERT_TEST",
    "BACKUP_RESTORE_FAILED",
    "BACKUP_RTO_EXCEEDED",
    "BACKUP_JOB_TIMEOUT",
    "BACKUP_ALREADY_RUNNING",
    "BACKUP_JOB_INTERRUPTED",
    "BACKUP_WRITE_WINDOW_CLOSED",
    "BACKUP_CADENCE_LIMIT_REACHED",
    "BACKUP_UPLOAD_LIMIT_EXCEEDED",
  ]);
  const errorCode = safeCodes.has(error?.code) ? error.code : "BACKUP_OPERATION_FAILED";
  const safeMessages = {
    BACKUP_CONFIG_INVALID: "Backup configuration is incomplete or invalid.",
    BACKUP_DATABASE_SCOPE_UNSAFE: "The database schema cannot be backed up completely by this logical backup format.",
    BACKUP_DATABASE_ROLE_UNSAFE: "The backup database role is not read-only.",
    BACKUP_DESTINATION_UNSAFE: "The backup destination does not meet the required protection policy.",
    BACKUP_NOT_FRESH: "No sufficiently recent protected backup was found.",
    BACKUP_OBJECT_INVALID: "The named backup artifact did not pass integrity and retention checks.",
    BACKUP_PROVIDER_CHECK_FAILED: "The backup provider could not be verified.",
    BACKUP_SOURCE_MISMATCH: "The backup source revision did not match the expected running revision.",
    BACKUP_ALERT_TEST: "The backup freshness alert test was requested.",
    BACKUP_RESTORE_FAILED: "The isolated restore did not complete successfully.",
    BACKUP_RTO_EXCEEDED: "The restore and verification exceeded the approved recovery time objective.",
    BACKUP_JOB_TIMEOUT: "The scheduled backup exceeded its maximum runtime and was stopped.",
    BACKUP_ALREADY_RUNNING: "Another logical backup is already running.",
    BACKUP_JOB_INTERRUPTED: "The scheduled backup was stopped before it completed.",
    BACKUP_WRITE_WINDOW_CLOSED: "The approved backup write window is not active.",
    BACKUP_CADENCE_LIMIT_REACHED: "The protected backup slot already contains an accepted write.",
    BACKUP_UPLOAD_LIMIT_EXCEEDED: "The new backup exceeds the fixed upload safety limit.",
    BACKUP_OPERATION_FAILED: "The backup operation failed.",
  };
  return { ok: false, mode, errorCode, message: safeMessages[errorCode] };
}

export function sanitizedSuccess(result) {
  const allowed = [
    "ok",
    "mode",
    "createdAt",
    "uploadedAt",
    "writeAcceptedAt",
    "sourceCommit",
    "backupCreatedAt",
    "backupSourceCommit",
    "retentionDays",
    "retentionUntil",
    "byteLength",
    "backupSlotStartAt",
    "writeWindowStartAt",
    "writeWindowEndAt",
    "ageHours",
    "durationMs",
    "restoreDurationMs",
    "verificationDurationMs",
    "combinedDurationMs",
    "rtoMinutes",
    "latestMigration",
    "appliedMigrations",
    "pendingMigrations",
    "strictCounts",
    "strictCompare",
    "encryptionKeyMode",
    "contentDigest",
    "contentDiffCount",
    "tableCount",
    "rowCount",
  ];
  const receipt = Object.fromEntries(
    allowed
      .filter((name) => result[name] !== undefined)
      .map((name) => [name, result[name]]),
  );
  if (
    result.endpoint
    && result.region
    && result.bucket
    && result.prefix
    && typeof result.forcePathStyle === "boolean"
  ) {
    receipt.destinationIdentitySha256 = backupDestinationIdentitySha256(result);
  }
  if (result.bucket && result.key && result.versionId && result.sha256) {
    receipt.artifactIdentitySha256 = sha256Hex(
      Buffer.from(`${result.bucket}\0${result.key}\0${result.versionId}\0${result.sha256}`),
    );
  }
  if (Array.isArray(result.countDiffs)) receipt.countDiffCount = result.countDiffs.length;
  return receipt;
}

export function positiveInteger(value, name, defaultValue) {
  const raw = value?.trim() || String(defaultValue);
  if (!/^\d+$/.test(raw)) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", `${name} must be a positive integer.`);
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", `${name} must be a positive integer.`);
  }
  return parsed;
}

export function requireConfiguredEnv(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", `${name} is required.`);
  }
  return value;
}

export function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is required.`);
    process.exit(1);
  }
  return value;
}

export function normalizeS3Prefix(rawPrefix) {
  const prefix = rawPrefix.trim().replace(/^\/+|\/+$/g, "");
  if (
    !prefix
    || prefix.includes("\\")
    || prefix.includes("//")
    || prefix.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The configured S3 prefix is invalid.");
  }
  return prefix;
}

export function assertObjectKeyInPrefix(key, prefix) {
  if (!key.startsWith(`${prefix}/`) || key.slice(prefix.length + 1).includes("..")) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The backup object key is outside the configured prefix.");
  }
  return key;
}

export function validateHttpsEndpoint(rawEndpoint) {
  let endpoint;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The S3 endpoint is invalid.");
  }
  if (
    endpoint.protocol !== "https:"
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || (endpoint.pathname && endpoint.pathname !== "/")
  ) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The S3 endpoint must be an HTTPS origin.");
  }
  return endpoint.origin;
}

export function assertNodeTlsVerificationEnabled(env = process.env) {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED?.trim() === "0") {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Backup and restore processes cannot run with Node TLS certificate verification disabled.",
    );
  }
}

export function s3ConfigFromEnv(namespace, env = process.env) {
  assertNodeTlsVerificationEnabled(env);
  const endpoint = validateHttpsEndpoint(requireConfiguredEnv(`${namespace}_ENDPOINT`, env));
  const region = requireConfiguredEnv(`${namespace}_REGION`, env);
  const bucket = requireConfiguredEnv(`${namespace}_BUCKET`, env);
  const prefix = normalizeS3Prefix(requireConfiguredEnv(`${namespace}_PREFIX`, env));
  const accessKeyId = requireConfiguredEnv(`${namespace}_ACCESS_KEY_ID`, env);
  const secretAccessKey = requireConfiguredEnv(`${namespace}_SECRET_ACCESS_KEY`, env);
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The configured S3 bucket name is invalid.");
  }
  if (env.S3_BUCKET?.trim() && env.S3_BUCKET.trim() === bucket) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The backup bucket must be separate from the application object-storage bucket.",
    );
  }
  if (env.S3_ACCESS_KEY_ID?.trim() && env.S3_ACCESS_KEY_ID.trim() === accessKeyId) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Backup storage must use a dedicated least-privilege access key.",
    );
  }
  if (
    namespace === "RESTORE_SOURCE_S3"
    && env.BACKUP_DESTINATION_S3_ACCESS_KEY_ID?.trim()
    && env.BACKUP_DESTINATION_S3_ACCESS_KEY_ID.trim() === accessKeyId
  ) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Restore verification must use a separate read-only storage key, not the backup upload key.",
    );
  }
  return {
    endpoint,
    region,
    bucket,
    prefix,
    forcePathStyle: env[`${namespace}_FORCE_PATH_STYLE`]?.trim() === "true",
    credentials: { accessKeyId, secretAccessKey },
  };
}

export function destinationS3Config(env = process.env) {
  return s3ConfigFromEnv("BACKUP_DESTINATION_S3", env);
}

export function restoreSourceS3Config(env = process.env) {
  return s3ConfigFromEnv("RESTORE_SOURCE_S3", env);
}

export function s3ClientForConfig(config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: config.credentials,
  });
}

export function requiredSourceCommit(env = process.env, name = "SOURCE_COMMIT") {
  const sourceCommit = requireConfiguredEnv(name, env).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", `${name} must be a full 40-character Git commit SHA.`);
  }
  const railwayRuntime = [
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_SERVICE_ID",
    "RAILWAY_DEPLOYMENT_ID",
  ].some((variableName) => Boolean(env[variableName]?.trim()));
  const railwayCommit = env.RAILWAY_GIT_COMMIT_SHA?.trim().toLowerCase();
  if (railwayRuntime && !railwayCommit) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "RAILWAY_GIT_COMMIT_SHA is required for a Railway backup runtime.",
    );
  }
  if (railwayCommit) {
    if (!/^[a-f0-9]{40}$/.test(railwayCommit)) {
      throw new BackupConfigurationError(
        "BACKUP_CONFIG_INVALID",
        "RAILWAY_GIT_COMMIT_SHA must be a full 40-character Git commit SHA.",
      );
    }
    if (sourceCommit !== railwayCommit) {
      throw new BackupConfigurationError(
        "BACKUP_SOURCE_MISMATCH",
        "SOURCE_COMMIT does not match the Railway deployment commit.",
      );
    }
  }
  return sourceCommit;
}

export function backupJobTimeoutMsFromEnv(env = process.env) {
  const minutes = positiveInteger(
    env.BACKUP_JOB_TIMEOUT_MINUTES,
    "BACKUP_JOB_TIMEOUT_MINUTES",
    DEFAULT_BACKUP_JOB_TIMEOUT_MINUTES,
  );
  if (minutes > MAX_BACKUP_JOB_TIMEOUT_MINUTES) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      `BACKUP_JOB_TIMEOUT_MINUTES cannot exceed ${MAX_BACKUP_JOB_TIMEOUT_MINUTES}.`,
    );
  }
  return minutes * 60_000;
}

export async function acquireLogicalBackupLock(client) {
  const result = await client.query(
    "SELECT pg_try_advisory_lock(hashtextextended('rivt-logical-backup-v2', 0)) AS acquired",
  );
  if (result.rows?.[0]?.acquired !== true) {
    throw new BackupConfigurationError("BACKUP_ALREADY_RUNNING", "Another logical backup session holds the lock.");
  }
}

export function retentionDaysFromEnv(env = process.env) {
  const days = positiveInteger(env.BACKUP_RETENTION_DAYS, "BACKUP_RETENTION_DAYS", MIN_BACKUP_RETENTION_DAYS);
  if (days < MIN_BACKUP_RETENTION_DAYS) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      `BACKUP_RETENTION_DAYS must be at least ${MIN_BACKUP_RETENTION_DAYS}.`,
    );
  }
  return days;
}

export function maxBackupAgeHoursFromEnv(env = process.env) {
  const hours = positiveInteger(env.BACKUP_MAX_AGE_HOURS, "BACKUP_MAX_AGE_HOURS", DEFAULT_BACKUP_MAX_AGE_HOURS);
  if (hours > DEFAULT_BACKUP_MAX_AGE_HOURS) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      `BACKUP_MAX_AGE_HOURS cannot exceed ${DEFAULT_BACKUP_MAX_AGE_HOURS}.`,
    );
  }
  return hours;
}

export function recoveryRtoMinutesFromEnv(env = process.env) {
  const minutes = positiveInteger(env.RECOVERY_RTO_MINUTES, "RECOVERY_RTO_MINUTES", DEFAULT_RECOVERY_RTO_MINUTES);
  if (minutes > DEFAULT_RECOVERY_RTO_MINUTES) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      `RECOVERY_RTO_MINUTES cannot exceed ${DEFAULT_RECOVERY_RTO_MINUTES}.`,
    );
  }
  return minutes;
}

export function enforceRecoveryRto(restoreDurationMs, verificationDurationMs, rtoMinutes) {
  if (
    !Number.isSafeInteger(restoreDurationMs)
    || restoreDurationMs < 0
    || !Number.isSafeInteger(verificationDurationMs)
    || verificationDurationMs < 0
  ) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "Recovery durations must be nonnegative integers.");
  }
  const combinedDurationMs = restoreDurationMs + verificationDurationMs;
  if (!Number.isSafeInteger(combinedDurationMs) || combinedDurationMs > rtoMinutes * 60_000) {
    throw new BackupConfigurationError("BACKUP_RTO_EXCEEDED", "Restore and verification exceeded the RTO.");
  }
  return { restoreDurationMs, verificationDurationMs, combinedDurationMs, rtoMinutes };
}

export function sslFor(url, env = process.env) {
  assertNodeTlsVerificationEnabled(env);
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.toLowerCase();
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (loopback) return false;
  const sslMode = parsedUrl.searchParams.get("sslmode")?.toLowerCase();
  const unsafeUrlTlsOption = parsedUrl.searchParams.has("ssl")
    || (sslMode && sslMode !== "verify-full");
  const envSslMode = env.PGSSLMODE?.trim().toLowerCase();
  if (
    env.PGSSL?.trim() === "disable"
    || unsafeUrlTlsOption
    || (envSslMode && envSslMode !== "verify-full")
  ) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Remote backup and restore database connections must verify TLS.",
    );
  }
  const ca = env.PGSSL_CA?.replaceAll("\\n", "\n").trim();
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
}

export function poolFor(url, env = process.env) {
  return new pg.Pool({
    connectionString: url,
    ssl: sslFor(url, env),
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export async function beginReadOnlyBackupSnapshot(client) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '60s'");
  await configureCanonicalTextSession(client, { local: true });
}

// Compatibility helper for the pre-hardening test and local fidelity harness.
// Production backup creation uses beginReadOnlyBackupSnapshot() directly so its
// stricter catalog and role checks cannot be bypassed through this wrapper.
export async function withCanonicalReadSnapshot(client, work) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL DateStyle = 'ISO, YMD'");
    await client.query("SET LOCAL IntervalStyle = 'iso_8601'");
    await client.query("SET LOCAL bytea_output = 'hex'");
    await client.query("SET LOCAL extra_float_digits = 3");
    const result = await work();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function configureCanonicalTextSession(client, { local = false } = {}) {
  const scope = local ? " LOCAL" : "";
  await client.query(`SET${scope} TIME ZONE 'UTC'`);
  await client.query(`SET${scope} DateStyle TO 'ISO, YMD'`);
  await client.query(`SET${scope} IntervalStyle TO 'postgres'`);
  await client.query(`SET${scope} bytea_output TO 'hex'`);
  await client.query(`SET${scope} extra_float_digits TO 3`);
}

export async function assertBackupDatabaseRoleReadOnly(client) {
  const result = await client.query(`
    SELECT
      r.rolsuper,
      r.rolcreatedb,
      r.rolcreaterole,
      r.rolreplication,
      r.rolbypassrls,
      has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
      has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
          AND (
            has_table_privilege(current_user, c.oid, 'INSERT')
            OR has_table_privilege(current_user, c.oid, 'UPDATE')
            OR has_table_privilege(current_user, c.oid, 'DELETE')
            OR has_table_privilege(current_user, c.oid, 'TRUNCATE')
            OR has_table_privilege(current_user, c.oid, 'REFERENCES')
            OR has_table_privilege(current_user, c.oid, 'TRIGGER')
          )
      ) AS table_write,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND NOT has_table_privilege(current_user, c.oid, 'SELECT')
      ) AS table_read_missing,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND NOT has_column_privilege(current_user, c.oid, a.attnum, 'SELECT')
      ) AS column_read_missing,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'S'
          AND (
            has_sequence_privilege(current_user, c.oid, 'USAGE')
            OR has_sequence_privilege(current_user, c.oid, 'UPDATE')
          )
      ) AS sequence_write,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'S'
          AND NOT has_sequence_privilege(current_user, c.oid, 'SELECT')
      ) AS sequence_read_missing,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND (c.relrowsecurity OR c.relforcerowsecurity)
      ) AS row_security_enabled,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p')
          AND n.nspname <> 'public'
          AND n.nspname <> 'information_schema'
          AND n.nspname !~ '^pg_'
      ) AS application_table_outside_public,
      EXISTS (
        SELECT 1
        FROM pg_roles assumable
        WHERE assumable.oid <> r.oid
          AND pg_has_role(r.oid, assumable.oid, 'SET')
      ) AS set_role_membership
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);
  const permissions = result.rows[0];
  if (!permissions || Object.values(permissions).some(Boolean)) {
    throw new BackupConfigurationError(
      "BACKUP_DATABASE_ROLE_UNSAFE",
      "BACKUP_DATABASE_URL must authenticate as a dedicated read-only database role.",
    );
  }
}

export async function assertBackupCatalogComplete(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND (c.relrowsecurity OR c.relforcerowsecurity)
      ) AS row_security_enabled,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p')
          AND n.nspname <> 'public'
          AND n.nspname <> 'information_schema'
          AND n.nspname !~ '^pg_'
      ) AS application_table_outside_public,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_inherits inheritance
        JOIN pg_catalog.pg_class child ON child.oid = inheritance.inhrelid
        JOIN pg_catalog.pg_namespace child_namespace ON child_namespace.oid = child.relnamespace
        JOIN pg_catalog.pg_class parent ON parent.oid = inheritance.inhparent
        JOIN pg_catalog.pg_namespace parent_namespace ON parent_namespace.oid = parent.relnamespace
        WHERE child_namespace.nspname = 'public'
           OR parent_namespace.nspname = 'public'
      ) AS inheritance_or_partitioning_present
  `);
  const scope = result.rows[0];
  if (!scope || Object.values(scope).some(Boolean)) {
    throw new BackupConfigurationError(
      "BACKUP_DATABASE_SCOPE_UNSAFE",
      "The logical backup supports only complete non-RLS public tables without inheritance or partitioning.",
    );
  }
}

export function databaseIdentity(connectionString) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    username: url.username,
  };
}

export function assertDifferentDatabases(sourceUrl, targetUrl) {
  if (sourceUrl === targetUrl) {
    throw new Error("Source and target database URLs must not match.");
  }
  const source = databaseIdentity(sourceUrl);
  const target = databaseIdentity(targetUrl);
  if (
    source.host === target.host &&
    source.port === target.port &&
    source.database === target.database
  ) {
    throw new Error("Source and target database identities match even if their usernames differ. Refusing to continue.");
  }
}

export async function runtimeDatabaseIdentity(client) {
  let result;
  try {
    result = await client.query(`
      SELECT
        control.system_identifier::text AS system_identifier,
        database.oid::text AS database_oid,
        current_database() AS database_name
      FROM pg_catalog.pg_database database
      CROSS JOIN LATERAL pg_catalog.pg_control_system() control
      WHERE database.datname = current_database()
    `);
  } catch (error) {
    const wrapped = new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Runtime PostgreSQL identity could not be established before restore.",
    );
    wrapped.cause = error;
    throw wrapped;
  }
  const identity = result.rows[0];
  if (
    result.rows.length !== 1
    || !/^\d+$/.test(identity?.system_identifier ?? "")
    || !/^\d+$/.test(identity?.database_oid ?? "")
    || typeof identity?.database_name !== "string"
    || !identity.database_name
  ) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Runtime PostgreSQL identity could not be established before restore.",
    );
  }
  return {
    systemIdentifier: identity.system_identifier,
    databaseOid: identity.database_oid,
    databaseName: identity.database_name,
  };
}

export function assertDifferentRuntimeDatabases(source, target) {
  if (source.systemIdentifier === target.systemIdentifier) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Restore source and target resolve to the same runtime PostgreSQL cluster.",
    );
  }
}

export function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

export function qualified(tableName) {
  return `${quoteIdentifier("public")}.${quoteIdentifier(tableName)}`;
}

export async function publicTables(client) {
  const result = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  `);
  return result.rows.map((row) => row.table_name);
}

export async function tableColumns(client, tableName) {
  const result = await client.query(`
    SELECT
      a.attname AS column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS type_name,
      CASE WHEN a.attgenerated = '' THEN 'NEVER' ELSE 'ALWAYS' END AS is_generated,
      CASE a.attidentity
        WHEN 'a' THEN 'ALWAYS'
        WHEN 'd' THEN 'BY DEFAULT'
        ELSE NULL
      END AS identity_generation
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = $1
      AND c.relkind IN ('r', 'p')
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum
  `, [tableName]);
  return result.rows
    .filter((row) => row.is_generated !== "ALWAYS")
    .map((row) => row.type_name !== undefined
      ? {
          name: row.column_name,
          typeName: row.type_name,
          identityGeneration: row.identity_generation,
        }
      : {
          name: row.column_name,
          dataType: row.data_type,
          identityGeneration: row.identity_generation,
        });
}

export async function foreignKeyDependencies(client, tables) {
  const result = await client.query(`
    SELECT
      tc.table_name AS table_name,
      ccu.table_name AS referenced_table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
  `);
  const tableSet = new Set(tables);
  return result.rows
    .filter((row) => tableSet.has(row.table_name) && tableSet.has(row.referenced_table_name))
    .map((row) => ({ tableName: row.table_name, referencedTableName: row.referenced_table_name }))
    .filter((edge) => edge.tableName !== edge.referencedTableName);
}

export function orderedTables(tables, dependencies) {
  const tableSet = new Set(tables);
  const incoming = new Map(tables.map((tableName) => [tableName, new Set()]));
  const outgoing = new Map(tables.map((tableName) => [tableName, new Set()]));

  for (const dependency of dependencies) {
    incoming.get(dependency.tableName)?.add(dependency.referencedTableName);
    outgoing.get(dependency.referencedTableName)?.add(dependency.tableName);
  }

  const ready = tables.filter((tableName) => incoming.get(tableName)?.size === 0).sort();
  const ordered = [];
  while (ready.length) {
    const tableName = ready.shift();
    if (!tableSet.has(tableName)) continue;
    ordered.push(tableName);
    tableSet.delete(tableName);
    for (const dependent of outgoing.get(tableName) ?? []) {
      incoming.get(dependent)?.delete(tableName);
      if (incoming.get(dependent)?.size === 0) ready.push(dependent);
    }
    ready.sort();
  }

  if (tableSet.size) {
    throw new Error(`Cannot determine restore order because foreign keys contain a cycle: ${[...tableSet].join(", ")}`);
  }
  return ordered;
}

export async function rowsForTable(client, tableName, columns) {
  if (!columns.length) return [];
  const selectedColumns = columns.map((column) => {
    const identifier = quoteIdentifier(column.name);
    return `${identifier}::text AS ${identifier}`;
  }).join(", ");
  const result = await client.query(`SELECT ${selectedColumns} FROM ONLY ${qualified(tableName)}`);
  return result.rows;
}

function canonicalBackupValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { type: "Buffer", data: [...value] };
  if (Array.isArray(value)) return value.map(canonicalBackupValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalBackupValue(value[key])]),
    );
  }
  if (value === undefined) return { type: "undefined" };
  return value;
}

export function canonicalTableDigest(rows, columns) {
  const columnNames = columns.map((column) => typeof column === "string" ? column : column.name);
  const encodedRows = rows.map((row) => JSON.stringify(
    columnNames.map((columnName) => canonicalBackupValue(row[columnName])),
  )).sort();
  const digest = crypto.createHash("sha256");
  digest.update(JSON.stringify(columnNames));
  for (const encodedRow of encodedRows) {
    digest.update(`\0${Buffer.byteLength(encodedRow)}\0`);
    digest.update(encodedRow);
  }
  return digest.digest("hex");
}

function canonicalTextRow(columns, row) {
  return columns.map((column) => {
    const value = row[column.name];
    if (value === null) return null;
    if (typeof value !== "string") {
      throw new Error(`Canonical PostgreSQL value for ${column.name} must be text or null.`);
    }
    return value;
  });
}

// Version-1 digest compatibility is intentionally isolated from the v2
// protected-artifact digest path. Existing encrypted v1 backups and their
// fidelity tests can still be read without changing v2 canonicalization.
export function tableContentDigest(tableName, columns, rows) {
  const canonicalRows = rows
    .map((row) => JSON.stringify(canonicalTextRow(columns, row)))
    .sort();
  const preimage = JSON.stringify([
    "rivt-table-content-digest-v1",
    tableName,
    columns.map((column) => [column.name, column.formattedType ?? null]),
    canonicalRows,
  ]);
  return crypto.createHash("sha256").update(preimage).digest("hex");
}

export function databaseContentDigest(tableDigests) {
  const preimage = JSON.stringify([
    "rivt-database-content-digest-v1",
    Object.entries(tableDigests).sort(([left], [right]) => left.localeCompare(right)),
  ]);
  return crypto.createHash("sha256").update(preimage).digest("hex");
}

export function integrityForTables(tables) {
  const tableDigests = Object.fromEntries(
    [...tables]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((table) => [table.name, tableContentDigest(table.name, table.columns, table.rows)]),
  );
  return {
    format: "rivt-logical-backup-integrity-v1",
    algorithm: "sha256",
    canonicalization: "postgresql-text-v1",
    tableDigests,
    databaseDigest: databaseContentDigest(tableDigests),
  };
}

export function diffContentDigests(expectedDigests, actualDigests) {
  const tableNames = new Set([
    ...Object.keys(expectedDigests ?? {}),
    ...Object.keys(actualDigests ?? {}),
  ]);
  return [...tableNames]
    .sort()
    .flatMap((tableName) => {
      if (!(tableName in (expectedDigests ?? {}))) return [{ tableName, reason: "unexpected" }];
      if (!(tableName in (actualDigests ?? {}))) return [{ tableName, reason: "missing" }];
      if (expectedDigests[tableName] !== actualDigests[tableName]) {
        return [{ tableName, reason: "mismatch" }];
      }
      return [];
    });
}

export function snapshotTableDigests(tables) {
  return Object.fromEntries(
    [...tables]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((table) => [table.name, canonicalTableDigest(table.rows, table.columns)]),
  );
}

export async function databaseTableDigests(client, tables) {
  const digests = {};
  for (const table of [...tables].sort((left, right) => left.name.localeCompare(right.name))) {
    const rows = await rowsForTable(client, table.name, table.columns);
    digests[table.name] = canonicalTableDigest(rows, table.columns);
  }
  return digests;
}

export function aggregateTableDigest(tableDigests) {
  return sha256Hex(Buffer.from(JSON.stringify(
    Object.fromEntries(Object.entries(tableDigests).sort(([left], [right]) => left.localeCompare(right))),
  )));
}

export function diffTableDigests(expected, actual) {
  return Object.keys(expected).sort()
    .filter((tableName) => expected[tableName] !== actual[tableName])
    .map((tableName) => ({ tableName }));
}

export async function countTableRows(client, tables) {
  const counts = {};
  for (const tableName of tables) {
    const result = await client.query(`SELECT count(*)::integer AS count FROM ONLY ${qualified(tableName)}`);
    counts[tableName] = result.rows[0].count;
  }
  return counts;
}

export async function sequenceStates(client) {
  const result = await client.query(`
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);
  const states = [];
  for (const row of result.rows) {
    const sequenceName = row.sequence_name;
    const state = await client.query(`SELECT last_value, is_called FROM ${qualified(sequenceName)}`);
    states.push({
      sequenceName,
      lastValue: state.rows[0].last_value,
      isCalled: state.rows[0].is_called,
    });
  }
  return states;
}

export async function truncateTarget(client, tables) {
  if (!tables.length) return;
  await client.query(`TRUNCATE ${tables.map(qualified).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function setUserTriggers(client, tables, enabled) {
  for (const tableName of tables) {
    await client.query(`ALTER TABLE ${qualified(tableName)} ${enabled ? "ENABLE" : "DISABLE"} TRIGGER USER`);
  }
}

export async function insertBatch(client, tableName, columns, rows, { rowEncoding } = {}) {
  if (!rows.length || !columns.length) return;
  const columnNames = columns.map((column) => column.name);
  const columnSql = columnNames.map(quoteIdentifier).join(", ");
  const hasSystemIdentity = columns.some((column) => column.identityGeneration === "ALWAYS");
  const values = [];
  const tuples = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      const value = row[column.name];
      values.push(
        rowEncoding !== POSTGRES_TEXT_ROW_ENCODING
          && (column.dataType === "json" || column.dataType === "jsonb")
          && value !== null
          && value !== undefined
          ? JSON.stringify(value)
          : value,
      );
      return `$${rowIndex * columnNames.length + columnIndex + 1}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  const overriding = hasSystemIdentity ? " OVERRIDING SYSTEM VALUE" : "";
  await client.query(
    `INSERT INTO ${qualified(tableName)} (${columnSql})${overriding} VALUES ${tuples.join(", ")}`,
    values,
  );
}

export async function restoreSequences(client, states) {
  for (const state of states) {
    await client.query("SELECT setval($1::regclass, $2::bigint, $3::boolean)", [
      `public.${quoteIdentifier(state.sequenceName)}`,
      state.lastValue,
      state.isCalled,
    ]);
  }
}

export function backupEncryptionSecret(env = process.env) {
  return [
    env.BACKUP_ENCRYPTION_KEY,
    env.RIVT_BACKUP_ENCRYPTION_KEY,
    env.BACKUP_SECRET,
  ].map((value) => value?.trim()).find(Boolean) ?? "";
}

export function previousBackupEncryptionSecret(env = process.env) {
  return [
    env.BACKUP_ENCRYPTION_KEY_PREVIOUS,
    env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS,
  ].map((value) => value?.trim()).find(Boolean) ?? "";
}

export function strictEncryptionKeyFromSecret(secret) {
  if (typeof secret !== "string" || !secret.trim()) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "A 32-byte backup encryption key is required.");
  }
  const normalized = secret.trim();
  if (/^[a-f0-9]{64}$/i.test(normalized)) return Buffer.from(normalized, "hex");
  if (/^[A-Za-z0-9+/]{43}=$/.test(normalized)) {
    const decoded = Buffer.from(normalized, "base64");
    if (decoded.length === 32 && decoded.toString("base64") === normalized) return decoded;
  }
  if (/^[A-Za-z0-9_-]{43}$/.test(normalized)) {
    const decoded = Buffer.from(normalized, "base64url");
    if (decoded.length === 32 && decoded.toString("base64url") === normalized) return decoded;
  }
  throw new BackupConfigurationError(
    "BACKUP_CONFIG_INVALID",
    "The active backup key must encode exactly 32 random bytes as hex, base64, or base64url.",
  );
}

export function requireStrictActiveBackupEncryptionSecret(env = process.env) {
  const secret = requireConfiguredEnv("BACKUP_ENCRYPTION_KEY", env);
  strictEncryptionKeyFromSecret(secret);
  return secret;
}

export function strictRestoreEncryptionSecrets(env = process.env) {
  const active = requireConfiguredEnv("BACKUP_ENCRYPTION_KEY", env);
  const activeKey = strictEncryptionKeyFromSecret(active);
  const previous = env.BACKUP_ENCRYPTION_KEY_PREVIOUS?.trim() ?? "";
  if (previous) {
    const previousKey = strictEncryptionKeyFromSecret(previous);
    if (crypto.timingSafeEqual(activeKey, previousKey)) {
      throw new BackupConfigurationError(
        "BACKUP_CONFIG_INVALID",
        "BACKUP_ENCRYPTION_KEY and BACKUP_ENCRYPTION_KEY_PREVIOUS must be different keys.",
      );
    }
  }
  return { active, previous };
}

export function encryptionKeyFromSecret(secret) {
  if (!secret) {
    throw new Error("BACKUP_ENCRYPTION_KEY or RIVT_BACKUP_ENCRYPTION_KEY is required.");
  }
  if (/^[a-f0-9]{64}$/i.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  for (const encoding of ["base64", "base64url"]) {
    try {
      const decoded = Buffer.from(secret, encoding);
      if (decoded.length === 32) return decoded;
    } catch {
      // Try the next supported encoding before deriving from the configured secret.
    }
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptionKeyIdFromSecret(secret) {
  return crypto
    .createHmac("sha256", encryptionKeyFromSecret(secret))
    .update("rivt-backup-key-id-v1")
    .digest("hex")
    .slice(0, 32);
}

export function encryptSnapshot(snapshot, secret) {
  const encryptedFormat = snapshot?.format === LOGICAL_BACKUP_FORMAT_V2
    ? ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2
    : snapshot?.format === "rivt-logical-backup-v1"
      ? "rivt-encrypted-logical-backup-v1"
      : null;
  if (!encryptedFormat) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Unsupported logical backup snapshot format.");
  }
  if (
    snapshot.format === LOGICAL_BACKUP_FORMAT_V2
    && (
      snapshot.rowEncoding !== POSTGRES_TEXT_ROW_ENCODING
      || snapshot.manifest?.format !== LOGICAL_BACKUP_MANIFEST_FORMAT_V2
      || snapshot.manifest?.rowEncoding !== POSTGRES_TEXT_ROW_ENCODING
    )
  ) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Logical backup v2 requires PostgreSQL text row encoding.");
  }
  const key = encryptionKeyFromSecret(secret);
  const keyId = encryptionKeyIdFromSecret(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const uncompressed = Buffer.from(JSON.stringify(snapshot));
  if (uncompressed.length > MAX_DECOMPRESSED_BACKUP_BYTES) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "The logical backup exceeds the safe payload limit.");
  }
  const payload = gzipSync(uncompressed);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  return {
    format: encryptedFormat,
    algorithm: "aes-256-gcm",
    compression: "gzip",
    keyId,
    createdAt: snapshot.createdAt,
    sourceCommit: snapshot.sourceCommit,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptionCandidates(secretOrSecrets) {
  const configured = typeof secretOrSecrets === "string"
    ? [secretOrSecrets]
    : [secretOrSecrets?.active, secretOrSecrets?.previous];
  const candidates = [];
  const seenKeyIds = new Set();
  for (const secret of configured) {
    if (typeof secret !== "string" || !secret) continue;
    const keyId = encryptionKeyIdFromSecret(secret);
    if (seenKeyIds.has(keyId)) continue;
    seenKeyIds.add(keyId);
    candidates.push({ keyId, secret });
  }
  if (candidates.length === 0) {
    throw new Error("BACKUP_ENCRYPTION_KEY or RIVT_BACKUP_ENCRYPTION_KEY is required.");
  }
  return candidates;
}

function keyIdsEqual(left, right) {
  if (!/^[a-f0-9]{32}$/i.test(left) || !/^[a-f0-9]{32}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

class BackupAuthenticationError extends Error {}

function decryptWithSecret(envelope, secret) {
  const key = encryptionKeyFromSecret(secret);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  let compressed;
  try {
    compressed = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]);
  } catch {
    throw new BackupAuthenticationError("Backup authentication failed.");
  }
  try {
    return JSON.parse(gunzipSync(compressed, { maxOutputLength: MAX_DECOMPRESSED_BACKUP_BYTES }).toString("utf8"));
  } catch (error) {
    if (error?.code === "ERR_BUFFER_TOO_LARGE" || error?.code === "ERR_OUT_OF_RANGE") {
      throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "The decrypted backup exceeds the safe payload limit.");
    }
    throw error;
  }
}

export function decryptSnapshot(envelope, secretOrSecrets) {
  if (
    envelope?.format !== "rivt-encrypted-logical-backup-v1"
    && envelope?.format !== ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2
  ) {
    throw new Error("Unsupported encrypted backup format.");
  }
  if (envelope.algorithm !== "aes-256-gcm" || envelope.compression !== "gzip") {
    throw new Error("Unsupported encrypted backup algorithm or compression.");
  }
  const candidates = decryptionCandidates(secretOrSecrets);
  if (envelope.keyId !== undefined) {
    if (typeof envelope.keyId !== "string" || !/^[a-f0-9]{32}$/i.test(envelope.keyId)) {
      throw new Error("Encrypted backup key identifier is invalid.");
    }
    const matchingCandidate = candidates.find((candidate) => keyIdsEqual(candidate.keyId, envelope.keyId));
    if (!matchingCandidate) {
      throw new Error("Unable to decrypt backup with the configured encryption keys.");
    }
    try {
      return decryptWithSecret(envelope, matchingCandidate.secret);
    } catch (error) {
      if (!(error instanceof BackupAuthenticationError)) throw error;
      throw new Error("Unable to decrypt backup with the configured encryption keys.");
    }
  }

  for (const candidate of candidates) {
    try {
      return decryptWithSecret(envelope, candidate.secret);
    } catch (error) {
      if (!(error instanceof BackupAuthenticationError)) throw error;
      // Older envelopes have no key identifier, so try active then previous.
    }
  }
  throw new Error("Unable to decrypt backup with the configured encryption keys.");
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function bodyToBuffer(body, maxBytes = MAX_ENCRYPTED_BACKUP_BYTES) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "The encrypted backup exceeds the safe artifact limit.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function protectedArtifactMetadata({ sha256, createdAt, sourceCommit, retentionDays, format }) {
  return {
    "rivt-artifact": "logical-backup",
    "rivt-format": format,
    "rivt-sha256": sha256,
    "rivt-created-at": createdAt,
    "rivt-source-commit": sourceCommit,
    "rivt-retention-days": String(retentionDays),
  };
}

export async function putProtectedJsonObject(client, config, key, value, options) {
  assertObjectKeyInPrefix(key, config.prefix);
  if (value?.format !== ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2) {
    throw new BackupConfigurationError(
      "BACKUP_OBJECT_INVALID",
      "Only lossless logical backup v2 artifacts may be uploaded as current backup evidence.",
    );
  }
  if (!options || typeof options !== "object") {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "Protected backup upload options are required.");
  }
  const parsedCreatedAt = new Date(options.createdAt ?? "");
  if (
    typeof options.createdAt !== "string"
    || !Number.isFinite(parsedCreatedAt.getTime())
    || parsedCreatedAt.toISOString() !== options.createdAt
    || value.createdAt !== options.createdAt
  ) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The protected backup createdAt value must be one matching canonical UTC timestamp.",
    );
  }
  if (
    typeof options.sourceCommit !== "string"
    || !/^[a-f0-9]{40}$/.test(options.sourceCommit)
    || value.sourceCommit !== options.sourceCommit
  ) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The protected backup sourceCommit must be one matching full lowercase Git commit SHA.",
    );
  }
  if (!Number.isInteger(options.retentionDays) || options.retentionDays < MIN_BACKUP_RETENTION_DAYS) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      `Protected backup retention must be at least ${MIN_BACKUP_RETENTION_DAYS} whole days.`,
    );
  }
  if (options.now !== undefined && typeof options.now !== "function") {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The backup clock must be a function when supplied.");
  }
  const body = Buffer.from(JSON.stringify(value));
  if (body.length > MAX_NEW_LOGICAL_BACKUP_BYTES) {
    throw new BackupConfigurationError(
      "BACKUP_UPLOAD_LIMIT_EXCEEDED",
      "The new encrypted backup exceeds the fixed upload safety limit.",
    );
  }
  const sha256 = sha256Hex(body);
  const uploadStartedAt = options.now ? options.now() : new Date();
  if (!(uploadStartedAt instanceof Date) || !Number.isFinite(uploadStartedAt.getTime())) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The backup upload time is invalid.");
  }
  backupWriteWindowFromEnv({
    BACKUP_WRITE_WINDOW_START_AT: options.writeWindowStartAt,
    BACKUP_WRITE_WINDOW_END_AT: options.writeWindowEndAt,
  }, uploadStartedAt);
  const expectedKey = logicalBackupObjectKey(config.prefix, uploadStartedAt);
  if (key !== expectedKey) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The protected backup object key must match the current deterministic write slot.",
    );
  }
  const backupSlotStartAt = backupSlotStart(uploadStartedAt).toISOString();
  const checksumSha256 = Buffer.from(sha256, "hex").toString("base64");
  let response;
  try {
    response = await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
      ChecksumAlgorithm: "SHA256",
      ChecksumSHA256: checksumSha256,
      IfNoneMatch: "*",
      ServerSideEncryption: "AES256",
      Metadata: protectedArtifactMetadata({
        sha256,
        createdAt: options.createdAt,
        sourceCommit: options.sourceCommit,
        retentionDays: options.retentionDays,
        format: value.format,
      }),
    }));
  } catch (error) {
    if (
      error?.name === "PreconditionFailed"
      || error?.Code === "PreconditionFailed"
      || error?.$metadata?.httpStatusCode === 412
    ) {
      throw new BackupConfigurationError(
        "BACKUP_CADENCE_LIMIT_REACHED",
        "The protected backup slot already contains an accepted write.",
      );
    }
    throw error;
  }
  const writeAcceptedAt = options.now ? options.now() : new Date();
  if (!(writeAcceptedAt instanceof Date) || !Number.isFinite(writeAcceptedAt.getTime())) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The backup completion time is invalid.");
  }
  if (!response.VersionId || response.VersionId === "null") {
    throw new BackupConfigurationError(
      "BACKUP_DESTINATION_UNSAFE",
      "The backup upload did not return an immutable object version identifier.",
    );
  }
  if (response.ChecksumSHA256 !== checksumSha256) {
    throw new BackupConfigurationError(
      "BACKUP_PROVIDER_CHECK_FAILED",
      "The backup provider did not confirm the uploaded content checksum.",
    );
  }
  let verifiedRetention;
  try {
    verifiedRetention = await client.send(new GetObjectRetentionCommand({
      Bucket: config.bucket,
      Key: key,
      VersionId: response.VersionId,
    }));
  } catch (error) {
    const wrapped = new BackupConfigurationError(
      "BACKUP_PROVIDER_CHECK_FAILED",
      "The uploaded backup retention could not be verified.",
    );
    wrapped.cause = error;
    throw wrapped;
  }
  const providerRetainUntil = verifiedRetention.Retention?.RetainUntilDate;
  if (
    verifiedRetention.Retention?.Mode !== "COMPLIANCE"
    || !(providerRetainUntil instanceof Date)
    || !Number.isFinite(providerRetainUntil.getTime())
    || providerRetainUntil.getTime() < (
      writeAcceptedAt.getTime()
      + options.retentionDays * 86_400_000
      - MAX_PROVIDER_CLOCK_SKEW_MS
    )
  ) {
    throw new BackupConfigurationError(
      "BACKUP_DESTINATION_UNSAFE",
      "The uploaded backup version does not have sufficient provider-confirmed COMPLIANCE retention.",
    );
  }
  return {
    key,
    sha256,
    versionId: response.VersionId,
    etag: response.ETag ?? null,
    byteLength: body.length,
    backupSlotStartAt,
    writeAcceptedAt: writeAcceptedAt.toISOString(),
    retentionUntil: providerRetainUntil.toISOString(),
  };
}

function canonicalUtcTimestamp(raw, name) {
  const value = raw?.trim();
  const parsed = new Date(value ?? "");
  if (!value || !Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      `${name} must be a canonical UTC timestamp such as 2026-08-01T00:00:00.000Z.`,
    );
  }
  return parsed;
}

export function backupWriteWindowFromEnv(env = process.env, currentTime = new Date()) {
  if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The backup execution time is invalid.");
  }
  const start = canonicalUtcTimestamp(env.BACKUP_WRITE_WINDOW_START_AT, "BACKUP_WRITE_WINDOW_START_AT");
  const end = canonicalUtcTimestamp(env.BACKUP_WRITE_WINDOW_END_AT, "BACKUP_WRITE_WINDOW_END_AT");
  const expectedEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const isCalendarMonthStart = (
    start.getUTCDate() === 1
    && start.getUTCHours() === 0
    && start.getUTCMinutes() === 0
    && start.getUTCSeconds() === 0
    && start.getUTCMilliseconds() === 0
  );
  if (!isCalendarMonthStart || end.getTime() !== expectedEnd.getTime()) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The backup write window must be exactly one UTC calendar month.",
    );
  }
  if (currentTime.getTime() < start.getTime() || currentTime.getTime() >= end.getTime()) {
    throw new BackupConfigurationError(
      "BACKUP_WRITE_WINDOW_CLOSED",
      "The current time is outside the approved backup write window.",
    );
  }
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export function backupSlotStart(currentTime) {
  if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The backup slot time is invalid.");
  }
  const slotHour = currentTime.getUTCHours() < BACKUP_SLOT_HOURS ? 0 : BACKUP_SLOT_HOURS;
  return new Date(Date.UTC(
    currentTime.getUTCFullYear(),
    currentTime.getUTCMonth(),
    currentTime.getUTCDate(),
    slotHour,
  ));
}

export function logicalBackupObjectKey(prefix, currentTime) {
  const slotStart = backupSlotStart(currentTime);
  const slotTimestamp = slotStart.toISOString().replaceAll(":", "-");
  return `${prefix}/${slotTimestamp}-slot.json.gz.aes256gcm`;
}

export function backupDestinationIdentitySha256(config) {
  const endpoint = validateHttpsEndpoint(config.endpoint);
  const region = typeof config.region === "string" ? config.region.trim() : "";
  const bucket = typeof config.bucket === "string" ? config.bucket.trim() : "";
  const prefix = normalizeS3Prefix(config.prefix);
  if (!region || !bucket || typeof config.forcePathStyle !== "boolean") {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The backup destination identity is incomplete.",
    );
  }
  return sha256Hex(Buffer.from([
    endpoint,
    region,
    bucket,
    prefix,
    config.forcePathStyle ? "path" : "virtual-hosted",
  ].join("\0")));
}

export function assertBackupWriteDestination(config, env = process.env) {
  const expected = requireConfiguredEnv("BACKUP_WRITE_WINDOW_DESTINATION_SHA256", env);
  if (!/^[a-f0-9]{64}$/.test(expected) || backupDestinationIdentitySha256(config) !== expected) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The backup destination does not match the approved write window.",
    );
  }
}

export async function getJsonObject(client, bucket, key, versionId, maxBytes = MAX_ENCRYPTED_BACKUP_BYTES) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, VersionId: versionId }));
  const body = await bodyToBuffer(response.Body, maxBytes);
  return {
    value: JSON.parse(body.toString("utf8")),
    body,
    response,
  };
}

function retentionDaysFromDefault(defaultRetention) {
  if (defaultRetention?.Mode !== "COMPLIANCE") return 0;
  if (Number.isInteger(defaultRetention.Days)) return defaultRetention.Days;
  if (Number.isInteger(defaultRetention.Years)) return defaultRetention.Years * 365;
  return 0;
}

export async function verifyBucketProtection(client, config, retentionDays) {
  try {
    const versioning = await client.send(new GetBucketVersioningCommand({ Bucket: config.bucket }));
    if (versioning.Status !== "Enabled") {
      throw new BackupConfigurationError("BACKUP_DESTINATION_UNSAFE", "Backup bucket versioning is not enabled.");
    }
    const objectLock = await client.send(new GetObjectLockConfigurationCommand({ Bucket: config.bucket }));
    const defaultRetention = objectLock.ObjectLockConfiguration?.Rule?.DefaultRetention;
    const defaultRetentionDays = retentionDaysFromDefault(defaultRetention);
    if (
      objectLock.ObjectLockConfiguration?.ObjectLockEnabled !== "Enabled"
      || defaultRetentionDays < retentionDays
    ) {
      throw new BackupConfigurationError(
        "BACKUP_DESTINATION_UNSAFE",
        "Backup bucket COMPLIANCE Object Lock does not meet the retention requirement.",
      );
    }
    return {
      versioning: versioning.Status,
      objectLockMode: defaultRetention.Mode,
      defaultRetentionDays,
    };
  } catch (error) {
    if (error instanceof BackupConfigurationError) throw error;
    const wrapped = new BackupConfigurationError(
      "BACKUP_PROVIDER_CHECK_FAILED",
      "The backup provider protections could not be verified.",
    );
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function newestBackupVersion(client, config) {
  const candidates = [];
  let keyMarker;
  let versionIdMarker;
  const seenMarkers = new Set();
  try {
    for (let page = 0; page < 100; page += 1) {
      const response = await client.send(new ListObjectVersionsCommand({
        Bucket: config.bucket,
        Prefix: `${config.prefix}/`,
        MaxKeys: 1000,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      }));
      candidates.push(...(response.Versions ?? []));
      if (!response.IsTruncated) break;
      if (!response.NextKeyMarker) {
        throw new BackupConfigurationError("BACKUP_PROVIDER_CHECK_FAILED", "Backup version pagination is incomplete.");
      }
      const marker = `${response.NextKeyMarker}\0${response.NextVersionIdMarker ?? ""}`;
      if (seenMarkers.has(marker)) {
        throw new BackupConfigurationError("BACKUP_PROVIDER_CHECK_FAILED", "Backup version pagination did not advance.");
      }
      seenMarkers.add(marker);
      keyMarker = response.NextKeyMarker;
      versionIdMarker = response.NextVersionIdMarker;
      if (page === 99) {
        throw new BackupConfigurationError("BACKUP_PROVIDER_CHECK_FAILED", "Backup version inventory exceeds the safe verification bound.");
      }
    }
  } catch (error) {
    if (error instanceof BackupConfigurationError) throw error;
    const wrapped = new BackupConfigurationError("BACKUP_PROVIDER_CHECK_FAILED", "Backup versions could not be listed.");
    wrapped.cause = error;
    throw wrapped;
  }
  const versions = candidates
    .filter((entry) => entry.Key && entry.VersionId && entry.VersionId !== "null" && entry.LastModified)
    .sort((left, right) => right.LastModified.getTime() - left.LastModified.getTime());
  if (!versions.length) {
    throw new BackupConfigurationError("BACKUP_NOT_FRESH", "No versioned logical backup artifact was found.");
  }
  const newest = versions[0];
  assertObjectKeyInPrefix(newest.Key, config.prefix);
  return newest;
}

export async function verifyProtectedBackupObject(client, config, identity, options = {}) {
  const { key, versionId } = identity;
  assertObjectKeyInPrefix(key, config.prefix);
  if (!versionId || versionId === "null") {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "A named object version is required.");
  }
  let head;
  try {
    head = await client.send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
      VersionId: versionId,
    }));
  } catch (error) {
    const wrapped = new BackupConfigurationError("BACKUP_PROVIDER_CHECK_FAILED", "The named backup object could not be inspected.");
    wrapped.cause = error;
    throw wrapped;
  }
  const metadata = Object.fromEntries(
    Object.entries(head.Metadata ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const createdAt = metadata["rivt-created-at"];
  const sourceCommit = metadata["rivt-source-commit"];
  const metadataRetentionDays = Number.parseInt(metadata["rivt-retention-days"] ?? "", 10);
  const retentionUntil = head.ObjectLockRetainUntilDate;
  const uploadedAt = head.LastModified;
  const createdMs = new Date(createdAt ?? "").getTime();
  const uploadedMs = uploadedAt?.getTime();
  const retainUntilMs = retentionUntil?.getTime();
  if (
    metadata["rivt-artifact"] !== "logical-backup"
    || metadata["rivt-format"] !== ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2
    || !/^[a-f0-9]{64}$/.test(metadata["rivt-sha256"] ?? "")
    || !/^[a-f0-9]{40}$/.test(sourceCommit ?? "")
    || !Number.isFinite(createdMs)
    || !Number.isInteger(metadataRetentionDays)
    || metadataRetentionDays < options.retentionDays
    || head.ObjectLockMode !== "COMPLIANCE"
    || !Number.isInteger(head.ContentLength)
    || head.ContentLength < 1
    || head.ContentLength > MAX_ENCRYPTED_BACKUP_BYTES
    || !Number.isFinite(uploadedMs)
    || !Number.isFinite(retainUntilMs)
    || retainUntilMs < uploadedMs + options.retentionDays * 86_400_000
    || retainUntilMs <= (options.now ?? Date.now())
  ) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Backup object metadata or retention is invalid.");
  }
  if (options.expectedSha256 && metadata["rivt-sha256"] !== options.expectedSha256.toLowerCase()) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Backup digest does not match the named restore request.");
  }

  let downloaded;
  try {
    downloaded = await getJsonObject(client, config.bucket, key, versionId);
  } catch (error) {
    const wrapped = new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Backup object content could not be read.");
    wrapped.cause = error;
    throw wrapped;
  }
  const actualSha256 = sha256Hex(downloaded.body);
  if (actualSha256 !== metadata["rivt-sha256"] || (options.expectedSha256 && actualSha256 !== options.expectedSha256.toLowerCase())) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Backup content digest verification failed.");
  }
  const envelope = downloaded.value;
  if (
    envelope?.format !== ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2
    || envelope.algorithm !== "aes-256-gcm"
    || envelope.compression !== "gzip"
    || (envelope.keyId !== undefined && !/^[a-f0-9]{32}$/i.test(envelope.keyId))
    || Buffer.from(envelope.iv ?? "", "base64").length !== 12
    || Buffer.from(envelope.tag ?? "", "base64").length !== 16
    || typeof envelope.ciphertext !== "string"
    || envelope.ciphertext.length < 1
    || envelope.createdAt !== createdAt
    || envelope.sourceCommit !== sourceCommit
  ) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Backup envelope does not match its protected metadata.");
  }
  if (options.expectedKeyId && envelope.keyId?.toLowerCase() !== options.expectedKeyId.toLowerCase()) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Backup key identity does not match the expected active key.");
  }
  return {
    envelope,
    sha256: actualSha256,
    createdAt,
    uploadedAt: uploadedAt.toISOString(),
    sourceCommit,
    retentionDays: metadataRetentionDays,
    retentionUntil: retentionUntil.toISOString(),
    contentLength: head.ContentLength ?? downloaded.body.length,
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length
    && actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

function isCatalogIdentifier(value) {
  return typeof value === "string" && value.length > 0 && !value.includes("\0");
}

function isPostgresBigint(value) {
  if (!(typeof value === "string" && /^-?\d+$/.test(value)) && !Number.isSafeInteger(value)) return false;
  try {
    const parsed = BigInt(value);
    return parsed >= -9_223_372_036_854_775_808n && parsed <= 9_223_372_036_854_775_807n;
  } catch {
    return false;
  }
}

export function assertRestoreUsableSnapshot(snapshot, protectedArtifact) {
  const invalid = () => {
    throw new BackupConfigurationError(
      "BACKUP_OBJECT_INVALID",
      "The authenticated backup payload is not structurally restore-usable.",
    );
  };
  if (
    !isRecord(snapshot)
    || snapshot.format !== LOGICAL_BACKUP_FORMAT_V2
    || snapshot.rowEncoding !== POSTGRES_TEXT_ROW_ENCODING
    || snapshot.createdAt !== protectedArtifact?.createdAt
    || snapshot.sourceCommit !== protectedArtifact?.sourceCommit
    || !Array.isArray(snapshot.tables)
    || !Array.isArray(snapshot.sequences)
    || !isRecord(snapshot.manifest)
    || snapshot.manifest.format !== LOGICAL_BACKUP_MANIFEST_FORMAT_V2
    || snapshot.manifest.rowEncoding !== POSTGRES_TEXT_ROW_ENCODING
    || snapshot.manifest.createdAt !== snapshot.createdAt
    || snapshot.manifest.sourceCommit !== snapshot.sourceCommit
  ) invalid();

  const tableNames = [];
  let rowCount = 0;
  for (const table of snapshot.tables) {
    if (!isRecord(table) || !isCatalogIdentifier(table.name) || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
      invalid();
    }
    tableNames.push(table.name);
    const columnNames = [];
    for (const column of table.columns) {
      if (
        !isRecord(column)
        || !isCatalogIdentifier(column.name)
        || typeof column.typeName !== "string"
        || !column.typeName.trim()
        || ![null, "ALWAYS", "BY DEFAULT"].includes(column.identityGeneration)
      ) invalid();
      columnNames.push(column.name);
    }
    if (new Set(columnNames).size !== columnNames.length) invalid();
    for (const row of table.rows) {
      if (!hasExactKeys(row, columnNames)) invalid();
      if (columnNames.some((columnName) => row[columnName] !== null && typeof row[columnName] !== "string")) invalid();
    }
    rowCount += table.rows.length;
    if (!Number.isSafeInteger(rowCount)) invalid();
  }
  if (new Set(tableNames).size !== tableNames.length) invalid();

  const manifest = snapshot.manifest;
  if (
    !Number.isSafeInteger(manifest.tableCount)
    || manifest.tableCount < 0
    || manifest.tableCount !== snapshot.tables.length
    || !Number.isSafeInteger(manifest.rowCount)
    || manifest.rowCount < 0
    || manifest.rowCount !== rowCount
    || !hasExactKeys(manifest.counts, tableNames)
    || tableNames.some((tableName, index) => (
      !Number.isSafeInteger(manifest.counts[tableName])
      || manifest.counts[tableName] < 0
      || manifest.counts[tableName] !== snapshot.tables[index].rows.length
    ))
  ) invalid();

  const expectedTableDigests = snapshotTableDigests(snapshot.tables);
  if (
    manifest.tableDigests !== undefined
    && (
      !hasExactKeys(manifest.tableDigests, tableNames)
      || tableNames.some((tableName) => (
        !/^[a-f0-9]{64}$/.test(manifest.tableDigests[tableName] ?? "")
        || manifest.tableDigests[tableName] !== expectedTableDigests[tableName]
      ))
    )
  ) invalid();

  const sequenceNames = [];
  for (const sequence of snapshot.sequences) {
    if (
      !isRecord(sequence)
      || !isCatalogIdentifier(sequence.sequenceName)
      || !isPostgresBigint(sequence.lastValue)
      || typeof sequence.isCalled !== "boolean"
    ) invalid();
    sequenceNames.push(sequence.sequenceName);
  }
  if (new Set(sequenceNames).size !== sequenceNames.length) invalid();
  return snapshot;
}

export function sumCounts(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

export function diffCounts(expectedCounts, actualCounts) {
  return Object.keys(expectedCounts)
    .sort()
    .map((tableName) => ({
      tableName,
      expected: expectedCounts[tableName],
      actual: actualCounts[tableName],
      delta: (actualCounts[tableName] ?? 0) - expectedCounts[tableName],
    }))
    .filter((entry) => entry.delta !== 0);
}
