# RIVT Build State

Last updated: 2026-06-29 America/New_York
Current gate: Gate A launch hardening
Current phase: Packet 08 controllable UX hardening, invoice and estimate tool polish, no-scroll Heavy 16th calculator fit, Work draft editor date-normalization hotfix, launch-readiness machine gate sweep, improvement backlog and truthful-entitlement cleanup, Tools calculator/estimate extraction and provider-doc hardening, App activity feed hook extraction, App theme hook extraction, Shop Talk reaction hook extraction, App state type extraction, Work empty-state and runtime helper extraction, profile training data extraction, Shop Talk fallback data extraction, Shop Talk community helper extraction, dead guest job fixture removal, Work mapping extraction, app preference helper extraction, app route metadata extraction, account/activity panel extraction, auth screen extraction, legacy sidebar export cleanup, legacy App view cleanup, Shop Talk route split, Profile session ownership split, App profile-route split, frontend smoke-test tripwire, async password hashing, exact direct dependency pinning, founder/support/legal-safety approvals recorded, incident and launch readiness gates passing, Gate A approval packet prepared, incident rehearsal passed, incident routing approved, recovery policy approved, support hours and backup incident owner recorded, Sentry error monitoring and first escalation route configured, server-owned Shop Talk reactions/reputation ledger, Daily Log live UI proof, Daily Log Records bridge, daily engagement loop, Shop Talk answer queue, RIVT Daily home check-in, Trade News real-media and mobile layout pass, production UI smoke regression fixes, Tools studio release, Records workspace upgrade, UI system pass, shared UI primitives, Tools primitive alignment, Shop Talk command center, Tools app surface pass, Heavy 16th multi-mode calculator, Invoice Draft app upgrade, Shop Talk reaction/social pulse pass, expanded production accessibility smoke verified, Claude-audit UI consolidation deployed, global search command surface deployed, server-owned profile search deployed, and local `TEST_DATABASE_URL` configured against isolated test Postgres; physical/deeper manual accessibility-device evidence remains the next launch-quality boundary
Active packet: `docs/delivery/packets/08_GATE_A_HARDENING.md`
Repository branch: `master`
Production release commit: see live `/api/health` build metadata

## Latest Packet 08 Pass - Invoice and Estimate Tool Polish

- Reworked Estimate into a target-first bid calculator: recommended price range is now the primary visual object, with copy-ready output, labor/material/cushion quick stats, denser two-column mobile inputs, and a separate cost breakdown panel.
- Reworked Invoice Draft into a more credible invoice app surface: total due and copy/print actions now appear first, local templates are compact, invoice details use a cleaner responsive grid, line items are denser on mobile, and the printable invoice preview remains prominent.
- Preserved the Gate A honesty boundary: invoice email/text still open user-owned drafts only, RIVT still does not send on the user's behalf, no fake payment processing was added, and templates remain explicitly device-local.
- Strengthened `npm run test:ui:tools` with Estimate screenshot evidence in addition to the existing Tools, Heavy 16th, Invoice, Daily Log, and Records/photos coverage.
- Rendered QA passed for Tools at desktop and mobile through `npm run test:ui:tools`; screenshots were saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, including `mobile-estimate.png`, `mobile-invoice.png`, and `desktop-invoice.png`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run test`, `npm run test:ui:tools`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- Production deployment is pending for this slice until the committed source is pushed and Railway monitor confirms the exact build commit on `https://rivt.pro`.

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

## Next Exact Task

Continue Gate A launch hardening by running `docs/quality/PHYSICAL_ACCESSIBILITY_CHECKLIST.md` on physical iOS Safari, Android Chrome, desktop keyboard-only, and at least one screen reader, then record the pass/fail evidence before named-cohort launch. Keep `npm run incident:readiness -- --require-ready` and `npm run launch:readiness -- --require-ready` passing as the machine-readiness gates while that manual evidence is gathered.

## Blocking Founder Decisions

Needed before Gate A recruitment, not before finishing Packet 00:

- Pilot user count and named cohort.
- Priority Jacksonville trade clusters and configured service area.
- Support hours and escalation owner.
- Email provider and sender-domain plan.
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
