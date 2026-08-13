import pg from "pg";
import { poolMaxForRole } from "./process-role.js";

const { Pool } = pg;

function environmentValue(environment, name) {
  const value = String(environment?.[name] ?? "").trim();
  return value || null;
}

function boundedTimeout(environment, name, {
  fallback,
  minimum,
  maximum,
}) {
  const raw = environmentValue(environment, name);
  const parsed = raw === null ? fallback : Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return parsed;
}

export function databaseUrlForEnvironment(environment = process.env) {
  return environmentValue(environment, "DATABASE_URL");
}

export function databasePoolTimeouts(environment = process.env) {
  return {
    connectionTimeoutMillis: boundedTimeout(environment, "RIVT_DB_CONNECTION_TIMEOUT_MS", {
      fallback: 5_000,
      minimum: 500,
      maximum: 30_000,
    }),
    idleTimeoutMillis: boundedTimeout(environment, "RIVT_DB_IDLE_TIMEOUT_MS", {
      fallback: 30_000,
      minimum: 1_000,
      maximum: 300_000,
    }),
  };
}

export function createDatabasePool({
  environment = process.env,
  role,
  requireDatabase = true,
} = {}) {
  const databaseUrl = databaseUrlForEnvironment(environment);
  if (!databaseUrl) {
    if (requireDatabase) throw new Error("DATABASE_URL is required.");
    return null;
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    max: poolMaxForRole(role, environment),
    ...databasePoolTimeouts(environment),
    ssl:
      environmentValue(environment, "PGSSL") === "disable"
      || databaseUrl.includes("localhost")
      || databaseUrl.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });
  return pool;
}
