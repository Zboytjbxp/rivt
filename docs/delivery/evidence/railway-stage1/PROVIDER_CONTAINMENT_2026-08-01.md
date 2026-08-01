# Provider containment receipt - 2026-08-01

This receipt records non-secret evidence only. It does not approve Stripe
invoice bank payments, close the credential incident, approve Railway Stage 1,
or authorize launch.

## Source and release boundary

- Reviewed candidate: `72e7ad7907d3725ff1232cce9af730e7e577dcfe`
- Branch: `codex/railway-stage1-packet87-integration`
- Draft pull request: #14
- Production source remained:
  `29e3c613f2eb95a6583b52c671275e5046dde0d3`
- Production migration remained: `0042_push_vapid_generation`
- The candidate was not merged or deployed. No Stage 1 worker or new recurring
  resource was created.

## Provider controls

- Railway automatic deployments were disabled.
- Railway Wait for CI was enabled.
- A live Stripe destination named
  `RIVT connected-account ACH settlement` was created with scope
  `Connected accounts` and the nine snapshot money-state events implemented by
  RIVT:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `payment_intent.processing`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.dispute.created`
  - `charge.refunded`
- Its dedicated signing secret was installed in
  `STRIPE_CONNECT_WEBHOOK_SECRET`. The value is not recorded here.
- `STRIPE_CONNECT_WEBHOOK_SCOPE` remains unset. The older Your-account
  destination is retained only as provider inventory/rollback reference;
  RIVT no longer holds its signing secret, so it is not an operational
  fallback.

## Unexpected enabled-state discovery and correction

- At `2026-08-01T02:12:38Z`, public health unexpectedly reported invoice bank
  payments `enabled:true`, `configured:true`, `webhookConfigured:true`, and
  `mode:configured`. The start time of that state is unknown.
- `STRIPE_CONNECT_ACH_ENABLED` was immediately set to `false`.
- Corrective Railway deployment:
  `3d53eb50-7317-499f-950b-845ee536074c`
- At `2026-08-01T02:21:47.8089240Z`, public health returned HTTP 200 with:
  - `enabled:false`
  - `configured:false`
  - `webhookConfigured:true`
  - `mode:setup_required`
- An unsigned POST to `/api/stripe/connect/webhook` returned HTTP 400 before
  application writes. This proves fail-closed signature rejection, not that the
  replacement secret accepts a real Stripe-signed event.

## Existing-link inventory

A production SSH command executed a count-only transaction with
`BEGIN TRANSACTION READ ONLY` across `project_invoice_payment_requests` and
`tool_invoice_payment_requests`. It returned zero rows across all statuses.
No customer values, payment values, URLs, provider identifiers, or credentials
were selected or recorded. No database-backed RIVT payment request was
available to reconcile or expire. Provider-side sessions without a durable
RIVT row were not enumerated during this containment action.

## Cost and remaining boundary

- No new service, worker, database, bucket, volume, backup, payment, or
  recurring resource was created.
- The actions were selected because their expected incremental usage was below
  the owner's $2 authorization. Actual corrective-deployment compute usage
  remains unreconciled and is not represented as zero cost.
- Still required before payment activation: Stripe-signed Connected-accounts
  delivery, a matching durable payment-state transition, scope attestation
  only after that proof, named payment-provider approval, launch readiness,
  and an explicit activation decision.
- The last conservative Railway Stage 1 worker estimate was about $10.05 per
  month, which exceeds the current $2 authorization. No worker action occurred.
