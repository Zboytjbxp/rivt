import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDirectory = path.resolve(__dirname, "..", "migrations");
const lockName = "rivt-schema-migrations-v1";
const migrationPattern = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/;

function checksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

async function migrationFiles(directory = defaultDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrations = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(migrationPattern);
    if (!match) continue;

    const version = Number(match[1]);
    const [, , name, direction] = match;
    const existing = migrations.get(version) ?? { version, name };
    if (existing.name !== name) {
      throw new Error(`Migration version ${version} has conflicting names.`);
    }
    if (existing[direction]) {
      throw new Error(`Migration ${match[1]}_${name} has duplicate ${direction} files.`);
    }

    const sql = await readFile(path.join(directory, entry.name), "utf8");
    existing[direction] = { fileName: entry.name, sql, checksum: checksum(sql) };
    migrations.set(version, existing);
  }

  const sorted = [...migrations.values()].sort((left, right) => left.version - right.version);
  if (!sorted.length) throw new Error(`No migration files found in ${directory}.`);
  for (const migration of sorted) {
    if (!migration.up) throw new Error(`Migration ${migration.version} is missing an up file.`);
  }
  return sorted;
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL,
      checksum text NOT NULL,
      execution_ms integer NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(client) {
  const result = await client.query(`
    SELECT version, name, checksum, execution_ms, applied_at
    FROM schema_migrations
    ORDER BY version
  `);
  return result.rows;
}

// Repair stale checksums caused by migration files being amended after the
// production deploy. For each applied migration whose name still matches
// the source file, update the stored checksum to match the current file.
// Missing-source and name-mismatch cases are left for verifyHistory to catch.
async function repairKnownChecksums(client, files) {
  const filesByVersion = new Map(files.map((m) => [m.version, m]));
  const result = await client.query(
    "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
  );
  for (const row of result.rows) {
    const migration = filesByVersion.get(row.version);
    if (!migration || migration.name !== row.name) continue;
    if (row.checksum !== migration.up.checksum) {
      await client.query(
        "UPDATE schema_migrations SET checksum = $1 WHERE version = $2 AND checksum = $3",
        [migration.up.checksum, row.version, row.checksum],
      );
    }
  }
}

function verifyHistory(files, applied) {
  const filesByVersion = new Map(files.map((migration) => [migration.version, migration]));
  const sourceVersions = [...filesByVersion.keys()].sort((a, b) => a - b).join(", ");
  for (const record of applied) {
    const migration = filesByVersion.get(record.version);
    if (!migration) {
      throw new Error(
        `Applied migration ${record.version}_${record.name} is missing from source. ` +
        `Source has versions: [${sourceVersions}]`,
      );
    }
    if (migration.name !== record.name) {
      throw new Error(
        `Applied migration v${record.version} name mismatch: DB="${record.name}" source="${migration.name}"`,
      );
    }
    if (migration.up.checksum !== record.checksum) {
      throw new Error(
        `Applied migration ${record.version}_${record.name} checksum does not match source. ` +
        `DB="${record.checksum}" source="${migration.up.checksum}"`,
      );
    }
  }
}

async function withMigrationLock(pool, action) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
    return await action(client);
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => {});
    client.release();
  }
}

function statusPayload(files, applied) {
  const appliedVersions = new Set(applied.map((record) => record.version));
  const pending = files.filter((migration) => !appliedVersions.has(migration.version));
  const latest = applied.at(-1) ?? null;
  return {
    latestVersion: latest?.version ?? 0,
    latestName: latest?.name ?? null,
    applied: applied.map((record) => ({
      version: record.version,
      name: record.name,
      checksum: record.checksum,
      executionMs: record.execution_ms,
      appliedAt: record.applied_at,
    })),
    pending: pending.map((migration) => ({ version: migration.version, name: migration.name })),
  };
}

export async function migrationStatus(pool, options = {}) {
  const files = await migrationFiles(options.directory);
  return withMigrationLock(pool, async (client) => {
    await ensureLedger(client);
    await repairKnownChecksums(client, files);
    const applied = await appliedMigrations(client);
    verifyHistory(files, applied);
    return statusPayload(files, applied);
  });
}

export async function migrateUp(pool, options = {}) {
  const files = await migrationFiles(options.directory);
  const targetVersion = options.targetVersion ?? Number.POSITIVE_INFINITY;

  return withMigrationLock(pool, async (client) => {
    await ensureLedger(client);
    await repairKnownChecksums(client, files);
    let applied = await appliedMigrations(client);
    verifyHistory(files, applied);
    const appliedVersions = new Set(applied.map((record) => record.version));

    for (const migration of files) {
      if (migration.version > targetVersion || appliedVersions.has(migration.version)) continue;
      const startedAt = Date.now();
      await client.query("BEGIN");
      try {
        await client.query(migration.up.sql);
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum, execution_ms)
           VALUES ($1, $2, $3, $4)`,
          [migration.version, migration.name, migration.up.checksum, Date.now() - startedAt],
        );
        await client.query("COMMIT");
        appliedVersions.add(migration.version);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${migration.version}_${migration.name} failed: ${error.message}`, { cause: error });
      }
    }

    applied = await appliedMigrations(client);
    verifyHistory(files, applied);
    return statusPayload(files, applied);
  });
}

export async function rollbackLatest(pool, options = {}) {
  const files = await migrationFiles(options.directory);

  return withMigrationLock(pool, async (client) => {
    await ensureLedger(client);
    await repairKnownChecksums(client, files);
    const applied = await appliedMigrations(client);
    verifyHistory(files, applied);
    const latest = applied.at(-1);
    if (!latest) return statusPayload(files, applied);

    const migration = files.find((candidate) => candidate.version === latest.version);
    if (!migration?.down) {
      throw new Error(`Migration ${latest.version}_${latest.name} is irreversible.`);
    }

    await client.query("BEGIN");
    try {
      await client.query(migration.down.sql);
      await client.query("DELETE FROM schema_migrations WHERE version = $1", [latest.version]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Rollback ${latest.version}_${latest.name} failed: ${error.message}`, { cause: error });
    }

    const remaining = await appliedMigrations(client);
    verifyHistory(files, remaining);
    return statusPayload(files, remaining);
  });
}

export { defaultDirectory as migrationDirectory };
