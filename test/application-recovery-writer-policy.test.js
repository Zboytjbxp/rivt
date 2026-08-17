import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  MAX_EXACT_RECOVERY_WRITER_OBJECTS,
  MAX_EXACT_RECOVERY_WRITER_POLICY_BYTES,
  RecoveryWriterPolicyError,
  renderExactRecoveryWriterPolicy,
} from "../scripts/application-recovery-writer-policy.js";

const snapshotId = `set-${"a".repeat(48)}`;
const databaseKey = `snapshots/${snapshotId}/database.json.gz.aes256gcm`;
const archiveKey = `snapshots/${snapshotId}/application-objects.bin.aes256gcm`;
const completionKey = `snapshots/${snapshotId}/complete.json`;

const baseInput = Object.freeze({
  bucket: "rivt-recovery-evidence",
  basePrefix: "one-shot/application-objects",
  snapshotId,
  objectKeys: [databaseKey, archiveKey, completionKey],
  writeWindow: {
    startAt: "2026-08-16T12:00:00.000Z",
    endAt: "2026-08-16T12:30:00.000Z",
  },
});

function render(changes = {}) {
  return renderExactRecoveryWriterPolicy({
    ...baseInput,
    ...changes,
  });
}

function errorCode(expectedCode) {
  return (error) => {
    assert.equal(error instanceof RecoveryWriterPolicyError, true);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function statementFor(result, effect, action) {
  return result.policy.Statement.find(
    (statement) => statement.Effect === effect && statement.Action === action,
  );
}

test("renderer emits a deterministic exact-key create-only writer policy", () => {
  const result = render({
    objectKeys: [completionKey, archiveKey, databaseKey],
  });
  const expectedKeys = [archiveKey, completionKey, databaseKey];
  const expectedResources = expectedKeys.map(
    (key) => `arn:aws:s3:::${baseInput.bucket}/${baseInput.basePrefix}/${key}`,
  );

  assert.deepEqual(result.objectKeys, expectedKeys);
  assert.deepEqual(result.physicalKeys, expectedKeys.map(
    (key) => `${baseInput.basePrefix}/${key}`,
  ));
  assert.deepEqual(result.resourceArns, expectedResources);
  assert.equal(result.protectedObjectCount, 3);
  assert.equal(result.policyBytes, Buffer.byteLength(result.policyJson, "utf8"));
  assert.equal(
    result.policySha256,
    crypto.createHash("sha256").update(result.policyJson, "utf8").digest("hex"),
  );
  assert.match(result.exactKeySetSha256, /^[a-f0-9]{64}$/u);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.policy), true);

  const put = statementFor(result, "Allow", "s3:PutObject");
  assert.deepEqual(put.Resource, expectedResources);
  assert.deepEqual(put.Condition, {
    DateGreaterThanEquals: { "aws:CurrentTime": baseInput.writeWindow.startAt },
    DateLessThan: { "aws:CurrentTime": baseInput.writeWindow.endAt },
    StringEquals: { "s3:if-none-match": "*" },
  });
  const multipartDeny = statementFor(result, "Deny", "s3:PutObject");
  assert.deepEqual(multipartDeny.Resource, expectedResources);
  assert.deepEqual(multipartDeny.Condition, {
    Bool: { "s3:ObjectCreationOperation": "false" },
  });
  const retention = statementFor(result, "Allow", "s3:GetObjectRetention");
  assert.deepEqual(retention.Resource, expectedResources);
  assert.deepEqual(retention.Condition, {
    DateGreaterThanEquals: { "aws:CurrentTime": baseInput.writeWindow.startAt },
    DateLessThan: { "aws:CurrentTime": baseInput.writeWindow.endAt },
  });

  assert.equal(result.resourceArns.some((resource) => resource.includes("*")), false);
  assert.equal(result.policyJson.includes("?"), false);
  assert.equal(result.policyJson.includes("${"), false);
  assert.equal(result.policyJson.includes("s3:GetObject\""), false);
  assert.equal(result.policyJson.includes("s3:List"), false);
  assert.equal(result.policyJson.includes("s3:Delete"), false);
});

test("input order cannot change the rendered policy or its attestation", () => {
  const left = render({
    objectKeys: [databaseKey, archiveKey, completionKey],
  });
  const right = render({
    objectKeys: [completionKey, databaseKey, archiveKey],
  });

  assert.equal(left.policyJson, right.policyJson);
  assert.equal(left.policySha256, right.policySha256);
  assert.equal(left.exactKeySetSha256, right.exactKeySetSha256);
});

test("renderer rejects a prefix wildcard or policy-variable expansion", () => {
  for (const basePrefix of [
    "one-shot/*",
    "one-shot/recovery?",
    "one-shot/${aws:username}",
  ]) {
    assert.throws(
      () => render({ basePrefix }),
      errorCode("RECOVERY_WRITER_POLICY_INVALID"),
    );
  }
});

test("renderer rejects keys outside the exact snapshot layout", () => {
  const invalidKeySets = [
    [databaseKey, archiveKey, archiveKey],
    [databaseKey, archiveKey],
    [completionKey, archiveKey],
    [databaseKey, completionKey, `snapshots/${snapshotId}/objects/*`],
    [databaseKey, completionKey, `snapshots/set-${"d".repeat(48)}/application-objects.bin.aes256gcm`],
    [databaseKey, completionKey, `snapshots/${snapshotId}/arbitrary/application-objects.bin`],
  ];

  for (const objectKeys of invalidKeySets) {
    assert.throws(
      () => render({ objectKeys }),
      errorCode("RECOVERY_WRITER_POLICY_INVALID"),
    );
  }
});

test("renderer accepts only the recovery core's set-plus-48-hex snapshot ID", () => {
  for (const invalidSnapshotId of [
    "a".repeat(64),
    `set-${"a".repeat(47)}`,
    `set-${"a".repeat(49)}`,
    `set-${"A".repeat(48)}`,
    `other-${"a".repeat(48)}`,
  ]) {
    assert.throws(
      () => render({ snapshotId: invalidSnapshotId }),
      errorCode("RECOVERY_WRITER_POLICY_INVALID"),
    );
  }
});

test("fixed object-count ceiling fails before rendering an oversized policy", () => {
  const objectKeys = [databaseKey, archiveKey, completionKey, `${completionKey}.extra`];
  assert.equal(objectKeys.length, MAX_EXACT_RECOVERY_WRITER_OBJECTS + 1);

  assert.throws(
    () => render({ objectKeys }),
    errorCode("RECOVERY_WRITER_POLICY_OBJECT_LIMIT"),
  );
});

test("the reviewed object-count ceiling is representable at the policy-byte ceiling", () => {
  const objectKeys = [databaseKey, archiveKey, completionKey];
  const result = render({
    bucket: "abc",
    basePrefix: "x",
    objectKeys,
  });

  assert.equal(result.protectedObjectCount, MAX_EXACT_RECOVERY_WRITER_OBJECTS);
  assert.equal(result.policyBytes <= MAX_EXACT_RECOVERY_WRITER_POLICY_BYTES, true);
});

test("fixed policy-byte ceiling fails closed instead of truncating exact keys", () => {
  assert.throws(
    () => render({ policyByteLimit: 1 }),
    errorCode("RECOVERY_WRITER_POLICY_SIZE_LIMIT"),
  );
  const result = render();
  assert.equal(result.policyBytes <= MAX_EXACT_RECOVERY_WRITER_POLICY_BYTES, true);
  assert.equal(result.resourceArns.length, result.objectKeys.length);
});

test("callers may tighten but cannot raise reviewed source limits", () => {
  assert.throws(
    () => render({ objectCountLimit: MAX_EXACT_RECOVERY_WRITER_OBJECTS + 1 }),
    errorCode("RECOVERY_WRITER_POLICY_LIMIT_INVALID"),
  );
  assert.throws(
    () => render({ policyByteLimit: MAX_EXACT_RECOVERY_WRITER_POLICY_BYTES + 1 }),
    errorCode("RECOVERY_WRITER_POLICY_LIMIT_INVALID"),
  );
  assert.throws(
    () => render({ objectCountLimit: 2 }),
    errorCode("RECOVERY_WRITER_POLICY_OBJECT_LIMIT"),
  );
});

test("writer window and AWS bucket coordinates are canonical and bounded", () => {
  for (const changes of [
    { bucket: "RIVT-Recovery" },
    { bucket: "192.168.1.1" },
    { bucket: "rivt..recovery" },
    { writeWindow: { startAt: "2026-08-16T12:00:00Z", endAt: baseInput.writeWindow.endAt } },
    { writeWindow: { startAt: baseInput.writeWindow.startAt, endAt: baseInput.writeWindow.startAt } },
    {
      writeWindow: {
        startAt: baseInput.writeWindow.startAt,
        endAt: "2026-08-16T13:00:00.001Z",
      },
    },
  ]) {
    assert.throws(
      () => render(changes),
      errorCode("RECOVERY_WRITER_POLICY_INVALID"),
    );
  }
});
