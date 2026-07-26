# Account-owned customer book with document snapshots

- Status: accepted
- Date: 2026-07-26
- Owner: Product owner / RIVT engineering
- Review date: after the Jacksonville customer-continuity pilot

## Context

Tradespeople repeatedly use the same customer details across private projects,
estimates, invoices, and follow-up notes. Re-entering that information creates
errors, while a browser-only address book cannot provide account ownership or
cross-device continuity. Referencing only the current customer row from a sent
document would create a different integrity problem: correcting a customer's
address later could silently rewrite the apparent recipient of an older
invoice.

## Decision

RIVT keeps one account-owned customer book. Projects and tool records may link
to a customer only when that customer belongs to the same authenticated
account. Estimate and invoice payloads also retain an immutable customer
snapshot representing what the author reviewed for that document.

Customer notes are private account records, not a communication channel.
Archiving is reversible; RIVT does not automatically merge possible
duplicates. The UI warns on matching email or phone and leaves consolidation
to a future reviewed merge flow.

## Alternatives considered

- Keep contacts in browser storage: rejected because it cannot support
  reliable cross-device use or server-side authorization.
- Store only a customer foreign key on documents: rejected because later
  customer edits would alter historical document identity.
- Copy customer data into every workflow without a canonical record: rejected
  because corrections and repeat use would continue to drift.
- Automatically merge matching email/phone records: deferred because shared
  offices, family contacts, and reused business numbers make automatic
  consolidation destructive.

## Impact

- Privacy/security: all reads, writes, links, and activity are account-scoped.
  Creating a customer never creates a public or homeowner identity.
- Data/migration: migration `0033_customer_book` is reversible and preserves
  the legacy client-contact representation during rollback.
- Accessibility: one shared picker provides labeled search, selection, and
  creation controls; archive and favorite states remain explicit.
- Operations: customer export/merge and multi-contact companies are follow-up
  capabilities, not silently approximated in this release.

## Reversal

Roll back application code first, then use the reviewed down migration to
mirror current customer fields into legacy client records before dropping the
canonical table and foreign keys.
