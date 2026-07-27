# RIVT product completion audit

Audit date: 2026-07-27 America/New_York

Baseline: `origin/master` at `8fb745a`

Current packet: `docs/delivery/packets/79_CONTACTS_COMPLETION.md`

## Why this exists

RIVT is not considered finished because a screen looks polished or because a
happy-path smoke passes. This register freezes what "complete" means, records
remaining cross-surface seams, and prevents a temporary local implementation
from being mistaken for a long-term product boundary.

## Definition of complete

A surface is complete only when all applicable conditions are true:

1. The primary workflow and its correction, archive/delete, recovery, and
   empty/error/loading/offline states exist.
2. Business data is server-owned with account/participant authorization.
   Browser storage may cache a draft or preference, but is not the only copy
   of a record the UI describes as saved or shared.
3. The record can be found and reused where the same business identity or
   work context is needed. The app does not create parallel silos.
4. Copy describes the action that actually occurred. Counts, delivery,
   sharing, verification, and payment states come from real evidence.
5. Keyboard, screen-reader, Standard/Large/Extra Large text, light/dark,
   320–390px phone, and desktop behavior meet the acceptance matrix.
6. Unit, integration, authorization, lifecycle, rendered UI, migration,
   dependency, operational-readiness, deployment, and exact-source checks
   pass in proportion to the risk.
7. The completion boundary and three post-implementation blind spots are
   documented before the packet is marked Verified.

## Completion register

### Current — Contacts

Packet 79 closes the short-term-list problem:

- one multi-role Contact identity;
- canonical filters for Crew, Subs, Customers, and Suppliers;
- Estimate, Invoice, Materials, job, and private-project reuse;
- activity, archive/restore, CSV portability, duplicate prevention, and
  tracked RIVT referrals;
- server authorization and reversible relationship integrity.

Status: **Production deployed and exact-source verified at `8d2a1a7`.**

### Next 1 — Work workspace records

Evidence:

- `WorkWorkspace.tsx` still stores change orders, completion checklist,
  payment milestones, field notes, and older contact records in
  `localStorage`.
- Visible copy correctly says checklist, payments, and notes are saved to the
  device, which is honest but not a finished multi-device job workspace.

Completion boundary:

- move checklist, milestones/payments, notes/decisions, and change orders to
  canonical active-work/project records with participant authorization,
  audit history, offline draft behavior, and conflict-safe retry;
- preserve the one-time explicit move path for older device records;
- prove contractor/tradesperson visibility and mutation boundaries.

### Next 2 — Professional identity and people discovery

Evidence:

- Profile completion still reads bio/certification/rate evidence partly from
  browser storage.
- Portfolio currently routes to job photos instead of owning a reviewed,
  intentionally shareable professional portfolio.
- Availability is a single server status rather than availability windows;
  profile service-area/privacy and credential/portfolio ownership remain
  partial in Gate A traceability.

Completion boundary:

- canonical server-owned bio, rate references, credentials with evidence
  states, availability windows, service area, avatar, and portfolio items;
- intentional portfolio publication and removal controls;
- reusable profile detail from search, job applications, Shop Talk, and
  Contacts without exposing private contact information.

### Next 3 — Messages and customer notes

Evidence:

- Canonical conversations/messages/receipts are server-owned, but message
  attachments remain an API shape without a complete authorized upload/read
  UI.
- Conversation templates, pins, archives, and emoji reactions are
  device-only.
- A customer-note photo remains only in the local thread while the adjacent
  text notes may sync; the product must not imply the photo synced.

Completion boundary:

- participant-authorized message media with upload, failure, retry, download,
  and removal states;
- account-owned message preferences where cross-device continuity is
  expected;
- customer notes and their attachments either persist as canonical private
  Contact activity or are explicitly limited to a local draft before save.

### Next 4 — Shop Talk and Trade News continuity

Evidence:

- Shop Talk posts, answers, reactions, moderation, media, and opt-in public
  discovery are canonical.
- Trade News follows, saved articles, scope, and location are device-only.
- News-to-discussion matching scans currently loaded post bodies, so a
  paginated or unloaded discussion can be missed and duplicated.

Completion boundary:

- account-owned News preferences;
- canonical article URL on Shop Talk discussions and an indexed
  server lookup;
- preserve source/image/freshness honesty and the existing public-consent
  boundary.

### Next 5 — Offline and recovery behavior

Evidence:

- The PWA can reopen its cached shell, but business writes do not have a
  product-wide offline queue/retry/conflict contract.
- Field use on unstable jobsites is a defining RIVT context; a cached shell
  alone must not be described as offline work support.

Completion boundary:

- select the field-critical offline records (notes, checklist, daily log,
  photos awaiting upload, calculator tape list where applicable);
- show queued/synced/failed/conflicted states;
- retry idempotently without duplicating financial or relationship records;
- document records that intentionally remain online-only.

### Next 6 — Security, accessibility, and operations closure

Evidence:

- Machine launch and incident readiness currently pass.
- Gate A traceability still records partial breached-password,
  enumeration/CSRF evidence, physical-device/screen-reader coverage, and a
  few production lifecycle checks.
- Product analytics code no-ops safely without configured endpoints/keys;
  configuration and launch funnel evidence must be verified operationally.

Completion boundary:

- close or explicitly waive each remaining Partial Gate A row with current
  code/test evidence rather than historical notes;
- complete physical iOS/Android, keyboard-only, and screen-reader matrices;
- verify live Stripe billing/Connect and analytics using non-secret public
  client configuration plus server delivery evidence;
- keep restore/incident readiness green at the final source.

### Final — Architecture subtraction and contract freeze

Evidence:

- Retired role-specific managers and compatibility adapters still exist in
  source even when production routing no longer reaches them.
- Historical traceability text contains superseded "remaining boundary"
  statements mixed with later completed work.

Completion boundary:

- delete unreachable fallback components after their migration/rollback
  windows close;
- retire transitional APIs only after all callers and rollback needs are
  removed;
- rewrite the live traceability summary from current source and tests;
- run every route/state matrix, freeze the release contract, deploy once,
  and exact-source verify it.

## Current launch statement

RIVT is **not yet 100% product-complete** under this definition. Contacts is
the current completion packet. The machine launch-readiness and
incident-readiness gates pass, but they do not override the unfinished
server-continuity and physical-acceptance items above.
