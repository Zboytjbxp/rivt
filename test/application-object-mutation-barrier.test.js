import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  APPLICATION_OBJECT_BARRIER_LOCK_NAME,
  ApplicationObjectBarrierError,
  acquireApplicationObjectCaptureLease,
  acquireApplicationObjectMutationLease,
  createApplicationObjectMutationRuntime,
} from "../server/application-object-mutation-barrier.js";
import { acquireCompleteRecoveryCaptureBarrier } from "../scripts/complete-recovery-database.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function advisoryLockDatabase() {
  const state = {
    exclusive: false,
    shared: 0,
    calls: [],
    clients: [],
  };
  return {
    state,
    async connect() {
      const client = {
        mode: null,
        released: false,
        releaseError: undefined,
        async query(sql, parameters) {
          state.calls.push({ sql, parameters });
          assert.deepEqual(parameters, [APPLICATION_OBJECT_BARRIER_LOCK_NAME]);
          if (sql.includes("pg_try_advisory_lock_shared")) {
            const acquired = !state.exclusive;
            if (acquired) {
              state.shared += 1;
              client.mode = "mutation";
            }
            return { rows: [{ acquired }] };
          }
          if (sql.includes("pg_try_advisory_lock(")) {
            const acquired = !state.exclusive && state.shared === 0;
            if (acquired) {
              state.exclusive = true;
              client.mode = "capture";
            }
            return { rows: [{ acquired }] };
          }
          if (sql.includes("pg_advisory_unlock_shared")) {
            const released = client.mode === "mutation";
            if (released) {
              state.shared -= 1;
              client.mode = null;
            }
            return { rows: [{ released }] };
          }
          if (sql.includes("pg_advisory_unlock(")) {
            const released = client.mode === "capture";
            if (released) {
              state.exclusive = false;
              client.mode = null;
            }
            return { rows: [{ released }] };
          }
          throw new Error(`Unexpected advisory-lock query: ${sql}`);
        },
        release(error) {
          client.released = true;
          client.releaseError = error;
          if (error && client.mode === "mutation") state.shared -= 1;
          if (error && client.mode === "capture") state.exclusive = false;
          if (error) client.mode = null;
        },
      };
      state.clients.push(client);
      return client;
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function advisoryChallengePool(namespace) {
  const state = { endCalls: 0, releaseCalls: 0 };
  return {
    state,
    async connect() {
      const heldExclusive = new Set();
      const heldShared = new Set();
      return {
        async query(sql, [key]) {
          if (sql.includes("pg_try_advisory_lock_shared")) {
            const acquired = !namespace.exclusive.has(key);
            if (acquired) {
              namespace.shared.set(key, (namespace.shared.get(key) ?? 0) + 1);
              heldShared.add(key);
            }
            return { rows: [{ acquired }] };
          }
          if (sql.includes("pg_try_advisory_lock(")) {
            const acquired = !namespace.exclusive.has(key) && !namespace.shared.has(key);
            if (acquired) {
              namespace.exclusive.add(key);
              heldExclusive.add(key);
            }
            return { rows: [{ acquired }] };
          }
          if (sql.includes("pg_advisory_unlock_shared")) {
            const released = heldShared.delete(key);
            if (released) {
              const remaining = (namespace.shared.get(key) ?? 1) - 1;
              if (remaining) namespace.shared.set(key, remaining);
              else namespace.shared.delete(key);
            }
            return { rows: [{ released }] };
          }
          if (sql.includes("pg_advisory_unlock(")) {
            const released = heldExclusive.delete(key);
            if (released) namespace.exclusive.delete(key);
            return { rows: [{ released }] };
          }
          throw new Error(`Unexpected advisory challenge query: ${sql}`);
        },
        release(error) {
          state.releaseCalls += 1;
          if (!error) return;
          for (const key of heldExclusive) namespace.exclusive.delete(key);
          for (const key of heldShared) {
            const remaining = (namespace.shared.get(key) ?? 1) - 1;
            if (remaining) namespace.shared.set(key, remaining);
            else namespace.shared.delete(key);
          }
        },
      };
    },
    async end() { state.endCalls += 1; },
  };
}

test("shared mutation and exclusive capture leases cannot overlap", async () => {
  const database = advisoryLockDatabase();
  const mutation = await acquireApplicationObjectMutationLease(database);
  assert.equal(database.state.shared, 1);

  await assert.rejects(
    () => acquireApplicationObjectCaptureLease(database),
    (error) => error.code === "APPLICATION_OBJECT_BARRIER_BUSY",
  );
  assert.equal(database.state.exclusive, false);

  await mutation.release();
  assert.equal(database.state.shared, 0);
  const capture = await acquireApplicationObjectCaptureLease(database);
  assert.equal(database.state.exclusive, true);

  await assert.rejects(
    () => acquireApplicationObjectMutationLease(database),
    (error) => error.code === "APPLICATION_OBJECT_BARRIER_BUSY",
  );
  await capture.release();
  assert.equal(database.state.exclusive, false);
  assert.ok(database.state.calls.some(({ sql }) => sql.includes("pg_try_advisory_lock_shared")));
  assert.ok(database.state.calls.some(({ sql }) => sql.includes("pg_try_advisory_lock(")));
});

test("runtime rejects mutation commands outside a lease but permits read-only object reads", async () => {
  const database = advisoryLockDatabase();
  const providerCalls = [];
  const runtime = createApplicationObjectMutationRuntime({ database });
  const client = runtime.guardClient({
    async send(command) {
      providerCalls.push(command.constructor.name);
      return {};
    },
  });

  await client.send(new GetObjectCommand({ Bucket: "source", Key: "read-only" }));
  await assert.rejects(
    () => client.send(new PutObjectCommand({ Bucket: "source", Key: "blocked", Body: "x" })),
    (error) => error.code === "APPLICATION_OBJECT_MUTATION_BARRIER_REQUIRED",
  );
  assert.deepEqual(providerCalls, ["GetObjectCommand"]);
});

test("capture lease makes a request mutation fail before any provider call", async () => {
  const database = advisoryLockDatabase();
  const capture = await acquireApplicationObjectCaptureLease(database);
  let providerCalls = 0;
  const runtime = createApplicationObjectMutationRuntime({ database });
  const client = runtime.guardClient({
    async send() {
      providerCalls += 1;
      return {};
    },
  });
  const route = runtime.wrapRoute(async () => (
    client.send(new PutObjectCommand({ Bucket: "source", Key: "must-not-write", Body: "x" }))
  ));

  await assert.rejects(
    () => route({}, {}, () => undefined),
    (error) => error.code === "APPLICATION_OBJECT_CAPTURE_IN_PROGRESS",
  );
  assert.equal(providerCalls, 0);
  await capture.release();
});

test("route wrapper holds a shared lease until handler settlement despite a client abort", async () => {
  const database = advisoryLockDatabase();
  let providerCalls = 0;
  const runtime = createApplicationObjectMutationRuntime({ database });
  const client = runtime.guardClient({
    async send() {
      providerCalls += 1;
      return { ok: true };
    },
  });
  const handlerEntered = deferred();
  const finishHandler = deferred();
  const route = runtime.wrapRoute(async (_request, response) => {
    await client.send(new PutObjectCommand({ Bucket: "source", Key: "allowed", Body: "x" }));
    handlerEntered.resolve();
    await finishHandler.promise;
    response.completed = true;
  });
  const response = new EventEmitter();
  response.completed = false;
  const operation = route({}, response, () => undefined);
  await handlerEntered.promise;
  assert.equal(providerCalls, 1);
  assert.equal(database.state.shared, 1);
  response.emit("close");
  await assert.rejects(
    () => acquireApplicationObjectCaptureLease(database),
    (error) => error.code === "APPLICATION_OBJECT_BARRIER_BUSY",
  );

  finishHandler.resolve();
  await operation;
  assert.equal(response.completed, true);
  assert.equal(database.state.shared, 0);
  const capture = await acquireApplicationObjectCaptureLease(database);
  await capture.release();

  await assert.rejects(
    () => client.send(new PutObjectCommand({ Bucket: "source", Key: "after-response", Body: "x" })),
    (error) => error.code === "APPLICATION_OBJECT_MUTATION_BARRIER_REQUIRED",
  );
  assert.equal(providerCalls, 1);
});

test("route wrapper drains an admitted unawaited object mutation before releasing", async () => {
  const database = advisoryLockDatabase();
  const providerEntered = deferred();
  const finishProvider = deferred();
  const runtime = createApplicationObjectMutationRuntime({ database });
  const client = runtime.guardClient({
    async send() {
      providerEntered.resolve();
      await finishProvider.promise;
      return { ok: true };
    },
  });
  let mutationPromise;
  const route = runtime.wrapRoute(async () => {
    mutationPromise = client.send(new PutObjectCommand({ Bucket: "source", Key: "unawaited", Body: "x" }));
  });
  const operation = route({}, {}, () => undefined);
  await providerEntered.promise;

  assert.equal(database.state.shared, 1);
  await assert.rejects(
    () => acquireApplicationObjectCaptureLease(database),
    (error) => error.code === "APPLICATION_OBJECT_BARRIER_BUSY",
  );
  finishProvider.resolve();
  await Promise.all([operation, mutationPromise]);
  assert.equal(database.state.shared, 0);
});

test("complete recovery barrier binds application and backup URLs to one runtime identity", async () => {
  const env = {
    BACKUP_DATABASE_URL: "postgresql://backup.example.test/rivt",
    DATABASE_URL: "postgresql://application.example.test/rivt",
  };
  const poolEnds = [];
  let leaseReleases = 0;
  const pools = new Map([
    [env.BACKUP_DATABASE_URL, { role: "backup", async end() { poolEnds.push("backup"); } }],
    [env.DATABASE_URL, { role: "application", async end() { poolEnds.push("application"); } }],
  ]);
  const runtimeIdentity = {
    systemIdentifier: "123456789",
    databaseOid: "16384",
    databaseName: "rivt",
  };
  const barrier = await acquireCompleteRecoveryCaptureBarrier({
    env,
    poolFactory(url, suppliedEnv) {
      assert.equal(suppliedEnv, env);
      return pools.get(url);
    },
    async acquireLease(suppliedPool, options) {
      assert.equal(suppliedPool, pools.get(env.BACKUP_DATABASE_URL));
      assert.equal(typeof options.identityProbe, "function");
      return {
        runtimeIdentity,
        async release() { leaseReleases += 1; },
      };
    },
    async probeRuntimeIdentity(pool) {
      assert.equal(pool, pools.get(env.DATABASE_URL));
      return runtimeIdentity;
    },
    async proveSharedLockNamespace(sourcePool, applicationPool) {
      assert.equal(sourcePool, pools.get(env.BACKUP_DATABASE_URL));
      assert.equal(applicationPool, pools.get(env.DATABASE_URL));
    },
  });

  assert.match(barrier.sourceRuntimeIdentitySha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    barrier.applicationRuntimeIdentitySha256,
    barrier.sourceRuntimeIdentitySha256,
  );
  assert.deepEqual(poolEnds, ["application"]);
  await Promise.all([barrier.release(), barrier.release()]);
  assert.equal(leaseReleases, 1);
  assert.deepEqual(poolEnds, ["application", "backup"]);
});

test("complete recovery challenge accepts two pools backed by one advisory-lock namespace", async () => {
  const namespace = { exclusive: new Set(), shared: new Map() };
  const sourcePool = advisoryChallengePool(namespace);
  const applicationPool = advisoryChallengePool(namespace);
  const runtimeIdentity = {
    systemIdentifier: "123456789",
    databaseOid: "16384",
    databaseName: "rivt",
  };
  let leaseReleases = 0;
  const barrier = await acquireCompleteRecoveryCaptureBarrier({
    env: {
      BACKUP_DATABASE_URL: "postgresql://backup.example.test/rivt",
      DATABASE_URL: "postgresql://application.example.test/rivt",
    },
    poolFactory(url) {
      return url.includes("backup") ? sourcePool : applicationPool;
    },
    acquireLease: async () => ({
      runtimeIdentity,
      async release() { leaseReleases += 1; },
    }),
    probeRuntimeIdentity: async () => runtimeIdentity,
  });
  assert.equal(namespace.exclusive.size, 0);
  assert.equal(namespace.shared.size, 0);
  assert.equal(applicationPool.state.endCalls, 1);
  await barrier.release();
  assert.equal(leaseReleases, 1);
  assert.equal(sourcePool.state.endCalls, 1);
});

test("complete recovery rejects matching database identities on different advisory-lock namespaces", async () => {
  const sourceNamespace = { exclusive: new Set(), shared: new Map() };
  const applicationNamespace = { exclusive: new Set(), shared: new Map() };
  const sourcePool = advisoryChallengePool(sourceNamespace);
  const applicationPool = advisoryChallengePool(applicationNamespace);
  const runtimeIdentity = {
    systemIdentifier: "123456789",
    databaseOid: "16384",
    databaseName: "rivt",
  };
  let leaseReleases = 0;
  await assert.rejects(
    () => acquireCompleteRecoveryCaptureBarrier({
      env: {
        BACKUP_DATABASE_URL: "postgresql://replica.example.test/rivt",
        DATABASE_URL: "postgresql://primary.example.test/rivt",
      },
      poolFactory(url) {
        return url.includes("replica") ? sourcePool : applicationPool;
      },
      acquireLease: async () => ({
        runtimeIdentity,
        async release() { leaseReleases += 1; },
      }),
      probeRuntimeIdentity: async () => runtimeIdentity,
    }),
    (error) => error.code === "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
  );
  assert.equal(leaseReleases, 1);
  assert.equal(sourceNamespace.exclusive.size, 0);
  assert.equal(sourceNamespace.shared.size, 0);
  assert.equal(applicationNamespace.exclusive.size, 0);
  assert.equal(applicationNamespace.shared.size, 0);
  assert.equal(sourcePool.state.endCalls, 1);
  assert.equal(applicationPool.state.endCalls, 1);
});

test("complete recovery closes both pools and releases the lock on runtime identity mismatch", async () => {
  const env = {
    BACKUP_DATABASE_URL: "postgresql://backup.example.test/rivt",
    DATABASE_URL: "postgresql://application.example.test/other",
  };
  let poolEnds = 0;
  let leaseReleases = 0;
  await assert.rejects(
    () => acquireCompleteRecoveryCaptureBarrier({
      env,
      poolFactory: () => ({ async end() { poolEnds += 1; } }),
      acquireLease: async () => ({
        runtimeIdentity: {
          systemIdentifier: "123456789",
          databaseOid: "16384",
          databaseName: "rivt",
        },
        async release() { leaseReleases += 1; },
      }),
      probeRuntimeIdentity: async () => ({
        systemIdentifier: "987654321",
        databaseOid: "16385",
        databaseName: "other",
      }),
    }),
    (error) => error.code === "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
  );
  assert.equal(leaseReleases, 1);
  assert.equal(poolEnds, 2);
});

test("complete recovery maps a competing mutation to a fail-before-capture error", async () => {
  let poolEnds = 0;
  await assert.rejects(
    () => acquireCompleteRecoveryCaptureBarrier({
      env: {
        BACKUP_DATABASE_URL: "postgresql://backup.example.test/rivt",
        DATABASE_URL: "postgresql://application.example.test/rivt",
      },
      poolFactory: () => ({ async end() { poolEnds += 1; } }),
      acquireLease: async () => {
        throw new ApplicationObjectBarrierError(
          "APPLICATION_OBJECT_BARRIER_BUSY",
          "busy",
        );
      },
    }),
    (error) => error.code === "RECOVERY_OBJECT_MUTATION_ACTIVE",
  );
  assert.equal(poolEnds, 2);
});

test("every checked-in server object or uploads-table mutator is wired to the shared barrier", () => {
  const serverDirectory = join(repositoryRoot, "server");
  const indexSource = readFileSync(join(serverDirectory, "index.js"), "utf8");
  const objectMutation = /new\s+(?:PutObjectCommand|DeleteObjectCommand)\b/u;
  const uploadsMutation = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:(?:"?public"?\.)?)"?uploads"?\b/iu;
  const expectedSurface = Object.freeze({
    "albums.js": { mutationTokens: 2, wrappedRoutes: 1 },
    "document-brand.js": { mutationTokens: 6, wrappedRoutes: 2 },
    "index.js": { mutationTokens: 3, wrappedRoutes: 1 },
    "legacy-integrations.js": { mutationTokens: 2, wrappedRoutes: 1 },
    "messaging-continuity.js": { mutationTokens: 12, wrappedRoutes: 5 },
    "professional-profile.js": { mutationTokens: 17, wrappedRoutes: 5 },
    "shop-talk.js": { mutationTokens: 3, wrappedRoutes: 2 },
  });
  const mutatorFiles = [];

  for (const entry of readdirSync(serverDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const source = readFileSync(join(serverDirectory, entry.name), "utf8");
    if (!objectMutation.test(source) && !uploadsMutation.test(source)) continue;
    mutatorFiles.push(entry.name);
    assert.match(source, /applicationObjectMutationBarrier/u, `${entry.name} must depend on the shared barrier`);
    const objectMutationCount = [...source.matchAll(/new\s+(?:PutObjectCommand|DeleteObjectCommand)\b/gu)].length;
    const uploadsMutationCount = [...source.matchAll(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:(?:"?public"?\.)?)"?uploads"?\b/giu,
    )].length;
    assert.equal(
      objectMutationCount + uploadsMutationCount,
      expectedSurface[entry.name]?.mutationTokens,
      `${entry.name} mutation surface changed and requires a barrier audit`,
    );
    assert.equal(
      [...source.matchAll(/applicationObjectMutationBarrier\(async\b/gu)].length,
      expectedSurface[entry.name]?.wrappedRoutes,
      `${entry.name} wrapped mutation-route inventory changed`,
    );
    assert.doesNotMatch(
      source,
      /,\s*applicationObjectMutationBarrier,\s*(?:asyncRoute|async)\b/u,
      `${entry.name} must use handler-lifetime wrapping, not response middleware`,
    );

    for (const match of source.matchAll(/([A-Za-z][A-Za-z0-9]*)\.send\(\s*new\s+(?:PutObjectCommand|DeleteObjectCommand)\b/gu)) {
      if (entry.name === "index.js") {
        assert.equal(match[1], "applicationObjectStoreClient", "index object writes must use the guarded client");
      } else {
        assert.equal(match[1], "s3Client", `${entry.name} must use its injected guarded client`);
      }
    }

    if (entry.name !== "index.js" && objectMutation.test(source)) {
      const registrationName = source.match(/export function (register[A-Za-z0-9]+Routes)\s*\(/u)?.[1];
      assert.ok(registrationName, `${entry.name} must expose one auditable route registration`);
      const registrationBlock = indexSource.match(
        new RegExp(`${registrationName}\\(\\{[\\s\\S]{0,2000}?\\n\\}\\);`, "u"),
      )?.[0] ?? "";
      assert.match(registrationBlock, /applicationObjectMutationBarrier/u, `${registrationName} must receive the barrier`);
      assert.match(
        registrationBlock,
        /s3Client:\s*applicationObjectStoreClient/u,
        `${registrationName} must receive the guarded object-store client`,
      );
    }
  }

  assert.deepEqual(mutatorFiles.sort(), [
    "albums.js",
    "document-brand.js",
    "index.js",
    "legacy-integrations.js",
    "messaging-continuity.js",
    "professional-profile.js",
    "shop-talk.js",
  ]);
  assert.match(indexSource, /const applicationObjectBarrierDatabase = databaseUrl[\s\S]{0,500}?max: 2,/u);
  assert.match(
    indexSource,
    /createApplicationObjectMutationRuntime\(\{\s*database: applicationObjectBarrierDatabase,/u,
  );
  assert.match(indexSource, /await applicationObjectBarrierDatabase\.end\(\)/u);
});

test("the production project-smoke cleanup holds the shared lease around direct object deletes", () => {
  const source = readFileSync(join(repositoryRoot, "scripts", "live-smoke-projects.js"), "utf8");
  const acquireAt = source.indexOf("const mutationLease = await acquireApplicationObjectMutationLease(pool)");
  const deleteAt = source.indexOf("s3Client.send(new DeleteObjectCommand", acquireAt);
  const releaseAt = source.indexOf("await mutationLease.release()", deleteAt);
  assert.ok(acquireAt > 0);
  assert.ok(deleteAt > acquireAt);
  assert.ok(releaseAt > deleteAt);
});
