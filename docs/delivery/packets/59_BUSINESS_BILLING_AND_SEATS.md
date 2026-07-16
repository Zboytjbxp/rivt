# Packet 59 - Business Billing and Seats

**Status:** Queued after Packet 58
**Runtime exposure:** Stripe test mode and internal organizations only

## Objective

Make Business billing organization-owned, seat-aware, idempotent, and
fail-closed. Preserve the current account-owned Pro subscription lifecycle.

## Billing model

- Business is $39 monthly including 3 active seats.
- Additional active seats are $8 each per month.
- Only an Owner can start checkout, change seats, manage payment details,
  cancel, resume, or transfer the billing owner.
- Checkout accepts a server-known product key and organization ID, never an
  arbitrary Stripe price ID or quantity.
- Seat quantity is derived from server membership state and reconciled with
  Stripe; client input is not authoritative.

## State handling

- `checkout_pending`: no Business access until a verified completion is reconciled.
- `active` or `trialing`: resolve Business entitlements for the organization.
- `past_due`: show billing attention and use a documented grace period.
- `canceled_at_period_end`: retain access through the exact period end.
- `canceled` or `unpaid`: enter read-only company mode; preserve records and export.
- Webhook, checkout reconciliation, and scheduled reconciliation are
  idempotent and produce audit events.

## Changes

- Add organization billing subjects without overloading account subscriptions.
- Add subscription item/seat quantity, period, status, cancellation, grace,
  and provider identifiers with unique constraints.
- Add signed webhook processing for Business lifecycle events.
- Add seat-limit checks to invitations and member activation.
- Add self-service cancel, resume, payment management, invoices, and ownership
  transfer using Stripe-hosted surfaces where appropriate.
- Add storage and seat usage summaries driven by server data.

## Acceptance

- Cross-account and cross-organization checkout/reconciliation returns 403.
- Duplicate or reordered webhooks cannot duplicate access or charges.
- A canceled company retains readable records and loses new paid mutations at
  the documented time, never early.
- Removing or adding members updates billable quantity predictably and is
  covered by proration tests.
- The last owner and billing owner cannot be stranded.
- Checkout, portal, cancellation, resume, failed payment, webhook replay,
  reconciliation, quantity changes, and downgrade pass in Stripe test mode.
- Business remains unavailable to ordinary production accounts.

## Next packet

Packet 60 builds and tests the human-facing Business workspace and controlled
pilot release.
