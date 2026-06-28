# Gate A Requirements Traceability

Status values:

- **Verified:** persisted and tested against the live/production-like service.
- **Partial:** real implementation exists but Gate A behavior or safety is incomplete.
- **Prototype:** UI/local or application-blob behavior only.
- **Missing:** no meaningful implementation found.
- **Blocker:** current behavior is unsafe or contradicts Gate A.

Evidence must eventually link to implementation, automated tests, manual acceptance proof, and deployed build.

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
| GA-PRO-002 | Role-correct professional profile persists independently | Partial | Canonical account/profile records persist independently of legacy app-state and Packet 02 live smoke verified profile update/publish; portfolio/contact/availability completeness remains launch follow-up. |
| GA-PRO-003 | Trade specialties use canonical taxonomy | Partial | Versioned 25-trade taxonomy, profile relationship tables, and profile/onboarding APIs exist; broader profile-search and trade-management UX still need polish. |
| GA-PRO-004 | Service area and location privacy | Partial | Public-area/private-address protection is verified for jobs and accepted work; profile-level service-area normalization/geospatial privacy remains incomplete. |
| GA-PRO-005 | Availability and controlled contact visibility | Partial | Contact visibility is constrained through accepted-work messaging and server-owned profiles; source `436b83f` adds Home `Availability radar` that writes `available` / `limited` / `unavailable` to the authenticated server-owned profile through `PATCH /api/v1/profile`. A full availability calendar, schedule windows, and contractor-facing availability search remain open. |
| GA-PRO-006 | Profile photos/portfolio use authorized private media | Partial | Private project evidence media is participant-authorized and signed; profile photo/portfolio ownership and moderation remain unresolved before broad launch. |

## Application Shell and UX

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-UX-001 | Compact role-correct shell and routes | Partial | Modern shell exists and Packet 08 UI system pass deployed a cleaner authenticated shell/sidebar/top-bar/main canvas treatment across Home, Work, Crew, Inbox, Tools, Records, and Profile on source `8d90ef2`. The shared UI primitives pass on source `b222917` added reusable page headers, panels, empty states, metric tiles, status pills, and avatars, then applied them to high-visibility shell/Home/Crew/Inbox/Profile/Work surfaces. The Tools primitive alignment pass on source `0680b8f` moved Tools and Records onto those shared primitives as well. Legacy views/routes and large `src/App.tsx` sections remain. |
| GA-UX-002 | Mobile nav is Home, Work, Crew, Shop Talk, Tools | Partial | Packet 03 shell uses exactly Home, Work, Crew, Shop Talk, Tools in primary navigation; desktop/mobile E2E and live release evidence pass. Older fallback components remain for later App cleanup, but the app-state bridge is no longer active frontend persistence. |
| GA-UX-003 | Messages, notifications, search, and profile use top-bar entry | Partial | Search, messages, notifications, and profile use top-bar entry; Packet 05 live smoke proves Messages/Notifications are server-owned. Authenticated UI smoke `ui-a11y-20260621062332-02b380` verified top-bar controls and opened search, notifications, profile/account, and messages/inbox across contractor/tradesperson mobile and contractor tablet/laptop/desktop scenarios after tap-target and text-scale fixes. Older fallback components remain for later App cleanup, but messages/notifications do not depend on app-state persistence. |
| GA-UX-004 | No role toggle or duplicate global Post action | Partial | Signup/onboarding role selection exists appropriately; authenticated UI smoke `ui-a11y-20260621062332-02b380` verified no role toggle and no More tab in the signed-in contractor/tradesperson shell. Legacy components still need later cleanup. |
| GA-UX-005 | Every screen has loading, empty, error, offline, permission, and retry states | Partial | Work now has server loading, directional empty, error, retry, filter, and detail states with local E2E coverage. Home source `436b83f` adds `RIVT Daily` work/money/crew/field-knowledge signals plus a server-backed availability save path and desktop/mobile E2E coverage; source `73f79ac` updates the Home field signal to surface current Shop Talk answer opportunities when available; source `aeb23ca` expands Home with a daily habit loop and `Reputation momentum` panel that routes users toward Work, Shop Talk, and Tools without inventing fake marketplace density. Shop Talk/Trade News now has curated-source fallback content, search-first filters, summary metrics, honest empty states, readable card/detail states, loading skeletons, original-source links, and rendered desktop/mobile QA through `npm run test:ui:shop-talk-news`. Shop Talk source `73f79ac` adds an Answer queue card, Answer now jump path, active answer-queue filter chip, and answer guidance card to improve the daily contributor loop; source `aeb23ca` adds a `Reputation path` card that explains first-answer, verified-fix, and badge progression while preserving the durable-reputation honesty boundary. Trade News source `a59eb47` adds real-media enrichment from RSS/article metadata, explicit article/feed/fallback thumbnail states, safer public-image filtering, mobile command/KPI compaction, and live `/api/news` proof of 24 real/feed thumbnails out of 30 with no missing thumbnails or source URLs. Shop Talk source `13f7e2e` moves reactions from browser-local state to authenticated server-owned thread/answer reaction aggregates with idempotent up/down/clear behavior, append-only reaction events, audit events, and a live Railway-SSH smoke; full author-earned reputation still needs canonical server-owned posts/answers and profile surfacing. Tools has working standalone local utility surfaces for Heavy 16th calculations, estimates, invoice drafts, material takeoff, and a new Daily Log field-record draft, plus server-backed Records. The Tools app surface pass on source `ad5ff7d` upgraded the active Tools hub with app-style launch cards, copy-ready ft/in/16ths calculator output, estimate composition meter, invoice email/SMS device draft affordances with no fake delivery claim, material presets, and repeatable rendered QA through `npm run test:ui:tools`. Heavy 16th source `444fc96` adds real Length, Spacing, Cuts, and Hardware modes with field-card copy output and 44px mode controls. Invoice Draft source `97d9da7` adds a cleaner mobile builder, local browser-only saved templates, a polished printable preview, and print action while preserving no-fake-delivery copy. Daily Log source `aeb23ca` adds crew hours, site notes, blockers, materials, safety, next steps, checklist, copy/download output, and explicit device-local draft save/load; source `d03f2a` connects Daily Log to the authenticated Records API when accepted active work exists, adds the `Records-ready` target state and `Save to Records` timeline-note action, and preserves the device-local fallback when no accepted work is loaded. Records now has accepted-work selection, inline notes, evidence upload notes, stored evidence list, completion checklist, confirm/dispute controls, timeline, and closeout report preview; the Tools primitive alignment pass replaced one-off local Tools/Records empty/metric/status surfaces with shared primitives. Invoice delivery remains explicitly local draft/copy/download/print until server email/SMS delivery is implemented; Daily Log can now save a server-backed project note only through the accepted-work Records path, with copy/download/local draft fallback otherwise. Remaining screens still need the matrix. |
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
| GA-OPS-004 | Backup and timed restore drill pass | Verified | Timed isolated logical restore passed against temporary Railway target `Postgres-3Ei3` on 2026-06-20. A named backup-artifact restore also passed on 2026-06-21: `npm run backup:logical-artifact` created encrypted object `backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm` from 59 tables / 1,524 rows in 630 ms; `npm run restore:logical-artifact -- --apply-migrations` restored that object to isolated target `Postgres-_FQz`, applied nine migrations through `0009_durable_rate_limits`, restored 59 tables / 1,524 rows, verified table/column/sequence and strict manifest-count parity with zero diffs in 13,411 ms; `npm run restore:drill` then verified the isolated target in 1,862 ms. The temporary target was deleted, detached restore volumes were marked for deletion, and temporary restore variables were removed. `docs/operations/recovery-policy.json` now records this evidence and approves Gate A RPO 1440 minutes, RTO 240 minutes, 30-day backup retention, 30-day restore-drill cadence, next restore drill due `2026-07-21T04:18:59.000Z`, with founder and operations approval by Michael. |
| GA-OPS-005 | Structured logs, error monitoring, alerts, and incident routing | Partial | Packet 08 added structured JSON request/domain logs and request IDs. `npm run monitor:production` and the scheduled `Production Synthetic Check` workflow now verify public health, provider controls, and anonymous fail-closed routes from outside Railway; the workflow installs from lockfile, uploads monitor evidence, opens/updates a single GitHub incident issue on failure, and closes it after recovery. Source `6d8e276` adds Sentry-compatible error monitoring hooks for HTTP 500, startup failure, unhandled rejection, and uncaught exception capture; `/api/health` and authenticated `/api/readiness` expose redacted monitoring setup status. Railway deployment `eaa7409d` configures Sentry Cloud for the RIVT production service, live health reports `observability.errorMonitoring.mode=configured`, and Sentry accepted smoke event `RIVT Sentry smoke test` with HTTP 200. Sentry alert rule `Send a notification for high priority issues` is connected to project `node-express`, notifies suggested assignees or recently active members on every trigger, and triggered once for the smoke issue at 2026-06-22 02:38 UTC; this is accepted as the first pilot escalation route, with dedicated phone/SMS paging recommended before broader scale. Backup owner Anya Tingle is recorded with email and phone status recorded, without storing the phone number in the repo. Founder-provided support coverage is recorded as Monday-Saturday, 9:00 AM-5:00 PM, America/New_York. `docs/operations/incident-routing.json` is approved for the Gate A pilot route scope by Michael at `2026-06-22T03:09:36.0366141Z`. Scenario A rehearsal passed on 2026-06-22: `npm run monitor:production` passed locally, `railway ssh --service RIVT --environment production -- npm run smoke:gate-a:live` passed inside the Railway service with zero seed/demo findings and seven anonymous private-route checks, and Sentry accepted incident-rehearsal event `43fc7567f458490582db1f6642e2e0ea` with HTTP 200. Michael approved founder/support/legal-safety signoffs at `2026-06-22T03:48:04.1166525Z`, and `node scripts/incident-readiness-check.js --json` now reports `ready` with zero findings. Dedicated phone/SMS paging remains recommended before broader scale. |
| GA-OPS-006 | Critical rate limits and upload abuse limits | Verified | Auth/write/upload limits now use PostgreSQL-backed `rate_limit_windows`, uploads retain MIME/size/count policy, domain quotas remain in workflow routes, and signup/mutation kill switches are live. Threshold tuning remains an operating task, not a launch blocker. |
| GA-OPS-007 | Automated tests cover critical journeys and authorization | Partial | Unit/integration and Playwright journeys pass; local `TEST_DATABASE_URL` is configured against isolated `rivt_test` Postgres so `npm run test` now executes all 12 DB-backed integration tests locally with zero skips; disposable-Postgres auth/job/match authorization coverage passes in GitHub Actions. Packet 08 controllable progress now opens top-bar search, notifications, profile/account, and messages/inbox in local mocked E2E, and production smoke `ui-a11y-20260621062332-02b380` applied interaction audits to those same top-bar surfaces across the expanded viewport/text-scale matrix after fixing search, notifications, theme toggles, Inbox, and 200% text-scale overflow. Source `436b83f` expands `npm run test:e2e` so Home opens on desktop/mobile, `RIVT Daily` and `Availability radar` render, and a mocked server-backed profile availability update persists before continuing through Work, top-bar actions, Tools, and Records. A temporary rendered Playwright QA pass covered Shop Talk -> Trade News on desktop/mobile against the real local `/api/news` endpoint. Production `/api/news` was verified after deployment `7fe1c3ea-d5f4-48c4-b757-a46ff8ebc369` on source `4fe22bc` with zero Google favicon thumbnails, zero missing thumbnails, and zero missing source URLs; the later Trade News real-media deployment `4fb062bd-1c3e-474e-90df-fe42f4f2e1fa` on source `a59eb47` returned 30 live items with 24 article/feed thumbnails, 6 fallbacks, zero missing thumbnails, zero missing source URLs, and zero Google favicon thumbnails. Tools E2E opens Heavy 16th, Estimate builder, Invoice draft, and Material takeoff on desktop/mobile; Records E2E opens accepted-work project records, submits a field note, and loads a server report. Rendered Playwright QA at 390x844 and 1440x900 found no horizontal overflow or console errors for Tools and Records. Packet 08 UI system and shared-primitives passes also rendered Home, Work, Crew, Inbox, Tools, Records, and Profile at desktop/mobile breakpoints with no horizontal overflow and no console/page errors. Shop Talk command center source `4cef797` adds repeatable `npm run test:ui:shop-talk-news` coverage for Shop Talk and Trade News search, original-source links, no horizontal overflow, and console/page-error regression checks at desktop/mobile widths. Shop Talk reaction sources `1227e1c` and `13f7e2e` expand that command with regression coverage for one active thread reaction, one active answer reaction, reaction clearing, server-owned reaction API mocks, Social hub pulse visibility, accessible active labels, and live authenticated Railway-SSH reaction smoke; Shop Talk answer queue source `73f79ac` expands it with answer queue visibility, Answer now interaction, active answer-queue filtering, answer guidance, and skip-link screenshot-artifact regression coverage; Daily Engagement source `aeb23ca` expands it with Shop Talk reputation-path coverage; Trade News real-media source `a59eb47` expands it with real-media class checks and deterministic media rendering. Tools app surface source `ad5ff7d` adds repeatable `npm run test:ui:tools` coverage for Tools hub, Heavy 16th calculator, Estimate Builder, Invoice Draft, Material Takeoff, email/SMS draft affordances, material presets, no horizontal overflow, and console/page-error regression checks at desktop/mobile widths. Heavy 16th source `444fc96` expands E2E and `npm run test:ui:tools` to cover Spacing mode and rendered mode behavior across Length, Spacing, Cuts, and Hardware. Invoice Draft source `97d9da7` further expands `npm run test:ui:tools` for template save/load, recipient fields, draft email/SMS actions, printable invoice preview, no horizontal overflow, and console/page-error regression checks. Daily Engagement source `aeb23ca` expands `npm run test:ui:tools` for the Daily Log mini-app, field-note entry, checklist toggles, preview output, local draft save, no horizontal overflow, and console/page-error regression checks; Daily Log Records bridge source `d03f2a` expands it for `Records-ready`, accepted-work target copy, `Save to Records`, project timeline note creation against mocked authenticated APIs, local fallback, no horizontal overflow, and console/page-error regression checks. Source `9c614ac` adds `npm run smoke:daily-log-ui:live`, and split live run `daily-log-ui-20260622004926-05a797` passed with real invited accounts, real accepted work, real browser login, server-backed `Save to Records`, one verified project timeline note, and cleanup of two disposable accounts. Error monitoring source `6d8e276` adds unit coverage for setup-required status, DSN redaction, no-op unconfigured capture, sanitized Sentry-compatible delivery, public health redaction, and production monitor observability output. The source also passed `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check`; server-owned reaction source `13f7e2e` passed the same local gate set plus `npm run smoke:shop-talk-reactions:live` and `npm run monitor:production`; source `6d8e276` passed `npm run monitor:production` live with observability evidence; broader domains and physical/manual accessibility remain packet work. |
| GA-OPS-008 | Deployed commit, migrations, flags, and rollback are recorded | Partial | Packet 00-08 commits, Railway deployment IDs, config changes, migration status, operational controls, smoke/hardening audit evidence, timed isolated logical restore evidence, named backup-artifact restore evidence, expanded UI smoke evidence, production UI-smoke regression fixes through source `4fe22bc`, Tools studio deployment `ac8d1f8d` on source `24c37ac`, Records workspace deployment `83c95b13` on source `1679aec`, UI system pass deployment `747f71f5` on source `8d90ef2`, shared UI primitives deployment `e3ad8e53` on source `b222917`, Tools primitive alignment deployment `b7740f77` on source `0680b8f`, Shop Talk command center deployment `f001843b` on source `4cef797`, Tools app surface deployment `14bb03aa` on source `ad5ff7d`, Heavy 16th multi-mode deployment `6bd7f24d` on source `444fc96`, Invoice Draft app upgrade deployment `58d6dca4` on source `97d9da7`, Shop Talk reaction/social pulse deployment `740dfd5a` on source `1227e1c`, Trade News real-media/mobile-layout deployment `4fb062bd` on source `a59eb47`, RIVT Daily home check-in deployment `f17fbcec` on source `436b83f`, Shop Talk answer queue deployment `d717edd7` on source `73f79ac`, Daily Engagement Loop deployment `63a4f5aa` on source `aeb23ca`, Daily Log Records bridge deployment `95973719` on source `d03f2a`, Daily Log live UI proof deployment `1c138a66` on source `9c614ac`, server-owned Shop Talk reactions deployment `718003b2` on source `13f7e2e` with migration `0011_shop_talk_reaction_events_immutable`, error monitoring readiness deployment `3260e837` on source `6d8e276`, Sentry provider configuration deployment `eaa7409d`, incident-readiness tooling, launch-ops checklist, incident rehearsal runbook, recovery-policy approval, incident-routing approval, incident-rehearsal pass, Gate A approval packet, founder/support/legal-safety approvals, and passing incident/launch readiness gates are recorded. Physical/deeper manual accessibility-device evidence remains a non-machine launch-quality boundary. |

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

## Current Gate A Summary

- Production infrastructure is reachable and managed storage is healthy.
- Authentication, canonical profiles/onboarding, jobs/discovery, match acceptance, messaging/notifications, project records/completion, reviews, admin operations, safety records, and server-owned Shop Talk reactions have production evidence.
- Packet 08 hardening audit passed live with exact source, migration status, anonymous fail-closed routes, operational controls, durable rate-limit storage, and zero seed/demo findings after cleanup.
- Founder/support/legal-safety signoff is recorded, and the machine-readable incident and launch readiness gates now report `ready`. Expanded production accessibility smoke now passes on source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`, but physical/deeper manual accessibility-device evidence remains the next non-machine launch-quality boundary. Error-monitoring capture code, Sentry ingestion, first pilot escalation, backup owner, support hours, incident routing, incident rehearsal, and the Gate A recovery policy are now configured.
- The app must continue to avoid fake seed data, frontend-only success, and homeowner flows.
