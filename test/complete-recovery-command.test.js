import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMPLETE_RECOVERY_LIMITS,
  createRestrictedRecoveryEvidenceSink,
  defaultRuntimeSourceProbe,
  exactRecoveryReference,
  recoveryRuntimeSourceIdentitySha256,
} from "../scripts/complete-recovery-command-utils.js";
import {
  createCompleteRecoverySet,
  runCreateCompleteRecoverySetCli,
} from "../scripts/create-complete-recovery-set.js";
import {
  restoreCompleteRecoverySet,
  runRestoreCompleteRecoverySetCli,
} from "../scripts/restore-complete-recovery-set.js";
import {
  APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE,
  buildDatabaseRecoveryBinding,
  recoveryDatabaseEncryptionSecret,
} from "../scripts/recovery-object-utils.js";
import {
  recoveryS3CoordinateIdentitySha256,
} from "../scripts/recovery-s3-store.js";
import {
  decryptSnapshot,
  snapshotTableDigests,
} from "../scripts/logical-backup-utils.js";
import {
  encryptCompleteRecoveryDatabaseSnapshot,
} from "../scripts/complete-recovery-database.js";

const nowValue = new Date("2026-08-16T20:00:00.000Z");
const retentionUntil = "2026-09-15T20:00:00.000Z";
const sourceCommit = "a".repeat(40);
const activeKey = "11".repeat(32);
const sourceRuntimeIdentitySha256 = "9".repeat(64);
const protectedRetentionReceipt = Object.freeze({
  completionRetentionMode: "COMPLIANCE",
  completionRetentionUntil: retentionUntil,
  databaseArtifactRetentionMode: "COMPLIANCE",
  databaseArtifactRetentionUntil: retentionUntil,
  archiveRetentionMode: "COMPLIANCE",
  archiveRetentionUntil: retentionUntil,
});

test("restore references preserve exact opaque provider version IDs", () => {
  const env = restoreEnv();
  env.COMPLETE_RECOVERY_COMPLETION_VERSION_ID = " version-id ";
  const reference = exactRecoveryReference(env);
  assert.equal(reference.completionVersionId, " version-id ");
  assert.equal(reference.completionRetentionMode, "COMPLIANCE");
  assert.equal(reference.completionRetentionUntil, retentionUntil);
});

const coordinates = Object.freeze({
  source: Object.freeze({
    endpoint: "https://source.example.test",
    region: "us-east-1",
    bucket: "application-private",
    basePrefix: "",
  }),
  destination: Object.freeze({
    endpoint: "https://destination.example.test",
    region: "us-east-1",
    bucket: "recovery-protected",
    basePrefix: "complete/one-shot",
  }),
  restore: Object.freeze({
    endpoint: "https://restore.example.test",
    region: "us-east-1",
    bucket: "recovery-isolated",
    basePrefix: "temporary/proof",
  }),
});

function coordinateEnv(role, value) {
  const namespace = `COMPLETE_RECOVERY_${role.toUpperCase()}_S3`;
  return {
    [`${namespace}_ENDPOINT`]: value.endpoint,
    [`${namespace}_REGION`]: value.region,
    [`${namespace}_BUCKET`]: value.bucket,
    [`${namespace}_PREFIX`]: value.basePrefix,
    [`${namespace}_FORCE_PATH_STYLE`]: String(value.forcePathStyle ?? false),
    [`${namespace}_COORDINATE_SHA256`]: recoveryS3CoordinateIdentitySha256(
      value,
      { allowEmptyPrefix: role === "source" },
    ),
  };
}

function commonEnv() {
  return {
    COMPLETE_RECOVERY_EXECUTION_MODE: "one-shot",
    CONFIRM_COMPLETE_RECOVERY_PROVIDER_IO: "true",
    CONFIRM_COMPLETE_RECOVERY_PRODUCTION_DATA_READ: "true",
    CONFIRM_COMPLETE_RECOVERY_CHARGE_BEARING_ACTION: "true",
    SOURCE_COMMIT: sourceCommit,
    RAILWAY_GIT_COMMIT_SHA: sourceCommit,
    RAILWAY_PROJECT_ID: "project-test",
    RAILWAY_ENVIRONMENT_ID: "environment-test",
    RAILWAY_SERVICE_ID: "service-test",
    RAILWAY_DEPLOYMENT_ID: "deployment-test",
    COMPLETE_RECOVERY_RUNTIME_SOURCE_COMMIT: sourceCommit,
    COMPLETE_RECOVERY_REVIEWED_RUNTIME_SHA256: recoveryRuntimeSourceIdentitySha256(),
    BACKUP_ENCRYPTION_KEY: activeKey,
    COMPLETE_RECOVERY_MINIMUM_RETENTION_UNTIL: retentionUntil,
    ...coordinateEnv("source", coordinates.source),
    ...coordinateEnv("destination", coordinates.destination),
    ...coordinateEnv("restore", coordinates.restore),
    COMPLETE_RECOVERY_SOURCE_S3_ACCESS_KEY_ID: "source-reader-id",
    COMPLETE_RECOVERY_DESTINATION_S3_ACCESS_KEY_ID: "protected-writer-id",
    COMPLETE_RECOVERY_READER_S3_ACCESS_KEY_ID: "exact-reader-id",
    COMPLETE_RECOVERY_RESTORE_S3_ACCESS_KEY_ID: "isolated-writer-id",
    COMPLETE_RECOVERY_SOURCE_PRINCIPAL_IDENTITY_SHA256: "1".repeat(64),
    COMPLETE_RECOVERY_DESTINATION_PRINCIPAL_IDENTITY_SHA256: "2".repeat(64),
    COMPLETE_RECOVERY_READER_PRINCIPAL_IDENTITY_SHA256: "3".repeat(64),
    COMPLETE_RECOVERY_RESTORE_PRINCIPAL_IDENTITY_SHA256: "4".repeat(64),
    COMPLETE_RECOVERY_APPLICATION_STORAGE_PRINCIPAL_IDENTITY_SHA256: "5".repeat(64),
  };
}

function createEnv() {
  return {
    ...commonEnv(),
    CONFIRM_COMPLETE_RECOVERY_CREATE: "true",
    CONFIRM_COMPLETE_RECOVERY_SOURCE_READ_ONLY: "true",
    CONFIRM_COMPLETE_RECOVERY_IMMUTABLE_WRITES: "true",
    COMPLETE_RECOVERY_WRITE_WINDOW_START_AT: "2026-08-16T19:55:00.000Z",
    COMPLETE_RECOVERY_WRITE_WINDOW_END_AT: "2026-08-16T20:30:00.000Z",
    BACKUP_DATABASE_URL: "postgresql://reader:secret@source-db.example.test/rivt",
    DATABASE_URL: "postgresql://application:secret@source-db.example.test/rivt",
    COMPLETE_RECOVERY_SOURCE_S3_SECRET_ACCESS_KEY: "source-reader-secret",
    COMPLETE_RECOVERY_DESTINATION_S3_SECRET_ACCESS_KEY: "protected-writer-secret",
  };
}

function restoreEnv() {
  return {
    ...commonEnv(),
    CONFIRM_COMPLETE_RECOVERY_RESTORE: "true",
    CONFIRM_COMPLETE_RECOVERY_TARGETS_ISOLATED: "true",
    CONFIRM_RESTORE_TARGET_ISOLATED: "true",
    CONFIRM_COMPLETE_RECOVERY_TEMPORARY_DATA_DELETION: "true",
    BACKUP_DATABASE_URL: "postgresql://reader:secret@source-db.example.test/rivt",
    DATABASE_URL: "postgresql://production:secret@production-db.example.test/rivt",
    RESTORE_DATABASE_URL: "postgresql://restore:secret@restore-db.example.test/rivt_restore",
    COMPLETE_RECOVERY_SET_ID: `set-${"b".repeat(48)}`,
    COMPLETE_RECOVERY_COMPLETION_VERSION_ID: "exact-version-17",
    COMPLETE_RECOVERY_COMPLETION_SHA256: "c".repeat(64),
    COMPLETE_RECOVERY_COMPLETION_RETENTION_MODE: "COMPLIANCE",
    COMPLETE_RECOVERY_COMPLETION_RETENTION_UNTIL: retentionUntil,
    COMPLETE_RECOVERY_READER_S3_SECRET_ACCESS_KEY: "exact-reader-secret",
    COMPLETE_RECOVERY_RESTORE_S3_SECRET_ACCESS_KEY: "isolated-writer-secret",
  };
}

function databaseSnapshot() {
  const columns = [
    { name: "id", typeName: "text", identityGeneration: null },
    { name: "session_id", typeName: "text", identityGeneration: null },
    { name: "account_id", typeName: "text", identityGeneration: null },
    { name: "object_key", typeName: "text", identityGeneration: null },
    { name: "mime_type", typeName: "text", identityGeneration: null },
    { name: "size_bytes", typeName: "integer", identityGeneration: null },
    { name: "upload_status", typeName: "text", identityGeneration: null },
    { name: "content_sha256", typeName: "text", identityGeneration: null },
    { name: "storage_scope", typeName: "text", identityGeneration: null },
  ];
  const rows = [{
    id: "00000000-0000-4000-8000-000000000001",
    session_id: "10000000-0000-4000-8000-000000000001",
    account_id: "10000000-0000-4000-8000-000000000001",
    object_key: "project/photo.bin",
    mime_type: "application/octet-stream",
    size_bytes: "3",
    upload_status: "stored",
    content_sha256: crypto.createHash("sha256").update("abc").digest("hex"),
    storage_scope: "project",
  }];
  const tables = [{ name: "uploads", columns, rows }];
  return {
    format: "rivt-logical-backup-v2",
    rowEncoding: "postgres-text-v1",
    createdAt: nowValue.toISOString(),
    sourceCommit,
    manifest: {
      format: "rivt-logical-backup-manifest-v2",
      rowEncoding: "postgres-text-v1",
      createdAt: nowValue.toISOString(),
      sourceCommit,
      tableCount: 1,
      rowCount: 1,
      counts: { uploads: 1 },
      tableDigests: snapshotTableDigests(tables),
    },
    sequences: [],
    tables,
  };
}

function emptyDatabaseSnapshot() {
  const snapshot = databaseSnapshot();
  const tables = snapshot.tables.map((table) => ({ ...table, rows: [] }));
  return {
    ...snapshot,
    manifest: {
      ...snapshot.manifest,
      rowCount: 0,
      counts: { uploads: 0 },
      tableDigests: snapshotTableDigests(tables),
    },
    tables,
  };
}

function fakeClientFactory(lifecycle) {
  return ({ role, coordinates: roleCoordinates, credentials }) => {
    lifecycle.push(`client:${role}`);
    assert.equal(typeof credentials.secretAccessKey, "string");
    assert.equal(roleCoordinates.endpoint.startsWith("https://"), true);
    return {
      destroy() { lifecycle.push(`destroy:${role}`); },
    };
  };
}

function fakeEvidenceSinkFactory(lifecycle = [], receipts = []) {
  return async () => {
    lifecycle.push("evidence:opened");
    return {
      async plan(receipt) {
        receipts.push({ plan: receipt });
        lifecycle.push("evidence:planned");
      },
      async markWritesStarted() {
        lifecycle.push("evidence:writes-started");
      },
      async commit(receipt) {
        receipts.push(receipt);
        lifecycle.push("evidence:committed");
      },
      async abort() {
        lifecycle.push("evidence:aborted");
      },
    };
  };
}

function fakeCaptureBarrierFactory(lifecycle = []) {
  return async () => {
    lifecycle.push("barrier:capture-acquired");
    let released = false;
    return {
      sourceRuntimeIdentitySha256,
      applicationRuntimeIdentitySha256: sourceRuntimeIdentitySha256,
      async release() {
        if (released) return;
        released = true;
        lifecycle.push("barrier:capture-released");
      },
    };
  };
}

function protectedWritePlan(input) {
  return {
    snapshotId: input.snapshotId,
    objectKeys: [
      `snapshots/${input.snapshotId}/database.json.gz.aes256gcm`,
      `snapshots/${input.snapshotId}/application-objects.bin.aes256gcm`,
      `snapshots/${input.snapshotId}/complete.json`,
    ],
    restoreObjectKeys: ["project/restored-db.bin"],
  };
}

async function authorizeExactWriter({
  policyPlan,
  destinationStoreIdentitySha256,
  writerPrincipalIdentitySha256,
}) {
  return {
    authorized: true,
    authorizationMode: "provider-exact-key-policy",
    writerInitiallyInert: true,
    multipartInitiationDenied: true,
    noPreexistingMultipartUploadsVerified: true,
    policySha256: policyPlan.policySha256,
    exactKeySetSha256: policyPlan.exactKeySetSha256,
    destinationStoreIdentitySha256,
    writerPrincipalIdentitySha256,
    authorizedAt: nowValue.toISOString(),
    expiresAt: createEnv().COMPLETE_RECOVERY_WRITE_WINDOW_END_AT,
  };
}

function restrictedWriterAuthorization() {
  return {
    writerPolicySha256: "6".repeat(64),
    writerExactKeySetSha256: "7".repeat(64),
    writerAuthorizationIdentitySha256: "2".repeat(64),
    writerAuthorizationAt: nowValue.toISOString(),
    writerAuthorizationExpiresAt: createEnv().COMPLETE_RECOVERY_WRITE_WINDOW_END_AT,
    multipartInitiationDenied: true,
    noPreexistingMultipartUploadsVerified: true,
  };
}

test("create command binds one exact database snapshot and fixed limits before one provider-neutral write", async () => {
  const env = createEnv();
  const snapshot = databaseSnapshot();
  const lifecycle = [];
  const clockValues = [1_000, 1_017];
  const restrictedReceipts = [];
  let backupArguments;
  const result = await createCompleteRecoverySet({
    env,
    now: () => new Date(nowValue),
    clock: () => clockValues.shift(),
    clientFactory: fakeClientFactory(lifecycle),
    restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle, restrictedReceipts),
    captureBarrierFactory: fakeCaptureBarrierFactory(lifecycle),
    authorizeProtectedWrites: authorizeExactWriter,
    captureDatabaseSnapshot: async ({ env: suppliedEnv, expectedSourceRuntimeIdentitySha256 }) => {
      lifecycle.push("capture:database");
      assert.equal(suppliedEnv, env);
      assert.equal(expectedSourceRuntimeIdentitySha256, sourceRuntimeIdentitySha256);
      return snapshot;
    },
    sourceStoreFactory: ({ binding, sourceBindingIdentitySha256, limits }) => ({
      identitySha256: binding.identitySha256,
      bindingIdentitySha256: sourceBindingIdentitySha256,
      limits,
      openRead() {},
      listInventory() {},
    }),
    destinationStoreFactory: ({ binding, minimumRetentionUntil }) => ({
      identitySha256: binding.identitySha256,
      minimumRetentionUntil,
      atomicPut: true,
      put() {},
    }),
    backupSnapshot: async (input) => {
      lifecycle.push("backup:one-shot");
      backupArguments = input;
      await input.beforeProtectedWrites(protectedWritePlan(input));
      assert.equal(input.relationalManifest.snapshotAt, snapshot.createdAt);
      assert.equal(input.relationalManifest.objectCount, 1);
      assert.equal(input.databaseBinding.sourceCommit, sourceCommit);
      assert.deepEqual(
        decryptSnapshot(
          JSON.parse(input.databaseArtifact.toString("utf8")),
          recoveryDatabaseEncryptionSecret(activeKey, input.databaseBinding),
        ),
        snapshot,
      );
      assert.deepEqual(input.limits, {
        maxObjects: COMPLETE_RECOVERY_LIMITS.maxObjects,
        maxObjectBytes: COMPLETE_RECOVERY_LIMITS.maxObjectBytes,
        maxTotalBytes: COMPLETE_RECOVERY_LIMITS.maxTotalBytes,
        concurrency: COMPLETE_RECOVERY_LIMITS.concurrency,
      });
      assert.equal(input.maxReadAttempts, COMPLETE_RECOVERY_LIMITS.maxReadAttempts);
      return {
        ok: true,
        mode: "provider-neutral-complete-set",
        recoverySetIdentitySha256: "d".repeat(64),
        sourceCommit,
        snapshotId: input.snapshotId,
        objectCount: 1,
        totalPlaintextBytes: 3,
        completionWritten: true,
        completionKey: `snapshots/${input.snapshotId}/complete.json`,
        completionVersionId: "restricted-version",
        completionSha256: "e".repeat(64),
        databaseArtifactVersionId: "database-version",
        databaseArtifactSha256: "a".repeat(64),
        archiveVersionId: "archive-version",
        archiveSha256: "b".repeat(64),
        ...protectedRetentionReceipt,
        reconciliation: {
          storedReferencesMissing: 0,
          declaredSizeMismatches: 0,
          declaredHashMismatches: 0,
          providerOnlyObjects: 0,
          removedObjectsStillPresent: 0,
          unresolvedObjects: 0,
        },
        durationMs: 17,
      };
    },
  });

  assert.equal(result.mode, "create-complete-recovery-set");
  assert.equal(result.completionWritten, true);
  assert.equal(result.restrictedEvidenceRecorded, true);
  assert.equal(result.durationMs, 17);
  assert.equal(backupArguments.minimumRetentionUntil, retentionUntil);
  assert.equal(restrictedReceipts.length, 2);
  assert.equal(restrictedReceipts[1].completionVersionId, "restricted-version");
  assert.ok(lifecycle.indexOf("evidence:opened") < lifecycle.indexOf("barrier:capture-acquired"));
  assert.ok(lifecycle.indexOf("barrier:capture-acquired") < lifecycle.indexOf("capture:database"));
  assert.ok(lifecycle.indexOf("capture:database") < lifecycle.indexOf("client:source-reader"));
  assert.ok(lifecycle.indexOf("evidence:planned") < lifecycle.indexOf("client:source-reader"));
  assert.ok(lifecycle.indexOf("barrier:capture-released") < lifecycle.indexOf("evidence:writes-started"));
  assert.ok(lifecycle.indexOf("evidence:writes-started") < lifecycle.indexOf("evidence:committed"));
  assert.deepEqual(lifecycle.slice(-2), [
    "destroy:source-reader",
    "destroy:protected-writer",
  ]);
});

test("create samples its write boundary after advancing provider authorization", async () => {
  const lifecycle = [];
  const authorizedAt = "2026-08-16T20:00:01.000Z";
  const nowValues = [
    new Date("2026-08-16T20:00:00.000Z"),
    new Date("2026-08-16T20:00:00.000Z"),
    new Date("2026-08-16T20:00:02.000Z"),
  ];
  let protectedWrites = 0;
  const result = await createCompleteRecoverySet({
    env: createEnv(),
    now: () => nowValues.shift(),
    clock: (() => {
      const values = [1_000, 1_010];
      return () => values.shift();
    })(),
    clientFactory: fakeClientFactory(lifecycle),
    restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
    captureBarrierFactory: fakeCaptureBarrierFactory(lifecycle),
    captureDatabaseSnapshot: async () => databaseSnapshot(),
    sourceStoreFactory: ({ binding, sourceBindingIdentitySha256 }) => ({
      identitySha256: binding.identitySha256,
      bindingIdentitySha256: sourceBindingIdentitySha256,
    }),
    destinationStoreFactory: ({ binding }) => ({ identitySha256: binding.identitySha256 }),
    authorizeProtectedWrites: async ({
      policyPlan,
      destinationStoreIdentitySha256,
      writerPrincipalIdentitySha256,
    }) => ({
      authorized: true,
      authorizationMode: "provider-exact-key-policy",
      writerInitiallyInert: true,
      multipartInitiationDenied: true,
      noPreexistingMultipartUploadsVerified: true,
      policySha256: policyPlan.policySha256,
      exactKeySetSha256: policyPlan.exactKeySetSha256,
      destinationStoreIdentitySha256,
      writerPrincipalIdentitySha256,
      authorizedAt,
      expiresAt: createEnv().COMPLETE_RECOVERY_WRITE_WINDOW_END_AT,
    }),
    backupSnapshot: async (input) => {
      await input.beforeProtectedWrites(protectedWritePlan(input));
      protectedWrites += 1;
      return {
        ok: true,
        completionWritten: true,
        sourceCommit,
        snapshotId: input.snapshotId,
        completionKey: `snapshots/${input.snapshotId}/complete.json`,
        completionVersionId: "exact-version",
        completionSha256: "e".repeat(64),
        databaseArtifactVersionId: "database-version",
        databaseArtifactSha256: "a".repeat(64),
        archiveVersionId: "archive-version",
        archiveSha256: "b".repeat(64),
        ...protectedRetentionReceipt,
        recoverySetIdentitySha256: "d".repeat(64),
      };
    },
  });

  assert.equal(protectedWrites, 1);
  assert.equal(result.writerAuthorizationAt, authorizedAt);
  assert.ok(lifecycle.indexOf("barrier:capture-released") < lifecycle.indexOf("evidence:writes-started"));
});

test("create enforces the fixed aggregate RTO", async () => {
  const env = createEnv();
  const times = [0, COMPLETE_RECOVERY_LIMITS.rtoMinutes * 60_000 + 1];
  const lifecycle = [];
  await assert.rejects(
    () => createCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clock: () => times.shift(),
      clientFactory: () => ({ destroy() {} }),
      restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
      captureBarrierFactory: fakeCaptureBarrierFactory(lifecycle),
      authorizeProtectedWrites: authorizeExactWriter,
      captureDatabaseSnapshot: async () => databaseSnapshot(),
      sourceStoreFactory: ({ binding, sourceBindingIdentitySha256 }) => ({
        identitySha256: binding.identitySha256,
        bindingIdentitySha256: sourceBindingIdentitySha256,
      }),
      destinationStoreFactory: ({ binding }) => ({
        identitySha256: binding.identitySha256,
      }),
      backupSnapshot: async (input) => {
        await input.beforeProtectedWrites(protectedWritePlan(input));
        return {
          ok: true,
          completionWritten: true,
          sourceCommit,
          snapshotId: input.snapshotId,
          completionKey: `snapshots/${input.snapshotId}/complete.json`,
          completionVersionId: "exact-version",
          completionSha256: "e".repeat(64),
          databaseArtifactVersionId: "database-version",
          databaseArtifactSha256: "a".repeat(64),
          archiveVersionId: "archive-version",
          archiveSha256: "b".repeat(64),
          ...protectedRetentionReceipt,
          recoverySetIdentitySha256: "d".repeat(64),
        };
      },
    }),
    (error) => error.code === "RECOVERY_RTO_EXCEEDED",
  );
  assert.ok(lifecycle.includes("evidence:committed"));
  assert.equal(lifecycle.includes("evidence:aborted"), false);
});

test("create rechecks the one-hour window immediately before protected writes", async () => {
  const lifecycle = [];
  const nowValues = [
    new Date("2026-08-16T20:00:00.000Z"),
    new Date("2026-08-16T20:30:00.000Z"),
  ];
  await assert.rejects(
    () => createCompleteRecoverySet({
      env: createEnv(),
      now: () => nowValues.shift(),
      clock: () => 1_000,
      restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
      clientFactory: fakeClientFactory(lifecycle),
      captureBarrierFactory: fakeCaptureBarrierFactory(lifecycle),
      captureDatabaseSnapshot: async () => databaseSnapshot(),
      sourceStoreFactory: ({ binding, sourceBindingIdentitySha256 }) => ({
        identitySha256: binding.identitySha256,
        bindingIdentitySha256: sourceBindingIdentitySha256,
      }),
      destinationStoreFactory: ({ binding }) => ({ identitySha256: binding.identitySha256 }),
      backupSnapshot: async (input) => {
        await input.beforeProtectedWrites(protectedWritePlan(input));
        throw new Error("must not pass the closed window");
      },
    }),
    (error) => error.code === "RECOVERY_WRITE_WINDOW_CLOSED",
  );
  assert.ok(lifecycle.includes("evidence:aborted"));
  assert.equal(lifecycle.includes("evidence:committed"), false);
});

test("create refuses protected writes without a trusted exact-key authorization adapter", async () => {
  const lifecycle = [];
  let protectedWrites = 0;
  await assert.rejects(
    () => createCompleteRecoverySet({
      env: createEnv(),
      now: () => new Date(nowValue),
      clock: () => 1_000,
      restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
      clientFactory: fakeClientFactory(lifecycle),
      captureBarrierFactory: fakeCaptureBarrierFactory(lifecycle),
      captureDatabaseSnapshot: async () => databaseSnapshot(),
      sourceStoreFactory: ({ binding, sourceBindingIdentitySha256 }) => ({
        identitySha256: binding.identitySha256,
        bindingIdentitySha256: sourceBindingIdentitySha256,
      }),
      destinationStoreFactory: ({ binding }) => ({ identitySha256: binding.identitySha256 }),
      backupSnapshot: async (input) => {
        await input.beforeProtectedWrites(protectedWritePlan(input));
        protectedWrites += 1;
      },
    }),
    (error) => error.code === "RECOVERY_WRITER_AUTHORIZATION_REQUIRED",
  );
  assert.equal(protectedWrites, 0);
  assert.ok(lifecycle.includes("evidence:aborted"));
  assert.equal(lifecycle.includes("evidence:writes-started"), false);
});

test("create rejects incomplete multipart safety authorization before protected writes", async (t) => {
  for (const field of [
    "multipartInitiationDenied",
    "noPreexistingMultipartUploadsVerified",
  ]) {
    await t.test(field, async () => {
      const lifecycle = [];
      let protectedWrites = 0;
      await assert.rejects(
        () => createCompleteRecoverySet({
          env: createEnv(),
          now: () => new Date(nowValue),
          clock: () => 1_000,
          restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
          clientFactory: fakeClientFactory(lifecycle),
          captureBarrierFactory: fakeCaptureBarrierFactory(lifecycle),
          captureDatabaseSnapshot: async () => databaseSnapshot(),
          sourceStoreFactory: ({ binding, sourceBindingIdentitySha256 }) => ({
            identitySha256: binding.identitySha256,
            bindingIdentitySha256: sourceBindingIdentitySha256,
          }),
          destinationStoreFactory: ({ binding }) => ({ identitySha256: binding.identitySha256 }),
          authorizeProtectedWrites: async (input) => {
            const receipt = await authorizeExactWriter(input);
            delete receipt[field];
            return receipt;
          },
          backupSnapshot: async (input) => {
            await input.beforeProtectedWrites(protectedWritePlan(input));
            protectedWrites += 1;
          },
        }),
        (error) => error.code === "RECOVERY_WRITER_AUTHORIZATION_INVALID",
      );
      assert.equal(protectedWrites, 0);
      assert.ok(lifecycle.includes("evidence:aborted"));
      assert.equal(lifecycle.includes("evidence:writes-started"), false);
    });
  }
});

test("create performs no protected write when the capture lease cannot release safely", async () => {
  const lifecycle = [];
  let protectedWrites = 0;
  await assert.rejects(
    () => createCompleteRecoverySet({
      env: createEnv(),
      now: () => new Date(nowValue),
      clock: () => 1_000,
      restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
      clientFactory: fakeClientFactory(lifecycle),
      captureBarrierFactory: async () => ({
        sourceRuntimeIdentitySha256,
        applicationRuntimeIdentitySha256: sourceRuntimeIdentitySha256,
        async release() {
          lifecycle.push("barrier:capture-release-failed");
          const error = new Error("release failed");
          error.code = "RECOVERY_OBJECT_MUTATION_BARRIER_UNAVAILABLE";
          throw error;
        },
      }),
      captureDatabaseSnapshot: async () => databaseSnapshot(),
      sourceStoreFactory: ({ binding, sourceBindingIdentitySha256 }) => ({
        identitySha256: binding.identitySha256,
        bindingIdentitySha256: sourceBindingIdentitySha256,
      }),
      destinationStoreFactory: ({ binding }) => ({ identitySha256: binding.identitySha256 }),
      authorizeProtectedWrites: authorizeExactWriter,
      backupSnapshot: async (input) => {
        await input.beforeProtectedWrites(protectedWritePlan(input));
        protectedWrites += 1;
      },
    }),
    (error) => error.code === "RECOVERY_OBJECT_MUTATION_BARRIER_UNAVAILABLE",
  );
  assert.equal(protectedWrites, 0);
  assert.ok(lifecycle.includes("barrier:capture-release-failed"));
  assert.ok(lifecycle.includes("evidence:aborted"));
  assert.equal(lifecycle.includes("evidence:writes-started"), false);
});

test("create aborts before snapshot or provider access when an object mutation is active", async () => {
  const lifecycle = [];
  let databaseReads = 0;
  let providerClients = 0;
  await assert.rejects(
    () => createCompleteRecoverySet({
      env: createEnv(),
      now: () => new Date(nowValue),
      restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
      captureBarrierFactory: async () => {
        const error = new Error("busy");
        error.code = "RECOVERY_OBJECT_MUTATION_ACTIVE";
        throw error;
      },
      captureDatabaseSnapshot: async () => {
        databaseReads += 1;
        return databaseSnapshot();
      },
      clientFactory: () => {
        providerClients += 1;
        return {};
      },
    }),
    (error) => error.code === "RECOVERY_OBJECT_MUTATION_ACTIVE",
  );
  assert.equal(databaseReads, 0);
  assert.equal(providerClients, 0);
  assert.deepEqual(lifecycle, ["evidence:opened", "evidence:aborted"]);
});

test("create rejects a different application advisory-lock database before snapshot or provider access", async () => {
  const lifecycle = [];
  let databaseReads = 0;
  let providerClients = 0;
  await assert.rejects(
    () => createCompleteRecoverySet({
      env: createEnv(),
      now: () => new Date(nowValue),
      restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
      captureBarrierFactory: async () => ({
        sourceRuntimeIdentitySha256,
        applicationRuntimeIdentitySha256: "8".repeat(64),
        async release() { lifecycle.push("barrier:capture-released"); },
      }),
      captureDatabaseSnapshot: async () => {
        databaseReads += 1;
        return databaseSnapshot();
      },
      clientFactory: () => {
        providerClients += 1;
        return {};
      },
    }),
    (error) => error.code === "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
  );
  assert.equal(databaseReads, 0);
  assert.equal(providerClients, 0);
  assert.deepEqual(lifecycle, [
    "evidence:opened",
    "barrier:capture-released",
    "evidence:aborted",
  ]);
});

test("create releases the capture lease and opens no provider when snapshot identity differs", async () => {
  const lifecycle = [];
  let providerClients = 0;
  await assert.rejects(
    () => createCompleteRecoverySet({
      env: createEnv(),
      now: () => new Date(nowValue),
      restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(lifecycle),
      captureBarrierFactory: fakeCaptureBarrierFactory(lifecycle),
      captureDatabaseSnapshot: async ({ expectedSourceRuntimeIdentitySha256 }) => {
        assert.equal(expectedSourceRuntimeIdentitySha256, sourceRuntimeIdentitySha256);
        const error = new Error("different backend");
        error.code = "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH";
        throw error;
      },
      clientFactory: () => {
        providerClients += 1;
        return {};
      },
    }),
    (error) => error.code === "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
  );
  assert.equal(providerClients, 0);
  assert.deepEqual(lifecycle, [
    "evidence:opened",
    "barrier:capture-acquired",
    "barrier:capture-released",
    "evidence:aborted",
  ]);
});

test("create preflight rejects authority ambiguity before database or provider access", async (t) => {
  const cases = [
    ["missing confirmation", { CONFIRM_COMPLETE_RECOVERY_CREATE: undefined }, "RECOVERY_CONFIRMATION_REQUIRED"],
    ["runtime revision mismatch", { COMPLETE_RECOVERY_RUNTIME_SOURCE_COMMIT: "f".repeat(40) }, "RECOVERY_SOURCE_REVISION_MISMATCH"],
    ["runtime file identity mismatch", { COMPLETE_RECOVERY_REVIEWED_RUNTIME_SHA256: "0".repeat(64) }, "RECOVERY_SOURCE_REVISION_MISMATCH"],
    ["predecessor key present", { BACKUP_ENCRYPTION_KEY_PREVIOUS: "22".repeat(32) }, "RECOVERY_PREDECESSOR_KEY_FORBIDDEN"],
    ["missing application database", { DATABASE_URL: undefined }, "RECOVERY_COMMAND_CONFIG_INVALID"],
    ["coordinate digest mismatch", { COMPLETE_RECOVERY_SOURCE_S3_COORDINATE_SHA256: "0".repeat(64) }, "RECOVERY_COORDINATE_BINDING_MISMATCH"],
    ["limit override", { COMPLETE_RECOVERY_MAX_OBJECTS: "1" }, "RECOVERY_LIMIT_OVERRIDE_FORBIDDEN"],
    ["credential collision", {
      COMPLETE_RECOVERY_DESTINATION_S3_ACCESS_KEY_ID: "source-reader-id",
    }, "RECOVERY_CREDENTIAL_COLLISION"],
    ["cross-phase credential collision", {
      COMPLETE_RECOVERY_READER_S3_ACCESS_KEY_ID: "source-reader-id",
    }, "RECOVERY_CREDENTIAL_COLLISION"],
    ["application credential reuse", { S3_ACCESS_KEY_ID: "source-reader-id" }, "RECOVERY_CREDENTIAL_COLLISION"],
    ["recovery principal reuse", {
      COMPLETE_RECOVERY_READER_PRINCIPAL_IDENTITY_SHA256: "1".repeat(64),
    }, "RECOVERY_PRINCIPAL_COLLISION"],
    ["application principal reuse", {
      COMPLETE_RECOVERY_APPLICATION_STORAGE_PRINCIPAL_IDENTITY_SHA256: "4".repeat(64),
    }, "RECOVERY_PRINCIPAL_COLLISION"],
    ["source prefix would omit provider-only objects", coordinateEnv("source", {
      ...coordinates.source,
      basePrefix: "application",
    }), "RECOVERY_COMMAND_CONFIG_INVALID"],
  ];
  for (const [name, changes, expectedCode] of cases) {
    await t.test(name, async () => {
      const env = { ...createEnv(), ...changes };
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) delete env[key];
      }
      let databaseReads = 0;
      let clients = 0;
      await assert.rejects(
        () => createCompleteRecoverySet({
          env,
          now: () => new Date(nowValue),
          restrictedEvidenceSinkFactory: fakeEvidenceSinkFactory(),
          captureDatabaseSnapshot: async () => { databaseReads += 1; return databaseSnapshot(); },
          clientFactory: () => { clients += 1; return {}; },
        }),
        (error) => error.code === expectedCode,
      );
      assert.equal(databaseReads, 0);
      assert.equal(clients, 0);
    });
  }
});

test("local source attestation is anchored to the recovery script repository and tracked runtime files", () => {
  const calls = [];
  const result = defaultRuntimeSourceProbe({
    execute(command, args) {
      calls.push({ command, args });
      if (args.includes("status")) return "";
      if (args.includes("--show-toplevel")) return `${args[1]}\n`;
      return `${sourceCommit}\n`;
    },
  });
  assert.equal(result, sourceCommit);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.command, "git");
    assert.equal(call.args[0], "-C");
    assert.equal(typeof call.args[1], "string");
  }
  const statusArgs = calls[0].args;
  assert.ok(statusArgs.includes("--untracked-files=all"));
  assert.ok(statusArgs.includes("scripts"));
  assert.ok(statusArgs.includes("server"));
  assert.ok(statusArgs.includes("migrations"));
  assert.ok(statusArgs.includes("package.json"));
  assert.ok(statusArgs.includes("package-lock.json"));
});

test("runtime source identity covers barrier, logical-backup, and migration source", () => {
  const observed = new Set();
  const baseline = recoveryRuntimeSourceIdentitySha256({
    readRuntimeFile: (relativePath) => {
      observed.add(relativePath);
      return Buffer.from(relativePath, "utf8");
    },
  });
  for (const changedPath of [
    "server/index.js",
    "scripts/logical-backup-utils.js",
    "migrations/0001_legacy_baseline.up.sql",
  ]) {
    assert.ok(observed.has(changedPath));
    const changed = recoveryRuntimeSourceIdentitySha256({
      readRuntimeFile: (relativePath) => Buffer.from(
        relativePath === changedPath ? `${relativePath}:changed` : relativePath,
        "utf8",
      ),
    });
    assert.notEqual(changed, baseline);
  }
});

test("runtime source identity canonicalizes checkout line endings", () => {
  const lf = recoveryRuntimeSourceIdentitySha256({
    readRuntimeFile: (relativePath) => Buffer.from(`${relativePath}\n`, "utf8"),
  });
  const crlf = recoveryRuntimeSourceIdentitySha256({
    readRuntimeFile: (relativePath) => Buffer.from(`${relativePath}\r\n`, "utf8"),
  });
  assert.equal(crlf, lf);
});

test("a copied Railway commit variable cannot bypass local source attestation", async () => {
  const env = createEnv();
  delete env.RAILWAY_PROJECT_ID;
  delete env.RAILWAY_ENVIRONMENT_ID;
  delete env.RAILWAY_SERVICE_ID;
  delete env.RAILWAY_DEPLOYMENT_ID;
  let databaseReads = 0;
  await assert.rejects(
    () => createCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      runtimeSourceProbe: () => "f".repeat(40),
      captureDatabaseSnapshot: async () => { databaseReads += 1; return databaseSnapshot(); },
    }),
    (error) => error.code === "RECOVERY_SOURCE_REVISION_MISMATCH",
  );
  assert.equal(databaseReads, 0);
});

test("coordinate namespaces must remain distinct before database or provider access", async () => {
  const env = createEnv();
  Object.assign(env, coordinateEnv("restore", coordinates.destination));
  let databaseReads = 0;
  await assert.rejects(
    () => createCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      captureDatabaseSnapshot: async () => { databaseReads += 1; return databaseSnapshot(); },
    }),
    (error) => error.code === "RECOVERY_STORE_COLLISION",
  );
  assert.equal(databaseReads, 0);

  const overlapping = createEnv();
  const nestedDestination = {
    ...coordinates.source,
    basePrefix: "application/recovery",
    forcePathStyle: true,
  };
  Object.assign(overlapping, coordinateEnv("destination", nestedDestination));
  await assert.rejects(
    () => createCompleteRecoverySet({
      env: overlapping,
      now: () => new Date(nowValue),
      captureDatabaseSnapshot: async () => { databaseReads += 1; return databaseSnapshot(); },
    }),
    (error) => error.code === "RECOVERY_STORE_COLLISION",
  );
  assert.equal(databaseReads, 0);
});

test("create CLI emits only the aggregate safe projection", async () => {
  const stdout = [];
  const stderr = [];
  const code = await runCreateCompleteRecoverySetCli({
    execute: async () => ({
      ok: true,
      mode: "create-complete-recovery-set",
      sourceCommit,
      recoverySetIdentitySha256: "d".repeat(64),
      objectCount: 1,
      totalPlaintextBytes: 3,
      completionWritten: true,
      completionKey: "snapshots/raw-object-reference",
      completionVersionId: "raw-version-reference",
      completionSha256: "e".repeat(64),
      secretAccessKey: "do-not-print-secret",
      durationMs: 12,
    }),
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
  });
  assert.equal(code, 0);
  assert.equal(stderr.length, 0);
  assert.equal(stdout.length, 1);
  for (const forbidden of [
    "raw-object-reference",
    "raw-version-reference",
    "do-not-print-secret",
    "completionSha256",
  ]) assert.equal(stdout[0].includes(forbidden), false);
  assert.equal(JSON.parse(stdout[0]).completionWritten, true);
});

test("restricted create evidence is exclusively opened and durably records exact restore references", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rivt-recovery-receipt-"));
  const path = join(directory, "restricted-create-receipt.json");
  try {
    const sink = await createRestrictedRecoveryEvidenceSink({
      COMPLETE_RECOVERY_RESTRICTED_RECEIPT_PATH: path,
    });
    const planned = {
      sourceCommit,
      snapshotId: `set-${"b".repeat(48)}`,
      completionKey: `snapshots/set-${"b".repeat(48)}/complete.json`,
      sourceDatabaseRuntimeIdentitySha256: sourceRuntimeIdentitySha256,
      sourceStoreIdentitySha256: "e".repeat(64),
      destinationStoreIdentitySha256: "f".repeat(64),
      restoreStoreIdentitySha256: "1".repeat(64),
      recoveryPrincipalSetSha256: "2".repeat(64),
      writeWindowStartAt: "2026-08-16T19:55:00.000Z",
      writeWindowEndAt: "2026-08-16T20:30:00.000Z",
    };
    await sink.plan(planned);
    const writerAuthorization = restrictedWriterAuthorization();
    await sink.markWritesStarted({
      writesStartedAt: "2026-08-16T20:00:00.000Z",
      ...writerAuthorization,
    });
    await sink.commit({
      ...planned,
      ...writerAuthorization,
      completionVersionId: "exact-completion-version",
      completionSha256: "c".repeat(64),
      databaseArtifactVersionId: "exact-database-version",
      databaseArtifactSha256: "a".repeat(64),
      archiveVersionId: "exact-archive-version",
      archiveSha256: "b".repeat(64),
      ...protectedRetentionReceipt,
      recoverySetIdentitySha256: "d".repeat(64),
    });
    const rawReceipt = await readFile(path, "utf8");
    assert.equal(Buffer.byteLength(rawReceipt), 16 * 1024);
    const receipt = JSON.parse(rawReceipt);
    assert.equal(receipt.status, "complete");
    assert.equal(receipt.completionVersionId, "exact-completion-version");
    assert.equal(receipt.databaseArtifactVersionId, "exact-database-version");
    assert.equal(receipt.databaseArtifactSha256, "a".repeat(64));
    assert.equal(receipt.archiveVersionId, "exact-archive-version");
    assert.equal(receipt.archiveSha256, "b".repeat(64));
    assert.equal(receipt.completionRetentionMode, "COMPLIANCE");
    assert.equal(receipt.completionRetentionUntil, retentionUntil);
    assert.equal(receipt.databaseArtifactRetentionUntil, retentionUntil);
    assert.equal(receipt.archiveRetentionUntil, retentionUntil);
    await assert.rejects(
      () => createRestrictedRecoveryEvidenceSink({
        COMPLETE_RECOVERY_RESTRICTED_RECEIPT_PATH: path,
      }),
      (error) => error.code === "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
    );
    assert.equal(await readFile(path, "utf8"), rawReceipt);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("restricted evidence rejects a repository-local path before opening it", async () => {
  const path = fileURLToPath(new URL("../packet100-restricted-receipt.json", import.meta.url));
  let opened = false;
  await assert.rejects(
    () => createRestrictedRecoveryEvidenceSink(
      { COMPLETE_RECOVERY_RESTRICTED_RECEIPT_PATH: path },
      {
        openFile: async () => {
          opened = true;
          throw new Error("must not open");
        },
      },
    ),
    (error) => error.code === "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
  );
  assert.equal(opened, false);
});

test("restricted evidence durably syncs its parent directory before returning", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rivt-recovery-directory-sync-"));
  const path = join(directory, "restricted-create-receipt.json");
  const events = [];
  try {
    const sink = await createRestrictedRecoveryEvidenceSink(
      { COMPLETE_RECOVERY_RESTRICTED_RECEIPT_PATH: path },
      {
        async syncParentDirectory(openedPath) {
          assert.equal(openedPath, directory);
          events.push("directory-sync");
        },
      },
    );
    events.push("sink-returned");
    assert.deepEqual(events, [
      "directory-sync",
      "sink-returned",
    ]);
    await sink.abort();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("restricted evidence fails closed and removes its reservation when directory sync fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rivt-recovery-directory-sync-failure-"));
  const path = join(directory, "restricted-create-receipt.json");
  try {
    await assert.rejects(
      () => createRestrictedRecoveryEvidenceSink(
        { COMPLETE_RECOVERY_RESTRICTED_RECEIPT_PATH: path },
        {
          async syncParentDirectory() {
            throw new Error("directory sync failed");
          },
        },
      ),
      (error) => error.code === "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
    );
    await assert.rejects(
      () => readFile(path),
      (error) => error.code === "ENOENT",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("restricted evidence rejects missing multipart safety attestations", async (t) => {
  for (const field of [
    "multipartInitiationDenied",
    "noPreexistingMultipartUploadsVerified",
  ]) {
    await t.test(field, async () => {
      const directory = await mkdtemp(join(tmpdir(), "rivt-recovery-multipart-evidence-"));
      const path = join(directory, "restricted-create-receipt.json");
      try {
        const sink = await createRestrictedRecoveryEvidenceSink({
          COMPLETE_RECOVERY_RESTRICTED_RECEIPT_PATH: path,
        });
        const snapshotId = `set-${"b".repeat(48)}`;
        await sink.plan({
          sourceCommit,
          snapshotId,
          completionKey: `snapshots/${snapshotId}/complete.json`,
          sourceDatabaseRuntimeIdentitySha256: sourceRuntimeIdentitySha256,
          sourceStoreIdentitySha256: "e".repeat(64),
          destinationStoreIdentitySha256: "f".repeat(64),
          restoreStoreIdentitySha256: "1".repeat(64),
          recoveryPrincipalSetSha256: "2".repeat(64),
          writeWindowStartAt: "2026-08-16T19:55:00.000Z",
          writeWindowEndAt: "2026-08-16T20:30:00.000Z",
        });
        const authorization = restrictedWriterAuthorization();
        delete authorization[field];
        await assert.rejects(
          () => sink.markWritesStarted({
            writesStartedAt: "2026-08-16T20:00:00.000Z",
            ...authorization,
          }),
          (error) => error.code === "RECOVERY_RESTRICTED_EVIDENCE_INVALID",
        );
        await sink.abort();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
});

test("restricted evidence preserves the deterministic plan after an ambiguous protected write", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rivt-recovery-ambiguous-"));
  const path = join(directory, "restricted-create-receipt.json");
  try {
    const sink = await createRestrictedRecoveryEvidenceSink({
      COMPLETE_RECOVERY_RESTRICTED_RECEIPT_PATH: path,
    });
    const snapshotId = `set-${"b".repeat(48)}`;
    await sink.plan({
      sourceCommit,
      snapshotId,
      completionKey: `snapshots/${snapshotId}/complete.json`,
      sourceDatabaseRuntimeIdentitySha256: sourceRuntimeIdentitySha256,
      sourceStoreIdentitySha256: "e".repeat(64),
      destinationStoreIdentitySha256: "f".repeat(64),
      restoreStoreIdentitySha256: "1".repeat(64),
      recoveryPrincipalSetSha256: "2".repeat(64),
      writeWindowStartAt: "2026-08-16T19:55:00.000Z",
      writeWindowEndAt: "2026-08-16T20:30:00.000Z",
    });
    await sink.markWritesStarted({
      writesStartedAt: "2026-08-16T20:00:00.000Z",
      ...restrictedWriterAuthorization(),
    });
    await sink.abort();
    const evidence = JSON.parse(await readFile(path, "utf8"));
    assert.equal(evidence.status, "write_failed_or_ambiguous");
    assert.equal(evidence.snapshotId, snapshotId);
    assert.equal(evidence.completionKey, `snapshots/${snapshotId}/complete.json`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("restore consumes exact completion references, active-authenticates the database, and forces object cleanup", async () => {
  const env = restoreEnv();
  const snapshot = databaseSnapshot();
  const databaseBinding = buildDatabaseRecoveryBinding(snapshot);
  const encrypted = encryptCompleteRecoveryDatabaseSnapshot(snapshot, activeKey);
  const lifecycle = [];
  let databaseCalls = 0;
  let referenceResolverCalls = 0;
  const targetRuntimeIdentitySha256 = "9".repeat(64);
  const clockValues = [1_000, 1_150];
  const result = await restoreCompleteRecoverySet({
    env,
    now: () => new Date(nowValue),
    clock: () => clockValues.shift(),
    clientFactory: fakeClientFactory(lifecycle),
    backupStoreFactory: ({ binding }) => ({
      identitySha256: binding.identitySha256,
      versionedReads: true,
      openRead() {},
      inspect() {},
    }),
    restoreStoreFactory: ({ binding }) => ({
      identitySha256: binding.identitySha256,
      atomicPut: true,
      put() {},
      openRead() {},
      delete() {},
      assertEmpty() {},
    }),
    restoreDatabaseSnapshot: async (input) => {
      databaseCalls += 1;
      assert.deepEqual(input.authenticatedSnapshot, snapshot);
      assert.equal(input.authenticationMode, "active-key-only");
      assert.equal(input.confirmTargetIsolated, true);
      assert.equal(input.applyMigrations, true);
      assert.deepEqual(input.protectedDatabaseUrls, [env.DATABASE_URL]);
      assert.equal(input.batchSize, COMPLETE_RECOVERY_LIMITS.restoreBatchSize);
      assert.equal(input.rtoMinutes, COMPLETE_RECOVERY_LIMITS.rtoMinutes);
      input.onTargetMutationAuthorized({ targetRuntimeIdentitySha256 });
      return {
        ok: true,
        backupSourceCommit: sourceCommit,
        pendingMigrationCount: 0,
        countDiffCount: 0,
        contentDiffCount: 0,
        targetRuntimeIdentitySha256,
      };
    },
    resolveDatabaseObjectReferences: async (input) => {
      referenceResolverCalls += 1;
      assert.equal(input.targetUrl, env.RESTORE_DATABASE_URL);
      assert.equal(input.expectedTargetRuntimeIdentitySha256, targetRuntimeIdentitySha256);
      assert.equal(input.confirmTargetIsolated, true);
      // Deliberately differs from the authenticated input row: the smoke must
      // consume the restored target query, not reuse snapshot memory.
      return [{
        uploadId: "00000000-0000-4000-8000-000000000001",
        ownerAccountId: "10000000-0000-4000-8000-000000000001",
        sourceKey: "project/restored-db.bin",
        storageScope: "project",
      }];
    },
    applicationRouteReadSmoke: async (input) => {
      lifecycle.push("smoke:application-route");
      assert.equal(input.targetUrl, env.RESTORE_DATABASE_URL);
      assert.deepEqual(input.protectedDatabaseUrls, [env.BACKUP_DATABASE_URL, env.DATABASE_URL]);
      assert.equal(input.confirmTargetIsolated, true);
      assert.equal(input.expectedTargetRuntimeIdentitySha256, targetRuntimeIdentitySha256);
      assert.equal(input.targetReferenceByteSmoke.targetReferenceByteSmokePassed, true);
      assert.equal(typeof input.openRestoredObject, "function");
      assert.equal(input.maximumObjectBytes, COMPLETE_RECOVERY_LIMITS.maxObjectBytes);
      assert.deepEqual(input.databaseReferences, [
        {
          uploadId: "00000000-0000-4000-8000-000000000001",
          ownerAccountId: "10000000-0000-4000-8000-000000000001",
          sourceKey: "project/restored-db.bin",
          storageScope: "project",
        },
      ]);
      return {
        ok: true,
        mode: "isolated-application-route",
        applicationReadSmokeEvidenceLevel:
          APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE,
        representativeObjectCount: 1,
        storageScopes: ["project"],
      };
    },
    cleanupDatabaseTarget: async (input) => {
      lifecycle.push("cleanup:database");
      assert.equal(input.confirmTargetIsolated, true);
      assert.equal(input.confirmTemporaryDataDeletion, true);
      assert.deepEqual(input.protectedDatabaseUrls, [env.DATABASE_URL]);
      assert.equal(input.expectedTargetRuntimeIdentitySha256, targetRuntimeIdentitySha256);
      return {
        ok: true,
        targetDatabaseCleaned: true,
        targetRuntimeIdentitySha256,
      };
    },
    verifySnapshot: async (input) => {
      lifecycle.push("verify:exact-set");
      assert.equal(input.snapshotId, env.COMPLETE_RECOVERY_SET_ID);
      assert.equal(input.completionVersionId, env.COMPLETE_RECOVERY_COMPLETION_VERSION_ID);
      assert.equal(input.completionSha256, env.COMPLETE_RECOVERY_COMPLETION_SHA256);
      assert.equal(input.cleanupRestoreStoreAfterVerification, true);
      await input.databaseArtifactConsumer(encrypted.bytes, databaseBinding);
      const smoke = await input.applicationReadSmoke({
        entries: [{
          sourceKey: "project/restored-db.bin",
          plaintextBytes: 3,
          plaintextSha256: crypto.createHash("sha256").update("abc").digest("hex"),
          storageScopes: ["project"],
        }],
        openRestoredObject: async () => Readable.from([Buffer.from("abc")]),
      });
      assert.equal(smoke.ok, true);
      assert.equal(
        smoke.applicationReadSmokeEvidenceLevel,
        APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE,
      );
      return {
        ok: true,
        recoverySetIdentitySha256: "d".repeat(64),
        sourceCommit,
        objectCount: 1,
        totalPlaintextBytes: 3,
        databaseArtifactVerified: true,
        contentVerified: true,
        targetReferenceByteSmokePassed: true,
        applicationReadSmokePassed: true,
        applicationReadSmokeEvidenceLevel:
          APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE,
        restoreTargetCleaned: true,
        storageScopes: ["project"],
        reconciliation: {
          storedReferencesMissing: 0,
          declaredSizeMismatches: 0,
          declaredHashMismatches: 0,
          providerOnlyObjects: 0,
          removedObjectsStillPresent: 0,
          unresolvedObjects: 0,
        },
        durationMs: 100,
      };
    },
  });
  assert.equal(databaseCalls, 1);
  assert.equal(referenceResolverCalls, 1);
  assert.ok(lifecycle.includes("smoke:application-route"));
  assert.equal(result.mode, "restore-complete-recovery-set");
  assert.equal(result.restoreTargetCleaned, true);
  assert.equal(result.databaseTargetCleaned, true);
  assert.equal(
    result.applicationReadSmokeEvidenceLevel,
    APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE,
  );
  assert.equal(result.durationMs, 150);
  assert.deepEqual(lifecycle.slice(-2), [
    "destroy:exact-version-reader",
    "destroy:isolated-restore-writer",
  ]);
});

test("nonempty restore fails closed when its application-route adapter is explicitly unavailable", async () => {
  const env = restoreEnv();
  const snapshot = databaseSnapshot();
  const databaseBinding = buildDatabaseRecoveryBinding(snapshot);
  const encrypted = encryptCompleteRecoveryDatabaseSnapshot(snapshot, activeKey);
  const targetRuntimeIdentitySha256 = "9".repeat(64);
  await assert.rejects(
    () => restoreCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clock: () => 1_000,
      clientFactory: fakeClientFactory([]),
      backupStoreFactory: ({ binding }) => ({
        identitySha256: binding.identitySha256,
        versionedReads: true,
      }),
      restoreStoreFactory: ({ binding }) => ({
        identitySha256: binding.identitySha256,
        atomicPut: true,
      }),
      restoreDatabaseSnapshot: async (input) => {
        input.onTargetMutationAuthorized({ targetRuntimeIdentitySha256 });
        return {
          ok: true,
          backupSourceCommit: sourceCommit,
          pendingMigrationCount: 0,
          countDiffCount: 0,
          contentDiffCount: 0,
          targetRuntimeIdentitySha256,
        };
      },
      resolveDatabaseObjectReferences: async () => [
        {
          uploadId: "00000000-0000-4000-8000-000000000001",
          ownerAccountId: "10000000-0000-4000-8000-000000000001",
          sourceKey: "project/restored-db.bin",
          storageScope: "project",
        },
      ],
      applicationRouteReadSmoke: null,
      cleanupDatabaseTarget: async () => ({
        ok: true,
        targetDatabaseCleaned: true,
        targetRuntimeIdentitySha256,
      }),
      verifySnapshot: async (input) => {
        await input.databaseArtifactConsumer(encrypted.bytes, databaseBinding);
        await input.applicationReadSmoke({
          entries: [{
            sourceKey: "project/restored-db.bin",
            plaintextBytes: 3,
            plaintextSha256: crypto.createHash("sha256").update("abc").digest("hex"),
            storageScopes: ["project"],
          }],
          openRestoredObject: async () => Readable.from([Buffer.from("abc")]),
        });
      },
    }),
    (error) => error.code === "APPLICATION_READ_SMOKE_REQUIRED",
  );
});

test("restore accepts an empty stored-object set and still cleans both isolated targets", async () => {
  const env = restoreEnv();
  const snapshot = emptyDatabaseSnapshot();
  const binding = buildDatabaseRecoveryBinding(snapshot);
  const encrypted = encryptCompleteRecoveryDatabaseSnapshot(snapshot, activeKey);
  const lifecycle = [];
  const targetRuntimeIdentitySha256 = "9".repeat(64);
  let objectReads = 0;
  const result = await restoreCompleteRecoverySet({
    env,
    now: () => new Date(nowValue),
    clock: (() => {
      const values = [1_000, 1_050];
      return () => values.shift();
    })(),
    clientFactory: fakeClientFactory(lifecycle),
    backupStoreFactory: ({ binding: storeBinding }) => ({
      identitySha256: storeBinding.identitySha256,
      versionedReads: true,
    }),
    restoreStoreFactory: ({ binding: storeBinding }) => ({
      identitySha256: storeBinding.identitySha256,
      atomicPut: true,
    }),
    restoreDatabaseSnapshot: async (input) => {
      input.onTargetMutationAuthorized({ targetRuntimeIdentitySha256 });
      return {
        ok: true,
        backupSourceCommit: sourceCommit,
        pendingMigrationCount: 0,
        countDiffCount: 0,
        contentDiffCount: 0,
        targetRuntimeIdentitySha256,
      };
    },
    resolveDatabaseObjectReferences: async () => [],
    cleanupDatabaseTarget: async () => {
      lifecycle.push("cleanup:database");
      return {
        ok: true,
        targetDatabaseCleaned: true,
        targetRuntimeIdentitySha256,
      };
    },
    verifySnapshot: async (input) => {
      assert.equal(input.cleanupRestoreStoreAfterVerification, true);
      await input.databaseArtifactConsumer(encrypted.bytes, binding);
      const smoke = await input.applicationReadSmoke({
        entries: [],
        openRestoredObject: async () => {
          objectReads += 1;
          throw new Error("empty recovery must not open an object");
        },
      });
      assert.deepEqual(smoke, {
        ok: true,
        mode: "not-applicable-no-stored-references",
        representativeObjectCount: 0,
        notApplicableNoStoredReferences: true,
        storageScopes: [],
      });
      lifecycle.push("cleanup:objects");
      return {
        ok: true,
        recoverySetIdentitySha256: "d".repeat(64),
        sourceCommit,
        objectCount: 0,
        totalPlaintextBytes: 0,
        databaseArtifactVerified: true,
        contentVerified: true,
        targetReferenceByteSmokePassed: true,
        applicationReadSmokePassed: true,
        restoreTargetCleaned: true,
        storageScopes: [],
        reconciliation: {
          storedReferencesMissing: 0,
          declaredSizeMismatches: 0,
          declaredHashMismatches: 0,
          providerOnlyObjects: 0,
          removedObjectsStillPresent: 0,
          unresolvedObjects: 0,
        },
      };
    },
  });

  assert.equal(objectReads, 0);
  assert.equal(result.objectCount, 0);
  assert.equal(result.applicationReadSmokeEvidenceLevel, undefined);
  assert.equal(result.restoreTargetCleaned, true);
  assert.equal(result.databaseTargetCleaned, true);
  assert.ok(lifecycle.indexOf("cleanup:objects") < lifecycle.indexOf("cleanup:database"));
  assert.deepEqual(lifecycle.slice(-2), [
    "destroy:exact-version-reader",
    "destroy:isolated-restore-writer",
  ]);
});

test("a partial restored-reference query cannot waive any completed application scope", async () => {
  const env = restoreEnv();
  const snapshot = databaseSnapshot();
  const binding = buildDatabaseRecoveryBinding(snapshot);
  const encrypted = encryptCompleteRecoveryDatabaseSnapshot(snapshot, activeKey);
  const lifecycle = [];
  const targetRuntimeIdentitySha256 = "9".repeat(64);
  await assert.rejects(
    () => restoreCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clock: () => 1_000,
      clientFactory: fakeClientFactory(lifecycle),
      backupStoreFactory: ({ binding: storeBinding }) => ({
        identitySha256: storeBinding.identitySha256,
        versionedReads: true,
      }),
      restoreStoreFactory: ({ binding: storeBinding }) => ({
        identitySha256: storeBinding.identitySha256,
        atomicPut: true,
      }),
      restoreDatabaseSnapshot: async (input) => {
        input.onTargetMutationAuthorized({ targetRuntimeIdentitySha256 });
        return {
          ok: true,
          backupSourceCommit: sourceCommit,
          pendingMigrationCount: 0,
          countDiffCount: 0,
          contentDiffCount: 0,
          targetRuntimeIdentitySha256,
        };
      },
      resolveDatabaseObjectReferences: async () => [{
        uploadId: "00000000-0000-4000-8000-000000000001",
        ownerAccountId: "10000000-0000-4000-8000-000000000001",
        sourceKey: "project/restored-db.bin",
        storageScope: "project",
      }],
      cleanupDatabaseTarget: async () => {
        lifecycle.push("cleanup:database");
        return {
          ok: true,
          targetDatabaseCleaned: true,
          targetRuntimeIdentitySha256,
        };
      },
      verifySnapshot: async (input) => {
        await input.databaseArtifactConsumer(encrypted.bytes, binding);
        try {
          await input.applicationReadSmoke({
            entries: [{
              sourceKey: "project/restored-db.bin",
              plaintextBytes: 3,
              plaintextSha256: crypto.createHash("sha256").update("abc").digest("hex"),
              storageScopes: ["project"],
            }, {
              sourceKey: "album/restored-db.bin",
              plaintextBytes: 3,
              plaintextSha256: crypto.createHash("sha256").update("def").digest("hex"),
              storageScopes: ["album"],
            }],
            openRestoredObject: async (sourceKey) => Readable.from([
              Buffer.from(sourceKey.startsWith("project/") ? "abc" : "def"),
            ]),
          });
        } finally {
          lifecycle.push("cleanup:objects");
        }
      },
    }),
    (error) => error.code === "APPLICATION_READ_SMOKE_FAILED",
  );
  assert.ok(lifecycle.indexOf("cleanup:objects") < lifecycle.indexOf("cleanup:database"));
  assert.deepEqual(lifecycle.slice(-2), [
    "destroy:exact-version-reader",
    "destroy:isolated-restore-writer",
  ]);
});

test("restore rejects invalid exact references before constructing provider clients", async () => {
  const env = { ...restoreEnv(), COMPLETE_RECOVERY_COMPLETION_VERSION_ID: "null" };
  let clients = 0;
  await assert.rejects(
    () => restoreCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clientFactory: () => { clients += 1; return {}; },
    }),
    (error) => error.code === "RECOVERY_REFERENCE_INVALID",
  );
  assert.equal(clients, 0);
});

test("restore rejects a static source-target database collision before provider access", async () => {
  const env = restoreEnv();
  env.RESTORE_DATABASE_URL = env.BACKUP_DATABASE_URL;
  let clients = 0;
  await assert.rejects(
    () => restoreCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clientFactory: () => { clients += 1; return {}; },
    }),
    (error) => error.code === "RECOVERY_DATABASE_TARGET_NOT_ISOLATED",
  );
  assert.equal(clients, 0);
});

test("restore requires the production database protection coordinate before provider access", async () => {
  const env = restoreEnv();
  delete env.DATABASE_URL;
  let clients = 0;
  await assert.rejects(
    () => restoreCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clientFactory: () => { clients += 1; return {}; },
    }),
    (error) => error.code === "RECOVERY_COMMAND_CONFIG_INVALID",
  );
  assert.equal(clients, 0);
});

test("restore rejects the production database as target before provider or database access", async () => {
  const env = restoreEnv();
  env.RESTORE_DATABASE_URL = env.DATABASE_URL;
  let clients = 0;
  let databaseCalls = 0;
  await assert.rejects(
    () => restoreCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clientFactory: () => { clients += 1; return {}; },
      restoreDatabaseSnapshot: async () => { databaseCalls += 1; },
    }),
    (error) => error.code === "RECOVERY_DATABASE_TARGET_NOT_ISOLATED",
  );
  assert.equal(clients, 0);
  assert.equal(databaseCalls, 0);
});

test("restore never falls back to a predecessor key for its database member", async () => {
  const env = restoreEnv();
  const snapshot = databaseSnapshot();
  const databaseBinding = buildDatabaseRecoveryBinding(snapshot);
  const encryptedWithAnotherKey = encryptCompleteRecoveryDatabaseSnapshot(snapshot, "22".repeat(32));
  let databaseCalls = 0;
  const lifecycle = [];
  await assert.rejects(
    () => restoreCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clock: () => 1_000,
      clientFactory: fakeClientFactory(lifecycle),
      backupStoreFactory: ({ binding }) => ({ identitySha256: binding.identitySha256 }),
      restoreStoreFactory: ({ binding }) => ({ identitySha256: binding.identitySha256 }),
      restoreDatabaseSnapshot: async () => { databaseCalls += 1; },
      verifySnapshot: async (input) => {
        await input.databaseArtifactConsumer(encryptedWithAnotherKey.bytes, databaseBinding);
      },
    }),
    (error) => error.code === "DATABASE_ARTIFACT_INVALID",
  );
  assert.equal(databaseCalls, 0);
  assert.equal(lifecycle.filter((entry) => entry.startsWith("destroy:")).length, 2);
});

test("restore enforces the fixed aggregate RTO", async () => {
  const env = restoreEnv();
  const snapshot = databaseSnapshot();
  const binding = buildDatabaseRecoveryBinding(snapshot);
  const encrypted = encryptCompleteRecoveryDatabaseSnapshot(snapshot, activeKey);
  const targetRuntimeIdentitySha256 = "9".repeat(64);
  const times = [0, COMPLETE_RECOVERY_LIMITS.rtoMinutes * 60_000 + 1];
  await assert.rejects(
    () => restoreCompleteRecoverySet({
      env,
      now: () => new Date(nowValue),
      clock: () => times.shift(),
      clientFactory: () => ({ destroy() {} }),
      backupStoreFactory: ({ binding: storeBinding }) => ({ identitySha256: storeBinding.identitySha256 }),
      restoreStoreFactory: ({ binding: storeBinding }) => ({ identitySha256: storeBinding.identitySha256 }),
      restoreDatabaseSnapshot: async (input) => {
        input.onTargetMutationAuthorized({ targetRuntimeIdentitySha256 });
        return {
          ok: true,
          backupSourceCommit: sourceCommit,
          pendingMigrationCount: 0,
          countDiffCount: 0,
          contentDiffCount: 0,
          targetRuntimeIdentitySha256,
        };
      },
      cleanupDatabaseTarget: async () => ({
        ok: true,
        targetDatabaseCleaned: true,
        targetRuntimeIdentitySha256,
      }),
      verifySnapshot: async (input) => {
        await input.databaseArtifactConsumer(encrypted.bytes, binding);
        return {
          ok: true,
          sourceCommit,
          databaseArtifactVerified: true,
          contentVerified: true,
          targetReferenceByteSmokePassed: true,
          applicationReadSmokePassed: true,
          applicationReadSmokeEvidenceLevel:
            APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE,
          restoreTargetCleaned: true,
          storageScopes: ["project"],
        };
      },
    }),
    (error) => error.code === "RECOVERY_RTO_EXCEEDED",
  );
});

test("restore CLI suppresses raw error messages, coordinates, credentials, and object references", async () => {
  const stdout = [];
  const stderr = [];
  const secretText = [
    coordinates.destination.endpoint,
    coordinates.destination.bucket,
    "exact-version-17",
    "exact-reader-secret",
  ].join(" ");
  const code = await runRestoreCompleteRecoverySetCli({
    execute: async () => { throw new Error(secretText); },
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
  });
  assert.equal(code, 1);
  assert.equal(stdout.length, 0);
  assert.equal(stderr.length, 1);
  assert.deepEqual(JSON.parse(stderr[0]), {
    ok: false,
    mode: "restore-complete-recovery-set",
    errorCode: "RECOVERY_FAILED",
    message: "Recovery failed closed.",
  });
  for (const forbidden of secretText.split(" ")) {
    assert.equal(stderr[0].includes(forbidden), false);
  }
});
