import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  runRecoveryWriterRetirementSweep,
} from "../scripts/run-recovery-writer-retirement-sweep.js";

const RUN_ID = `run-${"1".repeat(48)}`;
const RUN_NONCE = "2".repeat(64);
const DESCRIPTOR = `private-control-record:${"3".repeat(64)}`;

function registeredRecord() {
  return {
    schema: "rivt-recovery-writer-retirement-record-v1",
    runId: RUN_ID,
    runNonce: RUN_NONCE,
    bindingDigestSha256: "a".repeat(64),
    writerControlEvidenceLevel: "providerless-injected-fake",
    retirementDescriptorReference: DESCRIPTOR,
    retirementDescriptorIdentitySha256: "b".repeat(64),
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
  };
}

function memoryStore() {
  let record = registeredRecord();
  return {
    async create(candidate) {
      record ??= structuredClone(candidate);
      return structuredClone(record);
    },
    async load() {
      return structuredClone(record);
    },
    async compareExchange({ expectedRevision, expectedFencingToken, next }) {
      if (
        record.revision !== expectedRevision
        || record.fencingToken !== expectedFencingToken
      ) return null;
      record = structuredClone(next);
      return structuredClone(record);
    },
    async listDue() {
      return [structuredClone(record)];
    },
  };
}

test("one-shot sweep emits only a redacted aggregate receipt", async () => {
  const receipts = [];
  const receipt = await runRecoveryWriterRetirementSweep({
    store: memoryStore(),
    async retireAndVerify(operation, { signal }) {
      assert.equal(signal.aborted, false);
      return {
        schema: "rivt-recovery-writer-retirement-proof-v1",
        runId: operation.runId,
        runNonce: operation.runNonce,
        bindingDigestSha256: operation.bindingDigestSha256,
        writerControlEvidenceLevel: operation.writerControlEvidenceLevel,
        retirementDescriptorIdentitySha256: operation.retirementDescriptorIdentitySha256,
        fencingToken: operation.fencingToken,
        retired: true,
        verifiedAt: operation.retiringAt,
        retirementVerificationSha256: "c".repeat(64),
      };
    },
    now: () => "2026-08-17T15:06:00.000Z",
    async writeReceipt(value) {
      receipts.push(value);
    },
  });

  assert.deepEqual(receipt, receipts[0]);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.reconciledCount, 1);
  assert.deepEqual(receipt.stateCounts, { retired: 1 });
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes(RUN_NONCE), false);
  assert.equal(serialized.includes(DESCRIPTOR), false);
  assert.equal(serialized.includes(RUN_ID), false);
});

test("retirement operation timeout aborts and fails closed", async () => {
  await assert.rejects(
    () => runRecoveryWriterRetirementSweep({
      store: memoryStore(),
      retireAndVerify(operation, { signal }) {
        assert.equal(operation.runId, RUN_ID);
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      },
      now: () => "2026-08-17T15:06:00.000Z",
      operationTimeoutMs: 5,
    }),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
  );
});

test("direct CLI is inert and prints only a fixed safe failure", () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("../scripts/run-recovery-writer-retirement-sweep.js", import.meta.url)),
  ], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout.trim());
  assert.deepEqual(output, {
    ok: false,
    code: "RECOVERY_WRITER_RETIREMENT_CONTROLLER_REQUIRED",
    message: "Writer-retirement sweep is unavailable without reviewed controller injection.",
  });
  assert.equal(result.stderr, "");
});
