# RIVT product completion audit

Audit date: 2026-07-28 America/New_York

Baseline: `origin/master` at `5e838ab`

Current packet: `docs/delivery/packets/83_SHOP_TALK_NEWS_CONTINUITY.md`

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

### Completed — Contacts

Packet 79 closes the short-term-list problem:

- one multi-role Contact identity;
- canonical filters for Crew, Subs, Customers, and Suppliers;
- Estimate, Invoice, Materials, job, and private-project reuse;
- activity, archive/restore, CSV portability, duplicate prevention, and
  tracked RIVT referrals;
- server authorization and reversible relationship integrity.

Status: **Production deployed and exact-source verified at `8d2a1a7`.**

### Current — Work workspace records

Packet 80 closes the device-only accepted-job record boundary:

- canonical checklist, milestones, notes, and change orders;
- participant, author, and contractor decision authorization;
- exact-cents money records and honest manual-payment copy;
- correction, archive, restore, immutable history, and closeout export;
- shared counterpart notifications without leaking private notes;
- device-only unsent drafts and explicit loss-safe migration of older local
  records;
- conflict-safe, idempotent multi-device mutations.

Status: **Production deployed and exact-source verified at `ec784d5`.**

### Current — Professional identity and people discovery

Packet 81 closes the browser-only proof and fragmented-discovery boundary:

- canonical account profile plus account-owned credentials, dated
  availability, avatar, rates, and portfolio;
- explicit private/network visibility, correction, archive/restore, and
  append-only history;
- honest self-reported/evidence-on-file language without invented RIVT
  verification;
- managed media with ownership, signed reads, removal, and embedded-GPS
  rejection;
- explicit one-item-at-a-time portfolio publication;
- one privacy-filtered professional profile reused by search, Work
  applicants, Shop Talk authors, and linked Contacts.

Status: **Production deployed and exact-source verified at `2901255`.**
Migration `0039_professional_identity`, the seven-check production monitor,
and a disposable two-account privacy/media lifecycle all pass.

### Current — Messages and customer notes

Packet 82 closes the browser-only continuity and split-note boundary:

- participant-authorized managed message media with upload, local draft,
  retry, transactional send, signed read, removal, and 24-hour abandoned
  draft cleanup;
- account-owned conversation pin/archive preferences and reusable templates;
- persisted participant reactions with real shared counts;
- canonical private Contact notes with correction, archive/restore,
  immutable history, managed private media, and preserved legacy chronology;
- explicit loss-safe device migration and copy that never describes a
  private note as sent to a customer.

Status: **Production deployed and exact-source verified at `635d96d`.**
Migration `0040_messaging_customer_notes`, all 22 serial integration suites,
browser E2E, focused rendered suites, dependency audit, the seven-check
production monitor, and disposable authenticated run
`packet82-20260728053258-287136` pass. The live run proved two-party
preferences/reactions/media, private Contact-note CRUD/history/media,
outsider denial, relogin continuity, and cleanup.

### Current — Shop Talk and Trade News continuity

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

Status: **Locally verified; production release pending.** Migration
`0041_shop_talk_news_continuity`, 112 unit/frontend tests, all 22 serial
PostgreSQL integration suites, browser E2E, focused rendered suites, and the
dependency audit pass. The implementation includes explicit loss-safe device
migration, saved-article snapshots, structured clean-body discussions,
indexed cross-filter lookup, public-audience enforcement, and duplicate-race
navigation to the existing thread.

### Next 3 — Offline and recovery behavior

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

### Next 4 — Security, accessibility, and operations closure

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

RIVT is **not yet 100% product-complete** under this definition. Work
workspace records are the current completion packet. The machine launch-readiness and
incident-readiness gates pass, but they do not override the unfinished
server-continuity and physical-acceptance items above.
