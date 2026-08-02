import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import {
  insertBatch,
  rowsForTable,
  tableColumns,
  tableContentDigest,
  withCanonicalReadSnapshot,
} from "../scripts/logical-backup-utils.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("logical backup PostgreSQL text fidelity", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  test("logical backup preserves PostgreSQL text values and repeatable-read consistency", async () => {
    const tableName = `recovery_fidelity_${randomUUID().replaceAll("-", "")}`;
    const quotedTable = `"public"."${tableName}"`;
    const pool = new pg.Pool({ connectionString: testDatabaseUrl, ssl: false, max: 3 });
    const snapshotClient = await pool.connect();
    const writerClient = await pool.connect();

    try {
      await writerClient.query(`
        CREATE TABLE ${quotedTable} (
          id uuid PRIMARY KEY,
          big_value bigint NOT NULL,
          precise_value numeric NOT NULL,
          day_value date NOT NULL,
          local_time timestamp(6) NOT NULL,
          utc_time timestamptz(6) NOT NULL,
          json_value json NOT NULL,
          jsonb_value jsonb NOT NULL,
          bytes_value bytea NOT NULL,
          uuid_values uuid[] NOT NULL,
          text_values text[] NOT NULL,
          unicode_text text,
          nullable_text text
        )
      `);
      const id = randomUUID();
      const arrayId = randomUUID();
      await writerClient.query(
        `INSERT INTO ${quotedTable} (
           id, big_value, precise_value, day_value, local_time, utc_time,
           json_value, jsonb_value, bytes_value, uuid_values, text_values,
           unicode_text, nullable_text
         ) VALUES (
           $1, 9007199254740993, 1234567890.123456789012345678,
           DATE '2026-07-29',
           TIMESTAMP '2026-07-29 12:34:56.123456',
           TIMESTAMPTZ '2026-07-29 16:34:56.654321+00',
           '{"b":2,"a":1}'::json,
           '{"b":2,"a":1}'::jsonb,
           decode('00ff10', 'hex'),
           ARRAY[$2::uuid],
           ARRAY['line one', E'line\\ntwo'],
           E'caf\u00e9\\nwork',
           NULL
         )`,
        [id, arrayId],
      );

      const first = await withCanonicalReadSnapshot(snapshotClient, async () => {
        const columns = await tableColumns(snapshotClient, tableName);
        const rows = await rowsForTable(snapshotClient, tableName, columns);
        return { columns, rows };
      });
      assert.equal(first.rows.length, 1);
      const row = first.rows[0];
      assert.equal(row.big_value, "9007199254740993");
      assert.equal(row.precise_value, "1234567890.123456789012345678");
      assert.equal(row.day_value, "2026-07-29");
      assert.equal(row.local_time, "2026-07-29 12:34:56.123456");
      assert.equal(row.utc_time, "2026-07-29 16:34:56.654321+00");
      assert.equal(row.bytes_value, "\\x00ff10");
      assert.equal(row.uuid_values, `{${arrayId}}`);
      assert.match(row.text_values, /line/);
      assert.equal(row.unicode_text, "caf\u00e9\nwork");
      assert.equal(row.nullable_text, null);

      const originalDigest = tableContentDigest(tableName, first.columns, first.rows);
      await writerClient.query(`TRUNCATE ${quotedTable}`);
      await insertBatch(
        writerClient,
        tableName,
        first.columns.map((column) => ({ ...column, canonicalText: true })),
        first.rows,
      );
      const restored = await withCanonicalReadSnapshot(snapshotClient, async () => ({
        columns: await tableColumns(snapshotClient, tableName),
        rows: await rowsForTable(snapshotClient, tableName, first.columns),
      }));
      assert.equal(tableContentDigest(tableName, restored.columns, restored.rows), originalDigest);

      let releaseWriter;
      const writerCanCommit = new Promise((resolve) => {
        releaseWriter = resolve;
      });
      const concurrent = await withCanonicalReadSnapshot(snapshotClient, async () => {
        const before = await rowsForTable(snapshotClient, tableName, first.columns);
        await writerClient.query(
          `UPDATE ${quotedTable} SET precise_value = 999.001 WHERE id = $1`,
          [id],
        );
        releaseWriter();
        await writerCanCommit;
        const after = await rowsForTable(snapshotClient, tableName, first.columns);
        return { before, after };
      });
      assert.deepEqual(concurrent.after, concurrent.before);

      const afterCommit = await withCanonicalReadSnapshot(snapshotClient, async () => (
        rowsForTable(snapshotClient, tableName, first.columns)
      ));
      assert.equal(afterCommit[0].precise_value, "999.001");
      assert.notEqual(
        tableContentDigest(tableName, first.columns, afterCommit),
        originalDigest,
      );

      await assert.rejects(
        withCanonicalReadSnapshot(snapshotClient, async () => {
          await snapshotClient.query(`DELETE FROM ${quotedTable}`);
        }),
        (error) => error?.code === "25006",
      );
    } finally {
      await writerClient.query(`DROP TABLE IF EXISTS ${quotedTable}`).catch(() => undefined);
      snapshotClient.release();
      writerClient.release();
      await pool.end();
    }
  });
}
