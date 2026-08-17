import { createHash } from "node:crypto";
import pg from "pg";
import {
  createRecoveryWriterRetirementPostgresStore,
} from "../../scripts/recovery-writer-retirement-postgres-store.js";
import {
  createRecoveryWriterRetirementController,
} from "../../scripts/recovery-writer-retirement-controller.js";
import {
  runRecoveryWriterRetirementSweep,
} from "../../scripts/run-recovery-writer-retirement-sweep.js";

const { Pool } = pg;
const MARKER_TABLE = "public.packet100a_providerless_authority_markers";

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || !value) throw new Error(`Missing ${name}.`);
  return value;
}

function safeCode(error) {
  return typeof error?.code === "string"
    ? error.code
    : "RECOVERY_WRITER_RETIREMENT_UNVERIFIED";
}

function send(message) {
  if (process.send) process.send(message);
}

function holdProcessOpen() {
  return new Promise(() => {
    setInterval(() => {}, 1_000);
  });
}

const mode = requiredEnv("PACKET100A_MODE");
const databaseUrl = requiredEnv("PACKET100A_DATABASE_URL");
const expectedIdentity = requiredEnv("PACKET100A_EXPECTED_DATABASE_IDENTITY_SHA256");
const prohibitedIdentity = requiredEnv("PACKET100A_PROHIBITED_DATABASE_IDENTITY_SHA256");
const nowIso = requiredEnv("PACKET100A_NOW");
const context = JSON.parse(Buffer.from(
  requiredEnv("PACKET100A_CONTEXT_BASE64URL"),
  "base64url",
).toString("utf8"));
const attemptTimeoutMs = Number(process.env.PACKET100A_ATTEMPT_TIMEOUT_MS ?? "1000");
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: false,
  max: 2,
  connectionTimeoutMillis: 5_000,
  query_timeout: 30_000,
  statement_timeout: 30_000,
  lock_timeout: 5_000,
  idle_in_transaction_session_timeout: 30_000,
});

function store() {
  return createRecoveryWriterRetirementPostgresStore({
    pool,
    expectedRuntimeDatabaseIdentitySha256: expectedIdentity,
    prohibitedRuntimeDatabaseIdentitySha256s: {
      application: prohibitedIdentity,
      backup: prohibitedIdentity,
      restore: prohibitedIdentity,
    },
  });
}

async function retireProviderlessMarker(operation, { responseLoss = false } = {}) {
  const updated = await pool.query(
    `UPDATE ${MARKER_TABLE}
        SET active = FALSE,
            retirement_count = retirement_count + 1,
            last_fencing_token = $3
      WHERE run_id = $1
        AND retirement_descriptor_identity_sha256 = $2
        AND active = TRUE
      RETURNING run_id, retirement_descriptor_identity_sha256, active,
                retirement_count, last_fencing_token`,
    [
      operation.runId,
      operation.retirementDescriptorIdentitySha256,
      operation.fencingToken,
    ],
  );
  const result = updated.rowCount === 1
    ? updated
    : await pool.query(
      `SELECT run_id, retirement_descriptor_identity_sha256, active,
              retirement_count, last_fencing_token
         FROM ${MARKER_TABLE}
        WHERE run_id = $1`,
      [operation.runId],
    );
  const marker = result.rows[0];
  if (
    result.rowCount !== 1
    || marker.run_id !== operation.runId
    || marker.retirement_descriptor_identity_sha256
      !== operation.retirementDescriptorIdentitySha256
  ) {
    throw new Error("Providerless authority marker binding mismatch.");
  }
  if (responseLoss) {
    send({ type: "ready", phase: "retirement-effect-persisted" });
    await holdProcessOpen();
  }
  const digest = createHash("sha256").update(JSON.stringify([
    "rivt-providerless-writer-retirement-proof-v1",
    operation.runId,
    operation.bindingDigestSha256,
    operation.retirementDescriptorIdentitySha256,
    marker.retirement_count,
  ])).digest("hex");
  return {
    schema: "rivt-recovery-writer-retirement-proof-v1",
    runId: operation.runId,
    runNonce: operation.runNonce,
    bindingDigestSha256: operation.bindingDigestSha256,
    writerControlEvidenceLevel: operation.writerControlEvidenceLevel,
    retirementDescriptorIdentitySha256: operation.retirementDescriptorIdentitySha256,
    fencingToken: operation.fencingToken,
    retired: true,
    verifiedAt: nowIso,
    retirementVerificationSha256: digest,
  };
}

async function main() {
  if (mode === "register-and-hold") {
    const controller = createRecoveryWriterRetirementController({
      store: store(),
      async retireAndVerify() {
        throw new Error("Registration mode cannot retire authority.");
      },
      now: () => nowIso,
      attemptTimeoutMs,
    });
    const receipt = await controller.register(context);
    await pool.query(
      `INSERT INTO ${MARKER_TABLE} (
         run_id, retirement_descriptor_identity_sha256, active,
         retirement_count, last_fencing_token
       ) VALUES ($1, $2, TRUE, 0, NULL)`,
      [context.runId, context.retirementDescriptorIdentitySha256],
    );
    send({ type: "ready", phase: "registered-and-active", runId: receipt.runId });
    await holdProcessOpen();
    return;
  }

  if (mode === "claim-and-hold") {
    const controller = createRecoveryWriterRetirementController({
      store: store(),
      async retireAndVerify(operation) {
        send({
          type: "ready",
          phase: "retiring",
          revision: operation.retirementAttempt,
          fencingToken: operation.fencingToken,
        });
        await holdProcessOpen();
      },
      now: () => nowIso,
      attemptTimeoutMs,
    });
    await controller.reconcile(context.runId);
    return;
  }

  if (mode === "sweep" || mode === "sweep-response-loss") {
    const receipt = await runRecoveryWriterRetirementSweep({
      store: store(),
      retireAndVerify(operation) {
        return retireProviderlessMarker(operation, {
          responseLoss: mode === "sweep-response-loss",
        });
      },
      now: () => nowIso,
      attemptTimeoutMs,
      operationTimeoutMs: 10_000,
      writeReceipt(value) {
        send({ type: "receipt", receipt: value });
      },
    });
    send({ type: "complete", receipt });
    return;
  }

  throw new Error("Unsupported subprocess mode.");
}

try {
  await main();
} catch (error) {
  send({ type: "failed", code: safeCode(error) });
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
