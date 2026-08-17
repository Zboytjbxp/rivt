import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetObjectRetentionCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  S3ExactVersionBackupReader,
  S3IsolatedRestoreTarget,
  S3ProtectedDestinationWriter,
  S3SourceObjectStore,
  assertRecoveryS3LogicalKeysAddressable,
  assertRecoveryS3StoreSeparation,
  normalizeRecoveryS3Key,
  normalizeRecoveryS3Prefix,
  recoveryS3CoordinateIdentitySha256,
} from "../scripts/recovery-s3-store.js";

const ENDPOINT = "https://s3.example.test";
const REGION = "us-east-1";
const RETENTION_FLOOR = "2030-01-01T00:00:00.000Z";

test("restore key addressability includes the exact nonproduction prefix", () => {
  const coordinates = {
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "isolated-restore",
    basePrefix: "r",
    forcePathStyle: false,
  };
  assert.equal(
    assertRecoveryS3LogicalKeysAddressable(coordinates, ["a".repeat(1022)]),
    true,
  );
  assert.throws(
    () => assertRecoveryS3LogicalKeysAddressable(coordinates, ["a".repeat(1023)]),
    (error) => error.code === "S3_KEY_INVALID",
  );
});

class FakeS3Client {
  constructor(handler, extras = {}) {
    this.handler = handler;
    this.commands = [];
    Object.assign(this, extras);
  }

  async send(command) {
    this.commands.push(command);
    return this.handler(command, this.commands.length);
  }
}

function checksum(value) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

async function readAll(body) {
  const chunks = [];
  for await (const value of body) chunks.push(Buffer.from(value));
  return Buffer.concat(chunks);
}

function inventoryObject(key, value, lastModified = "2029-01-01T00:00:00.000Z") {
  return {
    Key: key,
    Size: Buffer.byteLength(value),
    ETag: `\"${crypto.createHash("md5").update(value).digest("hex")}\"`,
    LastModified: new Date(lastModified),
    ChecksumAlgorithm: ["SHA256"],
  };
}

function sourceStore(client, overrides = {}) {
  return new S3SourceObjectStore({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-source",
    basePrefix: "application",
    bindingIdentitySha256: "b".repeat(64),
    ...overrides,
  });
}

function destinationWriter(client, overrides = {}) {
  return new S3ProtectedDestinationWriter({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-protected",
    basePrefix: "recovery/sets",
    minimumRetentionUntil: RETENTION_FLOOR,
    ...overrides,
  });
}

test("S3 key and prefix validation is exact and rejects ambiguous paths", () => {
  assert.equal(normalizeRecoveryS3Prefix("recovery/sets"), "recovery/sets");
  assert.equal(normalizeRecoveryS3Prefix("", { allowEmpty: true }), "");
  assert.equal(normalizeRecoveryS3Key("uploads/a b/évidence.jpg"), "uploads/a b/évidence.jpg");

  for (const value of [" /outer-space", "/absolute", "windows\\path", "uploads/e\u0301.bin"]) {
    assert.equal(normalizeRecoveryS3Key(value), value);
  }
  for (const value of ["", "nul\0key", "control\nkey", "x".repeat(1025)]) {
    assert.throws(() => normalizeRecoveryS3Key(value), { code: "S3_KEY_INVALID" });
  }
  for (const value of [" /outer-space", "/absolute", "trailing/", "dot/../escape"]) {
    assert.throws(() => normalizeRecoveryS3Prefix(value), { code: "S3_KEY_INVALID" });
  }
  assert.throws(() => normalizeRecoveryS3Prefix(""), { code: "S3_KEY_INVALID" });
});

test("coordinate identity excludes clients and credentials and detects namespace collisions", () => {
  const coordinates = {
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-source",
    basePrefix: "application",
  };
  const first = sourceStore(new FakeS3Client(async () => ({}), {
    credentials: { accessKeyId: "AKIA-FIRST", secretAccessKey: "secret-one" },
  }));
  const second = sourceStore(new FakeS3Client(async () => ({}), {
    credentials: { accessKeyId: "AKIA-SECOND", secretAccessKey: "secret-two" },
  }));
  assert.equal(first.identitySha256, second.identitySha256);
  assert.equal(
    first.identitySha256,
    recoveryS3CoordinateIdentitySha256(coordinates, { allowEmptyPrefix: true }),
  );
  assert.notEqual(
    first.identitySha256,
    recoveryS3CoordinateIdentitySha256(
      { ...coordinates, forcePathStyle: true },
      { allowEmptyPrefix: true },
    ),
  );

  const destination = destinationWriter(new FakeS3Client(async () => ({})));
  const restore = new S3IsolatedRestoreTarget({
    client: new FakeS3Client(async () => ({})),
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-restore",
    basePrefix: "isolated/run-1",
  });
  assert.equal(assertRecoveryS3StoreSeparation({
    sourceStore: first,
    destinationStore: destination,
    restoreStore: restore,
  }), true);
  assert.throws(() => assertRecoveryS3StoreSeparation({
    sourceStore: first,
    destinationStore: second,
    restoreStore: restore,
  }), { code: "S3_STORE_COLLISION" });

  const overlapping = new S3ProtectedDestinationWriter({
    client: new FakeS3Client(async () => ({})),
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-source",
    basePrefix: "application/recovery",
    forcePathStyle: true,
    minimumRetentionUntil: RETENTION_FLOOR,
  });
  assert.throws(() => assertRecoveryS3StoreSeparation({
    sourceStore: first,
    destinationStore: overlapping,
    restoreStore: restore,
  }), { code: "S3_STORE_COLLISION" });

  const endpointAlias = new S3ProtectedDestinationWriter({
    client: new FakeS3Client(async () => ({})),
    endpoint: "https://s3.us-east-1.amazonaws.com",
    region: REGION,
    bucket: "rivt-source",
    basePrefix: "separate-looking-prefix",
    minimumRetentionUntil: RETENTION_FLOOR,
  });
  assert.throws(() => assertRecoveryS3StoreSeparation({
    sourceStore: first,
    destinationStore: endpointAlias,
    restoreStore: restore,
  }), { code: "S3_STORE_COLLISION" });
});

test("deterministic protected and restore keys are addressable before any write", () => {
  const client = new FakeS3Client(async () => {
    throw new Error("provider must not be called");
  });
  const writer = new S3ProtectedDestinationWriter({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-protected",
    basePrefix: "x".repeat(900),
    minimumRetentionUntil: RETENTION_FLOOR,
  });
  assert.throws(
    () => writer.assertWritableKeys([
      `snapshots/set-${"a".repeat(48)}/objects/${"b".repeat(64)}.bin`,
    ]),
    { code: "S3_KEY_INVALID" },
  );

  const restore = new S3IsolatedRestoreTarget({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-restore",
    basePrefix: "y".repeat(900),
  });
  assert.throws(
    () => restore.assertWritableKeys(["application/" + "z".repeat(200)]),
    { code: "S3_KEY_INVALID" },
  );
  assert.equal(client.commands.length, 0);
});

test("source store performs a bounded full inventory and exact read without write methods", async () => {
  const client = new FakeS3Client(async (command) => {
    if (command instanceof ListObjectsV2Command) {
      if (!command.input.ContinuationToken) {
        return {
          IsTruncated: true,
          NextContinuationToken: "page-2",
          KeyCount: 1,
          Contents: [inventoryObject("application/z-last.bin", "last")],
        };
      }
      assert.equal(command.input.ContinuationToken, "page-2");
      return {
        IsTruncated: false,
        KeyCount: 1,
        Contents: [inventoryObject("application/a-first.bin", "first")],
      };
    }
    if (command instanceof HeadObjectCommand) {
      const value = command.input.Key.endsWith("z-last.bin") ? "last" : "first";
      const listed = inventoryObject(command.input.Key, value);
      return {
        ContentLength: listed.Size,
        ETag: listed.ETag,
        ContentType: " application/octet-stream ",
        Metadata: {
          contentsha256: crypto.createHash("sha256").update(value).digest("hex"),
          filename: "e\u0301 file ",
          empty: "",
        },
        MissingMeta: 0,
        ChecksumSHA256: checksum(value),
      };
    }
    if (command instanceof GetObjectCommand) {
      return { Body: Readable.from([Buffer.from("first")]) };
    }
    throw new Error("unexpected command");
  });
  const store = sourceStore(client);
  const inventory = await store.listInventory({ maximumItems: 10 });
  assert.deepEqual(inventory.map(({ key, sizeBytes }) => ({ key, sizeBytes })), [
    { key: "a-first.bin", sizeBytes: 5 },
    { key: "z-last.bin", sizeBytes: 4 },
  ]);
  assert.match(inventory[0].identity, /^[a-f0-9]{64}$/u);
  assert.deepEqual(inventory[0].providerMetadata, {
    contentType: " application/octet-stream ",
    customMetadata: {
      contentsha256: crypto.createHash("sha256").update("first").digest("hex"),
      empty: "",
      filename: "e\u0301 file ",
    },
  });

  const body = await store.openRead("a-first.bin", {
    expectedIdentity: inventory[0].readCondition,
  });
  assert.equal((await readAll(body)).toString(), "first");
  assert.equal(store.put, undefined);
  assert.equal(store.delete, undefined);
  assert.deepEqual(client.commands.map((command) => command.constructor.name), [
    "ListObjectsV2Command",
    "HeadObjectCommand",
    "ListObjectsV2Command",
    "HeadObjectCommand",
    "GetObjectCommand",
  ]);
  assert.deepEqual(client.commands[0].input, {
    Bucket: "rivt-source",
    Prefix: "application/",
    MaxKeys: 11,
  });
  assert.deepEqual(client.commands[4].input, {
    Bucket: "rivt-source",
    Key: "application/a-first.bin",
    IfMatch: inventory[0].readCondition,
    ChecksumMode: "ENABLED",
  });
  assert.deepEqual(client.commands[1].input, {
    Bucket: "rivt-source",
    Key: "application/z-last.bin",
    IfMatch: inventory[1].readCondition,
    ChecksumMode: "ENABLED",
  });
});

test("source inventory rejects malformed and nonadvancing pagination", async (t) => {
  await t.test("final page without an explicit truncation state", async () => {
    const client = new FakeS3Client(async () => ({ Contents: [] }));
    await assert.rejects(sourceStore(client).listInventory({ maximumItems: 2 }), {
      code: "S3_PAGINATION_INVALID",
    });
  });
  await t.test("truncated page without a token", async () => {
    const client = new FakeS3Client(async () => ({ IsTruncated: true, Contents: [] }));
    await assert.rejects(sourceStore(client).listInventory({ maximumItems: 2 }), {
      code: "S3_PAGINATION_INVALID",
    });
  });

  await t.test("same token twice", async () => {
    const client = new FakeS3Client(async (_command, count) => ({
      IsTruncated: true,
      NextContinuationToken: count === 1 ? "token-1" : "token-1",
      Contents: [],
    }));
    await assert.rejects(sourceStore(client).listInventory({ maximumItems: 2 }), {
      code: "S3_PAGINATION_INVALID",
    });
    assert.equal(client.commands.length, 2);
  });

  await t.test("repeated token cycle", async () => {
    const tokens = ["token-1", "token-2", "token-1"];
    const client = new FakeS3Client(async (_command, count) => ({
      IsTruncated: true,
      NextContinuationToken: tokens[count - 1],
      Contents: [],
    }));
    await assert.rejects(sourceStore(client).listInventory({ maximumItems: 2 }), {
      code: "S3_PAGINATION_INVALID",
    });
    assert.equal(client.commands.length, 3);
  });

  await t.test("bounded advancing empty pages", async () => {
    const client = new FakeS3Client(async (_command, count) => ({
      IsTruncated: true,
      NextContinuationToken: `token-${count}`,
      Contents: [],
    }));
    await assert.rejects(sourceStore(client, { maximumPages: 2 }).listInventory({
      maximumItems: 2,
    }), { code: "S3_PAGINATION_INVALID" });
    assert.equal(client.commands.length, 2);
  });

  await t.test("token on a final page", async () => {
    const client = new FakeS3Client(async () => ({
      IsTruncated: false,
      NextContinuationToken: "unexpected",
      Contents: [],
    }));
    await assert.rejects(sourceStore(client).listInventory({ maximumItems: 2 }), {
      code: "S3_PAGINATION_INVALID",
    });
  });

  await t.test("HeadObject reports omitted custom metadata", async () => {
    const client = new FakeS3Client(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        return {
          IsTruncated: false,
          Contents: [inventoryObject("application/a", "a")],
        };
      }
      const listed = inventoryObject("application/a", "a");
      return {
        ContentLength: listed.Size,
        ETag: listed.ETag,
        MissingMeta: 1,
      };
    });
    await assert.rejects(sourceStore(client).listInventory({ maximumItems: 2 }), {
      code: "S3_INVENTORY_INVALID",
    });
  });
});

test("source inventory enforces its item limit before accepting a partial inventory", async () => {
  const client = new FakeS3Client(async () => ({
    IsTruncated: false,
    KeyCount: 2,
    Contents: [
      inventoryObject("application/a", "a"),
      inventoryObject("application/b", "b"),
    ],
  }));
  await assert.rejects(sourceStore(client).listInventory({ maximumItems: 1 }), {
    code: "S3_INVENTORY_LIMIT",
  });
  assert.equal(client.commands[0].input.MaxKeys, 2);
});

test("protected writer uses only direct create and exact-version COMPLIANCE retention commands", async () => {
  const value = Buffer.from("protected recovery component");
  const expectedChecksum = checksum(value);
  const client = new FakeS3Client(async (command) => {
    if (command instanceof PutObjectCommand) {
      return { ChecksumSHA256: expectedChecksum, VersionId: "protected-version-1" };
    }
    if (command instanceof GetObjectRetentionCommand) {
      return {
        Retention: {
          Mode: "COMPLIANCE",
          RetainUntilDate: new Date("2031-01-01T00:00:00.000Z"),
        },
      };
    }
    throw new Error("unexpected command");
  });
  const store = destinationWriter(client);
  const receipt = await store.put("snapshots/set-1/object.bin", Readable.from([value]), {
    ifNoneMatch: true,
    contentLength: value.length,
    checksumSha256: expectedChecksum,
  });
  assert.deepEqual(receipt, {
    versionId: "protected-version-1",
    checksumSha256: expectedChecksum,
    retentionMode: "COMPLIANCE",
    retentionUntil: "2031-01-01T00:00:00.000Z",
  });
  assert.equal(store.atomicPut, true);
  assert.equal(store.openRead, undefined);
  assert.equal(store.listInventory, undefined);
  assert.equal(store.delete, undefined);
  assert.deepEqual(client.commands.map((command) => command.constructor.name), [
    "PutObjectCommand",
    "GetObjectRetentionCommand",
  ]);
  assert.deepEqual(client.commands[0].input, {
    Bucket: "rivt-protected",
    Key: "recovery/sets/snapshots/set-1/object.bin",
    Body: client.commands[0].input.Body,
    ContentLength: value.length,
    ChecksumAlgorithm: "SHA256",
    ChecksumSHA256: expectedChecksum,
    IfNoneMatch: "*",
  });
  assert.deepEqual(client.commands[1].input, {
    Bucket: "rivt-protected",
    Key: "recovery/sets/snapshots/set-1/object.bin",
    VersionId: "protected-version-1",
  });
});

test("protected writer fails closed on checksum, version, and retention defects", async (t) => {
  const value = Buffer.from("component");
  const expectedChecksum = checksum(value);
  const cases = [
    {
      name: "missing response checksum",
      put: { VersionId: "v1" },
      code: "S3_CHECKSUM_MISMATCH",
    },
    {
      name: "mismatched response checksum",
      put: { ChecksumSHA256: checksum("different"), VersionId: "v1" },
      code: "S3_CHECKSUM_MISMATCH",
    },
    {
      name: "missing version",
      put: { ChecksumSHA256: expectedChecksum },
      code: "S3_VERSION_MISSING",
    },
    {
      name: "null version",
      put: { ChecksumSHA256: expectedChecksum, VersionId: "null" },
      code: "S3_VERSION_MISSING",
    },
    {
      name: "wrong retention mode",
      put: { ChecksumSHA256: expectedChecksum, VersionId: "v1" },
      retention: { Retention: { Mode: "GOVERNANCE", RetainUntilDate: new Date("2031-01-01") } },
      code: "S3_RETENTION_INVALID",
    },
    {
      name: "missing retention evidence",
      put: { ChecksumSHA256: expectedChecksum, VersionId: "v1" },
      retention: {},
      code: "S3_RETENTION_INVALID",
    },
    {
      name: "retention below floor",
      put: { ChecksumSHA256: expectedChecksum, VersionId: "v1" },
      retention: { Retention: { Mode: "COMPLIANCE", RetainUntilDate: new Date("2029-12-31") } },
      code: "S3_RETENTION_INVALID",
    },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const client = new FakeS3Client(async (command) => {
        if (command instanceof PutObjectCommand) return scenario.put;
        if (command instanceof GetObjectRetentionCommand) return scenario.retention;
        throw new Error("unexpected command");
      });
      await assert.rejects(destinationWriter(client).put(
        "snapshots/set-1/component",
        Readable.from([value]),
        {
          ifNoneMatch: true,
          contentLength: value.length,
          checksumSha256: expectedChecksum,
        },
      ), { code: scenario.code });
    });
  }
});

test("protected writer refuses nonconditional or malformed writes before provider IO", async () => {
  const client = new FakeS3Client(async () => {
    throw new Error("provider must not be called");
  });
  const store = destinationWriter(client);
  await assert.rejects(store.put("snapshots/set-1/component", Readable.from(["x"]), {
    ifNoneMatch: false,
    contentLength: 1,
    checksumSha256: checksum("x"),
  }), { code: "S3_ATOMIC_WRITE_REQUIRED" });
  await assert.rejects(store.put("snapshots/set-1/component", Readable.from(["x"]), {
    ifNoneMatch: true,
    contentLength: 1,
    checksumSha256: "not-a-checksum",
  }));
  assert.equal(client.commands.length, 0);
});

test("backup reader requires and confirms the exact version on every GetObject", async () => {
  const client = new FakeS3Client(async (command) => {
    assert.ok(command instanceof GetObjectCommand);
    return {
      VersionId: "version-7",
      Body: Readable.from([Buffer.from("ciphertext")]),
    };
  });
  const reader = new S3ExactVersionBackupReader({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-protected",
    basePrefix: "recovery/sets",
  });
  assert.equal(reader.versionedReads, true);
  assert.equal((await readAll(await reader.openRead("snapshots/set-1/object", {
    versionId: "version-7",
  }))).toString(), "ciphertext");
  assert.deepEqual(client.commands[0].input, {
    Bucket: "rivt-protected",
    Key: "recovery/sets/snapshots/set-1/object",
    VersionId: "version-7",
    ChecksumMode: "ENABLED",
  });

  await assert.rejects(reader.openRead("snapshots/set-1/object"), {
    code: "S3_VERSION_INVALID",
  });
  assert.equal(client.commands.length, 1);
});

test("backup reader inspects checksum and COMPLIANCE retention for the exact version", async () => {
  const expectedChecksum = checksum("ciphertext");
  const client = new FakeS3Client(async (command) => {
    if (command instanceof HeadObjectCommand) {
      return { VersionId: "version-7", ChecksumSHA256: expectedChecksum };
    }
    if (command instanceof GetObjectRetentionCommand) {
      return {
        Retention: {
          Mode: "COMPLIANCE",
          RetainUntilDate: new Date("2031-01-01T00:00:00.000Z"),
        },
      };
    }
    throw new Error("unexpected command");
  });
  const reader = new S3ExactVersionBackupReader({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-protected",
    basePrefix: "recovery/sets",
  });
  assert.deepEqual(await reader.inspect("snapshots/set-1/object", {
    versionId: "version-7",
  }), {
    versionId: "version-7",
    checksumSha256: expectedChecksum,
    retentionMode: "COMPLIANCE",
    retentionUntil: "2031-01-01T00:00:00.000Z",
  });
  assert.deepEqual(client.commands.map((command) => command.constructor.name), [
    "HeadObjectCommand",
    "GetObjectRetentionCommand",
  ]);
});

test("backup reader rejects a missing or mismatched returned version", async (t) => {
  for (const returnedVersion of [undefined, "other-version", "null"]) {
    await t.test(String(returnedVersion), async () => {
      const client = new FakeS3Client(async () => ({
        VersionId: returnedVersion,
        Body: Readable.from(["bytes"]),
      }));
      const reader = new S3ExactVersionBackupReader({
        client,
        endpoint: ENDPOINT,
        region: REGION,
        bucket: "rivt-protected",
        basePrefix: "recovery/sets",
      });
      await assert.rejects(reader.openRead("snapshots/set-1/object", {
        versionId: "required-version",
      }), { code: "S3_VERSION_MISMATCH" });
    });
  }
});

test("isolated restore target confines list, conditional put, readback, and delete to its prefix", async () => {
  const value = Buffer.from("restored object");
  const expectedChecksum = checksum(value);
  let listCalls = 0;
  const client = new FakeS3Client(async (command) => {
    if (command instanceof GetBucketVersioningCommand) return {};
    if (command instanceof ListObjectsV2Command) {
      listCalls += 1;
      if (listCalls === 1) return { IsTruncated: false, KeyCount: 0, Contents: [] };
      return {
        IsTruncated: false,
        KeyCount: 1,
        Contents: [inventoryObject("isolated/run-1/uploads/file.bin", value)],
      };
    }
    if (command instanceof PutObjectCommand) {
      assert.equal(command.input.ContentType, "application/pdf");
      assert.deepEqual(command.input.Metadata, { source: "rivt-test" });
      return { ChecksumSHA256: expectedChecksum };
    }
    if (command instanceof HeadObjectCommand) {
      const listed = inventoryObject("isolated/run-1/uploads/file.bin", value);
      return {
        ContentLength: listed.Size,
        ETag: listed.ETag,
        ContentType: "application/pdf",
        Metadata: { source: "rivt-test" },
        ChecksumSHA256: expectedChecksum,
      };
    }
    if (command instanceof GetObjectCommand) {
      return {
        VersionId: "restore-version-1",
        Body: Readable.from([value]),
      };
    }
    if (command instanceof DeleteObjectCommand) return {};
    throw new Error("unexpected command");
  });
  const target = new S3IsolatedRestoreTarget({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-restore",
    basePrefix: "isolated/run-1",
  });

  await target.assertEmpty();
  const receipt = await target.put("uploads/file.bin", Readable.from([value]), {
    ifNoneMatch: true,
    contentLength: value.length,
    checksumSha256: expectedChecksum,
    providerMetadata: {
      contentType: "application/pdf",
      customMetadata: { source: "rivt-test" },
    },
  });
  assert.deepEqual(receipt, {
    checksumSha256: expectedChecksum,
  });
  assert.equal((await readAll(await target.openRead("uploads/file.bin", {
    versionId: receipt.versionId,
  }))).toString(), value.toString());
  assert.deepEqual((await target.listInventory({ maximumItems: 2 })).map((item) => item.key), [
    "uploads/file.bin",
  ]);
  await target.delete("uploads/file.bin");

  assert.deepEqual(client.commands.map((command) => command.constructor.name), [
    "GetBucketVersioningCommand",
    "ListObjectsV2Command",
    "GetBucketVersioningCommand",
    "PutObjectCommand",
    "GetObjectCommand",
    "ListObjectsV2Command",
    "HeadObjectCommand",
    "DeleteObjectCommand",
  ]);
  for (const command of client.commands) {
    if (command instanceof ListObjectsV2Command) {
      assert.equal(command.input.Prefix, "isolated/run-1/");
    } else if (command instanceof HeadObjectCommand) {
      assert.equal(command.input.Key, "isolated/run-1/uploads/file.bin");
    } else if (!(command instanceof GetBucketVersioningCommand)) {
      assert.equal(command.input.Key, "isolated/run-1/uploads/file.bin");
    }
  }
  assert.equal(client.commands.some((command) => command instanceof GetObjectRetentionCommand), false);
});

test("isolated restore target detects preexisting objects and rejects invalid control keys", async () => {
  const client = new FakeS3Client(async (command) => {
    if (command instanceof GetBucketVersioningCommand) return {};
    if (command instanceof ListObjectsV2Command) {
      return {
        IsTruncated: false,
        KeyCount: 1,
        Contents: [inventoryObject("isolated/run-1/existing", "x")],
      };
    }
    if (command instanceof HeadObjectCommand) {
      const listed = inventoryObject("isolated/run-1/existing", "x");
      return { ContentLength: listed.Size, ETag: listed.ETag, Metadata: {} };
    }
    throw new Error("unexpected command");
  });
  const target = new S3IsolatedRestoreTarget({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-restore",
    basePrefix: "isolated/run-1",
  });
  await assert.rejects(target.assertEmpty(), { code: "RESTORE_TARGET_NOT_EMPTY" });
  await assert.rejects(target.delete("invalid\nkey"), { code: "S3_KEY_INVALID" });
  assert.equal(client.commands.length, 3);
});

test("isolated restore target rejects versioned buckets before a plaintext write", async () => {
  const client = new FakeS3Client(async (command) => {
    assert.ok(command instanceof GetBucketVersioningCommand);
    return { Status: "Enabled" };
  });
  const target = new S3IsolatedRestoreTarget({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-versioned-restore",
    basePrefix: "isolated/run-1",
  });
  await assert.rejects(target.assertEmpty(), { code: "RESTORE_TARGET_VERSIONED" });
  await assert.rejects(target.put("uploads/file.bin", Readable.from(["x"]), {
    ifNoneMatch: true,
    contentLength: 1,
    checksumSha256: checksum("x"),
  }), { code: "RESTORE_TARGET_UNVERIFIED" });
  assert.deepEqual(client.commands.map((command) => command.constructor.name), [
    "GetBucketVersioningCommand",
  ]);
});

test("isolated restore target exact-deletes a null version returned by a raced write", async () => {
  const value = Buffer.from("raced null version");
  const client = new FakeS3Client(async (command) => {
    if (command instanceof GetBucketVersioningCommand) return {};
    if (command instanceof ListObjectsV2Command) {
      return { IsTruncated: false, KeyCount: 0, Contents: [] };
    }
    if (command instanceof PutObjectCommand) {
      return { ChecksumSHA256: checksum(value), VersionId: "null" };
    }
    if (command instanceof DeleteObjectCommand) return {};
    throw new Error("unexpected command");
  });
  const target = new S3IsolatedRestoreTarget({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-restore",
    basePrefix: "isolated/run-null-version",
  });
  await target.assertEmpty();
  await assert.rejects(target.put("uploads/file.bin", Readable.from([value]), {
    ifNoneMatch: true,
    contentLength: value.length,
    checksumSha256: checksum(value),
  }), { code: "RESTORE_TARGET_VERSIONED" });
  const deleteCommand = client.commands.find((command) => command instanceof DeleteObjectCommand);
  assert.deepEqual(deleteCommand.input, {
    Bucket: "rivt-restore",
    Key: "isolated/run-null-version/uploads/file.bin",
    VersionId: "null",
  });
});

test("isolated restore target cleans an accepted write with a malformed version receipt", async () => {
  const value = Buffer.from("malformed version receipt");
  const client = new FakeS3Client(async (command) => {
    if (command instanceof GetBucketVersioningCommand) return {};
    if (command instanceof ListObjectsV2Command) {
      return { IsTruncated: false, KeyCount: 0, Contents: [] };
    }
    if (command instanceof PutObjectCommand) {
      return { ChecksumSHA256: checksum(value), VersionId: { malformed: true } };
    }
    if (command instanceof DeleteObjectCommand) return {};
    throw new Error("unexpected command");
  });
  const target = new S3IsolatedRestoreTarget({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-restore",
    basePrefix: "isolated/run-malformed-version",
  });
  await target.assertEmpty();
  await assert.rejects(target.put("uploads/file.bin", Readable.from([value]), {
    ifNoneMatch: true,
    contentLength: value.length,
    checksumSha256: checksum(value),
  }), { code: "S3_VERSION_INVALID" });
  const cleanupDelete = client.commands.find((command) => command instanceof DeleteObjectCommand);
  assert.deepEqual(cleanupDelete.input, {
    Bucket: "rivt-restore",
    Key: "isolated/run-malformed-version/uploads/file.bin",
  });
  assert.deepEqual(client.commands.slice(-2).map((command) => command.constructor.name), [
    "GetBucketVersioningCommand",
    "ListObjectsV2Command",
  ]);
});

test("isolated restore target cleans an accepted write whose receipt fails validation", async () => {
  const value = Buffer.from("ambiguous restore write");
  const client = new FakeS3Client(async (command) => {
    if (command instanceof GetBucketVersioningCommand) return {};
    if (command instanceof ListObjectsV2Command) {
      return { IsTruncated: false, KeyCount: 0, Contents: [] };
    }
    if (command instanceof PutObjectCommand) {
      return { ChecksumSHA256: checksum("different") };
    }
    if (command instanceof DeleteObjectCommand) return {};
    throw new Error("unexpected command");
  });
  const target = new S3IsolatedRestoreTarget({
    client,
    endpoint: ENDPOINT,
    region: REGION,
    bucket: "rivt-restore",
    basePrefix: "isolated/run-ambiguous",
  });
  await target.assertEmpty();
  await assert.rejects(target.put("uploads/file.bin", Readable.from([value]), {
    ifNoneMatch: true,
    contentLength: value.length,
    checksumSha256: checksum(value),
  }), { code: "S3_CHECKSUM_MISMATCH" });
  assert.deepEqual(client.commands.map((command) => command.constructor.name), [
    "GetBucketVersioningCommand",
    "ListObjectsV2Command",
    "GetBucketVersioningCommand",
    "PutObjectCommand",
    "DeleteObjectCommand",
    "GetBucketVersioningCommand",
    "ListObjectsV2Command",
  ]);
  const cleanupDelete = client.commands.find((command) => command instanceof DeleteObjectCommand);
  assert.deepEqual(cleanupDelete.input, {
    Bucket: "rivt-restore",
    Key: "isolated/run-ambiguous/uploads/file.bin",
  });
});

test("provider failures expose only fixed privacy-safe messages", async () => {
  const sensitiveValues = ["rivt-source", "application/private/user-123.jpg", "SECRET-EXAMPLE"];
  const client = new FakeS3Client(async () => {
    const error = new Error(sensitiveValues.join(" "));
    error.$metadata = { httpStatusCode: 403 };
    error.secretAccessKey = sensitiveValues[2];
    throw error;
  });
  const store = sourceStore(client);
  let reported;
  try {
    await store.openRead("private/user-123.jpg");
  } catch (error) {
    reported = error;
  }
  assert.equal(reported?.code, "S3_READ_FAILED");
  for (const sensitive of sensitiveValues) {
    assert.equal(reported.message.includes(sensitive), false);
  }
  assert.equal(Object.hasOwn(reported, "cause"), false);
});
