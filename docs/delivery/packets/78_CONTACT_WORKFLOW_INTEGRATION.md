# Packet 78 — Contact workflow integration

## Objective

Make the canonical Contacts directory useful at the moments where a trade
business actually needs it: pricing work, billing customers, buying
materials, and coordinating a job.

## Accepted implementation scope

- Reuse one accessible, role-aware Contact picker instead of maintaining
  separate customer and supplier dropdowns.
- Keep Estimate and Invoice document compatibility while selecting Customers
  from the canonical Contacts directory. Saved documents continue to retain
  immutable customer snapshots and compatibility customer IDs.
- Let Materials price-book entries select a saved Supplier and retain its
  canonical contact ID. A typed supplier name remains available for a
  one-time entry and is labeled by behavior rather than represented as a
  saved contact.
- Replace Work's device-only jobsite-contact editor for canonical jobs with
  authenticated job-contact links. A link stores relationship role,
  job-specific private notes, and a per-role primary flag without duplicating
  or deleting the underlying contact.
- Offer an explicit, record-by-record move path for older device-only
  jobsite contacts. A local record is removed only after its canonical
  contact and job link save successfully.
- Extend rendered Tools and Work lifecycle checks to cover Customer selection,
  saved Supplier selection, and canonical job-contact linking.

## Authorization and honesty contract

- Contact identity and job-contact links are account-owned and enforced on
  the server. A caller must be the job creator or a participant in its
  accepted active-work record, and may link only an active Contact owned by
  the caller's account.
- Linking a Contact to a job does not automatically share the Contact with
  another account, the crew, or a public RIVT profile.
- Removing a job link never deletes the Contact.
- RIVT Messages remains a conversation between actual RIVT accounts. An
  arbitrary private Contact is not presented as messageable because RIVT
  cannot honestly deliver an in-app message to an external email or phone
  number through that surface.
- No seed relationship, fabricated delivery state, or browser-only
  production fallback is introduced.

## Data and rollback contract

- No new migration is required. Packet 77's reviewed
  `0036_canonical_contacts` migration already created account-owned
  `contact_job_links` and the canonical contact identity.
- Existing Estimate, Invoice, Customer, project, and tool-record schemas
  remain compatible.
- The existing `0036_canonical_contacts.down.sql` rollback continues to
  archive complete canonical snapshots before removing canonical tables.

## Acceptance

- Estimate and Invoice can search, create, and select a Customer through the
  shared canonical picker.
- Materials can search, create, and select a Supplier and stores the selected
  canonical contact ID with the price entry.
- A canonical job can list, add/update, and unlink only the current account's
  Contacts, with no cross-account reads or writes.
- Older device-only jobsite contacts remain visible until the user explicitly
  moves them; successful migration does not duplicate a normalized
  email/phone match.
- Tools and Work remain usable at desktop and mobile sizes with 44px targets,
  no horizontal overflow, and clear account-sync/private-sharing copy.
- Build, application/security lint, unit/frontend tests, database integration,
  E2E, focused rendered QA, dependency audit, and diff integrity pass before
  merge or deployment.

