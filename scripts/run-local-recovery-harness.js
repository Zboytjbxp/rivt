import crypto from "node:crypto";
import {
  InMemoryObjectStore,
  backupRecoverySnapshot,
  buildDatabaseRecoveryBinding,
  buildRelationalObjectManifestFromSnapshot,
  canonicalRecoveryJson,
  recoveryObjectInternals,
  recoveryDatabaseEncryptionSecret,
  recoverySetIdForDatabaseBinding,
  verifyRecoverySnapshot,
} from "./recovery-object-utils.js";
import {
  POSTGRES_TEXT_ROW_ENCODING,
  canonicalTableDigest,
  encryptSnapshot,
} from "./logical-backup-utils.js";
import { completeRecoveryDatabaseIdentitySha256 } from "./complete-recovery-database.js";
import { verifyIsolatedApplicationRouteReads } from "./isolated-application-route-reader.js";

const unexpectedArguments = process.argv.slice(2);
if (unexpectedArguments.length) {
  console.error("The local recovery harness accepts no command-line arguments.");
  process.exit(1);
}
if (
  process.env.RECOVERY_HARNESS_MODE !== "local-memory"
  || process.env.CONFIRM_RECOVERY_LOCAL_ONLY !== "true"
) {
  console.error(
    "RECOVERY_HARNESS_MODE=local-memory and CONFIRM_RECOVERY_LOCAL_ONLY=true are required.",
  );
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  console.error("The local recovery harness cannot run with NODE_ENV=production.");
  process.exit(1);
}

const fixtures = {
  "fixture/photo.bin": Buffer.from("local fixture photo bytes"),
  "fixture/document.bin": Buffer.from("local fixture document bytes"),
  "fixture/evidence.bin": Buffer.from("local fixture evidence bytes"),
};
const ownerAccountId = "10000000-0000-4000-8000-000000000001";
const uploadRows = Object.entries(fixtures).map(([objectKey, value], index) => ({
  uploadId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  ownerAccountId,
  kind: ["photo", "document", "evidence"][index],
  objectKey,
  mimeType: "application/octet-stream",
  sizeBytes: value.length,
  uploadStatus: "stored",
  storageScope: ["album", "message", "professional-profile"][index],
  contentSha256: recoveryObjectInternals.sha256Hex(value),
}));
const sourceBinding = {
  logicalBucket: "primary",
  provider: "local-memory",
  region: "local",
  bucketIdentity: "fixture-source",
  endpointFingerprint: recoveryObjectInternals.sha256Hex("local-memory"),
  coordinateIdentitySha256: recoveryObjectInternals.sha256Hex("local-memory-source"),
};
const uploadColumns = [
  "id",
  "session_id",
  "account_id",
  "kind",
  "object_key",
  "mime_type",
  "size_bytes",
  "upload_status",
  "storage_scope",
  "content_sha256",
].map((name) => ({ name, typeName: "text", identityGeneration: null }));
const createdAt = "2026-07-29T00:00:00.000Z";
const sourceCommit = "1".repeat(40);
const uploadSnapshotRows = uploadRows.map((row) => ({
  id: row.uploadId,
  session_id: row.ownerAccountId,
  account_id: row.ownerAccountId,
  kind: row.kind,
  object_key: row.objectKey,
  mime_type: row.mimeType,
  size_bytes: String(row.sizeBytes),
  upload_status: row.uploadStatus,
  storage_scope: row.storageScope,
  content_sha256: row.contentSha256,
}));
const tableDigests = {
  uploads: canonicalTableDigest(uploadSnapshotRows, uploadColumns),
};
const snapshot = {
  format: "rivt-logical-backup-v2",
  rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
  createdAt,
  sourceCommit,
  manifest: {
    format: "rivt-logical-backup-manifest-v2",
    rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
    createdAt,
    sourceCommit,
    tableCount: 1,
    rowCount: uploadSnapshotRows.length,
    counts: { uploads: uploadSnapshotRows.length },
    tableDigests,
  },
  sequences: [],
  tables: [{ name: "uploads", columns: uploadColumns, rows: uploadSnapshotRows }],
};
const relationalManifest = buildRelationalObjectManifestFromSnapshot(snapshot, { sourceBinding });
const sourceStore = new InMemoryObjectStore(fixtures, {
  name: "local-source",
  identitySha256: sourceBinding.coordinateIdentitySha256,
  bindingIdentitySha256: recoveryObjectInternals.sha256Hex(
    canonicalRecoveryJson(sourceBinding),
  ),
});
const backupStore = new InMemoryObjectStore({}, { name: "local-backup" });
const restoreStore = new InMemoryObjectStore({}, { name: "local-restore" });
const masterKey = crypto.randomBytes(32);
const databaseBinding = buildDatabaseRecoveryBinding(snapshot);
const snapshotId = recoverySetIdForDatabaseBinding(masterKey, databaseBinding);
const limits = {
  maxObjects: 10,
  maxObjectBytes: 1024 * 1024,
  maxTotalBytes: 3 * 1024 * 1024,
  concurrency: 1,
};
const targetRuntimeIdentity = Object.freeze({
  systemIdentifier: "7000000000000000001",
  databaseOid: "17001",
  databaseName: "rivt_local_restore",
});
const targetRuntimeIdentitySha256 = completeRecoveryDatabaseIdentitySha256(targetRuntimeIdentity);
const databaseReferences = uploadRows.map((row) => Object.freeze({
  uploadId: row.uploadId,
  ownerAccountId: row.ownerAccountId,
  sourceKey: row.objectKey,
  storageScope: row.storageScope,
}));

function localRoutePool() {
  const client = {
    async query(sql, parameters = []) {
      if (/SELECT object_key/u.test(sql)) {
        const reference = databaseReferences.find((candidate) => (
          candidate.uploadId === parameters[0]
          && candidate.ownerAccountId === parameters[1]
        ));
        return reference
          ? { rowCount: 1, rows: [{ object_key: reference.sourceKey }] }
          : { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  return {
    async connect() { return client; },
    async end() {},
  };
}

const backup = await backupRecoverySnapshot({
  sourceStore,
  destinationStore: backupStore,
  relationalManifest,
  databaseBinding,
  databaseArtifact: Buffer.from(JSON.stringify(
    encryptSnapshot(
      snapshot,
      recoveryDatabaseEncryptionSecret(masterKey, databaseBinding),
    ),
  )),
  masterKey,
  snapshotId,
  minimumRetentionUntil: "2098-01-01T00:00:00.000Z",
  limits,
});
const completionWrittenLast =
  backupStore.operations.at(-1)?.key === recoveryObjectInternals.completionKeyFor(snapshotId);
const restore = await verifyRecoverySnapshot({
  backupStore,
  restoreStore,
  masterKey,
  snapshotId,
  completionVersionId: backup.completionVersionId,
  completionSha256: backup.completionSha256,
  minimumRetentionUntil: "2098-01-01T00:00:00.000Z",
  expectedSourceStoreIdentitySha256: sourceBinding.coordinateIdentitySha256,
  limits,
  applicationReadSmoke: async ({ entries, openRestoredObject }) => {
    return verifyIsolatedApplicationRouteReads({
      targetUrl: "postgresql://local@isolated.invalid/rivt_local_restore",
      protectedDatabaseUrls: ["postgresql://local@source.invalid/rivt"],
      confirmTargetIsolated: true,
      expectedTargetRuntimeIdentitySha256: targetRuntimeIdentitySha256,
      databaseReferences,
      entries,
      openRestoredObject,
      maximumObjectBytes: limits.maxObjectBytes,
      targetReferenceByteSmoke: { targetReferenceByteSmokePassed: true },
      poolFactory: localRoutePool,
      readRuntimeDatabaseIdentity: async () => targetRuntimeIdentity,
    });
  },
});

for (const [key, expected] of Object.entries(fixtures)) {
  const restored = restoreStore.value(key);
  if (!restored?.equals(expected)) {
    throw new Error("Local restore fixture did not match its source.");
  }
}

console.log(JSON.stringify({
  ok: true,
  mode: "local-memory",
  providerIo: false,
  productionDataRead: false,
  chargeBearingAction: false,
  objectCount: restore.objectCount,
  totalPlaintextBytes: restore.totalPlaintextBytes,
  completionWrittenLast,
  contentVerified: restore.contentVerified,
  applicationReadSmokePassed: restore.applicationReadSmokePassed,
  applicationReadSmokeEvidenceLevel: restore.applicationReadSmokeEvidenceLevel,
  maximumObservedChunkBytes: Math.max(
    sourceStore.maximumObservedChunkBytes,
    backupStore.maximumObservedChunkBytes,
    restoreStore.maximumObservedChunkBytes,
  ),
  backupDurationMs: backup.durationMs,
  restoreDurationMs: restore.durationMs,
}, null, 2));
