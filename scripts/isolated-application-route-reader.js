import crypto from "node:crypto";
import { createAuthenticatedUploadUrlHandler } from "../server/legacy-integrations.js";
import { completeRecoveryDatabaseIdentitySha256 } from "./complete-recovery-database.js";
import {
  assertDifferentDatabases,
  poolFor,
  runtimeDatabaseIdentity,
} from "./logical-backup-utils.js";
import {
  APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE,
  RecoveryError,
} from "./recovery-object-utils.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ROUTE_SIGNED_URL_SECONDS = 60;

function routeReadFailure(message = "Representative isolated RIVT application-route reads failed.") {
  return new RecoveryError("APPLICATION_READ_SMOKE_FAILED", message);
}

function isolatedTargetFailure() {
  return new RecoveryError(
    "RECOVERY_DATABASE_TARGET_NOT_ISOLATED",
    "The application-route reader is not bound to the expected isolated database target.",
  );
}

function exactNonsecretString(value, maximumBytes) {
  return typeof value === "string"
    && value.length > 0
    && value === value.trim()
    && Buffer.byteLength(value, "utf8") <= maximumBytes
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function opaqueObjectKey(value) {
  return typeof value === "string"
    && value.length > 0
    && Buffer.byteLength(value, "utf8") <= 1_024
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function exactScopedRepresentatives(databaseReferences, entries) {
  if (
    !Array.isArray(databaseReferences)
    || databaseReferences.length > 64
    || !Array.isArray(entries)
  ) {
    throw routeReadFailure();
  }
  const expectedScopes = new Set();
  const normalizedEntries = entries.map((entry) => {
    if (
      !opaqueObjectKey(entry?.sourceKey)
      || !Number.isSafeInteger(entry?.plaintextBytes)
      || entry.plaintextBytes < 0
      || !SHA256_PATTERN.test(entry?.plaintextSha256 ?? "")
      || !Array.isArray(entry?.storageScopes)
    ) {
      throw routeReadFailure();
    }
    const storageScopes = new Set();
    for (const scope of entry.storageScopes) {
      if (!exactNonsecretString(scope, 128) || storageScopes.has(scope)) {
        throw routeReadFailure();
      }
      storageScopes.add(scope);
      expectedScopes.add(scope);
    }
    return Object.freeze({
      sourceKey: entry.sourceKey,
      plaintextBytes: entry.plaintextBytes,
      plaintextSha256: entry.plaintextSha256,
      storageScopes,
    });
  });
  const observedScopes = new Set();
  const representatives = databaseReferences.map((reference) => {
    if (
      !UUID_PATTERN.test(reference?.uploadId ?? "")
      || !UUID_PATTERN.test(reference?.ownerAccountId ?? "")
      || !opaqueObjectKey(reference?.sourceKey)
      || !exactNonsecretString(reference?.storageScope, 128)
      || observedScopes.has(reference.storageScope)
    ) {
      throw routeReadFailure();
    }
    observedScopes.add(reference.storageScope);
    const entry = normalizedEntries.find((candidate) => (
      candidate.sourceKey === reference.sourceKey
      && candidate.storageScopes.has(reference.storageScope)
    ));
    if (!entry) throw routeReadFailure();
    return Object.freeze({
      uploadId: reference.uploadId,
      ownerAccountId: reference.ownerAccountId,
      sourceKey: reference.sourceKey,
      storageScope: reference.storageScope,
      entry,
    });
  });
  const sortedExpectedScopes = [...expectedScopes].sort();
  const sortedObservedScopes = [...observedScopes].sort();
  if (
    sortedExpectedScopes.length === 0
    || sortedExpectedScopes.length !== sortedObservedScopes.length
    || sortedExpectedScopes.some((scope, index) => scope !== sortedObservedScopes[index])
  ) {
    throw routeReadFailure(
      "Every restored application-object scope requires one exact application-route representative.",
    );
  }
  return Object.freeze({
    representatives: Object.freeze(representatives),
    storageScopes: Object.freeze(sortedExpectedScopes),
  });
}

async function hashBoundedStream(stream, maximumBytes) {
  if (
    !stream
    || (
      typeof stream[Symbol.asyncIterator] !== "function"
      && typeof stream[Symbol.iterator] !== "function"
    )
  ) {
    throw routeReadFailure();
  }
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) {
    const value = Buffer.from(chunk);
    bytes += value.length;
    if (bytes > maximumBytes) {
      throw routeReadFailure("An application-route representative exceeds the fixed read limit.");
    }
    hash.update(value);
  }
  return Object.freeze({ bytes, sha256: hash.digest("hex") });
}

function responseCapture() {
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

function opaqueDeliveryUrl(deliveryTokens, sourceKey) {
  let url;
  do {
    url = `https://isolated-route.invalid/${crypto.randomBytes(24).toString("base64url")}`;
  } while (deliveryTokens.has(url));
  deliveryTokens.set(url, sourceKey);
  return url;
}

export async function verifyIsolatedApplicationRouteReads({
  targetUrl,
  protectedDatabaseUrls = [],
  confirmTargetIsolated = false,
  expectedTargetRuntimeIdentitySha256,
  databaseReferences,
  entries,
  openRestoredObject,
  maximumObjectBytes,
  targetReferenceByteSmoke,
  poolFactory = poolFor,
  readRuntimeDatabaseIdentity = runtimeDatabaseIdentity,
  uploadUrlHandlerFactory = createAuthenticatedUploadUrlHandler,
} = {}) {
  if (
    confirmTargetIsolated !== true
    || !exactNonsecretString(targetUrl, 8_192)
    || !Array.isArray(protectedDatabaseUrls)
    || protectedDatabaseUrls.length === 0
    || protectedDatabaseUrls.some((url) => !exactNonsecretString(url, 8_192))
    || !SHA256_PATTERN.test(expectedTargetRuntimeIdentitySha256 ?? "")
    || typeof openRestoredObject !== "function"
    || !Number.isSafeInteger(maximumObjectBytes)
    || maximumObjectBytes < 1
    || targetReferenceByteSmoke?.targetReferenceByteSmokePassed !== true
    || typeof poolFactory !== "function"
    || typeof readRuntimeDatabaseIdentity !== "function"
    || typeof uploadUrlHandlerFactory !== "function"
  ) {
    throw routeReadFailure();
  }
  try {
    for (const protectedUrl of protectedDatabaseUrls) {
      assertDifferentDatabases(protectedUrl, targetUrl);
    }
  } catch {
    throw isolatedTargetFailure();
  }
  const { representatives, storageScopes } = exactScopedRepresentatives(
    databaseReferences,
    entries,
  );
  const pool = poolFactory(targetUrl);
  if (!pool || typeof pool.connect !== "function" || typeof pool.end !== "function") {
    throw routeReadFailure();
  }
  let client;
  let transactionStarted = false;
  let operationError;
  let receipt;
  try {
    client = await pool.connect();
    if (!client || typeof client.query !== "function" || typeof client.release !== "function") {
      throw routeReadFailure();
    }
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;
    await client.query("SET LOCAL statement_timeout = '60s'");
    const runtimeIdentity = await readRuntimeDatabaseIdentity(client);
    if (
      completeRecoveryDatabaseIdentitySha256(runtimeIdentity)
      !== expectedTargetRuntimeIdentitySha256
    ) {
      throw isolatedTargetFailure();
    }
    const deliveryTokens = new Map();
    const database = Object.freeze({
      query: (...args) => client.query(...args),
    });
    const routeHandler = uploadUrlHandlerFactory({
      database,
      runWithDatabase: async (_response, _next, action) => action(),
      signedObjectUrl: async (sourceKey) => opaqueDeliveryUrl(deliveryTokens, sourceKey),
      signedUrlSeconds: ROUTE_SIGNED_URL_SECONDS,
    });
    if (typeof routeHandler !== "function") throw routeReadFailure();

    for (const representative of representatives) {
      const { response, state } = responseCapture();
      let nextError;
      await routeHandler(
        {
          authUser: Object.freeze({ id: representative.ownerAccountId }),
          params: Object.freeze({ id: representative.uploadId }),
        },
        response,
        (error) => { nextError = error ?? routeReadFailure(); },
      );
      if (nextError) throw nextError;
      const routedSourceKey = deliveryTokens.get(state.body?.signedUrl);
      if (
        state.statusCode !== 200
        || state.body?.ok !== true
        || state.body?.expiresIn !== ROUTE_SIGNED_URL_SECONDS
        || routedSourceKey !== representative.sourceKey
      ) {
        throw routeReadFailure();
      }
      deliveryTokens.delete(state.body.signedUrl);
      const observed = await hashBoundedStream(
        await openRestoredObject(routedSourceKey),
        maximumObjectBytes,
      );
      if (
        observed.bytes !== representative.entry.plaintextBytes
        || observed.sha256 !== representative.entry.plaintextSha256
      ) {
        throw routeReadFailure();
      }
    }
    if (deliveryTokens.size !== 0) throw routeReadFailure();
    await client.query("COMMIT");
    transactionStarted = false;
    receipt = Object.freeze({
      ok: true,
      mode: "isolated-application-route",
      applicationReadSmokeEvidenceLevel:
        APPLICATION_READ_SMOKE_HANDLER_INJECTED_STORE,
      representativeObjectCount: representatives.length,
      storageScopes,
    });
  } catch (error) {
    operationError = error instanceof RecoveryError ? error : routeReadFailure();
  } finally {
    if (transactionStarted) await client?.query("ROLLBACK").catch(() => undefined);
    client?.release();
    try {
      await pool.end();
    } catch {
      operationError = operationError ?? routeReadFailure();
    }
  }
  if (operationError) throw operationError;
  return receipt;
}
