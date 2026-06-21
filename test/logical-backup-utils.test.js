import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDifferentDatabases,
  decryptSnapshot,
  diffCounts,
  encryptSnapshot,
  orderedTables,
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
