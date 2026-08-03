import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runLeasedDatabaseMaintenance } from "../server/database-maintenance.js";
import { assertDatabaseConnectionCeiling } from "../server/process-role.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("database maintenance lease admits one replica", {
    skip: "TEST_DATABASE_URL is not configured",
  }, () => {});
} else {
  const { Pool } = pg;

  test("database maintenance lease admits one replica and safely skips its contender", async () => {
    const firstPool = new Pool({
      connectionString: testDatabaseUrl,
      ssl: false,
      max: 1,
    });
    const secondPool = new Pool({
      connectionString: testDatabaseUrl,
      ssl: false,
      max: 1,
    });
    let releaseFirst;
    let firstAcquired;
    const firstHoldingLease = new Promise((resolve) => {
      firstAcquired = resolve;
    });
    const releaseLease = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    let secondPruneCalled = false;

    try {
      const first = runLeasedDatabaseMaintenance(firstPool, {
        prune: async () => {
          firstAcquired();
          await releaseLease;
          return 3;
        },
      });
      await firstHoldingLease;
      const second = await runLeasedDatabaseMaintenance(secondPool, {
        prune: async () => {
          secondPruneCalled = true;
          return 1;
        },
      });
      assert.deepEqual(second, {
        acquired: false,
        pruned: 0,
        durationMs: second.durationMs,
      });
      assert.equal(secondPruneCalled, false);

      releaseFirst();
      const completed = await first;
      assert.equal(completed.acquired, true);
      assert.equal(completed.pruned, 3);
    } finally {
      releaseFirst?.();
      await firstPool.end();
      await secondPool.end();
    }
  });

  test("database connection ceiling is read from PostgreSQL before activation", async () => {
    const pool = new Pool({
      connectionString: testDatabaseUrl,
      ssl: false,
      max: 1,
    });
    try {
      const ceiling = await assertDatabaseConnectionCeiling(pool, {
        ok: true,
        databaseMaxConnections: 1,
      });
      assert.ok(ceiling.observedMaxConnections >= 1);
      assert.ok(ceiling.observedUsableConnections >= 1);
      assert.equal(ceiling.declaredMaxConnections, 1);
      assert.ok(ceiling.globalUsableConnections >= 1);
      assert.ok(ceiling.databaseConnectionLimit >= -1);
      assert.ok(ceiling.roleConnectionLimit >= -1);
      assert.ok(
        ceiling.observedUsableConnections
          <= ceiling.observedMaxConnections,
      );
    } finally {
      await pool.end();
    }
  });
}
