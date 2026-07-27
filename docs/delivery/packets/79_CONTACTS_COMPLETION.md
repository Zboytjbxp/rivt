# Packet 79 — Contacts completion

## Objective

Finish Work -> Contacts as one durable relationship system instead of a set
of role-specific short-term lists. A person or company may be Crew, a
Subcontractor, a Customer, a Supplier, or another trade relationship at the
same time without being duplicated.

## Completion contract

- All, Crew, Subs, Customers, and Suppliers are filters over the same
  authenticated, account-owned Contact records.
- One editor owns identity, contact methods, addresses, relationship roles,
  trade/supplier details, tags, favorite state, notes, and archive/restore.
- The same Contact can be reused by Estimate, Invoice, Materials, canonical
  jobs, and private standalone projects.
- Contact activity shows real related documents, jobs, private projects, and
  supplier price-book records. No fabricated activity or counts are added.
- Job and private-project relationships store their own role and private
  context without rewriting the Contact or claiming that the relationship is
  crew-shared.
- Contacts are portable through quoted CSV import and complete CSV export.
  Import recognizes common customer/client, crew/employee,
  subcontractor/sub, and supplier/vendor role names and skips normalized
  email/phone duplicates.
- Crew and Sub contacts expose a real tracked RIVT referral link. The action
  says that it copies an invite; it does not claim that RIVT sent one.
- The retired planning-only invite ledger and legacy role-specific customer
  and crew managers are not routed from the production Contacts surface.

## Three issues considered after implementation

1. **A relationship can change without creating a new identity.** Multi-role
   records and role filters preserve one history when a subcontractor later
   becomes regular crew, or a supplier representative is also a trade
   collaborator.
2. **The useful fact is often job-specific.** Relationship roles and notes
   belong to the job/private project link, so a global Contact is not polluted
   with context that applies to only one site.
3. **Business records must remain portable and attributable.** CSV
   import/export, supplier ownership validation, cross-account denial, and
   activity links prevent Contacts from becoming a browser-only address book
   or an untraceable label inside a price entry.

## Authorization and data contract

- Contacts, job links, and private-project links are account-owned and
  authorized on the server.
- A caller cannot read or reuse another account's Contact, including as a
  Materials supplier.
- A project link requires ownership of the private standalone project. A job
  link requires the existing canonical job/participant authorization.
- A relationship removal does not delete the Contact. Archive is reversible.
- Similar names are not automatically merged. Creation/import prevents exact
  normalized email/phone duplicates; potentially destructive fuzzy merges
  require a separate field-by-field review design and are not silently
  performed.
- External Contacts are not represented as RIVT message recipients until
  they have an actual RIVT account and an authorized conversation.

## Migration and rollback

- Migration `0037_contact_link_integrity` repairs case-only relationship
  duplicates and multiple-primary collisions, then adds case-insensitive
  relationship identity and one-primary-per-role constraints for job and
  private-project links.
- The rollback removes only those integrity indexes. Packet 77's full
  canonical Contact snapshot rollback remains intact.

## Acceptance

- Every relationship tab renders the canonical directory and never the
  retired customer/crew list implementations.
- A multi-role Contact appears under every applicable filter and retains one
  identity/history.
- An account can link/unlink its Contact to both a canonical job and a private
  project; the unified work view keeps local-first relationship ordering and
  blocks cross-account access.
- A selected Supplier must be an active supplier-role Contact owned by the
  current account before a Materials record can be saved.
- CSV import/export handles quoted values, role aliases, multi-role rows,
  invalid rows, and duplicate reporting without presenting skipped rows as
  imported.
- Desktop, 390px, and 320px views contain header actions, long contact
  methods, work forms, and card actions without clipping or horizontal
  overflow.
- Build, lint, unit/frontend, database integration, E2E, focused rendered
  QA, dependency audit, migration rollback/reapply, diff integrity,
  deployment, and exact-source production checks pass before the packet is
  marked Verified.

