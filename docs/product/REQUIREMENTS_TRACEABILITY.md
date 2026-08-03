# Gate A Requirements Traceability

## Packet 96 - Provider-evidence approval lifecycle (in progress)

- `GA-OPS-004` remains **Blocker**. The candidate defines how six stable
  recovery controls can be materialized from exact evidence and approved only
  afterward; it does not create, validate, restore, retain, or schedule any
  backup.
- `GA-OPS-005` remains **Partial**. The candidate defines five stable incident
  evidence controls and a separately protected post-evidence approval/hold
  decision. A valid hold clearance can suppress only `ACTIVE_LAUNCH_HOLD`, not
  any missing incident evidence or approval finding.
- `GA-OPS-007` remains **Partial**. Build, application/security lint, 537/537
  unit tests, the combined test command, four browser E2E journeys, diff
  integrity, and a zero-vulnerability production dependency audit pass.
  Independent review found and closed clean-runner dependency, hold-incident
  binding, and E/A branch-protection gaps. Pull-request CI and its disposable
  PostgreSQL integration proof remain required before packet acceptance.
- `GA-OPS-008` remains **Partial**. The workflow candidate binds exact source,
  evidence, and approval revisions, uses the read-only GitHub API to attest
  that E/A report protected, and validates both roots before dependencies or
  provider credentials. The protection flag does not by itself attest exact
  reviewer/ruleset strength. The change is not merged to `master` or deployed
  and creates no deployment evidence.
- `GA-OPS-009` remains **Blocker**. A reachable, fail-closed approval lifecycle
  is prerequisite control-plane work; it does not prove capacity, redundancy,
  failure domains, recovery, provider configuration, or launch readiness.
- Requirement maturity does not change. The checked-in operations policies do
  not yet declare the full 12-control materializer contract, nine provider
  adapters remain separate bounded work, and no protected `E` or `A` revision
  has been created.
- No merge to `master`, deployment, provider call, added cost, credential
  access, production-data action, launch-hold clearance, Railway Stage 1, ACH
  activation, incident closure, or public launch is authorized by this packet.

## Packet 95 - Provider-evidence policy boundary (merged into release candidate)

- `GA-OPS-004` remains **Blocker**. This packet does not create or validate
  recovery evidence; it prevents later evidence from redefining pinned
  recovery policy.
- `GA-OPS-005` remains **Partial**. Incident policy remains subject to the
  active launch hold and independent evidence and approval requirements.
- `GA-OPS-007` gains a clean production build, application/security lint,
  486/486 unit/frontend tests, all four browser E2E journeys, zero known
  production dependency vulnerabilities, the non-reproducing original PoC,
  and a clean independent change-aware security re-review. Pull-request Gate A
  run `30788718976` additionally passes all 28 disposable-PostgreSQL
  integration tests, the same four browser journeys, patch formatting, and
  the production dependency audit. Documentation-only Gate A run
  `30789376060` repeats the same pre-readiness pass. PR #15 merged into the
  release-candidate branch as
  `ce757652fa49d4592dcf6e13c4291cd8e4db18aa`. `GA-OPS-007` remains
  **Partial** pending exact deployed-source evidence; both runs stop only at
  the intentional final enforcement of the unchanged 21-item readiness block.
- `GA-OPS-008` remains **Partial**. Packet 95 is not merged to `master` or
  deployed and creates no deployment evidence.
- `GA-OPS-009` remains **Blocker**. This authority-boundary fix does not prove
  production hosting, redundancy, recovery, or launch readiness.
- No merge, deployment, provider call, added cost, credential access,
  production-data action, launch-hold clearance, Railway Stage 1, ACH
  activation, or incident closure is authorized by this packet.

## Packet 87 — Money-integrity containment (local verification)

- `GA-FND-003` gains one authoritative amount boundary for each invoice path:
  standalone customer documents use the account-owned tool record, while
  accepted-work documents must match the participant-authorized project
  invoice and its unpaid balance exactly.
- `GA-FND-004` gains server-side refusal for deleted, void, mismatched,
  processing, settled, externally paid, refunded, and disputed
  invoice/payment combinations. Public payer redirects revalidate the current
  invoice before forwarding to Stripe, and consequential out-of-order Stripe
  events cannot erase settlement, refund, or dispute truth.
- `GA-UX-005` gains honest Receivables and delivery behavior. New manual
  `payment_record` writes are retired; older rows remain readable but cannot
  contribute to current totals or claim settlement. A bank-link creation no
  longer labels an invoice sent.
- `GA-UX-006` gains content-bound invoice delivery: the provider retry
  identity derives from the exact recipient and rendered document,
  different-key concurrent sends serialize, and an identical lost-response
  replay restores the truthful sent label without another email. Browser
  writes cannot forge paid/sent state or provider metadata, provider delivery
  requires an active verified account, and repeated status writes do not
  duplicate project effects.
- Local evidence: production build, full/security lint, 164 unit/frontend
  tests, all three browser E2E journeys, Tools/Invoice, mobile-actions, and
  Work-lifecycle rendered suites, dependency audit, and diff integrity pass.
  A freshly reset disposable PostgreSQL 16.14 cluster passed all 22
  integration tests, including all 19 database-backed suites, with zero
  failures or skips. It was loopback-only, stopped, and removed after the
  run; production and Railway were not used. Independent review found no
  remaining code blocker.
- No migration, production data, provider configuration, paid resource,
  deployment, or live payment changed. Packet 87 remains launch-blocking until
  merge, deployment, and exact-source acceptance pass.

## Operational Incident Addendum - 2026-07-29 Credential Containment

- `GA-OPS-007` gains local Web Push retirement instrumentation: migration
  `0042_push_vapid_generation` preserves legacy subscriptions as unknown,
  constrains non-null values to nonsecret 64-character SHA-256 fingerprints,
  and rolls back without deleting subscription rows. Registration accepts
  cached clients without guessing their key, rejects unrecognized generation
  claims, and clears inherited success proof when a binding changes. Delivery
  records the generation that actually succeeds while preserving the
  authentication-only fallback rule. A bounded read-only
  `npm run push:readiness` command reports counts and fails closed on previous,
  unknown, unrecognized, unproven, stale-claim, stale-backlog, or recent
  terminal-failure state without printing endpoints, account IDs, keys, or
  database credentials.
- Current local evidence includes production build, application/security lint,
  158 unit/frontend tests, all three browser E2E journeys, diff integrity, and
  a zero-vulnerability production dependency audit. GitHub Actions run
  `30577678020` passed build, lint, all 152 unit/frontend tests, and all 22
  database integration tests against PostgreSQL 16. The workflow then stopped
  only at the intentional `ACTIVE_LAUNCH_HOLD`, so the complete workflow is not
  represented as green.
- `GA-OPS-008` gains exact-source production evidence from Railway deployment
  `9a7d4657-5c2d-4b11-8333-2b210601227c` serving
  `21e534feef86958f58fda108f26c6184174d346d` with migration
  `0042_push_vapid_generation` ready. Public health returned `ok: true` with
  PostgreSQL/S3-compatible storage healthy and Web Push configured; the
  expected-source monitor passed in 543 ms. The first production read-only
  inventory failed closed with two eligible legacy subscriptions still
  unknown, zero current-generation delivery proofs, and no due, stale, or
  recently terminal queue work. A desktop session was refreshed, but its
  device alerts were off and no permission or subscription was silently
  created. Final acceptance then passed on owner-controlled Android, iOS
  16.7.16, and iOS 18.7.8 devices: each received and opened a real production
  alert. Stale sessions were removed through the Security UI, and one
  explicitly authorized legacy test-account notification registration was
  removed without deleting its account or login session. Railway deployment
  `e4dbe7fb-5290-4732-b377-b164002217a7` serves exact source
  `922e94415ffd3bea3e2e6ac633705b91c283bb8b`; health is green, the
  expected-source monitor passed in 605 ms, and final `push:readiness` reports
  eligible/active/successful `3/3/3`, previous/unknown/retired `0/0/0`, and a
  clear outbox. The Web Push retirement boundary is closed. The older Railway
  Stage 1 worker branch must still be rebased and re-reviewed so its success
  path preserves this generation evidence before any new Stage 1 approval.
- `GA-SEC-001`, `GA-OPS-005`, and `GA-OPS-008` gain completed Sentry
  credential-rotation evidence. Railway deployments
  `599620ce-18fc-4e86-b638-88283dd18857` and
  `c6ddf9c8-91a3-4953-a47c-70c72deb154e` installed the replacement DSN and
  exact-source verifier hardening. Live health and the 590 ms production
  monitor passed on source
  `f505e5fcdd9874a172bb61b59ab083a2ff86e6d0`. Exact event
  `52d1e8add9f7492eb440de033209da0e` was indexed as a High-priority production
  issue and triggered the configured alert before the prior `Default` key was
  disabled. Exact post-retirement event
  `7ed1315e474448ce9807dbb4bd6bf420` was then accepted and indexed on the same
  release. Provider audit and 14-day usage review found only the expected key
  actions, 20 accepted errors, zero filtered/rate-limited/invalid errors, and
  no significant spike. No misuse indicator was identified in available
  Sentry evidence; unavailable evidence is not represented as proof of no use.

- `GA-OPS-004` gains verified backup-key rotation and historical recovery:
  new writes use the active key; restore accepted active plus previous without
  masking authenticated payload corruption; a fresh active-key artifact
  restored 109 tables/8,768 rows; the 2026-07-29 legacy artifact restored 109
  tables/8,760 rows; and the 2026-07-25 source-schema artifact restored 82
  tables/7,028 rows. Every manifest comparison returned zero differences, the
  independent critical-table checks passed, and the previous key and temporary
  restore URL are now absent from the running service.
- `GA-OPS-005` gains a dated incident record and credential-rotation runbook
  covering exact environment confirmation, approval and cost stops,
  one-provider-at-a-time verification, old-credential revocation, and a rule
  that source rollback never restores compromised credentials.
- `GA-OPS-005` also gains enforceable operator-tooling containment: the local
  production-smoke wrapper no longer retrieves a whole Railway service
  environment, accepts only explicitly named temporary values, limits
  credential inheritance by smoke type, and is protected by a recursive
  executable-script/CI scan that fails on reintroduced environment-list
  commands.
- `GA-SEC-001` and `GA-OPS-005` gain a shared structured-logging boundary
  that recursively removes credential material and direct customer PII,
  scrubs secret-bearing provider/database error text, handles circular
  values, and prevents callers from forging reserved log metadata. Focused
  regression coverage preserves operational request/account/provider IDs and
  status fields while proving the protected values do not reach serialized
  output.
- `GA-OPS-007` gains focused automated coverage for backup key rotation and
  transitional Web Push fallback behavior plus passing production build,
  application/security lint, 137 unit/frontend checks, all 22 tests across the
  20 PostgreSQL integration files in a clean isolated database, and the full
  three-journey browser E2E chain twice consecutively. Diff integrity and the
  production dependency audit pass with zero known vulnerabilities.
- `GA-OPS-007` also makes the external production monitor and live Gate A
  hardening check fail closed unless Google OAuth, server-side session
  security, and Sentry error monitoring report configured. The enhanced
  expected-source monitor passed in 562 ms.
- `GA-OPS-005` gains a design-only object-storage audit portfolio that traces
  every direct application S3 authority path, compares three materially
  different control models, and recommends a centralized gateway backed by
  the existing append-only `audit_events` table. It adds no migration,
  provider setting, service, or cost and does not claim historical object
  access can be reconstructed.
- `GA-OPS-008` gains exact-source production evidence for deployment
  `4af32f02-fd17-4899-9b62-74ac4c565590` serving
  `a3be803cc5ad2563d100870663dbf6dc51307126`. The 730 ms monitor passed with
  PostgreSQL/S3-compatible storage healthy, Sentry/Web Push/Stripe Connect
  configured, and seven anonymous private-route checks closed. PostgreSQL,
  object storage, Stripe API/webhooks, Resend, backup encryption, and the
  authentication metadata pepper have completed rotation evidence.
- Transitional Web Push continuity tries the active VAPID pair first, retries
  the previous pair only after a definitive authentication rejection, and
  migrates only existing opted-in clients.
- `GA-OPS-008` also gains physical Web Push migration and retirement evidence:
  the incident owner confirmed a real alert on an already opted-in controlled
  device; both previous VAPID variables were removed; deployment
  `a29ff982-c10c-4ec3-b8e6-9fd323e65837` succeeded on exact source
  `599c352b3c69592a8afcf1182e73e8ebbce5dfdb`; secret-safe runtime checks
  found only the active pair; and the expected-source monitor passed in 592 ms.
  Final generation-tracked acceptance later passed on controlled Android plus
  iOS 16.7.16 and 18.7.8 devices. Deployment
  `e4dbe7fb-5290-4732-b377-b164002217a7` serves
  `922e94415ffd3bea3e2e6ac633705b91c283bb8b`; its 605 ms monitor and
  post-deploy readiness inventory passed with current-key delivery proof for
  all three eligible devices and no unknown, previous, retired, or stale
  delivery state.
- `GA-OPS-008` gains complete Google OAuth secret-rotation evidence: provider UI
  verifies `support@rivt.pro` owns production project `rivt-499402`; two unused
  replacement candidates were deleted before installation; Railway deployment
  `0898208b-707f-49c3-b9b9-d0938e157542` serves exact source
  `04f13e006cae545a33002d2225f90ab0d8b7e9c9`; and public health,
  provider-configuration, and expected-source production-monitor checks pass.
  A fresh `zboytjbxp@gmail.com` OAuth journey completed a real 131 ms callback,
  established a server session, and rendered the authenticated RIVT Home
  workspace; an earlier expired transaction failed closed before exchange. The
  secret created June 13 was then disabled and deleted on July 30; final
  provider inventory contains exactly one enabled July 30 replacement. A
  second fresh owner-controlled Google sign-in completed after retirement and
  rendered authenticated RIVT Home, proving the remaining replacement serves
  production callbacks after the prior secret's deletion. At
  approximately 14:33 UTC, production health returned `ok: true`, the provider
  probe reported Google configured, and the expected-source monitor passed
  against build `04f13e006cae545a33002d2225f90ab0d8b7e9c9`.
- `GA-SEC-001`, `GA-OPS-005`, and `GA-OPS-008` gain production proof for the
  incident logger and monitor hardening. Railway deployment
  `e12e66b2-9701-44d6-b57f-8e12fe436738` serves exact source
  `5d14ba9cf6efce81b1f503fe64ecfd6837261e43`; public health reports ready
  migration `0041_shop_talk_news_continuity`, healthy PostgreSQL/S3-compatible
  storage, and configured Sentry, Web Push, and Stripe Connect. The
  expected-source monitor passed in 583 ms with Google/session checks healthy,
  all seven anonymous private routes closed, and controls open. An
  owner-controlled authenticated reload rendered RIVT Home without horizontal
  overflow, and the bounded startup-log review found no application failure.
  Current-head evidence includes 140 passing unit/frontend tests, full browser
  E2E, application/security lint, build, diff integrity, and zero known
  production dependency vulnerabilities.
- Requirement maturity remains Partial because final provider-review
  synthesis, explicit incident-owner acceptance of the
  historical database/object-storage forensic limits, and a fresh Railway
  Stage 1 re-review and approval remain open. The bounded
  PostgreSQL error classification found no authentication failure, `FATAL`, or
  `PANIC` event. An explicit
  `ACTIVE_LAUNCH_HOLD` makes the automated launch gate fail closed until every
  incident exit criterion is verified. Railway Stage 1 remains paused and its
  earlier approval cannot be reused.
- `GA-SEC-001` gains deployed Sentry-boundary containment at source
  `ecd6af85d94f3f907ccdecf07c600356f34613fc` and Railway deployment
  `fbcd0e9c-aead-4c91-926b-0be7d27161d1`: the monitoring
  payload reuses the structured logger's sensitive-field and string scrubbers
  for exception messages, stack frames, nested context, and tags. A focused
  regression proves known provider credentials, authorization material,
  credential-bearing URLs, query secrets, and email addresses do not reach the
  serialized Sentry event while safe request/operational fields remain.
  Exact-source health and the production monitor passed in 645 ms without
  injecting a live credential or customer record.
  Production currently has the primary Sentry variable present and the legacy
  alias absent, verified by a value-free in-container check; this does not
  satisfy the still-open replacement-key and provider-ingestion proof.

## Packet 85 — Security, accessibility, and operations closure evidence

- `GA-SEC-001` gains privacy-preserving breached-password screening on signup
  and reset: the raw password and full digest remain inside RIVT, only a
  padded five-character range prefix is sent, compromised values fail with a
  typed error, and provider failure is redacted and fail-soft.
- `GA-SEC-002` gains equal-work invalid login handling plus Fetch Metadata,
  exact Origin, and Referer enforcement for state-changing browser requests.
  Stripe webhooks remain outside the browser guard and the state/nonce-bound
  Apple form-post callback has one exact path exemption.
- `GA-SEC-004` gains resolved-address enforcement for Trade News Open Graph
  requests and every redirect, closing private, loopback, link-local,
  carrier-grade NAT, multicast, documentation, and reserved network targets.
- `GA-UX-006` gains a current authenticated automation matrix for Home,
  Work/Contacts, Camera, Shop Talk, Tools, search, notifications, messages, and
  account surfaces across mobile/desktop, light/dark, 200% text, reduced
  motion, labels, keyboard focus, dialog focus, target size, overflow, and
  landmarks. Physical iOS, Android, desktop keyboard-only, and real
  screen-reader proof remains open and is not represented as automated.
- `GA-OPS-002` and `GA-OPS-004` retain fresh approved incident rehearsal,
  isolated restore, recovery-policy, and routing evidence. Both
  `incident:readiness -- --require-ready` and
  `launch:readiness -- --require-ready` pass.
- `GA-OPS-007` gains a sealed 245-file standard security scan with complete
  coverage and three remediated findings, plus passing build, application and
  security lint, the full `npm run test` aggregate with 118 unit/frontend
  tests and all 22 serial PostgreSQL integration suites, all three E2E paths,
  five rendered product suites, diff integrity, and zero production
  dependency vulnerabilities. GitHub Gate A Safety run `30405816013` passed
  build, lint, the full aggregate, readiness, all three separately named
  browser scenarios, and the production dependency audit.
- `GA-OPS-008` gains production evidence: Railway deployment
  `a52b5201-57a4-4046-a3d1-4b8200653f63` serves exact source
  `ef468578ad19fc8dc94627baf0df9a9e308d9fae` with ready migration
  `0041_shop_talk_news_continuity`, PostgreSQL, S3-compatible storage,
  configured breached-password screening, Sentry, Web Push, and Stripe
  Connect. The 497 ms production monitor passed seven anonymous private-route
  checks with operational controls open. Authenticated accessibility run
  `ui-a11y-20260728220924-9f3afc` passed seven live scenarios and closed both
  disposable accounts. `GA-UX-006` remains Partial only for the explicitly
  human physical-device and real-screen-reader boundary.

## Packet 84 — Offline-recovery evidence

- `GA-FND-004` gains an account-scoped device outbox whose replay still uses
  the authenticated server cookie and the original idempotency key. Another
  account's rows are excluded from display and replay.
- `GA-PRJ-001` gains durable interrupted-connectivity recovery for accepted
  Work punch-list items, job notes, Daily Logs, and project photos without
  moving financial decisions, completion, or messaging into browser-only
  state.
- `GA-UX-005` gains explicit queued/syncing/failed/conflicted states,
  retry/discard, conflict refusal, bounded backoff, storage-limit copy, and a
  documented online-only action boundary.
- `GA-UX-006` gains rendered Work, Daily Log, and Camera `503` recovery plus
  a production-service-worker E2E that reopens the cached shell and active
  Work at 390px while explicitly offline.
- `GA-OPS-007` gains a clean build, application/security lint, 113
  unit/frontend tests, all 22 serial PostgreSQL integration suites, three
  browser E2E paths, focused Work/Tools/Shop Talk/Trade News/mobile-action
  rendered QA, diff integrity, and zero production dependency
  vulnerabilities.
- Production source `a33ee1adc91b124e202408730cd6f7381e1c3eb9`,
  health, and the seven-check production monitor are verified. Physical-device
  evidence remains in the final operations acceptance matrix; Packet 84 is
  Verified without claiming that manual hardware matrix complete.

## Packet 82 — Messages and customer-note continuity evidence

- `GA-FND-003` gains additive migration
  `0040_messaging_customer_notes`: versioned account conversation
  preferences/templates/reactions, canonical private Contact notes, managed
  attachment lifecycle fields, and append-only continuity events. The
  rollback detaches only Packet 82 media and preserves prior conversations,
  messages, jobs, Contacts, and work.
- `GA-FND-004` gains participant authorization for conversation preferences,
  reactions, and media; creator-only media removal; owner-only Contact
  note/history/media access; optimistic versions; idempotent creates; signed
  private reads; content/type/size validation; and embedded-GPS rejection.
- `GA-UX-003` gains one coherent Inbox boundary: real accepted-work Messages
  and explicitly private notes on the same canonical Contact used in Work,
  Estimates, Invoices, and Contacts.
- `GA-UX-005` gains honest staged/failed/retry message upload states, persisted
  shared reaction counts, loss-safe explicit legacy migration, correction,
  archive/restore, immutable note history, preserved occurrence dates, and a
  24-hour abandoned-message-upload expiry.
- `GA-UX-006` gains rendered mobile and desktop Inbox evidence in light and
  dark themes, with the selected mobile conversation ahead of the thread
  index and a stable desktop two-column layout.
- `GA-OPS-007` has a clean build/lint, 111 unit/frontend tests, all 22 serial
  PostgreSQL integration suites, migration rollback/reapply, fail-closed
  authentication and Jobs/discovery E2E, every focused rendered suite, and
  zero production dependency vulnerabilities.
- `GA-OPS-008` gains production evidence: Railway application deployment
  `67d196bc-791a-4a8b-8101-ae2d9541032e` and exact-source release
  `6cf74104-0d57-4a12-9af6-4627e703d8a2` succeeded; live health serves
  `635d96d292bd32f73ecd0f42ad3d27386bfa789c` with migration
  `0040_messaging_customer_notes` ready; the exact-source monitor passed with
  seven anonymous private-route checks; and authenticated disposable run
  `packet82-20260728053258-287136` proved two-party
  preferences/reactions/media plus owner-only Contact-note CRUD/history/media,
  outsider denial, relogin persistence, and cleanup. Packet 82 is Verified.

## Packet 81 — Professional-identity evidence

- `GA-FND-003` gains additive migration
  `0039_professional_identity`: versioned credentials, dated availability
  windows, intentionally published portfolio items, and append-only identity
  events. Its rollback removes only those new domains and safely detaches
  their managed uploads.
- `GA-FND-004` gains owner-only mutation, required optimistic versions,
  idempotent creates, block/unpublished-profile denial, network/private
  filtering, upload ownership, and one server-side viewer projection that
  excludes contact details, exact address, credential evidence, and private
  profile records.
- `GA-PRO-002`, `GA-PRO-005`, and `GA-PRO-006` gain one durable professional
  identity with credential evidence states, dated availability,
  item-specific portfolio publication, managed avatar/work-proof media, and
  embedded-GPS rejection.
- `GA-UX-003` gains one profile-detail contract reused by global search,
  Work applicants, Shop Talk authors, and linked Contacts instead of four
  independently assembled identity cards.
- `GA-UX-005` gains explicit local-credential migration, correction,
  archive/restore/history, honest evidence language, loading/error/retry, and
  loss-safe private defaults.
- `GA-UX-006` gains rendered light/dark, Extra Large text, 390px, and 320px
  coverage. Visual review found and fixed a transparent portal surface that
  functional assertions alone missed.
- `GA-OPS-007` has a clean build/lint, 109 unit/frontend tests, all 22 serial
  database integration tests, E2E, focused rendered suites, migration
  rollback/reapply, and zero production dependency vulnerabilities.
- Railway application deployment
  `225015f8-3b7d-4c33-b0ef-646254f2bfbd` and exact-source release
  `8f1c87da-1051-4191-8442-0ed86b97b584` succeeded. Live health reports
  source `2901255fae8a6c4c8e5f7615e1a51d031dad8c92` with
  `0039_professional_identity` ready; the production monitor and disposable
  two-account privacy/media lifecycle pass. Packet 81 is Verified.

## Packet 80 — Work-workspace-record evidence

- `GA-FND-003` gains additive migration
  `0038_project_workspace_records`: canonical, versioned checklist,
  milestone, change-order, and note records plus append-only audit events.
  The rollback removes only the new workspace tables.
- `GA-FND-004` gains accepted-work participant authorization, author-only
  private notes, contractor-only milestone writes and change-order
  decisions, outsider denial, required optimistic versions, and idempotent
  mutations.
- `GA-PRJ-001` gains the durable operational layer around the accepted-work
  project: shared records, counterpart notifications, archived-record
  recovery, immutable history, and closeout report inclusion.
- `GA-UX-003` gains one coherent Work record surface across checklist,
  money, changes, and notes instead of browser-only silos.
- `GA-UX-005` gains honest offline/manual-payment boundaries, cents-accurate
  money, loss-safe device-record migration, correction controls, and private
  note exclusion from notifications and closeout exports.
- `GA-UX-006` gains a 390px light/dark lifecycle that creates, edits,
  archives, restores, and reads a synced record without the fixed navigation
  covering content.
- `GA-OPS-007` currently has a clean production build and lint plus focused
  project integration and Work rendered QA. Full repository, migration,
  dependency, E2E, deployment, and production evidence remain in progress;
  Packet 80 is not yet marked Verified.

## Packet 79 — Contacts-completion evidence

- `GA-FND-003` gains migration `0037_contact_link_integrity`, a reversible
  integrity layer for canonical Contact relationships across jobs and private
  projects. Case-only relationship duplicates and conflicting primary flags
  are repaired before unique constraints are installed.
- `GA-FND-004` gains server authorization for private-project Contact links,
  unified Contact work history, and selected Materials suppliers. A caller
  cannot read another account's project relationships or save another
  account's, archived, or non-Supplier Contact as a price-book supplier.
- `GA-UX-003` gains one long-term relationship model: All, Crew, Subs,
  Customers, and Suppliers are filters over the same multi-role Contact
  identity. Estimate, Invoice, Materials, jobs, and private projects reuse
  that identity. Crew/Sub Contacts expose a real tracked referral link rather
  than a planning-only invite ledger.
- `GA-UX-005` gains full CSV portability, duplicate/invalid-row reporting,
  honest copy-only invite feedback, and one real activity stream without
  fabricated delivery, sharing, or relationship counts.
- `GA-UX-006` gains desktop, 390px, and 320px rendered coverage for canonical
  role filters, long contact methods, import/export/add controls, activity,
  work linking, and wrapping card actions. Container clipping found during
  screenshot review was fixed even though the page-level overflow assertion
  had passed.
- `GA-OPS-007` has a clean production build and lint, 104 passing
  unit/frontend tests, all 21 passing database integration suites,
  fail-closed authentication and job-discovery E2E, authenticated Contacts,
  guest, Work, Tools, and Shop Talk rendered QA, zero production dependency
  vulnerabilities, and clean diff integrity.
- Packet 79 is **Verified**. Railway application deployment
  `cc44a6b7-828d-494d-991d-eb04a5c4663c` and exact-source deployment
  `1b1ae222-e08b-4887-8cd9-1c6bc08808c5` serve commit `8d2a1a7`;
  production migration `0037_contact_link_integrity` is ready; the production
  monitor passes; and live Contacts/project-Contact routes fail closed for
  anonymous callers.

## Packet 76 — Tools launcher-subtraction evidence

- `GA-UX-003` gains a quieter fixed Tools information architecture: all seven
  apps remain visible once, while device-only pin management and broad
  Field/Business labels no longer compete with tool identity.
- `GA-UX-005` gains honesty evidence: the launcher no longer presents
  Customize as though it changes tool capabilities when it only changed local
  ordering. Every card remains a named button and its adjacent icon remains
  decorative.
- `GA-UX-006` gains desktop, 390px, and 320px rendered evidence in light and
  dark themes for the fixed order, absent management chrome, unique
  launchers, and no horizontal overflow.
- `GA-OPS-007` gains a production build, clean lint, 103 unit/frontend tests,
  all 20 serial PostgreSQL integration suites, fail-closed authentication and
  Jobs/discovery E2E, focused rendered Tools QA, diff integrity, and a
  zero-vulnerability production dependency audit.
- `GA-OPS-008` gains production evidence: Railway application deployment
  `d1ed67d2-8b4c-4dee-b411-53302bcaf3a8` and exact-source metadata deployment
  `e173434d-1f96-44a3-ac63-112d589b7c04` serve feature source
  `c2a698fab0812d0324053e01fbc0802f13715663`; live health reports ready
  migration `0035_job_budget_floor`, PostgreSQL/S3-compatible storage, and
  configured Sentry, Web Push, and Stripe Connect; the exact-source monitor
  passed with all seven anonymous private-route checks and controls off.
- Packet 76 is **Verified**. It changes no tool behavior, record,
  authorization, API, schema, migration, or production data.

## Packet 75 — App icon-system evidence

- `GA-UX-003` gains one coherent recognition system across Home, Work,
  Camera, Shop Talk, and Tools: distinct destination identities, distinct
  Work and Shop Talk section identities, and a separate command layer for
  global search, messages, and notifications.
- `GA-UX-005` gains icon-only honesty/accessibility evidence: top-bar
  commands expose labels and tooltips, decorative artwork is hidden beside
  visible text, and previously unnamed cancel/delete/checklist controls now
  expose their actual action.
- `GA-UX-006` gains rendered desktop, 390px, and 320px evidence across
  Standard/Large/Extra Large text and light/dark themes for unique icon
  identity, 44px Work switcher targets, contained navigation, no horizontal
  overflow, and a non-clipping Shop Talk Post action.
- `GA-OPS-007` gains a production build, clean lint, 103 unit/frontend
  checks, all 20 serial PostgreSQL integration suites, fail-closed
  authentication and Jobs/discovery E2E, four focused rendered UI suites,
  diff integrity, and a zero-vulnerability production dependency audit.
- `GA-OPS-008` gains production evidence: Railway application deployment
  `c31273f0-524f-4a42-9515-2dbb94bb100c` and exact-source metadata deployment
  `8be00a1c-78b7-4f73-af3d-8a8b33634725` serve feature source
  `9f79fa59333dc9e27387f0ec7034939ec9854dbe`; live health reports ready
  migration `0035_job_budget_floor`, PostgreSQL/S3-compatible storage, and
  configured Sentry, Web Push, and Stripe Connect; the exact-source monitor
  passed with all seven anonymous private-route checks and controls off.
- Packet 75 is **Verified**. This is a presentation and accessibility packet
  with no behavior, authorization, schema, migration, or production-data
  change.

## Packet 74 — Tools icon-language evidence

- `GA-UX-003` gains a clearer tool-recognition layer: each of the seven
  launchers has a distinct, semantically accurate identity while preserving
  the single-launcher information architecture from Packet 73.
- `GA-UX-006` gains desktop, 390px mobile, and 320px compact-mobile rendered
  evidence in light and dark themes for unique icon identity, contained
  responsive sizing, no horizontal overflow, and decorative-SVG
  accessibility handling.
- `GA-OPS-007` gains a production build, clean lint, all unit/frontend tests,
  all 20 serial PostgreSQL integration suites, fail-closed authentication and
  Jobs/discovery E2E, focused rendered Tools QA, and a zero-vulnerability
  production dependency audit.
- Requirement maturity does not change. This is a presentation-only packet:
  it changes no tool behavior, records, authorization, schema, migrations, or
  production data. Railway application deployment
  `45b170ce-a430-4900-a8ec-98d7d7dc41d9` plus metadata deployment
  `e901b8e1-bf63-43af-9463-cb9a27c2d293` serve exact feature source
  `19916b3e71cfdac6a72abdea70b9b12ae91ef98f`; the exact-source production
  monitor passed with seven anonymous private-route checks and controls off.

## Packet 72 — Public Jobs and Shop Talk discovery evidence

- `GA-FND-003` gains additive migration `0034_public_discovery`: jobs and Shop
  Talk posts default to member-only web visibility, answers require their own
  public consent timestamp, and the reviewed rollback removes only those new
  fields and indexes.
- `GA-FND-004` gains server-authorized publication evidence: only a job/post
  owner can change visibility; role-limited communities cannot publish
  publicly; member-only answers cannot be retroactively exposed; hidden,
  closed, inactive, and unauthorized records remain absent.
- `GA-UX-003` gains a real acquisition/read path for RIVT's defining
  surfaces: indexable public Job and Shop Talk list/detail pages lead
  interested visitors into the authenticated apply and discussion workflows.
- `GA-UX-005` gains privacy and honesty evidence: no existing record is
  auto-published; exact addresses, contact/account identifiers, private
  communities, and unconsented answers are omitted; public media and public
  answers require explicit acknowledgement; guest/sample posts cannot claim
  public publication.
- `GA-UX-006` gains mobile/desktop light/dark public-page evidence with no
  horizontal overflow, canonical/social/structured metadata, and honest
  empty/unavailable states.
- `GA-OPS-007` gains 103 passing unit/frontend checks, all 20 serial
  PostgreSQL integration suites, E2E, five rendered UI suites, direct
  responsive browser inspection, diff check, and a zero-vulnerability
  production dependency audit. The integration command completed in 21
  minutes with zero failures, including public publication, messaging and
  notifications, Work/Shop Talk lifecycles, and migration rollback/reapply.
  Production exact-source monitoring subsequently passed with seven
  anonymous private-route checks.
- `GA-FND-003` additionally gains migration `0035_job_budget_floor`, which
  repairs the original database/API minimum-budget mismatch without changing
  the already-tested API contract. Its rollback refuses to discard or
  rewrite valid lower-budget jobs.
- `GA-OPS-008` gains production deployment
  `e96c39e7-8a47-47f7-822e-46b022e4f366` at exact source
  `8682f206706a91e1585982e774996111e8695157`, ready migration `0035`, an
  authenticated publish/render/unpublish cleanup proof for both surfaces,
  private-address omission, empty-feed cleanup confirmation, and the
  exact-source production monitor.
- Packet 72 is **Verified**. This does not by itself declare the entire
  nationwide product launch-ready; cross-product operational and
  physical-device gates remain tracked separately.

## Packet 71 — Pre-launch activation and accessibility evidence

- `GA-UX-001`, `GA-UX-002`, and `GA-OPS-007` gain local evidence for a
  reachable post-onboarding role checklist, canonical server-trade persona,
  actionable empty Work state, AA primary-action tokens in both themes,
  reduced-motion suppression, dialog focus containment, self-hosted fonts,
  intrinsic image sizing, deferred feature reads, and install discovery.
- `GA-OPS-007` adds 99 passing deterministic unit/frontend checks,
  fail-closed authentication and jobs/discovery E2E, focused account and
  server-owned Shop Talk integration passes, rendered Tools, Shop Talk/Trade
  News, mobile-actions, and Work lifecycle coverage, and a zero-vulnerability
  production dependency audit. Baseline and updated light/dark mobile
  screenshots are retained in the repository. The bounded aggregate wrapper
  stall is recorded without being represented as a pass.
- Requirement maturity does not change until review and deployment evidence
  are recorded. Analytics delivery, real Jacksonville launch content, and
  public/indexable content remain founder decisions; no fabricated activity,
  public content exposure, schema migration, or production data change is
  claimed.

Status values:

- **Verified:** persisted and tested against the live/production-like service.
- **Partial:** real implementation exists but Gate A behavior or safety is incomplete.
- **Prototype:** UI/local or application-blob behavior only.
- **Missing:** no meaningful implementation found.
- **Blocker:** current behavior is unsafe or contradicts Gate A.

Evidence must eventually link to implementation, automated tests, manual acceptance proof, and deployed build.

## Traceability Addendum - 2026-07-26 Customer Book Continuity

- `GA-FND-003` gains migration `0033_customer_book`: canonical account-owned
  customers, optional links from standalone projects and tool records, and a
  reversible migration that preserves richer customer fields through rollback.
- `GA-FND-004` gains server-side ownership on customer create, search, update,
  recent-use, and activity reads. Cross-account customer links and reads are
  denied; hiding a control is not treated as authorization.
- `GA-UX-003` gains one reusable customer picker across Estimate, Invoice, and
  standalone-project creation plus a Work -> People -> Customers book with
  favorites, archive/restore, duplicate warnings, and real related activity.
- `GA-UX-005` gains immutable customer snapshots on reviewed documents.
  Updating the canonical customer changes future reuse without silently
  rewriting an earlier estimate or invoice. Inbox customer notes remain
  explicitly private and do not imply message delivery.
- `GA-UX-006` gains rendered 390px customer-book and document-flow evidence
  with no horizontal overflow. Document branding through migration `0032`
  supplies account-owned business identity, verified managed logo uploads,
  guided layouts, and reusable estimate templates without fabricating sync,
  delivery, or public visibility.
- Local evidence includes build, application/security lint, 89 unit/frontend
  tests, direct customer/tool-record ownership and migration lifecycle
  integrations, fail-closed authentication and jobs/discovery E2E, rendered
  Tools/mobile QA, diff checks, and zero known production dependency
  vulnerabilities. The buffered aggregate serial wrapper is recorded as
  unclaimed; both affected PostgreSQL suites passed directly.
- `GA-OPS-008` gains Railway deployment
  `00e22345-10ba-497f-a7bb-ad3663c0dfc2` serving exact source
  `3cab1f3eb475dae8078ada2b0fd5ebe81656f90b` through ready migration
  `0033_customer_book`. Health and the exact-source production monitor passed.
  An authenticated disposable account then created, searched, updated, marked
  used, and read activity for a live customer; anonymous access returned 401
  and all temporary records were cleaned up.

## Traceability Addendum - 2026-07-25 Desktop Release Polish

- `GA-UX-001` and `GA-UX-003` gain a wide-screen shell that preserves the
  five primary destinations and keeps People under Work. Destination changes
  reset document scroll, and focused Work anchors clear the sticky top bar.
- `GA-UX-003` gains desktop-specific information hierarchy: Tools restores
  field and money launcher rows, Camera bounds album cards inside a two-column
  workbench, and the global Shop Talk feed uses its second column for real
  community discovery rather than empty chrome.
- `GA-UX-005` gains state and data honesty: Communities no longer mounts the
  unrelated Trade News detail pane, and no desktop-only counts, activity, or
  records are introduced.
- `GA-UX-006` gains repeatable 1440x900 light/dark assertions for scroll
  reset, horizontal overflow, Camera card bounds, Shop Talk composition, and
  Tools grid geometry. Theme-specific sidebar and community colors now use
  the shared `--v2-*` tokens.
- Local verification passes build, lint, 85 unit/frontend tests, E2E,
  guest-preview/Tools/Shop Talk/mobile rendered QA, and the production
  dependency audit. The database integration stall and local Connect-status
  503 boundary are recorded in Packet 71 and are not represented as passes.
- `GA-UX-006` and `GA-OPS-007` gain live production evidence from
  `ui-a11y-20260726031210-b81689` on exact source
  `a2095df7eef356942b66bba0759694a714ce7921`: eight role/viewport scenarios
  cover 360x800 and 390x844 phones, 768x1024 tablet, 1366x768 laptop,
  1440x900 desktop, and 390x844 at 200% text. Every scenario reports zero
  small targets, missing image alternatives, unlabeled fields, horizontal
  overflow, and console warnings/errors; both disposable accounts were
  closed. Railway deployments `e0c5b4a4-4d82-4f1d-adc5-5eb17b7222fd` and
  `7aa5f117-c026-4f8f-8b0a-6f7d4efad003` serve the exact source, and the
  exact-source production monitor passes.

## Traceability Addendum - 2026-07-25 Stripe Connect Accounts v2 Correction

- A real Stripe sandbox request invalidated the original Accounts v1
  onboarding assumption: Stripe rejects new v1 connected-account creation for
  this platform. `GA-FND-004` now uses Accounts v2 merchant configuration and
  requests `ach_debit_payments` plus the required `card_payments` capability.
- `GA-OPS-004` gains an explicit responsibility proof: the connected account
  uses the full Stripe Dashboard with Stripe as both fee collector and
  negative-balance loss collector. RIVT does not take an application fee or
  silently assume merchant losses.
- `GA-FND-003` gains migration `0030_stripe_connect_accounts_v2`, preserving
  API-generation/dashboard provenance and the honest v2 capability states
  `restricted` and `unsupported`.
- Provider evidence includes successful Accounts v2 creation, a successful
  hosted onboarding-link request, ACH-only direct Checkout compatibility, a
  real successful delayed payment, and a real `no_account` failure. Stripe
  emitted `checkout.session.async_payment_succeeded` and
  `checkout.session.async_payment_failed`; RIVT mapped the real payloads to
  `paid` and `failed` without treating Checkout completion as settlement.
- `GA-OPS-008` gains fail-closed production evidence: Railway deployments
  `69c46b9d-33e7-4450-b737-84eafe174a07` and
  `afac9014-c51d-4298-8516-44496366f654` serve exact source
  `548ce531fe850679b47386e30287b990bd02b37b` through ready migration
  `0030_stripe_connect_accounts_v2`; health reports Accounts v2 and the
  exact-source production monitor passes.
- The Stripe sandbox has an active connected-account destination for the nine
  mapped settlement events. Its test signing secret is not mixed into the
  live-key production environment. Hosted onboarding reached Stripe's
  anti-bot challenge and still requires human completion; a live connected
  destination/signing secret remains outstanding. Production stays disabled
  and no live ACH readiness is claimed.

## Traceability Addendum - 2026-07-25 Stripe Connect ACH Invoices

- Product-owner direction adds a bounded exception to the former no-job-
  payment launch rule: Stripe-hosted ACH direct charges may pay the invoice
  author's own connected merchant account. RIVT receives no application fee
  at launch and provides no escrow, custody, guarantee, insurance, or payment
  protection.
- `GA-FND-003` gains normalized connected-account, invoice-provider-payment,
  and immutable connected-event storage through migration
  `0029_stripe_connect_invoice_payments`.
- `GA-FND-004` gains server-side authorship, active-work participation,
  verified-account, connected-account, capability, amount, origin, webhook-
  signature, replay, and public-data-minimization boundaries.
- `GA-UX-005` gains truthful delayed-payment state: Checkout completion is
  processing rather than paid; external participant records stay separate;
  failure, refund, and dispute reopen the balance; and open ACH states block
  conflicting manual payment/void actions.
- `GA-UX-006` gains a tokenized public payer-return surface plus Invoice
  setup/manage/link/cancel controls. The payer surface is a payment utility,
  not a homeowner account or marketplace flow.
- `GA-OPS-004` gains a dedicated Connect webhook secret, explicit
  `STRIPE_CONNECT_ACH_ENABLED` kill switch, provider health state, and a
  rollback rule that preserves webhook/status handling for outstanding
  payments.
- Local evidence includes lint, build, security lint, 82 unit/frontend tests,
  all 19 serial PostgreSQL integration suites, E2E, dependency audit with zero
  vulnerabilities, strict launch readiness, migration lifecycle, and rendered
  desktop/mobile invoice plus payer-return proof.
- `GA-OPS-008` gains fail-closed production evidence: Railway deployments
  `042ed135-454b-4c2b-be5b-cdce069390f9` and
  `6832307b-0792-4251-8825-8269350f1b2a` serve exact source
  `75caa9d867c9a9c813bb3d381af17a397088ba63` through migration
  `0029_stripe_connect_invoice_payments`. The production monitor passed in
  607 ms; provider health truthfully reports disabled/unconfigured/
  `setup_required`; the public return shell loads; and an unsigned Connect
  webhook fails closed.
- Customer activation remains blocked on Stripe test-mode connected-account
  onboarding, asynchronous success/failure proof, and connected-webhook
  configuration. No live ACH capability is claimed.

## Traceability Addendum - 2026-07-26 Invoice Payment Clarity

- Product-owner activation completed the live Accounts v2 event destination,
  dedicated signing secret, and `STRIPE_CONNECT_ACH_ENABLED=true` gate. Health
  reports the provider enabled/configured/webhook-configured, unsigned events
  fail closed, and production monitoring passed before this extension.
- `GA-FND-003` gains durable Quick use and standalone-project invoice payment
  requests through migration `0031_tool_invoice_payment_requests`; no fake
  active-work record is created to obtain a payment link.
- `GA-FND-004` gains account-owned tool-invoice link create/read/cancel
  boundaries, a bounded public short-link redirect, signed settlement updates,
  and refund/dispute reopening for non-Work invoices.
- `GA-UX-005` and `GA-UX-006` gain an explicit payment-method decision before
  delivery. Stripe invoices show and email a real pay action; other methods
  require exact sender instructions. The legacy ambiguous `Direct payment`
  fallback is not accepted as sufficient customer direction.
- Evidence includes build, lint, security lint, 86 unit/frontend tests, all
  19 serial database integration suites, fail-closed authentication and
  jobs/discovery E2E, migration apply/rollback, server-owned invoice
  email/redirect integration, rendered desktop/390px/compact Tools proof,
  zero known production dependency vulnerabilities, exact-source production
  health on migration `0031`, and a passing production monitor.
- A controlled live Quick use payment-link creation from an onboarded
  merchant remains required before claiming the provider path was physically
  exercised in production; no real debit is required for that proof.

## Traceability Addendum - 2026-07-25 Jacksonville Launch-Readiness Closure

- `GA-UX-001` and `GA-UX-003` gain a contract-aligned shell: persistent
  destinations are Home, Work, Camera, Shop Talk, and Tools; People/Crew
  relationships and canonical assignments live under Work -> People.
- `GA-UX-003` gains grouped global search across current Work jobs, public
  People profiles, current Shop Talk posts, and directly openable Tools.
  Recent destinations are bounded to five and labeled private to the current
  browser.
- `GA-UX-005` gains honesty evidence from session-scoped guest preview,
  canonical People assignments, real Shop Talk reply totals in search,
  cleaned source-derived Trade News summaries, and removal of a redundant
  Camera destination card that looked like an empty/dead album.
- `GA-UX-006` gains rendered mobile evidence for Work -> People assignment,
  direct search-to-Invoice navigation and private recent search, coherent
  guest Work/Camera preview across refresh, compact Camera destinations,
  calculator gesture geometry, Shop Talk/Trade News, and Work lifecycle.
- `GA-OPS-002`, `GA-OPS-004`, and `GA-OPS-007` gain fresh operational
  evidence: an encrypted 82-table/7,028-row production logical artifact
  restored to isolated PostgreSQL with zero count differences; all 28
  migrations applied; stale smoke organizations were closed through the
  guarded cleanup with zero profile/job/review changes; the live hardening
  rerun found zero public seed/demo artifacts; Sentry accepted the rehearsal
  event; and strict launch readiness exits zero.
- `GA-OPS-007` also gains passing lint, build, 75 unit/frontend tests,
  desktop/mobile E2E, five targeted rendered UI smokes, security lint, and a
  zero-vulnerability production dependency audit. The aggregate database
  integration runner produced no result within 15 minutes, so no full
  integration pass is claimed.
- `GA-OPS-008` gains production evidence: Railway application deployment
  `fe6880e7-3789-4151-a800-157f205d5d47` and exact release-marker deployment
  `ee7276e7-bd66-4ca1-94de-81160bc6cdc0` succeeded for feature source
  `21213427ef9ed857fd34eada12a4630df9484923`. Exact-source health reports
  migration `0028_compensation_workflow` ready with PostgreSQL/S3-compatible
  dependencies and configured Sentry/Web Push; the production monitor passed
  in 461 ms with all seven anonymous private routes healthy.
- `GA-OPS-007` gains post-deploy proof from the Railway-hosted Gate A
  hardening smoke: zero public seed/demo findings, zero open jobs, zero active
  restrictions, and seven anonymous private checks. A forced Jacksonville
  news refresh produced one HB 803 cluster with eight related sources and
  zero leaked HTML entities.
- Authenticated billing-smoke proof remains open because dedicated smoke
  credentials are not configured. The guard refused to run, and no customer
  account or fabricated success was substituted.
- Commercial/physical acceptance remains human-owned: verify the configured
  Stripe Price is $9/month, complete a real mobile checkout return, and
  observe downstream incident delivery. No automated success is claimed for
  those steps.

## Traceability Addendum - 2026-07-25 Calculator Two-Choice Wheel Spacing

- `GA-UX-003` gains one-motion fraction-entry evidence: a two-choice family
  uses a compact upper arc rather than leaving a large dead zone between its
  heading and controls, and its cancel/use instruction stays inside the same
  interaction surface.
- `GA-UX-006` gains rendered light/dark assertions that bound the header-to-
  choice gap between 8 and 60 pixels while preserving viewport containment
  and the blocked-thumb safety check.
- `GA-OPS-007` gains passing lint, build, 75 unit/frontend tests, E2E,
  rendered Tools QA, mobile-action QA, and zero-vulnerability dependency
  evidence. The aggregate database-backed command reached its ten-minute
  limit without a result, so no integration pass is claimed.
- No new `GA-OPS-008` production evidence is claimed until this follow-up is
  deployed and exact-source health is confirmed.

## Traceability Addendum - 2026-07-25 Calculator Wheel Header Band

- `GA-UX-003` gains quick-entry hierarchy evidence: each wheel reserves a
  title/result row and context row before its choice arc without moving the
  choices out of thumb reach.
- `GA-UX-006` gains rendered geometry assertions requiring an eight-pixel
  title/context-to-choice gap and an on-screen header across fraction,
  multiply, and divide wheels in the mobile light/dark surfaces.
- `GA-OPS-007` gains passing lint, build, 75 unit/frontend tests, E2E,
  rendered Tools QA, mobile-action QA, and zero-vulnerability dependency
  evidence.
- `GA-OPS-008` gains production evidence: Railway application deployment
  `baae3625-bd28-4123-a5c2-c12516180d6c` and exact-source metadata deployment
  `6c8b6eb6-ffd9-481b-8c82-8db17da12706` serve commit
  `3b827444137356f367a97cc941d7a25f6d7f51d5`. Live health reports migration
  `0028_compensation_workflow` ready with healthy PostgreSQL/S3-compatible
  storage, and the seven-check expected-source monitor passed in 475 ms.

## Traceability Addendum - 2026-07-25 Calculator Clear Recovery

- `GA-UX-003` gains control-hierarchy evidence: persistent Undo is removed,
  Clear alone offers a five-second recovery, and the orange Enter key displays
  only `=` while retaining honest context-aware behavior and accessible
  naming.
- `GA-UX-005` gains state-scope evidence: temporary clear recovery restores
  the exact device snapshot and is invalidated by the next entry so it cannot
  claim broader history.
- `GA-UX-006` gains rendered mobile assertions that normal entry has no Undo,
  clear recovery stays below the primary value, the equals key has no
  Add/Solve subtitle, and Tape List guidance points to the actual `=` entry
  point.
- `GA-OPS-007` gains passing lint, build, 75 unit/frontend tests, E2E,
  rendered Tools QA, mobile-action QA, and zero-vulnerability dependency
  evidence.
- `GA-OPS-008` gains production evidence: Railway application deployment
  `2d400787-3a84-4e52-95d7-dea896f97d03` and exact-source metadata deployment
  `427d474f-b76e-4a09-93a5-adb61493b52e` serve commit
  `3f2557ab1f329583119c7916f7050e38c2d5237f`. Exact-source health and the
  seven-check production monitor passed.

## Traceability Addendum - 2026-07-24 Calculator Wheel Containment

- `GA-UX-003` gains interaction-discipline evidence: digit holds exist only
  for learnable families with two to five choices. Complete imperial and
  metric mark access moves through the explicit `ALL` palette instead of
  overloading `6` or opening single-choice holds on `2` and `9`.
- `GA-UX-006` gains rendered mobile evidence that every quick-wheel choice
  stays inside the viewport, the complete imperial palette uses two rows, and
  all five compact Tape List values retain their full label/value height.
- `GA-OPS-007` gains assertions for the 2-6 useful-choice limit, an 8 px
  viewport inset, absence of useless hold affordances, two-row palette
  geometry, and client-height versus scroll-height clipping detection. Lint,
  build, 75 unit/frontend tests, E2E, rendered Tools QA, mobile-action QA, and
  the zero-vulnerability dependency audit pass.
- `GA-OPS-008` gains production evidence: Railway application deployment
  `4881c7ac-fa8f-4a84-9d7f-fa9b96252d63` and exact-source metadata deployment
  `7f7b1b43-d948-418a-b7b6-253bf9f9180a` serve commit
  `ebf18f6ef0f03c59db7c6ea4b59302d865bed65e`. Exact-source health and the
  seven-check production monitor passed.

## Traceability Addendum - 2026-07-24 Calculator Logical Quick Wheels

- `GA-UX-003` gains field-speed evidence: number holds expose stable,
  learnable fraction families; multiplication and division holds expose
  common jobsite factors; and `L`, `H`, `÷2`, and `×2` remain directly above
  the keypad. A centered `ALL` shortcut exposes every imperial sixteenth or
  every metric decimal tenth without crowding the number keys.
- `GA-UX-003` also gains one-motion gesture evidence. The quick wheel is
  biased above and beside the blocked thumb, highlights the current choice
  during the drag, previews the full resulting measurement, and commits on
  release while preserving a keyboard path. Auto edge avoidance and
  persistent left/right reach preferences cover either hand.
- `GA-UX-005` gains state-scope evidence: holding `DEL` clears the current
  problem without deleting the device-local Tape List, while tap-to-delete
  retains its narrower behavior. Dead-zone release makes no change, one-step
  Undo restores only the current device snapshot, and optional measurement
  labels are explicitly part of the device-local Tape List.
- `GA-UX-006` gains mobile light/dark rendered evidence for the unified
  display/Tape List workspace, the hidden-fraction five-measurement view,
  logical eighth and sixteenth wheels, complete imperial/metric palettes,
  metric-specific settings and independent decimal-strip visibility, and
  avoidance of Tools swipe-back.
- `GA-OPS-007` gains a real pointer-gesture Tools smoke for hold, slide,
  highlight, release, operator scaling, and hold-to-clear behavior, plus a
  keyboard-open/focus/commit assertion. It now also locks wheel preview,
  center-release cancellation, reach preference, one-step Undo, and Tape List
  labeling. Lint, build, 75 unit/frontend tests, desktop/mobile E2E, and a
  zero-vulnerability production dependency audit pass. The aggregate serial
  database test exceeded the local command limit, so no full integration pass
  is claimed.
- `GA-OPS-008` gains production evidence: Railway application deployment
  `a7caecc9-4045-4665-b3e0-b607b3525432` and exact-source metadata deployment
  `33b71edc-c396-4efd-aed0-1f8d00189128` serve commit
  `a810a80bbb680cf5bc1a4a5f072dc238cddb7ab1`. Exact-source health and the
  seven-check production monitor passed.

## Traceability Addendum - 2026-07-24 Heavy 16th Intelligent Tape Workflow

- `GA-UX-003` gains field-notation evidence: imperial arithmetic retains
  1/32-inch working precision, exact sixteenths stay exact, odd
  thirty-seconds become Heavy/Light relative to a tape mark, ambiguous cases
  default Heavy, and finer results visibly disclose approximation.
- `GA-UX-003` also gains a device-local measurement workflow: plain Enter
  adds the displayed value to a duplicate-safe Tape List; independent
  used/unused controls preserve the value for later reuse; tapping a row
  reloads the measurement.
- `GA-UX-005` gains honesty evidence: the Tape List is labeled as device-local,
  approximate results carry `≈`, and the feature makes no sync, sharing, or
  false-precision claim.
- `GA-UX-006` gains rendered desktop, 390px mobile, and compact-phone
  assertions for persistent completion state, five visible measurements when
  fraction keys are hidden, full sixteenth access through number-key hold,
  and restored normal fraction-key layout.
- `GA-OPS-007` gains repeatable Tools-smoke coverage for the Heavy/Light
  arithmetic and Tape List journey in addition to the standard build, lint,
  unit, E2E, and dependency gates.
- `GA-OPS-008` gains production evidence: Railway deployment
  `9554c380-d331-4ed0-82ea-3bf8acfc108c` serves feature source
  `077d3b5e19ffddcfd5df265e3b4483e42d9fe948`; exact-source health,
  the seven-check production monitor, and live frontend-bundle inspection all
  passed.

## Traceability Addendum - 2026-07-24 Jacksonville Pre-Launch Hardening

- `GA-SEC-004` gains server evidence that the legacy free-form invoice relay
  is retired with authenticated `410 Gone`, browser faults enter a
  same-origin, schema-bounded, durable-rate-limited operational path, expense
  CSV export requires a server-confirmed active Pro entitlement, and the
  server—not a hidden browser control—limits free time history to 90 days.
- `GA-UX-005` gains launch honesty and money evidence: canned inbound replies
  can no longer be injected; private client activity, review notes,
  availability, and reactions state their scope; copy feedback follows the
  clipboard result; the Pro offer names only enforced benefits; Expense
  Logger preserves cents; Shop Talk uses persisted reply counts and its valid
  reset sentinel; GPS is described as device-reported rather than verified.
- `GA-UX-003` gains mobile purchase-path evidence because successful checkout
  returns directly to the Billing section. Network and Inbox action language
  now matches the actual copy/save behavior, and Shop Talk answer coaching is
  neutral enough for questions, news discussions, and field advice.
- `GA-UX-006` gains 390px light/dark rendered evidence across all five
  primary surfaces plus the requested Tools, Shop Talk/Trade News,
  mobile-actions, and Work lifecycle smokes. Assertions cover the removed
  reply simulator, private client-notes framing, valid Shop Talk reset,
  two-decimal expense display, and absence of the Work fake-financial entry
  point.
- `GA-OPS-007` gains local evidence from lint, production build, 75
  unit/frontend tests, targeted database integrations for retired relay,
  client errors, Pro expense export and 90-day history, desktop/mobile E2E,
  the four rendered UI smokes, and a zero-vulnerability production dependency
  audit. The full serial remote-database suite progressed without an emitted
  assertion failure but exceeded the 15-minute command limit before
  completion; no full integration pass is claimed.
- `GA-OPS-008` gains production evidence: Railway deployments
  `707bdb00-693d-4b78-93e3-3b97c0f88210` and
  `a4e6b2e2-43f8-424b-a78b-d5415c2461ab` serve exact feature source
  `b46ef953d91496f9d31c3781a8bca2b3e42e1c52`; health reports ready migration
  `0028_compensation_workflow`, healthy PostgreSQL/S3-compatible storage,
  configured Sentry/Web Push, and the new security headers. The production
  monitor passed in 539 ms with open controls and seven healthy anonymous
  private routes. The live main bundle matches the locally verified build,
  client-error intake returned 202, and the retired relay failed closed for
  anonymous access. Authenticated production acceptance remains incomplete:
  the Gate A smoke detected 17 pre-existing demo organizations, billing smoke
  credentials are not configured, and no production data was deleted.
- Launch remains blocked on human-owned restore-drill, incident-rehearsal and
  verified-backup evidence producing a strict readiness exit of 0, review and
  rollback-safe cleanup of the stale demo organizations, provisioned smoke
  credentials and passing authenticated smokes, plus confirmation that the
  live Stripe Price is $9/month.

## Traceability Addendum - 2026-07-23 Shop Talk Thread Detail Redesign

- `GA-UX-003` gains selected-thread hierarchy evidence: the post leads, voting
  is grouped, answers precede answer creation, article context is inline, and
  the collapsed composer anchors the end of the reading flow instead of
  blocking it.
- `GA-UX-005` retains honesty and provenance: answer counts still come from
  persisted replies; reputation copy reflects the reaction ledger state;
  Verified Fix, reporting, bookmarking, ownership-gated deletion, char limits,
  and answer submission keep their existing data and authorization paths.
- `GA-UX-006` gains repeatable desktop/mobile rendered assertions for default
  composer collapse, keyboard expansion and focus transfer, answer-before-
  composer order, leading empty-answer state, icon-only delete, and horizontal
  containment. Mobile light/dark captures verify semantic-token contrast,
  sentence-case metadata, safe-area navigation clearance, and the flattened
  editorial layout.
- `GA-OPS-007` gains local evidence from lint, production build, 73
  unit/frontend tests, rendered Shop Talk/Trade News QA, desktop/mobile E2E,
  and a zero-vulnerability production dependency audit. The aggregate serial
  database phase timed out after five minutes without a result and is not
  claimed as passed.
- `GA-OPS-008` gains production evidence: Railway deployments
  `46a80948-4d02-4c2c-8d39-da11b16d627e` and
  `f564f94f-e471-4ea2-a0fd-5c28a58cb79e` serve exact feature source
  `d07f32a71824bf78280740d9e8e13eb362ec2fbb`; health reports ready migration
  `0028_compensation_workflow` with healthy PostgreSQL/S3-compatible storage,
  Sentry, Web Push, and matching-job alerts. The expected-source monitor
  passed in 562 ms with open controls and seven healthy anonymous private
  routes. Production bundle inspection found the collapsed-composer copy and
  new detail hierarchy class in the lazy Shop Talk chunk.
- Remaining risk: signed-in physical-device acceptance should verify sticky-
  composer behavior with the software keyboard and a long real answer thread.

## Traceability Addendum - 2026-07-23 Shop Talk Linked-Article Discussion Finish

- `GA-UX-003` gains a finished Trade News-to-Shop Talk discussion path:
  article context is rendered as compact metadata in the composer, Feed, and
  selected thread; the visible comment field starts empty; selected-thread
  actions and the answer composer reflow cleanly on mobile.
- `GA-UX-005` gains honesty and ownership evidence: canonical article URLs
  remain persisted for real thread matching but are not exposed as body copy;
  delete visibility comes from immutable server account ownership; deletion
  uses the existing author-authorized server mutation and does not claim a
  frontend-only result.
- `GA-UX-006` gains desktop/mobile light/dark rendered captures for the linked
  article thread and delete confirmation, plus assertions that long redirect
  URLs do not render, the article attachment remains available, and the
  visible answer/read surfaces retain semantic-token contrast.
- `GA-OPS-007` gains local evidence from lint, production build, 73
  unit/frontend tests, the targeted server-owned Shop Talk post integration
  test, Shop Talk/Trade News rendered QA, desktop/mobile E2E, and a
  zero-vulnerability production dependency audit. The aggregate serial
  database phase timed out after five minutes without a result and is not
  claimed as passed.
- `GA-OPS-008` gains production evidence: Railway deployments
  `8093c375-537f-4916-9b66-fceaae24f64e` and
  `4936432d-820b-4ea7-a993-3d17686999a3` serve exact feature source
  `474babff7cffc1fee61ad06544347564d8ad9038`; health reports ready migration
  `0028_compensation_workflow` with healthy PostgreSQL/S3-compatible storage,
  Sentry, Web Push, and matching-job alerts. The expected-source monitor
  passed in 526 ms with open controls and seven healthy anonymous private
  routes. Authenticated production Shop Talk smoke
  `shop-talk-react-20260724023711-b61eea` passed and cleaned up both disposable
  accounts. Production bundle inspection found all four new linked-article
  discussion/delete strings in the lazy Shop Talk chunk.
- Remaining risk is signed-in physical-device acceptance for Trade News
  discussion creation and owned-post deletion in both themes.

## Traceability Addendum - 2026-07-23 Final Pre-Release Five-Surface Polish

- `GA-UX-003` gains final cross-surface hierarchy and mobile evidence across
  Home, Work, Camera, Shop Talk, and Tools: device-private availability
  reflows, open-community controls precede the feed, Camera destination/actions
  are no longer duplicated, and fixed trays remain reachable on short and tall
  mobile viewports.
- `GA-UX-005` gains honesty and money evidence: Work cannot open an unmatched
  job detail that invents zero-dollar financials; Expense Logger and Bid
  Builder preserve cents; Shop Talk counts only persisted replies; Reset uses
  the valid all-trades sentinel; availability states its device-only scope;
  GPS is described as device-reported rather than verified; share feedback
  distinguishes native sharing, clipboard copy, and no-op behavior; and
  unsupported answered-state mutation was removed.
- `GA-UX-006` gains repeatable 390x844 light/dark captures for all five primary
  surfaces, plus existing 375x553 and 390x664 checks at Standard, Large, and
  Extra Large text. Semantic token checks cover Work milestones/errors,
  Shop Talk flair/reputation, Camera/Tools action contrast, and horizontal
  containment.
- `GA-OPS-007` gains local evidence from lint, build, 73 unit/frontend tests,
  four targeted rendered smoke suites, desktop/mobile E2E, diff check, and a
  zero-vulnerability production dependency audit. The aggregate serial
  database integration phase timed out without a result and is not claimed as
  passed.
- `GA-OPS-008` gains production evidence: Railway deployment
  `9ed7b494-6a77-45c2-9912-aaac667b49be` serves exact source
  `86bd14942723e759680b4614c2e67cebda84ae33`; health reports ready migration
  `0028_compensation_workflow` and healthy PostgreSQL/S3-compatible storage.
  The expected-source monitor passed in 567 ms with configured Sentry/Web Push,
  enabled matching-job alerts, open controls, and seven healthy anonymous
  private-route checks. Production bundle inspection found the new private
  availability, device-GPS, and Shop Talk loading copy and no `verified GPS`.
- Remaining risk is signed-in physical-device acceptance for the edited Work,
  Camera, Shop Talk, and money-tool flows in both themes.

## Traceability Addendum - 2026-07-23 Shop Talk Final Editorial Polish

- `GA-UX-003` gains cross-surface hierarchy evidence: Feed posts, Community
  directory entries, featured news, and compact news use one editorial-list
  model. Elevation remains reserved for navigation, controls, sheets, and
  selected detail instead of wrapping every content object in a card.
- `GA-UX-006` gains rendered desktop/mobile and dark/light evidence: the Shop
  Talk smoke requires zero outer card radius and zero shadow across Feed,
  Communities, and every Trade News item while retaining focus states, 44px
  actions, content ordering, Local-channel isolation, and horizontal
  containment.
- `GA-OPS-007` gains local evidence from build, lint, 73 unit/frontend tests,
  E2E at desktop/mobile, rendered Shop Talk/Trade News smoke, and a
  zero-vulnerability production dependency audit. The aggregate serial
  PostgreSQL phase timed out without a result and is not claimed as passed.
- `GA-OPS-008` gains production evidence: Railway deployment
  `0249394d-0d8e-4d1b-8863-f85a1e6a9875` serves runtime source
  `c1155514e25b4b5d90fcd92d687752bcac59539c`; exact-source health and the
  production monitor passed in 544 ms with ready migrations and healthy
  production dependencies.

## Traceability Addendum - 2026-07-23 Trade News V2.4 Local Matching

- `GA-UX-003` gains locality-hierarchy evidence: national-origin articles with
  conservative state/city content signals are promoted above the neutral
  `Beyond your area · national trade news` divider and remain available in the
  strict Local channel.
- `GA-UX-005` gains honesty evidence: a bounded built-in US state table expands
  `City, ST` preferences without external lookup; bare abbreviations and bare
  city words cannot trigger promotion. Promoted records carry aligned
  `tier: local`, `isLocal: true`, and `geography: local` fields.
- `GA-UX-006` gains desktop/mobile dark/light evidence that a national-origin
  Duval fixture renders above the divider and in Local while unrelated
  national stories remain below it.
- `GA-OPS-007` gains local evidence from build, lint, 73 unit/frontend tests,
  and the rendered Trade News smoke. The packet changes no schema,
  dependencies, clustering/freshness/resource rules, or feed-depth thresholds.
- `GA-OPS-008` gains production evidence: Railway deployment
  `47b4421d-beec-4809-a5c4-a4d2d2ab97af` served exact feature source
  `a703c15c7f3a792f8cc35eb327d8dc913a946723`; the expected-source monitor
  passed in 628 ms with healthy PostgreSQL/S3-compatible storage and all seven
  anonymous private-route checks. A forced Jacksonville response returned the
  real Duval Schools story exactly once as local.

## Traceability Addendum - 2026-07-23 Trade News V2.3 Feed Depth

- `GA-UX-003` gains information-hierarchy evidence: location briefings keep
  verified local stories first and place national backfill beneath an explicit
  `Beyond {city} · national trade news` boundary. Local remains a strict
  local-only channel, and a national story cannot become featured above
  available local coverage.
- `GA-UX-005` gains honesty evidence: each API item carries a server-assigned
  local or national tier, canonical URL/title checks prevent cross-tier
  duplicates, and thin feeds stop at the verified available count instead of
  fabricating depth. Official reference titles are cleaned without inventing
  resources or changing source attribution.
- `GA-UX-006` gains rendered desktop/mobile evidence in dark and light themes
  for tier order, Local-channel isolation, reference-title cleanup, and
  horizontal containment.
- `GA-OPS-007` gains local evidence from build, lint, 71 unit/frontend tests,
  E2E at desktop/mobile, rendered Trade News smoke, and a zero-vulnerability
  production dependency audit. The existing database integration suite timed
  out without a result and is not claimed as passed.
- `GA-OPS-008` gains production evidence: Railway deployment
  `9505cdd8-8755-454e-8c75-de9a57b6e896` served exact feature source
  `617d4f2fceee4a078a62c031df5dcf32ed6cb53e`; the expected-source monitor
  passed in 657 ms with healthy PostgreSQL/S3-compatible storage and seven
  anonymous private-route checks. A forced Jacksonville response proved three
  local stories followed by nine national stories, zero untiered items, and
  cleaned official-reference titles.

## Traceability Addendum - 2026-07-17 Home Completion-State Correction

- `GA-UX-003` gains lifecycle-label evidence: Home derives its current-work
  card only from an accepted-work record whose canonical status is `active`.
  Completed and cancelled work remains historical and is not relabeled as
  active when no current job exists.
- `GA-UX-005` gains regression evidence: a frontend test renders completed and
  cancelled records together and proves Home exposes neither the active label
  nor either historical job title.
- Local evidence includes build, lint, security lint, 58 unit tests, E2E,
  mobile-actions, rendered Work lifecycle, and a zero-vulnerability production
  dependency audit. `GA-OPS-008` gains production evidence: `/api/health`
  served exact source `97a9e0fc14dba95bffe2a9297c517ba80be6b03a`, and
  the expected-source monitor passed in 594 ms with all seven anonymous
  private-route checks healthy.

## Traceability Addendum - 2026-07-17 Exact Closeout and Review Workflow (Production Verification)

- `GA-UX-003` gains exact-destination evidence: fixed-price applicants can be
  hired at the listed amount without re-entering compensation; completion
  actions remain inside the selected Work workspace; and completion and review
  notifications open the exact server-owned record instead of generic Records
  or a blank review form.
- `GA-UX-005` gains role-specific lifecycle evidence: the tradesperson sees one
  required completion summary with optional photos, notes, and checks, while
  the contractor sees that exact submission before confirming completion or
  requesting changes. Disabled submission states explain what is missing.
- `GA-FND-004` gains participant-authorization evidence: exact review lookup is
  restricted to the review participants and returns not found to unrelated
  accounts.
- `GA-OPS-007` gains local verification evidence: build, lint, security lint,
  57 unit tests, E2E, mobile actions, rendered two-role Work lifecycle, zero
  production dependency vulnerabilities, focused completion/review PostgreSQL
  suites, and all 19 fresh-database integration suites passed.
- `GA-OPS-008` gains production evidence: `/api/health` served exact merge
  source `2d0692c8bfffed11f427902090252acbc9b402bf` with migration 0028 ready,
  and the expected-source monitor passed in 583 ms with all seven anonymous
  private-route checks healthy.

## Traceability Addendum - 2026-07-16 Compensation Workflow (Production Verification)

- `GA-FND-002` gains migration evidence: `0028_compensation_workflow` owns job
  compensation modes, application proposals, final offer compensation, and
  per-trade profile rate cards with apply/rollback/reapply coverage.
- `GA-FND-004` gains authorization evidence: rate visibility is enforced by
  server query context, job writes remain organization-authorized,
  applications remain applicant-owned, and offers remain contractor-owned.
- `GA-FND-005` gains typed validation evidence: realistic hourly listings are
  accepted; partial, zero, or contradictory proposal/offer terms fail closed.
- `GA-PRO-002` gains server-owned professional-rate evidence. Rates are labeled
  as references and visibility is controlled; they are not represented as a
  bid, contract, verified market rate, or promise of payment.
- `GA-UX-003` gains lifecycle clarity evidence: listing pay, target budget,
  applicant proposal, final offer, and accepted agreed pay are distinct states
  in Work rather than one overloaded number.
- Local gates and affected PostgreSQL suites pass. `GA-OPS-008` gains Railway
  deployment `748dcef5-42a9-4e63-af86-c51a56ebdb96`, exact-source commit
  `b9f7458978db70cd9c7d21d950376eaaa1a04d16`, ready migration 0028, and a
  passing expected-source production monitor. Physical two-account acceptance
  of all four listing modes remains open.

## Traceability Addendum - 2026-07-16 Account Drawer Subtraction (Production Verification)

- `GA-UX-003` gains navigation-ownership evidence: the top-bar account drawer
  contains only identity, Profile, Settings, conditional Admin, and Sign out.
  Professional metrics remain in Profile; appearance, alerts, subscription,
  storage, sessions, legal, support, and account controls remain in Settings.
- `GA-UX-006` gains compact-mobile evidence: rendered smoke verifies the
  reduced drawer, exact Settings theme and Alerts handoffs, conditional staff
  behavior, and no horizontal overflow.
- Existing session, billing, storage, moderation, notification, profile, and
  account records are read in place. No API, schema, migration, authentication,
  authorization, or server-owned record boundary changes in this packet.
- Local evidence includes typecheck, build, lint, security lint, 55 unit tests,
  E2E, mobile-action UI, zero production dependency vulnerabilities, diff
  checks, and all 19 serial PostgreSQL integration suites.
- `GA-OPS-008` gains production evidence: Railway served exact merge source
  `657aa80eda8c1ea1de0771dc5918d2fcd0511193` with migration 27 ready. The
  expected-source monitor passed in 594 ms with PostgreSQL, S3-compatible
  storage, Sentry, Web Push, matching-job alerts, operational controls, and
  seven anonymous private-route checks healthy.

## Traceability Addendum - 2026-07-15 Work State Architecture (Local Verification)

- `GA-UX-003` gains lifecycle-destination evidence: Browse, Hiring or
  Applications, Active, and Archive each expose the exact records and actions
  appropriate to that state rather than stacking the whole lifecycle.
- `GA-UX-006` gains rendered mobile evidence: an accepted offer moves into an
  Active workspace that replaces the browse list and retains exact Messages,
  Photos, Daily log, Estimate, and Invoice handoffs without horizontal
  overflow.
- Contractor applicant cards and tradesperson application/offer records now
  open their exact job, including jobs outside the current open-work list.
- Existing server-owned jobs, applications, offers, active-work records, and
  exact deep links are read in place. No migration, record rewrite, API,
  authorization, authentication, billing, storage, or moderation boundary
  changes in this packet.

## Traceability Addendum - 2026-07-15 Interface Foundation and Subtraction (Local Verification)

- `GA-UX-006` gains shared-dialog evidence: Shop Talk reporting and the Tools
  work-context picker now use one focus-trapped, Escape-dismissible,
  focus-restoring dialog behavior with accessible semantics.
- Rendered regression evidence covers desktop, mobile, and compact-phone Tools,
  Camera, Shop Talk, and Trade News without changing their records or actions.
- More than 600 lines of verified-unreferenced visual experiment CSS were
  removed, reducing specificity and bundle debt before Work and field-tool
  task-flow redesign.
- This packet changes no API, record, authorization, authentication, billing,
  storage, moderation, migration, or route boundary.

## Traceability Addendum - 2026-07-15 Invoice and Receivables Consolidation (Production Verification)

- `GA-UX-003` gains billing-workflow evidence: invoice drafting and receivable
  tracking now live in one customer-billing app rather than competing as two
  unrelated launchers.
- `GA-UX-006` gains compact interaction evidence: Draft and Receivables remain
  reachable through a lower mobile dock at 390x844 and 320x568, while desktop
  keeps the controls in flow above the workspace.
- Existing invoice and payment records are read in place. This packet performs
  no data migration, deletion, calculation, auth, billing-provider, storage,
  or delivery change.
- Legacy Receivables deep links and stored shortcuts resolve to the matching
  section, and Estimate continues to convert into Invoice Draft.
- Build, lint, security lint, 55 unit tests, all 19 PostgreSQL integration
  suites, E2E, desktop/mobile/compact Tools UI, mobile-action UI, dependency
  audit, and diff checks pass. Railway serves exact feature source
  `ddb31bedf6235a78e152bf84b7e475413c040835`; expected-source monitoring
  passed with PostgreSQL, private object storage, Sentry, Web Push, matching
  alerts, rollout controls, and anonymous private-route checks healthy.

## Traceability Addendum - 2026-07-15 Time and Costs Consolidation (Production Verification)

- `GA-UX-003` gains tool-IA evidence: Time, Expenses, Mileage, and Summary now
  live in one supporting app rather than competing as four unrelated launchers.
- `GA-UX-006` gains compact interaction evidence: a four-section lower dock
  keeps all controls reachable at 390x844 and 320x568 while preserving full
  desktop use.
- Existing server and device records are read in place; this packet performs no
  data migration, deletion, auth, billing, storage, or provider change.
- Legacy deep links and stored shortcuts resolve to the corresponding section
  so consolidation does not strand prior navigation.
- Build, lint, security lint, 55 unit tests, E2E, desktop/mobile/compact Tools
  UI, mobile-action UI, dependency audit, diff checks, and the focused
  PostgreSQL tool-records integration suite pass. Railway serves exact source
  `dcd8a8f191dad2a9ee76d6c21dc069e4b909ca79`; expected-source monitoring
  passed with PostgreSQL, private object storage, Sentry, Web Push, matching
  alerts, rollout controls, and anonymous private-route checks healthy.

## Traceability Addendum - 2026-07-14 Tools Truth and Containment (Production Verification)

- `GA-UX-003` gains product-boundary evidence: a single public catalog now
  prevents unfinished or overlapping tool modes from leaking through stale
  URLs, notifications, or internal transitions while keeping fourteen
  supported tools reachable.
- `GA-UX-005` gains money-truth evidence: mileage deductions are calculated
  from each trip date using published 2024, 2025, and split-2026 IRS business
  rates. Dates outside known periods are excluded and disclosed instead of
  inheriting a guessed value.
- `GA-UX-006` gains rendered containment evidence: Tools UI smoke covers
  desktop, mobile, and compact-phone surfaces and asserts that a contained
  Contracts deep link returns to the public hub.
- Local gates passed: build, lint, security lint, 55 unit tests, E2E,
  desktop/mobile/compact Tools UI, mobile-action UI, dependency audit with zero
  vulnerabilities, and all 19 PostgreSQL integration suites against isolated
  `rivt_test`.
- The mobile-action gate found a route/UI mismatch on Calculator browser Back;
  the controlled Tools route was corrected and the full rendered action rerun
  passed.
- This packet deletes no records and changes no database, auth, billing,
  storage, moderation, or provider boundary. Railway deployment
  `f343cb7b-ac98-4403-a348-5a1d7bf4feb5` serves exact feature source
  `a068728d98d74c73e925144050e076c756ee53b2`; live health and the
  expected-source production monitor passed.

## Traceability Addendum - 2026-07-14 Estimate Email Delivery (Local Verification)

- `GA-UX-003` gains estimate-delivery evidence: Estimate now gathers the
  recipient, scope, valid-through date, note, and customer-facing itemization
  before a clearly labeled Send action is possible.
- `GA-UX-006` gains compact-action evidence: the Estimate dock preserves a
  labeled Send action in the thumb zone while secondary Save, Invoice, and
  Copy actions reduce to recognizable controls on compact devices.
- `GA-SEC-004` gains account-owned delivery evidence: the server reads only
  the actor's saved estimate, validates its snapshot, records delivery state,
  and returns a cross-account lookup as not found. Customer email content
  excludes internal pricing assumptions.
- Local build, lint, security lint, unit/E2E/UI gates, dependency audit, and
  the full 19-suite PostgreSQL integration run passed against isolated
  `rivt_test`. Railway deployed source
  `4793b1b3dd240fb709e88c820d649ea5f31f5031`; live health and the production
  monitor passed. Founder-controlled inbox delivery was confirmed on
  2026-07-14.

## Traceability Addendum - 2026-07-14 Camera Home Album Previews (Production Verified)

- `GA-UX-003` gains independent-camera clarity evidence: account-owned private
  albums now show truthful counts and the latest stored capture directly on
  Camera home, with each card opening its exact album.
- `GA-UX-006` gains one-hand hierarchy evidence: Camera retains its lower
  Destination, Feed, and Capture dock while the global Camera destination no
  longer competes visually with the primary navigation.
- `GA-SEC-004` gains media-list evidence: album cover data is retrieved through
  the existing authenticated account-owned albums endpoint, and accepted or
  standalone work contexts intentionally do not render unrelated private
  albums.
- Local evidence includes build, lint, unit, E2E, Tools UI, mobile-action UI,
  dependency-audit, and diff checks. Production health and the expected-source
  synthetic monitor passed on `0849eaacc0b70302bf70c487c058c33b62f99c42` with
  ready migration `0027_default_private_photo_album`. PostgreSQL integration
  remains pending a configured disposable `TEST_DATABASE_URL`, as does
  physical-device confirmation of two private-album captures.

## Traceability Addendum - 2026-07-14 Camera Private Album Destinations (Production Verified)

- `GA-UX-003` gains clear-destination evidence: Camera exposes an account-owned
  default `Private photos` album alongside explicit standalone and accepted
  RIVT-work destinations, so generic field captures do not inherit an
  unrelated job.
- `GA-UX-006` gains one-handed capture evidence: private-album selection,
  creation, gallery access, and capture remain available through the Camera
  destination sheet and lower action dock on compact viewports.
- `GA-SEC-004` gains an account-bound storage migration: `0027` enforces at
  most one default album per account, and the default-album endpoint is
  authenticated and idempotent. Cross-account behavior remains covered by the
  existing album authorization contract; the full PostgreSQL integration run
  remains pending a configured disposable `TEST_DATABASE_URL`.
- `GA-OPS-007` gains production evidence: exact source
  `c366a69facf764cc36f226014bd3a83da46996c8` reports ready migration `0027`,
  healthy PostgreSQL/S3-compatible storage, configured Sentry/Web Push, and a
  passing expected-source production monitor.

## Traceability Addendum - Camera Before / After Proof Images (Local Verification)

- `GA-UX-003` gains field-proof composition coverage: users can select two
  already-saved captures from their current Camera destination, label them,
  and generate a side-by-side or stacked JPEG comparison while preserving the
  originals.
- `GA-UX-006` gains compact comparison controls: layout and labels stay
  reachable on phones, and a side-by-side proof remains side-by-side instead
  of being silently converted to a vertical stack at the compact breakpoint.
- `GA-SEC-004` remains unchanged: the comparison is uploaded through the
  existing authenticated, destination-scoped media path; no client-only media
  record or cross-destination copy is introduced.
- Production evidence remains pending. The deployment check must confirm
  canvas-safe reads from the configured signed object-storage URLs before this
  behavior is marked production verified.

## Traceability Addendum - 2026-07-14 Camera Field Action (Production Verified)

- `GA-UX-002` gains compact-navigation evidence: Camera replaces the former
  Crew slot after People moved under Work, acting as a field command rather
  than adding another competing product destination.
- `GA-UX-003` gains exact-work evidence: active-work Photos routes to the
  selected job's Camera/gallery context, while a direct Camera launch requires
  an explicit accepted-work or standalone-project destination.
- `GA-UX-006` gains SE-class one-hand evidence: lower Camera controls retain
  the visible save destination, gallery, capture type, shutter, latest capture,
  and camera switch; rendered mobile, tool, and work-lifecycle checks pass.
- `GA-OPS-007` gains production evidence: exact source
  `9262bb81d630d95f4b482d7d462b506099a1ae8c` passed the expected-source
  monitor with configured Sentry/Web Push, healthy PostgreSQL/S3-compatible
  storage, operational controls off, and seven anonymous private-route checks.

## Traceability Addendum - 2026-07-13 Daily Workspace and Camera

- `GA-UX-003` gains focused-workspace evidence: an exact accepted-work route
  suppresses broad Work browsing chrome on mobile and presents Messages,
  Photos, Daily log, Estimate, and Invoice before general job facts.
- `GA-UX-006` gains one-handed Camera evidence: the exact save destination and
  a Done action are repeated in the lower capture control zone on SE-class
  viewports, while accepted RIVT work and standalone work remain distinct.
- Rendered verification passed through Tools, Work lifecycle, and mobile-action
  UI smoke suites without changing server authorization or upload ownership.

## Traceability Addendum - 2026-07-12 Field Kit Themes (Local Verification)

- `GA-UX-003` gains a clearer personal-preference path: users select a familiar
  Field Kit in one tap or choose their own tool color, while detailed visual
  controls stay available without being the primary decision.
- `GA-UX-006` gains mobile preference evidence: Field Kit selection applies the
  shared application shell immediately, and mobile smoke verifies the selected
  blue/black kit updates document-level accent, chrome, canvas, and density
  without horizontal overflow.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `d260da9a517f7660c26bd42a5ddb3740dbb52630` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 584 ms. No production database,
  authentication, or billing behavior changed.

## Traceability Addendum - 2026-07-12 Appearance Studio (Local Verification)

- `GA-UX-003` gains clearer account-preference evidence: the Account drawer
  exposes one concise Appearance entry while the complete editor is focused,
  previewable, and independently selectable by Accent, Chrome, Canvas, Display
  mode, and Workspace density.
- `GA-UX-006` gains full-surface device-preference evidence: selections update
  canvas, panels, top bar, navigation, actions, spacing, and radii through the
  shared token layer without reload. Mobile smoke covers independent accent,
  chrome, canvas, and density updates with no horizontal overflow.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `36f0735d45922e8a3cc49fb8dc9d255896aade5d` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 569 ms. No production database,
  authentication, or billing behavior changed.

## Traceability Addendum - 2026-07-12 Field Finishes (Local Verification)

- `GA-UX-003` gains account-clarity evidence: the compact account drawer
  summarizes the current appearance and opens one focused Field Finishes editor
  instead of embedding a long preference surface in a profile menu.
- `GA-UX-006` gains full-surface preference evidence: selected original RIVT
  finishes update canvas, panels, chrome, navigation, active states, actions,
  and supporting information tones without reload. The mobile smoke opens the
  editor, selects Harbor Blue, and verifies the live navigation token changes.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `5944d6207a8961cf754282fbd667e4e52ff53bc1` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 569 ms.

## Traceability Addendum - 2026-07-12 Theme Studio (Local Verification)

- `GA-UX-003` gains account-clarity evidence: the account drawer remains the
  single top-bar account entry point, while appearance controls are named and
  previewable instead of hidden in a generic menu.
- `GA-UX-006` gains device-preference evidence: System, Light, Dark, and
  palette choices remain clear on compact mobile screens and update the shared
  application token layer without a reload.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `2f67ce4551b1a2bf4e53b57ed609dfcd27fb06b1` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 575 ms.

## Traceability Addendum - 2026-07-12 Entry Experience (Local Verification)

- `GA-UX-003` gains entry-path evidence: prospective members can explore a
  labeled product demo without obscuring account creation or returning-member
  login.
- `GA-UX-006` gains mobile access evidence: both account actions remain visible
  and reachable from every intro slide without requiring a long scroll.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `d6c475546229ae62165b3afd4c5149540720b83e` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 583 ms.

## Traceability Addendum - 2026-07-12 Tool Consolidation (Local Verification)

- `GA-UX-003` gains launch-surface subtraction evidence: five frequent field
  apps remain prominent while secondary planning, tracking, and site utilities
  are grouped without exposing duplicate or unfinished workflows as peers.
- `GA-UX-006` gains mobile hierarchy evidence: the compact Tools hub keeps
  field actions within the first scan and removes decorative tool-count copy.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `31c70a3f252f733857d822f1732c19b561c52848` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 599 ms.

## Traceability Addendum - 2026-07-12 Active Work Camera Workflow (Production Verification)

- `GA-UX-003` gains exact-workspace evidence: the active-job Today panel
  exposes Messages, Photos, and Daily log as one job's daily tools rather than
  routing the person through generic records.
- `GA-UX-006` gains one-hand Camera evidence: Camera keeps the chosen job or
  standalone project visible while the lower dock exposes Destination, Feed,
  and Capture controls.
- `GA-OPS-007` gains local evidence: build, lint, 53/53 unit tests, E2E, Work
  lifecycle UI smoke, Tools rendered UI smoke, dependency audit, and diff
  check passed. This client-only packet does not claim a new DB-backed pass.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `bd2a531e3faa4a6d3b1fb098e353008006659442` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 611 ms.

## Traceability Addendum - 2026-07-12 Work Action Ownership (Production Verification)

- `GA-UX-003` gains destination-ownership evidence: contractors create jobs
  from Work, Shop Talk owns community questions, and Home no longer repeats a
  generic posting action that already has a primary destination.
- `GA-UX-006` gains rendered mobile evidence: the mobile-action smoke proves
  Home has no creation FAB and Work's contractor-only `Post job` action is
  visible and tappable above persistent navigation at a compact viewport.
- `GA-OPS-007` gains local evidence: build, lint, security lint, 53/53 unit
  tests, E2E, mobile-action UI smoke, dependency audit, and diff check passed.
  The aggregate test command exceeded the local runner window during
  integration, so this client-only packet does not claim a new DB-backed pass.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `97d749e459352a40b36bb5d9b44b3e306306510e` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 606 ms.

## Traceability Addendum - 2026-07-12 Field Access Workbench (Production Verification)

- `GA-UX-003` gains field-access evidence: mobile Tools uses a configurable
  Field Tools tray for Camera, Heavy 16th, Daily log, and a compact All tools
  route without expanding the five-destination navigation model. Camera now
  names and asks for a capture destination instead of silently attaching a
  generic capture to a loaded job.
- `GA-UX-006` gains rendered one-hand evidence: Tools and mobile-action smokes
  prove the tray is reachable above the mobile nav, Camera capture/destination
  actions remain in the lower dock, and the Crew roster/invite flow has no
  document-wide horizontal overflow.
- `GA-OPS-007` gains local evidence: build, lint, security lint, 53/53 unit
  tests, E2E, Tools rendered UI smoke, mobile-action UI smoke, dependency
  audit, and diff check passed. The aggregate test command exceeded the local
  runner window before integration output, so no new DB-backed pass is claimed.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `8b634549f1e10d1761a92b9e23fb7db636c190b2` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 649 ms.

## Traceability Addendum - 2026-07-11 Shop Talk Command Center (Local Verification)

- `GA-UX-003` gains community-navigation evidence: Shop Talk now separates the
  discussion feed, community directory, and trade news reader. Community
  creation is visible to signed-in users and retains the server-enforced
  public/contractor/tradesperson audience choices.
- `GA-UX-006` gains rendered mobile evidence: the Shop Talk smoke proves Feed,
  Communities, and Trade News have no horizontal overflow, expose a visible
  Create community control, and keep the Ask composer action reachable.
- `GA-OPS-007` gains local evidence: build, lint, security lint, 53/53 unit
  tests, E2E, Shop Talk rendered UI smoke, mobile-action UI smoke, dependency
  audit, and diff check passed. The database integration suite was attempted
  twice against the configured test database but stalled before producing a
  result; this packet does not claim a new DB-backed integration pass.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `b682ac9adc2dfdd408b33f453b8a41b73b58197c` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The expected-source monitor passed with
  seven anonymous private-route checks in 585 ms.

## Traceability Addendum - 2026-07-11 Core Surface Subtraction (Local Verification)

- `GA-UX-003` gains deliberate hierarchy evidence: Home no longer repeats
  tool, offline, and answer actions that already have a persistent destination;
  its remaining daily decisions are active work, communities, the feed, and
  one role-aware action.
- `GA-UX-006` gains rendered mobile coverage: the mobile-action smoke asserts
  the removed duplicate panels stay absent at 320px while the single Home FAB
  remains visible; the Tools smoke preserves all five core apps and three
  expandable utility groups.
- `GA-OPS-007` gains local evidence: build, lint, 53/53 unit tests, E2E,
  mobile-action UI smoke, Tools rendered UI smoke, dependency audit, and diff
  check passed.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `3f4ea9585ef77d3769d8507fd1fd486b03f2634d`; live health reports ready
  migration `0026_standalone_projects`, PostgreSQL/S3-compatible storage,
  configured Sentry, and configured Web Push. The expected-source production
  monitor passed with seven anonymous private-route checks in 516 ms.

## Traceability Addendum - 2026-07-11 Job Workspace Simplification (In Progress)

- `GA-UX-003` gains workspace clarity evidence: eight peer job-detail tabs are
  grouped into Today, Job, Money, and More without removing the underlying
  records or their exact active-work context.
- `GA-UX-006` gains rendered ordering coverage: Today puts accepted-work
  actions before scope, facts, and other job summary content.

## Traceability Addendum - 2026-07-11 Work Mobile Priority (In Progress)

- `GA-UX-003` gains mobile hierarchy evidence: the active accepted job renders
  immediately after Work's heading, before job status browsing, metrics, and
  search. The exact workspace route remains unchanged.
- `GA-UX-006` gains rendered priority coverage: the lifecycle smoke asserts
  the active-work strip is in the viewport and precedes Work's browsing
  controls at a phone viewport.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `8e2c757d690513318daf3fe85583aa7674a7725d`; live health reports ready
  migration `0026_standalone_projects`, PostgreSQL/S3-compatible storage,
  configured Sentry, and configured Web Push. The expected-source production
  monitor passed with seven anonymous private-route checks in 553 ms.

## Traceability Addendum - 2026-07-11 Active Work Action Simplification (In Progress)

- `GA-UX-003` gains field-workspace hierarchy evidence: an accepted job now
  leads with one exact project-record handoff, exposes Messages, Camera, and
  Daily Log as the daily field actions, and groups Estimate and Invoice under
  Money. Reschedule and cancellation remain available behind a deliberate
  disclosure instead of competing with normal job work.
- `GA-UX-006` gains rendered mobile coverage: the Work lifecycle smoke asserts
  the focused exact workspace, the visible primary and daily actions, and
  collapsed rare controls before proving the Camera still opens the matching
  active job.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `596d824b34d1f6ec84e644ec2f2a20c790907279`; live health reports ready
  migration `0026_standalone_projects`, PostgreSQL/S3-compatible storage,
  configured Sentry, and configured Web Push. The expected-source production
  monitor passed with seven anonymous private-route checks in 527 ms.

## Traceability Addendum - 2026-07-11 Workspace Focus Handoff (Unmerged)

- `GA-UX-003` gains visible-destination evidence: Work's accepted-work action
  now delegates to the canonical active-work route, then scrolls and focuses
  the resolved job detail. The user sees the exact workspace rather than an
  unchanged Work header after a successful handoff.
- `GA-UX-006` gains rendered accessibility evidence: the job title receives
  focus without forcing an additional scroll, and the lifecycle smoke asserts
  both focus and viewport visibility at 390px.
- `GA-OPS-007` gains local evidence: build, lint, security lint, 53/53 unit
  tests, E2E, Work lifecycle UI smoke (twice), mobile-action UI smoke, Tools
  rendered QA, dependency audit, and diff check passed. The aggregate test
  command exceeded the local two-minute runner limit before reporting an
  integration result, so this addendum does not claim an aggregate pass.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `5e766ca22f5d20bdfa52f7ef632274fe425f2326`; live health reports ready
  migration `0026_standalone_projects`, PostgreSQL/S3-compatible storage,
  configured Sentry, and configured Web Push. The expected-source production
  monitor passed with seven anonymous private-route checks in 621 ms.

## Traceability Addendum - 2026-07-10 Active Work Continuity (Unmerged)

- `GA-PRO-001` gains durable private-work evidence: job invoices, direct-payment records, project timeline entries, closeout proof, and reviews attach to the same server-owned active-work relationship. Job payments remain participant-supplied records; RIVT does not process, escrow, guarantee, or certify a payment.
- `GA-UX-003` gains exact-workspace evidence: Work's active job actions now retain the active-work id through Records, Photos, Daily Log, Estimate, Invoice, and Messages, with `Open workspace` routing to the exact project record.
- `GA-UX-005` gains closeout continuity evidence: a confirmed completion exposes an exact review context for the other participant and reports private invoice/payment summaries with the rest of the proof packet.
- `GA-OPS-007` gains targeted verification: build, lint, security lint, 52/52 unit tests, E2E, Work lifecycle UI smoke, Tools UI smoke, dependency audit, `test/project-completion.integration.test.js`, and `test/migrations.integration.test.js` passed. The aggregate test wrapper exceeded its ten-minute remote-database window, so it is intentionally not recorded as a full aggregate pass.
- `GA-OPS-008` remains pending: this branch needs code review/merge, Railway migration `0025_project_financial_records`, exact live source/health proof, production monitor evidence, and a real participant workflow check before it can be called deployed.

## Traceability Addendum - 2026-07-10 Job-Scoped Tool Context

- `GA-PRO-001` gains accepted-work record coherence: active-work API data now includes the job's trade, duration, budget, and public location summary, allowing job-aware tools to initialize against the accepted job even after it leaves open-work discovery.
- `GA-UX-003` gains context evidence: active-work URLs wait for their exact work record, label the active job in the compact tool header, and prevent Estimate, Invoice, Daily Log, Materials, Time, Expenses, Bid Builder, Mileage, and Safety from retaining an unrelated tool context.
- `GA-UX-005` gains Daily Log isolation evidence: accepted-work drafts use distinct browser/server record keys and cannot silently reuse an unscoped or other-job Daily Log draft.
- `GA-OPS-007` gains local evidence: build, lint, 46/46 unit tests, E2E, the expanded Work lifecycle smoke, dependency audit, and diff checks passed. The new rendered regression places an unrelated job first and proves Invoice/Daily Log retain the job selected by the active-work URL.
- `GA-OPS-008` remains pending until the branch is merged, Railway serves the exact runtime SHA, and the production monitor passes.

## Traceability Addendum - 2026-07-10 Exact Notification Destinations

- `GA-UX-003` gains navigation-coherence evidence: application, offer, active-work, project, review, message, and Shop Talk actions now encode and restore the exact object instead of routing to a generic destination.
- `GA-UX-005` gains state-continuity evidence: cold starts and browser history restore exact Work, Inbox, Records, Reviews, and Shop Talk intent after authenticated data loads, and legacy authenticated aliases no longer fall through to Home.
- `GA-PRO-001` gains accepted-work workflow evidence: the workspace, Messages, Photos/Records, and Daily Log actions retain accepted-work context, while Records automatically opens the intended project detail without cancelling its own load.
- `GA-OPS-007` gains automated evidence: build, lint, security lint, 46/46 unit tests, E2E, the rendered Work lifecycle smoke, dependency audit, and diff checks passed. The affected `match-acceptance`, `project-completion`, and `reviews-admin-safety` PostgreSQL suites also passed individually. The aggregate wrapper exceeded its local time window, so aggregate completion is not claimed.
- `GA-OPS-008` gains production evidence: the branch was fast-forwarded into `master`; live `/api/health` served exact source `e0b4fb518018989fcf8a433af5c528ff52fe7cba` with ready migration `0022_community_audiences`, PostgreSQL/S3-compatible storage, and configured Sentry; the exact-source production monitor passed with seven anonymous authorization probes in 589 ms. A read-only authenticated production probe also passed, but the shared test account had no current notifications or active work, so a newly generated production notification-to-record click remains a manual acceptance boundary.

## Traceability Addendum - 2026-07-10 Field Reliability Train

- `GA-UX-005` gains recovery-honesty evidence: client requests now time out, boot-time 5xx/network failures show a retry state instead of false logout, rate limits use human copy, and the offline banner no longer promises a sync queue that does not exist.
- `GA-UX-005` also gains upload-recovery evidence: job-camera and album batches continue after individual failures, preserve failed files for retry, and a rendered tool smoke proves the original captured image can be retried into the active job timeline.
- `GA-UX-006` gains update-safety evidence: a service-worker activation no longer reloads a visible form; a refresh prompt is shown while the page is visible, and asset cache names derive from the built module hash rather than a hand-maintained version string.
- `GA-PRO-001` gains public-link evidence: Open Graph/Twitter metadata now uses a 1200x630 RIVT-owned image rendered from the approved logo asset, with canonical URL, robots, sitemap, and route-specific document titles.
- `GA-OPS-007` gains local verification evidence: build, lint, security lint, 46/46 unit tests, E2E, guest-preview recovery, Tools upload retry, mobile actions, dependency audit, and diff checks passed. The configured remote PostgreSQL stalled both the full integration command and a targeted project test without output, so this addendum does not claim new DB-backed evidence.
- `GA-OPS-008` remains pending until the branch is merged, Railway serves the exact runtime SHA, and `npm run monitor:production` passes.

## Traceability Addendum - 2026-07-09 Desktop Workspace Pass

- `GA-UX-003` gains desktop information-hierarchy evidence: Home, Tools, Crew, and Shop Talk now use desktop-specific work lanes instead of stretching a single mobile stack across the available width. The pass keeps the existing five primary destinations and does not introduce a parallel desktop navigation model.
- `GA-UX-006` gains rendered desktop evidence: a 1440px guest-preview check found no document-wide horizontal overflow. Shop Talk initializes as community discovery plus feed, adding a third thread panel only after selection; Crew uses distinct roster and invite-planning columns on the same viewport.
- `GA-OPS-007` gains local verification evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:guest-preview`, `npm run test:ui:shop-talk-news`, `npm run test:e2e`, and `npm audit --omit=dev` passed; unit tests passed 46/46. The aggregate database integration phase was attempted but the configured remote test PostgreSQL reset its connection during setup, so this addendum does not claim a new DB-backed integration pass.
- `GA-OPS-008` gains production evidence: `codex/desktop-workspace-pass` was fast-forwarded into `master`; Railway deployment `73eadb90-aa92-4b79-9f99-2aa03d68abe2` succeeded. Live `https://rivt.pro/api/health` returned exact source commit `be6a6d211eae8bef81c40d55e2054bf49e3148b9`, ready migration `0022_community_audiences`, PostgreSQL, S3-compatible storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=be6a6d211eae8bef81c40d55e2054bf49e3148b9 npm run monitor:production` passed with seven anonymous private-route checks in 445 ms.
- Remaining boundary: desktop visual verification is local preview evidence. A production browser/keyboard pass remains useful before presenting desktop accessibility as fully verified.

## Traceability Addendum - 2026-07-08 Guest Preview Black-Screen Hardening

- `GA-PRO-001` gains preview reachability evidence: Contractor and Subcontractor guest preview now run through a dedicated compact mobile smoke at 320px and must render the authenticated app shell with demo content instead of a blank/black screen.
- `GA-UX-005` gains error/recovery evidence: route crashes now render a visible recovery panel with reload and sign-in actions, and failed preview startup returns the user to the auth form with an explicit message instead of leaving the intro/preview carousel in an ambiguous state.
- `GA-UX-006` gains service-worker freshness evidence: production now serves a bumped service-worker cache version that skips API caching, refreshes app-shell assets with `no-cache`, and uses `index.html` as a navigation fallback only when the network fails.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run test:ui:guest-preview`, `npm audit --omit=dev`, and `git diff --check` passed. Full `npm run test` and `npm run test:integration` exceeded local command windows against the remote test DB; the previously stuck `test/shop-talk-moderation.integration.test.js` file was then run individually and passed.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `7f6aed13a046da80c5adc45270a02cbdcd75dcdb` with migration `0022_community_audiences`, PostgreSQL/S3-compatible storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=7f6aed13a046da80c5adc45270a02cbdcd75dcdb npm run monitor:production` passed.
- Remaining boundary: this addendum hardens and deploys the guest-preview black-screen failure mode. It does not replace physical iOS Safari/PWA verification on the reported device, where an old service worker may require one refresh or app restart before the new cache version takes over.

## Traceability Addendum - 2026-07-05 Launch Final Train Deployment

- `GA-UX-006` gains deployed compact-device calculator evidence: production now serves the launch-final-train slice where the SE-class calculator smoke exercises the real visible fraction-strip controls and the decorative ruler is removed from the accessibility tree.
- `GA-OPS-007` gains full local gate evidence for the deployed train: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, and `npm audit --omit=dev` all passed before merge. The aggregate `npm run test` pass included 44/44 unit tests and 18/18 integration tests.
- `GA-OPS-008` gains production deployment evidence: `codex/launch-final-train` was merged into `master`, Railway production now serves commit `5ce29c2f7c2768402a0dce24f3744df254be4b20`, live `https://rivt.pro/api/health` reports migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry, and `EXPECTED_SOURCE_COMMIT=5ce29c2f7c2768402a0dce24f3744df254be4b20 npm run monitor:production` passed with seven anonymous private-route checks in 589 ms.
- `GA-UX-005` gains deployed billing/session honesty evidence: production now includes the Stripe billing reconcile path, the logout/session-expiry purge for `rivt.*` local state, server-backed feed-card votes, and the shared 401 session-expiry handling instead of misleading local-only sync behavior.
- Remaining boundary: this addendum records the merged/deployed launch-final-train slice only. Physical-device QA, final cohort validation, and other manual launch checks remain separate launch-quality evidence.

## Traceability Addendum - 2026-07-05 SE Tool Chrome Cleanup

- `GA-UX-006` gains additional small-phone evidence: compact-device tool shells now force full-width containment for invoice and other immersive tools, preventing the narrow-phone right-edge clipping reported from the physical handset screenshots.
- `GA-UX-003` gains calculator-clarity evidence: the Heavy 16th tool now collapses non-essential top-bar text and hides `Light/Heavy/Half/Double` helper labels on SE-class widths so the core controls remain readable.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test:ui:tools`, `npm run test:ui:mobile-actions`, `npm run test:e2e`, and `npm audit --omit=dev` passed. `npm run test` still exceeded the local command window in this pass, so aggregate unit+integration completion is not newly claimed here.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `88d5adab057ba2848e6e4b692f8fba18b3239d55` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=88d5adab057ba2848e6e4b692f8fba18b3239d55 npm run monitor:production` passed.
- Remaining boundary: this addendum hardens the currently reported SE tool-shell/calculator readability issues, but it is still not a substitute for a final physical-device sweep across the rest of the app before broad launch.

## Traceability Addendum - 2026-07-05 SE Tool Fullscreen Ownership

- `GA-UX-006` gains narrow-phone immersive-tool evidence: the deployed calculator/tool shell now force-hides both shell mobile-nav layers and removes inherited inline app-shell padding so fullscreen tools can use the handset width on SE-class phones.
- `GA-UX-003` gains calculator-layout clarity evidence: compact-device calculator wrappers now explicitly opt out of late max-width/grid inheritance and the tool smoke asserts handset-width ownership instead of checking overflow alone.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:mobile-actions`, and `npm audit --omit=dev` passed. `npm run test` / `npm run test:integration` still exceeded the local command window in this pass, so aggregate integration completion is not newly claimed here.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `f3971fe8b12cae0d88f66774ff3211f6bc53c17d` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and configured Sentry.
- Remaining boundary: one final human recheck on the physical small iPhone is still useful, but the live runtime now matches the fixed immersive-tool source.

## Traceability Addendum - 2026-07-04 Launch QA Trust Cleanup

- `GA-UX-005` gains honesty evidence: authenticated Shop Talk post creation now fails visibly when server persistence fails instead of inserting a local-only post that disappears on reload.
- `GA-UX-005` also gains fresh-account truthfulness evidence: new accounts no longer begin with fabricated record/training progress, and safety quiz copy no longer claims server safety-record persistence before that record type exists.
- `GA-UX-006` gains mobile polish evidence: Profile/Settings no longer exposes a duplicate local-only service-radius control, Pro copy reflects real launch gates, and bid-line fields have a 375px containment layout.
- `GA-FND-004` gains session-safety evidence: API, Shop Talk, and tool-record 401 responses now dispatch a shared session-ended signal so users are prompted to sign in again after revocation/expiry.
- `GA-OPS-007` gains rendered local evidence: `npm run test:ui:tools` and `npm run test:ui:mobile-actions` passed for this slice. Full machine-gate results are recorded in `docs/delivery/BUILD_STATE.md`.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `90f19da845519507a2a523672e822990ff9920de` with PostgreSQL/S3-compatible storage and configured Sentry; `EXPECTED_SOURCE_COMMIT=90f19da845519507a2a523672e822990ff9920de npm run monitor:production` passed.

## Traceability Addendum - 2026-07-05 Immersive Tools Small-Phone Containment

- `GA-UX-006` gains rendered small-phone evidence: immersive tools now hide shell chrome on compact devices so the top bar, guest banner, and bottom nav do not overlap the Heavy 16th calculator or invoice builder on SE-class phones.
- `GA-UX-003` gains tool-layout clarity evidence: invoice, daily-log, and tool workbenches now collapse to single-column compact-device layouts instead of relying only on wider breakpoint math, and the fraction calculator gets a dedicated compact fullscreen arrangement.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:mobile-actions`, and `npm audit --omit=dev` passed. The DB-backed integration half of `npm run test` completed in this pass rather than timing out.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `c9b2a0033bc7155abd031f47db414d71bcfc028f` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and configured Sentry.
- Remaining boundary: one physical iPhone SE recheck is still required before this slice can be treated as fully real-device verified instead of smoke/deploy verified.

## Traceability Addendum - 2026-07-05 Physical Small-Phone Compact Guard

- `GA-UX-006` gains narrow-device containment evidence: SE-class phones and other truly narrow coarse-pointer devices now set a root compact-device flag based on physical screen/viewport floor instead of relying only on CSS viewport breakpoints.
- `GA-UX-006` also gains shell truth evidence: when the compact-device flag is present, the desktop sidebar/search layout is forcibly suppressed and the mobile shell/nav is restored even if the browser reports an odd desktop-like viewport mode.
- `GA-PRO-001` gains onboarding reachability evidence: the auth intro and guest-preview orange screens reuse the compact narrow-phone containment rules under the same compact-device flag, preventing desktop-style preview compositions from overflowing on tiny physical phones.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test:ui:mobile-actions`, `npm run test:e2e`, and `npm audit --omit=dev` passed. Full `npm run test` exceeded the local command window, so aggregate DB-backed completion is not claimed here.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `8a6377c70fa664ff4dd800beac50df3795aafacd` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=8a6377c70fa664ff4dd800beac50df3795aafacd npm run monitor:production` passed.
- Remaining boundary: this addendum strengthens shell/auth behavior on physically small phones, but it is still not a substitute for a final real-device pass across Safari/PWA installed mode and Android Chrome before broad launch.

## Traceability Addendum - 2026-07-04 Mobile Layout and Device Accessibility Subtraction

- `GA-UX-006` gains rendered mobile evidence for a device-accessibility slice across Home, Work, Crew, Shop Talk, Tools, Records, and Profile/Settings at 390x844 with no document-wide horizontal overflow and no sampled visible sub-44px touch targets.
- `GA-UX-003` gains subtraction evidence: Work mobile tabs are now compact horizontal chips, Records and non-calculator tool shells no longer spend the first viewport on explanatory command blocks, and Crew/Profile/Moderation copy was shortened where screens were narrating themselves.
- `GA-UX-005` gains clearer-state evidence: Records/Job Photos now describes private cloud photo records without broad marketing copy, and the pass did not add fake verification, fake storage success, or frontend-only production claims.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, `npm run launch:readiness -- --require-ready`, and `git diff --check` passed.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `c33200506efd8018552fa847eda3fabdcf2bf5d6` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=c33200506efd8018552fa847eda3fabdcf2bf5d6 npm run monitor:production` passed.
- Remaining boundary: physical iOS Safari, Android Chrome, desktop keyboard-only, and screen-reader evidence remain required before the deeper accessibility boundary can be considered verified.

## Traceability Addendum - 2026-07-03 Typography and Breakpoint Polish

- `GA-UX-003` gains visual-system clarity evidence: Home, Work, Crew, Profile/Settings, and Shop Talk/Trade News now share semantic v2 text aliases instead of screen-specific hardcoded 14/16/19px patterns.
- `GA-UX-006` gains mobile polish evidence: a 430x932 rendered guest-preview smoke checked Home, Work, Crew, Shop Talk, Tools, and the Profile/Settings menu with no document-wide horizontal overflow; intentionally scrollable community/chip rows were the only offscreen detections.
- `GA-UX-006` also gains breakpoint cleanup evidence: the checked CSS no longer contains 9-12px font sizes, 15.5px Trade News body text, a stray 480px breakpoint, or 11px card radii.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:e2e`, `npm run test`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, `npm run launch:readiness -- --require-ready`, and `git diff --check` passed.
- `GA-OPS-008` gains production deployment evidence: live `https://rivt.pro/api/health` reported commit `530fe4f2152c1e191d7dc4e2c9d2b36ebb93119f` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=530fe4f2152c1e191d7dc4e2c9d2b36ebb93119f npm run monitor:production` passed.
- Remaining boundary: this addendum covers the typography/token/breakpoint polish slice only. It does not claim final product-wide design completion.

## Traceability Addendum - 2026-07-03 UI System and Settings Polish

- `GA-UX-003` gains Settings/Profile clarity evidence: Settings copy now names the actual work of the screen (`Profile, billing, storage, and alerts`), theme controls are compact icon swatches, and redundant storage allocation copy was removed.
- `GA-UX-005` gains honest-state evidence: the storage panel now says RIVT pays the infrastructure provider while user accounts consume plan quota, and it keeps the cloud/device boundary explicit without implying uploads are only on the user's phone.
- `GA-UX-006` gains mobile polish evidence: authenticated Settings at 390x844 verified no horizontal overflow, compact theme swatches, readable stacked storage rows, and reachable plan/storage sections; screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-settings-ui-system-polish.png`.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:e2e`, `npm run test`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, `npm run launch:readiness -- --require-ready`, and `git diff --check` passed.
- `GA-OPS-008` gains production deployment evidence: live synthetic monitoring confirmed commit `8f31a49b6ecd37a841bd7e72094ba9913e65dd2e`, PostgreSQL/S3-compatible storage, configured Sentry, operational controls off, and seven anonymous private-route checks.
- Remaining boundary: this addendum covers the foundational UI-system/Profile-Settings cleanup only. It does not claim completion of the broader typography scale sweep, breakpoint consolidation, or all remaining screen-by-screen mobile polish.

## Traceability Addendum - 2026-07-03 Profile Onboarding Subtraction

- `GA-UX-003` gains onboarding clarity evidence: Settings no longer exposes a second `Redo setup` flow after signup/onboarding has already been completed.
- `GA-UX-005` gains honest-state evidence: the removed modal wrote trade, rate, and city to `rivt.onboarding.v1` and local rate-card storage, so it is no longer presented as a production account setup path.
- `GA-UX-006` gains rendered mobile evidence: authenticated Settings smoke at 390x844 verified the `Redo setup` card/copy is gone and `Sign out` remains reachable; screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-settings-no-redo-setup.png`.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:e2e`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, `npm run launch:readiness -- --require-ready`, and `git diff --check` passed.
- `GA-OPS-008` gains production evidence: live synthetic monitor reported commit `2b714896e4a7913c8f67b734bf11171c50d80bb8`, PostgreSQL/S3-compatible storage, configured Sentry, and passing anonymous private-route checks.
- Remaining boundary: this addendum covers duplicate local Profile onboarding removal only. It does not claim completion of broad onboarding sequence polish, typography/token consolidation, or all remaining mobile layout items.

## Traceability Addendum - 2026-07-03 Claude Audit Auth Preview Honesty

- `GA-UX-005` gains honesty evidence: the public auth/onboarding preview no longer shows fabricated Shop Talk vote/reply counts as if preview posts already have organic engagement.
- `GA-UX-003` gains onboarding clarity evidence: preview cards now use neutral example labels so new users can understand Shop Talk, Work/Crew, and Tools without fake social proof.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:e2e`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, `npm run launch:readiness -- --require-ready`, and `git diff --check` passed.
- `GA-UX-006` gains rendered mobile evidence: built-client Playwright smoke at 390x844 verified the auth preview no longer renders the old fake engagement labels and does render the replacement example copy; screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-auth-preview-honesty.png`.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health`/synthetic monitor reported commit `7bab3358e28b5d994ccba02ecb5b832bfd239cfb`, PostgreSQL/S3-compatible storage, configured Sentry, and passing anonymous private-route checks.
- Remaining boundary: this addendum covers preview truthfulness only. It does not claim completion of physical-device onboarding QA, typography/token consolidation, or remaining broad mobile layout polish.

## Traceability Addendum - 2026-07-03 Live Subscription QA and Storage Settings Polish

- `GA-UX-005` gains live manual billing evidence: the owner account completed RIVT Pro signup, scheduled cancellation from Settings, confirmed continued paid-through access through August 3, 2026, and resumed the subscription from the same screen.
- `GA-UX-006` gains mobile polish evidence: live Android screenshots exposed Settings storage label/value collisions, and the storage panel now uses dedicated stacked rows so S3 location, payer, quota, allocation, and policy copy wrap cleanly inside the card.
- `GA-UX-005` keeps the storage honesty boundary: the UI continues to state that cloud photos and attachments are stored in managed S3-compatible object storage and billed to RIVT's infrastructure account, not silently kept only on the user's phone.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- `GA-UX-006` gains rendered evidence: after the in-app Browser could not reach the authenticated Settings storage card from its unauthenticated local session, Playwright fallback at 390x844 with mocked authenticated state verified stacked storage rows, no horizontal overflow, and no relevant app console/page errors; screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-settings-storage-polish-storage-card.png`.
- `GA-OPS-008` gains production deployment evidence: live `https://rivt.pro/api/health` reported commit `2f1717094d5eaa0c4749acf887694ae5c7afd400` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and Sentry configured; `EXPECTED_SOURCE_COMMIT=2f1717094d5eaa0c4749acf887694ae5c7afd400 npm run monitor:production` passed.

## Traceability Addendum - 2026-07-03 Subscription Controls and Shop Talk Cleanup

- `GA-UX-005` gains customer-control billing evidence on branch `codex/subscription-cleanup-controls`: RIVT Pro users can cancel directly from Settings without contacting support, keep access through the paid-through date, and resume a scheduled cancellation from the same screen.
- `GA-UX-005` also gains honest billing-copy evidence: the free/pro plan UI now distinguishes Stripe-managed payment details from RIVT-owned cancel/resume controls and does not imply RIVT takes a cut of job payments.
- `GA-COM-001` gains cleanup evidence: Shop Talk authors can delete their own posts through a server-owned route that hides the post from feeds and removes active media/upload records instead of leaving test or mistake posts stuck.
- `GA-OPS-004` gains auditability evidence: subscription cancel/resume requests and Shop Talk post deletions write audit events, preserving support visibility instead of making destructive client-only changes.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, targeted billing/Shop Talk integration tests, `npm run test:e2e`, `npm audit --omit=dev`, and `npm run test:integration` passed. Aggregate `npm run test` first exceeded a 5-minute local command window, so the equivalent unit and integration scripts were run and recorded separately.
- `GA-OPS-008` gains production deployment evidence: live `https://rivt.pro/api/health` reported commit `98afa82dd23811457a0213b9a8e46ebc2bc88d05` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=98afa82dd23811457a0213b9a8e46ebc2bc88d05 npm run monitor:production` passed.

## Traceability Addendum - 2026-07-03 Shop Talk Post Photos

- `GA-COM-001` gains local implementation evidence on branch `codex/shop-talk-image-posts`: Shop Talk posts can now carry server-owned photo media through `POST /api/v1/shop-talk/posts/:postId/media`, and post reads include signed thumbnail data for feed/detail rendering.
- `GA-UX-003` gains Reddit-style community UX evidence: the Shop Talk composer now supports add/change/remove photo, shows a preview before posting, and allows title-plus-photo posts instead of requiring body text for image-led questions.
- `GA-UX-005` gains honest storage evidence: photos are not treated as production-ready local blobs; authenticated uploads require S3-compatible object storage and Postgres media rows, while storage failures return a visible post-created-without-photo state instead of fake success.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, targeted Shop Talk posts/migration integration tests, `npm run test:e2e`, and `npm audit --omit=dev` passed. Aggregate `npm run test` and `npm run test:integration` exceeded local command windows, so aggregate completion is not claimed for this pass.
- `GA-OPS-008` gains production deployment evidence: live `https://rivt.pro/api/health` reported commit `5c8ef97859bb02eb0db5cec0520c44e223cbdb20` with migration `0021_shop_talk_post_media`, PostgreSQL/S3-compatible storage, and Sentry configured; `EXPECTED_SOURCE_COMMIT=5c8ef97859bb02eb0db5cec0520c44e223cbdb20 npm run monitor:production` passed.
- Remaining boundary: live authenticated photo-post smoke is still intentionally not claimed because the current API has no safe production cleanup/delete route for test posts.

## Traceability Addendum - 2026-07-03 Tools Hub Consolidation

- `GA-UX-003` gains deployed Tools reachability evidence on `master` commit `85ce42cab4f938b217e21359aecd700a505dd53f`: the Tools hub keeps the five primary field apps visible while exposing all fifteen supporting utilities through compact Money / Site / Business launchers instead of leaving implemented tools unreachable.
- `GA-UX-005` gains honest-state evidence: the Tools hub now labels the storage boundary directly, stating that standalone drafts save on the device while accepted-work records and uploaded photos use cloud storage.
- `GA-UX-006` gains rendered mobile evidence: `npm run test:ui:tools` passed and saved mobile/desktop screenshots under `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`; the smoke asserts five primary launch cards, fifteen compact supporting launchers, and intact calculator/estimate/invoice/daily-log/records paths.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check` passed. The aggregate `npm run test` pass included all 15 DB-backed integration suites.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `85ce42cab4f938b217e21359aecd700a505dd53f` with migration `0018_shop_talk_moderation`; `EXPECTED_SOURCE_COMMIT=85ce42cab4f938b217e21359aecd700a505dd53f npm run monitor:production` passed.
- Remaining boundary: the hidden-tool launcher problem is closed, but duplicate client/payment/checklist surfaces and server persistence for local-only money/business records remain open.

## Traceability Addendum - 2026-07-03 Reachability and Naming Cleanup

- `GA-UX-003` gains deployed navigation clarity evidence on `master` commit `c974faf1bd96f16da19c678ad6880965632fd214`: the active product vocabulary now uses `Work` instead of `Marketplace`, `Crew` instead of `My Crew`, and `Shop Talk` instead of lingering `Trade Talk` naming/class paths across routes, onboarding destinations, profile links, legacy bridge copy, and active Shop Talk CSS hooks.
- `GA-UX-003` also gains reachability evidence: global person search no longer drops users on a generic Crew page; selecting a person result opens Crew with a focused search-result spotlight showing the selected profile's name, headline, trade/location, and availability.
- `GA-UX-006` gains mobile E2E evidence: `npm run test:e2e` now covers top-bar search for `Riley Harper`, tapping the person result, and verifying the Crew search-result landing state.
- `GA-UX-005` gains subtraction evidence: Crew no longer repeats `Network` page headers/descriptions and decorative metric tiles across Crew, Subs, Reviews, and Clients; the screen now uses one compact `Crew` header and tab content.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. `npm run test` timed out after roughly 15 minutes, so full aggregate local integration evidence is not claimed for this pass.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `c974faf1bd96f16da19c678ad6880965632fd214` with migration `0018_shop_talk_moderation`; `EXPECTED_SOURCE_COMMIT=c974faf1bd96f16da19c678ad6880965632fd214 npm run monitor:production` passed.
- Remaining boundary: this pass resolves first-order naming/reachability issues only. Tool consolidation, duplicate money/client/checklist surfaces, typography/token/breakpoint consolidation, and server persistence for local-only business records remain open.

## Traceability Addendum - 2026-07-03 Minimal Truthfulness and UI Subtraction

- `GA-UX-005` gains honesty evidence on `master`: fake-looking Shop Talk fallback posts with fabricated authors, stock thumbnails, timestamps, upvotes, and comment counts were removed; remaining fallback prompts are clearly labeled `RIVT` starter prompts with zero votes and no fake comments.
- `GA-UX-005` also gains trust-copy evidence: the account profile showcase no longer renders a hardcoded `Verified` badge/chip, account facts now say `Consent` instead of `Trust`, and identity/payment readiness claims are no longer derived from the generic consent flag.
- `GA-UX-003` gains navigation/duplication evidence: the Home duplicate `Post work` / `Find your crew` CTA row and duplicate empty-state `Ask the trades` button were removed in favor of persistent Work/Crew navigation and the Shop Talk FAB; the `questions need a hand` nudge now opens the answer queue path instead of the ask composer.
- `GA-UX-006` gains rendered mobile evidence at 390x844: local Playwright QA verified zero duplicate Home CTA rows, zero fake seed authors, zero Tools dev-speak strings, zero standalone fake `Verified` labels, and zero console errors; screenshots are stored at `artifacts/ui-audit-2026-07-03/`.
- `GA-OPS-007` gains partial local automated evidence: `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:e2e`, and `npm audit --omit=dev` passed. `npm run test` and `npm run test:integration` timed out during the integration half locally, so full aggregate integration evidence is not claimed for this pass.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `e2d50f9a1d7a3d7d89f44c355b88c218d74c4aad` with migration `0018_shop_talk_moderation`; `EXPECTED_SOURCE_COMMIT=e2d50f9a1d7a3d7d89f44c355b88c218d74c4aad npm run monitor:production` passed.
- Remaining boundary: this is a focused truthfulness/subtraction pass. Broader audit items around tool consolidation, duplicate data surfaces, search profile routing, token/typography/breakpoint consolidation, and server persistence for local-only business records remain open.

## Traceability Addendum - 2026-07-03 Shop Talk Human Moderation Console and Report UX

- `GA-COM-004` gains local product evidence on branch `codex/shop-talk-moderation-console`: Shop Talk users now report communities, posts, and answers through a reason picker with explicit unsafe-advice, misinformation, spam, harassment, privacy/contact-info, duplicate/off-topic, and other categories plus optional reporter context.
- `GA-OPS-004` gains local staff-operations evidence: owner/support/moderator accounts receive an Admin account-menu entry, `/app/admin` renders a human-facing Shop Talk moderation console, and staff can inspect report queues, target snapshots, reporter context, and apply dismiss/hide/lock/archive/restore actions with required support notes.
- `GA-UX-005` gains honesty evidence: report submission remains server-first and only falls back to local feedback when persistence fails; the UI no longer hides hardcoded reasons behind one-tap report actions.
- `GA-UX-006` gains rendered mobile evidence: Playwright QA at 430px loaded the admin console with mocked reports, submitted a queue action, opened the Shop Talk report sheet, verified reason options, and found no horizontal overflow.
- `GA-OPS-007` gains local automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; the aggregate test pass included 15/15 DB-backed integration suites.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `f4db07fee34b760d10d9f16cc7593e163524e1a4` with migration `0018_shop_talk_moderation`; `EXPECTED_SOURCE_COMMIT=f4db07fee34b760d10d9f16cc7593e163524e1a4 npm run monitor:production` passed with seven anonymous private-route checks and configured Sentry.
- Remaining boundary: this closes the first usable support console/report-reason UX gap, but broad public Shop Talk still requires an explicit moderation SLA/process and a live-support-window report review exercise.

## Traceability Addendum - 2026-07-03 Shop Talk Moderation and Reporting Backend

- `GA-COM-001`, `GA-COM-002`, and `GA-COM-003` gain deployed moderation evidence on `master` commit `87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5`: communities, Shop Talk posts, and Shop Talk answers now have server-owned moderation states, and public read/write paths filter hidden content and reject writes into locked communities/posts.
- `GA-COM-004` gains deployed abuse-reporting evidence: authenticated users can report communities, posts, or answers through `POST /api/v1/shop-talk/reports`; reports are deduped while open/reviewing and retain a target snapshot for review.
- `GA-OPS-004` gains admin-control evidence: owner/support/moderator actors can list report queues and apply dismiss/hide/lock/archive/restore actions through admin-only routes; actions are recorded in append-only `shop_talk_moderation_actions` and mirrored into admin action events.
- `GA-UX-005` gains honesty evidence: user-facing Shop Talk report actions now distinguish durable server reports from local fallback feedback when persistence fails.
- `GA-OPS-007` gains automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. The integration pass used a Railway-backed `TEST_DATABASE_URL` and included migration lifecycle coverage through `0018_shop_talk_moderation`.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5` with migration `0018_shop_talk_moderation`; `EXPECTED_SOURCE_COMMIT=87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5 npm run monitor:production` passed.
- Remaining boundary: this is the server-owned moderation/reporting backend, not the final public moderation operation. A human-facing moderation console/SLA, richer reason picker, and queue-review evidence are still required before broad public Shop Talk exposure.

## Traceability Addendum - 2026-07-02 Shop Talk Reddit Backbone

- `GA-COM-001` gains deployed backend evidence on `master` commit `dba2acb77a3cc36d9757c895591e81e4bb24cf6e`: Shop Talk posts now require a real `community_id`, can be created/listed by community slug, and existing posts are backfilled into starter communities by migration `0017_shop_talk_reddit_backbone`.
- `GA-COM-002` gains deployed community evidence: authenticated users can create communities, creators become owners, duplicate candidates are surfaced before creation, and member counts are derived from actual `community_members` rows rather than seeded fake values.
- `GA-COM-003` gains deployed server-owned answer evidence: `shop_talk_answers` persists answers, the UI writes answers through the API when authenticated, and Verified Fix assignment is enforced server-side so only the original post author can mark the fix.
- `GA-UX-005` gains honesty evidence: fallback/offline community metadata no longer claims large fake member counts, and the old localStorage-only reply pathway was removed from the Shop Talk view.
- `GA-OPS-007` gains automated evidence: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, and `npm audit --omit=dev` passed; the integration pass used a Railway-backed `TEST_DATABASE_URL` and included migration lifecycle coverage through `0017`.
- `GA-OPS-008` gains production evidence: live `https://rivt.pro/api/health` reported commit `dba2acb77a3cc36d9757c895591e81e4bb24cf6e` with migration `0017_shop_talk_reddit_backbone`; `EXPECTED_SOURCE_COMMIT=dba2acb77a3cc36d9757c895591e81e4bb24cf6e npm run monitor:production` passed; live cross-user smoke `shop-talk-reddit-20260702233531-a72dd0` proved community creation, duplicate guard, scoped post listing, answer persistence, non-author Verified Fix rejection, author Verified Fix success, and cleanup.

## Traceability Addendum - 2026-07-02 UI Polish Phase 1 Launch Blockers

- `GA-UX-003` gains local navigation clarity evidence on branch `codex/ui-polish-phase-1`: duplicate global search surfaces were removed, the AppShell search is the single Cmd/Ctrl+K and top-bar search entry, and the normal-user `/admin` dead-end now redirects back to the app.
- `GA-UX-005` gains honest-state evidence: the shared offline banner is now the only user-visible offline state, Verified Fix no longer says `during testing`, failed Shop Talk thumbnails are hidden instead of displayed as broken placeholders, and `Records & photos` opens the real `Job Photos` tool instead of a misleading Records route.
- `GA-COM-003` gains partial client-side trust evidence: `Mark fix` is shown only to the post author on the client while already verified answers still display their verified state. Server-side authorization for assigning a Verified Fix remains required before this can be treated as abuse-resistant.
- `GA-UX-006` gains rendered mobile evidence: in-app Browser QA at 430px and 390px verified one search dialog, the `Job Photos` tool path, Heavy 16th calculator target sizing, and no horizontal overflow or console warnings/errors in the checked flows.
- `GA-OPS-007` gains local automated evidence for this branch slice: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run test:ui:tools`, and `npm audit --omit=dev` passed with 0 vulnerabilities. The aggregate `npm run test` command timed out locally during the integration half, so full local test evidence remains incomplete for this slice.
- `GA-OPS-008` gains deployment evidence: UI polish source commit `912332eb7daf561fb2e4c60290b3da5b08268885` was merged to `master`, Railway deployment `116da2b7-75b9-4f73-8dbd-e79a1543f7ca` served it on live `/api/health` with migration `0016_communities`, PostgreSQL/S3-compatible dependencies and Sentry healthy, and `EXPECTED_SOURCE_COMMIT=912332eb7daf561fb2e4c60290b3da5b08268885 npm run monitor:production` passed.

## Traceability Addendum - 2026-07-02 Tools Immersive Mobile Gestures

- `GA-UX-003` gains mobile navigation evidence on branch `codex/tools-immersive-swipe`: the bottom nav remains available on the Tools hub, hides only while a specific tool is open, and restores when the user returns to the hub or leaves Tools.
- `GA-UX-006` gains rendered mobile evidence at 430x932: the in-app Browser verified Tools hub -> `Heavy 16th` hides the bottom toolbar and frees the bottom viewport, then an edge swipe-right returns to the Tools hub with the bottom nav restored and no console warnings/errors.
- `GA-UX-006` also gains repeatable rendered-smoke evidence: `npm run test:ui:tools` passed after the smoke was updated to mock server-owned Shop Talk/community read endpoints and after the mobile Heavy 16th workbench height math was corrected for the 390x844 no-scroll calculator check.
- `GA-UX-005` retains honesty boundaries: this slice changes shell/tool navigation only; it does not claim fake invoice sending, SMS delivery, payment processing, escrow, payroll, tax filing, or frontend-only Records success.
- `GA-OPS-007` gains partial local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run test:ui:tools`, and `npm audit --omit=dev` passed with 0 vulnerabilities. The aggregate `npm run test` command was attempted and timed out after five minutes during the integration half, so full local test evidence remains incomplete for this slice.
- `GA-OPS-008` gains deployment evidence: Tools immersive source commit `f29e0e34e96fa3d4b43d2f283fc0b7f297d2344d` was pushed to `master`, Railway production service `RIVT` served that source on live `/api/health` with migration `0016_communities`, PostgreSQL/S3-compatible dependencies and Sentry healthy, and `EXPECTED_SOURCE_COMMIT=f29e0e34e96fa3d4b43d2f283fc0b7f297d2344d npm run monitor:production` passed.

## Traceability Addendum - 2026-07-02 Community Discovery and Tools Pricing Guidance Branch

- `GA-UX-003` gains local navigation clarity evidence on branch `codex/community-tools-pass`: Shop Talk community discovery now has searchable community rows, community pages, back navigation to all communities, and visible member/post/join state.
- `GA-COM-001` and `GA-COM-002` gain local community-surface evidence: posts can be scoped by selected community, and rendered QA verified `Cabinetry Talk` shows only the matching Cabinetry post instead of borrowing unrelated Carpentry content.
- `GA-UX-005` gains honest-tooling evidence: the Tools tab no longer presents active-job context as a required frame for standalone tools, and Estimate/Invoice pricing guidance is explicitly heuristic instead of a server-owned market-rate guarantee.
- `GA-UX-006` gains rendered mobile evidence at 430x932 for Shop Talk community search/open behavior, the fuller-screen Tools launcher, Estimate pricing signal, and Invoice labor-line pricing signal.
- `GA-OPS-007` gains local automated evidence for this branch slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed with 0 vulnerabilities.
- `GA-OPS-008` gains deployment evidence: community/tools source commit `572f401b19a3b60a75bce965e11217e2df464428` was merged to `master`, Railway served it on live `/api/health` with migration `0016_communities`, PostgreSQL/S3-compatible dependencies and Sentry healthy, and `EXPECTED_SOURCE_COMMIT=572f401b19a3b60a75bce965e11217e2df464428 npm run monitor:production` passed.

## Traceability Addendum - 2026-07-02 Onboarding V2 Hybrid Branch

- `GA-PRO-001` gains onboarding activation evidence on branch `codex/onboarding-v2-hybrid`: first-time users now see a short Trade Talk/product education sequence, then choose a trade and area for a preview workspace before they decide to create an account.
- `GA-UX-003` gains mobile onboarding clarity evidence: the intro is skippable, the preview is explicit about being non-production, and signup/login remain available without blocking product understanding.
- `GA-UX-004` and `GA-FND-004` retain trades-only and server-gated behavior: no homeowner flow was added, no role-switching was reintroduced after setup, and apply/post/message/save/publish actions still require account setup instead of frontend-only success.
- `GA-UX-005` gains fail-closed first-visit evidence: anonymous session bootstrap no longer shows a red `Authentication required` message before the user tries to log in, while failed login/signup attempts still surface server-owned errors.
- `GA-UX-006` gains rendered mobile evidence at 430x932 for the orange intro, guest preview selector, and logged-in Home checklist spacing. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-intro-430.png`, `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-preview-430.png`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-logged-in-430.png`.
- `GA-OPS-007` gains local automated evidence for this branch slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed with 0 vulnerabilities.
- `GA-OPS-008` gains deployment evidence: onboarding V2 hybrid source commit `fc59728ed34318fb72da9e5506a29cd602b9d5e2` was pushed to `master`, Railway production service `RIVT` served that source on live `/api/health` with migration `0016_communities`, PostgreSQL/S3-compatible dependencies and Sentry healthy, and `EXPECTED_SOURCE_COMMIT=fc59728ed34318fb72da9e5506a29cd602b9d5e2 npm run monitor:production` passed.

## Traceability Addendum - 2026-07-02 Home Getting Started Checklist

- `GA-PRO-001` gains post-onboarding activation evidence: Home now shows a role-aware `Get RIVT working for you` checklist so new contractors and tradespeople understand the next useful actions after account setup.
- `GA-UX-005` gains honest state evidence: checklist progress is derived from real app state where available, including jobs/drafts, profile basics, profile bio/headline, joined communities, authored Trade Talk posts, records beyond the legal baseline, and passed safety certs. Action clicks route to existing product surfaces and do not fabricate completion.
- `GA-UX-006` gains rendered mobile QA evidence: the checklist was tested through the in-app Browser at 430x932 using the guest path; the pass verified zero console warnings/errors, legible dark-mode action pills after a fix, correct `Find communities` routing to Shop Talk, and a working dismiss control.
- `GA-DATA-001` and `GA-FND-004` retain honesty boundaries: this slice did not add homeowner flows, seed/demo success, provider claims, server authorization changes, or frontend-only production readiness claims.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed with 0 vulnerabilities.
- `GA-OPS-008` gains deployment evidence: checklist runtime source commit `285ce7a8841b2ca921d98692143e7632333b96cf` was pushed to `master`, Railway production service `RIVT` served that source on live `/api/health` with migration `0016_communities`, PostgreSQL/S3-compatible dependencies and Sentry healthy, and `EXPECTED_SOURCE_COMMIT=285ce7a8841b2ca921d98692143e7632333b96cf npm run monitor:production` passed.

## Traceability Addendum - 2026-07-02 Onboarding Education and Activation

- `GA-PRO-001` gains UX activation evidence: post-signup onboarding now asks each user what they are trying to do first, shapes the feed with trade and topic interests, and routes them to the relevant first product surface instead of always dropping them on Home.
- `GA-UX-003` gains onboarding clarity evidence: the auth entry screen now explains RIVT's core surfaces through interactive capability cards for Trade Talk, Work, Crew, and Tools without adding a long modal tour.
- `GA-UX-004` retains the role boundary: the role selector remains an onboarding-only setup control and no authenticated Contractor/Tradesperson role toggle was reintroduced.
- `GA-DATA-001` and `GA-FND-004` retain honesty boundaries: this slice did not add homeowner flows, fake seed users, frontend-only verification, new permissions, or fake provider success.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed with 0 vulnerabilities.
- `GA-OPS-008` gains deployment evidence: onboarding runtime source commit `cf7fa3a53d2fab9f5378957b0fdb68b8c37f0894` was pushed to `master`, Railway source redeploy was accepted for production service `RIVT`, live `/api/health` reported the source with PostgreSQL/S3-compatible dependencies healthy, and `EXPECTED_SOURCE_COMMIT=cf7fa3a53d2fab9f5378957b0fdb68b8c37f0894 npm run monitor:production` passed.

## Traceability Addendum - 2026-07-01 Shop Talk Server Read Path Wiring

- `GA-UX-001` gains maintainability evidence: Home and Shop Talk now share centralized community display metadata in `src/features/shop-talk/community-directory.ts` instead of maintaining duplicate hardcoded community arrays.
- `GA-UX-005` gains server-read evidence: authenticated Shop Talk loads canonical `/api/v1/shop-talk/posts` rows and `/api/v1/communities` rows for post IDs, timestamps, member counts, and joined state, while guest/offline fallback remains explicitly a preview path.
- `GA-COM-001`, `GA-COM-002`, and `GA-COM-003` retain behavior while moving closer to canonical data: post selection/reactions now use string/UUID post IDs, newly created posts use the server-returned UUID when persistence succeeds, and the existing browser-local reply boundary remains unchanged because reply persistence is outside this slice.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed. Production deployment and authenticated live smoke remain required before this becomes production evidence.

## Traceability Addendum - 2026-07-01 Launch Rehearsal and Mobile Tool Polish

- `GA-UX-003` gains rendered mobile evidence for the top-bar contract: the mobile Search icon is visible again while the full desktop search field stays hidden at phone widths, preserving Search/Messages/Notifications/Profile as top-bar actions.
- `GA-UX-005` gains rendered Shop Talk / Trade News evidence: mobile Trade Talk and Trade News search bars remain usable instead of being hidden with the fieldbar; the smoke covers Trade Talk reactions, answer posting, Trade News filtering, real thumbnails, and original-source links.
- `GA-UX-006` gains calculator-fit evidence: the Heavy 16th fullscreen calculator workbench fits the 390x844 mobile viewport without internal vertical overflow, and `npm run test:ui:tools` verifies the calculator, estimate, invoice, daily log, and records/photos tool paths.
- `GA-OPS-007` gains launch-rehearsal evidence: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run test:ui:shop-talk-news`, `npm run test:ui:tools`, `npm run test:ui:work-lifecycle`, `npm run test:ui:mobile-actions`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, and `npm run launch:readiness -- --require-ready` passed.
- `GA-OPS-008` gains current production rehearsal evidence: production monitoring and the Railway-backed live smokes for Gate A hardening, jobs, match acceptance, messaging, projects, reviews/admin safety, and server-owned Shop Talk reactions passed. Live Stripe Checkout and Customer Portal sessions were created for the authenticated test account without charging a card; real paid-checkout completion plus webhook entitlement confirmation remains required before collecting money from first users.
- Pilot operations gain founder copy and first-week control evidence in `docs/launch/JACKSONVILLE_SOFT_LAUNCH_SCRIPT.md`.

## Traceability Addendum - 2026-06-29 Server-Owned Stripe Billing Entitlements

- `GA-FND-004` and `GA-OPS-004` gain entitlement-safety evidence: Pro access now depends on server-owned billing rows updated from verified Stripe webhook events, not frontend-only payment-link state.
- `GA-OPS-007` gains automated evidence for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, and `npm run launch:readiness -- --require-ready` passed.
- Migration coverage now includes `0014_billing_subscriptions` creation and rollback for billing customers, subscriptions, entitlements, and webhook event IDs.
- `PRODUCTION.md` and `.env.example` now document `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, Checkout return URLs, Customer Portal return URL, and the required `https://rivt.pro/api/stripe/webhook` endpoint/events.
- `GA-OPS-008` gains deployment evidence: live `https://rivt.pro/api/health` served source `30cd75325f58eef5ff95202480dda547ba1f31af` with ready migration `0014_billing_subscriptions`, PostgreSQL, S3-compatible object storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=30cd75325f58eef5ff95202480dda547ba1f31af npm run monitor:production` passed. Production Stripe variables and provider setup are still required before paid billing can be accepted.

## Traceability Addendum - 2026-06-28 Launch Readiness Machine Gate Sweep

- `GA-UX-003`, `GA-UX-005`, and `GA-UX-006` gain current rendered mobile evidence: `npm run test:ui:mobile-actions`, `npm run test:ui:work-lifecycle`, `npm run test:ui:tools`, and `npm run test:ui:shop-talk-news` passed after the latest Work editor hotfix and production deployment.
- `GA-OPS-001`, `GA-OPS-002`, and `GA-OPS-006` retain operational readiness evidence: `npm run incident:readiness -- --require-ready` and `npm run launch:readiness -- --require-ready` passed with the approved backup owner, support hours, incident routing, recovery policy, monitoring, and operational-control requirements recorded.
- `GA-OPS-007` gains full machine-gate evidence for this sweep: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- `GA-OPS-008` gains deployment-monitor evidence: `EXPECTED_SOURCE_COMMIT=aac69811ef6d9b4088e5f4c95bc4bc3886a904ce npm run monitor:production` passed against `https://rivt.pro`, with live health reporting PostgreSQL, S3-compatible object storage, configured Sentry, no missing storage variables, anonymous private-route checks passing, and operational controls off.
- `GA-JOB-001` retains authenticated production smoke evidence from run `contractor-click-20260628212559-2114c1`; repeat authenticated live publish smokes are currently blocked by the expected server-owned daily publish limit on the shared production test contractor, not by a publish validation regression.
- Physical/manual device accessibility remains the next launch boundary before widening the pilot: iOS Safari install mode, Android Chrome install mode, desktop keyboard-only use, screen reader labels, and real slow-cellular behavior still need recorded acceptance or written launch risk acceptance.

## Traceability Addendum - 2026-06-28 Work Draft Editor Date Normalization Hotfix

- `GA-JOB-001` gains regression evidence for the user-reported Edit job validation failure: `JobEditorModal` now normalizes optional preferred start dates to `YYYY-MM-DD` or `null`, and `npm run test:ui:work-lifecycle` covers opening a saved draft editor with timestamp-shaped date data, saving it, and publishing without surfacing `Request validation failed`.
- `GA-UX-003` gains copy-polish evidence: preferred-start-date validation issues now map to the user-facing `preferred start date` label instead of the internal `preferredStartDate` field name.
- `GA-OPS-007` gains local automated evidence for this hotfix: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:work-lifecycle`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- `GA-OPS-008` gains deployment evidence: source `4fa7d083ad19b390e0ac5ddd30c379edd1b85641` was deployed through Railway; live `/api/health` reported PostgreSQL, S3-compatible object storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=4fa7d083ad19b390e0ac5ddd30c379edd1b85641 npm run monitor:production` passed; authenticated `npm run smoke:contractor-click-path:live` passed with run `contractor-click-20260628212559-2114c1`.

## Traceability Addendum - 2026-06-28 Live Contractor Click-Path and Mobile Containment

- `GA-JOB-001` gains authenticated production UI evidence: `npm run smoke:contractor-click-path:live` creates a complete draft through the live API, logs into `https://rivt.pro` as the production test contractor, opens the draft in the mobile Work UI, publishes it through the actual button, verifies it appears under Open work, then closes the temporary job during cleanup.
- `GA-UX-003` and `GA-UX-006` gain live mobile click-path evidence: the smoke drives top-bar Search -> Tools, bottom-nav Work/Crew/Shop Talk, Trade News, notification quick action to Records, Crew invite planning, no horizontal/off-screen elements, no post-login failed responses, and no console/page errors on a 390px mobile viewport.
- `GA-UX-006` also gains responsive fix evidence from the failures the smoke exposed: Work section/detail tabs now use mobile-safe grids instead of off-screen horizontal tab rows, selected contractor Work details hydrate canonical private jobsite data before publish-readiness checks, and mobile focus/tap targets receive bottom-nav scroll margin.
- `GA-OPS-007` gains automated evidence for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:work-lifecycle`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, `git diff --check`, and authenticated `npm run smoke:contractor-click-path:live` passed.
- `GA-OPS-008` gains deployment evidence: Railway deployment `f3168081-4b7b-4eb0-970c-c83cf82082dc` served source `c911914f90e748c2a8c58763de3196c4865f9382`; live `/api/health` returned ready migration `0013_album_storage_scope`, PostgreSQL, S3-compatible object storage, and configured Sentry; `EXPECTED_SOURCE_COMMIT=c911914f90e748c2a8c58763de3196c4865f9382 npm run monitor:production` passed.

## Traceability Addendum - 2026-06-28 Work Lifecycle Bridge and Active-Work Tool Paths

- `GA-UX-005` gains UI evidence: Work accepted-detail surfaces now route directly to Daily Log, Records/photos, and Invoice Draft using the existing Tools/Records surfaces rather than disconnected buttons or unsupported deep links.
- `GA-MAT-005`, `GA-MAT-006`, and `GA-PRJ-001` gain rendered lifecycle evidence: `npm run test:ui:work-lifecycle` covers contractor draft publish, applicant shortlist/offer, tradesperson application draft/submit, offer acceptance into active work, active-work Daily Log launch, Records/photos launch, and Invoice Draft launch on a 390px mobile viewport with no page/console errors and no horizontal overflow.
- `GA-JOB-001` gains regression evidence for the user-reported publish-from-draft path: the new rendered smoke publishes a ready draft without surfacing "Request validation failed" and then verifies the job appears under Open work.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:work-lifecycle`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` gains deployment evidence: source `b6f6496178e55648eddad5226326007ea6c0a032` was deployed through Railway, and live `/api/health` reported ready migration `0013_album_storage_scope`, PostgreSQL, S3-compatible object storage, and configured Sentry.

## Traceability Addendum - 2026-06-27 Tools, Server, Styles, Shop Talk, and Trade News Liability Reduction

- `GA-UX-001` gains maintainability evidence: invoice drafting, daily log, job photos, material takeoff, time tracking, bid building, expense logging, and earnings dashboard behavior were extracted from `src/features/tools/ToolsStudio.tsx` into dedicated feature modules; Trade News aggregation moved to `server/news.js`; server-owned Shop Talk reaction/reputation routes moved to `server/shop-talk.js`; retired legacy/integration bridge routes moved to `server/legacy-integrations.js`; photo album/media routes moved to `server/albums.js`.
- `GA-UX-003` and `GA-UX-005` gain UI evidence: Tools now groups standalone field apps, money/tracking apps, and closeout/business apps; Records exposes a clearer closeout workflow strip; Shop Talk and Trade News styles are owned by the Shop Talk feature; Trade News cards/details render article/fallback thumbnails without Google favicon placeholders.
- `GA-DATA-001` and `GA-FND-004` retain safety boundaries: the pass did not add homeowner flows, seed/demo data, fake provider success, frontend-only Records success, fake invoice sending, fake SMS/email delivery, fake payment processing, or fake closeout records. The legacy/integration bridge extraction preserved the existing retired endpoint, managed upload, identity/Stripe readiness, notification provider check, and invoice provider route contracts; the album route extraction preserved authenticated actor, upload, content-detection, signed-object, and database boundaries.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The rendered smoke and jobs-discovery E2E tests now block service workers so Playwright API mocks are not bypassed by PWA caching during local authenticated UI checks, and the Home E2E assertion accepts the product's time-aware morning/afternoon/evening greeting.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` gains deployment evidence: this slice was pushed to `master` and deployed through Railway. Live `/api/health` returned healthy PostgreSQL, S3-compatible object storage, ready migrations, and configured Sentry; live `/api/news?location=Jacksonville%2C%20FL` returned 30 trade-news items with real article/feed thumbnails where available. Authenticated production publish-path testing remains blocked until a valid production test login is available; local integration/E2E coverage verifies the draft publish path and validation boundaries.

## Traceability Addendum - 2026-06-22 Tools Extraction and Provider Documentation Hardening

- `GA-UX-001` gains maintainability evidence: Heavy 16th calculator behavior moved into `src/features/tools/FieldCalculatorTool.tsx`, and estimate-builder behavior moved into `src/features/tools/EstimateTool.tsx`; `src/features/tools/ToolsStudio.tsx` is reduced to 1,259 lines.
- `GA-UX-005` retains behavior boundaries: calculator modes, copy output, estimate inputs, target range calculation, and tool hub launch behavior remain unchanged.
- `GA-FND-001` gains deployment-readiness evidence: `PRODUCTION.md` now names Railway Object Storage as the current intended S3-compatible provider, documents required S3 variables and private signed-URL behavior, and states that missing object storage must fail closed with setup-required/503 behavior.
- `GA-AUTH-004` and `GA-OPS-004` retain safety boundaries: current auth signup/login/email verification/password reset endpoints use durable `authRateLimit`, and production email signup/password recovery must fail closed when Resend is not configured.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 App Activity Feed Hook Extraction

- `GA-UX-001` gains maintainability evidence: local activity feed state, toast state, toast auto-dismiss timing, notification-to-activity mapping, unread activity counts, and activity event recording moved from `src/App.tsx` into `src/app-shell/useActivityFeed.ts`.
- `GA-UX-003` retains behavior boundaries: activity toasts, activity panel fallback items, notification activity prioritization, mark-all-read behavior, and server event recording payloads remain unchanged.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 App Theme Hook Extraction

- `GA-UX-001` gains maintainability evidence: theme mode, theme palette, CSS variable application, color-scheme application, and localStorage persistence moved from `src/App.tsx` into `src/app-shell/useAppTheme.ts`.
- `GA-UX-003` retains behavior boundaries: dark/light theme toggle behavior, tool-manufacturer palette selection, and profile/account panel theme controls remain unchanged.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Shop Talk Reaction Hook Extraction

- `GA-UX-001` gains maintainability evidence: server-owned Shop Talk reaction target batching, ledger loading, pending state, reaction commits, and reset behavior moved from `src/App.tsx` into `src/features/shop-talk/useCommunityReactions.ts`.
- `GA-UX-005` retains behavior boundaries: Shop Talk answer/thread vote controls still use server-owned reaction data, error toasts still surface failed saves, and logout/session reset still clears reaction state.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 App State Type Extraction

- `GA-UX-001` gains maintainability evidence: App-owned account, auth, activity, feedback, payment, reaction-aggregate, crew shout-out, and Work filter type contracts were moved from `src/App.tsx` into `src/app-shell/app-state-types.ts`.
- `GA-UX-005` gains cleanup evidence: duplicate Shop Talk post/reaction type declarations were removed from `src/App.tsx` in favor of the existing `src/features/shop-talk/ShopTalkView.tsx` exported contracts.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Work Empty State and Runtime Helper Extraction

- `GA-UX-001` gains maintainability evidence: the Work empty-job fallback moved from `src/App.tsx` into `src/features/work/empty-job.ts`, and generic runtime helpers moved into `src/lib/app-helpers.ts`.
- `GA-UX-003` retains behavior boundaries: selected-job fallback, activity timestamp labels, retired event-bridge no-op behavior, and Shop Talk reaction idempotency-key generation remain unchanged.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Profile Training Data Extraction

- `GA-UX-001` gains maintainability evidence: profile safety training metadata, quiz types, quiz data, record checklist, and training module labels were moved from `src/App.tsx` into `src/features/profile/training-data.ts`.
- `GA-SAFE-004` and `GA-UX-005` retain behavior boundaries: training-progress, record-goal, safety-module count, and safety quiz result typing continue to use the same data.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Shop Talk Fallback Data Extraction

- `GA-UX-001` gains maintainability evidence: static Shop Talk fallback news and founder/community prompt records were moved from `src/App.tsx` into `src/features/shop-talk/fallback-data.ts`.
- `GA-UX-005` retains behavior boundaries: Shop Talk and Trade News still receive the same fallback items and community prompt records through the active route.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Shop Talk Community Helper Extraction

- `GA-UX-001` gains maintainability evidence: shared Shop Talk score sorting, community badge labeling, and server-owned reaction key helpers were extracted from `src/App.tsx` and `src/features/shop-talk/ShopTalkView.tsx` into `src/features/shop-talk/community-utils.ts`.
- `GA-UX-005` retains behavior boundaries: App-level community badges keep the existing 10/25 answer thresholds, while the Shop Talk screen keeps its existing 3/8 thresholds.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Dead Guest Job Fixture Removal

- `GA-UX-001` gains cleanup evidence: the unreferenced `guestDemoJobs` fixture was removed from `src/App.tsx`.
- `GA-DATA-001` improves launch hygiene: unused local demo job titles and example job details are no longer retained in the frontend bundle.
- `GA-OPS-007` gains local automated evidence for this cleanup slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Work Mapping Extraction

- `GA-UX-001` gains maintainability evidence: trade-code, difficulty-label, and work-type-label mappings were extracted from `src/App.tsx` into `src/features/work/work-mappings.ts`.
- `GA-UX-003` retains behavior boundaries: Work filters, profile publish specialties, and onboarding specialties still use the same mapping values.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 App Preference Helper Extraction

- `GA-UX-001` gains maintainability evidence: theme, palette, and auth-mode storage keys plus browser preference readers were extracted from `src/App.tsx` into `src/app-shell/preferences.ts`.
- `GA-UX-003` retains behavior boundaries: theme persistence, palette persistence, auth-mode session persistence, and fallback defaults are unchanged.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 App Route Metadata Extraction

- `GA-UX-001` gains maintainability evidence: route labels, destination mapping, path aliases, and page-title metadata were extracted from `src/App.tsx` into `src/app-shell/routes.ts`.
- `GA-UX-003` retains behavior boundaries: existing top-level navigation state, profile-menu routing, active destination mapping, and browser path handling still call the same route helpers.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Account Activity Panel Extraction

- `GA-UX-001` gains maintainability evidence: notification toast, notification panel, account panel, avatar fallback, account stat item, and theme-palette picker presentation were extracted from `src/App.tsx` into `src/app-shell/AppPanels.tsx`.
- `GA-UX-003` retains behavior boundaries: notification read clearing, account open/close, logout, and profile navigation remain owned by the existing App state and server flows.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Auth Screen Extraction

- `GA-UX-001` gains maintainability evidence: auth, verification/reset, guest prompt, onboarding, theme toggle, and progress-bar presentation were extracted from `src/App.tsx` into `src/features/auth/AuthScreens.tsx`.
- `GA-AUTH-001`, `GA-AUTH-003`, `GA-AUTH-004`, and `GA-AUTH-005` retain behavior boundaries: auth/session/onboarding state and server calls remain owned by the existing app flow, with the moved UI calling the same endpoints through shared `src/lib/api.ts`.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full DB-backed `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Legacy Sidebar Export Cleanup

- `GA-UX-001` gains maintainability evidence: unused deprecated `Sidebar` and `MobileNavStrip` exports were removed from `src/App.tsx` after confirming no references in `src` or `test`.
- `GA-UX-002` and `GA-UX-004` gain cleanup evidence that the old role-filtered nav helper table is no longer present in `App.tsx`; active primary navigation remains owned by AppShell.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full DB-backed `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Legacy App View Cleanup

- `GA-UX-001` gains maintainability evidence: unreachable deprecated `OperationsWorkspace`, old `MarketplaceView`, and old `PostJobModal` code paths were removed from `src/App.tsx` after call-site verification.
- Active Gate A surfaces remain routed through HomeDashboard, WorkWorkspace, ShopTalkView, NetworkHub, InboxCenter, ProfileRoute, ToolsStudio, and the lightweight LegacyBridge.
- `GA-UX-004` gains cleanup evidence that the removed legacy authenticated workspace path can no longer reintroduce the old role-toggle/global-post patterns through `OperationsWorkspace`.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The full DB-backed `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Foundation

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-FND-001 | Managed PostgreSQL and private object storage are required | Verified | Live `/api/health` and `npm run monitor:production` report PostgreSQL and S3-compatible storage healthy; anonymous `/api/storage` correctly returns 401 because storage readiness is private. |
| GA-FND-002 | Versioned database migrations own schema changes | Verified | Production runs checksummed transactional migrations with advisory locking; apply/rerun/rollback/reapply/tamper tests pass, and the latest live authenticated smoke verified migration `0011_shop_talk_reaction_events_immutable` with zero pending. |
| GA-FND-003 | Core records use normalized, user-owned domain tables | Partial | Canonical account/profile/organization/trade, job, application, offer, active-work, participant, timeline, conversation, message, receipt, notification, project, project media, completion, review, safety, support, admin-role, admin-action, and restriction foundations are live-smoked. The legacy app-state/event/payment-export bridge is retired and deployed; legacy rows remain quarantined for retention/rollback until the restore/retention decision. |
| GA-FND-004 | Authenticated tenant/ownership authorization protects every private API | Partial | Canonical job/match/messaging/project/review/safety/admin/support routes pass live smoke with owner, participant, blocked-account, restricted-account, and staff-role boundaries. Legacy app-state, event, and app-state payment export routes now fail with explicit retired responses in deployed source; anonymous hardening smoke confirms these private routes still fail closed. |
| GA-FND-005 | API uses consistent typed errors and validation | Partial | `/api/v1` has request IDs, Zod validation, stable errors, and pagination primitives; legacy APIs retain transitional shapes. |
| GA-FND-006 | Retryable writes are idempotent | Partial | Canonical idempotency storage is used by job, match, messaging, project, review, report, unsafe-work, support, and admin/restriction mutations; Packet 08 adds durable shared rate-limit buckets. Some smaller profile/session mutations remain non-idempotent by design. |
| GA-FND-007 | Auditable domain events use authenticated actor and subject | Verified | Job, application, offer, active-work, message, project media, project entry, completion, review, unsafe-work, support, restriction, admin action, and Shop Talk reaction events include actor/subject/time/reason as applicable; live smoke and append-only triggers cover critical domains. |
| GA-FND-008 | Internal diagnostics identify deployed source revision and dependency readiness | Verified | Health/readiness identify exact source `13f7e2e`, dependencies, applied migrations, pending count, and Packet 08 operational-control state in production. |

## Authentication and Account

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-AUTH-001 | Email signup creates a real account with password policy | Partial | Async scrypt hashing, explicit role, 8-character minimum, invite gating, email verification, recovery, and auth throttling exist; breached-password screening remains deferred. |
| GA-AUTH-002 | Invalid login fails closed | Verified | Local fallback was removed; Playwright and deployed production smoke both prove a rejected login remains unauthenticated. |
| GA-AUTH-003 | Email ownership verification | Verified | Packet 02 added hashed, single-use verification challenges with expiry and live delivery; production smoke verified account verification and cleanup. |
| GA-AUTH-004 | Password reset and recovery | Verified | Packet 02 added hashed, single-use password recovery/reset with expiry and session revocation; production smoke verified recovery, reset, and cleanup. |
| GA-AUTH-005 | Google OAuth validates identity and continues onboarding | Verified | Google OIDC validation creates or links canonical accounts without fabricated role/company/location, and first-login users continue through pending onboarding; live provider handoff and account journey passed in Packet 02. |
| GA-AUTH-006 | OAuth uses safe redirect/state/nonce design and account linking rules | Verified | Packet 02 added state, nonce, PKCE, JWKS signature validation, redirect-intent records, and safe identity linking rules with source and live acceptance evidence. |
| GA-AUTH-007 | Session rotates after authentication and uses bounded lifetime | Verified | Signup/login/OAuth rotate sessions, sessions default to 30-day expiry, and Packet 02 live acceptance verified multi-session revocation and logout. |
| GA-AUTH-008 | Logout revokes server session and clears local auth | Verified | Local E2E coverage and a deployed disposable-account smoke prove logout clears the server session and subsequent `/api/auth/me` is anonymous. |
| GA-AUTH-009 | Auth endpoints are rate-limited and resist enumeration/CSRF | Partial | Auth/write/upload limits and approved-origin checks exist with SameSite cookies; enumeration review and explicit CSRF threat evidence remain. |
| GA-AUTH-010 | Account state and role are server-authoritative | Verified | Server role is required, pending during OAuth onboarding, and immutable afterward. The frontend no longer hydrates or saves account/app state through `/api/app-state`; deployed source `00147c8` retires the legacy app-state bridge. |

## Profiles and Onboarding

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-PRO-001 | Resumable contractor/tradesperson onboarding | Partial | Canonical onboarding APIs persist selected role, organization/profile basics, and resume state; richer checklist/profile-strength guidance remains outside Gate A. |
| GA-PRO-002 | Role-correct professional profile persists independently | Verified | Packet 81 adds canonical credentials, availability windows, avatar, portfolio, rate references, archive/restore/history, and one reusable network profile over the existing account profile. Exact-source production health and the authenticated owner/viewer lifecycle pass. |
| GA-PRO-003 | Trade specialties use canonical taxonomy | Partial | Versioned 25-trade taxonomy, profile relationship tables, and profile/onboarding APIs exist; broader profile-search and trade-management UX still need polish. |
| GA-PRO-004 | Service area and location privacy | Partial | Public-area/private-address protection is verified for jobs and accepted work; profile-level service-area normalization/geospatial privacy remains incomplete. |
| GA-PRO-005 | Availability and controlled contact visibility | Verified | Packet 81 adds dated private/network availability windows and exposes only chosen network windows through the authenticated profile used by search, applicants, Shop Talk, and linked Contacts. Production owner/viewer and block proofs confirm email, phone, exact address, evidence files, and private records remain excluded. |
| GA-PRO-006 | Profile photos/portfolio use authorized private media | Verified | Packet 81 adds account-owned managed avatar and portfolio media, signed reads, private-by-default work proof, explicit publication/removal, file validation, cleanup, and hidden-GPS rejection. Production object-storage, viewer filtering, removal, and cleanup pass. |

## Application Shell and UX

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-UX-001 | Compact role-correct shell and routes | Partial | Modern shell exists and Packet 08 UI system pass deployed a cleaner authenticated shell/sidebar/top-bar/main canvas treatment across Home, Work, Crew, Inbox, Tools, Records, and Profile on source `8d90ef2`. The shared UI primitives pass on source `b222917` added reusable page headers, panels, empty states, metric tiles, status pills, and avatars, then applied them to high-visibility shell/Home/Crew/Inbox/Profile/Work surfaces. The Tools primitive alignment pass on source `0680b8f` moved Tools and Records onto those shared primitives as well. Legacy views/routes and large `src/App.tsx` sections remain. |
| GA-UX-002 | Compact primary navigation | Partial | Packet 38 consolidates relationship work beneath Work -> People, leaving Home, Work, Shop Talk, and Tools as the exposed primary destinations. Existing Crew/network links resolve to People and retained roster, subs, client, review, and invite records remain available; desktop/mobile E2E covers the current shell. Older fallback components remain for later App cleanup, but the app-state bridge is no longer active frontend persistence. |
| GA-UX-003 | Messages, notifications, search, and profile use top-bar entry | Partial | Search, messages, notifications, and profile use top-bar entry; Packet 05 live smoke proves Messages/Notifications are server-owned. Authenticated UI smoke `ui-a11y-20260621062332-02b380` verified top-bar controls and opened search, notifications, profile/account, and messages/inbox across contractor/tradesperson mobile and contractor tablet/laptop/desktop scenarios after tap-target and text-scale fixes. Packet 13 adds an action matrix and local lifecycle smoke proof that Home's accepted-work summary has one exact workspace handoff; the job-scoped Messages/Photos/Daily log actions remain in that workspace. Older fallback components remain for later App cleanup, but messages/notifications do not depend on app-state persistence. |
| GA-UX-004 | No role toggle or duplicate global Post action | Partial | Signup/onboarding role selection exists appropriately; authenticated UI smoke `ui-a11y-20260621062332-02b380` verified no role toggle and no More tab in the signed-in contractor/tradesperson shell. Legacy components still need later cleanup. |
| GA-UX-005 | Every screen has loading, empty, error, offline, permission, and retry states | Partial | Work now has server loading, directional empty, error, retry, filter, and detail states with local E2E coverage. Home source `436b83f` adds `RIVT Daily` work/money/crew/field-knowledge signals plus a server-backed availability save path and desktop/mobile E2E coverage; source `73f79ac` updates the Home field signal to surface current Shop Talk answer opportunities when available; source `aeb23ca` expands Home with a daily habit loop and `Reputation momentum` panel that routes users toward Work, Shop Talk, and Tools without inventing fake marketplace density. Shop Talk/Trade News now has curated-source fallback content, search-first filters, summary metrics, honest empty states, readable card/detail states, loading skeletons, original-source links, and rendered desktop/mobile QA through `npm run test:ui:shop-talk-news`. Shop Talk source `73f79ac` adds an Answer queue card, Answer now jump path, active answer-queue filter chip, and answer guidance card to improve the daily contributor loop; source `aeb23ca` adds a `Reputation path` card that explains first-answer, verified-fix, and badge progression while preserving the durable-reputation honesty boundary. Trade News source `a59eb47` adds real-media enrichment from RSS/article metadata, explicit article/feed/fallback thumbnail states, safer public-image filtering, mobile command/KPI compaction, and live `/api/news` proof of 24 real/feed thumbnails out of 30 with no missing thumbnails or source URLs. Shop Talk source `13f7e2e` moves reactions from browser-local state to authenticated server-owned thread/answer reaction aggregates with idempotent up/down/clear behavior, append-only reaction events, audit events, and a live Railway-SSH smoke; full author-earned reputation still needs canonical server-owned posts/answers and profile surfacing. Tools has working standalone local utility surfaces for Heavy 16th calculations, estimates, invoice drafts, material takeoff, and a new Daily Log field-record draft, plus server-backed Records. The Tools app surface pass on source `ad5ff7d` upgraded the active Tools hub with app-style launch cards, copy-ready ft/in/16ths calculator output, estimate composition meter, invoice email/SMS device draft affordances with no fake delivery claim, material presets, and repeatable rendered QA through `npm run test:ui:tools`. Heavy 16th source `444fc96` adds real Length, Spacing, Cuts, and Hardware modes with field-card copy output and 44px mode controls; the current Packet 08 metric rebuild adds true metric-native millimetre entry, decimal-tenths quick chips, mm/cm/m readouts, and compact-device smoke coverage instead of a metric-only display toggle. Invoice Draft source `97d9da7` adds a cleaner mobile builder, local browser-only saved templates, a polished printable preview, and print action while preserving no-fake-delivery copy. Daily Log source `aeb23ca` adds crew hours, site notes, blockers, materials, safety, next steps, checklist, copy/download output, and explicit device-local draft save/load; source `d03f2a` connects Daily Log to the authenticated Records API when accepted active work exists, adds the `Records-ready` target state and `Save to Records` timeline-note action, and preserves the device-local fallback when no accepted work is loaded. Records now has accepted-work selection, inline notes, evidence upload notes, stored evidence list, completion checklist, confirm/dispute controls, timeline, and closeout report preview; the Tools primitive alignment pass replaced one-off local Tools/Records empty/metric/status surfaces with shared primitives. Invoice delivery remains explicitly local draft/copy/download/print until server email/SMS delivery is implemented; Daily Log can now save a server-backed project note only through the accepted-work Records path, with copy/download/local draft fallback otherwise. Remaining screens still need the matrix. |
| GA-UX-006 | Responsive, keyboard, screen-reader, light/dark acceptance | Partial | Themes and skip link exist; public-shell browser smoke at 1280x720, 390x844, and 360x800 is recorded in `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md`, and a sub-44px auth input target-size issue was fixed. Expanded authenticated UI smoke `ui-a11y-20260621062332-02b380` covered contractor/tradesperson 360x800 and 390x844 phones, contractor 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and contractor 390x844 with 200% root text scale. It verified opened search, notification, profile/account, and messages/inbox surfaces, top-bar search/messages/notifications/profile, no More tab/role-toggle regressions, zero post-login console warnings/errors, zero small tap-target findings, reduced-motion preference, keyboard focus reaching named top-bar and primary-nav targets, and no horizontal overflow after fixing search, notification, theme-toggle, inbox, and 200% text-scale regressions. Trade News rendered QA and live `/api/news` checks on 2026-06-21 covered 1280x800 and 390x844 with no console errors, no Google favicon thumbnails, visible original-source links, usable detail state, real/fallback media classes, and mobile command/KPI compaction. Packet 08 UI system pass rendered local authenticated desktop/mobile QA for Home, Work, Crew, Inbox, Tools, Records, and Profile with zero page/console errors and no horizontal overflow, then deployed source `8d90ef2` to production. Shared UI primitives pass spot-checked Home/Work/Crew/Inbox/Tools/Records/Profile screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-primitives-pass` plus final mobile Crew/Profile at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-primitives-pass-final`, also with no horizontal overflow or console/page errors, and deployed source `b222917`. Tools primitive alignment source `0680b8f` passed desktop/mobile E2E coverage for Tools and Records after the primitive migration. Shop Talk command center source `4cef797` added repeatable rendered QA for Shop Talk and Trade News at 1440x900 and 390x844 with zero console/page errors and no horizontal overflow; Shop Talk reaction sources `1227e1c` and `13f7e2e` expand that QA with Social hub pulse visibility, thread/answer reaction toggle regression checks, server-owned reaction API mocks, active accessible labels, no horizontal overflow, zero console/page errors, and live authenticated Railway-SSH reaction smoke; Shop Talk answer queue source `73f79ac` expands the same QA with answer queue visibility, Answer now interaction, active answer-queue filter, answer guidance, and cleaned skip-link screenshot artifacts while preserving keyboard focus behavior; Daily Engagement source `aeb23ca` expands the same QA with the Shop Talk reputation path. Trade News real-media source `a59eb47` expands the same QA with real-media class checks and cleaner phone article-card spacing. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`. Tools app surface source `ad5ff7d` added repeatable `npm run test:ui:tools` coverage for Tools hub, Heavy 16th, Estimate Builder, Invoice Draft, and Material Takeoff at 1440x900 and 390x844 with zero console/page errors and no horizontal overflow; Heavy 16th source `444fc96` expands that rendered coverage across Length, Spacing, Cuts, and Hardware modes and raises mode/preset controls to the 44px tap-target floor. Invoice Draft source `97d9da7` expands `npm run test:ui:tools` to cover local template save/load visibility, recipient email/phone fields, email/SMS draft affordances, printable invoice preview, and no-overflow checks on desktop/mobile; Daily Engagement source `aeb23ca` expands it to cover the Daily Log mini-app, checklist toggles, preview, and local draft save; Daily Log Records bridge source `d03f2a` expands it to cover `Records-ready`, accepted-work target selection, `Save to Records`, project timeline note creation against mocked authenticated APIs, local draft fallback, and no-overflow checks. Daily Log live UI proof source `9c614ac` adds split production smoke coverage for real login, real accepted work, Tools -> Daily Log, `Records-ready`, server-backed `Save to Records`, live project-bundle verification, cleanup, and no horizontal overflow, with screenshot evidence at `C:\Users\zboyt\AppData\Local\Temp\rivt-daily-log-live-smoke`. Source `436b83f` adds desktop/mobile E2E coverage for Home `RIVT Daily` and availability update behavior, and a mobile visual pass tightened the Daily signal grid to avoid excessive top-of-screen height. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`. Physical devices, route-level keyboard workflows, screen-reader evidence, and full route-level manual coverage remain open. |

## Jobs and Discovery

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-JOB-001 | Contractor creates a job draft and publishes it | Verified | Packet 03 `jobs` tables, typed APIs, progressive editor, publish consent, idempotency, CI, E2E, and live smoke pass. |
| GA-JOB-002 | Contractor edits, pauses, closes, and views status history | Verified | Server state machine supports draft/open/paused/closed with append-only status events; Work UI exposes edit/publish/pause/resume/close; live smoke passed. |
| GA-JOB-003 | Job captures canonical scope, difficulty, tools/materials, schedule, pay expectation, location, and privacy | Verified | Canonical fields, validation, versioning, public location, private address, schedule/deadline, budget, duration, and requirements are implemented and live-smoked. |
| GA-JOB-004 | Only authorized contractor/organization members mutate a job | Verified | Job mutations require active owner/admin membership for the owning organization; CI and live smoke verify cross-contractor mutation returns 403. |
| GA-JOB-005 | Tradesperson discovers only real, open, permitted jobs | Verified | Tradesperson list API returns only published open jobs; seeded jobs/talent are removed from `src/data.ts`; live smoke verified open discovery and paused/closed hiding. |
| GA-JOB-006 | Search/filter works over server-owned records | Verified | `/api/v1/jobs` supports paginated server filtering by query, trade, difficulty, work type, location, insurance, and status; Work UI calls typed API; live smoke verified trade/region discovery. |
| GA-JOB-007 | Exact address remains server-private until accepted relationship | Verified | Packet 04 live smoke verified exact address was hidden before acceptance, revealed to the accepted tradesperson after offer acceptance, and unavailable to an unrelated tradesperson. |
| GA-JOB-008 | Published/paused/closed status transitions are server-enforced | Verified | Server enforces valid lifecycle transitions and rejects invalid duplicate/closed transitions; unit, E2E, and live smoke pass. |
| GA-JOB-009 | Job events are timestamped with actor/reason | Verified | Status events and audit events include authenticated actor/reason/timestamp and are immutable via trigger; lifecycle live smoke passed. |
| GA-JOB-010 | Rate limits and duplicate-submit protection | Verified | Job create/publish daily limits, idempotency-key replay protection, and Packet 08 PostgreSQL-backed write limits are implemented; job lifecycle and hardening smoke passed in production. |

## Applications, Offers, and Active Work

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-MAT-001 | Tradesperson submits one application per job | Verified | Packet 04 production smoke verified application submit and duplicate application rejection; schema enforces one application per job/applicant. |
| GA-MAT-002 | Tradesperson withdraws application | Partial | Authenticated withdraw API, timeline event, and Work UI action exist; acceptance smoke did not exercise withdrawal before hire. |
| GA-MAT-003 | Contractor sees authorized applicants and profiles | Verified | Packet 04 production smoke verified non-owner applicant list returned 403 and the owning contractor saw exactly the applicant profile preview. |
| GA-MAT-004 | Contractor sends an offer/invite to a specific applicant/person | Verified | Packet 04 production smoke verified applicant-specific offer creation and one active-offer boundary. |
| GA-MAT-005 | Tradesperson accepts/declines offer | Partial | Recipient-only accept/decline APIs and UI actions exist; production smoke verified accept and wrong-recipient rejection, while decline remains source/CI coverage only. |
| GA-MAT-006 | Accepted offer creates participants and Active work exactly once | Verified | Packet 04 production smoke verified offer acceptance created one active-work record with two participants and repeated acceptance returned the same active-work record. |
| GA-MAT-007 | Cancellation/reschedule records actor and reason | Verified | Packet 04 production smoke verified active-work reschedule and cancel events with reasons; append-only status events are migration-enforced. |
| GA-MAT-008 | Block/suspension/closed-job rules prevent action | Verified | Packet 04 production smoke verified wrong-recipient and closed accepted job boundaries; Packet 07 live smoke verified block-hardened discovery/detail/reputation paths and account-restriction mutation denial with support access preserved. |

## Messaging and Notifications

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-MSG-001 | Job-linked conversation exists only for authorized participants | Verified | Packet 05 live smoke `packet05-20260620123233-891897` proved accepted-work conversation creation, participant access, outsider empty list, and outsider direct-message 404. |
| GA-MSG-002 | Message persists once with sender and server timestamp | Verified | Packet 05 live smoke proved idempotent message send replayed the same persisted message and two messages remained in the conversation. |
| GA-MSG-003 | Unread/read state is persistent per participant | Verified | Packet 05 live smoke proved contractor unread count survived relogin and conversation read cleared unread state. |
| GA-MSG-004 | Message attachments use private authorized media | Partial | Packet 06 adds private participant-authorized project media and signed access; message attachment rows still remain `pending_authorization` until the messaging attachment UI/API is wired to project media. |
| GA-MSG-005 | Block/report/mute rules apply to messaging | Verified | Packet 05 live smoke proved mute suppressed a second message notification, conversation report persisted, and blocked sender returned `ACCOUNT_BLOCKED`. |
| GA-MSG-006 | Gate A in-app notifications represent real domain events | Verified | Packet 05 live smoke proved message/offer notifications were real server records, read-all worked, and notification text did not leak private address fields. |

## Project Records and Completion

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-PRJ-001 | Accepted work owns a project record/timeline | Verified | Packet 06 migration/API creates one private project per accepted active work, immutable entries, and live smoke opened a participant-scoped project record. |
| GA-PRJ-002 | Photo/file/note upload is user/job authorized | Verified | Project notes/media require accepted-work participant access; outsider project/media URL access returned 404 in live smoke. |
| GA-PRJ-003 | File type/size/content safety and private signed access | Verified | Multer size/MIME limits, content-signature checks, SHA-256, rejected media state, private object key, and participant-scoped signed URL route are implemented; live smoke rejected malformed PNG and authorized stored evidence URL. |
| GA-PRJ-004 | Completion submission contains note/evidence/checklist | Verified | Tradesperson completion API persists note, checklist, and evidence media IDs; live smoke submitted completion with evidence. |
| GA-PRJ-005 | Contractor confirms or disputes completion | Verified | Contractor-only confirm/dispute APIs persist actor/time/reason, notify the tradesperson, and update project/active-work state; live smoke confirmed one project and disputed another. |
| GA-PRJ-006 | Closeout report is reproducible and exportable | Verified | `/api/v1/projects/:id/report` generates deterministic JSON from canonical server records; live smoke proved the report matched after relogin and excluded private address. |
| GA-PRJ-007 | Original evidence and audit history are preserved | Verified | Upload rows, project media metadata/content hash, immutable project entries, completion submissions, and append-only resolution records preserve evidence/audit history. |

## Reviews and Safety

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-REV-001 | Only completed participants may review once | Verified | Packet 07 live smoke verified completed-active-work participant review creation, duplicate review rejection, and ineligible outsider review rejection. |
| GA-REV-002 | Two-sided review response/dispute state persists | Verified | Packet 07 live smoke verified pending review, dispute, response, admin resolve, and append-only review event behavior. |
| GA-REV-003 | Public reputation includes count/context and no fake data | Verified | Seeded review counts remain removed; Packet 07 live smoke verified reputation count/average from canonical reviews and blocked-account reputation hiding. |
| GA-SAFE-001 | Versioned signup and contextual work consent | Verified | Signup/job/application/offer consent is persisted; Packet 07 migration adds actor attribution and live smoke verified stop-work/review consent paths through accepted workflows. |
| GA-SAFE-002 | Block and report user/job/message | Verified | Packet 05 live-smoked conversation report/block; Packet 07 live smoke verified normalized safety reports and extended block enforcement across job and reputation alternate paths. |
| GA-SAFE-003 | Unsafe condition / stop-work record | Verified | Packet 07 live smoke verified no-fault unsafe-work/stop-work records with participant authorization, contextual consent, notifications, and append-only event history. |
| GA-SAFE-004 | Verification claims use accurate states | Partial | Seed talent verification/insurance claims were removed; Packet 07 production changes current visible copy to evidence-state and safety-module vocabulary. Counsel/content review and remaining legacy/deferred surfaces still need launch signoff. |

## Admin and Operations

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-ADM-001 | Internal routes require least-privilege admin authorization | Verified | Packet 07 live smoke verified normal-user admin overview 403 and staff-only admin overview/review/restriction/support actions through `admin_role_grants`. |
| GA-ADM-002 | Support can inspect safe account/workflow timeline | Partial | Packet 07 live smoke verified support cases/events and admin overview for review/report/support/restriction queues; a fuller support timeline remains a Gate A hardening item. |
| GA-ADM-003 | Moderation/account actions use reason and immutable audit | Verified | Packet 07 live smoke verified reason-required admin review/support/restriction mutations and immutable `admin_action_events` count. Broader moderation UI remains later work, but the safety-critical audit path is live. |
| GA-OPS-001 | Build and lint gates pass | Verified | Production build and repository-wide ESLint pass locally and in GitHub Actions with zero errors or warnings. |
| GA-OPS-002 | Direct production dependencies are declared and vulnerability gate passes | Verified | `fast-xml-parser` is direct, Multer is 2.2.0, all direct dependencies/devDependencies are exact-pinned in local source with `.nvmrc` set to Node 20, and `npm audit --omit=dev` reports zero vulnerabilities locally and in GitHub Actions. |
| GA-OPS-003 | Health, readiness, and build version are distinct | Verified | Deployed health and authenticated readiness report dependencies, migration version, operational-control state, observability setup state, and exact source commit `6d8e276`. Public health exposes only non-secret monitoring status. |
| GA-OPS-004 | Backup and timed restore drill pass | Blocker | Historical isolated database restores passed in June, and the approved 2026-08-02 refresh created one encrypted same-provider logical artifact for 109 tables and 8,811 rows. That refresh proves a current backup can be created but not that the exact artifact can be restored. It also does not independently retain or restore the referenced object bytes used by photos and attachments, and it does not prove scheduled, monitored recurrence. Packet 90 adds a content-digested v2 logical format and a guarded provider-neutral local recovery harness; those controls pass locally but are not provider or production recovery evidence. Keep `R-052` open. Exit requires restoration of the exact current artifact, independent retention and integrity-checked restoration of every required object byte, and approved/proved scheduled backups plus recurring restore drills. |
| GA-OPS-005 | Structured logs, error monitoring, alerts, and incident routing | Partial | Packet 08 added structured JSON request/domain logs and request IDs. `npm run monitor:production` and the scheduled `Production Synthetic Check` workflow now verify public health, provider controls, and anonymous fail-closed routes from outside Railway; the workflow installs from lockfile, uploads monitor evidence, opens/updates a single GitHub incident issue on failure, and closes it after recovery. Source `6d8e276` adds Sentry-compatible error monitoring hooks for HTTP 500, startup failure, unhandled rejection, and uncaught exception capture; `/api/health` and authenticated `/api/readiness` expose redacted monitoring setup status. Railway deployment `eaa7409d` configures Sentry Cloud for the RIVT production service, live health reports `observability.errorMonitoring.mode=configured`, and Sentry accepted smoke event `RIVT Sentry smoke test` with HTTP 200. Sentry alert rule `Send a notification for high priority issues` is connected to project `node-express`, notifies suggested assignees or recently active members on every trigger, and triggered once for the smoke issue at 2026-06-22 02:38 UTC; this is accepted as the first pilot escalation route, with dedicated phone/SMS paging recommended before broader scale. Backup owner Anya Tingle is recorded with email and phone status recorded, without storing the phone number in the repo. Founder-provided support coverage is recorded as Monday-Saturday, 9:00 AM-5:00 PM, America/New_York. `docs/operations/incident-routing.json` is approved for the Gate A pilot route scope by Michael at `2026-06-22T03:09:36.0366141Z`. Scenario A rehearsal passed on 2026-06-22: `npm run monitor:production` passed locally, `railway ssh --service RIVT --environment production -- npm run smoke:gate-a:live` passed inside the Railway service with zero seed/demo findings and seven anonymous private-route checks, and Sentry accepted incident-rehearsal event `43fc7567f458490582db1f6642e2e0ea` with HTTP 200. Michael approved founder/support/legal-safety signoffs at `2026-06-22T03:48:04.1166525Z`, and `node scripts/incident-readiness-check.js --json` now reports `ready` with zero findings. Dedicated phone/SMS paging remains recommended before broader scale. |
| GA-OPS-006 | Critical rate limits and upload abuse limits | Verified | Auth/write/upload limits now use PostgreSQL-backed `rate_limit_windows`, uploads retain MIME/size/count policy, domain quotas remain in workflow routes, and signup/mutation kill switches are live. Threshold tuning remains an operating task, not a launch blocker. |
| GA-OPS-007 | Automated tests cover critical journeys and authorization | Partial | Unit/integration and Playwright journeys pass; local `TEST_DATABASE_URL` is configured against isolated `rivt_test` Postgres so `npm run test` now executes all 12 DB-backed integration tests locally with zero skips; disposable-Postgres auth/job/match authorization coverage passes in GitHub Actions. Packet 08 controllable progress now opens top-bar search, notifications, profile/account, and messages/inbox in local mocked E2E, and production smoke `ui-a11y-20260621062332-02b380` applied interaction audits to those same top-bar surfaces across the expanded viewport/text-scale matrix after fixing search, notifications, theme toggles, Inbox, and 200% text-scale overflow. Source `436b83f` expands `npm run test:e2e` so Home opens on desktop/mobile, `RIVT Daily` and `Availability radar` render, and a mocked server-backed profile availability update persists before continuing through Work, top-bar actions, Tools, and Records. A temporary rendered Playwright QA pass covered Shop Talk -> Trade News on desktop/mobile against the real local `/api/news` endpoint. Production `/api/news` was verified after deployment `7fe1c3ea-d5f4-48c4-b757-a46ff8ebc369` on source `4fe22bc` with zero Google favicon thumbnails, zero missing thumbnails, and zero missing source URLs; the later Trade News real-media deployment `4fb062bd-1c3e-474e-90df-fe42f4f2e1fa` on source `a59eb47` returned 30 live items with 24 article/feed thumbnails, 6 fallbacks, zero missing thumbnails, zero missing source URLs, and zero Google favicon thumbnails. Tools E2E opens Heavy 16th, Estimate builder, Invoice draft, and Material takeoff on desktop/mobile; Records E2E opens accepted-work project records, submits a field note, and loads a server report. Rendered Playwright QA at 390x844 and 1440x900 found no horizontal overflow or console errors for Tools and Records. Packet 08 UI system and shared-primitives passes also rendered Home, Work, Crew, Inbox, Tools, Records, and Profile at desktop/mobile breakpoints with no horizontal overflow and no console/page errors. Shop Talk command center source `4cef797` adds repeatable `npm run test:ui:shop-talk-news` coverage for Shop Talk and Trade News search, original-source links, no horizontal overflow, and console/page-error regression checks at desktop/mobile widths. Shop Talk reaction sources `1227e1c` and `13f7e2e` expand that command with regression coverage for one active thread reaction, one active answer reaction, reaction clearing, server-owned reaction API mocks, Social hub pulse visibility, accessible active labels, and live authenticated Railway-SSH reaction smoke; Shop Talk answer queue source `73f79ac` expands it with answer queue visibility, Answer now interaction, active answer-queue filtering, answer guidance, and skip-link screenshot-artifact regression coverage; Daily Engagement source `aeb23ca` expands it with Shop Talk reputation-path coverage; Trade News real-media source `a59eb47` expands it with real-media class checks and deterministic media rendering. Tools app surface source `ad5ff7d` adds repeatable `npm run test:ui:tools` coverage for Tools hub, Heavy 16th calculator, Estimate Builder, Invoice Draft, Material Takeoff, email/SMS draft affordances, material presets, no horizontal overflow, and console/page-error regression checks at desktop/mobile widths. Heavy 16th source `444fc96` expands E2E and `npm run test:ui:tools` to cover Spacing mode and rendered mode behavior across Length, Spacing, Cuts, and Hardware. Invoice Draft source `97d9da7` further expands `npm run test:ui:tools` for template save/load, recipient fields, draft email/SMS actions, printable invoice preview, no horizontal overflow, and console/page-error regression checks. Daily Engagement source `aeb23ca` expands `npm run test:ui:tools` for the Daily Log mini-app, field-note entry, checklist toggles, preview output, local draft save, no horizontal overflow, and console/page-error regression checks; Daily Log Records bridge source `d03f2a` expands it for `Records-ready`, accepted-work target copy, `Save to Records`, project timeline note creation against mocked authenticated APIs, local fallback, no horizontal overflow, and console/page-error regression checks. Source `9c614ac` adds `npm run smoke:daily-log-ui:live`, and split live run `daily-log-ui-20260622004926-05a797` passed with real invited accounts, real accepted work, real browser login, server-backed `Save to Records`, one verified project timeline note, and cleanup of two disposable accounts. Error monitoring source `6d8e276` adds unit coverage for setup-required status, DSN redaction, no-op unconfigured capture, sanitized Sentry-compatible delivery, public health redaction, and production monitor observability output. The source also passed `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; server-owned reaction source `13f7e2e` passed the same local gate set plus `npm run smoke:shop-talk-reactions:live` and `npm run monitor:production`; source `6d8e276` passed `npm run monitor:production` live with observability evidence. Web Push generation source `21e534feef86958f58fda108f26c6184174d346d` adds 152 passing unit/frontend tests and 22 passing PostgreSQL 16 integration tests in GitHub Actions run `30577678020`; the workflow then stopped only at the intentional launch hold. Closeout source `922e94415ffd3bea3e2e6ac633705b91c283bb8b` passes build, lint, 158 unit/frontend tests, all three browser E2E journeys, and a zero-vulnerability dependency audit. Broader domains and physical/manual accessibility remain packet work. |
| GA-OPS-008 | Deployed commit, migrations, flags, and rollback are recorded | Partial | Packet 00-08 commits, Railway deployment IDs, config changes, migration status, operational controls, smoke/hardening audit evidence, timed isolated logical restore evidence, named backup-artifact restore evidence, expanded UI smoke evidence, production UI-smoke regression fixes through source `4fe22bc`, Tools studio deployment `ac8d1f8d` on source `24c37ac`, Records workspace deployment `83c95b13` on source `1679aec`, UI system pass deployment `747f71f5` on source `8d90ef2`, shared UI primitives deployment `e3ad8e53` on source `b222917`, Tools primitive alignment deployment `b7740f77` on source `0680b8f`, Shop Talk command center deployment `f001843b` on source `4cef797`, Tools app surface deployment `14bb03aa` on source `ad5ff7d`, Heavy 16th multi-mode deployment `6bd7f24d` on source `444fc96`, Invoice Draft app upgrade deployment `58d6dca4` on source `97d9da7`, Shop Talk reaction/social pulse deployment `740dfd5a` on source `1227e1c`, Trade News real-media/mobile-layout deployment `4fb062bd` on source `a59eb47`, RIVT Daily home check-in deployment `f17fbcec` on source `436b83f`, Shop Talk answer queue deployment `d717edd7` on source `73f79ac`, Daily Engagement Loop deployment `63a4f5aa` on source `aeb23ca`, Daily Log Records bridge deployment `95973719` on source `d03f2a`, Daily Log live UI proof deployment `1c138a66` on source `9c614ac`, server-owned Shop Talk reactions deployment `718003b2` on source `13f7e2e` with migration `0011_shop_talk_reaction_events_immutable`, error monitoring readiness deployment `3260e837` on source `6d8e276`, Sentry provider configuration deployment `eaa7409d`, incident-readiness tooling, launch-ops checklist, incident rehearsal runbook, recovery-policy approval, incident-routing approval, incident-rehearsal pass, Gate A approval packet, founder/support/legal-safety approvals, and historical readiness evidence are recorded. Web Push closeout deployment `e4dbe7fb-5290-4732-b377-b164002217a7` serves exact source `922e94415ffd3bea3e2e6ac633705b91c283bb8b` with migration `0042_push_vapid_generation`; health, the 605 ms monitor, and the final `3/3` physical-device readiness gate pass. Sentry rotation deployment `c6ddf9c8-91a3-4953-a47c-70c72deb154e` serves exact source `f505e5fcdd9874a172bb61b59ab083a2ff86e6d0`; health, the 590 ms monitor, replacement event/alert proof, prior-key disable, and post-retirement event proof pass. Current exact-source launch readiness intentionally fails closed on `ACTIVE_LAUNCH_HOLD`; final incident synthesis, explicit forensic-limit acceptance, fresh Railway Stage 1 review/approval, and deeper manual accessibility remain open boundaries. |
| GA-OPS-009 | Hosting capacity, redundancy, failover, and migration posture are evidenced | Blocker | Packet 92 records the decision to harden Railway before considering an AWS migration. Packets 92-94 add provider-neutral source controls for role separation, bounded database pools, leased maintenance, push attempt fencing, graceful shutdown, privacy-safe capacity telemetry, and fail-closed activation preflight. The consolidated candidate verifies those controls locally only. No new worker, replica, provider setting, load test, failover test, activation, deployment, or paid resource is claimed, and `R-055` remains open. After the credential incident closes and a fresh exact-source/cost approval is granted, exit requires a fresh provider snapshot, proved capacity and connection headroom, staged web/worker activation, verified alerts and rollback, bounded load/failure tests, and documented database failure-domain, recovery, and migration-trigger decisions. |

## Traceability Addendum - 2026-08-02 Release-Candidate Consolidation

- The historical `GA-OPS-007` row above records earlier test environments and
  results. It is not current-candidate PostgreSQL evidence. This workstation
  does not provide an authenticated PostgreSQL 16 acceptance target; the
  pull-request Gate A disposable PostgreSQL service remains the current
  candidate's database acceptance boundary.
- `GA-FND-004` gains expected-account binding for onboarding profile drafts,
  onboarding completion, the post-onboarding canonical refresh, and session
  inventory/revocation. A mismatch fails with `ACCOUNT_CONTEXT_CHANGED`
  before mutation. Browser assertions and database-backed cases are present
  in source; the final disposable-PostgreSQL 16 result, deployment, and
  physical two-account stale-tab check remain pending.
- `GA-FND-006` and `GA-UX-005` gain a durable payment-request reservation
  before Stripe Checkout creation, stable row-derived provider identity,
  convergence across different client retry keys, retained ambiguous outcomes,
  monotonic early-webhook finalization, and server-only Checkout URLs. This is
  local candidate source and test coverage, not PostgreSQL 16, provider,
  deployment, or real-payment evidence.
- `GA-OPS-004` gains strict nonlocal TLS, read-only-role, encryption-key,
  source-revision, artifact-version/digest, retention, newest-artifact, and
  source/target-isolation controls. They do not restore the current provider
  artifact or independently recover its referenced object corpus.
- `GA-OPS-005` gains locally verified fixed-schema capacity and request telemetry
  that classifies route families without retaining raw paths, query strings,
  actor identifiers, or free text. The new stream is not deployed and does not
  close the broader semantic-PII risk in `R-057`.
- `GA-OPS-005` and `GA-OPS-008` also gain typed, source-bound provider receipts
  plus a protected runtime-configuration proof path. Empty templates and
  repository code are not live provider evidence; no approved provider run is
  claimed.
- `R-050` and `GA-OPS-007` gain a complete offline install contract: a public
  Vite manifest binds the registered entry to every lazy feature chunk, both
  theme lockups, and the field fonts; a partial or mixed-build cache cannot
  activate. The production-build browser journey verifies zero missing
  manifest assets and passed three consecutive focused installed-app reopens.
- Code checkpoint `c936dd00fbe87db493e1ebeca142bbf50599eb9f`
  passed production build, application/security lint, 477/477 unit/frontend
  checks, all four browser E2E journeys, Tools/Trade News/mobile-actions/Work-
  lifecycle UI smokes, the guarded local recovery harness, diff integrity, and
  the zero-vulnerability production dependency audit. These are local checks;
  the exact final pull-request head and disposable-PostgreSQL 16 aggregate must
  still pass Gate A before review or merge.
- `GA-OPS-008` records no new deployment. The consolidated branch has not been
  merged or activated, the current production incident hold remains active,
  and Packet 94's earlier branch CI and dated Railway observations are
  historical evidence only.

## Traceability Addendum - 2026-06-22 Accessibility Boundary Progress

- `GA-UX-006` remains **Partial**, but automated production evidence was expanded materially on source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`.
- Railway deployment `17cc18db-0ac5-4f23-bf5f-955b98af38cb` passed production accessibility smoke `ui-a11y-20260622041456-3d6a3d`.
- The smoke covered contractor/tradesperson 360x800 and 390x844 phones, contractor 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and contractor 390x844 with 200% root text scale.
- Each scenario audited Home, Work, Crew, Shop Talk, Tools, and Home again, plus the opened search, notifications, account/profile, and messages/inbox top-bar surfaces.
- New automated checks include screenshot capture, visible main/navigation landmarks, visible image `alt` coverage, visible form-control naming, touch-target size, no horizontal overflow, top-bar command presence, no More tab/role-toggle regression, post-login console cleanliness, reduced-motion, and named keyboard focus targets.
- The run produced 72 screenshot PNGs at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-a11y-20260622041456-3d6a3d`.
- The hardened smoke found and verified fixes for two issues: a sub-44px Shop Talk search input on 360px mobile and 200% text clipping in Inbox metric labels.
- `GA-OPS-007` gains this production accessibility smoke evidence plus the existing local gates; `GA-OPS-008` gains deployment `17cc18db-0ac5-4f23-bf5f-955b98af38cb`, source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`, screenshot evidence, and cleanup evidence.
- `docs/quality/PHYSICAL_ACCESSIBILITY_CHECKLIST.md` now defines the remaining manual/physical boundary. Physical iOS Safari, Android Chrome, desktop keyboard-only, and screen-reader route evidence remain required before `GA-UX-006` can move to Verified.

## Traceability Addendum - 2026-06-22 Claude-Audit UI Consolidation

- `GA-UX-001` gains a local shell/design-system consolidation slice: v2 tokens now cover the referenced typography weights, info state colors, card shadow, topbar/sidebar sizing, and fallback radius values; shared button and skeleton primitives live in `src/components/ui.css`.
- `GA-UX-003` gains server-backed notification badge clearing evidence: opening the notification center now calls the existing `POST /api/v1/notifications/read` flow instead of leaving the badge stale.
- `GA-UX-005` gains improved loading/empty states: Inbox loading now renders skeleton cards, Crew empty states provide directional copy/actions, and Home no longer uses landing-page mission copy as repeated product UI.
- `GA-UX-006` gains local responsive cleanup evidence for mobile safe areas, horizontal Home availability controls, reduced duplicate desktop profile display, and modal close affordances.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. DB-backed local integration tests still skip because `TEST_DATABASE_URL` is not configured.
- `GA-OPS-008` gains deployment evidence: Railway runtime upload deployment `eb75395a-45c9-4d8d-b9cc-c9e63230fba9` and metadata redeploy `68e6eca4-8574-4c0c-b2a6-d533fc5cab47` now serve source `92fd0a71d6a39cd21c9b3e233c5caa2c1a37da54`; live `/api/health` and `EXPECTED_SOURCE_COMMIT=92fd0a71d6a39cd21c9b3e233c5caa2c1a37da54 npm run monitor:production` passed.
- Unified cross-surface search remains a real backend/product gap, not a frontend-only claim: no unified `/api/v1/search` endpoint currently exists, so this pass did not fabricate People/Jobs/Shop Talk result lists.

## Traceability Addendum - 2026-06-22 Global Search Command Surface

- `GA-UX-003` gains functional global search command evidence: the top-bar search modal now exposes explicit Work, Shop Talk, and Tools commands instead of accepting text with no visible destination-specific result.
- `GA-JOB-006` gains local e2e coverage that `Ctrl+K`, entering `electrical`, and selecting `Search work` routes to Work and preserves the server-backed Work query input.
- `GA-UX-005` gains a clearer no-fake-results state: people search is explicitly deferred until profile discovery is server-owned; the UI does not fabricate profile matches.
- `GA-UX-006` gains rendered desktop/mobile evidence for the search command modal and Work result state at `C:\Users\zboyt\AppData\Local\Temp\rivt-global-search-1782149323491`; Browser plugin access was unavailable for target `iab`, so local Playwright was used with route mocks.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. DB-backed local integration tests still skip because `TEST_DATABASE_URL` is not configured.
- `GA-OPS-008` gains deployment evidence: Railway runtime upload deployment `a4918783-b28c-4ab0-a606-851c631a62c3` and metadata redeploy `5c6c5a06-12b3-4ad8-a365-854a85ebcfdc` now serve source `98f4b6716674de57e6c38c497ea837105ad069b1`; live `/api/health` and `EXPECTED_SOURCE_COMMIT=98f4b6716674de57e6c38c497ea837105ad069b1 npm run monitor:production` passed.

## Traceability Addendum - 2026-06-22 Server-Owned Profile Search

- `GA-PRO-002` gains server-owned public profile discovery: `GET /api/v1/profiles` now searches only active completed accounts with published network profiles and returns limited public profile fields.
- `GA-PRO-003` gains trade-aware profile discovery evidence: profile search matches canonical trade names/codes through `profile_trades` and `trades` without introducing a parallel taxonomy.
- `GA-PRO-004` and `GA-PRO-005` retain privacy boundaries: the search response excludes email, phone, private address, private contact visibility, and unpublished profiles, and it filters blocked account pairs.
- `GA-UX-003` gains functional People results in the global search modal while preserving Work, Shop Talk, and Tools commands.
- `GA-UX-005` gains loading, empty, and error states for People search instead of a static "not built yet" placeholder.
- `GA-UX-006` gains rendered desktop/mobile profile-search and Crew-navigation evidence at `C:\Users\zboyt\AppData\Local\Temp\rivt-profile-search-1782153354986`; Browser plugin access was unavailable for target `iab`, so local Playwright was used with route mocks.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. DB-backed local integration tests still skip because `TEST_DATABASE_URL` is not configured.
- `GA-OPS-008` gains deployment evidence: Railway runtime upload deployment `1f29a48c-89aa-45a0-8554-dfce1d386924` and metadata redeploy `58a361b4-0f0a-41b5-8309-d3a4104fc1eb` now serve source `cda9733acdaa7ed858b819fc9b5904ee2c237600`; live `/api/health` and `EXPECTED_SOURCE_COMMIT=cda9733acdaa7ed858b819fc9b5904ee2c237600 RIVT_MONITOR_TIMEOUT_MS=30000 npm run monitor:production` passed.
- Remaining boundary: this is discovery, not a full social graph. Profile detail pages, connection requests, messaging permissions outside active work, and safe contact exchange remain future server-owned work.

## Traceability Addendum - 2026-06-22 Exact Direct Dependency Pinning

- `GA-OPS-002` gains reproducibility evidence: every direct runtime and dev dependency in `package.json` is exact-pinned to the version already resolved by `package-lock.json`; `latest` and caret ranges were removed from direct dependencies.
- `.nvmrc` now records Node major `20` for local/runtime alignment with the Railway target.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The first sandboxed `npm run test` attempt failed only because the sandbox blocked the isolated Railway test Postgres network connection; the same command passed after explicit network access was granted.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed, and no runtime product behavior changed.

## Traceability Addendum - 2026-06-22 Async Password Hashing

- `GA-AUTH-001` gains server hardening evidence: email signup, Google first-account creation, login verification, and password reset now use promisified async `scrypt` instead of blocking `scryptSync`, while preserving salt generation, 64-byte derived keys, and timing-safe comparison.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- The first sandboxed `npm run test` attempt timed out without useful output; the same command passed after explicit network access was granted for the isolated test Postgres.

## Traceability Addendum - 2026-07-05 Launch Final Train Local Verification

- `GA-UX-006` gains compact-device regression coverage for the Heavy 16th calculator: the decorative tape ruler is no longer exposed as the interactive control path in automation/accessibility, and the SE-class compact fullscreen path now explicitly verifies visible fraction-strip availability instead of repeated nudge-only entry.
- `GA-OPS-007` gains fresh local evidence on branch `codex/launch-final-train`: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, and `npm audit --omit=dev` all passed after the launch-final-train calculator/smoke alignment. The long DB-backed integration leg completed cleanly once given the full runtime window (44/44 unit, 18/18 integration).
- `GA-OPS-008` is unchanged in production for this slice: the work is currently local on `codex/launch-final-train`, not yet merged or redeployed, so no new runtime commit or Railway build is claimed here.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Frontend Smoke Test Tripwire

- `GA-OPS-007` gains frontend render-tripwire evidence: `test/frontend-smoke.test.mjs` now mounts Home, Work, Profile, and AppShell through Vite SSR and `react-dom/server` without adding dependencies.
- `npm run test:unit` now includes this frontend smoke suite, and `npm run test` proved 35 unit tests plus 12 integration tests passed with the new coverage.
- Required local gates passed for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 App Profile Route Split

- `GA-UX-001` gains maintainability evidence: the active Profile route adapter was extracted from `src/App.tsx` into `src/features/profile/ProfileRoute.tsx`, reducing direct route-render coupling while preserving existing account/profile behavior.
- This is the first safe slice of the larger `App.tsx` decomposition. Auth/session ownership remains in `App.tsx` because it is still shared by Settings and the top-bar account panel.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run test:unit`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Profile Session Ownership Split

- `GA-UX-001` gains maintainability evidence: `ProfileRoute` now owns session-list loading and non-current session revocation, further reducing active account/profile state in `src/App.tsx`.
- `GA-AUTH-007` retains behavior: current-session revocation still clears the whole app auth/session state through an App-owned callback.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run test:unit`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-06-22 Shop Talk Route Split

- `GA-UX-001` gains maintainability evidence: the active Shop Talk and Trade News surface now lives in `src/features/shop-talk/ShopTalkView.tsx` instead of inside the main application shell.
- `GA-COM-001`, `GA-COM-002`, and `GA-COM-003` retain behavior: the extraction preserves Shop Talk filtering, answer queue, post creation, reporting, verified-fix display, and server-owned reaction props.
- `GA-UX-004` retains Trade News behavior: the extracted view still uses the live `/api/news` fetch path with curated fallback data and source links.
- `GA-OPS-007` gains local automated evidence for this refactor slice: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- `GA-OPS-008` is unchanged for production deployment: this slice has not been deployed.

## Traceability Addendum - 2026-07-03 Screen Density Polish

- `GA-UX-006` gains rendered mobile evidence for a screen-density polish slice across Home, Tools hub, Heavy 16th calculator, Shop Talk, Trade News, Work, and Profile/Settings at 430x932 with no document-wide horizontal overflow.
- `GA-UX-005` gains clearer mobile information hierarchy evidence: Tools and Work now expose more usable first-screen content, Profile/Settings card rhythm is tighter, and Trade News fallback thumbnails render as deliberate source-initial badges instead of blank placeholder tiles.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, `npm run launch:readiness -- --require-ready`, and `git diff --check` passed.
- `GA-OPS-008` gains deployment evidence: production now serves source `cdaf0af3b71bc855f057cc525468a0a58db19040`; live `/api/health` reached that commit and `EXPECTED_SOURCE_COMMIT=cdaf0af3b71bc855f057cc525468a0a58db19040 npm run monitor:production` passed with PostgreSQL, S3-compatible storage, configured Sentry, controls off, seven anonymous private-route checks, and 591 ms duration.
- Remaining boundary: this is UI-density polish only. Physical device coverage, keyboard/screen-reader route sweeps, and additional screen-by-screen simplification remain open launch-quality work.

## Traceability Addendum - 2026-07-08 Soft Launch Polish Checkpoint

- `GA-UX-005` gains notification truthfulness evidence: review notifications now distinguish exact review targets from generic reviews-surface routes, so the action label no longer promises a specific review unless the notification carries one.
- `GA-UX-006` gains entry-screen hierarchy evidence: the returning-user path on the onboarding/landing carousel is promoted to an intentional account action while preserving the create-account path.
- `GA-OPS-007` gains local automated evidence for this slice: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. The aggregate `npm run test` command was attempted and timed out locally during the integration half; full DB-backed evidence still requires `npm run test:integration` with `TEST_DATABASE_URL`.
- `GA-OPS-008` gains deployment evidence: production now serves source `6cd8f5d6b87d057eb836f10bc79efc69a289d106`; live `/api/health` reached that commit and `EXPECTED_SOURCE_COMMIT=6cd8f5d6b87d057eb836f10bc79efc69a289d106 npm run monitor:production` passed with PostgreSQL, S3-compatible storage, configured Sentry, controls off, seven anonymous private-route checks, and 622 ms duration.
- Remaining boundary: this is a small launch-polish checkpoint only. Physical-device acceptance, screen-reader/keyboard route sweeps, and full DB-backed integration evidence remain separate launch-quality work.

## Current Gate A Summary

- Production infrastructure is reachable and managed storage is healthy.
- Authentication, canonical profiles/onboarding, jobs/discovery, match acceptance, messaging/notifications, project records/completion, reviews, admin operations, safety records, and server-owned Shop Talk reactions have production evidence.
- Packet 08 hardening audit passed live with exact source, migration status, anonymous fail-closed routes, operational controls, durable rate-limit storage, and zero seed/demo findings after cleanup.
- Founder/support/legal-safety signoff is recorded, and the machine-readable incident and launch readiness gates now report `ready`. Expanded production accessibility smoke now passes on source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`, but physical/deeper manual accessibility-device evidence remains the next non-machine launch-quality boundary. Error-monitoring capture code, Sentry ingestion, first pilot escalation, backup owner, support hours, incident routing, incident rehearsal, and the Gate A recovery policy are now configured.
- The app must continue to avoid fake seed data, frontend-only success, and homeowner flows.

## Traceability Addendum - 2026-07-10 Gate B Daily Use (Production Verified)

- `GA-UX-005` gains an honest active-work continuation surface: Home reads the participant-authorized project timeline and distinguishes loading, unavailable, completion-waiting, daily-log-saved-today, and no-log-yet-today states without manufacturing work progress.
- `GA-UX-003` retains exact-object routing: the Home workspace, Messages, Photos, and Daily Log actions preserve the active-work identifier instead of falling back to a generic Records list or unrelated job.
- `GA-OPS-007` gains controlled-engagement operating guidance in `docs/operations/GATE_B_CONTROLLED_ENGAGEMENT.md` for Shop Talk moderation, device alerts, matching-job privacy, support escalation, and job-record recovery.
- `GA-OPS-007` gains local evidence on `codex/gate-b-daily-use`: build, lint, security lint, 53/53 unit tests, E2E, active-work lifecycle UI smoke, mobile-action UI smoke, Shop Talk/Trade News UI smoke, dependency audit, and diff check passed. The aggregate remote PostgreSQL runner exceeded the local wrapper window without output or a test failure; no aggregate-pass claim is made.
- `GA-OPS-008` gains deployment evidence: `master` serves exact source `e44eb6a8e1b7d8c804880d1f956b3052f1596898`; the production monitor passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, matching alerts enabled, controls off, and seven anonymous private-route checks. The genuine active-job daily-log walkthrough remains a manual field-proof boundary.

## Traceability Addendum - 2026-07-11 Field Camera (Pending Deployment)

- `GA-PRJ-002` gains capture-context evidence: the field camera keeps the exact accepted-job destination visible throughout capture, while retaining the existing participant-authorized project-media route and refusing to report success before that route resolves.
- `GA-UX-006` gains field-usability evidence: capture type moves into the full-height camera, and one-hand controls include a 44px-plus intent strip, center shutter, last capture preview, and real front/back camera switch. The compact camera hides redundant chrome rather than clipping it on 320px devices.
- `GA-OPS-007` gains rendered evidence: build, lint, 53 unit tests, E2E, `test:ui:tools` at 1440x900/390x844/320x568, the targeted `project-completion.integration.test.js`, dependency audit, and diff check pass. The aggregate `npm run test` exceeded its ten-minute wrapper without reporting a failure or completion; it is not recorded as a pass.
- `GA-OPS-008` gains deployment evidence: `master` serves exact source `dc009c799b856b45f64fda90ee22b8ff853ef4e8`; live health reports ready migration `0025_project_financial_records`, PostgreSQL, S3-compatible storage, configured Sentry, and configured Web Push; `npm run monitor:production` passed with matching alerts enabled, controls off, seven anonymous private-route checks, and a 569 ms duration. Physical active-work photo capture remains the iOS/Android evidence boundary.

## Traceability Addendum - 2026-07-09 Mature Guest Demo and Nationwide Audit

- `GA-UX-005` gains a clearer anonymous first-value path: contractor and subcontractor previews now demonstrate a labeled one-year sample account with completed work, records, repeat relationships, active work, messages, and reputation rather than an empty or lightly populated shell.
- `GA-UX-006` gains compact-device rendered evidence for both preview roles at 320x568, including reduced-motion rendering, no horizontal overflow, visible initial demo entry, persistent active-work context, and a working Messages-to-Home return path.
- `GA-AUTH-007` retains fail-closed behavior: guest preview remains client-isolated, makes no authenticated reaction calls, and is cleared when leaving preview for signup or sign-in.
- `GA-OPS-007` gains fresh local evidence on `codex/nationwide-launch-hardening`: build, lint, security lint, 46/46 unit tests, 18/18 PostgreSQL integration suites, E2E, guest-preview, mobile-actions, work-lifecycle, Tools, Shop Talk/Trade News, Gate A readiness, incident readiness, dependency audit, and diff checks passed.
- `GA-OPS-008` gains production evidence: `codex/nationwide-launch-hardening` was fast-forwarded into `master`, live `/api/health` served exact feature source `39886b12495c4134b09bbb32b6c7d13058f00122` with migration `0022_community_audiences`, PostgreSQL, S3-compatible object storage, and configured Sentry, and `EXPECTED_SOURCE_COMMIT=39886b12495c4134b09bbb32b6c7d13058f00122 npm run monitor:production` passed with controls off, seven anonymous private-route checks, and 519 ms duration.
- `docs/product/NATIONWIDE_FINAL_LAUNCH_AUDIT_2026-07-09.md` is a product/architecture readiness audit, not a certification. It deliberately does not upgrade Gate A requirement maturity and records that pilot readiness is not nationwide readiness.

## Traceability Addendum - 2026-07-09 Preview Phone Recovery

- `GA-UX-006` gains preview-resilience evidence: a static boot layer remains available until React confirms the app is ready, a root boundary gives users a visible recovery path for render failures, and the guest-preview UI smoke verifies both normal demo render and a deliberately blocked-module recovery state.
- `GA-OPS-007` gains fresh local evidence: build, lint, security lint, 46/46 unit tests, E2E, guest-preview UI smoke, dependency audit, and diff checks passed. The database-backed integration suite was retried twice but the configured remote test PostgreSQL terminated connections during setup; this frontend/service-worker-only slice changes no migration or server route.
- `GA-OPS-008` remains unchanged until `codex/preview-phone-recovery` is merged and production serves its exact source commit.

## Traceability Addendum - 2026-07-10 Field Reliability Train

- `GA-UX-006` gains recoverable field-media evidence: failed camera and multi-file uploads retain the original files, continue unaffected uploads, and expose retry actions that resend only failed media. The Tools UI smoke deliberately rejects the first job-photo upload, retries the retained capture, and verifies it appears in the project timeline.
- `GA-AUTH-007` gains degraded-startup evidence: authentication state is cleared only for a real 401. A network or 5xx boot failure now presents a retryable connection state instead of implying that the account or session disappeared.
- `GA-OPS-007` gains fresh local evidence: build, lint, security lint, 46/46 unit tests, E2E, guest-preview, Tools, mobile-actions, dependency audit, and diff checks passed. The configured remote database stalled both the aggregate integration command and a targeted project-completion suite without output; this slice changes no server route, migration, or database behavior, so no new DB-backed claim is made.
- `GA-OPS-008` gains deployment evidence: `codex/field-reliability-train` was fast-forwarded into `master`, live `/api/health` served exact source `504e1db2e5b6fc9db23883ed17a3cb7444a3a66e` with migration `0022_community_audiences`, PostgreSQL, S3-compatible object storage, and configured Sentry, and `EXPECTED_SOURCE_COMMIT=504e1db2e5b6fc9db23883ed17a3cb7444a3a66e npm run monitor:production` passed with controls off, seven anonymous private-route checks, and 552 ms duration.
- Public-link evidence also passed: the 1200x630 approved-logo social image, `robots.txt`, and sitemap returned HTTP 200, while production HTML contained the absolute Open Graph image and canonical Open Graph URL.
- Remaining boundary: physically verify stalled LTE/offline transitions, retained-photo retry, and an update arriving during an in-progress form on iOS Safari/PWA and Android Chrome.

## Traceability Addendum - 2026-07-10 Notification Delivery Truthfulness

- `GA-UX-006` gains truthful notification controls: Settings now labels and saves only server-enforced in-app preferences, and no longer presents a browser-local flag as background push delivery.
- `GA-OPS-007` gains provider-boundary evidence collected without printing secret values: Railway has configured Resend credentials and sender identity, while Twilio and VAPID variables are absent.
- Local evidence includes build, lint, security lint, 46/46 unit tests, E2E, mobile Settings QA, and a zero-vulnerability production dependency audit. The aggregate integration phase stalled without output and no `TEST_DATABASE_URL` is available in this checkout; no database-backed pass is claimed for this frontend-only change.
- Background Web Push, matching-job fan-out, general-alert SMS, and email digests remain outside Packet 08. They require a reviewed Gate B packet with consent, quiet hours, unsubscribe/STOP handling where applicable, delivery failure handling, and production acceptance evidence.

## Gate B Addendum - 2026-07-10 Web Push Delivery

- Packet 09 adds explicit-consent Web Push without weakening or replacing the server-owned notification center.
- Browser subscriptions are authenticated, PostgreSQL-owned, HTTPS-only, and bound to the current login session. Revoked and expired sessions are excluded from fan-out.
- Notification creation and outbox insertion share the existing server transaction, while a separate bounded worker handles provider delivery/retry so user actions are not held open by push-provider latency.
- Existing Messages, Work updates, and Community/account category preferences gate both the notification bell and enabled device delivery. No automatic permission prompt or browser-local success flag exists.
- Same-origin service-worker click handling preserves the exact message/job/project/review/Shop Talk destinations already verified in Packet 08.
- Local evidence: 49/49 unit tests, isolated PostgreSQL migration/subscription/outbox/revocation integration, E2E, mobile Settings smoke, build/lint/security lint, and zero production dependency vulnerabilities.
- Production source `535e21bf1c2b76c7547b9c5ac5dc9ef54b8d5b79` serves migration `0024_push_subscription_sessions`; health and the synthetic monitor report Web Push configured without exposing keys. On 2026-07-10, a physical phone received a background RIVT test alert and tapping it returned to RIVT. Maturity is `production verified`; post-logout exclusion remains integration-proven through session-bound subscription deletion.

## Gate B Matching Job Alerts

- Packet 10 activates the previously dormant `new_jobs` preference for tradespeople and routes matching notifications through the server-owned notification center plus durable Web Push outbox.
- Initial publish matches only active, fully onboarded tradespeople with the selected trade and exact public city/region/country. The poster, blocks, opt-outs, wrong trades, and wrong cities are excluded.
- Exact job routes and payload tests prove no private address/access-note data enters notifications. Replay and resume do not create duplicate publish alerts.
- Bulk recipient/notification/outbox queries, a 200-recipient default/500 hard cap, and `MATCHING_JOB_ALERTS_ENABLED=false` by default keep the first rollout controllable.
- Evidence: 50/50 unit tests, isolated jobs + push PostgreSQL integration, and the complete 19/19 PostgreSQL aggregate pass. Railway serves exact source `43a1fa5eb9528a1fc06a0bea95da81122448c990`; health reports the feature enabled with a 200-recipient cap and exact-area rule; the production monitor passes. Maturity is `production configured`; one controlled legitimate publish and physical exact-job tap remain before field verification.

## Traceability Addendum - 2026-07-11 Standalone Tool Context

- `GA-PRO-001` gains off-platform utility evidence: Camera, Estimate, and
  Invoice support Quick use and private standalone projects in addition to
  accepted RIVT work. The Tools hub no longer requires or invents a marketplace
  job before these apps are useful.
- `GA-UX-003` gains explicit-destination evidence: each contextual tool shows a
  selected save destination and exact deep links remain authoritative. The
  previous first-job / first-active-work fallback is removed.
- `GA-UX-005` gains state-isolation evidence: Estimate and Invoice drafts use
  context-specific storage keys, server records carry one reviewed context,
  and Camera hides unrelated album/work surfaces while a project is selected.
  Quick drafts carry forward only into an empty destination, preventing an
  attach-later action from overwriting established project work.
- `GA-UX-006` gains one-handed evidence: Camera, Estimate, and Invoice expose
  48px lower-screen primary actions; mobile smoke verifies Quick-use isolation,
  standalone-project switching, no horizontal overflow, and in-viewport Save
  and Camera controls at 390x844.
- `GA-OPS-007` gains database evidence: standalone projects, tool records, and
  albums reject cross-account access; dual-context writes fail validation; and
  migration 0026 applies and rolls back cleanly. Build, lint/security, 53 unit
  tests, E2E, mobile actions, and all 19 PostgreSQL integration suites pass.
- `GA-OPS-008` gains production evidence: Packet 15 was fast-forwarded into
  `master`; live health serves exact source
  `1b38d144f83db07a305348e5e633256c666f55c2` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry, and configured Web Push. The production monitor passed with matching
  alerts enabled, controls off, seven anonymous private-route checks, and a
  592 ms duration. Physical Camera context/capture behavior remains the field
  acceptance boundary.

## Traceability Addendum - 2026-07-11 Mobile Experience Train

- `GA-UX-003` gains clearer exact-destination hierarchy: mobile Work uses labeled status/detail selectors, and the active-work summary disappears when that exact workspace is already open instead of repeating the same destination.
- `GA-UX-005` gains a feed-first Shop Talk entry while retaining community search, audience selection, joining, and creation in an expandable discovery rail.
- `GA-UX-006` gains 44px intro pagination targets, visible provider labels, contained account-drawer rendering, a navigable Settings section index, compact invoice preview tables, and mature demo-state continuity at 320px/390px widths.
- `GA-AUTH-007` remains fail-closed: demo crew/profile state is supplied only under the existing isolated guest-preview flag, skips account sync, and cannot write sample records to authenticated storage.
- `GA-OPS-007` gains complete local evidence: build/lint/security lint, 53 unit tests, E2E, five rendered UI suites, zero-vulnerability dependency audit, diff check, and all 19 PostgreSQL integration tests pass.
- `GA-OPS-008` gains production evidence: health serves exact source `aaf3a8701b4dceb084bdaf007a04ea2bcba74385` with ready migration `0026_standalone_projects`, PostgreSQL/S3-compatible storage, Sentry, and Web Push; the synthetic monitor passed with matching alerts enabled, controls off, seven anonymous private-route checks, and a 752 ms duration.

## Traceability Addendum - 2026-07-13 Appearance Simplification

- `GA-UX-006` gains a reduced, mobile-readable appearance preference: System,
  Light, and Dark are direct controls rather than a field-kit editor with
  palette, chrome, canvas, density, and custom-color controls.
- Appearance is device-local only and is not represented as a paid entitlement
  or manufacturer affiliation. Retired appearance keys are cleared so older
  custom state cannot apply after the release.
- Local evidence: build, lint, 53/53 unit tests, E2E, mobile-action UI smoke,
  production dependency audit, and diff check passed. This client-only packet
  makes no new database-backed claim. Production health serves exact source
  `210f5d17581ed1c83ed2218be96d92093fe8de30` with ready migration
  `0026_standalone_projects`; the expected-source monitor passed with seven
  anonymous private-route checks in 572 ms.

## Traceability Addendum - 2026-07-13 Tools Subtraction

- `GA-UX-006` gains a quieter Tools hierarchy: user-selected field shortcuts
  are not repeated in the core launcher, and secondary helpers live in one
  expandable Utilities section.
- No tool record, deep link, active-work context, or authorization behavior was
  removed. This packet changes discovery hierarchy only.
- Local evidence: build, lint, rendered Tools UI smoke, and diff check passed.

## Traceability Addendum - 2026-07-13 Shop Talk Hierarchy

- `GA-UX-005` gains a visible feed-level Post command, actionable empty feeds,
  direct community creation, and exact community identity before its mobile
  feed.
- Existing audience authorization, memberships, posts, answers, reactions,
  reports, moderation, and live-news retrieval remain server-owned.
- Local evidence: build, lint, rendered Shop Talk/Trade News UI smoke, and diff
  check passed.

## Traceability Addendum - 2026-07-13 Entry and Onboarding Return Path

- `GA-UX-006` gains a compact-phone entry hierarchy in which Preview, Create
  free account, and Log in are visible without advancing a carousel or
  scrolling past a feature mockup.
- `GA-AUTH-007` retains the existing fail-closed boundaries: preview activity
  remains explicitly sample data, while account creation, role locking, email
  verification, consent, and onboarding completion are unchanged.
- Post-signup setup removes generic instructional narration while retaining
  resumable state, factual validation messages, and final readiness feedback.
- Aggregate release evidence: build, lint, security lint, 53/53 unit tests,
  E2E, Work lifecycle UI, Tools UI, Shop Talk/Trade News UI, 320x568
  entry/login/preview UI, mobile-actions UI, zero-vulnerability production
  dependency audit, diff check, and all 19 freshly reset PostgreSQL integration
  suites passed.
- `GA-OPS-008` gains production evidence: health served exact feature source
  `b2bc306089d8320517110fc3361615c6df4a8dc8` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry and Web Push, and matching-job alerts enabled. The expected-source
  monitor passed with controls off, seven anonymous private-route checks, and
  a 563 ms duration.

## Traceability Addendum - 2026-07-13 Shop Talk Reliability

- `GA-UX-003` gains exact Shop Talk notification handling: a notification can
  hydrate its named post outside the newest page or a selected feed filter,
  while the server applies the same community-audience authorization to that
  direct read as to the normal feed.
- `GA-UX-005` gains error and reputation truthfulness: Shop Talk preserves
  typed API failures for user feedback, Daily Log pulse detection has a shared
  contract, and earned badges now use server-authoritative author IDs rather
  than display-name matching or device-local reputation values.
- `GA-OPS-007` gains local evidence: build, lint, 53/53 unit tests, E2E,
  mobile-action UI smoke, dependency audit, diff check, and focused PostgreSQL
  Shop Talk integration passed. The full integration wrapper exceeded its
  local 15-minute limit without a failing assertion, so aggregate integration
  success is intentionally not claimed for this packet.

## Traceability Addendum - 2026-07-13 Workflow Coherence and Field Tools

- `GA-UX-003` gains visible exact-destination feedback: focused accepted work
  identifies the named job workspace after navigation and presents the next
  useful actions without requiring a user to infer that a scroll occurred.
- `GA-UX-006` gains one-handed Camera reachability: mobile Camera home and
  gallery actions are named lower-screen controls with safe-area clearance;
  the mobile smoke asserts the save destination, project feed, and capture
  controls remain visible at a compact field viewport.
- Local evidence: build, lint, unit tests, E2E, mobile-action UI smoke,
  production dependency audit, and diff check pass. No server contract,
  database schema, persistence, or authorization behavior changed, so this
  client-only packet does not claim database integration coverage.
- `GA-OPS-008` gains production evidence: health serves exact feature source
  `d9b9097f3a0e20a8ccb119b76c794c942efad7e7` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry and Web Push, matching-job alerts enabled, controls off, and a
  passing expected-source synthetic monitor.

## Traceability Addendum - 2026-07-15 Materials and Price Library

- `GA-UX-006` gains one coherent Materials app with Takeoff, Sheets, and Price
  library views instead of separate overlapping launchers.
- Materials presets no longer include guessed supplier costs. Users enter
  current costs and retain their existing device and server-backed price-book
  records without a schema or ownership change.
- Legacy Price Book URLs and pinned shortcuts resolve into Materials so saved
  workflows do not dead-end after consolidation.
- Local evidence includes build, lint, security lint, unit tests, E2E, rendered
  Tools QA at desktop/mobile/compact viewports, mobile-action QA, dependency
  audit, and aggregate test coverage recorded in Packet 44.

## Traceability Addendum - 2026-07-15 Jobsite Tools Consolidation

- `GA-UX-006` gains one coherent Jobsite app with Log, Punch, and Safety
  sections instead of three disconnected launchers.
- Existing Daily Log project entries, Punch List records, Safety records,
  storage keys, and account/server ownership rules are preserved without a
  schema or record conversion.
- Legacy URLs select the matching Jobsite section so active-work actions and
  saved links do not dead-end after consolidation.
- Local evidence includes build, lint, security lint, 55 unit tests, all 19
  freshly reset PostgreSQL integration suites, E2E, rendered Tools QA at
  desktop/mobile/compact viewports, mobile-action QA, accepted-work lifecycle
  QA, a zero-vulnerability production dependency audit, and diff checks.
- Production evidence: exact source
  `82b243e6bdbb28ffe4ec3d28c4253c044a1d6f22` is live with migration 0027 ready;
  the expected-source synthetic monitor passed all seven anonymous private-route
  checks. Physical cross-device record-retention acceptance remains open.

## Traceability Addendum - 2026-07-15 Final Tools and Launch QA

- `GA-UX-006` gains a final subtraction boundary: five distinct core field apps
  and two grouped utilities remain visible, while consolidated legacy modes
  continue to resolve to their owning app without duplicate launchers.
- `GA-UX-006` gains rendered evidence across every final Tool destination at
  1440x900, 390x844, and 320x568, including one-hand docks, legacy routes, back
  navigation, and document-level overflow assertions.
- `GA-OPS-007` gains a launch-wide browser workflow matrix spanning mobile
  actions, contractor/tradesperson work lifecycle, exact active-work and photo
  notification destinations, Shop Talk/Trade News, and guest preview.
- Local evidence also includes production build, lint, security lint, 55 unit
  tests, E2E, a zero-vulnerability production dependency audit, and all 19
  integration suites against a freshly reset PostgreSQL database at migration
  27 with zero pending migrations.
- Physical camera capture, cross-device server-record retention, installed-iOS
  push, and a two-account production closeout remain explicit human acceptance
  boundaries; mocked browser evidence is not represented as live proof.
- Production evidence: Railway served exact merged source
  `b0fe53b22af2e75f81a765d11030b0eaecac00af`; the expected-source synthetic
  monitor passed all seven anonymous private-route checks with migration 27,
  storage, Sentry, Web Push, matching alerts, and rollout controls healthy.

## Traceability Addendum - 2026-07-15 Work State Architecture

- `GA-UX-003` gains four explicit Work lifecycle states: Browse, Hiring or
  Applications, Active, and Archive. Each state owns one class of task instead
  of stacking discovery, administration, accepted work, and history in one
  mobile surface.
- `GA-UX-003` preserves exact job and work-record destinations for applicants,
  applications, offers, active work, and archived work, including records that
  no longer appear in open-work discovery.
- `GA-UX-006` gains rendered mobile evidence that accepted work replaces broad
  Work chrome, draft readiness remains reachable through Hiring, and the Work
  surface has no horizontal overflow.
- Local evidence includes production build, lint, security lint, 55 unit
  tests, E2E, Work lifecycle and mobile-action browser suites, a zero-
  vulnerability production dependency audit, diff checks, and all 19 serial
  PostgreSQL integration suites with zero failures or skips.
- No API, database, authorization, authentication, billing, storage,
  moderation, or server-owned lifecycle contract changed in this packet.
- Production evidence: Railway served exact merge source
  `25ca2de639a40c6d7956de467a33decc99c520fa`; the expected-source monitor
  passed in 612 ms with migration 27, managed dependencies, observability,
  engagement controls, and all anonymous private-route checks healthy.
# Traceability Addendum - 2026-07-15 Progressive Money Flows (Production Verification)

- `GA-UX-003` gains progressive-task evidence: Estimate separates Price,
  Customer, and Review; Invoice separates Items, Customer, and Review while
  preserving conversion, draft records, delivery handoff, and receivables.
- `GA-UX-006` gains one-handed mobile evidence: both money tools keep Save and
  the current next action in a thumb-reachable dock at 390x844 and 320x568,
  with no horizontal overflow. Invoice section navigation no longer competes
  with that action zone.
- `GA-TRUST-004` retains truthful money boundaries: internal estimate guidance
  is review-only, customer copy remains separate, and Invoice continues to say
  that direct payment occurs outside RIVT.
- No requirement maturity changes. No server contract, authorization,
  authentication, billing, storage, or data model changed.

# Traceability Addendum - 2026-07-17 Money Document Flow (Local Verification)

- `GA-UX-003` gains customer-document handoff evidence: Estimate exposes a
  distinct preview-and-send stage, and Invoice exposes a distinct
  preview-and-deliver stage with visible customer copy, copy, and print/save
  actions.
- `GA-UX-006` gains small-screen document-review evidence: the printable
  Invoice document is visible only in its dedicated final stage, avoiding both
  an extra disclosure and edit-stage crowding on phones.
- `GA-TRUST-004` retains truthful money boundaries: device email/text actions
  report that they open local drafts, accepted-work copy directs the user to
  mark delivery in the private record, and RIVT does not claim to process or
  confirm job payments.
- No requirement maturity changes. No server contract, authorization,
  authentication, billing, storage, moderation, or data model changed.
- Local evidence includes build, lint, 58 unit/frontend tests, E2E, Tools UI,
  mobile-action UI, and a zero-vulnerability production dependency audit.
  Three non-database integration checks pass; sixteen PostgreSQL suites are
  skipped because `TEST_DATABASE_URL` is not configured in this worktree.
  Deployment evidence is pending review and merge of
  `codex/money-document-flow`.

# Traceability Addendum - 2026-07-15 Progressive Jobsite Flows

- `GA-UX-003` gains progressive field-task evidence: Daily Log separates Today,
  Work, and Review; Punch List separates Open, Add item, and Resolved; Safety
  separates Check, Details, and Sign off.
- `GA-UX-006` gains one-handed mobile evidence: Daily Log keeps Save and the
  current next step in a lower action dock, optional details remain collapsed,
  and rendered QA passes at 390x844 and 320x568 without horizontal overflow.
- Existing Daily Log, Punch List, and Safety record ownership, exports,
  history, signoffs, legacy links, and exact work context remain authoritative.
- No requirement maturity changes. No server contract, authorization,
  authentication, billing, storage, moderation, or data model changed.
- Local evidence includes typecheck, production build, lint, security lint, 55
  unit tests, E2E, rendered Tools QA, mobile-action QA, a zero-vulnerability
  production dependency audit, diff checks, and all 19 serial PostgreSQL
  integration suites with zero failures or skips.
- Production evidence: Railway served exact merge source
  `af13e52232ec0199a35d11f7f059942fed25b7a5`; the expected-source monitor
  passed in 574 ms with migration 27 and all managed dependencies, alerts,
  controls, and anonymous private-route checks healthy.

# Traceability Addendum - 2026-07-17 Heavy 16th Standalone App

- `GA-UX-003` gains calculator-continuity evidence: completed equations remain
  available in a short device-local tape and can restore their exact result
  and imperial/metric mode without introducing another calculator mode.

- `GA-UX-006` gains compact-device evidence: the History action and accessible
  history sheet remain fully in viewport at 375x553 while all fifteen fraction
  buttons and the complete keypad remain available without scrolling.
- Calculator history contains measurement expressions only and remains a
  device preference/history surface, not a substitute for server-owned job,
  customer, invoice, or project records.
- No requirement maturity changes and no server contract, schema,
  authorization, authentication, billing, storage, or moderation changes.
- Production evidence: Railway served exact source
  `38edcd371f3c99ae0d9d2da1e4375b73cd8a0b43`; migration 0028 was ready and
  the expected-source monitor passed in 588 ms with managed dependencies,
  observability, engagement controls, and all anonymous private-route checks
  healthy.

# Traceability Addendum - 2026-07-17 Unlimited Inches Calculator

- `GA-UX-003` gains field-notation evidence: inches mode accepts and preserves
  measurements above twelve inches through entry, math, copy, history, and
  restore, while feet notation remains an explicit user choice.
- `GA-UX-006` gains rendered desktop, mobile, and SE regression coverage for
  the exact `27 5/16"` -> `2' 3 5/16"` -> `27 5/16"` unit-switch round trip.

# Traceability Addendum - 2026-07-17 Calculator Key Balance

- `GA-UX-006` gains rendered key-proportion evidence: at mobile and compact-SE
  heights, fraction presets and whole-number keys remain within eighteen
  percent of one another while every input stays visible without scrolling.
- No requirement maturity changes and no calculator-math, server, schema,
  authorization, authentication, billing, storage, or moderation changes.
- `GA-OPS-008` gains production evidence: Railway served exact source
  `fe393887abe17a2e5c162769a62851897feb81bb`; migration 0028 was ready and
  the expected-source monitor passed in 619 ms with managed dependencies,
  observability, engagement controls, and all anonymous private-route checks
  healthy.

# Traceability Addendum - 2026-07-17 Calculator Tape Preferences

- `GA-UX-003` gains tape-notation evidence: Heavy and Light retain their
  visible qualifier when a single tape mark is entered, while paired marks
  resolve to a measurable sixteenth. Thirty-second precision remains an
  explicit calculator preference rather than an implied result.
- `GA-UX-006` gains preference and compact-device coverage: metric mode,
  inches-only notation, fraction order, and Heavy / Light behavior are
  persistent device preferences; rendered tools QA exercises the compact
  fraction strip and the visible `5/8` tap target.
- No requirement maturity changes and no server contract, schema,
  authorization, authentication, billing, storage, or moderation changes.
- Local evidence: build, lint, 58 unit/frontend tests, E2E, rendered
  desktop/mobile/SE Tools QA, mobile-action QA, and dependency audit pass.
  Three non-database integration checks pass; sixteen PostgreSQL suites are
  skipped because this worktree does not contain `TEST_DATABASE_URL`.
- Production evidence: Railway served exact source
  `6765dd2196221816ea9149916f295ea58112d210`; migration 0028 was ready and
  the production monitor passed in 582 ms with managed dependencies,
  observability, engagement controls, and all anonymous private-route checks
  healthy.

# Traceability Addendum - 2026-07-17 Calculator Fraction Hierarchy

- `GA-UX-003` gains field-legibility evidence: quarter, eighth, and sixteenth
  fraction presets carry a long, medium, and short tape mark respectively,
  rather than relying on faint accent color alone.
- `GA-UX-006` gains rendered mobile hierarchy coverage: equal-sized fraction
  targets expose a semantic family and quarter > eighth > sixteenth tick
  dimensions at handset viewports.
- No requirement maturity change and no calculator arithmetic, server,
  schema, authorization, authentication, billing, storage, or moderation
  change.
- Local evidence: build, lint, 58 unit/frontend tests, E2E, rendered Tools UI,
  mobile-action UI, and dependency audit pass. Three non-database integration
  checks pass; sixteen PostgreSQL suites are skipped because this worktree does
  not contain `TEST_DATABASE_URL`. The rendered SE calculator confirms the
  tape-mark hierarchy at handset scale.
- Production evidence: Railway served exact source
  `ff64a11f023803adb3cc150b056adaf5818222e0`. The production monitor passed
  in 591 ms with PostgreSQL, S3-compatible storage, Sentry, Web Push,
  matching-job alerts, and all seven anonymous private-route checks healthy.

# Traceability Addendum - 2026-07-17 Invoice Delivery and Records

- `GA-UX-003` gains invoice-delivery evidence: a reviewed invoice is saved as
  an account-owned record before delivery, and the UI separately names
  `Save draft`, `Email invoice`, and `Print or Save PDF`.
- `GA-OPS-007` gains provider-confirmed delivery evidence: recipient,
  provider message id, attempt count, and delivery failure state are retained
  only after the transactional provider responds.
- No payment processing, escrow, tax automation, or client-payment claim is
  introduced. The invoice continues to state the direct-payment boundary.
- Local evidence: build, full lint, 58 unit/frontend tests, E2E,
  mobile-action UI, targeted PostgreSQL invoice integration, and dependency
  audit pass. The full integration aggregate exceeded the local ten-minute
  command window without reporting a failure.
- Production evidence: Railway served exact source
  `64b48833aa1498e3dc9438ea9989790580a31bbd` on 2026-07-17. The production
  monitor passed in 569 ms with PostgreSQL, S3-compatible storage, Sentry,
  Web Push, matching-job alerts, operational controls, and all seven
  anonymous private-route checks healthy.

# Traceability Addendum - 2026-07-17 Tool Context and Estimate Dock Usability

- `GA-UX-003` gains exact-context evidence: the tool destination picker
  exposes only canonical active RIVT work for new artifacts. Completed and
  cancelled work is preserved as history rather than represented as live work.
- `GA-UX-006` gains compact workflow evidence: Estimate's fixed action dock is
  step-specific and workbench content reserves enough bottom clearance to
  remain fully reachable above the mobile safe area.
- No requirement maturity change and no server, schema, authorization,
  authentication, billing, storage, or moderation change.
- Local evidence: build, lint, 58 unit/frontend tests, E2E, rendered Tools UI,
  mobile-action UI, and dependency audit pass. Three non-database integration
  checks pass; sixteen PostgreSQL suites are skipped because this clean
  worktree does not contain `TEST_DATABASE_URL`.
- Production evidence: Railway served exact source
  `279a21bdd58091d0147d7dda9242a19ee210e54b`; the production monitor passed
  with PostgreSQL, S3-compatible storage, Sentry, Web Push, matching-job
  alerts, and all seven anonymous private-route checks healthy.

# Traceability Addendum - 2026-07-17 Tools Mobile Landing

- `GA-UX-003` gains mobile tool-discovery evidence: Camera, Heavy 16th,
  Jobsite, Estimate, and Invoice remain visible as in-flow core apps, while
  the field tray acts as a configurable shortcut rather than hidden primary
  navigation.
- `GA-UX-006` gains handset customization coverage: the field-tools Edit
  control and picker remain reachable at mobile widths; More opens the real
  utility surface with an unambiguous action label.
- No requirement maturity change and no server, schema, authorization,
  authentication, billing, storage, or moderation change.
- Local evidence: build, lint, all 58 unit/frontend tests, E2E, rendered
  Tools UI, mobile-action UI, and dependency audit pass. The aggregate
  `npm run test` command exceeded the local ten-minute limit without printing
  a failure; no full PostgreSQL integration pass is claimed.
- `GA-OPS-008` gains production evidence: `master` serves exact source
  `c2f02632285735f7d0a19b2979370ae55d239dca`; live health reports ready
  migration `0028_compensation_workflow`, PostgreSQL, S3-compatible storage,
  configured Sentry, and configured Web Push. The production monitor passed
  with operational controls open and seven anonymous private-route checks.

# Traceability Addendum - 2026-07-19 Accessible Display Modes

- `GA-UX-006` gains persistent display-accessibility evidence: users can
  enable larger text, stronger contrast, and color-safe semantic status cues
  from Settings without losing their light, dark, or system theme preference.
- The controls expose switch state to assistive technology, the larger-text
  mode raises the small-copy floor, and the contrast mode adds a visible
  three-pixel keyboard focus treatment.
- Requirement maturity remains Partial until physical-device validation with
  system text enlargement, keyboard and screen-reader review, and feedback
  from people with low vision or color-vision deficiencies is recorded.
- No server, schema, authorization, authentication, billing, storage, or
  moderation change.
- Local evidence: build, lint, 59 unit/frontend tests, E2E, rendered
  mobile-action UI, and dependency audit pass. The PostgreSQL integration
  aggregate produced no output during a bounded run, so no integration pass
  is claimed.

## Packet 69 - Paperwork Queue Exact Resume

- `GA-UX-003` gains truthful Home assistance for unfinished paperwork: only
  real saved estimate and invoice drafts appear, and empty accounts remain
  empty rather than receiving demo records.
- `GA-UX-005` gains exact destination continuity: selecting a Home paperwork
  item opens that saved record with its accepted-work or standalone-project
  context and preserves the same record id on subsequent saves.
- No server, schema, authorization, authentication, billing, storage,
  moderation, or delivery-provider change.
- Local evidence: build, lint, 59 unit/frontend tests, E2E, rendered
  mobile-action and Tools UI QA, and the zero-vulnerability production
  dependency audit pass. Three non-database integration checks pass; sixteen
  PostgreSQL suites are skipped because `TEST_DATABASE_URL` is unavailable.

# Traceability Addendum - 2026-07-22 Text Scale and Live Trade News

- `GA-UX-006` gains persisted Standard, Large, and Extra Large device text
  sizes. Root scaling covers semantic typography tokens and legacy fixed-size
  declarations; the previous boolean Larger text preference migrates to Large.
  Shop Talk Filters retains an icon-only visual treatment with an accessible
  name and tooltip at every scale.
- `GA-UX-003` and `GA-UX-006` gain a twelve-scenario rendered mobile matrix:
  all three sizes at 375x553 and 390x664 cover Tools title/top-bar clearance,
  field shortcut names, Shop Talk tabs/actions, bottom navigation, and
  document-wide horizontal overflow.
- `GA-UX-005` gains an honest Trade News source boundary: live feeds cover
  construction, skilled trades, safety, codes, labor, tools, business,
  projects, and Jacksonville/Florida contractor news. RSS media/enclosures and
  bounded public Open Graph images are accepted; missing media is labeled and
  an outage stays empty rather than receiving invented articles or artwork.
- Trade News canonicalizes URLs, deduplicates canonical URL/title pairs,
  favors current/local/trade-relevant items, and caps source repetition. Cards
  expose category, source, date, original link, and explicit refresh state.
- Requirement maturity remains Partial pending physical iOS/Android dynamic
  type, desktop keyboard, and screen-reader acceptance. No schema, migration,
  authorization, billing, production-data, or dependency change is included.
- Local evidence: build, lint, 61/61 unit/frontend tests, E2E, mobile-action UI,
  Shop Talk/Trade News rendered QA, zero-vulnerability dependency audit, and
  diff check pass. Aggregate `npm run test` exceeded a bounded 244-second
  integration run without a failing assertion; no aggregate pass is claimed.
- `GA-OPS-008` gains production evidence: Railway deployment
  `9fd6f8a6-add5-47d8-acd4-1bac9cc1c925` serves runtime source
  `36e413df7dc2a17502bd5aad0813e17e414e892f`; the expected-source production
  monitor passed in 599 ms. A forced Jacksonville/Florida news refresh returned
  30 articles from 20 sources across all seven requested categories, 18
  legitimate feed/article images, 12 explicit no-image items, zero internal
  fallback artwork, and zero missing source URLs.
## Traceability Addendum - 2026-07-22 Shop Talk and Communities Release Hardening

- `GA-UX-005` gains cold-start honesty evidence: authenticated Shop Talk posts,
  communities, and joined state now begin empty and hydrate only from the
  authenticated APIs; RIVT starter prompts and device-local membership state no
  longer appear while server truth is pending or unavailable.
- `GA-COM-001` and `GA-COM-002` gain membership-integrity evidence: community
  join/leave UI reconciles from server-owned membership and rolls optimistic
  changes back when persistence fails.
- `GA-UX-003` gains user-control evidence: Trade News persists location scope,
  topic, and source choices, refetches local versus all-region coverage, and
  filters only returned source articles.
- `GA-UX-003` preserves the current navigation contract: People and former
  Crew relationship workflows remain under Work -> People, while Camera keeps
  the primary field-action slot and remains reachable from contextual Work
  handoffs and Tools field shortcuts.
- `GA-UX-006` and `GA-OPS-007` gain repeatable rendered evidence from Shop
  Talk/Trade News desktop/mobile QA and the 375x553 plus 390x664 three-text-size
  mobile matrix, alongside build, lint, unit, E2E, and dependency audit gates.
## Traceability Addendum - 2026-07-23 Trade News Intelligence V2

- `GA-UX-003` gains production information-hierarchy evidence: Trade News uses
  one compact status strip, five channels, expandable search, a mobile
  customization sheet, a conditional fresh-priority feature, and compact
  category-led rows instead of a uniform RSS-card dump.
- `GA-UX-005` gains production honesty evidence: undated stories are routine,
  30/90/180-day age gates prevent stale urgency, high/critical treatment is
  capped at 25%, evergreen official pages are separated as references, and
  reply counts are derived only from real Shop Talk posts containing the
  canonical article URL.
- `GA-UX-006` gains rendered desktop/mobile evidence in dark and light themes:
  the smoke locks one channel row, no legacy hero or select fieldbar, no
  horizontal overflow, quiet source links, separated references, and
  real-only discussion counts.
- `GA-OPS-007` gains production evidence at merge commit
  `7642132cdd991da666d39cb847688885a61c081f`: build, lint, 65 unit/frontend
  tests, E2E, rendered Trade News smoke, and zero-vulnerability audit passed;
  live health and the expected-source synthetic monitor passed after Railway
  deployment `1bfa0b03-4090-4558-9308-eda5edce15d8`.
## Traceability Addendum - 2026-07-23 Trade News V2.1 Clustering

- `GA-UX-005` gains production data-honesty evidence: Google publisher suffixes
  are removed before deduplication, significant-title duplicates cannot render
  under different URLs, and bill/entity plus stemmed-token clustering reduces
  the observed Jacksonville HB 803 family to one card with six real related
  sources.
- `GA-UX-003` gains production information-quality evidence: category fill is
  capped at 40% while alternatives remain, zero-new copy is replaced by
  truthful story/freshness context, discussion is visibly primary, and source
  links remain secondary.
- `GA-UX-006` gains computed-theme evidence: Trade News now inherits distinct
  shared dark/light token surfaces instead of legacy Shop Talk colors pinning
  dark-mode titles and the active tab to light values.
- `GA-OPS-007` gains production evidence at
  `9901d1f5a9d8df996505eaa70d792f726f225e2c`: build, lint, 67 unit/frontend
  tests, E2E, rendered HB 803/theme smoke, and zero-vulnerability audit passed;
  exact-source health and the production monitor passed after Railway
  deployment `61dece4b-2e7f-4638-81ab-b486298c3ede`.
## Traceability Addendum - 2026-07-23 Trade News V2.2 Content Quality

- `GA-UX-003` gains production classification evidence: a permitted concrete
  build with project/value signals is Projects, while permit reform,
  requirements, waivers, elimination, rules, thresholds, streamlining, and
  drop/drops/dropped/dropping policy language remain Codes.
- `GA-UX-005` gains freshness evidence: feed inclusion now stops at 90 days;
  a forced Jacksonville response contained zero older items while preserving
  the separate official-reference path.
- `GA-OPS-007` gains production evidence at
  `a76d7b30896af3f98a25c4fc4079a1ef408eec41`: build, lint, 68 unit/frontend
  tests, E2E, rendered mixed-category/age smoke, and zero-vulnerability audit
  passed; exact-source health and the production monitor passed after Railway
  deployment `f9f58138-32a4-4310-a079-025ddd29b095`.

## Traceability Addendum - 2026-07-26 Estimate and Invoice Document Integrity

- `GA-UX-003` gains end-to-end document-workflow evidence: Estimate and
  Invoice each support a distinct new-document action, validated customer
  details, consistent preview/copy/print/email content, and an explicit
  payment-method decision before invoice delivery.
- `GA-UX-005` gains money and delivery-honesty evidence: new documents start
  at zero instead of assumed prices, estimate markup is named correctly,
  templates cannot leak a prior customer's identity, and sent state is bound
  to the exact document fingerprint so later edits are labeled unsent.
- `GA-UX-006` gains rendered desktop, 390px mobile, and compact-phone
  evidence for the complete Estimate and Invoice flows, including
  customer-paper theme tokens, printable documents, mobile action access,
  and horizontal-overflow checks.
- `GA-OPS-007` gains local branch evidence from production build, application
  and security lint, 86 unit/frontend tests, all 19 serial database
  integration tests, fail-closed authentication and jobs/discovery E2E,
  rendered Tools QA, diff check, and a zero-vulnerability production
  dependency audit. The branch remains review-only and no deployment
  evidence is claimed.

## Traceability Addendum - 2026-07-26 Customer Document Branding and Templates

- `GA-UX-003` gains a single truthful customer-document identity: Profile →
  Business now controls the company name, optional customer-visible contact
  fields, license display, logo, and guided Estimate/Invoice layouts used by
  preview, print/PDF, and delivered email.
- `GA-UX-005` gains persistence and honesty evidence: branding is
  account-owned rather than browser-only, upload and save failures remain
  visible, estimate templates exclude recipient/document identity, and a
  branding change makes a formerly sent document visibly unsent.
- `GA-UX-006` gains rendered desktop, 390px, and compact-phone coverage for
  Classic, Compact, and Field customer documents with tokenized app controls,
  print-stable document colors, no horizontal overflow, and reachable
  delivery actions.
- `GA-DATA-001` gains migration `0032_document_branding`: account-scoped
  document profiles, private raster-logo object references, and
  `estimate_template` records have a reviewed rollback. Cross-account brand
  and template reads are integration-tested.
- `GA-OPS-007` gains local evidence from build, application/security lint,
  89 unit/frontend tests, targeted account-isolation/email-branding and full
  migration-lifecycle integration, fail-closed auth and jobs/discovery E2E,
  rendered Tools QA, diff check, and zero production dependency
  vulnerabilities. The aggregate integration command encountered the known
  push-notification suite stall before this packet and is not represented as
  passed. No deployment evidence is claimed.

## Traceability Addendum - 2026-07-26 Customer Book Continuity

- `GA-DATA-001` gains migration `0033_customer_book`: customer identity,
  contact details, address/default preferences, archive state, private notes,
  and recent-use state are account-owned. Optional customer links on
  standalone projects and tool records are ownership-validated, and the
  reviewed rollback preserves legacy client-contact data.
- `GA-UX-003` gains cross-workflow continuity: Estimate, Invoice, and
  standalone-project creation share search, recent/favorite selection, and
  inline customer creation instead of requiring repeated manual entry.
- `GA-UX-005` gains document and communication honesty: saved documents retain
  immutable customer snapshots, archive is reversible, linked activity is
  computed from real records, and Customer notes explicitly remain private
  rather than implying message delivery.
- `GA-UX-006` gains rendered 390px evidence for the customer book, saved
  customer selection in both money tools, and private customer notes with no
  horizontal overflow.
- `GA-AUTH-007` gains direct cross-account rejection evidence for customer
  links and customer activity. No homeowner account, public customer
  identity, or outbound-contact permission is introduced.
- Requirement maturity does not change. Local evidence includes build,
  application/security lint, 89 unit/frontend tests, targeted customer
  ownership/tool-record integration, migration lifecycle, E2E, rendered
  Tools/mobile-action QA, diff check, and a zero-vulnerability dependency
  audit. The serial aggregate integration wrapper remained
  buffered/non-diagnostic during a bounded four-minute attempt, so only the
  directly passing affected suites are claimed. No deployment evidence is
  claimed.

## Traceability Addendum - 2026-07-28 Customer Documents and Contact Import

- `GA-UX-003` gains one canonical contact-ingestion model: Contacts supports
  user-selected device people plus complete CSV/vCard migration, while
  Estimate and Invoice reuse a one-contact shortcut instead of duplicating an
  address-book manager inside every form.
- `GA-DATA-001` retains one account-owned identity: every imported person is
  written through the authenticated Contacts API, exact existing matches gain
  or reactivate the requested relationship, and no device-only or
  document-only customer store is introduced.
- `GA-UX-003` gains truthful customer-document delivery: one `Send` action
  exposes real server email, a user-controlled device text draft, or email
  followed by a text draft. Invoice may offer bank payment, exact
  sender-provided instructions, or both; the recipient chooses among the
  options actually printed and delivered.
- `GA-UX-005` gains payment and branding honesty: the server refuses a bank
  option without a current Stripe payment link and refuses direct payment
  without usable instructions. Documents render only a real uploaded logo or
  a clean text letterhead, never generated initials presented as branding.
- `GA-UX-006` gains rendered desktop, 390px, and compact-phone evidence for
  unclipped Estimate/Invoice action docks, independent payment choices,
  customer previews, the accessible Send sheet, and the Contacts import
  privacy boundary.
- Requirement maturity does not change. Local evidence includes production
  build, application lint, 122 unit/frontend tests, all 22 serial PostgreSQL
  integration suites, fail-closed authentication, Jobs/discovery and offline
  recovery E2E, rendered Tools/mobile-action QA, diff integrity, and a
  zero-vulnerability production dependency audit. Railway deployment
  `ee30fd80-da7a-4551-afb3-623b20d43736` serves exact feature source
  `1acccf49f8223d432b5cdcff8d5455a27d31d150`; live health and the production
  synthetic monitor passed with the existing provider and privacy controls.

## Traceability Addendum - 2026-07-26 Document Trust and Resume

- `GA-UX-003` gains reload-safe document continuity: account-owned Estimate
  and Invoice handoffs retain the selected record id in the URL and resolve it
  through the authenticated tool-record API after refresh/history navigation.
- `GA-UX-005` gains save and recovery honesty: account-loaded records no
  longer continue saying `Saved` after a device-only edit; offline copy states
  that local drafts still work while account sync/delivery are paused; failed
  recent-use ordering does not silently erase a selected customer.
- `GA-UX-006` gains rendered desktop, 390px, and compact-phone evidence for a
  savable zero-value invoice draft, recoverable line removal, exact linked
  record restore, device/account save-state transitions, and account resave.
- Requirement maturity does not change. No API, schema, migration,
  authorization, provider, or production-data change is introduced. Local
  evidence includes build, lint, 90 unit/frontend tests, E2E, rendered Tools
  and mobile-action QA, diff check, and a zero-vulnerability dependency audit.
  The aggregate and direct database runners produced no test event during
  bounded attempts, so no database integration pass is claimed. Production
  source `fac181b52a0498a21748d032e2b79d4861f216fa` is exact-source verified
  with migration `0033_customer_book` ready and the synthetic monitor passing.

## Traceability Addendum - 2026-07-26 Tools and Work People Discovery

- `GA-UX-003` gains a single Tools information architecture: every field and
  business tool appears exactly once in one responsive launcher, while the
  existing preference becomes an honest pinned-order control rather than a
  duplicated fixed tray.
- `GA-UX-005` gains contact-state honesty: Work exposes the existing
  server-backed People/Customers hub, while job-specific site contacts state
  that they are private device notes and do not imply crew sharing or account
  synchronization.
- `GA-UX-006` gains desktop, 390px mobile, and 320px compact-phone rendered
  evidence for the unified tool launcher, persistent pin ordering, Work/People
  switcher, and first-class active-job People workspace.
- Requirement maturity does not change. This packet introduces no schema,
  authorization, seed data, or production-data change. A
  server-owned site-contact model remains a separate reviewed migration and
  rollback packet. Local evidence includes production build, lint, 103
  unit/frontend tests, all 20 serial PostgreSQL integration suites,
  fail-closed auth and Jobs/discovery E2E at desktop/mobile widths, focused
  rendered QA, diff integrity, and a zero-vulnerability production dependency
  audit. Production exact-source health, the seven-check synthetic monitor,
  and live frontend-chunk inspection confirm the packet is deployed at
  `5ed3bf7f77180b02caecb15cbc3d7042b91a0c6c`; no authenticated production
  click-path is claimed because its test credential is not configured here.

## Traceability Addendum - 2026-07-27 Canonical Contacts Foundation

- `GA-DATA-001` gains migration `0036_canonical_contacts`: one account-owned
  identity supports person/company records, multiple relationship roles,
  methods, addresses, tags, favorites, archive/recent-use state, and private
  job/project links. Existing Customers and Crew/Sub records are backfilled
  and retained as transactional compatibility projections.
- `GA-DATA-001` also gains tested rollback preservation. Complete canonical
  snapshots are archived before rollback, and a supplier created only in the
  new directory is restored with stable roles, methods, addresses, and tags
  when the migration is reapplied.
- `GA-UX-003` gains one long-term Contacts information architecture in Work:
  All, Crew, Subs, Customers, and Suppliers are relationship views over the
  same identity. Reviews remains visibly separate because it is reputation,
  not a contact category.
- `GA-UX-005` gains relationship-state honesty: writes are server-owned,
  normalized email/phone duplicates are surfaced instead of silently merged,
  unsafe website schemes are rejected, private notes remain labeled private,
  and guest records remain explicitly sample data.
- `GA-UX-006` gains rendered desktop, 390px, and 320px evidence for contact
  search, multi-role editing, supplier details, favorites, archive/restore,
  the Customer compatibility book, the Crew compatibility manager, complete
  compact-phone role navigation, and no horizontal overflow.
- `GA-AUTH-007` gains direct cross-account list/read/activity isolation for
  contacts. A private account directory does not automatically expose a
  contact to another account or link it to a public RIVT profile.
- Requirement maturity does not change. Local evidence includes build,
  application/security lint, 103 unit/frontend tests, all 21 serial
  PostgreSQL integration suites, migration rollback/reapply, fail-closed auth
  plus Jobs/discovery E2E, focused rendered QA, diff integrity, and a
  zero-vulnerability dependency audit. Production exact-source health reports
  `fe405c0c650ea44134f780c0b308041089cf139d` with
  `0036_canonical_contacts` ready; the seven-check synthetic monitor,
  anonymous Contacts authorization check, and live-bundle inspection pass.

## Traceability Addendum - 2026-07-27 Contact Workflow Integration

- `GA-UX-003` gains shared relationship selection at the point of work:
  Estimate and Invoice select Customers, Materials selects Suppliers, and
  canonical jobs select site relationships from one Contacts directory.
- `GA-DATA-001` gains real use of the existing
  `0036_canonical_contacts.contact_job_links` model. Job links retain an
  account-owned Contact ID, job ID, relationship role, primary flag, and
  job-specific private notes without duplicating the Contact.
- `GA-UX-005` gains explicit continuity and honesty: document snapshots remain
  immutable, a typed supplier is not represented as saved, old device-only
  job contacts require an explicit move, unlink never means delete, and job
  links do not imply sharing with crew or another account.
- `GA-AUTH-007` gains server enforcement for job-contact list/write/delete:
  access requires the job creator or accepted active-work participant and the
  linked Contact must belong to the caller's account.
- `GA-UX-006` gains rendered Tools and Work lifecycle evidence for canonical
  Customer selection, Supplier selection, and job-contact linking on mobile.
- Requirement maturity does not change. No new migration, public-contact
  exposure, public-profile linkage, or outbound message delivery is added.
  Local evidence includes production build, application/security lint, 103
  unit/frontend tests, all 21 serial PostgreSQL integration suites,
  fail-closed authentication plus Jobs/discovery E2E, focused Tools,
  mobile-action, and Work-lifecycle rendered QA, diff integrity, and a
  zero-vulnerability production dependency audit. Production exact-source
  health reports `32db9cd56451e51db076eaa5a3d1c74b610db86b` with
  `0036_canonical_contacts` ready; the seven-check synthetic monitor,
  anonymous job-contact authorization check, and live Contact/Work/Tools
  bundle inspection pass.

## Traceability Addendum - 2026-07-27 Work Workspace Records

- `GA-DATA-001` gains canonical, versioned accepted-job checklist,
  milestone, change-order, and note records plus append-only record events.
- `GA-AUTH-007` gains participant-only workspace reads and writes,
  author-only private notes, contractor-only milestone mutation and
  change-order decisions, and fail-closed outsider behavior.
- `GA-UX-005` gains honest multi-device state: required optimistic versions,
  idempotent mutation, explicit local-record migration, device-only unsent
  drafts, reversible archive, immutable history, and manual-payment wording.
- `GA-UX-006` gains rendered mobile light, dark, and Extra Large evidence for
  create, edit, archive, restore, exact milestone cents, and fixed-navigation
  clearance.
- Closeout report v2 includes authorized shared records and their history
  while excluding private notes.
- Local evidence includes production build, application/security lint, 104
  unit/frontend tests, all 21 serial PostgreSQL integration suites,
  migration rollback/reapply, fail-closed authentication plus Jobs/discovery
  E2E, focused rendered QA, diff integrity, and a zero-vulnerability
  production dependency audit.
- Production exact-source health reports
  `ec784d5a35c60294792853e479d3fdb492e8c3d1` with
  `0038_project_workspace_records` ready. The seven-check monitor,
  anonymous workspace authorization probe, and disposable authenticated
  project lifecycle pass.

## Traceability Addendum - 2026-07-28 Shop Talk and Trade News Continuity

- `GA-DATA-001` gains versioned account-owned Trade News preferences and
  saved-article snapshots plus structured canonical article fields on Shop
  Talk posts. Browser `rivt.news.*` values are a cache or an explicitly
  migrated legacy source, never the only signed-in copy.
- `GA-AUTH-007` gains owner-only preference and saved-article mutation,
  public-audience community enforcement for shared article discussions, and
  audience/moderation filtering on indexed discussion lookup.
- `GA-COM-001` and `GA-COM-003` gain one canonical cross-role discussion per
  article. Server canonicalization, an active-post uniqueness index, and
  conflict responses carrying the existing post ID prevent duplicate
  conversations without inventing engagement.
- `GA-UX-005` gains loss-safe continuity and article honesty: a device choice
  is never silently overwritten, failed migration retains local state,
  saved records contain only known publisher metadata, and structured posts
  keep the article link separate from the member's comment.
- `GA-UX-006` gains rendered desktop and 390px evidence for fresh-account
  sync, explicit old-device migration, Saved continuity, structured
  discussion reuse, and light/dark presentation.
- Requirement maturity does not change. Local evidence includes production
  build, application/security lint, 112 unit/frontend tests, all 22 serial
  PostgreSQL integration suites, migration rollback/reapply, fail-closed
  authentication plus Jobs/discovery E2E, focused rendered QA, diff
  integrity, and a zero-vulnerability production dependency audit.
- Production exact-source health reports
  `ef44c728c0af8afd004b735668f11f2c304087a6` with
  `0041_shop_talk_news_continuity` ready. The seven-check production monitor
  and disposable run `packet83-20260728070811-f7d1a6` pass owner continuity
  and isolation, structured clean-body discussion creation, indexed
  cross-role lookup, duplicate prevention, answer visibility, and cleanup.
