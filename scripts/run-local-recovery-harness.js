import crypto from "node:crypto";
import {
  InMemoryObjectStore,
  backupRecoverySnapshot,
  buildRelationalObjectManifest,
  recoveryObjectInternals,
  verifyRecoverySnapshot,
} from "./recovery-object-utils.js";

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
const uploadRows = Object.entries(fixtures).map(([objectKey, value], index) => ({
  uploadId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
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
};
const relationalManifest = buildRelationalObjectManifest(uploadRows, {
  sourceBinding,
  snapshotAt: "2026-07-29T00:00:00.000Z",
});
const sourceStore = new InMemoryObjectStore(fixtures);
const backupStore = new InMemoryObjectStore();
const restoreStore = new InMemoryObjectStore();
const masterKey = crypto.randomBytes(32);
const snapshotId = `local-${crypto.randomUUID()}`;
const limits = {
  maxObjects: 10,
  maxObjectBytes: 1024 * 1024,
  maxTotalBytes: 3 * 1024 * 1024,
  concurrency: 1,
};

const backup = await backupRecoverySnapshot({
  sourceStore,
  destinationStore: backupStore,
  relationalManifest,
  masterKey,
  snapshotId,
  limits,
});
const completionWrittenLast =
  backupStore.operations.at(-1)?.key === recoveryObjectInternals.completionKeyFor(snapshotId);
const restore = await verifyRecoverySnapshot({
  backupStore,
  restoreStore,
  masterKey,
  snapshotId,
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
  maximumObservedChunkBytes: Math.max(
    sourceStore.maximumObservedChunkBytes,
    backupStore.maximumObservedChunkBytes,
    restoreStore.maximumObservedChunkBytes,
  ),
  backupDurationMs: backup.durationMs,
  restoreDurationMs: restore.durationMs,
}, null, 2));
