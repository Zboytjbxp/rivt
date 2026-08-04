const PROCESS_ROLES = Object.freeze(["web", "worker", "migrate", "combined"]);
const HOSTED_PROCESS_ROLES = Object.freeze(["web", "worker"]);
const MINIMUM_CONNECTION_HEADROOM_PERCENT = 30;

const ROLE_POOL_CONFIGURATION = Object.freeze({
  web: { key: "RIVT_WEB_PG_POOL_MAX", localDefault: 8 },
  worker: { key: "RIVT_WORKER_PG_POOL_MAX", localDefault: 4 },
  migrate: { key: "RIVT_MIGRATE_PG_POOL_MAX", localDefault: 1 },
  combined: { key: "PG_POOL_MAX", localDefault: 10 },
});

function value(environment, name) {
  const candidate = String(environment?.[name] ?? "").trim();
  return candidate || null;
}

export function isHostedRuntime(environment = process.env) {
  return value(environment, "NODE_ENV") === "production"
    || [
      "RAILWAY_ENVIRONMENT",
      "RAILWAY_ENVIRONMENT_ID",
      "RAILWAY_PROJECT_ID",
      "RAILWAY_SERVICE_ID",
      "RAILWAY_STATIC_URL",
    ].some((name) => Boolean(value(environment, name)));
}

export function resolveProcessRole(
  environment = process.env,
  { allowLocalCombinedDefault = false, requestedRole = null } = {},
) {
  const hosted = isHostedRuntime(environment);
  const configuredRole = String(value(environment, "RIVT_PROCESS_ROLE") ?? "")
    .trim()
    .toLowerCase();
  const boundRole = String(requestedRole ?? "").trim().toLowerCase();
  const rawRole = boundRole || configuredRole;

  if (!rawRole) {
    if (!hosted && allowLocalCombinedDefault) return "combined";
    throw new Error(
      `RIVT_PROCESS_ROLE is required. Choose ${hosted ? "web or worker" : "web, worker, migrate, or combined"}.`,
    );
  }
  if (!PROCESS_ROLES.includes(rawRole)) {
    throw new Error(
      `RIVT_PROCESS_ROLE must be ${hosted ? "web or worker" : "web, worker, migrate, or combined"}.`,
    );
  }
  if (hosted && rawRole === "combined") {
    throw new Error("The combined process role is only allowed for local development and tests.");
  }
  if (hosted && boundRole === "migrate") {
    if (configuredRole !== "web") {
      throw new Error("Hosted migrations must run only as the web service pre-deploy command.");
    }
  } else if (hosted && rawRole === "migrate") {
    throw new Error("Hosted migrations must run only as the web service pre-deploy command.");
  } else if (hosted && boundRole) {
    if (!configuredRole) {
      throw new Error("RIVT_PROCESS_ROLE must be set and match the bound hosted process role.");
    }
    if (configuredRole !== boundRole) {
      throw new Error("RIVT_PROCESS_ROLE conflicts with the bound hosted process role.");
    }
  }
  return rawRole;
}

export function processCapabilities(role) {
  switch (role) {
    case "web":
      return {
        servesHttp: true,
        appliesMigrations: false,
        runsPushWorker: false,
        runsMaintenance: false,
      };
    case "worker":
      return {
        servesHttp: false,
        appliesMigrations: false,
        runsPushWorker: true,
        runsMaintenance: true,
      };
    case "migrate":
      return {
        servesHttp: false,
        appliesMigrations: true,
        runsPushWorker: false,
        runsMaintenance: false,
      };
    case "combined":
      return {
        servesHttp: true,
        appliesMigrations: true,
        runsPushWorker: true,
        runsMaintenance: true,
      };
    default:
      throw new Error("Unknown RIVT process role.");
  }
}

function boundedPositiveInteger(raw, {
  name,
  fallback = null,
  maximum,
  required = false,
}) {
  const source = raw === null || raw === undefined || String(raw).trim() === ""
    ? fallback
    : raw;
  if (source === null || source === undefined || String(source).trim() === "") {
    if (required) throw new Error(`${name} is required for a hosted runtime.`);
    return null;
  }
  const parsed = Number(source);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return parsed;
}

export function poolMaxForRole(role, environment = process.env) {
  const configuration = ROLE_POOL_CONFIGURATION[role];
  if (!configuration) throw new Error("Unknown RIVT process role.");
  const hosted = isHostedRuntime(environment);
  const explicit = value(environment, configuration.key);
  return boundedPositiveInteger(explicit, {
    name: configuration.key,
    fallback: hosted ? null : configuration.localDefault,
    maximum: 100,
    required: hosted,
  });
}

function readBudgetInteger(environment, name, {
  hosted,
  localDefault,
  maximum,
  missing,
  errors,
}) {
  const explicit = value(environment, name);
  if (!explicit && hosted) {
    missing.push(name);
    return 0;
  }
  try {
    return boundedPositiveInteger(explicit, {
      name,
      fallback: localDefault,
      maximum,
    });
  } catch (error) {
    errors.push(error.message);
    return 0;
  }
}

function roundedPercent(valueToRound) {
  if (!Number.isFinite(valueToRound)) return 0;
  return Math.round(valueToRound * 100) / 100;
}

export function connectionBudgetStatus(environment = process.env) {
  const hosted = isHostedRuntime(environment);
  const missing = [];
  const errors = [];
  const shared = { hosted, missing, errors };
  const topology = {
    webReplicas: readBudgetInteger(environment, "RIVT_WEB_REPLICAS", {
      ...shared,
      localDefault: 1,
      maximum: 100,
    }),
    workerReplicas: readBudgetInteger(environment, "RIVT_WORKER_REPLICAS", {
      ...shared,
      localDefault: 1,
      maximum: 100,
    }),
    webPoolMax: readBudgetInteger(environment, "RIVT_WEB_PG_POOL_MAX", {
      ...shared,
      localDefault: 8,
      maximum: 100,
    }),
    workerPoolMax: readBudgetInteger(environment, "RIVT_WORKER_PG_POOL_MAX", {
      ...shared,
      localDefault: 4,
      maximum: 100,
    }),
    migratePoolMax: readBudgetInteger(environment, "RIVT_MIGRATE_PG_POOL_MAX", {
      ...shared,
      localDefault: 2,
      maximum: 100,
    }),
    reservedConnections: readBudgetInteger(environment, "RIVT_DB_RESERVED_CONNECTIONS", {
      ...shared,
      localDefault: 4,
      maximum: 1_000,
    }),
  };
  const databaseMaxConnections = readBudgetInteger(environment, "RIVT_DB_MAX_CONNECTIONS", {
    ...shared,
    localDefault: 100,
    maximum: 100_000,
  });
  const plannedConnections = (
    topology.webReplicas * topology.webPoolMax
    + topology.workerReplicas * topology.workerPoolMax
    + topology.migratePoolMax
    + topology.reservedConnections
  );
  const headroomConnections = Math.max(0, databaseMaxConnections - plannedConnections);
  const headroomPercent = databaseMaxConnections > 0
    ? roundedPercent((headroomConnections / databaseMaxConnections) * 100)
    : 0;

  if (missing.length === 0 && errors.length === 0 && plannedConnections > databaseMaxConnections) {
    errors.push("The planned application connection count exceeds RIVT_DB_MAX_CONNECTIONS.");
  } else if (
    missing.length === 0
    && errors.length === 0
    && headroomPercent < MINIMUM_CONNECTION_HEADROOM_PERCENT
  ) {
    errors.push(`The database connection budget must retain at least ${MINIMUM_CONNECTION_HEADROOM_PERCENT}% headroom.`);
  }

  return {
    ok: missing.length === 0 && errors.length === 0,
    hosted,
    databaseMaxConnections,
    plannedConnections,
    headroomConnections,
    headroomPercent,
    minimumHeadroomPercent: MINIMUM_CONNECTION_HEADROOM_PERCENT,
    topology,
    missing,
    errors,
  };
}

export function assertConnectionBudget(environment = process.env) {
  const status = connectionBudgetStatus(environment);
  if (!status.ok) {
    const details = status.missing.length
      ? `Missing: ${status.missing.join(", ")}.`
      : status.errors.join(" ");
    throw new Error(`The PostgreSQL connection budget is not safe. ${details}`);
  }
  return status;
}

function databaseLimitInteger(valueToParse, name) {
  const parsed = Number(valueToParse);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL returned an invalid ${name} value.`);
  }
  return parsed;
}

function databaseConnectionLimit(valueToParse, name) {
  const parsed = Number(valueToParse);
  if (!Number.isSafeInteger(parsed) || parsed < -1) {
    throw new Error(`PostgreSQL returned an invalid ${name} value.`);
  }
  return parsed;
}

export async function assertDatabaseConnectionCeiling(database, budget) {
  if (!database || typeof database.query !== "function") {
    throw new Error("A PostgreSQL connection is required to verify the connection ceiling.");
  }
  if (!budget?.ok || !Number.isSafeInteger(budget.databaseMaxConnections)) {
    throw new Error("A valid declared connection budget is required before PostgreSQL verification.");
  }

  const result = await database.query(
    `SELECT
       current_setting('max_connections')::integer AS max_connections,
       current_setting('superuser_reserved_connections')::integer
         AS superuser_reserved_connections,
       COALESCE(NULLIF(current_setting('reserved_connections', true), ''), '0')::integer
         AS reserved_connections,
       (SELECT datconnlimit
        FROM pg_database
        WHERE datname = current_database())::integer AS database_connection_limit,
       (SELECT rolconnlimit
        FROM pg_roles
        WHERE rolname = current_user)::integer AS role_connection_limit`,
  );
  if (result.rows.length !== 1) {
    throw new Error("PostgreSQL did not return one connection-ceiling record.");
  }

  const row = result.rows[0];
  const observedMaxConnections = databaseLimitInteger(
    row.max_connections,
    "max_connections",
  );
  const superuserReservedConnections = databaseLimitInteger(
    row.superuser_reserved_connections,
    "superuser_reserved_connections",
  );
  const reservedConnections = databaseLimitInteger(
    row.reserved_connections,
    "reserved_connections",
  );
  const globalUsableConnections = (
    observedMaxConnections
    - superuserReservedConnections
    - reservedConnections
  );
  const databaseConnectionLimitValue = databaseConnectionLimit(
    row.database_connection_limit,
    "database connection limit",
  );
  const roleConnectionLimit = databaseConnectionLimit(
    row.role_connection_limit,
    "role connection limit",
  );
  const observedUsableConnections = Math.min(
    globalUsableConnections,
    ...[databaseConnectionLimitValue, roleConnectionLimit]
      .filter((limit) => limit >= 0),
  );
  if (observedUsableConnections < 1) {
    throw new Error("PostgreSQL reported no usable application connections.");
  }
  if (budget.databaseMaxConnections > observedUsableConnections) {
    throw new Error(
      "RIVT_DB_MAX_CONNECTIONS exceeds PostgreSQL's observed usable connection ceiling.",
    );
  }

  return {
    declaredMaxConnections: budget.databaseMaxConnections,
    observedMaxConnections,
    observedUsableConnections,
    globalUsableConnections,
    databaseConnectionLimit: databaseConnectionLimitValue,
    roleConnectionLimit,
    superuserReservedConnections,
    reservedConnections,
  };
}

export const processRoleInternals = {
  databaseConnectionLimit,
  databaseLimitInteger,
  HOSTED_PROCESS_ROLES,
  MINIMUM_CONNECTION_HEADROOM_PERCENT,
  PROCESS_ROLES,
  ROLE_POOL_CONFIGURATION,
};
