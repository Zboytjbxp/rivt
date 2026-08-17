import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptSnapshot,
  sha256Hex,
  snapshotTableDigests,
} from "../scripts/logical-backup-utils.js";
import {
  buildDatabaseRecoveryBinding,
  recoveryDatabaseEncryptionSecret,
} from "../scripts/recovery-object-utils.js";
import {
  captureCompleteRecoveryDatabaseSnapshot,
  cleanupCompleteRecoveryDatabaseTarget,
  completeRecoveryDatabaseIdentitySha256,
  encryptCompleteRecoveryDatabaseSnapshot,
  resolveCompleteRecoveryDatabaseObjectReferences,
  restoreCompleteRecoveryDatabaseSnapshot,
} from "../scripts/complete-recovery-database.js";

const createdAt = "2026-08-16T20:00:00.000Z";
const sourceCommit = "a".repeat(40);
const columns = [{ name: "id", typeName: "bigint", identityGeneration: "BY DEFAULT" }];
const sourceRuntimeIdentity = Object.freeze({
  systemIdentifier: "7612345678901234567",
  databaseOid: "16384",
  databaseName: "rivt",
});
const sourceRuntimeIdentitySha256 = completeRecoveryDatabaseIdentitySha256(sourceRuntimeIdentity);

function validSnapshot() {
  const tables = [{ name: "accounts", columns, rows: [{ id: "1" }] }];
  return {
    format: "rivt-logical-backup-v2",
    rowEncoding: "postgres-text-v1",
    createdAt,
    sourceCommit,
    manifest: {
      format: "rivt-logical-backup-manifest-v2",
      rowEncoding: "postgres-text-v1",
      createdAt,
      sourceCommit,
      tableCount: 1,
      rowCount: 1,
      counts: { accounts: 1 },
      tableDigests: snapshotTableDigests(tables),
    },
    sequences: [{ sequenceName: "accounts_id_seq", lastValue: "1", isCalled: true }],
    tables,
  };
}

function validEncryptableSnapshot() {
  const snapshot = validSnapshot();
  const uploads = {
    name: "uploads",
    columns: [{ name: "id", typeName: "text", identityGeneration: null }],
    rows: [],
  };
  const tables = [...snapshot.tables, uploads];
  return {
    ...snapshot,
    manifest: {
      ...snapshot.manifest,
      tableCount: tables.length,
      counts: { ...snapshot.manifest.counts, uploads: 0 },
      tableDigests: snapshotTableDigests(tables),
    },
    tables,
  };
}

function fakePool(label, lifecycle = []) {
  const client = {
    label,
    async query(sql) {
      lifecycle.push(`${label}:query:${sql}`);
      return { rows: [] };
    },
    release() {
      lifecycle.push(`${label}:release`);
    },
  };
  return {
    label,
    async connect() {
      lifecycle.push(`${label}:connect`);
      return client;
    },
    async end() {
      lifecycle.push(`${label}:end`);
    },
  };
}

test("capture returns one lossless read-only v2 snapshot without any provider dependency", async () => {
  const lifecycle = [];
  const pool = fakePool("source", lifecycle);
  const rows = [{ id: "1" }];
  const snapshot = await captureCompleteRecoveryDatabaseSnapshot({
    env: {
      BACKUP_DATABASE_URL: "postgresql://reader:secret@source.example.test/rivt",
      SOURCE_COMMIT: sourceCommit,
    },
    now: () => new Date(createdAt),
    expectedSourceRuntimeIdentitySha256: sourceRuntimeIdentitySha256,
    poolFactory(url) {
      assert.equal(url, "postgresql://reader:secret@source.example.test/rivt");
      return pool;
    },
    operations: {
      async runtimeDatabaseIdentity(client) {
        assert.equal(client.label, "source");
        lifecycle.push("guard:runtime-identity");
        return sourceRuntimeIdentity;
      },
      async acquireLogicalBackupLock(client) {
        assert.equal(client.label, "source");
        lifecycle.push("guard:advisory-lock");
      },
      async beginReadOnlyBackupSnapshot() {
        lifecycle.push("guard:repeatable-read-read-only");
      },
      async assertBackupDatabaseRoleReadOnly() {
        lifecycle.push("guard:read-only-role");
      },
      async assertBackupCatalogComplete() {
        lifecycle.push("guard:catalog-complete");
      },
      async publicTables() { return ["accounts"]; },
      async countTableRows() { return { accounts: 1 }; },
      async tableColumns(_client, tableName) {
        assert.equal(tableName, "accounts");
        return columns;
      },
      async rowsForTable(_client, tableName, suppliedColumns) {
        assert.equal(tableName, "accounts");
        assert.equal(suppliedColumns, columns);
        return rows;
      },
      async sequenceStates() {
        return [{ sequenceName: "accounts_id_seq", lastValue: "1", isCalled: true }];
      },
    },
  });

  assert.equal(snapshot.format, "rivt-logical-backup-v2");
  assert.equal(snapshot.rowEncoding, "postgres-text-v1");
  assert.equal(snapshot.createdAt, createdAt);
  assert.equal(snapshot.sourceCommit, sourceCommit);
  assert.deepEqual(snapshot.tables, [{ name: "accounts", columns, rows }]);
  assert.deepEqual(snapshot.manifest.counts, { accounts: 1 });
  assert.deepEqual(snapshot.manifest.tableDigests, snapshotTableDigests(snapshot.tables));
  assert.deepEqual(lifecycle.slice(1, 6), [
    "guard:runtime-identity",
    "guard:advisory-lock",
    "guard:repeatable-read-read-only",
    "guard:read-only-role",
    "guard:catalog-complete",
  ]);
  assert.ok(lifecycle.includes("source:query:COMMIT"));
  assert.equal(lifecycle.includes("source:query:ROLLBACK"), false);
  assert.deepEqual(lifecycle.slice(-2), ["source:release", "source:end"]);
});

test("capture rolls back and closes its database session when a catalog read fails", async () => {
  const lifecycle = [];
  const pool = fakePool("source", lifecycle);
  await assert.rejects(
    () => captureCompleteRecoveryDatabaseSnapshot({
      env: {
        BACKUP_DATABASE_URL: "postgresql://reader:secret@source.example.test/rivt",
        SOURCE_COMMIT: sourceCommit,
      },
      now: () => new Date(createdAt),
      expectedSourceRuntimeIdentitySha256: sourceRuntimeIdentitySha256,
      poolFactory: () => pool,
      operations: {
        async runtimeDatabaseIdentity() { return sourceRuntimeIdentity; },
        async acquireLogicalBackupLock() {},
        async beginReadOnlyBackupSnapshot() {},
        async assertBackupDatabaseRoleReadOnly() {},
        async assertBackupCatalogComplete() {},
        async publicTables() { throw new Error("simulated catalog failure"); },
        async countTableRows() { throw new Error("must not run"); },
        async tableColumns() { throw new Error("must not run"); },
        async rowsForTable() { throw new Error("must not run"); },
        async sequenceStates() { throw new Error("must not run"); },
      },
    }),
    /simulated catalog failure/,
  );
  assert.ok(lifecycle.includes("source:query:ROLLBACK"));
  assert.deepEqual(lifecycle.slice(-2), ["source:release", "source:end"]);
});

test("capture rejects a lease/snapshot runtime database mismatch before any catalog read", async () => {
  const lifecycle = [];
  const pool = fakePool("source", lifecycle);
  await assert.rejects(
    () => captureCompleteRecoveryDatabaseSnapshot({
      env: {
        BACKUP_DATABASE_URL: "postgresql://reader:secret@source.example.test/rivt",
        SOURCE_COMMIT: sourceCommit,
      },
      now: () => new Date(createdAt),
      expectedSourceRuntimeIdentitySha256: sourceRuntimeIdentitySha256,
      poolFactory: () => pool,
      operations: {
        async runtimeDatabaseIdentity() {
          lifecycle.push("guard:runtime-identity");
          return { ...sourceRuntimeIdentity, databaseOid: "16385", databaseName: "other_rivt" };
        },
        async acquireLogicalBackupLock() { lifecycle.push("must-not-lock"); },
        async beginReadOnlyBackupSnapshot() { lifecycle.push("must-not-begin"); },
        async assertBackupDatabaseRoleReadOnly() { lifecycle.push("must-not-read-role"); },
        async assertBackupCatalogComplete() { lifecycle.push("must-not-read-catalog"); },
        async publicTables() { lifecycle.push("must-not-read-tables"); return []; },
        async countTableRows() { return {}; },
        async tableColumns() { return []; },
        async rowsForTable() { return []; },
        async sequenceStates() { return []; },
      },
    }),
    (error) => error.code === "RECOVERY_SOURCE_DATABASE_IDENTITY_MISMATCH",
  );
  assert.equal(lifecycle.some((event) => event.startsWith("must-not-")), false);
  assert.deepEqual(lifecycle.slice(-2), ["source:release", "source:end"]);
});

test("strict active-key encryption returns the exact authenticated JSON bytes", () => {
  const snapshot = validEncryptableSnapshot();
  const activeKey = "11".repeat(32);
  const result = encryptCompleteRecoveryDatabaseSnapshot(snapshot, activeKey);
  const databaseSecret = recoveryDatabaseEncryptionSecret(
    activeKey,
    buildDatabaseRecoveryBinding(snapshot),
  );
  assert.equal(result.encryptionKeyMode, "active-only");
  assert.equal(result.envelope.format, "rivt-encrypted-logical-backup-v2");
  assert.equal(result.bytes.equals(Buffer.from(JSON.stringify(result.envelope), "utf8")), true);
  assert.equal(result.byteLength, result.bytes.length);
  assert.equal(result.sha256, sha256Hex(result.bytes));
  assert.deepEqual(decryptSnapshot(JSON.parse(result.bytes.toString("utf8")), databaseSecret), snapshot);
  assert.throws(
    () => decryptSnapshot(JSON.parse(result.bytes.toString("utf8")), activeKey),
    /Unable to decrypt/u,
  );
  assert.throws(
    () => encryptCompleteRecoveryDatabaseSnapshot(snapshot, "human-memorable-passphrase"),
    (error) => error.code === "BACKUP_CONFIG_INVALID",
  );
  const padded = encryptCompleteRecoveryDatabaseSnapshot(snapshot, `  ${activeKey}\n`);
  assert.deepEqual(decryptSnapshot(padded.envelope, databaseSecret), snapshot);
});

function successfulRestoreFixture({ lifecycle = [], operationOverrides = {} } = {}) {
  const snapshot = validSnapshot();
  const sourceUrl = "postgresql://reader:secret@source.example.test/rivt";
  const targetUrl = "postgresql://restore:secret@restore.example.test/rivt_restore";
  const sourcePool = fakePool("source", lifecycle);
  const targetPool = fakePool("target", lifecycle);
  let applied = false;
  let countReadCount = 0;
  let sequenceReadCount = 0;
  const expectedDigests = snapshotTableDigests(snapshot.tables);
  const operations = {
    async runtimeDatabaseIdentity(client) {
      lifecycle.push(`guard:identity:${client.label}`);
      return client.label === "source"
        ? { systemIdentifier: "100", databaseOid: "10", databaseName: "rivt" }
        : { systemIdentifier: "200", databaseOid: "20", databaseName: "rivt_restore" };
    },
    async assertBackupCatalogComplete() { lifecycle.push("guard:catalog"); },
    async configureCanonicalTextSession() { lifecycle.push("guard:canonical-session"); },
    async publicTables() { lifecycle.push("guard:tables"); return ["accounts"]; },
    async tableColumns() { lifecycle.push("guard:columns"); return columns; },
    async sequenceStates() {
      sequenceReadCount += 1;
      lifecycle.push(sequenceReadCount === 1 ? "guard:sequences" : "verify:sequences");
      return snapshot.sequences;
    },
    async foreignKeyDependencies() { lifecycle.push("guard:dependencies"); return []; },
    orderedTables(tableNames) { lifecycle.push("guard:copy-order"); return tableNames; },
    async applySnapshotToTarget(_client, input) {
      lifecycle.push("mutation:transactional-apply");
      assert.deepEqual(input.copyOrder, ["accounts"]);
      assert.deepEqual(input.snapshotTables.get("accounts"), snapshot.tables[0]);
      assert.deepEqual(input.sequences, snapshot.sequences);
      applied = true;
    },
    async countTableRows() {
      countReadCount += 1;
      if (!applied) {
        lifecycle.push("guard:empty-counts");
        return { accounts: 0 };
      }
      lifecycle.push("verify:counts");
      return { accounts: 1 };
    },
    async databaseTableDigests() {
      lifecycle.push("verify:digests");
      assert.equal(applied, true);
      return expectedDigests;
    },
    ...operationOverrides,
  };
  return {
    snapshot,
    sourceUrl,
    targetUrl,
    lifecycle,
    operations,
    poolFactory(url) {
      if (url === sourceUrl) return sourcePool;
      if (url === targetUrl) return targetPool;
      throw new Error("Unexpected database URL");
    },
    wasApplied() { return applied; },
  };
}

test("restore verifies isolation, exact schema, content, counts, and sequences around one transactional apply", async () => {
  const fixture = successfulRestoreFixture();
  const times = [1_000, 1_120, 1_150];
  const result = await restoreCompleteRecoveryDatabaseSnapshot({
    authenticatedSnapshot: fixture.snapshot,
    authenticatedArtifact: { createdAt, sourceCommit },
    authenticationMode: "active-key-only",
    sourceUrl: fixture.sourceUrl,
    targetUrl: fixture.targetUrl,
    confirmTargetIsolated: true,
    poolFactory: fixture.poolFactory,
    operations: fixture.operations,
    migrationStatusFn: async () => ({
      latestVersion: 42,
      applied: Array.from({ length: 42 }, (_, index) => ({ version: index + 1 })),
      pending: [],
    }),
    clock: () => times.shift(),
  });

  assert.equal(fixture.wasApplied(), true);
  assert.equal(result.ok, true);
  assert.equal(result.authenticationMode, "active-key-only");
  assert.equal(result.tableCount, 1);
  assert.equal(result.rowCount, 1);
  assert.equal(result.sequenceCount, 1);
  assert.equal(result.latestMigrationVersion, 42);
  assert.equal(result.restoreDurationMs, 120);
  assert.equal(result.verificationDurationMs, 30);
  assert.equal(result.durationMs, 150);
  assert.equal(result.countDiffCount, 0);
  assert.equal(result.contentDiffCount, 0);
  assert.equal(result.targetRuntimeIdentitySha256, completeRecoveryDatabaseIdentitySha256({
    systemIdentifier: "200",
    databaseOid: "20",
    databaseName: "rivt_restore",
  }));
  assert.equal("sourceUrl" in result, false);
  assert.equal("targetUrl" in result, false);
  assert.ok(
    fixture.lifecycle.indexOf("guard:empty-counts")
      < fixture.lifecycle.indexOf("mutation:transactional-apply"),
  );
  assert.ok(
    fixture.lifecycle.indexOf("guard:copy-order")
      < fixture.lifecycle.indexOf("mutation:transactional-apply"),
  );
  assert.ok(
    fixture.lifecycle.indexOf("mutation:transactional-apply")
      < fixture.lifecycle.indexOf("verify:counts"),
  );
});

test("restore cannot mutate a target before runtime isolation passes", async () => {
  const fixture = successfulRestoreFixture({
    operationOverrides: {
      async runtimeDatabaseIdentity() {
        return { systemIdentifier: "100", databaseOid: "10", databaseName: "same" };
      },
    },
  });
  await assert.rejects(
    () => restoreCompleteRecoveryDatabaseSnapshot({
      authenticatedSnapshot: fixture.snapshot,
      authenticatedArtifact: { createdAt, sourceCommit },
      authenticationMode: "active-key-only",
      sourceUrl: fixture.sourceUrl,
      targetUrl: fixture.targetUrl,
      confirmTargetIsolated: true,
      poolFactory: fixture.poolFactory,
      operations: fixture.operations,
      migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
    }),
    /same runtime PostgreSQL cluster/,
  );
  assert.equal(fixture.wasApplied(), false);
  assert.equal(fixture.lifecycle.includes("mutation:transactional-apply"), false);
});

test("restore cannot mutate a target before exact column and sequence guards pass", async (t) => {
  await t.test("column mismatch", async () => {
    const fixture = successfulRestoreFixture({
      operationOverrides: {
        async tableColumns() {
          return [{ name: "unexpected", typeName: "text", identityGeneration: null }];
        },
      },
    });
    await assert.rejects(
      () => restoreCompleteRecoveryDatabaseSnapshot({
        authenticatedSnapshot: fixture.snapshot,
        authenticatedArtifact: { createdAt, sourceCommit },
        authenticationMode: "active-key-only",
        sourceUrl: fixture.sourceUrl,
        targetUrl: fixture.targetUrl,
        confirmTargetIsolated: true,
        poolFactory: fixture.poolFactory,
        operations: fixture.operations,
        migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
      }),
      /columns differ/,
    );
    assert.equal(fixture.wasApplied(), false);
  });

  await t.test("sequence mismatch", async () => {
    const fixture = successfulRestoreFixture({
      operationOverrides: {
        async sequenceStates() { return []; },
      },
    });
    await assert.rejects(
      () => restoreCompleteRecoveryDatabaseSnapshot({
        authenticatedSnapshot: fixture.snapshot,
        authenticatedArtifact: { createdAt, sourceCommit },
        authenticationMode: "active-key-only",
        sourceUrl: fixture.sourceUrl,
        targetUrl: fixture.targetUrl,
        confirmTargetIsolated: true,
        poolFactory: fixture.poolFactory,
        operations: fixture.operations,
        migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
      }),
      /sequences differ/,
    );
    assert.equal(fixture.wasApplied(), false);
  });
});

test("optional migrations run only after runtime isolation and catalog scope checks", async () => {
  const lifecycle = [];
  let tableReadCount = 0;
  const fixture = successfulRestoreFixture({
    lifecycle,
    operationOverrides: {
      async publicTables() {
        tableReadCount += 1;
        lifecycle.push(tableReadCount === 1 ? "guard:fresh-empty-tables" : "guard:tables");
        return tableReadCount === 1 ? [] : ["accounts"];
      },
    },
  });
  const times = [1_000, 1_010, 1_020];
  await restoreCompleteRecoveryDatabaseSnapshot({
    authenticatedSnapshot: fixture.snapshot,
    authenticatedArtifact: { createdAt, sourceCommit },
    authenticationMode: "active-key-only",
    sourceUrl: fixture.sourceUrl,
    targetUrl: fixture.targetUrl,
    confirmTargetIsolated: true,
    applyMigrations: true,
    poolFactory: fixture.poolFactory,
    operations: fixture.operations,
    onTargetMutationAuthorized: () => { lifecycle.push("guard:mutation-authorized"); },
    migrateUpFn: async () => { lifecycle.push("mutation:migrations"); },
    migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
    clock: () => times.shift(),
  });
  assert.ok(lifecycle.indexOf("guard:identity:target") < lifecycle.indexOf("mutation:migrations"));
  assert.ok(lifecycle.indexOf("guard:fresh-empty-tables") < lifecycle.indexOf("mutation:migrations"));
  assert.ok(lifecycle.indexOf("guard:mutation-authorized") < lifecycle.indexOf("mutation:migrations"));
  assert.ok(lifecycle.indexOf("mutation:migrations") < lifecycle.indexOf("guard:tables"));
  assert.ok(lifecycle.indexOf("mutation:migrations") < lifecycle.indexOf("guard:catalog"));
});

test("restore rejects stale targets before migrations or snapshot application", async (t) => {
  await t.test("migrate-and-restore requires zero public tables", async () => {
    const lifecycle = [];
    const fixture = successfulRestoreFixture({ lifecycle });
    let migrations = 0;
    await assert.rejects(
      () => restoreCompleteRecoveryDatabaseSnapshot({
        authenticatedSnapshot: fixture.snapshot,
        authenticatedArtifact: { createdAt, sourceCommit },
        authenticationMode: "active-key-only",
        sourceUrl: fixture.sourceUrl,
        targetUrl: fixture.targetUrl,
        confirmTargetIsolated: true,
        applyMigrations: true,
        poolFactory: fixture.poolFactory,
        operations: fixture.operations,
        migrateUpFn: async () => { migrations += 1; },
        migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
      }),
      (error) => error.code === "RESTORE_TARGET_NOT_EMPTY",
    );
    assert.equal(migrations, 0);
    assert.equal(fixture.wasApplied(), false);
  });

  await t.test("schema-ready restore requires zero rows", async () => {
    const fixture = successfulRestoreFixture({
      operationOverrides: {
        async countTableRows() { return { accounts: 1 }; },
      },
    });
    await assert.rejects(
      () => restoreCompleteRecoveryDatabaseSnapshot({
        authenticatedSnapshot: fixture.snapshot,
        authenticatedArtifact: { createdAt, sourceCommit },
        authenticationMode: "active-key-only",
        sourceUrl: fixture.sourceUrl,
        targetUrl: fixture.targetUrl,
        confirmTargetIsolated: true,
        poolFactory: fixture.poolFactory,
        operations: fixture.operations,
        migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
      }),
      (error) => error.code === "RESTORE_TARGET_NOT_EMPTY",
    );
    assert.equal(fixture.wasApplied(), false);
  });

  await t.test("schema-ready restore requires counts for every exact table", async () => {
    const fixture = successfulRestoreFixture({
      operationOverrides: {
        async countTableRows() { return {}; },
      },
    });
    await assert.rejects(
      () => restoreCompleteRecoveryDatabaseSnapshot({
        authenticatedSnapshot: fixture.snapshot,
        authenticatedArtifact: { createdAt, sourceCommit },
        authenticationMode: "active-key-only",
        sourceUrl: fixture.sourceUrl,
        targetUrl: fixture.targetUrl,
        confirmTargetIsolated: true,
        poolFactory: fixture.poolFactory,
        operations: fixture.operations,
        migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
      }),
      (error) => error.code === "RESTORE_TARGET_NOT_EMPTY",
    );
    assert.equal(fixture.wasApplied(), false);
  });
});

test("restore runtime-isolates the target from every protected database", async () => {
  const fixture = successfulRestoreFixture();
  const productionUrl = "postgresql://production:secret@production.example.test/rivt";
  const productionPool = fakePool("production", fixture.lifecycle);
  await assert.rejects(
    () => restoreCompleteRecoveryDatabaseSnapshot({
      authenticatedSnapshot: fixture.snapshot,
      authenticatedArtifact: { createdAt, sourceCommit },
      authenticationMode: "active-key-only",
      sourceUrl: fixture.sourceUrl,
      protectedDatabaseUrls: [productionUrl],
      targetUrl: fixture.targetUrl,
      confirmTargetIsolated: true,
      poolFactory(url) {
        if (url === productionUrl) return productionPool;
        return fixture.poolFactory(url);
      },
      operations: {
        ...fixture.operations,
        async runtimeDatabaseIdentity(client) {
          if (client.label === "source") {
            return { systemIdentifier: "100", databaseOid: "10", databaseName: "rivt" };
          }
          return { systemIdentifier: "200", databaseOid: "20", databaseName: client.label };
        },
      },
      migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
    }),
    /same runtime PostgreSQL cluster/u,
  );
  assert.equal(fixture.wasApplied(), false);
});

test("restore rejects ambiguous key fallback and enforces the aggregate recovery RTO", async () => {
  const fixture = successfulRestoreFixture();
  await assert.rejects(
    () => restoreCompleteRecoveryDatabaseSnapshot({
      authenticatedSnapshot: fixture.snapshot,
      authenticatedArtifact: { createdAt, sourceCommit },
      authenticationMode: "active-or-previous",
      sourceUrl: fixture.sourceUrl,
      targetUrl: fixture.targetUrl,
      confirmTargetIsolated: true,
      poolFactory: fixture.poolFactory,
      operations: fixture.operations,
    }),
    /active backup key only/,
  );

  const slowFixture = successfulRestoreFixture();
  const times = [0, 60_000, 120_001];
  await assert.rejects(
    () => restoreCompleteRecoveryDatabaseSnapshot({
      authenticatedSnapshot: slowFixture.snapshot,
      authenticatedArtifact: { createdAt, sourceCommit },
      authenticationMode: "active-key-only",
      sourceUrl: slowFixture.sourceUrl,
      targetUrl: slowFixture.targetUrl,
      confirmTargetIsolated: true,
      rtoMinutes: 2,
      poolFactory: slowFixture.poolFactory,
      operations: slowFixture.operations,
      migrationStatusFn: async () => ({ latestVersion: 42, applied: [], pending: [] }),
      clock: () => times.shift(),
    }),
    (error) => error.code === "BACKUP_RTO_EXCEEDED",
  );
});

test("isolated database cleanup repeats runtime separation and removes all public state", async () => {
  const lifecycle = [];
  const sourcePool = fakePool("source", lifecycle);
  const targetPool = fakePool("target", lifecycle);
  const targetIdentity = { systemIdentifier: "200", databaseOid: "20", databaseName: "rivt_restore" };
  const expectedTargetRuntimeIdentitySha256 = completeRecoveryDatabaseIdentitySha256(targetIdentity);
  const receipt = await cleanupCompleteRecoveryDatabaseTarget({
    sourceUrl: "postgresql://reader:secret@source.example.test/rivt",
    targetUrl: "postgresql://restore:secret@restore.example.test/rivt_restore",
    confirmTargetIsolated: true,
    confirmTemporaryDataDeletion: true,
    expectedTargetRuntimeIdentitySha256,
    poolFactory: (url) => (url.includes("source.example") ? sourcePool : targetPool),
    operations: {
      async runtimeDatabaseIdentity(client) {
        return client.label === "source"
          ? { systemIdentifier: "100", databaseOid: "10", databaseName: "rivt" }
          : targetIdentity;
      },
      async publicTables() { return []; },
      async sequenceStates() { return []; },
    },
  });
  assert.equal(receipt.targetDatabaseCleaned, true);
  assert.equal(receipt.targetRuntimeIdentitySha256, expectedTargetRuntimeIdentitySha256);
  assert.ok(lifecycle.includes("target:query:BEGIN"));
  assert.ok(lifecycle.includes("target:query:DROP SCHEMA public CASCADE"));
  assert.ok(lifecycle.includes("target:query:CREATE SCHEMA public"));
  assert.ok(lifecycle.includes("target:query:COMMIT"));

  await assert.rejects(
    () => cleanupCompleteRecoveryDatabaseTarget({
      sourceUrl: "postgresql://same.example.test/rivt",
      targetUrl: "postgresql://same.example.test/rivt",
      confirmTargetIsolated: true,
      confirmTemporaryDataDeletion: true,
    }),
    /must not match/u,
  );
});

test("isolated database cleanup rejects a changed runtime target before mutation", async () => {
  const lifecycle = [];
  const sourcePool = fakePool("source", lifecycle);
  const targetPool = fakePool("target", lifecycle);
  await assert.rejects(
    () => cleanupCompleteRecoveryDatabaseTarget({
      sourceUrl: "postgresql://reader:secret@source.example.test/rivt",
      targetUrl: "postgresql://restore:secret@restore.example.test/rivt_restore",
      confirmTargetIsolated: true,
      confirmTemporaryDataDeletion: true,
      expectedTargetRuntimeIdentitySha256: completeRecoveryDatabaseIdentitySha256({
        systemIdentifier: "999",
        databaseOid: "99",
        databaseName: "different_restore",
      }),
      poolFactory: (url) => (url.includes("source.example") ? sourcePool : targetPool),
      operations: {
        async runtimeDatabaseIdentity(client) {
          return client.label === "source"
            ? { systemIdentifier: "100", databaseOid: "10", databaseName: "rivt" }
            : { systemIdentifier: "200", databaseOid: "20", databaseName: "rivt_restore" };
        },
        async publicTables() { return []; },
        async sequenceStates() { return []; },
      },
    }),
    /runtime database identity changed/u,
  );
  assert.equal(lifecycle.some((entry) => entry.includes("query:BEGIN")), false);
  assert.equal(lifecycle.some((entry) => entry.includes("DROP SCHEMA")), false);
});

test("restored object references are read from the identity-bound target transaction", async () => {
  const lifecycle = [];
  const targetPool = fakePool("target", lifecycle);
  const identity = { systemIdentifier: "200", databaseOid: "20", databaseName: "rivt_restore" };
  let referenceReads = 0;
  const references = await resolveCompleteRecoveryDatabaseObjectReferences({
    targetUrl: "postgresql://restore:secret@restore.example.test/rivt_restore",
    expectedTargetRuntimeIdentitySha256: completeRecoveryDatabaseIdentitySha256(identity),
    confirmTargetIsolated: true,
    poolFactory: () => targetPool,
    operations: {
      async runtimeDatabaseIdentity() { return identity; },
      async storedUploadReferences() {
        referenceReads += 1;
        return [
          {
            upload_id: "00000000-0000-4000-8000-000000000001",
            owner_account_id: "10000000-0000-4000-8000-000000000001",
            source_key: " project/cafe\u0301 photo.bin ",
            storage_scope: "project",
          },
          {
            upload_id: "00000000-0000-4000-8000-000000000002",
            owner_account_id: "10000000-0000-4000-8000-000000000001",
            source_key: "album/cover.bin",
            storage_scope: "album",
          },
        ];
      },
    },
  });
  assert.deepEqual(references, [
    {
      uploadId: "00000000-0000-4000-8000-000000000001",
      ownerAccountId: "10000000-0000-4000-8000-000000000001",
      sourceKey: " project/cafe\u0301 photo.bin ",
      storageScope: "project",
    },
    {
      uploadId: "00000000-0000-4000-8000-000000000002",
      ownerAccountId: "10000000-0000-4000-8000-000000000001",
      sourceKey: "album/cover.bin",
      storageScope: "album",
    },
  ]);
  assert.equal(referenceReads, 1);
  assert.ok(lifecycle.includes("target:query:BEGIN READ ONLY"));
  assert.ok(lifecycle.includes("target:query:COMMIT"));
  assert.equal(lifecycle.includes("target:query:ROLLBACK"), false);
});

test("restored reference reads reject invalid route identities and duplicate scopes", async () => {
  const identity = { systemIdentifier: "200", databaseOid: "20", databaseName: "rivt_restore" };
  const common = {
    targetUrl: "postgresql://restore:secret@restore.example.test/rivt_restore",
    expectedTargetRuntimeIdentitySha256: completeRecoveryDatabaseIdentitySha256(identity),
    confirmTargetIsolated: true,
    poolFactory: () => fakePool("target"),
  };
  await assert.rejects(
    () => resolveCompleteRecoveryDatabaseObjectReferences({
      ...common,
      operations: {
        async runtimeDatabaseIdentity() { return identity; },
        async storedUploadReferences() {
          return [{
            upload_id: "not-a-uuid",
            owner_account_id: "10000000-0000-4000-8000-000000000001",
            source_key: "project/photo.bin",
            storage_scope: "project",
          }];
        },
      },
    }),
    /reference is invalid/u,
  );
  await assert.rejects(
    () => resolveCompleteRecoveryDatabaseObjectReferences({
      ...common,
      operations: {
        async runtimeDatabaseIdentity() { return identity; },
        async storedUploadReferences() {
          return [1, 2].map((suffix) => ({
            upload_id: `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`,
            owner_account_id: "10000000-0000-4000-8000-000000000001",
            source_key: `project/photo-${suffix}.bin`,
            storage_scope: "project",
          }));
        },
      },
    }),
    /more than one representative/u,
  );
});

test("restored reference reads reject a changed runtime target before querying uploads", async () => {
  const lifecycle = [];
  const targetPool = fakePool("target", lifecycle);
  let referenceReads = 0;
  await assert.rejects(
    () => resolveCompleteRecoveryDatabaseObjectReferences({
      targetUrl: "postgresql://restore:secret@restore.example.test/rivt_restore",
      expectedTargetRuntimeIdentitySha256: completeRecoveryDatabaseIdentitySha256({
        systemIdentifier: "999",
        databaseOid: "99",
        databaseName: "expected_restore",
      }),
      confirmTargetIsolated: true,
      poolFactory: () => targetPool,
      operations: {
        async runtimeDatabaseIdentity() {
          return { systemIdentifier: "200", databaseOid: "20", databaseName: "rivt_restore" };
        },
        async storedUploadReferences() { referenceReads += 1; return []; },
      },
    }),
    /runtime database identity changed/u,
  );
  assert.equal(referenceReads, 0);
  assert.ok(lifecycle.includes("target:query:BEGIN READ ONLY"));
  assert.ok(lifecycle.includes("target:query:ROLLBACK"));
});
