import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  completeRecoveryDatabaseIdentitySha256,
} from "../scripts/complete-recovery-database.js";
import {
  assertRecoveryWriterRetirementControllerDatabaseUrlSeparation,
  createRecoveryWriterRetirementPostgresStore,
} from "../scripts/recovery-writer-retirement-postgres-store.js";

const RUN_ID = `run-${"1".repeat(48)}`;
const RUN_NONCE = "2".repeat(64);
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const IDENTITY = Object.freeze({
  systemIdentifier: "7612345678901234567",
  databaseOid: "17384",
  databaseName: "rivt_recovery_controller_test",
});
const IDENTITY_SHA256 = completeRecoveryDatabaseIdentitySha256(IDENTITY);
const BOUNDED_POOL_OPTIONS = Object.freeze({
  connectionTimeoutMillis: 5_000,
  query_timeout: 30_000,
  statement_timeout: 30_000,
  lock_timeout: 5_000,
  idle_in_transaction_session_timeout: 30_000,
});

function initialRecord(overrides = {}) {
  return {
    schema: "rivt-recovery-writer-retirement-record-v1",
    runId: RUN_ID,
    runNonce: RUN_NONCE,
    bindingDigestSha256: SHA_A,
    writerControlEvidenceLevel: "providerless-injected-fake",
    retirementDescriptorReference: `providerless-injected-fake:${RUN_ID}`,
    retirementDescriptorIdentitySha256: SHA_B,
    retirementDeadlineAt: "2026-08-17T15:05:00.000Z",
    retirementProofDeadlineAt: "2026-08-17T15:09:00.000Z",
    writerSessionExpiresAt: "2026-08-17T15:10:00.000Z",
    state: "registered",
    revision: 1,
    fencingToken: 1,
    registeredAt: "2026-08-17T15:00:00.000Z",
    retirementRequestedAt: null,
    retirementTrigger: null,
    writerOutcome: null,
    retiringAt: null,
    attemptLeaseExpiresAt: null,
    retirementAttempts: 0,
    retiredAt: null,
    retirementVerificationSha256: null,
    completionEligible: false,
    lastFailureCode: null,
    quarantinedAt: null,
    quarantineReason: null,
    ...overrides,
  };
}

function requestedRecord(overrides = {}) {
  return initialRecord({
    state: "retirement_requested",
    revision: 2,
    fencingToken: 2,
    retirementRequestedAt: "2026-08-17T15:01:00.000Z",
    retirementTrigger: "writer-requested",
    writerOutcome: "failed",
    ...overrides,
  });
}

function rowFor(record) {
  return {
    run_id: record.runId,
    revision: record.revision,
    fencing_token: record.fencingToken,
    state: record.state,
    record: structuredClone(record),
  };
}

function fakePool(queryHandler, lifecycle = []) {
  return {
    options: BOUNDED_POOL_OPTIONS,
    async connect() {
      lifecycle.push("connect");
      return {
        async query(sql, values) {
          const normalized = sql.trim().replace(/\s+/gu, " ");
          lifecycle.push([normalized, values]);
          return queryHandler(normalized, values);
        },
        release() {
          lifecycle.push("release");
        },
      };
    },
  };
}

function storeFor(pool, overrides = {}) {
  return createRecoveryWriterRetirementPostgresStore({
    pool,
    expectedRuntimeDatabaseIdentitySha256: IDENTITY_SHA256,
    prohibitedRuntimeDatabaseIdentitySha256s: {
      application: SHA_C,
      backup: SHA_C,
      restore: SHA_C,
    },
    async readRuntimeDatabaseIdentity() {
      return IDENTITY;
    },
    ...overrides,
  });
}

function schemaResult() {
  return { rowCount: 1, rows: [{ schema_version: 1 }] };
}

test("controller database URL guard requires three distinct protected databases", () => {
  assert.equal(assertRecoveryWriterRetirementControllerDatabaseUrlSeparation({
    controllerDatabaseUrl: "postgresql://controller:secret@db.example.test:5432/rivt_controller",
    applicationDatabaseUrl: "postgresql://app:secret@db.example.test:5432/rivt_app",
    backupDatabaseUrl: "postgresql://backup:secret@db.example.test:5432/rivt_backup",
    restoreDatabaseUrl: "postgresql://restore:secret@db.example.test:5432/rivt_restore",
  }), true);

  assert.throws(
    () => assertRecoveryWriterRetirementControllerDatabaseUrlSeparation({
      controllerDatabaseUrl: "postgresql://controller:secret@db.example.test:5432/rivt_app",
      applicationDatabaseUrl: "postgresql://different-user:secret@db.example.test/rivt_app",
      backupDatabaseUrl: "postgresql://backup:secret@db.example.test/rivt_backup",
      restoreDatabaseUrl: "postgresql://restore:secret@db.example.test/rivt_restore",
    }),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_DATABASE_COLLISION",
  );

  const secret = "controller-url-password";
  assert.throws(
    () => assertRecoveryWriterRetirementControllerDatabaseUrlSeparation({
      controllerDatabaseUrl: `postgresql://controller:${secret}@`,
      applicationDatabaseUrl: "postgresql://app:secret@db.example.test/rivt_app",
      backupDatabaseUrl: "postgresql://backup:secret@db.example.test/rivt_backup",
      restoreDatabaseUrl: "postgresql://restore:secret@db.example.test/rivt_restore",
    }),
    (error) => (
      error.code === "RECOVERY_WRITER_RETIREMENT_STORE_INVALID"
      && !JSON.stringify(error).includes(secret)
      && !String(error).includes(secret)
    ),
  );
});

test("construction is I/O-free and rejects a prohibited runtime identity", () => {
  let connectCalls = 0;
  const pool = {
    options: BOUNDED_POOL_OPTIONS,
    async connect() { connectCalls += 1; },
  };
  assert.throws(
    () => createRecoveryWriterRetirementPostgresStore({
      pool,
      expectedRuntimeDatabaseIdentitySha256: IDENTITY_SHA256,
      prohibitedRuntimeDatabaseIdentitySha256s: {
        application: IDENTITY_SHA256,
        backup: SHA_C,
        restore: SHA_C,
      },
    }),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_DATABASE_COLLISION",
  );
  assert.equal(connectCalls, 0);
});

test("construction requires all protected identities and fixed PostgreSQL timeouts", () => {
  const pool = {
    options: BOUNDED_POOL_OPTIONS,
    async connect() { throw new Error("must not connect"); },
  };
  assert.throws(
    () => createRecoveryWriterRetirementPostgresStore({
      pool,
      expectedRuntimeDatabaseIdentitySha256: IDENTITY_SHA256,
      prohibitedRuntimeDatabaseIdentitySha256s: {
        application: SHA_C,
        backup: SHA_C,
      },
    }),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
  );
  assert.throws(
    () => createRecoveryWriterRetirementPostgresStore({
      pool: {
        ...pool,
        options: { ...BOUNDED_POOL_OPTIONS, lock_timeout: 5_001 },
      },
      expectedRuntimeDatabaseIdentitySha256: IDENTITY_SHA256,
      prohibitedRuntimeDatabaseIdentitySha256s: {
        application: SHA_C,
        backup: SHA_C,
        restore: SHA_C,
      },
    }),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
  );
});

test("create binds identity and schema before a synchronous durable insert", async () => {
  const record = initialRecord();
  const lifecycle = [];
  const pool = fakePool((sql, values) => {
    if (sql.startsWith("SELECT schema_version")) return schemaResult();
    if (["BEGIN", "SET LOCAL synchronous_commit = on", "COMMIT"].includes(sql)) {
      return { rowCount: null, rows: [] };
    }
    if (sql.startsWith("INSERT INTO rivt_recovery_control.writer_retirement_records")) {
      assert.equal(values[0], RUN_ID);
      assert.equal(values[1], 1);
      assert.equal(values[6], record.retirementDeadlineAt);
      return { rowCount: 1, rows: [rowFor(record)] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }, lifecycle);
  let identityReads = 0;
  const store = storeFor(pool, {
    async readRuntimeDatabaseIdentity() {
      identityReads += 1;
      return IDENTITY;
    },
  });

  assert.deepEqual(await store.create(record), record);
  assert.equal(identityReads, 1);
  assert.equal(lifecycle[0], "connect");
  assert.match(lifecycle[1][0], /^SELECT schema_version/u);
  assert.equal(lifecycle[2][0], "BEGIN");
  assert.equal(lifecycle[3][0], "SET LOCAL synchronous_commit = on");
  assert.match(lifecycle[4][0], /^INSERT INTO/u);
  assert.equal(lifecycle[5][0], "COMMIT");
  assert.equal(lifecycle[6], "release");
});

test("idempotent create returns the exact existing durable record", async () => {
  const record = requestedRecord();
  const pool = fakePool((sql) => {
    if (sql.startsWith("SELECT schema_version")) return schemaResult();
    if (["BEGIN", "SET LOCAL synchronous_commit = on", "COMMIT"].includes(sql)) {
      return { rows: [] };
    }
    if (sql.startsWith("INSERT INTO")) return { rowCount: 0, rows: [] };
    if (sql.startsWith("SELECT run_id")) return { rowCount: 1, rows: [rowFor(record)] };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  assert.deepEqual(await storeFor(pool).create(initialRecord()), record);
});

test("compareExchange performs one conditional update and returns null when stale", async () => {
  const record = requestedRecord();
  let updateValues;
  const pool = fakePool((sql, values) => {
    if (sql.startsWith("SELECT schema_version")) return schemaResult();
    if (["BEGIN", "SET LOCAL synchronous_commit = on", "COMMIT"].includes(sql)) {
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE rivt_recovery_control.writer_retirement_records")) {
      updateValues = values;
      return { rowCount: 0, rows: [] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await storeFor(pool).compareExchange({
    runId: RUN_ID,
    expectedRevision: 1,
    expectedFencingToken: 1,
    next: record,
  });
  assert.equal(result, null);
  assert.equal(updateValues[8], 1);
  assert.equal(updateValues[9], 1);
});

test("compareExchange rejects a skipped fence before opening a connection", async () => {
  let connectCalls = 0;
  const store = storeFor({
    options: BOUNDED_POOL_OPTIONS,
    async connect() { connectCalls += 1; },
  });
  await assert.rejects(
    () => store.compareExchange({
      runId: RUN_ID,
      expectedRevision: 1,
      expectedFencingToken: 1,
      next: requestedRecord({ fencingToken: 3 }),
    }),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_INVALID",
  );
  assert.equal(connectCalls, 0);
});

test("listDue is deterministic and fails closed instead of truncating", async () => {
  const record = initialRecord();
  let observedValues;
  const pool = fakePool((sql, values) => {
    if (sql.startsWith("SELECT schema_version")) return schemaResult();
    if (sql.startsWith("SELECT run_id")) {
      observedValues = values;
      return { rowCount: 1, rows: [rowFor(record)] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const store = storeFor(pool, { dueLimit: 2 });
  const result = await store.listDue({
    at: "2026-08-17T15:06:00.000Z",
    states: ["registered"],
    limit: 2,
  });
  assert.deepEqual(result, [record]);
  assert.equal(observedValues[2], 3);

  const overflowPool = fakePool((sql) => {
    if (sql.startsWith("SELECT schema_version")) return schemaResult();
    if (sql.startsWith("SELECT run_id")) {
      return { rowCount: 3, rows: [rowFor(record), rowFor(record), rowFor(record)] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  await assert.rejects(
    () => storeFor(overflowPool, { dueLimit: 2 }).listDue({
      at: "2026-08-17T15:06:00.000Z",
      states: ["registered"],
      limit: 2,
    }),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_CAPACITY_EXCEEDED",
  );
});

test("runtime identity drift fails before schema or record access", async () => {
  const lifecycle = [];
  const pool = fakePool(() => {
    throw new Error("schema query must not run");
  }, lifecycle);
  const store = storeFor(pool, {
    async readRuntimeDatabaseIdentity() {
      return { ...IDENTITY, databaseOid: "99999" };
    },
  });

  await assert.rejects(
    () => store.load(RUN_ID),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_DATABASE_COLLISION",
  );
  assert.deepEqual(lifecycle, ["connect", "release"]);
});

test("malformed rows and unsupported schema versions fail closed", async () => {
  const wrongSchemaPool = fakePool((sql) => {
    if (sql.startsWith("SELECT schema_version")) {
      return { rowCount: 1, rows: [{ schema_version: 2 }] };
    }
    throw new Error("record query must not run");
  });
  await assert.rejects(
    () => storeFor(wrongSchemaPool).load(RUN_ID),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_SCHEMA_MISMATCH",
  );

  const corruptPool = fakePool((sql) => {
    if (sql.startsWith("SELECT schema_version")) return schemaResult();
    if (sql.startsWith("SELECT run_id")) {
      return {
        rowCount: 1,
        rows: [{ ...rowFor(initialRecord()), fencing_token: 99 }],
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  await assert.rejects(
    () => storeFor(corruptPool).load(RUN_ID),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STORE_CORRUPT",
  );
});

test("controller migration is explicit-only, constrained, and rollback preserves evidence", () => {
  const up = readFileSync(new URL(
    "../migrations/recovery-writer-retirement-controller/0001_durable_records.up.sql",
    import.meta.url,
  ), "utf8");
  const down = readFileSync(new URL(
    "../migrations/recovery-writer-retirement-controller/0001_durable_records.down.sql",
    import.meta.url,
  ), "utf8");

  assert.match(up, /CREATE SCHEMA rivt_recovery_control/u);
  assert.match(up, /run_id text PRIMARY KEY/u);
  assert.match(up, /record jsonb NOT NULL/u);
  assert.match(up, /record ->> 'revision'\)::bigint = revision\) IS TRUE/u);
  assert.match(up, /writer_retirement_records_due_idx/u);
  assert.match(up, /REVOKE ALL .* FROM PUBLIC/u);
  assert.doesNotMatch(up, /GRANT .* PUBLIC/iu);
  assert.match(down, /LOCK TABLE .* ACCESS EXCLUSIVE MODE/su);
  assert.match(down, /refusing to remove nonempty writer-retirement evidence/u);
  assert.doesNotMatch(down, /CASCADE/iu);
});
