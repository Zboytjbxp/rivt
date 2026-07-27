# Packet 77 — Canonical contacts and relationships

## Objective

Replace the split customer, crew, subcontractor, and device-only contact
models with one account-owned relationship directory that can support people
and companies in more than one role.

## Accepted implementation scope

- Add a canonical `contacts` model with account ownership, person/company
  identity, contact methods, addresses, roles, tags, and archive/recent-use
  state.
- Support the durable roles `crew`, `subcontractor`, `customer`, `supplier`,
  and `other`. A contact may hold more than one role.
- Backfill existing customers and crew/subcontractor network records without
  silently merging ambiguous records.
- Keep customer IDs, document/project links, immutable document snapshots,
  and existing device caches compatible while the canonical contact becomes
  the shared identity.
- Add authenticated, account-isolated contact APIs with duplicate detection,
  role filtering, create/update/archive, and real linked activity.
- Make Work -> Contacts a relationship directory with clear All, Crew, Subs,
  Customers, and Suppliers views. Reviews remain reputation, not a contact
  category.
- Reuse the canonical directory in customer selectors without changing saved
  estimate or invoice snapshots.

## Migration and rollback contract

- Migration `0036_canonical_contacts` is additive. Existing `customers` and
  `network_records` rows remain available as compatibility projections.
- Exact normalized email or phone matches may reuse an existing contact only
  when the match is unique within the account. Ambiguous matches remain
  separate and are surfaced for later user-reviewed merging.
- New writes update the canonical contact plus the applicable compatibility
  record in one transaction.
- Rollback must preserve every canonical-only contact in a rollback archive
  before removing the canonical tables. Reapplying the migration restores the
  archived records and then removes the archive.
- No production migration is deployed until lifecycle, isolation, and
  compatibility tests pass.

## Deliberate boundaries

- This packet does not upload a device address book or retain non-user phone
  contacts.
- Linking a private contact to a public RIVT profile requires a separate
  consent and identity-confirmation workflow; no automatic linkage is added.
- Job assignment authorization and shared jobsite-contact visibility remain
  separate from a private account directory. This packet may record private
  relationship context but does not imply that another account can see it.
- No fabricated relationship, activity, availability, review, or message
  state is introduced.

## Acceptance

- One server-owned contact can appear in multiple role views without creating
  duplicate identity rows.
- Existing customers still load in Estimate, Invoice, projects, and the
  customer book with their current IDs and activity.
- Existing crew and subs still load with trade, licensing, availability,
  rate, notes, and assignment context.
- Suppliers can be created, edited, archived, searched, and selected from the
  same directory.
- Duplicate normalized email or phone creation returns the existing contact
  candidate instead of silently creating another record.
- Cross-account contact reads, writes, activity, and links are rejected.
- Work -> Contacts stays usable at desktop, 390px, and 320px in light/dark with
  no horizontal overflow and 44px interaction targets.
- Build, lint, unit/frontend tests, all database integration suites, E2E,
  focused rendered QA, dependency audit, migration lifecycle, and diff
  integrity pass before merge or deployment.
