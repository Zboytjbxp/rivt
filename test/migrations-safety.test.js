import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertMigrationsCurrent } from "../server/migrations.js";

function checksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

async function withMigrationDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rivt-migration-safety-"));
  const firstSql = "SELECT 1;\n";
  const secondSql = "SELECT 2;\n";
  await writeFile(path.join(directory, "0001_first.up.sql"), firstSql);
  await writeFile(path.join(directory, "0002_second.up.sql"), secondSql);
  try {
    await run({
      directory,
      first: {
        version: 1,
        name: "first",
        checksum: checksum(firstSql),
        execution_ms: 1,
        applied_at: new Date("2026-01-01T00:00:00.000Z"),
      },
      second: {
        version: 2,
        name: "second",
        checksum: checksum(secondSql),
        execution_ms: 1,
        applied_at: new Date("2026-01-02T00:00:00.000Z"),
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function poolDouble(query) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return query(sql, params);
    },
    release() {},
  };
  return {
    calls,
    pool: {
      async connect() {
        return client;
      },
    },
  };
}

test("web and worker migration checks never create the migration ledger", async () => {
  await withMigrationDirectory(async ({ directory }) => {
    const { calls, pool } = poolDouble(async () => ({ rows: [{ ledger: null }] }));
    await assert.rejects(
      assertMigrationsCurrent(pool, { directory }),
      /migration ledger is missing/i,
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /to_regclass/i);
    assert.doesNotMatch(calls[0].sql, /create table/i);
  });
});

test("web and worker migration checks require every source migration", async () => {
  await withMigrationDirectory(async ({ directory, first }) => {
    let queryCount = 0;
    const { calls, pool } = poolDouble(async () => {
      queryCount += 1;
      if (queryCount === 1) return { rows: [{ ledger: "schema_migrations" }] };
      return { rows: [first] };
    });
    await assert.rejects(
      assertMigrationsCurrent(pool, { directory }),
      /pending migrations: 0002_second/i,
    );
    assert.equal(calls.length, 2);
    assert.ok(calls.every(({ sql }) => !/create table/i.test(sql)));
  });
});

test("web and worker migration checks accept a complete verified ledger", async () => {
  await withMigrationDirectory(async ({ directory, first, second }) => {
    let queryCount = 0;
    const { calls, pool } = poolDouble(async () => {
      queryCount += 1;
      if (queryCount === 1) return { rows: [{ ledger: "schema_migrations" }] };
      return { rows: [first, second] };
    });
    const status = await assertMigrationsCurrent(pool, { directory });
    assert.equal(status.latestVersion, 2);
    assert.equal(status.latestName, "second");
    assert.deepEqual(status.pending, []);
    assert.equal(calls.length, 2);
  });
});
