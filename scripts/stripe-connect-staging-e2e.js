import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";

const REQUIRED_ACK = "isolated-stripe-connect";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assertStagingSafety(baseUrl) {
  const environment = required("RAILWAY_ENVIRONMENT_NAME").toLowerCase();
  const acknowledgment = required("RIVT_STAGING_ACK");
  const parsedUrl = new URL(baseUrl);
  if (environment !== "staging") throw new Error("This test only runs in the staging environment.");
  if (acknowledgment !== REQUIRED_ACK) throw new Error("RIVT_STAGING_ACK does not authorize the isolated staging test.");
  if (!parsedUrl.hostname.includes("staging")) throw new Error("STAGING_BASE_URL must identify a staging host.");
  if (parsedUrl.protocol !== "https:") throw new Error("STAGING_BASE_URL must use HTTPS.");
}

function stripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

async function postEvent(baseUrl, secret, event, signatureOverride) {
  const payload = JSON.stringify(event);
  return fetch(`${baseUrl}/api/stripe/connect/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signatureOverride ?? stripeSignature(payload, secret),
    },
    body: payload,
  });
}

function eventFixture({ id, type, stripeAccountId, paymentIntentId, paymentRequestId }) {
  return {
    id,
    object: "event",
    api_version: "2026-06-24.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: paymentIntentId,
        object: "payment_intent",
        metadata: { payment_request_id: paymentRequestId },
        last_payment_error: type === "payment_intent.payment_failed"
          ? { code: "test_bank_declined" }
          : null,
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
    account: stripeAccountId,
  };
}

async function seedPaymentFixtures(pool, pilotAccountId, stripeAccountId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const organization = (await client.query(
      `SELECT organization_id
       FROM organization_memberships
       WHERE account_id = $1 AND status = 'active'
       ORDER BY created_at
       LIMIT 1`,
      [pilotAccountId],
    )).rows[0];
    if (!organization) throw new Error("The staging pilot has no active organization.");
    const counterpart = (await client.query(
      `SELECT id
       FROM accounts
       WHERE id <> $1 AND status = 'active'
       ORDER BY created_at
       LIMIT 1`,
      [pilotAccountId],
    )).rows[0];
    if (!counterpart) throw new Error("A second active staging account is required.");

    const jobId = randomUUID();
    const applicationId = randomUUID();
    const offerId = randomUUID();
    const activeWorkId = randomUUID();
    const projectId = randomUUID();
    const successInvoiceId = randomUUID();
    const failureInvoiceId = randomUUID();
    const successRequestId = randomUUID();
    const failureRequestId = randomUUID();
    const suffix = randomUUID().replaceAll("-", "");
    const successIntentId = `pi_rivt_staging_success_${suffix}`;
    const failureIntentId = `pi_rivt_staging_failure_${suffix}`;

    await client.query(
      `INSERT INTO jobs (
         id, organization_id, created_by_account_id, title, trade_code, summary,
         status, budget_cents, published_at, closed_at
       ) VALUES ($1, $2, $3, 'ACH staging webhook verification', 'electrical',
                 'Synthetic staging-only payment lifecycle fixture.', 'closed', 24690, now(), now())`,
      [jobId, organization.organization_id, pilotAccountId],
    );
    await client.query(
      `INSERT INTO job_applications (
         id, job_id, applicant_account_id, status, message, submitted_at, decided_at
       ) VALUES ($1, $2, $3, 'offered', 'Staging-only fixture.', now(), now())`,
      [applicationId, jobId, counterpart.id],
    );
    await client.query(
      `INSERT INTO job_offers (
         id, job_id, application_id, contractor_account_id, recipient_account_id,
         status, scope_summary, message, agreed_amount_cents, agreed_unit, accepted_at
       ) VALUES ($1, $2, $3, $4, $5, 'accepted',
                 'Staging webhook lifecycle proof.', 'Synthetic staging-only fixture.',
                 24690, 'fixed', now())`,
      [offerId, jobId, applicationId, pilotAccountId, counterpart.id],
    );
    await client.query(
      `INSERT INTO active_work (
         id, job_id, offer_id, organization_id, contractor_account_id, tradesperson_account_id
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [activeWorkId, jobId, offerId, organization.organization_id, pilotAccountId, counterpart.id],
    );
    await client.query(
      `INSERT INTO projects (
         id, active_work_id, job_id, organization_id, contractor_account_id,
         tradesperson_account_id, created_by_account_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $5)`,
      [projectId, activeWorkId, jobId, organization.organization_id, pilotAccountId, counterpart.id],
    );
    const lineItems = JSON.stringify([{ description: "Staging ACH verification", quantity: 1, unitPriceCents: 12345 }]);
    for (const [invoiceId, invoiceNumber] of [
      [successInvoiceId, `STAGING-SUCCESS-${suffix.slice(0, 10)}`],
      [failureInvoiceId, `STAGING-FAILURE-${suffix.slice(10, 20)}`],
    ]) {
      await client.query(
        `INSERT INTO project_invoices (
           id, project_id, active_work_id, created_by_account_id, invoice_number,
           bill_to, pay_to, terms, payment_method, status, line_items,
           subtotal_cents, tax_cents, total_cents, sent_at
         ) VALUES ($1, $2, $3, $4, $5, 'Staging customer', 'RIVT staging pilot',
                   'Staging test only', 'ACH', 'sent', $6::jsonb, 12345, 0, 12345, now())`,
        [invoiceId, projectId, activeWorkId, pilotAccountId, invoiceNumber, lineItems],
      );
    }
    for (const [requestId, invoiceId, intentId] of [
      [successRequestId, successInvoiceId, successIntentId],
      [failureRequestId, failureInvoiceId, failureIntentId],
    ]) {
      await client.query(
        `INSERT INTO project_invoice_payment_requests (
           id, invoice_id, project_id, active_work_id, merchant_account_id,
           stripe_connected_account_id, stripe_payment_intent_id, amount_cents, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 12345, 'processing')`,
        [requestId, invoiceId, projectId, activeWorkId, pilotAccountId, stripeAccountId, intentId],
      );
    }
    await client.query("COMMIT");
    return {
      successInvoiceId,
      failureInvoiceId,
      successRequestId,
      failureRequestId,
      successIntentId,
      failureIntentId,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const baseUrl = required("STAGING_BASE_URL").replace(/\/+$/, "");
  assertStagingSafety(baseUrl);
  const databaseUrl = required("DATABASE_URL");
  const webhookSecret = required("STRIPE_CONNECT_WEBHOOK_SECRET");
  const pilotAccountId = required("PILOT_ACCOUNT_ID");
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    max: 2,
  });
  try {
    const connectedAccount = (await pool.query(
      `SELECT stripe_account_id
       FROM stripe_connect_accounts
       WHERE account_id = $1
       LIMIT 1`,
      [pilotAccountId],
    )).rows[0];
    if (!connectedAccount) throw new Error("The staging pilot has no Stripe connected account.");
    const fixtures = await seedPaymentFixtures(pool, pilotAccountId, connectedAccount.stripe_account_id);
    const runId = randomUUID().replaceAll("-", "");
    const successEvent = eventFixture({
      id: `evt_rivt_staging_success_${runId}`,
      type: "payment_intent.succeeded",
      stripeAccountId: connectedAccount.stripe_account_id,
      paymentIntentId: fixtures.successIntentId,
      paymentRequestId: fixtures.successRequestId,
    });
    const failureEvent = eventFixture({
      id: `evt_rivt_staging_failure_${runId}`,
      type: "payment_intent.payment_failed",
      stripeAccountId: connectedAccount.stripe_account_id,
      paymentIntentId: fixtures.failureIntentId,
      paymentRequestId: fixtures.failureRequestId,
    });

    const invalidResponse = await postEvent(
      baseUrl,
      webhookSecret,
      { ...successEvent, id: `evt_rivt_staging_invalid_${runId}` },
      `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`,
    );
    if (invalidResponse.status !== 400) {
      throw new Error(`Invalid signature returned HTTP ${invalidResponse.status}, expected 400.`);
    }

    const successResponse = await postEvent(baseUrl, webhookSecret, successEvent);
    const failureResponse = await postEvent(baseUrl, webhookSecret, failureEvent);
    const duplicateResponse = await postEvent(baseUrl, webhookSecret, successEvent);
    for (const [label, response] of [
      ["success", successResponse],
      ["failure", failureResponse],
      ["duplicate", duplicateResponse],
    ]) {
      if (response.status !== 200) throw new Error(`${label} webhook returned HTTP ${response.status}.`);
    }

    const paymentRows = await pool.query(
      `SELECT id, status, failure_code
       FROM project_invoice_payment_requests
       WHERE id = ANY($1::uuid[])
       ORDER BY id`,
      [[fixtures.successRequestId, fixtures.failureRequestId]],
    );
    const byId = new Map(paymentRows.rows.map((row) => [row.id, row]));
    if (byId.get(fixtures.successRequestId)?.status !== "paid") {
      throw new Error("Signed success event did not settle the payment request.");
    }
    if (byId.get(fixtures.failureRequestId)?.status !== "failed") {
      throw new Error("Signed failure event did not fail the payment request.");
    }
    if (byId.get(fixtures.failureRequestId)?.failure_code !== "test_bank_declined") {
      throw new Error("Signed failure event did not persist its failure code.");
    }
    const invoices = await pool.query(
      `SELECT id, status
       FROM project_invoices
       WHERE id = ANY($1::uuid[])`,
      [[fixtures.successInvoiceId, fixtures.failureInvoiceId]],
    );
    const invoiceById = new Map(invoices.rows.map((row) => [row.id, row.status]));
    if (invoiceById.get(fixtures.successInvoiceId) !== "paid") {
      throw new Error("The success webhook did not reconcile the invoice to paid.");
    }
    if (invoiceById.get(fixtures.failureInvoiceId) !== "sent") {
      throw new Error("The failed payment incorrectly marked its invoice paid.");
    }
    const ledger = await pool.query(
      `SELECT stripe_event_id, count(*)::int AS count
       FROM stripe_connect_events
       WHERE stripe_event_id = ANY($1::text[])
       GROUP BY stripe_event_id`,
      [[successEvent.id, failureEvent.id]],
    );
    if (ledger.rows.length !== 2 || ledger.rows.some((row) => row.count !== 1)) {
      throw new Error("Webhook event idempotency ledger did not retain one immutable row per event.");
    }
    console.log(JSON.stringify({
      ok: true,
      environment: "staging",
      invalidSignatureRejected: true,
      successLifecycle: "paid",
      failureLifecycle: "failed",
      duplicateEventRows: 1,
      invoiceReconciliation: { success: "paid", failure: "sent" },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
