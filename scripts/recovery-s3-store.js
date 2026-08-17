import crypto from "node:crypto";
import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetObjectRetentionCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const IDENTITY_FORMAT = "rivt-recovery-s3-coordinate-v1";
const MAX_KEY_BYTES = 1024;
const MAX_PREFIX_BYTES = 900;
const MAX_TOKEN_BYTES = 4096;
const MAX_INVENTORY_ITEMS = 1_000_000;
const MAX_INVENTORY_PAGES = 10_000;
const TRANSIENT_PROVIDER_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "SlowDown",
]);
const ACCEPTED_VERSION_ID = Symbol("accepted-version-id");
const ACCEPTED_OBJECT_KEY = Symbol("accepted-object-key");

export class RecoveryS3StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RecoveryS3StoreError";
    this.code = code;
  }
}

function storeError(code, message) {
  return new RecoveryS3StoreError(code, message);
}

function providerError(error, fallbackCode, message) {
  const statusCode = Number(error?.$metadata?.httpStatusCode ?? error?.statusCode ?? 0);
  const providerCode = String(error?.code ?? error?.name ?? "");
  let code = fallbackCode;
  if (statusCode === 404) code = "OBJECT_NOT_FOUND";
  else if (TRANSIENT_PROVIDER_CODES.has(providerCode)) code = providerCode;
  const wrapped = storeError(code, message);
  if (Number.isSafeInteger(statusCode) && statusCode > 0) wrapped.statusCode = statusCode;
  return wrapped;
}

function exactText(value, label, maximumBytes) {
  if (typeof value !== "string" || !value || value !== value.trim()) {
    throw storeError("S3_COORDINATE_INVALID", `${label} must be an exact non-empty string.`);
  }
  if (value.includes("\0") || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw storeError("S3_COORDINATE_INVALID", `${label} contains a disallowed control character.`);
  }
  if (value !== value.normalize("NFC")) {
    throw storeError("S3_COORDINATE_INVALID", `${label} must use canonical Unicode.`);
  }
  if (Buffer.byteLength(value, "utf8") > maximumBytes) {
    throw storeError("S3_COORDINATE_INVALID", `${label} exceeds the local safety limit.`);
  }
  return value;
}

function ordinalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function opaqueMetadataText(value, label, maximumBytes) {
  if (
    typeof value !== "string"
    || value.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(value)
    || Buffer.byteLength(value, "utf8") > maximumBytes
  ) {
    throw storeError("S3_INVENTORY_INVALID", `${label} is not byte-exact bounded metadata.`);
  }
  return value;
}

function providerObjectMetadata(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw storeError("S3_INVENTORY_INVALID", "S3 object metadata must be an object.");
  }
  const rawContentType = value.contentType;
  const contentType = rawContentType === undefined || rawContentType === null
    ? null
    : opaqueMetadataText(rawContentType, "S3 object content type", 1024);
  const rawMetadata = value.customMetadata ?? {};
  if (
    !rawMetadata
    || typeof rawMetadata !== "object"
    || Array.isArray(rawMetadata)
    || Object.getPrototypeOf(rawMetadata) !== Object.prototype
  ) {
    throw storeError("S3_INVENTORY_INVALID", "S3 custom object metadata must be a plain object.");
  }
  const entries = Object.entries(rawMetadata);
  if (entries.length > 32) {
    throw storeError("S3_INVENTORY_INVALID", "S3 custom object metadata exceeds the field limit.");
  }
  let encodedBytes = 0;
  const customMetadata = {};
  for (const [rawKey, rawValue] of entries.sort(([left], [right]) => ordinalCompare(left, right))) {
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(rawKey)) {
      throw storeError("S3_INVENTORY_INVALID", "S3 custom object metadata contains an invalid key.");
    }
    const metadataValue = opaqueMetadataText(rawValue, "S3 custom object metadata value", 2048);
    encodedBytes += Buffer.byteLength(rawKey, "utf8") + Buffer.byteLength(metadataValue, "utf8");
    if (encodedBytes > 8192) {
      throw storeError("S3_INVENTORY_INVALID", "S3 custom object metadata exceeds the byte limit.");
    }
    customMetadata[rawKey] = metadataValue;
  }
  return Object.freeze({ contentType, customMetadata: Object.freeze(customMetadata) });
}

function normalizeEndpoint(value) {
  const raw = exactText(value, "S3 endpoint", 2048);
  let endpoint;
  try {
    endpoint = new URL(raw);
  } catch {
    throw storeError("S3_COORDINATE_INVALID", "S3 endpoint must be a valid HTTPS origin.");
  }
  if (
    endpoint.protocol !== "https:"
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || (endpoint.pathname && endpoint.pathname !== "/")
  ) {
    throw storeError("S3_COORDINATE_INVALID", "S3 endpoint must be a valid HTTPS origin.");
  }
  return endpoint.origin;
}

function normalizeRegion(value) {
  const region = exactText(value, "S3 region", 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(region)) {
    throw storeError("S3_COORDINATE_INVALID", "S3 region contains unsupported characters.");
  }
  return region;
}

function normalizeBucket(value) {
  const bucket = exactText(value, "S3 bucket", 255);
  if (/[\\/\s]/u.test(bucket)) {
    throw storeError("S3_COORDINATE_INVALID", "S3 bucket contains unsupported characters.");
  }
  return bucket;
}

function validatePathSegments(value, label, maximumBytes, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || value !== value.trim()) {
    throw storeError("S3_KEY_INVALID", `${label} must be exact and cannot contain outer whitespace.`);
  }
  if (!value) {
    if (allowEmpty) return "";
    throw storeError("S3_KEY_INVALID", `${label} is required.`);
  }
  if (
    value.startsWith("/")
    || value.endsWith("/")
    || value.includes("//")
    || value.includes("\\")
    || value !== value.normalize("NFC")
    || value.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(value)
    || value.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw storeError("S3_KEY_INVALID", `${label} is not a safe exact S3 path.`);
  }
  if (Buffer.byteLength(value, "utf8") > maximumBytes) {
    throw storeError("S3_KEY_INVALID", `${label} exceeds the local safety limit.`);
  }
  return value;
}

export function normalizeRecoveryS3Prefix(value, { allowEmpty = false } = {}) {
  return validatePathSegments(value, "S3 base prefix", MAX_PREFIX_BYTES, { allowEmpty });
}

export function normalizeRecoveryS3Key(value) {
  if (
    typeof value !== "string"
    || !value
    || value.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(value)
    || Buffer.byteLength(value, "utf8") > MAX_KEY_BYTES
  ) {
    throw storeError("S3_KEY_INVALID", "S3 object key is not an exact bounded string.");
  }
  return value;
}

function physicalKey(basePrefix, logicalKey) {
  const key = normalizeRecoveryS3Key(logicalKey);
  const physical = basePrefix ? `${basePrefix}/${key}` : key;
  if (Buffer.byteLength(physical, "utf8") > MAX_KEY_BYTES) {
    throw storeError("S3_KEY_INVALID", "Combined S3 object key exceeds the local safety limit.");
  }
  return physical;
}

function logicalKey(basePrefix, key) {
  const physical = normalizeRecoveryS3Key(key);
  if (!basePrefix) return physical;
  const requiredPrefix = `${basePrefix}/`;
  if (!physical.startsWith(requiredPrefix)) {
    throw storeError("S3_INVENTORY_INVALID", "S3 inventory returned an object outside its namespace.");
  }
  return normalizeRecoveryS3Key(physical.slice(requiredPrefix.length));
}

function normalizeForcePathStyle(value) {
  if (typeof value !== "boolean") {
    throw storeError("S3_COORDINATE_INVALID", "S3 addressing mode must be an exact boolean.");
  }
  return value;
}

function normalizeCoordinates({ endpoint, region, bucket, basePrefix, forcePathStyle = false }, { allowEmptyPrefix }) {
  return Object.freeze({
    endpoint: normalizeEndpoint(endpoint),
    region: normalizeRegion(region),
    bucket: normalizeBucket(bucket),
    basePrefix: normalizeRecoveryS3Prefix(basePrefix ?? "", { allowEmpty: allowEmptyPrefix }),
    forcePathStyle: normalizeForcePathStyle(forcePathStyle),
  });
}

function coordinateDigest(coordinates) {
  const canonical = JSON.stringify([
    IDENTITY_FORMAT,
    coordinates.endpoint,
    coordinates.region,
    coordinates.bucket,
    coordinates.basePrefix,
    coordinates.forcePathStyle ? "path" : "virtual-hosted",
  ]);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function recoveryS3CoordinateIdentitySha256(coordinates, { allowEmptyPrefix = false } = {}) {
  return coordinateDigest(normalizeCoordinates(coordinates, { allowEmptyPrefix }));
}

function ensureClient(client) {
  if (!client || typeof client.send !== "function") {
    throw storeError("S3_CLIENT_INVALID", "An injected S3 client with send(command) is required.");
  }
  return client;
}

function assignStoreIdentity(store, coordinates) {
  store.coordinates = coordinates;
  store.identitySha256 = coordinateDigest(coordinates);
}

function validIdentity(value) {
  return /^[a-f0-9]{64}$/u.test(String(value ?? ""));
}

export function assertRecoveryS3LogicalKeysAddressable(
  coordinates,
  logicalKeys,
  { allowEmptyPrefix = false } = {},
) {
  if (!Array.isArray(logicalKeys)) {
    throw storeError("S3_KEY_INVALID", "Recovery object keys must be an explicit array.");
  }
  const normalized = normalizeCoordinates(coordinates, { allowEmptyPrefix });
  for (const key of logicalKeys) physicalKey(normalized.basePrefix, key);
  return true;
}

export function assertRecoveryS3StoreSeparation({ sourceStore, destinationStore, restoreStore }) {
  const stores = [sourceStore, destinationStore, restoreStore];
  if (stores.some((store) => !validIdentity(store?.identitySha256) || !store?.coordinates)) {
    throw storeError(
      "S3_STORE_IDENTITY_INVALID",
      "Every recovery store must expose exact coordinates and their identity.",
    );
  }
  for (let leftIndex = 0; leftIndex < stores.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < stores.length; rightIndex += 1) {
      const left = stores[leftIndex];
      const right = stores[rightIndex];
      const sameBucketName = left.coordinates.bucket === right.coordinates.bucket;
      const sameBackend = left.coordinates.endpoint === right.coordinates.endpoint
        && left.coordinates.region === right.coordinates.region
        && sameBucketName;
      const leftPrefix = left.coordinates.basePrefix;
      const rightPrefix = right.coordinates.basePrefix;
      const overlappingPrefixes = leftPrefix === rightPrefix
        || !leftPrefix
        || !rightPrefix
        || leftPrefix.startsWith(`${rightPrefix}/`)
        || rightPrefix.startsWith(`${leftPrefix}/`);
      if (
        left.identitySha256 === right.identitySha256
        || sameBucketName
        || (sameBackend && overlappingPrefixes)
      ) {
        throw storeError(
          "S3_STORE_COLLISION",
          "Recovery source, destination, and restore must use distinct buckets and namespaces.",
        );
      }
    }
  }
  return true;
}

function boundedInteger(value, label, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw storeError("S3_LIMIT_INVALID", `${label} is outside the supported range.`);
  }
  return value;
}

function boundedNonnegativeInteger(value, label, maximum) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw storeError("S3_LIMIT_INVALID", `${label} is outside the supported range.`);
  }
  return value;
}

function normalizedVersionId(value, { required = true } = {}) {
  if (value === undefined || value === null || value === "") {
    if (!required) return undefined;
    throw storeError("S3_VERSION_INVALID", "An exact non-null S3 version ID is required.");
  }
  if (typeof value !== "string") {
    throw storeError("S3_VERSION_INVALID", "An exact non-null S3 version ID is required.");
  }
  const versionId = value;
  if (
    versionId.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(versionId)
    || Buffer.byteLength(versionId, "utf8") > 1024
  ) {
    throw storeError("S3_VERSION_INVALID", "An exact non-null S3 version ID is required.");
  }
  if (versionId.toLowerCase() === "null") {
    throw storeError("S3_VERSION_INVALID", "An exact non-null S3 version ID is required.");
  }
  return versionId;
}

function returnedVersionId(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw storeError("S3_VERSION_INVALID", "S3 returned an invalid object version identifier.");
  }
  if (
    value.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(value)
    || Buffer.byteLength(value, "utf8") > 1024
  ) {
    throw storeError("S3_VERSION_INVALID", "S3 returned an invalid object version identifier.");
  }
  return value;
}

function normalizedChecksum(value) {
  if (typeof value !== "string" || !value || value !== value.trim()) {
    throw storeError("S3_CHECKSUM_INVALID", "SHA-256 checksum must be canonical base64.");
  }
  const checksum = value;
  if (!/^[A-Za-z0-9+/]{43}=$/u.test(checksum)) {
    throw storeError("S3_CHECKSUM_INVALID", "SHA-256 checksum must be canonical base64.");
  }
  const decoded = Buffer.from(checksum, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== checksum) {
    throw storeError("S3_CHECKSUM_INVALID", "SHA-256 checksum must be canonical base64.");
  }
  return checksum;
}

function isoDateTime(value, label) {
  let date;
  if (value instanceof Date) date = new Date(value);
  else if (typeof value === "string" && value && value === value.trim()) date = new Date(value);
  else throw storeError("S3_RETENTION_INVALID", `${label} must be a valid date-time.`);
  if (Number.isNaN(date.getTime())) {
    throw storeError("S3_RETENTION_INVALID", `${label} must be a valid date-time.`);
  }
  return date.toISOString();
}

function inventoryIdentity(item, metadata, checksumSha256) {
  const etag = exactText(item?.ETag, "S3 inventory ETag", 512);
  let lastModified = null;
  if (item?.LastModified !== undefined) {
    const date = new Date(item.LastModified);
    if (Number.isNaN(date.getTime())) {
      throw storeError("S3_INVENTORY_INVALID", "S3 inventory contains an invalid modification time.");
    }
    lastModified = date.toISOString();
  }
  const algorithms = item?.ChecksumAlgorithm ?? [];
  if (!Array.isArray(algorithms) || algorithms.some((value) => typeof value !== "string")) {
    throw storeError("S3_INVENTORY_INVALID", "S3 inventory contains invalid checksum metadata.");
  }
  return crypto.createHash("sha256").update(JSON.stringify([
    item.Size,
    etag,
    lastModified,
    [...algorithms].sort(),
    checksumSha256,
    metadata,
  ])).digest("hex");
}

async function inventoryObjectDetails({ client, coordinates, item }) {
  const etag = exactText(item?.ETag, "S3 inventory ETag", 512);
  let head;
  try {
    head = await client.send(new HeadObjectCommand({
      Bucket: coordinates.bucket,
      Key: item.Key,
      IfMatch: etag,
      ChecksumMode: "ENABLED",
    }));
  } catch (error) {
    throw providerError(error, "S3_INVENTORY_FAILED", "S3 object metadata could not be read.");
  }
  if (
    !Number.isSafeInteger(head?.ContentLength)
    || head.ContentLength !== item.Size
    || head.ETag !== etag
    || (head.MissingMeta !== undefined
      && (!Number.isSafeInteger(head.MissingMeta) || head.MissingMeta !== 0))
  ) {
    throw storeError("S3_INVENTORY_INVALID", "S3 object metadata differs from its inventory entry.");
  }
  let checksumSha256 = null;
  if (head.ChecksumSHA256 !== undefined && head.ChecksumSHA256 !== null) {
    checksumSha256 = normalizedChecksum(head.ChecksumSHA256);
  }
  const metadata = providerObjectMetadata({
    contentType: head.ContentType,
    customMetadata: head.Metadata,
  });
  return {
    metadata,
    identity: inventoryIdentity(item, metadata, checksumSha256),
    readCondition: etag,
  };
}

async function listInventory({
  client,
  coordinates,
  maximumItems,
  configuredMaximumItems,
  maximumPages,
}) {
  const itemLimit = Math.min(
    boundedInteger(maximumItems, "Inventory item limit", MAX_INVENTORY_ITEMS),
    configuredMaximumItems,
  );
  const records = [];
  const seenKeys = new Set();
  const seenTokens = new Set();
  let continuationToken;
  let pages = 0;

  while (true) {
    pages += 1;
    if (pages > maximumPages) {
      throw storeError("S3_PAGINATION_INVALID", "S3 inventory exceeded the bounded page limit.");
    }
    const remaining = itemLimit - records.length;
    const maxKeys = Math.min(1000, Math.max(1, remaining + 1));
    let page;
    try {
      page = await client.send(new ListObjectsV2Command({
        Bucket: coordinates.bucket,
        ...(coordinates.basePrefix ? { Prefix: `${coordinates.basePrefix}/` } : {}),
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
        MaxKeys: maxKeys,
      }));
    } catch (error) {
      throw providerError(error, "S3_INVENTORY_FAILED", "S3 inventory could not be read.");
    }
    if (!page || (page.Contents !== undefined && !Array.isArray(page.Contents))) {
      throw storeError("S3_INVENTORY_INVALID", "S3 inventory returned a malformed page.");
    }
    if (typeof page.IsTruncated !== "boolean") {
      throw storeError("S3_PAGINATION_INVALID", "S3 inventory returned invalid pagination state.");
    }
    const contents = page.Contents ?? [];
    if (contents.length > maxKeys) {
      throw storeError("S3_INVENTORY_INVALID", "S3 inventory page exceeded the requested bound.");
    }
    if (
      page.KeyCount !== undefined
      && (!Number.isSafeInteger(page.KeyCount) || page.KeyCount !== contents.length)
    ) {
      throw storeError("S3_INVENTORY_INVALID", "S3 inventory returned an inconsistent key count.");
    }
    if (records.length + contents.length > itemLimit) {
      throw storeError("S3_INVENTORY_LIMIT", "S3 inventory exceeds the configured item limit.");
    }
    for (const item of contents) {
      if (!Number.isSafeInteger(item?.Size) || item.Size < 0) {
        throw storeError("S3_INVENTORY_INVALID", "S3 inventory contains an invalid object size.");
      }
      const key = logicalKey(coordinates.basePrefix, item?.Key);
      if (seenKeys.has(key)) {
        throw storeError("S3_INVENTORY_INVALID", "S3 inventory contains a duplicate object key.");
      }
      seenKeys.add(key);
      const details = await inventoryObjectDetails({ client, coordinates, item });
      records.push({
        key,
        sizeBytes: item.Size,
        identity: details.identity,
        readCondition: details.readCondition,
        providerMetadata: details.metadata,
      });
    }

    const truncated = page.IsTruncated === true;
    const next = page.NextContinuationToken;
    if (!truncated) {
      if (next !== undefined && next !== null && next !== "") {
        throw storeError("S3_PAGINATION_INVALID", "S3 inventory returned an unexpected continuation token.");
      }
      break;
    }
    if (typeof next !== "string" || !next || Buffer.byteLength(next, "utf8") > MAX_TOKEN_BYTES) {
      throw storeError("S3_PAGINATION_INVALID", "S3 inventory omitted a valid continuation token.");
    }
    if (next === continuationToken || seenTokens.has(next)) {
      throw storeError("S3_PAGINATION_INVALID", "S3 inventory pagination did not advance.");
    }
    seenTokens.add(next);
    continuationToken = next;
  }

  return records.sort((left, right) => ordinalCompare(left.key, right.key));
}

function validateBody(body) {
  if (!body || typeof body[Symbol.asyncIterator] !== "function") {
    throw storeError("S3_READ_INVALID", "S3 returned no readable object body.");
  }
  return body;
}

async function getObject({ client, coordinates, key, versionId, exactVersion, expectedIdentity }) {
  const objectKey = physicalKey(coordinates.basePrefix, key);
  const requestedVersion = versionId === undefined
    ? undefined
    : normalizedVersionId(versionId);
  if (exactVersion && !requestedVersion) {
    throw storeError("S3_VERSION_INVALID", "Backup reads require an exact S3 version ID.");
  }
  let response;
  try {
    response = await client.send(new GetObjectCommand({
      Bucket: coordinates.bucket,
      Key: objectKey,
      ...(requestedVersion ? { VersionId: requestedVersion } : {}),
      ...(expectedIdentity ? { IfMatch: exactText(expectedIdentity, "S3 inventory identity", 512) } : {}),
      ChecksumMode: "ENABLED",
    }));
  } catch (error) {
    throw providerError(error, "S3_READ_FAILED", "S3 object could not be read.");
  }
  if (requestedVersion) {
    let returnedVersion;
    try {
      returnedVersion = normalizedVersionId(response?.VersionId);
    } catch {
      throw storeError("S3_VERSION_MISMATCH", "S3 did not return the requested exact object version.");
    }
    if (returnedVersion !== requestedVersion) {
      throw storeError("S3_VERSION_MISMATCH", "S3 did not return the requested exact object version.");
    }
  }
  return validateBody(response?.Body);
}

export class S3SourceObjectStore {
  constructor({
    client,
    endpoint,
    region,
    bucket,
    basePrefix = "",
    forcePathStyle = false,
    maximumInventoryItems = MAX_INVENTORY_ITEMS,
    maximumPages = MAX_INVENTORY_PAGES,
    bindingIdentitySha256,
  }) {
    this.client = ensureClient(client);
    assignStoreIdentity(this, normalizeCoordinates(
      { endpoint, region, bucket, basePrefix, forcePathStyle },
      { allowEmptyPrefix: true },
    ));
    this.maximumInventoryItems = boundedInteger(
      maximumInventoryItems,
      "Configured inventory item limit",
      MAX_INVENTORY_ITEMS,
    );
    this.maximumPages = boundedInteger(maximumPages, "Inventory page limit", MAX_INVENTORY_PAGES);
    if (!validIdentity(bindingIdentitySha256)) {
      throw storeError("S3_STORE_IDENTITY_INVALID", "Source binding identity must be a SHA-256 value.");
    }
    this.bindingIdentitySha256 = bindingIdentitySha256;
  }

  async listInventory({ maximumItems } = {}) {
    return listInventory({
      client: this.client,
      coordinates: this.coordinates,
      maximumItems,
      configuredMaximumItems: this.maximumInventoryItems,
      maximumPages: this.maximumPages,
    });
  }

  async openRead(key, { expectedIdentity } = {}) {
    return getObject({
      client: this.client,
      coordinates: this.coordinates,
      key,
      expectedIdentity,
      exactVersion: false,
    });
  }
}

function validatePutRequest({ ifNoneMatch, contentLength, checksumSha256, providerMetadata }) {
  if (ifNoneMatch !== true) {
    throw storeError("S3_ATOMIC_WRITE_REQUIRED", "S3 recovery writes must be create-only.");
  }
  const length = boundedNonnegativeInteger(
    contentLength,
    "S3 content length",
    Number.MAX_SAFE_INTEGER,
  );
  const metadata = providerObjectMetadata(providerMetadata);
  return {
    contentLength: length,
    checksumSha256: normalizedChecksum(checksumSha256),
    providerMetadata: metadata,
  };
}

async function directConditionalPut({
  client,
  coordinates,
  key,
  body,
  options,
  requireVersion,
}) {
  const { contentLength, checksumSha256, providerMetadata: metadata } = validatePutRequest(options);
  const objectKey = physicalKey(coordinates.basePrefix, key);
  let response;
  try {
    response = await client.send(new PutObjectCommand({
      Bucket: coordinates.bucket,
      Key: objectKey,
      Body: body,
      ContentLength: contentLength,
      ChecksumAlgorithm: "SHA256",
      ChecksumSHA256: checksumSha256,
      IfNoneMatch: "*",
      ...(metadata.contentType ? { ContentType: metadata.contentType } : {}),
      ...(Object.keys(metadata.customMetadata).length
        ? { Metadata: metadata.customMetadata }
        : {}),
    }));
  } catch (error) {
    const status = Number(error?.$metadata?.httpStatusCode ?? error?.statusCode ?? 0);
    if (status === 409 || status === 412) {
      throw providerError(error, "DESTINATION_COLLISION", "S3 create-only write collided with an existing object.");
    }
    throw providerError(error, "S3_WRITE_FAILED", "S3 create-only write failed.");
  }
  try {
    const returnedVersion = returnedVersionId(response?.VersionId);
    if (response?.ChecksumSHA256 !== checksumSha256) {
      throw storeError("S3_CHECKSUM_MISMATCH", "S3 write checksum receipt is missing or differs.");
    }
    const versionId = returnedVersion?.toLowerCase() === "null" ? undefined : returnedVersion;
    if (requireVersion && !versionId) {
      throw storeError("S3_VERSION_MISSING", "Protected S3 write returned no non-null version ID.");
    }
    return { objectKey, checksumSha256, versionId, returnedVersionId: returnedVersion };
  } catch (error) {
    error[ACCEPTED_OBJECT_KEY] = objectKey;
    if (
      typeof response?.VersionId === "string"
      && response.VersionId
      && Buffer.byteLength(response.VersionId, "utf8") <= 1024
    ) {
      error[ACCEPTED_VERSION_ID] = response.VersionId;
    }
    throw error;
  }
}

export class S3ProtectedDestinationWriter {
  constructor({
    client,
    endpoint,
    region,
    bucket,
    basePrefix,
    forcePathStyle = false,
    minimumRetentionUntil,
  }) {
    this.client = ensureClient(client);
    assignStoreIdentity(this, normalizeCoordinates(
      { endpoint, region, bucket, basePrefix, forcePathStyle },
      { allowEmptyPrefix: false },
    ));
    this.minimumRetentionUntil = isoDateTime(
      minimumRetentionUntil,
      "Minimum protected retention",
    );
    this.atomicPut = true;
  }

  assertWritableKeys(keys) {
    if (!Array.isArray(keys) || !keys.length) {
      throw storeError("S3_KEY_INVALID", "Protected destination keys are required.");
    }
    for (const key of keys) physicalKey(this.coordinates.basePrefix, key);
    return true;
  }

  async put(key, body, options = {}) {
    const callerFloor = options.minimumRetentionUntil === undefined
      ? this.minimumRetentionUntil
      : isoDateTime(options.minimumRetentionUntil, "Caller retention floor");
    const retentionFloor = new Date(callerFloor) > new Date(this.minimumRetentionUntil)
      ? callerFloor
      : this.minimumRetentionUntil;
    const written = await directConditionalPut({
      client: this.client,
      coordinates: this.coordinates,
      key,
      body,
      options,
      requireVersion: true,
    });
    let retention;
    try {
      retention = await this.client.send(new GetObjectRetentionCommand({
        Bucket: this.coordinates.bucket,
        Key: written.objectKey,
        VersionId: written.versionId,
      }));
    } catch (error) {
      throw providerError(error, "S3_RETENTION_CHECK_FAILED", "Protected S3 retention could not be verified.");
    }
    if (retention?.Retention?.Mode !== "COMPLIANCE") {
      throw storeError("S3_RETENTION_INVALID", "Protected S3 version is not in COMPLIANCE mode.");
    }
    const retentionUntil = isoDateTime(
      retention?.Retention?.RetainUntilDate,
      "Protected retention end",
    );
    if (new Date(retentionUntil) < new Date(retentionFloor)) {
      throw storeError("S3_RETENTION_INVALID", "Protected S3 retention ends before the required floor.");
    }
    return {
      versionId: written.versionId,
      checksumSha256: written.checksumSha256,
      retentionMode: "COMPLIANCE",
      retentionUntil,
    };
  }
}

export class S3ExactVersionBackupReader {
  constructor({ client, endpoint, region, bucket, basePrefix, forcePathStyle = false }) {
    this.client = ensureClient(client);
    assignStoreIdentity(this, normalizeCoordinates(
      { endpoint, region, bucket, basePrefix, forcePathStyle },
      { allowEmptyPrefix: false },
    ));
    this.versionedReads = true;
  }

  async openRead(key, { versionId } = {}) {
    return getObject({
      client: this.client,
      coordinates: this.coordinates,
      key,
      versionId,
      exactVersion: true,
    });
  }

  async inspect(key, { versionId } = {}) {
    const requestedVersion = normalizedVersionId(versionId);
    const objectKey = physicalKey(this.coordinates.basePrefix, key);
    let head;
    try {
      head = await this.client.send(new HeadObjectCommand({
        Bucket: this.coordinates.bucket,
        Key: objectKey,
        VersionId: requestedVersion,
        ChecksumMode: "ENABLED",
      }));
    } catch (error) {
      throw providerError(error, "S3_READ_FAILED", "Exact S3 object metadata could not be read.");
    }
    if (normalizedVersionId(head?.VersionId) !== requestedVersion) {
      throw storeError("S3_VERSION_MISMATCH", "S3 metadata did not return the requested version.");
    }
    const checksumSha256 = normalizedChecksum(head?.ChecksumSHA256);
    let retention;
    try {
      retention = await this.client.send(new GetObjectRetentionCommand({
        Bucket: this.coordinates.bucket,
        Key: objectKey,
        VersionId: requestedVersion,
      }));
    } catch (error) {
      throw providerError(error, "S3_RETENTION_CHECK_FAILED", "Exact S3 retention could not be read.");
    }
    if (retention?.Retention?.Mode !== "COMPLIANCE") {
      throw storeError("S3_RETENTION_INVALID", "Exact S3 version is not in COMPLIANCE mode.");
    }
    return {
      versionId: requestedVersion,
      checksumSha256,
      retentionMode: "COMPLIANCE",
      retentionUntil: isoDateTime(retention.Retention.RetainUntilDate, "Protected retention end"),
    };
  }
}

export class S3IsolatedRestoreTarget {
  constructor({
    client,
    endpoint,
    region,
    bucket,
    basePrefix,
    forcePathStyle = false,
    maximumInventoryItems = MAX_INVENTORY_ITEMS,
    maximumPages = MAX_INVENTORY_PAGES,
  }) {
    this.client = ensureClient(client);
    assignStoreIdentity(this, normalizeCoordinates(
      { endpoint, region, bucket, basePrefix, forcePathStyle },
      { allowEmptyPrefix: false },
    ));
    this.maximumInventoryItems = boundedInteger(
      maximumInventoryItems,
      "Configured inventory item limit",
      MAX_INVENTORY_ITEMS,
    );
    this.maximumPages = boundedInteger(maximumPages, "Inventory page limit", MAX_INVENTORY_PAGES);
    this.atomicPut = true;
    this.cleanupSafetyVerified = false;
  }

  assertWritableKeys(keys) {
    if (!Array.isArray(keys) || !keys.length) {
      throw storeError("S3_KEY_INVALID", "Isolated restore keys are required.");
    }
    for (const key of keys) physicalKey(this.coordinates.basePrefix, key);
    return true;
  }

  async assertCleanupSafe() {
    let versioning;
    try {
      versioning = await this.client.send(new GetBucketVersioningCommand({
        Bucket: this.coordinates.bucket,
      }));
    } catch (error) {
      throw providerError(
        error,
        "S3_VERSIONING_CHECK_FAILED",
        "Isolated restore bucket versioning state could not be verified.",
      );
    }
    if (versioning?.Status !== undefined && versioning.Status !== null && versioning.Status !== "") {
      throw storeError(
        "RESTORE_TARGET_VERSIONED",
        "Isolated restore requires a never-versioned disposable bucket.",
      );
    }
    this.cleanupSafetyVerified = true;
  }

  async assertEmpty() {
    await this.assertCleanupSafe();
    let inventory;
    try {
      inventory = await this.listInventory({ maximumItems: 1 });
    } catch (error) {
      if (error?.code === "S3_INVENTORY_LIMIT") {
        throw storeError("RESTORE_TARGET_NOT_EMPTY", "Isolated S3 restore namespace is not empty.");
      }
      throw error;
    }
    if (inventory.length) {
      throw storeError("RESTORE_TARGET_NOT_EMPTY", "Isolated S3 restore namespace is not empty.");
    }
  }

  async listInventory({ maximumItems } = {}) {
    return listInventory({
      client: this.client,
      coordinates: this.coordinates,
      maximumItems,
      configuredMaximumItems: this.maximumInventoryItems,
      maximumPages: this.maximumPages,
    });
  }

  async put(key, body, options = {}) {
    if (this.cleanupSafetyVerified !== true) {
      throw storeError(
        "RESTORE_TARGET_UNVERIFIED",
        "Isolated restore cleanup safety must be verified before writing.",
      );
    }
    await this.assertCleanupSafe();
    const objectKey = physicalKey(this.coordinates.basePrefix, key);
    let written;
    try {
      written = await directConditionalPut({
        client: this.client,
        coordinates: this.coordinates,
        key,
        body,
        options,
        requireVersion: false,
      });
    } catch (error) {
      if (error?.code === "S3_WRITE_FAILED" || error?.[ACCEPTED_OBJECT_KEY]) {
        try {
          await this.client.send(new DeleteObjectCommand({
            Bucket: this.coordinates.bucket,
            Key: objectKey,
            ...(error[ACCEPTED_VERSION_ID]
              ? { VersionId: error[ACCEPTED_VERSION_ID] }
              : {}),
          }));
          await this.assertEmpty();
        } catch {
          throw storeError(
            "RESTORE_CLEANUP_FAILED",
            "An ambiguous isolated restore write could not be cleaned safely.",
          );
        }
      }
      throw error;
    }
    if (written.returnedVersionId) {
      try {
        await this.client.send(new DeleteObjectCommand({
          Bucket: this.coordinates.bucket,
          Key: objectKey,
          VersionId: written.returnedVersionId,
        }));
      } catch {
        throw storeError(
          "RESTORE_CLEANUP_FAILED",
          "An unexpected versioned restore object could not be removed.",
        );
      }
      throw storeError(
        "RESTORE_TARGET_VERSIONED",
        "Isolated restore target became versioned before the write completed.",
      );
    }
    return {
      checksumSha256: written.checksumSha256,
    };
  }

  async openRead(key, { versionId, expectedIdentity } = {}) {
    return getObject({
      client: this.client,
      coordinates: this.coordinates,
      key,
      versionId,
      expectedIdentity,
      exactVersion: false,
    });
  }

  async delete(key, { versionId } = {}) {
    const objectKey = physicalKey(this.coordinates.basePrefix, key);
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.coordinates.bucket,
        Key: objectKey,
        ...(versionId ? { VersionId: normalizedVersionId(versionId) } : {}),
      }));
    } catch (error) {
      throw providerError(error, "S3_DELETE_FAILED", "Isolated S3 restore object could not be removed.");
    }
  }
}
