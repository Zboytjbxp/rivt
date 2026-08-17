import crypto from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  assertRestoreUsableSnapshot,
  canonicalTableDigest,
  decryptSnapshot,
  snapshotTableDigests,
} from "./logical-backup-utils.js";

const OBJECT_FORMAT = "rivt-recovery-object-v1";
const ARCHIVE_FORMAT = "rivt-recovery-member-archive-v1";
const COMPLETION_FORMAT = "rivt-recovery-completion-v2";
const INNER_MANIFEST_FORMAT = "rivt-recovery-inner-manifest-v2";
const RELATIONAL_MANIFEST_FORMAT = "rivt-relational-object-manifest-v1";
const DATABASE_BINDING_FORMAT = "rivt-recovery-database-binding-v1";
const MAX_CONCURRENCY = 4;
const DEFAULT_CHUNK_BYTES = 64 * 1024;
const COMPLETION_MAX_BYTES = 8 * 1024 * 1024;
const COMPLETION_INNER_MAX_BYTES = 5 * 1024 * 1024;
const MAX_PROVIDER_VERSION_ID_BYTES = 1024;

export const APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE = "handler-injected-store";

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

function ordinalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function providerVersionId(value, label) {
  const versionId = typeof value === "string" ? value : "";
  if (
    !versionId
    || versionId.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(versionId)
    || Buffer.byteLength(versionId, "utf8") > MAX_PROVIDER_VERSION_ID_BYTES
  ) {
    throw recoveryError("MANIFEST_INVALID", `${label} exceeds the provider-version limit.`);
  }
  return versionId;
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
  if (typeof value === "string") return value;
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
    const entries = Object.entries(value).sort(([left], [right]) => ordinalCompare(left, right));
    return Object.fromEntries(
      entries.map(([key, nested]) => {
          if (nested === undefined) {
            throw recoveryError("CANONICAL_VALUE_INVALID", "Canonical objects cannot contain undefined.");
          }
          return [key, canonicalValue(nested)];
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
    coordinateIdentitySha256: stringField(
      sourceBinding?.coordinateIdentitySha256,
      "sourceBinding.coordinateIdentitySha256",
    ),
  };
  if (
    !validSha256(binding.endpointFingerprint)
    || !validSha256(binding.coordinateIdentitySha256)
  ) {
    throw recoveryError(
      "MANIFEST_INVALID",
      "Source binding fingerprints must be lowercase SHA-256 values.",
    );
  }
  return binding;
}

export function recoverySourceBindingForConfig(config, logicalBucket = "application") {
  const endpoint = stringField(config?.endpoint, "source config endpoint");
  const region = stringField(config?.region, "source config region");
  const bucket = stringField(config?.bucket, "source config bucket");
  return validateSourceBinding({
    logicalBucket,
    provider: "s3-compatible",
    region,
    bucketIdentity: sha256Hex(canonicalRecoveryJson(["bucket", bucket])),
    endpointFingerprint: sha256Hex(canonicalRecoveryJson(["endpoint", endpoint])),
    coordinateIdentitySha256: config?.coordinateIdentitySha256,
  });
}

export function recoverySourceBindingIdentitySha256(sourceBinding) {
  return sourceBindingIdentitySha256(sourceBinding);
}

export function buildRelationalObjectManifest(uploadRows, {
  sourceBinding,
  snapshotAt,
  databaseUploadsTableSha256,
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
  const excludedObjects = [];
  const gaps = [];
  for (const row of uploadRows) {
    const uploadId = stringField(rowField(row, "uploadId", "upload_id"), "uploadId");
    const status = String(rowField(row, "uploadStatus", "upload_status") ?? "stored").trim();
    const rawObjectKey = rowField(row, "objectKey", "object_key");
    let objectKey = "";
    if (rawObjectKey !== undefined && rawObjectKey !== null && rawObjectKey !== "") {
      try {
        objectKey = sourceObjectKey(rawObjectKey);
      } catch {
        gaps.push({ uploadId, reason: "invalid_object_key" });
        continue;
      }
    }
    if (status !== "stored") {
      if (!["pending", "removed", "rejected", "failed"].includes(status)) {
        gaps.push({ uploadId, reason: "unsupported_status" });
      } else {
        excludedByStatus[status] = (excludedByStatus[status] ?? 0) + 1;
        if (objectKey) {
          excludedObjects.push({
            uploadId,
            sourceKey: objectKey,
            status,
          });
        }
      }
      continue;
    }
    if (!objectKey) {
      gaps.push({ uploadId, reason: "missing_object_key" });
      continue;
    }

    let sizeBytes;
    try {
      sizeBytes = integerField(rowField(row, "sizeBytes", "size_bytes"), "sizeBytes");
    } catch {
      gaps.push({ uploadId, reason: "invalid_size" });
      continue;
    }
    const rawDeclaredSha256 = rowField(row, "contentSha256", "content_sha256");
    const declaredSha256 = rawDeclaredSha256 === undefined || rawDeclaredSha256 === null
      ? ""
      : String(rawDeclaredSha256);
    if (declaredSha256 && !validSha256(declaredSha256)) {
      gaps.push({ uploadId, reason: "invalid_hash" });
      continue;
    }
    const normalizedHash = declaredSha256 || null;
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
    .sort((left, right) => ordinalCompare(left.sourceKey, right.sourceKey));
  const manifest = {
    format: RELATIONAL_MANIFEST_FORMAT,
    snapshotAt: new Date(capturedAt).toISOString(),
    sourceBinding: binding,
    databaseUploadsTableSha256: String(databaseUploadsTableSha256 ?? "").toLowerCase(),
    entries,
    excludedByStatus,
    excludedObjects: excludedObjects.sort((left, right) => (
      ordinalCompare(
        `${left.sourceKey}:${left.status}:${left.uploadId}`,
        `${right.sourceKey}:${right.status}:${right.uploadId}`,
      )
    )),
    metadataGaps: gaps.sort((left, right) => (
      ordinalCompare(`${left.reason}:${left.uploadId}`, `${right.reason}:${right.uploadId}`)
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
  const uploadsTableSha256 = String(snapshot.manifest?.tableDigests?.uploads ?? "").toLowerCase();
  if (
    !validSha256(uploadsTableSha256)
    || uploadsTableSha256 !== canonicalTableDigest(uploads.rows, uploads.columns)
  ) {
    throw recoveryError(
      "SNAPSHOT_BINDING_INVALID",
      "Logical snapshot uploads-table digest is invalid.",
    );
  }
  return buildRelationalObjectManifest(
    uploads.rows.map((row) => ({ ...row, uploadId: row.uploadId ?? row.upload_id ?? row.id })),
    {
      sourceBinding,
      snapshotAt: snapshot.createdAt ?? snapshot.manifest?.createdAt,
      databaseUploadsTableSha256: uploadsTableSha256,
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
  if (!validSha256(manifest.databaseUploadsTableSha256)) {
    throw recoveryError("MANIFEST_INVALID", "Object manifest is not bound to the uploads-table digest.");
  }
  const expectedMissingHashes = manifest.entries.filter((entry) => !entry.declaredSha256).length;
  if (manifest.needsSourceHashCount !== expectedMissingHashes) {
    throw recoveryError("MANIFEST_INVALID", "Object manifest missing-hash aggregate is inconsistent.");
  }
  const digestInput = { ...manifest };
  delete digestInput.manifestSha256;
  if (manifest.manifestSha256 !== sha256Hex(canonicalRecoveryJson(digestInput))) {
    throw recoveryError("MANIFEST_DIGEST_MISMATCH", "Relational object manifest digest does not match.");
  }
}

function isoDateTime(value, label) {
  const text = stringField(value, label);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== text) {
    throw recoveryError("MANIFEST_INVALID", `${label} must be a canonical ISO date-time.`);
  }
  return text;
}

function exactSourceCommit(value, label = "sourceCommit") {
  const commit = stringField(value, label).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commit)) {
    throw recoveryError("MANIFEST_INVALID", `${label} must be an exact 40-character commit.`);
  }
  return commit;
}

export function buildDatabaseRecoveryBinding(snapshot) {
  if (
    snapshot?.format !== "rivt-logical-backup-v2"
    || snapshot?.manifest?.format !== "rivt-logical-backup-manifest-v2"
    || !Array.isArray(snapshot.tables)
  ) {
    throw recoveryError(
      "SNAPSHOT_FORMAT_INVALID",
      "A version-2 logical snapshot and manifest are required for a recovery set.",
    );
  }
  const createdAt = isoDateTime(snapshot.createdAt, "snapshot.createdAt");
  if (snapshot.manifest.createdAt !== createdAt) {
    throw recoveryError("SNAPSHOT_BINDING_INVALID", "Snapshot and manifest creation times differ.");
  }
  const sourceCommit = exactSourceCommit(snapshot.sourceCommit, "snapshot.sourceCommit");
  if (String(snapshot.manifest.sourceCommit ?? "").toLowerCase() !== sourceCommit) {
    throw recoveryError("SNAPSHOT_BINDING_INVALID", "Snapshot and manifest source commits differ.");
  }
  const tableCount = integerField(snapshot.manifest.tableCount, "snapshot.manifest.tableCount");
  const rowCount = integerField(snapshot.manifest.rowCount, "snapshot.manifest.rowCount");
  if (tableCount !== snapshot.tables.length) {
    throw recoveryError("SNAPSHOT_BINDING_INVALID", "Snapshot table count differs from its manifest.");
  }
  const uploadsTable = snapshot.tables.find((table) => table.name === "uploads");
  const uploadsTableSha256 = String(snapshot.manifest.tableDigests?.uploads ?? "").toLowerCase();
  if (!uploadsTable || !validSha256(uploadsTableSha256)) {
    throw recoveryError("UPLOAD_INVENTORY_MISSING", "Snapshot uploads-table digest is missing.");
  }
  if (uploadsTableSha256 !== canonicalTableDigest(uploadsTable.rows, uploadsTable.columns)) {
    throw recoveryError("SNAPSHOT_BINDING_INVALID", "Snapshot uploads-table digest does not match its rows.");
  }
  const binding = {
    format: DATABASE_BINDING_FORMAT,
    logicalFormat: snapshot.format,
    manifestFormat: snapshot.manifest.format,
    createdAt,
    sourceCommit,
    tableCount,
    rowCount,
    uploadsTableSha256,
    manifestSha256: sha256Hex(canonicalRecoveryJson(snapshot.manifest)),
    snapshotSha256: sha256Hex(canonicalRecoveryJson(snapshot)),
  };
  binding.bindingSha256 = sha256Hex(canonicalRecoveryJson(binding));
  return binding;
}

function validateDatabaseRecoveryBinding(binding) {
  if (binding?.format !== DATABASE_BINDING_FORMAT) {
    throw recoveryError("DATABASE_BINDING_INVALID", "Recovery set database binding is unsupported.");
  }
  const normalized = {
    format: DATABASE_BINDING_FORMAT,
    logicalFormat: stringField(binding.logicalFormat, "databaseBinding.logicalFormat"),
    manifestFormat: stringField(binding.manifestFormat, "databaseBinding.manifestFormat"),
    createdAt: isoDateTime(binding.createdAt, "databaseBinding.createdAt"),
    sourceCommit: exactSourceCommit(binding.sourceCommit, "databaseBinding.sourceCommit"),
    tableCount: integerField(binding.tableCount, "databaseBinding.tableCount"),
    rowCount: integerField(binding.rowCount, "databaseBinding.rowCount"),
    uploadsTableSha256: String(binding.uploadsTableSha256 ?? "").toLowerCase(),
    manifestSha256: String(binding.manifestSha256 ?? "").toLowerCase(),
    snapshotSha256: String(binding.snapshotSha256 ?? "").toLowerCase(),
  };
  for (const field of ["uploadsTableSha256", "manifestSha256", "snapshotSha256"]) {
    if (!validSha256(normalized[field])) {
      throw recoveryError("DATABASE_BINDING_INVALID", `databaseBinding.${field} is invalid.`);
    }
  }
  const bindingSha256 = String(binding.bindingSha256 ?? "").toLowerCase();
  if (!validSha256(bindingSha256)) {
    throw recoveryError("DATABASE_BINDING_INVALID", "databaseBinding.bindingSha256 is invalid.");
  }
  if (bindingSha256 !== sha256Hex(canonicalRecoveryJson(normalized))) {
    throw recoveryError("DATABASE_BINDING_INVALID", "Database binding digest does not match.");
  }
  return { ...normalized, bindingSha256 };
}

function validateSnapshotId(value) {
  const snapshotId = String(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,79}$/.test(snapshotId)) {
    throw recoveryError("SNAPSHOT_ID_INVALID", "Snapshot ID must be an opaque 8-80 character identifier.");
  }
  return snapshotId;
}

function sourceObjectKey(value, label = "source object key") {
  const key = typeof value === "string" ? value : "";
  if (
    !key
    || key.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(key)
    || Buffer.byteLength(key, "utf8") > 1024
  ) {
    throw recoveryError("SOURCE_KEY_INVALID", `${label} is not a valid bounded object key.`);
  }
  return key;
}

export function recoverySetIdForDatabaseBinding(masterKey, databaseBinding) {
  const key = parseRecoveryMasterKey(masterKey);
  const binding = validateDatabaseRecoveryBinding(databaseBinding);
  const idKey = deriveKey(key, Buffer.from(binding.bindingSha256, "hex"), "recovery-set-id-v1");
  return `set-${crypto.createHmac("sha256", idKey)
    .update(binding.bindingSha256)
    .digest("hex")
    .slice(0, 48)}`;
}

export function recoveryDatabaseEncryptionSecret(masterKey, databaseBinding) {
  const key = parseRecoveryMasterKey(masterKey);
  const binding = validateDatabaseRecoveryBinding(databaseBinding);
  return deriveKey(
    key,
    Buffer.from(binding.bindingSha256, "hex"),
    "database-artifact-v1",
  ).toString("base64");
}

function databaseKeyFor(snapshotId) {
  return `snapshots/${snapshotId}/database.json.gz.aes256gcm`;
}

function normalizeProviderObjectMetadata(value = {}) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw recoveryError("SOURCE_INVENTORY_INVALID", "Provider object metadata must be a plain object.");
  }
  const rawContentType = value.contentType;
  const contentType = rawContentType === undefined || rawContentType === null
    ? null
    : String(rawContentType);
  if (
    contentType !== null
    && (
      contentType.includes("\0")
      || /[\u0000-\u001f\u007f]/u.test(contentType)
      || Buffer.byteLength(contentType, "utf8") > 1024
    )
  ) {
    throw recoveryError("SOURCE_INVENTORY_INVALID", "Provider content type is invalid.");
  }
  const rawCustomMetadata = value.customMetadata ?? {};
  if (
    !rawCustomMetadata
    || typeof rawCustomMetadata !== "object"
    || Array.isArray(rawCustomMetadata)
    || Object.getPrototypeOf(rawCustomMetadata) !== Object.prototype
  ) {
    throw recoveryError("SOURCE_INVENTORY_INVALID", "Provider custom metadata must be a plain object.");
  }
  const entries = Object.entries(rawCustomMetadata)
    .sort(([left], [right]) => ordinalCompare(left, right));
  if (entries.length > 32) {
    throw recoveryError("SOURCE_INVENTORY_INVALID", "Provider custom metadata exceeds the field limit.");
  }
  let encodedBytes = 0;
  const customMetadata = {};
  for (const [key, rawValue] of entries) {
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(key) || typeof rawValue !== "string") {
      throw recoveryError("SOURCE_INVENTORY_INVALID", "Provider custom metadata is invalid.");
    }
    if (
      rawValue.includes("\0")
      || /[\u0000-\u001f\u007f]/u.test(rawValue)
      || Buffer.byteLength(rawValue, "utf8") > 2048
    ) {
      throw recoveryError("SOURCE_INVENTORY_INVALID", "Provider custom metadata is invalid.");
    }
    encodedBytes += Buffer.byteLength(key, "utf8") + Buffer.byteLength(rawValue, "utf8");
    if (encodedBytes > 8192) {
      throw recoveryError("SOURCE_INVENTORY_INVALID", "Provider custom metadata exceeds the byte limit.");
    }
    customMetadata[key] = rawValue;
  }
  return { contentType, customMetadata };
}

function normalizeInventoryRecord(record) {
  const key = sourceObjectKey(record?.key, "inventory key");
  const sizeBytes = integerField(record?.sizeBytes, "inventory sizeBytes");
  const identity = stringField(record?.identity, "inventory identity");
  const readCondition = stringField(record?.readCondition ?? record?.identity, "inventory read condition");
  if (Buffer.byteLength(identity, "utf8") > 512 || Buffer.byteLength(readCondition, "utf8") > 512) {
    throw recoveryError("SOURCE_INVENTORY_INVALID", "Inventory identity exceeds the local limit.");
  }
  return {
    key,
    sizeBytes,
    identity,
    readCondition,
    providerMetadata: normalizeProviderObjectMetadata(record?.providerMetadata),
  };
}

async function sourceInventory(sourceStore, maximumItems) {
  if (typeof sourceStore?.listInventory !== "function") {
    throw recoveryError("STORE_INVALID", "Source store must provide a bounded full inventory.");
  }
  const raw = await sourceStore.listInventory({ maximumItems });
  if (!Array.isArray(raw)) {
    throw recoveryError("SOURCE_INVENTORY_INVALID", "Source inventory must be a finite array.");
  }
  if (raw.length > maximumItems) {
    throw recoveryError("OBJECT_COUNT_LIMIT", "Source inventory exceeds the configured recovery limit.");
  }
  const records = raw.map(normalizeInventoryRecord)
    .sort((left, right) => ordinalCompare(left.key, right.key));
  for (let index = 1; index < records.length; index += 1) {
    if (records[index - 1].key === records[index].key) {
      throw recoveryError("SOURCE_INVENTORY_INVALID", "Source inventory contains a duplicate key.");
    }
  }
  return {
    records,
    fingerprint: sha256Hex(canonicalRecoveryJson(records)),
  };
}

function reconcileSourceInventory(relationalManifest, inventory) {
  const byKey = new Map(inventory.records.map((record) => [record.key, record]));
  const removedByKey = new Map();
  for (const excluded of relationalManifest.excludedObjects ?? []) {
    const statuses = removedByKey.get(excluded.sourceKey) ?? new Set();
    statuses.add(excluded.status);
    removedByKey.set(excluded.sourceKey, statuses);
  }
  const expected = [];
  for (const entry of relationalManifest.entries) {
    const inventoryEntry = byKey.get(entry.sourceKey);
    if (!inventoryEntry) {
      throw recoveryError("SOURCE_OBJECT_MISSING", "A stored database object is absent from source inventory.");
    }
    if (inventoryEntry.sizeBytes !== entry.declaredSizeBytes) {
      throw recoveryError("SOURCE_SIZE_MISMATCH", "Source inventory size differs from the database snapshot.");
    }
    expected.push({
      ...entry,
      classification: "stored",
      sourceIdentity: inventoryEntry.identity,
      sourceReadCondition: inventoryEntry.readCondition,
      sourceProviderMetadata: inventoryEntry.providerMetadata,
    });
    byKey.delete(entry.sourceKey);
  }
  const classifiedProviderObjects = [...byKey.values()].map((record) => ({
    sourceKey: record.key,
    declaredSizeBytes: record.sizeBytes,
    declaredSha256: null,
    needsSourceHash: true,
    uploadIds: [],
    storageScopes: [],
    kinds: [],
    mimeTypes: [],
    classification: removedByKey.has(record.key) ? "removed" : "provider-unreferenced",
    sourceIdentity: record.identity,
    sourceReadCondition: record.readCondition,
    sourceProviderMetadata: record.providerMetadata,
  }));
  const entries = [...expected, ...classifiedProviderObjects]
    .sort((left, right) => ordinalCompare(left.sourceKey, right.sourceKey));
  return {
    entries,
    reconciliation: {
      storedReferencesMissing: 0,
      declaredSizeMismatches: 0,
      declaredHashMismatches: 0,
      providerOnlyObjects: classifiedProviderObjects
        .filter((entry) => entry.classification === "provider-unreferenced").length,
      removedObjectsStillPresent: classifiedProviderObjects
        .filter((entry) => entry.classification === "removed").length,
      unresolvedObjects: 0,
    },
  };
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
  if (!Array.isArray(entries)) {
    throw recoveryError("MANIFEST_INVALID", "Recovery snapshot object entries must be an array.");
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
    const size = integerField(entry.declaredSizeBytes, "entry.declaredSizeBytes");
    if (size > limits.maxObjectBytes) {
      throw recoveryError("OBJECT_SIZE_LIMIT", "An object exceeds the configured per-object limit.");
    }
    if (entry.declaredSha256 !== null && !validSha256(entry.declaredSha256)) {
      throw recoveryError("MANIFEST_INVALID", "Declared object hashes must be lowercase SHA-256 values or null.");
    }
    total += size;
    if (!Number.isSafeInteger(total) || total > limits.maxTotalBytes) {
      throw recoveryError("TOTAL_SIZE_LIMIT", "Snapshot bytes exceed the configured recovery limit.");
    }
  }
  return total;
}

function preflightCompletionEntries(inner, limits) {
  if (!Array.isArray(inner?.entries)) {
    throw recoveryError("COMPLETION_ENTRY_INVALID", "Completion manifest object entries must be an array.");
  }
  if (
    integerField(inner.objectCount, "completion objectCount")
      !== inner.entries.length
    || inner.entries.length > limits.maxObjects
  ) {
    throw recoveryError("OBJECT_COUNT_LIMIT", "Completion object count exceeds the recovery limit.");
  }
  let total = 0;
  let expectedArchiveOffset = 0;
  const inventoryRecords = [];
  for (const entry of inner.entries) {
    const sourceKey = sourceObjectKey(entry?.sourceKey, "completion entry sourceKey");
    const bytes = integerField(
      entry?.plaintextBytes,
      "completion entry plaintextBytes",
    );
    if (bytes > limits.maxObjectBytes) {
      throw recoveryError("OBJECT_SIZE_LIMIT", "A completed object exceeds the recovery limit.");
    }
    const archiveOffset = integerField(
      entry?.archiveOffset,
      "completion entry archiveOffset",
    );
    const ciphertextBytes = integerField(
      entry?.ciphertextBytes,
      "completion entry ciphertextBytes",
    );
    if (archiveOffset !== expectedArchiveOffset || ciphertextBytes !== bytes) {
      throw recoveryError(
        "ARCHIVE_ENTRY_INVALID",
        "Completion archive entries must be contiguous and preserve member byte lengths.",
      );
    }
    expectedArchiveOffset += ciphertextBytes;
    if (!Number.isSafeInteger(expectedArchiveOffset) || expectedArchiveOffset > limits.maxTotalBytes) {
      throw recoveryError("TOTAL_SIZE_LIMIT", "Completed archive bytes exceed the recovery limit.");
    }
    total += bytes;
    if (!Number.isSafeInteger(total) || total > limits.maxTotalBytes) {
      throw recoveryError("TOTAL_SIZE_LIMIT", "Completed object bytes exceed the recovery limit.");
    }
    inventoryRecords.push(normalizeInventoryRecord({
      key: sourceKey,
      sizeBytes: bytes,
      identity: entry?.sourceIdentity,
      readCondition: entry?.sourceReadCondition,
      providerMetadata: entry?.sourceProviderMetadata,
    }));
  }
  if (integerField(inner.totalPlaintextBytes, "completion totalPlaintextBytes") !== total) {
    throw recoveryError("RESTORE_AGGREGATE_MISMATCH", "Completion aggregate differs from its entries.");
  }
  const archive = inner.archive;
  const archiveBytes = integerField(archive?.byteLength, "completion archive byteLength");
  const archiveSha256 = String(archive?.sha256 ?? "");
  if (
    archive?.format !== ARCHIVE_FORMAT
    || archive?.key !== archiveKeyFor(inner.snapshotId)
    || integerField(archive?.entryCount, "completion archive entryCount")
      !== inner.entries.length
    || archiveBytes !== expectedArchiveOffset
    || archiveBytes !== total
    || !validSha256(archiveSha256)
    || archive?.checksumSha256 !== Buffer.from(archiveSha256, "hex").toString("base64")
    || !providerVersionId(archive?.versionId, "completion archive versionId")
  ) {
    throw recoveryError(
      "ARCHIVE_FORMAT_INVALID",
      "Completion archive receipt or contiguous member index is invalid.",
    );
  }
  isoDateTime(archive?.retentionUntil, "completion archive retentionUntil");
  inventoryRecords.sort((left, right) => ordinalCompare(left.key, right.key));
  if (sha256Hex(canonicalRecoveryJson(inventoryRecords)) !== inner.sourceInventorySha256) {
    throw recoveryError(
      "RECOVERY_SET_BINDING_INVALID",
      "Completion entries do not reproduce the bound source inventory.",
    );
  }
}

function validatedDatabaseArtifactReference(reference, snapshotId, maximumBytes) {
  const key = stringField(reference?.key, "completion database artifact key");
  const expectedKey = databaseKeyFor(snapshotId);
  const byteLength = integerField(
    reference?.byteLength,
    "completion database artifact byteLength",
    { minimum: 1 },
  );
  const sha256 = String(reference?.sha256 ?? "").toLowerCase();
  const checksumSha256 = String(reference?.checksumSha256 ?? "");
  const versionId = providerVersionId(
    reference?.versionId,
    "completion database artifact versionId",
  );
  const retentionUntil = isoDateTime(
    reference?.retentionUntil,
    "completion database artifact retentionUntil",
  );
  if (
    key !== expectedKey
    || byteLength > maximumBytes
    || !validSha256(sha256)
    || checksumSha256 !== Buffer.from(sha256, "hex").toString("base64")
  ) {
    throw recoveryError(
      "DATABASE_ARTIFACT_INVALID",
      "Completion database artifact receipt is invalid.",
    );
  }
  return Object.freeze({
    key,
    byteLength,
    sha256,
    checksumSha256,
    versionId,
    retentionUntil,
  });
}

function opaqueIdFor(masterKey, salt, sourceBinding, sourceKey) {
  const namingKey = deriveKey(masterKey, salt, "opaque-object-name-v1");
  return crypto
    .createHmac("sha256", namingKey)
    .update(canonicalRecoveryJson([sourceBinding.logicalBucket, sourceKey]))
    .digest("hex");
}

function archiveKeyFor(snapshotId) {
  return `snapshots/${snapshotId}/application-objects.bin.aes256gcm`;
}

function completionKeyFor(snapshotId) {
  return `snapshots/${snapshotId}/complete.json`;
}

function objectAad(snapshotId, opaqueId, plaintextBytes, databaseBindingSha256) {
  return Buffer.from(canonicalRecoveryJson([
    OBJECT_FORMAT,
    snapshotId,
    opaqueId,
    plaintextBytes,
    databaseBindingSha256,
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

const SAFE_RECOVERY_FAILURE_MESSAGES = {
  BACKUP_OBJECT_HASH_MISMATCH: "A protected recovery component failed integrity verification.",
  BACKUP_OBJECT_MISSING: "A required protected recovery component is missing.",
  COMPLETION_AUTH_FAILED: "The recovery completion record failed authentication.",
  COMPLETION_MISSING: "The exact recovery completion record is missing.",
  DESTINATION_COLLISION: "A conditional recovery write collided with an existing component.",
  DESTINATION_RETENTION_INVALID: "A recovery component did not receive the required retention.",
  FATAL_METADATA_GAP: "The database object inventory contains an unresolved metadata gap.",
  OBJECT_AUTH_FAILED: "A recovery object failed authentication.",
  RECOVERY_OBJECT_MUTATION_ACTIVE: "An application object mutation is active; recovery capture did not start.",
  RECOVERY_OBJECT_MUTATION_BARRIER_UNAVAILABLE: "The application-object mutation barrier is unavailable.",
  RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH: "The recovery source database identity differs from the reviewed source.",
  RECOVERY_SET_BINDING_INVALID: "Recovery-set components are not consistently bound.",
  RESTORE_CLEANUP_FAILED: "The isolated recovery target could not be cleaned completely.",
  RESTORE_TARGET_NOT_EMPTY: "The isolated recovery target is not empty.",
  SOURCE_HASH_MISMATCH: "A source object differs from the database inventory.",
  SOURCE_INVENTORY_CHANGED: "The source object inventory changed during capture.",
  SOURCE_OBJECT_MISSING: "A database-referenced source object is missing.",
  SOURCE_SIZE_MISMATCH: "A source object size differs from the database inventory.",
};

export function sanitizedRecoverySuccess(result) {
  const allowed = [
    "ok",
    "mode",
    "recoverySetIdentitySha256",
    "sourceCommit",
    "objectCount",
    "totalPlaintextBytes",
    "completionWritten",
    "restrictedEvidenceRecorded",
    "databaseArtifactVerified",
    "contentVerified",
    "targetReferenceByteSmokePassed",
    "applicationReadSmokePassed",
    "restoreTargetCleaned",
    "databaseTargetCleaned",
    "storageScopes",
    "durationMs",
  ];
  const sanitized = Object.fromEntries(
    allowed.filter((field) => result?.[field] !== undefined).map((field) => [field, result[field]]),
  );
  if (
    result?.applicationReadSmokeEvidenceLevel
    === APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE
  ) {
    sanitized.applicationReadSmokeEvidenceLevel =
      APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE;
  }
  if (result?.reconciliation) {
    sanitized.reconciliation = Object.fromEntries([
      "storedReferencesMissing",
      "declaredSizeMismatches",
      "declaredHashMismatches",
      "providerOnlyObjects",
      "removedObjectsStillPresent",
      "unresolvedObjects",
    ].map((field) => [field, integerField(result.reconciliation[field] ?? 0, field)]));
  }
  return sanitized;
}

export function sanitizedRecoveryFailure(error, mode = "complete-recovery-set") {
  const code = error instanceof RecoveryError ? error.code : "RECOVERY_FAILED";
  return {
    ok: false,
    mode,
    errorCode: code,
    message: SAFE_RECOVERY_FAILURE_MESSAGES[code] ?? "Recovery failed closed.",
  };
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

async function prepareStagedArchive(stagedEntries) {
  const aggregateHash = crypto.createHash("sha256");
  const ordered = [...stagedEntries]
    .sort((left, right) => ordinalCompare(left.opaqueId, right.opaqueId));
  const entries = [];
  let archiveOffset = 0;
  for (const staged of ordered) {
    const memberHash = crypto.createHash("sha256");
    let ciphertextBytes = 0;
    for await (const chunk of createReadStream(staged.tempPath, {
      highWaterMark: DEFAULT_CHUNK_BYTES,
    })) {
      ciphertextBytes += chunk.length;
      if (ciphertextBytes > staged.entry.declaredSizeBytes) {
        throw recoveryError(
          "CIPHERTEXT_SIZE_MISMATCH",
          "A staged archive member exceeds its declared size.",
        );
      }
      memberHash.update(chunk);
      aggregateHash.update(chunk);
    }
    if (
      ciphertextBytes !== staged.entry.declaredSizeBytes
      || memberHash.digest("hex") !== staged.ciphertextSha256
    ) {
      throw recoveryError(
        "CIPHERTEXT_HASH_MISMATCH",
        "A staged archive member differs from its verified ciphertext.",
      );
    }
    entries.push({
      ...staged,
      archiveOffset,
      ciphertextBytes,
    });
    archiveOffset += ciphertextBytes;
    if (!Number.isSafeInteger(archiveOffset)) {
      throw recoveryError("TOTAL_SIZE_LIMIT", "Archive bytes exceed the safe integer limit.");
    }
  }
  return {
    entries,
    byteLength: archiveOffset,
    sha256: aggregateHash.digest("hex"),
  };
}

async function* stagedArchiveStream(archivePlan) {
  const aggregateHash = crypto.createHash("sha256");
  let archiveBytes = 0;
  for (const staged of archivePlan.entries) {
    const memberHash = crypto.createHash("sha256");
    let memberBytes = 0;
    for await (const chunk of createReadStream(staged.tempPath, {
      highWaterMark: DEFAULT_CHUNK_BYTES,
    })) {
      memberBytes += chunk.length;
      archiveBytes += chunk.length;
      if (
        memberBytes > staged.ciphertextBytes
        || archiveBytes > archivePlan.byteLength
      ) {
        throw recoveryError(
          "CIPHERTEXT_SIZE_MISMATCH",
          "The staged archive stream exceeds its verified bounds.",
        );
      }
      memberHash.update(chunk);
      aggregateHash.update(chunk);
      yield chunk;
    }
    if (
      memberBytes !== staged.ciphertextBytes
      || memberHash.digest("hex") !== staged.ciphertextSha256
    ) {
      throw recoveryError(
        "CIPHERTEXT_HASH_MISMATCH",
        "The staged archive stream differs from its verified member.",
      );
    }
  }
  if (
    archiveBytes !== archivePlan.byteLength
    || aggregateHash.digest("hex") !== archivePlan.sha256
  ) {
    throw recoveryError(
      "ARCHIVE_HASH_MISMATCH",
      "The staged archive stream differs from its verified aggregate.",
    );
  }
}

async function stageVerifiedCiphertext({
  sourceStore,
  entry,
  objectOrdinal,
  objectCount,
  masterKey,
  salt,
  snapshotId,
  opaqueId,
  databaseBindingSha256,
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
    cipher.setAAD(objectAad(
      snapshotId,
      opaqueId,
      entry.declaredSizeBytes,
      databaseBindingSha256,
    ));
    const plaintextHash = crypto.createHash("sha256");
    let plaintextBytes = 0;
    const verifier = new Transform({
      transform(chunk, _encoding, callback) {
        plaintextHash.update(chunk);
        plaintextBytes += chunk.length;
        if (plaintextBytes > entry.declaredSizeBytes) {
          callback(recoveryError("SOURCE_SIZE_MISMATCH", "Source object exceeds its manifest size."));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      const source = await sourceStore.openRead(entry.sourceKey, {
        expectedIdentity: entry.sourceReadCondition,
      });
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
      if (entry.declaredSha256 && observedHash !== entry.declaredSha256) {
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
        iv: iv.toString("base64"),
        tag: authTag.toString("base64"),
        ciphertextSha256: ciphertext.hex,
        plaintextSha256: observedHash,
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
    innerManifest.database.bindingSha256,
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
    databaseBindingSha256: innerManifest.database.bindingSha256,
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
  const objectCount = integerField(outer.objectCount, "objectCount");
  const totalPlaintextBytes = integerField(
    outer.totalPlaintextBytes,
    "totalPlaintextBytes",
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
    String(outer.databaseBindingSha256 ?? ""),
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
    || inner.database?.bindingSha256 !== outer.databaseBindingSha256
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

function protectedWriteReceipt(receipt, expectedChecksum, minimumRetentionUntil, label) {
  const versionId = providerVersionId(receipt?.versionId, `${label} versionId`);
  const checksumSha256 = stringField(receipt?.checksumSha256, `${label} checksumSha256`);
  if (checksumSha256 !== expectedChecksum) {
    throw recoveryError("DESTINATION_CHECKSUM_MISMATCH", `${label} checksum receipt differs.`);
  }
  if (receipt?.retentionMode !== "COMPLIANCE") {
    throw recoveryError("DESTINATION_RETENTION_INVALID", `${label} is not COMPLIANCE retained.`);
  }
  const retentionUntil = isoDateTime(receipt.retentionUntil, `${label} retentionUntil`);
  if (new Date(retentionUntil) < new Date(minimumRetentionUntil)) {
    throw recoveryError("DESTINATION_RETENTION_INVALID", `${label} retention is too short.`);
  }
  return { versionId, checksumSha256, retentionUntil };
}

function completionInnerManifest({
  snapshotId,
  relationalManifest,
  destinationStoreIdentitySha256,
  sourceInventorySha256,
  databaseBinding,
  databaseReceipt,
  archiveReceipt,
  reconciliation,
  entries,
  totalPlaintextBytes,
}) {
  return {
    format: INNER_MANIFEST_FORMAT,
    snapshotId,
    sourceSnapshotAt: relationalManifest.snapshotAt,
    sourceManifestSha256: relationalManifest.manifestSha256,
    sourceBinding: relationalManifest.sourceBinding,
    destinationStoreIdentitySha256,
    sourceInventorySha256,
    database: {
      ...databaseBinding,
      artifact: databaseReceipt,
    },
    archive: {
      ...archiveReceipt,
      format: ARCHIVE_FORMAT,
      entryCount: entries.length,
    },
    reconciliation,
    objectCount: entries.length,
    totalPlaintextBytes,
    entries: [...entries].sort((left, right) => ordinalCompare(left.opaqueId, right.opaqueId)),
  };
}

function assertCompletionCapacityBeforeWrites({
  snapshotId,
  relationalManifest,
  destinationStoreIdentitySha256,
  sourceInventorySha256,
  databaseBinding,
  databaseBytes,
  archivePlan,
  reconciliation,
  stagedEntries,
  totalPlaintextBytes,
  minimumRetentionUntil,
}) {
  // Backslash is the largest legal JSON-escaping case after control
  // characters are rejected, so this reserves the true serialized maximum.
  const maximumVersionId = "\\".repeat(MAX_PROVIDER_VERSION_ID_BYTES);
  const projectedEntries = stagedEntries.map((staged) => ({
    opaqueId: staged.opaqueId,
    sourceKey: staged.entry.sourceKey,
    sourceIdentity: staged.entry.sourceIdentity,
    sourceReadCondition: staged.entry.sourceReadCondition,
    sourceProviderMetadata: staged.entry.sourceProviderMetadata,
    archiveOffset: staged.archiveOffset,
    ciphertextBytes: staged.ciphertextBytes,
    plaintextBytes: staged.entry.declaredSizeBytes,
    plaintextSha256: staged.plaintextSha256,
    ciphertextSha256: staged.ciphertextSha256,
    iv: staged.iv,
    tag: staged.tag,
    classification: staged.entry.classification,
    storageScopes: staged.entry.storageScopes,
    kinds: staged.entry.kinds,
    mimeTypes: staged.entry.mimeTypes,
    uploadIds: staged.entry.uploadIds,
  }));
  const projected = completionInnerManifest({
    snapshotId,
    relationalManifest,
    destinationStoreIdentitySha256,
    sourceInventorySha256,
    databaseBinding,
    databaseReceipt: {
      key: databaseKeyFor(snapshotId),
      byteLength: databaseBytes.length,
      sha256: sha256Hex(databaseBytes),
      versionId: maximumVersionId,
      checksumSha256: sha256Base64(databaseBytes),
      retentionUntil: minimumRetentionUntil,
    },
    archiveReceipt: {
      key: archiveKeyFor(snapshotId),
      byteLength: archivePlan.byteLength,
      sha256: archivePlan.sha256,
      versionId: maximumVersionId,
      checksumSha256: Buffer.from(archivePlan.sha256, "hex").toString("base64"),
      retentionUntil: minimumRetentionUntil,
    },
    reconciliation,
    entries: projectedEntries,
    totalPlaintextBytes,
  });
  if (Buffer.byteLength(canonicalRecoveryJson(projected), "utf8") > COMPLETION_INNER_MAX_BYTES) {
    throw recoveryError(
      "MANIFEST_SIZE_LIMIT",
      "Completion metadata exceeds the limit before protected writes begin.",
    );
  }
}

async function putProtectedBytes(store, key, body, minimumRetentionUntil, label) {
  const bytes = Buffer.from(body);
  const checksumSha256 = sha256Base64(bytes);
  const receipt = await store.put(key, Readable.from([bytes]), {
    ifNoneMatch: true,
    contentLength: bytes.length,
    checksumSha256,
  });
  return {
    key,
    byteLength: bytes.length,
    sha256: sha256Hex(bytes),
    ...protectedWriteReceipt(receipt, checksumSha256, minimumRetentionUntil, label),
  };
}

async function putProtectedArchive(store, snapshotId, archivePlan, minimumRetentionUntil) {
  const key = archiveKeyFor(snapshotId);
  const checksumSha256 = Buffer.from(archivePlan.sha256, "hex").toString("base64");
  const receipt = await store.put(key, stagedArchiveStream(archivePlan), {
    ifNoneMatch: true,
    contentLength: archivePlan.byteLength,
    checksumSha256,
  });
  return {
    key,
    byteLength: archivePlan.byteLength,
    sha256: archivePlan.sha256,
    ...protectedWriteReceipt(
      receipt,
      checksumSha256,
      minimumRetentionUntil,
      "application-object archive",
    ),
  };
}

export async function backupRecoverySnapshot({
  sourceStore,
  destinationStore,
  relationalManifest,
  databaseBinding,
  databaseArtifact,
  masterKey,
  snapshotId,
  minimumRetentionUntil,
  limits,
  randomBytesFn = crypto.randomBytes,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  logger = () => undefined,
  maxReadAttempts = 3,
  beforeProtectedWrites = async () => undefined,
}) {
  const startedAt = Date.now();
  const key = parseRecoveryMasterKey(masterKey);
  const binding = validateDatabaseRecoveryBinding(databaseBinding);
  const expectedId = recoverySetIdForDatabaseBinding(key, binding);
  const id = validateSnapshotId(snapshotId ?? expectedId);
  if (id !== expectedId) {
    throw recoveryError("RECOVERY_SET_ID_MISMATCH", "Recovery set ID is not bound to the database snapshot.");
  }
  const retentionFloor = isoDateTime(minimumRetentionUntil, "minimumRetentionUntil");
  const databaseBytes = Buffer.from(databaseArtifact ?? []);
  if (!databaseBytes.length || databaseBytes.length > 16 * 1024 * 1024) {
    throw recoveryError("DATABASE_ARTIFACT_SIZE_LIMIT", "Database artifact must be between 1 byte and 16 MiB.");
  }
  let encryptedDatabaseArtifact;
  try {
    encryptedDatabaseArtifact = JSON.parse(databaseBytes.toString("utf8"));
  } catch {
    throw recoveryError("DATABASE_ARTIFACT_INVALID", "Database artifact is not a JSON envelope.");
  }
  let artifactSnapshot;
  try {
    artifactSnapshot = decryptSnapshot(
      encryptedDatabaseArtifact,
      recoveryDatabaseEncryptionSecret(key, binding),
    );
    assertRestoreUsableSnapshot(artifactSnapshot, {
      createdAt: encryptedDatabaseArtifact.createdAt,
      sourceCommit: encryptedDatabaseArtifact.sourceCommit,
    });
    if (
      canonicalRecoveryJson(artifactSnapshot.manifest.tableDigests)
      !== canonicalRecoveryJson(snapshotTableDigests(artifactSnapshot.tables))
    ) {
      throw new Error("table digests differ");
    }
  } catch {
    throw recoveryError(
      "DATABASE_ARTIFACT_INVALID",
      "Database artifact cannot be authenticated as a complete restore-usable snapshot.",
    );
  }
  const artifactBinding = buildDatabaseRecoveryBinding(artifactSnapshot);
  if (artifactBinding.bindingSha256 !== binding.bindingSha256) {
    throw recoveryError("DATABASE_ARTIFACT_BINDING_MISMATCH", "Database artifact differs from its recovery binding.");
  }
  assertRelationalManifestReady(relationalManifest);
  const derivedRelationalManifest = buildRelationalObjectManifestFromSnapshot(artifactSnapshot, {
    sourceBinding: relationalManifest.sourceBinding,
  });
  assertRelationalManifestReady(derivedRelationalManifest);
  if (
    canonicalRecoveryJson(relationalManifest) !== canonicalRecoveryJson(derivedRelationalManifest)
  ) {
    throw recoveryError(
      "SNAPSHOT_BINDING_INVALID",
      "Object inventory is not derived exactly from the authenticated database snapshot.",
    );
  }
  const normalizedLimits = normalizeLimits(limits);
  // Database-declared limits fail before even a read-only provider inventory call.
  preflightEntries(relationalManifest.entries, normalizedLimits);
  const attempts = integerField(maxReadAttempts, "maxReadAttempts", { minimum: 1 });
  if (attempts > 3) throw recoveryError("LIMIT_INVALID", "maxReadAttempts cannot exceed 3.");
  if (typeof beforeProtectedWrites !== "function") {
    throw recoveryError("MANIFEST_INVALID", "Protected-write preflight hook must be a function.");
  }
  if (
    !sourceStore?.openRead
    || sourceStore.bindingIdentitySha256 !== sourceBindingIdentitySha256(relationalManifest.sourceBinding)
    || sourceStore.identitySha256 !== relationalManifest.sourceBinding.coordinateIdentitySha256
    || !destinationStore?.put
    || typeof destinationStore.assertWritableKeys !== "function"
    || destinationStore.atomicPut !== true
    || !validSha256(destinationStore.identitySha256)
    || destinationStore.identitySha256 === sourceStore.identitySha256
  ) {
    throw recoveryError(
      "STORE_INVALID",
      "Recovery stores must implement reads and explicitly atomic protected writes.",
    );
  }

  const inventoryBefore = await sourceInventory(sourceStore, normalizedLimits.maxObjects);
  const reconciled = reconcileSourceInventory(relationalManifest, inventoryBefore);
  const totalPlaintextBytes = preflightEntries(reconciled.entries, normalizedLimits);
  const salt = Buffer.from(randomBytesFn(32));
  if (salt.length !== 32) throw recoveryError("RANDOM_SOURCE_INVALID", "Salt generator must return 32 bytes.");
  const tempDirectory = await mkdtemp(join(tmpdir(), "rivt-recovery-"));
  await chmod(tempDirectory, 0o700);
  emit(logger, {
    event: "recovery_snapshot_started",
    phase: "backup",
    outcome: "started",
    objectCount: reconciled.entries.length,
    aggregateBytes: totalPlaintextBytes,
  });

  let stagedEntries = [];
  let archivePlan;
  let stagingCleaned = false;
  try {
    // No irreversible destination write occurs until every source byte has been staged
    // and a second complete inventory proves the source key set remained stable.
    stagedEntries = await mapWithConcurrency(
      reconciled.entries,
      normalizedLimits.concurrency,
      async (entry, index) => {
        const opaqueId = opaqueIdFor(key, salt, relationalManifest.sourceBinding, entry.sourceKey);
        return {
          entry,
          opaqueId,
          ...(await stageVerifiedCiphertext({
            sourceStore,
            entry,
            objectOrdinal: index + 1,
            objectCount: reconciled.entries.length,
            masterKey: key,
            salt,
            snapshotId: id,
            opaqueId,
            databaseBindingSha256: binding.bindingSha256,
            tempDirectory,
            randomBytesFn,
            maxReadAttempts: attempts,
            sleep,
            logger,
          })),
        };
      },
    );
    const inventoryAfter = await sourceInventory(sourceStore, normalizedLimits.maxObjects);
    if (inventoryBefore.fingerprint !== inventoryAfter.fingerprint) {
      throw recoveryError("SOURCE_INVENTORY_CHANGED", "Source inventory changed during recovery capture.");
    }
    archivePlan = await prepareStagedArchive(stagedEntries);

    assertCompletionCapacityBeforeWrites({
      snapshotId: id,
      relationalManifest,
      destinationStoreIdentitySha256: destinationStore.identitySha256,
      sourceInventorySha256: inventoryAfter.fingerprint,
      databaseBinding: binding,
      databaseBytes,
      archivePlan,
      reconciliation: reconciled.reconciliation,
      stagedEntries: archivePlan.entries,
      totalPlaintextBytes,
      minimumRetentionUntil: retentionFloor,
    });
    destinationStore.assertWritableKeys([
      databaseKeyFor(id),
      archiveKeyFor(id),
      completionKeyFor(id),
    ]);
    await beforeProtectedWrites(Object.freeze({
      snapshotId: id,
      objectKeys: Object.freeze([
        databaseKeyFor(id),
        archiveKeyFor(id),
        completionKeyFor(id),
      ]),
      restoreObjectKeys: Object.freeze(
        reconciled.entries.map((entry) => entry.sourceKey),
      ),
    }));

    const databaseReceipt = await putProtectedBytes(
      destinationStore,
      databaseKeyFor(id),
      databaseBytes,
      retentionFloor,
      "database artifact",
    );
    const archiveReceipt = await putProtectedArchive(
      destinationStore,
      id,
      archivePlan,
      retentionFloor,
    );
    const completedEntries = archivePlan.entries.map((staged, index) => {
      emit(logger, {
        event: "recovery_object_archived",
        phase: "backup",
        outcome: "stored",
        objectOrdinal: index + 1,
        objectCount: archivePlan.entries.length,
        aggregateBytes: staged.entry.declaredSizeBytes,
        retryCount: staged.retryCount,
      });
      return {
        opaqueId: staged.opaqueId,
        sourceKey: staged.entry.sourceKey,
        sourceIdentity: staged.entry.sourceIdentity,
        sourceReadCondition: staged.entry.sourceReadCondition,
        sourceProviderMetadata: staged.entry.sourceProviderMetadata,
        archiveOffset: staged.archiveOffset,
        ciphertextBytes: staged.ciphertextBytes,
        plaintextBytes: staged.entry.declaredSizeBytes,
        plaintextSha256: staged.plaintextSha256,
        ciphertextSha256: staged.ciphertextSha256,
        iv: staged.iv,
        tag: staged.tag,
        classification: staged.entry.classification,
        storageScopes: staged.entry.storageScopes,
        kinds: staged.entry.kinds,
        mimeTypes: staged.entry.mimeTypes,
        uploadIds: staged.entry.uploadIds,
      };
    });

    await Promise.all(stagedEntries.map((entry) => rm(entry.tempPath, { force: true })));
    await rm(tempDirectory, { recursive: true, force: true });
    stagingCleaned = true;

    const innerManifest = completionInnerManifest({
      snapshotId: id,
      relationalManifest,
      destinationStoreIdentitySha256: destinationStore.identitySha256,
      sourceInventorySha256: inventoryAfter.fingerprint,
      databaseBinding: binding,
      databaseReceipt,
      archiveReceipt,
      reconciliation: reconciled.reconciliation,
      entries: completedEntries,
      totalPlaintextBytes,
    });
    const outer = encryptCompletionManifest(innerManifest, key, salt, id, randomBytesFn);
    const completionBytes = Buffer.from(canonicalRecoveryJson(outer));
    if (completionBytes.length > COMPLETION_MAX_BYTES) {
      throw recoveryError("MANIFEST_SIZE_LIMIT", "Stored completion manifest exceeds the local limit.");
    }
    const completionReceipt = await putProtectedBytes(
      destinationStore,
      completionKeyFor(id),
      completionBytes,
      retentionFloor,
      "completion record",
    );
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
      mode: "provider-neutral-complete-set",
      recoverySetIdentitySha256: sha256Hex(id),
      sourceCommit: binding.sourceCommit,
      snapshotId: id,
      objectCount: completedEntries.length,
      totalPlaintextBytes,
      completionWritten: true,
      completionKey: completionReceipt.key,
      completionVersionId: completionReceipt.versionId,
      completionSha256: completionReceipt.sha256,
      completionRetentionMode: "COMPLIANCE",
      completionRetentionUntil: completionReceipt.retentionUntil,
      databaseArtifactVersionId: databaseReceipt.versionId,
      databaseArtifactSha256: databaseReceipt.sha256,
      databaseArtifactRetentionMode: "COMPLIANCE",
      databaseArtifactRetentionUntil: databaseReceipt.retentionUntil,
      archiveVersionId: archiveReceipt.versionId,
      archiveSha256: archiveReceipt.sha256,
      archiveRetentionMode: "COMPLIANCE",
      archiveRetentionUntil: archiveReceipt.retentionUntil,
      reconciliation: reconciled.reconciliation,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    emit(logger, {
      event: "recovery_snapshot_failed",
      phase: "backup",
      outcome: "failed",
      objectCount: reconciled.entries.length,
      aggregateBytes: totalPlaintextBytes,
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof RecoveryError ? error.code : "RECOVERY_FAILED",
    });
    throw error;
  } finally {
    if (!stagingCleaned) {
      await Promise.all(stagedEntries.map((entry) => rm(entry.tempPath, { force: true }).catch(() => undefined)));
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

async function* decryptObjectStream({
  encryptedStream,
  entry,
  masterKey,
  salt,
  snapshotId,
  databaseBindingSha256,
}) {
  const key = deriveKey(masterKey, salt, `object-v1:${entry.opaqueId}`);
  const iv = Buffer.from(entry.iv, "base64");
  const tag = Buffer.from(entry.tag, "base64");
  if (iv.length !== 12 || tag.length !== 16) {
    throw recoveryError("OBJECT_FORMAT_INVALID", "Object cryptographic fields have invalid lengths.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(objectAad(
    snapshotId,
    entry.opaqueId,
    entry.plaintextBytes,
    databaseBindingSha256,
  ));
  decipher.setAuthTag(tag);
  const plaintextHash = crypto.createHash("sha256");
  const ciphertextHash = crypto.createHash("sha256");
  let plaintextBytes = 0;
  let ciphertextBytes = 0;
  try {
    for await (const encryptedChunk of chunked(encryptedStream)) {
      ciphertextBytes += encryptedChunk.length;
      if (ciphertextBytes > entry.ciphertextBytes) {
        throw recoveryError("CIPHERTEXT_SIZE_MISMATCH", "Stored ciphertext exceeds its manifest size.");
      }
      ciphertextHash.update(encryptedChunk);
      const plaintext = decipher.update(encryptedChunk);
      if (plaintext.length) {
        plaintextHash.update(plaintext);
        plaintextBytes += plaintext.length;
        if (plaintextBytes > entry.plaintextBytes) {
          throw recoveryError("RESTORE_SIZE_MISMATCH", "Restored object exceeds its manifest size.");
        }
        yield plaintext;
      }
    }
    const final = decipher.final();
    if (final.length) {
      plaintextHash.update(final);
      plaintextBytes += final.length;
      if (plaintextBytes > entry.plaintextBytes) {
        throw recoveryError("RESTORE_SIZE_MISMATCH", "Restored object exceeds its manifest size.");
      }
      yield final;
    }
  } catch (error) {
    if (error instanceof RecoveryError) throw error;
    throw recoveryError("OBJECT_AUTH_FAILED", "Encrypted recovery object authentication failed.");
  }
  if (plaintextBytes !== entry.plaintextBytes) {
    throw recoveryError("RESTORE_SIZE_MISMATCH", "Restored object size differs from the completion manifest.");
  }
  if (ciphertextBytes !== entry.ciphertextBytes) {
    throw recoveryError("CIPHERTEXT_SIZE_MISMATCH", "Stored ciphertext size differs from the completion manifest.");
  }
  if (plaintextHash.digest("hex") !== entry.plaintextSha256) {
    throw recoveryError("RESTORE_HASH_MISMATCH", "Restored object hash differs from the completion manifest.");
  }
  if (ciphertextHash.digest("hex") !== entry.ciphertextSha256) {
    throw recoveryError("CIPHERTEXT_HASH_MISMATCH", "Stored ciphertext hash differs from the completion manifest.");
  }
}

async function exactVersionBytes(store, reference, maximumBytes, label, minimumRetentionUntil) {
  const objectKey = stringField(reference?.key, `${label} key`);
  const versionId = providerVersionId(reference?.versionId, `${label} versionId`);
  const expectedSha256 = String(reference?.sha256 ?? "").toLowerCase();
  if (!validSha256(expectedSha256)) {
    throw recoveryError("COMPLETION_ENTRY_INVALID", `${label} SHA-256 is invalid.`);
  }
  let inspection;
  try {
    inspection = await store.inspect(objectKey, { versionId });
  } catch {
    throw recoveryError("BACKUP_OBJECT_MISSING", `${label} exact version is missing.`);
  }
  const verifiedReceipt = protectedWriteReceipt(
    inspection,
    Buffer.from(expectedSha256, "hex").toString("base64"),
    minimumRetentionUntil,
    label,
  );
  if (verifiedReceipt.versionId !== versionId) {
    throw recoveryError("BACKUP_OBJECT_MISSING", `${label} exact version is missing.`);
  }
  let body;
  try {
    body = await store.openRead(objectKey, { versionId });
  } catch {
    throw recoveryError("BACKUP_OBJECT_MISSING", `${label} exact version is missing.`);
  }
  const bytes = await readBounded(body, maximumBytes);
  if (sha256Hex(bytes) !== expectedSha256) {
    throw recoveryError("BACKUP_OBJECT_HASH_MISMATCH", `${label} exact-version digest differs.`);
  }
  return bytes;
}

async function inspectExactVersionStream(
  store,
  reference,
  maximumBytes,
  label,
  minimumRetentionUntil,
) {
  const objectKey = stringField(reference?.key, `${label} key`);
  const versionId = providerVersionId(reference?.versionId, `${label} versionId`);
  const expectedSha256 = String(reference?.sha256 ?? "").toLowerCase();
  const byteLength = integerField(reference?.byteLength, `${label} byteLength`);
  if (!validSha256(expectedSha256) || byteLength > maximumBytes) {
    throw recoveryError("ARCHIVE_FORMAT_INVALID", `${label} bounds or SHA-256 are invalid.`);
  }
  let inspection;
  try {
    inspection = await store.inspect(objectKey, { versionId });
  } catch {
    throw recoveryError("BACKUP_OBJECT_MISSING", `${label} exact version is missing.`);
  }
  const verifiedReceipt = protectedWriteReceipt(
    inspection,
    Buffer.from(expectedSha256, "hex").toString("base64"),
    minimumRetentionUntil,
    label,
  );
  if (verifiedReceipt.versionId !== versionId) {
    throw recoveryError("BACKUP_OBJECT_MISSING", `${label} exact version is missing.`);
  }
  return {
    objectKey,
    versionId,
    byteLength,
    sha256: expectedSha256,
  };
}

async function openInspectedExactVersionStream(store, reference, label) {
  let body;
  try {
    body = await store.openRead(reference.objectKey, { versionId: reference.versionId });
  } catch {
    throw recoveryError("BACKUP_OBJECT_MISSING", `${label} exact version is missing.`);
  }
  return {
    body,
    byteLength: reference.byteLength,
    sha256: reference.sha256,
  };
}

function createBoundedArchiveReader(iterable, expectedBytes, expectedSha256) {
  const iterator = chunked(iterable)[Symbol.asyncIterator]();
  const hash = crypto.createHash("sha256");
  let pending = Buffer.alloc(0);
  let receivedBytes = 0;
  let consumedBytes = 0;
  let ended = false;
  let digest;

  async function receive() {
    if (ended) return false;
    const next = await iterator.next();
    if (next.done) {
      ended = true;
      return false;
    }
    const chunk = Buffer.from(next.value);
    receivedBytes += chunk.length;
    if (receivedBytes > expectedBytes) {
      throw recoveryError("ARCHIVE_SIZE_MISMATCH", "Protected archive exceeds its completion bound.");
    }
    hash.update(chunk);
    pending = chunk;
    return true;
  }

  return Object.freeze({
    get consumedBytes() {
      return consumedBytes;
    },
    async readExactly(length) {
      const memberBytes = integerField(length, "archive member length");
      if (consumedBytes + memberBytes > expectedBytes) {
        throw recoveryError("ARCHIVE_SIZE_MISMATCH", "Archive member exceeds the aggregate bound.");
      }
      const member = Buffer.allocUnsafe(memberBytes);
      let written = 0;
      while (written < memberBytes) {
        if (!pending.length && !(await receive())) {
          throw recoveryError("ARCHIVE_SIZE_MISMATCH", "Protected archive ended before its member index.");
        }
        const take = Math.min(memberBytes - written, pending.length);
        pending.copy(member, written, 0, take);
        pending = pending.subarray(take);
        written += take;
      }
      consumedBytes += memberBytes;
      return member;
    },
    async finish() {
      if (pending.length || consumedBytes !== expectedBytes) {
        throw recoveryError("ARCHIVE_SIZE_MISMATCH", "Archive members do not consume the exact aggregate.");
      }
      while (await receive()) {
        if (pending.length) {
          throw recoveryError("ARCHIVE_SIZE_MISMATCH", "Protected archive contains trailing bytes.");
        }
      }
      if (receivedBytes !== expectedBytes) {
        throw recoveryError("ARCHIVE_SIZE_MISMATCH", "Protected archive byte count differs.");
      }
      digest ??= hash.digest("hex");
      if (digest !== expectedSha256) {
        throw recoveryError("ARCHIVE_HASH_MISMATCH", "Protected archive aggregate digest differs.");
      }
    },
    async close() {
      await iterator.return?.();
    },
  });
}

function sourceBindingIdentitySha256(binding) {
  return sha256Hex(canonicalRecoveryJson(validateSourceBinding(binding)));
}

function validateReconciliation(reconciliation) {
  const fields = [
    "storedReferencesMissing",
    "declaredSizeMismatches",
    "declaredHashMismatches",
    "providerOnlyObjects",
    "removedObjectsStillPresent",
    "unresolvedObjects",
  ];
  const normalized = Object.fromEntries(fields.map((field) => [
    field,
    integerField(reconciliation?.[field], `reconciliation.${field}`),
  ]));
  for (const field of [
    "storedReferencesMissing",
    "declaredSizeMismatches",
    "declaredHashMismatches",
    "unresolvedObjects",
  ]) {
    if (normalized[field] !== 0) {
      throw recoveryError("RECOVERY_RECONCILIATION_FAILED", "Recovery-set reconciliation is incomplete.");
    }
  }
  return normalized;
}

async function cleanupRestoredKeys(restoreStore, restoredObjects) {
  const failures = [];
  for (const restored of [...restoredObjects].reverse()) {
    try {
      await restoreStore.delete(restored.key, {
        ...(restored.versionId ? { versionId: restored.versionId } : {}),
      });
    } catch {
      failures.push(restored.key);
    }
  }
  if (failures.length) {
    throw recoveryError("RESTORE_CLEANUP_FAILED", "Isolated restore cleanup did not remove every staged object.");
  }
}

export async function verifyRecoverySnapshot({
  backupStore,
  restoreStore,
  masterKey,
  snapshotId,
  completionVersionId,
  completionSha256,
  completionMinimumRetentionUntil,
  minimumRetentionUntil,
  expectedSourceStoreIdentitySha256,
  limits,
  databaseArtifactConsumer,
  applicationReadSmoke,
  cleanupRestoreStoreAfterVerification = false,
  logger = () => undefined,
}) {
  const startedAt = Date.now();
  const key = parseRecoveryMasterKey(masterKey);
  const id = validateSnapshotId(snapshotId);
  const retentionFloor = isoDateTime(minimumRetentionUntil, "minimumRetentionUntil");
  const recordedCompletionRetentionFloor = isoDateTime(
    completionMinimumRetentionUntil ?? minimumRetentionUntil,
    "completionMinimumRetentionUntil",
  );
  const completionRetentionFloor = new Date(recordedCompletionRetentionFloor) > new Date(retentionFloor)
    ? recordedCompletionRetentionFloor
    : retentionFloor;
  const normalizedLimits = normalizeLimits(limits);
  if (!validSha256(expectedSourceStoreIdentitySha256)) {
    throw recoveryError("STORE_INVALID", "The exact source-store identity is required for restore.");
  }
  if (typeof cleanupRestoreStoreAfterVerification !== "boolean") {
    throw recoveryError("MANIFEST_INVALID", "Restore cleanup selection must be boolean.");
  }
  if (
    !backupStore?.openRead
    || typeof backupStore.inspect !== "function"
    || backupStore.versionedReads !== true
    || !validSha256(backupStore.identitySha256)
  ) {
    throw recoveryError("STORE_INVALID", "Backup store must inspect and enforce exact-version reads.");
  }
  if (
    restoreStore
    && (
      restoreStore.atomicPut !== true
      || typeof restoreStore.put !== "function"
      || typeof restoreStore.assertWritableKeys !== "function"
      || typeof restoreStore.openRead !== "function"
      || typeof restoreStore.delete !== "function"
      || typeof restoreStore.assertEmpty !== "function"
      || !validSha256(restoreStore.identitySha256)
    )
  ) {
    throw recoveryError(
      "STORE_INVALID",
      "Restore stores must be identity-bound, empty, readable, and support atomic writes and cleanup.",
    );
  }
  const completionReference = {
    key: completionKeyFor(id),
    versionId: completionVersionId,
    sha256: completionSha256,
  };
  let completionBytes;
  try {
    completionBytes = await exactVersionBytes(
      backupStore,
      completionReference,
      COMPLETION_MAX_BYTES,
      "completion record",
      completionRetentionFloor,
    );
  } catch (error) {
    if (error?.code === "BACKUP_OBJECT_MISSING") {
      throw recoveryError("COMPLETION_MISSING", "Recovery snapshot has no exact completion record.");
    }
    throw error;
  }
  let outer;
  try {
    outer = JSON.parse(completionBytes.toString("utf8"));
  } catch {
    throw recoveryError("COMPLETION_JSON_INVALID", "Stored completion record is not valid JSON.");
  }
  const { inner, salt } = decryptCompletionManifest(outer, key);
  const databaseBinding = validateDatabaseRecoveryBinding(inner.database);
  const reconciliation = validateReconciliation(inner.reconciliation);
  if (
    !validSha256(inner.sourceManifestSha256)
    || !validSha256(inner.sourceInventorySha256)
  ) {
    throw recoveryError("RECOVERY_SET_BINDING_INVALID", "Recovery-set source digests are invalid.");
  }
  if (
    recoverySetIdForDatabaseBinding(key, databaseBinding) !== id
    || inner.sourceSnapshotAt !== databaseBinding.createdAt
    || inner.database?.artifact?.key !== databaseKeyFor(id)
  ) {
    throw recoveryError("RECOVERY_SET_BINDING_INVALID", "Completion is not bound to this database recovery set.");
  }
  const innerSourceBinding = validateSourceBinding(inner.sourceBinding);
  if (
    !validSha256(inner.destinationStoreIdentitySha256)
    || inner.destinationStoreIdentitySha256 !== backupStore.identitySha256
  ) {
    throw recoveryError(
      "RECOVERY_SET_BINDING_INVALID",
      "Completion is not bound to the exact protected destination store.",
    );
  }
  if (innerSourceBinding.coordinateIdentitySha256 !== expectedSourceStoreIdentitySha256) {
    throw recoveryError(
      "RECOVERY_SET_BINDING_INVALID",
      "Completion is not bound to the exact application source store.",
    );
  }
  preflightCompletionEntries(inner, normalizedLimits);
  const databaseArtifact = validatedDatabaseArtifactReference(
    inner.database?.artifact,
    id,
    16 * 1024 * 1024,
  );
  if (
    restoreStore
    && (
      restoreStore.identitySha256 === backupStore.identitySha256
      || restoreStore.identitySha256 === innerSourceBinding.coordinateIdentitySha256
    )
  ) {
    throw recoveryError("RESTORE_TARGET_NOT_ISOLATED", "Restore target collides with a protected object store.");
  }
  if (restoreStore && inner.entries.length) {
    restoreStore.assertWritableKeys(inner.entries.map((entry) => entry.sourceKey));
  }
  let restoreTargetInitiallyEmpty = false;
  if (restoreStore) {
    await restoreStore.assertEmpty();
    restoreTargetInitiallyEmpty = true;
  }

  const databaseBytes = await exactVersionBytes(backupStore, {
    key: databaseArtifact.key,
    versionId: databaseArtifact.versionId,
    sha256: databaseArtifact.sha256,
  }, 16 * 1024 * 1024, "database artifact",
  new Date(databaseArtifact.retentionUntil) > new Date(retentionFloor)
    ? databaseArtifact.retentionUntil
    : retentionFloor);
  if (databaseBytes.length !== databaseArtifact.byteLength) {
    throw recoveryError("DATABASE_ARTIFACT_SIZE_MISMATCH", "Database artifact byte count differs.");
  }
  const archiveReference = inner.archive;
  const inspectedArchive = await inspectExactVersionStream(
    backupStore,
    archiveReference,
    normalizedLimits.maxTotalBytes,
    "application-object archive",
    new Date(archiveReference.retentionUntil) > new Date(retentionFloor)
      ? archiveReference.retentionUntil
      : retentionFloor,
  );

  const restoredKeys = [];
  const seenSourceKeys = new Set();
  let restoredBytes = 0;
  let applicationRouteReadVerified = false;
  let applicationReadSmokeEvidenceLevel;
  let emptyReferenceReadNotApplicable = false;
  let archiveReader;
  try {
    if (typeof databaseArtifactConsumer === "function") {
      await databaseArtifactConsumer(Buffer.from(databaseBytes), databaseBinding);
    }
    const archiveStream = await openInspectedExactVersionStream(
      backupStore,
      inspectedArchive,
      "application-object archive",
    );
    archiveReader = createBoundedArchiveReader(
      archiveStream.body,
      archiveStream.byteLength,
      archiveStream.sha256,
    );
    for (let index = 0; index < inner.entries.length; index += 1) {
      const entry = inner.entries[index];
      const sourceKey = sourceObjectKey(entry?.sourceKey, "completion entry sourceKey");
      if (seenSourceKeys.has(sourceKey)) {
        throw recoveryError("COMPLETION_ENTRY_INVALID", "Completion manifest contains a duplicate source key.");
      }
      seenSourceKeys.add(sourceKey);
      const plaintextBytes = integerField(
        entry?.plaintextBytes,
        "completion entry plaintextBytes",
      );
      const sourceProviderMetadata = normalizeProviderObjectMetadata(
        entry?.sourceProviderMetadata,
      );
      if (!/^[a-f0-9]{64}$/.test(String(entry?.opaqueId ?? ""))) {
        throw recoveryError("COMPLETION_ENTRY_INVALID", "Completion manifest contains an invalid opaque ID.");
      }
      const expectedOpaqueId = opaqueIdFor(key, salt, innerSourceBinding, sourceKey);
      if (
        expectedOpaqueId !== entry.opaqueId
        || entry.archiveOffset !== archiveReader.consumedBytes
        || entry.ciphertextBytes !== plaintextBytes
        || !validSha256(entry.plaintextSha256)
        || !validSha256(entry.ciphertextSha256)
      ) {
        throw recoveryError("COMPLETION_ENTRY_INVALID", "Completion manifest contains an invalid object entry.");
      }
      const encrypted = await archiveReader.readExactly(entry.ciphertextBytes);
      let plaintext;
      try {
        plaintext = await readBounded(decryptObjectStream({
          encryptedStream: Readable.from([encrypted]),
          entry,
          masterKey: key,
          salt,
          snapshotId: id,
          databaseBindingSha256: databaseBinding.bindingSha256,
        }), plaintextBytes);
        if (restoreStore) {
          const checksumSha256 = Buffer.from(entry.plaintextSha256, "hex").toString("base64");
          const receipt = await restoreStore.put(sourceKey, Readable.from([plaintext]), {
            ifNoneMatch: true,
            contentLength: plaintextBytes,
            checksumSha256,
            providerMetadata: sourceProviderMetadata,
          });
          const restoredReference = {
            key: sourceKey,
            ...(receipt?.versionId ? { versionId: receipt.versionId } : {}),
          };
          restoredKeys.push(restoredReference);
          if (receipt?.checksumSha256 !== checksumSha256) {
            throw recoveryError("RESTORE_WRITE_MISMATCH", "Isolated restore checksum receipt differs.");
          }
          const restoredBody = await restoreStore.openRead(sourceKey, {
            ...(receipt.versionId ? { versionId: receipt.versionId } : {}),
          });
          const restored = await readBounded(restoredBody, plaintextBytes);
          if (restored.length !== plaintextBytes || sha256Hex(restored) !== entry.plaintextSha256) {
            throw recoveryError("RESTORE_WRITE_MISMATCH", "Isolated restore read-back differs.");
          }
        }
      } finally {
        encrypted.fill(0);
        plaintext?.fill(0);
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
    await archiveReader.finish();
    if (inner.entries.length !== inner.objectCount || restoredBytes !== inner.totalPlaintextBytes) {
      throw recoveryError("RESTORE_AGGREGATE_MISMATCH", "Restored aggregate differs from completion data.");
    }
    if (restoreStore) {
      // Store adapters require a positive inventory bound. A one-item sentinel
      // still proves an authenticated empty set restored no unexpected bytes.
      const restoredInventory = await sourceInventory(
        restoreStore,
        Math.max(1, inner.objectCount),
      );
      const expectedKeys = [...seenSourceKeys].sort(ordinalCompare);
      if (
        restoredInventory.records.length !== expectedKeys.length
        || restoredInventory.records.some((record, index) => record.key !== expectedKeys[index])
      ) {
        throw recoveryError("RESTORE_INVENTORY_MISMATCH", "Isolated restore contains missing or unexpected objects.");
      }
      const completionByKey = new Map(inner.entries.map((entry) => [entry.sourceKey, entry]));
      for (const record of restoredInventory.records) {
        const entry = completionByKey.get(record.key);
        if (
          !entry
          || record.sizeBytes !== entry.plaintextBytes
          || canonicalRecoveryJson(record.providerMetadata)
            !== canonicalRecoveryJson(normalizeProviderObjectMetadata(entry.sourceProviderMetadata))
        ) {
          throw recoveryError(
            "RESTORE_INVENTORY_MISMATCH",
            "Isolated restore metadata differs from the completed recovery set.",
          );
        }
        const finalBody = await restoreStore.openRead(record.key, {
          expectedIdentity: record.readCondition,
        });
        const finalBytes = await readBounded(finalBody, entry.plaintextBytes);
        if (
          finalBytes.length !== entry.plaintextBytes
          || sha256Hex(finalBytes) !== entry.plaintextSha256
        ) {
          throw recoveryError(
            "RESTORE_WRITE_MISMATCH",
            "Final isolated restore bytes differ from the completed recovery set.",
          );
        }
      }
      if (typeof applicationReadSmoke !== "function") {
        throw recoveryError(
          "APPLICATION_READ_SMOKE_REQUIRED",
          "A representative application-object read smoke is required before cleanup.",
        );
      }
      const smokeReceipt = await applicationReadSmoke({
        entries: inner.entries.map((entry) => Object.freeze({
          sourceKey: entry.sourceKey,
          plaintextBytes: entry.plaintextBytes,
          plaintextSha256: entry.plaintextSha256,
          storageScopes: Object.freeze([...(entry.storageScopes ?? [])]),
        })),
        openRestoredObject: (sourceKey) => restoreStore.openRead(
          sourceObjectKey(sourceKey, "application read source key"),
        ),
      });
      const representativeObjectCount = smokeReceipt?.representativeObjectCount;
      const hasStoredApplicationReference = inner.entries.some(
        (entry) => Array.isArray(entry.storageScopes) && entry.storageScopes.length > 0,
      );
      const handlerRouteReadClaimed = smokeReceipt?.mode === "isolated-application-route";
      const reportedEvidenceLevel = smokeReceipt?.applicationReadSmokeEvidenceLevel;
      applicationRouteReadVerified = handlerRouteReadClaimed
        && reportedEvidenceLevel === APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE;
      const localReferenceReadVerified = smokeReceipt?.mode === "provider-neutral-local-reference";
      emptyReferenceReadNotApplicable =
        smokeReceipt?.mode === "not-applicable-no-stored-references";
      const evidenceLevelValid = handlerRouteReadClaimed
        ? applicationRouteReadVerified
        : reportedEvidenceLevel === undefined;
      const smokePassed = smokeReceipt?.ok === true
        && evidenceLevelValid
        && Number.isSafeInteger(representativeObjectCount)
        && (
          (
            representativeObjectCount >= 1
            && (applicationRouteReadVerified || localReferenceReadVerified)
          )
          || (
            representativeObjectCount === 0
            && smokeReceipt?.notApplicableNoStoredReferences === true
            && emptyReferenceReadNotApplicable
            && !hasStoredApplicationReference
          )
        );
      if (!smokePassed) {
        throw recoveryError(
          "APPLICATION_READ_SMOKE_FAILED",
          "Representative application-object reads did not pass.",
        );
      }
      if (applicationRouteReadVerified) {
        applicationReadSmokeEvidenceLevel =
          APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE;
      }
      if (cleanupRestoreStoreAfterVerification) {
        await cleanupRestoredKeys(restoreStore, restoredKeys);
        restoredKeys.length = 0;
        await restoreStore.assertEmpty();
      }
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
      recoverySetIdentitySha256: sha256Hex(id),
      sourceCommit: databaseBinding.sourceCommit,
      objectCount: inner.objectCount,
      totalPlaintextBytes: restoredBytes,
      databaseArtifactVerified: typeof databaseArtifactConsumer === "function",
      contentVerified: true,
      targetReferenceByteSmokePassed: Boolean(restoreStore),
      applicationReadSmokePassed: Boolean(
        restoreStore
        && (
          applicationRouteReadVerified
          || emptyReferenceReadNotApplicable
        )
      ),
      ...(applicationReadSmokeEvidenceLevel
        ? { applicationReadSmokeEvidenceLevel }
        : {}),
      restoreTargetCleaned: Boolean(restoreStore && cleanupRestoreStoreAfterVerification),
      reconciliation,
      storageScopes: [...new Set(inner.entries.flatMap((entry) => entry.storageScopes ?? []))].sort(),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    let reported = error;
    if (restoreStore && restoreTargetInitiallyEmpty) {
      try {
        if (restoredKeys.length) await cleanupRestoredKeys(restoreStore, restoredKeys);
        await restoreStore.assertEmpty();
      } catch (cleanupError) {
        reported = cleanupError?.code === "RESTORE_CLEANUP_FAILED"
          ? cleanupError
          : recoveryError(
            "RESTORE_CLEANUP_FAILED",
            "Isolated restore cleanup left unexpected object state.",
          );
      }
    }
    emit(logger, {
      event: "recovery_restore_failed",
      phase: "restore",
      outcome: "failed",
      objectCount: inner.objectCount,
      aggregateBytes: restoredBytes,
      durationMs: Date.now() - startedAt,
      errorCode: reported instanceof RecoveryError ? reported.code : "RESTORE_FAILED",
    });
    throw reported;
  } finally {
    if (archiveReader) await archiveReader.close().catch(() => undefined);
  }
}

export class InMemoryObjectStore {
  constructor(initialEntries = {}, {
    chunkBytes = 13,
    name = `memory-${crypto.randomUUID()}`,
    retentionUntil = "2099-01-01T00:00:00.000Z",
    bindingIdentitySha256,
    identitySha256,
    objectMetadata = {},
  } = {}) {
    this.entries = new Map(
      Object.entries(initialEntries).map(([key, value]) => [key, Buffer.from(value)]),
    );
    this.versions = new Map(
      [...this.entries].map(([key, value]) => [
        key,
        `initial-${sha256Hex(Buffer.concat([Buffer.from(key), value])).slice(0, 24)}`,
      ]),
    );
    this.metadata = new Map(
      [...this.entries.keys()].map((key) => [
        key,
        normalizeProviderObjectMetadata(objectMetadata[key]),
      ]),
    );
    this.chunkBytes = chunkBytes;
    this.atomicPut = true;
    this.versionedReads = true;
    this.identitySha256 = identitySha256
      ?? sha256Hex(canonicalRecoveryJson(["in-memory-store", name]));
    if (!validSha256(this.identitySha256)) {
      throw recoveryError("STORE_INVALID", "In-memory store identity must be a SHA-256 value.");
    }
    this.bindingIdentitySha256 = bindingIdentitySha256;
    this.retentionUntil = isoDateTime(retentionUntil, "retentionUntil");
    this.operations = [];
    this.maximumObservedChunkBytes = 0;
    this.versionCounter = 0;
  }

  async openRead(key, { versionId, expectedIdentity } = {}) {
    if (!this.entries.has(key)) {
      const error = recoveryError("OBJECT_NOT_FOUND", "Object does not exist.");
      error.statusCode = 404;
      throw error;
    }
    if (versionId && this.versions.get(key) !== versionId) {
      const error = recoveryError("OBJECT_NOT_FOUND", "Object version does not exist.");
      error.statusCode = 404;
      throw error;
    }
    if (expectedIdentity && sha256Hex(this.entries.get(key)) !== expectedIdentity) {
      throw recoveryError("SOURCE_INVENTORY_CHANGED", "Object identity changed after inventory.");
    }
    const value = this.entries.get(key);
    this.operations.push({ operation: "read", key, versionId: versionId ?? null });
    const chunkBytes = this.chunkBytes;
    return Readable.from((async function* readChunks() {
      for (let offset = 0; offset < value.length; offset += chunkBytes) {
        yield value.subarray(offset, Math.min(offset + chunkBytes, value.length));
      }
    }()));
  }

  async put(key, body, {
    ifNoneMatch = false,
    contentLength,
    checksumSha256,
    providerMetadata,
  } = {}) {
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
    const stored = Buffer.concat(chunks);
    this.entries.set(key, stored);
    this.metadata.set(key, normalizeProviderObjectMetadata(providerMetadata));
    this.versionCounter += 1;
    const versionId = `memory-${this.versionCounter}-${sha256Hex(stored).slice(0, 24)}`;
    this.versions.set(key, versionId);
    this.operations.push({ operation: "put", key, bytes, versionId });
    return {
      versionId,
      checksumSha256: observedChecksum,
      retentionMode: "COMPLIANCE",
      retentionUntil: this.retentionUntil,
    };
  }

  async delete(key, { versionId } = {}) {
    if (versionId && this.versions.get(key) !== versionId) {
      throw recoveryError("OBJECT_NOT_FOUND", "Object version does not exist.");
    }
    this.entries.delete(key);
    this.versions.delete(key);
    this.metadata.delete(key);
    this.operations.push({ operation: "delete", key });
  }

  async listInventory({ maximumItems } = {}) {
    const records = [...this.entries].map(([key, value]) => ({
      key,
      sizeBytes: value.length,
      identity: sha256Hex(value),
      readCondition: sha256Hex(value),
      providerMetadata: this.metadata.get(key),
    })).sort((left, right) => ordinalCompare(left.key, right.key));
    if (maximumItems !== undefined && records.length > maximumItems) {
      throw recoveryError("OBJECT_COUNT_LIMIT", "In-memory inventory exceeds the configured limit.");
    }
    this.operations.push({ operation: "list", count: records.length });
    return records;
  }

  async assertEmpty() {
    if (this.entries.size) {
      throw recoveryError("RESTORE_TARGET_NOT_EMPTY", "Isolated restore store must be empty.");
    }
  }

  async inspect(key, { versionId } = {}) {
    if (!this.entries.has(key) || (versionId && this.versions.get(key) !== versionId)) {
      const error = recoveryError("OBJECT_NOT_FOUND", "Object version does not exist.");
      error.statusCode = 404;
      throw error;
    }
    const value = this.entries.get(key);
    return {
      versionId: this.versions.get(key),
      checksumSha256: sha256Base64(value),
      retentionMode: "COMPLIANCE",
      retentionUntil: this.retentionUntil,
    };
  }

  value(key) {
    return this.entries.get(key);
  }

  versionId(key) {
    return this.versions.get(key);
  }

  keys() {
    return [...this.entries.keys()].sort(ordinalCompare);
  }

  assertWritableKeys(keys) {
    if (!Array.isArray(keys) || !keys.length) {
      throw recoveryError("SOURCE_KEY_INVALID", "Writable object keys are required.");
    }
    for (const key of keys) sourceObjectKey(key, "writable object key");
    return true;
  }
}

export const recoveryObjectInternals = {
  ARCHIVE_FORMAT,
  COMPLETION_FORMAT,
  DATABASE_BINDING_FORMAT,
  INNER_MANIFEST_FORMAT,
  RELATIONAL_MANIFEST_FORMAT,
  completionKeyFor,
  archiveKeyFor,
  databaseKeyFor,
  decryptCompletionManifest,
  encryptCompletionManifest,
  deriveKey,
  opaqueIdFor,
  safeEvent,
  sha256Hex,
};
