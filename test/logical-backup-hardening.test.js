import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  BackupConfigurationError,
  acquireLogicalBackupLock,
  backupJobTimeoutMsFromEnv,
  ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2,
  LOGICAL_BACKUP_FORMAT_V2,
  LOGICAL_BACKUP_MANIFEST_FORMAT_V2,
  POSTGRES_TEXT_ROW_ENCODING,
  aggregateTableDigest,
  assertBackupCatalogComplete,
  assertBackupDatabaseRoleReadOnly,
  assertDifferentDatabases,
  assertDifferentRuntimeDatabases,
  backupEncryptionSecret,
  beginReadOnlyBackupSnapshot,
  bodyToBuffer,
  canonicalTableDigest,
  decryptSnapshot,
  destinationS3Config,
  diffCounts,
  encryptionKeyFromSecret,
  encryptionKeyIdFromSecret,
  encryptSnapshot,
  enforceRecoveryRto,
  insertBatch,
  maxBackupAgeHoursFromEnv,
  newestBackupVersion,
  orderedTables,
  previousBackupEncryptionSecret,
  protectedArtifactMetadata,
  publicTables,
  putProtectedJsonObject,
  recoveryRtoMinutesFromEnv,
  requiredSourceCommit,
  restoreSourceS3Config,
  retentionDaysFromEnv,
  rowsForTable,
  runtimeDatabaseIdentity,
  sanitizedFailure,
  sanitizedSuccess,
  sha256Hex,
  snapshotTableDigests,
  sslFor,
  strictEncryptionKeyFromSecret,
  strictRestoreEncryptionSecrets,
  tableColumns,
  validateHttpsEndpoint,
  verifyBucketProtection,
  verifyProtectedBackupObject,
} from "../scripts/logical-backup-utils.js";
import { verifyLogicalBackup } from "../scripts/verify-logical-backup.js";
import { createLogicalBackupArtifact } from "../scripts/create-logical-backup-artifact.js";
import {
  applySnapshotToTarget,
  restoreLogicalBackupArtifact,
} from "../scripts/restore-logical-backup-artifact.js";
import { completeInventory, verifyRestoreDrill } from "../scripts/restore-drill.js";
import { backupKeyIdReceipt } from "../scripts/backup-key-id.js";
import { runScheduledLogicalBackup } from "../scripts/run-scheduled-logical-backup.js";

const snapshot = {
  format: "rivt-logical-backup-v1",
  createdAt: "2026-06-20T00:00:00.000Z",
  sourceCommit: "abc1234",
  manifest: {
    format: "rivt-logical-backup-manifest-v1",
    counts: { accounts: 1 },
    tableCount: 1,
    rowCount: 1,
  },
  sequences: [],
  tables: [{
    name: "accounts",
    columns: [{ name: "id", identityGeneration: null }],
    rows: [{ id: "acct-1" }],
  }],
};

function legacyEncryptedSnapshot(value, secret) {
  const key = encryptionKeyFromSecret(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(gzipSync(Buffer.from(JSON.stringify(value)))),
    cipher.final(),
  ]);
  return {
    format: "rivt-encrypted-logical-backup-v1",
    algorithm: "aes-256-gcm",
    compression: "gzip",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function keyedAuthenticatedPayload(payload, secret) {
  const key = encryptionKeyFromSecret(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  return {
    format: "rivt-encrypted-logical-backup-v1",
    algorithm: "aes-256-gcm",
    compression: "gzip",
    keyId: encryptionKeyIdFromSecret(secret),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptLikePreRotationCode(envelope, secret) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKeyFromSecret(secret),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const compressed = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(gunzipSync(compressed).toString("utf8"));
}

test("logical backup encryption round trips without exposing plaintext or key material", () => {
  const encrypted = encryptSnapshot(snapshot, "test-secret");
  assert.equal(encrypted.format, "rivt-encrypted-logical-backup-v1");
  assert.match(encrypted.keyId, /^[a-f0-9]{32}$/);
  assert.equal(JSON.stringify(encrypted).includes("acct-1"), false);
  assert.equal(JSON.stringify(encrypted).includes("test-secret"), false);
  assert.deepEqual(decryptSnapshot(encrypted, "test-secret"), snapshot);
  assert.deepEqual(decryptLikePreRotationCode(encrypted, "test-secret"), snapshot);
});

test("new backup encryption is v2 and does not expose the manifest", () => {
  const secret = "1".repeat(64);
  const encrypted = encryptSnapshot(losslessSnapshot, secret);
  assert.equal(encrypted.format, ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2);
  assert.equal("manifest" in encrypted, false);
  assert.equal(JSON.stringify(encrypted).includes("accounts"), false);
  assert.deepEqual(decryptSnapshot(encrypted, secret), losslessSnapshot);
});

test("keyed backup restores with the configured previous key after rotation", () => {
  const encrypted = encryptSnapshot(snapshot, "previous-secret");
  assert.deepEqual(
    decryptSnapshot(encrypted, {
      active: "active-secret",
      previous: "previous-secret",
    }),
    snapshot,
  );
});

test("legacy backup tries the active key then the previous key", () => {
  const encrypted = legacyEncryptedSnapshot(snapshot, "previous-secret");
  assert.deepEqual(
    decryptSnapshot(encrypted, {
      active: "active-secret",
      previous: "previous-secret",
    }),
    snapshot,
  );
});

test("keyed backup fails closed for an unknown or tampered key identifier", () => {
  const encrypted = encryptSnapshot(snapshot, "active-secret");
  assert.throws(
    () => decryptSnapshot(encrypted, {
      active: "different-active-secret",
      previous: "different-previous-secret",
    }),
    /Unable to decrypt backup/,
  );

  const tampered = {
    ...encrypted,
    keyId: encryptSnapshot(snapshot, "different-previous-secret").keyId,
  };
  assert.throws(
    () => decryptSnapshot(tampered, {
      active: "active-secret",
      previous: "different-previous-secret",
    }),
    /Unable to decrypt backup/,
  );
});

test("authenticated payload corruption is not misreported as a key mismatch", () => {
  const encrypted = keyedAuthenticatedPayload(Buffer.from("not-a-gzip-payload"), "active-secret");
  assert.throws(
    () => decryptSnapshot(encrypted, "active-secret"),
    (error) => {
      assert.equal(error.message.includes("configured encryption keys"), false);
      return true;
    },
  );
});

test("restore key rotation reads the configured previous-key alias without exposing it", () => {
  const originalPrimary = process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS;
  const originalAlias = process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS;
  delete process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS;
  process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS = "previous-secret";
  try {
    assert.equal(previousBackupEncryptionSecret(), "previous-secret");
  } finally {
    if (originalPrimary === undefined) delete process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS;
    else process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS = originalPrimary;
    if (originalAlias === undefined) delete process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS;
    else process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS = originalAlias;
  }
});

test("backup key aliases ignore blank higher-priority variables", () => {
  const names = [
    "BACKUP_ENCRYPTION_KEY",
    "RIVT_BACKUP_ENCRYPTION_KEY",
    "BACKUP_SECRET",
    "BACKUP_ENCRYPTION_KEY_PREVIOUS",
    "RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS",
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.BACKUP_ENCRYPTION_KEY = " ";
  process.env.RIVT_BACKUP_ENCRYPTION_KEY = "active-alias";
  process.env.BACKUP_SECRET = "legacy-alias";
  process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS = "";
  process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS = "previous-alias";
  try {
    assert.equal(backupEncryptionSecret(), "active-alias");
    assert.equal(previousBackupEncryptionSecret(), "previous-alias");
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

test("logical backup restore count diff reports only mismatches", () => {
  assert.deepEqual(diffCounts({ accounts: 2, jobs: 1 }, { accounts: 2, jobs: 0 }), [
    { tableName: "jobs", expected: 1, actual: 0, delta: -1 },
  ]);
});

test("logical restore ordering sorts foreign-key dependencies before dependents", () => {
  assert.deepEqual(
    orderedTables(["job_applications", "jobs", "accounts"], [
      { tableName: "jobs", referencedTableName: "accounts" },
      { tableName: "job_applications", referencedTableName: "jobs" },
    ]),
    ["accounts", "jobs", "job_applications"],
  );
});

test("logical backup restore refuses matching database identities", () => {
  const databaseUrl = "postgresql://user:password@example.test:5432/rivt";
  assert.throws(
    () => assertDifferentDatabases(databaseUrl, databaseUrl),
    /must not match/,
  );
  assert.throws(
    () => assertDifferentDatabases(
      "postgresql://backup_reader:password@example.test:5432/rivt",
      "postgresql://restore_writer:other@example.test:5432/rivt",
    ),
    /identities match even if their usernames differ/,
  );
});

test("restore isolation uses runtime cluster and database identity, not connection aliases", async () => {
  const identity = await runtimeDatabaseIdentity({
    async query(sql) {
      assert.match(sql, /pg_catalog\.pg_control_system\(\)/);
      return {
        rows: [{
          system_identifier: "7442812116162923295",
          database_oid: "16384",
          database_name: "rivt",
        }],
      };
    },
  });
  assert.deepEqual(identity, {
    systemIdentifier: "7442812116162923295",
    databaseOid: "16384",
    databaseName: "rivt",
  });
  assert.throws(
    () => assertDifferentRuntimeDatabases(identity, { ...identity, databaseName: "alias_name" }),
    (error) => error.code === "BACKUP_CONFIG_INVALID",
  );
  assert.throws(() => assertDifferentRuntimeDatabases(identity, {
    ...identity,
    databaseOid: "16385",
    databaseName: "isolated_restore",
  }), (error) => error.code === "BACKUP_CONFIG_INVALID");
  assert.doesNotThrow(() => assertDifferentRuntimeDatabases(identity, {
    ...identity,
    systemIdentifier: "7442812116162923296",
    databaseOid: "16384",
  }));
  await assert.rejects(
    () => runtimeDatabaseIdentity({ async query() { throw new Error("permission denied"); } }),
    (error) => error.code === "BACKUP_CONFIG_INVALID",
  );
});

test("logical backup column metadata retains target data types for restore binding", async () => {
  const client = {
    async query() {
      return {
        rows: [
          {
            column_name: "id",
            type_name: "bigint",
            is_generated: "NEVER",
            identity_generation: "ALWAYS",
          },
          {
            column_name: "thread_messages",
            type_name: "jsonb",
            is_generated: "NEVER",
            identity_generation: null,
          },
          {
            column_name: "generated_label",
            type_name: "text",
            is_generated: "ALWAYS",
            identity_generation: null,
          },
        ],
      };
    },
  };

  assert.deepEqual(await tableColumns(client, "customers"), [
    { name: "id", typeName: "bigint", identityGeneration: "ALWAYS" },
    { name: "thread_messages", typeName: "jsonb", identityGeneration: null },
  ]);
});

test("logical restore binds JSON arrays and values as JSON without changing ordinary or identity values", async () => {
  let captured;
  const client = {
    async query(sql, values) {
      captured = { sql, values };
    },
  };
  const columns = [
    { name: "id", dataType: "bigint", identityGeneration: "ALWAYS" },
    { name: "thread_messages", dataType: "jsonb", identityGeneration: null },
    { name: "metadata", dataType: "json", identityGeneration: null },
    { name: "label", dataType: "text", identityGeneration: null },
  ];

  await insertBatch(client, "customers", columns, [
    {
      id: 41,
      thread_messages: [],
      metadata: { source: "restore" },
      label: "empty",
    },
    {
      id: 42,
      thread_messages: [{ body: "Measured twice" }, "plain", 3, true],
      metadata: "customer note",
      label: "nonempty",
    },
  ]);

  assert.match(captured.sql, /OVERRIDING SYSTEM VALUE/);
  assert.deepEqual(captured.values, [
    41,
    "[]",
    '{"source":"restore"}',
    "empty",
    42,
    '[{"body":"Measured twice"},"plain",3,true]',
    '"customer note"',
    "nonempty",
  ]);
});

test("lossless v2 rows preserve PostgreSQL canonical text through backup and restore binding", async () => {
  const columns = [
    { name: "captured_at", typeName: "timestamp with time zone", identityGeneration: null },
    { name: "payload", typeName: "jsonb", identityGeneration: null },
    { name: "amount", typeName: "numeric(30,12)", identityGeneration: null },
    { name: "raw", typeName: "bytea", identityGeneration: null },
    { name: "measurements", typeName: "numeric[]", identityGeneration: null },
  ];
  const exactRow = {
    captured_at: "2026-08-01 12:00:00.123456+00",
    payload: '{"id": 9007199254740993}',
    amount: "9007199254740993.123456789012",
    raw: "\\x00ff80",
    measurements: "{1.125,9007199254740993.000000000001}",
  };
  let selectSql = "";
  const rows = await rowsForTable({
    async query(sql) {
      selectSql = sql;
      return { rows: [exactRow] };
    },
  }, "measurements", columns);
  assert.deepEqual(rows, [exactRow]);
  for (const column of columns) {
    assert.match(selectSql, new RegExp(`"${column.name}"::text AS "${column.name}"`));
  }

  let insert;
  await insertBatch({
    async query(sql, values) { insert = { sql, values }; },
  }, "measurements", columns, rows, { rowEncoding: POSTGRES_TEXT_ROW_ENCODING });
  assert.deepEqual(insert.values, Object.values(exactRow));
  assert.equal(insert.values[1], '{"id": 9007199254740993}');
  assert.equal(insert.values[0].endsWith(".123456+00"), true);
  assert.equal(insert.values[3], "\\x00ff80");
});

test("destructive restore work rolls back trigger changes and rows on any copy failure", async () => {
  const statements = [];
  const columns = [{ name: "id", typeName: "bigint", identityGeneration: null }];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("FROM pg_catalog.pg_attribute")) {
        return {
          rows: [{
            column_name: "id",
            type_name: "bigint",
            is_generated: "NEVER",
            identity_generation: null,
          }],
        };
      }
      if (sql.startsWith("INSERT INTO")) throw new Error("simulated copy failure");
      return { rows: [] };
    },
  };
  await assert.rejects(
    () => applySnapshotToTarget(client, {
      copyOrder: ["accounts"],
      snapshotTables: new Map([["accounts", {
        name: "accounts",
        columns,
        rows: [{ id: "9007199254740993" }],
      }]]),
      sequences: [],
      batchSize: 200,
    }),
    /simulated copy failure/,
  );
  assert.equal(statements[0], "BEGIN");
  assert.ok(statements.some((sql) => /DISABLE TRIGGER USER/.test(sql)));
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.equal(statements.includes("COMMIT"), false);
});

const destinationEnv = {
  BACKUP_DESTINATION_S3_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
  BACKUP_DESTINATION_S3_REGION: "us-west-004",
  BACKUP_DESTINATION_S3_BUCKET: "rivt-backups-prod",
  BACKUP_DESTINATION_S3_PREFIX: "postgres/daily",
  BACKUP_DESTINATION_S3_ACCESS_KEY_ID: "backup-only-key",
  BACKUP_DESTINATION_S3_SECRET_ACCESS_KEY: "backup-only-secret",
};

const losslessSnapshot = {
  format: LOGICAL_BACKUP_FORMAT_V2,
  rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
  createdAt: "2026-08-01T12:00:00.000Z",
  sourceCommit: "b".repeat(40),
  manifest: {
    format: LOGICAL_BACKUP_MANIFEST_FORMAT_V2,
    rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
    createdAt: "2026-08-01T12:00:00.000Z",
    sourceCommit: "b".repeat(40),
    counts: { accounts: 1 },
    tableCount: 1,
    rowCount: 1,
  },
  sequences: [],
  tables: [{
    name: "accounts",
    columns: [{ name: "id", typeName: "text", identityGeneration: null }],
    rows: [{ id: "acct-1" }],
  }],
};

test("backup and restore storage configuration never falls back to application S3 credentials", () => {
  assert.throws(
    () => destinationS3Config({
      S3_ENDPOINT: "https://app-storage.example.test",
      S3_BUCKET: "application-uploads",
      S3_ACCESS_KEY_ID: "app-key",
      S3_SECRET_ACCESS_KEY: "app-secret",
    }),
    /BACKUP_DESTINATION_S3_ENDPOINT is required/,
  );
  assert.throws(
    () => restoreSourceS3Config(destinationEnv),
    /RESTORE_SOURCE_S3_ENDPOINT is required/,
  );
  assert.equal(destinationS3Config(destinationEnv).prefix, "postgres/daily");
  assert.throws(
    () => destinationS3Config({
      ...destinationEnv,
      S3_BUCKET: destinationEnv.BACKUP_DESTINATION_S3_BUCKET,
    }),
    /must be separate/,
  );
  assert.throws(
    () => destinationS3Config({
      ...destinationEnv,
      S3_ACCESS_KEY_ID: destinationEnv.BACKUP_DESTINATION_S3_ACCESS_KEY_ID,
    }),
    /dedicated least-privilege/,
  );
  const restoreEnv = Object.fromEntries(
    Object.entries(destinationEnv).map(([name, value]) => [name.replace("BACKUP_DESTINATION", "RESTORE_SOURCE"), value]),
  );
  assert.throws(
    () => restoreSourceS3Config({
      ...restoreEnv,
      BACKUP_DESTINATION_S3_ACCESS_KEY_ID: restoreEnv.RESTORE_SOURCE_S3_ACCESS_KEY_ID,
    }),
    /separate read-only storage key/,
  );
});

test("backup creation never falls back to DATABASE_URL and restore never falls back to application storage", async () => {
  await assert.rejects(
    () => createLogicalBackupArtifact({
      env: {
        ...destinationEnv,
        DATABASE_URL: "postgresql://app:secret@app.example.test/rivt",
        SOURCE_COMMIT: "a".repeat(40),
        BACKUP_ENCRYPTION_KEY: "1".repeat(64),
      },
    }),
    /BACKUP_DATABASE_URL is required/,
  );
  await assert.rejects(
    () => restoreLogicalBackupArtifact({
      env: {
        RESTORE_DATABASE_URL: "postgresql://restore:secret@restore.example.test/rivt",
        RESTORE_SOURCE_DATABASE_URL: "postgresql://reader:secret@source.example.test/rivt",
        CONFIRM_RESTORE_TARGET_ISOLATED: "true",
        S3_ENDPOINT: "https://app-storage.example.test",
        S3_BUCKET: "application-uploads",
        S3_ACCESS_KEY_ID: "app-key",
        S3_SECRET_ACCESS_KEY: "app-secret",
        RESTORE_BACKUP_S3_KEY: "postgres/daily/artifact",
        RESTORE_BACKUP_S3_VERSION_ID: "v1",
        RESTORE_BACKUP_SHA256: "a".repeat(64),
      },
      applyMigrations: false,
    }),
    /RESTORE_SOURCE_S3_ENDPOINT is required/,
  );
});

test("backup endpoints require a credential-free HTTPS origin", () => {
  assert.equal(validateHttpsEndpoint("https://s3.example.test/"), "https://s3.example.test");
  for (const endpoint of [
    "http://s3.example.test",
    "https://user:secret@s3.example.test",
    "https://s3.example.test/path",
    "https://s3.example.test?bucket=wrong",
  ]) {
    assert.throws(() => validateHttpsEndpoint(endpoint), BackupConfigurationError);
  }
});

test("database TLS uses exact loopback detection and verifies remote server identity", () => {
  assert.equal(sslFor("postgresql://user:secret@localhost/rivt", {}), false);
  assert.equal(sslFor("postgresql://user:secret@127.0.0.1/rivt", {}), false);
  assert.deepEqual(
    sslFor("postgresql://user:secret@localhost.attacker.example/rivt", {}),
    { rejectUnauthorized: true },
  );
  assert.deepEqual(
    sslFor("postgresql://user:secret@db.example.test/rivt", { PGSSL_CA: "line-one\\nline-two" }),
    { rejectUnauthorized: true, ca: "line-one\nline-two" },
  );
  assert.throws(
    () => sslFor("postgresql://user:secret@db.example.test/rivt", { PGSSL: "disable" }),
    (error) => error.code === "BACKUP_CONFIG_INVALID",
  );
  for (const query of [
    "sslmode=disable",
    "sslmode=allow",
    "sslmode=prefer",
    "sslmode=require",
    "sslmode=no-verify",
    "ssl=false",
  ]) {
    assert.throws(
      () => sslFor(`postgresql://user:secret@db.example.test/rivt?${query}`, {}),
      (error) => error.code === "BACKUP_CONFIG_INVALID",
    );
  }
  assert.deepEqual(
    sslFor("postgresql://user:secret@db.example.test/rivt?sslmode=verify-full", {}),
    { rejectUnauthorized: true },
  );
});

test("backup storage and database configuration reject Node-wide TLS verification bypass", () => {
  assert.throws(
    () => sslFor("postgresql://user:secret@db.example.test/rivt", {
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
    }),
    (error) => error.code === "BACKUP_CONFIG_INVALID",
  );
  assert.throws(
    () => destinationS3Config({
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
      BACKUP_DESTINATION_S3_ENDPOINT: "https://s3.example.test",
      BACKUP_DESTINATION_S3_REGION: "us-east-1",
      BACKUP_DESTINATION_S3_BUCKET: "rivt-backups",
      BACKUP_DESTINATION_S3_PREFIX: "postgres/daily",
      BACKUP_DESTINATION_S3_ACCESS_KEY_ID: "backup-key",
      BACKUP_DESTINATION_S3_SECRET_ACCESS_KEY: "backup-secret",
    }),
    (error) => error.code === "BACKUP_CONFIG_INVALID",
  );
});

test("new backup keys must encode exactly 32 bytes while legacy decryption remains compatible", () => {
  const bytes = crypto.randomBytes(32);
  assert.deepEqual(strictEncryptionKeyFromSecret(bytes.toString("hex")), bytes);
  assert.deepEqual(strictEncryptionKeyFromSecret(bytes.toString("base64")), bytes);
  assert.deepEqual(strictEncryptionKeyFromSecret(bytes.toString("base64url")), bytes);
  assert.throws(() => strictEncryptionKeyFromSecret("old-human-passphrase"), /exactly 32 random bytes/);

  const legacyEnvelope = legacyEncryptedSnapshot(snapshot, "old-human-passphrase");
  assert.deepEqual(decryptSnapshot(legacyEnvelope, "old-human-passphrase"), snapshot);
});

test("restore accepts only explicit strict active and previous keys", () => {
  const active = "1".repeat(64);
  const previous = "2".repeat(64);
  assert.deepEqual(strictRestoreEncryptionSecrets({
    BACKUP_ENCRYPTION_KEY: active,
    BACKUP_ENCRYPTION_KEY_PREVIOUS: previous,
  }), { active, previous });
  assert.throws(
    () => strictRestoreEncryptionSecrets({ RIVT_BACKUP_ENCRYPTION_KEY: active }),
    /BACKUP_ENCRYPTION_KEY is required/,
  );
  assert.throws(
    () => strictRestoreEncryptionSecrets({ BACKUP_ENCRYPTION_KEY: "human-passphrase" }),
    /exactly 32 random bytes/,
  );
  assert.throws(
    () => strictRestoreEncryptionSecrets({
      BACKUP_ENCRYPTION_KEY: active,
      BACKUP_ENCRYPTION_KEY_PREVIOUS: active,
    }),
    /must be different/,
  );
});

test("backup key-id helper emits only the nonsecret active-key fingerprint", () => {
  const secret = crypto.randomBytes(32).toString("hex");
  const receipt = backupKeyIdReceipt({ BACKUP_ENCRYPTION_KEY: secret });
  assert.deepEqual(receipt, {
    ok: true,
    mode: "backup-key-id",
    keyId: encryptionKeyIdFromSecret(secret),
  });
  assert.equal(JSON.stringify(receipt).includes(secret), false);
  assert.throws(
    () => backupKeyIdReceipt({ BACKUP_ENCRYPTION_KEY: "human-passphrase" }),
    /exactly 32 random bytes/,
  );
});

test("backup evidence requires a full source commit and bounded policy thresholds", () => {
  assert.equal(requiredSourceCommit({ SOURCE_COMMIT: "A".repeat(40) }), "a".repeat(40));
  assert.equal(requiredSourceCommit({
    SOURCE_COMMIT: "A".repeat(40),
    RAILWAY_GIT_COMMIT_SHA: "a".repeat(40),
    RAILWAY_SERVICE_ID: "service-id",
  }), "a".repeat(40));
  assert.throws(() => requiredSourceCommit({ SOURCE_COMMIT: "abc1234" }), /full 40-character/);
  assert.throws(
    () => requiredSourceCommit({ SOURCE_COMMIT: "a".repeat(40), RAILWAY_SERVICE_ID: "service-id" }),
    (error) => error.code === "BACKUP_CONFIG_INVALID",
  );
  assert.throws(
    () => requiredSourceCommit({
      SOURCE_COMMIT: "a".repeat(40),
      RAILWAY_GIT_COMMIT_SHA: "b".repeat(40),
      RAILWAY_SERVICE_ID: "service-id",
    }),
    (error) => error.code === "BACKUP_SOURCE_MISMATCH",
  );
  assert.equal(backupJobTimeoutMsFromEnv({}), 45 * 60_000);
  assert.equal(backupJobTimeoutMsFromEnv({ BACKUP_JOB_TIMEOUT_MINUTES: "60" }), 60 * 60_000);
  assert.throws(
    () => backupJobTimeoutMsFromEnv({ BACKUP_JOB_TIMEOUT_MINUTES: "61" }),
    /cannot exceed 60/,
  );
  assert.equal(retentionDaysFromEnv({}), 30);
  assert.throws(() => retentionDaysFromEnv({ BACKUP_RETENTION_DAYS: "29" }), /at least 30/);
  assert.equal(maxBackupAgeHoursFromEnv({}), 14);
  assert.throws(() => maxBackupAgeHoursFromEnv({ BACKUP_MAX_AGE_HOURS: "15" }), /cannot exceed 14/);
  assert.equal(recoveryRtoMinutesFromEnv({}), 240);
  assert.throws(() => recoveryRtoMinutesFromEnv({ RECOVERY_RTO_MINUTES: "241" }), /cannot exceed 240/);
  assert.deepEqual(enforceRecoveryRto(12_000, 3_000, 240), {
    restoreDurationMs: 12_000,
    verifyDurationMs: 3_000,
    combinedDurationMs: 15_000,
    rtoMinutes: 240,
  });
  assert.throws(() => enforceRecoveryRto(14_400_000, 1, 240), (error) => error.code === "BACKUP_RTO_EXCEEDED");
});

test("logical backup advisory lock fails closed when another run holds it", async () => {
  await acquireLogicalBackupLock({
    async query(sql) {
      assert.match(sql, /pg_try_advisory_lock/);
      return { rows: [{ acquired: true }] };
    },
  });
  await assert.rejects(
    () => acquireLogicalBackupLock({ async query() { return { rows: [{ acquired: false }] }; } }),
    (error) => error.code === "BACKUP_ALREADY_RUNNING",
  );
});

test("scheduled backup wrapper passes through success and stops a run after its deadline", async () => {
  const successfulChild = new EventEmitter();
  successfulChild.kill = () => true;
  let spawnCall;
  const success = runScheduledLogicalBackup({
    env: { SAFE: "value" },
    timeoutMs: 1_000,
    spawnImpl(command, args, options) {
      spawnCall = { command, args, options };
      queueMicrotask(() => successfulChild.emit("exit", 0, null));
      return successfulChild;
    },
  });
  assert.deepEqual(await success, { ok: true });
  assert.equal(spawnCall.command, process.execPath);
  assert.equal(spawnCall.args.length, 1);
  assert.match(spawnCall.args[0], /create-logical-backup-artifact\.js$/);
  assert.deepEqual(spawnCall.options.env, { SAFE: "value" });
  assert.equal(spawnCall.options.stdio, "inherit");

  const timedOutChild = new EventEmitter();
  const signals = [];
  timedOutChild.kill = (signal) => {
    signals.push(signal);
    if (signal === "SIGTERM") queueMicrotask(() => timedOutChild.emit("exit", null, signal));
    return true;
  };
  await assert.rejects(
    () => runScheduledLogicalBackup({
      env: {},
      timeoutMs: 5,
      terminationGraceMs: 5,
      spawnImpl: () => timedOutChild,
    }),
    (error) => error.code === "BACKUP_JOB_TIMEOUT",
  );
  assert.deepEqual(signals, ["SIGTERM"]);

  const uncooperativeChild = new EventEmitter();
  const escalatedSignals = [];
  uncooperativeChild.kill = (signal) => {
    escalatedSignals.push(signal);
    if (signal === "SIGKILL") queueMicrotask(() => uncooperativeChild.emit("exit", null, signal));
    return true;
  };
  await assert.rejects(
    () => runScheduledLogicalBackup({
      env: {},
      timeoutMs: 5,
      terminationGraceMs: 5,
      spawnImpl: () => uncooperativeChild,
    }),
    (error) => error.code === "BACKUP_JOB_TIMEOUT",
  );
  assert.deepEqual(escalatedSignals, ["SIGTERM", "SIGKILL"]);
});

test("scheduled backup wrapper bounds failed termination and forwards host shutdown signals", async () => {
  const stuckChild = new EventEmitter();
  const stuckSignals = [];
  let stuckChildUnrefCount = 0;
  stuckChild.kill = (signal) => {
    stuckSignals.push(signal);
    if (signal === "SIGTERM") {
      queueMicrotask(() => stuckChild.emit("error", new Error("simulated kill failure")));
    }
    return false;
  };
  stuckChild.unref = () => {
    stuckChildUnrefCount += 1;
  };
  await assert.rejects(
    () => runScheduledLogicalBackup({
      env: {},
      timeoutMs: 5,
      terminationGraceMs: 5,
      spawnImpl: () => stuckChild,
      signalSource: new EventEmitter(),
    }),
    (error) => error.code === "BACKUP_JOB_TIMEOUT",
  );
  assert.deepEqual(stuckSignals, ["SIGTERM", "SIGKILL"]);
  assert.equal(stuckChildUnrefCount, 1);
  assert.equal(stuckChild.listenerCount("error"), 0);
  assert.equal(stuckChild.listenerCount("exit"), 0);

  const signalSource = new EventEmitter();
  const interruptedChild = new EventEmitter();
  const interruptedSignals = [];
  interruptedChild.kill = (signal) => {
    interruptedSignals.push(signal);
    queueMicrotask(() => interruptedChild.emit("exit", null, signal));
    return true;
  };
  const interrupted = runScheduledLogicalBackup({
    env: {},
    timeoutMs: 1_000,
    terminationGraceMs: 5,
    spawnImpl: () => interruptedChild,
    signalSource,
  });
  signalSource.emit("SIGINT");
  await assert.rejects(interrupted, (error) => error.code === "BACKUP_JOB_INTERRUPTED");
  assert.deepEqual(interruptedSignals, ["SIGINT"]);
  assert.equal(signalSource.listenerCount("SIGINT"), 0);
  assert.equal(signalSource.listenerCount("SIGTERM"), 0);
});

test("scheduled backup wrapper reports spawn, nonzero, and unexpected-signal failures", async () => {
  const spawnFailureChild = new EventEmitter();
  spawnFailureChild.kill = () => true;
  const spawnFailure = new Error("spawn failed");
  const spawnResult = runScheduledLogicalBackup({
    env: {},
    timeoutMs: 1_000,
    spawnImpl: () => {
      queueMicrotask(() => spawnFailureChild.emit("error", spawnFailure));
      return spawnFailureChild;
    },
    signalSource: new EventEmitter(),
  });
  await assert.rejects(spawnResult, (error) => error === spawnFailure);

  const nonzeroChild = new EventEmitter();
  nonzeroChild.kill = () => true;
  const nonzeroResult = runScheduledLogicalBackup({
    env: {},
    timeoutMs: 1_000,
    spawnImpl: () => {
      queueMicrotask(() => nonzeroChild.emit("exit", 2, null));
      return nonzeroChild;
    },
    signalSource: new EventEmitter(),
  });
  await assert.rejects(
    nonzeroResult,
    (error) => error.childReportedFailure === true && /\(2\)/.test(error.message),
  );

  const signaledChild = new EventEmitter();
  signaledChild.kill = () => true;
  const signaledResult = runScheduledLogicalBackup({
    env: {},
    timeoutMs: 1_000,
    spawnImpl: () => {
      queueMicrotask(() => signaledChild.emit("exit", null, "SIGABRT"));
      return signaledChild;
    },
    signalSource: new EventEmitter(),
  });
  await assert.rejects(
    signaledResult,
    (error) => error.childReportedFailure === true && /SIGABRT/.test(error.message),
  );
});

test("backup creation rejects Railway source mismatch before opening database or storage clients", async () => {
  let databaseOpened = false;
  let storageOpened = false;
  await assert.rejects(
    () => createLogicalBackupArtifact({
      env: {
        ...destinationEnv,
        BACKUP_DATABASE_URL: "postgresql://backup_reader:secret@db.example.test/rivt",
        BACKUP_ENCRYPTION_KEY: "1".repeat(64),
        SOURCE_COMMIT: "a".repeat(40),
        RAILWAY_GIT_COMMIT_SHA: "b".repeat(40),
        RAILWAY_SERVICE_ID: "service-id",
      },
      poolFactory() {
        databaseOpened = true;
        throw new Error("database should not open");
      },
      s3ClientFactory() {
        storageOpened = true;
        throw new Error("storage should not open");
      },
    }),
    (error) => error.code === "BACKUP_SOURCE_MISMATCH",
  );
  assert.equal(databaseOpened, false);
  assert.equal(storageOpened, false);
});

test("backup snapshot starts repeatable-read and refuses a role with any write capability", async () => {
  const queries = [];
  const safeClient = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("FROM pg_roles")) {
        return {
          rows: [{
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
            rolreplication: false,
            rolbypassrls: false,
            database_create: false,
            schema_create: false,
            table_write: false,
            sequence_write: false,
            set_role_membership: false,
          }],
        };
      }
      return { rows: [] };
    },
  };
  await beginReadOnlyBackupSnapshot(safeClient);
  await assertBackupDatabaseRoleReadOnly(safeClient);
  assert.equal(queries[0], "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.match(queries[1], /SET LOCAL statement_timeout/);
  assert.match(queries[2], /SET LOCAL TIME ZONE 'UTC'/);
  assert.ok(queries.some((sql) => /SET LOCAL extra_float_digits TO 3/.test(sql)));
  const roleQuery = queries.find((sql) => sql.includes("FROM pg_roles"));
  assert.match(roleQuery, /has_sequence_privilege\(current_user, c\.oid, 'USAGE'\)/);
  assert.match(roleQuery, /pg_has_role\(r\.oid, assumable\.oid, 'SET'\)/);

  const unsafeClient = {
    async query() {
      return {
        rows: [{
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolreplication: false,
          rolbypassrls: false,
          database_create: false,
          schema_create: false,
          table_write: true,
          sequence_write: false,
        }],
      };
    },
  };
  await assert.rejects(() => assertBackupDatabaseRoleReadOnly(unsafeClient), (error) => (
    error.code === "BACKUP_DATABASE_ROLE_UNSAFE"
  ));

  for (const unsafeFlag of ["sequence_write", "set_role_membership"]) {
    const indirectlyWritableClient = {
      async query() {
        return {
          rows: [{
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
            rolreplication: false,
            rolbypassrls: false,
            database_create: false,
            schema_create: false,
            table_write: false,
            table_read_missing: false,
            column_read_missing: false,
            sequence_write: false,
            sequence_read_missing: false,
            row_security_enabled: false,
            application_table_outside_public: false,
            set_role_membership: false,
            [unsafeFlag]: true,
          }],
        };
      },
    };
    await assert.rejects(
      () => assertBackupDatabaseRoleReadOnly(indirectlyWritableClient),
      (error) => error.code === "BACKUP_DATABASE_ROLE_UNSAFE",
    );
  }

  const incompleteReader = {
    async query() {
      return {
        rows: [{
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolreplication: false,
          rolbypassrls: false,
          database_create: false,
          schema_create: false,
          table_write: false,
          table_read_missing: false,
          column_read_missing: true,
          sequence_write: false,
          sequence_read_missing: false,
        }],
      };
    },
  };
  await assert.rejects(() => assertBackupDatabaseRoleReadOnly(incompleteReader), (error) => (
    error.code === "BACKUP_DATABASE_ROLE_UNSAFE"
  ));

  for (const completenessFailure of ["row_security_enabled", "application_table_outside_public"]) {
    const incompleteCatalog = {
      async query() {
        return {
          rows: [{
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
            rolreplication: false,
            rolbypassrls: false,
            database_create: false,
            schema_create: false,
            table_write: false,
            table_read_missing: false,
            column_read_missing: false,
            sequence_write: false,
            sequence_read_missing: false,
            row_security_enabled: false,
            application_table_outside_public: false,
            [completenessFailure]: true,
          }],
        };
      },
    };
    await assert.rejects(
      () => assertBackupDatabaseRoleReadOnly(incompleteCatalog),
      (error) => error.code === "BACKUP_DATABASE_ROLE_UNSAFE",
    );
  }
});

test("public table inventory uses pg_catalog and cannot hide unreadable tables through information_schema", async () => {
  let capturedSql = "";
  const tables = await publicTables({
    async query(sql) {
      capturedSql = sql;
      return { rows: [{ table_name: "accounts" }, { table_name: "private_records" }] };
    },
  });
  assert.deepEqual(tables, ["accounts", "private_records"]);
  assert.match(capturedSql, /pg_catalog\.pg_class/);
  assert.equal(capturedSql.includes("information_schema.tables"), false);
});

test("backup scope rejects RLS, non-public application tables, and inheritance or partitioning", async () => {
  const safe = await assertBackupCatalogComplete({
    async query(sql) {
      assert.match(sql, /pg_catalog\.pg_inherits/);
      return {
        rows: [{
          row_security_enabled: false,
          application_table_outside_public: false,
          inheritance_or_partitioning_present: false,
        }],
      };
    },
  });
  assert.equal(safe, undefined);

  for (const unsafeFlag of [
    "row_security_enabled",
    "application_table_outside_public",
    "inheritance_or_partitioning_present",
  ]) {
    await assert.rejects(
      () => assertBackupCatalogComplete({
        async query() {
          return {
            rows: [{
              row_security_enabled: false,
              application_table_outside_public: false,
              inheritance_or_partitioning_present: false,
              [unsafeFlag]: true,
            }],
          };
        },
      }),
      (error) => error.code === "BACKUP_DATABASE_SCOPE_UNSAFE",
    );
  }
});

test("restore drill inventory discovers every current public table dynamically", async () => {
  const tableNames = ["billing_events", "future_launch_table"];
  const client = {
    async query(sql, params) {
      if (sql.includes("pg_catalog.pg_inherits")) {
        return {
          rows: [{
            row_security_enabled: false,
            application_table_outside_public: false,
            inheritance_or_partitioning_present: false,
          }],
        };
      }
      if (sql.includes("SELECT c.relname AS table_name")) {
        return { rows: tableNames.map((table_name) => ({ table_name })) };
      }
      if (sql.includes("FROM pg_catalog.pg_attribute")) {
        assert.ok(tableNames.includes(params[0]));
        return {
          rows: [{
            column_name: "id",
            type_name: "bigint",
            is_generated: "NEVER",
            identity_generation: null,
          }],
        };
      }
      if (sql.startsWith("SELECT count(*)")) return { rows: [{ count: 1 }] };
      if (sql.startsWith("SELECT \"id\"::text")) return { rows: [{ id: "1" }] };
      if (sql.includes("information_schema.sequences")) return { rows: [] };
      return { rows: [] };
    },
    release() {},
  };
  const inventory = await completeInventory({ async connect() { return client; } });
  assert.deepEqual(inventory.tableNames, tableNames);
  assert.deepEqual(Object.keys(inventory.tableDigests), tableNames);
  assert.deepEqual(inventory.counts, { billing_events: 1, future_launch_table: 1 });
});

test("canonical table digests are order-independent and detect equal-count content changes", () => {
  const columns = [{ name: "id" }, { name: "payload" }];
  const original = [
    { id: 2, payload: { b: 2, a: 1 } },
    { id: 1, payload: ["measured", 5] },
  ];
  const reordered = [
    { id: 1, payload: ["measured", 5] },
    { id: 2, payload: { a: 1, b: 2 } },
  ];
  const changed = [
    { id: 1, payload: ["measured", 5] },
    { id: 2, payload: { a: 1, b: 3 } },
  ];
  assert.equal(canonicalTableDigest(original, columns), canonicalTableDigest(reordered, columns));
  assert.notEqual(canonicalTableDigest(original, columns), canonicalTableDigest(changed, columns));
  const digests = snapshotTableDigests([{ name: "records", columns, rows: original }]);
  assert.match(aggregateTableDigest(digests), /^[a-f0-9]{64}$/);
});

test("encrypted object buffering is bounded before JSON parsing", async () => {
  await assert.rejects(
    () => bodyToBuffer(Readable.from([Buffer.alloc(3), Buffer.alloc(3)]), 5),
    (error) => error.code === "BACKUP_OBJECT_INVALID",
  );
});

function protectedBucketClient(overrides = {}) {
  return {
    commands: [],
    async send(command) {
      this.commands.push(command);
      switch (command.constructor.name) {
        case "HeadBucketCommand": return {};
        case "GetBucketVersioningCommand": return { Status: overrides.versioning ?? "Enabled" };
        case "GetObjectLockConfigurationCommand": return {
          ObjectLockConfiguration: {
            ObjectLockEnabled: "Enabled",
            Rule: { DefaultRetention: { Mode: overrides.lockMode ?? "COMPLIANCE", Days: 30 } },
          },
        };
        case "GetBucketLifecycleConfigurationCommand": return {
          Rules: [{
            ID: "expire-daily-after-lock",
            Status: "Enabled",
            Filter: overrides.lifecycleFilter ?? { Prefix: overrides.lifecyclePrefix ?? "postgres/daily/" },
            Expiration: { Days: 30 },
            NoncurrentVersionExpiration: { NoncurrentDays: overrides.noncurrentDays ?? 30 },
          }],
        };
        default: throw new Error(`Unexpected command ${command.constructor.name}`);
      }
    },
  };
}

test("bucket protection requires versioning, COMPLIANCE default retention, and an exact lifecycle prefix", async () => {
  const config = destinationS3Config(destinationEnv);
  const verified = await verifyBucketProtection(protectedBucketClient(), config, 30);
  assert.deepEqual(verified, {
    versioning: "Enabled",
    objectLockMode: "COMPLIANCE",
    defaultRetentionDays: 30,
    lifecycleRuleId: "expire-daily-after-lock",
    lifecycleExpirationDays: 30,
    lifecycleNoncurrentExpirationDays: 30,
  });
  await assert.rejects(
    () => verifyBucketProtection(protectedBucketClient({ versioning: "Suspended" }), config, 30),
    (error) => error.code === "BACKUP_DESTINATION_UNSAFE",
  );
  await assert.rejects(
    () => verifyBucketProtection(protectedBucketClient({ lockMode: "GOVERNANCE" }), config, 30),
    (error) => error.code === "BACKUP_DESTINATION_UNSAFE",
  );
  await assert.rejects(
    () => verifyBucketProtection(protectedBucketClient({ lifecyclePrefix: "postgres/" }), config, 30),
    (error) => error.code === "BACKUP_DESTINATION_UNSAFE",
  );
  await assert.rejects(
    () => verifyBucketProtection(protectedBucketClient({ noncurrentDays: 29 }), config, 30),
    (error) => error.code === "BACKUP_DESTINATION_UNSAFE",
  );
  await assert.rejects(
    () => verifyBucketProtection(protectedBucketClient({
      lifecycleFilter: { And: { Prefix: "postgres/daily/", Tags: [{ Key: "scope", Value: "partial" }] } },
    }), config, 30),
    (error) => error.code === "BACKUP_DESTINATION_UNSAFE",
  );
});

test("backup creation reads one repeatable snapshot with a read-only role and uploads a unique protected version", async () => {
  const queries = [];
  const lifecycle = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ acquired: true }] };
      if (sql.includes("FROM pg_roles")) {
        return {
          rows: [{
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
            rolreplication: false,
            rolbypassrls: false,
            database_create: false,
            schema_create: false,
            table_write: false,
            sequence_write: false,
          }],
        };
      }
      if (sql.includes("pg_catalog.pg_inherits")) {
        return {
          rows: [{
            row_security_enabled: false,
            application_table_outside_public: false,
            inheritance_or_partitioning_present: false,
          }],
        };
      }
      if (sql.includes("information_schema.tables")) return { rows: [] };
      if (sql.includes("information_schema.sequences")) return { rows: [] };
      return { rows: [] };
    },
    release() { lifecycle.push("client-release"); },
  };
  let poolEnded = false;
  const pool = {
    async connect() { return client; },
    async end() {
      poolEnded = true;
      lifecycle.push("pool-end");
    },
  };
  let putInput;
  const s3 = {
    async send(command) {
      switch (command.constructor.name) {
        case "HeadBucketCommand": return {};
        case "GetBucketVersioningCommand": return { Status: "Enabled" };
        case "GetObjectLockConfigurationCommand": return {
          ObjectLockConfiguration: {
            ObjectLockEnabled: "Enabled",
            Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 30 } },
          },
        };
        case "GetBucketLifecycleConfigurationCommand": return {
          Rules: [{
            ID: "expire-daily-after-lock",
            Status: "Enabled",
            Filter: { Prefix: "postgres/daily/" },
            Expiration: { Days: 30 },
            NoncurrentVersionExpiration: { NoncurrentDays: 30 },
          }],
        };
        case "PutObjectCommand":
          lifecycle.push("upload");
          putInput = command.input;
          return { VersionId: "protected-version" };
        case "HeadObjectCommand":
          lifecycle.push("upload-verified");
          return {
            VersionId: "protected-version",
            LastModified: new Date("2026-08-01T12:00:01.000Z"),
            ObjectLockMode: "COMPLIANCE",
            ObjectLockRetainUntilDate: new Date("2026-09-01T12:05:00.000Z"),
          };
        default: throw new Error(`Unexpected command ${command.constructor.name}`);
      }
    },
  };
  const result = await createLogicalBackupArtifact({
    env: {
      ...destinationEnv,
      BACKUP_DATABASE_URL: "postgresql://backup_reader:secret@db.example.test/rivt",
      BACKUP_ENCRYPTION_KEY: "1".repeat(64),
      SOURCE_COMMIT: "a".repeat(40),
    },
    now: () => new Date("2026-08-01T12:00:00.000Z"),
    poolFactory: () => pool,
    s3ClientFactory: () => s3,
  });
  assert.equal(result.versionId, "protected-version");
  assert.equal(result.uploadedAt, "2026-08-01T12:00:01.000Z");
  assert.match(result.key, /^postgres\/daily\/2026-08-01T12-00-00\.000Z-a{40}-[a-f0-9-]+\.json\.gz\.aes256gcm$/);
  assert.equal(putInput.IfNoneMatch, "*");
  assert.equal(putInput.ObjectLockMode, "COMPLIANCE");
  assert.match(queries[0], /pg_try_advisory_lock/);
  assert.equal(queries[1], "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(queries.at(-1), "COMMIT");
  assert.equal(poolEnded, true);
  assert.deepEqual(lifecycle, ["upload", "upload-verified", "client-release", "pool-end"]);
});

test("protected backup upload is unique, versioned, digest-bound, and COMPLIANCE locked", async () => {
  const config = destinationS3Config(destinationEnv);
  let input;
  const client = {
    async send(command) {
      if (command.constructor.name === "PutObjectCommand") {
        input = command.input;
        return { VersionId: "4_zversion", ETag: "etag" };
      }
      if (command.constructor.name === "HeadObjectCommand") {
        return {
          VersionId: "4_zversion",
          LastModified: new Date("2026-08-01T12:00:01.000Z"),
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date("2026-09-01T12:05:00.000Z"),
        };
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    },
  };
  const createdAt = "2026-08-01T12:00:00.000Z";
  const sourceCommit = "a".repeat(40);
  const key = `${config.prefix}/artifact.json.gz.aes256gcm`;
  const artifact = { format: ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2, createdAt, sourceCommit };
  const result = await putProtectedJsonObject(client, config, key, artifact, {
    createdAt,
    sourceCommit,
    retentionDays: 30,
    now: () => new Date(createdAt),
  });
  assert.equal(input.IfNoneMatch, "*");
  assert.equal(input.ObjectLockMode, "COMPLIANCE");
  assert.ok(input.ObjectLockRetainUntilDate.getTime() >= new Date(createdAt).getTime() + 30 * 86_400_000);
  assert.deepEqual(input.Metadata, protectedArtifactMetadata({
    sha256: result.sha256,
    createdAt,
    sourceCommit,
    retentionDays: 30,
    format: ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2,
  }));
  assert.equal(result.versionId, "4_zversion");
  assert.equal(result.uploadedAt, "2026-08-01T12:00:01.000Z");
  assert.equal(result.sha256, sha256Hex(input.Body));
});

function protectedArtifactFixture({
  snapshotValue = losslessSnapshot,
  secret = "1".repeat(64),
} = {}) {
  const createdAt = "2026-08-01T12:00:00.000Z";
  const sourceCommit = "b".repeat(40);
  const currentSnapshot = {
    ...snapshotValue,
    createdAt,
    sourceCommit,
    manifest: { ...snapshotValue.manifest, createdAt, sourceCommit },
  };
  const value = encryptSnapshot(currentSnapshot, secret);
  const body = Buffer.from(JSON.stringify(value));
  const sha256 = sha256Hex(body);
  const metadata = protectedArtifactMetadata({
    sha256,
    createdAt,
    sourceCommit,
    retentionDays: 30,
    format: ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2,
  });
  return { body, createdAt, sourceCommit, sha256, metadata, value };
}

function freshnessClientForFixture(fixture) {
  return {
    async send(command) {
      switch (command.constructor.name) {
        case "HeadBucketCommand": return {};
        case "GetBucketVersioningCommand": return { Status: "Enabled" };
        case "GetObjectLockConfigurationCommand": return {
          ObjectLockConfiguration: {
            ObjectLockEnabled: "Enabled",
            Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 30 } },
          },
        };
        case "GetBucketLifecycleConfigurationCommand": return {
          Rules: [{
            ID: "expire-daily-after-lock",
            Status: "Enabled",
            Filter: { Prefix: "postgres/daily/" },
            Expiration: { Days: 30 },
            NoncurrentVersionExpiration: { NoncurrentDays: 30 },
          }],
        };
        case "ListObjectVersionsCommand": return {
          Versions: [{
            Key: "postgres/daily/artifact.json.gz.aes256gcm",
            VersionId: "4_zversion",
            LastModified: new Date(fixture.createdAt),
            IsLatest: true,
          }],
        };
        case "HeadObjectCommand": return {
          Metadata: fixture.metadata,
          LastModified: new Date(fixture.createdAt),
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date("2026-09-01T12:05:00.000Z"),
          ContentLength: fixture.body.length,
        };
        case "GetObjectCommand": return { Body: Readable.from([fixture.body]) };
        default: throw new Error(`Unexpected command ${command.constructor.name}`);
      }
    },
  };
}

test("named restore object requires an exact version, digest, metadata, and unexpired COMPLIANCE lock", async () => {
  const config = destinationS3Config(destinationEnv);
  const fixture = protectedArtifactFixture();
  const client = {
    async send(command) {
      if (command.constructor.name === "HeadObjectCommand") {
        return {
          Metadata: fixture.metadata,
          LastModified: new Date(fixture.createdAt),
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date("2026-09-01T12:05:00.000Z"),
          ContentLength: fixture.body.length,
        };
      }
      if (command.constructor.name === "GetObjectCommand") {
        return { Body: Readable.from([fixture.body]) };
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    },
  };
  const verified = await verifyProtectedBackupObject(client, config, {
    key: "postgres/daily/artifact.json.gz.aes256gcm",
    versionId: "4_zversion",
  }, {
    expectedSha256: fixture.sha256,
    expectedKeyId: fixture.value.keyId,
    retentionDays: 30,
    now: new Date("2026-08-01T13:00:00.000Z").getTime(),
  });
  assert.equal(verified.sha256, fixture.sha256);
  assert.equal(verified.sourceCommit, fixture.sourceCommit);

  await assert.rejects(
    () => verifyProtectedBackupObject(client, config, {
      key: "postgres/daily/artifact.json.gz.aes256gcm",
      versionId: "4_zversion",
    }, {
      expectedSha256: fixture.sha256,
      expectedKeyId: "0".repeat(32),
      retentionDays: 30,
      now: new Date("2026-08-01T13:00:00.000Z").getTime(),
    }),
    (error) => error.code === "BACKUP_OBJECT_INVALID",
  );

  await assert.rejects(
    () => verifyProtectedBackupObject(client, config, {
      key: "postgres/daily/artifact.json.gz.aes256gcm",
      versionId: "4_zversion",
    }, {
      expectedSha256: "0".repeat(64),
      retentionDays: 30,
      now: new Date("2026-08-01T13:00:00.000Z").getTime(),
    }),
    (error) => error.code === "BACKUP_OBJECT_INVALID",
  );
});

test("restore validates the named locked version and digest before opening the target database", async () => {
  const fixture = protectedArtifactFixture();
  let targetOpened = false;
  const s3 = {
    async send(command) {
      switch (command.constructor.name) {
        case "HeadBucketCommand": return {};
        case "GetBucketVersioningCommand": return { Status: "Enabled" };
        case "GetObjectLockConfigurationCommand": return {
          ObjectLockConfiguration: {
            ObjectLockEnabled: "Enabled",
            Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 30 } },
          },
        };
        case "GetBucketLifecycleConfigurationCommand": return {
          Rules: [{
            ID: "expire-daily-after-lock",
            Status: "Enabled",
            Filter: { Prefix: "postgres/daily/" },
            Expiration: { Days: 30 },
            NoncurrentVersionExpiration: { NoncurrentDays: 30 },
          }],
        };
        case "HeadObjectCommand": return {
          Metadata: fixture.metadata,
          LastModified: new Date(fixture.createdAt),
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date(Date.now() + 31 * 86_400_000),
          ContentLength: fixture.body.length,
        };
        default: throw new Error(`Unexpected command ${command.constructor.name}`);
      }
    },
  };
  const restoreStorage = Object.fromEntries(
    Object.entries(destinationEnv).map(([name, value]) => [name.replace("BACKUP_DESTINATION", "RESTORE_SOURCE"), value]),
  );
  await assert.rejects(
    () => restoreLogicalBackupArtifact({
      env: {
        ...restoreStorage,
        RESTORE_DATABASE_URL: "postgresql://restore:secret@restore.example.test/rivt",
        RESTORE_SOURCE_DATABASE_URL: "postgresql://reader:secret@source.example.test/rivt",
        CONFIRM_RESTORE_TARGET_ISOLATED: "true",
        RESTORE_BACKUP_S3_KEY: "postgres/daily/artifact.json.gz.aes256gcm",
        RESTORE_BACKUP_S3_VERSION_ID: "4_zversion",
        RESTORE_BACKUP_SHA256: "0".repeat(64),
        BACKUP_ENCRYPTION_KEY: "1".repeat(64),
      },
      applyMigrations: false,
      s3ClientFactory: () => s3,
      poolFactory: () => {
        targetOpened = true;
        throw new Error("target must remain unopened");
      },
    }),
    (error) => error.code === "BACKUP_OBJECT_INVALID",
  );
  assert.equal(targetOpened, false);
});

test("freshness verifier binds provider controls to the newest current version", async () => {
  const fixture = protectedArtifactFixture();
  const currentTime = new Date("2026-08-01T13:00:00.000Z").getTime();
  const client = freshnessClientForFixture(fixture);
  const result = await verifyLogicalBackup({
    env: {
      ...destinationEnv,
      BACKUP_ENCRYPTION_KEY: "1".repeat(64),
      BACKUP_EXPECTED_SOURCE_COMMIT: fixture.sourceCommit,
    },
    now: () => currentTime,
    s3ClientFactory: () => client,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ageHours, 1);
  assert.equal(result.versionId, "4_zversion");
  assert.equal(result.sha256, fixture.sha256);
  assert.equal(result.tableCount, losslessSnapshot.manifest.tableCount);
  assert.equal(result.rowCount, losslessSnapshot.manifest.rowCount);

  assert.equal(result.encryptionKeyMode, "active-only");

  await assert.rejects(
    () => verifyLogicalBackup({
      env: {
        ...destinationEnv,
        BACKUP_ENCRYPTION_KEY: "2".repeat(64),
        BACKUP_ENCRYPTION_KEY_PREVIOUS: "1".repeat(64),
        BACKUP_EXPECTED_SOURCE_COMMIT: fixture.sourceCommit,
      },
      now: () => currentTime,
      s3ClientFactory: () => client,
    }),
    (error) => error.code === "BACKUP_OBJECT_INVALID",
  );
});

test("freshness verifier fails closed without a valid trusted source binding", async () => {
  const fixture = protectedArtifactFixture();
  const base = {
    ...destinationEnv,
    BACKUP_ENCRYPTION_KEY: "1".repeat(64),
  };
  for (const BACKUP_EXPECTED_SOURCE_COMMIT of [undefined, "abc123", "G".repeat(40)]) {
    await assert.rejects(
      () => verifyLogicalBackup({
        env: { ...base, BACKUP_EXPECTED_SOURCE_COMMIT },
        now: () => new Date("2026-08-01T13:00:00.000Z").getTime(),
        s3ClientFactory: () => freshnessClientForFixture(fixture),
      }),
      (error) => error.code === "BACKUP_CONFIG_INVALID",
    );
  }
});

test("freshness verifier rejects an otherwise valid artifact from another source revision", async () => {
  const fixture = protectedArtifactFixture();
  await assert.rejects(
    () => verifyLogicalBackup({
      env: {
        ...destinationEnv,
        BACKUP_ENCRYPTION_KEY: "1".repeat(64),
        BACKUP_EXPECTED_SOURCE_COMMIT: "c".repeat(40),
      },
      now: () => new Date("2026-08-01T13:00:00.000Z").getTime(),
      s3ClientFactory: () => freshnessClientForFixture(fixture),
    }),
    (error) => error.code === "BACKUP_SOURCE_MISMATCH",
  );
});

test("named restore drill rejects an artifact encrypted by the previous key", async () => {
  const fixture = protectedArtifactFixture({ secret: "1".repeat(64) });
  const restoreStorage = Object.fromEntries(
    Object.entries(destinationEnv).map(([name, value]) => [name.replace("BACKUP_DESTINATION", "RESTORE_SOURCE"), value]),
  );
  let targetOpened = false;

  await assert.rejects(
    () => verifyRestoreDrill({
      env: {
        ...restoreStorage,
        RESTORE_DATABASE_URL: "postgresql://restore:secret@restore.example.test/rivt",
        RESTORE_SOURCE_DATABASE_URL: "postgresql://reader:secret@source.example.test/rivt",
        CONFIRM_RESTORE_TARGET_ISOLATED: "true",
        RESTORE_BACKUP_S3_KEY: "postgres/daily/artifact.json.gz.aes256gcm",
        RESTORE_BACKUP_S3_VERSION_ID: "4_zversion",
        RESTORE_BACKUP_SHA256: fixture.sha256,
        BACKUP_ENCRYPTION_KEY: "2".repeat(64),
        BACKUP_ENCRYPTION_KEY_PREVIOUS: "1".repeat(64),
      },
      applyMigrations: false,
      s3ClientFactory: () => freshnessClientForFixture(fixture),
      poolFactory: () => {
        targetOpened = true;
        throw new Error("target must remain unopened");
      },
    }),
    (error) => error.code === "BACKUP_OBJECT_INVALID",
  );
  assert.equal(targetOpened, false);
});

test("freshness verifier rejects a forged protected envelope without exposing secret material", async () => {
  const secret = "1".repeat(64);
  const fixture = protectedArtifactFixture({ secret });
  const forgedValue = {
    ...fixture.value,
    ciphertext: Buffer.from("forged-but-self-consistent-object").toString("base64"),
  };
  const forgedBody = Buffer.from(JSON.stringify(forgedValue));
  const forgedSha256 = sha256Hex(forgedBody);
  const forgedFixture = {
    ...fixture,
    body: forgedBody,
    sha256: forgedSha256,
    metadata: { ...fixture.metadata, "rivt-sha256": forgedSha256 },
    value: forgedValue,
  };

  await assert.rejects(
    () => verifyLogicalBackup({
      env: {
        ...destinationEnv,
        BACKUP_ENCRYPTION_KEY: secret,
        BACKUP_EXPECTED_SOURCE_COMMIT: forgedFixture.sourceCommit,
      },
      now: () => new Date("2026-08-01T13:00:00.000Z").getTime(),
      s3ClientFactory: () => freshnessClientForFixture(forgedFixture),
    }),
    (error) => {
      assert.equal(error.code, "BACKUP_OBJECT_INVALID");
      const safeFailure = JSON.stringify(sanitizedFailure(error, "verify-logical-backup"));
      assert.equal(safeFailure.includes(secret), false);
      assert.equal(safeFailure.includes(forgedValue.ciphertext), false);
      return true;
    },
  );
});

test("freshness verifier rejects an authenticated payload that is not structurally restore-usable", async () => {
  const malformedFixture = protectedArtifactFixture({
    snapshotValue: { ...losslessSnapshot, tables: "not-an-array" },
  });
  await assert.rejects(
    () => verifyLogicalBackup({
      env: {
        ...destinationEnv,
        BACKUP_ENCRYPTION_KEY: "1".repeat(64),
        BACKUP_EXPECTED_SOURCE_COMMIT: malformedFixture.sourceCommit,
      },
      now: () => new Date("2026-08-01T13:00:00.000Z").getTime(),
      s3ClientFactory: () => freshnessClientForFixture(malformedFixture),
    }),
    (error) => error.code === "BACKUP_OBJECT_INVALID",
  );
});

test("newest backup selection and sanitized failures do not expose credentials or provider detail", async () => {
  const config = destinationS3Config(destinationEnv);
  const newest = await newestBackupVersion({
    async send() {
      return {
        Versions: [
          { Key: "postgres/daily/older", VersionId: "v1", LastModified: new Date("2026-08-01T01:00:00Z") },
          { Key: "postgres/daily/newer", VersionId: "v2", LastModified: new Date("2026-08-01T02:00:00Z") },
        ],
      };
    },
  }, config);
  assert.equal(newest.VersionId, "v2");
  const failure = sanitizedFailure(
    Object.assign(new Error("secret-key https://private.example.test"), { code: "BACKUP_PROVIDER_CHECK_FAILED" }),
    "verify-logical-backup",
  );
  assert.equal(JSON.stringify(failure).includes("secret-key"), false);
  assert.equal(JSON.stringify(failure).includes("private.example.test"), false);

  const success = sanitizedSuccess({
    ok: true,
    mode: "verify-logical-backup",
    bucket: "secret-bucket",
    prefix: "secret/prefix",
    key: "secret/prefix/object",
    versionId: "secret-version",
    sha256: "a".repeat(64),
    sourceCommit: "b".repeat(40),
    ageHours: 1,
    retentionDays: 30,
    retentionUntil: "2026-09-01T00:00:00.000Z",
    encryptionKeyMode: "active-only",
    tableCount: 109,
    rowCount: 8768,
    durationMs: 10,
  });
  const serializedSuccess = JSON.stringify(success);
  for (const rawIdentity of ["secret-bucket", "secret/prefix", "secret-version", "a".repeat(64)]) {
    assert.equal(serializedSuccess.includes(rawIdentity), false);
  }
  assert.match(success.destinationIdentitySha256, /^[a-f0-9]{64}$/);
  assert.match(success.artifactIdentitySha256, /^[a-f0-9]{64}$/);
  assert.equal(success.encryptionKeyMode, "active-only");
  assert.equal(success.tableCount, 109);
  assert.equal(success.rowCount, 8768);
});

test("newest backup selection follows version pagination instead of trusting the first lexicographic page", async () => {
  const config = destinationS3Config(destinationEnv);
  const inputs = [];
  const newest = await newestBackupVersion({
    async send(command) {
      inputs.push(command.input);
      if (inputs.length === 1) {
        return {
          IsTruncated: true,
          NextKeyMarker: "postgres/daily/older",
          NextVersionIdMarker: "v1",
          Versions: [{
            Key: "postgres/daily/older",
            VersionId: "v1",
            LastModified: new Date("2026-07-01T01:00:00Z"),
          }],
        };
      }
      return {
        IsTruncated: false,
        Versions: [{
          Key: "postgres/daily/newest",
          VersionId: "v2",
          LastModified: new Date("2026-08-01T02:00:00Z"),
        }],
      };
    },
  }, config);
  assert.equal(newest.VersionId, "v2");
  assert.equal(inputs.length, 2);
  assert.equal(inputs[1].KeyMarker, "postgres/daily/older");
  assert.equal(inputs[1].VersionIdMarker, "v1");
});

test("backup version pagination fails closed when a provider repeats its continuation marker", async () => {
  const config = destinationS3Config(destinationEnv);
  await assert.rejects(
    () => newestBackupVersion({
      async send() {
        return {
          IsTruncated: true,
          NextKeyMarker: "postgres/daily/stuck",
          NextVersionIdMarker: "v1",
          Versions: [],
        };
      },
    }, config),
    (error) => error.code === "BACKUP_PROVIDER_CHECK_FAILED",
  );
});
