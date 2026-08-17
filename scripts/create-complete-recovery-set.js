import {
  RecoveryError,
  backupRecoverySnapshot,
  buildDatabaseRecoveryBinding,
  buildRelationalObjectManifestFromSnapshot,
  recoverySetIdForDatabaseBinding,
  recoverySourceBindingForConfig,
  recoverySourceBindingIdentitySha256,
  sanitizedRecoveryFailure,
  sanitizedRecoverySuccess,
} from "./recovery-object-utils.js";
import {
  S3ProtectedDestinationWriter,
  S3SourceObjectStore,
  assertRecoveryS3LogicalKeysAddressable,
  assertRecoveryS3StoreSeparation,
} from "./recovery-s3-store.js";
import {
  acquireCompleteRecoveryCaptureBarrier,
  captureCompleteRecoveryDatabaseSnapshot,
  encryptCompleteRecoveryDatabaseSnapshot,
} from "./complete-recovery-database.js";
import { renderExactRecoveryWriterPolicy } from "./application-recovery-writer-policy.js";
import {
  assertDistinctCredentials,
  assertCompleteRecoveryWriteWindow,
  assertExactStoreIdentity,
  completeRecoveryClockMilliseconds,
  completeRecoveryCommandConfig,
  completeRecoveryCredentials,
  destroyRecoveryClients,
  enforceCompleteRecoveryRto,
  explicitS3ClientFactory,
  createRestrictedRecoveryEvidenceSink,
} from "./complete-recovery-command-utils.js";
import { isDirectExecution } from "./logical-backup-utils.js";

function createSourceStore({ client, binding, sourceBindingIdentitySha256, limits }) {
  return new S3SourceObjectStore({
    client,
    ...binding.coordinates,
    maximumInventoryItems: limits.maxObjects,
    maximumPages: limits.maximumInventoryPages,
    bindingIdentitySha256: sourceBindingIdentitySha256,
  });
}

function createDestinationStore({ client, binding, minimumRetentionUntil }) {
  return new S3ProtectedDestinationWriter({
    client,
    ...binding.coordinates,
    minimumRetentionUntil,
  });
}

function exactVersionId(value) {
  return typeof value === "string"
    && value
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && value.toLowerCase() !== "null"
    && Buffer.byteLength(value, "utf8") <= 1_024;
}

function canonicalRetention(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function assertCreateReceipt(result, sourceCommit, snapshotId, minimumRetentionUntil) {
  if (
    result?.ok !== true
    || result.completionWritten !== true
    || result.sourceCommit !== sourceCommit
    || result.snapshotId !== snapshotId
    || result.completionKey !== `snapshots/${snapshotId}/complete.json`
    || !exactVersionId(result.completionVersionId)
    || !exactVersionId(result.databaseArtifactVersionId)
    || !exactVersionId(result.archiveVersionId)
    || !/^[a-f0-9]{64}$/u.test(result.completionSha256 ?? "")
    || !/^[a-f0-9]{64}$/u.test(result.databaseArtifactSha256 ?? "")
    || !/^[a-f0-9]{64}$/u.test(result.archiveSha256 ?? "")
    || !/^[a-f0-9]{64}$/u.test(result.recoverySetIdentitySha256 ?? "")
    || result.completionRetentionMode !== "COMPLIANCE"
    || result.databaseArtifactRetentionMode !== "COMPLIANCE"
    || result.archiveRetentionMode !== "COMPLIANCE"
    || !canonicalRetention(result.completionRetentionUntil)
    || !canonicalRetention(result.databaseArtifactRetentionUntil)
    || !canonicalRetention(result.archiveRetentionUntil)
    || new Date(result.completionRetentionUntil) < new Date(minimumRetentionUntil)
    || new Date(result.databaseArtifactRetentionUntil) < new Date(minimumRetentionUntil)
    || new Date(result.archiveRetentionUntil) < new Date(minimumRetentionUntil)
  ) {
    throw new RecoveryError(
      "RECOVERY_CREATE_RECEIPT_INVALID",
      "Complete-recovery creation returned no exact completion receipt.",
    );
  }
}

async function unavailableProtectedWriterAuthorization() {
  throw new RecoveryError(
    "RECOVERY_WRITER_AUTHORIZATION_REQUIRED",
    "A reviewed exact-key provider authorization adapter is required before protected writes.",
  );
}

function assertProtectedWriterAuthorization(receipt, policyPlan, config, writesStartedAt) {
  const authorizedAt = new Date(receipt?.authorizedAt ?? "");
  const startedAt = new Date(writesStartedAt);
  const windowStart = new Date(config.writeWindow.startAt);
  const windowEnd = new Date(config.writeWindow.endAt);
  if (
    receipt?.authorized !== true
    || receipt.authorizationMode !== "provider-exact-key-policy"
    || receipt.writerInitiallyInert !== true
    || receipt.multipartInitiationDenied !== true
    || receipt.noPreexistingMultipartUploadsVerified !== true
    || receipt.policySha256 !== policyPlan.policySha256
    || receipt.exactKeySetSha256 !== policyPlan.exactKeySetSha256
    || receipt.destinationStoreIdentitySha256 !== config.destination.identitySha256
    || receipt.writerPrincipalIdentitySha256 !== config.principalIdentities.destination
    || receipt.expiresAt !== config.writeWindow.endAt
    || !Number.isFinite(authorizedAt.getTime())
    || authorizedAt.toISOString() !== receipt.authorizedAt
    || authorizedAt < windowStart
    || authorizedAt > startedAt
    || startedAt >= windowEnd
  ) {
    throw new RecoveryError(
      "RECOVERY_WRITER_AUTHORIZATION_INVALID",
      "The protected writer is not bound to the exact staged key set and reviewed window.",
    );
  }
  return Object.freeze({
    writerPolicySha256: policyPlan.policySha256,
    writerExactKeySetSha256: policyPlan.exactKeySetSha256,
    writerAuthorizationIdentitySha256: config.principalIdentities.destination,
    writerAuthorizationAt: receipt.authorizedAt,
    writerAuthorizationExpiresAt: receipt.expiresAt,
    multipartInitiationDenied: true,
    noPreexistingMultipartUploadsVerified: true,
  });
}

export async function createCompleteRecoverySet({
  env = process.env,
  now = () => new Date(),
  clock = () => Date.now(),
  clientFactory = explicitS3ClientFactory,
  sourceStoreFactory = createSourceStore,
  destinationStoreFactory = createDestinationStore,
  captureBarrierFactory = acquireCompleteRecoveryCaptureBarrier,
  captureDatabaseSnapshot = captureCompleteRecoveryDatabaseSnapshot,
  encryptDatabaseSnapshot = encryptCompleteRecoveryDatabaseSnapshot,
  backupSnapshot = backupRecoverySnapshot,
  authorizeProtectedWrites = unavailableProtectedWriterAuthorization,
  restrictedEvidenceSinkFactory = createRestrictedRecoveryEvidenceSink,
  runtimeSourceProbe,
  randomBytesFn,
  sleep,
  logger = () => undefined,
} = {}) {
  const config = completeRecoveryCommandConfig({
    env,
    operation: "create",
    now,
    runtimeSourceProbe,
  });
  const sourceCredentials = completeRecoveryCredentials(env, "source");
  const destinationCredentials = completeRecoveryCredentials(env, "destination");
  assertDistinctCredentials([sourceCredentials, destinationCredentials]);
  const startedAt = completeRecoveryClockMilliseconds(clock);
  const evidenceSink = await restrictedEvidenceSinkFactory(env);
  let evidenceCommitted = false;
  let captureBarrier;
  let sourceDatabaseRuntimeIdentitySha256;
  let sourceClient;
  let destinationClient;
  let writerAuthorization;

  async function releaseCaptureBarrier() {
    if (!captureBarrier) return;
    const barrier = captureBarrier;
    captureBarrier = undefined;
    await barrier.release();
  }

  try {
    try {
      captureBarrier = await captureBarrierFactory({ env });
      sourceDatabaseRuntimeIdentitySha256 = captureBarrier.sourceRuntimeIdentitySha256;
      const applicationRuntimeIdentitySha256 = captureBarrier.applicationRuntimeIdentitySha256;
      if (
        !/^[a-f0-9]{64}$/u.test(sourceDatabaseRuntimeIdentitySha256 ?? "")
        || !/^[a-f0-9]{64}$/u.test(applicationRuntimeIdentitySha256 ?? "")
        || applicationRuntimeIdentitySha256 !== sourceDatabaseRuntimeIdentitySha256
      ) {
        throw new RecoveryError(
          "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
          "The application mutation barrier and recovery capture must share one PostgreSQL runtime identity.",
        );
      }
    } catch (error) {
      if (
        error?.code === "RECOVERY_OBJECT_MUTATION_ACTIVE"
        || error?.code === "RECOVERY_OBJECT_MUTATION_BARRIER_UNAVAILABLE"
        || error?.code === "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH"
      ) {
        throw new RecoveryError(error.code, error.message);
      }
      throw error;
    }
    // Capture and fully bind the read-only relational snapshot before any
    // provider client or store is constructed. The exclusive application-
    // object barrier remains held through both inventories and staging.
    let snapshot;
    try {
      snapshot = await captureDatabaseSnapshot({
        env,
        now,
        expectedSourceRuntimeIdentitySha256: sourceDatabaseRuntimeIdentitySha256,
      });
    } catch (error) {
      if (error?.code === "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH") {
        throw new RecoveryError(error.code, error.message);
      }
      throw error;
    }
    if (snapshot?.sourceCommit !== config.sourceCommit) {
      throw new RecoveryError(
        "RECOVERY_SOURCE_REVISION_MISMATCH",
        "Database snapshot source revision differs from the reviewed runtime.",
      );
    }
    const sourceBinding = recoverySourceBindingForConfig({
      ...config.source.coordinates,
      coordinateIdentitySha256: config.source.identitySha256,
    });
    const relationalManifest = buildRelationalObjectManifestFromSnapshot(snapshot, { sourceBinding });
    const databaseBinding = buildDatabaseRecoveryBinding(snapshot);
    const databaseArtifact = encryptDatabaseSnapshot(snapshot, config.activeKey);
    const snapshotId = recoverySetIdForDatabaseBinding(config.activeKey, databaseBinding);
    const restrictedPlan = {
      sourceCommit: config.sourceCommit,
      snapshotId,
      completionKey: `snapshots/${snapshotId}/complete.json`,
      sourceDatabaseRuntimeIdentitySha256,
      sourceStoreIdentitySha256: config.source.identitySha256,
      destinationStoreIdentitySha256: config.destination.identitySha256,
      restoreStoreIdentitySha256: config.restore.identitySha256,
      recoveryPrincipalSetSha256: config.principalIdentities.setSha256,
      writeWindowStartAt: config.writeWindow.startAt,
      writeWindowEndAt: config.writeWindow.endAt,
    };
    await evidenceSink.plan(restrictedPlan);

    sourceClient = clientFactory({
      role: "source-reader",
      coordinates: config.source.coordinates,
      credentials: sourceCredentials,
    });
    destinationClient = clientFactory({
      role: "protected-writer",
      coordinates: config.destination.coordinates,
      credentials: destinationCredentials,
    });
    const sourceStore = sourceStoreFactory({
      client: sourceClient,
      binding: config.source,
      sourceBindingIdentitySha256: recoverySourceBindingIdentitySha256(sourceBinding),
      limits: config.limits,
    });
    const destinationStore = destinationStoreFactory({
      client: destinationClient,
      binding: config.destination,
      minimumRetentionUntil: config.minimumRetentionUntil,
      limits: config.limits,
    });
    assertExactStoreIdentity(sourceStore, config.source, "source");
    assertExactStoreIdentity(destinationStore, config.destination, "destination");
    assertRecoveryS3StoreSeparation({
      sourceStore: config.source,
      destinationStore: config.destination,
      restoreStore: config.restore,
    });

    const result = await backupSnapshot({
      sourceStore,
      destinationStore,
      relationalManifest,
      databaseBinding,
      databaseArtifact: databaseArtifact.bytes,
      masterKey: config.activeKey,
      snapshotId,
      minimumRetentionUntil: config.minimumRetentionUntil,
      limits: {
        maxObjects: config.limits.maxObjects,
        maxObjectBytes: config.limits.maxObjectBytes,
        maxTotalBytes: config.limits.maxTotalBytes,
        concurrency: config.limits.concurrency,
      },
      maxReadAttempts: config.limits.maxReadAttempts,
      ...(randomBytesFn ? { randomBytesFn } : {}),
      ...(sleep ? { sleep } : {}),
      logger,
      beforeProtectedWrites: async ({
        snapshotId: plannedSnapshotId,
        objectKeys,
        restoreObjectKeys,
      }) => {
        if (plannedSnapshotId !== snapshotId) {
          throw new RecoveryError(
            "RECOVERY_WRITER_AUTHORIZATION_INVALID",
            "The protected writer plan differs from the authenticated recovery set.",
          );
        }
        assertRecoveryS3LogicalKeysAddressable(
          config.restore.coordinates,
          restoreObjectKeys,
        );
        // The second full inventory and all source staging have completed.
        // Release the exclusive capture lease before any protected write so
        // normal uploads/removals are paused only for the coordinated read.
        await releaseCaptureBarrier();
        const policyPlan = renderExactRecoveryWriterPolicy({
          bucket: config.destination.coordinates.bucket,
          basePrefix: config.destination.coordinates.basePrefix,
          snapshotId,
          objectKeys,
          writeWindow: config.writeWindow,
        });
        assertCompleteRecoveryWriteWindow(config.writeWindow, now);
        const authorizationReceipt = await authorizeProtectedWrites(Object.freeze({
          policyPlan,
          destinationStoreIdentitySha256: config.destination.identitySha256,
          writerPrincipalIdentitySha256: config.principalIdentities.destination,
        }));
        // Provider-side authorization can take measurable time. Sample the
        // write boundary only after the receipt exists so a truthful
        // authorizedAt timestamp can precede it, and fail if the window closed
        // while authorization was being installed.
        const writesStartedAt = assertCompleteRecoveryWriteWindow(config.writeWindow, now);
        writerAuthorization = assertProtectedWriterAuthorization(
          authorizationReceipt,
          policyPlan,
          config,
          writesStartedAt,
        );
        await evidenceSink.markWritesStarted({ writesStartedAt, ...writerAuthorization });
      },
    });
    await releaseCaptureBarrier();
    assertCreateReceipt(result, config.sourceCommit, snapshotId, config.minimumRetentionUntil);
    const completedAt = completeRecoveryClockMilliseconds(clock);
    const restrictedResult = {
      ...result,
      mode: "create-complete-recovery-set",
      durationMs: completedAt >= startedAt ? completedAt - startedAt : 0,
      sourceDatabaseRuntimeIdentitySha256,
      sourceStoreIdentitySha256: config.source.identitySha256,
      destinationStoreIdentitySha256: config.destination.identitySha256,
      restoreStoreIdentitySha256: config.restore.identitySha256,
      recoveryPrincipalSetSha256: config.principalIdentities.setSha256,
      writeWindowStartAt: config.writeWindow.startAt,
      writeWindowEndAt: config.writeWindow.endAt,
      ...writerAuthorization,
    };
    await evidenceSink.commit(restrictedResult);
    evidenceCommitted = true;
    const durationMs = enforceCompleteRecoveryRto(startedAt, completedAt);
    return { ...restrictedResult, durationMs, restrictedEvidenceRecorded: true };
  } finally {
    let barrierReleaseError;
    try {
      await releaseCaptureBarrier();
    } catch (error) {
      barrierReleaseError = error;
    }
    destroyRecoveryClients([sourceClient, destinationClient]);
    if (!evidenceCommitted) await evidenceSink.abort();
    if (barrierReleaseError) throw barrierReleaseError;
  }
}

export async function runCreateCompleteRecoverySetCli({
  execute = () => createCompleteRecoverySet(),
  stdout = (value) => console.log(value),
  stderr = (value) => console.error(value),
} = {}) {
  try {
    stdout(JSON.stringify(sanitizedRecoverySuccess(await execute()), null, 2));
    return 0;
  } catch (error) {
    stderr(JSON.stringify(sanitizedRecoveryFailure(error, "create-complete-recovery-set"), null, 2));
    return 1;
  }
}

if (isDirectExecution(import.meta.url)) {
  process.exitCode = await runCreateCompleteRecoverySetCli();
}
