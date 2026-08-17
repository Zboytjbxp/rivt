import assert from "node:assert/strict";
import test from "node:test";
import {
  RECOVERY_WRITER_CONTROL_EVIDENCE_LEVELS,
  assertRecoveryWriterRetirementControllerClient,
  createRecoveryWriterRetirementController,
  createRecoveryWriterRetirementControllerClient,
} from "../scripts/recovery-writer-retirement-controller.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const RUN_ID = `run-${"1".repeat(48)}`;
const RUN_NONCE = "2".repeat(64);
const DESCRIPTOR_REFERENCE = `providerless-injected-fake:${RUN_ID}`;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createMemoryStore({ createError } = {}) {
  const records = new Map();
  const calls = [];
  let rejectNextCompareExchange = false;
  let nextCompareExchangeMutation;

  return {
    calls,
    records,
    rejectNextCompareExchange() {
      rejectNextCompareExchange = true;
    },
    mutateNextCompareExchange(mutation) {
      nextCompareExchangeMutation = mutation;
    },
    async create(record) {
      calls.push(["create", record.runId]);
      if (createError) throw createError;
      const existing = records.get(record.runId);
      if (existing) return clone(existing);
      records.set(record.runId, clone(record));
      return clone(record);
    },
    async load(runId) {
      calls.push(["load", runId]);
      return clone(records.get(runId) ?? null);
    },
    async compareExchange({
      runId,
      expectedRevision,
      expectedFencingToken,
      next,
    }) {
      calls.push([
        "compareExchange",
        runId,
        expectedRevision,
        expectedFencingToken,
        next.state,
      ]);
      if (rejectNextCompareExchange) {
        rejectNextCompareExchange = false;
        const current = records.get(runId);
        records.set(runId, {
          ...current,
          revision: current.revision + 1,
          fencingToken: current.fencingToken + 1,
        });
        return null;
      }
      const current = records.get(runId);
      if (
        !current
        || current.revision !== expectedRevision
        || current.fencingToken !== expectedFencingToken
      ) {
        return null;
      }
      if (nextCompareExchangeMutation) {
        const mutation = nextCompareExchangeMutation;
        nextCompareExchangeMutation = undefined;
        const mutated = mutation(clone(next));
        records.set(runId, clone(mutated));
        return clone(mutated);
      }
      records.set(runId, clone(next));
      return clone(next);
    },
    async listDue({ at, states }) {
      calls.push(["listDue", at, [...states]]);
      return [...records.values()]
        .filter((record) => {
          if (!states.includes(record.state)) return false;
          if (record.state === "registered") {
            return record.retirementDeadlineAt <= at;
          }
          if (record.state === "retiring") {
            return record.attemptLeaseExpiresAt <= at;
          }
          return true;
        })
        .map(clone);
    },
  };
}

function registration(overrides = {}) {
  return {
    runId: RUN_ID,
    runNonce: RUN_NONCE,
    bindingDigestSha256: SHA_A,
    writerControlEvidenceLevel:
      RECOVERY_WRITER_CONTROL_EVIDENCE_LEVELS.PROVIDERLESS_INJECTED_FAKE,
    retirementDescriptorReference: DESCRIPTOR_REFERENCE,
    retirementDescriptorIdentitySha256: SHA_B,
    retirementDeadlineAt: "2026-08-17T15:05:00.000Z",
    retirementProofDeadlineAt: "2026-08-17T15:09:00.000Z",
    writerSessionExpiresAt: "2026-08-17T15:10:00.000Z",
    ...overrides,
  };
}

function retirementRequest(overrides = {}) {
  return {
    runId: RUN_ID,
    runNonce: RUN_NONCE,
    bindingDigestSha256: SHA_A,
    writerControlEvidenceLevel:
      RECOVERY_WRITER_CONTROL_EVIDENCE_LEVELS.PROVIDERLESS_INJECTED_FAKE,
    retirementDescriptorIdentitySha256: SHA_B,
    retirementTrigger: "writer-requested",
    writerOutcome: "completed",
    ...overrides,
  };
}

function proofFor(operation, overrides = {}) {
  return {
    schema: "rivt-recovery-writer-retirement-proof-v1",
    runId: operation.runId,
    runNonce: operation.runNonce,
    bindingDigestSha256: operation.bindingDigestSha256,
    writerControlEvidenceLevel: operation.writerControlEvidenceLevel,
    retirementDescriptorIdentitySha256: operation.retirementDescriptorIdentitySha256,
    fencingToken: operation.fencingToken,
    retired: true,
    verifiedAt: "2026-08-17T15:00:02.000Z",
    retirementVerificationSha256: SHA_C,
    ...overrides,
  };
}

function assertPrivateControllerDataOmitted(value) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes("retirementDescriptorReference"), false);
  assert.equal(serialized.includes(DESCRIPTOR_REFERENCE), false);
  assert.equal(serialized.includes("runNonce"), false);
  assert.equal(serialized.includes(RUN_NONCE), false);
}

test("branded client performs no I/O during construction and waits idempotently", async () => {
  const events = [];
  const client = createRecoveryWriterRetirementControllerClient({
    async register(context) {
      events.push(["register", context.runId]);
      return {
        schema: "rivt-recovery-writer-retirement-registration-receipt-v1",
        ...registration(),
        state: "registered",
        revision: 1,
        fencingToken: 1,
        registeredAt: "2026-08-17T15:00:00.000Z",
      };
    },
    async requestRetirementAndWait(context) {
      events.push(["retire", context.retirementTrigger, context.writerOutcome]);
      return {
        schema: "rivt-recovery-writer-retirement-receipt-v1",
        runId: context.runId,
        runNonce: context.runNonce,
        bindingDigestSha256: context.bindingDigestSha256,
        writerControlEvidenceLevel: context.writerControlEvidenceLevel,
        retirementDescriptorReference: DESCRIPTOR_REFERENCE,
        retirementDescriptorIdentitySha256: context.retirementDescriptorIdentitySha256,
        state: "retired",
        retirementTrigger: context.retirementTrigger,
        writerOutcome: context.writerOutcome,
        completionEligible: true,
        revision: 4,
        fencingToken: 4,
        retiredAt: "2026-08-17T15:00:02.000Z",
        retirementVerificationSha256: SHA_C,
      };
    },
  });

  assert.deepEqual(events, []);
  assert.equal(client.phase, "prepared");
  assert.equal(assertRecoveryWriterRetirementControllerClient(client), client);
  assert.throws(
    () => assertRecoveryWriterRetirementControllerClient({
      register() {},
      requestRetirementAndWait() {},
    }),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
  );

  const registered = await client.register(registration());
  assert.equal(registered.state, "registered");
  assert.equal(registered.retirementDescriptorIdentitySha256, SHA_B);
  assert.equal("retirementDescriptorReference" in registered, false);
  assert.equal(client.phase, "registered");
  const receipts = await Promise.all([
    client.requestRetirementAndWait(retirementRequest()),
    client.requestRetirementAndWait(retirementRequest()),
  ]);
  assert.deepEqual(receipts[0], receipts[1]);
  assert.equal("retirementDescriptorReference" in receipts[0], false);
  assert.equal(client.phase, "retired");
  assert.deepEqual(events, [
    ["register", RUN_ID],
    ["retire", "writer-requested", "completed"],
  ]);
});

test("client and reconciler fail closed when durable registration fails", async () => {
  const registrationError = new Error("control store unavailable");
  let reconciliationRequests = 0;
  const client = createRecoveryWriterRetirementControllerClient({
    async register() {
      throw registrationError;
    },
    async requestRetirementAndWait(context) {
      reconciliationRequests += 1;
      return {
        schema: "rivt-recovery-writer-retirement-receipt-v1",
        runId: context.runId,
        runNonce: context.runNonce,
        bindingDigestSha256: context.bindingDigestSha256,
        writerControlEvidenceLevel: context.writerControlEvidenceLevel,
        retirementDescriptorReference: DESCRIPTOR_REFERENCE,
        retirementDescriptorIdentitySha256: context.retirementDescriptorIdentitySha256,
        state: "retired",
        retirementTrigger: context.retirementTrigger,
        writerOutcome: context.writerOutcome,
        completionEligible: false,
        revision: 4,
        fencingToken: 4,
        retiredAt: "2026-08-17T15:00:02.000Z",
        retirementVerificationSha256: SHA_C,
      };
    },
  });
  await assert.rejects(
    () => client.register(registration()),
    (error) => (
      error.code === "RECOVERY_WRITER_RETIREMENT_REGISTRATION_FAILED"
      && error.cause === registrationError
    ),
  );
  assert.equal(client.phase, "registration_ambiguous");
  const reconciled = await client.requestRetirementAndWait(retirementRequest({
    writerOutcome: "abandoned-or-unknown",
  }));
  assert.equal(reconciled.state, "retired");
  assert.equal(reconciled.completionEligible, false);
  assert.equal("retirementDescriptorReference" in reconciled, false);
  assert.equal(reconciliationRequests, 1);

  const store = createMemoryStore({ createError: registrationError });
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify() {
      throw new Error("must not run");
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await assert.rejects(
    () => controller.register(registration()),
    (error) => (
      error.code === "RECOVERY_WRITER_RETIREMENT_REGISTRATION_FAILED"
      && error.cause === registrationError
    ),
  );
});

test("lost durable-registration response can still retire the exact ambiguous run", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  const responseLost = new Error("response lost after durable registration");
  const client = createRecoveryWriterRetirementControllerClient({
    async register(context) {
      await controller.register(context);
      throw responseLost;
    },
    requestRetirementAndWait: controller.requestRetirementAndWait,
  });

  await assert.rejects(
    () => client.register(registration()),
    (error) => (
      error.code === "RECOVERY_WRITER_RETIREMENT_REGISTRATION_FAILED"
      && error.cause === responseLost
    ),
  );
  assert.equal((await store.load(RUN_ID)).state, "registered");
  const receipt = await client.requestRetirementAndWait(retirementRequest({
    writerOutcome: "abandoned-or-unknown",
  }));
  assert.equal(receipt.state, "retired");
  assert.equal(receipt.completionEligible, false);
});

test("registration is exact-idempotent and conflicting binding is quarantined", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });

  const first = await controller.register(registration());
  const duplicate = await controller.register(registration());
  assert.deepEqual(duplicate, first);
  assert.equal(first.state, "registered");
  assert.equal(first.retirementDescriptorIdentitySha256, SHA_B);
  assert.equal(first.retirementProofDeadlineAt, "2026-08-17T15:09:00.000Z");
  assert.equal(first.writerSessionExpiresAt, "2026-08-17T15:10:00.000Z");
  assert.equal("retirementDescriptorReference" in first, false);

  await assert.rejects(
    () => controller.register(registration({
      retirementDescriptorReference: `${DESCRIPTOR_REFERENCE}:changed`,
    })),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
  );
  const quarantined = await store.load(RUN_ID);
  assert.equal(quarantined.state, "quarantined");
  assert.equal(quarantined.writerOutcome, "abandoned-or-unknown");
  assert.equal(quarantined.completionEligible, false);
  assert.equal(quarantined.quarantineReason, "conflicting-registration-binding");
});

test("changed descriptor identity conflicts and quarantines the durable run", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await controller.register(registration());

  await assert.rejects(
    () => controller.register(registration({
      retirementDescriptorIdentitySha256: SHA_D,
    })),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
  );
  const quarantined = await store.load(RUN_ID);
  assert.equal(quarantined.state, "quarantined");
  assert.equal(quarantined.retirementDescriptorReference, DESCRIPTOR_REFERENCE);
  assert.equal(quarantined.retirementDescriptorIdentitySha256, SHA_B);
});

test("deadline sweep retires registered authority without any activation observation", async () => {
  let currentTime = "2026-08-17T15:00:00.000Z";
  const operations = [];
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      operations.push(operation);
      return proofFor(operation, { verifiedAt: currentTime });
    },
    now: () => currentTime,
    attemptTimeoutMs: 1_000,
  });
  await controller.register(registration());
  assert.equal(operations.length, 0);

  currentTime = "2026-08-17T15:05:01.000Z";
  const sweep = await controller.reconcileDue();
  assert.equal(sweep.results.length, 1);
  assert.equal(sweep.results[0].state, "retired");
  assert.equal(operations.length, 1);
  assert.equal(operations[0].retirementTrigger, "write-window-expired");
  assert.equal(operations[0].writerOutcome, "abandoned-or-unknown");
  assert.equal(sweep.results[0].completionEligible, false);
});

test("operational status and sweep JSON omit private controller resolution data", async () => {
  let currentTime = "2026-08-17T15:00:00.000Z";
  const operations = [];
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      operations.push(operation);
      return proofFor(operation, { verifiedAt: currentTime });
    },
    now: () => currentTime,
  });
  await controller.register(registration());

  const requestedStatus = await controller.requestRetirement(retirementRequest({
    writerOutcome: "failed",
  }));
  assert.equal(requestedStatus.schema, "rivt-recovery-writer-retirement-status-v1");
  assertPrivateControllerDataOmitted(requestedStatus);
  const retiredStatus = await controller.reconcile(RUN_ID);
  assertPrivateControllerDataOmitted(retiredStatus);
  assert.equal(operations[0].retirementDescriptorReference, DESCRIPTOR_REFERENCE);
  assert.equal(operations[0].runNonce, RUN_NONCE);

  const sweepStore = createMemoryStore();
  const sweepController = createRecoveryWriterRetirementController({
    store: sweepStore,
    async retireAndVerify(operation) {
      return proofFor(operation, { verifiedAt: currentTime });
    },
    now: () => currentTime,
  });
  currentTime = "2026-08-17T15:00:00.000Z";
  await sweepController.register(registration());
  currentTime = "2026-08-17T15:05:01.000Z";
  const sweep = await sweepController.reconcileDue();
  assert.equal(sweep.results[0].schema, "rivt-recovery-writer-retirement-status-v1");
  assertPrivateControllerDataOmitted(sweep);
  assertPrivateControllerDataOmitted(sweep.results);
});

test("completed request at or after the deadline atomically becomes abandoned", async () => {
  for (const currentTime of [
    "2026-08-17T15:05:00.000Z",
    "2026-08-17T15:05:00.001Z",
  ]) {
    const operations = [];
    const store = createMemoryStore();
    const controller = createRecoveryWriterRetirementController({
      store,
      async retireAndVerify(operation) {
        operations.push(operation);
        return proofFor(operation, { verifiedAt: currentTime });
      },
      now: () => currentTime,
    });
    await controller.register(registration());

    const requested = await controller.requestRetirement(retirementRequest());
    assert.equal(requested.state, "retirement_requested");
    assert.equal(requested.retirementRequestedAt, currentTime);
    assert.equal(requested.retirementTrigger, "write-window-expired");
    assert.equal(requested.writerOutcome, "abandoned-or-unknown");
    assert.equal(requested.completionEligible, false);

    const retired = await controller.reconcile(RUN_ID);
    assert.equal(retired.state, "retired");
    assert.equal(retired.writerOutcome, "abandoned-or-unknown");
    assert.equal(retired.completionEligible, false);
    assert.equal(operations[0].retirementTrigger, "write-window-expired");
    assert.equal(operations[0].writerOutcome, "abandoned-or-unknown");
  }
});

test("ambiguous retirement is recorded and safely retried with a newer fence", async () => {
  let attempts = 0;
  const fences = [];
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      attempts += 1;
      fences.push(operation.fencingToken);
      if (attempts === 1) {
        throw new Error("response lost after idempotent retirement");
      }
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await controller.register(registration());

  await assert.rejects(
    () => controller.requestRetirementAndWait(retirementRequest()),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
  );
  assert.equal((await store.load(RUN_ID)).state, "retirement_unverified");

  const retired = await controller.reconcile(RUN_ID);
  assert.equal(retired.state, "retired");
  assert.equal(attempts, 2);
  assert.ok(fences[1] > fences[0]);
});

test("expired fenced attempt is reclaimed after the controller process dies", async () => {
  let currentTime = "2026-08-17T15:00:00.000Z";
  const operations = [];
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      operations.push(operation);
      return proofFor(operation, { verifiedAt: currentTime });
    },
    now: () => currentTime,
    attemptTimeoutMs: 1_000,
  });
  await controller.register(registration());
  await controller.requestRetirement(retirementRequest());
  const requested = await store.load(RUN_ID);
  store.records.set(RUN_ID, {
    ...requested,
    state: "retiring",
    revision: requested.revision + 1,
    fencingToken: requested.fencingToken + 1,
    retiringAt: "2026-08-17T15:00:00.000Z",
    attemptLeaseExpiresAt: "2026-08-17T15:00:01.000Z",
    retirementAttempts: 1,
  });

  currentTime = "2026-08-17T15:00:02.000Z";
  const retired = await controller.reconcile(RUN_ID);
  assert.equal(retired.state, "retired");
  assert.equal(operations.length, 1);
  assert.ok(operations[0].fencingToken > requested.fencingToken + 1);
  assert.equal(operations[0].retirementDescriptorReference, DESCRIPTOR_REFERENCE);
  assert.equal(operations[0].retirementDescriptorIdentitySha256, SHA_B);
  assert.equal(operations[0].retirementProofDeadlineAt, "2026-08-17T15:09:00.000Z");
  assert.equal(operations[0].writerSessionExpiresAt, "2026-08-17T15:10:00.000Z");
});

test("stale revision/fence prevents a controller from exercising retirement authority", async () => {
  let retireCalls = 0;
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      retireCalls += 1;
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await controller.register(registration());
  await controller.requestRetirement(retirementRequest());
  store.rejectNextCompareExchange();

  await assert.rejects(
    () => controller.reconcile(RUN_ID),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STALE_WRITE",
  );
  assert.equal(retireCalls, 0);
});

test("mutated CAS response cannot alter a canonical retirement outcome", async () => {
  let retireCalls = 0;
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      retireCalls += 1;
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await controller.register(registration());
  store.mutateNextCompareExchange((next) => ({
    ...next,
    writerOutcome: "failed",
  }));

  await assert.rejects(
    () => controller.requestRetirement(retirementRequest()),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_STALE_WRITE",
  );
  assert.equal(retireCalls, 0);
  assert.equal((await store.load(RUN_ID)).writerOutcome, "failed");
});

test("a proof with a stale fencing token is never accepted", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation, { fencingToken: operation.fencingToken - 1 });
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await controller.register(registration());

  await assert.rejects(
    () => controller.requestRetirementAndWait(retirementRequest()),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
  );
  const record = await store.load(RUN_ID);
  assert.equal(record.state, "retirement_unverified");
  assert.equal(record.completionEligible, false);
});

test("proof backdated before the persisted fenced attempt is never accepted", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      assert.equal(operation.retiringAt, "2026-08-17T15:00:01.000Z");
      return proofFor(operation, { verifiedAt: "2026-08-17T15:00:00.999Z" });
    },
    now: () => "2026-08-17T15:00:01.000Z",
  });
  await controller.register(registration());

  await assert.rejects(
    () => controller.requestRetirementAndWait(retirementRequest()),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
  );
  const record = await store.load(RUN_ID);
  assert.equal(record.state, "retirement_unverified");
  assert.equal(record.completionEligible, false);
  assert.equal(record.retiredAt, null);
});

test("proof produced after its deadline cannot finalize a completed run", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation, { verifiedAt: "2026-08-17T15:09:00.001Z" });
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await controller.register(registration());

  await assert.rejects(
    () => controller.requestRetirementAndWait(retirementRequest()),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
  );
  const record = await store.load(RUN_ID);
  assert.equal(record.state, "retirement_unverified");
  assert.equal(record.writerOutcome, "completed");
  assert.equal(record.completionEligible, false);
  assert.equal(record.retiredAt, null);
});

test("abandoned runs retire authority but cannot become completion-eligible", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await controller.register(registration());
  const retired = await controller.requestRetirementAndWait(retirementRequest({
    writerOutcome: "abandoned-or-unknown",
  }));

  assert.equal(retired.state, "retired");
  assert.equal(retired.writerOutcome, "abandoned-or-unknown");
  assert.equal(retired.completionEligible, false);
  assert.equal(retired.retirementDescriptorIdentitySha256, SHA_B);
  assert.equal("retirementDescriptorReference" in retired, false);
});

test("retired state is immutable and rejects conflicting finalization", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  await controller.register(registration());
  const retired = await controller.requestRetirementAndWait(retirementRequest());
  const terminalRecord = clone(await store.load(RUN_ID));
  assert.equal(retired.completionEligible, true);

  await assert.rejects(
    () => controller.requestRetirement(retirementRequest({ writerOutcome: "failed" })),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_TERMINAL",
  );
  await assert.rejects(
    () => controller.register(registration({ bindingDigestSha256: SHA_B })),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
  );
  assert.deepEqual(await store.load(RUN_ID), terminalRecord);
});

test("source-only reconciler cannot mint AWS evidence levels", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });

  await assert.rejects(
    () => controller.register(registration({
      writerControlEvidenceLevel:
        RECOVERY_WRITER_CONTROL_EVIDENCE_LEVELS.LIVE_AWS_CONTROL_AND_DATA_PLANE,
    })),
    (error) => error.code === "RECOVERY_WRITER_RETIREMENT_EVIDENCE_LEVEL_INVALID",
  );
  assert.deepEqual(store.calls, []);
});

test("private descriptor and temporal contracts reject unsafe registrations before I/O", async () => {
  const store = createMemoryStore();
  const controller = createRecoveryWriterRetirementController({
    store,
    async retireAndVerify(operation) {
      return proofFor(operation);
    },
    now: () => "2026-08-17T15:00:00.000Z",
  });
  const invalidRegistrations = [
    registration({ retirementDescriptorReference: "" }),
    registration({ retirementDescriptorReference: `${DESCRIPTOR_REFERENCE}\nunsafe` }),
    registration({ retirementDescriptorReference: "x".repeat(2_049) }),
    registration({ retirementDescriptorIdentitySha256: undefined }),
    registration({ retirementProofDeadlineAt: "2026-08-17T15:05:00.000Z" }),
    registration({ writerSessionExpiresAt: "2026-08-17T15:09:00.000Z" }),
  ];

  for (const invalid of invalidRegistrations) {
    await assert.rejects(
      () => controller.register(invalid),
      (error) => error.code === "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
    );
  }
  assert.deepEqual(store.calls, []);
});
