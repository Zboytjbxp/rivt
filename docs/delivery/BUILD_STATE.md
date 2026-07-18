# RIVT Build State

Last updated: 2026-07-17 America/New_York
Current gate: Gate B controlled engagement
Current phase: Packet 63 invoice delivery and records is ready for release verification.
Active packet: `docs/delivery/packets/63_INVOICE_DELIVERY_AND_RECORDS.md`
Repository branch: `codex/invoice-delivery-release` (base: `origin/master`)
Production feature release commit: pending Packet 63 deployment

## Packet 63 - Invoice Delivery and Records

- Invoice now saves a server-owned customer-facing snapshot before email is
  attempted. The review flow distinguishes `Save draft`, `Email invoice`, and
  `Print or Save PDF` so printing is no longer misrepresented as delivery.
- Email is accepted only after the configured transactional provider responds;
  recipient, provider message id, attempt count, success, and failure state
  are persisted on the account-owned invoice record.
- Delivery is idempotent and account-scoped. Customer email includes the
  invoice lines, total, terms, and direct-payment boundary, while internal
  pricing mechanics remain private.
- Local verification: build, scoped lint, 58 unit/frontend tests, E2E,
  mobile-action UI, targeted PostgreSQL invoice integration, and dependency
  audit pass. The full integration aggregate exceeded the local ten-minute
  command window without reporting a failure; deployment and production
  monitoring remain pending.
- No payment processing, escrow, payment verification, or tax automation is
  introduced. R-023 remains unchanged.

## Packet 62 - Tool Context and Estimate Dock Usability

- Tool context pickers now distinguish current work from history: only
  canonical `active` RIVT work is selectable for new tool artifacts;
  completed and cancelled work remains in its records/history surface.
- Estimate's mobile dock now presents one forward action for the current
  progressive step, while conversion to Invoice stays readable in Review.
  Workbench bottom clearance prevents the fixed dock from hiding fields or
  customer-facing review content.
- Build, lint, 58 unit/frontend tests, E2E, rendered Tools UI, mobile-action
  UI, and dependency audit pass. Three non-database integration checks pass;
  sixteen PostgreSQL suites are skipped because this clean release worktree
  does not contain `TEST_DATABASE_URL`.
- Railway served exact source `279a21bdd58091d0147d7dda9242a19ee210e54b`.
  The production monitor passed with PostgreSQL, S3-compatible storage,
  Sentry, Web Push, matching-job alerts, and all seven anonymous private-route
  checks healthy. No server, schema, authorization, billing, storage, or
  dependency change is included.

## Packet 61 - Calculator Fraction Hierarchy

- Heavy 16th now gives quarter, eighth, and sixteenth presets an unmistakable
  tape-mark hierarchy: a long strong quarter mark, a medium eighth mark, and
  a short sixteenth mark. Equal-size keys remain equally reachable.
- Semantic fraction-family data and accessible labels identify each tape mark;
  the selected outline does not hide the hierarchy.
- Build, lint, 58 unit/frontend tests, E2E, rendered Tools UI, mobile-action
  UI, and dependency audit pass. The rendered SE calculator confirms the
  three tape-mark sizes at handset scale.
- Three non-database integration checks pass; sixteen PostgreSQL suites are
  skipped because this worktree does not have `TEST_DATABASE_URL` configured.
- Railway served exact source `ff64a11f023803adb3cc150b056adaf5818222e0`.
  The production monitor passed in 591 ms with PostgreSQL, S3-compatible
  storage, Sentry, Web Push, matching-job alerts, and all seven anonymous
  private-route checks healthy.
  No server, schema, authorization, billing, storage, or dependency change is
  included.

## Packet 60 - Money Document Flow

- Estimate and Invoice now reserve their final progressive stage for the
  customer-facing document and its next action instead of mixing editing,
  hidden preview, and delivery choices together.
- Invoice review exposes the document directly with copy and print/save-PDF
  handoffs; device email/text drafts explain their exact local handoff and the
  accepted-work follow-up.
- No payment processing, payment verification, provider setup, external send
  confirmation, or server contract is added. The existing server-backed
  Estimate email route remains authoritative.
- Build, lint, 58 unit/frontend tests, E2E, rendered Tools UI, mobile-action
  UI, and the production dependency audit pass. Three non-database integration
  checks pass; sixteen PostgreSQL suites are skipped because this clean
  worktree does not have `TEST_DATABASE_URL` configured. Deployment evidence
  is complete. Railway served exact source
  `3d399023c8d866f112403549776a056a22a28f74` and the production monitor
  passed with PostgreSQL, S3-compatible storage, Sentry, Web Push, and
  matching-job alerts healthy. Requirement maturity is unchanged; the active
  risk boundary remains R-023 until a reviewed payment or server delivery
  contract exists.

## Packet 59 - Calculator Tape Preferences

- Heavy 16th now keeps metric, notation, fraction ordering, and Heavy / Light
  behavior as device-local calculator preferences instead of treating every
  option as a top-of-keypad command.
- Inches-only entry stays unbounded by the twelve-inch display convention;
  feet-and-inches remains an explicit optional notation.
- Heavy and Light are truthful tape qualifiers by default. One mark remains
  visible, matching marks resolve to one sixteenth, and thirty-second behavior
  is opt-in rather than silently fabricated.
- Fraction-key hierarchy now makes quarter, eighth, and sixteenth marks easier
  to identify while preserving balanced tap targets on compact phones.
- Build, lint, 58 unit/frontend tests, E2E, rendered desktop/mobile/SE Tools
  QA, mobile-action QA, and dependency audit pass. Three non-database
  integration checks pass; sixteen PostgreSQL suites are skipped because this
  worktree does not contain `TEST_DATABASE_URL`.
- Production `/api/health` served exact source
  `6765dd2196221816ea9149916f295ea58112d210` with migration 0028 ready.
  The production monitor passed in 582 ms with PostgreSQL and S3-compatible
  storage healthy, Sentry and Web Push configured, matching-job alerts
  enabled, operational controls open, and all seven anonymous private-route
  checks healthy.

## Packet 58 - Calculator Key Balance

- Heavy 16th now gives its three fraction rows and four keypad rows
  proportional space instead of letting an implicit grid row compress the
  whole-number pad.
- Fraction labels are more legible and both key families share one visual
  rhythm at mobile and compact-phone heights.
- Rendered desktop/mobile/SE Tools QA passes, including a new regression check
  that constrains representative fraction and number key heights to within
  eighteen percent of one another.
- Build, lint, security lint, 58 unit/frontend tests, E2E, rendered
  desktop/mobile/SE Tools QA, mobile-action QA, the production dependency
  audit, and diff checks pass. Three non-database integration checks passed;
  sixteen PostgreSQL suites skipped because this CSS-only worktree does not
  contain `TEST_DATABASE_URL`.
- Production `/api/health` served exact source
  `fe393887abe17a2e5c162769a62851897feb81bb`. The expected-source monitor
  passed in 619 ms with PostgreSQL, S3-compatible storage, Sentry, Web Push,
  matching-job alerts, operational controls, and all seven anonymous
  private-route checks healthy.

## Packet 57 - Unlimited Inches Calculator

- Heavy 16th inches mode now accepts long whole-inch measurements and keeps
  them in inches-and-fractions notation instead of rolling over at twelve.
- Feet remains an explicit optional notation. Switching `IN` -> `FT` -> `IN`
  preserves the exact measurement.
- Equation labels, copied output, result cards, and new/restored history use
  the selected notation consistently; older device history restores safely in
  inches mode.
- Build, lint, security lint, 58 unit/frontend tests, E2E, rendered
  desktop/mobile/SE Tools QA, mobile-action QA, the production dependency
  audit, and diff checks pass. The integration command passed its three
  non-database checks and skipped sixteen PostgreSQL suites because this
  worktree does not contain `TEST_DATABASE_URL`; there are no server changes.
- Production `/api/health` served exact feature source
  `cfe99f6bb0ea95e87506e2e7b33eeaec100ef0a9`. The expected-source monitor
  passed in 576 ms with PostgreSQL, S3-compatible storage, Sentry, Web Push,
  matching-job alerts, operational controls, and all seven anonymous
  private-route checks healthy.

## Packet 56 - Heavy 16th Standalone App

- Heavy 16th now keeps a live equation tape and a short, device-local history
  of completed equations and double/half operations.
- History opens in an accessible, one-handed bottom sheet on phones. A prior
  result restores its original imperial or metric mode in one tap.
- Metric/imperial mode controls use explicit `MODE MM` / `MODE IN` labels, and
  copied-result feedback is announced without covering the keypad.
- The calculator remains fraction-only. Spacing, cuts, hardware, estimator,
  and unrelated field modes are intentionally outside this packet.
- Build, lint, security lint, E2E, 58 unit/frontend tests, rendered
  multi-viewport Tools QA, compact mobile-action QA, the production dependency
  audit, and diff checks pass. A configured PostgreSQL integration run exercised
  real account, job, messaging, migration, and project lifecycles without a
  failure before the ten-minute command limit stopped the still-running suite;
  Packet 56 does not change server or database code.
- Production `/api/health` serves exact source
  `38edcd371f3c99ae0d9d2da1e4375b73cd8a0b43` with migration 0028 ready,
  PostgreSQL and S3-compatible storage healthy, and Sentry and Web Push
  configured. The expected-source production monitor passed in 588 ms with
  rollout controls off and all seven anonymous private-route checks healthy.

## Home completion-state correction

- Home now presents `You're active now` only for an accepted-work record whose
  canonical status is `active`. Completed and cancelled records remain in Work
  and Records history but no longer fall back into the current-work slot.
- A frontend regression test renders completed and cancelled records together
  and proves that neither the active label nor either historical job title is
  shown on Home.
- Build, lint, security lint, 58 unit tests, E2E, mobile-actions, rendered Work
  lifecycle, and the production dependency audit pass. Production health
  served exact source `97a9e0fc14dba95bffe2a9297c517ba80be6b03a`;
  the expected-source monitor passed in 594 ms with PostgreSQL, object storage,
  Sentry, Web Push, matching-job alerts, and all seven anonymous private-route
  checks healthy.

## Packet 55 - Compensation Workflow (Production Verification)

### Exact closeout and review workflow repair

- Fixed-price applicants now move to a one-tap hire at the posted amount. The
  contractor only edits compensation for negotiable, hourly, or quote-based
  work, so a fixed listing no longer asks for the same price twice.
- Completion now stays inside the exact accepted-work workspace in Work. A
  tradesperson submits one short completion summary; photos, field notes, and
  checks remain useful evidence but are not invented closeout requirements.
- Disabled completion actions explain the one missing requirement in place.
  Submitting completion keeps the user on the same job and shows the next
  server-owned lifecycle state instead of opening the generic Records app.
- Contractors open the exact submitted completion from Work or its
  notification, see the tradesperson's summary and attachment count, and can
  confirm completion or request changes without searching another screen.
- Review notifications preserve the exact review id. The review destination
  renders the submitted author, rating, body, and approval state instead of an
  empty review form; participant-only review lookup is enforced server-side.
- Generic Records is once again an evidence archive. It no longer duplicates
  completion/review controls or claims a field note is required to close work.
- Rendered two-role lifecycle QA at mobile width and the fresh 19-suite
  PostgreSQL gate pass with zero failures or skips. Focused completion and
  review suites also prove exact notification destinations and outsider denial.
- Production `/api/health` serves exact merge source
  `2d0692c8bfffed11f427902090252acbc9b402bf` with migration 0028 ready.
  The expected-source monitor passed in 583 ms with PostgreSQL, S3-compatible
  storage, Sentry, Web Push, matching-job alerts, operational controls, and all
  seven anonymous private-route checks healthy.

### Active-work acceptance repair

- Work now distinguishes the public listing state from the private accepted-work
  lifecycle. Accepting an offer can close the listing to new applicants without
  labeling the participant workspace `Closed`.
- Contractor and tradesperson workspaces have role-specific guidance and
  actions. Contractors track progress and approve closeout; tradespeople perform
  the work, document it, invoice it, and submit completion.
- Accepted participants receive the exact private jobsite address and access
  notes through the participant-authorized active-work response. Work provides
  copy and directions actions without exposing that location to outsiders.
- Closeout is now a visible part of Work. The action follows the server-owned
  project state from completion submission through contractor review,
  confirmation, or requested changes, and opens the exact accepted-work record.
- Focused PostgreSQL coverage proves private-address release to the accepted
  tradesperson while preserving outsider denial, reschedule, and cancellation.
  Rendered mobile lifecycle coverage proves both role views and the closeout
  handoff.
- The complete fresh-database integration gate passed all 19 serial PostgreSQL
  suites with zero failures or skips through migration 0028.
- Railway deployment `65be4acd-34a1-40f2-b459-b9a0cae05308` serves exact
  source `650e50dbc20b1992fd8d3c8e0a4f0065aacead1a`. The expected-source
  production monitor passed in 581 ms with migration 0028 ready, PostgreSQL,
  S3-compatible storage, Sentry, Web Push, matching-job alerts, operational
  controls, and all seven anonymous private-route checks healthy.

- Contractors can list fixed, hourly, open-to-offers, or request-quotes work.
  Open-to-offers uses an optional target; request-quotes requires no invented
  budget.
- Tradespeople can submit explicit proposals where required. Contractors must
  enter the final amount/unit before sending an offer, and accepted work keeps
  those agreed terms instead of inheriting a listing estimate.
- Server-owned per-trade rate cards support hourly, day, and minimum-charge
  reference rates with network, applications-only, and private visibility.
- Migration `0028_compensation_workflow` adds the normalized fields and rate
  cards with rollback coverage. Affected PostgreSQL suites and rendered Work
  lifecycle QA pass against the configured isolated test database.
- Railway deployment `748dcef5-42a9-4e63-af86-c51a56ebdb96` serves exact
  source `b9f7458978db70cd9c7d21d950376eaaa1a04d16`; live health reports migration
  `0028_compensation_workflow` ready with PostgreSQL, S3-compatible storage,
  Sentry, and Web Push configured.
- The expected-source production monitor passed in 612 ms with rollout
  controls off and seven anonymous private-route checks.
- This packet does not process payments, escrow funds, create payroll, or make
  profile rates binding offers.
- Remaining boundary: physically complete fixed, hourly, open-to-offers, and
  request-quotes flows using one contractor and one tradesperson account.

## Packet 54 - Account Drawer Subtraction (Production Verified)

- The account drawer is now a compact navigation menu containing identity,
  Profile, Settings, staff-only Admin, and Sign out.
- Duplicate profile metrics, standing, device, appearance, and setup content
  was removed from the drawer. Profile and Settings remain the authoritative
  destinations for those controls and records.
- Exact Settings-section routing preserves theme and alert access without
  carrying preference controls in the account menu.
- Typecheck, build, lint, security lint, 55 unit tests, E2E, mobile-action UI,
  dependency audit, diff checks, and all 19 serial PostgreSQL integration
  suites passed with zero failures or skips.
- No API, schema, migration, authentication, authorization, billing, storage,
  moderation, or server-owned record behavior changed.
- Railway deployment `236c22b5-99ce-48b9-bfe8-74c3ec4534b8` served exact merge
  commit `657aa80eda8c1ea1de0771dc5918d2fcd0511193`. The expected-source
  production monitor passed in 594 ms with migration 27 ready,
  PostgreSQL/S3-compatible storage, Sentry, Web Push, matching-job alerts,
  operational controls, and all seven anonymous private-route checks healthy.
- Next boundary: begin Packet 55 on the next interface-audit subtraction
  target without adding a new product concept.

## Packet 53 - Progressive Jobsite Flows (Production Verified)

- Daily Log now follows Today, Work, and Review. Optional blockers, materials,
  and safety details stay collapsed until needed.
- Punch List separates Open, Add item, and Resolved. Safety separates Check,
  Details, and Sign off while presenting one checklist category at a time.
- Existing Daily Log, Punch List, and Safety records, exports, history,
  signoffs, legacy routes, and exact work context remain unchanged.
- Build, typecheck, lint, security lint, 55 unit tests, E2E, rendered Tools QA
  at desktop/mobile/compact widths, mobile-action QA, dependency audit, diff
  checks, and all 19 serial PostgreSQL integration suites passed with zero
  failures or skips.
- Railway served exact merge commit
  `af13e52232ec0199a35d11f7f059942fed25b7a5`. The expected-source production
  monitor passed in 574 ms with migration 27 ready, PostgreSQL/S3-compatible
  storage, Sentry, Web Push, matching-job alerts, operational controls, and all
  seven anonymous private-route checks healthy.
- Next boundary: Packet 54 Account Drawer Subtraction.

## Packet 52 - Progressive Money Flows (Production Verified)

- Estimate is organized into Price, Customer, and Review. Invoice is organized
  into Items, Customer, and Review.
- Existing calculations, draft persistence, delivery handoff, conversion,
  project invoices, external-payment records, and explicit work context are
  unchanged.
- A thumb-reachable dock owns Save and the visible next step. Invoice's older
  Draft/Receivables control moved above the task flow and no longer covers the
  current actions.
- Build, lint, security lint, 55 unit tests, E2E, rendered Tools QA at desktop,
  mobile, and compact-phone sizes, mobile-action QA, dependency audit, diff
  checks, and all 19 serial isolated PostgreSQL integration suites pass with
  zero failures or skips.
- Railway served exact merge commit
  `d39dc391cf7f5d88a3ed592f3dc3eccfc44da2dd`. The expected-source production
  monitor passed in 548 ms with migration 27 ready, PostgreSQL/S3-compatible
  storage, Sentry, Web Push, matching-job alerts, operational controls, and all
  seven anonymous private-route checks healthy.
- Next boundary: begin Packet 53 progressive Daily Log and Safety field flows.

## Packet 51 - Work State Architecture (Production Verified)

- Work now exposes four explicit states instead of stacking open work, drafts,
  applicants, active work, archive controls, templates, calendar, and local
  vanity metrics in one long surface.
- Browse owns open work and People discovery; contractor Hiring owns drafts,
  applicant pipeline, templates, and schedule; tradesperson Applications owns
  applications and offers; Active owns accepted-work workspaces; Archive owns
  past or paused records.
- Applicant, application, offer, and active-work actions preserve exact job and
  work-record routing, including records outside the current open-work list.
- The device-local contractor metric bar is removed from Work. No server data,
  schema, API, authorization, authentication, billing, storage, or moderation
  behavior changed.
- Build, lint, security lint, 55 unit tests, E2E, rendered Work lifecycle QA,
  mobile-action QA, dependency audit, diff checks, and all 19 serial
  PostgreSQL integration suites pass with zero failures or skips.
- Merge commit `25ca2de639a40c6d7956de467a33decc99c520fa` was served by
  Railway. The expected-source production monitor passed in 612 ms with
  migration 27 ready, PostgreSQL/S3-compatible storage, Sentry, Web Push,
  matching-job alerts, operational controls, and all seven anonymous private
  route checks healthy.
- Next boundary: begin Packet 52 progressive Estimate and Invoice task flows.

## Packet 50 - Interface Foundation and Subtraction (Production Verified)

- Removed 600+ lines of verified-orphaned theme, appearance, field-kit, and
  Shop Talk FAB styling before another visible redesign adds override debt.
- Added a named overlay scale and shared accessible dialog surface with focus
  trapping, Escape/backdrop dismissal, focus restoration, and ARIA semantics.
- Shop Talk reporting and the Tools work-context picker now share that behavior
  while preserving their existing content, actions, and class names.
- Shared page/panel/avatar primitives no longer use negative letter spacing.
- Build, lint, security lint, 55 unit tests, E2E, Tools UI, Shop Talk/Trade
  News UI, mobile-action UI, dependency audit, diff checks, and all 19 serial
  PostgreSQL integration suites against the configured isolated test database
  pass with zero skips or failures.
- Rendered evidence covers desktop, normal mobile, and compact-phone Tools and
  Camera plus desktop/mobile Shop Talk. Camera's lower one-handed controls and
  the seven-destination Tools floor remain intact.
- No route, record, schema, authorization, authentication, billing, storage,
  moderation, or lifecycle workflow changed.
- Merge commit `5b69d4bebd764271033cd461786a677cc0b98fa1` was served by Railway with
  migration 27 ready. The expected-source production monitor passed with
  PostgreSQL, S3-compatible storage, Sentry, Web Push, matching-job alerts,
  rollout controls, and seven anonymous private-route checks healthy in 586 ms.
- Next boundary: Packet 51 Work State Architecture, separating Browse, Hiring,
  Active, and Archive without changing server-owned job/application truth.

## Packet 49 - Full Interface Audit (Audit Complete)

- Every reachable customer and staff surface was inventoried across shell,
  entry/auth, Home, Work/People, Camera, Shop Talk/Trade News, Tools, Inbox,
  Profile, Settings, and moderation.
- The audit applies one workflow standard to every primary action: clear
  feedback, exact destination, and a visible next step.
- RIVT's product core is coherent and should not be rewritten. The principal
  interface issue is simultaneous exposure of too much capability, especially
  in Work, Estimate, Invoice, Daily Log, Safety, the account drawer, and desktop
  compositions.
- The seven-destination Tools floor remains correct. Heavy 16th and Camera's
  lower capture dock are preservation references; further simplification
  should happen inside destinations rather than by hiding useful capability.
- No new P0 authorization, billing, or data-integrity issue was established and
  no Gate B requirement changes maturity. Runtime code, schema, records,
  dependencies, deployment, and production evidence are unchanged.
- The recommended next packet is Foundation and Subtraction: verified orphan
  CSS deletion, semantic type/breakpoint/z-index/status tokens, shared dialog
  and drawer primitives, and stronger rendered overlap/overflow gates.
- Full findings and implementation trains are in
  `docs/product/FULL_INTERFACE_AUDIT_2026-07-15.md`.

## Packet 48 - Final Tools Subtraction and Launch QA (Production Verified)

- The final visible catalog is five core apps plus two grouped utilities.
  Compatibility aliases preserve legacy URLs and stored shortcuts without
  returning duplicate launchers to the hub.
- Rendered Tools QA passes at 1440x900, 390x844, and 320x568, including every
  final app, consolidated section docks, legacy routes, back navigation,
  launcher-count assertions, and horizontal-overflow checks.
- Mobile-action, accepted-work lifecycle, Shop Talk/Trade News, and guest
  preview suites pass. The Shop Talk harness now mocks the current server-owned
  post and answer APIs rather than depending on removed fallback data.
- Production build, lint, security lint, 55 unit tests, E2E, dependency audit,
  diff checks, and all 19 freshly reset PostgreSQL integration suites pass.
  Migration 27 is applied with zero pending migrations.
- No production behavior, schema, authorization, or stored record changed in
  this packet; it is a QA assertion and delivery-evidence release.
- Merge evidence: Packet 48 commit `e274dbced3dbcbac00942c6fb5f6302ca343655f`
  is on `master`. The user-facing production feature source remains Packet 47
  because Packet 48 changes only tests and delivery documentation.
- Railway served exact source `b0fe53b22af2e75f81a765d11030b0eaecac00af`.
  The expected-source production monitor passed with migration 27 ready,
  PostgreSQL and S3-compatible storage healthy, Sentry and Web Push configured,
  matching-job alerts enabled, operational controls open, and seven anonymous
  private-route checks in 622 ms.
- Remaining boundary: physical iOS/Android camera capture, cross-device record
  retention, installed-iOS push, and one two-account production closeout chain.

## Packet 47 - Jobsite Tools Consolidation (Production Verification)

- One Jobsite launcher now contains Log, Punch, and Safety sections. Separate
  Punch List and Safety utility launchers are removed.
- Existing Daily Log project entries, Punch List records, Safety records,
  storage keys, synchronization paths, and forms remain in place.
- Legacy Daily Log, Punch List, and Safety URLs resolve into the matching
  Jobsite section.
- Build, lint, security lint, 55 unit tests, all 19 freshly reset PostgreSQL
  integration suites, E2E, rendered Tools QA at desktop/mobile/compact widths,
  mobile-action QA, accepted-work lifecycle QA, dependency audit, and diff
  checks pass.
- Rendered checks cover 1440x900, 390x844, and 320x568 with no horizontal
  overflow. The three-section mobile dock remains thumb-reachable without
  preventing the underlying forms from scrolling; desktop renders it in flow.
- Production `/api/health` serves the exact feature commit with ready migration
  `0027_default_private_photo_album`, PostgreSQL, S3-compatible storage, Sentry,
  Web Push, and matching-job alerts healthy. The expected-source production
  monitor passed all seven anonymous private-route checks in 593 ms.
- Remaining boundary: physically confirm existing Daily Log, Punch, and Safety
  records remain after switching sections and reopening Jobsite on iOS/Android.

## Packet 46 - Invoice and Receivables Consolidation (Production Verification)

- Tools now has one Invoice launcher with Draft and Receivables sections. The
  duplicate Receivables launcher is removed.
- Existing invoice and payment-tracker implementations, records, storage keys,
  totals, email, print, templates, and estimate conversion remain in place.
- Legacy `?tool=payments` links and stored shortcuts resolve to Invoice with
  Receivables selected.
- Build, lint, security lint, 55 unit tests, all 19 PostgreSQL integration
  suites, E2E, desktop/mobile/compact Tools UI, mobile-action UI, dependency
  audit, and diff checks pass.
- Rendered checks cover 1440x900, 390x844, and 320x568 with no horizontal
  overflow. The lower mobile dock remains reachable without obscuring the
  working surface; desktop sections render in flow above it.
- Server-owned tool-record persistence and account isolation pass in the full
  PostgreSQL integration run.
- Railway serves exact feature source
  `ddb31bedf6235a78e152bf84b7e475413c040835`. The expected-source production
  monitor passed with PostgreSQL and S3-compatible storage healthy, Sentry and
  Web Push configured, matching-job alerts enabled, rollout controls off, and
  seven anonymous private-route checks in 569 ms.
- Remaining boundary: physical-device confirmation that an existing invoice
  and receivable remain present after switching sections, leaving Invoice, and
  reopening it.

## Packet 45 - Time and Costs Consolidation (Production Verification)

- Tools now has one `Time & costs` launcher with Time, Expenses, Mileage, and
  Summary sections in a persistent lower dock. Four duplicate launchers were
  removed from the hub.
- Existing server-owned and device records remain in place and are read by the
  original tools. No database migration, record rewrite, or tax-math change is
  part of this packet.
- Legacy URLs and stored shortcuts for Time Tracker, Expense Logger, Mileage,
  and Tax Summary resolve into the matching consolidated section.
- Build, lint, security lint, 55 unit tests, E2E, desktop/mobile/compact Tools
  UI, mobile-action UI, dependency audit, diff checks, and the focused
  PostgreSQL tool-records integration suite pass.
- Rendered checks cover 1440x900, 390x844, and 320x568 with no horizontal
  overflow and a visible four-section dock.
- Railway serves exact source `dcd8a8f191dad2a9ee76d6c21dc069e4b909ca79`.
  The expected-source production monitor passed with PostgreSQL and
  S3-compatible storage healthy, Sentry and Web Push configured, matching-job
  alerts enabled, rollout controls off, and seven anonymous private-route
  checks in 545 ms.
- Remaining boundary: physical-device confirmation that all four sections
  remain reachable and preserve existing records after leaving and reopening
  Time & costs.

## Packet 44 - Materials and Price Library (Production Verification)

- One Materials launcher now contains Takeoff, Sheets, and Price library.
  The separate Price Book launcher is gone; legacy links and pinned shortcuts
  resolve into the consolidated app.
- Existing device and server-owned `price_book` records are merged by record
  ID and update time. No records or schema were removed.
- The old trade-based starter catalog and automatic price seeding are removed.
  Takeoff presets now carry geometry and waste assumptions only, and the UI
  asks for a current supplier cost instead of pretending one is known.
- Build, lint, security lint, 55 unit tests, E2E, desktop/mobile/compact Tools
  UI, mobile-action UI, dependency audit, and diff checks pass. The directly
  affected PostgreSQL tool-records integration suite passes against the
  configured isolated test database.
- The aggregate test command entered the serial PostgreSQL suite and exceeded
  the 15-minute local command window without a reported assertion failure, so
  a full integration pass is not claimed for this packet.
- Feature commit: `a963041d774dbf511f12c183db7f6bb6425b1814`.
- Railway serves exact source `2bcc6d33d71db1c1e0102f402b885d6d80a15fc3`.
  The expected-source production monitor passed with PostgreSQL and
  S3-compatible storage healthy, Sentry and Web Push configured, matching-job
  alerts enabled, rollout controls off, and seven anonymous private-route
  checks in 611 ms.
- Remaining boundary: physical-device confirmation of one existing price and
  one newly added current supplier price after leaving and reopening Materials.

## Packet 43 - Tools Truth and Containment (Production Verification)

- One shared public-tool catalog now governs URL parsing, notification deep
  links, internal tool transitions, and the Tools container. Earnings, Bid
  Builder, Tax Estimator, Contracts, Job Checklist, and Daily Report resolve
  to the Tools hub instead of leaking unfinished surfaces.
- No stored tool records or contained component implementations were deleted.
  This is a reversible product boundary before capability consolidation.
- Mileage and Tax Summary now rate each trip by date: 2024 at $0.67/mile, 2025
  at $0.70/mile, 2026 H1 at $0.725/mile, and 2026 H2 at $0.76/mile. Unknown
  periods are excluded and visibly require review rather than being guessed.
- Local evidence passes: build, lint, security lint, 55 unit tests, E2E,
  desktop/mobile/compact Tools UI, mobile-action UI, dependency audit with zero
  vulnerabilities, diff checks, and all 19 PostgreSQL integration suites
  against isolated `rivt_test`.
- The rendered action gate caught and drove a browser-Back correction: leaving
  Calculator now returns to the Tools hub in both URL and mounted UI.
- Railway deployment `f343cb7b-ac98-4403-a348-5a1d7bf4feb5` serves exact
  feature source `a068728d98d74c73e925144050e076c756ee53b2` with ready migration
  `0027_default_private_photo_album`.
- The expected-source production monitor passed with PostgreSQL and
  S3-compatible storage healthy, Sentry and Web Push configured, rollout
  controls off, and seven anonymous private-route checks.

## Packet 42 - Estimate Email Delivery (Production Verification)

- Estimate now keeps customer details, scope, valid-through date, note, and a
  customer-safe itemized preview with its saved server record.
- An authenticated account can send only its own saved estimate through the
  existing transactional email provider. The server validates the recipient
  and exact customer-facing total, persists `sent` or `delivery_failed`, and
  rejects another account as not found.
- Email content is deliberately an estimate, not an invoice or payment link:
  internal overhead, margin, and contingency stay in the contractor view and
  never appear in the email snapshot.
- Client and provider idempotency prevent a same-key retry from sending a
  duplicate estimate; the client keeps the retry key while unchanged fields
  are retried after a weak connection.
- Build, lint, security lint, 53 unit tests, E2E, Tools UI, mobile-action UI,
  dependency audit, and all 19 isolated PostgreSQL integration suites passed.
- Railway serves source `edcc98e623d01c0fb9d841d18cd754b4b4cd763a`;
  founder-controlled inbox delivery and the production monitor passed. Full
  evidence remains in the Packet 42 verification section below.

## Packet 41 - Camera Home Album Previews (Production Verified)

- `GET /api/v1/albums` now returns a nullable, authenticated cover photo from
  each account-owned album's newest stored upload. The list query remains
  account scoped and does not create, fabricate, or expose media.
- Independent Camera now renders compact private-album cards with truthful
  counts and actual cover photos where available, plus a recent-captures row
  when multiple albums have stored media.
- An accepted RIVT job or standalone project keeps Camera focused on that
  exact work. Private albums are intentionally not mixed into a scoped camera
  session, preventing an accidental destination switch.
- The lower Destination, Feed, and Capture dock remains the one-handed primary
  action area. The global Camera navigation item is now equal to the other
  primary destinations rather than elevated as a separate command.
- Build, lint, 53/53 unit tests, E2E, Tools UI, mobile-action UI, dependency
  audit, and diff checks pass locally. The aggregate test command skipped 16
  PostgreSQL integration suites because this worktree has no
  `TEST_DATABASE_URL`; no database-integration pass is claimed.
- Production health serves exact source
  `0849eaacc0b70302bf70c487c058c33b62f99c42` with ready migration
  `0027_default_private_photo_album`; the expected-source monitor passed with
  PostgreSQL/S3-compatible storage, configured Sentry/Web Push, matching-job
  alerts enabled, controls off, and seven anonymous private-route checks.
- Remaining boundary: run the affected PostgreSQL integration suite using a
  disposable test database, then physically verify two private album covers
  and context separation on iOS and Android.

## Packet 40 - Camera Private Album Destinations (Production Verified)

- Every account has one server-owned default `Private photos` album, enforced
  by a partial unique index and created idempotently through the authenticated
  albums API for accounts created after migration backfill.
- Camera now presents private albums first in its destination sheet, followed
  by standalone projects and accepted RIVT work. Users can create a new
  private album within the same flow and it becomes the selected destination.
- Camera opens predictably on its home surface with `Private photos` selected;
  it does not silently attach captures to a job or jump into an album gallery.
- Build, lint, 53/53 unit tests, E2E, Tools UI, mobile-action UI, production
  dependency audit, and diff checks pass locally. The aggregate test command
  safely skipped 16 PostgreSQL integration suites because this isolated
  worktree has no `TEST_DATABASE_URL`; database integration is not claimed.
- Production health serves exact source
  `c366a69facf764cc36f226014bd3a83da46996c8` with ready migration
  `0027_default_private_photo_album`; the expected-source monitor passed with
  PostgreSQL/S3-compatible storage, configured Sentry/Web Push, matching-job
  alerts enabled, controls off, and seven anonymous private-route checks.
- Remaining boundary: run the integration suite with a disposable PostgreSQL
  URL, then physically confirm that a freshly created user sees `Private
  photos`, creates another album, captures to both, and cannot see another
  account's albums.

## Packet 39 - Camera Field Action and One-Hand Capture (Production Verified)

- Camera now occupies the compact shell's former Crew slot after People moved
  under Work. It is a quick field command, not a new competing product area.
- Direct Camera starts without guessing a job. Users explicitly choose accepted
  RIVT work or a standalone project before capture. Exact job Photos handoffs
  retain `/app/camera?activeWork=<id>` through the gallery and capture flow.
- The lower camera control zone keeps the exact destination, photo gallery,
  capture type, latest capture, shutter, and switch-camera controls inside the
  one-handed thumb zone. Accessible copy also identifies the save destination.
- Build, lint, 53/53 unit tests, E2E, mobile-action UI, work-lifecycle UI, and
  tools UI checks pass locally. `TEST_DATABASE_URL` is not present in this
  clean worktree, so no new database-integration result is claimed.
- Production health served exact source
  `9262bb81d630d95f4b482d7d462b506099a1ae8c`. PostgreSQL and S3-compatible
  storage, configured Sentry and Web Push, matching-job alerts, and all seven
  anonymous private-route checks passed in the production monitor (646 ms).
- Remaining boundary: physical one-handed Camera command/capture checks on the
  founder's iPhone and Android devices before treating the new navigation as
  field accepted.

## Packet 38 - Work and People Navigation (Production Verified)

- Work is now the entry point for both Jobs and People. People contains the
  saved-person, subs, clients, reviews, and invite-planning surfaces that were
  previously reached through Crew.
- Home, Work, Shop Talk, and Tools are the exposed primary destinations. Old
  Crew/network URLs resolve to Work -> People so existing links remain valid.
- Build, lint, unit tests, E2E, dependency audit, and diff check pass locally.
  `npm run test` has the normal 53 passing unit tests; database integration
  suites are skipped because this worktree has no `TEST_DATABASE_URL`.
- Production health serves exact source
  `1e7141c13170d623e49996a48a74310ace5bfe0f`; PostgreSQL and S3-compatible
  storage are healthy, Sentry and Web Push are configured, matching-job alerts
  remain enabled, controls are off, and the synthetic monitor passed seven
  anonymous private-route checks in 553 ms.
- Remaining boundary: physically confirm Jobs -> People switching on founder
  devices, including legacy `/app/crew` links, before treating the information
  architecture as field accepted.

## Packet 37 - Workflow Coherence and Field Tool Reachability (Local Verification)

- Focused accepted work now gives an explicit, dismissible arrival confirmation
  that names the selected job and points to the exact job thread, photos, and
  daily-log next steps instead of relying on an imperceptible scroll.
- Mobile Camera home and gallery actions are named and held in lower-screen
  docks; the gallery removes its duplicate top control row only on mobile and
  reserves safe-area clearance for the dock.
- Build, lint, unit tests, E2E, mobile-action UI smoke, production dependency
  audit, and diff check pass locally. This worktree has no `TEST_DATABASE_URL`;
  this client-only packet makes no database-integration claim.
- Production health serves exact source
  `d9b9097f3a0e20a8ccb119b76c794c942efad7e7`; PostgreSQL and S3-compatible
  storage are healthy, Sentry and Web Push are configured, matching-job alerts
  remain enabled, controls are off, and the synthetic monitor passed seven
  anonymous private-route checks in 537 ms.
- Remaining boundary: physical one-handed gallery capture/upload checks on
  iPhone and Android.

## Packet 36 - Shop Talk Reliability (Production Verified)

- `master` serves exact runtime source
  `845761451038215d855cced6080f3be7e4a84394`; the production synthetic
  monitor passed with PostgreSQL/S3-compatible storage healthy, configured
  Sentry and Web Push, matching job alerts enabled, controls off, and seven
  anonymous private-route checks in 619 ms.
- Focused PostgreSQL coverage passed for exact post retrieval, audience denial,
  and author-earned reputation. The full integration wrapper exceeded the
  local 15-minute runner limit without a failure, so aggregate completion is
  intentionally not claimed.
- Remaining physical checks: tap a notification for a post outside the newest
  feed page, then log out and back in on a subscribed device to confirm the
  next push arrives without opening Settings.

## Packets 32-35 - Aggregate Release Verification

- Build, lint, security lint, 53/53 unit tests, E2E, Work lifecycle UI, Tools
  UI, Shop Talk/Trade News UI, guest-preview UI, and mobile-actions UI passed.
- A freshly reset isolated PostgreSQL database passed all 19 integration
  suites. The earlier community fixture failure did not reproduce after the
  test database reset and was stale test state, not a product regression.
- `npm audit --omit=dev` reports zero production dependency vulnerabilities;
  `git diff --check` passes.
- Existing E2E and mobile smoke selectors now assert the deliberate product
  hierarchy: two core Tools cards plus one Utilities drawer, Camera and Heavy
  16th in Field shortcuts, a labeled Shop Talk Post command, and the decisive
  entry headline.
- Production health served exact feature source
  `b2bc306089d8320517110fc3361615c6df4a8dc8` with ready migration
  `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured
  Sentry and Web Push, and matching-job alerts enabled. The expected-source
  synthetic monitor passed with controls off, seven anonymous private-route
  checks, and a 563 ms duration.
- Remaining boundary: physical one-handed review on the founder's phones.

## Packet 35 - Entry, Login, and Onboarding Return Path (Production Verified)

- One decisive entry replaces the low-information feature carousel and names
  Work, proof, trade community, and field tools together.
- Preview, Create free account, and Log in remain in the initial 320x568
  viewport; Login has an explicit RIVT overview return path.
- Post-signup setup keeps its real task progression but removes instructional
  filler and uses a stable one-handed Back/Next row.
- Verification passed individually, in the aggregate release gate, and in the
  exact-source production monitor.
- Remaining boundary: physical-device review.

## Packet 34 - Shop Talk Hierarchy (Local Verification)

- A labeled Post command replaces the floating Ask control, and empty feeds
  provide the same clear next step.
- Community discovery and creation are explicit; selected community identity
  precedes the scoped feed on mobile.
- Feed, Communities, and Trade News retain their real server-owned behavior.
- Local verification passed: build, lint, rendered Shop Talk/Trade News smoke,
  and diff check.
- Remaining boundary: physical-device review and production deployment.

## Packet 33 - Tools Subtraction (Local Verification)

- Default pinned tools no longer repeat in the core-app grid, and the redundant
  Recent block is removed.
- Nine supporting helpers remain available in one compact Utilities drawer
  instead of three competing category boxes.
- Tool implementations, stored records, exact-job context, and deep links are
  unchanged.
- Local verification passed: build, lint, rendered Tools UI smoke, and diff
  check.
- Remaining boundary: physical one-handed validation and production deployment.

## Packet 32 - Daily Workspace and Camera (Local Verification)

- Focused accepted work now suppresses broad Work dashboard controls on mobile
  and puts the exact job's Today actions before general job facts.
- Camera repeats the exact save destination beside the shutter controls and
  adds a lower-screen Done action, preserving one-handed completion on short
  phones.
- Accepted-job, standalone-project, and private-album destinations remain
  explicit; no persistence or authorization boundary changed.
- Local verification passed: build, lint, Tools rendered UI smoke, Work
  lifecycle UI smoke, mobile-action UI smoke, and diff check.
- Remaining boundary: physical one-handed validation and production deployment.

## Packet 31 - Appearance Simplification (Local Verification)

- Appearance is now only System, Light, or Dark. It is no longer a tool-brand
  palette selector, custom color editor, or paid-looking customization surface.
- Account and Settings share the same direct three-choice preference; all users
  keep the same RIVT visual identity.
- Retired accent, chrome, canvas, density, palette, and custom-color device
  keys are cleared when the new preference loads, preventing old visual state
  from lingering after the update.
- Local verification passed: build, lint, 53/53 unit tests, E2E,
  mobile-action UI smoke, dependency audit, and diff check. This client-only
  packet does not claim a database integration pass.
- Production evidence: `master` serves exact source
  `210f5d17581ed1c83ed2218be96d92093fe8de30`; live health reports ready
  migration `0026_standalone_projects`, PostgreSQL/S3-compatible storage,
  configured Sentry, and configured Web Push. The expected-source production
  monitor passed with matching alerts enabled, controls off, seven anonymous
  private-route checks, and a 572 ms duration.

## Packet 30 - Field Kit Themes (Local Verification)

- Appearance now starts with six familiar, high-contrast Field Kit color
  systems: orange/black, red/black, yellow/black, teal/black, green/black,
  and blue/black. A kit applies the shell, work surface, and density together.
- My tool color persists an exact user-selected color on the device; it is not
  presented as a manufacturer affiliation or branded skin.
- Fine tuning remains available but is secondary to the simpler one-tap Field
  Kit choice.
- Local verification passed: build, lint, 53/53 unit tests, E2E, mobile-action
  UI smoke, dependency audit, and diff check. This client-only packet does not
  claim a database integration pass.
- Remaining boundary: physical device checks before a future paid appearance
  decision.
- Production evidence: `master` serves exact source
  `d260da9a517f7660c26bd42a5ddb3740dbb52630`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push remain configured, ready migration is
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 584 ms.

## Packet 29 - Appearance Studio (Local Verification)

- Field Finishes are superseded. Appearance is now a composed RIVT setup:
  original Accent, Chrome, Canvas, Display mode, and Workspace density
  controls, instead of vague manufacturer-adjacent palettes.
- Existing device-local Field Finish preferences migrate to the closest
  composed RIVT setup, then the new preferences are stored independently.
- Account stays compact and opens a dedicated mobile editor; Settings keeps
  the full editor. Both update the shared token layer without reload.
- Local verification passed: build, lint, 53/53 unit tests, E2E, mobile-action
  UI smoke, Tools rendered UI smoke, dependency audit, and diff check. This
  client-only packet does not claim a database integration pass; the aggregate
  test command's database-integration half exceeded the local runner window
  without output.
- Remaining boundary: physical light/dark checks on iPhone and Android before
  any future paid appearance entitlement decision.
- Production evidence: `master` serves exact source
  `36f0735d45922e8a3cc49fb8dc9d255896aade5d`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push remain configured, ready migration is
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 569 ms.

## Packet 28 - Field Finishes (Local Verification)

- Appearance now uses named, original RIVT Field Finishes rather than
  manufacturer-adjacent swatches. Each finish changes canvas, panels, borders,
  top bar, navigation, active state, primary action, and information tones.
- Account is compact: it shows the selected finish and opens a dedicated
  full-screen editor. Settings retains the full Field Finishes editor.
- Local verification passed: build, lint, 53/53 unit tests, E2E, mobile-action
  UI smoke, Tools rendered UI smoke, dependency audit, and diff check. The
  aggregate test command stalled without output during its remote database
  integration half, so this frontend-only packet makes no new database claim.
- Production evidence: `master` serves exact source
  `5944d6207a8961cf754282fbd667e4e52ff53bc1`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push remain configured, the ready migration is
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 569 ms.
- Remaining boundary: production source and physical light/dark checks on an
  iPhone and Android device before any future paid entitlement decision.

## Packet 27 - Theme Studio (Production Verification)

- Appearance is one shared Theme Studio in Account and Settings, with a current
  style preview, explicit display-mode choices, and named palette cards.
- Palette variables now affect application chrome, active states, information
  accents, and warning highlights, not only primary accent buttons.
- Local verification passed: build, lint, 53/53 unit tests, E2E, mobile-action
  UI smoke, Tools rendered UI smoke, dependency audit, and diff check. This
  client-only packet does not claim a new database integration pass.
- Production evidence: `master` serves exact source
  `2f67ce4551b1a2bf4e53b57ed609dfcd27fb06b1`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push remain configured, the ready migration is
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 575 ms.
- Remaining boundary: physical light and dark checks on an iPhone and Android
  device for every palette before any future paid entitlement decision.

## Packet 26 - Entry Experience (Production Verification)

- The RIVT intro keeps its capability preview but no longer makes returning
  members hunt through a feature tour for login.
- Create free account and Log in are persistent peer controls; Preview demo is
  a distinct, accurately labeled sample path.
- Local verification passed: build, lint, 53/53 unit tests, E2E, dependency
  audit, and diff check. This client-only packet does not claim a new database
  integration pass.
- Production evidence: `master` serves exact source
  `d6c475546229ae62165b3afd4c5149540720b83e`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push are configured, the ready migration remains
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 583 ms.
- Remaining boundary: a physical mobile review of intro, preview, signup, and
  login transitions on iOS and Android.

## Packet 25 - Tool Consolidation (Production Verification)

- Tools preserves five daily field apps and reduces the supporting hub to
  Plan, Track, and Site groups.
- Bid builder, Earnings, Tax estimator, Daily report, Job checklists, and
  Contracts are no longer presented as day-one launchers. Their code and
  existing records are retained pending a deliberate future product decision.
- Local verification passed: build, lint, 53/53 unit tests, E2E, Tools rendered
  UI smoke, dependency audit, and diff check. This client-only packet does not
  claim a new database integration pass.
- Production evidence: `master` serves exact source
  `31c70a3f252f733857d822f1732c19b561c52848`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push are configured, the ready migration remains
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 599 ms.
- Remaining boundary: physical mobile confirmation that the smaller tool
  inventory feels clear without hiding an expected daily tool.

## Packet 24 - Active Work Camera Workflow (Production Verification)

- Active-work Today now treats Messages, Photos, and Daily log as the daily
  job actions. Each route retains the exact active-work context, and the
  former generic project-record detour is removed from this surface.
- Camera's bottom dock now contains the selected destination, Feed, and
  Capture. High-screen duplicate project-feed commands are removed so frequent
  camera navigation is reachable with one hand.
- Local verification passed: build, lint, 53/53 unit tests, E2E, Work lifecycle
  UI smoke, Tools rendered UI smoke, dependency audit, and diff check. This
  client-only packet does not claim a new database integration pass.
- Production evidence: `master` serves exact source
  `bd2a531e3faa4a6d3b1fb098e353008006659442`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push are configured, the ready migration remains
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 611 ms.
- Remaining boundary: physical one-handed iOS/Android proof for the active-job
  daily-action row and Camera Destination, Feed, and Capture dock.

## Packet 23 - Work Action Ownership (Production Verification)

- Home no longer owns a generic floating creation button. It remains a daily
  status surface, while onboarding can still direct a new contractor to their
  first job when appropriate.
- Work owns the contractor posting action. Desktop uses the Work-header
  `Post job` command; compact mobile uses a lower-screen `Post job` control
  immediately above the persistent navigation.
- Local verification passed: build, lint, security lint, 53/53 unit tests,
  E2E, mobile-action UI smoke, dependency audit, and diff check. This
  client-only packet does not claim a new database integration pass; the
  aggregate test command exceeded the local runner window during integration.
- Production evidence: `master` serves exact source
  `97d749e459352a40b36bb5d9b44b3e306306510e`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push are configured, the ready migration remains
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 606 ms.
- Remaining field-proof boundary: physical phone confirmation that Work's
  posting action remains clear of the bottom navigation and active-work
  controls.

## Packet 22 - Field Access Workbench (Production Verification)

- Tools now exposes a three-slot Field Tools tray above the mobile navigation.
  Its defaults are Camera, Heavy 16th, and Daily log; it is configurable per
  device and keeps `All tools` one tap away without adding permanent nav items.
- Camera moves its frequent actions into the bottom action dock. Generic Camera
  entry requires a deliberate accepted-work or standalone-project destination
  before opening capture, while exact active-work Camera retains the job.
- Crew is roster-first. Invite planning is collapsed until requested, and the
  default Crew page no longer repeats Shop Talk prompts or decorative trust
  content from other destinations.
- Local verification passed: build, lint, security lint, 53/53 unit tests,
  E2E, Tools rendered UI smoke, mobile-action UI smoke, dependency audit, and
  diff check. The aggregate `npm run test` exceeded the local command window
  before the integration half emitted output, so no new DB-suite pass is
  claimed for this packet.
- Production evidence: `master` serves exact source
  `8b634549f1e10d1761a92b9e23fb7db636c190b2`; PostgreSQL, S3-compatible
  storage, Sentry, and Web Push are configured, the ready migration remains
  `0026_standalone_projects`, and the expected-source production monitor
  passed with seven anonymous private-route checks in 649 ms.
- Remaining field-proof boundary: physical one-handed iOS/Android checks for
  the Tools tray, Camera destination choice/capture, and collapsed Crew
  planner.

## Packet 21 - Shop Talk Command Center (Local Verification)

- Shop Talk now has distinct Feed, Communities, and Trade News destinations.
  Community discovery and creation no longer compete with discussion posts.
- The feed uses a single expandable filter surface. Ask is fixed above mobile
  navigation with clearance beneath the final post.
- Communities use compact rows with real counts, a visible signed-in Create
  action, search, joining, and existing public/role-limited audience choices.
- Live RSS and Google News sources now lead the feed. Curated content is an
  outage fallback; the cache is ten minutes and a user can request refresh.
- Local verification passed: build, lint, security lint, 53/53 unit tests,
  E2E, Shop Talk rendered UI smoke, mobile-action UI smoke, dependency audit,
  and diff check. The configured database integration suite was attempted
  twice and stalled before producing a result, so no new DB-suite pass is
  claimed for this packet.
- Production evidence: `master` serves exact source
  `b682ac9adc2dfdd408b33f453b8a41b73b58197c`; PostgreSQL,
  S3-compatible storage, Sentry, and Web Push are configured, the ready
  migration remains `0026_standalone_projects`, and the expected-source
  production monitor passed with seven anonymous private-route checks in
  585 ms.

## Packet 20 - Core Surface Subtraction (Production Verification)

- Home removes duplicate recent-tool, offline/device-state, and answer-queue
  panels. The persistent shell, Tools, and Shop Talk own those destinations.
- Tools now treats every recently opened tool as recent, then keeps five core
  field apps visible and all supporting utilities in three compact groups.
- The hub-level storage copy is removed; each record surface remains
  responsible for explaining its own persistence state.
- Local verification passed: build, lint, 53/53 unit tests, E2E,
  mobile-action UI smoke, Tools rendered UI smoke, dependency audit, and diff
  check. The packet has no server or migration change, so the PostgreSQL
  integration suite was not repeated.
- Production evidence: Railway deployment `1f01e85b-6398-4bba-930c-223faf970afc`
  succeeded. Live `/api/health` serves exact source
  `3f4ea9585ef77d3769d8507fd1fd486b03f2634d` with PostgreSQL,
  S3-compatible storage, configured Sentry, configured Web Push, and ready
  migration `0026_standalone_projects`. The expected-source production monitor
  passed with seven anonymous private-route checks in 516 ms.
- Remaining field-proof boundary: one physical phone scan of the reduced Home
  and Tools hubs.

## Packet 19 - Job Workspace Simplification (Production Verification)

- Job detail now uses Today, Job, Money, and More as the primary workspace
  modes. Inactive jobs use Activity instead of Today.
- Active-work actions are ordered first within Today, followed by summary and
  job facts. Requirements remain a Job subview; changes, checklist, notes, and
  contacts remain in More.
- The Work lifecycle smoke asserts that Today puts exact active-work actions
  before the job summary, then continues to prove the scoped Camera handoff.
- Local verification passed: build, lint, security lint, 53/53 unit tests,
  E2E, Work lifecycle UI smoke, mobile-action UI smoke, Tools rendered QA,
  dependency audit, and diff check. The aggregate test command was not
  repeated because this client-only navigation packet does not touch server or
  database code.
- Production evidence: Packet 19 source is included in deployed source
  `3f4ea9585ef77d3769d8507fd1fd486b03f2634d`, which passed exact-source
  health and production monitoring with migration `0026_standalone_projects`.
- Remaining field-proof boundary: a physical active-job pass on iOS and
  Android.

## Packet 18 - Work Mobile Priority (Local Verification)

- Active work renders immediately after the Work heading, ahead of status
  browsing, metrics, search, and filters. This makes the current job the first
  decision for a person who has accepted work.
- Contractor summary metrics are withheld while active work exists. Other
  listings and administration remain available through the unchanged status
  controls, labeled `Other work` on small screens.
- The lifecycle smoke asserts that the active-work strip is visible and above
  Work browsing controls before exercising the exact workspace handoff.
- Local verification passed: build, lint, security lint, 53/53 unit tests,
  E2E, Work lifecycle UI smoke, mobile-action UI smoke, Tools rendered QA,
  dependency audit, and diff check. The aggregate test command was not
  repeated because this client-only hierarchy packet does not touch server or
  database code.
- Production evidence: `master` serves exact source
  `8e2c757d690513318daf3fe85583aa7674a7725d`; health reports PostgreSQL,
  S3-compatible storage, configured Sentry, configured Web Push, and ready
  migration `0026_standalone_projects`. The expected-source production monitor
  passed with matching-job alerts enabled, controls off, seven anonymous
  private-route checks, and a 553 ms duration.
- Remaining field-proof boundary: physical-phone confirmation with a
  contractor who has active work.

## Packet 17 - Active Work Action Simplification (Local Verification)

- The accepted-work panel now leads with one `Open project records` command.
  `Messages`, `Camera`, and `Daily log` form the visible daily field row;
  Estimate and Invoice sit in a compact Money group.
- Reschedule and cancellation are still available, but begin collapsed under
  `Job controls` so exceptional job changes do not compete with normal field
  work.
- The Work lifecycle smoke now asserts the focused exact workspace, visible
  field actions, collapsed job controls, and the exact-job Camera handoff.
- Local verification passed: build, lint, security lint, 53/53 unit tests,
  E2E, Work lifecycle UI smoke, mobile-action UI smoke, Tools rendered QA,
  dependency audit, and diff check. The aggregate test command was not
  repeated because this client-only presentation packet does not touch server
  or database code.
- Production evidence: `master` serves exact source
  `596d824b34d1f6ec84e644ec2f2a20c790907279`; health reports PostgreSQL,
  S3-compatible storage, configured Sentry, configured Web Push, and ready
  migration `0026_standalone_projects`. The expected-source production monitor
  passed with matching-job alerts enabled, controls off, seven anonymous
  private-route checks, and a 527 ms duration.
- Remaining field-proof boundary: one-handed physical-phone confirmation on
  an accepted job.

## Packet 16 - Workspace Focus Handoff (Local Verification)

- Work's active-work summary now uses the same exact route-level handoff as
  Home and notification destinations. It preserves the active-work and job
  identifiers instead of only toggling a local detail state.
- After the matching detail renders, Work scrolls it into view and moves focus
  to its job title. This makes the result visible on a phone rather than
  leaving the user at the top of Work with no apparent change.
- The Work lifecycle smoke now asserts the active-work URL, in-viewport job
  heading, and accessible focus handoff after tapping `Open workspace`.
- Local verification passed: build, lint, security lint, 53/53 unit tests,
  E2E, Work lifecycle UI smoke, mobile-action UI smoke, Tools rendered QA,
  dependency audit, and diff check. The aggregate `npm run test` exceeded the
  local runner's two-minute limit before reporting an integration result, so
  no aggregate pass is claimed for this client-only packet.
- Production evidence: `master` serves exact source
  `5e766ca22f5d20bdfa52f7ef632274fe425f2326`; live health reports ready
  migration `0026_standalone_projects`, PostgreSQL, S3-compatible object
  storage, configured Sentry, and configured Web Push. The production monitor
  passed with matching alerts enabled, controls off, seven anonymous
  private-route checks, and a 621 ms duration.
- Remaining field-proof boundary: tap `Open workspace` from an active-work
  card on a physical phone and confirm the job detail scrolls into view.

## Packet 15 Follow-up - Mobile Experience Train (Production Verified)

- Returning-user provider actions keep their Google/Apple/Email labels at phone widths, intro pager dots now have 44px targets, and the account drawer clips no content horizontally.
- Shop Talk is feed-first on mobile. Community discovery remains available as a compact horizontal rail with an explicit expand action for search, audience selection, joining, and user-created communities.
- Work replaces clipped seven/eight-tab strips with labeled mobile selectors, and suppresses the duplicate active-work banner once that exact workspace is open.
- Settings now has a sticky mobile section index for Account, Alerts, Profile, Theme, Plan, Business, and Security instead of one undifferentiated page. Notification controls are one tap from the Settings header.
- Invoice templates are optional and collapsed by default; compact printable previews prioritize description and total without sideways table overflow. Camera launcher copy now covers project photos and proof for RIVT and standalone work.
- The labeled one-year guest preview now carries mature sample state into Crew, Subs, invites, and profile completion without writing demo records into real account storage.
- Automated evidence passed: build, full lint, security lint, 53/53 unit tests, E2E, mobile-actions, Tools at desktop/mobile/SE widths, Work lifecycle, Shop Talk/Trade News, both guest-role previews, dependency audit with zero vulnerabilities, diff check, and all 19 PostgreSQL integration tests.
- Rendered evidence is stored outside the repository under `C:\Users\zboyt\AppData\Local\Temp\rivt-*-pass`.
- Production evidence: exact source `aaf3a8701b4dceb084bdaf007a04ea2bcba74385` is live with migration `0026_standalone_projects`, PostgreSQL, S3-compatible storage, Sentry, Web Push, and matching-job alerts configured. The synthetic monitor passed with controls off, seven anonymous private-route checks, and a 752 ms duration.
- Remaining boundary: physical iOS/Android review of the new Settings section navigation, Shop Talk feed/directory order, and return-user provider labels.

## Packet 15 - Standalone Tool Context (Production Verified)

- Added explicit Quick use, standalone-project, and accepted-RIVT-work context
  selection to Camera, Estimate, and Invoice. Opening a tool from the Tools hub
  no longer borrows the first loaded job or active-work record.
- Added account-owned standalone projects and context ownership columns for
  tool records and albums in migration `0026_standalone_projects`.
- Estimate and Invoice drafts are partitioned by context locally and can sync
  to the matching standalone project or exact RIVT workspace. A record cannot
  claim both contexts. A Quick-use draft carries into a newly selected context
  only when that destination has no existing draft, so attach-later never
  overwrites project work.
- Camera now presents only the selected destination: private albums for Quick
  use, one standalone project feed for off-platform work, or one accepted-job
  feed for RIVT work. Choosing context inside Camera stays on the capture home;
  only an exact workspace deep link auto-opens the project feed.
- Camera, Estimate, and Invoice use lower-screen action docks with 48px targets;
  top-of-screen duplicate Invoice actions were removed.
- Added `docs/product/FIELD_TOOL_INTERACTION_STANDARD.md` to preserve explicit
  context, one-handed placement, truthful save state, and narrow-device
  verification in future tools.
- Automated evidence: build, lint, security lint, 53/53 unit tests, E2E,
  mobile-action and Tools rendered QA, dependency audit, and the complete
  PostgreSQL run passed with 19/19 integration suites. Migration 0026 applies
  and rolls back cleanly.
- Production evidence: `master` serves exact source
  `1b38d144f83db07a305348e5e633256c666f55c2`; health reports ready migration
  `0026_standalone_projects`, PostgreSQL, S3-compatible object storage,
  configured Sentry, and configured Web Push. The production monitor passed
  with matching alerts enabled, controls off, seven anonymous private-route
  checks, and a 592 ms duration.
- Remaining field-proof boundary: switch among Quick use, one standalone
  project, and one accepted RIVT workspace on a physical phone, then capture a
  real photo and confirm it remains in the selected destination.

## Packet 14 - Field Camera (Local Verification)

- Rebuilt the live-job camera as a full-height, one-hand capture surface with
  a persistent exact-job label, in-camera capture types, large center shutter,
  recent-capture preview, and a functional front/back camera switch.
- Reduced the camera launcher to one active-job command surface: one primary
  `Open camera` action, one quiet project-feed handoff, recent job photos, and
  collapsed side-work albums. Duplicate camera/feed buttons, summary chips,
  and the repeated explanatory hero are removed.
- Moved capture type selection out of the home/gallery dashboard. Field
  photos are now categorized at capture time; the project feed keeps only
  filtering controls.
- Kept the existing participant-authorized project-media upload path intact.
  The capture surface names the destination while saving and only reports
  success after that upload resolves. A failed capture remains retryable
  without requiring the user to retake it.
- Local verification passed: build, lint, `test:ui:tools` at 1440x900,
  390x844, and 320x568, 53 unit tests, E2E, targeted
  `project-completion.integration.test.js`, dependency audit, and diff check.
  The rendered smoke covers exact job context, capture type, camera switch,
  failed-upload retry, saved confirmation, feed return, and no horizontal
  overflow. The aggregate `npm run test` exceeded its ten-minute wrapper
  without a failure or completion, so no aggregate-pass claim is made.
- Production evidence: `master` serves exact source
  `dc009c799b856b45f64fda90ee22b8ff853ef4e8`; health reports ready migration
  `0025_project_financial_records`, PostgreSQL, S3-compatible object storage,
  configured Sentry, and configured Web Push. The production monitor passed
  with matching alerts enabled, controls off, seven anonymous private-route
  checks, and a 569 ms duration. The launcher-subtraction follow-up now
  serves exact source `7b3d9be3fd25fb9dacf75baa506d09ff6e3f73a4`; its
  production monitor passed with the same health dependencies and a 582 ms
  duration.
- Remaining field-proof boundary: take a real camera photo into a legitimate
  active job on iOS Safari/PWA and Android Chrome.

## Packet 13 - Workflow Coherence (Production Verified)

- Reduced Home and Work accepted-work summaries to one clear `Open workspace`
  handoff. Messages, Photos, Daily log, money, and other job actions remain
  inside the exact job workspace rather than appearing three times before it.
- Renamed the in-workspace record transition to `Open project records` so its
  label matches the exact destination instead of implying a no-op workspace
  reload.
- Removed Tools launcher narration (`Pick up where you left off` and `Run the
  job`) while keeping the Recent and Core apps groups.
- Added `docs/delivery/WORKFLOW_ACTION_MATRIX.md` as the release checklist for
  primary-action label, destination, feedback, and next-step coherence.
- Settings notification controls remain above theme and subscription controls.
- Local verification passed: build, lint, security lint, 53 unit tests, E2E,
  Work lifecycle UI smoke, mobile actions UI smoke, dependency audit, and diff
  check. This packet is client/docs only; no migration or integration suite is
  required.
- Production evidence: `master` source `cab4c9e89f6422480a79c781a2e2aa7a41929377`
  is served by `https://rivt.pro/api/health`; the live monitor passed with
  PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push,
  enabled matching alerts, controls off, seven anonymous private-route checks,
  and a 606 ms duration.
- Remaining field-proof boundary: visually check the simplified Home -> Open
  workspace -> job-scoped Photos handoff on a physical phone.

## Packet 12 - Gate B Daily Use (Production Verified)

- Home now reads the authenticated participant's exact active-work project timeline and makes the daily state explicit: loading, unavailable, completion waiting, daily log saved today, or no daily log today.
- The daily-work action remains scoped to the same accepted-work id. It never substitutes a generic Records list or another open job.
- If a private project read is unavailable, Home stays usable and offers the exact workspace route rather than inventing a record state.
- Pro language now reflects enforced capability boundaries: extended time history and CSV exports are Pro; core work records and field tools remain available on the free plan.
- Added `docs/operations/GATE_B_CONTROLLED_ENGAGEMENT.md` for moderation, device-alert, matching-job, active-work-record recovery, and support escalation routines.
- Local verification passed: build, lint, security lint, 53/53 unit tests, E2E, active-work lifecycle UI smoke, mobile-action UI smoke, Shop Talk/Trade News UI smoke, dependency audit, and diff check. The aggregate `npm run test` ran for eleven minutes against sequential remote PostgreSQL suites without emitting a failure but exceeded the wrapper deadline, so no aggregate completion is claimed.
- Production evidence: `master` serves exact source `e44eb6a8e1b7d8c804880d1f956b3052f1596898`; `EXPECTED_SOURCE_COMMIT=e44eb6a8e1b7d8c804880d1f956b3052f1596898 npm run monitor:production` passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, matching alerts enabled, controls off, and seven anonymous private-route checks.
- Remaining field-proof boundary: confirm Home's daily pulse against a genuine active job where a participant saves a real daily log. The legitimate two-participant closeout walkthrough remains a separate operational proof.

## Packet 10 - Gate B Matching Job Alerts (Production Configured)

- Added a fail-closed `MATCHING_JOB_ALERTS_ENABLED` control and bounded `MATCHING_JOB_ALERT_LIMIT` fan-out (200 default, 500 hard maximum).
- Initial job publish now finds active tradespeople with the same selected trade and exact public city/region/country, excluding the poster, blocks, mismatches, and `new_jobs` opt-outs.
- Matching notifications use public title/location only and deep-link to the exact job. Private address and access notes never enter the recipient query, notification, metadata, or audit summary.
- Notifications and push outbox rows are inserted in bulk. Remote PostgreSQL publish time dropped from 64.7 seconds in the first per-recipient implementation to 3.6 seconds after the bulk correction.
- Settings now exposes a tradesperson-only `Matching jobs` control; the dormant `new_jobs` category is now real.
- Local verification passes: build, lint, security lint, 50/50 unit tests, E2E, mobile-action smoke, dependency audit, diff checks, and the complete PostgreSQL aggregate (`npm run test`) with 19/19 integration assertions. Isolated and aggregate coverage prove matching delivery, wrong-trade/wrong-city/block/opt-out exclusion, idempotent dedupe, existing push durability, and session revocation.
- Production evidence: Railway deployment `79bc9d5c-d20b-4c30-9b1a-955225d77876` serves exact source `43a1fa5eb9528a1fc06a0bea95da81122448c990`. Live health reports matching alerts enabled, a 200-recipient cap, and the exact public service-area rule. The production monitor passed with PostgreSQL, S3-compatible storage, Sentry, Web Push, controls off, and seven anonymous private-route probes.
- Pending boundary: perform one controlled legitimate production publish and physical exact-job tap. Do not create a fake live job solely to manufacture this evidence.

## Packet 11 - Active Work Continuity (Production Verified)

- Added migration `0025_project_financial_records` with server-owned private `project_invoices` and append-only `project_invoice_payments`. Records are scoped through the existing active-work participant authorization; invoice recipient contact data remains private project data.
- Work now offers an exact `Open workspace` action alongside Messages, Photos, Daily log, Estimate, and Invoice. The action preserves the active-work id and opens that job's project record instead of a generic Records list.
- Invoice drafts opened from active work can be saved to that same job, marked sent only after the participant uses their own delivery method, and given a participant-recorded external payment entry. The UI and report explicitly say RIVT does not collect, hold, verify, or protect job-payment funds.
- Project Records now exposes the job's invoice/payment summary in the same private timeline/proof packet, and closeout reports include the private financial record summary without exposing jobsite data publicly.
- Added an exact server review-context route and closeout review form: after contractor confirmation completes the work, either participant can leave one review for the other; it remains pending the reviewee's existing approval workflow.
- Targeted PostgreSQL evidence passed using the configured test database: `test/project-completion.integration.test.js` proved outsider rejection, participant invoice creation, author-only state changes, partial/final payment records, overage rejection, closeout-report persistence, and review eligibility. `test/migrations.integration.test.js` passed migration 25 apply/rollback lifecycle.
- Local verification passed: build, lint, security lint, 52/52 unit tests, E2E, Work lifecycle UI smoke, Tools UI smoke, dependency audit, and diff check. The aggregate `npm run test` ran for ten minutes against sequential remote PostgreSQL suites without emitting a failure but exceeded the wrapper deadline, so no aggregate completion is claimed.
- Production evidence: `master` serves exact source `4e0d079101fd065d7eb5b7bb7a7ee2d6bea8132b`; Railway applied migration `0025_project_financial_records`; and `EXPECTED_SOURCE_COMMIT=4e0d079101fd065d7eb5b7bb7a7ee2d6bea8132b npm run monitor:production` passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, matching alerts enabled, controls off, and seven anonymous private-route checks.
- Remaining operational proof: perform one legitimate participant acceptance -> exact workspace -> invoice -> external-payment-record -> closeout-review walkthrough. Do not create fake production work merely to manufacture this evidence.
- Matching-alert field proof remains a separate legitimate-job operational boundary.

## Packet 09 - Gate B Web Push (Production Verified)

- Added PostgreSQL-owned browser subscriptions and a durable delivery outbox in migrations 0023/0024.
- Bound every subscription to an active login session; logout, single-device revocation, and revoke-other-devices remove the corresponding delivery endpoints.
- Existing server notification creation now queues Web Push transactionally while retaining the notification bell as the source of truth.
- Added a bounded outbox worker with stale-claim recovery, exponential retry, terminal failure state, dead-subscription pruning, retention cleanup, and redacted failure logs.
- Added explicit Settings controls. RIVT never asks for notification permission on page load; the user must tap `Enable device alerts`.
- Notification clicks accept only same-origin RIVT destinations and reuse existing exact-object routing.
- Local evidence so far: build, full lint, unit tests (49/49), E2E, mobile action smoke, dependency audit, and diff checks pass. The aggregate PostgreSQL run completed 17/19 suites; its migration fixture and an accepted-work mapper assertion failed, were corrected, and both affected suites then passed individually. The dedicated push subscription/outbox/session-revocation suite passed in 17.2 seconds.
- Production evidence: Railway deployment `1af25317-a227-4e7a-ad8f-abdffcaeaa9f` succeeded; live health served exact source `535e21bf1c2b76c7547b9c5ac5dc9ef54b8d5b79`, migration `0024_push_subscription_sessions`, and configured Web Push without exposing keys. The production monitor passed with PostgreSQL, S3-compatible storage, Sentry, Web Push, controls off, and seven anonymous private-route probes.
- Physical evidence: on 2026-07-10, the founder enabled device alerts on a physical phone, received the RIVT test alert in the phone notification tray while outside the app, tapped it, and returned to RIVT. The first alert exposed a white-square Android status icon; the follow-up replaces the full-background badge with an approved-mark-derived monochrome transparent badge. Session-bound deletion and post-revocation delivery exclusion remain integration-proven.

## Latest Packet 08 Pass - Notification Delivery Truthfulness

- Removed the browser-local push subscription flag and automatic notification-permission prompt. Neither represented server-backed background delivery.
- Reframed Settings around the notification system that is actually live:
  - Messages, Work updates, and Community/account notices now save as `in_app` preferences.
  - Those preferences are enforced by the existing server notification insert path and control the notification bell.
  - Settings explicitly states that background device alerts are not connected yet.
- Verified production provider configuration without printing secret values:
  - Resend API key and sender are configured in Railway.
  - Twilio account/auth/sender variables are not configured in Railway.
  - VAPID public/private/client keys are not configured, and no server push subscription path exists.
- Preserved the Gate A boundary: no VAPID dependency, push-subscription schema, SMS expansion, job-alert fan-out, or email digest was added. Twilio remains limited in source to explicit invoice SMS delivery when configured.
- Local verification: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit` (46/46), `npm run test:e2e`, `npm run test:ui:mobile-actions`, `npm audit --omit=dev`, and `git diff --check` pass. The mobile smoke asserts the truthful boundary copy and rejects a reintroduced `Enable notifications` control. The aggregate `npm run test` entered the integration phase and stalled without output; this checkout has no `TEST_DATABASE_URL`, and this frontend-only pass changes no server route, schema, or authorization behavior.
- Deployment evidence: `codex/notification-truthfulness` was fast-forwarded into `master`; production served exact source `ecbd470ba9fc126eea685121030ad00f5b3b4ad0`; and the production monitor passed with PostgreSQL, S3-compatible storage, configured Sentry, controls disabled, and seven anonymous private-route checks.

## Latest Packet 08 Pass - Job-Scoped Tool Context

- Removed the remaining active-work ambiguity from job-aware tools:
  - a tool opened from accepted work waits for its exact active-work record instead of borrowing the first job in the Work list
  - Estimate, Invoice, Daily Log, Materials, Time, Expenses, Bid Builder, Mileage, and Safety remount only when their active-work context changes, so their initial values cannot remain attached to a prior job
  - compact tool headers now show the current job name without adding a separate dashboard panel
- Made active-work data sufficient for tool initialization even when an accepted job is no longer part of the open-work list:
  - active-work responses now include the job trade, duration, budget, and location summary
  - the client uses that exact summary as the tool context instead of a generic or unrelated fallback
- Made Daily Log drafts job-specific:
  - active-work drafts use distinct browser and server record keys per accepted-work relationship
  - a Daily Log opened from a job saves its timeline note to that same job
  - existing unscoped drafts remain readable only for standalone Daily Log use; they are not silently assigned to an accepted job
- Local verification:
  - `npm run build`, `npm run lint`, `npm run test:unit` (46/46), `npm run test:e2e`, `npm run test:ui:work-lifecycle`, `npm audit --omit=dev`, and `git diff --check` passed
  - the lifecycle smoke now places an unrelated job first, opens Invoice and Daily Log through an active-work URL, and proves both retain the accepted job context with no horizontal overflow
- Scope boundary: server-backed background push, matching-job fan-out, and email digests remain deliberate Gate B/provider work. This pass makes the existing in-app and active-work tool flows exact without claiming background delivery.
- Deployment boundary: pending merge to `master`, Railway deployment, exact `/api/health` source proof, and production monitor.

## Latest Packet 08 Pass - Exact Notification Destinations and Active Work

- Replaced generic notification destinations with exact object routes:
  - applications, shortlist/decline decisions, offers, unsafe-work reports, cancellations, and reschedule requests carry the exact job and active-work identifiers
  - project completion events carry the exact accepted-work project and open its Records detail
  - review notifications carry the exact review identifier
  - messages, Shop Talk posts/communities, and existing active-work notifications preserve their exact conversation or community object through cold starts and browser history
- Hardened direct and history-based navigation:
  - `/app/work`, `/app/inbox`, `/app/tools/records`, `/app/profile/reviews`, and Shop Talk routes hydrate their query intent after authenticated data loads
  - legacy authenticated aliases now resolve to their real destination instead of silently falling back to Home
- Tightened the accepted-work workspace:
  - workspace, Messages, Photos/Records, and Daily Log actions preserve the accepted-work identifier
  - Records now auto-opens the intended project instead of cancelling its own request after state changes
  - activity labels distinguish projects, closeout, reviews, jobs, and tools instead of presenting every job-linked event as generic Work
- Added server notifications for the previously silent application loop:
  - contractors are notified when someone applies
  - applicants are notified when shortlisted or declined
  - all actions deep-link to the exact application and job
- Local verification:
  - `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit` (46/46), `npm run test:e2e`, `npm run test:ui:work-lifecycle`, `npm audit --omit=dev`, and `git diff --check` passed
  - affected PostgreSQL integration suites passed individually: `match-acceptance`, `project-completion`, and `reviews-admin-safety`
  - aggregate `npm run test` exceeded the local wrapper window while running the same slow database suites, so no aggregate completion is claimed
- Deployment evidence:
  - `codex/exact-notification-destinations` was fast-forwarded into `master` and pushed to GitHub
  - Railway served exact source `e0b4fb518018989fcf8a433af5c528ff52fe7cba` with ready migration `0022_community_audiences`, PostgreSQL, S3-compatible storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=e0b4fb518018989fcf8a433af5c528ff52fe7cba npm run monitor:production` passed with seven anonymous authorization probes in 589 ms
  - a non-destructive authenticated production probe logged in as the shared test account and read notifications/active work successfully; that account had zero current notifications and zero active work, so no production click-through event is claimed
  - the synthetic production match smoke could not run because this deployment worktree does not contain `DATABASE_URL`; creating a fresh production notification and tapping it on a physical device remains the final manual acceptance boundary for this slice

## Latest Packet 08 Pass - Field Reliability Train

- Added bounded client request behavior across every frontend fetch path:
  - ordinary API reads/writes fail after 15 seconds instead of spinning indefinitely
  - media uploads get a field-practical 60-second window before failing visibly
  - network and timeout failures use one consistent connection message
  - HTTP 429 responses use a human rate-limit message and honor `Retry-After` when available
- Corrected authentication boot semantics:
  - only a real 401 clears the current account/session state
  - network and 5xx failures render a dedicated `RIVT is having trouble connecting` recovery screen with Retry instead of presenting sign-in as though the account disappeared
- Made photo capture failure recoverable:
  - album and job-photo batches continue after an individual file fails
  - failed files remain in memory and can be retried without selecting or shooting them again
  - the camera overlay keeps the captured blob and exposes `Retry upload`; a rendered smoke deliberately rejects the first upload, retries the same photo, and verifies it appears in the job timeline
- Removed two false reliability signals:
  - the offline banner now says changes cannot be saved while offline because no background sync queue exists
  - a newly activated service worker no longer reloads a visible form; it shows a user-controlled refresh notice and derives its cache namespace from the built app-module hash
- Improved public link quality without changing product scope:
  - added an approved-logo 1200x630 social image, absolute Open Graph/Twitter metadata, `og:url`, `robots.txt`, and `sitemap.xml`
  - authenticated routes now update the document title (`Work - RIVT`, `Shop Talk - RIVT`, and so on)
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 46/46)
  - `npm run test:e2e` (pass; includes human 429 copy)
  - `npm run test:ui:guest-preview` (pass; includes boot-time 5xx recovery and 401 retry path)
  - `npm run test:ui:tools` (pass; includes failed camera-upload retry with the original capture)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF conversion warnings only)
  - `npm run test:integration` and a targeted `test/project-completion.integration.test.js` were attempted with configured `TEST_DATABASE_URL`; both stalled without test output against the remote database and were terminated. No server route, migration, or database behavior changed in this pass, so no new DB-backed integration result is claimed.
- Deployment evidence:
  - `codex/field-reliability-train` was fast-forwarded into `master` and pushed to GitHub
  - Railway served exact source `504e1db2e5b6fc9db23883ed17a3cb7444a3a66e`
  - `EXPECTED_SOURCE_COMMIT=504e1db2e5b6fc9db23883ed17a3cb7444a3a66e npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, controls off, seven anonymous private-route checks, and 552 ms duration
  - the public social image, `robots.txt`, and sitemap returned HTTP 200, and the production HTML exposed the expected absolute Open Graph image and URL

## Latest Packet 08 Pass - Desktop Workspaces

- Reworked the principal desktop surfaces without changing the five primary destinations:
  - Home now uses its wide workspace deliberately: active work and continuation tasks stay in the left work lane, while answering activity and communities occupy the right lane.
  - Tools now has a dense three-column core-app launcher, optional recent-tools recovery row, and compact grouped utility launchers rather than a stretched mobile card stack.
  - Crew now holds the roster beside a sticky invite-planning surface; the invite form opens on demand instead of consuming the page before an invite is being planned.
  - Shop Talk now separates community discovery, the feed, and the selected thread on wide screens. A thread panel is absent until a post is deliberately selected, so the feed is the initial work surface.
- Rendered desktop preview checks at 1440px found no document-wide horizontal overflow. The Shop Talk workspace resolved to a two-column discovery/feed grid until a thread selection adds the third panel; the Crew workbench resolved to distinct roster and planner columns.
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:ui:guest-preview` (pass)
  - `npm run test:ui:shop-talk-news` (pass)
  - `npm run test:e2e` (pass)
  - `npm run lint:security` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test:unit` ran as part of `npm run test` and passed (46/46)
  - full `npm run test` reached the integration phase but the configured remote PostgreSQL reset connections during setup (`ECONNRESET` / `Connection terminated unexpectedly`); this pass changes no server routes, migrations, or database behavior, so no integration pass is claimed
- Live deployment: `codex/desktop-workspace-pass` fast-forwarded to `master`; Railway deployment `73eadb90-aa92-4b79-9f99-2aa03d68abe2` succeeded. Live `/api/health` reports exact source `be6a6d211eae8bef81c40d55e2054bf49e3148b9`, ready migration `0022_community_audiences`, PostgreSQL, S3-compatible storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=be6a6d211eae8bef81c40d55e2054bf49e3148b9 npm run monitor:production` passed with seven anonymous private-route checks in 445 ms.

## Latest Packet 08 Pass - Preview Phone Recovery

- Hardened the anonymous preview app-shell path after a physical-phone black-screen report:
  - added a static boot/recovery layer that stays visible until React reports a successful first render
  - added a root React error boundary with a clear `Refresh RIVT` action instead of allowing a render failure to become a blank page
  - recovery clears only stale service-worker/cache shell files and reloads the app; it does not clear account, record, or job data
  - upgraded the service worker to network-only navigation and asset-only caching so an old cached `index.html` cannot point at deleted build assets
  - an installed client with an older service-worker controller reloads once when the new v5 shell takes over
- Expanded `test:ui:guest-preview`:
  - contractor/subcontractor demo paths must hide the boot layer and set an explicit app-ready state
  - a deliberately blocked app module must display the recovery action and stale-shell explanation instead of a black screen
- Local verification on `codex/preview-phone-recovery`:
  - `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit` (46/46), `npm run test:e2e`, `npm run test:ui:guest-preview`, `npm audit --omit=dev`, and `git diff --check` passed
  - fresh production-style Chromium and WebKit runs both opened contractor and subcontractor previews successfully before this recovery hardening
  - `npm run test:integration` was attempted twice but the configured remote test PostgreSQL ended connections during test setup (`ECONNRESET` / `Connection terminated unexpectedly`); no server code or migration changed in this pass
- Deployment boundary: pending merge/deploy and exact live preview verification on production.

## Latest Packet 08 Pass - Mature Guest Demo and Nationwide Readiness Boundary

- Rebuilt the explicit guest preview around outcomes instead of a thin feature carousel:
  - contractor and subcontractor paths now open clearly labeled one-year sample accounts
  - the entry preview shows completed jobs, work value, job-record count, repeat relationships, and role-specific value before entering the app
  - the in-app preview keeps active work, messages, communities, Shop Talk, notifications, records, completed history, and reputation cues connected
  - role switching remains available inside the sample workspace without changing a real account role
- Fixed a real preview lifecycle bug:
  - authenticated background loaders no longer clear guest active work or guest conversation messages while someone is exploring the demo
  - the compact mobile smoke now opens Messages, verifies the demo job thread, returns Home, and proves the mature account survives navigation
- Tightened preview trust:
  - all fictional activity remains isolated to explicit guest-preview state and labeled sample/demo content
  - the old recycled seed-company name was removed from the demo story
  - auth surfaces now link directly to factual Security, Privacy, and Terms pages
  - guest preview reaction state does not call authenticated server reaction paths
- Added `docs/product/NATIONWIDE_FINAL_LAUNCH_AUDIT_2026-07-09.md`.
  - verdict: the current core can support controlled Jacksonville launch work, but it is **not** a responsible nationwide-final launch yet
  - nationwide P0 boundaries are geospatial discovery, durable server ownership for business records, malware scanning/quarantine, complete legal/data-rights flows, reliable notification delivery, and nationwide moderation/support/on-call capacity
  - the audit defines twelve measurable acceptance gates and a five-train build order
- Local verification on `codex/nationwide-launch-hardening`:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 46/46)
  - `npm run test:integration` (pass; 18/18 against configured PostgreSQL)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:guest-preview` (pass; contractor/subcontractor at 320x568 with reduced motion)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm run test:ui:work-lifecycle` (pass)
  - `npm run test:ui:tools` (pass)
  - `npm run test:ui:shop-talk-news` (pass)
  - `npm run launch:readiness -- --require-ready` (pass for the existing Gate A policy)
  - `npm run incident:readiness -- --require-ready` (pass for the existing Gate A policy)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF warnings only)
- Deployment boundary:
  - `codex/nationwide-launch-hardening` was fast-forwarded into `master`, and Railway production served exact feature commit `39886b12495c4134b09bbb32b6c7d13058f00122`
  - live `/api/health` reported PostgreSQL, S3-compatible object storage, configured Sentry, and migration `0022_community_audiences`; `EXPECTED_SOURCE_COMMIT=39886b12495c4134b09bbb32b6c7d13058f00122 npm run monitor:production` passed with operational controls off and seven anonymous private-route checks
  - production browser QA opened the contractor one-year sample workspace and verified its metrics, active-work context, and connected demo navigation
  - the Gate A readiness scripts remain pilot-scoped and must not be presented as nationwide-readiness certification

## Latest Packet 08 Pass - Public Security and Disclosure Page

- Added a public `/legal/security.html` page and `/.well-known/security.txt` so beta users, Reddit reviewers, and security-minded contractors have a plain responsible-disclosure path instead of a fake security badge.
- The page states current safeguards honestly:
  - HTTPS production traffic
  - hashed passwords
  - protected server-issued cookies
  - authenticated private API routes
  - private jobsite address handling
  - managed cloud object storage for uploads
  - Stripe-hosted subscription billing with no full-card storage by RIVT
  - production monitoring of health, storage dependencies, and private-route protections
- The page explicitly avoids overclaiming:
  - no SOC 2 certification
  - no RIVT PCI certification
  - no government accreditation
  - no background-check verification claim
  - no completed third-party penetration-test claim
- Linked the Security page from the public landing footer and the authenticated Profile > Trust & Legal document list.
- Added an explicit `/.well-known/security.txt` server route because Express static serving otherwise falls through dot-directory paths to the SPA shell.
- Contact remains `support@rivt.pro` with subject `Security report`; a separate `security@rivt.pro` mailbox/alias has not been confirmed configured.
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 46/46)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF warnings only)
  - full `npm run test` was attempted but timed out after 304 seconds; `TEST_DATABASE_URL` was not set in this shell, so no full DB-backed integration evidence is claimed for this static security/disclosure slice
- Live verification:
  - branch `codex/auth-onboarding-redesign` was pushed and fast-forwarded to `master`
  - production `/api/health` reported exact build commit `159bdac16009a81b5e0e00f286515f0cf2c32404`
  - `EXPECTED_SOURCE_COMMIT=159bdac16009a81b5e0e00f286515f0cf2c32404 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 619 ms duration
  - `https://rivt.pro/legal/security.html` returned HTTP 200 with title `RIVT Security`
  - `https://rivt.pro/.well-known/security.txt` returned HTTP 200 as `text/plain; charset=utf-8` and included the `support@rivt.pro` security-report contact

## Latest Packet 08 Pass - Configuration-Gated Apple Sign-In

- Added Apple sign-in support alongside the existing Google OAuth path without creating a second auth system:
  - `/api/auth/providers` already reported Apple setup state; the auth screen now renders Apple only when that provider is fully configured, so no dead Apple promise appears before credentials exist
  - `/api/auth/apple/start` creates a state/nonce transaction and redirects to Apple's OIDC authorization endpoint
  - `/api/auth/apple/callback` handles Apple's `form_post` callback, exchanges the code, verifies the Apple `id_token` through Apple's JWKS, and rotates the RIVT session like email/Google auth
  - Apple and Google now share the same server-owned account-linking rules: match provider subject first, then verified email, otherwise create a pending-onboarding account only when a verified email is available
  - Apple OAuth state uses a dedicated `SameSite=None; Secure` state cookie so Apple's cross-site POST callback can still pass CSRF/state validation in production
  - deployment docs and `.env.example` now document the Apple Services ID, Team ID, Key ID, private key, and redirect URI required before the button appears
- Preserved launch boundaries:
  - no Apple credentials, provider secrets, auth bypass, local auth fallback, role override, billing behavior, production data migration, or fake provider success was added
  - Apple remains hidden until Railway has `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY`
  - existing email and Google paths remain fail-closed and still rotate sessions
- Local verification:
  - `node --test test/auth.test.js` (pass; added Apple authorization URL coverage)
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 46/46)
  - `npm run test:e2e` (pass)
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/auth-lifecycle.integration.test.js` (pass)
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/server.integration.test.js` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - full `npm run test` was attempted but timed out after 604 seconds during the broader DB-backed integration run; the targeted auth lifecycle and server integration evidence above is newly green for this auth-provider slice
- Live verification:
  - branch `codex/auth-onboarding-redesign` was pushed and fast-forwarded to `master`
  - production `/api/health` reported exact build commit `4cc911107926232f72d184c39f358e4bea0b21fa`
  - `EXPECTED_SOURCE_COMMIT=4cc911107926232f72d184c39f358e4bea0b21fa npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, seven anonymous private-route checks, and 568 ms duration
  - Apple end-to-end login cannot be live-smoked until the Apple Developer Services ID/key are configured in Railway

## Latest Packet 08 Pass - Guest Preview Black-Screen Hardening

- Hardened the anonymous `Browse RIVT preview` path after a phone report that both Contractor and Subcontractor preview could land on a black screen:
  - preview setup now fails visibly instead of leaving the user on a blank route if demo workspace creation throws on-device
  - the route error boundary now renders a full recovery panel with `Reload RIVT` and `Back to sign in` actions instead of a small inline paragraph that could disappear into a dark/blank state
  - the auth gate now surfaces preview/login errors on the auth form instead of staying on the intro/preview carousel after a failed action
  - the service worker cache was bumped and tightened so app-shell assets refresh cleanly, API responses are never cached by the service worker, and navigations fall back to `index.html` only when the network fails
  - added `npm run test:ui:guest-preview` to exercise Contractor and Subcontractor guest preview at a 320px mobile viewport with mocked anonymous APIs
- Preserved launch boundaries:
  - no production data, auth fallback, billing behavior, provider config, or server mutation path changed
  - guest preview remains explicitly labeled demo/sample content and still clears when exiting preview or moving to signup
  - route recovery only offers reload/sign-in recovery; it does not bypass server authorization
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:guest-preview` (pass; Contractor and Subcontractor at 320px, screenshots in `C:\Users\zboyt\AppData\Local\Temp\rivt-guest-preview-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF warnings only)
  - full `npm run test` and `npm run test:integration` did not complete before local command timeouts against the remote test DB; `test/shop-talk-moderation.integration.test.js` was then run by itself and passed, confirming the previously stuck integration file was not failing this patch
- Rendered QA:
  - local Playwright/Chrome fallback verified the preview flow opens the real app shell instead of a black page for both role choices
  - in-app Browser tooling was unavailable in this session, so Playwright/Chrome screenshots were used
- Live verification:
  - branch `codex/auth-onboarding-redesign` was pushed and fast-forwarded to `master`
  - production `/api/health` reported exact build commit `7f6aed13a046da80c5adc45270a02cbdcd75dcdb`
  - `EXPECTED_SOURCE_COMMIT=7f6aed13a046da80c5adc45270a02cbdcd75dcdb npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 613 ms duration

## Latest Packet 08 Pass - Guest Preview Demo Workspace

- Rebuilt `Browse RIVT preview` into a labeled demo workspace instead of an empty guest shell:
  - preview setup now lets visitors choose Contractor or Subcontractor plus trade and area before entering the app
  - preview mode seeds demo-only jobs, active work, Shop Talk posts, communities, an unread message, a notification, records, and a shout-out so visitors can see the intended mature product loop without needing real production density
  - the guest banner now explicitly says this is a demo preview with sample jobs, posts, messages, and records
  - exiting preview or moving to signup clears the demo workspace surfaces so sample data does not bleed into authenticated state
  - Home copy now pluralizes the answer-queue nudge correctly for one question versus multiple questions
- Preserved launch boundaries:
  - no seed/demo data was inserted into production tables
  - no authenticated workflow, authorization boundary, billing behavior, storage provider, or server mutation path was changed
  - demo content is generated client-side only for explicit guest preview mode and is labeled as sample/demo content
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - full `npm run test` and DB-backed `npm run test:integration` were not claimed because `TEST_DATABASE_URL` was not configured in this shell
- Rendered QA:
  - local Chrome connector smoke opened the preview flow, selected the preview path, and verified the demo banner, demo account, demo job, and demo Shop Talk post rendered in the authenticated app shell
  - in-app Browser tooling was unavailable in this session and Playwright browser binaries were not installed, so Chrome connector evidence was used instead
- Live verification:
  - branch `codex/auth-onboarding-redesign` was merged to `master`
  - production `/api/health` reported exact build commit `2ae4627674c71a2d28b8ba0ea24915d3fdce9744`
  - `EXPECTED_SOURCE_COMMIT=2ae4627674c71a2d28b8ba0ea24915d3fdce9744 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 636 ms duration

## Latest Packet 08 Pass - Railway Live Smoke Environment Automation

- Removed the recurring local DB URL scavenger hunt without committing or printing secrets:
  - added `npm run with:railway-public-db -- <command>` to resolve Railway's Postgres `DATABASE_PUBLIC_URL` at runtime and inject it into the child command as `DATABASE_URL`
  - documented why Railway app `DATABASE_URL` is an internal-only host while Postgres `DATABASE_PUBLIC_URL` is the correct local live-smoke URL
  - added opt-in `RIVT_RAILWAY_INCLUDE_STORAGE=true` support for project/media smokes so the child process can clean up temporary S3 objects after upload verification
  - copied the ignored local `.env` into existing worktrees so `TEST_DATABASE_URL` is available there without committing the secret
- Preserved launch boundaries:
  - no database URL, storage credential, or Railway secret was committed or printed
  - the helper only injects secrets into the child process environment and exits with the child command
  - no app behavior, auth boundary, billing path, provider configuration, or production data migration was changed
- Local verification:
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/project-completion.integration.test.js` (pass)
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/tool-records.integration.test.js` (pass)
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/network-records.integration.test.js` (pass)
  - `npm run lint:security` (pass)
- Live verification:
  - `npm run with:railway-public-db -- npm run monitor:production` (pass; production commit `6b4f49db82a17a90da0377aad842e73285a17bcd`)
  - `RIVT_RAILWAY_INCLUDE_STORAGE=true npm run with:railway-public-db -- npm run smoke:projects:live` (pass; production project/media smoke verified uploads, signed URLs, authorization, completion/dispute flow, and storage cleanup path)

## Latest Packet 08 Pass - Project Feed Camera Upload Truthfulness

- Fixed the active-job camera/project-feed seam after a live report that the app celebrated a successful upload but showed no photo anywhere after backing out:
  - project bundle reads now attach signed object URLs to stored project media instead of returning only raw `project_media` rows
  - the camera/project-feed client now immediately merges uploaded media + entry records into the open project state before the follow-up refresh, so a successful snap shows up in the live feed right away
  - the follow-up `getProject()` refresh remains in place, but it no longer strips the photo back out because the server bundle now returns renderable media objects
- Preserved launch boundaries:
  - no fake local success state, auth fallback, provider change, billing change, or production data migration was added
  - uploads still go through the existing authenticated `/api/v1/projects/:id/media` contract
  - media authorization remains server-side and signed URLs are only generated for stored uploads already visible to a project participant
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` still timed out in this workstation shell after 364 seconds without yielding a useful integration failure or completion signal; no new DB-backed integration evidence is claimed for this pass
- Live verification:
  - not deployed in this pass

## Latest Packet 08 Pass - Shared Device + Return Loop Hardening

- Tightened three launch-quality gaps that were easy to miss in day-to-day phone use:
  - shared-device logout/session-revocation now clears the saved auth-mode session preference alongside `rivt.*` local state, so a borrowed phone or shared browser does not keep nudging the next user into the last account's sign-in mode
  - session-revocation and logout now clear signed-in-only in-memory surfaces too: jobs, selected job, inbox conversations/messages/notifications, active-work focus, uploaded-record state, storage usage, shout-outs, and one-shot Shop Talk intents
  - session-revocation now fails closed with a plain notice on the auth gate: `This session ended on this device. Sign in again to keep going.`
  - the account panel now has a compact `This device` section that says who is signed in here and reminds the user to sign out before handing the phone or browser to someone else
  - Home now adds a real `Pick up where you left off` section instead of more generic dashboard narration
  - that return-loop section surfaces unread messages, recent tools used on this phone, and honest device-state messaging when the app is offline or local tool workspaces still live on the device
- Preserved launch boundaries:
  - no auth fallback, fake sync state, billing behavior, provider configuration, new server contract, or production-data mutation was added
  - the new Home cues are derived from real inbox counts, actual recent-tool history, `navigator.onLine`, and existing local tool state keys
  - session authorization remains server-side; this pass only improves what the client forgets and how honestly it explains device state
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:mobile-actions` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` still timed out in this workstation shell because `npm run test:integration` did not return before the shell timeout; no new DB-backed integration evidence is claimed for this small UI/client-state slice
- Live verification:
  - not deployed in this pass

## Latest Packet 08 Pass - Active Work Workspace Deep-Link QA

- Tightened the accepted-offer lifecycle after live phone testing exposed a mushy handoff between notifications, closed job cards, and the real active-work record:
  - accepted offers now merge the returned canonical active-work record into app state immediately instead of waiting for a later reload to reveal it
  - Home active-work cards now clearly say `You're active now` and group the post-acceptance workspace actions: `Open workspace`, `Messages`, `Photos`, and `Daily log`
  - Work now keeps track of a focused active-work relationship, so offer-accepted notifications and active-work notifications can land on the correct accepted job even after the public listing closes
  - offer-accepted notifications whose canonical destination is messages now open the exact active-work conversation instead of stopping on the generic Work tab
  - contractor-side `Open active work` now switches the Work section to `Closed` when needed before selecting the accepted job, preventing the detail pane from silently falling back to another open listing
  - active-work notification labels now distinguish `Open message` from `Open active work`, so the tap target says where it goes
  - project/photo/media notifications tied to active work now land on `Records`, which is the user-facing destination for the photos/logs proof path
  - Records/photos and Daily log now receive the focused active-work id, so opening either tool from Home, Work, or a notification puts the accepted job first instead of making the user hunt for it
  - the Work detail active-job area now treats `Messages`, `Photos`, and `Daily log` as the primary workspace trio, with invoice/reschedule/cancel kept as secondary lifecycle actions
- Preserved launch boundaries:
  - no new authorization path, fake active-work state, local auth fallback, billing behavior, provider config, or production data mutation was added
  - the accepted-work transition still depends on the existing server-owned offer acceptance, active-work, and inbox conversation endpoints
  - notification clicks remain navigation only; server authorization still owns access to jobs, records, and messages
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:work-lifecycle` (pass; now asserts offer-accepted notification opens the exact active-work conversation; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF warnings only)
  - full `npm run test` timed out in this local shell after 304 seconds without producing useful failure output; targeted unit/e2e/work-lifecycle evidence above is newly green for this slice
- Live verification:
  - production `/api/health` reported exact build commit `059b8f45b6361b0cd2ae67a99b928fe9aa06ba30`
  - `EXPECTED_SOURCE_COMMIT=059b8f45b6361b0cd2ae67a99b928fe9aa06ba30 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 570 ms duration

## Latest Packet 08 Pass - Notification and Community Tightening

- Tightened a small set of launch-facing loose ends without widening scope:
  - notification activity labels now name their destination for Shop Talk posts/communities, work/job updates, support, reviews, profile/account events, messages, and records instead of falling back to a generic `Open` label for common non-work paths
  - Shop Talk community pages no longer repeat the audience label twice in the stat row; unjoined communities now clearly read `Not joined`
  - public landing footer legal links now route to the real Privacy and Terms pages
  - Jacksonville launch script vocabulary now consistently says `Shop Talk`
- Preserved launch boundaries:
  - no fake notification state, local-only success path, auth fallback, billing behavior, provider config, database migration, or production data mutation was added
  - notification routing still uses existing authenticated notification metadata/action URLs and server authorization remains the access boundary
  - community membership display continues to hydrate from server-owned community rows when available
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:mobile-actions` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF warnings only)
  - `npm run test` and `npm run test:integration` did not complete in this local shell before command timeouts; `TEST_DATABASE_URL` and `DATABASE_URL` are not configured in this shell, so DB-backed integration evidence is not newly claimed for this small tightening slice
- Live verification:
  - production `/api/health` reported exact build commit `15b11eaacf3c742203b0c4d5d186cf9041d7d77c`
  - `EXPECTED_SOURCE_COMMIT=15b11eaacf3c742203b0c4d5d186cf9041d7d77c npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 587 ms duration

## Latest Packet 08 Pass - Interactable Notifications + Active Work Landing

- Tightened the accepted-offer handoff after mobile testing showed notification rows were visible but not directly useful:
  - notification/activity rows that can open a destination now render as real tappable controls with visible `Open work`, `Open message`, or `Open records` labels
  - activity rows preserve keyboard focus states and accessible labels instead of relying on card-looking static markup
  - offer and active-work notifications now resolve `activeWorkId` from either notification metadata or the canonical notification source id
  - opening an offer/active-work notification marks it read, closes the panel, refreshes jobs and active work, navigates to Work, and selects the related job when the listing is still available
  - Work now shows an `Active work ready` landing strip whenever a canonical active-work relationship exists, even if the public job listing is closed or filtered out
  - the landing strip explains the transition plainly: the accepted offer closes the public listing, and the job now lives as a private active-work record with logs, records/photos, and invoices
- Preserved launch boundaries:
  - no fake active-work state, local auth fallback, new provider, billing behavior, or production-data migration was added
  - active-work visibility still comes from the existing authenticated active-work endpoint
  - notification routing remains navigation only; server authorization still owns access
- Live verification:
  - production `/api/health` reported exact build commit `9b715a288dd03e62fab19f257f8f2095ad23e88f`
  - `EXPECTED_SOURCE_COMMIT=9b715a288dd03e62fab19f257f8f2095ad23e88f npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 623 ms duration
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test -- --runInBand` (pass for unit tests; DB-backed integration cases skipped because `TEST_DATABASE_URL` is not configured locally)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:mobile-actions` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `node scripts/work-lifecycle-ui-smoke.mjs` (pass; includes a mobile notification click-path that opens Work and reveals the `Active work ready` region)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)

## Latest Packet 08 Pass - Active Job Camera Upload Handoff

- Fixed the active-job camera handoff after mobile testing showed tradespeople could snap a photo and see no obvious upload result:
  - camera captures now upload the captured `Blob` as a direct `File[]` instead of relying on `DataTransfer` to synthesize a `FileList`, which is brittle on iOS Safari
  - the camera overlay now shows `Saving`, `Saved`, and `Failed` status feedback so users know whether a photo landed on the live job record
  - active-job and side-album upload handlers now throw upload failures back to the camera after setting the visible error state, preventing silent failures
  - the saved confirmation explicitly says the photo was saved to the job's project feed
- Preserved launch boundaries:
  - no new storage provider, fake local success state, auth fallback, billing behavior, or production-data migration was added
  - photos still go through the existing authenticated project-media and album upload endpoints
  - upload authorization remains server-side
- Live verification:
  - production `/api/health` reported exact build commit `dbdcdaea65483ba872d48a33d294075b8fcec6be`
  - `EXPECTED_SOURCE_COMMIT=dbdcdaea65483ba872d48a33d294075b8fcec6be npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 484 ms duration
- Local verification:
  - `npm run test:ui:tools` (pass; exercised fake camera stream -> shutter -> mocked project-media upload -> saved status -> job feed row at desktop, 390px mobile, and 320px SE)
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:integration` (pass for non-DB checks; 15 DB-backed cases skipped because `TEST_DATABASE_URL` is not configured locally)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)

## Latest Packet 08 Pass - Active Work Notification Handoff

- Fixed the accepted-offer experience after mobile testing showed notification cards were inert and accepted work was hard to discover:
  - notification rows in the Inbox notification center are now tappable controls
  - opening offer, active-work, or work-linked notifications marks the notification read and navigates to Work instead of leaving the user in the notification panel
  - the app now fetches canonical active-work relationships separately from open job listings
  - Home shows an `Active work` card when an accepted offer exists, explaining that the original posting is closed to new applicants and that the job now lives as active work
  - Work refreshes active-work state after offer acceptance, reschedule requests, and cancellation requests
  - active-work cards include explicit copy explaining why the public job posting may read closed while the relationship is active
- Preserved launch boundaries:
  - no new fake active-work state, local auth fallback, billing behavior, provider config, invite behavior, or production-data migration was added
  - active-work visibility remains backed by the existing canonical server active-work endpoint
  - notification routing uses existing metadata/action fields and does not grant authorization by hiding or showing UI
- Live verification:
  - production `/api/health` reported exact build commit `d9b3a9866d4e8cfabd04c16f3d79c176331902cd`
  - `EXPECTED_SOURCE_COMMIT=d9b3a9866d4e8cfabd04c16f3d79c176331902cd npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 518 ms duration
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:integration` (pass for non-DB checks; 15 DB-backed cases skipped because `TEST_DATABASE_URL` is not configured locally)
  - `npm run test:ui:work-lifecycle` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`)
  - `npm run test:ui:mobile-actions` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)

## Latest Packet 08 Pass - Offer Start Date Normalization

- Fixed the contractor `Send offer` path after a real mobile failure showing `Request validation failed for startDate`:
  - job API mapping now serializes `preferredStartDate` as `YYYY-MM-DD` instead of allowing a database date/timestamp object to become a full ISO datetime in the client payload
  - the Work UI defensively normalizes offer start dates before calling `/api/v1/applications/:id/offer`
  - the offer uses the applicant's proposed start date first, then the job's preferred start date, and otherwise sends `null` rather than inventing a date
  - applicant cards now show the start date that will be used for the offer, so the contractor is not sending a hidden value
  - validation copy now labels `startDate` as `offer start date`
- Preserved launch boundaries:
  - no new role, authorization, billing, invite, or production-data behavior was added
  - the backend offer contract remains server-owned and idempotent
  - no frontend-only success state was added
- Live verification:
  - production `/api/health` reported exact build commit `901996e6a35a625cf0a07aa58fa24f2b7e66ef90`
  - `EXPECTED_SOURCE_COMMIT=901996e6a35a625cf0a07aa58fa24f2b7e66ef90 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 571 ms duration
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:integration` (pass for non-DB checks; 15 DB-backed cases skipped because `TEST_DATABASE_URL` is not configured locally)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)

## Latest Packet 08 Pass - Admin Support Account Review

- Added a human-facing support review path for account-type change requests:
  - Admin now has two sections: `Shop Talk moderation` and `Support cases`
  - support staff can review account support cases with requester email, display name, current role, request text, and status
  - account-type requests can be approved to `Contractor` or `Tradesperson` from the support queue
  - contractor approvals require or reuse a business/crew organization name and create/attach an owner organization when needed
  - support can also close a request without changing account type, with user-visible notes and an admin audit trail
- Preserved server-side boundaries:
  - users still cannot instantly toggle roles after onboarding
  - the approval route requires authenticated admin access with `owner` or `support`
  - staff cannot approve their own account type change request
  - closed support cases and closed accounts fail closed
  - account role, legacy auth user role, organization ownership, support-case events, and admin actions are mutated in one idempotent transaction
- Test coverage:
  - added DB-backed integration coverage for creating an account support case, approving contractor access through the admin route, verifying the user's canonical role and organization, and asserting the admin action audit event
  - the DB-backed assertion is skipped locally unless `TEST_DATABASE_URL` is configured, matching the existing integration suite behavior
- Live verification:
  - production `/api/health` reported exact build commit `727986f630fc4d7d7166d3e516e79817dc8bf270`
  - `EXPECTED_SOURCE_COMMIT=727986f630fc4d7d7166d3e516e79817dc8bf270 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 568 ms duration
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test` (pass; unit suite green, integration suite passed non-DB checks and skipped 15 DB-backed cases because `TEST_DATABASE_URL` is not configured)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF warnings only)

## Latest Packet 08 Pass - Account Type Change Request

- Added a Settings account-type control without weakening server-side role immutability:
  - Settings now shows the current account type (`Contractor` or `Tradesperson`) under Account basics
  - users can request the opposite account type through the existing support-case system
  - the request copy makes clear that support reviews work history, applications, organization setup, open jobs, and marketplace access before any role change
  - no instant frontend role toggle, local auth fallback, authorization bypass, or onboarding role mutation was added
- Preserved launch boundaries:
  - the existing server guard still rejects direct post-onboarding role mutation with `ROLE_IMMUTABLE`
  - support requests use the authenticated `/api/v1/support/cases` path with idempotency and existing rate limiting
  - no database migrations, provider configuration, auth flow, billing flow, invite flow, or production data changes were made
- Live verification:
  - production `/api/health` reported exact build commit `ccd115667e2f58936373d43ced6e327884c36bdb`
  - `EXPECTED_SOURCE_COMMIT=ccd115667e2f58936373d43ced6e327884c36bdb npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 565 ms duration
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` did not complete in this workstation shell after two attempts because the integration half did not return output before the command timeouts; `TEST_DATABASE_URL` and `DATABASE_URL` are not configured in this shell, so DB-backed integration coverage remains a deploy/CI or configured-local verification item for this slice

## Latest Packet 08 Pass - Password Reset Link Grace

- Improved password-reset reliability after a real mobile reset-link failure:
  - forgot-password requests no longer consume earlier unexpired reset links
  - any valid unexpired reset link from the last 30 minutes can reset the password
  - successful reset still consumes all outstanding reset tokens for the account and revokes active sessions
  - reset-link error copy now tells users to request a fresh reset email when the link is invalid, expired, incomplete, or already used
- Preserved security boundaries:
  - reset links remain one-time-use after successful reset
  - reset links still expire after 30 minutes
  - forgot-password remains account-enumeration-safe and always returns accepted
  - rate limiting and the three reset requests per hour cap remain in place
- Live verification:
  - production `/api/health` reported exact build commit `c8953404bd58f63f97f71e3a143afe6ee325a59b`
  - `npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 527 ms duration
  - Railway SSH live reset smoke created a disposable verified account, inserted an older reset token, requested a newer reset email, verified the older token stayed unconsumed, reset the password with that older token, confirmed the new password could log in, confirmed all reset tokens were consumed, and closed the disposable account
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:integration` (pass for non-DB checks; 15 DB-backed cases skipped because `TEST_DATABASE_URL` is not configured locally)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)

## Latest Packet 08 Pass - Signup Failure Guidance

- Improved signup failure copy so users see practical next steps instead of the dead-end generic account-creation message:
  - existing or possibly existing email: directs the user to log in or use Forgot password
  - missing invite: asks for a pilot invitation code
  - invalid/expired/full invite: explains that the code may be invalid, expired, fully used, or not assigned to the selected email/account type
  - validation errors: gives field-specific guidance for email, display name, and invite-code length
  - email-provider/signups-disabled states: points users to retry later or contact `support@rivt.pro`
- Preserved the server-side privacy boundary:
  - the backend still does not expose an email-existence lookup
  - the UI uses the existing safe error codes returned by the signup endpoint
  - no auth, invite-consumption, provider-secret, database, or production-data behavior changed
- Live verification:
  - production `/api/health` reported exact build commit `5db08797fbe640a8314422301a3cc9d7506fe7bb`
  - `npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 593 ms duration
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)

## Latest Packet 08 Pass - Jacksonville Beta Invite Code

- Added support for the named Jacksonville beta access code `JAX26`:
  - signup request validation now accepts 5-character pilot codes while invite consumption remains server-side and hash-backed
  - `scripts/create-pilot-invite.js` can now create a reviewed fixed code with `--code=...` instead of only random one-time strings
  - `scripts/create-pilot-invite.js` can also raise the capacity of an existing active fixed code with `--update-max-uses=...`, avoiding one-off production SQL for launch-code adjustments
  - integration coverage includes a short-code invite signup path so this does not regress silently
- Created the production invite through Railway SSH inside the production service network:
  - code: `JAX26`
  - invite id: `b6ce645b-bb30-4279-875a-405b85ec5879`
  - email lock: none
  - role lock: none
  - max uses: 500
  - uses consumed at update time: 0
  - expires: `2026-10-05T01:09:24.224Z`
- Live verification:
  - production `/api/health` reported exact build commit `8be08d7768f3796257d7b669a0c9eddd38d38df9`
  - Railway SSH update returned the active `JAX26` invite with `maxUses: 500`, `useCount: 0`, and `revokedAt: null`
  - non-consuming signup probe with `JAX26` reached password-policy validation instead of request-shape rejection, proving the short code is accepted by the deployed API without consuming the invite
  - `EXPECTED_SOURCE_COMMIT=8be08d7768f3796257d7b669a0c9eddd38d38df9 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 593 ms duration
- Preserved boundaries:
  - the code remains revocable, expiring, max-use-limited, and stored only as a hash
  - no homeowner flows, fake success paths, auth bypasses, production migrations, provider-secret changes, or invite-gating relaxations beyond accepting the reviewed short beta code length
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:integration` (pass for non-DB checks; 15 DB-backed cases skipped because `TEST_DATABASE_URL` is not configured locally and were not run against production)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass)

## Latest Packet 08 Pass - Responsive Shell and Token Bridge

- Continued Packet 08 on branch `codex/responsive-token-polish` from `origin/master` commit `107c6e2dfe803f78bec554f01202cce10e3ad151`.
- Responsive shell outcomes:
  - added destination-aware main content widths so Work, Shop Talk, and Tools can use wider desktop workspaces without stretching every screen the same way
  - added tablet and wide-desktop shell rules for sidebar width, search width, gutters, nav spacing, and main-canvas padding
  - gave the desktop Home feed a real two-column composition with the community rail/nudge on the right and feed content on the left
  - expanded the desktop Tools hub into a denser three-column tool workspace instead of a phone-shaped column on large screens
- Token/visual-system outcomes:
  - added shell/content/nav tokens in `tokens.css`
  - added missing legacy bridge tokens for `--v2-radius-xl`, `--v2-radius-pill`, success/warning/danger/info colors, and related soft states
  - moved touched accent-on-orange text from hardcoded white to `--v2-on-accent`
  - fixed compact-device logo specificity so the mobile header shows one theme-correct RIVT lockup instead of both logo variants stacked
  - reduced the Home floating action to an icon-only button on phone widths so it no longer covers feed titles as aggressively
- Smoke-maintenance outcomes:
  - updated `scripts/mobile-actions-ui-smoke.mjs` to recognize the current `Camera` primary tool launcher and the current accessible `Switch to metric mode` calculator control
- Rendered QA:
  - Browser plugin instructions were loaded first, but this runtime's in-app Browser connector did not expose the documented `browser.documentation()` API; Playwright fallback was used
  - local Vite QA at `http://127.0.0.1:5317` captured desktop Home, desktop Tools, and 390x664 mobile Home screenshots outside the repo:
    - `C:\Users\zboyt\AppData\Local\Temp\rivt-responsive-desktop-home.png`
    - `C:\Users\zboyt\AppData\Local\Temp\rivt-responsive-desktop-tools.png`
    - `C:\Users\zboyt\AppData\Local\Temp\rivt-responsive-mobile-home.png`
  - rendered metrics reported zero horizontal overflow and no Vite error overlay for desktop Home, desktop Tools, and mobile Home
  - console noise during the fallback run was limited to expected client-only API fetch failures because the local API was not running
- Local verification:
  - `git diff --check` (pass; CRLF warnings only)
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test` (pass; unit suite green, integration suite passed non-DB checks and skipped 15 DB-backed cases because `TEST_DATABASE_URL` is not configured)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:mobile-actions` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment status:
  - fast-forward merged to `master`, pushed to origin, and picked up by Railway production
  - live `https://rivt.pro/api/health` reported exact build commit `e6ae1b25e7789204ab7b46552412a8f4e59e21c1`
  - `EXPECTED_SOURCE_COMMIT=e6ae1b25e7789204ab7b46552412a8f4e59e21c1 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 643 ms duration

## Latest Packet 08 Pass - Truth / Profile Cleanup Deployment

- Fast-forward merged `codex/truth-trust-cleanup` into `master` and pushed `master` to origin.
- Production `/api/health` verified the served build commit as `6695c69e91f0bd6a925f5d3fa70176bad2f66131`.
- Production monitor evidence:
  - `npm run monitor:production` with `EXPECTED_SOURCE_COMMIT=6695c69e91f0bd6a925f5d3fa70176bad2f66131` (pass)
  - database dependency: `postgres`
  - object storage dependency: `s3-compatible`
  - error monitoring: `sentry`, configured and reporting `ok`
  - anonymous private-route checks: 7
  - signups disabled: false
  - mutations disabled: false
- Deployment scope:
  - shipped the truth/trust copy cleanup and Home/Profile subtraction slices described below
  - no auth, billing, moderation, storage-contract, provider, migration, or persistence behavior changed in the deployment

## Latest Packet 08 Pass - Truth / Trust Copy Cleanup

- Continued Packet 08 on branch `codex/truth-trust-cleanup` with a small subtraction-only pass aimed at trust, settings, and profile language rather than layout or data-shape changes.
- Truth/copy outcomes in this slice:
  - replaced checklist-y record goal labels with calmer factual wording (`Work scope`, `Platform consent`, `Verified email`, `Payment notes`, `Review request`)
  - shortened the passed safety-quiz result copy so it stays honest about device-only persistence without over-explaining future architecture
  - changed device export controls and toasts from vague `Export` wording to explicit `Download device ...` wording
  - simplified support-case success copy and feedback-history notes so they describe the real support flow without staff-console jargon
  - tightened Trust & Legal wording so the surface reads as `Platform consent`, `Documents`, and `What you can review or request` instead of sounding like a prototype trust dashboard
  - normalized account-fact labels from `Signup method` / `Current` to clearer `Sign-in method` / `On file`
- Preserved launch boundaries:
  - no auth, billing, moderation, storage-contract, provider, migration, or persistence behavior changed in this pass
  - no new fake trust claims, fake verification, or frontend-only success paths were introduced
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass; unit suite green, integration suite skipped DB-backed cases because `TEST_DATABASE_URL` is not configured in this workstation context)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment status:
  - deployed on `master` at release commit `6695c69e91f0bd6a925f5d3fa70176bad2f66131`
  - production `/api/health` and `npm run monitor:production` verified this deployed commit

## Latest Packet 08 Pass - Home / Profile Subtraction

- Continued `codex/truth-trust-cleanup` with a second subtraction pass focused on repeated explanatory copy in Home and Profile/Settings.
- Density/copy outcomes in this slice:
  - shortened the Home getting-started card from title-plus-body to a single clear next step
  - changed Home setup progress from `steps ready` to a simpler completed-count
  - tightened the empty Shop Talk prompt on Home to a single-line action hint
  - removed the redundant contractor/tradesperson profile label above the account name in Settings
  - simplified top-level page descriptions and section headers across Feedback, Settings, Trust, Training, Community, Reputation, Subscription, Storage, Notifications, and Sessions
  - kept the same actions and information architecture while reducing the amount of explanatory chrome above the real controls
- Preserved launch boundaries:
  - no auth, billing, moderation, storage-contract, provider, migration, or persistence behavior changed in this pass
  - no onboarding flow rules, permissions, or data contracts were altered
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass; unit suite green, integration suite skipped DB-backed cases because `TEST_DATABASE_URL` is not configured in this workstation context)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment status:
  - deployed on `master` at release commit `6695c69e91f0bd6a925f5d3fa70176bad2f66131`
  - production `/api/health` and `npm run monitor:production` verified this deployed commit

## Latest Packet 08 Pass - Camera Tool Launch-Line Merge

- Reviewed the isolated camera-only branch `codex/camera-tool-polish-clean` before merging it onto the launch line.
- Confirmed the slice was limited to five camera-related files only:
  - `src/features/tools/JobPhotosTool.tsx`
  - `src/features/tools/ToolsStudio.tsx`
  - `src/features/tools/tools-studio.css`
  - `scripts/tools-ui-smoke.mjs`
  - `test/jobs-discovery.e2e.mjs`
- Merged that clean branch onto `master` in a fresh worktree instead of trying to untangle the dirty `codex/camera-tool-rebuild` worktree.
- Camera-tool outcomes in this slice:
  - the launcher and immersive tool shell now consistently present the tool as `Camera`
  - the tool now reads as a live project-feed camera surface instead of an album-first photo utility
  - live job language now emphasizes `project feed`, `live jobsite`, and `recent live captures`
  - side-work albums were pushed into a more secondary lane
  - capture-type filters now let the live feed be narrowed by progress / before / after / issue / material / closeout
- Local verification on the launch-line merge worktree:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `node scripts/tools-ui-smoke.mjs` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment status:
  - pushed to `master` and verified live at `/api/health`
  - production now serves release commit `1a9bc4b7b2d90554777d02f718397a57f92598f8`
  - `npm run monitor:production` passed against the deployed build

## Latest Packet 08 Pass - Camera Rebase Verification

- Rebased the in-flight `codex/camera-tool-rebuild` work over current `origin/master` and preserved the newer master camera/project-feed implementation from the already-merged launch-line camera pass.
- Camera surface preserved in this slice:
  - the primary Tools launcher opens `Camera`
  - live job photos remain centered on the project-feed workflow instead of a passive album-first gallery
  - active-job photos keep capture-type filters for progress / before / after / issue / material / closeout
  - side-work albums remain secondary to live jobsite capture
  - desktop, standard mobile, and SE-class smoke coverage still verifies the Camera flow
- Supporting launch-hardening change retained from the rebase:
  - dev-only localhost origin matching is centralized in `isAllowedOrigin()` so local rendered UI smokes can use dynamic ports without weakening production origin checks
- Preserved launch boundaries:
  - no homeowner flows, fake success, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or moderation/auth relaxations were introduced
  - no production data migration or provider-secret change was required for this pass
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm run test:ui:mobile-actions` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm run test:integration` (pass; 18/18 after allowing the full DB-backed runtime to complete)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass)
- Rendered QA:
  - Browser plugin invocation failed in this session at the required documentation call (`browser.documentation is not a function`), so the repo's Playwright smoke scripts were used as the rendered QA fallback
  - refreshed `desktop-job-photos.png`, `mobile-job-photos.png`, and `se-job-photos.png` show the current camera/project-feed surface contained across desktop, 390px mobile, and 320px SE-class screens
- Production deployment status:
  - fast-forward merged to `master`, pushed to origin, and picked up by Railway production
  - live `https://rivt.pro/api/health` reported exact build commit `1bd570335f41c9b0038c3d99c4650df6829b16af`
  - `EXPECTED_SOURCE_COMMIT=1bd570335f41c9b0038c3d99c4650df6829b16af npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 562 ms duration

## Latest Packet 08 Pass - Native Metric Calculator Mode

- Continued Packet 08 on branch `codex/metric-mode-rebuild` with a true metric-first rebuild of the Heavy 16th calculator for SI users rather than a metric display toggle on top of imperial-only entry.
- Metric-mode outcomes in this slice:
  - calculator state now uses a shared exact internal measurement unit so imperial sixteenths/thirty-seconds and metric millimetres can round-trip cleanly
  - metric mode now has native millimetre entry, decimal-tenth quick chips, `mm / cm / m` readouts, half-millimetre `H/L` trim nudges, and metric-aware multiply/divide behavior
  - imperial mode remains available as the paired fallback, and switching between modes carries the active value across instead of resetting the calculation
  - locale-aware number formatting is now used for metric displays so decimal separators follow the device/browser locale
- QA coverage updates:
  - `scripts/tools-ui-smoke.mjs` now exercises the real metric flow on desktop, standard mobile, and SE-class compact layouts before switching back to imperial math
  - `test/jobs-discovery.e2e.mjs` now checks for the real mode-switch control instead of the retired `MM` toggle wording
- Local verification:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test:integration` still timed out on this workstation with no `TEST_DATABASE_URL` configured, so no fresh DB-backed integration claim is recorded in this slice
- Rendered QA:
  - refreshed calculator screenshots in `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass` now cover the native metric path on desktop, 390px mobile, and 320px SE widths
- Production deployment status:
  - not deployed in this pass
  - production remains on release commit `5ce29c2f7c2768402a0dce24f3744df254be4b20` until this branch is merged and redeployed

## Latest Packet 08 Pass - SE Home Compression

- Continued `codex/small-phone-polish` with one more SE-class pass aimed at the Home feed rather than tool internals:
  - tightened the welcome block spacing and headline scaling so the first viewport stops feeling over-inflated on narrow phones
  - reduced the answer-queue nudge density and community-card footprint so the early Home stack fits more naturally on first-generation iPhone SE-class widths
  - resized and simplified the floating primary action so it no longer dominates the lower viewport on `<= 430px`
  - hid the FAB label on ultra-tight widths (`<= 360px`) so the icon stays tappable without covering neighboring content
- Preserved launch boundaries:
  - no auth, billing, moderation, storage-contract, or data-shape behavior changed in this pass
  - this was a UI-density and responsive-layout slice only
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:mobile-actions` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test:integration` still exceeded extended local command windows in this pass, so no fresh integration claim is recorded here
- Rendered QA:
  - refreshed `mobile-home-iphone-se.png` now shows the Home surface in the mobile shell with a smaller floating action instead of the broken split/sidebar presentation from the physical-device reports
  - refreshed `se-calculator.png`, `se-invoice.png`, and `se-tools-hub.png` remain contained after the Home pass, confirming the narrower feed CTA did not re-break adjacent small-phone surfaces
- Production deployment status:
  - not deployed in this pass
  - production remains on release commit `5ce29c2f7c2768402a0dce24f3744df254be4b20` until this branch is merged and redeployed

## Latest Packet 08 Pass - Compact Tool Detail Collapse

- Continued `codex/small-phone-polish` with a compact-phone density pass focused on the immersive invoice and daily-log surfaces:
  - shortened the invoice builder header to a simple `Invoice` title and moved saved templates behind a compact fold-down row
  - collapsed the printable invoice preview into an explicit `Open preview` section so the builder and send/export actions stay in view first on SE-class screens
  - shortened the daily-log primary title to `Jobsite note`
  - moved the daily-log checklist and raw text preview into fold-down sections so the summary panel stays useful without becoming a wall of content on small phones
  - added shared compact collapsible styles for these secondary sections to keep the visual language consistent across tool surfaces
- Preserved launch boundaries:
  - no billing, moderation, auth, storage-contract, or data-shape behavior changed in this pass
  - this pass only changed UI density, copy, and test expectations for already-shipped tool workflows
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` still exceeded the local command window in this pass, so no fresh aggregate test claim is recorded here
- Rendered QA:
  - refreshed `se-invoice.png` now shows the invoice builder leading with total / template / line-item editing while templates and printable preview use compact fold-down rows
  - refreshed `se-daily-log.png` confirms the daily-log summary no longer has to show the checklist and raw text body at full height by default
- Production deployment status:
  - not deployed in this pass
  - production remains on release commit `5ce29c2f7c2768402a0dce24f3744df254be4b20` until this branch is merged and redeployed

## Latest Packet 08 Pass - Calmer Tools Hub

- Continued `codex/small-phone-polish` with one more tools-only subtraction pass aimed at tiny-phone readability rather than new functionality:
  - shortened the five primary tool summaries so the first viewport reads like a toolbox instead of a feature brochure
  - moved the local/cloud storage honesty note below the secondary groups so the first screen shows tools first and explanation second
  - tightened the small-phone tool-card, group, and mini-card spacing so the Tools hub stops feeling bloated on SE-class screens
  - preserved the grouped secondary-tool layout while keeping the five primary launchers as the clear first actions
- Preserved launch boundaries:
  - no auth, billing, moderation, storage-contract, or data-shape behavior changed in this pass
  - no tool persistence rules changed; this was a UI-density and copy-only slice
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
- Rendered QA:
  - refreshed `se-tools-hub.png` now shows a calmer first screen with shorter tool blurbs and the storage note pushed below the grouped utilities
  - refreshed `se-calculator.png` confirms the Heavy 16th fullscreen chrome remains intact after the hub-density pass
- Production deployment status:
  - not deployed in this pass
  - production remains on release commit `5ce29c2f7c2768402a0dce24f3744df254be4b20` until this branch is merged and redeployed

## Latest Packet 08 Pass - Calculator Chrome Cleanup

- Continued `codex/small-phone-polish` with a focused Heavy 16th pass aimed at the fullscreen calculator experience rather than broader tool behavior:
  - replaced the misleading reset-style left chrome with a real back affordance when the calculator is opened from Tools
  - restored an always-visible clear action in the top bar so compact phones no longer lose the full reset control when the inner calculator header is hidden
  - removed the duplicate inner calculator header block so the keypad and fraction controls reclaim more of the first viewport
  - tightened the calculator top-bar action group styling across default, fullscreen, and compact-device breakpoints so the back / clear / copy controls stay readable without reintroducing overflow
- Preserved launch boundaries:
  - no billing, moderation, auth, data-shape, or provider behavior changed in this pass
  - the calculator remains fraction-only with `H`, `L`, `÷2`, `×2`, and metric toggle behavior intact
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` still exceeded the local command window in this pass, so no fresh full-unit-plus-integration claim is recorded here
- Rendered QA:
  - refreshed `se-calculator.png` now shows a real back arrow plus dedicated clear/copy controls while keeping the fraction strip and keypad fully in view on an SE-sized smoke viewport
  - refreshed `se-invoice.png` and `se-tools-hub.png` remain clean, confirming the calculator chrome change did not re-break neighboring tool surfaces
- Production deployment status:
  - not deployed in this pass
  - production remains on release commit `5ce29c2f7c2768402a0dce24f3744df254be4b20` until this branch is merged and redeployed

## Latest Packet 08 Pass - Small-Phone Polish

- Advanced branch `codex/small-phone-polish` to close the remaining SE-class and narrow-phone layout regressions without changing launch-boundary behavior:
  - strengthened the compact-device detector so true small touch devices still fall into compact mode even when the browser reports an odd desktop-like viewport
  - added a narrow-phone shell fallback that forces the mobile brand/search/actions layout and suppresses sidebar-sized chrome at `<= 430px`
  - tightened auth/onboarding preview spacing, copy, pills, and guest-banner density for tiny phones so the orange preview screens stop overlapping and cropping
  - added a final narrow-phone tools override layer so invoice/detail/preview surfaces stay single-column and inside the handset width even when late-file CSS duplicates compete
  - aligned the Heavy 16th calculator with the current product direction on phones: visible fraction strip, hidden ruler rail, tighter top chrome, tighter display, and smaller helper copy
  - updated `scripts/tools-ui-smoke.mjs` so handset QA now asserts the visible fraction strip path instead of the retired ruler-entry path
- Preserved launch boundaries:
  - no homeowner flows, fake success, fake verification, billing/provider changes, moderation/auth relaxations, or data-contract changes were introduced
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm run test:ui:mobile-actions` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test:integration` still exceeded extended local command windows twice in this pass, so no fresh integration claim is recorded here
- Rendered QA:
  - refreshed `mobile-home-iphone-se.png` confirms the small-phone shell is now using the mobile layout instead of the sidebar/search split seen in the physical iPhone reports
  - refreshed `se-calculator.png` and `se-invoice.png` confirm the calculator and invoice stay in-viewport on SE-class screens with no clipped right rail or helper-label pileup
- Production deployment status:
  - not deployed in this pass
  - production remains on release commit `5ce29c2f7c2768402a0dce24f3744df254be4b20` until this branch is merged and redeployed

## Latest Packet 08 Pass - Launch Final Train Deployment

- Merged `codex/launch-final-train` into `master` as a fast-forward and deployed the launch-final-train slice to Railway production.
- Runtime launch-final-train outcomes now live on `https://rivt.pro`:
  - billing reconcile path is available so authenticated post-checkout recovery can repair entitlements when Stripe checkout succeeds but the webhook path lags
  - logout and session-expiry cleanup now purge `rivt.*` local state while preserving the device theme key
  - feed-card votes use the existing server-backed Shop Talk reaction path instead of a second local-only vote cache
  - network-record 401s now route through the shared session-expiry flow instead of surfacing as misleading sync failures
  - estimate-to-invoice conversion stays disabled for a zero target, avoiding empty invoice promotion
  - compact and SE-class calculator verification now exercises the real visible fraction controls, and the decorative ruler is removed from the accessibility tree
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or moderation/auth relaxations were introduced
  - no migration or provider-secret changes were required for this train
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test` (pass; 44/44 unit and 18/18 integration)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm run test:ui:tools` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production verification:
  - live `https://rivt.pro/api/health` returned 200 with exact build commit `5ce29c2f7c2768402a0dce24f3744df254be4b20`, migration `0021_shop_talk_post_media`, PostgreSQL dependency `postgres`, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=5ce29c2f7c2768402a0dce24f3744df254be4b20 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 589 ms duration
  - refreshed local screenshot evidence remains at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass` and `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`

## Latest Packet 08 Pass - Launch Final Train Local Verification

- Advanced the current launch-final-train slice on branch `codex/launch-final-train` without crossing Gate A trust/auth/moderation boundaries:
  - the Heavy 16th calculator smoke now exercises the real visible fraction controls across desktop, standard mobile, and SE-class compact layouts instead of the decorative ruler
  - SE-class smoke now explicitly applies the compact-device flag in automation, matching the real coarse-pointer device behavior the product code already uses on a physical first-generation iPhone SE
  - the fraction ruler is now removed from the accessibility tree (`aria-hidden` plus non-focusable tick buttons), so automated and assistive navigation resolve to the actual interactive fraction-entry controls instead of a decorative measurement reference
  - launch-final-train functional work from the active branch remains in place: billing reconcile client/server path, logout local-state purge, server-backed feed-card vote plumbing, cross-surface 401 session-expiry handling, and the zero-target estimate-to-invoice guard
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, frontend-only production claims, or auth/moderation relaxations were introduced
  - no migrations, provider secrets, Stripe entitlements, or production data were changed in this verification pass
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test` (pass; 44/44 unit and 18/18 integration after extended local runtime)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test:integration` (pass; 18/18 after allowing the full DB-backed runtime to complete)
- Rendered QA:
  - refreshed `desktop-calculator.png`, `mobile-calculator.png`, and `se-tools-hub.png` were written outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`
  - SE compact smoke now proves the 15-button fraction strip remains available in the compact fullscreen calculator path rather than forcing ruler-only or repeated tap entry
- Production deployment status:
  - not deployed in this pass
  - production remains on source commit `88d5adab057ba2848e6e4b692f8fba18b3239d55` until the launch-final-train branch is merged and Railway is redeployed

## Latest Packet 08 Pass - SE Tool Chrome Cleanup

- Closed the remaining SE-class tool readability issues that were still visible after the immersive containment work:
  - non-calculator tool shells now opt into the fullscreen-tool layout class so compact devices use the same full-viewport framing intent instead of inheriting hub-like spacing
  - compact-device invoice/tool workbenches and panels now force `min-width: 0`, `width: 100%`, and hidden overflow so invoice/detail/preview content cannot push past the narrow-phone viewport
  - compact-device invoice action buttons and template rows now compress more aggressively, preventing the right-side drift reported from the physical small-phone screenshots
  - the Heavy 16th calculator top bar now hides non-essential label text on SE-class widths, and the `L / H / ÷2 / ×2` helper labels collapse to the core controls instead of turning into unreadable stacked text
  - `scripts/tools-ui-smoke.mjs` now asserts that the immersive invoice also hides the app mobile nav and that the SE calculator no longer renders helper-label clutter
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, moderation, subscription, migration, or provider contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` still exceeded the local command window in this pass, so aggregate unit+integration completion is not newly claimed here
- Rendered QA:
  - refreshed `se-calculator.png` now shows the Heavy 16th calculator using icon-only top-bar affordances and uncluttered `L / H / ÷2 / ×2` controls
  - refreshed `se-invoice.png` shows the invoice shell staying inside the handset width with the immersive mobile nav hidden while the tool is open
- Production deployment status:
  - deployed to Railway production from master commit `88d5adab057ba2848e6e4b692f8fba18b3239d55`
  - live `https://rivt.pro/api/health` returned 200 with exact build commit `88d5adab057ba2848e6e4b692f8fba18b3239d55`, migration `0021_shop_talk_post_media`, PostgreSQL dependency `postgres`, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=88d5adab057ba2848e6e4b692f8fba18b3239d55 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 606 ms duration
  - this closes the currently visible compact-tool chrome/readability regressions from the latest phone screenshots at the deployed-runtime level; one final human recheck on the physical device is still useful

## Latest Packet 08 Pass - SE Tool Fullscreen Ownership

- Closed the remaining SE-class immersive-tool shell/layout regression reported from a physical small iPhone:
  - immersive-tool mode now force-hides both the current shell mobile nav and the older legacy mobile-nav strip, preventing tool surfaces from sharing the viewport with bottom-nav chrome
  - immersive-tool mode now removes inherited inline app-shell padding so fullscreen tools can use the full narrow-phone width instead of rendering inside a squeezed central column
  - fullscreen calculator wrappers now explicitly opt out of late-file max-width/grid inheritance, keeping the Heavy 16th tool at full handset width on compact devices
  - calculator compact-device rules now force a single-column fullscreen grid even when late desktop-like width assumptions would otherwise survive on a tiny physical phone
  - `scripts/tools-ui-smoke.mjs` now asserts that the immersive calculator owns the handset width and that the app mobile nav is not visible while the calculator is open
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, moderation, subscription, migration, or provider contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; refreshed screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` / `npm run test:integration` still exceeded the local command window in this pass, so aggregate integration completion is not newly claimed here
- Rendered QA:
  - refreshed `mobile-calculator.png` and `se-calculator.png` now show the Heavy 16th calculator using the handset width instead of collapsing into the prior narrow left rail
- Production deployment status:
  - deployed to Railway production from master commit `f3971fe8b12cae0d88f66774ff3211f6bc53c17d`
  - live `https://rivt.pro/api/health` returned 200 with exact build commit `f3971fe8b12cae0d88f66774ff3211f6bc53c17d`, migration `0021_shop_talk_post_media`, PostgreSQL dependency `postgres`, S3-compatible object storage, and configured Sentry
  - this closes the reported narrow left-rail calculator regression from the physical iPhone screenshots at the deployed-runtime level; one final human recheck is still useful, but the live source now matches the fix

## Latest Packet 08 Pass - Immersive Tools Small-Phone Containment

- Closed the remaining SE-class tool containment issues that were still visible after the compact-device shell pass:
  - immersive tools now set a document-level `data-rivt-immersive-tool` flag while any non-hub tool is open
  - the app shell hides the global top bar, bottom nav, and guest banner while an immersive tool is open, so the calculator and invoice surfaces get the full tiny-phone viewport instead of fighting shell chrome
  - compact-device tool CSS now force-collapses invoice/daily-log/tool workbenches into single-column layouts and tightens padding, panel spacing, action rows, and preview tables for SE-sized viewports
  - the Heavy 16th calculator receives a true compact-device fullscreen layout: reduced chrome, tighter display/action rows, hidden secondary meta blocks, and keypad sizing that fits 320x568 without overlap
  - Shop Talk compact-device spacing was tightened at the same time so community discovery/search rows keep consistent breathing room above the mobile nav
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, moderation, migration, or production data contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass; unit plus DB-backed integration)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm run test:ui:mobile-actions` (pass; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Rendered QA:
  - refreshed SE-sized smoke screenshots confirmed the Heavy 16th calculator no longer renders under the shell top bar and the invoice layout no longer clips horizontally in the compact viewport
- Production deployment status:
  - deployed to Railway production from master commit `c9b2a0033bc7155abd031f47db414d71bcfc028f`
  - live `https://rivt.pro/api/health` returned 200 with exact build commit `c9b2a0033bc7155abd031f47db414d71bcfc028f`, migration `0021_shop_talk_post_media`, PostgreSQL dependency `postgres`, S3-compatible object storage, and configured Sentry
  - one physical recheck on the small iPhone SE is still required to close the remaining real-device confidence gap for this slice

## Latest Packet 08 Pass - Physical Small-Phone Compact Guard

- Added a defensive compact-device guard for SE-class phones and other truly narrow coarse-pointer devices:
  - `App.tsx` now sets `data-rivt-compact-device="true"` on the document root when the physical screen floor is `<= 375px` or the active viewport floor is `<= 360px`
  - this guard is independent of browser viewport honesty, so odd desktop-mode rendering on a tiny physical phone still collapses to the mobile shell
  - the AppShell now force-hides the desktop sidebar, suppresses the desktop search field, restores the mobile brand/search controls, and forces the bottom nav back on when the compact-device flag is present
  - auth/onboarding intro and preview screens now reuse the narrow-phone containment rules when the compact-device flag is present, preventing the orange preview layouts from staying in wide two-column mode on a small physical phone
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, moderation, migration, or production data contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF warnings only for touched files)
- Local limitation:
  - full `npm run test` was attempted but exceeded the local command window; this slice is UI-only and the targeted mobile smoke plus e2e gates passed
- Production deployment status:
  - runtime release commit `8a6377c70fa664ff4dd800beac50df3795aafacd` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `8a6377c70fa664ff4dd800beac50df3795aafacd`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=8a6377c70fa664ff4dd800beac50df3795aafacd npm run monitor:production` passed with operational controls available, seven anonymous private-route checks, and 562 ms duration

## Latest Packet 08 Pass - Launch QA Trust Cleanup

- Addressed the remaining high-priority launch QA trust blockers on branch `codex/launch-qa-trust-cleanup`:
  - authenticated Shop Talk posting no longer creates a local success when the server rejects or drops the post; users now get an explicit not-saved message and nothing is published locally
  - fresh accounts no longer start with fabricated `2/6` records progress or `25%` training completion
  - safety quiz results persist locally across reloads and the copy now says the result is saved on this device instead of claiming a server safety record
  - revoked/expired sessions now dispatch a shared session-ended event from API, Shop Talk, and tool-record sync paths so the app prompts re-authentication instead of mislabeling the event as generic storage sync trouble
  - removed the duplicate local-only service-radius control from Profile/Settings, leaving the canonical account-backed service-area control
  - corrected Pro copy around real launch gates: full time-history access, CSV expense export, expanded records/closeout exports, billing details, and self-serve cancellation
  - tightened the 375px bid-line layout so line-item fields wrap inside the viewport instead of clipping
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no production migrations, provider contracts, billing entitlements, or object-storage contracts were changed
  - the Heavy 16th calculator remains the simplified fraction-only tool; stale kerf/pieces drawer findings were not reintroduced
- Rendered QA:
  - `npm run test:ui:tools` passed; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`
  - `npm run test:ui:mobile-actions` passed; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`
  - Browser plugin setup was attempted, but this session's in-app browser runtime did not expose the documented `browser.documentation()` API, so Playwright fallback evidence was used
- Local gates:
  - `git diff --check` (pass)
  - stale-copy grep for the corrected launch QA phrases (pass; no source hits)
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass; 44/44 unit and 17/17 integration)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment status:
  - merged to `master` and deployed from code commit `90f19da845519507a2a523672e822990ff9920de`
  - live `https://rivt.pro/api/health` returned 200 with exact build commit `90f19da845519507a2a523672e822990ff9920de`, PostgreSQL dependency `postgres`, S3-compatible object storage, and Sentry configured
  - `EXPECTED_SOURCE_COMMIT=90f19da845519507a2a523672e822990ff9920de npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 579 ms duration
  - this docs-only evidence update may supersede the served source SHA without changing runtime code

## Latest Packet 08 Pass - iPhone SE Layout Containment

- Fixed small-phone layout failures reported from a physical iPhone SE:
  - added a true `max-width: 360px` auth/onboarding layer so the orange intro and preview screens stop cropping oversized text and phone mockups
  - compressed intro/preview copy, phone mockups, trade pills, and preview cards only on narrow phones while preserving the larger mobile layout
  - hid the decorative preview phone on the narrow preview-picker screen so the trade/area picker owns the viewport instead of overlapping the headline
  - added a defensive app-shell media query for coarse pointer devices so the desktop sidebar cannot appear on narrow iPhones even if Safari reports an odd desktop-like viewport
  - added an iPhone SE assertion to `scripts/mobile-actions-ui-smoke.mjs`: Home at `320x568` must have no horizontal overflow, no visible desktop sidebar, and a visible mobile nav
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, subscription, moderation, migration, or production data contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm run test:ui:mobile-actions` (pass; includes the new `320x568` iPhone SE shell assertion; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Rendered QA:
  - Browser plugin setup was attempted, but the in-app browser runtime did not expose the documented `browser.documentation()` API in this session, so Playwright fallback was used
  - manual SE screenshots were captured outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-se-after-auth.png`, `C:\Users\zboyt\AppData\Local\Temp\rivt-se-after-preview.png`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-se-after-guest.png`
- Production deployment status:
  - deployed to Railway production from master commit `2fe69d39d6290a67d9d886047ad90f41aef844b6`
  - live `https://rivt.pro/api/health` returned 200 with exact build commit `2fe69d39d6290a67d9d886047ad90f41aef844b6`, migration `0021_shop_talk_post_media`, PostgreSQL dependency `postgres`, S3-compatible object storage, and Sentry configured
  - `EXPECTED_SOURCE_COMMIT=2fe69d39d6290a67d9d886047ad90f41aef844b6 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 562 ms duration

## Latest Packet 08 Pass - Fraction Calculator Ergonomics

- Took the Heavy 16th fraction calculator one step closer to a shippable field app:
  - kept the fraction-only calculator direction instead of adding the dense spacing/hardware calculator panels back
  - reduced unused display height so the keypad owns more of the first mobile viewport
  - enlarged the fullscreen phone controls for the unit row, heavy/light row, and numeric keypad
  - made the `FT`, `IN`, `FRAC`, and `MM` unit controls centered and visually consistent
  - changed `H`, `L`, `x2`, and `/2` into self-explaining two-line buttons: Heavy, Light, Double, and Half
  - replaced raw multiply/divide glyphs in JSX with HTML entities so Windows source encoding cannot corrupt the labels
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, subscription, moderation, migration, or production data contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm run test:ui:tools` (pass; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm run test:ui:mobile-actions` (pass; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Local limitation:
  - full `npm run test` and standalone `npm run test:integration` were attempted, but the DB-backed integration suite did not return within a 5-minute local timeout. The calculator change is frontend-only and the targeted UI, unit, and e2e gates passed.
- Rendered QA:
  - mobile calculator screenshot confirmed the calculator remains no-scroll in the smoke viewport with larger thumb targets and clearer H/L/half/double controls.
- Production deployment status:
  - runtime release commit `9e62aaadea0c39ef9bd659454aa71314739e4cb7` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `9e62aaadea0c39ef9bd659454aa71314739e4cb7`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=9e62aaadea0c39ef9bd659454aa71314739e4cb7 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 654 ms duration

## Latest Packet 08 Pass - Fraction Calculator Simplification

- Simplified the Heavy 16th calculator into a dedicated fraction calculator:
  - removed the visible spacing, cut-angle, and hardware-layout modes from the calculator experience
  - removed the calculator drawer mode switcher so the tool opens directly into the fraction keypad
  - added a metric toggle (`MM`) that shows the metric equivalent in the main display
  - replaced the old `+1/16` / `-1/16` controls with field-style `H` and `L` controls for heavy/light one-thirty-second nudges
  - added dedicated `x2` and `/2` controls for fast doubling and splitting measurements
  - reduced copy/output to result-focused calculator language instead of cut-card, kerf, spacing, or hardware language
- Updated calculator regression coverage:
  - `scripts/tools-ui-smoke.mjs` now verifies `MM`, `H`, `L`, `x2`, and `/2` controls, plus actual half/double/heavy/light results
  - removed stale smoke expectations for spacing, cut-angle, and hardware calculator panels
  - added missing UI-smoke mocks for tool-records and notification preferences so the tools smoke stays frontend-only
  - `scripts/mobile-actions-ui-smoke.mjs` now checks the new calculator controls before the browser-back regression
  - `test/jobs-discovery.e2e.mjs` now expects the fraction-only calculator controls instead of the removed spacing panel
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, subscription, moderation, or migration contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm run test:ui:tools` (pass; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm run test:ui:mobile-actions` (pass; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `git diff --check` (pass; CRLF warnings only for touched files)
- Rendered QA:
  - mobile calculator screenshot confirmed the calculator fits the smoke viewport without the removed mode panels or drawer
- Production deployment status:
  - runtime release commit `0b31628568c3ab83c056f96ab26d45559994d764` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `0b31628568c3ab83c056f96ab26d45559994d764`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=0b31628568c3ab83c056f96ab26d45559994d764 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 612 ms duration

## Latest Packet 08 Pass - Tools Back Navigation Fix

- Fixed a mobile navigation bug in Tools:
  - opening a tool now creates a tool-specific URL state such as `/app/tools?tool=calculator`
  - browser/system back from the calculator returns to the Tools hub at `/app/tools`
  - the in-tool back control still returns to the Tools hub without leaving the app
  - direct links to valid tool URLs hydrate the correct tool, while invalid tool query values fall back to the Tools hub
- Added regression coverage to `scripts/mobile-actions-ui-smoke.mjs`:
  - Tools -> Heavy 16th calculator -> browser back -> Tools hub
  - asserts the `tool=calculator` query exists while the calculator is open and is cleared after back
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Rendered QA:
  - Browser plugin instructions were loaded first; the in-app browser runtime connected but did not expose the documented `browser.documentation()` API in this session, so Playwright fallback was used
  - screenshot evidence from the mobile action smoke is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`
- Production deployment status:
  - runtime release commit `1d5f968fe0076f79eb5294d0bf3e43309b403b79` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `1d5f968fe0076f79eb5294d0bf3e43309b403b79`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=1d5f968fe0076f79eb5294d0bf3e43309b403b79 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 558 ms duration

## Latest Packet 08 Pass - Launch QA Merge Train

- Merged `origin/codex/launch-polish-phase-1` into `codex/launch-go-train` and completed the remaining no-go diffs from Claude's July 4 launch QA:
  - kept the Phase 1 mobile Shop Talk composer reachability fix and its 390x664 Post-button assertion
  - fixed the remaining sub-1-hour Estimate -> Invoice rate mismatch by using the same 0.5-hour quantity floor in invoice line-rate math
  - removed the duplicate Account Plan fact so Settings has one authoritative subscription surface instead of showing stale beta/free copy above the RIVT Pro card
  - added a post-checkout `billing=success` banner that polls server-owned billing status without granting any frontend-only entitlement
  - replaced provider/setup internals with user-safe subscription-unavailable copy across Settings and the upgrade modal
  - rewrote Pro benefit copy around the real gates: full time-history access, CSV expense export, expanded record/closeout exports, billing details, and self-serve cancellation
  - changed active Pro copy from "active through" to renewal/cancellation-period wording
  - renamed Work's misleading "Quick apply" button to "View & apply" and removed the extra localStorage-derived match badge/calculation from job rows
  - softened unsupported social proof: shout-out activity now says it was saved to your records, and the empty "Reviews you've received" panel is hidden until a delivered-review path exists
  - reworded the Invites route and remaining visible marketplace copy so the UI stays aligned to Home, Work, Crew, Shop Talk, and Tools
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no auth, storage, moderation, migration, or production data contracts were changed
  - Stripe billing authority remains server-owned; checkout-return UI only polls the server
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm run test:ui:mobile-actions` (pass; includes Shop Talk composer Post-button reachability at 390x664; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `git diff --check` (pass; CRLF warnings only for touched files)
- Local limitation:
  - full `npm run test` / `npm run test:integration` was attempted, but `test:integration` did not return within a 5-minute local timeout and `TEST_DATABASE_URL` is not configured in this shell. Re-run the full DB-backed integration suite in CI or a configured test database shell before treating this train as fully release-certified.
- Production deployment status:
  - runtime release commit `f3d15a8b37fa652aad35228782c727ca2156422d` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `f3d15a8b37fa652aad35228782c727ca2156422d`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=f3d15a8b37fa652aad35228782c727ca2156422d npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 612 ms duration

## Latest Packet 08 Pass - Launch Polish Phase 1

- Implemented the Phase 1 launch-polish blockers from Claude's July 4 audit on branch `codex/launch-polish-phase-1`:
  - made the Shop Talk create-post modal usable on short phones with a scrollable body, fixed header/footer, safe-area-aware footer padding, and a mobile smoke assertion at 390x664
  - changed Estimate -> Invoice conversion so overhead, margin, and contingency are included in billable line rates instead of appearing as client-facing invoice lines
  - moved invoice totals to cents-based math, clamped line quantity/rate inputs to non-negative values, added a "Start blank invoice" escape hatch, and limited price-guidance chips to labor lines only
  - removed the Bid Builder path that wrote accepted bids into `rivt.jobs.v1` and replaced the mobile summary action with an honest "Save bid" action
  - kept Bid, Mileage, and Safety summaries visible on mobile instead of hiding them under the 900px breakpoint
  - replaced unsupported "sync will retry"/"cloud sync will catch up" copy across local-only record surfaces with honest saved-on-device / could-not-sync wording
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no production data, migrations, auth, billing, storage, or moderation authorization contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm run test:ui:mobile-actions` (pass; includes Shop Talk composer Post-button reachability at 390x664)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; CRLF warnings only for touched files)
- Local limitation:
  - full `npm run test` was attempted twice and timed out because `test:integration` did not return in this local environment; `test:unit` and the targeted e2e/mobile gates passed, and `test/server.integration.test.js` passed when isolated. Re-run the full integration suite in CI or a DB-provisioned shell before deploying this phase.
- Production deployment status:
  - not deployed from this branch yet.

## Latest Packet 08 Pass - Mobile Layout and Device Accessibility Subtraction

- Continued Claude's minimal-professional audit cleanup with a device-accessibility pass:
  - added broader `:focus-visible` coverage for shell, shared UI, Work, Crew, Shop Talk, Inbox, Profile/Settings, Tools, and admin surfaces
  - raised sampled mobile controls, top-bar controls, tab buttons, report buttons, filter chips, community actions, and tool launch controls to the 44px touch-target floor on coarse pointers
  - converted the Work section tabs into a horizontal mobile chip row so the first viewport is content-first rather than tab-grid-first
  - compacted Records and non-calculator tool shells by removing redundant explanatory headers and the oversized Records command block
  - shortened Records/Job Photos album copy, Crew empty-state copy, Profile/Settings theme/personalization copy, and moderation console descriptions
  - kept Tools as Tools only: no active-job/job-context marketing block was reintroduced
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, subscription, moderation, or migration contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test` (pass; unit plus DB-backed integration tests)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `git diff --check` (pass; CRLF warnings only for touched files)
- Rendered QA:
  - Browser plugin instructions were loaded; previous in-app browser runtime attempts in this session did not expose a usable documentation/tabs API for the mocked authenticated flow, so Playwright fallback was used
  - branch-specific Vite client was started at `http://127.0.0.1:5177`
  - mobile route-mocked smoke at 390x844 checked Home, Work, Crew, Shop Talk, Tools, Records, and Settings
  - the smoke reported `overflowX: 0` and no sampled sub-44px visible targets on every checked page
  - screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-accessibility-nav-smoke-final-3\`
- Production deployment status:
  - runtime release commit `c33200506efd8018552fa847eda3fabdcf2bf5d6` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `c33200506efd8018552fa847eda3fabdcf2bf5d6`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=c33200506efd8018552fa847eda3fabdcf2bf5d6 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 587 ms duration
- Remaining boundary:
  - this is automated and rendered mobile evidence, not physical iOS Safari/Android Chrome/screen-reader certification. The physical accessibility checklist remains the manual launch-quality boundary.

## Latest Packet 08 Pass - Screen Density Polish

- Continued the minimal-professional UI audit cleanup after the typography/breakpoint pass:
  - tightened the Tools hub into denser two-column primary cards plus shorter grouped list rows
  - shortened the Tools storage boundary copy to one clear sentence: local drafts stay on the device; records/photos sync to cloud storage
  - made individual tool headers sticky, compact, and title-first so tools get more usable screen space
  - reduced Shop Talk command/card padding and hid nonessential KPI copy on mobile
  - tightened Trade News mobile article cards so more headlines fit per viewport, source links remain visible, and fallback thumbnails read as source-initial badges rather than blank placeholders
  - tightened Work job rows, detail headers, facts, tabs, and action bars while keeping tap targets at or above the 44px floor
  - tightened Settings/Profile panels, storage rows, completion, portfolio, rate card, and certification surfaces so the page reads less like stacked dashboard cards
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, subscription, moderation, or migration contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test` (pass; unit plus 17 DB-backed integration tests)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `git diff --check` (pass; CRLF warnings only for touched files)
- Rendered QA:
  - Browser plugin instructions were loaded, but the in-app browser runtime exposed no usable `documentation`/`tabs` API in this session; Playwright was used with the local Chrome channel
  - fresh branch-specific Vite client was started at `http://127.0.0.1:5177`
  - mobile guest-preview smoke at 430x932 checked Home, Tools hub, Heavy 16th calculator, Shop Talk, Trade News, Work, and Profile/Settings
  - the smoke found no document-wide horizontal overflow on any checked surface
  - local API checks during rendered QA used a setup-required dev process, so CORS/setup console noise was treated as an environment artifact rather than app UI evidence
  - screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-density-home.png`, `rivt-density-tools-hub.png`, `rivt-density-tool-calculator.png`, `rivt-density-shop-talk.png`, `rivt-density-trade-news-final2.png`, `rivt-density-work.png`, and `rivt-density-profile-settings.png`
- Production deployment status:
  - runtime release commit `cdaf0af3b71bc855f057cc525468a0a58db19040` was pushed to GitHub and picked up by Railway production service `RIVT`
  - `EXPECTED_SOURCE_COMMIT=cdaf0af3b71bc855f057cc525468a0a58db19040 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, controls off, seven anonymous private-route checks, and 591 ms duration
- Remaining boundary:
  - this pass is focused screen-density polish. Physical/manual device evidence, route-level keyboard/screen-reader checks, and continued feature-specific UI simplification remain open launch-quality work.

## Latest Packet 08 Pass - Typography and Breakpoint Polish

- Continued the minimal-professional UI audit cleanup after the Settings/Profile foundation pass:
  - added semantic v2 text aliases (`caption`, `label`, `body`, `body-lg`, `title`, `display`) and spacing aliases so feature CSS stops inventing one-off sizes
  - added app-wide text-size adjustment guards plus balanced headings and prettier paragraph wrapping inside the v2 shell
  - moved Home feed, Work, Crew, Profile/Settings storage, and Shop Talk/Trade News visible text onto the shared token scale
  - normalized remaining odd scanned values in these surfaces: no 9-12px font sizes, no 15.5px news body text, no 480px breakpoint, and no 11px card radius remains in the checked CSS paths
  - kept calculator/tool display sizing out of the broad sweep because those controls need field-calculator ergonomics rather than normal content typography
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - no server data, auth, billing, storage, subscription, or moderation contracts were changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm run test` (pass; unit plus 17 DB-backed integration tests)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `git diff --check` (pass; CRLF warnings only for touched files)
- Rendered QA:
  - fresh branch-specific Vite client was started at `http://127.0.0.1:5177`
  - Playwright used the local Chrome channel because the bundled Playwright browser was not installed in this environment
  - mobile guest-preview smoke at 430x932 checked Home, Work, Crew, Shop Talk, Tools, and the Profile/Settings menu
  - the smoke found no document-wide horizontal overflow; detected offscreen items were intentional horizontal-scroll community/chip rows with `scrollWidth` equal to the viewport
- Production deployment status:
  - runtime release commit `530fe4f2152c1e191d7dc4e2c9d2b36ebb93119f` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `530fe4f2152c1e191d7dc4e2c9d2b36ebb93119f`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=530fe4f2152c1e191d7dc4e2c9d2b36ebb93119f npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 565 ms duration

## Latest Packet 08 Pass - UI System and Settings Polish

- Started the paired UI-system/Profile-Settings pass from the minimal-professional audit:
  - default app palette now falls back to the approved RIVT orange instead of the older tool-theme placeholder
  - v2 surfaces now bridge the selected palette into accent, hover, soft, deep, and text compatibility tokens
  - missing compatibility tokens were added so Profile, Settings, Pro, and older surfaces stop fighting over text/weight/accent values
  - Profile/Settings page width, section spacing, panel headers, card borders, and typography were tightened around one calmer visual rhythm
  - Profile Settings theme choices now render as compact icon swatches instead of large text-heavy blocks
  - Settings storage copy was shortened and clarified: RIVT pays the infrastructure provider and user accounts consume assigned plan quota
  - duplicate storage allocation copy was removed, leaving usage, quota, payer, and cloud/device boundary information once
  - the RIVT Pro card styling was softened to match the cleaned Settings/Profile card system without changing Stripe billing logic
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, local-auth fallback, or frontend-only production claims were added
  - subscription, auth, storage, and server data contracts were not changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; fail-closed auth plus desktop/mobile jobs/discovery)
  - `npm run test` (pass; unit plus 17 DB-backed integration tests)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `git diff --check` (pass; CRLF warnings only for touched files)
- Rendered QA:
  - the Browser plugin guidance was read completely before browser-capable QA
  - authenticated Settings at 390x844 was verified with a Playwright fallback harness because the authenticated Settings state requires route-mocked account, billing, and storage responses
  - the smoke verified no horizontal overflow, compact theme swatches, removed `Allocated` storage duplication, cleaned `Billing` storage copy, and the current-plan/storage sections still render
  - screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-settings-ui-system-polish.png`
- Production deployment status:
  - runtime release commit `8f31a49b6ecd37a841bd7e72094ba9913e65dd2e` was pushed to GitHub and picked up by Railway production service `RIVT`
  - `EXPECTED_SOURCE_COMMIT=8f31a49b6ecd37a841bd7e72094ba9913e65dd2e npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, controls off, seven anonymous private-route checks, and 538 ms duration
- Remaining boundary:
  - this pass addresses the foundational Settings/Profile/token/card-style cleanup. Broader typography scale sweeps, breakpoint consolidation, and remaining screen-by-screen mobile layout cleanup are still open.

## Latest Packet 08 Pass - Profile Onboarding Subtraction

- Closed one remaining onboarding/repetition issue from the minimal-professional audit:
  - removed the duplicate Profile Settings `Redo setup` card
  - removed the separate localStorage-only onboarding modal that wrote `rivt.onboarding.v1`
  - removed the dead `.v2-onboarding-*` CSS from Profile styling
- Preserved the real onboarding boundary:
  - signup/onboarding remains the server-owned product path
  - users who have already completed onboarding are no longer offered a second, local setup flow from Settings
  - no local-only rate/trade/city setup is presented as production account data
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, or frontend-only production claims were added
  - server data, auth, billing, storage, and subscription controls were not changed
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `git diff --check` (pass; CRLF warnings only for touched Profile files)
- Rendered QA:
  - authenticated Settings smoke at 390x844 verified the Settings screen no longer renders `Redo setup` or `Update your trade, rate, and city from the onboarding flow`
  - the same smoke verified `Sign out` remains reachable
  - screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-settings-no-redo-setup.png`
- Production deployment status:
  - runtime release commit `2b714896e4a7913c8f67b734bf11171c50d80bb8` was pushed to GitHub and picked up by Railway production service `RIVT`
  - `EXPECTED_SOURCE_COMMIT=2b714896e4a7913c8f67b734bf11171c50d80bb8 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, controls off, seven anonymous private-route checks, and 568 ms duration
- Remaining boundary:
  - this pass closes the duplicate local Profile onboarding path only. Remaining Claude-audit themes still include typography/token/breakpoint consolidation, continued mobile layout sweeps, and broader onboarding walkthrough polish.

## Latest Packet 08 Pass - Claude Audit Auth Preview Honesty

- Closed one remaining Claude-audit truthfulness residue in the public auth/onboarding preview:
  - removed fabricated vote/reply counts from the Shop Talk intro carousel
  - removed fabricated vote/reply counts from the unauthenticated product-preview phone feed
  - replaced those labels with neutral `Example question`, `Example community post`, and `Example local post` copy so preview content teaches the flow without pretending there is existing engagement
- Preserved launch boundaries:
  - no homeowner flows, fake verification, job-payment processing, escrow, payroll, or frontend-only production claims were added
  - this pass changes preview/onboarding copy only; server data, auth, billing, and production storage paths are untouched
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `git diff --check` (pass; CRLF warning only for the touched TSX file)
- Rendered QA:
  - built-client Vite preview at 390x844 verified the auth preview no longer renders `128 votes`, `96 votes`, `71 votes`, `67 replies`, `54 replies`, `38 replies`, `42 votes`, or `31 votes`
  - the same smoke verified replacement copy renders and saved screenshot evidence outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-auth-preview-honesty.png`
- Production deployment status:
  - runtime release commit `7bab3358e28b5d994ccba02ecb5b832bfd239cfb` was pushed to GitHub and picked up by Railway production service `RIVT`
  - `EXPECTED_SOURCE_COMMIT=7bab3358e28b5d994ccba02ecb5b832bfd239cfb npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, controls off, seven anonymous private-route checks, and 562 ms duration
- Remaining boundary:
  - this is not a broad UI redesign pass; remaining Claude-audit themes still include physical-device onboarding walkthrough, typography/token/breakpoint consolidation, and continued mobile layout sweeps as product surfaces change

## Latest Packet 08 Pass - Live Subscription QA and Storage Settings Polish

- Recorded founder live QA evidence from 2026-07-03:
  - the owner account subscribed to RIVT Pro in production
  - cancellation was scheduled from Settings without a support ticket
  - the Settings card showed continued Pro access through August 3, 2026
  - the owner resumed the subscription from the same Settings card and saw the continued-subscription state
- Tightened the Settings storage panel after live mobile screenshots showed row labels and values colliding:
  - storage rows now stack label/value text in a dedicated storage-list layout
  - long provider/storage policy copy wraps inside the card instead of running into labels
  - the patch keeps the existing cloud-storage honesty copy: uploads use managed S3-compatible object storage, not device-local storage
- Preserved launch boundaries:
  - no homeowner flows, fake verification, escrow, payroll, job-payment processing, or frontend-only entitlement claims were added
  - this pass records live manual billing evidence and mobile UI polish only
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass)
- Rendered QA:
  - in-app Browser was available and used for local app orientation, but the unauthenticated local browser session could not reach the authenticated Settings storage card
  - Playwright fallback with mocked authenticated state at 390x844 verified six storage rows, no horizontal overflow, and stacked label/value geometry for `Location`, `Who pays`, and the remaining storage facts
  - screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-settings-storage-polish-storage-card.png`
- Production deployment status:
  - runtime release commit `2f1717094d5eaa0c4749acf887694ae5c7afd400` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `2f1717094d5eaa0c4749acf887694ae5c7afd400`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=2f1717094d5eaa0c4749acf887694ae5c7afd400 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 573 ms duration

## Latest Packet 08 Pass - Subscription Controls and Shop Talk Cleanup

- Implemented subscription cancellation controls and Shop Talk cleanup on branch `codex/subscription-cleanup-controls`.
- Added customer-friendly RIVT Pro subscription controls:
  - authenticated `POST /api/v1/billing/subscription/cancel` schedules Stripe cancellation at period end
  - authenticated `POST /api/v1/billing/subscription/resume` clears a scheduled cancellation
  - both routes update server-owned billing rows immediately from Stripe's subscription response
  - both routes record append-only audit events
  - cancellation does not depend on Stripe Customer Portal setup; only the Stripe secret key and an existing subscription are required
- Updated the Settings plan card:
  - free-plan copy now explicitly says subscriptions can be cancelled from the screen without a support ticket
  - Pro users see `Manage payment details` for Stripe portal access
  - Pro users also see a direct `Cancel subscription` control
  - scheduled cancellations show the paid-through date and a `Keep Pro subscription` resume action
- Added safe Shop Talk post cleanup:
  - authenticated `DELETE /api/v1/shop-talk/posts/:postId` requires an idempotency key
  - only the post author can delete the post
  - deletion hides the post, marks attached Shop Talk media as removed, marks linked upload records removed, and records an audit event
  - the Shop Talk detail view shows a delete control only for the current user's own posts
- Preserved launch boundaries:
  - no homeowner flows, fake verification, payment escrow, job-payment processing, or frontend-only billing entitlement was added
  - Stripe remains the billing provider; RIVT only exposes a straightforward control layer around subscription management
  - Shop Talk cleanup is soft-delete/audited rather than destructive production data removal
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/billing.test.js test/shop-talk-posts.integration.test.js` (pass)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test:integration` (pass with extended local command window; 17/17 integration tests)
  - aggregate `npm run test` was attempted first and exceeded a 5-minute local command window; `test:unit` plus `test:integration` passed separately afterward
- Production deployment status:
  - runtime release commit `98afa82dd23811457a0213b9a8e46ebc2bc88d05` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `98afa82dd23811457a0213b9a8e46ebc2bc88d05`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=98afa82dd23811457a0213b9a8e46ebc2bc88d05 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 648 ms duration

## Latest Packet 08 Pass - Shop Talk Post Photos

- Implemented server-owned Shop Talk photo posts on branch `codex/shop-talk-image-posts`.
- Added reviewed database migration `0021_shop_talk_post_media` with rollback:
  - explicit `shop-talk` upload storage scope
  - account-owned `shop_talk_post_media` table
  - active media indexes by post, upload, and uploader
  - rollback removes the media table and restores the prior upload scope constraint
- Added authenticated `POST /api/v1/shop-talk/posts/:postId/media`:
  - requires a real post and authenticated actor
  - only the post author can attach a photo
  - accepts image uploads only and validates content signatures before object storage writes
  - stores the file in configured S3-compatible storage and records the upload/media rows in Postgres
  - returns the updated post with signed media URL so the feed can render the image
- Updated the Shop Talk read path:
  - post list responses now include active media, signed thumbnail URLs, and thumbnail alt text
  - answer and media aggregation use separate lateral subqueries so answers and photos do not duplicate each other
- Updated the mobile composer and feed/detail UX:
  - users can add, preview, change, and remove a photo before posting
  - title plus photo is allowed, matching the expected Reddit-style image-post flow
  - feed thumbnails use the existing `TradePostCard` image slot
  - post detail now renders the attached image at full content width
- Preserved the Gate A honesty boundary:
  - no device-local fake upload success is presented as production-ready
  - if the post saves but the photo upload fails, the activity message says the post was created without the photo
  - no homeowner flows, fake verification, fake provider behavior, payment processing, or authorization shortcut was added
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/shop-talk-posts.integration.test.js test/migrations.integration.test.js` (pass against the env-file test database)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - aggregate `npm run test` and `npm run test:integration` were attempted with extended local command windows and timed out; aggregate completion is not claimed for this pass
- Production deployment status:
  - runtime release commit `5c8ef97859bb02eb0db5cec0520c44e223cbdb20` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `5c8ef97859bb02eb0db5cec0520c44e223cbdb20`, migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=5c8ef97859bb02eb0db5cec0520c44e223cbdb20 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 561 ms duration
  - live authenticated photo-post smoke is still intentionally not claimed because the current API has no safe production cleanup/delete route for test posts

## Latest Packet 08 Pass - Network Records Sync

- Implemented the remaining non-tool product-record sync slice on branch `codex/network-records-sync`.
- Added reviewed database migration `0020_network_records` with rollback:
  - account-owned `network_records` table
  - record types: `crew_member`, `crew_invite`, and `network_review`
  - active-record uniqueness by account, type, and local id
  - soft delete support for removing local records from the account-backed set
- Added authenticated `/api/v1/network-records` routes:
  - `GET /api/v1/network-records?type=...`
  - `POST /api/v1/network-records` with idempotency enforcement
  - `DELETE /api/v1/network-records/:recordType/:localId`
  - account isolation and server-side auth are enforced by the same v1 actor path as tool records
- Wired Crew surfaces to the new account-backed path:
  - Crew and Subs rosters hydrate synced records, upload existing device-local records when reachable, and sync adds/edits/job-assignment changes/removals
  - Crew invite planner hydrates synced planned invites, uploads existing device-local invites when reachable, and syncs planned/accepted/declined/removed invite states
  - informal written shout-outs hydrate synced `network_review` records, upload existing device-local written shout-outs when reachable, and display them under `Reviews you've written` instead of incorrectly treating them as received reviews
- Preserved the review truth boundary:
  - `network_review` is an informal, account-owned written shout-out/note record
  - official completed-work reviews, disputes, and approval flows still live in the existing `work_reviews` domain
  - no new verified badge, public reputation claim, homeowner flow, payment processing, fake provider behavior, or authorization shortcut was added
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/network-records.integration.test.js` (pass against the env-file test database)
  - `node --env-file-if-exists=.env --test --test-concurrency=1 test/migrations.integration.test.js` (pass against the env-file test database)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - aggregate `npm run test` was attempted with a 10-minute local command window and timed out; aggregate completion is not claimed for this pass
- Production deployment status:
  - runtime release commit `b57faf9d923a61f2fcb682c0e6eef78a5a1cde32` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `b57faf9d923a61f2fcb682c0e6eef78a5a1cde32`, migration `0020_network_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=b57faf9d923a61f2fcb682c0e6eef78a5a1cde32 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 730 ms duration

## Latest Packet 08 Pass - Non-Tool Local State Boundaries

- Implemented the non-tool local-only surface cleanup on branch `codex/non-tool-local-state-boundaries`.
- Converted the safe non-tool data slice to account-backed storage without a new migration:
  - client contacts were already backed by authenticated `client` tool records
  - Inbox client text threads now hydrate from, merge into, and sync through each client record payload
  - old local text client threads are promoted to the account-backed client payload when the account record API is reachable
  - text threads retain local device fallback when signed out, offline, or the account record API is unreachable
- Kept harmless UI preferences local by design:
  - Inbox message templates
  - pinned conversation IDs
  - archived conversation IDs
  - per-message emoji reactions
- Preserved honest boundaries instead of overstating readiness:
  - client thread photo attachments remain device-local until routed through the object-storage media upload path
  - Crew saves/roster, crew invite planner, and reviews/shout-outs are product records that need dedicated server domain tables/APIs before public readiness
  - those Crew records were not shoved into generic client records or tool records because that would create a misleading source of truth
- Preserved the Gate A honesty boundary:
  - no homeowner flows, fake verification, fake provider behavior, payment processing, production data migration, or authorization changes were added
  - no new package dependency was added
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - aggregate `npm run test` was attempted and exceeded the local command window; aggregate completion is not claimed for this pass
- Production deployment status:
  - runtime release commit `ee20d06ac6181c2b285042ebd1ccd80e9bf668f2` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `ee20d06ac6181c2b285042ebd1ccd80e9bf668f2`, migration `0019_tool_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=ee20d06ac6181c2b285042ebd1ccd80e9bf668f2 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 601 ms duration

## Latest Packet 08 Pass - Tool Summary Account Records

- Implemented the next tool-records cleanup slice on branch `codex/tool-summary-account-records`.
- Reduced remaining local-only summary ambiguity:
  - Earnings now hydrates synced `time_session` and `expense` tool records before rendering weekly earnings, expense categories, and top jobs
  - Tax Summary now hydrates synced `time_session`, `expense`, and `mileage` tool records before calculating annual revenue, expenses, mileage deduction, net profit, and estimated self-employment tax
  - both summaries retain local device fallback when signed out, offline, or the account record API is unreachable
  - both summaries now show a short source notice so account-backed vs device-backed numbers are not overstated
- Updated rendered Tools QA after recent copy cleanup:
  - the smoke now clicks `Save draft` and expects `Daily log draft saved.` instead of stale `Save local draft` copy
- Preserved the Gate A honesty boundary:
  - no new production data migration, fake provider behavior, payment processing, homeowner flow, or authorization change was added
  - no new package dependency was added
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm run test:ui:tools` (pass; screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `node --test test/tool-records.integration.test.js` was attempted but skipped because `TEST_DATABASE_URL` is not configured in this shell
  - aggregate `npm run test` was attempted and exceeded the local command window; aggregate completion is not claimed for this pass
- Production deployment status:
  - runtime release commit `ca59d7f71a95d7506724c8efd0d1fd1359716472` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `ca59d7f71a95d7506724c8efd0d1fd1359716472`, migration `0019_tool_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=ca59d7f71a95d7506724c8efd0d1fd1359716472 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 748 ms duration

## Latest Packet 08 Pass - Daily Log Draft Sync

- Implemented the next accepted tool-records cleanup slice on branch `codex/tool-records-local-sync-polish`.
- Reduced the remaining local-only tool-record ambiguity:
  - standalone Daily Log drafts now hydrate from the authenticated `daily_report` tool-record path when available
  - existing local Daily Log drafts are promoted to a `draft` tool record on load when the account API is reachable
  - saving a Daily Log draft now keeps the local backup and attempts account sync through `/api/v1/tool-records`
  - accepted-work `Save to Records` behavior is unchanged and still writes official closeout notes through the authenticated Records/project timeline API
- Tightened Daily Log copy:
  - replaced `Save local draft` with `Save draft`
  - changed stale `Local draft` labels to `Draft`
  - kept honest fallback copy for signed-out/offline states: drafts remain saved on the device when account sync is unavailable
- Preserved the Gate A honesty boundary:
  - no new production data migration, fake provider behavior, payment processing, homeowner flow, or authorization change was added
  - no new package dependency was added
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `node --test test/tool-records.integration.test.js` was attempted but skipped because `TEST_DATABASE_URL` is not configured in this shell
- Production deployment status:
  - runtime release commit `dee7df54a27470a17c7f74f9599aab9e71b3bef3` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `dee7df54a27470a17c7f74f9599aab9e71b3bef3`, migration `0019_tool_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=dee7df54a27470a17c7f74f9599aab9e71b3bef3 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 684 ms duration

## Latest Packet 08 Pass - Home, Shop Talk, and Tools Polish

- Implemented the next minimal-professional polish slice on branch `codex/home-shoptalk-tools-polish`.
- Reduced Home repetition:
  - the first-run setup card now hides once onboarding is complete
  - when setup is still relevant, Home shows only the next incomplete setup action instead of the full checklist
  - the Home floating action button is role-aware: contractors see `Post work`; tradespeople see `Ask`
- Reduced Shop Talk clutter while preserving the Reddit-style community/feed model:
  - removed the extra answer-queue panel, reputation-path panel, community-rules accordion, and top-contributors pulse from the feed column
  - removed the related stale CSS so the feature no longer carries hidden panel styles
  - shortened repeated empty-state CTA copy and kept the floating `Ask` control as the single compose action on empty community feeds
  - kept community discovery, community pages, filters, post cards, answers, reports, and moderation hooks intact
- Tightened Tools as app-like surfaces:
  - active tools now use the existing immersive mode with a compact `All tools` header
  - added a fullscreen-tool layout class so individual tools get more viewport height while the mobile bottom nav remains hidden inside tools
- Preserved the Gate A honesty boundary:
  - no homeowner flows, fake verification, fake provider behavior, payment processing, production data migration, or authorization changes were added
  - no new package dependency was added
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - targeted integration evidence passed by individual file with extended local time windows, including project completion, Shop Talk posts/reactions/moderation, communities, tool records, migrations, and the remaining Gate A domain flows
  - aggregate `npm run test` was attempted and exceeded local timeout windows; aggregate completion is not claimed for this pass because the database-backed integration suite now runs longer than the local command window
  - rendered mobile QA at 430px in the in-app browser:
    - Home product shell loads with no completed-onboarding setup card, no removed panel copy, and a role-aware FAB
    - Shop Talk loads with community discovery, community-page navigation, no removed side panels, and one visible `Ask` action on empty community pages
    - Tools hub loads without the old active-job/job-context banner or dev-copy phrases; opening Invoice uses compact fullscreen-tool mode with the bottom mobile nav visually hidden
- Production deployment status:
  - runtime release commit `0992ee144532df88471a643ac01e67df86d1832f` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `0992ee144532df88471a643ac01e67df86d1832f`, migration `0019_tool_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=0992ee144532df88471a643ac01e67df86d1832f npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 593 ms duration

## Latest Packet 08 Pass - Naming and Repetition Cleanup

- Implemented the next minimal-professional audit slice on branch `codex/naming-repetition-cleanup`.
- Normalized user-facing route copy around the five core concepts:
  - legacy Work sub-routes now present as `Work` instead of separate `My Jobs`, `Applications`, and `Invites` destination names
  - condensed Tools, Crew, Messages, Settings, and Admin descriptions so headers read like product navigation rather than onboarding copy
  - removed the legacy fallback page paragraph from non-primary page headings
- Reduced repeated header/stat chrome:
  - replaced the Shop Talk moderation dashboard's four stat cards with a compact inline status summary
  - removed extra moderation header eyebrow/description copy so reports are closer to the first viewport
  - replaced the Inbox three-card stat block with one compact unread/update line
  - deleted stale Crew/Inbox header-metric CSS that no longer maps to rendered UI
- Reduced Tools bloat:
  - simplified tool cards to icon, title, one short line, and a chevron
  - removed badge/action copy such as repeated `Open` labels from launch cards
  - shortened grouped tool section labels to `Money`, `Site`, and `Business`
  - removed unused tool-shell eyebrow/description metadata so active tools stay title-only and screen space belongs to the tool itself
- Preserved the Gate A honesty boundary:
  - no homeowner flows, fake verification, fake provider behavior, payment processing, production data migration, or authorization changes were added
  - legacy route identifiers remain internally for backwards-compatible redirects, but visible copy now points users back to the current Home / Work / Crew / Shop Talk / Tools model
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass; unit plus integration, 44/44 unit tests and 16/16 integration suites)
  - `npm run test:e2e` (pass; desktop and mobile jobs/discovery flow updated for the compact Inbox copy)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment status:
  - release commit `3a9b81de63d03966f07a565605bf9eba82df7dda` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `3a9b81de63d03966f07a565605bf9eba82df7dda`, migration `0019_tool_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=3a9b81de63d03966f07a565605bf9eba82df7dda npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 562 ms duration

## Latest Packet 08 Pass - Visual System Consolidation

- Implemented the next minimal-professional UI foundation slice on branch `codex/ui-system-consolidation`.
- Figma was not used for this pass because the immediate risk was code-level drift, not missing mockups:
  - duplicated/conflicting CSS tokens
  - inconsistent RIVT orange values
  - loose typography and breakpoint scales
  - oversized theme-picker cards
  - stale rendered QA selectors after recent IA cleanup
- Consolidated the visual system toward the current RIVT app direction:
  - normalized RIVT orange to the v2 accent (`#ff4b00`) across runtime styles, brand config, avatar seed color, test SVG art, and smoke expectations
  - aligned v2 radius tokens between `tokens.css` and the legacy root token layer
  - raised tiny CSS text declarations to a 13px floor for better mobile readability
  - normalized responsive media breakpoints to the 640 / 900 / 1180 scale while preserving fixed container widths
  - renamed the saved theme palette key from `tradeGreen` to `rivtOrange` with a compatibility migration for existing saved preferences
  - compressed the account-panel theme chooser from large text cards into compact color-swatch icon buttons
  - adjusted the fullscreen Heavy 16th calculator shell so it fits the mobile viewport without vertical overflow
- Updated rendered QA scripts to match the current product truth:
  - Tools smoke now checks the current invoice template success copy
  - mobile action smoke no longer expects removed duplicate Home CTAs and targets the primary Invoice tool launcher
  - Shop Talk/news smoke now checks the honest RIVT starter prompts and the current community/search/detail navigation structure instead of deleted fake demo posts
- Preserved the Gate A honesty boundary:
  - no homeowner flows, fake provider behavior, fake verification claims, payment processing, SMS/email delivery, or production data migration was added
  - the only remaining `tradeGreen` string is the one-time localStorage migration for old theme preferences
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test` (pass; unit plus integration, 44/44 unit tests and 16/16 integration suites)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; screenshots outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm run test:ui:mobile-actions` (pass; screenshots outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`)
  - `npm run test:ui:shop-talk-news` (pass; screenshots outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; line-ending warnings only)
- Production deployment status:
  - release commit `b38760b4ceb9b08b77c82508d407d78987a1dea0` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `b38760b4ceb9b08b77c82508d407d78987a1dea0`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=b38760b4ceb9b08b77c82508d407d78987a1dea0 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 1003 ms duration

## Latest Packet 08 Pass - Remaining Tool Records Sync Slice

- Implemented the remaining accepted `tool_records` sync slice on branch `codex/all-tools-records-sync`.
- Reused the accepted `0019_tool_records` schema and API; no schema change or production data migration was added.
- Added a shared client-record adapter for Crew and Inbox so client contacts share one typed local/cache shape and authenticated `tool_records` persistence.
- Wired these additional business-record surfaces to authenticated `tool_records` sync:
  - Invoice templates now load server-owned templates, upload existing device-local templates when the account has no server records, sync saves, and delete by local id.
  - Bid Builder now loads server-owned saved bids, uploads existing device-local bids when needed, syncs saved bids, and deletes by local id.
  - Price Book now loads server-owned price entries, syncs added/deleted entries, and uploads existing device-local trade price entries when the account has no server records.
  - Safety Checklist now loads server-owned signoff logs, uploads existing device-local signoffs, and syncs new signoffs.
  - Punch List now loads server-owned punch items, uploads existing device-local punch items, syncs new/resolved items, and deletes by local id.
  - Daily Report now loads server-owned reports, uploads existing device-local reports, and syncs saved reports.
  - Job Checklists now load server-owned checklist progress, uploads existing device-local checklist progress, and syncs check/reset changes.
  - Client contacts in Crew and Inbox now load server-owned client records, upload existing device-local contacts, sync new/edited contacts, and delete by local id from Crew.
- Preserved the Gate A honesty boundary:
  - each tool still saves instantly on-device first and reports when records are only device-local because the account/API is unavailable
  - no payment processing, SMS/email delivery, tax filing, payroll, escrow, official invoice sending, or fake provider behavior was added
  - short-lived field drafts/caches such as Daily Log drafts, weather cache, tax-estimator scratch input, and simulated client message threads remain explicitly local/browser-only until a reviewed record type or domain API is accepted
- Runtime source commit: `57c38c2a1a651ce65ad87918de3e7e391fb8714c`.
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:integration` (pass; 16/16 integration suites; completed in about 17.3 minutes)
  - targeted `node --env-file-if-exists=.env --test --test-concurrency=1 test/tool-records.integration.test.js` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; line-ending warnings only)
- Production deployment status:
  - release commit `31ff8050b4b3b1db01d46983bc583e203d16fdc3` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `31ff8050b4b3b1db01d46983bc583e203d16fdc3`, migration `0019_tool_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=31ff8050b4b3b1db01d46983bc583e203d16fdc3 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 607 ms duration

## Latest Packet 08 Pass - Money Tools Sync Slice

- Implemented the next server-owned Tools records slice on branch `codex/tool-records-money-sync`.
- Reused the accepted `0019_tool_records` schema and API; no schema change or production data migration was added.
- Wired three more money/time utilities to authenticated `tool_records` sync:
  - Expense Logger now loads server-owned expense records, uploads existing device-local expenses when the account has no server records, syncs new expenses, and deletes by local id.
  - Mileage Logger now loads server-owned mileage trips, uploads existing device-local trips when the account has no server records, syncs new trips, and deletes by local id.
  - Time Tracker now loads server-owned time sessions, preserves the running-session state from cloud records, uploads existing device-local sessions when the account has no server records, syncs clock-in/clock-out, and deletes by local id.
- Preserved the Gate A honesty boundary:
  - each tool still saves instantly on-device first and reports when records are only device-local because the account/API is unavailable
  - no payment processing, SMS/email delivery, tax filing, payroll, escrow, or fake provider behavior was added
  - bids, price book, punch lists, daily reports, safety checks, job checklists, contracts, clients, and other business records still need their own accepted persistence passes before they can be described as fully cloud-backed
- Runtime source commit: `f9953ddba345514fe15cfc18fa428e0b756d9586`.
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test` (pass; unit plus integration, 16/16 integration suites)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass; screenshots outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment completed from `master`:
  - release commit `5545a90f79ff7ac4067c162f9bae3bff9b8f1b27` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `5545a90f79ff7ac4067c162f9bae3bff9b8f1b27`, migration `0019_tool_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=5545a90f79ff7ac4067c162f9bae3bff9b8f1b27 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 649 ms duration

## Latest Packet 08 Pass - Tool Records Persistence Slice

- Implemented the first server-owned Tools records slice on branch `codex/tool-records-persistence`.
- Added migration `0019_tool_records` with rollback:
  - authenticated `tool_records` table scoped to `account_id`
  - constrained record types for payment records, invoice templates, expenses, mileage, time sessions, bids, price books, punch items, daily reports, safety checks, job checklists, and clients
  - partial unique index on active `(account_id, record_type, local_id)` plus account/type recency indexes
  - soft-delete support through `deleted_at`
- Added authenticated `/api/v1/tool-records` API routes:
  - `GET /api/v1/tool-records?type=...`
  - idempotent `POST /api/v1/tool-records`
  - idempotent `DELETE /api/v1/tool-records/:recordType/:localId`
  - all routes require a real v1 authenticated account/actor; anonymous requests fail closed
- Wired the Payment Tracker tool to the new API:
  - signed-in users load server-owned payment records when available
  - existing device-local payment records are uploaded once when the account has no server records yet
  - new invoices, paid-state updates, and deletes continue to save instantly on-device and sync to the account in the background
  - visible copy now reports whether the record is synced to the RIVT account or only saved on this device
- Preserved the Gate A honesty boundary:
  - no payment processing, escrow, payroll, tax filing, or fake delivery was added
  - other local-only Tools records are not claimed as server-backed until their own persistence slices are wired and tested
- Runtime source commit: `c3462b13be0dbf6f5579db412ba62ad80af3d0fd`.
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - targeted `node --env-file-if-exists=.env --test --test-concurrency=1 test\tool-records.integration.test.js test\migrations.integration.test.js` (pass; migration lifecycle plus tool-records API, 2/2)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; line-ending warnings only)
  - `npm run test` was attempted twice and exceeded the local timeout window; full aggregate local test evidence is not claimed for this pass
- Production deployment completed from `master`:
  - docs/build commit `f251145db9e6febd0ce44f0769cf2efef8f01ff7` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `f251145db9e6febd0ce44f0769cf2efef8f01ff7`, migration `0019_tool_records`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=f251145db9e6febd0ce44f0769cf2efef8f01ff7 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 610 ms duration
- Remaining boundary: this closes Payment Tracker's first server-persistence slice only. Expenses, mileage, time sessions, bids, price book, punch lists, daily reports, safety checks, checklists, and clients still need their own server-backed sync passes before they can be described as cloud-backed business records.

## Latest Packet 08 Pass - Tools Hub Consolidation

- Implemented the next Tools reachability slice on branch `codex/tools-hub-consolidation`, then fast-forwarded it to `master`.
- Kept the five primary field apps as the main Tools surface:
  - Heavy 16th
  - Estimate
  - Invoice
  - Daily log
  - Records & photos
- Exposed the previously hidden supporting tools as compact grouped launchers instead of leaving them unreachable in the bundle:
  - Money: Bid builder, Payment tracker, Expenses, Mileage, Earnings, Tax summary, Tax estimator
  - Site: Materials, Daily report, Punch list, Safety checklist, Job checklists, Time tracker
  - Business: Price book, Contracts
- Added one honest storage boundary line on the hub: standalone drafts save on the device; accepted-work records and uploaded photos use cloud storage.
- Updated rendered and E2E checks so the Tools hub must expose exactly five primary launch cards plus fifteen compact supporting launchers, while primary Estimate/Invoice/Daily log/Records click paths remain unambiguous.
- Rendered mobile QA through `npm run test:ui:tools`; screenshots were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test` (pass; unit plus integration, 15/15 integration suites)
  - `npm run test:e2e` (pass; includes the expanded Tools launcher assertions)
  - `npm run test:ui:tools` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass)
- Production deployment completed from `master`:
  - Tools consolidation source commit `85ce42cab4f938b217e21359aecd700a505dd53f` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `85ce42cab4f938b217e21359aecd700a505dd53f`, migration `0018_shop_talk_moderation`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=85ce42cab4f938b217e21359aecd700a505dd53f npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 558 ms duration
- Remaining boundary: this closes the hidden-tool reachability gap and makes the hub more logical, but it does not merge duplicate client/payment/checklist surfaces or make local-only money/business records server-backed.

## Latest Packet 08 Pass - Reachability and Naming Cleanup

- Implemented the next minimal-professional polish slice on branch `codex/reachability-naming-pass`, then fast-forwarded it to `master`.
- Normalized primary route naming around the five product concepts:
  - changed the active Work route label from `Marketplace` to `Work`
  - changed the active Crew route label from `My Crew` to `Crew`
  - updated route aliases, page copy, onboarding post-setup destinations, profile links, and legacy bridge copy to use the same Home / Work / Crew / Shop Talk / Tools vocabulary
  - removed remaining active `Trade Talk` / `trade-talk` class names from the Shop Talk surface so public naming is consistently `Shop Talk`
- Improved global search reachability:
  - top-bar person search results now pass the selected profile into the Crew surface instead of discarding the account id and landing on a generic Crew page
  - Crew now renders a compact search-result spotlight with the selected person's name, headline, trades, location, and availability plus a dismiss action
  - the jobs/discovery E2E now covers searching for `Riley Harper`, opening the person result, and seeing the Crew search-result landing state on mobile
- Reduced Crew screen repetition:
  - removed repeated `Network` headers, descriptions, and decorative metric tiles from Crew sub-tabs
  - hoisted one compact `Crew` header above Crew / Subs / Reviews / Clients
  - removed the old demo-talent-derived crew stat path from the visible Crew header
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass; includes the new profile-search landing assertion)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass)
  - `npm run test` was attempted and timed out after roughly 15 minutes with no completed local aggregate result, so full local integration evidence is not claimed for this pass
- Production deployment completed from `master`:
  - reachability/naming source commit `c974faf1bd96f16da19c678ad6880965632fd214` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `c974faf1bd96f16da19c678ad6880965632fd214`, migration `0018_shop_talk_moderation`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=c974faf1bd96f16da19c678ad6880965632fd214 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 572 ms duration
- Remaining boundary: this closes a first reachability/naming cleanup slice, but it does not complete the larger polish backlog around full tool consolidation, duplicate client/payment/checklist surfaces, global visual-token consolidation, typography/breakpoint consolidation, or server persistence for local-only business records.

## Latest Packet 08 Pass - Minimal Truthfulness and UI Subtraction

- Reviewed the 2026-07-03 minimal-professional audit against deployed commit `e8fff84f8c5aa875909a1d5d0171dec892ca593f` and implemented the highest-trust, lowest-risk subtraction slice on `master`.
- Removed fake-looking Shop Talk fallback activity:
  - deleted prompt posts 4-8 that used fabricated people, stock thumbnails, timestamps, upvote counts, and comment counts
  - kept only three clearly labeled `RIVT` starter prompts with `Community Prompt` badges, zero votes, no fake comments, and `Starter prompt` timestamps
  - removed stale dated heat-rule copy from the starter prompt body
- Removed overclaiming profile trust UI:
  - removed the hardcoded `Verified` avatar badge and profile chip from the account profile showcase
  - changed account facts from `Trust: Ready` to `Consent: Current/Needs review`
  - removed identity-readiness and payment-method claims that were previously driven by the same generic `trustReady` flag
  - changed the consent flag default to false and now derives it from completed canonical onboarding when available
- Reduced Home duplication:
  - removed the top `Post work` / `Find your crew` CTA row, leaving Work and Crew in persistent nav and the role-appropriate Shop Talk FAB
  - removed the duplicate `Ask the trades` button from the empty feed state
  - wired the `questions need a hand` nudge to open the Shop Talk answer queue instead of opening the new-question composer
- Tightened the visible Tools surface:
  - simplified tool launch cards to icon, badge, title, one short line, and arrow
  - removed internal/dev-speak copy such as `No fake sending` and `Server when linked`
  - changed tool detail shells from eyebrow + title + paragraph into a compact title bar so tools reclaim first-viewport space
  - unified the mileage logger and tax summary deduction math on one shared mileage-rate constant and removed stale `IRS 2025` wording from visible tool metadata
- Rendered mobile QA at 390x844 with a temporary Vite server and Playwright:
  - Home had `0` duplicate CTA rows, `0` fake seed authors, and no console errors
  - Tools had `0` dev-speak strings and no console errors
  - Profile panel had `0` fake standalone `Verified` labels and no console errors
  - screenshots were saved in-repo at `artifacts/ui-audit-2026-07-03/home-mobile.png`, `tools-mobile.png`, and `profile-panel-mobile.png`
- Local gates run on 2026-07-03:
  - `npm run lint` (pass)
  - `npm run build` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `npm run test:e2e` (pass after updating the e2e expectation from the removed duplicate `Find your crew` CTA to the persistent `Crew` nav)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` timed out after 4 minutes during the integration half; `npm run test:integration` also timed out after 10 minutes with no completed local result, so aggregate local integration evidence is not being claimed for this pass
- Production deployment completed from `master`:
  - runtime source commit `e2d50f9a1d7a3d7d89f44c355b88c218d74c4aad` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `e2d50f9a1d7a3d7d89f44c355b88c218d74c4aad`, migration `0018_shop_talk_moderation`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=e2d50f9a1d7a3d7d89f44c355b88c218d74c4aad npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 559 ms duration
- Remaining boundary: this pass improves visible truthfulness and reduces clutter, but it does not complete the broader audit findings around full tool consolidation, duplicate client/payment/checklist surfaces, global search profile routing, token/radius/font/breakpoint consolidation, or server persistence for local-only business records.

## Latest Packet 08 Pass - Shop Talk Human Moderation Console and Report UX

- Implemented the next human-facing moderation operations slice on branch `codex/shop-talk-moderation-console`.
- Added staff-only admin console routing and account context:
  - `GET /api/v1/me` now includes active `admin_role_grants` as `adminRoles`
  - the account menu exposes an `Admin` entry only for accounts with active owner/support/moderator roles
  - `/app/admin` renders the Shop Talk moderation console instead of sending staff through an unreachable placeholder
- Added a responsive Shop Talk moderation console:
  - status filters for Open, Reviewing, Actioned, Dismissed, and All reports
  - queue metrics for open reports, safety-priority reports, community reports, and oldest report age
  - target snapshots for community, post, and answer reports
  - role-aware review actions for dismiss, hide, lock, archive community, and restore
  - required support notes before applying moderation actions
  - clear empty/error/loading states for support use on mobile and desktop
- Upgraded user-facing report reasons in Shop Talk:
  - replaced one-tap/hardcoded report actions with a bottom-sheet reason picker
  - added richer reasons: unsafe trade advice, wrong/misleading, spam/promotion, harassment, private info, duplicate/off-topic, and other
  - added optional reporter context notes and preserved server-first report persistence with local feedback fallback if the report API fails
- Rendered local mobile QA at 430px with Playwright route mocks and service workers blocked:
  - `/app/admin` loaded the console, reviewed a mocked post report, submitted a `hide` action, and updated the queue
  - `/app/network/talk` opened a post report sheet, rendered reason options, and showed no horizontal overflow
  - screenshot evidence was saved locally at `tmp-moderation-ui-smoke.png`
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass)
  - `npm run test` (pass; unit plus integration, 15/15 suites)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment completed from `master`:
  - moderation-console source commit `f4db07fee34b760d10d9f16cc7593e163524e1a4` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `f4db07fee34b760d10d9f16cc7593e163524e1a4`, migration `0018_shop_talk_moderation`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=f4db07fee34b760d10d9f16cc7593e163524e1a4 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 630 ms duration
- Remaining boundary: this makes report review usable for support/admin staff, but broad public Shop Talk still needs the committed SLA/review process exercised against live production reports during the support window.

## Latest Packet 08 Pass - Shop Talk Moderation and Reporting Backend

- Reviewed the Gate B Shop Talk Reddit-model guidance and implemented the next durable public-community safety slice on branch `codex/shop-talk-moderation`, then fast-forwarded it to `master`.
- Added migration `0018_shop_talk_moderation`:
  - moderation states for communities, Shop Talk posts, and Shop Talk answers
  - server-owned `shop_talk_reports` with target snapshots, reason codes, status workflow, and open-report dedupe
  - server-owned `shop_talk_moderation_actions` with append-only audit protection
  - moderation/status indexes for queue and feed filtering
- Added authenticated reporting and admin moderation APIs:
  - `POST /api/v1/shop-talk/reports` reports communities, posts, or answers with idempotent dedupe
  - `GET /api/v1/admin/shop-talk/reports` lists the queue for owner/support/moderator roles only
  - `POST /api/v1/admin/shop-talk/reports/:reportId/actions` supports dismiss, hide, lock, archive community, and restore actions with admin audit events
- Enforced moderation state in the public API:
  - hidden communities, posts, and answers are excluded from public reads
  - locked communities reject new posts
  - locked posts or communities reject new answers
  - hidden answers cannot become Verified Fixes, and hiding a verified answer clears that flag
- Wired the frontend to the server-owned report path:
  - Shop Talk post reports now attempt server persistence first and only fall back to session-local feedback if the server report fails
  - community pages expose a report action for server-owned communities
  - answer cards expose a report action tied to the server-owned answer ID
  - activity feedback distinguishes durable admin-queue reports from local-only fallback flags
- Local gates run on 2026-07-03:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:integration` (pass; Railway-backed `TEST_DATABASE_URL`, 15/15 suites, 975s)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass)
- Production deployment completed from `master`:
  - runtime source commit `87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5`, migration `0018_shop_talk_moderation`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5 npm run monitor:production` passed with seven anonymous private-route checks and operational controls off
- Exposure boundary: this closes the first server-owned moderation/reporting backend slice for Shop Talk, but broad public Shop Talk exposure still needs a human-facing moderation console/SLA process and a better report-reason picker UX before it should be treated as fully public-scale community ops.

## Latest Packet 08 Pass - Shop Talk Reddit Backbone

- Reviewed Claude's `docs/product/SHOP_TALK_REDDIT_MODEL_BUILD_PROMPT.md` from branch `claude/audit` at commit `2e61be4`, implemented the first durable backbone slice on branch `codex/shop-talk-reddit-backbone`, then fast-forwarded it to `master`.
- Added migration `0017_shop_talk_reddit_backbone`:
  - resets seeded community member counts to real membership counts instead of fake public-size numbers
  - adds community ownership/moderator/member roles and archived-community support
  - links every Shop Talk post to a real community
  - adds server-owned `shop_talk_answers` with one verified fix per post
- Expanded the community API:
  - `GET /api/v1/communities` now returns real counts, joined state, viewer role, and supports search
  - `POST /api/v1/communities` creates user-owned communities with reserved-slug checks, duplicate suggestions, and a one-community-per-day throttle
  - joining/leaving updates real membership counts and prevents the last owner from leaving
- Expanded the Shop Talk API:
  - posts can be created inside a community and listed by community slug
  - recent posts include server-owned answers
  - answers can be created through `POST /api/v1/shop-talk/posts/:postId/answers`
  - only the original post author can mark a server-owned answer as the Verified Fix
- Wired the frontend to the new backbone:
  - community/post/answer IDs now use durable string IDs
  - the post composer chooses a community
  - community discovery can start a new community from search
  - fallback community counts no longer display fake `K`-scale membership
  - old localStorage-only reply plumbing was removed from the Shop Talk view
- Local gates run on 2026-07-02:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:integration` (pass; Railway-backed `TEST_DATABASE_URL`)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - focused migration/community/post integration pass also passed after updating the migration lifecycle test for `0017`
- Production deployment completed from `master`:
  - runtime source commit `dba2acb77a3cc36d9757c895591e81e4bb24cf6e` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` returned `ok: true`, build commit `dba2acb77a3cc36d9757c895591e81e4bb24cf6e`, migration `0017_shop_talk_reddit_backbone`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=dba2acb77a3cc36d9757c895591e81e4bb24cf6e npm run monitor:production` passed with seven anonymous private-route checks and operational controls off
  - live cross-user Shop Talk smoke `shop-talk-reddit-20260702233531-a72dd0` passed against production: disposable users created a community, duplicate-community guard fired, scoped post listing worked, a second user answered, non-author Verified Fix was rejected, author Verified Fix succeeded, and cleanup left `0` smoke communities, `0` smoke posts, and `0` open smoke accounts
- Exposure boundary: the backbone is deployed, but broad public Shop Talk exposure still requires the moderation/reporting policy and Gate B public-UGC readiness work tracked under R-024.

## Latest Packet 08 Pass - UI Polish Phase 1 Launch Blockers

- Reviewed Claude's `docs/product/UI_POLISH_BUILD_PROMPT.md` from branch `claude/audit` at commit `b9d0bae` and implemented the first launch-blocker slice on branch `codex/ui-polish-phase-1`, then merged it to `master`.
- Removed duplicate and confusing navigation/search surfaces:
  - deleted the legacy `GlobalSearch` component and CSS
  - removed the second App-level Cmd/Ctrl+K handler so the AppShell search is the single global search surface
  - redirected the normal-user `/admin` dead-end back to the app instead of rendering a user-facing placeholder
- Collapsed user-visible system noise:
  - removed the inline AppShell offline banner so the shared offline banner is the only offline state
  - renamed the shared offline banner class to avoid legacy CSS collisions
  - lowered its stacking layer so it does not sit above intentional modal/sheet surfaces
- Tightened Shop Talk trust/visual states:
  - removed the phrase `during testing` from Verified Fix copy
  - gated the `Mark fix` action to the post author on the client while preserving existing display for already verified answers
  - hid post thumbnails that fail to load instead of leaving blank/broken media cards
  - server-side Verified Fix authorization remains a required follow-up before this is treated as abuse-proof
- Repaired Tools routing and mobile fit:
  - `Records & photos` now opens the real `Job Photos` tool instead of routing away to Records
  - tool smoke tests and e2e expectations now cover the `Job Photos` route
  - Heavy 16th calculator controls were tightened at phone widths so mode buttons, action buttons, inputs, and keypad targets fit better without horizontal overflow
- Rendered mobile QA through the in-app Browser:
  - guest preview -> top-bar Search opened a single `Search RIVT` dialog
  - Tools -> `Records & photos` opened `Job Photos` with `Document any job` and `New album`
  - Tools -> `Heavy 16th` at 430px and 390px showed 42px mode/keypad controls, 40px action controls, and no horizontal overflow
  - no browser console warnings/errors were captured in the checked flows
- Local machine gates run on 2026-07-02:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` was attempted and timed out after roughly four minutes during the integration half; full aggregate local test evidence remains incomplete for this branch
- Production deployment completed from `master`:
  - UI polish source commit `912332eb7daf561fb2e4c60290b3da5b08268885` was pushed to GitHub and picked up by Railway production service `RIVT`
  - Railway deployment `116da2b7-75b9-4f73-8dbd-e79a1543f7ca` settled back to Online after the deploy
  - live `https://rivt.pro/api/health` reported build commit `912332eb7daf561fb2e4c60290b3da5b08268885`, migration `0016_communities`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=912332eb7daf561fb2e4c60290b3da5b08268885 npm run monitor:production` passed with operational controls off and seven anonymous private-route checks

## Latest Packet 08 Pass - Tools Immersive Mobile Gestures

- Implemented the Tools full-screen mobile behavior requested after the Shop Talk tightening pass:
  - the mobile bottom nav remains visible on the Tools hub
  - opening a tool enters an immersive state and slides the bottom nav off-screen
  - the app shell reduces mobile main padding while a tool is open so tools reclaim the space normally reserved for the bottom toolbar
  - leaving Tools immediately clears the immersive state so navigation never stays hidden on unrelated tabs
- Added a conservative swipe-back gesture inside tool detail screens:
  - swipe right from the left edge returns to the Tools hub
  - normal taps and drags on buttons, inputs, links, selects, textareas, and content-editable controls are ignored unless the gesture starts at the screen edge
  - the existing visible `Tools`/back controls remain the primary non-gesture escape path
- Rendered mobile QA through the in-app Browser at 430x932:
  - guest preview -> Tools hub showed the bottom nav normally
  - opening `Heavy 16th` hid the mobile nav (`v2-mobile-nav is-hidden`), set nav opacity to `0`, disabled pointer events, and reduced main bottom padding to `14px`
  - dragging from the left edge returned to the Tools hub and restored the bottom nav
  - no browser console warnings/errors were captured during the flow
- Updated and reran the repeatable Tools rendered QA smoke:
  - `scripts/tools-ui-smoke.mjs` now mocks the server-owned Shop Talk posts and communities read endpoints so Tools QA does not leak unmocked API requests into the console
  - the mobile Heavy 16th workbench shell height was corrected so the no-scroll calculator smoke passes at 390x844
  - screenshots were written outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`
- Local machine gates run on 2026-07-02:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:tools` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` was attempted and timed out after five minutes during the integration half; the full aggregate command is not being treated as green without a completed run
- Production deployment completed from `master`:
  - Tools immersive source commit `f29e0e34e96fa3d4b43d2f283fc0b7f297d2344d` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` reported build commit `f29e0e34e96fa3d4b43d2f283fc0b7f297d2344d`, migration `0016_communities`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=f29e0e34e96fa3d4b43d2f283fc0b7f297d2344d npm run monitor:production` passed with operational controls off and seven anonymous private-route checks

## Latest Packet 08 Pass - Shop Talk Reddit-Style Community Tightening

- Standardized the visible community surface name to `Shop Talk` across the app shell, onboarding/auth copy, global search panel, activity messages, empty states, and e2e expectations so users no longer see mixed `Trade Talk` / `Shop Talk` product names.
- Tightened the mobile Shop Talk community flow:
  - removed the two large top shortcut cards (`Ask the trades`, `Find your crew`) from the Shop Talk tab
  - removed the preset question strip from the top of Shop Talk
  - deep-linked Home community taps into a real in-app community page instead of a loose text search
  - community pages now behave more like destinations: community header, join state, community-specific search, compact flair chips, then the scoped feed
  - secondary type filters, trending tags, answer queue, reputation, rules, and pulse panels are suppressed inside a selected community on mobile so posts appear sooner
- Added a Reddit-style optional thumbnail slot to shared Shop Talk post cards:
  - post cards render compact right-side media when a post has `thumbnailUrl`
  - local prompt examples demonstrate the media slot with accessible image alt text
  - canonical server media upload/persistence for Shop Talk posts remains a future backend/schema feature, not claimed as production-complete
- Cleaned up the Tools hub header so it opens as a compact launcher:
  - removed the `Field apps...` explanatory page-header sentence
  - removed the `Launch set` eyebrow and `Five field apps worth using every day` heading
  - Tools now starts with the `Tools` title and the actual tool app cards
- Rendered mobile QA through the in-app Browser at 430x932:
  - first-run intro showed `Shop Talk, built for the trades.`
  - Home `Carpentry Talk` community card opened the `Carpentry Talk` community page
  - selected community page showed only the community header, compact search/flair row, and scoped feed with thumbnail media
  - Tools opened as a clean launcher without unnecessary top explanatory copy
- Local machine gates run on 2026-07-02:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run test` was attempted twice but timed out locally while running the integration half; the integration environment was not treated as green without evidence
- Production deployment completed from `master`:
  - Shop Talk tightening source commit `f5ca33caf4450647d09523ae12af9eca864eb1fc` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` reported build commit `f5ca33caf4450647d09523ae12af9eca864eb1fc`
  - `EXPECTED_SOURCE_COMMIT=f5ca33caf4450647d09523ae12af9eca864eb1fc npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, controls off, and seven anonymous private-route checks

## Latest Packet 08 Pass - Community Discovery and Tools Pricing Guidance Branch

- Implemented a focused Shop Talk community-discovery upgrade on branch `codex/community-tools-pass`:
  - community discovery now has its own search field
  - tapping a community opens an in-app community page with member/post counts, join state, and scoped posts
  - trade-specific communities now use strict trade matching so a `Cabinetry Talk` page does not pull unrelated `Carpentry Talk` posts just because the post text mentions cabinets
  - broader communities such as `Jacksonville Trades`, `Side Work`, and `Remodelers` still use topic/location matching where there is not yet a canonical post-community relation
- Cleaned up the Tools entry surface so Tools is no longer visually framed around an active job:
  - removed the top-level `Use active job` action
  - removed the Tools `Job context` command panel
  - removed the calculator drawer's active-job context block
  - expanded the Tools hub and tool detail layouts toward a fuller-screen field-app workspace
- Added pilot pricing guidance to the Estimate and Invoice tools:
  - Estimate now shows a high/low/in-range pricing signal based on labor rate, labor hours, trade, and target total
  - Invoice line items now show pricing guidance for labor/service lines while leaving pure material/supply rows unjudged
  - all guidance is framed as pilot/local heuristics, not a marketplace guarantee or production rate card
- Rendered mobile QA through the in-app Browser at 430x932:
  - guest preview -> Shop Talk -> community search -> `Cabinetry Talk` opened correctly and showed only the Cabinetry post
  - Tools opened as a clean tool launcher with no active-job context copy
  - Estimate rendered a pricing signal
  - Invoice rendered a labor pricing signal and no longer marked the Materials line as high/low
- Local machine gates run on 2026-07-02:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment completed from `master`:
  - community/tools source commit `572f401b19a3b60a75bce965e11217e2df464428` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` reported build commit `572f401b19a3b60a75bce965e11217e2df464428`, migration `0016_communities`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=572f401b19a3b60a75bce965e11217e2df464428 npm run monitor:production` passed with operational controls off and seven anonymous private-route checks

## Latest Packet 08 Pass - Onboarding V2 Hybrid Branch

- Reviewed Claude's `docs/product/ONBOARDING_V2_BUILD_PROMPT.md` from branch `claude/new-session-2wxmgd` at commit `269e964` before implementation.
- Implemented the agreed hybrid onboarding model on branch `codex/onboarding-v2-hybrid`:
  - anonymous first visit now opens a skippable, swipe/click-driven Trade Talk intro instead of a login-first wall
  - the intro leads into a preview-first trade/location selector so users can understand RIVT before account creation
  - guest preview preferences seed the existing guest workspace honestly by trade and area without presenting fake live work as production data
  - signup/login remain available from the intro and preview surfaces, and write actions still require real account setup
  - post-signup onboarding now behaves like a focused one-question-at-a-time setup flow while preserving the existing `OnboardingResult` payload and server gate
- Fixed the dev-bypass profile crash risk by making the mock account conform to the canonical account shape and by guarding optional `headline`/`bio` reads before `trim()`.
- Removed the scary anonymous bootstrap error on ordinary first visit; real auth errors still surface in the login flow when users attempt to authenticate.
- Adjusted the Home checklist/FAB mobile interaction so the `+ Ask` floating action does not overlap the getting-started checklist on phone widths.
- Updated `test/auth-fail-closed.e2e.mjs` to reflect the new intro-first flow while keeping the fail-closed guarantees:
  - no red anonymous session error on first visit
  - no `Browse local demo` escape hatch when guest demo is disabled
  - failed login and invite-required signup still fail closed through mocked server errors
- Rendered QA evidence captured outside the repo:
  - `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-intro-430.png`
  - `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-preview-430.png`
  - `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-logged-in-430.png`
- Local machine gates run on 2026-07-02:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment completed from `master`:
  - onboarding V2 hybrid source commit `fc59728ed34318fb72da9e5506a29cd602b9d5e2` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` reported build commit `fc59728ed34318fb72da9e5506a29cd602b9d5e2`, migration `0016_communities`, PostgreSQL, S3-compatible object storage, and configured Sentry
  - `EXPECTED_SOURCE_COMMIT=fc59728ed34318fb72da9e5506a29cd602b9d5e2 npm run monitor:production` passed with operational controls off and seven anonymous private-route checks

## Latest Packet 08 Pass - Home Getting Started Checklist

- Added a role-aware Home `Get RIVT working for you` checklist in `src/features/home/TradeFeed.tsx`:
  - contractors see steps for posting/drafting work, setting company basics, following a trade community, asking the trades, and trying the invoice tool
  - tradespeople see steps for confirming trade/location, adding a work bio, checking local work, joining a trade community, and adding proof through records/safety/daily log
- Checklist progress is derived from real app state where available:
  - jobs/drafts
  - profile basics
  - profile headline/bio
  - joined communities
  - authored Trade Talk posts
  - records beyond the default legal baseline or passed safety certificates
- Preserved Gate A honesty boundaries:
  - no homeowner flow
  - no fake completion claim for server/provider features
  - checklist action clicks route to existing product surfaces instead of marking steps complete
  - the dismiss control is a local UI preference only, not production data
- Rendered mobile QA through the in-app Browser at `430x932`:
  - loaded local `http://127.0.0.1:5173/`
  - entered `Browse first`
  - verified the checklist rendered on Home with zero console warnings/errors
  - caught and fixed unreadable checklist action pills in dark mode
  - verified `Find communities` routes to Shop Talk at `/app/network/talk`
  - verified the dismiss control hides the checklist without leaving Home
- Local machine gates run on 2026-07-02:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment completed from `master`:
  - checklist runtime source commit `285ce7a8841b2ca921d98692143e7632333b96cf` was pushed to GitHub and picked up by Railway production service `RIVT`
  - live `https://rivt.pro/api/health` reported source `285ce7a8841b2ca921d98692143e7632333b96cf` with migration `0016_communities`, PostgreSQL, S3-compatible object storage, and Sentry configured
  - `EXPECTED_SOURCE_COMMIT=285ce7a8841b2ca921d98692143e7632333b96cf npm run monitor:production` passed with operational controls off and seven anonymous private-route checks

## Latest Packet 08 Pass - Onboarding Education and Activation

- Added `docs/product/ONBOARDING_STRATEGY.md` as the product plan for a two-layer RIVT onboarding system:
  - entry education before signup so users understand Trade Talk, Work, Crew, and Tools
  - role-based activation after signup so contractors and tradespeople reach a first useful action faster
- Reworked the auth entry showcase in `src/features/auth/AuthScreens.tsx` with interactive capability cards for:
  - Ask the trades
  - Find work or help
  - Build your crew
  - Run the job
- Reworked post-signup onboarding into a more intentional activation flow:
  - role remains chosen once, with existing immutable-role behavior preserved after setup
  - users choose an immediate goal based on role
  - users shape their feed with trade specialties plus topics such as Local jobs, Code questions, Tools, Business/pricing, Safety, and Project photos
  - the left preview updates based on selected role, goal, trades, and topics
  - completion now routes users to the relevant first destination: Work, Crew, Shop Talk, Tools, or Profile
- Preserved Gate A honesty and safety boundaries:
  - no homeowner flow
  - no fake provider success
  - no new permissions or authorization logic
  - no server onboarding contract changes in this slice
- Local machine gates run on 2026-07-02:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment completed from `master`:
  - onboarding runtime source commit `cf7fa3a53d2fab9f5378957b0fdb68b8c37f0894` was pushed to GitHub
  - Railway source redeploy was accepted for service `RIVT` in environment `production`
  - live `https://rivt.pro/api/health` reported the onboarding source commit with PostgreSQL and S3-compatible object storage healthy
  - `EXPECTED_SOURCE_COMMIT=cf7fa3a53d2fab9f5378957b0fdb68b8c37f0894 npm run monitor:production` passed with configured Sentry, operational controls off, and seven anonymous private-route checks

## Latest Packet 08 Pass - Shop Talk Server Read Path Wiring

- Wired the Shop Talk frontend to the server-owned posts and communities read APIs that landed in migrations `0015_shop_talk_posts` and `0016_communities`:
  - authenticated sessions now load `/api/v1/shop-talk/posts` instead of relying on bundled prompt posts
  - authenticated sessions now load `/api/v1/communities` for live member counts and joined state
  - newly created Shop Talk posts now use the server-returned UUID instead of a client-minted timestamp ID
  - community post IDs are now string IDs throughout the active frontend, with `null` used for no selected post
  - relative timestamps are normalized before rendering server `createdAt` values
- Preserved honest fallback behavior:
  - guest/offline/API-unavailable views can still show the existing preview/prompt content
  - a successful authenticated empty server response now renders as empty server state, not fake prompt data
  - Shop Talk replies remain browser-local because canonical reply persistence is not in this slice
- Centralized community display metadata in `src/features/shop-talk/community-directory.ts` so Home and Shop Talk share one directory while server data owns membership/counts.
- Updated local E2E mocks for the new read endpoints so no browser console errors leak from unmocked `/api/v1/shop-talk/posts` or `/api/v1/communities` requests.
- Local machine gates run on 2026-07-01:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Deployment not performed in this pass; production read-path verification still requires deploy plus authenticated live smoke against `https://rivt.pro`.

## Latest Packet 08 Pass - Launch Rehearsal, Mobile Search, Trade News, and Calculator Fit

- Confirmed Railway production inventory:
  - project `RIVT`, environment `production`, service `RIVT`, custom URL `https://rivt.pro`
  - managed PostgreSQL online
  - managed object storage buckets present (`rivt-private`, `RIVT-uploads`)
- Re-ran production monitoring and live domain smokes from the Railway-backed environment:
  - `npm run monitor:production` passed against the live site.
  - `npm run smoke:gate-a:live` passed from Railway SSH with PostgreSQL/S3/Sentry healthy, migrations ready through `0014_billing_subscriptions`, seven anonymous private-route checks, no seed/demo findings, and operational controls off.
  - `npm run smoke:jobs:live`, `npm run smoke:match:live`, `npm run smoke:messaging:live`, `npm run smoke:projects:live`, `npm run smoke:reviews:live`, and `npm run smoke:shop-talk-reactions:live` all passed from Railway SSH.
- Verified live Stripe billing setup without charging a card:
  - authenticated `/api/v1/billing/status` returned provider configured for the shared test account.
  - authenticated `/api/v1/billing/checkout` created a live-mode Stripe Checkout Session.
  - authenticated `/api/v1/billing/portal` created a live-mode Stripe Customer Portal Session.
  - remaining billing boundary: complete one real checkout and confirm the Stripe webhook flips the server-owned entitlement before charging first users.
- Fixed launch-readiness UI gaps found during rendered QA:
  - restored the mobile top-bar Search icon by showing the icon trigger and hiding only the full desktop search field on phone widths.
  - restored compact mobile Trade Talk / Trade News search bars instead of hiding the whole fieldbar.
  - fixed the Heavy 16th mobile calculator fullscreen workbench so the calculator no longer internally overflows on a 390px phone viewport.
  - updated rendered smoke scripts to assert the current `Trade Talk` IA rather than retired copy.
- Added founder-facing Jacksonville soft-launch copy and first-week operating script at `docs/launch/JACKSONVILLE_SOFT_LAUNCH_SCRIPT.md`.
- Local machine gates run on 2026-07-01:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:shop-talk-news` (pass)
  - `npm run test:ui:tools` (pass)
  - `npm run test:ui:work-lifecycle` (pass)
  - `npm run test:ui:mobile-actions` (pass after one transient upstream 502 rerun)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
- Remaining launch-quality boundary: physical accessibility-device evidence (iOS Safari, Android Chrome, desktop keyboard-only, and screen-reader route checks) plus the real Stripe paid-checkout/webhook entitlement proof.

## Latest Packet 08 Pass - Security, Billing, and Rate Card Hardening

- Hardened Trade News server behavior:
  - `/api/news` now validates and normalizes the optional location query before use.
  - the in-memory news cache is capped and pruned so arbitrary location strings cannot grow it without bound.
  - anonymous news requests now have a durable rate limiter scoped only to `/api/news`.
- Hardened invoice-send provider paths:
  - email and SMS invoice recipients are validated and normalized before provider calls.
  - invoice subject/body are length-bounded.
  - repeated sends are throttled per account, channel, and recipient to reduce abuse risk.
- Updated Stripe subscription period handling for current API payloads by reading `current_period_end` from subscription items when the top-level field is not present.
- Added a canonical shared rate-card helper at `src/lib/rateCard.ts` and migrated Home, Work, Profile, Job Detail, Reports, and Tools reads away from the old ad hoc localStorage object shape.
- Tightened UI/a11y details found during the pass:
  - added accessible accent-text tokens for light/dark themes.
  - improved small orange text contrast across search, setup, inbox, reports, and Shop Talk surfaces.
  - increased compact tool buttons/bookmark targets toward 44px touch sizing.
  - added fade affordances to mobile horizontal chip rows.
  - guarded the crown calculator trig input against floating-point domain overflow.
  - normalized invoice line-total math through numeric parsing.
- Added coverage:
  - news query validation/cache pruning.
  - invoice send validation/throttling.
  - Stripe item-level subscription period-end mapping.
  - legacy rate-card migration and canonical array reads.
- Local machine gates run on 2026-06-30:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
  - `git diff --check` (pass; line-ending warnings only)
- Production deployment completed through Railway from `master`:
  - pushed hardening commit `7f2d288f432314563e57bc5d7e57092a81d7ba5e`
  - live `/api/health` reported the same build commit with PostgreSQL and S3-compatible object storage healthy
  - `EXPECTED_SOURCE_COMMIT=7f2d288f432314563e57bc5d7e57092a81d7ba5e npm run monitor:production` passed with configured Sentry, operational controls off, seven anonymous private-route checks, and 589 ms duration

## Latest Packet 08 Pass - Orange Trade Talk Visual System and Mobile Home Simplification

- Applied the approved orange/white Trade Talk visual direction across the core app shell and primary mobile surfaces:
  - light, high-contrast app shell with orange active states
  - readable approved RIVT lockup on light mobile top bars
  - bold Home headline: `Trade talk, built for the trades.`
  - simplified Home first screen by suppressing old local time-clock, local schedule, revenue-goal, and weekly availability dashboard widgets from the primary entry path
  - stronger Shop Talk actions (`Ask the trades`, `Find your crew`) and compact mobile feed cards
  - mobile Shop Talk fieldbar collapsed so the feed appears sooner
  - Work mobile duplicate create action removed from the header while keeping the empty-state create path
  - Tools cards tightened into focused app-style entries
- Restored a visible `Browse first` auth entry for QA/preview and kept it clearly in guest mode; guest write actions remain gated behind signup or server-owned setup.
- Disabled the automatic local-device setup modal on guest entry so the cloud-first product does not open with local-only profile setup.
- Updated `test/jobs-discovery.e2e.mjs` to assert the new Home headline instead of the retired greeting/availability widget.
- Rendered mobile screenshot evidence captured locally:
  - `artifacts-rivt-auth-mobile.png`
  - `artifacts-rivt-home-mobile-logo-final.png`
  - `artifacts-rivt-shoptalk-mobile-final.png`
  - `artifacts-rivt-work-mobile-final.png`
  - `artifacts-rivt-tools-mobile-final.png`
- Local machine gates run on 2026-06-30:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Production deployment completed from `master`:
  - live `/api/health` reported build commit `d99747ebf68daf4745ad1ec015d0da12ed835a85`
  - migration state ready at `0014_billing_subscriptions`
  - PostgreSQL and S3-compatible object storage healthy
  - Sentry configured
  - `EXPECTED_SOURCE_COMMIT=d99747ebf68daf4745ad1ec015d0da12ed835a85 npm run monitor:production` passed with seven anonymous private-route checks and operational controls off

## Latest Packet 08 Pass - Trade Talk Community UI, Live Billing Env, and Deploy Prep

- Rebuilt the mobile-first Shop Talk surface into a stronger Trade Talk community experience while preserving the `Shop Talk` primary navigation contract required by Gate A:
  - bold Trade Talk hero with direct `Ask the trades` action
  - prompt chips for real trade questions
  - community discovery cards for trade/local groups
  - compact feed cards and sticky mobile Ask action
  - Trade News card readability pass with compact source badges for publisher-only articles
- Rebuilt the auth/entry showcase around the same community-first language:
  - `Trade talk, built for the trades.`
  - mobile feed preview with trade posts, communities, and interest chips
- Confirmed Railway production service variables are present without committing secrets:
  - PostgreSQL, S3-compatible object storage, Resend email, Stripe secret key, Stripe Pro price ID, webhook secret, and billing return URLs are set.
  - `STRIPE_PRO_PRICE_ID` points at the live RIVT Pro price configured in Stripe.
- Updated UI smoke scripts for the new Trade Talk IA and scoped duplicate search placeholders so the tests assert the current product surface.
- Local machine gates run on 2026-06-30:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm run test:ui:shop-talk-news` (pass)
  - `npm run test:ui:work-lifecycle` (pass)
  - `npm run test:ui:tools` (pass)
  - `npm run test:ui:mobile-actions` (pass)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Deployment completed for this pass:
  - pushed to `master`
  - Railway service returned to `Online`
  - `/api/health` returned `ok: true` with PostgreSQL, S3-compatible object storage, migrations ready through `0014_billing_subscriptions`, and Sentry configured
  - `npm run monitor:production` passed against `https://rivt.pro`
- Remaining launch-quality boundary: physical accessibility-device evidence (iOS Safari, Android Chrome, desktop keyboard-only, and screen-reader route checks).

## Latest Packet 08 Pass - Stripe Sandbox Billing Wiring

- Created the Stripe sandbox `RIVT Pro` recurring monthly price at `$9.00 USD` with tax excluded and SaaS business-use tax code.
- Created a Stripe sandbox webhook endpoint for `https://rivt.pro/api/stripe/webhook` with the required subscription events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- Set production Railway service variables for sandbox billing without committing secret values:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PRO_PRICE_ID`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_SUCCESS_URL`
  - `STRIPE_CANCEL_URL`
  - `STRIPE_PORTAL_RETURN_URL`
  - `VITE_ALLOW_LOCAL_PRO=false`
- Redeployed the RIVT Railway service from source so the runtime picked up the billing variables.
- Verified authenticated production billing behavior with the shared test account:
  - `/api/v1/billing/status` returned provider configured with no missing Stripe variables.
  - `/api/v1/billing/checkout` created a sandbox Checkout Session (`cs_test_...`).
  - `/api/v1/billing/portal` created a sandbox Customer Portal session.
- `npm run monitor:production` passed after redeploy with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, and anonymous private-route checks healthy.
- Remaining Stripe launch boundary: repeat the same product/price/webhook/portal setup in Stripe live mode, replace Railway test keys with live keys, redeploy, and verify one live-mode Checkout Session before charging real users.

## Latest Packet 08 Pass - Mobile Click-Path Stabilization (Panel Closure + Billing Mock)

## Latest Packet 08 Pass - Final Gate A Verification Re-run

- Re-run smoke harness verification and close the script gaps that had regressed the Playwright UI smoke bootstrap:
  - Updated `scripts/shop-talk-news-ui-smoke.mjs` (adds `/api/storage` mock route).
  - Updated `scripts/work-lifecycle-ui-smoke.mjs` (adds `/api/storage` mock route).
  - Updated `scripts/tools-ui-smoke.mjs` (adds `/api/storage` mock route).
- Confirmed rendered UI clicks remain stable on current code:
  - `npm run test:ui:shop-talk-news` (pass)
  - `npm run test:ui:work-lifecycle` (pass)
  - `npm run test:ui:tools` (pass)
  - `npm run test:ui:mobile-actions` (pass)
- Re-ran the complete machine checklist for Packet 08 hardening:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test` (pass)
  - `npm run test:e2e` (pass)
  - `npm run incident:readiness -- --require-ready` (pass)
  - `npm run launch:readiness -- --require-ready` (pass)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Risk status unchanged from previous packet:
  - production Stripe product/price/webhook/portal wiring is still a founder/manual action.
  - physical accessibility device matrix evidence still pending (iOS Safari, Android Chrome, desktop keyboard-only, screen-reader route checks).

- Fixed the mobile click-path smoke from failing when navigating back to core surfaces by adding deterministic modal/panel dismissal in `scripts/mobile-actions-ui-smoke.mjs`.
- Added explicit billing endpoint mocking for `/api/v1/billing/status` in the mobile smoke harness to prevent cross-origin console noise and keep the test signal clean.
- The mobile flow now closes overlay state after draft/job-detail tooling and before top-bar panel entry points so profile/settings/workshop actions remain reliably clickable at 390x844.
- Rendered QA passed after changes:
  - `npm run test:ui:mobile-actions` (pass)
- Full machine gates remain green after this pass:
  - `npm run build`
  - `npm run lint`
  - `npm run test`
  - `npm run test:e2e`
  - `npm audit --omit=dev`
- No production deployment was required for this script-only hardening pass.

## Latest Packet 08 Pass - Full Machine Gate Sweep + Current Live Snapshot

- Executed the full machine verification stack from this workspace:
  - `npm run build` ✅
  - `npm run lint` ✅
  - `npm run test` ✅ (unit + integration; no failures)
  - `npm run test:e2e` ✅
  - `npm audit --omit=dev` ✅ (0 vulnerabilities)
  - `npm run incident:readiness -- --require-ready` ✅
  - `npm run launch:readiness -- --require-ready` ✅
- Executed production monitor:
  - `npm run monitor:production` ✅
  - build commit observed: `985e49a66a4c0966e9ec33c51e7c206e3e56985b`
  - controls: signupsDisabled `false`, mutationsDisabled `false`
  - dependencies: PostgreSQL and S3-compatible storage healthy
  - observability: Sentry configured
- Observed production read-through for `/api/health` and internal route checks remain healthy; no critical production-only machine blockers detected.
- Remaining immediate launch blocker is execution environment, not code:
  - `npm run smoke:gate-a:live` and `npm run smoke:ui:live` both require `DATABASE_URL` in local environment and currently fail fast with `DATABASE_URL is required`.
  - these should be executed from Railway-backed context or with matching env for full production route-level evidence.
- Remaining launch-quality blockers remain:
  - production Stripe app-side product/price creation, webhook secret, and Railway variable wiring
  - physical accessibility matrix completion (iPhone Safari, Android Chrome, desktop keyboard-only, screen-reader route validation) per `docs/quality/PHYSICAL_ACCESSIBILITY_CHECKLIST.md`.

## Latest Packet 08 Pass - Storage Usage Visibility and User Quota Surface

- Threaded `/api/storage` usage into the authenticated profile path: `src/App.tsx` now loads storage state on session bootstrap, `src/features/profile/ProfileRoute.tsx` forwards it, and `ProfileHub` renders it in a settings storage card.
- Added a user-facing panel showing storage location (`S3-compatible object storage (managed in the cloud)`), used bytes/object count, and plan quota when configured.
- `/api/storage` remains private and server-owned: authenticated sessions only, no local-device storage fallback, and usage values sourced from upload records in PostgreSQL plus managed object-storage object operations.
- Local quota messaging is explicit: users see `Quota tied to plan` unless an account limit env (`ACCOUNT_STORAGE_GB_LIMIT` or `STORAGE_GB_LIMIT`) is set.
- Required checks for this packet remain green (`npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`); only manual e2e test-account refresh is pending for fresh production smoke.

## Latest Packet 08 Pass - Server-Owned Stripe Billing Entitlements

- Added server-owned billing storage through migration `0014_billing_subscriptions`, including Stripe customers, subscriptions, entitlements, and processed webhook event IDs.
- Added `server/billing.js` with signed Stripe webhook verification, transactional event processing, Checkout Session creation, Customer Portal session creation, and authenticated billing-status lookup.
- Wired `/api/stripe/webhook`, `/api/v1/billing/status`, `/api/v1/billing/checkout`, and `/api/v1/billing/portal` into the Express app without adding a new Stripe SDK dependency.
- Updated the Pro upgrade flow so the UI starts server-created Stripe Checkout only; it no longer relies on a frontend-only payment link or frontend-only entitlement.
- Updated the profile plan card to show real server billing status, truthful setup-required copy when Stripe variables are missing, a refresh action, and a Manage billing action for active Pro users.
- Updated `.env.example` and `PRODUCTION.md` with required Stripe variables, webhook endpoint `https://rivt.pro/api/stripe/webhook`, required events, and Customer Portal setup.
- Added billing unit tests for webhook signature verification and entitlement status mapping; updated migration lifecycle coverage through version 14 and rollback.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, `npm run incident:readiness -- --require-ready`, and `npm run launch:readiness -- --require-ready`.
- Production deployment completed through Railway from `master`; live `https://rivt.pro/api/health` served source `30cd75325f58eef5ff95202480dda547ba1f31af` with ready migration `0014_billing_subscriptions`, PostgreSQL, S3-compatible object storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=30cd75325f58eef5ff95202480dda547ba1f31af npm run monitor:production` passed with seven anonymous private-route checks, operational controls off, and 635 ms duration. Anonymous `/api/v1/billing/status` returned `401`, as expected.
- Production Stripe product/price, webhook endpoint, Customer Portal, and Railway variables still need founder setup before Checkout can create paid subscriptions. Until then the billing UI fails closed with setup-required copy.

## Latest Packet 08 Pass - Invoice and Estimate Tool Polish

- Reworked Estimate into a target-first bid calculator: recommended price range is now the primary visual object, with copy-ready output, labor/material/cushion quick stats, denser two-column mobile inputs, and a separate cost breakdown panel.
- Reworked Invoice Draft into a more credible invoice app surface: total due and copy/print actions now appear first, local templates are compact, invoice details use a cleaner responsive grid, line items are denser on mobile, and the printable invoice preview remains prominent.
- Preserved the Gate A honesty boundary: invoice email/text still open user-owned drafts only, RIVT still does not send on the user's behalf, no fake payment processing was added, and templates remain explicitly device-local.
- Strengthened `npm run test:ui:tools` with Estimate screenshot evidence in addition to the existing Tools, Heavy 16th, Invoice, Daily Log, and Records/photos coverage.
- Rendered QA passed for Tools at desktop and mobile through `npm run test:ui:tools`; screenshots were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, including `mobile-estimate.png`, `mobile-invoice.png`, and `desktop-invoice.png`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:ui:tools`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- Production deployment was performed through Railway from `master`; live `https://rivt.pro` reported build commit `7e8ac1d2ebf5b66f43f4d91f59e8f3d147388f55` through `npm run monitor:production`, with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 553 ms duration.

## Latest Packet 08 Pass - No-Scroll Heavy 16th Calculator Fit

- Changed the Heavy 16th tool to bypass the generic Tools app wrapper so the calculator gets the available mobile viewport instead of spending vertical space on page chrome.
- Added an in-tool `Tools` back control and preserved the existing arithmetic, spacing, cuts, hardware, copy-result, active-job context, and five-tool launcher behavior.
- Reworked the mobile calculator layout into a fixed-height calculator surface: large display, compact mode strip, FT/IN/fraction controls, heavy/light modifiers, bottom-anchored keypad, and a visible right-side sixteenth tape rail. The tall sixteenth fraction grid and cut card are hidden on mobile because the tape rail now owns fraction input.
- Compacted spacing, cuts, and hardware modes so they stay inside the same calculator shell instead of becoming scrolling forms.
- Strengthened `npm run test:ui:tools` with mobile no-vertical-overflow assertions for length, spacing, cuts, and hardware modes, and with mobile fraction selection through the visible tape rail.
- Rendered QA passed for Tools at desktop and mobile through `npm run test:ui:tools`; screenshots were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, including `mobile-calculator.png` and `mobile-calculator-hardware.png`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:ui:tools`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- Production deployment was performed through Railway from `master`; live `https://rivt.pro` reported the new source through `npm run monitor:production`, with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 542 ms duration.

## Latest Packet 08 Pass - Heavy 16th Fraction Calculator Rebuild

- Rebuilt the visible Heavy 16th calculator from a generic form-style tool into a field calculator modeled on the approved reference direction: dark tool surface, large tape-style measurement readout, FT/IN/fraction entry, sixteenth-inch keys, arithmetic keypad, heavy/light 1/32 modifiers, 1/16 increment buttons, optional 1/8 in blade kerf, piece count, copy-ready cut card, and supporting spacing/cuts/hardware modes.
- Added a compact calculator app-shell mode so the calculator itself has priority on mobile instead of being buried under generic wrapper copy and the "No job loaded" context card.
- Kept the existing five-tool launcher model and did not add fake provider behavior, fake payment handling, fake sending, or homeowner scope.
- Strengthened `npm run test:ui:tools` so it verifies real fractional math, including `7 1/2 + 2 1/4 = 9 3/4`, before screenshot capture.
- Rendered QA passed for Tools at desktop and mobile through `npm run test:ui:tools`; screenshots were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- Broader mobile shell QA passed through `npm run test:ui:mobile-actions`; screenshots were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- Production deployment was performed through Railway from `master`. `EXPECTED_SOURCE_COMMIT=d413dc8577862835bd4af3961d590b3cb3c58dbd npm run monitor:production` passed against `https://rivt.pro` with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 699 ms duration.

## Latest Packet 08 Pass - Work Flow Cleanup, Trade News Mobile Thumbnails, and Tools Mobile Header

- Verified the current Work audit findings against `master`: the local-device job creation modal was unreachable, the top Work `Pipeline` button opened a stale local-storage path, and bulk selection mixed API jobs with local-storage mutation/export behavior.
- Removed the unreachable local Work job creation modal, `rivt.jobs.v1` local job helpers, local jobs section, stale top-level pipeline modal trigger, and API/local-storage bulk action bar from `src/features/work/WorkWorkspace.tsx` and `src/features/work/work-workspace.css`.
- Work now exposes a single contractor creation path through the existing server-backed `Create job` action, and the only visible Pipeline path is the API-backed contractor section tab.
- Work API load errors are no longer masked by a local browser fallback; failures now surface directly with the existing retry action.
- Improved mobile Trade News fallback thumbnails so source tiles show a stronger source initial plus visible label instead of looking like blank placeholder media, and added a right-edge fade to horizontally scrollable Shop Talk filter/chip rows.
- Tightened the Tools mobile section header so the `LAUNCH SET` eyebrow and heading stack cleanly instead of forming an uneven two-column wrap.
- Rendered QA passed for the affected surfaces: `npm run test:ui:work-lifecycle`, `npm run test:ui:shop-talk-news`, `npm run test:ui:tools`, and `npm run test:ui:mobile-actions`. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- No requirement maturity moved in this pass; this was controllable UX hardening and removal of stale frontend-only production paths.
- Production deployment was performed through Railway from `master`. `EXPECTED_SOURCE_COMMIT=01b7b6b5c5c173091a5413f2db935b4078b8f8e2 npm run monitor:production` passed against `https://rivt.pro` with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 554 ms duration.

## Latest Packet 08 Pass - Launch Readiness Machine Gate Sweep

- Re-ran the current automated launch gate set after the Work draft editor date-normalization hotfix and latest production deployment, without adding new product scope.
- Rendered local click-path smokes passed for the primary mobile surfaces: `npm run test:ui:mobile-actions`, `npm run test:ui:work-lifecycle`, `npm run test:ui:tools`, and `npm run test:ui:shop-talk-news`.
- Screenshot evidence for the rendered smokes was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Machine readiness gates passed: `npm run incident:readiness -- --require-ready` and `npm run launch:readiness -- --require-ready`.
- Production monitor passed against `https://rivt.pro` with `EXPECTED_SOURCE_COMMIT=aac69811ef6d9b4088e5f4c95bc4bc3886a904ce`; live health reported service `rivt-api`, PostgreSQL, S3-compatible object storage, configured Sentry, no missing storage variables, seven anonymous private-route checks, and operational controls off.
- Full local verification gates passed for this sweep: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- No new P0/P1 automated launch blocker was found in the controllable machine coverage.
- Authenticated live contractor publish smoke cannot be repeated again on the shared production test contractor until its server-owned daily publish limit resets or a fresh dedicated production test contractor is created; the last successful live contractor smoke remains `contractor-click-20260628212559-2114c1`, and later failures returned the expected `JOB_PUBLISH_LIMIT_REACHED` policy response.
- Remaining Gate A launch-quality boundary: physical/manual device evidence for iOS Safari install mode, Android Chrome install mode, desktop keyboard-only use, screen reader labels, real slow-cellular behavior, and any legal/support approval artifacts not already recorded.

## Latest Packet 08 Pass - Work Draft Editor Date Normalization Hotfix

- Fixed the mobile Work job editor path that could surface `Request validation failed for preferredStartDate` when editing a saved draft whose preferred start date was absent or retained as an older timestamp-shaped value.
- `JobEditorModal` now normalizes preferred start dates into the server-accepted `YYYY-MM-DD` shape for the date input and sends only `YYYY-MM-DD` or `null`; optional application deadlines continue to send offset datetimes or `null`.
- Improved validation copy mapping so any future preferred-start-date validation issue shows a user-facing `preferred start date` label instead of the internal `preferredStartDate` field name.
- Strengthened `npm run test:ui:work-lifecycle` so the contractor flow opens a draft editor with timestamp-shaped preferred date data, saves it, and fails if the payload contains an empty string or non-date preferred start value.
- Strengthened `npm run smoke:contractor-click-path:live` so the authenticated production contractor smoke creates a draft with no preferred start date, opens Edit job in the 390px mobile UI, saves the draft without the validation error, then publishes and closes the temporary job.
- Required local gates passed after this hotfix: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:work-lifecycle`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- Production deployment was performed through Railway from `master`; live `/api/health` served source `4fa7d083ad19b390e0ac5ddd30c379edd1b85641` on `https://rivt.pro`, with PostgreSQL, S3-compatible object storage, and configured Sentry.
- `EXPECTED_SOURCE_COMMIT=4fa7d083ad19b390e0ac5ddd30c379edd1b85641 npm run monitor:production` passed with seven anonymous private-route checks, provider dependencies healthy, operational controls off, and 533 ms duration.
- Final authenticated live contractor smoke passed with run `contractor-click-20260628212559-2114c1`; screenshots were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-contractor-click-path-live`.
- Follow-up live contractor smoke reruns after the successful verification were stopped by the server-owned production publish rate limit for the shared test contractor (`JOB_PUBLISH_LIMIT_REACHED`, 10 used of 10). That is expected after repeated live verification runs and is not evidence of the date-normalization bug recurring.

## Latest Packet 08 Pass - Live Contractor Click-Path and Mobile Containment

- Added `npm run smoke:contractor-click-path:live` as a repeatable authenticated production UI smoke for the contractor pilot path. The smoke requires `RIVT_LIVE_TEST_PASSWORD`, logs in as the production test contractor, creates a publish-ready draft through the live API, drives the 390px mobile UI, publishes the draft from Work, verifies the job under Open work, checks Search -> Tools, Crew invite planning, Shop Talk -> Trade News, Notifications -> Records, no horizontal overflow, no post-login failed responses, and cleanup closes the temporary job.
- The first live runs caught real issues instead of being treated as test noise: Work mobile tabs pushed off-screen, Work draft detail used list data without the private jobsite address and disabled Publish, and Crew invite planning could land under the fixed mobile nav during automated tap checks.
- Fixed those issues by making Work section/detail tabs wrap into mobile-safe grids, hydrating selected contractor job details from the canonical job endpoint before publish-readiness checks, and adding mobile scroll-margin for focus/tap targets so controls clear the bottom nav.
- Required local gates passed for the final slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:work-lifecycle`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- Production deployment was performed through Railway from `master`. Railway deployment `f3168081-4b7b-4eb0-970c-c83cf82082dc` served source `c911914f90e748c2a8c58763de3196c4865f9382` on `https://rivt.pro`; live `/api/health` returned ready migration `0013_album_storage_scope`, PostgreSQL, S3-compatible object storage, and configured Sentry.
- `EXPECTED_SOURCE_COMMIT=c911914f90e748c2a8c58763de3196c4865f9382 npm run monitor:production` passed with seven anonymous private-route checks, provider dependencies healthy, operational controls off, and 557 ms duration.
- Final authenticated live contractor smoke passed with run `contractor-click-20260628201612-637417`; screenshots were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-contractor-click-path-live`.

## Latest Packet 08 Pass - Work Lifecycle Bridge and Active-Work Tool Paths

- Added active-work bridge actions inside Work detail so accepted work can open the real Daily Log mini-app, Records/photos workspace, and Invoice Draft app directly from the job lifecycle surface instead of leaving users to hunt through Tools.
- Wired App-level tool launch state into `ToolsStudio` so Work can request a specific tool (`daily-log` or `invoice`) while preserving the existing single Tools route and without inventing unsupported deep links.
- Added repeatable rendered Work lifecycle smoke coverage through `npm run test:ui:work-lifecycle`. The smoke covers contractor draft publish without the previous validation-error path, contractor applicant shortlist/offer, tradesperson application draft/submit, tradesperson offer acceptance, active-work Daily Log launch, Records/photos launch, Invoice Draft launch, zero page/console errors, and no mobile horizontal overflow.
- Updated the existing Tools rendered smoke to align with the current Records UI text hierarchy instead of waiting for a retired heading role.
- Rendered QA passed for the Work lifecycle path. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`.
- Required local gates passed after this slice so far: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:work-lifecycle`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- Production deployment was performed through Railway from `master`. Live `/api/health` served source `b6f6496178e55648eddad5226326007ea6c0a032` with ready migration `0013_album_storage_scope`, PostgreSQL, S3-compatible object storage, and configured Sentry.

## Latest Packet 08 Pass - Solo Click-Path Audit and Focused Tools Launcher

- Reduced the Tools hub to five primary field apps only: Heavy 16th calculator, Estimate, Invoice, Daily log, and Records & photos. Secondary utilities remain preserved in code for future access, but they are no longer exposed as cluttered primary launcher buttons.
- Updated Tools copy so each visible app has a clearer purpose: field math, pricing, direct-pay invoice drafts, site records, and accepted-work closeout records/photos.
- Improved Records behavior from the Tools launcher: one accepted record now opens automatically, the selected record has a visible active state, and the misleading "Find work" action is hidden when accepted records already exist.
- Expanded the mobile click-path smoke audit to cover the Home "Post work" modal open/close path, five-card Tools launcher, absence of deprecated Material Takeoff/secondary tool cards from the main launcher, Records & photos routing, Shop Talk bottom-nav routing, Trade News routing, and panel/action tapability without horizontal overflow.
- Updated Tools and jobs-discovery E2E coverage to match the simplified five-app Tools model and to route Records & photos through the real Records screen instead of the retired primary Material Takeoff card.
- Cleaned UI screenshot evidence directories before every rendered smoke run so stale screenshots from removed surfaces cannot be mistaken for current QA evidence.
- Rendered QA passed for mobile actions, Tools, and Shop Talk/Trade News. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`. The first default test run hit the command timeout, then passed with a longer timeout.
- Production deployment was performed through Railway from `master`. Live `/api/health` served commit `41247df7a0c3abe17b1ef9de26a85b1b30f2e018` with ready migrations, PostgreSQL, S3-compatible object storage, and configured Sentry.

## Latest Packet 08 Pass - Mobile Action Audit, Install Icon, and Profile Overlay Hardening

- Updated PWA/install icon metadata so Android and notification surfaces prefer the high-contrast approved dark maskable RIVT mark instead of the low-contrast light shortcut crop.
- Updated notification icons in the app, push-notification hook, and service worker to use the same maskable RIVT icon path for consistency across installed-app and notification surfaces.
- Raised the legacy account/notification panel backdrop above the fixed mobile nav, added mobile safe-area bottom padding, and tightened panel sizing so panel actions remain tappable instead of sitting under the nav.
- Stopped the profile setup overlay from auto-opening on Settings/Safety/Reviews/Feedback for already-complete sessions. The setup flow is now launched only from the explicit Settings "Redo setup" action and has a visible close button.
- Extended the mobile action smoke test to validate notification quick actions, Records routing, Settings routing, Crew invite planning, profile-panel sign-out tapability, global search routing, and absence of horizontal overflow.
- Rendered QA passed for the updated mobile action paths. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- Production deployment was performed through Railway from `master`. Live `/api/health` served commit `c2fd05bc23ae36c346849b4aa9203612f67a039f` with ready migrations, PostgreSQL, S3-compatible object storage, and configured Sentry. Live `/api/storage` returned `401 Unauthorized` without an authenticated session, so public storage readiness was verified through `/api/health`.

## Latest Packet 08 Pass - Five-Point Mobile UX, Tools, Crew, and Trade News Hardening

- Removed the duplicate Home weather/drive-time block and static quick-action strip so Home no longer opens with redundant forecast cards, repeated job-site copy, and a second row of low-context action buttons.
- Removed the unused Home-to-Tools pending launch bridge after the duplicate quick-action strip was removed, keeping Tools entry through the primary Tools tab and tool hub.
- Tightened the Crew mobile layout so the invite planner, member panel, input grid, and actions stay inside the viewport on phone widths instead of pushing fields/buttons off-screen.
- Simplified the Tools hub by removing the duplicate app launcher strip and making the tool cards the single launcher surface, with compact responsive cards and a clearer secondary-tools disclosure.
- Compressed Trade News cards for mobile reading: smaller thumbnails, tighter headlines/meta, less summary text, denser source links, and smaller detail hero media so users can scan more than one article per screen.
- Extended the mobile action smoke test to assert the removed Home blocks stay gone, Crew inputs remain contained, and the Tools flow opens from the canonical tool card rather than the removed duplicate launcher.
- Rendered QA passed for the updated Home, Crew, Tools, and Trade News surfaces. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- Production deployment was performed through Railway from `master`. Deployment `eda4b53a-7654-4ac7-81ae-b4f8857e260f` served commit `ed7778e6909f1b169f2bb02c5cd932d2bab7f8c9` on `https://rivt.pro`; live `/api/health` returned healthy PostgreSQL, S3-compatible object storage, ready migrations, and configured Sentry.

## Source State

Packet 00 is merged on `master` at `4c199d903683e44d17b7985272c399c6d7a6cbd6`. The checkpoint preserves:

- Pre-existing Shop Talk/Trade News work: `server/index.js`, `src/App.tsx`, `src/features/network/NetworkHub.tsx`, `src/styles.css`
- Packet 00 safety work: auth/session/API hardening, dependency fixes, tests, and delivery documentation
- Product source of truth: `RIVT_MASTER_BUILD_PROMPT.md`

Do not discard or overwrite the pre-existing Trade News work when committing or splitting this packet.

## Latest Packet 08 Pass - Tools, Server, Styles, Shop Talk, and Trade News Liability Reduction

- Continued the Tools strangler split by extracting invoice drafting, daily log, job photos, material takeoff, time tracking, bid building, expense logging, and earnings dashboard behavior into dedicated feature modules: `src/features/tools/InvoiceDraftTool.tsx`, `src/features/tools/DailyLogTool.tsx`, `src/features/tools/JobPhotosTool.tsx`, `src/features/tools/MaterialsTool.tsx`, `src/features/tools/TimeTrackerTool.tsx`, `src/features/tools/BidBuilderTool.tsx`, `src/features/tools/ExpenseLoggerTool.tsx`, and `src/features/tools/EarningsDashboardTool.tsx`.
- Preserved the Gate A honesty boundary in Tools: invoice email/text actions still open user-owned drafts only, Records writes still require accepted active work, and no fake SMS, email, payment processing, escrow, payroll, tax filing, or frontend-only closeout success was added.
- Split server liabilities by extracting Trade News aggregation into `server/news.js`, server-owned Shop Talk reaction/reputation routes into `server/shop-talk.js`, the legacy/integration bridge into `server/legacy-integrations.js`, and photo album/media routes into `server/albums.js`; `server/index.js` now registers those modules instead of owning those implementations inline.
- The legacy/integration bridge extraction preserved existing route contracts for retired app-state/events/payment-export endpoints, managed uploads, identity and subscription provider readiness stubs, notification provider checks, and invoice email/SMS provider delivery.
- Split the global stylesheet by moving Shop Talk/Trade News styles into `src/features/shop-talk/shop-talk.css` and legacy Tools styles into `src/features/tools/tools-studio.css`, reducing `src/styles.css` from roughly 218 KB to roughly 180 KB in this pass.
- Polished the Tools hub into a focused core-tool launcher with secondary utilities collapsed behind an explicit control, added a clearer Records command strip, allowed fallback Trade News thumbnails to render in the improved card/detail layout, tightened the Trade News mobile feed header/card density, and fixed the authenticated app so completed users no longer see the legacy local setup dialog.
- Fixed draft-job publish from stale frontend state by refreshing the canonical job before publish transitions and surfacing field-specific validation messages for publish blockers.
- Hardened the Tools, Shop Talk/Trade News, and jobs-discovery rendered smoke/E2E tests by blocking service workers in the Playwright browser context so mocked API calls are not bypassed by PWA caching, kept the Home greeting assertion aligned with the time-aware greeting copy, and extended `lint:security` so extracted server modules remain inside the security-lint gate.
- Rendered QA passed for Tools and Shop Talk/Trade News at desktop and mobile sizes. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass` and `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- Production deployment was performed through Railway from `master`. Deployment `97915261-3fc8-499d-bfcd-04a7811990a5` served the new frontend assets, and follow-up deployment `2cf692b0-b88e-45c8-98da-f164d07b2c7d` corrected the reported health commit metadata. Live `/api/health` returned healthy PostgreSQL, S3-compatible object storage, ready migrations, and configured Sentry. Live `/api/news?location=Jacksonville%2C%20FL` returned 30 items with 13 article thumbnails, 9 feed thumbnails, and 8 fallback thumbnails. Authenticated production UI publish testing remains blocked until a valid production test login is available; the provided `rivttesting@gmail.com` credentials returned invalid credentials.

## Latest Packet 08 Pass - Improvement Backlog and Truthful Entitlement Cleanup

- Added `docs/product/RIVT_IMPROVEMENT_BACKLOG.md` as a 240-item product, architecture, UX, tools, records, Shop Talk, Trade News, operations, and polish backlog. It preserves the trades-only boundary and separates Gate A truthfulness from later product scope.
- Removed frontend-only Pro unlock behavior from the Stripe return path. `?upgraded=1` now records only a non-entitlement session marker and cleans the URL.
- Changed RIVT Pro access to fail closed by default. Browser-local Pro state is ignored unless `VITE_ALLOW_LOCAL_PRO=true`, which is documented as local-development only and must not be enabled in production.
- Changed the Pro upgrade modal to show truthful setup copy when checkout/server entitlements are not configured instead of simulating payment success.
- Documented `VITE_STRIPE_CHECKOUT_URL` and `VITE_ALLOW_LOCAL_PRO` in `.env.example` and `PRODUCTION.md`, including the requirement that paid access must become server-owned before launch billing.
- Removed the local-only fake application submitted path from Work. Non-canonical local job drafts now explain that applications require a server-backed published job and disable application submission.
- Removed seeded author reputation values from Shop Talk so visible reputation is derived from current posts/answers/reactions rather than demo scores.
- Polished a Crew assignment empty state that exposed an internal `rivt.jobs.v1` storage key and cleaned a Packet 08 title encoding artifact.
- Required gates passed after this pass: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.

## Latest Packet 08 Pass - Tools Extraction and Provider Documentation Hardening

- Reviewed the Claude master-branch audit against the current local `master`: `src/App.tsx` is already reduced to 1,194 lines locally, lint is green, Shop Talk has a feature folder, and sensitive auth endpoints use the durable `authRateLimit` created by `createDurableRateLimiter`.
- Continued the Tools strangler migration by moving Heavy 16th calculator behavior into `src/features/tools/FieldCalculatorTool.tsx` and estimate-builder behavior into `src/features/tools/EstimateTool.tsx`.
- Preserved existing calculator modes, copy output, estimate inputs, target range calculation, and tool hub launch behavior while reducing `src/features/tools/ToolsStudio.tsx` to 1,259 lines.
- Hardened `PRODUCTION.md` with explicit Railway Object Storage setup guidance, private signed-URL expectations, object-storage fail-closed behavior, and Resend fail-closed signup/password-recovery behavior.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- No production deployment was performed for this refactor/documentation slice.

## Latest Packet 08 Pass - App Activity Feed Hook Extraction

- Continued the incremental `App.tsx` split by moving local activity feed state, toast state, toast auto-dismiss timing, notification-to-activity mapping, unread activity counts, and activity event recording into `src/app-shell/useActivityFeed.ts`.
- Preserved activity toast behavior, activity panel fallback behavior, notification activity prioritization, mark-all-read behavior, and server event recording payloads.
- `src/App.tsx` is now reduced to 1,194 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - App Theme Hook Extraction

- Continued the incremental `App.tsx` split by moving theme mode, theme palette, CSS variable application, color-scheme application, and localStorage persistence into `src/app-shell/useAppTheme.ts`.
- Preserved dark/light theme toggle behavior, tool-manufacturer palette selection behavior, and profile/account panel theme controls.
- `src/App.tsx` is now reduced to 1,230 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Shop Talk Reaction Hook Extraction

- Continued the incremental `App.tsx` split by moving server-owned Shop Talk reaction target batching, ledger loading, pending state, reaction commits, and reaction reset behavior into `src/features/shop-talk/useCommunityReactions.ts`.
- Preserved Shop Talk reaction error toasts, server-owned reaction status, answer/thread vote behavior, and logout/session reset behavior.
- Removed reaction aggregate and ledger types from `src/app-shell/app-state-types.ts` because the hook now owns them.
- `src/App.tsx` is now reduced to 1,256 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - App State Type Extraction

- Continued the incremental `App.tsx` split by moving App-owned account, auth, activity, feedback, payment, reaction-aggregate, crew shout-out, and Work filter type contracts into `src/app-shell/app-state-types.ts`.
- Removed duplicate Shop Talk post/reaction type declarations from `src/App.tsx` by importing the existing exported contracts from `src/features/shop-talk/ShopTalkView.tsx`.
- Preserved account/session state, activity feed, payment record, Shop Talk reaction, and Work filter behavior.
- `src/App.tsx` is now reduced to 1,404 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Work Empty State and Runtime Helper Extraction

- Continued the incremental `App.tsx` split by moving the Work empty-job fallback into `src/features/work/empty-job.ts`.
- Moved the retired generic event bridge helper, time label formatter, and idempotency-key generator into `src/lib/app-helpers.ts`.
- Preserved selected-job fallback, activity timestamp, activity event no-op, and Shop Talk reaction idempotency-key behavior.
- `src/App.tsx` is now reduced to 1,538 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Profile Training Data Extraction

- Continued the incremental `App.tsx` split by moving profile safety training metadata, quiz types, quiz data, record checklist, and training module labels into `src/features/profile/training-data.ts`.
- Preserved existing training-progress, record-goal, safety-module count, and safety quiz result typing behavior.
- `src/App.tsx` is now reduced to 1,580 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command used the isolated test Postgres through local `TEST_DATABASE_URL`.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Shop Talk Fallback Data Extraction

- Continued the incremental `App.tsx` split by moving static Shop Talk fallback news and founder/community prompt records into `src/features/shop-talk/fallback-data.ts`.
- Preserved route behavior and visible fallback content while removing route-owned static data from the main app shell.
- `src/App.tsx` is now reduced to 2,036 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Shop Talk Community Helper Extraction

- Continued the incremental `App.tsx` split by moving shared Shop Talk score sorting, community badge labeling, and server-owned reaction key helpers into `src/features/shop-talk/community-utils.ts`.
- Preserved behavior boundaries: App-level community badges keep the existing 10/25 answer thresholds, while the Shop Talk screen keeps its existing 3/8 screen-level thresholds.
- `src/App.tsx` is now reduced to 2,152 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Dead Guest Job Fixture Removal

- Removed the unreferenced `guestDemoJobs` fixture from `src/App.tsx`; the fixture contained local demo job content and was not used by any active screen.
- Verified no remaining references to the deleted guest-demo job titles or `guestDemoJobs` symbol.
- `src/App.tsx` is now reduced to 2,180 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Work Mapping Extraction

- Continued the incremental `App.tsx` split by moving trade-code, difficulty-label, and work-type-label mappings into `src/features/work/work-mappings.ts`.
- Preserved Work filter, profile publish, and onboarding specialty mapping behavior exactly.
- `src/App.tsx` is now reduced to 2,324 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - App Preference Helper Extraction

- Continued the incremental `App.tsx` split by moving theme, palette, and auth-mode storage keys plus their browser preference readers into `src/app-shell/preferences.ts`.
- Preserved theme persistence, palette persistence, auth-mode session persistence, and fallback behavior exactly.
- `src/App.tsx` is now reduced to 2,366 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - App Route Metadata Extraction

- Continued the incremental `App.tsx` split by moving app route labels, destination mapping, path aliases, and page-title metadata into `src/app-shell/routes.ts`.
- Removed the duplicate `NavLabel` definition from `src/app-shell/AppPanels.tsx`; shell panels now import the shared route type.
- Preserved navigation behavior and URL paths exactly; this slice moves pure route metadata only.
- `src/App.tsx` is now reduced to 2,393 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Account Activity Panel Extraction

- Continued the incremental `App.tsx` split by moving notification toast, notification panel, account panel, avatar fallback, account stat item, and theme-palette picker presentation into `src/app-shell/AppPanels.tsx`.
- Preserved activity, account, theme, logout, notification-read, and navigation state ownership in `src/App.tsx`; this slice moves shell panel UI only.
- `AccountPanel` now receives record and safety target counts as props instead of reading App-local constants directly.
- `src/App.tsx` is now reduced to 2,522 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Auth Screen Extraction

- Continued the incremental `App.tsx` split by moving auth, verification/reset, guest prompt, onboarding, theme toggle, and progress-bar presentation into `src/features/auth/AuthScreens.tsx`.
- Added `src/lib/api.ts` as the shared API URL helper so the moved auth-link and Google-start flows use the same API base behavior as the authenticated app.
- Preserved auth/session/onboarding state ownership in `src/App.tsx`; this slice moves UI and helper presentation only.
- `src/App.tsx` is now reduced to 2,836 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Legacy Sidebar Export Cleanup

- Removed the unused deprecated `Sidebar` and `MobileNavStrip` exports from `src/App.tsx` after verifying no references in `src` or `test`.
- Removed the private legacy nav item and role-filter helper data that only existed to support those deprecated exports.
- This further reduces the chance of reintroducing stale authenticated shell patterns outside the active AppShell route.
- `src/App.tsx` is now reduced to 3,561 lines.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Legacy App View Cleanup

- Continued the incremental `App.tsx` split by removing unreachable deprecated legacy view blocks after call-site verification.
- Removed the inactive `OperationsWorkspace`, old `MarketplaceView`, and old `PostJobModal` paths from `src/App.tsx`; the active authenticated app remains routed through HomeDashboard, WorkWorkspace, ShopTalkView, NetworkHub, InboxCenter, ProfileRoute, ToolsStudio, and the lightweight LegacyBridge.
- Preserved only shared helpers still used by active onboarding/account/profile surfaces, including route mapping and `ProgressBar`.
- `src/App.tsx` is now reduced to 3,745 lines, down from the 10,339-line starting point recorded in the master hardening plan.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Shop Talk Route Split

- Continued the incremental `App.tsx` split by moving the active Shop Talk and Trade News view into `src/features/shop-talk/ShopTalkView.tsx`.
- Preserved the existing Shop Talk props, server-owned reaction state handoff, Trade News live fetch behavior, filters, answer queue, reporting, and post composer behavior.
- `App.tsx` now imports the Shop Talk surface instead of owning the full active screen implementation, reducing the main application file by another large route slice.
- Focused gates passed after this extraction before the full packet run: `npm run build`, `npm run lint`, and `npm run test:unit`.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Profile Session Ownership Split

- Moved Profile session-list loading and non-current session revocation from `src/App.tsx` into `src/features/profile/ProfileRoute.tsx`.
- `App.tsx` now keeps only the whole-app auth teardown callback for the current-session revocation case, because clearing auth still affects the shell, inbox, jobs, and Shop Talk reaction state.
- Preserved existing server endpoints and response handling for `GET /api/v1/sessions`, `DELETE /api/v1/sessions/:id`, and `POST /api/v1/sessions/revoke-others`; no auth/security route behavior changed.
- Required gates passed after this slice: `npm run build`, `npm run test:unit`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - App Profile Route Split

- Started the incremental `App.tsx` split with the Profile surface, adding `src/features/profile/ProfileRoute.tsx` as the active profile route adapter.
- Moved ProfileHub prop-shaping and canonical-profile mapping out of `src/App.tsx` while preserving the existing server-owned account, session, theme, logout, and profile mutation handlers in place.
- This intentionally does not move auth/session ownership yet because the profile session list is still coupled to both Settings and the account-panel menu. The next safe extraction is to separate that account/session owner after the active render path is slimmer.
- Required gates passed after this slice: `npm run build`, `npm run test:unit`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this refactor slice.

## Latest Packet 08 Pass - Frontend Smoke Test Tripwire

- Added `test/frontend-smoke.test.mjs`, a Vite SSR + React server-render smoke suite that mounts Home, Work, Profile, and AppShell with explicit mock props and fails on render crashes.
- Wired the smoke suite into `npm run test:unit`, so `npm run test` now catches basic frontend white-screen regressions before the larger App refactor work.
- No new npm dependencies were added; the suite uses existing Node test, Vite, React, and `react-dom/server`.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The full `npm run test` command was run with explicit network access because the integration suite uses the isolated test Postgres.
- No production deployment was performed for this test-coverage slice.

## Latest Packet 08 Pass - Async Password Hashing

- Replaced blocking `scryptSync` password derivation in `server/index.js` with promisified async `scrypt`, preserving salt generation, 64-byte key length, and timing-safe hash comparison.
- Updated signup, login, Google first-account creation, and password reset call sites to await password hashing/verification instead of blocking the Node event loop during credential work.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The first sandboxed `npm run test` attempt timed out without useful output; the same command passed after rerun with explicit network access to the configured isolated test Postgres.
- No production deployment was performed for this server hardening slice.

## Latest Packet 08 Pass - Exact Direct Dependency Pinning

- Replaced all direct `package.json` dependency and devDependency ranges/`latest` values with exact versions already resolved in `package-lock.json`.
- Added `.nvmrc` with Node major `20` to align local/runtime expectations with the Railway Node 20 target while keeping `engines.node` at `>=20`.
- Ran `npm install`; npm reported the tree up to date and updated only the root lockfile metadata from ranges to exact direct versions.
- Required gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- The first sandboxed `npm run test` attempt failed because network access to the isolated Railway test Postgres was blocked (`EACCES`); the same command passed after rerun with explicit network access.
- No production deployment was performed for this dependency pinning slice; runtime product behavior is unchanged.

## Latest Packet 08 Pass - Local TEST_DATABASE_URL Configuration

- Created an isolated `rivt_test` database on the existing Railway Postgres service for local DB-backed integration testing. This is separate from the production app database and is used only through ignored local `.env` configuration.
- Wrote `TEST_DATABASE_URL` to local `.env` without committing the secret value and added a blank `TEST_DATABASE_URL=` placeholder to `.env.example`.
- Updated `npm run test:integration` to load `.env` through `node --env-file-if-exists=.env`, so local runs use the configured test database while CI or other machines can still inject `TEST_DATABASE_URL` through environment variables.
- Fixed integration-test repeatability issues exposed by the newly active database suite: separated text session id and UUID account id parameters in project upload setup, compared legacy `app_state.id` as text, updated the Shop Talk consent version, made the Shop Talk reaction target unique per run, and raised auth rate limits inside DB-backed integration tests only.
- `npm run test:integration` now executes the DB-backed suite locally with 12 passed, 0 failed, and 0 skipped.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- No production deployment was performed for this setup/configuration slice; runtime product behavior is unchanged.

## Latest Packet 08 Pass - Server-Owned Profile Search

- Added authenticated `GET /api/v1/profiles` profile discovery for published network profiles only.
- The route requires an active, completed account, excludes the viewer, excludes blocked account pairs, searches profile name/headline/location/trades, clamps result count to eight, and returns only public profile fields.
- Replaced the search modal's profile placeholder with live People results, loading/error/empty states, and privacy copy that contact details remain private until a real connection or active job requires them.
- Selecting a person result routes to Crew without claiming profile detail pages or direct contact access that do not exist yet.
- Expanded `test/jobs-discovery.e2e.mjs` to prove `Ctrl+K -> People result -> Crew`, then the existing `Search work` flow; the e2e harness now also mocks external font CSS and notification-read requests so CI remains hermetic.
- Rendered validation used Playwright fallback because the Browser plugin reported the in-app browser target unavailable (`iab`). Desktop and mobile screenshots for profile search and Crew result navigation were captured outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-profile-search-1782153354986`; both runs had zero console warnings/errors.
- Local gates passed for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`. DB-backed local integration tests still skip because `TEST_DATABASE_URL` is not configured.
- Deployed to Railway production through runtime upload deployment `1f29a48c-89aa-45a0-8554-dfce1d386924` and metadata redeploy `58a361b4-0f0a-41b5-8309-d3a4104fc1eb`.
- Live `/api/health` reports exact source `cda9733acdaa7ed858b819fc9b5904ee2c237600`, PostgreSQL, S3-compatible object storage, and Sentry configured.
- `EXPECTED_SOURCE_COMMIT=cda9733acdaa7ed858b819fc9b5904ee2c237600 RIVT_MONITOR_TIMEOUT_MS=30000 npm run monitor:production` passed with seven anonymous private-route checks and operational controls off.
- Remaining honesty boundary: this is search-result discovery only. Full Crew directory, profile detail pages, connection requests, and contact exchange still need server-owned workflows before being represented as complete networking features.

## Latest Packet 08 Pass - Global Search Command Surface

- Replaced the global search modal's non-visible submit behavior with an explicit command surface for Work, Shop Talk, and Tools.
- Work search now receives the query and routes to the Work screen with the search input populated.
- Shop Talk search receives the query through the active authenticated shell and initializes the visible Shop Talk query field without claiming server-owned community search.
- Tools can be opened directly from the command surface.
- Added an honest note that people search remains blocked until profile discovery is server-owned; no fake profile matches are shown.
- Expanded `test/jobs-discovery.e2e.mjs` to prove `Ctrl+K -> Search work -> Work` routes correctly and preserves the query.
- Rendered validation used Playwright fallback because the Browser plugin reported the in-app browser target unavailable (`iab`). Desktop and mobile screenshots were captured outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-global-search-1782149323491`; both runs had zero console warnings/errors and verified the Work search query value.
- Local gates passed for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`. DB-backed local integration tests still skip because `TEST_DATABASE_URL` is not configured.
- Deployed to Railway production through runtime upload deployment `a4918783-b28c-4ab0-a606-851c631a62c3` and metadata redeploy `5c6c5a06-12b3-4ad8-a365-854a85ebcfdc`.
- Live `/api/health` reports exact source `98f4b6716674de57e6c38c497ea837105ad069b1`, PostgreSQL, S3-compatible object storage, and Sentry configured.
- `EXPECTED_SOURCE_COMMIT=98f4b6716674de57e6c38c497ea837105ad069b1 npm run monitor:production` passed with seven anonymous private-route checks and operational controls off.

## Latest Packet 08 Pass - Claude-Audit UI Consolidation

- Consolidated v2 design tokens for typography weights, info state colors, card shadow, sidebar/topbar sizing, and radius fallbacks so legacy and v2 CSS resolve consistently.
- Reduced CSS font weights to the five-token scale and normalized simple single-value border radii to the shared small/medium/large token scale while leaving custom compound and pill/circle shapes intact.
- Centralized shared primary, secondary, icon-button, modal-close, and skeleton primitives in `src/components/ui.css`, then removed duplicate local button definitions where they conflicted with the shared layer.
- Cleaned the Home surface by removing the editorial mission-copy block from `RIVT Daily`, keeping a compact section label, letting the signal grid own the section, moving reputation momentum to Profile, and tightening the mobile availability controls into a horizontal 52px row.
- Cleaned the shell by keeping active-job context visible consistently, reducing duplicate desktop account identity in the topbar, adding mobile safe-area spacing, and adding visible close controls to the search/job-editor modals.
- Improved missing/loading states with real Inbox skeleton cards, clearer Crew first-run empty states, and server-backed notification badge clearing through the existing `POST /api/v1/notifications/read` path when the notification center opens.
- Deliberately did not fake unified cross-surface search results because no unified `/api/v1/search` endpoint exists yet; the shell search still routes into the real Work search/filter behavior.
- Local gates passed for this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`. DB-backed local integration tests still skip because `TEST_DATABASE_URL` is not configured.
- Deployed to Railway production through runtime upload deployment `eb75395a-45c9-4d8d-b9cc-c9e63230fba9` and metadata redeploy `68e6eca4-8574-4c0c-b2a6-d533fc5cab47`.
- Live `/api/health` reports exact source `92fd0a71d6a39cd21c9b3e233c5caa2c1a37da54`, PostgreSQL, S3-compatible object storage, and Sentry configured.
- `EXPECTED_SOURCE_COMMIT=92fd0a71d6a39cd21c9b3e233c5caa2c1a37da54 npm run monitor:production` passed with seven anonymous private-route checks and operational controls off.

## Latest Packet 08 Pass - Accessibility Boundary Progress

- Deployed source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d` through Railway deployment `17cc18db-0ac5-4f23-bf5f-955b98af38cb`.
- Hardened `scripts/live-ui-accessibility.js` with optional screenshot capture, visible main/navigation landmark checks, visible-image `alt` checks, visible-form label/name/placeholder/title checks, and BOM tolerance for setup JSON created outside Node.
- The expanded production smoke caught two real issues and they were fixed before acceptance:
  - Shop Talk search input measured below the 44px touch target floor on a 360px phone; `src/styles.css` now raises `.shop-talk-search input` to a 44px minimum height.
  - Inbox metric labels clipped at 200% text on a 390px phone; `src/components/ui.css` allows metric labels to wrap and `src/features/inbox/inbox-center.css` stacks the Inbox summary on narrow phones.
- Production accessibility smoke `ui-a11y-20260622041456-3d6a3d` passed against `https://rivt.pro` and source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`.
- The smoke covered contractor/tradesperson 360x800 and 390x844 phones, contractor 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and contractor 390x844 with 200% root text scale.
- Each scenario audited Home, Work, Crew, Shop Talk, Tools, and Home again, plus opened top-bar search, notifications, account/profile, and messages/inbox surfaces.
- Every scenario reported `consoleWarningsOrErrors: 0`, `smallTargetCount: 0`, `missingImageAltCount: 0`, `unlabeledFieldCount: 0`, top-bar search/messages/notifications/profile present, no role toggle, no More tab, reduced-motion preference, named keyboard focus targets, and no horizontal overflow.
- Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-a11y-20260622041456-3d6a3d` with 72 PNGs.
- Disposable production smoke accounts were cleaned up with `accountsClosed: 2`.
- Post-documentation gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, `git diff --check`, `npm run incident:readiness -- --require-ready`, and `npm run launch:readiness -- --require-ready`.
- `npm run monitor:production` passed after deployment and after this evidence update, reporting exact source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`, PostgreSQL, S3-compatible object storage, Sentry configured, operational controls off, and seven anonymous private-route checks.
- Added `docs/quality/PHYSICAL_ACCESSIBILITY_CHECKLIST.md` as the remaining physical iOS Safari, Android Chrome, desktop keyboard-only, and screen-reader route matrix.
- Remaining honesty boundary: scripted production accessibility evidence is materially stronger, but `GA-UX-006` remains `Partial` until physical-device and screen-reader/manual route evidence is completed.

## Latest Packet 08 Pass - Final Incident Approvals Recorded

- Recorded Michael's explicit approval for founder, support, and legal/safety Gate A signoffs in `docs/operations/incident-routing.json`.
- Approval timestamp: `2026-06-22T03:48:04.1166525Z`.
- `node scripts/incident-readiness-check.js --json` now reports `ready` with zero findings.
- `node scripts/launch-readiness-check.js --json` now reports `ready` with zero findings.
- Remaining honesty boundary: the machine-readable incident and launch readiness gates are passing after these approvals, but the broader acceptance docs still call out physical/deeper manual accessibility-device evidence as the next launch-quality boundary before broader rollout.

## Latest Packet 08 Pass - Approval Packet Prepared

- Added `docs/operations/GATE_A_APPROVAL_PACKET.md` as the founder-facing signoff packet for the remaining founder/support/legal-safety approvals.
- The packet summarizes current evidence, approval scope, support posture, legal/safety posture, known risk acceptance, and the exact fields to update after explicit approval.
- Remaining honesty boundary: the packet was not approval by itself; Michael's follow-up approval is now recorded in `docs/operations/incident-routing.json`.

## Latest Packet 08 Pass - Incident Rehearsal Passed

- Re-authenticated Railway CLI as `zboytjbxp@gmail.com` and verified the linked project/service: project `RIVT`, production environment, service `RIVT`, public URL `https://rivt.pro`.
- `npm run monitor:production` passed against production, confirming exact source `6d8e276e036553c5f861f1f8ab97cc3333a3494b`, PostgreSQL and S3-compatible storage healthy, Sentry configured, operational controls off, and seven anonymous private-route checks failing closed.
- Local live smoke failed against the Railway internal DB hostname, then passed inside the service with `railway ssh --service RIVT --environment production -- npm run smoke:gate-a:live`.
- The service-local live smoke verified migration `0011_shop_talk_reaction_events_immutable`, zero seed/demo findings, seven anonymous private-route checks, operational controls off, five active accounts, zero network profiles, zero open jobs, two open support cases, zero active restrictions, 115 legacy app-state rows, and 111 rate-limit windows.
- Sent a harmless Sentry incident-rehearsal smoke event from inside Railway; Sentry accepted event `43fc7567f458490582db1f6642e2e0ea` with HTTP 200.
- Recorded the passed rehearsal in `docs/operations/incident-routing.json` and `docs/delivery/DEPLOYMENT_LEDGER.md`.
- Remaining honesty boundary: Gate A still requires founder/support/legal-safety approvals and physical/deeper manual accessibility-device evidence before named-cohort launch.

## Latest Packet 08 Pass - Incident Rehearsal Attempt Blocked

- Attempted Scenario A from `docs/operations/INCIDENT_REHEARSAL_RUNBOOK.md` against production on 2026-06-22.
- `npm run monitor:production` passed against `https://rivt.pro`, confirming exact source `6d8e276e036553c5f861f1f8ab97cc3333a3494b`, PostgreSQL and S3-compatible storage healthy, Sentry error monitoring configured, operational controls off, and seven anonymous private-route checks returning closed access.
- `npm run smoke:gate-a:live` could not run because `DATABASE_URL` is missing from the process; `.env` contains a blank `DATABASE_URL`, and Railway CLI variable lookup is blocked by expired auth (`railway login` required).
- Recorded the attempt as `status: "blocked"` in `docs/operations/incident-routing.json` and as `Incident Rehearsal Attempt - 2026-06-22` in `docs/delivery/DEPLOYMENT_LEDGER.md`.
- Remaining honesty boundary: this blocked attempt remains in the audit trail, but the follow-up pass above closed the incident rehearsal blocker.

## Latest Packet 08 Pass - Incident Routing Approved

- Approved the Gate A incident-routing plan in `docs/operations/incident-routing.json`.
- Recorded route approval by Michael at `2026-06-22T03:09:36.0366141Z` for the Gate A pilot scope: primary owner, backup owner, support hours, synthetic monitor, Sentry error monitoring, and first pilot escalation route.
- `node scripts/incident-readiness-check.js --json` is expected to stop reporting `INCIDENT_ROUTING_NOT_APPROVED`.
- Remaining honesty boundary: this approves the route design only. Gate A still needs a passed incident rehearsal and explicit founder/support/legal-safety approvals.

## Latest Packet 08 Pass - Recovery Policy Approved

- Approved Gate A recovery policy in `docs/operations/recovery-policy.json`: RPO 1440 minutes / 24 hours, RTO 240 minutes / 4 hours, 30-day backup retention, and 30-day restore-drill cadence.
- Set backup-retention and restore-drill owner to Michael for the Gate A pilot.
- Set next restore drill due date to `2026-07-21T04:18:59.000Z`, 30 days after the last passed named backup-artifact restore.
- Recorded founder and operations recovery-policy approvals by Michael at `2026-06-22T03:02:39.0867156Z`.
- `node scripts/launch-readiness-check.js --json` stopped reporting recovery-policy blockers. Remaining launch blockers are now incident rehearsal, founder/support/legal-safety approvals, and deeper manual accessibility/device evidence after the follow-up incident-routing approval pass.
- Remaining honesty boundary: the policy is approved for Gate A pilot only. RPO/RTO should be tightened before broader scale or any platform-held financial workflow.

## Latest Packet 08 Pass - Support Hours Recorded

- Recorded founder-provided Gate A support hours in `docs/operations/incident-routing.json`: Monday-Saturday, 9:00 AM-5:00 PM, America/New_York.
- `node scripts/incident-readiness-check.js --json` is expected to stop reporting `SUPPORT_HOURS_MISSING`; incident rehearsal and founder/support/legal-safety approvals remain blocked after the follow-up incident-routing approval pass.
- Remaining honesty boundary: this records the support coverage window, not final support/legal/founder approval.

## Latest Packet 08 Pass - Backup Incident Owner Recorded

- Recorded backup incident owner in `docs/operations/incident-routing.json`: Anya Tingle, partner / wife, `abota1994@gmail.com`.
- Phone status is `recorded`; the actual phone number is intentionally not stored in the repository.
- `node scripts/incident-readiness-check.js --json` stopped reporting `BACKUP_OWNER_MISSING`; support hours were recorded in the follow-up pass above.
- Remaining honesty boundary: backup ownership is recorded, but Anya still needs access/runbook orientation before we should treat incident response as operationally rehearsed.

## Latest Packet 08 Pass - Sentry Error Monitoring Configured

- Configured `SENTRY_DSN` and `ERROR_MONITORING_PROVIDER=sentry` on the Railway production `RIVT` service and redeployed through Railway deployment `eaa7409d-0e75-4ae4-8ac7-1aaa8c8e1a68`.
- Live `/api/health` reports exact source `6d8e276e036553c5f861f1f8ab97cc3333a3494b`, PostgreSQL and S3-compatible dependencies healthy, and `observability.errorMonitoring.mode=configured`.
- Sent a harmless smoke event named `RIVT Sentry smoke test`; Sentry returned HTTP 200 and the onboarding screen changed to `Error Received`.
- Verified Sentry's built-in alert rule `Send a notification for high priority issues` is connected to project `node-express`, set to notify suggested assignees or recently active members on every trigger, and triggered once for the smoke issue at 2026-06-22 02:38 UTC.
- Updated `docs/operations/incident-routing.json` so dedicated error monitoring is now `configured`; backup owner was recorded in the follow-up pass above.
- Updated `docs/operations/incident-routing.json` again so the Sentry high-priority issue alert is the first pilot escalation route. Dedicated phone/SMS paging remains recommended before broader scale, but the readiness `PAGING_ROUTE_MISSING` blocker is no longer expected.
- Remaining honesty boundary: Sentry ingestion and first escalation are configured. Gate A still requires support hours, incident rehearsal, RPO/RTO/retention/cadence approvals, founder/support/legal-safety approvals, and deeper manual device/accessibility evidence.

## Packet 08 Pass - Error Monitoring Readiness Hooks

- Deployed source `6d8e276e036553c5f861f1f8ab97cc3333a3494b` through Railway deployment `3260e837-ff72-4343-b0bd-4243ac02424f`.
- Added a dependency-light Sentry-compatible monitoring adapter in `server/monitoring.js` that reports honest setup state, redacts DSN material from status payloads, sanitizes captured context, and no-ops safely when no provider DSN is configured.
- Wired HTTP 500, startup failure, unhandled rejection, and uncaught exception capture hooks into the server without changing public health availability semantics.
- Extended public `/api/health` with non-secret `observability.errorMonitoring` status and authenticated `/api/readiness` with the full setup status so operators can see whether the monitoring provider is actually configured.
- Extended `npm run monitor:production` to include observability in its evidence output while keeping storage and private-route checks as the pass/fail contract.
- Added unit coverage for setup-required status, DSN redaction, no-op behavior when unconfigured, and sanitized Sentry-compatible event delivery.
- Local gates passed for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Readiness checks still correctly block launch: `node scripts/incident-readiness-check.js --json` reports backup owner, support hours, dedicated error monitoring provider, paging route, incident rehearsal, and approvals missing; `node scripts/launch-readiness-check.js --json` also reports recovery-policy RPO/RTO, retention, cadence, next-drill, and approval blockers.
- Live checks passed: `/api/health` reported exact source `6d8e276e036553c5f861f1f8ab97cc3333a3494b`, PostgreSQL and S3-compatible dependencies healthy, and `observability.errorMonitoring.mode=setup_required`; `npm run monitor:production` passed with the same source, healthy storage, operational controls enabled state unchanged, seven anonymous private-route checks, and observability evidence.
- Remaining honesty boundary: error monitoring was code-ready in this pass; it was configured in the follow-up Sentry pass above. Gate A still requires choosing a paging/escalation route, recording backup owner/support hours/approvals, and running a successful incident rehearsal.

## Latest Packet 08 Pass - Server-Owned Shop Talk Reactions and Reputation Ledger

- Deployed source `13f7e2e92ecc608e5326b0d1d335906700758584` through Railway deployment `718003b2-9b27-49fb-a36a-f01ea0528bf0`.
- Added canonical PostgreSQL tables for Shop Talk reactions and append-only reaction events in `0010_shop_talk_reactions`.
- Added migration `0011_shop_talk_reaction_events_immutable` after live proof exposed a real clear/delete bug: immutable reaction events cannot use `ON DELETE SET NULL` from the active reaction row. The fix removes that FK so reaction history remains append-only and active reactions can still be cleared.
- Added authenticated server routes for reaction aggregate batch loading, current-user reaction summary, and idempotent up/down/clear mutation: `POST /api/v1/shop-talk/reactions/batch`, `GET /api/v1/shop-talk/reputation/me`, and `POST /api/v1/shop-talk/reactions`.
- Replaced the prior browser-local Shop Talk reaction state with server-owned reaction state in the frontend. Reaction buttons now load viewer state from the API, disable while pending, show a failure toast if the server write fails, and no longer claim local-only reactions as production behavior.
- Added `npm run smoke:shop-talk-reactions:live`, a Railway-SSH live smoke that creates disposable invited accounts, verifies migration 0011, proves anonymous access fails closed, proves up/down/switch/clear/idempotency behavior through the real production API, verifies zero active reactions after clear, verifies five append-only reaction events and five audit events, then closes both smoke accounts.
- Live proof run `shop-talk-react-20260622020534-423b8b` passed on build `13f7e2e92ecc608e5326b0d1d335906700758584` with target `post:shop_talk_react_20260622020534_423b8b`, `activeReactionsAfterClear: 0`, `reactionEventsPersisted: 5`, `auditEventsPersisted: 5`, and `smokeAccountsClosed: 2`.
- Local gates passed for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `13f7e2e92ecc608e5326b0d1d335906700758584`, PostgreSQL and S3-compatible dependencies healthy, `npm run monitor:production` passed with seven anonymous private-route checks, and the authenticated Railway-SSH smoke verified migration `0011_shop_talk_reaction_events_immutable`.
- Remaining honesty boundary: reaction ownership is now production server-owned. Full Shop Talk production-grade social proof still requires canonical server-owned Shop Talk posts/answers, author-earned reputation totals, ranking, moderation queues, and profile reputation surfacing before treating Shop Talk as a complete durable social network.

## Packet 08 Pass - Daily Log Live UI Proof

- Deployed source `9c614ac2f8691186150e16583e7b204cbada590a` through Railway deployment `1c138a66-7015-4cfb-a2ad-48135b932c5d`.
- Added first-class live smoke command `npm run smoke:daily-log-ui:live` with full, setup-only, browser-only, and cleanup modes.
- Used Railway SSH setup mode to create disposable invited contractor/tradesperson accounts, publish a real job, accept real work, and leave an accepted-work fixture on production without bypassing app auth.
- Ran local browser-only mode against `https://rivt.pro`: logged in through the real auth form, opened Tools, selected Daily Log, verified `Records-ready`, saved the Daily Log through the authenticated Records API, verified the project bundle contained the marker, and captured screenshot evidence at `C:\Users\zboyt\AppData\Local\Temp\rivt-daily-log-live-smoke`.
- Live proof run `daily-log-ui-20260622004926-05a797` passed on build `9c614ac2f8691186150e16583e7b204cbada590a` with `dailyLogEntries: 1`, project `2d110b1a-258e-4516-b046-9ecfb735083e`, and active work `52a7ed95-365e-4d33-83e6-dde5bbc10a47`.
- Railway cleanup mode closed both disposable accounts and closed the smoke job for run `daily-log-ui-20260622004926-05a797`.
- Local gates passed for this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `9c614ac2f8691186150e16583e7b204cbada590a`, PostgreSQL and S3-compatible dependencies healthy, and `npm run monitor:production` passed with seven anonymous private-route checks.
- Remaining honesty boundary: this closes the exact Daily Log UI-to-Records live proof gap. Later Packet 08 passes closed external error monitoring/paging, incident-routing approval, RPO/RTO policy approval, and backup retention/cadence approval. Full Gate A still requires incident rehearsal, final support/legal/founder signoff, physical/deeper manual accessibility-device evidence, and production-grade server Shop Talk posts/reactions/reputation if promoted into launch scope.

## Packet 08 Pass - Daily Log Records Bridge

- Deployed source `d03f2a50e0df9297dc6c0e33c7eb83a6732cdd8b` through Railway deployment `95973719-d8de-42a7-854c-69833221c439`.
- Connected the Daily Log mini-app to the existing authenticated Records API when an accepted active-work record exists.
- Added a `Records-ready` state, accepted-work target card, and `Save to Records` action that opens/creates the private project record and writes the daily log as a project timeline note.
- Preserved the standalone field-tool fallback: without accepted work, Daily Log remains a clearly labeled device-local draft with copy/download/local-save options.
- Expanded `npm run test:ui:tools` to mock accepted work and project records, verify `Records-ready`, click `Save to Records`, and observe the server-backed success notice alongside the existing local draft, no-overflow, and zero console/page-error checks.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `d03f2a50e0df9297dc6c0e33c7eb83a6732cdd8b`, PostgreSQL and S3-compatible dependencies healthy, anonymous `/api/storage` returned 401 as expected for the private storage endpoint, and `npm run monitor:production` passed with seven anonymous private-route checks.
- Remaining honesty boundary: the rendered authenticated save flow is locally mocked. Production server routes already exist and are covered by project-record live smoke from prior Packet 06, but this exact Daily Log UI save path still needs an authenticated live UI smoke with accepted-work fixture before claiming end-to-end live UI evidence.

## Packet 08 Pass - Daily Engagement Loop

- Deployed source `aeb23caf2d09d9598adfcf3c7ad330e8bcaa9681` through Railway deployment `63a4f5aa-7b67-4e3e-9331-5ecd6dd8c0a6`.
- Expanded Home's `RIVT Daily` into a clearer habit loop: check work/crew, write a field record, and build Shop Talk reputation.
- Added a `Reputation momentum` Home panel with answer-queue, peer-proof, and news-watch signals plus direct actions to Shop Talk and the new Daily Log tool.
- Added a standalone Tools `Daily log` mini-app for crew hours, site notes, blockers, materials, safety notes, next steps, a field checklist, copy/download output, and an explicitly device-local draft.
- Added a Shop Talk `Reputation path` card so contributors can see the steps from first answer to verified fix to profile badge without claiming durable server-owned reputation yet.
- Expanded `npm run test:ui:tools` to verify the Daily Log tool on desktop/mobile, including entered notes, checklist toggles, preview output, local draft save, no horizontal overflow, and zero console/page errors.
- Expanded `npm run test:ui:shop-talk-news` to verify the Shop Talk reputation path alongside the answer queue and existing news/reaction coverage.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `aeb23caf2d09d9598adfcf3c7ad330e8bcaa9681`, PostgreSQL and S3-compatible dependencies healthy, anonymous `/api/storage` returned 401 as expected for the private storage endpoint, and `npm run monitor:production` passed with seven anonymous private-route checks.
- Remaining honesty boundary: Daily Log drafts are browser-local and Shop Talk reputation remains current-surface UI. Server-owned daily logs, streaks, analytics, posts, answers, reactions, moderation, and durable reputation still require canonical tables, authorization, provider/error handling, and live smoke evidence before being treated as production social proof.

## Packet 08 Pass - Shop Talk Answer Queue

- Deployed source `73f79ac63e22ceb07492fccd893b805a792d1ede` through Railway deployment `d717edd7-bd08-43f9-8f6e-eb213e45f8af`.
- Added a Shop Talk `Answer queue` card that surfaces unanswered questions in the user's primary trade plus General, with an `Answer now` path that jumps straight into the next thread and turns on the unanswered filter.
- Added an active `Electrical answer queue` filter chip and answer guidance card so contributors know what a useful field-tested answer should include.
- Updated Home's `Field signal` tile to call out open answer opportunities instead of only showing raw post counts, giving tradespeople and contractors a daily community reason to return.
- Tightened the skip-link visibility model so it remains accessible on keyboard focus but does not appear as an off-canvas artifact in full-page UI proof screenshots.
- Expanded `npm run test:ui:shop-talk-news` to verify the answer queue, `Answer now` interaction, selected detail thread, answer guidance, active queue filter, reaction toggling, Trade News original-source links, no horizontal overflow, and zero console/page errors at 1440x900 and 390x844. Screenshot evidence remains outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- In-app Browser path was attempted, but authenticated route mocking is not exposed by the Browser runtime; the dedicated Playwright UI smoke remains the rendered authenticated-surface evidence for this pass.
- Live checks passed: `/api/health` reported exact source `73f79ac63e22ceb07492fccd893b805a792d1ede`, PostgreSQL and S3-compatible dependencies healthy, anonymous `/api/storage` returned `Authentication required` as expected for the private storage endpoint, and `npm run monitor:production` passed with seven anonymous private-route checks.
- Remaining honesty boundary: the answer queue improves the current local Shop Talk surface and contributor loop. Durable server-owned Shop Talk posts, answers, reactions, follows, ranking, moderation, and reputation remain future work before Shop Talk can be treated as production-grade social proof.

## Packet 08 Pass - RIVT Daily Home Check-In

- Deployed source `436b83fb94f70d2dc0b831d2a7ee09c59d915882` through Railway deployment `f17fbcec-f7a2-4c5f-bceb-b5dc1af1a436`.
- Added a Home-level `RIVT Daily` command surface with work, money, crew, and field-knowledge signals so contractors and tradespeople have a daily reason to check in without inventing fake marketplace density.
- Added a compact `Availability radar` to Home that lets users set `available`, `limited`, or `unavailable/booked` from the dashboard.
- Wired the availability change to the existing authenticated `PATCH /api/v1/profile` route and refreshes the canonical account after save; it is not frontend-only state.
- Tuned the mobile Home layout so Daily signals render as a compact two-column grid on phone widths, with an extra-narrow one-column fallback only below 360px.
- Expanded `npm run test:e2e` to open Home on desktop and mobile, verify `RIVT Daily` and `Availability radar`, save a mocked server-backed availability update, and continue through Work, top-bar actions, Tools, and Records.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `436b83fb94f70d2dc0b831d2a7ee09c59d915882`, PostgreSQL and S3-compatible dependencies healthy, and `npm run monitor:production` passed with seven anonymous private-route checks.
- DB-bound live UI and hardening smokes were not completed from this local machine: plain local runs lack `DATABASE_URL`, and `railway run` injects the private `postgres.railway.internal` host that is not resolvable outside Railway's network. These checks need GitHub Actions/Railway runtime execution or a reviewed public DB proxy.
- Remaining honesty boundary: `RIVT Daily` summarizes current available app signals; durable daily streaks, personalized ranking, and server-owned social reputation remain future work.

## Packet 08 Pass - Trade News Real Media and Mobile Layout

- Deployed source `a59eb47b9b3efc4eb8e60da835fc50d0cc912b5f` through Railway deployment `4fb062bd-1c3e-474e-90df-fe42f4f2e1fa`.
- Reworked the Trade News image pipeline so RSS media, article Open Graph/Twitter images, and source page `image_src` candidates are used before RIVT fallback topic thumbnails.
- Added public-image safety filtering for local/private hosts, favicons, site logos, SVG/ICO placeholders, and credentialed URLs before exposing article images to the client.
- Added `thumbnailKind` (`article`, `feed`, `fallback`) to `/api/news` responses so the frontend can treat real photos differently from fallback graphics.
- Tightened Home and Shop Talk news thumbnails so real article images crop like media, fallback topic art is padded/contained, and the Shop Talk news rail no longer lets thumbnail aspect ratio overlap card text.
- Compacted the mobile Trade News command/KPI area so the first article headline appears sooner on phone screens.
- Expanded `npm run test:ui:shop-talk-news` to verify real-media classes, original-source links, reaction regression coverage, no horizontal overflow, and zero console/page errors at 1440x900 and 390x844.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Local `/api/news?location=Jacksonville, FL` probe returned 30 items with 24 `article`/`feed` thumbnails, 6 fallbacks, zero missing thumbnails, and zero missing source URLs.
- Live checks passed: `/api/health` reported exact source `a59eb47b9b3efc4eb8e60da835fc50d0cc912b5f`, PostgreSQL and S3-compatible dependencies healthy, live `/api/news` returned 30 items with 24 `article`/`feed` thumbnails, 6 fallbacks, zero missing thumbnails, zero missing source URLs, and zero Google favicon thumbnails, and `npm run monitor:production` passed.
- Remaining honesty boundary: some publishers do not expose usable article art, so RIVT fallback topic thumbnails remain intentional and should not be treated as a failure.

## Packet 08 Pass - Shop Talk Reaction and Social Pulse

- Deployed source `1227e1cdba071889384006fca44403538977b8df` through Railway deployment `740dfd5a-23ab-4509-bde3-0a0615a1f6fe`.
- Fixed the founder-reported infinite Shop Talk like/dislike behavior in the current UI: thread and answer reactions now support one active reaction per signed-in user/device, switching between up/down moves the count, and clicking the same reaction clears it.
- Added active visual and accessible reaction states (`aria-pressed`, upvote/downvote labels) so users can tell what they already reacted to.
- Added a compact Shop Talk social pulse with profile impact score, trade-thread count, badge count, and top contributor rows to push Shop Talk toward the trades-only social hub direction.
- Preserved the Gate A honesty boundary: this is local browser reaction state for the current Shop Talk surface, not production-grade server reputation. Durable multi-device reactions still require a canonical server reaction table and authorization/live smoke before being treated as permanent social proof.
- Expanded `npm run test:ui:shop-talk-news` so the rendered QA verifies thread and answer reactions move once, clear on second click, expose active labels, keep no horizontal overflow, and preserve Trade News original-source coverage at 1440x900 and 390x844.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `1227e1cdba071889384006fca44403538977b8df`, PostgreSQL and S3-compatible dependencies healthy, and `npm run monitor:production` passed.

## Packet 08 Pass - Invoice Draft App Upgrade

- Deployed source `97d9da7adb90a79b00af695fa36460f4888cb5e7` through Railway deployment `58d6dca4-d5cb-40e7-b18d-5a037c36ec6b`.
- Reworked Invoice Draft into a fuller invoice app with a cleaner builder column, totals/delivery actions, and a polished printable preview document.
- Added local browser-only invoice templates with save, load, and delete controls. Templates are explicitly labeled as device-local and not production records.
- Added a print action and print CSS so the printable preview can be sent to the browser print dialog without the app shell.
- Preserved the Gate A honesty boundary: email/text actions still open device drafts only; RIVT does not claim server delivery, payment processing, escrow, payroll, tax filing, or delivery logs.
- Expanded `npm run test:ui:tools` so the invoice flow verifies local template save/load visibility, recipient email/phone fields, draft email/SMS affordances, the printable preview, no horizontal overflow, and zero console/page errors at 1440x900 and 390x844.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `97d9da7adb90a79b00af695fa36460f4888cb5e7`, PostgreSQL and S3-compatible dependencies healthy, and `npm run monitor:production` passed.

## Packet 08 Pass - Heavy 16th Multi-Mode Calculator

- Deployed source `444fc96b49f9b7cb60e7ca547a300d3df3000891` through Railway deployment `6bd7f24d-6948-4a2c-a9c2-bf77b1a95abe`.
- Turned Heavy 16th from a static all-in-one panel into a real mini-app with separate Length, Spacing, Cuts, and Hardware modes.
- Added equal-spacing inputs for run length, item count, item width, and end reveal with first-center, last-center, open-gap, and center-to-center outputs.
- Added cut presets, inside/outside and left/right orientation controls, wall-angle and spring-angle inputs, plus flat miter, crown miter, and crown bevel outputs.
- Added a hardware layout mode for pulls and knobs with centerline, bore marks, and reference-edge height output.
- Added a persistent field-card summary with total length, spacing, cuts, hardware, and copy-ready output while preserving the Gate A honesty boundary.
- Raised calculator mode and preset controls to the 44px tap-target floor.
- Expanded `npm run test:ui:tools` and `npm run test:e2e` coverage so the new calculator modes are exercised at desktop and mobile widths.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `444fc96b49f9b7cb60e7ca547a300d3df3000891`, PostgreSQL and S3-compatible dependencies healthy, and `npm run monitor:production` passed.

## Packet 08 Pass - Tools App Surface

- Deployed source `ad5ff7d2ed174634c4bde82bb0b7b23d8a058e8f` through Railway deployment `14bb03aa-9e7d-41f1-a0d0-24335fb216b8`.
- Reworked the active Tools tab app surfaces so the hub reads like a utility suite instead of a generic card grid: each tool now has a clear app category, output signal, detail line, and stable action.
- Improved Heavy 16th with copy-ready ft/in/16ths output, total length/spacing/cut result cards, decimal inches, quantity summary, and clipboard feedback.
- Improved Estimate Builder with a cost composition meter for labor load and margin, while preserving copy-ready estimate behavior.
- Improved Invoice Draft with recipient email/phone fields and honest `mailto:`/`sms:` draft actions; RIVT still does not claim server email/SMS delivery, payment processing, escrow, payroll, or tax automation.
- Improved Material Takeoff with trade presets, waste-added output, and clearer sheet/cost breakdowns.
- Added repeatable rendered QA command `npm run test:ui:tools`, covering Tools hub, Heavy 16th, Estimate Builder, Invoice Draft, and Material Takeoff at 1440x900 and 390x844 with no horizontal overflow and zero console/page errors. Screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `ad5ff7d2ed174634c4bde82bb0b7b23d8a058e8f`, PostgreSQL and S3-compatible dependencies healthy, and `npm run monitor:production` passed.

## Packet 08 Pass - Shop Talk Command Center

- Deployed source `4cef7973b247c3377efad3040ddb600110b2678b` through Railway deployment `f001843b-ab15-4f79-9406-bc36bfd27f31`.
- Tightened Shop Talk into a search-first command center with thread/answer/fix metrics, a compact filter bar, honest empty states, and cleaner mobile/detail navigation.
- Tightened Trade News into a source-first feed with search, source/article metrics, readable mobile cards, RIVT-owned thumbnails, and original-source links.
- Added repeatable rendered QA command `npm run test:ui:shop-talk-news`, covering Shop Talk and Trade News at 1440x900 and 390x844 with no horizontal overflow and zero console/page errors. Screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Local gates passed: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; DB-backed integration tests still skip locally because `TEST_DATABASE_URL` is not configured.
- Live checks passed: `/api/health` reported exact source `4cef7973b247c3377efad3040ddb600110b2678b`, live `/api/news` returned 21 items with zero missing URLs or thumbnails, anonymous `/api/storage` returned 401 as expected, and `npm run monitor:production` passed.

## Packet 00 Delivered

- Removed browser-side fabricated authentication and session-storage auth fallback.
- Failed login/network requests remain signed out; local guest access is disabled.
- Private legacy API routes now require a valid database-backed user session and scope records to the authenticated user ID.
- Signup, login, and Google OAuth rotate the session ID; session lifetime defaults to 30 days.
- New Google users enter `pending` onboarding without a fabricated role, company, or location.
- Existing Google users retain established role/company/location; role becomes immutable after onboarding.
- Added approved-origin CORS/origin checks and baseline auth/write/upload rate limits.
- Restricted uploads to an explicit MIME allowlist and retained file-size/count limits.
- Replaced synthetic identity/Stripe success responses with honest `not_implemented` failures.
- Added safe build/dependency health output and authenticated readiness output.
- Declared `fast-xml-parser` directly and upgraded Multer to `2.2.0`.
- Added Node unit/integration tests and a Playwright fail-closed authentication test.
- Added a GitHub Actions Gate A safety workflow for build, full lint, tests, browser verification, and production dependency audit.
- Added a disposable PostgreSQL 16 CI service and cross-user authorization/session/role integration test.
- Restored explicit Contractor/Tradesperson selection inside signup while keeping role immutable afterward.
- Reduced repository lint from 59 findings to zero. Four superseded screens remain explicitly exported and deprecated for Packet 01 parity review.

## Verification Results

Run on 2026-06-18:

- `npm run build`: pass; 1,759 modules; approximately 344 kB JS and 192 kB CSS before gzip.
- `npm run test`: pass locally; 9 tests pass and the disposable-Postgres test skips because `TEST_DATABASE_URL` is intentionally absent locally.
- `npm run test:e2e`: pass; failed login stays signed out and Tradesperson signup sends the correct immutable role/company payload.
- `npm run lint`: pass repository-wide with zero errors or warnings.
- `npm audit --omit=dev`: pass; zero known vulnerabilities.
- In-app Browser QA at 1280x720 and 390x844: auth page renders, signup role selection responds, narrow role copy no longer overlaps, and no console warnings/errors were observed.
- GitHub Actions `Gate A Safety` run 27802147834 for commit `e4d1815`: pass; clean install, PostgreSQL-backed authorization/session tests, full lint, production build, Playwright auth flow, and production dependency audit all completed successfully.
- GitHub Actions `Gate A Safety` run 27802435052 for merged `master` commit `4c199d9`: pass.

## Live Environment Evidence

Deployed on 2026-06-18 through Railway deployment `0f6a928c-02e6-4d58-b13d-f80894bb4b77`:

- `https://rivt.pro/api/health` returned 200 and identified source commit `4c199d903683e44d17b7985272c399c6d7a6cbd6`.
- PostgreSQL and S3-compatible storage reported healthy; authenticated readiness reported `runtime-schema-v1`.
- Anonymous storage, readiness, and app-state requests returned 401.
- Invalid login returned 401 and did not create an authenticated session.
- A marked disposable account completed signup, authenticated readiness/storage access, and logout; it was then deleted from production.
- Trade News returned 22 live items.
- Playwright live checks at 1280x720 and 390x844 returned 200 with the correct title/heading and no console errors.

## Packet 00 Acceptance

Packet 00 is accepted. The broader Gate A release is not approved: normalized domain persistence, migrations, real workflow authorization, backup/restore evidence, and provider acceptance remain open.

## Packet 01 Implemented

- Inventoried production in a read-only transaction without emitting PII: 2 authenticated users, 114 unowned app-state blobs, 53 generic events, and 1 unowned upload.
- Classified all legacy marketplace state as quarantined prototype data; no legacy job, person, message, review, community post, or upload becomes canonical/public.
- Added transactional SQL migrations with checksums, advisory locking, migration status, explicit rollback, and fail-closed startup.
- Added canonical accounts, auth identities, private draft profiles, organizations/memberships, 25-trade taxonomy, consent, append-only audit events, and idempotency records.
- Bridged existing and newly inserted auth users to canonical private accounts without inferring organizations.
- Added `/api/v1` request IDs, validation/error conventions, pagination primitives, actor context, and fail-closed organization-role policy.
- Added clean/snapshot migration apply, idempotent rerun, rollback/reapply, checksum-tamper, account bridge, and authorization tests.
- GitHub Actions runs 27803255310 and 27803349568 passed against disposable PostgreSQL.

## Packet 01 Release Safety

- Created Railway bucket `rivt-private` with actual bucket `rivt-private-66cklzn4qc-f` after discovering the prior app variable used a display name that did not exist in S3.
- Copied and size-verified the single quarantined legacy object into the new bucket.
- Created an AES-256-GCM encrypted logical snapshot directly in private object storage at `backups/postgres/2026-06-19T03-29-15.832Z-pre-packet-01-4c199d9.json.aes256gcm`.
- Downloaded, decrypted, parsed, and reconciled the snapshot in memory: 53 events, 114 app-state rows, 3 sessions, 2 users, 0 guests, and 1 upload.
- Stored the encryption key as a Railway secret; no local backup file or plaintext cloud object was created.
- Deployed corrected S3 variables with Packet 01 and verified an authenticated upload, S3 head request, signed download, content match, and cleanup.

## Packet 01 Production Evidence

- Source commit: `166c43a9e24af64737eed22088e0306cc6873b22`
- Railway deployment: `1188000e-374c-44db-9d32-b007bf481959`
- Merged-master GitHub Actions run 27803652474: pass
- Production readiness: `0002_domain_foundation`, two applied migrations, zero pending
- Canonical bridge: 2 accounts, 2 private draft profiles, 2 identities, 25 trades, 0 inferred organizations
- Legacy reconciliation: 114 app-state blobs unchanged
- Anonymous storage/readiness/app-state/v1 account requests: 401
- Disposable Tradesperson signup, `/api/v1/me`, object upload/download, and logout passed; all smoke records and objects were deleted

## Packet 01 Acceptance

Packet 01 is accepted. The old object-storage bucket remains temporarily as a rollback source and should be deleted only after the isolated restore drill and retention decision.

## Packet 02 Implemented

- Added migration `0003_auth_onboarding_profiles` for verification/recovery challenges, OAuth transactions, profile ownership, resumable onboarding, and device/session controls.
- Added single-use, hashed email-verification and password-recovery tokens with expiry, replay protection, resend replacement, and session revocation after password reset.
- Added Google OIDC state, nonce, PKCE, JWKS signature validation, and safe identity linking.
- Added canonical `/api/v1/me`, profile, onboarding, and session/device APIs with server-authoritative role and ownership checks.
- Added role-correct onboarding, profile editing, email verification/recovery, and session management to the frontend without restoring browser-owned account state.
- Added a Resend email adapter, pilot invitation controls, production security configuration checks, and invitation CLI.
- Preserved the Packet 02 stop condition: no job or messaging persistence was added.

## Packet 02 Verification

- Local `npm run lint`, `npm run build`, `npm run test`, and `npm run test:e2e`: pass.
- Local PostgreSQL-backed tests skip when `TEST_DATABASE_URL` is absent by design.
- GitHub Actions Gate A run `27807673862` for accepted source commit `d417908`: pass.
- CI evidence includes PostgreSQL 16 migration lifecycle, account lifecycle/onboarding, cross-user authorization, browser fail-closed behavior, production bundle, full lint, and production dependency audit.
- Railway's first release attempt (`7a072390-c2c9-4a5a-89f1-5ecaeda29602`) failed before traffic moved because the production install omitted React type packages needed by the build. Commit `696a332` corrected their dependency classification; the complete local gate passed again before redeployment.

## Packet 02 Production Evidence

- Release commit: `696a332ee55355f49a43960b9962be2cc37c966c`
- Railway deployment: `2fe13f14-4852-48cd-bd19-c33f64ccc96a` (success)
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy
- Migration status: `0003_auth_onboarding_profiles`, three applied migrations, zero pending
- Resend sender domain: `rivt.pro` verified with DKIM and the `send.rivt.pro` SPF/MX return path; DMARC published at monitoring policy
- Railway email provider: sending-only production key restricted to `rivt.pro`; direct delivery and application verification/recovery messages delivered
- `/api/auth/providers`: Google, email, and session security configured; pilot invitations required; Facebook and Apple remain explicitly unavailable
- Live acceptance: invite-gated signup, email verification, canonical onboarding, profile update/publish, two-session revocation, logout, password recovery/reset, and Google authorization handoff passed
- Cleanup: two disposable accounts were closed and anonymized, three disposable invites were revoked, profiles were made private, sessions were revoked, and append-only audit history was preserved

## Packet 02 Acceptance

Packet 02 is accepted in production. The account journey, canonical profiles, provider configuration, and live release checks are complete for this packet. Facebook and Apple are not presented as available providers and remain deferred until their credentials and acceptance checks exist.

## Packet 03 Implemented Locally

- Added migration `0004_jobs_discovery` for canonical contractor-owned jobs, public job areas, private exact addresses, normalized requirements, and append-only job status events.
- Added typed job domain validation, publish-readiness checks, deterministic match scoring, server-side filtering, private-address-safe mapping, and lifecycle transition rules.
- Added `/api/v1/jobs` create/list/detail/update/publish/pause/resume/close APIs with authenticated actor context, organization owner/admin authorization, idempotency-key replay, optimistic version checks, daily job/publish limits, status events, and audit events.
- Migrated the Work UI from local job posting to the typed jobs API with progressive draft save, edit, publish, pause, resume, close, loading, empty, error, retry, filter, detail, and private-address owner states.
- Removed current seeded jobs, seeded talent, and fake review counts from `src/data.ts`; Work/Crew now use real empty states instead of fabricated people or jobs.
- Corrected the primary shell to Home, Work, Crew, Shop Talk, Tools, with search, messages, notifications, and profile in the top bar.
- Added job lifecycle unit tests, PostgreSQL-backed job integration tests, migration lifecycle coverage for migration 0004, and desktop/mobile Work shell E2E coverage.
- Preserved the Packet 03 stop condition: applications/offers/mutual hiring were not implemented.

## Packet 03 Local Verification

Run on 2026-06-19 from `codex/packet-03-jobs-discovery`:

- `npm.cmd run lint`: pass.
- `npm.cmd run lint:security`: pass.
- `npm.cmd run test`: pass; 18 unit tests pass, 3 non-DB integration tests pass, and 4 PostgreSQL integration tests skip locally because `TEST_DATABASE_URL` is not configured.
- `npm.cmd run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile Work acceptance pass.
- `npm.cmd run build`: pass; Vite builds 1,762 modules.
- `npm.cmd audit --omit=dev`: pass; zero vulnerabilities.

## Packet 03 Production Evidence

- Source commit: `4a3a7215b09a8cfe224405f7b274bc10c8f7ac31`
- Railway deployment: `61142204-fa92-4c44-a798-27c99932266b` (success)
- GitHub Actions disposable PostgreSQL run `27859431951`: pass for Packet 03 source before merge; merged source was deployed after the signup-policy/UI patches.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production readiness: `0004_jobs_discovery`, four applied migrations, zero pending.
- Live smoke `packet03-20260620052132-4ef6a7`: disposable contractor, second contractor, and tradesperson signup/onboarding passed; incomplete publish failed safely; authorized draft/update/publish/pause/resume/close passed; unauthorized mutation returned 403; idempotent publish replay was detected; tradesperson discovery returned the open job without private address; paused/closed jobs were hidden from tradesperson; owner detail included private address; disposable accounts were closed.

## Packet 03 Acceptance

Packet 03 is accepted in production for jobs and discovery. Applications, offers, mutual acceptance, project records, messaging, reviews, and admin operations remain later packets and must not be represented as production-ready.

## Packet 04 Implemented Locally

- Added migration `0005_match_acceptance` for account blocks, applications, application timelines, offers, offer timelines, active work, participants, and active-work status timelines.
- Added typed match/acceptance validation and response mapping in `server/matches.js`.
- Added `/api/v1/jobs/:id/application-draft`, `/api/v1/jobs/:id/applications`, `/api/v1/applications`, `/api/v1/applications/:id/withdraw`, `/api/v1/jobs/:id/applications`, `/api/v1/applications/:id/shortlist`, `/api/v1/applications/:id/decline`, `/api/v1/applications/:id/offer`, `/api/v1/offers`, `/api/v1/offers/:id/accept`, `/api/v1/offers/:id/decline`, `/api/v1/active-work`, `/api/v1/active-work/:id/reschedule`, and `/api/v1/active-work/:id/cancel`.
- Added server-side protections for active account role, organization owner/admin applicant review, one application per job/applicant, one active offer per job, blocked-account interactions, wrong-recipient offer acceptance, stale/closed jobs, idempotent mutations, and exactly-one active-work creation.
- Changed job detail authorization so exact private address remains hidden from browsing tradespeople but is visible to the accepted active-work participant.
- Added a compact Work detail hiring panel: tradespeople can save draft/apply/withdraw and accept/decline offers; contractors can review applicants, shortlist, decline, and send offers; accepted work shows active-work events and cancel/reschedule actions.
- Added PostgreSQL-backed Packet 04 integration coverage for blocked applications, duplicate applications, applicant privacy, wrong-recipient acceptance, double acceptance, address release before/after acceptance, participant creation, and timelines.
- Preserved the Packet 04 stop condition: persistent messaging was not added.

## Packet 04 Local Verification

Run on 2026-06-20 from `master`:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run test`: pass; 18 unit tests pass, non-DB integration tests pass, and DB-backed integration tests including Packet 04 skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile checks pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.

## Packet 04 Production Evidence

- Source commit: `0ccf88c3ade7511d6d3ad53fc2911cec90648810`
- Railway deployment: `04b7e269-f103-4bbe-88cf-6ef82161b6bc` (success); initial source upload was `bef21475-e9f7-46f6-af2e-71a040a4b8d5`, followed by a metadata redeploy after `SOURCE_COMMIT` was updated.
- GitHub Actions Gate A Safety run `27862175954`: pass for Packet 04 source.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production migration status: `0005_match_acceptance`, five applied migrations, zero pending.
- Live smoke `packet04-20260620061146-411fdf`: disposable contractor, tradesperson, and second tradesperson signup/onboarding passed; readiness confirmed migration 0005; tradesperson application passed; duplicate application returned 409; non-owner applicant list returned 403; contractor applicant review passed; contractor sent offer; wrong-recipient acceptance returned 403; recipient acceptance created exactly one active-work record with two participants; double acceptance returned the same active-work record; private address was hidden before acceptance and revealed to the accepted tradesperson after acceptance; unrelated tradesperson could not view the closed accepted job; active-work reschedule/cancel timeline events passed; disposable accounts were closed.
- Added reusable live-smoke command: `npm run smoke:match:live`.

## Packet 04 Acceptance

Packet 04 is accepted in production for applications, offers, mutual acceptance, active-work participants, accepted-address release, and active-work cancel/reschedule events. Persistent messaging, notifications, project records, completion, reviews, and admin operations remain later packets and must not be represented as production-ready.

## Packet 05 Implemented Locally

- Added migration `0006_messaging_notifications` for conversations, conversation participants, durable messages, message receipts, attachment metadata, in-app notifications, notification preferences, and conversation reports.
- Added typed messaging/notification validation and response mapping in `server/messaging.js`.
- Added `/api/v1/active-work/:id/conversation`, `/api/v1/conversations`, `/api/v1/conversations/:id/messages`, `/api/v1/conversations/:id/read`, `/api/v1/conversations/:id/mute`, `/api/v1/conversations/:id/report`, `/api/v1/accounts/:id/block`, `/api/v1/accounts/:id/unblock`, `/api/v1/notifications`, `/api/v1/notifications/read`, and notification preference APIs.
- Created conversations only from accepted active-work relationships and enforced participant-only read/send behavior.
- Added idempotent message send, per-participant receipts/read state, server notifications for offers/accepted work/work transitions/messages, and mute suppression.
- Added server-backed Inbox UI and top-bar notification activity mapping; old local sent-message behavior is no longer used by the Messages route.
- Added message attachment metadata with `pending_authorization` status as the Packet 06 media authorization handoff.
- Added PostgreSQL-backed Packet 05 integration coverage and reusable production smoke command `npm run smoke:messaging:live`.
- Preserved the Packet 05 stop condition: no project albums, external SMS channels, or frontend-only notification success were added.

## Packet 05 Local Verification

Run on 2026-06-20 from `master`:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run lint:security`: pass.
- `npm run test`: pass; 18 unit tests pass, non-DB integration tests pass, and DB-backed integration tests including Packet 05 skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile checks pass with Packet 05 inbox endpoints mocked.
- `npm audit --omit=dev`: pass; zero vulnerabilities.

## Packet 05 Production Evidence

- Source commit: `338ce7f7ec921fbcfafe20b4f9b96ecbf3053224`
- Railway deployment: `16fb271d-9dc0-4d85-9a55-4765acb07f43` (success)
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Anonymous `/api/storage` and `/api/readiness`: 401, preserving authenticated diagnostics.
- Live smoke `packet05-20260620123233-891897`: disposable contractor, tradesperson, and outsider signup/onboarding passed; readiness confirmed migration `0006_messaging_notifications`; accepted active work opened one conversation; outsider conversation list was empty and direct message access returned 404; message send was idempotent; unread count survived contractor relogin; notifications excluded private address details; conversation read cleared unread state; notification read-all passed; mute suppressed a second message notification; report creation passed; block enforcement returned `ACCOUNT_BLOCKED`; two messages and one report persisted; disposable smoke accounts were closed.
- Dedicated reusable production test accounts were created for future manual/smoke checks: one contractor account and one tradesperson account, both email-verified, active, onboarded, and profile-published.
- Added reusable live-smoke command: `npm run smoke:messaging:live`.

## Packet 05 Acceptance

Packet 05 is accepted in production for accepted-work conversations, durable messages, unread/read state, in-app notifications, mute, report, block enforcement, and private-address-safe notification content. Project records, completion evidence, reviews, support/admin, and full launch hardening remain later packets and must not be represented as production-ready.

## Packet 06 Implemented Locally

- Added migration `0007_project_completion` for projects, immutable project entries, authorized project media, completion submissions, and completion resolutions.
- Extended uploads with authenticated account ownership, active-work linkage, project upload status, content SHA-256, storage scope, failure reason, and verification timestamp.
- Added typed project validation/mapping and content-signature checks in `server/projects.js`.
- Added participant-scoped `/api/v1/active-work/:id/project`, `/api/v1/projects/:id`, note, media, media signed-url, completion submit, confirm, dispute, and report APIs.
- Bound all project access through accepted `work_participants`; unrelated authenticated accounts receive 404.
- Added idempotent project opening, notes, media upload/rejection, completion submission, and completion resolution.
- Added malformed-file rejection with durable rejected status; valid project media requires managed object storage and private signed access.
- Added Records mode in Tools with server-backed accepted-work records, note upload, evidence upload, completion submit, confirm/dispute, and report preview.
- Added Packet 06 integration coverage and reusable production smoke command `npm run smoke:projects:live`.
- Preserved the Packet 06 stop condition: no public share links, advanced annotations, or CompanyCam-scale media features were added.

## Packet 06 Local Verification

Run on 2026-06-20 from `master`:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run lint:security`: pass.
- `npm run test`: pass; 18 unit tests pass, non-DB integration tests pass, and DB-backed integration tests including Packet 06 skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile checks pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.

## Packet 06 Production Evidence

- Source commit: `993be3899f8eb996229be90cf423cf58e5e27c76`
- Railway deployment: initial application deploy `4da1b9b0-9afd-4af9-a088-c244a466a761`, followed by metadata deploy `67562c06-40d4-4923-bd82-52b169a0d45e` after updating `SOURCE_COMMIT`.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production migration status: `0007_project_completion`, seven applied migrations, zero pending, verified during live smoke readiness.
- Live smoke `packet06-20260620132532-bdf04b`: disposable contractor, tradesperson, and outsider signup/onboarding passed; readiness confirmed migration `0007_project_completion`; accepted work opened a private project record; outsider project and media URL access returned 404; note idempotency replayed; malformed PNG upload was rejected and idempotent; text evidence uploaded to managed storage; contractor received a media signed-url response; tradesperson submitted completion with evidence; contractor confirmed completion; closeout report matched after relogin and excluded private address; a second project completion was disputed with reason; persisted smoke evidence counted 9 entries, 2 media rows, and 2 resolutions; disposable accounts were closed and the smoke object was deleted from object storage.

## Packet 06 Acceptance

Packet 06 is accepted in production for private accepted-work project records, authorized media evidence, content-signature rejection, notes, completion submission, contractor confirmation/dispute, and reproducible closeout reports. Reviews, admin/support, safety moderation, and final launch hardening remain later packets and must not be represented as production-ready.

## Packet 07 Implemented

- Added migration `0008_reviews_admin_safety` for participant reviews, review events, safety reports, unsafe-work reports, support cases/events, admin role grants, admin action events, and account restrictions/events.
- Added `actor_account_id` to consent acceptances and expanded consent contexts for review submission and stop-work acknowledgement.
- Added typed review/safety/support/admin schemas and mappers in `server/reviews-safety.js`.
- Added participant-only review submission for completed active work, one-review-per-reviewee/work uniqueness, pending approval, dispute, response, admin resolve/hide, and reputation count/average APIs.
- Added report and unsafe/stop-work APIs with participant/relationship authorization, stop-work contextual consent, no-fault unsafe-work records, notifications, and append-only event history.
- Added support-case APIs that remain available to suspended/restricted accounts while regular mutating APIs fail closed.
- Added least-privilege admin API authorization through `admin_role_grants`, admin-only overview/review/support/restriction mutations, and immutable `admin_action_events` requiring actor, reason, subject, and timestamp.
- Hardened block behavior so blocked accounts cannot use job discovery/detail/profile reputation/application routes as alternate contact paths.
- Replaced the normal-user Admin route with a staff-access boundary notice and removed visible overclaims around verified profiles and safety certifications in current shell copy.
- Added Packet 07 integration coverage and reusable live smoke command `npm run smoke:reviews:live`.
- Preserved the Packet 07 stop condition: no public Shop Talk moderation or automated verification-provider claims were added.

## Packet 07 Local Verification

Run on 2026-06-20 from `master`:

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run test`: pass; 18 unit tests pass, non-DB integration tests pass, and DB-backed integration tests including Packet 07 skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile checks pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.
- `npm run lint:security`: pass.

The first production smoke attempt on deployment `0f708552-8598-4a04-8f45-0126262efce8` caught an onboarding regression: the new mutation-restriction guard blocked pending accounts from completing onboarding. Commit `01bf1adfedef03ee7ecd7c408d2bab6cbde654fe` fixed the guard so `/api/v1/onboarding/complete` remains available to pending accounts while normal mutating routes still fail closed for inactive or restricted accounts. The full local gate passed again before redeploy.

## Packet 07 Production Evidence

- Source commit: `01bf1adfedef03ee7ecd7c408d2bab6cbde654fe`
- Railway deployment: application deploy `698ce001-b5b2-42c6-9967-9c89e30afe68`, followed by metadata redeploy `b3c91226-d60b-407f-a93e-1e289cbdc968` after updating `SOURCE_COMMIT`.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production migration status: `0008_reviews_admin_safety`, eight applied migrations, zero pending, verified during live smoke readiness.
- Live smoke `packet07-20260620143318-94c6bd`: disposable contractor, tradesperson, outsider, and admin signup/onboarding passed; normal user admin overview returned 403; readiness confirmed migration `0008_reviews_admin_safety`; completed active work accepted one review and rejected duplicate/ineligible reviews; review dispute, response, admin resolve, and reputation count passed; unsafe stop-work report and safety report persisted; block enforcement hid job detail/list and reputation paths; admin suspension blocked normal mutations while support remained available; admin support assist and restriction lift passed; immutable admin-action evidence counted 4 actions; disposable accounts and smoke records were closed.

## Packet 07 Acceptance

Packet 07 is accepted in production for participant reviews, review disputes/resolution, reputation counts, safety reports, unsafe stop-work reports, support cases, least-privilege admin access, account restrictions, admin action events, and extended block enforcement. Gate A launch hardening, restore drill evidence, distributed limits, monitoring/alerts, and final ops checklist remain before first-user launch.

## Packet 08 Hardening Slice Implemented

- Added structured JSON request/domain logging with request IDs, method/path/status/duration, actor ID when authenticated, and safe error fields.
- Added operational controls for `RIVT_SIGNUPS_DISABLED` / `SIGNUPS_DISABLED`, `RIVT_MUTATIONS_DISABLED` / `PLATFORM_MUTATIONS_DISABLED`, and optional `RIVT_CONTROL_REASON`.
- Exposed control state through authenticated readiness and auth-provider status without exposing secrets.
- Preserved support/admin access during platform mutation lockout so restricted users can still reach support and staff can operate incidents.
- Added reusable production hardening audit command `npm run smoke:gate-a:live` for exact source commit, migration status, anonymous fail-closed routes, provider status, operational controls, and user-facing seed/demo sweeps.
- Added guarded cleanup command `npm run cleanup:gate-a:demo` that requires `CONFIRM_GATE_A_DEMO_CLEANUP=true`, preserves records, makes matching test profiles private, closes matching smoke organizations/jobs, and hides matching public reviews instead of deleting data.
- Executed the cleanup in production after the first hardening audit surfaced user-facing test artifacts.
- Added migration `0009_durable_rate_limits` with a shared PostgreSQL `rate_limit_windows` table and rollback.
- Replaced process-local auth/write/upload throttles with PostgreSQL-backed durable limit buckets keyed by privacy-safe subject hashes.
- Updated live hardening audit to require migration 0009 and the durable rate-limit table.

## Packet 08 Verification

Run on 2026-06-20 from `master`:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run lint:security`: pass.
- `npm run test`: pass; unit and non-DB integration coverage pass, while DB-backed local integration tests skip because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.
- `node --check server/security.js`, `node --check server/index.js`, and `node --check scripts/live-gate-a-hardening.js`: pass.
- `node --test test/security.test.js`: pass, including durable limiter header/block behavior.

Local restore tooling remains unavailable on this workstation (`docker`, `psql`, and `pg_dump` are not installed), so the timed isolated restore drill cannot be closed from the current local environment.

## Packet 08 Production Evidence

- Source commit: `bf42ee6a51dc91ddeb4c2451ee2434e0548d8615`
- Railway deployment: application deploy `14ae3c42-c5c0-4bfb-a873-b496a51c6877`, followed by metadata redeploy `300918e1-5ed5-44f3-8bbb-e2c289c5f97a` after updating `SOURCE_COMMIT`.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production migration status: `0009_durable_rate_limits`, nine applied migrations, zero pending.
- First live hardening audit on the Packet 08 code correctly failed because two published test network profiles and twelve active smoke organizations remained visible.
- Production cleanup made two `RIVT * Test` profiles private and closed twelve Packet 03-07 smoke organizations; no records were deleted.
- Final live hardening audit passed with exact source `bf42ee6a51dc91ddeb4c2451ee2434e0548d8615`, migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, and counts of 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 legacy app-state rows, and 0 rate-limit windows before traffic.

## Packet 08 Legacy Bridge Retirement

Implemented and deployed on 2026-06-20:

- Retired authenticated `/api/app-state` read/write calls with `410 LEGACY_APP_STATE_RETIRED`.
- Retired authenticated `/api/events` generic event writes with `410 LEGACY_EVENTS_RETIRED`.
- Retired `/api/payments/export.csv` because it depended on legacy app-state payment rows that are not canonical payment records.
- Removed the frontend app-state hydration/save loop and removed the obsolete E2E app-state stub.
- Kept authorized managed upload routes in place because profile/project media storage is a separate managed-storage path, not app-state authority.
- Updated database-backed authorization coverage to assert the legacy bridge no longer creates app-state rows for authenticated accounts.

Local verification for this slice:

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run test`: pass; DB-backed suites skipped locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.
- `npm run lint:security`: pass.

Production evidence:

- Source commit: `00147c8e3f70e246b41ed48b46550ae33cf0eb54`
- Railway deployment: application deploy `dd46b5e2-916a-47be-9dde-36cb0c8d9ed6`, followed by metadata redeploy `f2170045-3df8-498e-b29e-fc733cc18b9f` after updating `SOURCE_COMMIT`.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Live hardening audit executed inside the Railway service with private network access: exact source `00147c8e3f70e246b41ed48b46550ae33cf0eb54`, migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, and counts of 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 0 rate-limit windows before traffic.

## Packet 08 Gate Status

The Packet 08 hardening, durable-rate-limit, and legacy-bridge retirement slices are deployed and accepted as evidence. Later Packet 08 passes closed timed restore evidence, external monitoring/alerts, incident routing, and recovery-policy approval. Full Gate A approval remains rejected until the remaining launch blockers are closed: incident rehearsal, support/legal/founder signoff, and manual accessibility/device matrix.

## Packet 08 Manual Device/Accessibility Matrix Progress

Started on 2026-06-20 against `https://rivt.pro/`.

- Live health reports source commit `7fc6f65b1dad7af803547293cae199135908c5cd` after deployment `255d59f0-ecdf-4c0d-ac36-583045b767a8`.
- Codex in-app Browser smoke covered the public auth/marketing shell at 1280x720, 390x844, and 360x800.
- The public shell loaded with the expected RIVT title, no console warnings/errors, and no horizontal overflow on tested breakpoints.
- Invalid email/password remained signed out with the generic `Invalid email or password.` message.
- The provided test account did not authenticate, so no new production user was created and the authenticated route/device matrix remains blocked.
- A touch-target issue was fixed and deployed by raising auth input minimum height from 42px to 46px; post-deploy mobile verification measured 46px fields at 390x844.
- Evidence is recorded in `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md`.

Local verification for this slice:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run lint:security`: pass.
- `npm run test`: pass; DB-backed integration tests skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.

## Packet 08 Authenticated Accessibility Smoke Progress

Deployed on 2026-06-20:

- Source commit: `f5a68d9c16364c94dd727bb91e03a25f33e283df`
- Railway deployment: `b241d02b-04bf-42d8-a462-243d06f4ab4a`
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Authenticated UI smoke `ui-a11y-20260621005817-8a87eb` created disposable contractor and tradesperson accounts, tested contractor mobile, tradesperson mobile, and contractor desktop shells, then closed both accounts.
- Tested shells had top-bar search, messages, notifications, and profile controls; no role toggle; no More tab; no horizontal overflow; `consoleWarningsOrErrors: 0`; and `smallTargetCount: 0` on all tested viewports. The smoke uses reduced-motion browser preference and now fails on missing top-bar controls, post-login console warnings/errors, sub-44px controls, unnamed keyboard focus targets, or keyboard focus not reaching search/primary navigation.
- Live hardening audit passed after deployment with exact source `f5a68d9c16364c94dd727bb91e03a25f33e283df`, migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, and counts of 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 49 rate-limit windows.
- The authenticated UI smoke matrix was expanded in `scripts/live-ui-accessibility.js` to cover 360x800 phone, 390x844 phone, 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and a 390x844 200% text-scale scenario. It was rerun against production on 2026-06-21 as `ui-a11y-20260621043529-3efa9b`; evidence is recorded in `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md`.

## Packet 08 Synthetic Monitoring Progress

Implemented on 2026-06-20:

- Added `scripts/production-synthetic-monitor.js` and `npm run monitor:production`.
- Added `.github/workflows/production-synthetic.yml` to run the public production synthetic check every 30 minutes and on manual dispatch.
- The monitor verifies public health, deployed source presence, managed PostgreSQL/S3-compatible dependency status, invite-gated email/password provider configuration, operational-control state, and seven anonymous private-route 401 boundaries.
- Hardened the scheduled workflow so it installs dependencies from `package-lock.json`, uploads `production-monitor.log` evidence on every run, opens or updates one GitHub issue titled `Production synthetic check failing` when checks fail, and comments/closes that issue when production recovers.
- Latest local run against `https://rivt.pro` passed with source `f5a68d9c16364c94dd727bb91e03a25f33e283df`, operational controls disabled, seven anonymous private checks, and a 606 ms duration.
- This is partial monitoring progress only. Dedicated error monitoring, alert routing, paging destination, named incident owner, and rehearsal remain launch blockers.

## Packet 08 Incident Readiness Tooling Progress

Implemented on 2026-06-20:

- Added `docs/operations/incident-routing.json` as the machine-readable incident owner, support-hours, alert-destination, rehearsal, and approval source.
- Added `scripts/incident-readiness-check.js` and `npm run incident:readiness`.
- Added unit coverage proving incident readiness passes only with owners, support hours, synthetic monitoring, error monitoring, paging, recent rehearsal, and founder/support/legal-safety approvals.
- Updated the production synthetic GitHub issue workflow so a failing monitor issue includes incident-routing context: primary owner, backup owner, dedicated error-monitoring status, and paging status.
- Current readiness output is blocked, with primary owner recorded as Michael at `support@rivt.pro`, synthetic monitoring configured, and these missing blockers: backup owner, founder-approved support hours, dedicated error monitoring, paging route, incident rehearsal, founder approval, support approval, and legal/safety approval.

## Packet 08 Restore Drill Tooling Progress

Implemented on 2026-06-20:

- Added `scripts/restore-drill.js` and `npm run restore:drill`.
- Added `scripts/restore-logical-copy.js` and `npm run restore:logical-copy` to create a verified restored target through the application runtime when local `pg_dump`/`psql` tooling is unavailable.
- Added `scripts/logical-backup-utils.js`, `scripts/create-logical-backup-artifact.js`, and `scripts/restore-logical-backup-artifact.js`.
- Added `npm run backup:logical-artifact` to create an AES-256-GCM encrypted gzip logical backup object in private S3-compatible storage, with a manifest containing source commit, table counts, row counts, and object key evidence.
- Added `npm run restore:logical-artifact` to restore a named backup object into an isolated target, apply migrations when requested, verify table/column parity, restore sequences, and fail on count drift from the backup manifest by default.
- The verifier requires `CONFIRM_RESTORE_TARGET_ISOLATED=true` and `RESTORE_DATABASE_URL`; it refuses to run without an isolated target.
- The verifier checks migration status, requires migration `0009_durable_rate_limits`, verifies critical Gate A table presence, counts rows, can compare source/target counts with `RESTORE_SOURCE_DATABASE_URL`, and reports duration.
- A no-target artifact restore run correctly fails cleanly with `RESTORE_DATABASE_URL is required`.
- Unit coverage now verifies backup encryption/decryption, dependency ordering, count-diff reporting, and restore source/target identity refusal.

Timed isolated logical restore executed on 2026-06-20:

- Temporary Railway PostgreSQL target: `Postgres-3Ei3` (`fe501310-25bb-4389-a2fb-1a11dc89772c`, deployment `f034530e-2aa3-46d3-a83b-ea3b11df9f30`), deleted after verification.
- Production runtime source: `e0ac24d143c29f1f17c6570debbd576f49538597`, current Railway deployment `0d3f94b0-f586-446f-808b-9078c9a40f65`.
- `npm run restore:logical-copy -- --apply-migrations` ran inside the Railway RIVT service with explicit one-command restore env vars, applied migrations to the isolated target, copied 59 public tables and 1,524 rows, restored sequence positions, and completed in 1,421 ms.
- `npm run restore:drill` then verified the isolated target with strict source/target row-count parity, migration `0009_durable_rate_limits`, nine applied migrations, zero pending migrations, zero count diffs across critical Gate A tables, and a 220 ms verifier duration.
- Cleanup: the temporary target database was deleted, no temporary restore variables remain on RIVT or Postgres, and production health remained healthy on commit `e0ac24d143c29f1f17c6570debbd576f49538597`.
- This closes the timed isolated logical restore evidence gap. It does not by itself prove restoration from a specific backup artifact or define the final RPO/RTO policy.

Backup-artifact restore tooling progress on 2026-06-20:

- Local `npm run test:unit` passed with 23 tests, including the new logical backup utility tests.
- Local `npm run lint:security` passed with the new backup artifact scripts included.
- Temporary restore-control variables (`RESTORE_DATABASE_URL`, `RESTORE_SOURCE_DATABASE_URL`, and `CONFIRM_RESTORE_TARGET_ISOLATED`) were found on the RIVT service and removed. Remaining key-name check showed only persistent backup/storage names: `BACKUP_ENCRYPTION_KEY`, `DATABASE_URL`, `S3_*`, and `SOURCE_COMMIT`.
- Attempting to provision a fresh temporary Railway PostgreSQL target for the named-artifact restore rehearsal failed because the Railway CLI session is expired (`Unauthorized. Please run railway login again.`). No backup artifact was created and no restore target remains from this attempt.

## Packet 08 Backup Artifact Restore and Expanded UI Matrix Evidence

Completed on 2026-06-21 after Railway re-authentication:

- Deployed current source to production and verified `https://rivt.pro/api/health` reported exact source `67094c9853a8f4be2be01ffe30376b669afe6cde` with PostgreSQL and S3-compatible storage healthy.
- Created a current named encrypted backup artifact from production with `npm run backup:logical-artifact`: object `backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm`, source commit `332dbc05e1978976d31395a6e482911e34931251`, 59 tables, 1,524 rows, 630 ms creation duration.
- Restored that named object into isolated Railway PostgreSQL service `Postgres-_FQz`, applied nine migrations through `0009_durable_rate_limits`, restored 59 tables and 1,524 rows, verified table/column/sequence and strict manifest-count parity with zero diffs, and completed restore verification in 13,411 ms.
- Ran `npm run restore:drill` against the isolated restored target: migration `0009_durable_rate_limits`, nine applied migrations, zero pending migrations, zero count diffs, and 1,862 ms verifier duration.
- Deleted temporary restore service `Postgres-_FQz` and marked detached restore volumes `postgres-volume-FH_H` and `postgres-volume-M1Ll` for deletion. No temporary `RESTORE_*` or `CONFIRM_*` variables remain on the RIVT service, and a leftover `RESTORE_DATABASE_URL` variable was removed from the production Postgres service.
- `npm run monitor:production` passed on deployed commit `67094c9853a8f4be2be01ffe30376b669afe6cde` with seven anonymous private-route checks and managed PostgreSQL/S3-compatible dependencies healthy.
- `npm run smoke:gate-a:live` passed on deployed commit `67094c9853a8f4be2be01ffe30376b669afe6cde` with migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 64 rate-limit windows.
- Expanded authenticated UI smoke `ui-a11y-20260621043529-3efa9b` created disposable contractor and tradesperson accounts, tested 360x800 phone, 390x844 phone, 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and a 390x844 200% text-scale scenario, then closed both accounts. All scenarios reported top-bar search/messages/notifications/profile present, reduced-motion enabled, keyboard focus reaching named top-bar and primary navigation targets, `consoleWarningsOrErrors: 0`, and `smallTargetCount: 0`.
- The expanded UI smoke caught a real 360px Crew overflow in the V2 network shell. Two CSS fixes were deployed (`d7129b4` and `67094c9`) to force mobile network children and metric cards to shrink without off-screen bleed; the final smoke passed after those fixes.
- Required local gates passed after the production fix: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.
- `npm run incident:readiness -- --json` remains blocked by missing backup owner, support hours, dedicated error monitoring, paging route, incident rehearsal, and founder/support/legal-safety approvals.

## Packet 08 Launch Operations Readiness Progress

Implemented on 2026-06-21:

- Added `docs/operations/recovery-policy.json` as the machine-readable RPO/RTO, backup-retention, restore-cadence, latest named artifact restore, and recovery-approval source.
- Added `scripts/launch-readiness-check.js`, `npm run launch:readiness`, and unit coverage in `test/launch-readiness.test.js`.
- Added `docs/operations/LAUNCH_OPS_CHECKLIST.md` so the final go/no-go checklist is explicit across incident ownership, restore policy, support, providers, accessibility, and pilot cohort controls.
- Added `docs/operations/INCIDENT_REHEARSAL_RUNBOOK.md` with public-health, storage, and abuse/safety rehearsal scenarios plus an evidence template.
- Updated `docs/operations/RUNBOOKS.md` so it no longer describes the named backup-artifact restore as incomplete and now documents the launch readiness gate.
- `npm run launch:readiness -- --json` blocked at the time with expected non-code findings including incident routing, backup owner, support hours, dedicated error monitoring, paging, incident rehearsal, incident approvals, recovery policy, RPO/RTO, backup retention, restore cadence, next restore drill, and recovery approvals. Later Packet 08 passes closed all of those except incident rehearsal and final incident approvals.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.

## Packet 08 Controllable UI Smoke Coverage Progress

Implemented on 2026-06-21 after deciding to keep external Gate A finish blockers noted and move to controllable work:

- Hardened `scripts/live-ui-accessibility.js` so authenticated smoke now opens the top-bar search dialog, notifications panel, profile/account panel, and messages/inbox route, then applies the same title, overflow, unnamed-control, tap-target, top-bar-signal, and console-warning/error checks to those opened surfaces.
- Hardened `test/jobs-discovery.e2e.mjs` with mocked API coverage that opens top-bar search, notifications, account/profile, and messages/inbox across desktop and mobile viewports. The test also mocks `/api/v1/sessions` so the account panel can open without leaking to an unmocked local API.
- `npm run test:e2e` passed after the new top-bar interaction checks.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.

## Packet 08 Trade News and Shop Talk Polish Progress

Implemented on 2026-06-21 as controllable UX hardening:

- Replaced the Trade News Google favicon fallback with topic-aware RIVT-owned thumbnail assets in `public/news/` so cards render reliable editorial imagery for safety, code, HVAC, workforce, licensing, permitting, and general trade briefs.
- Added a curated contractor-relevant news layer ahead of live RSS aggregation in `/api/news`, with original-source links for OSHA heat inspection emphasis, NFPA 2026 NEC changes, EPA/R-410A HVAC timing, ABC workforce shortage signals, Florida DBPR renewal context, and Jacksonville permitting context.
- Kept live feed aggregation behind the curated items, filtered obvious consumer/homeowner drift out of the live tail, and changed its no-media fallback to RIVT topic thumbnails instead of `google.com/s2/favicons`.
- Reworked the Trade News card layout with larger readable headlines, summary previews, date/source separation, original-source links, non-cropped thumbnails, and cleaner selected/detail states.
- Reworked the Trade News detail hero on mobile so metadata no longer collides with the thumbnail artwork.
- Rendered QA with a mocked authenticated account while letting `/api/news` hit the real local API at `127.0.0.1:8787`: desktop `1280x800` and mobile `390x844` both showed curated cards, no Google favicon thumbnails, working original-source URLs, detail hero images, and zero console errors. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-trade-news-desktop.png` and `C:\Users\zboyt\AppData\Local\Temp\rivt-trade-news-mobile.png`.
- Deployed the slice to Railway production as deployment `9c1a3184-1b5e-44dc-bcae-6b8cffc5fc7b` from commit `850337ff3c54f98405c58f74ac5feb39213f1bbd`.
- Live `https://rivt.pro/api/news` verification after deployment returned 21 items with `GoogleFavicons: 0`, `MissingThumbnails: 0`, `MissingUrls: 0`, and `HomeownerMentions: 0`; the first card used `/news/permit-watch.svg` and linked to the Jacksonville permitting source.
- A follow-up metadata redeploy set production `SOURCE_COMMIT` to the Trade News documentation commit `97cc5dd6d807a0a44a7eac2cb71c2a602e1ee8f9`; subsequent UI-smoke fix deployments preserved the same `/api/news` behavior.
- Final live `/api/news` verification on production source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1` returned 23 items with `GoogleFavicons: 0`, `MissingThumbnails: 0`, and `MissingUrls: 0`; the first curated item uses `/news/permit-watch.svg` and links to the Jacksonville permitting source.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.

## Packet 08 Production UI Smoke Regression Fixes

Completed on 2026-06-21 as controllable Gate A hardening:

- Because `railway run` from the local workstation cannot resolve Railway private DNS (`postgres.railway.internal`) and the Railway container does not include Playwright browser binaries, live authenticated UI smoke used a split run: production setup/cleanup inside Railway and browser-only verification from the local Playwright runtime against `https://rivt.pro`.
- Setup run `ui-a11y-20260621062332-02b380` created disposable contractor and tradesperson accounts through the production service. After final verification, cleanup closed both disposable accounts.
- The production smoke caught and fixed five real UI regressions:
  - Search dialog `Cancel` action measured 18px tall on a 360px phone; commit `3577f1f` raised the mobile search action target to the 44px floor.
  - Notification quick actions measured 38px tall; commit `b1768d8` raised those panel actions to the 44px floor.
  - Theme toggles measured 36-42px across account, sidebar, onboarding, and top-bar surfaces; commits `a76377f` and `8f13d9c` corrected the base and responsive overrides.
  - Inbox refresh/open/mark-read controls measured 18-38px; commit `30293e9` raised Inbox header, alert, composer, empty-state, and job-row actions to the 44px floor.
  - The search dialog overflowed horizontally at 200% root text scale on a 390px phone; commit `4fe22bc` constrained the search panel and input flex behavior.
- Final browser-only production smoke passed against `https://rivt.pro` after deployment `7fe1c3ea-d5f4-48c4-b757-a46ff8ebc369` and source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1`.
- Passed viewports: contractor and tradesperson 360x800 phones, contractor and tradesperson 390x844 phones, contractor 768x1024 tablet, contractor 1366x768 laptop, contractor 1440x900 desktop, and contractor 390x844 phone at 200% root text scale.
- Every scenario reported top-bar search/messages/notifications/profile present, reduced-motion enabled, keyboard focus reaching named top-bar and primary navigation targets, `consoleWarningsOrErrors: 0`, and `smallTargetCount: 0`.
- Post-fix production checks passed: `npm run monitor:production` reported exact source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1`, PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, and seven anonymous private-route checks; `npm run smoke:gate-a:live` passed inside Railway with migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 78 rate-limit windows.
- Required local gates passed after each runtime fix: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.

## Packet 08 Tools Studio Release

Completed on 2026-06-21 as controllable UX hardening after the founder asked to flesh out Tools while continuing Gate A:

- Rebuilt the visible Tools tab into a working utility studio instead of a launchpad with dead-end actions.
- Added standalone local/browser tools for Heavy 16th field calculations, estimate building, invoice drafting, and material takeoff.
- Kept Records server-backed and tied to accepted active work/project records; Records still opens from Tools but does not fabricate project or payment rows.
- Kept invoice drafting honest for Gate A: users can copy or download a draft, but the UI explicitly states that email/text delivery is not production-ready. No fake SMS, fake email delivery, fake payment processing, escrow, payroll, or 1099 behavior was added.
- Updated desktop/mobile E2E coverage so `/app/tools` opens every new tool surface and verifies the no-fake-delivery invoice note.
- Rendered local Tools QA with Playwright at 390x844 mobile and 1440x900 desktop, including hub, calculator, and invoice surfaces. The pass found no horizontal overflow and zero console errors. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-visual-qa`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.
- Deployed the runtime slice to Railway production as deployment `ac8d1f8d-ac13-424d-b1ba-a4dc0a0ebdde` from commit `24c37ac7dfc086903c688ec64df684f42e35db6b`.
- Live `https://rivt.pro/api/health` returned 200 with exact build commit `24c37ac7dfc086903c688ec64df684f42e35db6b`; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 561 ms duration.
- `npm run smoke:gate-a:live` cannot run directly from this workstation because local execution lacks `DATABASE_URL`, and `railway run` from the workstation still cannot resolve Railway private DNS (`postgres.railway.internal`). This is the same known split-run limitation from the production UI smoke work, not a Tools-specific regression.

## Packet 08 Records Workspace Upgrade

Completed on 2026-06-21 as a continuation of the Tools buildout:

- Reworked the Records surface from prompt-driven actions into a structured field-documentation workspace with accepted-work list, project status header, refresh/report controls, metrics, field notebook, evidence upload notes, stored evidence list, completion checklist, confirm/dispute panel, latest update, timeline, and closeout report preview.
- Removed browser `window.prompt` usage from Records actions. Notes, upload notes, completion notes, and confirm/dispute reasons now use visible in-app forms with disabled states and inline success/error feedback.
- Preserved the production honesty boundary: Records still only unlocks for accepted active work from the server, does not fabricate project rows, and does not create fake payment, invoice, SMS, or email delivery records.
- Updated the project API wrapper so completion checklist values can be submitted from the UI while retaining safe defaults for existing callers.
- Expanded desktop/mobile E2E to cover `/app/tools/records` with mocked accepted work, server-owned project record data, field note submission, and report loading.
- Rendered local Records QA with Playwright at 390x844 mobile and 1440x900 desktop. The pass found no horizontal overflow and zero console errors. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-records-visual-qa`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.
- Deployed the runtime slice to Railway production as deployment `83c95b13-a681-4e31-9768-e87aea6f8312` from commit `1679aec006c8cb393b6986aa24ec507c15bc8181`.
- Live `https://rivt.pro/api/health` returned 200 with exact build commit `1679aec006c8cb393b6986aa24ec507c15bc8181`; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 464 ms duration.

## Packet 08 UI System Pass

Completed on 2026-06-21 as controllable UI hardening after the founder called out that the app still felt like an AI-generated interface:

- Refined the global V2 visual system with a more disciplined industrial palette, reduced radii, softer surfaces, cleaner shadows, `Instrument Sans`, stronger type hierarchy, and less default card/border noise.
- Updated the authenticated shell so the sidebar, top bar, global search, mobile header, and main canvas feel like one product system while preserving the approved five primary concepts: Home, Work, Crew, Shop Talk, Tools.
- Reworked the visible Home, Work, Crew, Inbox, Tools, Records, and Profile surfaces at the CSS/system layer to improve hierarchy, spacing, tap targets, status tabs, rows, cards, tool panels, message bubbles, profile facts, and mobile containment without changing Gate A business logic or adding fake feature success.
- Preserved the RIVT logo assets and did not regenerate, trace, recolor, or approximate approved marks.
- Rendered local authenticated UI QA with Playwright fallback because the Browser plugin was not exposed in this session. Desktop and mobile screenshots for Home, Work, Crew, Inbox, Tools, Records, and Profile were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-system-pass`; the pass reported zero page/console errors and no horizontal overflow.
- Required local gates passed after the UI system pass: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.
- Deployed the runtime slice to Railway production as deployment `747f71f5-f790-4277-8d26-cc50bcdff77a` from commit `8d90ef22be8fee2471435ccf9cab134d04154560`.
- Live `https://rivt.pro/api/health` returned 200 with exact build commit `8d90ef22be8fee2471435ccf9cab134d04154560`; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 465 ms duration.
- This is accepted as controllable UI hardening evidence only. It does not close the remaining Gate A external/manual blockers.

## Packet 08 Shared UI Primitives Pass

Completed on 2026-06-21 as the next serious UI push after the founder asked to keep improving the product toward a professional, popular-app feel:

- Added a shared UI primitive layer in `src/components/ui.tsx` and `src/components/ui.css` for page headers, panels, empty states, metric tiles, status pills, and deterministic avatars.
- Applied those primitives to high-visibility authenticated surfaces: shell/profile avatars, Home empty state/header, Crew metrics/panels/empty states, Inbox metrics/panels/empty states, Profile header/avatar/account facts, and Work status/empty states.
- Reduced one-off per-screen CSS and removed duplicated local avatar, badge, and empty-state treatments so future screens can converge on one RIVT component system instead of bespoke card stacks.
- Fixed a rendered mobile profile issue where long account facts such as email addresses inherited oversized numeric KPI styling and overflowed the card.
- Corrected the mobile top-bar logo to use the approved high-contrast RIVT lockup on the dark header surface. No logo was regenerated, recolored, traced, or approximated.
- Preserved Gate A business logic and production honesty boundaries: no fake feature success, no homeowner flows, no provider claims, and no frontend-only production state were added.
- Rendered authenticated UI QA with Playwright route mocks because the in-app Browser runtime does not expose the same route-mocking controls needed for authenticated surface tests. Full desktop/mobile screenshot evidence for Home, Work, Crew, Inbox, Tools, Records, and Profile was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-primitives-pass`; final mobile spot-checks for Crew and Profile after polish fixes were saved at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-primitives-pass-final`. The rendered pass reported zero page/console errors and no horizontal overflow.
- Required local gates passed after the shared UI primitives pass: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.
- Deployed the runtime slice to Railway production as deployment `e3ad8e53-e001-418d-b688-48519cd6a8dd` from commit `b2229170be23405138bb66ce479755585730163b`.
- Live `https://rivt.pro/api/health` returned 200 with exact build commit `b2229170be23405138bb66ce479755585730163b`; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 534 ms duration.
- This is accepted as controllable UI hardening evidence only. It does not close the remaining Gate A external/manual blockers or the remaining large-component strangler work in `src/App.tsx`.

## Packet 08 Tools Primitive Alignment Pass

Completed on 2026-06-21 as a focused follow-up to the shared UI primitive system:

- Migrated the Tools and Records surfaces onto shared `PageHeader`, `Panel`, `EmptyState`, `MetricTile`, and `StatusPill` primitives instead of one-off local section/header/card markup.
- Reduced bespoke Tools/Records CSS selectors that were styling old local card structures, aligned panel headers/actions with the shared UI layer, and fixed shortcut rows so status pills and open arrows have stable columns.
- Preserved the Gate A honesty boundary: no fake invoice sending, SMS delivery, payment processing, escrow, payroll, tax filing, or frontend-only Records success was added. Tools still calculate locally; Records remains server-backed and available only for accepted active work.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.
- Deployed the runtime slice to Railway production as deployment `b7740f77-4af0-4ba2-838f-ff85386cb86b` from commit `0680b8f013c167ac4706ad6faf648a0e5cc6df3a`.
- Live `https://rivt.pro/api/health` returned 200 with exact build commit `0680b8f013c167ac4706ad6faf648a0e5cc6df3a`, PostgreSQL dependency `postgres`, and object storage dependency `s3-compatible`.
- Anonymous `https://rivt.pro/api/storage` returned `Authentication required`, which is expected for the private storage endpoint. Public storage health is represented through `/api/health` and `npm run monitor:production`.
- `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 494 ms duration.
- This is accepted as controllable UI hardening evidence only. It does not close the remaining Gate A external/manual blockers or the remaining large-component strangler work in `src/App.tsx`.

## Packet 08 Launch Polish Phase 2 - Trust, Support, and Onboarding Honesty

Completed on 2026-07-04 on branch `codex/launch-polish-phase-2` as a controllable follow-up to Claude's launch-polish audit:

- Removed the unenforced Government-ID posting/accepting claim from product copy and type definitions. Trust copy now states only what the app currently enforces: email verification and platform consent before account setup is complete.
- Fixed the storage account display so Settings reads the nested `accountStorage` shape returned by `/api/storage` instead of always showing `0 B`. Storage quota copy now says no cap is set during beta when no account quota exists, and quota warnings only appear when a configured limit is actually present.
- Replaced the fake feedback success loop with a real support-case submission path using `/api/v1/support/cases`, idempotency keys, inline sending/error states, and a direct `support@rivt.pro` mail link.
- Made legal rows reachable from Settings by adding static launch placeholders for Terms, Privacy, and Subcontractor Agreement under `public/legal/`. Data-export requests now create a support case instead of doing nothing.
- Converted notification preferences from local-only toggles to server-backed `/api/v1/notification-preferences` reads and writes for messages, new jobs, work updates, and system notifications. Message browser notifications now honor the persisted Messages/Push preference.
- Removed the unrelated trade-personalization toggle from the notification panel so Settings no longer mixes notification delivery with feed personalization.
- Simplified onboarding to one visible step panel, changed "Enter network" language to "Open RIVT", removed repeated inner step numbers, persisted draft progress in `localStorage` across reloads, best-effort syncs profile draft fields during onboarding, and sends onboarding goal/topic interests to the server on completion.
- Adjusted pending-onboarding server policy to allow `PATCH /api/v1/profile` and `POST /api/v1/onboarding/complete` before full account activation, while keeping other authenticated writes fail-closed.
- Updated desktop/mobile E2E route mocks to cover the new notification-preferences read path.
- Required local gates passed: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm audit --omit=dev`, targeted `node --test test/auth.test.js test/api.test.js test/frontend-smoke.test.mjs`, and `git diff --check`.
- `npm run test:integration` could not complete locally because this workstation has no `TEST_DATABASE_URL`; the suite timed out after 184 seconds without assertion output. This is recorded as an environment limitation, not a launch acceptance pass.
- Deployed to Railway production from master commit `b823330f2d3b33dee6a93cdf29ce871031f4446c`.
- Live `https://rivt.pro/api/health` returned 200 with exact build commit `b823330f2d3b33dee6a93cdf29ce871031f4446c`, migration `0021_shop_talk_post_media`, PostgreSQL dependency `postgres`, S3-compatible object storage, and Sentry configured.
- `npm run monitor:production` passed with exact build commit `b823330f2d3b33dee6a93cdf29ce871031f4446c`, PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 507 ms duration.
- This is accepted as controllable trust/support/onboarding polish only. It does not close remaining external/manual Gate A blockers, Stripe production configuration, physical accessibility checks, legal counsel review, or incident-readiness approvals.

## Latest Packet 08 Pass - Launch Polish Production Verification

- Verified the launch-polish Phase 2 runtime after the duplicate onboarding-heading cleanup was deployed:
  - production runtime commit `44d208b983e0029ef524f0690ab2b9fefa491b74` was picked up by Railway service `RIVT`
  - `npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 838 ms duration
- Live authenticated Settings QA used the dedicated testing account and verified:
  - Storage no longer reads as a broken flat `0 B` response; the Settings panel renders the nested account-storage shape and beta quota copy
  - notification preferences persist across reload through the server-backed preferences API
  - Terms, Privacy, and Subcontractor Agreement links return HTTP 200 from `/legal/terms.html`, `/legal/privacy.html`, and `/legal/subcontractor-agreement.html`
  - Feedback creates a real support case through `/api/v1/support/cases` and displays `Support case created` instead of a fake local success state
- Fresh-signup onboarding QA used the deployed production frontend at 390x664 with mocked pending-account API responses to avoid creating throwaway production accounts:
  - first step rendered one visible `Choose your account type` heading and one `STEP 1 OF 5` label
  - profile draft fields survived reload (`Codex QA Tradesperson`, `Jacksonville`, `FL`)
  - the smoke finished with no console/page errors after filtering Playwright's expected service-worker-block message
- Rendered evidence saved outside the repo:
  - Settings/legal/support: `C:\Users\zboyt\AppData\Local\Temp\rivt-live-qa-1783176076700\`
  - Onboarding reload recovery: `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-qa-1783176956481\`
- Browser tooling note:
  - the Browser plugin instructions were loaded, but the current in-app Browser runtime did not expose usable documentation/tabs APIs for route-mocked authenticated QA; Playwright fallback was used for the mobile smokes.
- Remaining boundary:
  - this closes the controllable production-verification pass for Settings storage, support, legal links, notification persistence, and onboarding reload recovery. It does not replace physical-device accessibility checks, legal counsel review, or Stripe live webhook/Customer Portal configuration.

## Latest Packet 08 Pass - Stripe Billing Smoke Tooling

- Added a repeatable live Stripe billing smoke command:
  - `npm run smoke:billing:live` logs in with environment-provided smoke credentials, checks `/api/v1/billing/status`, verifies required billing provider variables report configured, and confirms unsigned webhook payloads fail with `STRIPE_SIGNATURE_INVALID` instead of setup failure
  - setting `RIVT_BILLING_EXERCISE_REDIRECTS=true` also creates hosted Stripe Checkout and Customer Portal sessions without entering card details or charging the account
- Added the script to security lint coverage and documented the smoke environment variables in `.env.example` and `PRODUCTION.md`.
- Preserved launch boundaries:
  - no Stripe keys, testing passwords, webhook secrets, or live session URLs were committed
  - no frontend-only entitlement, job-payment processing, escrow, payroll, or homeowner flow was added
  - the smoke only verifies subscription billing infrastructure and does not mark billing launch-ready until a real paid checkout webhook updates server-owned entitlements
- Local gates:
  - `node --check scripts/live-smoke-billing.js` (pass)
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run lint:security` (pass)
  - `npm run test:unit` (pass; 44/44)
  - `git diff --check` (pass; CRLF warnings only)
- Production deployment status:
  - runtime release commit `57c2f773376ae9a7178a99b0911c8dd3fee93c88` was pushed to GitHub and picked up by Railway production service `RIVT`
  - `EXPECTED_SOURCE_COMMIT=57c2f773376ae9a7178a99b0911c8dd3fee93c88 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 542 ms duration
- Follow-up smoke-tool robustness patch:
  - production runtime commit `771bc4948976d483fed9099194ab43197b667f78` was deployed after the smoke learned to accept Stripe webhook signature failures that return HTTP 400 with an empty body
  - `EXPECTED_SOURCE_COMMIT=771bc4948976d483fed9099194ab43197b667f78 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, configured Sentry, operational controls off, seven anonymous private-route checks, and 579 ms duration
- Founder-run live billing smoke evidence:
  - `npm run smoke:billing:live` passed against `https://rivt.pro` for the dedicated testing account
  - billing provider reported `checkoutConfigured: true`, `webhookConfigured: true`, and `portalConfigured: true`
  - unsigned webhook probe was rejected with HTTP 400 (`rejected_unsigned_event_http_400`), proving the webhook is not falling through as setup-required
  - live Checkout Session creation returned a `cs_live_` session on `checkout.stripe.com`
  - live Customer Portal session creation returned `billing.stripe.com`
  - the smoke account remained `plan: free`, `active: false`, `status: inactive`, so this did not charge a card or prove paid entitlement activation
- Founder live paid-entitlement evidence:
  - the owner account completed live RIVT Pro signup on 2026-07-03, scheduled cancellation, resumed the subscription, refreshed Settings, and confirmed the app still shows RIVT Pro active
  - this records the existing founder-run paid loop as live evidence; no duplicate payment was run during this pass
- Remaining boundary:
  - capture a read-only `/api/v1/billing/status` check for the owner account when convenient, so the evidence includes the server JSON state in addition to the Settings UI confirmation.

## Latest Packet 08 Pass - Soft Launch Polish Checkpoint

- Added a small launch-polish checkpoint focused on truthfulness and first-run clarity:
  - returning-user entry on the onboarding/landing carousel now reads as an intentional account path (`Already have an account` / `Log in`) instead of a small afterthought beside account creation
  - review notifications now say `Open reviews` when they only route to the reviews surface, and reserve `Open review` for notifications that carry an exact review target
  - the fail-closed auth e2e selector now matches the current three-slide onboarding headlines instead of stale `Shop Talk, built for the trades` copy
- Local gates:
  - `npm run build` (pass)
  - `npm run lint` (pass)
  - `npm run test:unit` (pass; 45/45)
  - `npm run test:e2e` (pass; auth fail-closed and jobs/discovery)
  - `npm audit --omit=dev` (pass; 0 vulnerabilities)
- Boundary:
  - `npm run test` timed out after four minutes because it proceeds into the full integration suite; run `npm run test:integration` separately with `TEST_DATABASE_URL` configured before using this checkpoint as full integration evidence.
- Production deployment status:
  - branch `codex/soft-launch-ultimate-finish` was fast-forward merged to `master`
  - production now serves source commit `6cd8f5d6b87d057eb836f10bc79efc69a289d106`; live `/api/health` reports PostgreSQL, S3-compatible object storage, configured Sentry, and migration `0022_community_audiences`
  - `EXPECTED_SOURCE_COMMIT=6cd8f5d6b87d057eb836f10bc79efc69a289d106 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 622 ms duration.

## Latest Deployment Evidence - Job-Scoped Tool Context

- Production source `1f9580ca388ed2c6e28864227d58f3787165f110` is live on `https://rivt.pro`; health reports PostgreSQL, S3-compatible object storage, configured Sentry, and migration `0022_community_audiences`.
- `EXPECTED_SOURCE_COMMIT=1f9580ca388ed2c6e28864227d58f3787165f110 npm run monitor:production` passed with seven anonymous private-route checks and operational controls disabled.
- The next focused acceptance check is a physical accepted-work route: open Invoice and Daily Log from that job's workspace and ensure the accepted job is named before data entry. Run the newly extended PostgreSQL integration assertion when `TEST_DATABASE_URL` is available.

## Packet 42 - Estimate Email Delivery Verification

- Branch `codex/estimate-delivery` was reviewed, fast-forward merged to
  `master`, and deployed by Railway as production deployment
  `8b04379c-b828-430b-9a54-55aad5608048`.
- The isolated ignored `TEST_DATABASE_URL` points to `rivt_test`; its reset ran
  through migration `0027_default_private_photo_album` with no pending
  migrations.
- Full automated evidence passed: `npm run build`, `npm run lint`,
  `npm run lint:security`, `npm run test:unit` (53 tests), `npm run test:e2e`,
  `npm run test:ui:tools`, `npm run test:ui:mobile-actions`,
  `npm audit --omit=dev`, and `npm run test:integration` (19 PostgreSQL
  suites).
- The migration lifecycle test now includes migration `0027` in its rollback
  contract instead of asserting an obsolete rollback version.
- Live `https://rivt.pro/api/health` reports exact source
  `4793b1b3dd240fb709e88c820d649ea5f31f5031`, migration
  `0027_default_private_photo_album`, PostgreSQL and S3-compatible storage,
  configured Sentry, and configured Web Push.
- `EXPECTED_SOURCE_COMMIT=4793b1b3dd240fb709e88c820d649ea5f31f5031 npm run
  monitor:production` passed with seven anonymous private-route checks.
- Founder-controlled inbox acceptance completed on 2026-07-14: the real
  estimate email arrived successfully. Provider-failure and same-key replay
  behavior remain covered by the isolated integration suite; no production
  provider outage was induced for testing.

## Next Exact Task

After Packet 43 is production verified, begin a separate consolidation packet:
merge Price Book into Materials while preserving all saved price-book records
and keeping Materials useful without a RIVT job. Follow with a separately
reviewed Time & Costs packet for Time, Expenses, Mileage, and Tax Summary. Do
not delete stored records or expose the six contained tools until their useful
capabilities have an explicit destination. In parallel, complete the physical
accessibility checklist on iOS, Android, desktop keyboard-only, and a screen
reader before nationwide launch.

## Blocking Founder Decisions

Needed before Gate A recruitment, not before finishing Packet 00:

- Pilot user count and named cohort.
- Priority Jacksonville trade clusters and configured service area.
- Support hours and escalation owner.
- Stripe pricing model, product/price creation, webhook setup, and Customer Portal activation.
- Whether SMS is deferred from Gate A.
- Review/dispute policy.
- Pilot retention/deletion policy.
- Legal-review owner and approval path.

## Required Handoff Format

At the end of each packet record:

1. Source commit/branch and working-tree state.
2. Requirements moved and new maturity state.
3. Files/migrations/config changed.
4. Commands/tests run with results.
5. Live/staging deploy status and build identifier.
6. Screenshots/manual acceptance evidence.
7. New risks or decisions.
8. Exact next packet/task.
