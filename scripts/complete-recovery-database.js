import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  BackupConfigurationError,
  DEFAULT_RECOVERY_RTO_MINUTES,
  ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2,
  LOGICAL_BACKUP_FORMAT_V2,
  LOGICAL_BACKUP_MANIFEST_FORMAT_V2,
  POSTGRES_TEXT_ROW_ENCODING,
  acquireLogicalBackupLock,
  aggregateTableDigest,
  assertBackupCatalogComplete,
  assertBackupDatabaseRoleReadOnly,
  assertDifferentDatabases,
  assertDifferentRuntimeDatabases,
  assertRestoreUsableSnapshot,
  beginReadOnlyBackupSnapshot,
  canonicalTableColumns,
  configureCanonicalTextSession,
  countTableRows,
  databaseTableDigests,
  diffCounts,
  diffTableDigests,
  encryptSnapshot,
  enforceRecoveryRto,
  foreignKeyDependencies,
  orderedTables,
  poolFor,
  publicTables,
  requireConfiguredEnv,
  requiredSourceCommit,
  rowsForTable,
  runtimeDatabaseIdentity,
  sequenceStates,
  sha256Hex,
  snapshotTableDigests,
  strictEncryptionKeyFromSecret,
  sumCounts,
  tableColumns,
} from "./logical-backup-utils.js";
import { applySnapshotToTarget } from "./restore-logical-backup-artifact.js";
import {
  buildDatabaseRecoveryBinding,
  recoveryDatabaseEncryptionSecret,
} from "./recovery-object-utils.js";
import { migrateUp, migrationStatus } from "../server/migrations.js";
import {
  ApplicationObjectBarrierError,
  acquireApplicationObjectCaptureLease,
} from "../server/application-object-mutation-barrier.js";

const CAPTURE_OPERATIONS = Object.freeze({
  runtimeDatabaseIdentity,
  acquireLogicalBackupLock,
  beginReadOnlyBackupSnapshot,
  assertBackupDatabaseRoleReadOnly,
  assertBackupCatalogComplete,
  publicTables,
  countTableRows,
  tableColumns,
  rowsForTable,
  sequenceStates,
});

const RESTORE_OPERATIONS = Object.freeze({
  runtimeDatabaseIdentity,
  assertBackupCatalogComplete,
  configureCanonicalTextSession,
  publicTables,
  tableColumns,
  sequenceStates,
  foreignKeyDependencies,
  orderedTables,
  applySnapshotToTarget,
  countTableRows,
  databaseTableDigests,
});

const CLEANUP_OPERATIONS = Object.freeze({
  runtimeDatabaseIdentity,
  publicTables,
  sequenceStates,
});

async function storedUploadReferences(client) {
  const result = await client.query(`
    SELECT DISTINCT ON (upload.storage_scope)
      upload.id AS upload_id,
      COALESCE(upload.account_id::text, upload.session_id) AS owner_account_id,
      upload.object_key AS source_key,
      upload.storage_scope
    FROM public.uploads upload
    INNER JOIN public.auth_users auth_user
      ON auth_user.id::text = COALESCE(upload.account_id::text, upload.session_id)
    INNER JOIN public.accounts account
      ON account.id = auth_user.id
    INNER JOIN public.profiles profile
      ON profile.account_id = auth_user.id
    WHERE upload.upload_status = 'stored'
      AND upload.object_key IS NOT NULL
    ORDER BY upload.storage_scope, upload.id
    LIMIT 65
  `);
  return result.rows;
}

const REFERENCE_OPERATIONS = Object.freeze({
  runtimeDatabaseIdentity,
  storedUploadReferences,
});

async function runtimeDatabaseIdentityForPool(pool) {
  let client;
  try {
    client = await pool.connect();
    if (!client || typeof client.query !== "function" || typeof client.release !== "function") {
      throw new Error("Database pool returned no usable client.");
    }
    return await runtimeDatabaseIdentity(client);
  } finally {
    client?.release();
  }
}

function randomAdvisoryChallengeKey() {
  return randomBytes(8).readBigInt64BE().toString();
}

async function assertSharedAdvisoryLockNamespace(
  sourcePool,
  applicationPool,
  { challengeKeyFactory = randomAdvisoryChallengeKey } = {},
) {
  const challengeKey = challengeKeyFactory();
  if (typeof challengeKey !== "string" || !/^-?[0-9]{1,20}$/u.test(challengeKey)) {
    throw new Error("Invalid advisory-lock challenge key.");
  }
  let sourceClient;
  let applicationClient;
  let sourceHeld = false;
  let applicationHeld = false;
  let sameNamespace = false;
  let cleanupFailed = false;
  let operationError;
  try {
    sourceClient = await sourcePool.connect();
    applicationClient = await applicationPool.connect();
    if (
      !sourceClient || typeof sourceClient.query !== "function" || typeof sourceClient.release !== "function"
      || !applicationClient || typeof applicationClient.query !== "function"
      || typeof applicationClient.release !== "function"
    ) {
      throw new Error("Database pool returned no usable client.");
    }
    const sourceResult = await sourceClient.query(
      "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
      [challengeKey],
    );
    if (sourceResult?.rows?.[0]?.acquired !== true) {
      throw new Error("The advisory-lock challenge could not be acquired.");
    }
    sourceHeld = true;
    const applicationResult = await applicationClient.query(
      "SELECT pg_try_advisory_lock_shared($1::bigint) AS acquired",
      [challengeKey],
    );
    if (applicationResult?.rows?.[0]?.acquired === true) {
      applicationHeld = true;
    } else if (applicationResult?.rows?.[0]?.acquired === false) {
      sameNamespace = true;
    } else {
      throw new Error("The advisory-lock challenge returned an invalid result.");
    }
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    if (applicationHeld) {
      try {
        const result = await applicationClient.query(
          "SELECT pg_advisory_unlock_shared($1::bigint) AS released",
          [challengeKey],
        );
        if (result?.rows?.[0]?.released !== true) cleanupFailed = true;
      } catch {
        cleanupFailed = true;
      }
    }
    if (sourceHeld) {
      try {
        const result = await sourceClient.query(
          "SELECT pg_advisory_unlock($1::bigint) AS released",
          [challengeKey],
        );
        if (result?.rows?.[0]?.released !== true) cleanupFailed = true;
      } catch {
        cleanupFailed = true;
      }
    }
    try {
      applicationClient?.release(
        operationError || cleanupFailed ? new Error("challenge operation failed") : undefined,
      );
    } catch {
      cleanupFailed = true;
    }
    try {
      sourceClient?.release(
        operationError || cleanupFailed ? new Error("challenge operation failed") : undefined,
      );
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed) throw new Error("The advisory-lock challenge could not be released safely.");
  if (!sameNamespace) {
    throw new BackupConfigurationError(
      "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
      "The application mutation barrier and recovery capture do not share one PostgreSQL advisory-lock namespace.",
    );
  }
}

/**
 * Hold the exclusive side of the application-object mutation protocol on the
 * exact backup-source database. The caller must retain the returned lease
 * through the relational snapshot and both object-store inventories/staging.
 */
export async function acquireCompleteRecoveryCaptureBarrier({
  env = process.env,
  poolFactory = poolFor,
  acquireLease = acquireApplicationObjectCaptureLease,
  probeRuntimeIdentity = runtimeDatabaseIdentityForPool,
  proveSharedLockNamespace = assertSharedAdvisoryLockNamespace,
} = {}) {
  const sourceUrl = requireConfiguredEnv("BACKUP_DATABASE_URL", env);
  const applicationUrl = requireConfiguredEnv("DATABASE_URL", env);
  if (
    typeof poolFactory !== "function"
    || typeof acquireLease !== "function"
    || typeof probeRuntimeIdentity !== "function"
    || typeof proveSharedLockNamespace !== "function"
  ) {
    throw new BackupConfigurationError(
      "RECOVERY_OBJECT_MUTATION_BARRIER_UNAVAILABLE",
      "Complete-recovery capture barrier dependencies must be functions.",
    );
  }
  let pool;
  let applicationPool;
  let lease;
  let sourceRuntimeIdentitySha256;
  let applicationRuntimeIdentitySha256;
  let applicationPoolClosed = false;
  try {
    pool = poolFactory(sourceUrl, env);
    applicationPool = poolFactory(applicationUrl, env);
    lease = await acquireLease(pool, { identityProbe: runtimeDatabaseIdentity });
    sourceRuntimeIdentitySha256 = completeRecoveryDatabaseIdentitySha256(lease.runtimeIdentity);
    applicationRuntimeIdentitySha256 = completeRecoveryDatabaseIdentitySha256(
      await probeRuntimeIdentity(applicationPool),
    );
    if (applicationRuntimeIdentitySha256 !== sourceRuntimeIdentitySha256) {
      throw new BackupConfigurationError(
        "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
        "The application mutation barrier and recovery capture do not address the same PostgreSQL database.",
      );
    }
    await proveSharedLockNamespace(pool, applicationPool);
    await applicationPool.end();
    applicationPoolClosed = true;
  } catch (error) {
    await lease?.release().catch(() => undefined);
    await pool?.end?.().catch(() => undefined);
    if (!applicationPoolClosed) await applicationPool?.end?.().catch(() => undefined);
    if (error instanceof ApplicationObjectBarrierError && error.code === "APPLICATION_OBJECT_BARRIER_BUSY") {
      throw new BackupConfigurationError(
        "RECOVERY_OBJECT_MUTATION_ACTIVE",
        "An application object mutation is active; recovery capture did not start.",
      );
    }
    if (error?.code === "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH") throw error;
    throw new BackupConfigurationError(
      "RECOVERY_OBJECT_MUTATION_BARRIER_UNAVAILABLE",
      "The application-object recovery barrier is unavailable.",
    );
  }

  let releasePromise;
  return Object.freeze({
    sourceRuntimeIdentitySha256,
    applicationRuntimeIdentitySha256,
    release() {
      releasePromise ??= (async () => {
        let releaseError;
        try {
          await lease.release();
        } catch {
          releaseError = new BackupConfigurationError(
            "RECOVERY_OBJECT_MUTATION_BARRIER_UNAVAILABLE",
            "The application-object recovery barrier could not be released safely.",
          );
        }
        try {
          await pool.end();
        } catch {
          releaseError ??= new BackupConfigurationError(
            "RECOVERY_OBJECT_MUTATION_BARRIER_UNAVAILABLE",
            "The application-object recovery barrier pool could not be closed safely.",
          );
        }
        if (releaseError) throw releaseError;
      })();
      return releasePromise;
    },
  });
}

function completeOperations(defaults, supplied) {
  const operations = { ...defaults, ...(supplied ?? {}) };
  for (const [name, operation] of Object.entries(operations)) {
    if (typeof operation !== "function") {
      throw new BackupConfigurationError(
        "BACKUP_CONFIG_INVALID",
        `Complete-recovery operation ${name} must be a function.`,
      );
    }
  }
  return operations;
}

function milliseconds(clock) {
  const value = clock();
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The recovery clock must return a nonnegative integer timestamp or valid Date.",
    );
  }
  return timestamp;
}

function snapshotTableMap(snapshot) {
  return new Map(snapshot.tables.map((table) => [table.name, table]));
}

function canonicalSequenceStates(states) {
  return [...states]
    .map((state) => ({
      sequenceName: state.sequenceName,
      lastValue: String(state.lastValue),
      isCalled: state.isCalled,
    }))
    .sort((left, right) => left.sequenceName.localeCompare(right.sequenceName));
}

function assertCompleteRecoverySnapshot(snapshot, authenticatedArtifact) {
  assertRestoreUsableSnapshot(snapshot, authenticatedArtifact);
  assert.deepEqual(
    snapshot.manifest.tableDigests,
    snapshotTableDigests(snapshot.tables),
    "Complete-recovery snapshots require exact authenticated table digests.",
  );
  return snapshot;
}

function assertExactTargetSchema(snapshot, targetTables, targetColumns, targetSequences) {
  const snapshotTableNames = snapshot.tables.map((table) => table.name).sort();
  assert.deepEqual([...targetTables].sort(), snapshotTableNames, "Restore target tables differ from the backup snapshot.");
  for (const table of snapshot.tables) {
    assert.deepEqual(
      canonicalTableColumns(targetColumns.get(table.name) ?? []),
      canonicalTableColumns(table.columns),
      "Restore target columns differ from the backup snapshot.",
    );
  }
  assert.deepEqual(
    canonicalSequenceStates(targetSequences).map((state) => state.sequenceName),
    canonicalSequenceStates(snapshot.sequences).map((state) => state.sequenceName),
    "Restore target sequences differ from the backup snapshot.",
  );
}

function assertEmptyCounts(counts, tableNames) {
  if (
    !counts
    || typeof counts !== "object"
    || !Array.isArray(tableNames)
    || JSON.stringify(Object.keys(counts).sort()) !== JSON.stringify([...tableNames].sort())
    || Object.values(counts).some((count) => !Number.isSafeInteger(count) || count !== 0)
  ) {
    throw new BackupConfigurationError(
      "RESTORE_TARGET_NOT_EMPTY",
      "The isolated restore target must contain no rows before snapshot application.",
    );
  }
}

function exactRuntimeDatabaseIdentity(identity) {
  const normalized = {
    systemIdentifier: String(identity?.systemIdentifier ?? ""),
    databaseOid: String(identity?.databaseOid ?? ""),
    databaseName: String(identity?.databaseName ?? ""),
  };
  if (
    !/^\d+$/u.test(normalized.systemIdentifier)
    || !/^\d+$/u.test(normalized.databaseOid)
    || !normalized.databaseName
    || normalized.databaseName !== normalized.databaseName.trim()
    || /[\u0000-\u001f\u007f]/u.test(normalized.databaseName)
  ) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Runtime PostgreSQL identity is invalid.",
    );
  }
  return normalized;
}

export function completeRecoveryDatabaseIdentitySha256(identity) {
  const normalized = exactRuntimeDatabaseIdentity(identity);
  return sha256Hex(JSON.stringify([
    "rivt-complete-recovery-runtime-database-v1",
    normalized.systemIdentifier,
    normalized.databaseOid,
    normalized.databaseName,
  ]));
}

function exactExpectedRuntimeIdentitySha256(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "An exact target runtime identity digest is required.",
    );
  }
  return value;
}

function assertRuntimeIdentityDigest(identity, expected) {
  if (completeRecoveryDatabaseIdentitySha256(identity) !== expected) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The isolated target runtime database identity changed.",
    );
  }
}

function assertSourceRuntimeIdentityDigest(identity, expected) {
  if (completeRecoveryDatabaseIdentitySha256(identity) !== expected) {
    throw new BackupConfigurationError(
      "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
      "The capture lease and relational snapshot do not address the same PostgreSQL database.",
    );
  }
}

function normalizedStoredReferences(rows) {
  if (!Array.isArray(rows) || rows.length > 64) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Restored upload references exceed the read-smoke safety limit.",
    );
  }
  const seenScopes = new Set();
  return rows.map((row) => {
    const uploadId = String(row?.uploadId ?? row?.upload_id ?? "");
    const ownerAccountId = String(row?.ownerAccountId ?? row?.owner_account_id ?? "");
    const sourceKey = String(row?.sourceKey ?? row?.source_key ?? "");
    const storageScope = String(row?.storageScope ?? row?.storage_scope ?? "");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(uploadId)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(ownerAccountId)
      || !sourceKey
      || Buffer.byteLength(sourceKey, "utf8") > 1_024
      || /[\u0000-\u001f\u007f]/u.test(sourceKey)
      || !storageScope
      || storageScope !== storageScope.trim()
      || Buffer.byteLength(storageScope, "utf8") > 128
      || /[\u0000-\u001f\u007f]/u.test(storageScope)
    ) {
      throw new BackupConfigurationError(
        "BACKUP_CONFIG_INVALID",
        "A restored upload reference is invalid.",
      );
    }
    if (seenScopes.has(storageScope)) {
      throw new BackupConfigurationError(
        "BACKUP_CONFIG_INVALID",
        "Restored upload references contain more than one representative for a storage scope.",
      );
    }
    seenScopes.add(storageScope);
    return Object.freeze({ uploadId, ownerAccountId, sourceKey, storageScope });
  });
}

/**
 * Capture the database member of a complete recovery set. This deliberately
 * has no object-storage dependency: the caller owns persistence and must not
 * publish a complete recovery-set marker until every member is durable.
 */
export async function captureCompleteRecoveryDatabaseSnapshot({
  env = process.env,
  now = () => new Date(),
  expectedSourceRuntimeIdentitySha256,
  poolFactory = poolFor,
  operations: suppliedOperations,
} = {}) {
  const sourceUrl = requireConfiguredEnv("BACKUP_DATABASE_URL", env);
  const sourceCommit = requiredSourceCommit(env);
  const expectedRuntimeIdentitySha256 = exactExpectedRuntimeIdentitySha256(
    expectedSourceRuntimeIdentitySha256,
  );
  const capturedAt = now();
  if (!(capturedAt instanceof Date) || !Number.isFinite(capturedAt.getTime())) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "The backup clock must return a valid Date.");
  }
  const createdAt = capturedAt.toISOString();
  const operations = completeOperations(CAPTURE_OPERATIONS, suppliedOperations);
  const pool = poolFactory(sourceUrl, env);
  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    const sourceRuntimeIdentity = await operations.runtimeDatabaseIdentity(client);
    assertSourceRuntimeIdentityDigest(sourceRuntimeIdentity, expectedRuntimeIdentitySha256);
    await operations.acquireLogicalBackupLock(client);
    await operations.beginReadOnlyBackupSnapshot(client);
    transactionStarted = true;
    try {
      await operations.assertBackupDatabaseRoleReadOnly(client);
      await operations.assertBackupCatalogComplete(client);
      const tableNames = await operations.publicTables(client);
      const counts = await operations.countTableRows(client, tableNames);
      const tables = [];
      for (const tableName of tableNames) {
        const columns = await operations.tableColumns(client, tableName);
        tables.push({
          name: tableName,
          columns,
          rows: await operations.rowsForTable(client, tableName, columns),
        });
      }
      const manifest = {
        format: LOGICAL_BACKUP_MANIFEST_FORMAT_V2,
        rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
        createdAt,
        sourceCommit,
        tableCount: tableNames.length,
        rowCount: sumCounts(counts),
        counts,
        tableDigests: snapshotTableDigests(tables),
      };
      const snapshot = {
        format: LOGICAL_BACKUP_FORMAT_V2,
        rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
        createdAt,
        sourceCommit,
        manifest,
        sequences: await operations.sequenceStates(client),
        tables,
      };
      await client.query("COMMIT");
      transactionStarted = false;
      return snapshot;
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
        transactionStarted = false;
      }
      throw error;
    }
  } finally {
    client?.release();
    await pool.end();
  }
}

/**
 * Encrypt a validated v2 snapshot with exactly one strict active key and
 * return the exact JSON bytes which the recovery-set writer must persist.
 */
export function encryptCompleteRecoveryDatabaseSnapshot(snapshot, activeEncryptionSecret) {
  const normalizedActiveSecret = typeof activeEncryptionSecret === "string"
    ? activeEncryptionSecret.trim()
    : activeEncryptionSecret;
  strictEncryptionKeyFromSecret(normalizedActiveSecret);
  assertCompleteRecoverySnapshot(snapshot, {
    createdAt: snapshot?.createdAt,
    sourceCommit: snapshot?.sourceCommit,
  });
  const databaseBinding = buildDatabaseRecoveryBinding(snapshot);
  const envelope = encryptSnapshot(
    snapshot,
    recoveryDatabaseEncryptionSecret(normalizedActiveSecret, databaseBinding),
  );
  if (envelope.format !== ENCRYPTED_LOGICAL_BACKUP_FORMAT_V2) {
    throw new BackupConfigurationError("BACKUP_OBJECT_INVALID", "Complete recovery requires encrypted logical backup v2.");
  }
  const bytes = Buffer.from(JSON.stringify(envelope), "utf8");
  return {
    envelope,
    bytes,
    sha256: sha256Hex(bytes),
    byteLength: bytes.length,
    createdAt: snapshot.createdAt,
    sourceCommit: snapshot.sourceCommit,
    tableCount: snapshot.manifest.tableCount,
    rowCount: snapshot.manifest.rowCount,
    contentDigest: aggregateTableDigest(snapshot.manifest.tableDigests),
    encryptionKeyMode: "active-only",
  };
}

function protectedDatabaseUrlSet(sourceUrl, additionalProtectedDatabaseUrls) {
  if (!Array.isArray(additionalProtectedDatabaseUrls)) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Protected database URLs must be provided as an array.",
    );
  }
  const urls = [sourceUrl, ...additionalProtectedDatabaseUrls].map((value) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new BackupConfigurationError(
        "BACKUP_CONFIG_INVALID",
        "Every protected database URL must be explicit.",
      );
    }
    return value.trim();
  });
  return [...new Set(urls)];
}

/**
 * Restore an already authenticated and decrypted database member. Decryption
 * and proof that the active key was used remain the caller's responsibility;
 * the explicit authenticationMode prevents an ambiguous fallback restore.
 */
export async function restoreCompleteRecoveryDatabaseSnapshot({
  authenticatedSnapshot,
  authenticatedArtifact,
  authenticationMode,
  sourceUrl,
  protectedDatabaseUrls = [],
  targetUrl,
  confirmTargetIsolated = false,
  applyMigrations = false,
  batchSize = 200,
  rtoMinutes = DEFAULT_RECOVERY_RTO_MINUTES,
  poolFactory = poolFor,
  migrateUpFn = migrateUp,
  migrationStatusFn = migrationStatus,
  migrationOptions,
  clock = () => Date.now(),
  onTargetMutationAuthorized = () => undefined,
  operations: suppliedOperations,
} = {}) {
  if (confirmTargetIsolated !== true) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Explicit isolated-target confirmation is required for a destructive complete-recovery restore.",
    );
  }
  if (authenticationMode !== "active-key-only") {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The caller must authenticate the database member with the active backup key only.",
    );
  }
  if (typeof sourceUrl !== "string" || !sourceUrl.trim() || typeof targetUrl !== "string" || !targetUrl.trim()) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "Explicit source and target database URLs are required.");
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "Restore batch size must be between 1 and 1000.");
  }
  if (!Number.isSafeInteger(rtoMinutes) || rtoMinutes < 1 || rtoMinutes > DEFAULT_RECOVERY_RTO_MINUTES) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      `Recovery RTO must be between 1 and ${DEFAULT_RECOVERY_RTO_MINUTES} minutes.`,
    );
  }
  if (
    typeof poolFactory !== "function"
    || typeof migrateUpFn !== "function"
    || typeof migrationStatusFn !== "function"
    || typeof onTargetMutationAuthorized !== "function"
  ) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "Recovery database dependencies must be functions.");
  }

  assertCompleteRecoverySnapshot(authenticatedSnapshot, authenticatedArtifact);
  const protectedUrls = protectedDatabaseUrlSet(sourceUrl, protectedDatabaseUrls);
  for (const protectedUrl of protectedUrls) assertDifferentDatabases(protectedUrl, targetUrl);
  const operations = completeOperations(RESTORE_OPERATIONS, suppliedOperations);
  const recoveryStartedAt = milliseconds(clock);
  let protectedPools = [];
  let targetPool;
  let protectedClients = [];
  let targetClient;
  try {
    protectedPools = protectedUrls.map((url) => poolFactory(url));
    targetPool = poolFactory(targetUrl);
    for (const pool of protectedPools) protectedClients.push(await pool.connect());
    targetClient = await targetPool.connect();
    const targetIdentity = await operations.runtimeDatabaseIdentity(targetClient);
    const targetRuntimeIdentitySha256 = completeRecoveryDatabaseIdentitySha256(targetIdentity);
    const protectedIdentities = [];
    for (const protectedClient of protectedClients) {
      const protectedIdentity = await operations.runtimeDatabaseIdentity(protectedClient);
      protectedIdentities.push(protectedIdentity);
      assertDifferentRuntimeDatabases(protectedIdentity, targetIdentity);
    }

    if (applyMigrations) {
      const preMigrationTables = await operations.publicTables(targetClient);
      if (!Array.isArray(preMigrationTables) || preMigrationTables.length !== 0) {
        throw new BackupConfigurationError(
          "RESTORE_TARGET_NOT_EMPTY",
          "A migrate-and-restore target must have zero public tables before migrations.",
        );
      }
      await onTargetMutationAuthorized(Object.freeze({ targetRuntimeIdentitySha256 }));
      targetClient.release();
      targetClient = undefined;
      await migrateUpFn(targetPool, migrationOptions);
      targetClient = await targetPool.connect();
      const reconnectedTargetIdentity = await operations.runtimeDatabaseIdentity(targetClient);
      assertRuntimeIdentityDigest(reconnectedTargetIdentity, targetRuntimeIdentitySha256);
      for (const protectedIdentity of protectedIdentities) {
        assertDifferentRuntimeDatabases(protectedIdentity, reconnectedTargetIdentity);
      }
      await operations.assertBackupCatalogComplete(targetClient);
    } else {
      await operations.assertBackupCatalogComplete(targetClient);
    }

    await targetClient.query("SET statement_timeout = '60s'");
    await operations.configureCanonicalTextSession(targetClient);
    const targetTables = await operations.publicTables(targetClient);
    const targetColumns = new Map();
    for (const tableName of targetTables) {
      targetColumns.set(tableName, await operations.tableColumns(targetClient, tableName));
    }
    const targetSequencesBefore = await operations.sequenceStates(targetClient);
    assertExactTargetSchema(authenticatedSnapshot, targetTables, targetColumns, targetSequencesBefore);

    if (!applyMigrations) {
      assertEmptyCounts(await operations.countTableRows(targetClient, targetTables), targetTables);
    }

    const dependencies = await operations.foreignKeyDependencies(targetClient, targetTables);
    const copyOrder = operations.orderedTables(targetTables, dependencies);
    const status = await migrationStatusFn(targetPool, migrationOptions);
    assert.deepEqual(status.pending, [], "Restore target has pending migrations.");

    if (!applyMigrations) {
      await onTargetMutationAuthorized(Object.freeze({ targetRuntimeIdentitySha256 }));
    }

    await operations.applySnapshotToTarget(targetClient, {
      copyOrder,
      snapshotTables: snapshotTableMap(authenticatedSnapshot),
      sequences: authenticatedSnapshot.sequences,
      batchSize,
    });

    const verificationStartedAt = milliseconds(clock);
    const targetCounts = await operations.countTableRows(targetClient, targetTables);
    const countDiffs = diffCounts(authenticatedSnapshot.manifest.counts, targetCounts);
    assert.deepEqual(countDiffs, [], "Restore target row counts differ from the authenticated snapshot.");

    const expectedTableDigests = snapshotTableDigests(authenticatedSnapshot.tables);
    assert.deepEqual(
      authenticatedSnapshot.manifest.tableDigests,
      expectedTableDigests,
      "Authenticated snapshot manifest digests do not match its table content.",
    );
    const actualTableDigests = await operations.databaseTableDigests(targetClient, authenticatedSnapshot.tables);
    const contentDiffs = diffTableDigests(expectedTableDigests, actualTableDigests);
    assert.deepEqual(contentDiffs, [], "Restore target content differs from the authenticated snapshot.");

    const targetSequencesAfter = await operations.sequenceStates(targetClient);
    assert.deepEqual(
      canonicalSequenceStates(targetSequencesAfter),
      canonicalSequenceStates(authenticatedSnapshot.sequences),
      "Restore target sequence state differs from the authenticated snapshot.",
    );

    const completedAt = milliseconds(clock);
    const recoveryDurations = enforceRecoveryRto(
      verificationStartedAt - recoveryStartedAt,
      completedAt - verificationStartedAt,
      rtoMinutes,
    );
    return {
      ok: true,
      mode: applyMigrations ? "migrate-and-restore-complete-recovery-database" : "restore-complete-recovery-database",
      format: authenticatedSnapshot.format,
      backupCreatedAt: authenticatedSnapshot.createdAt,
      backupSourceCommit: authenticatedSnapshot.sourceCommit,
      authenticationMode,
      latestMigrationVersion: status.latestVersion ?? 0,
      appliedMigrationCount: status.applied.length,
      pendingMigrationCount: status.pending.length,
      tableCount: targetTables.length,
      rowCount: Object.values(targetCounts).reduce((total, count) => total + count, 0),
      sequenceCount: targetSequencesAfter.length,
      countDiffCount: countDiffs.length,
      contentDigest: aggregateTableDigest(actualTableDigests),
      contentDiffCount: contentDiffs.length,
      strictCounts: true,
      strictContentDigests: true,
      strictSequenceState: true,
      targetRuntimeIdentitySha256,
      ...recoveryDurations,
      durationMs: recoveryDurations.combinedDurationMs,
    };
  } finally {
    for (const protectedClient of protectedClients) protectedClient.release();
    targetClient?.release();
    await Promise.all(
      [...protectedPools, targetPool]
        .filter(Boolean)
        .map((pool) => pool.end()),
    );
  }
}

/**
 * Resolve representative object references from the restored target itself.
 * The read-only transaction is bound to the exact runtime database identity
 * authorized by the restore helper; authenticated input rows are not used.
 */
export async function resolveCompleteRecoveryDatabaseObjectReferences({
  targetUrl,
  expectedTargetRuntimeIdentitySha256,
  confirmTargetIsolated = false,
  poolFactory = poolFor,
  operations: suppliedOperations,
} = {}) {
  if (confirmTargetIsolated !== true || typeof targetUrl !== "string" || !targetUrl.trim()) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "An explicit isolated target is required for restored reference reads.",
    );
  }
  if (typeof poolFactory !== "function") {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "Recovery reference pool factory must be a function.");
  }
  const expectedIdentity = exactExpectedRuntimeIdentitySha256(expectedTargetRuntimeIdentitySha256);
  const operations = completeOperations(REFERENCE_OPERATIONS, suppliedOperations);
  const pool = poolFactory(targetUrl);
  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;
    await client.query("SET LOCAL statement_timeout = '60s'");
    const targetIdentity = await operations.runtimeDatabaseIdentity(client);
    assertRuntimeIdentityDigest(targetIdentity, expectedIdentity);
    const references = normalizedStoredReferences(await operations.storedUploadReferences(client));
    await client.query("COMMIT");
    transactionStarted = false;
    return references;
  } catch (error) {
    if (transactionStarted) await client?.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

/**
 * Remove only the contents of an already-proved isolated restore database.
 * Static and runtime identity checks are repeated immediately before the
 * destructive transaction so a production/source database cannot be used as
 * the cleanup target.
 */
export async function cleanupCompleteRecoveryDatabaseTarget({
  sourceUrl,
  protectedDatabaseUrls = [],
  targetUrl,
  confirmTargetIsolated = false,
  confirmTemporaryDataDeletion = false,
  expectedTargetRuntimeIdentitySha256,
  poolFactory = poolFor,
  operations: suppliedOperations,
} = {}) {
  if (confirmTargetIsolated !== true || confirmTemporaryDataDeletion !== true) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "Isolated-target and temporary-data-deletion confirmations are required.",
    );
  }
  if (typeof sourceUrl !== "string" || !sourceUrl.trim() || typeof targetUrl !== "string" || !targetUrl.trim()) {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "Explicit source and target database URLs are required.");
  }
  if (typeof poolFactory !== "function") {
    throw new BackupConfigurationError("BACKUP_CONFIG_INVALID", "Recovery cleanup pool factory must be a function.");
  }
  const protectedUrls = protectedDatabaseUrlSet(sourceUrl, protectedDatabaseUrls);
  for (const protectedUrl of protectedUrls) assertDifferentDatabases(protectedUrl, targetUrl);
  const expectedIdentity = exactExpectedRuntimeIdentitySha256(expectedTargetRuntimeIdentitySha256);
  const operations = completeOperations(CLEANUP_OPERATIONS, suppliedOperations);
  let protectedPools = [];
  let targetPool;
  let protectedClients = [];
  let targetClient;
  let transactionStarted = false;
  try {
    protectedPools = protectedUrls.map((url) => poolFactory(url));
    targetPool = poolFactory(targetUrl);
    for (const pool of protectedPools) protectedClients.push(await pool.connect());
    targetClient = await targetPool.connect();
    const targetIdentity = await operations.runtimeDatabaseIdentity(targetClient);
    assertRuntimeIdentityDigest(targetIdentity, expectedIdentity);
    for (const protectedClient of protectedClients) {
      const protectedIdentity = await operations.runtimeDatabaseIdentity(protectedClient);
      assertDifferentRuntimeDatabases(protectedIdentity, targetIdentity);
    }

    await targetClient.query("BEGIN");
    transactionStarted = true;
    await targetClient.query("DROP SCHEMA public CASCADE");
    await targetClient.query("CREATE SCHEMA public");
    await targetClient.query("COMMIT");
    transactionStarted = false;

    const remainingTables = await operations.publicTables(targetClient);
    const remainingSequences = await operations.sequenceStates(targetClient);
    if (remainingTables.length || remainingSequences.length) {
      throw new BackupConfigurationError(
        "RESTORE_CLEANUP_FAILED",
        "Isolated restore database cleanup left public data behind.",
      );
    }
    return {
      ok: true,
      targetDatabaseCleaned: true,
      targetRuntimeIdentitySha256: expectedIdentity,
      remainingTableCount: 0,
      remainingSequenceCount: 0,
    };
  } catch (error) {
    if (transactionStarted) await targetClient?.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    for (const protectedClient of protectedClients) protectedClient.release();
    targetClient?.release();
    await Promise.all([...protectedPools, targetPool].filter(Boolean).map((pool) => pool.end()));
  }
}
