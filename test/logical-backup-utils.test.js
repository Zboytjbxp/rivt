import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  assertDifferentDatabases,
  backupEncryptionSecret,
  databaseContentDigest,
  decryptSnapshot,
  diffContentDigests,
  diffCounts,
  encryptionKeyFromSecret,
  encryptionKeyIdFromSecret,
  encryptSnapshot,
  integrityForTables,
  insertBatch,
  LOGICAL_BACKUP_FORMAT_V2,
  LOGICAL_BACKUP_MANIFEST_FORMAT_V2,
  orderedTables,
  POSTGRES_TEXT_ROW_ENCODING,
  previousBackupEncryptionSecret,
  rowsForTable,
  tableContentDigest,
  tableColumns,
  withCanonicalReadSnapshot,
} from "../scripts/logical-backup-utils.js";

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
      "postgresql://user:password@example.test:5432/rivt",
      "postgresql://user:other@example.test:5432/rivt",
    ),
    /identities match/,
  );
});

test("logical backup column metadata retains target data types for restore binding", async () => {
  const client = {
    async query() {
      return {
        rows: [
          {
            column_name: "id",
            data_type: "bigint",
            is_generated: "NEVER",
            identity_generation: "ALWAYS",
          },
          {
            column_name: "thread_messages",
            data_type: "jsonb",
            is_generated: "NEVER",
            identity_generation: null,
          },
          {
            column_name: "generated_label",
            data_type: "text",
            is_generated: "ALWAYS",
            identity_generation: null,
          },
        ],
      };
    },
  };

  assert.deepEqual(await tableColumns(client, "customers"), [
    { name: "id", dataType: "bigint", identityGeneration: "ALWAYS" },
    { name: "thread_messages", dataType: "jsonb", identityGeneration: null },
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

test("logical restore preserves canonical PostgreSQL JSON text for a version-2 snapshot", async () => {
  let captured;
  const client = {
    async query(sql, values) {
      captured = { sql, values };
    },
  };
  const columns = [
    { name: "payload", dataType: "jsonb", identityGeneration: null, canonicalText: true },
    { name: "metadata", dataType: "json", identityGeneration: null, canonicalText: true },
  ];

  await insertBatch(client, "records", columns, [{
    payload: '{"a": 1}',
    metadata: '"customer note"',
  }], { rowEncoding: POSTGRES_TEXT_ROW_ENCODING });

  assert.deepEqual(captured.values, ['{"a": 1}', '"customer note"']);
});

test("canonical read snapshot uses one read-only repeatable-read transaction", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
  };
  const value = await withCanonicalReadSnapshot(client, async () => "captured");
  assert.equal(value, "captured");
  assert.deepEqual(queries, [
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    "SET LOCAL statement_timeout = '60s'",
    "SET LOCAL TIME ZONE 'UTC'",
    "SET LOCAL DateStyle = 'ISO, YMD'",
    "SET LOCAL IntervalStyle = 'iso_8601'",
    "SET LOCAL bytea_output = 'hex'",
    "SET LOCAL extra_float_digits = 3",
    "COMMIT",
  ]);
});

test("canonical read snapshot rolls back and does not commit on failure", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
  };
  await assert.rejects(
    withCanonicalReadSnapshot(client, async () => {
      throw new Error("capture failed");
    }),
    /capture failed/,
  );
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.equal(queries.includes("COMMIT"), false);
});

test("canonical table reads cast and alias quoted columns as PostgreSQL text", async () => {
  let capturedSql = "";
  const client = {
    async query(sql) {
      capturedSql = sql;
      return { rows: [{ id: "1", odd: null }] };
    },
  };
  const rows = await rowsForTable(client, "odd-table", [
    { name: "id" },
    { name: "odd\"name" },
  ]);
  assert.match(capturedSql, /"id"::text AS "id"/);
  assert.match(capturedSql, /"odd""name"::text AS "odd""name"/);
  assert.match(capturedSql, /FROM ONLY "public"\."odd-table"/);
  assert.deepEqual(rows, [{ id: "1", odd: null }]);
});

test("table content digest is row-order independent and preserves duplicates", () => {
  const columns = [
    { name: "id", formattedType: "uuid" },
    { name: "payload", formattedType: "jsonb" },
  ];
  const first = { id: "a", payload: "{\"value\": 1}" };
  const second = { id: "b", payload: "{\"value\": 2}" };
  const digest = tableContentDigest("records", columns, [first, second, first]);
  assert.equal(
    digest,
    tableContentDigest("records", columns, [first, first, second]),
  );
  assert.notEqual(digest, tableContentDigest("records", columns, [first, second]));
  assert.notEqual(digest, tableContentDigest("records", columns, [first, second, second]));
});

test("table content digest distinguishes null, text, types, columns, and exact values", () => {
  const columns = [
    { name: "value", formattedType: "text" },
    { name: "typed", formattedType: "timestamp(6) without time zone" },
  ];
  const base = tableContentDigest("records", columns, [{
    value: null,
    typed: "2026-07-29 12:00:00.123456",
  }]);
  const variants = [
    ["records", columns, [{ value: "null", typed: "2026-07-29 12:00:00.123456" }]],
    ["records", columns, [{ value: "", typed: "2026-07-29 12:00:00.123456" }]],
    ["records", columns, [{ value: null, typed: "2026-07-29 12:00:00.123457" }]],
    ["other", columns, [{ value: null, typed: "2026-07-29 12:00:00.123456" }]],
    ["records", [{ ...columns[0], formattedType: "jsonb" }, columns[1]], [{
      value: null,
      typed: "2026-07-29 12:00:00.123456",
    }]],
    ["records", [columns[1], columns[0]], [{
      value: null,
      typed: "2026-07-29 12:00:00.123456",
    }]],
  ];
  for (const [tableName, variantColumns, rows] of variants) {
    assert.notEqual(base, tableContentDigest(tableName, variantColumns, rows));
  }
});

test("digest diff reports table names and reasons without exposing digest values", () => {
  const diffs = diffContentDigests(
    { accounts: "a".repeat(64), jobs: "b".repeat(64) },
    { accounts: "c".repeat(64), posts: "d".repeat(64) },
  );
  assert.deepEqual(diffs, [
    { tableName: "accounts", reason: "mismatch" },
    { tableName: "jobs", reason: "missing" },
    { tableName: "posts", reason: "unexpected" },
  ]);
  assert.equal(JSON.stringify(diffs).includes("a".repeat(64)), false);
});

test("v2 snapshot integrity is encrypted and aggregate digest is deterministic", () => {
  const tables = [{
    name: "accounts",
    columns: [{ name: "id", identityGeneration: null, formattedType: "uuid" }],
    rows: [{ id: "acct-1" }],
  }];
  const integrity = integrityForTables(tables);
  assert.equal(integrity.databaseDigest, databaseContentDigest(integrity.tableDigests));
  const v2Snapshot = {
    format: LOGICAL_BACKUP_FORMAT_V2,
    rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
    createdAt: "2026-07-29T00:00:00.000Z",
    sourceCommit: "abc1234",
    manifest: {
      format: LOGICAL_BACKUP_MANIFEST_FORMAT_V2,
      rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
      counts: { accounts: 1 },
      tableCount: 1,
      rowCount: 1,
    },
    integrity,
    sequences: [],
    tables,
  };
  const encrypted = encryptSnapshot(v2Snapshot, "test-secret");
  assert.equal(JSON.stringify(encrypted).includes(integrity.databaseDigest), false);
  assert.deepEqual(decryptSnapshot(encrypted, "test-secret"), v2Snapshot);
});
