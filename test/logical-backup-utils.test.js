import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDifferentDatabases,
  databaseContentDigest,
  decryptSnapshot,
  diffContentDigests,
  diffCounts,
  encryptSnapshot,
  integrityForTables,
  orderedTables,
  rowsForTable,
  tableContentDigest,
  withCanonicalReadSnapshot,
} from "../scripts/logical-backup-utils.js";

test("logical backup encryption round trips without exposing plaintext", () => {
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

  const encrypted = encryptSnapshot(snapshot, "test-secret");
  assert.equal(encrypted.format, "rivt-encrypted-logical-backup-v1");
  assert.equal(JSON.stringify(encrypted).includes("acct-1"), false);
  assert.deepEqual(decryptSnapshot(encrypted, "test-secret"), snapshot);
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
  assert.match(capturedSql, /FROM "public"\."odd-table"/);
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
  const snapshot = {
    format: "rivt-logical-backup-v2",
    createdAt: "2026-07-29T00:00:00.000Z",
    sourceCommit: "abc1234",
    manifest: {
      format: "rivt-logical-backup-manifest-v2",
      counts: { accounts: 1 },
      tableCount: 1,
      rowCount: 1,
    },
    integrity,
    sequences: [],
    tables,
  };
  const encrypted = encryptSnapshot(snapshot, "test-secret");
  assert.equal(JSON.stringify(encrypted).includes(integrity.databaseDigest), false);
  assert.deepEqual(decryptSnapshot(encrypted, "test-secret"), snapshot);
});
