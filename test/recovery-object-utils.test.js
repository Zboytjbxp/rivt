import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import test from "node:test";
import {
  InMemoryObjectStore,
  RecoveryError,
  assertRelationalManifestReady,
  backupRecoverySnapshot,
  buildDatabaseRecoveryBinding,
  buildRelationalObjectManifest,
  buildRelationalObjectManifestFromSnapshot,
  canonicalRecoveryJson,
  parseRecoveryMasterKey,
  recoveryObjectInternals,
  recoveryDatabaseEncryptionSecret,
  recoverySetIdForDatabaseBinding,
  sanitizedRecoveryFailure,
  sanitizedRecoverySuccess,
  verifyRecoverySnapshot,
} from "../scripts/recovery-object-utils.js";
import {
  POSTGRES_TEXT_ROW_ENCODING,
  canonicalTableDigest,
  encryptSnapshot,
} from "../scripts/logical-backup-utils.js";

const sourceBinding = {
  logicalBucket: "primary",
  provider: "local-memory",
  region: "local",
  bucketIdentity: "fixture-source",
  endpointFingerprint: recoveryObjectInternals.sha256Hex("fixture-endpoint"),
  coordinateIdentitySha256: recoveryObjectInternals.sha256Hex("fixture-source-coordinates"),
};

function sourceMemory(initialEntries = {}, options = {}) {
  return new InMemoryObjectStore(initialEntries, {
    ...options,
    identitySha256: sourceBinding.coordinateIdentitySha256,
    bindingIdentitySha256: recoveryObjectInternals.sha256Hex(
      canonicalRecoveryJson(sourceBinding),
    ),
  });
}

function uploadRow(objectKey, value, overrides = {}) {
  return {
    uploadId: crypto.randomUUID(),
    kind: "photo",
    objectKey,
    mimeType: "image/jpeg",
    sizeBytes: value.length,
    uploadStatus: "stored",
    storageScope: "album",
    contentSha256: recoveryObjectInternals.sha256Hex(value),
    ...overrides,
  };
}

function manifestFor(entries) {
  const snapshot = logicalSnapshot(entries);
  const manifest = buildRelationalObjectManifestFromSnapshot(snapshot, { sourceBinding });
  Object.defineProperty(manifest, "testSnapshot", { value: snapshot });
  return manifest;
}

const uploadColumns = [
  "id",
  "kind",
  "object_key",
  "mime_type",
  "size_bytes",
  "upload_status",
  "storage_scope",
  "content_sha256",
].map((name) => ({ name, typeName: "text", identityGeneration: null }));

function logicalSnapshot(entries, {
  createdAt = "2026-07-29T00:00:00.000Z",
  sourceCommit = "1".repeat(40),
} = {}) {
  const rows = entries.map((row) => ({
    id: row.uploadId ?? row.upload_id ?? row.id,
    kind: row.kind ?? "unknown",
    object_key: row.objectKey ?? row.object_key,
    mime_type: row.mimeType ?? row.mime_type ?? "application/octet-stream",
    size_bytes: String(row.sizeBytes ?? row.size_bytes),
    upload_status: row.uploadStatus ?? row.upload_status ?? "stored",
    storage_scope: row.storageScope ?? row.storage_scope ?? "legacy",
    content_sha256: row.contentSha256 ?? row.content_sha256 ?? null,
  }));
  const uploads = { name: "uploads", columns: uploadColumns, rows };
  const tableDigests = { uploads: canonicalTableDigest(rows, uploadColumns) };
  const manifest = {
    format: "rivt-logical-backup-manifest-v2",
    rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
    createdAt,
    sourceCommit,
    tableCount: 1,
    rowCount: rows.length,
    counts: { uploads: rows.length },
    tableDigests,
  };
  return {
    format: "rivt-logical-backup-v2",
    rowEncoding: POSTGRES_TEXT_ROW_ENCODING,
    createdAt,
    sourceCommit,
    manifest,
    sequences: [],
    tables: [uploads],
  };
}

function coordinatedArguments(relationalManifest, masterKey) {
  const snapshot = relationalManifest.testSnapshot;
  const databaseBinding = buildDatabaseRecoveryBinding(snapshot);
  const secret = recoveryDatabaseEncryptionSecret(masterKey, databaseBinding);
  return {
    databaseBinding,
    databaseArtifact: Buffer.from(JSON.stringify(encryptSnapshot(snapshot, secret))),
    snapshotId: recoverySetIdForDatabaseBinding(masterKey, databaseBinding),
    minimumRetentionUntil: "2098-01-01T00:00:00.000Z",
  };
}

async function backupFixture(options) {
  const masterKey = options.masterKey ?? crypto.randomBytes(32);
  const relationalManifest = options.relationalManifest;
  const {
    snapshotId: _ignoredSnapshotId,
    ...rest
  } = options;
  const coordinated = coordinatedArguments(relationalManifest, masterKey);
  return backupRecoverySnapshot({
    ...rest,
    relationalManifest,
    masterKey,
    ...coordinated,
    ...(options.databaseBinding ? { databaseBinding: options.databaseBinding } : {}),
    ...(options.databaseArtifact ? { databaseArtifact: options.databaseArtifact } : {}),
  });
}

function verificationArguments(result, backupStore, masterKey, restoreStore) {
  return {
    backupStore,
    ...(restoreStore ? { restoreStore } : {}),
    masterKey,
    snapshotId: result.snapshotId,
    completionVersionId: result.completionVersionId,
    completionSha256: result.completionSha256,
    completionMinimumRetentionUntil: result.completionRetentionUntil,
    minimumRetentionUntil: "2098-01-01T00:00:00.000Z",
    expectedSourceStoreIdentitySha256: sourceBinding.coordinateIdentitySha256,
    limits: limits(),
    ...(restoreStore ? {
      applicationReadSmoke: async ({ entries, openRestoredObject }) => {
        let bytes = 0;
        for await (const chunk of await openRestoredObject(entries[0].sourceKey)) {
          bytes += Buffer.from(chunk).length;
        }
        return {
          ok: bytes === entries[0].plaintextBytes,
          mode: "isolated-application-route",
          representativeObjectCount: 1,
        };
      },
    } : {}),
  };
}

function decryptedCompletion(backupStore, result, masterKey) {
  const completionKey = recoveryObjectInternals.completionKeyFor(result.snapshotId);
  const outer = JSON.parse(backupStore.value(completionKey).toString("utf8"));
  return {
    completionKey,
    outer,
    ...recoveryObjectInternals.decryptCompletionManifest(
      outer,
      parseRecoveryMasterKey(masterKey),
    ),
  };
}

function rewriteAuthenticatedCompletion(backupStore, result, masterKey, mutate) {
  const { completionKey, inner, salt } = decryptedCompletion(
    backupStore,
    result,
    masterKey,
  );
  mutate(inner);
  const outer = recoveryObjectInternals.encryptCompletionManifest(
    inner,
    parseRecoveryMasterKey(masterKey),
    salt,
    result.snapshotId,
    (length) => Buffer.alloc(length, 0xa5),
  );
  const bytes = Buffer.from(canonicalRecoveryJson(outer));
  backupStore.entries.set(completionKey, bytes);
  return {
    ...result,
    completionSha256: recoveryObjectInternals.sha256Hex(bytes),
  };
}

function readOnlyBackupStore(backupStore, overrides = {}) {
  return {
    identitySha256: backupStore.identitySha256,
    versionedReads: true,
    inspect: (key, options) => backupStore.inspect(key, options),
    openRead: (key, options) => backupStore.openRead(key, options),
    ...overrides,
  };
}

async function protectedAggregateFixture(name) {
  const fixtures = {
    "aggregate/first.bin": Buffer.from("first protected aggregate member"),
    "aggregate/second.bin": Buffer.from("second protected aggregate member"),
  };
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: `${name}-backup` });
  const result = await backupFixture({
    sourceStore: sourceMemory(fixtures, { name: `${name}-source` }),
    destinationStore: backupStore,
    relationalManifest: manifestFor(Object.entries(fixtures).map(([objectKey, value], index) => (
      uploadRow(objectKey, value, { uploadId: `${name}-${index}` })
    ))),
    masterKey,
    limits: limits(),
  });
  return { backupStore, masterKey, result };
}

function limits(overrides = {}) {
  return {
    maxObjects: 20,
    maxObjectBytes: 2 * 1024 * 1024,
    maxTotalBytes: 4 * 1024 * 1024,
    concurrency: 1,
    ...overrides,
  };
}

test("exact provider version IDs remain byte-for-byte opaque during verification", async () => {
  const value = Buffer.from("opaque-version-fixture");
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "opaque-version-backup" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "private/opaque.bin": value }),
    destinationStore: backupStore,
    relationalManifest: manifestFor([uploadRow("private/opaque.bin", value)]),
    masterKey,
    limits: limits(),
  });
  const opaqueVersionId = " version-id ";
  backupStore.versions.set(result.completionKey, opaqueVersionId);

  const receipt = await verifyRecoverySnapshot({
    ...verificationArguments(result, backupStore, masterKey),
    completionVersionId: opaqueVersionId,
  });

  assert.equal(receipt.contentVerified, true);
  assert.equal(
    backupStore.operations.some((operation) => (
      operation.operation === "read"
      && operation.key === result.completionKey
      && operation.versionId === opaqueVersionId
    )),
    true,
  );
});

test("recovery canonical JSON is ordinal and preserves opaque Unicode bytes", () => {
  const left = canonicalRecoveryJson({
    z: ["e\u0301", "a"],
    a: { y: 2, x: 1 },
  });
  const right = canonicalRecoveryJson({
    a: { x: 1, y: 2 },
    z: ["\u00e9", "a"],
  });
  assert.notEqual(left, right);
  assert.notEqual(left, canonicalRecoveryJson({
    a: { x: 1, y: 2 },
    z: ["a", "\u00e9"],
  }));
  assert.throws(() => canonicalRecoveryJson({ unsafe: 1.2 }), /safe integers/);
  assert.throws(() => canonicalRecoveryJson({ unsafe: undefined }), /undefined/);
  assert.equal(
    canonicalRecoveryJson({ "\u00e9": 1, "e\u0301": 2 }),
    "{\"é\":2,\"é\":1}",
  );
});

test("recovery master key parser accepts only exact 32-byte encodings", () => {
  const key = crypto.randomBytes(32);
  assert.deepEqual(parseRecoveryMasterKey(key), key);
  assert.deepEqual(parseRecoveryMasterKey(key.toString("hex")), key);
  assert.deepEqual(parseRecoveryMasterKey(key.toString("base64")), key);
  assert.deepEqual(parseRecoveryMasterKey(key.toString("base64url")), key);
  for (const invalid of ["password", "a".repeat(63), crypto.randomBytes(31), "A".repeat(44)]) {
    assert.throws(() => parseRecoveryMasterKey(invalid), (error) => (
      error instanceof RecoveryError && error.code === "RECOVERY_KEY_INVALID"
    ));
  }
});

test("relational manifest includes stored objects, excludes tombstones, and flags legacy hashes", () => {
  const stored = Buffer.from("stored");
  const legacy = Buffer.from("legacy");
  const manifest = manifestFor([
    uploadRow("album/stored.jpg", stored),
    uploadRow("legacy/no-hash.jpg", legacy, { contentSha256: null, storageScope: "legacy" }),
    uploadRow("pending/file.jpg", Buffer.from("pending"), { uploadStatus: "pending" }),
    uploadRow("removed/file.jpg", Buffer.from("removed"), { uploadStatus: "removed" }),
    uploadRow("", Buffer.from("missing")),
  ]);
  assert.equal(manifest.objectCount, 2);
  assert.equal(manifest.excludedByStatus.removed, 1);
  assert.equal(manifest.excludedByStatus.pending, 1);
  assert.equal(manifest.needsSourceHashCount, 1);
  assert.deepEqual(manifest.metadataGaps.map((gap) => gap.reason), ["missing_object_key"]);
  assert.throws(() => assertRelationalManifestReady(manifest), (error) => (
    error.code === "FATAL_METADATA_GAP"
  ));
});

test("relational manifest groups duplicate physical keys and rejects conflicting metadata", () => {
  const value = Buffer.from("same object");
  const first = uploadRow("shared/object.bin", value, { storageScope: "album" });
  const second = uploadRow("shared/object.bin", value, { storageScope: "project" });
  const grouped = manifestFor([first, second]);
  assert.equal(grouped.entries.length, 1);
  assert.deepEqual(grouped.entries[0].storageScopes, ["album", "project"]);
  assert.equal(grouped.entries[0].uploadIds.length, 2);

  const conflict = manifestFor([
    first,
    { ...second, sizeBytes: value.length + 1 },
  ]);
  assert.equal(conflict.metadataGaps[0].reason, "conflicting_size");
  assert.throws(() => assertRelationalManifestReady(conflict), /fatal metadata gap/i);
});

test("declared hashes and database object keys remain byte-exact evidence", async () => {
  const value = Buffer.from("exact evidence");
  const malformedHash = manifestFor([
    uploadRow("exact/object.bin", value, { contentSha256: "A".repeat(64) }),
  ]);
  assert.deepEqual(malformedHash.metadataGaps.map((gap) => gap.reason), ["invalid_hash"]);
  assert.throws(() => assertRelationalManifestReady(malformedHash), /fatal metadata gap/iu);

  const untrimmedKey = manifestFor([uploadRow(" exact/object.bin ", value)]);
  assert.deepEqual(untrimmedKey.metadataGaps, []);
  const sourceStore = sourceMemory({ "exact/object.bin": value });
  const destinationStore = new InMemoryObjectStore();
  await assert.rejects(
    backupFixture({
      sourceStore,
      destinationStore,
      relationalManifest: untrimmedKey,
      masterKey: crypto.randomBytes(32),
      limits: limits(),
    }),
    (error) => error.code === "SOURCE_OBJECT_MISSING",
  );
  assert.equal(sourceStore.operations.some((entry) => entry.operation === "read"), false);
  assert.equal(destinationStore.operations.length, 0);

  const decomposedKey = "uploads/e\u0301.bin";
  const exactSource = sourceMemory({ [decomposedKey]: value });
  const exactDestination = new InMemoryObjectStore();
  const exactManifest = manifestFor([uploadRow(decomposedKey, value)]);
  const exactBackup = await backupFixture({
    sourceStore: exactSource,
    destinationStore: exactDestination,
    relationalManifest: exactManifest,
    masterKey: crypto.randomBytes(32),
    limits: limits(),
  });
  assert.equal(exactBackup.completionWritten, true);
});

test("relational object manifest derives from the same version-2 logical snapshot", () => {
  const value = Buffer.from("coordinated");
  const row = uploadRow("coordinated/object.bin", value);
  row.id = row.uploadId;
  delete row.uploadId;
  const manifest = buildRelationalObjectManifestFromSnapshot(logicalSnapshot([row], {
    createdAt: "2026-07-29T02:03:04.000Z",
  }), { sourceBinding });
  assert.equal(manifest.snapshotAt, "2026-07-29T02:03:04.000Z");
  assert.equal(manifest.objectCount, 1);
  assert.equal(manifest.entries[0].sourceKey, "coordinated/object.bin");
  assert.throws(
    () => buildRelationalObjectManifestFromSnapshot({
      format: "rivt-logical-backup-v1",
      tables: [],
    }, { sourceBinding }),
    (error) => error.code === "SNAPSHOT_FORMAT_INVALID",
  );
});

test("local encrypted object backup writes completion last and restores exact bytes", async () => {
  const photo = Buffer.from("fixture photo content");
  const document = Buffer.concat([
    Buffer.from("fixture document "),
    Buffer.alloc(100_000, 7),
  ]);
  const source = sourceMemory({
    "albums/photo.jpg": photo,
    "messages/document.pdf": document,
  }, {
    chunkBytes: 997,
    objectMetadata: {
      "albums/photo.jpg": {
        contentType: "image/jpeg",
        customMetadata: { source: "rivt-album", contentsha256: recoveryObjectInternals.sha256Hex(photo) },
      },
      "messages/document.pdf": {
        contentType: "application/pdf",
        customMetadata: { source: "rivt-message" },
      },
    },
  });
  const backup = new InMemoryObjectStore();
  const restore = new InMemoryObjectStore();
  const relationalManifest = manifestFor([
    uploadRow("albums/photo.jpg", photo),
    uploadRow("messages/document.pdf", document, {
      kind: "message-attachment",
      mimeType: "application/pdf",
      storageScope: "message",
    }),
  ]);
  const masterKey = crypto.randomBytes(32);
  const result = await backupFixture({
    sourceStore: source,
    destinationStore: backup,
    relationalManifest,
    masterKey,
    limits: limits(),
  });
  assert.equal(result.completionWritten, true);
  assert.equal(result.completionRetentionMode, "COMPLIANCE");
  assert.equal(result.completionRetentionUntil, backup.retentionUntil);
  assert.equal(result.databaseArtifactRetentionMode, "COMPLIANCE");
  assert.equal(result.databaseArtifactRetentionUntil, backup.retentionUntil);
  assert.equal(result.archiveRetentionMode, "COMPLIANCE");
  assert.equal(result.archiveRetentionUntil, backup.retentionUntil);
  assert.equal(
    backup.operations.at(-1).key,
    recoveryObjectInternals.completionKeyFor(result.snapshotId),
  );
  const outer = backup.value(recoveryObjectInternals.completionKeyFor(result.snapshotId)).toString("utf8");
  assert.equal(outer.includes("albums/photo.jpg"), false);
  assert.equal(outer.includes(relationalManifest.entries[0].declaredSha256), false);
  assert.equal(outer.includes(photo.toString("utf8")), false);

  const verification = await verifyRecoverySnapshot(
    verificationArguments(result, backup, masterKey, restore),
  );
  assert.equal(verification.contentVerified, true);
  assert.equal(verification.databaseArtifactVerified, false);
  assert.equal(verification.applicationReadSmokePassed, true);
  assert.deepEqual(restore.value("albums/photo.jpg"), photo);
  assert.deepEqual(restore.value("messages/document.pdf"), document);
  assert.deepEqual(
    (await restore.listInventory()).find((entry) => entry.key === "albums/photo.jpg").providerMetadata,
    {
      contentType: "image/jpeg",
      customMetadata: { contentsha256: recoveryObjectInternals.sha256Hex(photo), source: "rivt-album" },
    },
  );
  assert.ok(backup.maximumObservedChunkBytes <= 64 * 1024);
});

test("an 88-object corpus still grants and writes exactly database, archive, then completion", async () => {
  const fixtures = Object.fromEntries(Array.from({ length: 88 }, (_, index) => [
    `corpus/object-${String(index).padStart(3, "0")}.bin`,
    Buffer.from(`member-${index}`),
  ]));
  const rows = Object.entries(fixtures).map(([objectKey, value], index) => uploadRow(
    objectKey,
    value,
    {
      uploadId: `corpus-upload-${String(index).padStart(3, "0")}`,
      storageScope: index % 2 === 0 ? "album" : "message",
    },
  ));
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "aggregate-88-backup" });
  let protectedWritePreflight;
  const result = await backupFixture({
    sourceStore: sourceMemory(fixtures, {
      name: "aggregate-88-source",
      objectMetadata: {
        "corpus/object-000.bin": {
          contentType: "application/octet-stream",
          customMetadata: { fixture: "aggregate-88" },
        },
      },
    }),
    destinationStore: backupStore,
    relationalManifest: manifestFor(rows),
    masterKey,
    limits: limits({ maxObjects: 100 }),
    beforeProtectedWrites: async (preflight) => {
      assert.equal(
        backupStore.operations.some((operation) => operation.operation === "put"),
        false,
      );
      protectedWritePreflight = preflight;
    },
  });
  const expectedWriteKeys = [
    recoveryObjectInternals.databaseKeyFor(result.snapshotId),
    recoveryObjectInternals.archiveKeyFor(result.snapshotId),
    recoveryObjectInternals.completionKeyFor(result.snapshotId),
  ];
  assert.deepEqual(protectedWritePreflight.objectKeys, expectedWriteKeys);
  assert.deepEqual(
    backupStore.operations
      .filter((operation) => operation.operation === "put")
      .map((operation) => operation.key),
    expectedWriteKeys,
  );
  assert.deepEqual(backupStore.keys().sort(), [...expectedWriteKeys].sort());

  const { inner } = decryptedCompletion(backupStore, result, masterKey);
  const archiveBytes = backupStore.value(inner.archive.key);
  assert.equal(inner.archive.format, recoveryObjectInternals.ARCHIVE_FORMAT);
  assert.equal(inner.archive.entryCount, 88);
  assert.equal(inner.archive.byteLength, archiveBytes.length);
  assert.equal(inner.archive.sha256, recoveryObjectInternals.sha256Hex(archiveBytes));
  assert.equal(
    inner.archive.checksumSha256,
    Buffer.from(inner.archive.sha256, "hex").toString("base64"),
  );
  assert.equal(inner.archive.versionId, result.archiveVersionId);
  assert.equal(inner.archive.retentionUntil, backupStore.retentionUntil);

  let expectedOffset = 0;
  for (const entry of inner.entries) {
    assert.equal(entry.archiveOffset, expectedOffset);
    assert.equal(entry.ciphertextBytes, entry.plaintextBytes);
    assert.match(entry.iv, /^[A-Za-z0-9+/]+={0,2}$/u);
    assert.match(entry.tag, /^[A-Za-z0-9+/]+={0,2}$/u);
    assert.match(entry.plaintextSha256, /^[a-f0-9]{64}$/u);
    assert.match(entry.ciphertextSha256, /^[a-f0-9]{64}$/u);
    assert.equal(typeof entry.sourceProviderMetadata, "object");
    assert.equal(
      recoveryObjectInternals.sha256Hex(archiveBytes.subarray(
        entry.archiveOffset,
        entry.archiveOffset + entry.ciphertextBytes,
      )),
      entry.ciphertextSha256,
    );
    expectedOffset += entry.ciphertextBytes;
  }
  assert.equal(expectedOffset, inner.archive.byteLength);

  const verification = await verifyRecoverySnapshot(
    {
      ...verificationArguments(result, backupStore, masterKey),
      limits: limits({ maxObjects: 100 }),
    },
  );
  assert.equal(verification.objectCount, 88);
  assert.deepEqual(
    backupStore.operations.filter((operation) => (
      operation.operation === "read" && operation.key === inner.archive.key
    )).map((operation) => operation.versionId),
    [inner.archive.versionId],
  );
});

test("zero-byte application objects remain recoverable with exact metadata", async () => {
  const empty = Buffer.alloc(0);
  const source = sourceMemory({ "albums/empty.bin": empty }, {
    objectMetadata: {
      "albums/empty.bin": {
        contentType: " application/octet-stream ",
        customMetadata: { source: " rivt-album ", filename: "e\u0301.bin", empty: "" },
      },
    },
  });
  const backup = new InMemoryObjectStore();
  const restore = new InMemoryObjectStore();
  const relationalManifest = manifestFor([uploadRow("albums/empty.bin", empty)]);
  const masterKey = crypto.randomBytes(32);
  const result = await backupFixture({
    sourceStore: source,
    destinationStore: backup,
    relationalManifest,
    masterKey,
    limits: limits(),
  });
  assert.equal(result.totalPlaintextBytes, 0);
  const verification = await verifyRecoverySnapshot(
    verificationArguments(result, backup, masterKey, restore),
  );
  assert.equal(verification.contentVerified, true);
  assert.equal(verification.totalPlaintextBytes, 0);
  assert.deepEqual(restore.value("albums/empty.bin"), empty);
  assert.deepEqual((await restore.listInventory())[0].providerMetadata, {
    contentType: " application/octet-stream ",
    customMetadata: { empty: "", filename: "e\u0301.bin", source: " rivt-album " },
  });
});

test("an empty database manifest still captures provider-only bytes", async () => {
  const providerOnly = Buffer.from("provider-only recovery member");
  const masterKey = crypto.randomBytes(32);
  const backup = new InMemoryObjectStore();
  const restore = new InMemoryObjectStore();
  const result = await backupFixture({
    sourceStore: sourceMemory({ "orphan/provider-only.bin": providerOnly }),
    destinationStore: backup,
    relationalManifest: manifestFor([]),
    masterKey,
    limits: limits(),
  });

  assert.equal(result.objectCount, 1);
  assert.equal(result.reconciliation.providerOnlyObjects, 1);
  const verification = await verifyRecoverySnapshot(
    verificationArguments(result, backup, masterKey, restore),
  );
  assert.equal(verification.contentVerified, true);
  assert.deepEqual(restore.value("orphan/provider-only.bin"), providerOnly);
});

test("a genuinely empty source produces and verifies a bound empty archive", async () => {
  const masterKey = crypto.randomBytes(32);
  const backup = new InMemoryObjectStore();
  const restore = new InMemoryObjectStore();
  const result = await backupFixture({
    sourceStore: sourceMemory(),
    destinationStore: backup,
    relationalManifest: manifestFor([]),
    masterKey,
    limits: limits(),
  });

  assert.equal(result.objectCount, 0);
  assert.equal(result.totalPlaintextBytes, 0);
  const { inner } = decryptedCompletion(backup, result, masterKey);
  assert.equal(inner.entries.length, 0);
  assert.equal(inner.archive.entryCount, 0);
  assert.equal(inner.archive.byteLength, 0);
  assert.equal(
    inner.archive.sha256,
    recoveryObjectInternals.sha256Hex(Buffer.alloc(0)),
  );
  const verification = await verifyRecoverySnapshot(
    {
      ...verificationArguments(result, backup, masterKey, restore),
      applicationReadSmoke: async ({ entries }) => ({
        ok: entries.length === 0,
        mode: "not-applicable-no-stored-references",
        representativeObjectCount: 0,
        notApplicableNoStoredReferences: true,
      }),
      cleanupRestoreStoreAfterVerification: true,
    },
  );
  assert.equal(verification.contentVerified, true);
  assert.equal(verification.objectCount, 0);
  assert.equal(verification.totalPlaintextBytes, 0);
  assert.equal(verification.applicationReadSmokePassed, true);
  assert.equal(verification.restoreTargetCleaned, true);
  assert.deepEqual(restore.keys(), []);
});

test("source hash or size mismatch fails without a completion record", async () => {
  const declared = Buffer.from("declared");
  const source = sourceMemory({ "object.bin": Buffer.from("tampered") });
  const backup = new InMemoryObjectStore();
  const relationalManifest = manifestFor([uploadRow("object.bin", declared)]);
  await assert.rejects(
    backupFixture({
      sourceStore: source,
      destinationStore: backup,
      relationalManifest,
      masterKey: crypto.randomBytes(32),
      snapshotId: "snapshot-hash-failure",
      limits: limits(),
    }),
    (error) => ["SOURCE_SIZE_MISMATCH", "SOURCE_HASH_MISMATCH"].includes(error.code),
  );
  assert.equal(
    backup.keys().some((key) => key.endsWith("/complete.json")),
    false,
  );
});

test("source streaming aborts immediately when bytes exceed the declared bound", async () => {
  const value = Buffer.from("bounded");
  const baseSource = sourceMemory({ "bounded.bin": value });
  const source = {
    identitySha256: baseSource.identitySha256,
    bindingIdentitySha256: baseSource.bindingIdentitySha256,
    listInventory: (options) => baseSource.listInventory(options),
    openRead: async () => Readable.from([value, Buffer.from("overflow")]),
  };
  const destination = new InMemoryObjectStore();
  await assert.rejects(
    backupFixture({
      sourceStore: source,
      destinationStore: destination,
      relationalManifest: manifestFor([uploadRow("bounded.bin", value)]),
      masterKey: crypto.randomBytes(32),
      limits: limits(),
    }),
    (error) => error.code === "SOURCE_SIZE_MISMATCH",
  );
  assert.equal(destination.operations.some((entry) => entry.operation === "put"), false);
});

test("restore rejects trailing protected-archive bytes beyond the completion bound", async () => {
  const value = Buffer.from("ciphertext-bound");
  const masterKey = crypto.randomBytes(32);
  const backup = new InMemoryObjectStore();
  const result = await backupFixture({
    sourceStore: sourceMemory({ "bounded.bin": value }),
    destinationStore: backup,
    relationalManifest: manifestFor([uploadRow("bounded.bin", value)]),
    masterKey,
    limits: limits(),
  });
  const completion = backup.value(recoveryObjectInternals.completionKeyFor(result.snapshotId));
  const { inner } = recoveryObjectInternals.decryptCompletionManifest(
    JSON.parse(completion.toString("utf8")),
    parseRecoveryMasterKey(masterKey),
  );
  const objectKey = inner.archive.key;
  const backupStore = readOnlyBackupStore(backup, {
    openRead: (key, options) => (
      key === objectKey
        ? Promise.resolve(Readable.from([backup.value(key), Buffer.from([0])]))
        : backup.openRead(key, options)
    ),
  });
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(result, backupStore, masterKey)),
    (error) => error.code === "ARCHIVE_SIZE_MISMATCH",
  );
});

test("authenticated archive indexes reject gaps, overlaps, and altered member lengths", async (t) => {
  const cases = [
    {
      name: "gap",
      mutate(inner) {
        inner.entries[1].archiveOffset += 1;
      },
    },
    {
      name: "overlap",
      mutate(inner) {
        inner.entries[1].archiveOffset -= 1;
      },
    },
    {
      name: "member length",
      mutate(inner) {
        inner.entries[0].ciphertextBytes -= 1;
      },
    },
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      const { backupStore, masterKey, result } = await protectedAggregateFixture(
        `invalid-index-${item.name.replace(" ", "-")}`,
      );
      const rewritten = rewriteAuthenticatedCompletion(
        backupStore,
        result,
        masterKey,
        item.mutate,
      );
      const archiveKey = recoveryObjectInternals.archiveKeyFor(result.snapshotId);
      let archiveOpened = false;
      const guardedStore = readOnlyBackupStore(backupStore, {
        openRead: async (key, options) => {
          if (key === archiveKey) archiveOpened = true;
          return backupStore.openRead(key, options);
        },
      });
      await assert.rejects(
        verifyRecoverySnapshot(verificationArguments(rewritten, guardedStore, masterKey)),
        (error) => error.code === "ARCHIVE_ENTRY_INVALID",
      );
      assert.equal(archiveOpened, false);
    });
  }
});

test("restore authenticates each archive member tag and ciphertext hash", async (t) => {
  const cases = [
    {
      name: "tag",
      expectedCode: "OBJECT_AUTH_FAILED",
      mutate(inner) {
        const original = Buffer.from(inner.entries[0].tag, "base64");
        original[0] ^= 0xff;
        inner.entries[0].tag = original.toString("base64");
      },
    },
    {
      name: "ciphertext hash",
      expectedCode: "CIPHERTEXT_HASH_MISMATCH",
      mutate(inner) {
        inner.entries[0].ciphertextSha256 = "0".repeat(64);
      },
    },
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      const { backupStore, masterKey, result } = await protectedAggregateFixture(
        `invalid-member-${item.name.replace(" ", "-")}`,
      );
      const rewritten = rewriteAuthenticatedCompletion(
        backupStore,
        result,
        masterKey,
        item.mutate,
      );
      await assert.rejects(
        verifyRecoverySnapshot(verificationArguments(rewritten, backupStore, masterKey)),
        (error) => error.code === item.expectedCode,
      );
    });
  }
});

test("restore independently verifies the aggregate archive digest after every member", async () => {
  const { backupStore, masterKey, result } = await protectedAggregateFixture(
    "invalid-aggregate-hash",
  );
  const forgedSha256 = "f".repeat(64);
  const rewritten = rewriteAuthenticatedCompletion(
    backupStore,
    result,
    masterKey,
    (inner) => {
      inner.archive.sha256 = forgedSha256;
      inner.archive.checksumSha256 = Buffer.from(forgedSha256, "hex").toString("base64");
    },
  );
  const archiveKey = recoveryObjectInternals.archiveKeyFor(result.snapshotId);
  const inspectionStore = readOnlyBackupStore(backupStore, {
    inspect: async (key, options) => {
      const receipt = await backupStore.inspect(key, options);
      return key === archiveKey
        ? { ...receipt, checksumSha256: Buffer.from(forgedSha256, "hex").toString("base64") }
        : receipt;
    },
  });
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(rewritten, inspectionStore, masterKey)),
    (error) => error.code === "ARCHIVE_HASH_MISMATCH",
  );
});

test("restore opens the exact archive body only after the database consumer settles", async () => {
  const { backupStore, masterKey, result } = await protectedAggregateFixture(
    "archive-open-ordering",
  );
  const archiveKey = recoveryObjectInternals.archiveKeyFor(result.snapshotId);
  let archiveInspected = false;
  let archiveOpened = false;
  const orderedStore = readOnlyBackupStore(backupStore, {
    inspect: async (key, options) => {
      const receipt = await backupStore.inspect(key, options);
      if (key === archiveKey) archiveInspected = true;
      return receipt;
    },
    openRead: async (key, options) => {
      if (key === archiveKey) archiveOpened = true;
      return backupStore.openRead(key, options);
    },
  });

  await verifyRecoverySnapshot({
    ...verificationArguments(result, orderedStore, masterKey),
    databaseArtifactConsumer: async () => {
      assert.equal(archiveInspected, true);
      assert.equal(archiveOpened, false);
      await Promise.resolve();
      assert.equal(archiveOpened, false);
    },
  });

  assert.equal(archiveOpened, true);
});

test("restore enforces the restricted completion retention receipt", async () => {
  const { backupStore, masterKey, result } = await protectedAggregateFixture(
    "completion-retention-binding",
  );
  const completionKey = recoveryObjectInternals.completionKeyFor(result.snapshotId);
  const shortenedRetentionStore = readOnlyBackupStore(backupStore, {
    inspect: async (key, options) => {
      const receipt = await backupStore.inspect(key, options);
      return key === completionKey
        ? { ...receipt, retentionUntil: "2098-06-01T00:00:00.000Z" }
        : receipt;
    },
  });
  await assert.rejects(
    verifyRecoverySnapshot({
      ...verificationArguments(result, shortenedRetentionStore, masterKey),
      completionMinimumRetentionUntil: "2098-07-01T00:00:00.000Z",
    }),
    (error) => error.code === "DESTINATION_RETENTION_INVALID",
  );
});

test("restore binds the archive to its exact version and recorded retention receipt", async (t) => {
  await t.test("version", async () => {
    const { backupStore, masterKey, result } = await protectedAggregateFixture(
      "archive-version-binding",
    );
    const archiveKey = recoveryObjectInternals.archiveKeyFor(result.snapshotId);
    const wrongVersionStore = readOnlyBackupStore(backupStore, {
      inspect: async (key, options) => {
        const receipt = await backupStore.inspect(key, options);
        return key === archiveKey ? { ...receipt, versionId: "different-version" } : receipt;
      },
    });
    await assert.rejects(
      verifyRecoverySnapshot(verificationArguments(result, wrongVersionStore, masterKey)),
      (error) => error.code === "BACKUP_OBJECT_MISSING",
    );
  });

  await t.test("retention", async () => {
    const { backupStore, masterKey, result } = await protectedAggregateFixture(
      "archive-retention-binding",
    );
    const archiveKey = recoveryObjectInternals.archiveKeyFor(result.snapshotId);
    const shortenedRetentionStore = readOnlyBackupStore(backupStore, {
      inspect: async (key, options) => {
        const receipt = await backupStore.inspect(key, options);
        return key === archiveKey
          ? { ...receipt, retentionUntil: "2098-06-01T00:00:00.000Z" }
          : receipt;
      },
    });
    await assert.rejects(
      verifyRecoverySnapshot(verificationArguments(result, shortenedRetentionStore, masterKey)),
      (error) => error.code === "DESTINATION_RETENTION_INVALID",
    );
  });
});

test("restore binds the database artifact to its authenticated checksum and retention receipt", async (t) => {
  await t.test("checksum", async () => {
    const { backupStore, masterKey, result } = await protectedAggregateFixture(
      "database-checksum-binding",
    );
    const rewritten = rewriteAuthenticatedCompletion(
      backupStore,
      result,
      masterKey,
      (inner) => {
        inner.database.artifact.checksumSha256 = Buffer.alloc(32, 0xff).toString("base64");
      },
    );
    await assert.rejects(
      verifyRecoverySnapshot(verificationArguments(rewritten, backupStore, masterKey)),
      (error) => error.code === "DATABASE_ARTIFACT_INVALID",
    );
  });

  await t.test("retention", async () => {
    const { backupStore, masterKey, result } = await protectedAggregateFixture(
      "database-retention-binding",
    );
    const rewritten = rewriteAuthenticatedCompletion(
      backupStore,
      result,
      masterKey,
      (inner) => {
        inner.database.artifact.retentionUntil = "2099-06-01T00:00:00.000Z";
      },
    );
    await assert.rejects(
      verifyRecoverySnapshot(verificationArguments(rewritten, backupStore, masterKey)),
      (error) => error.code === "DESTINATION_RETENTION_INVALID",
    );
  });
});

test("missing source fails closed and is never retried as transient", async () => {
  const value = Buffer.from("missing");
  const source = sourceMemory();
  const backup = new InMemoryObjectStore();
  await assert.rejects(
    backupFixture({
      sourceStore: source,
      destinationStore: backup,
      relationalManifest: manifestFor([uploadRow("missing.bin", value)]),
      masterKey: crypto.randomBytes(32),
      snapshotId: "snapshot-missing-source",
      limits: limits(),
      sleep: async () => undefined,
    }),
    (error) => error.code === "SOURCE_OBJECT_MISSING",
  );
  assert.equal(source.operations.filter((entry) => entry.operation === "read").length, 0);
  assert.equal(backup.keys().length, 0);
});

test("transient source read opens a fresh stream and retries at most three times", async () => {
  const value = Buffer.from("retry source");
  const base = sourceMemory({ "retry.bin": value });
  let attempts = 0;
  const source = {
    identitySha256: base.identitySha256,
    bindingIdentitySha256: base.bindingIdentitySha256,
    listInventory: (...args) => base.listInventory(...args),
    async openRead(key) {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("private provider detail");
        error.code = "ECONNRESET";
        throw error;
      }
      return base.openRead(key);
    },
  };
  const backup = new InMemoryObjectStore();
  await backupFixture({
    sourceStore: source,
    destinationStore: backup,
    relationalManifest: manifestFor([uploadRow("retry.bin", value)]),
    masterKey: crypto.randomBytes(32),
    snapshotId: "snapshot-transient-retry",
    limits: limits(),
    sleep: async () => undefined,
  });
  assert.equal(attempts, 3);
});

test("wrong key, modified ciphertext, and missing completion fail closed", async () => {
  const value = Buffer.from("protected object");
  const masterKey = crypto.randomBytes(32);
  const backup = new InMemoryObjectStore();
  const result = await backupFixture({
    sourceStore: sourceMemory({ "protected.bin": value }),
    destinationStore: backup,
    relationalManifest: manifestFor([uploadRow("protected.bin", value)]),
    masterKey,
    limits: limits(),
  });
  await assert.rejects(
    verifyRecoverySnapshot({
      ...verificationArguments(result, backup, crypto.randomBytes(32)),
      masterKey: crypto.randomBytes(32),
    }),
    (error) => ["COMPLETION_AUTH_FAILED", "RECOVERY_SET_BINDING_INVALID"].includes(error.code),
  );

  const completion = backup.value(recoveryObjectInternals.completionKeyFor(result.snapshotId));
  const outer = JSON.parse(completion.toString("utf8"));
  const { inner } = recoveryObjectInternals.decryptCompletionManifest(
    outer,
    parseRecoveryMasterKey(masterKey),
  );
  const blob = backup.value(inner.archive.key);
  blob[inner.entries[0].archiveOffset] ^= 0xff;
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(result, backup, masterKey)),
    (error) => [
      "OBJECT_AUTH_FAILED",
      "CIPHERTEXT_HASH_MISMATCH",
      "DESTINATION_CHECKSUM_MISMATCH",
    ].includes(error.code),
  );

  const incomplete = new InMemoryObjectStore();
  const incompleteManifest = manifestFor([uploadRow("missing-completion.bin", value)]);
  const incompleteBinding = coordinatedArguments(incompleteManifest, masterKey);
  await assert.rejects(
    verifyRecoverySnapshot({
      backupStore: incomplete,
      masterKey,
      snapshotId: incompleteBinding.snapshotId,
      completionVersionId: "missing-version",
      completionSha256: "a".repeat(64),
      minimumRetentionUntil: "2098-01-01T00:00:00.000Z",
      expectedSourceStoreIdentitySha256: sourceBinding.coordinateIdentitySha256,
      limits: limits(),
    }),
    (error) => error.code === "COMPLETION_MISSING",
  );
});

test("preflight count, byte, hash, and duplicate limits fail before provider I/O", async () => {
  const value = Buffer.from("limits");
  const row = uploadRow("limit.bin", value);
  const cases = [
    {
      manifest: manifestFor([row]),
      limits: limits({ maxObjects: 1, maxObjectBytes: 2 }),
      code: "OBJECT_SIZE_LIMIT",
    },
    {
      manifest: manifestFor([row]),
      limits: limits({ maxTotalBytes: 2 }),
      code: "TOTAL_SIZE_LIMIT",
    },
  ];
  for (const item of cases) {
    const source = sourceMemory({ "limit.bin": value });
    const destination = new InMemoryObjectStore();
    await assert.rejects(
      backupFixture({
        sourceStore: source,
        destinationStore: destination,
        relationalManifest: item.manifest,
        masterKey: crypto.randomBytes(32),
        snapshotId: `snapshot-${item.code.toLowerCase()}`,
        limits: item.limits,
      }),
      (error) => error.code === item.code,
    );
    assert.equal(source.operations.length, 0);
    assert.equal(destination.operations.length, 0);
  }
});

test("completion metadata capacity fails before the first protected write", async () => {
  const value = Buffer.from("bounded completion metadata");
  const relationalManifest = manifestFor([
    uploadRow("bounded/metadata.bin", value, { uploadId: "u".repeat(5 * 1024 * 1024) }),
  ]);
  const sourceStore = sourceMemory({ "bounded/metadata.bin": value });
  const destinationStore = new InMemoryObjectStore();
  await assert.rejects(
    backupFixture({
      sourceStore,
      destinationStore,
      relationalManifest,
      masterKey: crypto.randomBytes(32),
      limits: limits(),
    }),
    (error) => error.code === "MANIFEST_SIZE_LIMIT",
  );
  assert.equal(
    destinationStore.operations.filter((operation) => operation.operation === "put").length,
    0,
  );
});

test("backup and restore reject stores that do not guarantee atomic writes", async () => {
  const value = Buffer.from("atomic");
  const relationalManifest = manifestFor([uploadRow("atomic.bin", value)]);
  await assert.rejects(
    backupFixture({
      sourceStore: sourceMemory({ "atomic.bin": value }),
      destinationStore: { put: async () => undefined },
      relationalManifest,
      masterKey: crypto.randomBytes(32),
      snapshotId: "snapshot-non-atomic-backup",
      limits: limits(),
    }),
    (error) => error.code === "STORE_INVALID",
  );

  await assert.rejects(
    verifyRecoverySnapshot({
      backupStore: new InMemoryObjectStore(),
      restoreStore: {
        put: async () => undefined,
        delete: async () => undefined,
      },
      masterKey: crypto.randomBytes(32),
      snapshotId: "snapshot-non-atomic-restore",
      minimumRetentionUntil: "2098-01-01T00:00:00.000Z",
      expectedSourceStoreIdentitySha256: sourceBinding.coordinateIdentitySha256,
      limits: limits(),
    }),
    (error) => error.code === "STORE_INVALID",
  );
});

test("concurrent failure drains active workers and never writes completion", async () => {
  const first = Buffer.alloc(80_000, 1);
  const second = Buffer.alloc(80_000, 2);
  const third = Buffer.alloc(80_000, 3);
  const source = sourceMemory({
    "first.bin": first,
    "second.bin": Buffer.from("wrong"),
    "third.bin": third,
  }, { chunkBytes: 257 });
  const destination = new InMemoryObjectStore();
  await assert.rejects(
    backupFixture({
      sourceStore: source,
      destinationStore: destination,
      relationalManifest: manifestFor([
        uploadRow("first.bin", first),
        uploadRow("second.bin", second),
        uploadRow("third.bin", third),
      ]),
      masterKey: crypto.randomBytes(32),
      snapshotId: "snapshot-concurrent-failure",
      limits: limits({ concurrency: 2 }),
    }),
    (error) => ["SOURCE_SIZE_MISMATCH", "SOURCE_HASH_MISMATCH"].includes(error.code),
  );
  assert.equal(
    destination.keys().some((key) => key.endsWith("/complete.json")),
    false,
  );
  const operationsAtFailure = destination.operations.length;
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(destination.operations.length, operationsAtFailure);
});

test("destination collision prevents overwrite and completion", async () => {
  const value = Buffer.from("collision");
  const masterKey = Buffer.alloc(32, 9);
  const deterministicRandom = (length) => Buffer.alloc(length, length);
  const snapshotId = "snapshot-collision";
  const relationalManifest = manifestFor([uploadRow("collision.bin", value)]);
  const source = sourceMemory({ "collision.bin": value });
  const backup = new InMemoryObjectStore();
  await backupFixture({
    sourceStore: source,
    destinationStore: backup,
    relationalManifest,
    masterKey,
    snapshotId,
    limits: limits(),
    randomBytesFn: deterministicRandom,
  });
  await assert.rejects(
    backupFixture({
      sourceStore: source,
      destinationStore: backup,
      relationalManifest,
      masterKey,
      snapshotId,
      limits: limits(),
      randomBytesFn: deterministicRandom,
    }),
    (error) => error.code === "DESTINATION_COLLISION",
  );
});

test("privacy-safe recovery events use an exact allowlist", async () => {
  const sentinel = Buffer.from("private user@example.com file-name.jpg signed-url-token");
  const logs = [];
  const source = sourceMemory({ "accounts/private/file-name.jpg": sentinel });
  await backupFixture({
    sourceStore: source,
    destinationStore: new InMemoryObjectStore(),
    relationalManifest: manifestFor([
      uploadRow("accounts/private/file-name.jpg", sentinel, {
        uploadId: "private-account-id",
      }),
    ]),
    masterKey: crypto.randomBytes(32),
    snapshotId: "snapshot-private-log",
    limits: limits(),
    logger: (event) => logs.push(event),
  });
  const serialized = JSON.stringify(logs);
  for (const forbidden of [
    "user@example.com",
    "file-name.jpg",
    "accounts/private",
    "private-account-id",
    recoveryObjectInternals.sha256Hex(sentinel),
    "signed-url-token",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.ok(logs.every((entry) => (
    Object.keys(entry).every((key) => [
      "event",
      "phase",
      "outcome",
      "objectOrdinal",
      "objectCount",
      "aggregateBytes",
      "durationMs",
      "retryCount",
      "errorCode",
    ].includes(key))
  )));
});

test("legacy stored objects without database hashes are stream-hashed and restored", async () => {
  const legacy = Buffer.from("legacy object without a historical digest");
  const masterKey = crypto.randomBytes(32);
  const relationalManifest = manifestFor([
    uploadRow("legacy/private-name.jpg", legacy, {
      contentSha256: null,
      storageScope: "legacy",
    }),
  ]);
  assert.equal(relationalManifest.needsSourceHashCount, 1);
  assert.doesNotThrow(() => assertRelationalManifestReady(relationalManifest));
  const backupStore = new InMemoryObjectStore({}, { name: "legacy-backup" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "legacy/private-name.jpg": legacy }, { name: "legacy-source" }),
    destinationStore: backupStore,
    relationalManifest,
    masterKey,
    limits: limits(),
  });
  const outer = JSON.parse(backupStore.value(result.completionKey).toString("utf8"));
  const { inner } = recoveryObjectInternals.decryptCompletionManifest(
    outer,
    parseRecoveryMasterKey(masterKey),
  );
  assert.equal(inner.entries[0].plaintextSha256, recoveryObjectInternals.sha256Hex(legacy));
  assert.equal(inner.entries[0].classification, "stored");
  const restoreStore = new InMemoryObjectStore({}, { name: "legacy-restore" });
  const receipt = await verifyRecoverySnapshot(
    verificationArguments(result, backupStore, masterKey, restoreStore),
  );
  assert.equal(receipt.contentVerified, true);
  assert.deepEqual(restoreStore.value("legacy/private-name.jpg"), legacy);
});

test("full inventory preserves and classifies removed and provider-only objects", async () => {
  const stored = Buffer.from("stored");
  const removed = Buffer.from("removed but physically present");
  const orphan = Buffer.from("provider orphan");
  const masterKey = crypto.randomBytes(32);
  const relationalManifest = manifestFor([
    uploadRow("stored.bin", stored, { storageScope: "project" }),
    uploadRow("removed.bin", removed, { uploadStatus: "removed", storageScope: "project" }),
  ]);
  const backupStore = new InMemoryObjectStore({}, { name: "reconcile-backup" });
  const result = await backupFixture({
    sourceStore: sourceMemory({
      "stored.bin": stored,
      "removed.bin": removed,
      "provider-only/private.bin": orphan,
    }, { name: "reconcile-source" }),
    destinationStore: backupStore,
    relationalManifest,
    masterKey,
    limits: limits(),
  });
  assert.equal(result.objectCount, 3);
  assert.deepEqual(result.reconciliation, {
    storedReferencesMissing: 0,
    declaredSizeMismatches: 0,
    declaredHashMismatches: 0,
    providerOnlyObjects: 1,
    removedObjectsStillPresent: 1,
    unresolvedObjects: 0,
  });
  const restoreStore = new InMemoryObjectStore({}, { name: "reconcile-restore" });
  await verifyRecoverySnapshot(
    verificationArguments(result, backupStore, masterKey, restoreStore),
  );
  assert.deepEqual(restoreStore.value("stored.bin"), stored);
  assert.deepEqual(restoreStore.value("removed.bin"), removed);
  assert.deepEqual(restoreStore.value("provider-only/private.bin"), orphan);
});

test("source inventory drift aborts before the first irreversible destination write", async () => {
  const value = Buffer.from("stable bytes");
  const base = sourceMemory({ "stable.bin": value }, { name: "drifting-source" });
  let inventories = 0;
  const sourceStore = {
    identitySha256: base.identitySha256,
    bindingIdentitySha256: base.bindingIdentitySha256,
    openRead: (...args) => base.openRead(...args),
    async listInventory(options) {
      inventories += 1;
      const records = await base.listInventory(options);
      if (inventories === 2) records[0] = { ...records[0], identity: "changed" };
      return records;
    },
  };
  const destinationStore = new InMemoryObjectStore({}, { name: "drift-backup" });
  await assert.rejects(
    backupFixture({
      sourceStore,
      destinationStore,
      relationalManifest: manifestFor([uploadRow("stable.bin", value)]),
      masterKey: crypto.randomBytes(32),
      limits: limits(),
    }),
    (error) => error.code === "SOURCE_INVENTORY_CHANGED",
  );
  assert.equal(destinationStore.operations.filter((item) => item.operation === "put").length, 0);
});

test("database artifact must decrypt to the exact database binding before provider I/O", async () => {
  const value = Buffer.from("bound");
  const masterKey = crypto.randomBytes(32);
  const relationalManifest = manifestFor([uploadRow("bound.bin", value)]);
  const differentManifest = manifestFor([uploadRow("different.bin", Buffer.from("different"))]);
  const wrongArtifact = coordinatedArguments(differentManifest, masterKey).databaseArtifact;
  const sourceStore = sourceMemory({ "bound.bin": value }, { name: "bound-source" });
  const destinationStore = new InMemoryObjectStore({}, { name: "bound-backup" });
  await assert.rejects(
    backupFixture({
      sourceStore,
      destinationStore,
      relationalManifest,
      masterKey,
      databaseArtifact: wrongArtifact,
      limits: limits(),
    }),
    (error) => error.code === "DATABASE_ARTIFACT_INVALID",
  );
  assert.equal(sourceStore.operations.length, 0);
  assert.equal(destinationStore.operations.length, 0);
});

test("database artifact must be fully restore-usable before any provider I/O", async () => {
  const value = Buffer.from("restore usable");
  const masterKey = crypto.randomBytes(32);
  const relationalManifest = manifestFor([uploadRow("usable.bin", value)]);
  const invalidSnapshot = structuredClone(relationalManifest.testSnapshot);
  invalidSnapshot.manifest.rowCount = 999;
  invalidSnapshot.manifest.counts.uploads = 999;
  const invalidArtifact = Buffer.from(JSON.stringify(encryptSnapshot(
    invalidSnapshot,
    masterKey.toString("base64"),
  )));
  const sourceStore = sourceMemory({ "usable.bin": value });
  const destinationStore = new InMemoryObjectStore();
  await assert.rejects(backupFixture({
    sourceStore,
    destinationStore,
    relationalManifest,
    databaseArtifact: invalidArtifact,
    masterKey,
    limits: limits(),
  }), (error) => error.code === "DATABASE_ARTIFACT_INVALID");
  assert.equal(sourceStore.operations.length, 0);
  assert.equal(destinationStore.operations.length, 0);
});

test("object classifications and scopes must derive exactly from the authenticated database artifact", async () => {
  const value = Buffer.from("scope provenance");
  const relationalManifest = manifestFor([
    uploadRow("scope.bin", value, { storageScope: "album" }),
  ]);
  const fabricated = structuredClone(relationalManifest);
  Object.defineProperty(fabricated, "testSnapshot", {
    value: relationalManifest.testSnapshot,
  });
  fabricated.entries[0].storageScopes = [
    "legacy",
    "project",
    "album",
    "shop-talk",
    "document-brand",
    "professional-profile",
    "message",
    "contact-note",
  ];
  const digestInput = { ...fabricated };
  delete digestInput.manifestSha256;
  fabricated.manifestSha256 = crypto.createHash("sha256")
    .update(canonicalRecoveryJson(digestInput))
    .digest("hex");
  const sourceStore = sourceMemory({ "scope.bin": value });
  const destinationStore = new InMemoryObjectStore();
  await assert.rejects(backupFixture({
    sourceStore,
    destinationStore,
    relationalManifest: fabricated,
    masterKey: crypto.randomBytes(32),
    limits: limits(),
  }), (error) => error.code === "SNAPSHOT_BINDING_INVALID");
  assert.equal(sourceStore.operations.length, 0);
  assert.equal(destinationStore.operations.length, 0);
});

test("source and protected destination coordinate identities are mandatory and distinct", async () => {
  const value = Buffer.from("coordinate binding");
  const relationalManifest = manifestFor([uploadRow("coordinate.bin", value)]);
  const wrongSource = sourceMemory({ "coordinate.bin": value });
  wrongSource.identitySha256 = "c".repeat(64);
  await assert.rejects(backupFixture({
    sourceStore: wrongSource,
    destinationStore: new InMemoryObjectStore(),
    relationalManifest,
    masterKey: crypto.randomBytes(32),
    limits: limits(),
  }), (error) => error.code === "STORE_INVALID");
  assert.equal(wrongSource.operations.length, 0);

  const sourceStore = sourceMemory({ "coordinate.bin": value });
  const collidingDestination = new InMemoryObjectStore({}, {
    identitySha256: sourceBinding.coordinateIdentitySha256,
  });
  await assert.rejects(backupFixture({
    sourceStore,
    destinationStore: collidingDestination,
    relationalManifest,
    masterKey: crypto.randomBytes(32),
    limits: limits(),
  }), (error) => error.code === "STORE_INVALID");
  assert.equal(sourceStore.operations.length, 0);
  assert.equal(collidingDestination.operations.length, 0);
});

test("restore rejects protected-store collisions and nonempty isolated targets", async () => {
  const value = Buffer.from("isolation");
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "same-store" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "isolation.bin": value }, { name: "source-store" }),
    destinationStore: backupStore,
    relationalManifest: manifestFor([uploadRow("isolation.bin", value)]),
    masterKey,
    limits: limits(),
  });
  const collidingTarget = new InMemoryObjectStore({}, { name: "same-store" });
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(result, backupStore, masterKey, collidingTarget)),
    (error) => error.code === "RESTORE_TARGET_NOT_ISOLATED",
  );
  const sourceCollidingTarget = new InMemoryObjectStore({}, {
    name: "source-collision",
    identitySha256: sourceBinding.coordinateIdentitySha256,
  });
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(
      result,
      backupStore,
      masterKey,
      sourceCollidingTarget,
    )),
    (error) => error.code === "RESTORE_TARGET_NOT_ISOLATED",
  );
  const nonemptyTarget = new InMemoryObjectStore({ "unexpected.bin": Buffer.from("x") }, {
    name: "nonempty-target",
  });
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(result, backupStore, masterKey, nonemptyTarget)),
    (error) => error.code === "RESTORE_TARGET_NOT_EMPTY",
  );
});

test("completion is bound to the exact protected destination identity", async () => {
  const value = Buffer.from("destination binding");
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "bound-destination" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "bound-destination.bin": value }),
    destinationStore: backupStore,
    relationalManifest: manifestFor([uploadRow("bound-destination.bin", value)]),
    masterKey,
    limits: limits(),
  });
  backupStore.identitySha256 = "d".repeat(64);
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(result, backupStore, masterKey)),
    (error) => error.code === "RECOVERY_SET_BINDING_INVALID",
  );
});

test("restore is bound to the exact configured application source identity", async () => {
  const value = Buffer.from("source binding");
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "source-bound-destination" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "source-bound.bin": value }),
    destinationStore: backupStore,
    relationalManifest: manifestFor([uploadRow("source-bound.bin", value)]),
    masterKey,
    limits: limits(),
  });
  await assert.rejects(
    verifyRecoverySnapshot({
      ...verificationArguments(result, backupStore, masterKey),
      expectedSourceStoreIdentitySha256: "e".repeat(64),
    }),
    (error) => error.code === "RECOVERY_SET_BINDING_INVALID",
  );
});

test("restore failure cleans written objects and reports cleanup failure instead of hiding it", async () => {
  const first = Buffer.from("first");
  const second = Buffer.from("second");
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "cleanup-backup" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "first.bin": first, "second.bin": second }, {
      name: "cleanup-source",
    }),
    destinationStore: backupStore,
    relationalManifest: manifestFor([
      uploadRow("first.bin", first),
      uploadRow("second.bin", second),
    ]),
    masterKey,
    limits: limits(),
  });
  const baseTarget = new InMemoryObjectStore({}, { name: "cleanup-target" });
  let puts = 0;
  const restoreStore = {
    atomicPut: true,
    identitySha256: baseTarget.identitySha256,
    assertWritableKeys: (...args) => baseTarget.assertWritableKeys(...args),
    assertEmpty: () => baseTarget.assertEmpty(),
    openRead: (...args) => baseTarget.openRead(...args),
    listInventory: (...args) => baseTarget.listInventory(...args),
    async put(...args) {
      puts += 1;
      if (puts === 2) throw new Error("private write failure");
      return baseTarget.put(...args);
    },
    async delete() {
      throw new Error("private cleanup failure");
    },
  };
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(result, backupStore, masterKey, restoreStore)),
    (error) => error.code === "RESTORE_CLEANUP_FAILED",
  );
});

test("restore failure verifies cleanup state after a provider reports delete success", async () => {
  const value = Buffer.from("residual plaintext");
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "residual-backup" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "residual.bin": value }),
    destinationStore: backupStore,
    relationalManifest: manifestFor([uploadRow("residual.bin", value)]),
    masterKey,
    limits: limits(),
  });
  const baseTarget = new InMemoryObjectStore({}, { name: "residual-target" });
  const restoreStore = {
    atomicPut: true,
    identitySha256: baseTarget.identitySha256,
    assertWritableKeys: (...args) => baseTarget.assertWritableKeys(...args),
    assertEmpty: () => baseTarget.assertEmpty(),
    openRead: (...args) => baseTarget.openRead(...args),
    listInventory: (...args) => baseTarget.listInventory(...args),
    put: (...args) => baseTarget.put(...args),
    async delete() {},
  };
  await assert.rejects(
    verifyRecoverySnapshot({
      ...verificationArguments(result, backupStore, masterKey, restoreStore),
      applicationReadSmoke: async () => {
        throw new Error("force cleanup path");
      },
    }),
    (error) => error.code === "RESTORE_CLEANUP_FAILED",
  );
  assert.equal(baseTarget.keys().length, 1);
});

test("restore tracks an accepted object before validating its write receipt", async () => {
  const value = Buffer.from("receipt cleanup");
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "receipt-cleanup-backup" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "receipt-cleanup.bin": value }),
    destinationStore: backupStore,
    relationalManifest: manifestFor([uploadRow("receipt-cleanup.bin", value)]),
    masterKey,
    limits: limits(),
  });
  const baseTarget = new InMemoryObjectStore({}, { name: "receipt-cleanup-target" });
  const restoreStore = {
    atomicPut: true,
    identitySha256: baseTarget.identitySha256,
    assertWritableKeys: (...args) => baseTarget.assertWritableKeys(...args),
    assertEmpty: () => baseTarget.assertEmpty(),
    openRead: (...args) => baseTarget.openRead(...args),
    listInventory: (...args) => baseTarget.listInventory(...args),
    delete: (...args) => baseTarget.delete(...args),
    async put(...args) {
      const receipt = await baseTarget.put(...args);
      return { ...receipt, checksumSha256: "wrong-receipt" };
    },
  };
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(result, backupStore, masterKey, restoreStore)),
    (error) => error.code === "RESTORE_WRITE_MISMATCH",
  );
  assert.deepEqual(baseTarget.keys(), []);
});

test("final isolated inventory rehash rejects a same-size mutation after initial readback", async () => {
  const first = Buffer.from("first-object");
  const second = Buffer.from("second-value");
  const masterKey = crypto.randomBytes(32);
  const backup = new InMemoryObjectStore();
  const result = await backupFixture({
    sourceStore: sourceMemory({ "first.bin": first, "second.bin": second }),
    destinationStore: backup,
    relationalManifest: manifestFor([
      uploadRow("first.bin", first),
      uploadRow("second.bin", second),
    ]),
    masterKey,
    limits: limits(),
  });
  const target = new InMemoryObjectStore();
  const writtenKeys = [];
  let readbacks = 0;
  const racingTarget = {
    identitySha256: target.identitySha256,
    atomicPut: true,
    assertWritableKeys: (keys) => target.assertWritableKeys(keys),
    assertEmpty: () => target.assertEmpty(),
    listInventory: (options) => target.listInventory(options),
    delete: (key, options) => target.delete(key, options),
    put: async (key, body, options) => {
      writtenKeys.push(key);
      return target.put(key, body, options);
    },
    openRead: async (key, options) => {
      const body = await target.openRead(key, options);
      readbacks += 1;
      if (readbacks === 2) {
        const original = target.entries.get(writtenKeys[0]);
        target.entries.set(writtenKeys[0], Buffer.alloc(original.length, 0x78));
      }
      return body;
    },
  };
  await assert.rejects(
    verifyRecoverySnapshot(verificationArguments(result, backup, masterKey, racingTarget)),
    (error) => error.code === "RESTORE_WRITE_MISMATCH",
  );
  assert.deepEqual(target.keys(), []);
});

test("successful isolated restore can verify every object and then clean the target", async () => {
  const value = Buffer.from("verified then removed");
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "success-cleanup-backup" });
  const result = await backupFixture({
    sourceStore: sourceMemory({ "private/cleanup.bin": value }, { name: "success-cleanup-source" }),
    destinationStore: backupStore,
    relationalManifest: manifestFor([uploadRow("private/cleanup.bin", value)]),
    masterKey,
    limits: limits(),
  });
  const restoreStore = new InMemoryObjectStore({}, { name: "success-cleanup-target" });
  const receipt = await verifyRecoverySnapshot({
    ...verificationArguments(result, backupStore, masterKey, restoreStore),
    cleanupRestoreStoreAfterVerification: true,
  });
  assert.equal(receipt.contentVerified, true);
  assert.equal(receipt.restoreTargetCleaned, true);
  assert.deepEqual(restoreStore.keys(), []);
  assert.equal(sanitizedRecoverySuccess(receipt).restoreTargetCleaned, true);
});

test("all canonical application storage scopes survive the coordinated round trip", async () => {
  const scopes = [
    "legacy",
    "project",
    "album",
    "shop-talk",
    "document-brand",
    "professional-profile",
    "message",
    "contact-note",
  ];
  const fixtures = Object.fromEntries(scopes.map((scope) => [
    `${scope}/private.bin`,
    Buffer.from(`bytes:${scope}`),
  ]));
  const masterKey = crypto.randomBytes(32);
  const backupStore = new InMemoryObjectStore({}, { name: "scopes-backup" });
  const result = await backupFixture({
    sourceStore: sourceMemory(fixtures, { name: "scopes-source" }),
    destinationStore: backupStore,
    relationalManifest: manifestFor(Object.entries(fixtures).map(([objectKey, value]) => (
      uploadRow(objectKey, value, { storageScope: objectKey.split("/")[0] })
    ))),
    masterKey,
    limits: limits({ maxObjects: 20 }),
  });
  const receipt = await verifyRecoverySnapshot(verificationArguments(
    result,
    backupStore,
    masterKey,
    new InMemoryObjectStore({}, { name: "scopes-restore" }),
  ));
  assert.deepEqual(receipt.storageScopes, [...scopes].sort());
});

test("sanitized recovery receipts and failures exclude private coordinates", () => {
  const sanitized = sanitizedRecoverySuccess({
    ok: true,
    mode: "provider-neutral-complete-set",
    recoverySetIdentitySha256: "a".repeat(64),
    sourceCommit: "1".repeat(40),
    objectCount: 2,
    totalPlaintextBytes: 10,
    completionWritten: true,
    durationMs: 12,
    completionKey: "private/file-name.jpg",
    completionVersionId: "private-version",
    reconciliation: { providerOnlyObjects: 0 },
  });
  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes("file-name.jpg"), false);
  assert.equal(serialized.includes("private-version"), false);
  const failure = sanitizedRecoveryFailure(new Error("secret provider response"));
  assert.equal(JSON.stringify(failure).includes("secret provider response"), false);
});

test("local harness requires both guards and remains provider-free with ambient credentials", () => {
  const harnessPath = fileURLToPath(new URL("../scripts/run-local-recovery-harness.js", import.meta.url));
  const withoutGuards = spawnSync(process.execPath, [harnessPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      RECOVERY_HARNESS_MODE: "",
      CONFIRM_RECOVERY_LOCAL_ONLY: "",
    },
  });
  assert.equal(withoutGuards.status, 1);
  assert.match(withoutGuards.stderr, /local-memory/);

  const localOnly = spawnSync(process.execPath, [harnessPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      RECOVERY_HARNESS_MODE: "local-memory",
      CONFIRM_RECOVERY_LOCAL_ONLY: "true",
      AWS_ACCESS_KEY_ID: "must-not-be-used",
      AWS_SECRET_ACCESS_KEY: "must-not-be-used",
      S3_BUCKET: "must-not-be-used",
    },
  });
  assert.equal(localOnly.status, 0, localOnly.stderr);
  const result = JSON.parse(localOnly.stdout);
  assert.equal(result.providerIo, false);
  assert.equal(result.productionDataRead, false);
  assert.equal(result.chargeBearingAction, false);
  assert.equal(result.completionWrittenLast, true);
});
