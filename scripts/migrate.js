import "dotenv/config";

import { createDatabasePool } from "../server/database-pool.js";
import { migrateUp, migrationStatus, rollbackLatest } from "../server/migrations.js";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exitCode = 1;
} else {
  const pool = createDatabasePool({ role: "migrate" });

  const command = process.argv[2] ?? "up";
  try {
    const result = command === "status"
      ? await migrationStatus(pool)
      : command === "down"
        ? await rollbackLatest(pool)
        : command === "up"
          ? await migrateUp(pool)
          : null;

    if (!result) throw new Error(`Unknown migration command: ${command}`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
