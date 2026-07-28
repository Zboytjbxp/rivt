# Packet 81 — Professional identity and people discovery

## Objective

Finish the professional profile as one reusable, server-owned identity.
Tradespeople and contractors must be able to publish intentional work proof,
credentials, availability, service area, avatar, bio, trades, and reference
rates without exposing private contact information or presenting self-reported
evidence as RIVT verification.

## Completion contract

- Bio, headline, trade specialties, service area, broad availability, and
  rate references continue to use the canonical account profile.
- Credentials, dated availability windows, avatar, and portfolio items are
  account-owned records stored through authenticated APIs.
- Credentials distinguish `Self reported` from `Evidence on file`. Uploading
  a file never creates a `Verified by RIVT` claim.
- Credential number, dates, issuer, notes, evidence, and visibility can be
  corrected. Records can be archived and restored with immutable event
  history.
- Availability windows have start/end dates, available/limited/unavailable
  state, optional notes, and private/network visibility. Overlap is visible
  and never silently merged.
- Portfolio publication is item-by-item. New proof starts private; network
  publication and removal are explicit, reversible actions.
- Portfolio and avatar images use owned object storage records with content
  validation, bounded file size, signed reads, replacement/removal, and no
  browser-only production fallback.
- Older device-only credential entries move only through an explicit action.
  A local entry is removed only after its account record saves.
- One privacy-safe profile-detail endpoint powers global search, job
  applicants, Shop Talk authors, and Contacts linked to a RIVT account.
- Public profile detail never returns email, phone, exact address, private
  credentials, private availability windows, private rates, or private
  portfolio items.

## Authorization and data contract

- Owner routes require the authenticated account and return that account's
  private and network records.
- Viewer routes require an active, completed account, a published network
  profile, and no block in either direction.
- Upload association checks account ownership, expected kind, stored state,
  and supported image/document content.
- Every credential, availability, and portfolio update/archive/restore uses a
  required optimistic version.
- Mutations are idempotent where a retry could duplicate a business record.
- New record events are append-only and contain no credential document bytes,
  phone, email, or exact address.
- Migration `0039_professional_identity` is additive. Rollback removes only
  the three new record/event domains after the application stops using them;
  existing profile, rate, upload, job, review, and Contact data remain.

## Issues considered before implementation

1. **An uploaded license is not independently verified.** The data model and
   UI use evidence-state language only. No verified badge is created without
   a separate reviewed verification system.
2. **A private job photo is not automatically a public portfolio.** Portfolio
   proof is copied or uploaded intentionally into a separate item that starts
   private and can be unpublished without deleting the underlying work.
3. **Availability is not a promise.** Dated windows are reference information,
   can overlap, and do not reserve the user or accept work automatically.
4. **Reusable identity can become a privacy leak.** All discovery consumers
   use one server-filtered profile response rather than joining private
   account, Contact, credential-evidence, or project data in the browser.

## Three-things review after implementation

1. **A visibly safe work photo can still disclose its exact capture
   location.** Avatar, credential-image, and portfolio-image uploads are
   rejected when their supported image container carries an EXIF GPS
   directory. The user receives a specific correction message; RIVT does not
   silently publish the original bytes.
2. **Profile proof can be mistaken for RIVT endorsement.** The viewer keeps
   `Self reported` and `Evidence on file — not verified by RIVT` language,
   omits evidence files, and does not derive a verification badge from an
   upload.
3. **A reusable profile can bypass relationship privacy if each entry point
   assembles its own data.** Search, Work applicants, Shop Talk authors, and
   linked Contacts all open the same authenticated, server-filtered profile
   response. They do not receive email, phone, exact address, private rate,
   private availability, private credential, or private portfolio fields.

## Acceptance

- Owner CRUD, conflict, archive/restore, upload ownership, evidence-state,
  block, unpublished-profile, outsider, and privacy filtering are proven in
  PostgreSQL integration tests.
- Migration rollback/reapply preserves all pre-existing canonical profile and
  rate data.
- Rendered mobile and desktop QA covers empty/loading/error/retry, image
  upload, explicit publication, credential migration, availability dates,
  profile preview, and all four discovery entry points.
- Standard, Large, and Extra Large text, light/dark, 320–390px mobile,
  keyboard focus, screen-reader labels, 44px targets, and no horizontal
  overflow pass.
- Build, lint, unit/frontend, full database integration, E2E, focused
  rendered suites, dependency audit, diff integrity, deployment, migration,
  authenticated live proof, and exact-source production health pass before
  this packet is marked Verified.
