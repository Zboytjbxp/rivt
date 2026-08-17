import {
  completeRecoveryDatabaseIdentitySha256,
} from "./complete-recovery-database.js";
import {
  databaseIdentity,
  runtimeDatabaseIdentity,
} from "./logical-backup-utils.js";
import {
  normalizeRecoveryWriterRetirementRecord,
} from "./recovery-writer-retirement-controller.js";
import { RecoveryError } from "./recovery-object-utils.js";

const SCHEMA_NAME = "rivt_recovery_control";
const TABLE_NAME = `${SCHEMA_NAME}.writer_retirement_records`;
const METADATA_TABLE_NAME = `${SCHEMA_NAME}.controller_schema_metadata`;
const SCHEMA_VERSION = 1;
const DEFAULT_DUE_LIMIT = 1_000;
const MAX_RECORD_BYTES = 32 * 1024;
const MAX_CONNECTION_TIMEOUT_MS = 5_000;
const MAX_QUERY_TIMEOUT_MS = 30_000;
const MAX_STATEMENT_TIMEOUT_MS = 30_000;
const MAX_LOCK_TIMEOUT_MS = 5_000;
const MAX_IDLE_TRANSACTION_TIMEOUT_MS = 30_000;
const DUE_STATES = new Set([
  "registered",
  "retirement_requested",
  "retiring",
  "retirement_unverified",
  "quarantined",
]);

function storeError(code, message, cause) {
  const error = new RecoveryError(code, message);
  if (cause !== undefined) {
    Object.defineProperty(error, "cause", {
      value: cause,
      configurable: true,
      enumerable: false,
    });
  }
  return error;
}

function exactSha256(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} must be a lowercase SHA-256 digest.`,
    );
  }
  return value;
}

function exactInteger(value, label, { minimum = 1, maximum } = {}) {
  if (
    !Number.isSafeInteger(value)
    || value < minimum
    || (maximum !== undefined && value > maximum)
  ) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} is outside the fixed source limit.`,
    );
  }
  return value;
}

function exactIso(value, label) {
  if (
    typeof value !== "string"
    || Number.isNaN(Date.parse(value))
    || new Date(value).toISOString() !== value
  ) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} must be a canonical UTC timestamp.`,
    );
  }
  return value;
}

function requiredFunction(value, label) {
  if (typeof value !== "function") {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `The retirement store requires ${label}.`,
    );
  }
  return value;
}

function exactObject(value, label, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} must be an exact object.`,
    );
  }
  const actualKeys = Object.keys(value).sort();
  const requiredKeys = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(requiredKeys)) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} has missing or unexpected fields.`,
    );
  }
  return value;
}

function assertBoundedPoolOptions(pool) {
  const options = pool.options;
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      "PostgreSQL pool options must expose fixed operation timeouts.",
    );
  }
  const fixedLimits = [
    ["connectionTimeoutMillis", MAX_CONNECTION_TIMEOUT_MS],
    ["query_timeout", MAX_QUERY_TIMEOUT_MS],
    ["statement_timeout", MAX_STATEMENT_TIMEOUT_MS],
    ["lock_timeout", MAX_LOCK_TIMEOUT_MS],
    ["idle_in_transaction_session_timeout", MAX_IDLE_TRANSACTION_TIMEOUT_MS],
  ];
  for (const [name, maximum] of fixedLimits) {
    exactInteger(options[name], `PostgreSQL ${name}`, { maximum });
  }
}

function postgresIdentity(value, label) {
  if (typeof value !== "string" || !value || value !== value.trim()) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} must be an explicit PostgreSQL URL.`,
    );
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} must be an explicit PostgreSQL URL.`,
    );
  }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} must use the PostgreSQL protocol.`,
    );
  }
  const identity = databaseIdentity(value);
  if (!identity.host || !identity.database || !identity.username) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      `${label} must identify an explicit host, database, and role.`,
    );
  }
  return Object.freeze({
    host: identity.host.toLowerCase(),
    port: identity.port,
    database: identity.database,
  });
}

function sameDatabaseIdentity(left, right) {
  return left.host === right.host
    && left.port === right.port
    && left.database === right.database;
}

export function assertRecoveryWriterRetirementControllerDatabaseUrlSeparation({
  controllerDatabaseUrl,
  applicationDatabaseUrl,
  backupDatabaseUrl,
  restoreDatabaseUrl,
} = {}) {
  const controller = postgresIdentity(controllerDatabaseUrl, "Controller database URL");
  const protectedDatabases = [
    ["Application database URL", applicationDatabaseUrl],
    ["Backup database URL", backupDatabaseUrl],
    ["Restore database URL", restoreDatabaseUrl],
  ].map(([label, value]) => postgresIdentity(value, label));
  if (protectedDatabases.some((identity) => sameDatabaseIdentity(controller, identity))) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_DATABASE_COLLISION",
      "The retirement controller must use a dedicated PostgreSQL database.",
    );
  }
  return true;
}

function dueAtForRecord(record) {
  if (record.state === "retired") return null;
  if (record.state === "registered") return record.retirementDeadlineAt;
  if (record.state === "retiring") return record.attemptLeaseExpiresAt;
  return record.retirementRequestedAt ?? record.quarantinedAt ?? record.registeredAt;
}

function storedValues(record) {
  const serialized = JSON.stringify(record);
  if (Buffer.byteLength(serialized, "utf8") > MAX_RECORD_BYTES) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      "The retirement record exceeds the fixed store limit.",
    );
  }
  return Object.freeze([
    record.runId,
    record.revision,
    record.fencingToken,
    record.state,
    record.retirementDeadlineAt,
    record.attemptLeaseExpiresAt,
    dueAtForRecord(record),
    serialized,
  ]);
}

function recordFromRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
      "The retirement store returned an invalid row.",
    );
  }
  let candidate = row.record;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch (cause) {
      throw storeError(
        "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
        "The retirement store returned invalid record JSON.",
        cause,
      );
    }
  }
  let record;
  try {
    record = normalizeRecoveryWriterRetirementRecord(candidate);
  } catch (cause) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
      "The retirement store record failed canonical validation.",
      cause,
    );
  }
  if (
    row.run_id !== record.runId
    || Number(row.revision) !== record.revision
    || Number(row.fencing_token) !== record.fencingToken
    || row.state !== record.state
  ) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
      "The retirement store shadow fields do not match the canonical record.",
    );
  }
  return record;
}

async function querySingleSchemaVersion(client) {
  const result = await client.query(
    `SELECT schema_version
       FROM ${METADATA_TABLE_NAME}
      WHERE singleton = TRUE`,
  );
  if (
    result?.rowCount !== 1
    || result.rows?.length !== 1
    || Number(result.rows[0]?.schema_version) !== SCHEMA_VERSION
  ) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_SCHEMA_MISMATCH",
      "The retirement store schema version is missing or unsupported.",
    );
  }
}

async function synchronousTransaction(client, operation) {
  await client.query("BEGIN");
  let committed = false;
  try {
    await client.query("SET LOCAL synchronous_commit = on");
    const value = await operation();
    await client.query("COMMIT");
    committed = true;
    return value;
  } finally {
    if (!committed) await client.query("ROLLBACK").catch(() => {});
  }
}

export function createRecoveryWriterRetirementPostgresStore({
  pool,
  expectedRuntimeDatabaseIdentitySha256,
  prohibitedRuntimeDatabaseIdentitySha256s,
  readRuntimeDatabaseIdentity = runtimeDatabaseIdentity,
  dueLimit = DEFAULT_DUE_LIMIT,
} = {}) {
  if (!pool || typeof pool !== "object" || Array.isArray(pool)) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
      "The retirement store requires an injected PostgreSQL pool.",
    );
  }
  assertBoundedPoolOptions(pool);
  const connect = requiredFunction(pool.connect, "pool.connect").bind(pool);
  const readIdentity = requiredFunction(
    readRuntimeDatabaseIdentity,
    "a runtime database identity reader",
  );
  const expectedIdentity = exactSha256(
    expectedRuntimeDatabaseIdentitySha256,
    "Expected controller database identity",
  );
  const protectedIdentityBindings = exactObject(
    prohibitedRuntimeDatabaseIdentitySha256s,
    "Protected database identities",
    ["application", "backup", "restore"],
  );
  const prohibitedIdentities = new Set(
    Object.values(protectedIdentityBindings).map((value) => exactSha256(
      value,
      "Protected database identity",
    )),
  );
  if (prohibitedIdentities.has(expectedIdentity)) {
    throw storeError(
      "RECOVERY_WRITER_RETIREMENT_STORE_DATABASE_COLLISION",
      "The retirement controller database identity matches a protected database.",
    );
  }
  const maximumDueRecords = exactInteger(dueLimit, "Retirement-store due limit", {
    maximum: DEFAULT_DUE_LIMIT,
  });

  async function withBoundClient(operation) {
    let client;
    let primaryError;
    try {
      client = await connect();
      if (
        !client
        || typeof client.query !== "function"
        || typeof client.release !== "function"
      ) {
        throw storeError(
          "RECOVERY_WRITER_RETIREMENT_STORE_UNAVAILABLE",
          "The retirement database pool returned no usable client.",
        );
      }
      let runtimeIdentity;
      try {
        runtimeIdentity = await readIdentity(client);
      } catch (cause) {
        throw storeError(
          "RECOVERY_WRITER_RETIREMENT_STORE_IDENTITY_UNVERIFIED",
          "The retirement controller database identity could not be verified.",
          cause,
        );
      }
      const actualIdentity = completeRecoveryDatabaseIdentitySha256(runtimeIdentity);
      if (actualIdentity !== expectedIdentity || prohibitedIdentities.has(actualIdentity)) {
        throw storeError(
          "RECOVERY_WRITER_RETIREMENT_STORE_DATABASE_COLLISION",
          "The retirement controller database is not the reviewed dedicated database.",
        );
      }
      await querySingleSchemaVersion(client);
      return await operation(client);
    } catch (error) {
      primaryError = error;
      if (error instanceof RecoveryError) throw error;
      throw storeError(
        "RECOVERY_WRITER_RETIREMENT_STORE_UNAVAILABLE",
        "The retirement store operation failed closed.",
        error,
      );
    } finally {
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          if (!primaryError) {
            throw storeError(
              "RECOVERY_WRITER_RETIREMENT_STORE_UNAVAILABLE",
              "The retirement database connection could not be released safely.",
              releaseError,
            );
          }
        }
      }
    }
  }

  async function create(recordValue) {
    const record = normalizeRecoveryWriterRetirementRecord(recordValue);
    const values = storedValues(record);
    return withBoundClient((client) => synchronousTransaction(client, async () => {
      const inserted = await client.query(
        `INSERT INTO ${TABLE_NAME} (
           run_id, revision, fencing_token, state, retirement_deadline_at,
           attempt_lease_expires_at, due_at, record
         ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::timestamptz, $8::jsonb)
         ON CONFLICT (run_id) DO NOTHING
         RETURNING run_id, revision, fencing_token, state, record`,
        values,
      );
      if (inserted.rowCount === 1) return recordFromRow(inserted.rows[0]);
      if (inserted.rowCount !== 0) {
        throw storeError(
          "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
          "The retirement store returned an invalid create result.",
        );
      }
      const existing = await client.query(
        `SELECT run_id, revision, fencing_token, state, record
           FROM ${TABLE_NAME}
          WHERE run_id = $1`,
        [record.runId],
      );
      if (existing.rowCount !== 1 || existing.rows.length !== 1) {
        throw storeError(
          "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
          "The retirement registration conflict could not be loaded exactly.",
        );
      }
      return recordFromRow(existing.rows[0]);
    }));
  }

  async function load(runId) {
    if (typeof runId !== "string" || !/^run-[a-f0-9]{48}$/u.test(runId)) {
      throw storeError(
        "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
        "The retirement run identifier is invalid.",
      );
    }
    return withBoundClient(async (client) => {
      const result = await client.query(
        `SELECT run_id, revision, fencing_token, state, record
           FROM ${TABLE_NAME}
          WHERE run_id = $1`,
        [runId],
      );
      if (result.rowCount === 0) return null;
      if (result.rowCount !== 1 || result.rows.length !== 1) {
        throw storeError(
          "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
          "The retirement store returned a non-unique run.",
        );
      }
      return recordFromRow(result.rows[0]);
    });
  }

  async function compareExchange({
    runId,
    expectedRevision,
    expectedFencingToken,
    next,
  } = {}) {
    if (typeof runId !== "string" || !/^run-[a-f0-9]{48}$/u.test(runId)) {
      throw storeError(
        "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
        "The retirement run identifier is invalid.",
      );
    }
    exactInteger(expectedRevision, "Expected retirement revision");
    exactInteger(expectedFencingToken, "Expected retirement fencing token");
    const record = normalizeRecoveryWriterRetirementRecord(next);
    if (
      record.runId !== runId
      || record.revision !== expectedRevision + 1
      || record.fencingToken !== expectedFencingToken + 1
    ) {
      throw storeError(
        "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
        "The next retirement record does not advance the exact run fence.",
      );
    }
    const values = storedValues(record);
    return withBoundClient((client) => synchronousTransaction(client, async () => {
      const result = await client.query(
        `UPDATE ${TABLE_NAME}
            SET revision = $2,
                fencing_token = $3,
                state = $4,
                retirement_deadline_at = $5::timestamptz,
                attempt_lease_expires_at = $6::timestamptz,
                due_at = $7::timestamptz,
                record = $8::jsonb,
                updated_at = clock_timestamp()
          WHERE run_id = $1
            AND revision = $9
            AND fencing_token = $10
          RETURNING run_id, revision, fencing_token, state, record`,
        [...values, expectedRevision, expectedFencingToken],
      );
      if (result.rowCount === 0) return null;
      if (result.rowCount !== 1 || result.rows.length !== 1) {
        throw storeError(
          "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
          "The retirement CAS returned a non-unique result.",
        );
      }
      return recordFromRow(result.rows[0]);
    }));
  }

  async function listDue({ at, states, limit } = {}) {
    const checkedAt = exactIso(at, "Retirement sweep time");
    if (
      !Array.isArray(states)
      || states.length === 0
      || new Set(states).size !== states.length
      || states.some((state) => !DUE_STATES.has(state))
    ) {
      throw storeError(
        "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
        "The retirement sweep states are invalid.",
      );
    }
    const requestedLimit = exactInteger(limit, "Retirement sweep limit", {
      maximum: maximumDueRecords,
    });
    return withBoundClient(async (client) => {
      const result = await client.query(
        `SELECT run_id, revision, fencing_token, state, record
           FROM ${TABLE_NAME}
          WHERE due_at <= $1::timestamptz
            AND state = ANY($2::text[])
          ORDER BY due_at, run_id
          LIMIT $3`,
        [checkedAt, states, requestedLimit + 1],
      );
      if (result.rows.length > requestedLimit) {
        throw storeError(
          "RECOVERY_WRITER_RETIREMENT_STORE_CAPACITY_EXCEEDED",
          "The due retirement set exceeds the fixed sweep bound.",
        );
      }
      return result.rows.map(recordFromRow);
    });
  }

  return Object.freeze({ create, load, compareExchange, listDue });
}

export const recoveryWriterRetirementPostgresStoreInternals = Object.freeze({
  schemaName: SCHEMA_NAME,
  tableName: TABLE_NAME,
  metadataTableName: METADATA_TABLE_NAME,
  schemaVersion: SCHEMA_VERSION,
  dueLimit: DEFAULT_DUE_LIMIT,
  maxRecordBytes: MAX_RECORD_BYTES,
  maximumConnectionTimeoutMs: MAX_CONNECTION_TIMEOUT_MS,
  maximumQueryTimeoutMs: MAX_QUERY_TIMEOUT_MS,
  maximumStatementTimeoutMs: MAX_STATEMENT_TIMEOUT_MS,
  maximumLockTimeoutMs: MAX_LOCK_TIMEOUT_MS,
  maximumIdleTransactionTimeoutMs: MAX_IDLE_TRANSACTION_TIMEOUT_MS,
});
