import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import { completeRecoveryDatabaseIdentitySha256 } from "../scripts/complete-recovery-database.js";
import { verifyIsolatedApplicationRouteReads } from "../scripts/isolated-application-route-reader.js";
import { createAuthenticatedUploadUrlHandler } from "../server/legacy-integrations.js";

const scopes = Object.freeze([
  "legacy",
  "project",
  "album",
  "shop-talk",
  "document-brand",
  "professional-profile",
  "message",
  "contact-note",
]);
const ownerAccountId = "10000000-0000-4000-8000-000000000001";
const targetIdentity = Object.freeze({
  systemIdentifier: "7612345678901234567",
  databaseOid: "17384",
  databaseName: "rivt_restore",
});
const targetIdentitySha256 = completeRecoveryDatabaseIdentitySha256(targetIdentity);
const targetUrl = "postgresql://restore:secret@restore.example.test/rivt_restore";
const protectedDatabaseUrls = Object.freeze([
  "postgresql://reader:secret@source.example.test/rivt",
  "postgresql://runtime:secret@production.example.test/rivt",
]);

function fixture() {
  const objects = new Map();
  const databaseReferences = scopes.map((storageScope, index) => {
    const sourceKey = `restored/${storageScope}/object-${index + 1}.bin`;
    objects.set(sourceKey, Buffer.from(`restored-${storageScope}-bytes`));
    return {
      uploadId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      ownerAccountId,
      sourceKey,
      storageScope,
    };
  });
  const entries = databaseReferences.map((reference) => {
    const bytes = objects.get(reference.sourceKey);
    return {
      sourceKey: reference.sourceKey,
      plaintextBytes: bytes.length,
      plaintextSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      storageScopes: [reference.storageScope],
    };
  });
  return { databaseReferences, entries, objects };
}

function fakePool({
  canonicalReferences,
  lifecycle = [],
  routeObjectKey,
} = {}) {
  const client = {
    async query(sql, parameters = []) {
      lifecycle.push({ sql, parameters });
      if (/SELECT object_key/u.test(sql)) {
        const reference = canonicalReferences.find((candidate) => (
          candidate.uploadId === parameters[0]
          && candidate.ownerAccountId === parameters[1]
        ));
        if (!reference) return { rowCount: 0, rows: [] };
        const objectKey = typeof routeObjectKey === "function"
          ? routeObjectKey(reference)
          : reference.sourceKey;
        return { rowCount: 1, rows: [{ object_key: objectKey }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {
      lifecycle.push({ sql: "RELEASE", parameters: [] });
    },
  };
  return {
    async connect() {
      lifecycle.push({ sql: "CONNECT", parameters: [] });
      return client;
    },
    async end() {
      lifecycle.push({ sql: "END", parameters: [] });
    },
  };
}

function readArguments({
  suppliedFixture = fixture(),
  canonicalReferences = suppliedFixture.databaseReferences,
  lifecycle = [],
  identity = targetIdentity,
  routeObjectKey,
  openRestoredObject,
  maximumObjectBytes = 1_024,
  targetReferenceByteSmoke = { targetReferenceByteSmokePassed: true },
  suppliedTargetUrl = targetUrl,
  suppliedProtectedUrls = protectedDatabaseUrls,
} = {}) {
  return {
    targetUrl: suppliedTargetUrl,
    protectedDatabaseUrls: suppliedProtectedUrls,
    confirmTargetIsolated: true,
    expectedTargetRuntimeIdentitySha256: targetIdentitySha256,
    databaseReferences: suppliedFixture.databaseReferences,
    entries: suppliedFixture.entries,
    openRestoredObject: openRestoredObject ?? (async (sourceKey) => (
      Readable.from([suppliedFixture.objects.get(sourceKey)])
    )),
    maximumObjectBytes,
    targetReferenceByteSmoke,
    poolFactory: () => fakePool({ canonicalReferences, lifecycle, routeObjectKey }),
    readRuntimeDatabaseIdentity: async () => identity,
  };
}

function captureResponse() {
  const state = { statusCode: 200, body: undefined };
  const response = {
    status(statusCode) {
      state.statusCode = statusCode;
      return response;
    },
    json(body) {
      state.body = body;
      return response;
    },
  };
  return { response, state };
}

test("production upload URL handler remains startup-safe and signs only stored owned objects", async () => {
  assert.doesNotThrow(() => createAuthenticatedUploadUrlHandler({
    database: null,
    runWithDatabase: async () => undefined,
    signedObjectUrl: async () => null,
    signedUrlSeconds: Number.NaN,
  }));

  const queries = [];
  const handler = createAuthenticatedUploadUrlHandler({
    database: {
      async query(sql, parameters) {
        queries.push({ sql, parameters });
        return { rowCount: 1, rows: [{ object_key: "project/owned.bin" }] };
      },
    },
    runWithDatabase: async (_response, _next, action) => action(),
    signedObjectUrl: async (sourceKey) => `https://objects.example.test/${sourceKey}`,
    signedUrlSeconds: 900,
  });
  const { response, state } = captureResponse();
  await handler(
    { authUser: { id: ownerAccountId }, params: { id: "00000000-0000-4000-8000-000000000001" } },
    response,
    (error) => { throw error; },
  );
  assert.equal(state.statusCode, 200);
  assert.equal(state.body.ok, true);
  assert.deepEqual(queries[0].parameters, [
    "00000000-0000-4000-8000-000000000001",
    ownerAccountId,
    ownerAccountId,
  ]);
  assert.match(queries[0].sql, /account_id = \$2::uuid/u);
  assert.match(queries[0].sql, /account_id IS NULL AND session_id = \$3/u);
  assert.match(queries[0].sql, /upload_status = 'stored'/u);
  assert.match(queries[0].sql, /object_key IS NOT NULL/u);
});

test("providerless isolated route reader exercises the production handler for every exact scope", async () => {
  const lifecycle = [];
  const receipt = await verifyIsolatedApplicationRouteReads(readArguments({ lifecycle }));
  assert.equal(receipt.ok, true);
  assert.equal(receipt.mode, "isolated-application-route");
  assert.equal(receipt.applicationReadSmokeEvidenceLevel, "handler-injected-store");
  assert.equal(receipt.representativeObjectCount, scopes.length);
  assert.deepEqual(receipt.storageScopes, [...scopes].sort());
  assert.equal(lifecycle.filter(({ sql }) => /SELECT object_key/u.test(sql)).length, scopes.length);
  assert.equal(lifecycle.some(({ sql }) => sql === "BEGIN READ ONLY"), true);
  assert.equal(lifecycle.some(({ sql }) => sql === "COMMIT"), true);
  assert.equal(lifecycle.some(({ sql }) => sql === "ROLLBACK"), false);
  assert.deepEqual(lifecycle.slice(-2).map(({ sql }) => sql), ["RELEASE", "END"]);
});

test("isolated route reader preserves outer whitespace and NFD object keys byte-exactly", async () => {
  const suppliedFixture = fixture();
  const originalKey = suppliedFixture.databaseReferences[0].sourceKey;
  const opaqueKey = " restored/project/cafe\u0301 photo.bin ";
  const bytes = suppliedFixture.objects.get(originalKey);
  suppliedFixture.objects.delete(originalKey);
  suppliedFixture.objects.set(opaqueKey, bytes);
  suppliedFixture.databaseReferences[0] = {
    ...suppliedFixture.databaseReferences[0],
    sourceKey: opaqueKey,
  };
  suppliedFixture.entries[0] = {
    ...suppliedFixture.entries[0],
    sourceKey: opaqueKey,
  };
  const openedKeys = [];
  const receipt = await verifyIsolatedApplicationRouteReads(readArguments({
    suppliedFixture,
    openRestoredObject: async (sourceKey) => {
      openedKeys.push(sourceKey);
      return Readable.from([suppliedFixture.objects.get(sourceKey)]);
    },
  }));
  assert.equal(opaqueKey.startsWith(" "), true);
  assert.equal(opaqueKey.endsWith(" "), true);
  assert.notEqual(opaqueKey, opaqueKey.normalize("NFC"));
  assert.equal(receipt.ok, true);
  assert.equal(openedKeys[0], opaqueKey);
  assert.equal(openedKeys.includes(opaqueKey.normalize("NFC")), false);
});

test("isolated route reader requires exact scope equality before opening the target database", async () => {
  const suppliedFixture = fixture();
  suppliedFixture.databaseReferences = suppliedFixture.databaseReferences.slice(1);
  const lifecycle = [];
  await assert.rejects(
    () => verifyIsolatedApplicationRouteReads(readArguments({ suppliedFixture, lifecycle })),
    (error) => error.code === "APPLICATION_READ_SMOKE_FAILED",
  );
  assert.deepEqual(lifecycle, []);

  const duplicateFixture = fixture();
  duplicateFixture.databaseReferences = [
    ...duplicateFixture.databaseReferences,
    {
      ...duplicateFixture.databaseReferences[0],
      uploadId: "00000000-0000-4000-8000-000000000099",
    },
  ];
  await assert.rejects(
    () => verifyIsolatedApplicationRouteReads(readArguments({ suppliedFixture: duplicateFixture })),
    (error) => error.code === "APPLICATION_READ_SMOKE_FAILED",
  );
});

test("isolated route reader fails closed on identity drift before any application query", async () => {
  const lifecycle = [];
  await assert.rejects(
    () => verifyIsolatedApplicationRouteReads(readArguments({
      lifecycle,
      identity: { ...targetIdentity, databaseOid: "99999" },
    })),
    (error) => error.code === "RECOVERY_DATABASE_TARGET_NOT_ISOLATED",
  );
  assert.equal(lifecycle.some(({ sql }) => /SELECT object_key/u.test(sql)), false);
  assert.equal(lifecycle.some(({ sql }) => sql === "ROLLBACK"), true);
});

test("isolated route reader rejects wrong-owner, key substitution, and byte tampering", async (context) => {
  const canonicalFixture = fixture();
  const wrongOwnerFixture = fixture();
  wrongOwnerFixture.databaseReferences[0] = {
    ...wrongOwnerFixture.databaseReferences[0],
    ownerAccountId: "20000000-0000-4000-8000-000000000002",
  };
  await context.test("wrong owner", async () => {
    await assert.rejects(
      () => verifyIsolatedApplicationRouteReads(readArguments({
        suppliedFixture: wrongOwnerFixture,
        canonicalReferences: canonicalFixture.databaseReferences,
      })),
      (error) => error.code === "APPLICATION_READ_SMOKE_FAILED",
    );
  });

  await context.test("route key substitution", async () => {
    await assert.rejects(
      () => verifyIsolatedApplicationRouteReads(readArguments({
        routeObjectKey: () => "restored/attacker/substitute.bin",
      })),
      (error) => error.code === "APPLICATION_READ_SMOKE_FAILED",
    );
  });

  await context.test("tampered bytes", async () => {
    await assert.rejects(
      () => verifyIsolatedApplicationRouteReads(readArguments({
        openRestoredObject: async () => Readable.from([Buffer.from("tampered")]),
      })),
      (error) => error.code === "APPLICATION_READ_SMOKE_FAILED",
    );
  });
});

test("isolated route reader rejects unsafe limits, missing lower-level proof, and target collision", async () => {
  await assert.rejects(
    () => verifyIsolatedApplicationRouteReads(readArguments({ maximumObjectBytes: 1 })),
    (error) => error.code === "APPLICATION_READ_SMOKE_FAILED",
  );
  await assert.rejects(
    () => verifyIsolatedApplicationRouteReads(readArguments({ targetReferenceByteSmoke: {} })),
    (error) => error.code === "APPLICATION_READ_SMOKE_FAILED",
  );
  await assert.rejects(
    () => verifyIsolatedApplicationRouteReads(readArguments({
      suppliedProtectedUrls: [targetUrl],
    })),
    (error) => error.code === "RECOVERY_DATABASE_TARGET_NOT_ISOLATED",
  );
});
