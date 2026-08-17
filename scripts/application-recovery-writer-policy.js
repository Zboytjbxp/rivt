import crypto from "node:crypto";

const POLICY_VERSION = "2012-10-17";
const SNAPSHOT_ID_PATTERN = /^set-[a-f0-9]{48}$/u;
const MAXIMUM_WRITE_WINDOW_MS = 60 * 60 * 1000;
const MAXIMUM_BASE_PREFIX_BYTES = 512;
const MAXIMUM_OBJECT_KEY_BYTES = 1024;

export const MAX_EXACT_RECOVERY_WRITER_OBJECTS = 3;
export const MAX_EXACT_RECOVERY_WRITER_POLICY_BYTES = 6 * 1024;

export class RecoveryWriterPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RecoveryWriterPolicyError";
    this.code = code;
  }
}

function policyError(code, message) {
  return new RecoveryWriterPolicyError(code, message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function exactText(value, label, maximumBytes) {
  if (
    typeof value !== "string"
    || !value
    || value !== value.trim()
    || value !== value.normalize("NFC")
    || value.includes("\0")
    || /[\u0000-\u001f\u007f]/u.test(value)
    || Buffer.byteLength(value, "utf8") > maximumBytes
  ) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      `${label} must be an exact canonical value within the local safety limit.`,
    );
  }
  return value;
}

function assertNoIamExpansion(value, label) {
  if (/[*?]/u.test(value) || value.includes("${")) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      `${label} cannot contain IAM wildcard or policy-variable syntax.`,
    );
  }
}

function exactAwsBucket(value) {
  const bucket = exactText(value, "Recovery destination bucket", 63);
  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket)
    || bucket.includes("..")
    || /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(bucket)
  ) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      "Recovery destination bucket must be one exact AWS S3 bucket name.",
    );
  }
  assertNoIamExpansion(bucket, "Recovery destination bucket");
  return bucket;
}

function exactPath(value, label, maximumBytes) {
  const path = exactText(value, label, maximumBytes);
  if (
    path.startsWith("/")
    || path.endsWith("/")
    || path.includes("//")
    || path.includes("\\")
    || path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      `${label} must be one safe exact S3 path.`,
    );
  }
  assertNoIamExpansion(path, label);
  return path;
}

function canonicalTime(value, label) {
  const timestamp = exactText(value, label, 64);
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== timestamp) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      `${label} must be a canonical UTC timestamp.`,
    );
  }
  return date;
}

function boundedLimit(value, fallback, maximum, label) {
  const limit = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_LIMIT_INVALID",
      `${label} must be a fixed integer no greater than the reviewed source limit.`,
    );
  }
  return limit;
}

function exactSnapshotKeys(snapshotId, objectKeys, objectCountLimit) {
  if (typeof snapshotId !== "string" || !SNAPSHOT_ID_PATTERN.test(snapshotId)) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      "Recovery snapshot ID must use the exact set- plus 48 lowercase hex layout.",
    );
  }
  if (!Array.isArray(objectKeys)) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      "Recovery protected object keys must be an explicit array.",
    );
  }
  if (objectKeys.length > objectCountLimit) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_OBJECT_LIMIT",
      "Recovery protected object count exceeds the exact-key IAM policy limit.",
    );
  }

  const root = `snapshots/${snapshotId}`;
  const databaseKey = `${root}/database.json.gz.aes256gcm`;
  const archiveKey = `${root}/application-objects.bin.aes256gcm`;
  const completionKey = `${root}/complete.json`;
  const normalized = objectKeys.map((value) => exactPath(
    value,
    "Recovery protected object key",
    MAXIMUM_OBJECT_KEY_BYTES,
  ));
  if (new Set(normalized).size !== normalized.length) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      "Recovery protected object keys must be unique.",
    );
  }
  const requiredKeys = new Set([databaseKey, archiveKey, completionKey]);
  if (
    normalized.length !== requiredKeys.size
    || normalized.some((key) => !requiredKeys.has(key))
  ) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      "Recovery writer authority must contain exactly the database, archive, and completion keys.",
    );
  }
  return normalized.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export function renderExactRecoveryWriterPolicy({
  bucket,
  basePrefix,
  snapshotId,
  objectKeys,
  writeWindow,
  objectCountLimit,
  policyByteLimit,
}) {
  const protectedObjectLimit = boundedLimit(
    objectCountLimit,
    MAX_EXACT_RECOVERY_WRITER_OBJECTS,
    MAX_EXACT_RECOVERY_WRITER_OBJECTS,
    "Recovery writer object-count limit",
  );
  const protectedPolicyByteLimit = boundedLimit(
    policyByteLimit,
    MAX_EXACT_RECOVERY_WRITER_POLICY_BYTES,
    MAX_EXACT_RECOVERY_WRITER_POLICY_BYTES,
    "Recovery writer policy-byte limit",
  );
  const exactBucket = exactAwsBucket(bucket);
  const exactBasePrefix = exactPath(
    basePrefix,
    "Recovery destination base prefix",
    MAXIMUM_BASE_PREFIX_BYTES,
  );
  const keys = exactSnapshotKeys(snapshotId, objectKeys, protectedObjectLimit);
  const windowStart = canonicalTime(writeWindow?.startAt, "Recovery write-window start");
  const windowEnd = canonicalTime(writeWindow?.endAt, "Recovery write-window end");
  if (
    windowEnd <= windowStart
    || windowEnd.getTime() - windowStart.getTime() > MAXIMUM_WRITE_WINDOW_MS
  ) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_INVALID",
      "Recovery write window must be a positive half-open interval of at most one hour.",
    );
  }

  const physicalKeys = keys.map((key) => {
    const physicalKey = `${exactBasePrefix}/${key}`;
    if (Buffer.byteLength(physicalKey, "utf8") > MAXIMUM_OBJECT_KEY_BYTES) {
      throw policyError(
        "RECOVERY_WRITER_POLICY_INVALID",
        "Recovery protected physical object key exceeds the local safety limit.",
      );
    }
    return physicalKey;
  });
  const resources = physicalKeys.map((key) => `arn:aws:s3:::${exactBucket}/${key}`);
  const resourceCopies = () => [...resources];
  const policy = {
    Version: POLICY_VERSION,
    Statement: [
      {
        Sid: "AllowExactConditionalRecoverySetCreates",
        Effect: "Allow",
        Action: "s3:PutObject",
        Resource: resourceCopies(),
        Condition: {
          DateGreaterThanEquals: { "aws:CurrentTime": windowStart.toISOString() },
          DateLessThan: { "aws:CurrentTime": windowEnd.toISOString() },
          StringEquals: { "s3:if-none-match": "*" },
        },
      },
      {
        Sid: "DenyMultipartRecoverySetWrites",
        Effect: "Deny",
        Action: "s3:PutObject",
        Resource: resourceCopies(),
        Condition: {
          Bool: { "s3:ObjectCreationOperation": "false" },
        },
      },
      {
        Sid: "ReadExactRecoverySetRetentionMetadata",
        Effect: "Allow",
        Action: "s3:GetObjectRetention",
        Resource: resourceCopies(),
      },
    ],
  };
  const policyJson = JSON.stringify(policy);
  const policyBytes = Buffer.byteLength(policyJson, "utf8");
  if (policyBytes > protectedPolicyByteLimit) {
    throw policyError(
      "RECOVERY_WRITER_POLICY_SIZE_LIMIT",
      "Recovery exact-key IAM policy exceeds the fixed source byte limit.",
    );
  }

  return deepFreeze({
    format: "rivt-application-recovery-writer-policy-v1",
    snapshotId,
    bucket: exactBucket,
    basePrefix: exactBasePrefix,
    objectKeys: keys,
    physicalKeys,
    resourceArns: resources,
    protectedObjectCount: keys.length,
    policy,
    policyJson,
    policyBytes,
    policySha256: sha256(policyJson),
    exactKeySetSha256: sha256(JSON.stringify({
      bucket: exactBucket,
      basePrefix: exactBasePrefix,
      snapshotId,
      objectKeys: keys,
    })),
    writeWindow: {
      startAt: windowStart.toISOString(),
      endAt: windowEnd.toISOString(),
    },
  });
}
