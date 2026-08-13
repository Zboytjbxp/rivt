# RIVT network-first simplification plan

Status: founder-directed product roadmap preserved against release candidate
`00926a93e4af46ea42fd9a8534d540ca38a70463`; implementation is intentionally
paused while Packet 99 and the active launch hold remain open.

Originally recorded: 2026-08-02

Reconciled with the current release candidate: 2026-08-13

## Decision

RIVT is the trusted work network for skilled trades.

The product is:

- network-first;
- work-centered;
- proof-driven;
- tools-supported.

This is a hierarchy correction, not a ground-up rewrite. Existing jobs,
offers, mutual acceptance, messages, active-work records, project evidence,
completion, reviews, estimates, invoices, contacts, profiles, Shop Talk, and
field tools remain valuable. The simplification work must give each capability
one obvious home and remove duplicate ways to represent the same person, work,
record, or action.

## Contract and release boundary

`RIVT_MASTER_BUILD_PROMPT.md` remains the executable product contract. This
roadmap records the founder-directed long-term hierarchy and the reversible
sequence for reaching it; it does not silently override conflicting contract
language, authorization rules, or the active Gate A packet.

The verified Packet 99 release candidate remains untouched. This plan:

- does not authorize deployment or launch;
- does not enable ACH or change any provider;
- does not create, migrate, rewrite, or delete production data;
- does not change pricing or entitlements;
- does not clear the active launch hold or any readiness blocker;
- does not authorize a broad UI rewrite.

Implementation begins only in separately reviewed, reversible packets after
Packet 99 reaches its acceptance boundary and the affected product-contract
language is explicitly versioned. Existing route aliases and stored records
remain readable during every transition.

## Product promise

> When your first call is booked, RIVT helps you know who to call next.

Supporting promise:

> Find proven people through real work and trusted relationships, then keep the
> people you want to call again.

The complete core loop is:

1. Create a proof-rich professional identity.
2. Save or confirm a professional relationship.
3. Find a credible person through evidence, availability, or a trusted path.
4. Send that person an appropriate work brief.
5. Discuss the scope and make an explicit offer.
6. Mutually accept the work.
7. Coordinate and document the job.
8. Confirm completion and bilateral outcomes.
9. Save, rebook, or refer the relationship.

## Simplification rules

1. One canonical record for each person, organization, job, conversation,
   invoice, project, and relationship.
2. One obvious home for every capability.
3. One primary action for the user's current decision.
4. Advanced controls appear only when their context requires them.
5. A private contact is not a connection, endorsement, crew member, or
   confirmed collaborator.
6. A favorite is not a trusted bench until a server-owned bench model exists.
7. A work brief extends the canonical Job and Offer state machines; it is not a
   parallel pseudo-job.
8. Person identity, professional intent, organization membership, and server
   authorization remain separate concepts.
9. Existing data is preserved through compatibility aliases and reviewed
   migrations.
10. Anything visible at launch must be complete and honest. Anything deferred
    remains intentionally absent rather than half-built.

## Canonical vocabulary

| Term | Meaning |
| --- | --- |
| Person | One human professional. |
| Organization | A company or trade business. |
| Contact | A private address-book record owned by one RIVT account. |
| Connection | A mutually accepted RIVT relationship. |
| Collaborator | A relationship confirmed through shared work or bilateral confirmation. |
| Crew | An explicit group with server-owned memberships and permissions. |
| Bench | A private saved group controlled by its owner. |
| Customer, supplier, sub | Relationship labels attached to a person or organization, not separate copies. |
| Work brief | A canonical job with a restricted audience and progressive distribution. |
| Review | A completion-linked, contextual outcome; private contact notes remain separate. |

## Target information hierarchy

### Primary concepts

The founder-directed long-term concepts are:

1. Home
2. Work
3. Crew
4. Shop Talk
5. Tools

Camera remains a one-tap contextual field action for active work, private
albums, Shop Talk media, and proof capture.

There is a current source-of-truth conflict: `AGENTS.md` and this founder
direction name Crew as a primary concept, while `RIVT_MASTER_BUILD_PROMPT.md`
currently names Camera as the third persistent destination and places People
under Work. The current release therefore keeps Camera in navigation. The
affected navigation implementation must pause until the master contract is
versioned to resolve that conflict. No route is removed before contextual
Camera access, deep-link compatibility, offline capture, and physical-device
acceptance are proved.

The first simplification packet therefore improves Home, Work, and People
without changing the five bottom-navigation destinations. Crew promotion is a
later explicit packet after reciprocal relationships and crew membership are
real enough to justify the name.

### Home

Purpose: show what needs attention now.

Keep:

- active work requiring action;
- unfinished estimates and invoices;
- accurate first-run completion steps;
- time-sensitive relationship or work requests once implemented.

Consolidate active work, paperwork, and onboarding into one ordered **Needs
attention** stack. Keep no more than one compact Shop Talk preview below it.

Remove the device-only availability pill from Home. Restore availability there
only when it updates the canonical server profile and can truthfully affect
discovery.

Correct checklist completion predicates so using any unrelated field record
cannot complete invoice or portfolio-proof steps.

### Work

Purpose: turn an opportunity or relationship into completed work.

Use one role-aware lifecycle:

- Contractor: **Posted · Responses · Active · History**
- Tradesperson: **Opportunities · Applications · Active · History**

Draft, open, and paused are filters inside Posted. Applicant pipeline belongs
inside Responses. Templates and Schedule are secondary actions, not parallel
lifecycle levels.

Within accepted work, use:

- Overview
- Records
- Money
- People

Today becomes the default Overview content. Replace vague **More** navigation
with the exact destination it opens.

Records belongs to the accepted-work workspace. Existing Tools and
notification deep links redirect to the correct Work record; no record is
deleted or duplicated.

### People, then Crew

Purpose today: one private professional relationship directory.

Use **People** until the reciprocal network model exists. Present All, Crew,
Subs, Customers, and Suppliers as relationship filters, not separate books.
A single record may carry several labels.

On mobile:

- show search and one Filter action;
- make Add person the primary action;
- place Import and Export together in a secondary menu;
- open a person by tapping the row;
- move Favorite, Edit, Archive, and invite-copy into an overflow menu;
- show synchronization only while saving, after a mutation, or on error.

Move Reviews out of the relationship-filter row. Completion-linked reputation
belongs on profiles and within the relevant person's work history. Private
review notes remain private notes.

Do not rename this destination Crew until the server supports reciprocal
connections, confirmed collaborators, private benches, introductions, crews,
crew memberships, and consent-aware visibility.

### Shop Talk

Purpose: practical trade knowledge and knowledge evidence.

Keep questions, answers, Verified Fix, reporting, real reactions, communities,
Trade News, and article discussions.

Consolidate post type and flair into one post-kind model after a compatibility
migration: Question, Discussion, Tip, and Safety/Code. Infer trade from a trade
community when possible.

Remove **Looking for Sub** from new-post creation. Work needs belong in Work so
they receive audience privacy, offers, mutual acceptance, records, and
completion. Existing posts remain readable.

Make Communities a browse/filter surface rather than a second full feed.
Demote community creation until local density justifies unrestricted creation.
Keep owner-only share, visibility, and delete actions in one overflow menu.

Trade News keeps For you, Local, and Saved. Show Critical only when critical
content exists. Routine stories should not expose internal impact-classifier
language. Discussion remains the primary in-product action; Read original is a
quiet external link.

### Camera

Purpose: create attributable work proof.

Keep one-tap capture, explicit destination safety, offline queueing, private
albums, before/after proof, gallery, and honest device-GPS copy.

Use one persistent destination chip and one Change action. Active jobs, other
work, private albums, and album creation belong in one chooser. Do not repeat
Shoot, Upload, destination selection, album creation, or recent photos across
several panels.

Camera is not also a Tools tile after its contextual and primary access paths
are reconciled.

### Tools

Purpose: execute and document work after a relationship becomes a job.

Keep the consolidated core:

- Heavy 16th
- Estimate
- Invoice
- Jobsite
- Materials
- Time & costs

Use one Tools heading and one launcher. Keep standalone use where it is useful,
with optional Attach to job context. Short card descriptions; title and icon
carry most of the meaning.

Do not expose hidden legacy tools as separate products. Before deleting any
implementation, prove its useful capability and stored records have an
explicit destination in the six retained groups.

### Shell, search, messages, notifications, and profile

- Preserve top-bar Search, Messages, Notifications, and Profile.
- Use one search field and one results surface.
- Add People/Crew as a first-class search target only after visibility and
  relationship authorization are enforced server-side.
- Opening the notification bell must not mark every notification read. Mark an
  item when opened or through an explicit Mark all read action.
- Keep notifications in the bell; remove the duplicate notification panel
  from Messages.
- Move private customer notes from Messages into the canonical person detail.
- Keep one View profile and one Settings entry in the account menu.
- Consolidate settings into Profile, Notifications, Account, and
  Business/Billing; appearance and security become clear subsections.
- Present the person as the primary identity and organization affiliation as
  secondary.
- Replace **Verified account** with exact evidence such as **Email and setup
  complete** unless stronger identity verification actually occurred.

### Onboarding and roles

The current contractor form stores **trades you hire for** in the same profile
field used for **trades you perform**. This can misrepresent a contractor's
specialties and must be separated through a reviewed migration.

Short term, onboarding may use a primary-use choice to personalize the first
experience. It must not imply that one person can only ever hire or only ever
perform work. Long term, model separately:

- person identity;
- professional intent;
- trades performed;
- trades hired;
- organization membership;
- organization permissions.

Server permissions remain authoritative throughout the transition.

## Verified-dead and compatibility cleanup candidates

The following are candidates for removal only after route/render/reference and
stored-data verification:

- `_ClientBookView`;
- `_CrewManager`;
- `_CrewInvitePlanner`;
- dead profile-search spotlight state;
- duplicate Inbox notification panel;
- legacy local customer-note UI after canonical-contact migration;
- hidden obsolete Trade News strip;
- dormant separately maintained Tools implementations whose capabilities and
  records have an accepted destination.

Removal must include automated proof that no active route renders the code and
that no stored data becomes unreachable.

## Delivery sequence

### Packet S1 — Visible hierarchy and dead-code subtraction

No database migration.

- Recompose Home as Needs attention.
- Correct checklist completion rules.
- Reduce Work to one role-aware lifecycle.
- Present People relationship labels as filters.
- Flatten person-card actions.
- Remove only verified-dead compatibility UI.
- Preserve primary navigation and all active routes.

Acceptance: existing records remain reachable; role-correct Work journeys,
mobile/desktop UI smokes, keyboard flow, large text, build, lint, full test,
E2E, and dependency audit pass.

### Packet S2 — Surface consolidation

No relationship semantics invented.

- Move Records into accepted Work.
- Move customer notes into person detail.
- Remove duplicate notifications and notification auto-read.
- Consolidate Camera destination/action duplication.
- Remove Looking for Sub creation while preserving historical posts.
- Consolidate Shop Talk classification and community browsing through a
  reviewed compatibility path.

Acceptance: route aliases preserve deep links; no stored record or historical
post is lost; accepted-work authorization and offline capture remain intact.

### Packet N1 — Consent-aware relationship foundation

Reviewed migration and rollback required.

- Reciprocal connections.
- Confirmed collaboration edges with provenance.
- Private saves and benches.
- Referrals and introduction requests.
- Crews and crew memberships.
- Per-edge visibility, consent, retention, block, and audit behavior.

Acceptance: an imported contact never becomes public or reciprocal; private
benches cannot leak through search, APIs, analytics, exports, or notifications.

### Packet N2 — Private work briefs

- Add selected-person, bench, connection, local-network, and public audiences
  to canonical Jobs.
- Add Interested, Ask a question, Talk about it, Not available, and Pass as
  pre-offer responses.
- Continue into the existing offer, mutual-acceptance, active-work, completion,
  and review state machines.

Acceptance: no parallel job entity; exact-address privacy and server
authorization remain unchanged; interest never implies a contract.

### Packet N3 — Proof and repeat work

- Record structured bilateral completion outcomes.
- Add Would work together again.
- Derive repeat-collaboration facts from canonical completed work.
- Add Rebook and referral actions.
- Project completed-work and useful Shop Talk evidence into profiles with
  explicit provenance.

Acceptance: no opaque trust score, fabricated count, or unconfirmed public
relationship.

### Packet N4 — Explainable discovery and Crew promotion

- Add relationship path, availability window, service area, project context,
  crew capacity, and credential requirements to people discovery.
- Explain why each result appears without a false precision score.
- Provide newcomer eligibility paths that do not require an existing insider.
- Promote Crew to primary navigation only after contextual Camera parity and
  full device/accessibility acceptance are complete.

Acceptance: ranking does not expose private edges or exclude qualified
newcomers by default; every reason is backed by current server-owned evidence.

## Explicitly deferred

- AI matching before evaluable outcome data exists.
- A global trust score.
- Public follower or connection counts.
- Unrestricted unsolicited messaging.
- Pay-per-lead, pay-to-apply, or pay-to-rank.
- Nationwide rollout before Jacksonville demonstrates repeat collaboration.
- Automatic licensing or compliance conclusions.
- New unrelated Tools.
- A silent replacement of current Individual Pro pricing or entitlements.

## Three-things review

Before each packet closes, ask what has not been considered. At minimum, every
review must test:

1. Could this change expose a private relationship, bench, note, location, or
   contact method?
2. Could this create a second source of truth or make an existing record
   unreachable?
3. Could this terminology claim consent, verification, availability,
   delivery, payment, or trust that the server cannot prove?

If the answer is uncertain, the affected behavior remains hidden and the
packet does not close.
