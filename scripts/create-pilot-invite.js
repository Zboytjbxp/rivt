import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

function readArgument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : "";
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  fail("DATABASE_URL is required.");
} else {
  const requestedCode = readArgument("code");
  const updateMaxUsesArgument = readArgument("update-max-uses");
  const email = readArgument("email").toLowerCase();
  const role = readArgument("role");
  const days = Number.parseInt(readArgument("days") || "14", 10);
  const maxUses = Number.parseInt(readArgument("max-uses") || "1", 10);
  const updateMaxUses = Number.parseInt(updateMaxUsesArgument || "0", 10);

  if (requestedCode && !/^[A-Za-z0-9_-]{5,64}$/.test(requestedCode)) {
    fail("--code must be 5-64 characters using letters, numbers, underscores, or hyphens.");
  } else if (updateMaxUsesArgument && !requestedCode) {
    fail("--update-max-uses requires --code.");
  } else if (updateMaxUsesArgument && (!Number.isInteger(updateMaxUses) || updateMaxUses < 1 || updateMaxUses > 5000)) {
    fail("--update-max-uses must be an integer between 1 and 5000.");
  } else if (role && !["contractor", "tradesperson"].includes(role)) {
    fail("--role must be contractor or tradesperson.");
  } else if (!Number.isInteger(days) || days < 1 || days > 90) {
    fail("--days must be an integer between 1 and 90.");
  } else if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 5000) {
    fail("--max-uses must be an integer between 1 and 5000.");
  } else {
    const rawCode = requestedCode || `rivt_${randomBytes(24).toString("base64url")}`;
    const sha256 = (value) => createHash("sha256").update(value).digest("hex");
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    });
    try {
      if (updateMaxUsesArgument) {
        const result = await pool.query(
          `UPDATE signup_invites
           SET max_uses = GREATEST(max_uses, $1)
           WHERE code_hash = $2 AND revoked_at IS NULL
           RETURNING id, allowed_role, max_uses, use_count, expires_at, revoked_at`,
          [updateMaxUses, sha256(rawCode)],
        );
        const invite = result.rows[0];
        if (!invite) {
          fail("No active invite found for that code.");
        } else {
          console.log(JSON.stringify({
            code: rawCode,
            inviteId: invite.id,
            role: invite.allowed_role,
            maxUses: invite.max_uses,
            useCount: invite.use_count,
            expiresAt: invite.expires_at,
            revokedAt: invite.revoked_at,
          }, null, 2));
        }
      } else {
        const result = await pool.query(
          `INSERT INTO signup_invites (code_hash, email_hash, allowed_role, max_uses, expires_at)
           VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 day'))
           RETURNING id, allowed_role, max_uses, expires_at`,
          [sha256(rawCode), email ? sha256(email) : null, role || null, maxUses, days],
        );
        const invite = result.rows[0];
        console.log(JSON.stringify({
          code: rawCode,
          inviteId: invite.id,
          email: email || null,
          role: invite.allowed_role,
          maxUses: invite.max_uses,
          expiresAt: invite.expires_at,
        }, null, 2));
        console.error("Store the code securely. RIVT only stores its hash and cannot display it again.");
      }
    } finally {
      await pool.end();
    }
  }
}
