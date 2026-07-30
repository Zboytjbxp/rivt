import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  assertDifferentDatabases,
  backupEncryptionSecret,
  decryptSnapshot,
  diffCounts,
  encryptionKeyFromSecret,
  encryptionKeyIdFromSecret,
  encryptSnapshot,
  orderedTables,
  previousBackupEncryptionSecret,
} from "../scripts/logical-backup-utils.js";

const snapshot = {
  format: "rivt-logical-backup-v1",
  createdAt: "2026-06-20T00:00:00.000Z",
  sourceCommit: "abc1234",
  manifest: {
    format: "rivt-logical-backup-manifest-v1",
    counts: { accounts: 1 },
    tableCount: 1,
    rowCount: 1,
  },
  sequences: [],
  tables: [{
    name: "accounts",
    columns: [{ name: "id", identityGeneration: null }],
    rows: [{ id: "acct-1" }],
  }],
};

function legacyEncryptedSnapshot(value, secret) {
  const key = encryptionKeyFromSecret(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(gzipSync(Buffer.from(JSON.stringify(value)))),
    cipher.final(),
  ]);
  return {
    format: "rivt-encrypted-logical-backup-v1",
    algorithm: "aes-256-gcm",
    compression: "gzip",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function keyedAuthenticatedPayload(payload, secret) {
  const key = encryptionKeyFromSecret(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  return {
    format: "rivt-encrypted-logical-backup-v1",
    algorithm: "aes-256-gcm",
    compression: "gzip",
    keyId: encryptionKeyIdFromSecret(secret),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptLikePreRotationCode(envelope, secret) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKeyFromSecret(secret),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const compressed = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(gunzipSync(compressed).toString("utf8"));
}

test("logical backup encryption round trips without exposing plaintext or key material", () => {
  const encrypted = encryptSnapshot(snapshot, "test-secret");
  assert.equal(encrypted.format, "rivt-encrypted-logical-backup-v1");
  assert.match(encrypted.keyId, /^[a-f0-9]{32}$/);
  assert.equal(JSON.stringify(encrypted).includes("acct-1"), false);
  assert.equal(JSON.stringify(encrypted).includes("test-secret"), false);
  assert.deepEqual(decryptSnapshot(encrypted, "test-secret"), snapshot);
  assert.deepEqual(decryptLikePreRotationCode(encrypted, "test-secret"), snapshot);
});

test("keyed backup restores with the configured previous key after rotation", () => {
  const encrypted = encryptSnapshot(snapshot, "previous-secret");
  assert.deepEqual(
    decryptSnapshot(encrypted, {
      active: "active-secret",
      previous: "previous-secret",
    }),
    snapshot,
  );
});

test("legacy backup tries the active key then the previous key", () => {
  const encrypted = legacyEncryptedSnapshot(snapshot, "previous-secret");
  assert.deepEqual(
    decryptSnapshot(encrypted, {
      active: "active-secret",
      previous: "previous-secret",
    }),
    snapshot,
  );
});

test("keyed backup fails closed for an unknown or tampered key identifier", () => {
  const encrypted = encryptSnapshot(snapshot, "active-secret");
  assert.throws(
    () => decryptSnapshot(encrypted, {
      active: "different-active-secret",
      previous: "different-previous-secret",
    }),
    /Unable to decrypt backup/,
  );

  const tampered = {
    ...encrypted,
    keyId: encryptSnapshot(snapshot, "different-previous-secret").keyId,
  };
  assert.throws(
    () => decryptSnapshot(tampered, {
      active: "active-secret",
      previous: "different-previous-secret",
    }),
    /Unable to decrypt backup/,
  );
});

test("authenticated payload corruption is not misreported as a key mismatch", () => {
  const encrypted = keyedAuthenticatedPayload(Buffer.from("not-a-gzip-payload"), "active-secret");
  assert.throws(
    () => decryptSnapshot(encrypted, "active-secret"),
    (error) => {
      assert.equal(error.message.includes("configured encryption keys"), false);
      return true;
    },
  );
});

test("restore key rotation reads the configured previous-key alias without exposing it", () => {
  const originalPrimary = process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS;
  const originalAlias = process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS;
  delete process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS;
  process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS = "previous-secret";
  try {
    assert.equal(previousBackupEncryptionSecret(), "previous-secret");
  } finally {
    if (originalPrimary === undefined) delete process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS;
    else process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS = originalPrimary;
    if (originalAlias === undefined) delete process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS;
    else process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS = originalAlias;
  }
});

test("backup key aliases ignore blank higher-priority variables", () => {
  const names = [
    "BACKUP_ENCRYPTION_KEY",
    "RIVT_BACKUP_ENCRYPTION_KEY",
    "BACKUP_SECRET",
    "BACKUP_ENCRYPTION_KEY_PREVIOUS",
    "RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS",
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.BACKUP_ENCRYPTION_KEY = " ";
  process.env.RIVT_BACKUP_ENCRYPTION_KEY = "active-alias";
  process.env.BACKUP_SECRET = "legacy-alias";
  process.env.BACKUP_ENCRYPTION_KEY_PREVIOUS = "";
  process.env.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS = "previous-alias";
  try {
    assert.equal(backupEncryptionSecret(), "active-alias");
    assert.equal(previousBackupEncryptionSecret(), "previous-alias");
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

test("logical backup restore count diff reports only mismatches", () => {
  assert.deepEqual(diffCounts({ accounts: 2, jobs: 1 }, { accounts: 2, jobs: 0 }), [
    { tableName: "jobs", expected: 1, actual: 0, delta: -1 },
  ]);
});

test("logical restore ordering sorts foreign-key dependencies before dependents", () => {
  assert.deepEqual(
    orderedTables(["job_applications", "jobs", "accounts"], [
      { tableName: "jobs", referencedTableName: "accounts" },
      { tableName: "job_applications", referencedTableName: "jobs" },
    ]),
    ["accounts", "jobs", "job_applications"],
  );
});

test("logical backup restore refuses matching database identities", () => {
  const databaseUrl = "postgresql://user:password@example.test:5432/rivt";
  assert.throws(
    () => assertDifferentDatabases(databaseUrl, databaseUrl),
    /must not match/,
  );
  assert.throws(
    () => assertDifferentDatabases(
      "postgresql://user:password@example.test:5432/rivt",
      "postgresql://user:other@example.test:5432/rivt",
    ),
    /identities match/,
  );
});
