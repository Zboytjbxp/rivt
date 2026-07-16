# Packet 58 - Shared Workspace Ownership

**Status:** Queued after Packet 57
**Runtime exposure:** Disabled Business foundation

## Objective

Add explicit personal-versus-company ownership to business records and make
every read, write, export, upload, and delete permission-aware. Existing
personal data remains personal unless the owner deliberately moves or copies
it through a reviewed migration flow.

## Ownership rules

- Personal identity, profile, reputation, Shop Talk activity, personal rate
  card, standalone personal projects, and private albums remain account-owned.
- Records created while a company workspace is selected are organization-owned.
- Company clients, services, rate cards, templates, projects, accepted-work
  records, albums, photos, logs, punch items, safety records, expenses, time,
  estimates, invoices, receivables, and exports carry `organization_id`.
- Every company record keeps `created_by_account_id` and
  `updated_by_account_id` for attribution without granting ownership.
- Leaving a company removes access to company records but never deletes the
  member's account or personal reputation.

## Changes

- Add reviewed migrations and rollback for ownership columns and indexes.
- Add one server workspace resolver that validates membership and permission.
- Require explicit workspace context on company record mutations.
- Add assignments for projects, tasks, and records without implying payroll
  or employee classification.
- Make uploads, exports, closeout packets, and object-storage keys ownership-aware.
- Add a company activity stream from immutable audit events.
- Add safe read-only downgrade mode without deleting records.

## Acceptance

- Personal and company data cannot leak across accounts or organizations.
- A removed member loses company access immediately on every API surface.
- An organization record cannot be converted to personal ownership by editing
  a request payload.
- Object-storage download URLs are issued only after the same ownership check
  as the parent record.
- Existing personal records remain readable and unchanged after migrations.
- Downgraded company records remain readable/exportable by the owner while new
  writes that exceed plan limits fail with a human explanation.
- Integration tests cover every shared record family and storage path with
  two organizations and adversarial foreign IDs.

## Next packet

Packet 59 adds organization-owned subscriptions, seats, and billing state in
Stripe test mode.
