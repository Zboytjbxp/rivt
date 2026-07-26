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

## Estimate/invoice document-branding extension

### Product boundary

- One authenticated account owns one customer-document identity. It is not a
  public profile claim and does not verify licensing, insurance, or business
  ownership.
- Estimate and invoice layout choices affect presentation only. They do not
  alter amounts, payment state, delivery state, or Stripe settlement.
- Reusable templates contain work/pricing defaults only. They never retain a
  former customer, recipient, document number, or date.

### Server and storage

- Migration `0032_document_branding` adds the account-owned brand profile,
  `document-brand` upload scope, and server-owned `estimate_template` record
  type with a reviewed down migration.
- Logo upload accepts signature-checked PNG/JPG/WebP content up to 2 MB,
  stores it in private managed object storage, and embeds it into Resend
  delivery by content ID.
- Replaced/removed logo rows are marked removed; their objects are deleted on
  a best-effort basis. Customer delivery degrades to the saved business name
  when the logo object cannot be read.

### Acceptance

- Preview, print/PDF, copied summary, and delivered HTML email use the same
  server-owned business identity and selected Classic, Compact, or Field
  layout.
- Brand identity/style participates in the sent-document fingerprint.
- Cross-account reads/templates fail closed; migration apply/rollback and
  customer email branding are integration-tested.
- Rendered desktop, 390px, and compact-phone Estimate/Invoice flows have no
  horizontal overflow and retain reachable review/delivery actions.

### Rollback

- Roll application code back before rolling migration `0032` down.
- Export any document-brand settings or estimate templates that must be
  retained. The reviewed down migration deliberately deletes
  `estimate_template` records because the prior application cannot validate
  that type.
- Object rows in `document-brand` scope are returned to `legacy` on rollback;
  do not delete private logo objects during schema rollback without a
  separately reviewed retention decision.

## Customer-book continuity extension

### Product boundary

- A customer is an account-owned business/contact record for the
  tradesperson using RIVT. It does not create a homeowner account, public
  profile, marketplace identity, or permission to contact that person.
- Selecting a customer copies a snapshot into the estimate or invoice. Later
  edits to the customer book do not rewrite an already-reviewed document.
- Customer notes are a private account log. RIVT never labels them sent,
  received, or shared with the customer.

### Server and storage

- Migration `0033_customer_book` adds account-owned customers and optional
  customer links on tool records and standalone projects. It migrates
  existing client-contact tool records without deleting the legacy record.
- Customer routes support account-scoped search, favorites, active/archive
  status, recent use, private notes, and linked project/document activity.
  Every project/document customer link is checked against the authenticated
  account.
- The reviewed down migration mirrors customer data back into legacy client
  records before removing the new links/table, preserving the earlier
  application's readable contact boundary.

### Client and workflow

- Estimate, Invoice, and standalone-project creation share one saved-customer
  picker with recent/favorite ordering, search, and an inline new-customer
  path.
- Customer defaults can supply billing/service addresses, preferred contact
  method, and payment terms without silently changing document totals or
  delivery state.
- Work -> People -> Customers provides search, favorite, edit,
  archive/restore, duplicate email/phone warnings, and real linked activity.
  Inbox -> Customer notes reuses the same customer records while retaining
  explicit private-log copy.

### Acceptance and rollback

- Tests prove cross-account customer linking fails, archived customers remain
  recoverable, linked activity is account-owned, and migration apply/rollback
  preserves legacy client details.
- Rendered Estimate, Invoice, customer-book, and customer-notes flows remain
  usable without horizontal overflow at 390px.
- Roll application code back before migration `0033`. Run the reviewed down
  migration only after confirming any post-upgrade customer fields have been
  mirrored into the retained legacy client records.

## Document-continuity hardening extension

### Product boundary

- Saved Estimate and Invoice URLs may identify an account-owned tool record,
  but the identifier never bypasses authenticated account scoping.
- Device autosave is recovery, not account synchronization. The UI must state
  which one has happened and must not call a device-only edit synced.
- A zero-value invoice may be saved as an incomplete draft. It cannot be sent
  or offered for online payment until it contains a real positive amount.

### Client workflow

- Home paperwork and other saved-record handoffs retain the selected document
  id in the URL, including refresh and browser history.
- Editing an account-loaded document changes the save state to device-only
  until explicit account save succeeds.
- Invoice line removal has a reachable Undo action, and offline copy preserves
  truthful device-draft versus paused-sync/delivery behavior.
- Customer selection reports a recent-use sync failure without undoing the
  selected customer.

### Acceptance and rollback

- Rendered desktop, 390px, and compact-phone QA covers exact record restore,
  zero-value draft save, line-item undo, device-only edit status, and account
  resave.
- No server, schema, migration, provider, or production-data change is part
  of this extension. Rollback is source-only and leaves migrations `0032` and
  `0033` in place.
