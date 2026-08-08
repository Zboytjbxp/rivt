import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  InMemoryObjectStore,
  RecoveryError,
  assertRelationalManifestReady,
  backupRecoverySnapshot,
  buildRelationalObjectManifest,
  buildRelationalObjectManifestFromSnapshot,
  canonicalRecoveryJson,
  parseRecoveryMasterKey,
  recoveryObjectInternals,
  verifyRecoverySnapshot,
} from "../scripts/recovery-object-utils.js";

const sourceBinding = {
  logicalBucket: "primary",
  provider: "local-memory",
  region: "local",
  bucketIdentity: "fixture-source",
  endpointFingerprint: recoveryObjectInternals.sha256Hex("fixture-endpoint"),
};

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
  return buildRelationalObjectManifest(entries, {
    sourceBinding,
    snapshotAt: "2026-07-29T00:00:00.000Z",
  });
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

test("recovery canonical JSON is stable across object order and Unicode composition", () => {
  const left = canonicalRecoveryJson({
    z: ["e\u0301", "a"],
    a: { y: 2, x: 1 },
  });
  const right = canonicalRecoveryJson({
    a: { x: 1, y: 2 },
    z: ["\u00e9", "a"],
  });
  assert.equal(left, right);
  assert.notEqual(left, canonicalRecoveryJson({
    a: { x: 1, y: 2 },
    z: ["a", "\u00e9"],
  }));
  assert.throws(() => canonicalRecoveryJson({ unsafe: 1.2 }), /safe integers/);
  assert.throws(() => canonicalRecoveryJson({ unsafe: undefined }), /undefined/);
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

test("relational object manifest derives from the same version-2 logical snapshot", () => {
  const value = Buffer.from("coordinated");
  const row = uploadRow("coordinated/object.bin", value);
  row.id = row.uploadId;
  delete row.uploadId;
  const manifest = buildRelationalObjectManifestFromSnapshot({
    format: "rivt-logical-backup-v2",
    snapshotAt: "2026-07-29T02:03:04.000Z",
    tables: [{ name: "uploads", rows: [row] }],
  }, { sourceBinding });
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
  const source = new InMemoryObjectStore({
    "albums/photo.jpg": photo,
    "messages/document.pdf": document,
  }, { chunkBytes: 997 });
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
  const snapshotId = "snapshot-round-trip";

  const result = await backupRecoverySnapshot({
    sourceStore: source,
    destinationStore: backup,
    relationalManifest,
    masterKey,
    snapshotId,
    limits: limits(),
  });
  assert.equal(result.completionWritten, true);
  assert.equal(
    backup.operations.at(-1).key,
    recoveryObjectInternals.completionKeyFor(snapshotId),
  );
  const outer = backup.value(recoveryObjectInternals.completionKeyFor(snapshotId)).toString("utf8");
  assert.equal(outer.includes("albums/photo.jpg"), false);
  assert.equal(outer.includes(relationalManifest.entries[0].declaredSha256), false);
  assert.equal(outer.includes(photo.toString("utf8")), false);

  const verification = await verifyRecoverySnapshot({
    backupStore: backup,
    restoreStore: restore,
    masterKey,
    snapshotId,
  });
  assert.equal(verification.contentVerified, true);
  assert.deepEqual(restore.value("albums/photo.jpg"), photo);
  assert.deepEqual(restore.value("messages/document.pdf"), document);
  assert.ok(backup.maximumObservedChunkBytes <= 64 * 1024);
});

test("source hash or size mismatch fails without a completion record", async () => {
  const declared = Buffer.from("declared");
  const source = new InMemoryObjectStore({ "object.bin": Buffer.from("tampered") });
  const backup = new InMemoryObjectStore();
  const relationalManifest = manifestFor([uploadRow("object.bin", declared)]);
  await assert.rejects(
    backupRecoverySnapshot({
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
    backup.keys().includes(recoveryObjectInternals.completionKeyFor("snapshot-hash-failure")),
    false,
  );
});

test("missing source fails closed and is never retried as transient", async () => {
  const value = Buffer.from("missing");
  const source = new InMemoryObjectStore();
  const backup = new InMemoryObjectStore();
  await assert.rejects(
    backupRecoverySnapshot({
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
  const base = new InMemoryObjectStore({ "retry.bin": value });
  let attempts = 0;
  const source = {
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
  await backupRecoverySnapshot({
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
  const snapshotId = "snapshot-authentication";
  const backup = new InMemoryObjectStore();
  await backupRecoverySnapshot({
    sourceStore: new InMemoryObjectStore({ "protected.bin": value }),
    destinationStore: backup,
    relationalManifest: manifestFor([uploadRow("protected.bin", value)]),
    masterKey,
    snapshotId,
    limits: limits(),
  });
  await assert.rejects(
    verifyRecoverySnapshot({
      backupStore: backup,
      masterKey: crypto.randomBytes(32),
      snapshotId,
    }),
    (error) => error.code === "COMPLETION_AUTH_FAILED",
  );

  const completion = backup.value(recoveryObjectInternals.completionKeyFor(snapshotId));
  const outer = JSON.parse(completion.toString("utf8"));
  const { inner } = recoveryObjectInternals.decryptCompletionManifest(
    outer,
    parseRecoveryMasterKey(masterKey),
  );
  const blob = backup.value(inner.entries[0].destinationKey);
  blob[0] ^= 0xff;
  await assert.rejects(
    verifyRecoverySnapshot({ backupStore: backup, masterKey, snapshotId }),
    (error) => ["OBJECT_AUTH_FAILED", "CIPHERTEXT_HASH_MISMATCH"].includes(error.code),
  );

  const incomplete = new InMemoryObjectStore();
  await assert.rejects(
    verifyRecoverySnapshot({
      backupStore: incomplete,
      masterKey,
      snapshotId: "snapshot-no-completion",
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
    const source = new InMemoryObjectStore({ "limit.bin": value });
    const destination = new InMemoryObjectStore();
    await assert.rejects(
      backupRecoverySnapshot({
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

test("backup and restore reject stores that do not guarantee atomic writes", async () => {
  const value = Buffer.from("atomic");
  const relationalManifest = manifestFor([uploadRow("atomic.bin", value)]);
  await assert.rejects(
    backupRecoverySnapshot({
      sourceStore: new InMemoryObjectStore({ "atomic.bin": value }),
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
    }),
    (error) => error.code === "STORE_INVALID",
  );
});

test("concurrent failure drains active workers and never writes completion", async () => {
  const first = Buffer.alloc(80_000, 1);
  const second = Buffer.alloc(80_000, 2);
  const third = Buffer.alloc(80_000, 3);
  const source = new InMemoryObjectStore({
    "first.bin": first,
    "second.bin": Buffer.from("wrong"),
    "third.bin": third,
  }, { chunkBytes: 257 });
  const destination = new InMemoryObjectStore();
  await assert.rejects(
    backupRecoverySnapshot({
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
    destination.keys().includes(
      recoveryObjectInternals.completionKeyFor("snapshot-concurrent-failure"),
    ),
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
  const source = new InMemoryObjectStore({ "collision.bin": value });
  const backup = new InMemoryObjectStore();
  await backupRecoverySnapshot({
    sourceStore: source,
    destinationStore: backup,
    relationalManifest,
    masterKey,
    snapshotId,
    limits: limits(),
    randomBytesFn: deterministicRandom,
  });
  await assert.rejects(
    backupRecoverySnapshot({
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
  const source = new InMemoryObjectStore({ "accounts/private/file-name.jpg": sentinel });
  await backupRecoverySnapshot({
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
