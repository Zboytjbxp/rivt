import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRecoveryWriterAuthorizationLease,
  createRecoveryWriterAuthorizationLease,
} from "../scripts/recovery-writer-authorization.js";

test("writer lease performs no work until explicit activation", async () => {
  const events = [];
  const lease = createRecoveryWriterAuthorizationLease({
    async activate(context) {
      events.push(["activate", context.plan]);
      return { authorized: true };
    },
    async revokeAndVerify(context) {
      events.push(["revoke", context.activationOutcome]);
      return { revoked: true };
    },
  });

  assert.deepEqual(events, []);
  assert.equal(lease.phase, "prepared");
  assert.equal(assertRecoveryWriterAuthorizationLease(lease), lease);
  assert.deepEqual(await lease.activate({ plan: "exact" }), { authorized: true });
  assert.equal(lease.phase, "active");
  assert.deepEqual(await lease.revokeAndVerify({ reason: "complete" }), { revoked: true });
  assert.equal(lease.phase, "revoked");
  assert.deepEqual(events, [
    ["activate", "exact"],
    ["revoke", "active"],
  ]);
});

test("writer lease retains a revoker when activation becomes ambiguous", async () => {
  const events = [];
  const activationError = new Error("provider response lost after installation");
  const lease = createRecoveryWriterAuthorizationLease({
    async activate() {
      events.push("activation-attempted");
      throw activationError;
    },
    async revokeAndVerify({ authorizationReceipt, activationOutcome }) {
      events.push(["revoked", authorizationReceipt, activationOutcome]);
      return { revoked: true };
    },
  });

  await assert.rejects(() => lease.activate({}), (error) => error === activationError);
  assert.equal(lease.phase, "activation_ambiguous");
  assert.deepEqual(await lease.revokeAndVerify({ reason: "failed" }), { revoked: true });
  assert.equal(lease.phase, "revoked");
  assert.deepEqual(events, [
    "activation-attempted",
    ["revoked", undefined, "activation_ambiguous"],
  ]);
});

test("writer lease revocation is idempotent across concurrent callers", async () => {
  let revocations = 0;
  const lease = createRecoveryWriterAuthorizationLease({
    async activate() {
      return { authorized: true };
    },
    async revokeAndVerify() {
      revocations += 1;
      return { revoked: true };
    },
  });
  await lease.activate({});
  const receipts = await Promise.all([
    lease.revokeAndVerify({ reason: "first" }),
    lease.revokeAndVerify({ reason: "second" }),
    lease.revokeAndVerify({ reason: "third" }),
  ]);
  assert.equal(revocations, 1);
  assert.deepEqual(receipts, [
    { revoked: true },
    { revoked: true },
    { revoked: true },
  ]);
});

test("unverified revocation fails closed and is attempted only once", async () => {
  let revocations = 0;
  const lease = createRecoveryWriterAuthorizationLease({
    async activate() {
      return { authorized: true };
    },
    async revokeAndVerify() {
      revocations += 1;
      throw new Error("provider readback unavailable");
    },
  });
  await lease.activate({});
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      () => lease.revokeAndVerify({}),
      (error) => error.code === "RECOVERY_WRITER_REVOCATION_UNVERIFIED",
    );
  }
  assert.equal(revocations, 1);
  assert.equal(lease.phase, "revocation_unverified");
});

test("writer lease rejects invalid shapes and repeated activation", async () => {
  assert.throws(
    () => createRecoveryWriterAuthorizationLease({}),
    (error) => error.code === "RECOVERY_WRITER_AUTHORIZATION_INVALID",
  );
  assert.throws(
    () => assertRecoveryWriterAuthorizationLease({ activate() {} }),
    (error) => error.code === "RECOVERY_WRITER_AUTHORIZATION_INVALID",
  );
  assert.throws(
    () => assertRecoveryWriterAuthorizationLease({
      async activate() {},
      async revokeAndVerify() {},
    }),
    (error) => error.code === "RECOVERY_WRITER_AUTHORIZATION_INVALID",
  );
  const lease = createRecoveryWriterAuthorizationLease({
    async activate() { return { authorized: true }; },
    async revokeAndVerify() { return { revoked: true }; },
  });
  await lease.activate({});
  await assert.rejects(
    () => lease.activate({}),
    (error) => error.code === "RECOVERY_WRITER_AUTHORIZATION_INVALID",
  );
});
