# RIVT product completion audit

Audit date: 2026-07-31 America/New_York

Baseline: `origin/master` at `29e3c613f2eb95a6583b52c671275e5046dde0d3`

Current packet: `docs/delivery/packets/87_MONEY_INTEGRITY_CONTAINMENT.md`

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

## 2026-07-31 deep re-audit

This pass reviewed the live product, the current production source, the
normalized data paths, authorization and provider boundaries, recovery and
deployment controls, focused mobile rendering, and the available automated
test evidence. A polished screen or a passing happy path was not treated as
completion.

### Evidence that is currently strong

- Production health identifies exact source and reports PostgreSQL,
  S3-compatible storage, Web Push, Sentry, Stripe Connect, and migration
  readiness without returning secrets.
- Anonymous private-route checks fail closed, session revocation is
  server-owned, Web Push is generation-tracked, and three owner-controlled
  physical devices received and opened real production alerts.
- Build, application/security lint, 229 unit/frontend tests, the mobile-actions
  rendered smoke, and the production dependency audit pass locally on the
  audited source. GitHub Actions has recent PostgreSQL 16 evidence, but the
  full workflow intentionally stops at `ACTIVE_LAUNCH_HOLD`.
- The five-primary-surface shell, Contacts directory, Work records, Shop Talk,
  Trade News, Camera, and Tools are substantial real product surfaces rather
  than placeholder navigation.
- Existing demo or starter material is labeled; the audit did not find a new
  fabricated marketplace count, payment success, message delivery, or public
  activity claim.

### Tier 0 — launch remains held

1. **Credential-incident closure is operationally incomplete.** Credential
   replacement, provider continuity evidence, the incident owner's explicit
   forensic-limit acceptances, and local Stage 1 review are recorded. The
   active launch hold remains intentional until the formal exact-source Codex
   Security scan, exact-runtime CI, fresh provider/cost evidence and approval,
   strict preflight, and Stripe connected-account delivery boundary are
   resolved or explicitly disabled.
2. **Backups do not yet meet the intended 24-hour RPO automatically.** Restore
   drills prove that a named artifact can be recovered, but artifact creation,
   missed-backup alerting, retention enforcement, and an independent failure
   domain are not yet a scheduled production control.
3. **The final physical accessibility matrix is incomplete.** Important mobile
   and Web Push paths were physically tested, but keyboard-only,
   screen-reader, large-text, reduced-motion, and full light/dark route
   acceptance is not closed.

These are not code-completion claims. They require explicit operational and
physical evidence before launch.

### Tier 1 — code launch blockers

#### Packet 87 — Money integrity containment (active)

- Local containment now prevents invoice/link amount divergence, invalidates
  stale payer redirects, locks immutable payment history, and retires new
  mutable manual Receivables writes without deleting legacy rows.
- Project and standalone delivery now prove the exact full invoice amount,
  serialize against payment rows, and record project delivery effects in one
  transaction.
- Exact rendered content supplies a stable provider retry identity. Concurrent
  different-key sends replay one delivery, and a lost-response retry restores
  the truthful sent label without sending again.
- Browser writes cannot forge paid/sent state, delivery proof, or provider
  metadata. Email requires an active verified account. Void, processing,
  settlement, refund, dispute, and recorded external-payment state cannot be
  erased by a conflicting manual transition.
- Stripe event handling is monotonic when consequential events arrive out of
  order, and same-status project updates no longer duplicate timeline,
  notification, or audit effects.
- Build, lint/security lint, 164 unit/frontend tests, browser E2E, focused
  rendered suites, dependency audit, and diff integrity pass locally.
- A freshly reset, disposable PostgreSQL 16.14 cluster passed all 22
  integration tests, including all 19 database-backed suites, with zero
  failures or skips. It was loopback-only, stopped, and removed afterward;
  production and the older Railway test URL were not used.
- Independent final review found no remaining Packet 87 code blocker, and its
  conditional isolated-database requirement is now satisfied locally.

Exit: commit, merge, deploy, verify exact source, and keep the broader launch
hold until the independent operational and physical launch boundaries close.

#### Packet 88 — Migration-ledger immutability

- Startup currently permits a known checksum-repair path to rewrite the
  applied migration ledger before verification.
- That weakens the otherwise strong rule that applied migration history is
  immutable and independently auditable.

Exit: remove silent repair from normal startup; require an explicit,
operator-audited, one-off recovery command with exact before/after evidence.

#### Packet 89 — Contacts review, recovery, and conflict policy

- A Contacts load failure can look like an empty address book, encouraging
  duplicate creation.
- CSV/vCard and selected-phone imports write records before a user reviews the
  normalized names, roles, and duplicate decisions.
- Contact mutations have no explicit optimistic-concurrency version, so two
  devices can overwrite each other's correction.

Exit: error/retry states distinct from empty, preview-before-import,
partial-retry without duplicates, and conflict-safe correction.

#### Packet 90 — Durable side-effect intents

- Email/provider success followed by database failure can leave delivery state
  uncertain.
- Stripe checkout/session creation occurs inside some database/idempotency
  transactions without a durable provider-intent/outbox record.
- Contact-note/template mutation and its history event are not uniformly
  atomic.

Exit: one reviewed outbox/saga pattern for email, Stripe session creation, and
history-bearing mutations; idempotent replay and reconciliation tests.

### Tier 2 — product completion before broad public launch

#### Cross-surface state honesty

- Home and Shop Talk can convert a server failure into an honest-looking empty
  state.
- Contact pickers do not always provide a load retry.
- A failed Shop Talk report can close as if submission succeeded.
- A missing deep-linked Shop Talk thread resolves to a generic selection state
  rather than loading, not-found, permission, or retry.

Exit: a shared loading/empty/error/offline/permission/retry state matrix and
route-level rendered tests.

#### Work and search continuity

- The shell's “active job” fallback can select the first loaded listing rather
  than an accepted active-work relationship.
- Global search omits canonical Contacts and part of the Tools catalog, and
  title-based handoff can be ambiguous instead of opening an exact record ID.
- Saved job templates do not yet open a genuinely prefilled new posting.

Exit: exact-ID navigation, permission-scoped grouped search, canonical
active-work selection, and real prefilled templates.

#### Account continuity

- Shop Talk bookmarks, Work saved searches, and job templates still have
  browser-only ownership paths.
- The activation checklist has completion predicates that can count unrelated
  activity and no user-facing restore after dismissal.

Exit: account-owned saved state with loss-safe local migration, exact
server-owned first-action markers, and restore/reset controls.

#### Camera evidence and transfer integrity

- GPS can be captured once and reused after the user changes jobsites.
- Multi-photo upload lacks full per-file progress, cancellation,
  duplicate detection, and resumable transfer.
- “Other active jobs” still uses empty covers rather than useful recent proof.

Exit: capture-time location with age/accuracy, explicit unavailable behavior,
and a resumable per-file batch state machine.

#### Performance and accessibility

- The Tools feature chunk remains disproportionately large because many tools
  and their CSS ship together.
- Full accessibility acceptance and performance budgets are not CI gates.
- CI uses Node 22 while the current production runtime evidence still includes
  Node 20.

Exit: second-level tool splitting, measurable JS/CSS/LCP budgets, accessibility
automation plus physical evidence, and one supported Node runtime across
build/test/production.

### Tier 3 — resilience and scale hardening

1. Replace permissive PostgreSQL TLS verification with a verifiable CA-backed
   connection before moving across an untrusted network boundary.
2. Define service-level objectives, capacity thresholds, load shedding, and
   a tested scale-up response. Current telemetry is useful but not a capacity
   contract.
3. Separate application, worker, database, and backup failure domains before
   claiming high availability or regional disaster tolerance.
4. Move scheduled production synthetics into independently reportable CI jobs
   so an intentional launch hold does not skip technical test evidence.
5. Pin third-party GitHub Actions to immutable revisions and avoid reinstalling
   the complete dependency graph every 30 minutes.
6. Create a portable container/IaC runbook and exercise an alternate-provider
   restore before calling the Railway exit path proven.
7. Add a durable data-lifecycle ledger for deletion, retention, legal hold,
   backup expiry, and object reconciliation.

### Architecture rules exposed by the audit

The remaining defects repeatedly come from three missing cross-product rules:

1. **One canonical owner per business fact.** An invoice amount, paid state,
   contact identity, job relationship, or saved item cannot have two writable
   ledgers.
2. **One durable intent for every external side effect.** Email, payment
   session creation, object deletion, and notifications need a local intent
   that can be reconciled after an ambiguous timeout.
3. **One declared conflict policy for every multi-device record.** Each draft,
   import, saved item, upload, and correction needs an owner, version, merge
   rule, visible sync state, and recovery path.

These rules should be applied packet by packet rather than through a wholesale
rewrite.

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
- Trade News follows, saved articles, scope, and location are account-owned
  with explicit loss-safe migration of older device choices.
- News-to-discussion matching uses structured canonical URLs and an indexed
  server lookup independent of pagination or the current client filter.

Completion boundary:

- account-owned News preferences;
- canonical article URL on Shop Talk discussions and an indexed
  server lookup;
- preserve source/image/freshness honesty and the existing public-consent
  boundary.

Status: **Production deployed and exact-source verified at `ef44c72`.**
Migration `0041_shop_talk_news_continuity`, 112 unit/frontend tests, all 22
serial PostgreSQL integration suites, browser E2E, focused rendered suites,
and the dependency audit pass. Disposable authenticated run
`packet83-20260728070811-f7d1a6` proves owner continuity/isolation,
structured clean-body discussions, indexed cross-role lookup, duplicate
prevention, answer visibility, and cleanup.

### Current — Offline and recovery behavior

Evidence:

- The PWA can reopen its cached shell, but business writes do not have a
  product-wide offline queue/retry/conflict contract.
- Field use on unstable jobsites is a defining RIVT context; a cached shell
  alone must not be described as offline work support.

Completed:

- field-critical punch-list items, job notes, Daily Logs, accepted-work
  photos, and private-album photos use one account-scoped outbox;
- queued/syncing/failed/conflicted states, retry, discard, conflict refusal,
  exponential backoff, storage limits, and stale-photo handling are visible;
- first-attempt idempotency keys survive replay, including ambiguous timeout
  recovery;
- the cached account/Work projection opens only when the browser explicitly
  reports offline and is removed on sign-out;
- financial decisions, relationships, completion, messaging, publication,
  delivery, and payments remain online-only;
- calculator tape measurements remain intentionally device-local.

Status: **Production deployed and exact-source verified at `a33ee1a`.**
The production monitor, all 22 serial PostgreSQL integration suites, three
browser E2E paths, focused rendered Work/Tools/mobile/Shop Talk suites, and
the dependency audit pass. Physical iOS/Android field validation remains in
the final operations acceptance matrix and is not claimed here.

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

RIVT is **not yet 100% product-complete** under this definition. Offline and
recovery behavior is production verified. Security/accessibility/operations
closure is next. The incident-readiness gate passes. The machine launch-
readiness gate remains blocked by `ACTIVE_LAUNCH_HOLD` and
`PAYMENT_PROVIDER_NOT_APPROVED`; even after those are resolved, the gate does
not override unfinished final architecture subtraction and physical-device
acceptance items above.
