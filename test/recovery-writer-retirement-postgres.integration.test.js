import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import {
  completeRecoveryDatabaseIdentitySha256,
} from "../scripts/complete-recovery-database.js";
import {
  createRecoveryWriterRetirementPostgresStore,
} from "../scripts/recovery-writer-retirement-postgres-store.js";
import { runtimeDatabaseIdentity } from "../scripts/logical-backup-utils.js";
import { migrateUp, rollbackLatest } from "../server/migrations.js";

const { Pool } = pg;
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const fixturePath = fileURLToPath(new URL(
  "./fixtures/recovery-writer-retirement-process.mjs",
  import.meta.url,
));
const migrationDirectory = fileURLToPath(new URL(
  "../migrations/recovery-writer-retirement-controller/",
  import.meta.url,
));
const markerTable = "public.packet100a_providerless_authority_markers";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactTestDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid isolated PostgreSQL URL.");
  }
  const databaseName = url.pathname.replace(/^\//u, "").toLowerCase();
  if (!/(^|[_-])test($|[_-])|rivt_test/u.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL must identify an isolated test database.");
  }
  if (process.env.DATABASE_URL?.trim() === value) {
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL.");
  }
  return url;
}

async function identityForPool(pool) {
  const client = await pool.connect();
  try {
    return await runtimeDatabaseIdentity(client);
  } finally {
    client.release();
  }
}

function contextFor(label) {
  const digest = sha256(`packet-100a:${label}`);
  const runId = `run-${digest.slice(0, 48)}`;
  return {
    runId,
    runNonce: sha256(`nonce:${label}`),
    bindingDigestSha256: sha256(`binding:${label}`),
    writerControlEvidenceLevel: "providerless-injected-fake",
    retirementDescriptorReference: `private-control-record:${runId}`,
    retirementDescriptorIdentitySha256: sha256(`descriptor:${label}`),
    retirementDeadlineAt: "2026-08-17T15:05:00.000Z",
    retirementProofDeadlineAt: "2026-08-17T15:09:00.000Z",
    writerSessionExpiresAt: "2026-08-17T15:10:00.000Z",
  };
}

function minimalChildEnvironment(values) {
  const inherited = ["SystemRoot", "WINDIR", "TEMP", "TMP"];
  return Object.fromEntries([
    ...inherited
      .filter((name) => typeof process.env[name] === "string")
      .map((name) => [name, process.env[name]]),
    ...Object.entries(values),
  ]);
}

function spawnFixture({
  mode,
  databaseUrl,
  expectedIdentitySha256,
  prohibitedIdentitySha256,
  now,
  context,
  attemptTimeoutMs = 1_000,
}) {
  const child = fork(fixturePath, [], {
    env: minimalChildEnvironment({
      PACKET100A_MODE: mode,
      PACKET100A_DATABASE_URL: databaseUrl,
      PACKET100A_EXPECTED_DATABASE_IDENTITY_SHA256: expectedIdentitySha256,
      PACKET100A_PROHIBITED_DATABASE_IDENTITY_SHA256: prohibitedIdentitySha256,
      PACKET100A_NOW: now,
      PACKET100A_CONTEXT_BASE64URL: Buffer.from(JSON.stringify(context)).toString("base64url"),
      PACKET100A_ATTEMPT_TIMEOUT_MS: String(attemptTimeoutMs),
    }),
    silent: true,
    windowsHide: true,
  });
  const handle = {
    child,
    stdout: "",
    stderr: "",
    messages: [],
  };
  child.stdout.on("data", (chunk) => { handle.stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { handle.stderr += chunk.toString("utf8"); });
  child.on("message", (message) => { handle.messages.push(message); });
  return handle;
}

function waitForMessage(handle, predicate, timeoutMs = 15_000) {
  const existing = handle.messages.find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for a safe subprocess milestone."));
    }, timeoutMs);
    timeout.unref?.();
    function cleanup() {
      clearTimeout(timeout);
      handle.child.off("message", onMessage);
      handle.child.off("exit", onExit);
      handle.child.off("error", onError);
    }
    function onMessage(message) {
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    }
    function onExit() {
      cleanup();
      reject(new Error("Subprocess exited before the required milestone."));
    }
    function onError() {
      cleanup();
      reject(new Error("Subprocess failed before the required milestone."));
    }
    handle.child.on("message", onMessage);
    handle.child.once("exit", onExit);
    handle.child.once("error", onError);
    const raced = handle.messages.find(predicate);
    if (raced) {
      cleanup();
      resolve(raced);
    }
  });
}

function waitForExit(handle, timeoutMs = 20_000) {
  if (handle.child.exitCode !== null || handle.child.signalCode !== null) {
    return Promise.resolve({ code: handle.child.exitCode, signal: handle.child.signalCode });
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the subprocess to exit."));
    }, timeoutMs);
    timeout.unref?.();
    function cleanup() {
      clearTimeout(timeout);
      handle.child.off("exit", onExit);
      handle.child.off("error", onError);
    }
    function onExit(code, signal) {
      cleanup();
      resolve({ code, signal });
    }
    function onError() {
      cleanup();
      reject(new Error("Subprocess emitted an execution error."));
    }
    handle.child.once("exit", onExit);
    handle.child.once("error", onError);
    if (handle.child.exitCode !== null || handle.child.signalCode !== null) {
      cleanup();
      resolve({ code: handle.child.exitCode, signal: handle.child.signalCode });
    }
  });
}

async function killAndWait(handle) {
  handle.child.kill("SIGKILL");
  return waitForExit(handle);
}

function assertSafeTranscript(handle, secrets) {
  const transcript = `${handle.stdout}\n${handle.stderr}\n${JSON.stringify(handle.messages)}`;
  for (const secret of secrets) {
    if (secret) assert.equal(transcript.includes(secret), false);
  }
}

async function marker(pool, runId) {
  const result = await pool.query(
    `SELECT run_id, retirement_descriptor_identity_sha256, active,
            retirement_count, last_fencing_token
       FROM ${markerTable}
      WHERE run_id = $1`,
    [runId],
  );
  assert.equal(result.rowCount, 1);
  return {
    runId: result.rows[0].run_id,
    retirementDescriptorIdentitySha256:
      result.rows[0].retirement_descriptor_identity_sha256,
    active: result.rows[0].active,
    retirementCount: Number(result.rows[0].retirement_count),
    lastFencingToken: result.rows[0].last_fencing_token === null
      ? null
      : Number(result.rows[0].last_fencing_token),
  };
}

if (!testDatabaseUrl) {
  if (/^(1|true)$/iu.test(process.env.CI ?? "")) {
    test("durable writer-retirement PostgreSQL process restart proof", () => {
      throw new Error("CI requires TEST_DATABASE_URL for the Packet 100A restart proof.");
    });
  } else {
    test(
      "durable writer-retirement PostgreSQL process restart proof",
      { skip: "TEST_DATABASE_URL is not configured" },
      () => {},
    );
  }
} else {
  test("durable writer-retirement PostgreSQL process restart proof", {
    timeout: 120_000,
  }, async (suite) => {
    const baseUrl = exactTestDatabaseUrl(testDatabaseUrl);
    const databaseName = `rivt_controller_test_${process.pid}_${randomBytes(4).toString("hex")}`;
    const controllerUrl = new URL(baseUrl);
    controllerUrl.pathname = `/${databaseName}`;
    const controllerDatabaseUrl = controllerUrl.toString();
    const admin = new Pool({ connectionString: baseUrl.toString(), ssl: false, max: 2 });
    let controllerPool;
    const children = new Set();

    try {
      await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
      controllerPool = new Pool({
        connectionString: controllerDatabaseUrl,
        ssl: false,
        max: 4,
        connectionTimeoutMillis: 5_000,
        query_timeout: 30_000,
        statement_timeout: 30_000,
        lock_timeout: 5_000,
        idle_in_transaction_session_timeout: 30_000,
      });
      const protectedIdentitySha256 = completeRecoveryDatabaseIdentitySha256(
        await identityForPool(admin),
      );
      const expectedIdentitySha256 = completeRecoveryDatabaseIdentitySha256(
        await identityForPool(controllerPool),
      );
      assert.notEqual(expectedIdentitySha256, protectedIdentitySha256);

      const store = createRecoveryWriterRetirementPostgresStore({
        pool: controllerPool,
        expectedRuntimeDatabaseIdentitySha256: expectedIdentitySha256,
        prohibitedRuntimeDatabaseIdentitySha256s: {
          application: protectedIdentitySha256,
          backup: protectedIdentitySha256,
          restore: protectedIdentitySha256,
        },
      });
      const childOptions = (mode, context, now, attemptTimeoutMs) => ({
        mode,
        databaseUrl: controllerDatabaseUrl,
        expectedIdentitySha256,
        prohibitedIdentitySha256: protectedIdentitySha256,
        now,
        context,
        attemptTimeoutMs,
      });
      const secretsFor = (context) => [
        context.runNonce,
        context.retirementDescriptorReference,
        controllerDatabaseUrl,
        controllerUrl.password,
      ];

      await suite.test("explicit migration applies, rolls back empty, and reapplies", async () => {
        const applied = await migrateUp(controllerPool, { directory: migrationDirectory });
        assert.equal(applied.latestVersion, 1);
        const rerun = await migrateUp(controllerPool, { directory: migrationDirectory });
        assert.equal(rerun.applied.length, 1);
        const rolledBack = await rollbackLatest(controllerPool, { directory: migrationDirectory });
        assert.equal(rolledBack.latestVersion, 0);
        const reapplied = await migrateUp(controllerPool, { directory: migrationDirectory });
        assert.equal(reapplied.latestVersion, 1);
      });
      await controllerPool.query(
        `CREATE TABLE ${markerTable} (
           run_id text PRIMARY KEY,
           retirement_descriptor_identity_sha256 text NOT NULL,
           active boolean NOT NULL,
           retirement_count integer NOT NULL CHECK (retirement_count >= 0),
           last_fencing_token bigint
         )`,
      );
      await controllerPool.query(`REVOKE ALL ON TABLE ${markerTable} FROM PUBLIC`);

      await suite.test("killed writer process is retired by a reopened controller", async () => {
        const context = contextFor("killed-after-registration");
        const writer = spawnFixture(childOptions(
          "register-and-hold",
          context,
          "2026-08-17T15:00:00.000Z",
        ));
        children.add(writer);
        await waitForMessage(writer, (message) => (
          message?.type === "ready" && message.phase === "registered-and-active"
        ));
        await killAndWait(writer);
        children.delete(writer);
        assert.equal((await store.load(context.runId)).state, "registered");

        const sweeper = spawnFixture(childOptions(
          "sweep",
          context,
          "2026-08-17T15:06:00.000Z",
        ));
        children.add(sweeper);
        const exit = await waitForExit(sweeper);
        children.delete(sweeper);
        assert.equal(exit.code, 0);
        const record = await store.load(context.runId);
        assert.equal(record.state, "retired");
        assert.equal(record.retirementTrigger, "write-window-expired");
        assert.equal(record.writerOutcome, "abandoned-or-unknown");
        assert.equal(record.completionEligible, false);
        assert.deepEqual(await marker(controllerPool, context.runId), {
          runId: context.runId,
          retirementDescriptorIdentitySha256: context.retirementDescriptorIdentitySha256,
          active: false,
          retirementCount: 1,
          lastFencingToken: record.fencingToken - 1,
        });
        assertSafeTranscript(writer, secretsFor(context));
        assertSafeTranscript(sweeper, secretsFor(context));
      });

      await suite.test("expired attempt is reclaimed with a higher fence", async () => {
        const context = contextFor("killed-while-retiring");
        const writer = spawnFixture(childOptions(
          "register-and-hold",
          context,
          "2026-08-17T15:00:00.000Z",
        ));
        children.add(writer);
        await waitForMessage(writer, (message) => message?.phase === "registered-and-active");
        await killAndWait(writer);
        children.delete(writer);

        const firstController = spawnFixture(childOptions(
          "claim-and-hold",
          context,
          "2026-08-17T15:06:00.000Z",
          1_000,
        ));
        children.add(firstController);
        const claim = await waitForMessage(
          firstController,
          (message) => message?.phase === "retiring",
        );
        const stale = await store.load(context.runId);
        assert.equal(stale.state, "retiring");
        assert.equal(stale.fencingToken, claim.fencingToken);
        await killAndWait(firstController);
        children.delete(firstController);

        const early = spawnFixture(childOptions(
          "sweep",
          context,
          "2026-08-17T15:06:00.500Z",
          1_000,
        ));
        children.add(early);
        assert.equal((await waitForExit(early)).code, 0);
        children.delete(early);
        assert.equal((await store.load(context.runId)).fencingToken, stale.fencingToken);

        const recovered = spawnFixture(childOptions(
          "sweep",
          context,
          "2026-08-17T15:06:02.000Z",
          1_000,
        ));
        children.add(recovered);
        assert.equal((await waitForExit(recovered)).code, 0);
        children.delete(recovered);
        const finalRecord = await store.load(context.runId);
        assert.equal(finalRecord.state, "retired");
        assert.ok(finalRecord.fencingToken > stale.fencingToken);
        const staleNext = {
          ...stale,
          state: "retirement_unverified",
          revision: stale.revision + 1,
          fencingToken: stale.fencingToken + 1,
          retiringAt: null,
          attemptLeaseExpiresAt: null,
          lastFailureCode: "RETIREMENT_VERIFICATION_FAILED",
        };
        assert.equal(await store.compareExchange({
          runId: context.runId,
          expectedRevision: stale.revision,
          expectedFencingToken: stale.fencingToken,
          next: staleNext,
        }), null);
        for (const handle of [writer, firstController, early, recovered]) {
          assertSafeTranscript(handle, secretsFor(context));
        }
      });

      await suite.test("effect-before-response crash retries idempotently", async () => {
        const context = contextFor("response-lost-after-retirement");
        const writer = spawnFixture(childOptions(
          "register-and-hold",
          context,
          "2026-08-17T15:00:00.000Z",
        ));
        children.add(writer);
        await waitForMessage(writer, (message) => message?.phase === "registered-and-active");
        await killAndWait(writer);
        children.delete(writer);

        const lostResponse = spawnFixture(childOptions(
          "sweep-response-loss",
          context,
          "2026-08-17T15:06:00.000Z",
          1_000,
        ));
        children.add(lostResponse);
        await waitForMessage(
          lostResponse,
          (message) => message?.phase === "retirement-effect-persisted",
        );
        assert.equal((await marker(controllerPool, context.runId)).retirementCount, 1);
        const ambiguous = await store.load(context.runId);
        assert.equal(ambiguous.state, "retiring");
        await killAndWait(lostResponse);
        children.delete(lostResponse);

        const retry = spawnFixture(childOptions(
          "sweep",
          context,
          "2026-08-17T15:06:02.000Z",
          1_000,
        ));
        children.add(retry);
        assert.equal((await waitForExit(retry)).code, 0);
        children.delete(retry);
        assert.equal((await store.load(context.runId)).state, "retired");
        assert.equal((await marker(controllerPool, context.runId)).retirementCount, 1);
        for (const handle of [writer, lostResponse, retry]) {
          assertSafeTranscript(handle, secretsFor(context));
        }
      });

      await suite.test("concurrent sweepers cannot both exercise retirement authority", async () => {
        const context = contextFor("concurrent-sweepers");
        const writer = spawnFixture(childOptions(
          "register-and-hold",
          context,
          "2026-08-17T15:00:00.000Z",
        ));
        children.add(writer);
        await waitForMessage(writer, (message) => message?.phase === "registered-and-active");
        await killAndWait(writer);
        children.delete(writer);

        const first = spawnFixture(childOptions(
          "sweep",
          context,
          "2026-08-17T15:06:00.000Z",
        ));
        const second = spawnFixture(childOptions(
          "sweep",
          context,
          "2026-08-17T15:06:00.000Z",
        ));
        children.add(first);
        children.add(second);
        const exits = await Promise.all([waitForExit(first), waitForExit(second)]);
        children.delete(first);
        children.delete(second);
        assert.ok(exits.some(({ code }) => code === 0));
        assert.equal((await store.load(context.runId)).state, "retired");
        assert.equal((await marker(controllerPool, context.runId)).retirementCount, 1);
        for (const handle of [writer, first, second]) {
          assertSafeTranscript(handle, secretsFor(context));
        }
      });

      await suite.test("constraints and rollback preserve durable evidence", async () => {
        await assert.rejects(
          controllerPool.query(
            `UPDATE rivt_recovery_control.writer_retirement_records
                SET record = record || '{"unexpected":true}'::jsonb
              WHERE run_id = (SELECT run_id FROM rivt_recovery_control.writer_retirement_records LIMIT 1)`,
          ),
          /check constraint/iu,
        );
        await assert.rejects(
          controllerPool.query(
            `UPDATE rivt_recovery_control.writer_retirement_records
                SET record = jsonb_set(record, '{revision}', 'null'::jsonb)
              WHERE run_id = (SELECT run_id FROM rivt_recovery_control.writer_retirement_records LIMIT 1)`,
          ),
          /check constraint/iu,
        );
        await assert.rejects(
          rollbackLatest(controllerPool, { directory: migrationDirectory }),
          /refusing to remove nonempty writer-retirement evidence/iu,
        );
        await controllerPool.query(
          "DELETE FROM rivt_recovery_control.writer_retirement_records",
        );
        const rolledBack = await rollbackLatest(controllerPool, { directory: migrationDirectory });
        assert.equal(rolledBack.latestVersion, 0);
      });
    } finally {
      for (const handle of children) {
        if (handle.child.exitCode === null && handle.child.signalCode === null) {
          handle.child.kill("SIGKILL");
          await waitForExit(handle).catch(() => {});
        }
      }
      await controllerPool?.end().catch(() => {});
      await admin.query(
        `SELECT pg_terminate_backend(pid)
           FROM pg_stat_activity
          WHERE datname = $1
            AND pid <> pg_backend_pid()`,
        [databaseName],
      ).catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
      await admin.end().catch(() => {});
    }
  });
}
