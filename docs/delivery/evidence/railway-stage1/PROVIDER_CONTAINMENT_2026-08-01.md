# Provider containment receipt - 2026-08-01

This receipt preserves non-secret historical evidence and the owner's exact
disabled-mode approval at that checkpoint. It does not enable Stripe invoice
bank payments, close the credential incident, approve Railway Stage 1,
authorize deployment, or authorize launch. The stricter current readiness gate
does not treat this checked-in receipt or its checked-in policy as
provider-authenticated evidence.

## Source and release boundary

- Runtime/gate evidence commit:
  `2253bca16883e736cd06b9b47d4539ffa4a86e32` (the branch's later follow-up
  changes launch-readiness approval binding, its tests, and documentation only;
  it does not change application runtime behavior)
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

## Exact disabled-mode approval

- At `2026-08-01T03:26:10.3842506Z`, the founder role supplied this approval.
  Personal attribution is intentionally omitted from the public record while
  the approved scope is preserved in role-only form:
  "The RIVT founder approves RIVT's production bank-payment configuration in
  disabled mode as recorded on August 1, 2026. This does not enable ACH,
  authorize deployment, approve a worker, or authorize launch."
- The machine-readable policy records the SHA-256 of this receipt and binds
  that content hash, the evidence path, destination inventory, runtime scope
  attestation, exact public-health facts, and approval state into the
  configuration digest. The hashes are stored in
  `docs/operations/payment-provider-readiness.json` rather than duplicated
  here, avoiding a self-referential evidence hash.
- The approved state is only `mode:disabled`, with the production feature flag
  verified off. Any change to the reviewed fields invalidates the digest.
- Stripe provider inventory reports a `Connected accounts` destination, while
  RIVT's runtime scope attestation remains explicitly `unset`. Those are
  separate facts and cannot substitute for one another in enabled mode.
- Public health was checked again immediately before recording approval and
  still reported production source `29e3c613f2eb95a6583b52c671275e5046dde0d3`,
  `enabled:false`, `configured:false`, `webhookConfigured:true`, and
  `mode:setup_required`.

## Cost and remaining boundary

- No new service, worker, database, bucket, volume, backup, payment, or
  recurring resource was created.
- The actions were selected because their expected incremental usage was below
  the owner's $2 authorization. Actual corrective-deployment compute usage
  remains unreconciled and is not represented as zero cost.
- Historical disabled-mode payment-provider approval is recorded, but the
  current payment-provider prerequisite remains blocked by
  `PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED`. A trusted in-process provider verifier
  must supply the exact control/provider/digest identity for a strict typed
  payment-state receipt; this repository record cannot authenticate itself.
  Still required before payment activation: Stripe-signed Connected-accounts
  delivery, a matching durable payment-state transition, scope attestation
  only after that proof, a new enabled-mode approval, launch readiness, and an
  explicit activation decision.
- This documentation-only hardening performed no provider mutation, production
  read or write, deployment, resource creation, or paid action.
- The last conservative Railway Stage 1 worker estimate was about $10.05 per
  month, which exceeds the current $2 authorization. No worker action occurred.
