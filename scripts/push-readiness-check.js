import "dotenv/config";

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { pushProviderStatus, vapidProviders } from "../server/push-notifications.js";

const STALE_CLAIM_MINUTES = 5;
const STALE_BACKLOG_MINUTES = 15;
const RECENT_FAILURE_HOURS = 24;

function numericCounts(row, keys) {
  return Object.fromEntries(keys.map((key) => [key, Number(row?.[key] ?? 0)]));
}

export async function collectPushReadiness(database, environment = process.env) {
  const provider = pushProviderStatus(environment);
  const providers = vapidProviders(environment);
  const client = await database.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const schema = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'push_subscriptions'
           AND column_name = 'vapid_generation'
       ) AS ready`,
    );
    const schemaReady = schema.rows[0]?.ready === true;
    if (!schemaReady) {
      return {
        schemaReady,
        provider: {
          ok: provider.ok,
          mode: provider.mode,
          previousConfigured: provider.previousConfigured,
        },
        inventory: null,
        outbox: null,
      };
    }

    const inventoryResult = await client.query(
      `WITH classified AS (
         SELECT subscription.vapid_generation,
                subscription.last_success_at,
                (
                  session.revoked_at IS NULL
                  AND session.expires_at > now()
                ) AS eligible
         FROM push_subscriptions subscription
         INNER JOIN auth_sessions session
           ON session.session_id = subscription.auth_session_id
       )
       SELECT count(*)::int AS total,
              count(*) FILTER (WHERE eligible)::int AS eligible,
              count(*) FILTER (WHERE NOT eligible)::int AS inactive,
              count(*) FILTER (
                WHERE eligible AND $1::text IS NOT NULL AND vapid_generation = $1
              )::int AS active,
              count(*) FILTER (
                WHERE eligible AND $2::text IS NOT NULL AND vapid_generation = $2
              )::int AS previous,
              count(*) FILTER (
                WHERE eligible AND vapid_generation IS NULL
              )::int AS unknown,
              count(*) FILTER (
                WHERE eligible
                  AND vapid_generation IS NOT NULL
                  AND ($1::text IS NULL OR vapid_generation <> $1)
                  AND ($2::text IS NULL OR vapid_generation <> $2)
              )::int AS retired,
              count(*) FILTER (
                WHERE eligible
                  AND $1::text IS NOT NULL
                  AND vapid_generation = $1
                  AND last_success_at IS NOT NULL
              )::int AS active_with_success
       FROM classified`,
      [providers.active.generation, providers.previous?.generation ?? null],
    );
    const outboxResult = await client.query(
      `SELECT count(*) FILTER (
                WHERE status = 'pending' AND next_attempt_at <= now()
              )::int AS due_pending,
              count(*) FILTER (
                WHERE status = 'pending'
                  AND next_attempt_at <= now() - ($1 * interval '1 minute')
              )::int AS stale_pending,
              count(*) FILTER (WHERE status = 'processing')::int AS processing,
              count(*) FILTER (
                WHERE status = 'processing'
                  AND claimed_at <= now() - ($2 * interval '1 minute')
              )::int AS stale_processing,
              count(*) FILTER (
                WHERE status = 'failed'
                  AND updated_at >= now() - ($3 * interval '1 hour')
              )::int AS recent_terminal_failures
       FROM push_delivery_outbox`,
      [STALE_BACKLOG_MINUTES, STALE_CLAIM_MINUTES, RECENT_FAILURE_HOURS],
    );
    return {
      schemaReady,
      provider: {
        ok: provider.ok,
        mode: provider.mode,
        previousConfigured: provider.previousConfigured,
      },
      inventory: numericCounts(inventoryResult.rows[0], [
        "total",
        "eligible",
        "inactive",
        "active",
        "previous",
        "unknown",
        "retired",
        "active_with_success",
      ]),
      outbox: numericCounts(outboxResult.rows[0], [
        "due_pending",
        "stale_pending",
        "processing",
        "stale_processing",
        "recent_terminal_failures",
      ]),
    };
  } finally {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

export function evaluatePushReadiness(snapshot, { phase = "post_retirement" } = {}) {
  const findings = [];
  const add = (condition, code, message) => {
    if (condition) findings.push({ code, message });
  };

  add(!snapshot.provider.ok, "PUSH_PROVIDER_UNAVAILABLE", "The active Web Push provider is not valid.");
  add(!snapshot.schemaReady, "PUSH_GENERATION_SCHEMA_MISSING", "The VAPID generation migration is not applied.");
  add(
    phase === "post_retirement" && snapshot.provider.previousConfigured,
    "PUSH_PREVIOUS_KEY_STILL_CONFIGURED",
    "A previous Web Push key is still configured.",
  );
  if (snapshot.inventory) {
    add(
      snapshot.inventory.eligible === 0,
      "NO_ELIGIBLE_PUSH_SUBSCRIPTIONS",
      "No active device subscription is available for acceptance testing.",
    );
    add(
      snapshot.inventory.unknown > 0,
      "ELIGIBLE_PUSH_SUBSCRIPTIONS_UNCLASSIFIED",
      "At least one active device has not proved which Web Push key it uses.",
    );
    add(
      snapshot.inventory.previous > 0,
      "ELIGIBLE_PUSH_SUBSCRIPTIONS_ON_PREVIOUS_KEY",
      "At least one active device still depends on the previous Web Push key.",
    );
    add(
      snapshot.inventory.retired > 0,
      "ELIGIBLE_PUSH_SUBSCRIPTIONS_UNRECOGNIZED",
      "At least one active device references an unrecognized Web Push key generation.",
    );
    add(
      snapshot.inventory.active > snapshot.inventory.active_with_success,
      "ACTIVE_PUSH_DELIVERY_UNPROVEN",
      "At least one current-key device lacks successful-delivery proof.",
    );
  }
  if (snapshot.outbox) {
    add(
      snapshot.outbox.stale_processing > 0,
      "PUSH_OUTBOX_STALE_CLAIMS",
      "At least one push delivery worker claim is stale.",
    );
    add(
      snapshot.outbox.stale_pending > 0,
      "PUSH_OUTBOX_BACKLOG_STALE",
      "At least one due push delivery has waited more than 15 minutes.",
    );
    add(
      snapshot.outbox.recent_terminal_failures > 0,
      "PUSH_RECENT_TERMINAL_FAILURES",
      "At least one push delivery reached terminal failure in the last 24 hours.",
    );
  }

  return { ready: findings.length === 0, phase, findings, ...snapshot };
}

function printHuman(result) {
  console.log(`Web Push readiness: ${result.ready ? "READY" : "BLOCKED"}`);
  console.log(`Provider: ${result.provider.mode}; previous key: ${result.provider.previousConfigured ? "configured" : "absent"}`);
  if (result.inventory) {
    console.log(
      `Eligible devices: ${result.inventory.eligible}; active: ${result.inventory.active}; `
      + `previous: ${result.inventory.previous}; unknown: ${result.inventory.unknown}; retired: ${result.inventory.retired}`,
    );
    console.log(`Current-key successful devices: ${result.inventory.active_with_success}`);
  }
  if (result.outbox) {
    console.log(
      `Push queue: ${result.outbox.due_pending} due; ${result.outbox.stale_pending} stale; `
      + `${result.outbox.stale_processing} stale worker claims; ${result.outbox.recent_terminal_failures} recent terminal failures`,
    );
  }
  for (const finding of result.findings) console.log(`- ${finding.code}: ${finding.message}`);
}

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const { Pool } = pg;
  const database = new Pool({
    connectionString: databaseUrl,
    max: 1,
    ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });
  try {
    const phase = process.argv.includes("--retirement-check") ? "pre_retirement" : "post_retirement";
    const result = evaluatePushReadiness(await collectPushReadiness(database), { phase });
    if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
    else printHuman(result);
    if (process.argv.includes("--require-ready") && !result.ready) process.exitCode = 1;
  } finally {
    await database.end();
  }
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch(() => {
    console.error("Push readiness check could not complete.");
    process.exitCode = 1;
  });
}
