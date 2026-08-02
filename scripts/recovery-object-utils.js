import crypto from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const OBJECT_FORMAT = "rivt-recovery-object-v1";
const COMPLETION_FORMAT = "rivt-recovery-completion-v1";
const INNER_MANIFEST_FORMAT = "rivt-recovery-inner-manifest-v1";
const RELATIONAL_MANIFEST_FORMAT = "rivt-relational-object-manifest-v1";
const MAX_CONCURRENCY = 4;
const DEFAULT_CHUNK_BYTES = 64 * 1024;
const COMPLETION_MAX_BYTES = 8 * 1024 * 1024;
const COMPLETION_INNER_MAX_BYTES = 5 * 1024 * 1024;

export class RecoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RecoveryError";
    this.code = code;
  }
}

function recoveryError(code, message) {
  return new RecoveryError(code, message);
}

function stringField(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw recoveryError("MANIFEST_INVALID", `${label} is required.`);
  return text;
}

function integerField(value, label, { minimum = 0 } = {}) {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw recoveryError("MANIFEST_INVALID", `${label} must be a safe integer of at least ${minimum}.`);
  }
  return number;
}

function canonicalValue(value) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw recoveryError("CANONICAL_VALUE_INVALID", "Canonical numeric values must be safe integers.");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => {
          if (nested === undefined) {
            throw recoveryError("CANONICAL_VALUE_INVALID", "Canonical objects cannot contain undefined.");
          }
          return [key.normalize("NFC"), canonicalValue(nested)];
        }),
    );
  }
  throw recoveryError("CANONICAL_VALUE_INVALID", `Unsupported canonical value type: ${typeof value}.`);
}

export function canonicalRecoveryJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function parseRecoveryMasterKey(value) {
  if (Buffer.isBuffer(value)) {
    if (value.length !== 32) {
      throw recoveryError("RECOVERY_KEY_INVALID", "Recovery master key must contain exactly 32 bytes.");
    }
    return Buffer.from(value);
  }
  const secret = String(value ?? "").trim();
  if (/^[a-f0-9]{64}$/i.test(secret)) return Buffer.from(secret, "hex");
  if (/^[A-Za-z0-9+/]{43}=$/.test(secret)) {
    const decoded = Buffer.from(secret, "base64");
    if (decoded.length === 32 && decoded.toString("base64") === secret) return decoded;
  }
  if (/^[A-Za-z0-9_-]{43}$/.test(secret)) {
    const decoded = Buffer.from(secret, "base64url");
    if (decoded.length === 32 && decoded.toString("base64url") === secret) return decoded;
  }
  throw recoveryError(
    "RECOVERY_KEY_INVALID",
    "Recovery master key must be exactly 32 bytes encoded as 64 hex, base64, or base64url characters.",
  );
}

function deriveKey(masterKey, salt, purpose) {
  return Buffer.from(crypto.hkdfSync(
    "sha256",
    masterKey,
    salt,
    Buffer.from(`rivt-recovery:${purpose}`, "utf8"),
    32,
  ));
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256Base64(value) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value ?? ""));
}

function rowField(row, camel, snake) {
  return row[camel] ?? row[snake];
}

export function validateSourceBinding(sourceBinding) {
  const binding = {
    logicalBucket: stringField(sourceBinding?.logicalBucket, "sourceBinding.logicalBucket"),
    provider: stringField(sourceBinding?.provider, "sourceBinding.provider"),
    region: stringField(sourceBinding?.region, "sourceBinding.region"),
    bucketIdentity: stringField(sourceBinding?.bucketIdentity, "sourceBinding.bucketIdentity"),
    endpointFingerprint: stringField(
      sourceBinding?.endpointFingerprint,
      "sourceBinding.endpointFingerprint",
    ),
  };
  if (!validSha256(binding.endpointFingerprint)) {
    throw recoveryError(
      "MANIFEST_INVALID",
      "sourceBinding.endpointFingerprint must be a lowercase SHA-256 value.",
    );
  }
  return binding;
}

export function buildRelationalObjectManifest(uploadRows, {
  sourceBinding,
  snapshotAt,
} = {}) {
  if (!Array.isArray(uploadRows)) {
    throw recoveryError("MANIFEST_INVALID", "Upload inventory rows must be an array.");
  }
  const binding = validateSourceBinding(sourceBinding);
  const capturedAt = stringField(snapshotAt, "snapshotAt");
  if (Number.isNaN(Date.parse(capturedAt))) {
    throw recoveryError("MANIFEST_INVALID", "snapshotAt must be an ISO date-time.");
  }

  const groups = new Map();
  const excludedByStatus = {};
  const gaps = [];
  for (const row of uploadRows) {
    const uploadId = stringField(rowField(row, "uploadId", "upload_id"), "uploadId");
    const status = String(rowField(row, "uploadStatus", "upload_status") ?? "stored").trim();
    const objectKey = String(rowField(row, "objectKey", "object_key") ?? "").trim();
    if (status !== "stored") {
      if (!["pending", "removed", "rejected", "failed"].includes(status)) {
        gaps.push({ uploadId, reason: "unsupported_status" });
      } else {
        excludedByStatus[status] = (excludedByStatus[status] ?? 0) + 1;
      }
      continue;
    }
    if (!objectKey) {
      gaps.push({ uploadId, reason: "missing_object_key" });
      continue;
    }

    let sizeBytes;
    try {
      sizeBytes = integerField(rowField(row, "sizeBytes", "size_bytes"), "sizeBytes", { minimum: 1 });
    } catch {
      gaps.push({ uploadId, reason: "invalid_size" });
      continue;
    }
    const declaredSha256 = String(
      rowField(row, "contentSha256", "content_sha256") ?? "",
    ).trim().toLowerCase();
    const normalizedHash = validSha256(declaredSha256) ? declaredSha256 : null;
    const mimeType = String(rowField(row, "mimeType", "mime_type") ?? "application/octet-stream")
      .trim()
      .toLowerCase();
    const storageScope = String(rowField(row, "storageScope", "storage_scope") ?? "legacy").trim();
    const kind = String(row.kind ?? "unknown").trim();
    const existing = groups.get(objectKey);
    if (existing) {
      if (existing.declaredSizeBytes !== sizeBytes) {
        gaps.push({ uploadId, reason: "conflicting_size" });
        continue;
      }
      if (existing.declaredSha256 && normalizedHash && existing.declaredSha256 !== normalizedHash) {
        gaps.push({ uploadId, reason: "conflicting_hash" });
        continue;
      }
      existing.declaredSha256 ??= normalizedHash;
      existing.needsSourceHash = !existing.declaredSha256;
      existing.uploadIds.push(uploadId);
      existing.storageScopes.push(storageScope);
      existing.kinds.push(kind);
      existing.mimeTypes.push(mimeType);
      continue;
    }
    groups.set(objectKey, {
      sourceKey: objectKey,
      declaredSizeBytes: sizeBytes,
      declaredSha256: normalizedHash,
      needsSourceHash: !normalizedHash,
      uploadIds: [uploadId],
      storageScopes: [storageScope],
      kinds: [kind],
      mimeTypes: [mimeType],
    });
  }

  const entries = [...groups.values()]
    .map((entry) => ({
      ...entry,
      uploadIds: [...new Set(entry.uploadIds)].sort(),
      storageScopes: [...new Set(entry.storageScopes)].sort(),
      kinds: [...new Set(entry.kinds)].sort(),
      mimeTypes: [...new Set(entry.mimeTypes)].sort(),
    }))
    .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
  const manifest = {
    format: RELATIONAL_MANIFEST_FORMAT,
    snapshotAt: new Date(capturedAt).toISOString(),
    sourceBinding: binding,
    entries,
    excludedByStatus,
    metadataGaps: gaps.sort((left, right) => (
      `${left.reason}:${left.uploadId}`.localeCompare(`${right.reason}:${right.uploadId}`)
    )),
    objectCount: entries.length,
    totalDeclaredBytes: entries.reduce((total, entry) => total + entry.declaredSizeBytes, 0),
    needsSourceHashCount: entries.filter((entry) => entry.needsSourceHash).length,
  };
  manifest.manifestSha256 = sha256Hex(canonicalRecoveryJson(manifest));
  return manifest;
}

export function buildRelationalObjectManifestFromSnapshot(snapshot, { sourceBinding } = {}) {
  if (snapshot?.format !== "rivt-logical-backup-v2" || !Array.isArray(snapshot.tables)) {
    throw recoveryError(
      "SNAPSHOT_FORMAT_INVALID",
      "A version-2 logical snapshot is required for a coordinated object manifest.",
    );
  }
  const uploads = snapshot.tables.find((table) => table.name === "uploads");
  if (!uploads || !Array.isArray(uploads.rows)) {
    throw recoveryError("UPLOAD_INVENTORY_MISSING", "Logical snapshot does not contain uploads.");
  }
  return buildRelationalObjectManifest(
    uploads.rows.map((row) => ({ ...row, uploadId: row.uploadId ?? row.upload_id ?? row.id })),
    {
      sourceBinding,
      snapshotAt: snapshot.snapshotAt ?? snapshot.manifest?.snapshotAt,
    },
  );
}

export function assertRelationalManifestReady(manifest) {
  if (manifest?.format !== RELATIONAL_MANIFEST_FORMAT) {
    throw recoveryError("MANIFEST_INVALID", "Unsupported relational object manifest.");
  }
  if (manifest.metadataGaps?.length) {
    throw recoveryError(
      "FATAL_METADATA_GAP",
      `Object manifest contains ${manifest.metadataGaps.length} fatal metadata gap(s).`,
    );
  }
  if (manifest.needsSourceHashCount) {
    throw recoveryError(
      "SOURCE_HASH_REQUIRED",
      `Object manifest contains ${manifest.needsSourceHashCount} object(s) without a trustworthy source hash.`,
    );
  }
  const digestInput = { ...manifest };
  delete digestInput.manifestSha256;
  if (manifest.manifestSha256 !== sha256Hex(canonicalRecoveryJson(digestInput))) {
    throw recoveryError("MANIFEST_DIGEST_MISMATCH", "Relational object manifest digest does not match.");
  }
}

function validateSnapshotId(value) {
  const snapshotId = String(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,79}$/.test(snapshotId)) {
    throw recoveryError("SNAPSHOT_ID_INVALID", "Snapshot ID must be an opaque 8-80 character identifier.");
  }
  return snapshotId;
}

function normalizeLimits(limits = {}) {
  const maxObjects = integerField(limits.maxObjects ?? 1_000, "maxObjects", { minimum: 1 });
  const maxObjectBytes = integerField(
    limits.maxObjectBytes ?? 100 * 1024 * 1024,
    "maxObjectBytes",
    { minimum: 1 },
  );
  const maxTotalBytes = integerField(
    limits.maxTotalBytes ?? 1024 * 1024 * 1024,
    "maxTotalBytes",
    { minimum: 1 },
  );
  const concurrency = integerField(limits.concurrency ?? 1, "concurrency", { minimum: 1 });
  if (concurrency > MAX_CONCURRENCY) {
    throw recoveryError("LIMIT_INVALID", `concurrency cannot exceed ${MAX_CONCURRENCY}.`);
  }
  return { maxObjects, maxObjectBytes, maxTotalBytes, concurrency };
}

function preflightEntries(entries, limits) {
  if (!Array.isArray(entries) || !entries.length) {
    throw recoveryError("MANIFEST_EMPTY", "A recovery snapshot must contain at least one object.");
  }
  if (entries.length > limits.maxObjects) {
    throw recoveryError("OBJECT_COUNT_LIMIT", "Object count exceeds the configured recovery limit.");
  }
  const seenKeys = new Set();
  let total = 0;
  for (const entry of entries) {
    const sourceKey = stringField(entry.sourceKey, "entry.sourceKey");
    if (seenKeys.has(sourceKey)) {
      throw recoveryError("DUPLICATE_SOURCE_KEY", "Recovery manifest contains a duplicate source key.");
    }
    seenKeys.add(sourceKey);
    const size = integerField(entry.declaredSizeBytes, "entry.declaredSizeBytes", { minimum: 1 });
    if (size > limits.maxObjectBytes) {
      throw recoveryError("OBJECT_SIZE_LIMIT", "An object exceeds the configured per-object limit.");
    }
    if (!validSha256(entry.declaredSha256)) {
      throw recoveryError("SOURCE_HASH_REQUIRED", "Every recovery object requires a lowercase SHA-256 value.");
    }
    total += size;
    if (!Number.isSafeInteger(total) || total > limits.maxTotalBytes) {
      throw recoveryError("TOTAL_SIZE_LIMIT", "Snapshot bytes exceed the configured recovery limit.");
    }
  }
  return total;
}

function opaqueIdFor(masterKey, salt, sourceBinding, sourceKey) {
  const namingKey = deriveKey(masterKey, salt, "opaque-object-name-v1");
  return crypto
    .createHmac("sha256", namingKey)
    .update(canonicalRecoveryJson([sourceBinding.logicalBucket, sourceKey]))
    .digest("hex");
}

function objectKeyFor(snapshotId, opaqueId) {
  return `snapshots/${snapshotId}/objects/${opaqueId}.bin`;
}

function completionKeyFor(snapshotId) {
  return `snapshots/${snapshotId}/complete.json`;
}

function objectAad(snapshotId, opaqueId, plaintextBytes) {
  return Buffer.from(canonicalRecoveryJson([
    OBJECT_FORMAT,
    snapshotId,
    opaqueId,
    plaintextBytes,
  ]));
}

async function* chunked(iterable, chunkBytes = DEFAULT_CHUNK_BYTES) {
  for await (const value of iterable) {
    const buffer = Buffer.from(value);
    for (let offset = 0; offset < buffer.length; offset += chunkBytes) {
      yield buffer.subarray(offset, Math.min(offset + chunkBytes, buffer.length));
    }
  }
}

function isRetryableReadError(error) {
  const status = Number(error?.$metadata?.httpStatusCode ?? error?.statusCode ?? 0);
  const code = String(error?.code ?? error?.name ?? "");
  return [408, 429, 500, 502, 503, 504].includes(status)
    || ["SlowDown", "ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(code);
}

function safeEvent(payload) {
  const allowed = [
    "event",
    "phase",
    "outcome",
    "objectOrdinal",
    "objectCount",
    "aggregateBytes",
    "durationMs",
    "retryCount",
    "errorCode",
  ];
  return Object.fromEntries(
    allowed.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]),
  );
}

function emit(logger, payload) {
  if (typeof logger === "function") logger(safeEvent(payload));
}

async function hashFile(path) {
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: DEFAULT_CHUNK_BYTES })) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { bytes, hex: hash.digest("hex") };
}

async function stageVerifiedCiphertext({
  sourceStore,
  entry,
  objectKey,
  objectOrdinal,
  objectCount,
  masterKey,
  salt,
  snapshotId,
  opaqueId,
  tempDirectory,
  randomBytesFn,
  maxReadAttempts,
  sleep,
  logger,
}) {
  let retryCount = 0;
  for (let attempt = 1; attempt <= maxReadAttempts; attempt += 1) {
    const tempPath = join(tempDirectory, `${objectOrdinal}-${attempt}.ciphertext`);
    const iv = Buffer.from(randomBytesFn(12));
    if (iv.length !== 12) throw recoveryError("RANDOM_SOURCE_INVALID", "IV generator must return 12 bytes.");
    const objectKeyMaterial = deriveKey(masterKey, salt, `object-v1:${opaqueId}`);
    const cipher = crypto.createCipheriv("aes-256-gcm", objectKeyMaterial, iv);
    cipher.setAAD(objectAad(snapshotId, opaqueId, entry.declaredSizeBytes));
    const plaintextHash = crypto.createHash("sha256");
    let plaintextBytes = 0;
    const verifier = new Transform({
      transform(chunk, _encoding, callback) {
        plaintextHash.update(chunk);
        plaintextBytes += chunk.length;
        callback(null, chunk);
      },
    });

    try {
      const source = await sourceStore.openRead(entry.sourceKey);
      await pipeline(
        chunked(source),
        verifier,
        cipher,
        createWriteStream(tempPath, { flags: "wx", mode: 0o600 }),
      );
      const observedHash = plaintextHash.digest("hex");
      if (plaintextBytes !== entry.declaredSizeBytes) {
        throw recoveryError("SOURCE_SIZE_MISMATCH", "Source object size differs from the manifest.");
      }
      if (observedHash !== entry.declaredSha256) {
        throw recoveryError("SOURCE_HASH_MISMATCH", "Source object hash differs from the manifest.");
      }
      const authTag = cipher.getAuthTag();
      const ciphertext = await hashFile(tempPath);
      if (ciphertext.bytes !== entry.declaredSizeBytes) {
        throw recoveryError("CIPHERTEXT_SIZE_MISMATCH", "Ciphertext size differs from plaintext size.");
      }
      emit(logger, {
        event: "recovery_object_staged",
        phase: "backup",
        outcome: "verified",
        objectOrdinal,
        objectCount,
        aggregateBytes: plaintextBytes,
        retryCount,
      });
      return {
        tempPath,
        objectKey,
        iv: iv.toString("base64"),
        tag: authTag.toString("base64"),
        ciphertextSha256: ciphertext.hex,
        retryCount,
      };
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      if (attempt < maxReadAttempts && isRetryableReadError(error)) {
        retryCount += 1;
        emit(logger, {
          event: "recovery_source_retry",
          phase: "backup",
          outcome: "retrying",
          objectOrdinal,
          objectCount,
          retryCount,
          errorCode: "SOURCE_TRANSIENT",
        });
        await sleep(Math.min(100 * (2 ** (attempt - 1)), 1_000));
        continue;
      }
      if (error?.statusCode === 404 || error?.code === "OBJECT_NOT_FOUND") {
        throw recoveryError("SOURCE_OBJECT_MISSING", "A required source object is missing.");
      }
      if (error instanceof RecoveryError) throw error;
      throw recoveryError(
        isRetryableReadError(error) ? "SOURCE_RETRY_EXHAUSTED" : "SOURCE_READ_FAILED",
        "Source object could not be read.",
      );
    }
  }
  throw recoveryError("SOURCE_RETRY_EXHAUSTED", "Source object retry limit was exhausted.");
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let firstError;
  async function run() {
    while (!firstError && nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        firstError ??= error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  if (firstError) throw firstError;
  return results;
}

function encryptCompletionManifest(innerManifest, masterKey, salt, snapshotId, randomBytesFn) {
  const manifestBytes = Buffer.from(canonicalRecoveryJson(innerManifest));
  if (manifestBytes.length > COMPLETION_INNER_MAX_BYTES) {
    throw recoveryError("MANIFEST_SIZE_LIMIT", "Encrypted completion manifest exceeds the local limit.");
  }
  const iv = Buffer.from(randomBytesFn(12));
  if (iv.length !== 12) throw recoveryError("RANDOM_SOURCE_INVALID", "IV generator must return 12 bytes.");
  const key = deriveKey(masterKey, salt, "completion-manifest-v1");
  const aad = Buffer.from(canonicalRecoveryJson([
    COMPLETION_FORMAT,
    snapshotId,
    innerManifest.objectCount,
    innerManifest.totalPlaintextBytes,
  ]));
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(manifestBytes), cipher.final()]);
  return {
    format: COMPLETION_FORMAT,
    algorithm: "aes-256-gcm",
    kdf: "hkdf-sha256",
    snapshotId,
    salt: salt.toString("base64"),
    objectCount: innerManifest.objectCount,
    totalPlaintextBytes: innerManifest.totalPlaintextBytes,
    manifestIv: iv.toString("base64"),
    manifestTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptCompletionManifest(outer, masterKey) {
  if (
    outer?.format !== COMPLETION_FORMAT
    || outer.algorithm !== "aes-256-gcm"
    || outer.kdf !== "hkdf-sha256"
  ) {
    throw recoveryError("COMPLETION_FORMAT_INVALID", "Unsupported recovery completion format.");
  }
  const snapshotId = validateSnapshotId(outer.snapshotId);
  const objectCount = integerField(outer.objectCount, "objectCount", { minimum: 1 });
  const totalPlaintextBytes = integerField(
    outer.totalPlaintextBytes,
    "totalPlaintextBytes",
    { minimum: 1 },
  );
  const salt = Buffer.from(String(outer.salt ?? ""), "base64");
  const iv = Buffer.from(String(outer.manifestIv ?? ""), "base64");
  const tag = Buffer.from(String(outer.manifestTag ?? ""), "base64");
  if (salt.length !== 32 || iv.length !== 12 || tag.length !== 16) {
    throw recoveryError("COMPLETION_FORMAT_INVALID", "Completion cryptographic fields have invalid lengths.");
  }
  const ciphertext = Buffer.from(String(outer.ciphertext ?? ""), "base64");
  if (ciphertext.length > COMPLETION_MAX_BYTES) {
    throw recoveryError("MANIFEST_SIZE_LIMIT", "Encrypted completion manifest exceeds the local limit.");
  }
  const key = deriveKey(masterKey, salt, "completion-manifest-v1");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(canonicalRecoveryJson([
    COMPLETION_FORMAT,
    snapshotId,
    objectCount,
    totalPlaintextBytes,
  ])));
  decipher.setAuthTag(tag);
  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw recoveryError("COMPLETION_AUTH_FAILED", "Completion manifest authentication failed.");
  }
  let inner;
  try {
    inner = JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw recoveryError("COMPLETION_JSON_INVALID", "Completion manifest is not valid JSON.");
  }
  if (
    inner?.format !== INNER_MANIFEST_FORMAT
    || inner.snapshotId !== snapshotId
    || inner.objectCount !== objectCount
    || inner.totalPlaintextBytes !== totalPlaintextBytes
    || !Array.isArray(inner.entries)
    || inner.entries.length !== objectCount
  ) {
    throw recoveryError("COMPLETION_MISMATCH", "Completion manifest aggregates do not match its envelope.");
  }
  return { inner, salt };
}

async function readBounded(iterable, maximumBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const value of iterable) {
    const chunk = Buffer.from(value);
    bytes += chunk.length;
    if (bytes > maximumBytes) {
      throw recoveryError("MANIFEST_SIZE_LIMIT", "Stored completion manifest exceeds the local limit.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function backupRecoverySnapshot({
  sourceStore,
  destinationStore,
  relationalManifest,
  masterKey,
  snapshotId,
  limits,
  randomBytesFn = crypto.randomBytes,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  logger = () => undefined,
  maxReadAttempts = 3,
}) {
  const startedAt = Date.now();
  const key = parseRecoveryMasterKey(masterKey);
  const id = validateSnapshotId(snapshotId);
  assertRelationalManifestReady(relationalManifest);
  const normalizedLimits = normalizeLimits(limits);
  const totalPlaintextBytes = preflightEntries(relationalManifest.entries, normalizedLimits);
  const attempts = integerField(maxReadAttempts, "maxReadAttempts", { minimum: 1 });
  if (attempts > 3) throw recoveryError("LIMIT_INVALID", "maxReadAttempts cannot exceed 3.");
  if (
    !sourceStore?.openRead
    || !destinationStore?.put
    || destinationStore.atomicPut !== true
  ) {
    throw recoveryError(
      "STORE_INVALID",
      "Recovery stores must implement reads and explicitly atomic destination writes.",
    );
  }

  const salt = Buffer.from(randomBytesFn(32));
  if (salt.length !== 32) throw recoveryError("RANDOM_SOURCE_INVALID", "Salt generator must return 32 bytes.");
  const tempDirectory = await mkdtemp(join(tmpdir(), "rivt-recovery-"));
  await chmod(tempDirectory, 0o700);
  emit(logger, {
    event: "recovery_snapshot_started",
    phase: "backup",
    outcome: "started",
    objectCount: relationalManifest.entries.length,
    aggregateBytes: totalPlaintextBytes,
  });

  try {
    const completedEntries = await mapWithConcurrency(
      relationalManifest.entries,
      normalizedLimits.concurrency,
      async (entry, index) => {
        const opaqueId = opaqueIdFor(
          key,
          salt,
          relationalManifest.sourceBinding,
          entry.sourceKey,
        );
        const destinationKey = objectKeyFor(id, opaqueId);
        const staged = await stageVerifiedCiphertext({
          sourceStore,
          entry,
          objectKey: destinationKey,
          objectOrdinal: index + 1,
          objectCount: relationalManifest.entries.length,
          masterKey: key,
          salt,
          snapshotId: id,
          opaqueId,
          tempDirectory,
          randomBytesFn,
          maxReadAttempts: attempts,
          sleep,
          logger,
        });
        try {
          const file = await stat(staged.tempPath);
          await destinationStore.put(destinationKey, createReadStream(staged.tempPath), {
            ifNoneMatch: true,
            contentLength: file.size,
            checksumSha256: Buffer.from(staged.ciphertextSha256, "hex").toString("base64"),
          });
        } finally {
          await rm(staged.tempPath, { force: true });
        }
        emit(logger, {
          event: "recovery_object_uploaded",
          phase: "backup",
          outcome: "stored",
          objectOrdinal: index + 1,
          objectCount: relationalManifest.entries.length,
          aggregateBytes: entry.declaredSizeBytes,
          retryCount: staged.retryCount,
        });
        return {
          opaqueId,
          sourceKey: entry.sourceKey,
          destinationKey,
          plaintextBytes: entry.declaredSizeBytes,
          plaintextSha256: entry.declaredSha256,
          ciphertextSha256: staged.ciphertextSha256,
          iv: staged.iv,
          tag: staged.tag,
          storageScopes: entry.storageScopes,
          kinds: entry.kinds,
          mimeTypes: entry.mimeTypes,
          uploadIds: entry.uploadIds,
        };
      },
    );

    const innerManifest = {
      format: INNER_MANIFEST_FORMAT,
      snapshotId: id,
      sourceSnapshotAt: relationalManifest.snapshotAt,
      sourceManifestSha256: relationalManifest.manifestSha256,
      sourceBinding: relationalManifest.sourceBinding,
      objectCount: completedEntries.length,
      totalPlaintextBytes,
      entries: completedEntries.sort((left, right) => left.opaqueId.localeCompare(right.opaqueId)),
    };
    const outer = encryptCompletionManifest(innerManifest, key, salt, id, randomBytesFn);
    const completionBytes = Buffer.from(canonicalRecoveryJson(outer));
    if (completionBytes.length > COMPLETION_MAX_BYTES) {
      throw recoveryError("MANIFEST_SIZE_LIMIT", "Stored completion manifest exceeds the local limit.");
    }
    await destinationStore.put(completionKeyFor(id), Readable.from([completionBytes]), {
      ifNoneMatch: true,
      contentLength: completionBytes.length,
      checksumSha256: sha256Base64(completionBytes),
    });
    emit(logger, {
      event: "recovery_snapshot_completed",
      phase: "backup",
      outcome: "complete",
      objectCount: completedEntries.length,
      aggregateBytes: totalPlaintextBytes,
      durationMs: Date.now() - startedAt,
    });
    return {
      ok: true,
      mode: "provider-neutral",
      snapshotId: id,
      objectCount: completedEntries.length,
      totalPlaintextBytes,
      completionWritten: true,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    emit(logger, {
      event: "recovery_snapshot_failed",
      phase: "backup",
      outcome: "failed",
      objectCount: relationalManifest.entries.length,
      aggregateBytes: totalPlaintextBytes,
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof RecoveryError ? error.code : "RECOVERY_FAILED",
    });
    throw error;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function* decryptObjectStream({
  encryptedStream,
  entry,
  masterKey,
  salt,
  snapshotId,
}) {
  const key = deriveKey(masterKey, salt, `object-v1:${entry.opaqueId}`);
  const iv = Buffer.from(entry.iv, "base64");
  const tag = Buffer.from(entry.tag, "base64");
  if (iv.length !== 12 || tag.length !== 16) {
    throw recoveryError("OBJECT_FORMAT_INVALID", "Object cryptographic fields have invalid lengths.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(objectAad(snapshotId, entry.opaqueId, entry.plaintextBytes));
  decipher.setAuthTag(tag);
  const plaintextHash = crypto.createHash("sha256");
  const ciphertextHash = crypto.createHash("sha256");
  let plaintextBytes = 0;
  try {
    for await (const encryptedChunk of chunked(encryptedStream)) {
      ciphertextHash.update(encryptedChunk);
      const plaintext = decipher.update(encryptedChunk);
      if (plaintext.length) {
        plaintextHash.update(plaintext);
        plaintextBytes += plaintext.length;
        yield plaintext;
      }
    }
    const final = decipher.final();
    if (final.length) {
      plaintextHash.update(final);
      plaintextBytes += final.length;
      yield final;
    }
  } catch (error) {
    if (error instanceof RecoveryError) throw error;
    throw recoveryError("OBJECT_AUTH_FAILED", "Encrypted recovery object authentication failed.");
  }
  if (plaintextBytes !== entry.plaintextBytes) {
    throw recoveryError("RESTORE_SIZE_MISMATCH", "Restored object size differs from the completion manifest.");
  }
  if (plaintextHash.digest("hex") !== entry.plaintextSha256) {
    throw recoveryError("RESTORE_HASH_MISMATCH", "Restored object hash differs from the completion manifest.");
  }
  if (ciphertextHash.digest("hex") !== entry.ciphertextSha256) {
    throw recoveryError("CIPHERTEXT_HASH_MISMATCH", "Stored ciphertext hash differs from the completion manifest.");
  }
}

async function consume(iterable) {
  for await (const _chunk of iterable) {
    // Intentionally discard plaintext after cryptographic verification.
  }
}

export async function verifyRecoverySnapshot({
  backupStore,
  restoreStore,
  masterKey,
  snapshotId,
  logger = () => undefined,
}) {
  const startedAt = Date.now();
  const key = parseRecoveryMasterKey(masterKey);
  const id = validateSnapshotId(snapshotId);
  if (!backupStore?.openRead) {
    throw recoveryError("STORE_INVALID", "Backup store does not implement the required interface.");
  }
  if (
    restoreStore
    && (
      restoreStore.atomicPut !== true
      || typeof restoreStore.put !== "function"
      || typeof restoreStore.delete !== "function"
    )
  ) {
    throw recoveryError(
      "STORE_INVALID",
      "Restore stores must implement explicitly atomic writes and deletion.",
    );
  }
  let completion;
  try {
    completion = await backupStore.openRead(completionKeyFor(id));
  } catch {
    throw recoveryError("COMPLETION_MISSING", "Recovery snapshot has no completion record.");
  }
  const completionBytes = await readBounded(completion, COMPLETION_MAX_BYTES);
  let outer;
  try {
    outer = JSON.parse(completionBytes.toString("utf8"));
  } catch {
    throw recoveryError("COMPLETION_JSON_INVALID", "Stored completion record is not valid JSON.");
  }
  const { inner, salt } = decryptCompletionManifest(outer, key);
  const innerSourceBinding = validateSourceBinding(inner.sourceBinding);
  const restoredKeys = [];
  let restoredBytes = 0;
  try {
    for (let index = 0; index < inner.entries.length; index += 1) {
      const entry = inner.entries[index];
      const sourceKey = stringField(entry?.sourceKey, "completion entry sourceKey");
      const plaintextBytes = integerField(
        entry?.plaintextBytes,
        "completion entry plaintextBytes",
        { minimum: 1 },
      );
      if (!/^[a-f0-9]{64}$/.test(String(entry?.opaqueId ?? ""))) {
        throw recoveryError("COMPLETION_ENTRY_INVALID", "Completion manifest contains an invalid opaque ID.");
      }
      const expectedOpaqueId = opaqueIdFor(key, salt, innerSourceBinding, sourceKey);
      if (
        expectedOpaqueId !== entry.opaqueId
        || objectKeyFor(id, entry.opaqueId) !== entry.destinationKey
        || !validSha256(entry.plaintextSha256)
        || !validSha256(entry.ciphertextSha256)
      ) {
        throw recoveryError("COMPLETION_ENTRY_INVALID", "Completion manifest contains an invalid object entry.");
      }
      let encrypted;
      try {
        encrypted = await backupStore.openRead(entry.destinationKey);
      } catch {
        throw recoveryError("BACKUP_OBJECT_MISSING", "A completed recovery object is missing.");
      }
      const plaintext = decryptObjectStream({
        encryptedStream: encrypted,
        entry,
        masterKey: key,
        salt,
        snapshotId: id,
      });
      if (restoreStore) {
        await restoreStore.put(sourceKey, plaintext, {
          ifNoneMatch: true,
          contentLength: plaintextBytes,
          checksumSha256: Buffer.from(entry.plaintextSha256, "hex").toString("base64"),
        });
        restoredKeys.push(sourceKey);
      } else {
        await consume(plaintext);
      }
      restoredBytes += plaintextBytes;
      if (!Number.isSafeInteger(restoredBytes) || restoredBytes > inner.totalPlaintextBytes) {
        throw recoveryError("RESTORE_AGGREGATE_MISMATCH", "Restored byte total exceeds completion data.");
      }
      emit(logger, {
        event: "recovery_object_verified",
        phase: "restore",
        outcome: "verified",
        objectOrdinal: index + 1,
        objectCount: inner.objectCount,
        aggregateBytes: plaintextBytes,
      });
    }
    if (inner.entries.length !== inner.objectCount || restoredBytes !== inner.totalPlaintextBytes) {
      throw recoveryError("RESTORE_AGGREGATE_MISMATCH", "Restored aggregate differs from completion data.");
    }
    emit(logger, {
      event: "recovery_restore_completed",
      phase: "restore",
      outcome: "complete",
      objectCount: inner.objectCount,
      aggregateBytes: restoredBytes,
      durationMs: Date.now() - startedAt,
    });
    return {
      ok: true,
      snapshotId: id,
      objectCount: inner.objectCount,
      totalPlaintextBytes: restoredBytes,
      contentVerified: true,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (restoreStore?.delete) {
      await Promise.all(restoredKeys.map((sourceKey) => restoreStore.delete(sourceKey).catch(() => undefined)));
    }
    emit(logger, {
      event: "recovery_restore_failed",
      phase: "restore",
      outcome: "failed",
      objectCount: inner.objectCount,
      aggregateBytes: restoredBytes,
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof RecoveryError ? error.code : "RESTORE_FAILED",
    });
    throw error;
  }
}

export class InMemoryObjectStore {
  constructor(initialEntries = {}, { chunkBytes = 13 } = {}) {
    this.entries = new Map(
      Object.entries(initialEntries).map(([key, value]) => [key, Buffer.from(value)]),
    );
    this.chunkBytes = chunkBytes;
    this.atomicPut = true;
    this.operations = [];
    this.maximumObservedChunkBytes = 0;
  }

  async openRead(key) {
    if (!this.entries.has(key)) {
      const error = recoveryError("OBJECT_NOT_FOUND", "Object does not exist.");
      error.statusCode = 404;
      throw error;
    }
    const value = this.entries.get(key);
    this.operations.push({ operation: "read", key });
    const chunkBytes = this.chunkBytes;
    return Readable.from((async function* readChunks() {
      for (let offset = 0; offset < value.length; offset += chunkBytes) {
        yield value.subarray(offset, Math.min(offset + chunkBytes, value.length));
      }
    }()));
  }

  async put(key, body, { ifNoneMatch = false, contentLength, checksumSha256 } = {}) {
    if (ifNoneMatch && this.entries.has(key)) {
      throw recoveryError("DESTINATION_COLLISION", "Destination object already exists.");
    }
    const chunks = [];
    let bytes = 0;
    const hash = crypto.createHash("sha256");
    for await (const value of body) {
      const chunk = Buffer.from(value);
      this.maximumObservedChunkBytes = Math.max(this.maximumObservedChunkBytes, chunk.length);
      bytes += chunk.length;
      hash.update(chunk);
      chunks.push(chunk);
    }
    if (contentLength !== undefined && bytes !== contentLength) {
      throw recoveryError("DESTINATION_LENGTH_MISMATCH", "Destination length check failed.");
    }
    const observedChecksum = hash.digest("base64");
    if (checksumSha256 && observedChecksum !== checksumSha256) {
      throw recoveryError("DESTINATION_CHECKSUM_MISMATCH", "Destination checksum check failed.");
    }
    this.entries.set(key, Buffer.concat(chunks));
    this.operations.push({ operation: "put", key, bytes });
  }

  async delete(key) {
    this.entries.delete(key);
    this.operations.push({ operation: "delete", key });
  }

  value(key) {
    return this.entries.get(key);
  }

  keys() {
    return [...this.entries.keys()].sort();
  }
}

export const recoveryObjectInternals = {
  COMPLETION_FORMAT,
  INNER_MANIFEST_FORMAT,
  RELATIONAL_MANIFEST_FORMAT,
  completionKeyFor,
  decryptCompletionManifest,
  deriveKey,
  objectKeyFor,
  opaqueIdFor,
  safeEvent,
  sha256Hex,
};
