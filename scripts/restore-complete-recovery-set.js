import crypto from "node:crypto";
import {
  RecoveryError,
  buildDatabaseRecoveryBinding,
  recoveryDatabaseEncryptionSecret,
  sanitizedRecoveryFailure,
  sanitizedRecoverySuccess,
  verifyRecoverySnapshot,
} from "./recovery-object-utils.js";
import {
  S3ExactVersionBackupReader,
  S3IsolatedRestoreTarget,
  assertRecoveryS3StoreSeparation,
} from "./recovery-s3-store.js";
import {
  cleanupCompleteRecoveryDatabaseTarget,
  resolveCompleteRecoveryDatabaseObjectReferences,
  restoreCompleteRecoveryDatabaseSnapshot,
} from "./complete-recovery-database.js";
import {
  assertDistinctCredentials,
  assertExactStoreIdentity,
  completeRecoveryClockMilliseconds,
  completeRecoveryCommandConfig,
  completeRecoveryCredentials,
  destroyRecoveryClients,
  enforceCompleteRecoveryRto,
  exactRecoveryReference,
  explicitS3ClientFactory,
} from "./complete-recovery-command-utils.js";
import {
  assertDifferentDatabases,
  decryptSnapshot,
  isDirectExecution,
} from "./logical-backup-utils.js";

function createBackupStore({ client, binding }) {
  return new S3ExactVersionBackupReader({
    client,
    ...binding.coordinates,
  });
}

function createRestoreStore({ client, binding, limits }) {
  return new S3IsolatedRestoreTarget({
    client,
    ...binding.coordinates,
    maximumInventoryItems: limits.maxObjects,
    maximumPages: limits.maximumInventoryPages,
  });
}

function exactDatabaseUrl(env, name) {
  const value = env[name];
  if (
    typeof value !== "string"
    || !value
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new RecoveryError("RECOVERY_COMMAND_CONFIG_INVALID", `${name} must be explicitly configured.`);
  }
  return value;
}

function authenticatedDatabaseSnapshot(bytes, activeKey, expectedBinding, sourceCommit, decrypt) {
  let envelope;
  try {
    envelope = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new RecoveryError("DATABASE_ARTIFACT_INVALID", "Database artifact is not an exact JSON envelope.");
  }
  let snapshot;
  try {
    // A single string deliberately excludes every previous-key fallback path.
    snapshot = decrypt(
      envelope,
      recoveryDatabaseEncryptionSecret(activeKey, expectedBinding),
    );
  } catch {
    throw new RecoveryError(
      "DATABASE_ARTIFACT_INVALID",
      "Database artifact did not authenticate with the active recovery key.",
    );
  }
  const binding = buildDatabaseRecoveryBinding(snapshot);
  if (
    binding.bindingSha256 !== expectedBinding?.bindingSha256
    || binding.sourceCommit !== sourceCommit
  ) {
    throw new RecoveryError(
      "RECOVERY_SET_BINDING_INVALID",
      "Authenticated database content differs from the completed recovery-set binding.",
    );
  }
  return { snapshot, binding };
}

function assertRestoreReceipt(result, databaseReceipt, sourceCommit, targetRuntimeIdentitySha256) {
  if (
    result?.ok !== true
    || result.databaseArtifactVerified !== true
    || result.contentVerified !== true
    || result.targetReferenceByteSmokePassed !== true
    || result.applicationReadSmokePassed !== true
    || result.restoreTargetCleaned !== true
    || result.sourceCommit !== sourceCommit
    || databaseReceipt?.ok !== true
    || databaseReceipt.backupSourceCommit !== sourceCommit
    || databaseReceipt.pendingMigrationCount !== 0
    || databaseReceipt.countDiffCount !== 0
    || databaseReceipt.contentDiffCount !== 0
    || !/^[a-f0-9]{64}$/u.test(targetRuntimeIdentitySha256 ?? "")
    || databaseReceipt.targetRuntimeIdentitySha256 !== targetRuntimeIdentitySha256
  ) {
    throw new RecoveryError(
      "RECOVERY_RESTORE_RECEIPT_INVALID",
      "Complete recovery returned no strict database-and-object verification receipt.",
    );
  }
}

async function hashBoundedStream(stream, maximumBytes) {
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) {
    const value = Buffer.from(chunk);
    bytes += value.length;
    if (bytes > maximumBytes) {
      throw new RecoveryError(
        "APPLICATION_READ_SMOKE_FAILED",
        "Representative application object exceeds the fixed read limit.",
      );
    }
    hash.update(value);
  }
  return { bytes, sha256: hash.digest("hex") };
}

async function unavailableApplicationRouteReadSmoke() {
  throw new RecoveryError(
    "APPLICATION_READ_SMOKE_REQUIRED",
    "A separately reviewed isolated RIVT application-route read adapter is required.",
  );
}

async function verifyRepresentativeApplicationReads({
  databaseReferences,
  entries,
  openRestoredObject,
  maximumObjectBytes,
}) {
  if (!Array.isArray(databaseReferences)) {
    throw new RecoveryError("APPLICATION_READ_SMOKE_FAILED", "Restored upload references are unavailable.");
  }
  if (!Array.isArray(entries)) {
    throw new RecoveryError("APPLICATION_READ_SMOKE_FAILED", "Completed application objects are unavailable.");
  }
  if (databaseReferences.length === 0) {
    const hasScopedEntry = entries.some((entry) => (
      !Array.isArray(entry?.storageScopes) || entry.storageScopes.length > 0
    ));
    if (hasScopedEntry) {
      throw new RecoveryError(
        "APPLICATION_READ_SMOKE_FAILED",
        "Restored upload references cannot be empty while completed application scopes remain.",
      );
    }
    return {
      ok: true,
      mode: "not-applicable-no-stored-references",
      representativeObjectCount: 0,
      notApplicableNoStoredReferences: true,
    };
  }
  const representatives = new Map();
  for (const reference of databaseReferences) {
    const sourceKey = String(reference?.sourceKey ?? "");
    const scope = String(reference?.storageScope ?? "");
    if (sourceKey && scope && !representatives.has(scope)) representatives.set(scope, sourceKey);
  }
  if (!representatives.size) {
    throw new RecoveryError("APPLICATION_READ_SMOKE_FAILED", "No stored application object can be read-smoked.");
  }
  let representativeObjectCount = 0;
  for (const [scope, sourceKey] of representatives) {
    const entry = entries.find((candidate) => (
      candidate.sourceKey === sourceKey && candidate.storageScopes.includes(scope)
    ));
    if (!entry) {
      throw new RecoveryError(
        "APPLICATION_READ_SMOKE_FAILED",
        "A restored application reference is not represented in the completed object set.",
      );
    }
    const observed = await hashBoundedStream(
      await openRestoredObject(sourceKey),
      maximumObjectBytes,
    );
    if (observed.bytes !== entry.plaintextBytes || observed.sha256 !== entry.plaintextSha256) {
      throw new RecoveryError(
        "APPLICATION_READ_SMOKE_FAILED",
        "A representative restored application object differs from its bound bytes.",
      );
    }
    representativeObjectCount += 1;
  }
  return {
    ok: true,
    mode: "target-database-reference-bytes",
    representativeObjectCount,
    targetReferenceByteSmokePassed: true,
  };
}

export async function restoreCompleteRecoverySet({
  env = process.env,
  now = () => new Date(),
  clock = () => Date.now(),
  clientFactory = explicitS3ClientFactory,
  backupStoreFactory = createBackupStore,
  restoreStoreFactory = createRestoreStore,
  verifySnapshot = verifyRecoverySnapshot,
  decryptDatabaseSnapshot = decryptSnapshot,
  restoreDatabaseSnapshot = restoreCompleteRecoveryDatabaseSnapshot,
  resolveDatabaseObjectReferences = resolveCompleteRecoveryDatabaseObjectReferences,
  cleanupDatabaseTarget = cleanupCompleteRecoveryDatabaseTarget,
  applicationRouteReadSmoke = unavailableApplicationRouteReadSmoke,
  runtimeSourceProbe,
  logger = () => undefined,
} = {}) {
  const config = completeRecoveryCommandConfig({
    env,
    operation: "restore",
    now,
    runtimeSourceProbe,
  });
  const reference = exactRecoveryReference(env);
  const databaseSourceUrl = exactDatabaseUrl(env, "BACKUP_DATABASE_URL");
  const productionDatabaseUrl = exactDatabaseUrl(env, "DATABASE_URL");
  const databaseTargetUrl = exactDatabaseUrl(env, "RESTORE_DATABASE_URL");
  try {
    assertDifferentDatabases(databaseSourceUrl, databaseTargetUrl);
    assertDifferentDatabases(productionDatabaseUrl, databaseTargetUrl);
  } catch {
    throw new RecoveryError(
      "RECOVERY_DATABASE_TARGET_NOT_ISOLATED",
      "Source and isolated target database identities must differ.",
    );
  }
  const readerCredentials = completeRecoveryCredentials(env, "reader");
  const restoreCredentials = completeRecoveryCredentials(env, "restore");
  assertDistinctCredentials([readerCredentials, restoreCredentials]);
  const startedAt = completeRecoveryClockMilliseconds(clock);

  let readerClient;
  let restoreClient;
  let databaseReceipt;
  let databaseRestoreStarted = false;
  let targetRuntimeIdentitySha256;
  let databaseCleanupReceipt;
  let result;
  let operationError;
  try {
    readerClient = clientFactory({
      role: "exact-version-reader",
      coordinates: config.destination.coordinates,
      credentials: readerCredentials,
    });
    restoreClient = clientFactory({
      role: "isolated-restore-writer",
      coordinates: config.restore.coordinates,
      credentials: restoreCredentials,
    });
    const backupStore = backupStoreFactory({
      client: readerClient,
      binding: config.destination,
      limits: config.limits,
    });
    const restoreStore = restoreStoreFactory({
      client: restoreClient,
      binding: config.restore,
      limits: config.limits,
    });
    assertExactStoreIdentity(backupStore, config.destination, "backup reader");
    assertExactStoreIdentity(restoreStore, config.restore, "restore target");
    assertRecoveryS3StoreSeparation({
      sourceStore: config.source,
      destinationStore: config.destination,
      restoreStore: config.restore,
    });

    result = await verifySnapshot({
      backupStore,
      restoreStore,
      masterKey: config.activeKey,
      snapshotId: reference.snapshotId,
      completionVersionId: reference.completionVersionId,
      completionSha256: reference.completionSha256,
      completionMinimumRetentionUntil: reference.completionRetentionUntil,
      minimumRetentionUntil: config.minimumRetentionUntil,
      expectedSourceStoreIdentitySha256: config.source.identitySha256,
      limits: config.limits,
      cleanupRestoreStoreAfterVerification: true,
      logger,
      databaseArtifactConsumer: async (databaseBytes, expectedBinding) => {
        const authenticated = authenticatedDatabaseSnapshot(
          databaseBytes,
          config.activeKey,
          expectedBinding,
          config.sourceCommit,
          decryptDatabaseSnapshot,
        );
        databaseReceipt = await restoreDatabaseSnapshot({
          authenticatedSnapshot: authenticated.snapshot,
          authenticatedArtifact: {
            createdAt: authenticated.binding.createdAt,
            sourceCommit: authenticated.binding.sourceCommit,
          },
          authenticationMode: "active-key-only",
          sourceUrl: databaseSourceUrl,
          protectedDatabaseUrls: [productionDatabaseUrl],
          targetUrl: databaseTargetUrl,
          confirmTargetIsolated: true,
          applyMigrations: true,
          batchSize: config.limits.restoreBatchSize,
          rtoMinutes: config.limits.rtoMinutes,
          onTargetMutationAuthorized: (receipt) => {
            const identitySha256 = receipt?.targetRuntimeIdentitySha256;
            if (
              !/^[a-f0-9]{64}$/u.test(identitySha256 ?? "")
              || (targetRuntimeIdentitySha256 && targetRuntimeIdentitySha256 !== identitySha256)
            ) {
              throw new RecoveryError(
                "RECOVERY_DATABASE_TARGET_NOT_ISOLATED",
                "Restore target runtime identity proof is invalid.",
              );
            }
            targetRuntimeIdentitySha256 = identitySha256;
            databaseRestoreStarted = true;
          },
        });
      },
      applicationReadSmoke: async ({ entries, openRestoredObject }) => {
        const databaseReferences = await resolveDatabaseObjectReferences({
            targetUrl: databaseTargetUrl,
            expectedTargetRuntimeIdentitySha256: targetRuntimeIdentitySha256,
            confirmTargetIsolated: true,
          });
        const referenceReceipt = await verifyRepresentativeApplicationReads({
          databaseReferences,
          entries,
          openRestoredObject,
          maximumObjectBytes: config.limits.maxObjectBytes,
        });
        if (referenceReceipt.notApplicableNoStoredReferences === true) {
          return referenceReceipt;
        }
        if (typeof applicationRouteReadSmoke !== "function") {
          throw new RecoveryError(
            "APPLICATION_READ_SMOKE_REQUIRED",
            "An isolated RIVT application-route read adapter is unavailable.",
          );
        }
        const routeReceipt = await applicationRouteReadSmoke(Object.freeze({
          expectedTargetRuntimeIdentitySha256: targetRuntimeIdentitySha256,
          databaseReferences: Object.freeze(databaseReferences.map((reference) => Object.freeze({
            sourceKey: reference.sourceKey,
            storageScope: reference.storageScope,
          }))),
          entries: Object.freeze(entries.map((entry) => Object.freeze({
            sourceKey: entry.sourceKey,
            plaintextBytes: entry.plaintextBytes,
            plaintextSha256: entry.plaintextSha256,
            storageScopes: Object.freeze([...entry.storageScopes]),
          }))),
          targetReferenceByteSmoke: Object.freeze({ ...referenceReceipt }),
        }));
        if (
          routeReceipt?.ok !== true
          || routeReceipt?.mode !== "isolated-application-route"
          || routeReceipt?.representativeObjectCount !== referenceReceipt.representativeObjectCount
        ) {
          throw new RecoveryError(
            "APPLICATION_READ_SMOKE_FAILED",
            "The isolated RIVT application-route read smoke did not match the restored references.",
          );
        }
        return {
          ok: true,
          mode: "isolated-application-route",
          representativeObjectCount: routeReceipt.representativeObjectCount,
          targetReferenceByteSmokePassed: true,
        };
      },
    });
    assertRestoreReceipt(
      result,
      databaseReceipt,
      config.sourceCommit,
      targetRuntimeIdentitySha256,
    );
  } catch (error) {
    operationError = error;
  } finally {
    if (databaseRestoreStarted) {
      try {
        databaseCleanupReceipt = await cleanupDatabaseTarget({
          sourceUrl: databaseSourceUrl,
          protectedDatabaseUrls: [productionDatabaseUrl],
          targetUrl: databaseTargetUrl,
          confirmTargetIsolated: true,
          confirmTemporaryDataDeletion: true,
          expectedTargetRuntimeIdentitySha256: targetRuntimeIdentitySha256,
        });
        if (
          databaseCleanupReceipt?.targetDatabaseCleaned !== true
          || databaseCleanupReceipt.targetRuntimeIdentitySha256 !== targetRuntimeIdentitySha256
        ) {
          throw new Error("cleanup receipt invalid");
        }
      } catch {
        operationError = new RecoveryError(
          "RESTORE_CLEANUP_FAILED",
          "Isolated database restore cleanup did not complete.",
        );
      }
    }
    destroyRecoveryClients([readerClient, restoreClient]);
  }
  if (operationError) throw operationError;
  const durationMs = enforceCompleteRecoveryRto(
    startedAt,
    completeRecoveryClockMilliseconds(clock),
  );
  return {
    ...result,
    mode: "restore-complete-recovery-set",
    databaseTargetCleaned: databaseCleanupReceipt?.targetDatabaseCleaned === true,
    durationMs,
  };
}

export async function runRestoreCompleteRecoverySetCli({
  execute = () => restoreCompleteRecoverySet(),
  stdout = (value) => console.log(value),
  stderr = (value) => console.error(value),
} = {}) {
  try {
    stdout(JSON.stringify(sanitizedRecoverySuccess(await execute()), null, 2));
    return 0;
  } catch (error) {
    stderr(JSON.stringify(sanitizedRecoveryFailure(error, "restore-complete-recovery-set"), null, 2));
    return 1;
  }
}

if (isDirectExecution(import.meta.url)) {
  process.exitCode = await runRestoreCompleteRecoverySetCli();
}
