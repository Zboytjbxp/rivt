import "dotenv/config";
import { pathToFileURL } from "node:url";
import pg from "pg";

function bool(name) {
  return process.env[name]?.trim() === "true";
}

function pilotIds() {
  return [...new Set(
    String(process.env.STRIPE_CONNECT_ACH_PILOT_ACCOUNT_IDS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)),
  )];
}

export function evaluatePilotConfiguration() {
  const pilots = pilotIds();
  const enabled = bool("STRIPE_CONNECT_ACH_ENABLED");
  const openEnrollment = bool("STRIPE_CONNECT_ACH_ALLOW_ALL");
  const checks = {
    featureEnabled: enabled,
    secretKeyPresent: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    webhookSecretPresent: Boolean(process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim()),
    controlledRollout: !openEnrollment,
    pilotAccountsConfigured: pilots.length > 0,
  };
  return {
    checks,
    pilotAccountCount: pilots.length,
    rolloutMode: !enabled ? "disabled" : openEnrollment ? "open" : "pilot",
    readyForControlledPilot: Object.values(checks).every(Boolean),
    pilotIds: pilots,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const configuration = evaluatePilotConfiguration();
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    max: 2,
  });
  try {
    const [
      connectedAccounts,
      paymentRequests,
      eventActivity,
      activePayments,
      pilotConnections,
    ] = await Promise.all([
      pool.query(
        `SELECT onboarding_status, ach_payments_status, count(*)::int AS count
         FROM stripe_connect_accounts
         GROUP BY onboarding_status, ach_payments_status
         ORDER BY onboarding_status, ach_payments_status`,
      ),
      pool.query(
        `SELECT status, count(*)::int AS count,
                COALESCE(sum(amount_cents), 0)::bigint AS amount_cents
         FROM project_invoice_payment_requests
         GROUP BY status
         ORDER BY status`,
      ),
      pool.query(
        `SELECT count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24_hours,
                count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7_days,
                max(created_at) AS last_received_at
         FROM stripe_connect_events`,
      ),
      pool.query(
        `SELECT count(*)::int AS count, min(created_at) AS oldest_created_at
         FROM project_invoice_payment_requests
         WHERE status = ANY($1::text[])`,
        [["created", "open", "processing"]],
      ),
      pool.query(
        `SELECT count(*)::int AS count
         FROM stripe_connect_accounts
         WHERE account_id = ANY($1::uuid[])`,
        [configuration.pilotIds],
      ),
    ]);
    const output = {
      ok: true,
      environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? "local",
      rollout: {
        mode: configuration.rolloutMode,
        pilotAccountCount: configuration.pilotAccountCount,
        connectedPilotAccountCount: pilotConnections.rows[0]?.count ?? 0,
        readyForControlledPilot: configuration.readyForControlledPilot,
        checks: configuration.checks,
      },
      connectedAccounts: connectedAccounts.rows,
      paymentRequests: paymentRequests.rows.map((row) => ({
        status: row.status,
        count: row.count,
        amountCents: Number(row.amount_cents),
      })),
      activePayments: activePayments.rows[0],
      webhookActivity: eventActivity.rows[0],
    };
    console.log(JSON.stringify(output, null, 2));
    if (process.argv.includes("--require-ready") && !configuration.readyForControlledPilot) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
