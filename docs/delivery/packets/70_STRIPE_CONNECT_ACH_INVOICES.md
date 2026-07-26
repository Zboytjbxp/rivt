# Packet 70 - Stripe Connect ACH Invoices

## Goal

Let an invoice author offer a Stripe-hosted US bank-account payment option without making RIVT the holder of job funds or treating a browser redirect as proof of settlement.

## Product boundary

- The contractor or tradesperson who authored the invoice owns an Accounts v2 merchant account with full Stripe Dashboard access and is the merchant for the direct charge.
- Stripe collects its processing fees from the connected merchant and owns negative-balance loss responsibility; RIVT does not take on either role.
- RIVT takes no application fee at launch.
- RIVT does not hold, escrow, guarantee, insure, or protect job funds.
- Invoice recipients use a minimal public payment-return surface; they do not become homeowner RIVT users.
- Participant-recorded external payments remain separate, plainly labeled records.
- RIVT Pro subscription billing remains a separate Stripe customer/subscription system and webhook.

## Server work

1. Add versioned, reversible tables for connected-account status, invoice payment requests, and immutable connected webhook event IDs.
2. Add authenticated, author-owned Accounts v2 onboarding, full Stripe Dashboard access, ACH-link creation, and unused-link cancellation routes.
3. Create ACH-only Checkout Sessions as direct charges on the connected account.
4. Require active account/email verification, connected-account ownership, active ACH capability, USD amount limits, active-work participation, and invoice authorship.
5. Verify connected webhooks with a dedicated signing secret and apply events transactionally/idempotently.
6. Keep delayed ACH at `processing` until signed asynchronous success. Reopen invoices after failure, refund, or dispute.
7. Block external-payment logging and invoice voiding while an online payment is open or processing.
8. Expose only invoice number, payee, amount, and status from the bearer Checkout-session return endpoint.

## Client work

1. Add Stripe setup/manage controls inside a saved job invoice.
2. Create/copy/cancel customer ACH links with truthful fee, timing, and settlement copy.
3. Keep manually recorded external payments in a collapsed, clearly separate control.
4. Include a live server-owned ACH link in invoice email only when the invoice author owns the matching active job invoice and the link is still open.
5. Add a public light/dark payment-return page that distinguishes not submitted, processing, settled, failed, expired, refunded, and disputed states.
6. Ask the invoice author how the customer should pay before delivery; require
   exact instructions for payments outside Stripe.
7. Support Quick use and standalone-project invoice drafts without fabricating
   an accepted-work record, and use a short RIVT redirect in customer-facing
   email/print surfaces rather than the raw Stripe Checkout URL.

## Activation gate

- The feature flag is `STRIPE_CONNECT_ACH_ENABLED`.
- A separate `STRIPE_CONNECT_WEBHOOK_SECRET` is required.
- New links fail closed unless both are present with the Stripe secret key.
- Signed webhooks continue to process existing payments when new-link creation is disabled.
- Before production activation, exercise hosted onboarding plus asynchronous ACH success and failure in Stripe test mode, confirm Connect support/merchant responsibilities, and create the connected-account webhook.
- Sandbox provider proof and a nine-event connected-account destination are
  complete. Do not reuse its test signing secret in production: the live
  Stripe environment still requires its own connected-account destination,
  signing secret, human identity/business onboarding, and a controlled pilot
  before enabling the flag.

## Acceptance

- Lint, build, unit, E2E, security lint, migration lifecycle, project financial integration, and rendered Tools checks pass.
- Tests prove no paid balance while ACH is processing, replay safety, out-of-order event protection, amount bounds, refund/dispute reopening, cross-tier payment conflict prevention, and minimal public response data.
- Production health reports the Connect provider mode and migrations `0029_stripe_connect_invoice_payments` and `0030_stripe_connect_accounts_v2`.
- Quick use acceptance additionally requires migration
  `0031_tool_invoice_payment_requests`, a server-owned email containing the
  short `/pay/{requestId}` URL, and refund/dispute-safe status updates.
- Exact-source production monitor passes after deployment.
- Production proof: source
  `03c4336142bab09e12d649ffdf0bc0364716edb6` serves ready migration `0031`,
  Stripe Connect Accounts v2 enabled/configured/webhook-configured, and a
  passing exact-source monitor. Controlled live link creation from an
  onboarded merchant remains pending; no real debit is required.

## Rollback

- Set `STRIPE_CONNECT_ACH_ENABLED=false` first to stop new onboarding/link creation.
- Keep the connected webhook route and secret active while any payment remains open or processing.
- Do not roll migrations 0030 or 0029 down after real connected accounts or payment records exist without an approved export/retention plan.
- Application rollback must retain public status lookup and webhook processing until all outstanding ACH states are terminal.
