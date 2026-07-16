# Deployment Ledger

## 2026-07-15 - Packet 53 Progressive Jobsite Flows

- Source commit: `af13e52232ec0199a35d11f7f059942fed25b7a5`
- Feature commit: `fa3063a14a94d3bc1c256c0dafd94b59db82306a`
- Branch: `master` (source branch: `codex/progressive-jobsite-flows`)
- Production: `https://rivt.pro`
- Scope: Daily Log now follows Today, Work, and Review; Punch List separates
  Open, Add item, and Resolved; Safety separates Check, Details, and Sign off
  and presents one checklist category at a time. Existing records, work
  context, exports, history, signoffs, and legacy links are unchanged.
- Automated gates: typecheck, build, lint, security lint, 55 unit tests, E2E,
  desktop/mobile/compact Tools UI, mobile-action UI, dependency audit, diff
  checks, and all 19 serial isolated PostgreSQL integration suites passed with
  zero failures or skips.
- Post-deploy proof: production served the exact merge commit. The
  expected-source monitor passed with PostgreSQL and S3-compatible storage
  healthy, Sentry and Web Push configured, matching-job alerts enabled,
  controls off, and seven anonymous private-route checks in 574 ms.
- Rollback target: `82dcc44`.
- Remaining field acceptance: complete one Daily Log, Punch item, and Safety
  signoff from a physical phone and confirm the records remain after reopening.

## 2026-07-15 - Packet 44 Materials and Price Library

- Source commit: `2bcc6d33d71db1c1e0102f402b885d6d80a15fc3`
- Feature commit: `a963041d774dbf511f12c183db7f6bb6425b1814`
- Branch: `master` (source branch: `codex/materials-price-book`)
- Production: `https://rivt.pro`
- Scope: Materials now owns Takeoff, Sheets, and the saved Price library. The
  separate Price Book launcher is removed, legacy links remain compatible,
  existing local and server-owned prices are preserved, and guessed supplier
  catalogs are no longer seeded into accounts or used by takeoffs.
- Automated gates: build, lint, security lint, 55 unit tests, E2E,
  desktop/mobile/compact Tools UI, mobile-action UI, dependency audit, diff
  checks, and the focused PostgreSQL tool-records integration suite passed.
  The aggregate test command exceeded the 15-minute local command window while
  running serial PostgreSQL suites without a reported assertion failure, so a
  complete aggregate integration pass is not claimed.
- Post-deploy proof: production served the exact source commit. The
  expected-source monitor passed with PostgreSQL and S3-compatible storage
  healthy, Sentry and Web Push configured, matching-job alerts enabled,
  controls off, and seven anonymous private-route checks in 611 ms.
- Rollback target: `4dc06f9a34b8c76c81e5c37abb6561ed6a4ff175`.
- Remaining field acceptance: confirm one existing saved price and one newly
  entered current supplier price remain after leaving and reopening Materials
  on a physical phone.

## 2026-07-14 - Packet 41 Camera Home Album Previews

- Source commit: `0849eaacc0b70302bf70c487c058c33b62f99c42`
- Branch: `master`
- Production: `https://rivt.pro`
- Scope: Independent Camera now shows authenticated, account-owned private
  albums with their latest stored cover photo and truthful counts. Accepted
  RIVT work and standalone project sessions deliberately remain scoped and do
  not mix in unrelated private albums. Camera is an equal global navigation
  destination while the lower Destination, Feed, and Capture dock remains the
  one-handed control zone.
- Automated gates: build, lint, 53 unit tests, E2E, Tools rendered UI,
  mobile-action UI, dependency audit, and diff check passed. PostgreSQL
  integration suites were skipped locally because no disposable
  `TEST_DATABASE_URL` was configured; no database-integration result is
  claimed.
- Post-deploy proof: exact-source health passed with ready migration
  `0027_default_private_photo_album`, PostgreSQL, and S3-compatible object
  storage. The expected-source production monitor passed with configured
  Sentry/Web Push, matching-job alerts enabled, controls off, and seven
  anonymous private-route checks in 632 ms.
- Rollback target: `bc25fb3d7d13db398ace05dfe5b34c57b430690f`.
- Remaining field acceptance: capture into the default album and a second
  private album, then confirm previews and context separation on iOS and
  Android.

## 2026-07-14 - Packet 39 Camera Field Action and One-Hand Capture

- Source commit: `9262bb81d630d95f4b482d7d462b506099a1ae8c`
- Branch: `master`
- Production: `https://rivt.pro`
- Scope: Camera replaces the former compact Crew slot after People moved under
  Work. Direct Camera begins with an explicit RIVT-work or standalone-project
  destination; exact job photo handoffs preserve their scoped gallery.
- Automated gates: build, lint, 53 unit tests, E2E, mobile-action UI,
  work-lifecycle UI, Tools rendered UI, dependency audit, and diff check
  passed. Database integration suites skipped locally because this worktree has
  no `TEST_DATABASE_URL`; no server/schema behavior changed in this packet.
- Post-deploy proof: exact-source health passed with ready PostgreSQL and
  S3-compatible storage, configured Sentry and Web Push, matching-job alerts
  enabled, controls off, and seven anonymous private-route checks in 646 ms.
- Rollback target: `e213cc2eaf309c560699ba6966c2531788f6fb8b`.
- Remaining field acceptance: founder confirms the Camera command and
  one-handed shutter/destination controls on iPhone and Android.

## 2026-07-13 - Packet 37 Workflow Coherence and Field Tool Reachability

- Source commit: `d9b9097f3a0e20a8ccb119b76c794c942efad7e7`
- Branch: `master`
- Production: `https://rivt.pro`
- Health proof: production returned the exact source commit with ready
  migration `0026_standalone_projects`, PostgreSQL, and S3-compatible storage.
- Monitor: passed with configured Sentry/Web Push, matching-job alerts enabled,
  operational controls off, and seven anonymous private-route checks in 537 ms.
- Boundary: physical one-handed Camera gallery capture/upload checks remain.

Add one entry per staging/production deployment.

## Current Production - Packet 26 Entry Experience

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-12 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `d6c475546229ae62165b3afd4c5149540720b83e`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior production source `31c70a3f252f733857d822f1732c19b561c52848`; normal source rollback only
- Automated gates: build, lint, 53 unit tests, E2E, dependency audit, and diff check passed. The aggregate `npm run test` exceeded the local command window during its integration phase and is not claimed as passed.
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, ready migration `0026_standalone_projects`; `EXPECTED_SOURCE_COMMIT=d6c475546229ae62165b3afd4c5149540720b83e npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 583 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical iOS and Android proof remains for intro, demo, signup, and login transitions.
- Rollback performed/result: not required
- Approval: deployed as a client-only entry-path clarity pass with no auth, billing, storage, moderation, provider, or migration boundary change

## Current Production - Packet 25 Tool Consolidation

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-12 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `31c70a3f252f733857d822f1732c19b561c52848`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior production source `bd2a531e3faa4a6d3b1fb098e353008006659442`; normal source rollback only
- Automated gates: build, lint, 53 unit tests, E2E, Tools rendered UI smoke, dependency audit, and diff check passed. The aggregate `npm run test` exceeded the local command window during its integration phase and is not claimed as passed.
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, ready migration `0026_standalone_projects`; `EXPECTED_SOURCE_COMMIT=31c70a3f252f733857d822f1732c19b561c52848 npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 599 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical one-handed mobile confirmation remains for the smaller tool inventory and retained Field Tools tray.
- Rollback performed/result: not required
- Approval: deployed as a client-only launcher consolidation with no auth, billing, storage, moderation, provider, or migration boundary change

## Current Production - Packet 24 Active Work Camera Workflow

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-12 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `bd2a531e3faa4a6d3b1fb098e353008006659442`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior production source `97d749e459352a40b36bb5d9b44b3e306306510e`; normal source rollback only
- Automated gates: build, lint, 53 unit tests, E2E, Work lifecycle UI smoke, Tools rendered UI smoke, dependency audit, and diff check passed. The aggregate `npm run test` exceeded the local runner window during its integration phase and is not claimed as passed.
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, ready migration `0026_standalone_projects`; `EXPECTED_SOURCE_COMMIT=bd2a531e3faa4a6d3b1fb098e353008006659442 npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 611 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical signed-in iOS and Android confirmation remains for the exact Photos path and one-handed Camera Destination, Feed, and Capture dock.
- Rollback performed/result: not required
- Approval: deployed as a client-only active-work and camera-context correction with no auth, billing, storage, moderation, provider, or migration boundary change

## Current Production - Packet 23 Work Action Ownership

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-12 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `97d749e459352a40b36bb5d9b44b3e306306510e`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior production source `8b634549f1e10d1761a92b9e23fb7db636c190b2`; normal source rollback only
- Automated gates: build, lint, security lint, 53 unit tests, E2E, mobile-action UI smoke, dependency audit, and diff check passed. The aggregate `npm run test` exceeded the local command window during its integration phase and is not claimed as passed.
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, ready migration `0026_standalone_projects`; `EXPECTED_SOURCE_COMMIT=97d749e459352a40b36bb5d9b44b3e306306510e npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 606 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical phone confirmation remains for the lower-screen Work `Post job` action beside active-work controls.
- Rollback performed/result: not required
- Approval: deployed as a client-only action-ownership correction with no auth, billing, storage, moderation, provider, or migration boundary change

## Current Production - Packet 22 Field Access Workbench

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-12 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `8b634549f1e10d1761a92b9e23fb7db636c190b2`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior production source `b682ac9adc2dfdd408b33f453b8a41b73b58197c`; normal source rollback only
- Automated gates: build, lint, security lint, 53 unit tests, E2E, Tools rendered UI smoke, mobile-action UI smoke, dependency audit, and diff check passed. The aggregate `npm run test` exceeded the local command window before its integration phase reported and is not claimed as passed.
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, ready migration `0026_standalone_projects`; `EXPECTED_SOURCE_COMMIT=8b634549f1e10d1761a92b9e23fb7db636c190b2 npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 649 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical one-handed iOS/Android validation remains for the field tray, Camera destination choice/capture, and collapsed Crew planner.
- Rollback performed/result: not required
- Approval: deployed as a client-only field-access and explicit-context pass with no auth, billing, storage, moderation, provider, or migration boundary change

## Current Production - Packet 21 Shop Talk Command Center

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-11 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `b682ac9adc2dfdd408b33f453b8a41b73b58197c`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior production source `3f4ea9585ef77d3769d8507fd1fd486b03f2634d`; normal source rollback only
- Automated gates: build, lint, security lint, 53 unit tests, E2E, Shop Talk rendered UI smoke, mobile-action UI smoke, dependency audit, and diff check passed. The configured database integration suite stalled before reporting and is not claimed as passed.
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, ready migration `0026_standalone_projects`; `EXPECTED_SOURCE_COMMIT=b682ac9adc2dfdd408b33f453b8a41b73b58197c npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 585 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: a physical signed-in mobile scan should confirm live RSS ordering and manual refresh against production sources; the database integration harness needs separate diagnosis before the next server/data packet.
- Rollback performed/result: not required
- Approval: deployed as a Shop Talk hierarchy and live-news freshness pass with no auth, billing, storage, moderation, provider, or migration boundary change

## Current Production - Packet 20 Core Surface Subtraction

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-11 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `3f4ea9585ef77d3769d8507fd1fd486b03f2634d`
- Build/artifact ID: Railway deployment `1f01e85b-6398-4bba-930c-223faf970afc`
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior production source `b36cf039e2b49c82a4d350edbd4f5a7b9843f9e1`; normal source rollback only
- Automated gates: build, lint, 53 unit tests, E2E, mobile-action UI smoke, Tools UI smoke, dependency audit, and diff check passed
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, configured Web Push, ready migration `0026_standalone_projects`; `EXPECTED_SOURCE_COMMIT=3f4ea9585ef77d3769d8507fd1fd486b03f2634d npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 516 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical Home and Tools scan remains on iOS and Android
- Rollback performed/result: not required
- Approval: deployed as a client-only hierarchy reduction; no auth, billing, storage, moderation, provider, or migration boundary changed

## Template

- Environment:
- Date/time/timezone:
- Deployer:
- Source repository/branch:
- Source commit:
- Build/artifact ID:
- Migration version before/after:
- Feature-flag/config version:
- Provider/config changes (no secrets):
- Backup/rollback target:
- Automated gates:
- Post-deploy smoke tests:
- Health/readiness result:
- Known risks:
- Rollback performed/result:
- Approval:

## Current Production - Packet 18 Work Mobile Priority

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-11 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `8e2c757d690513318daf3fe85583aa7674a7725d`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior successful production source `596d824b34d1f6ec84e644ec2f2a20c790907279`; normal source rollback only
- Automated gates: build, lint, security lint, 53 unit tests, E2E, Work lifecycle UI smoke, mobile-action UI smoke, Tools UI smoke, dependency audit, and diff check passed
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, and configured Web Push. `EXPECTED_SOURCE_COMMIT=8e2c757d690513318daf3fe85583aa7674a7725d npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 553 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical contractor active-work priority confirmation remains on iOS and Android
- Rollback performed/result: not required
- Approval: deployed as a client-only Work hierarchy correction with no auth, billing, storage, moderation, provider, or migration boundary changes

## Current Production - Packet 17 Active Work Action Simplification

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-11 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `596d824b34d1f6ec84e644ec2f2a20c790907279`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational controls changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior successful production source `5e766ca22f5d20bdfa52f7ef632274fe425f2326`; normal source rollback only
- Automated gates: build, lint, security lint, 53 unit tests, E2E, Work lifecycle UI smoke, mobile-action UI smoke, Tools UI smoke, dependency audit, and diff check passed
- Post-deploy smoke tests: exact-source health passed with PostgreSQL, S3-compatible storage, configured Sentry, and configured Web Push. `EXPECTED_SOURCE_COMMIT=596d824b34d1f6ec84e644ec2f2a20c790907279 npm run monitor:production` passed with matching-job alerts enabled, controls off, seven anonymous private-route checks, and 527 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical iOS and Android one-handed confirmation remains for the simplified accepted-work card
- Rollback performed/result: not required
- Approval: deployed as a client-only active-work hierarchy correction with no auth, billing, storage, moderation, provider, or migration boundary changes

## Current Production - Packet 16 Workspace Focus Handoff

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-11 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `5e766ca22f5d20bdfa52f7ef632274fe425f2326`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0026_standalone_projects` / `0026_standalone_projects` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior successful production source `aaf3a8701b4dceb084bdaf007a04ea2bcba74385`; rollback is a normal source rollback because no migration changed
- Automated gates: build, lint, security lint, 53 unit tests, E2E, Work lifecycle UI smoke twice, mobile-action UI smoke, Tools UI smoke, dependency audit, and diff check passed. The aggregate test command exceeded the local two-minute runner limit before reporting its integration result.
- Post-deploy smoke tests: live health reported the exact source commit with PostgreSQL, S3-compatible storage, configured Sentry, and configured Web Push. `EXPECTED_SOURCE_COMMIT=5e766ca22f5d20bdfa52f7ef632274fe425f2326 npm run monitor:production` passed with matching alerts enabled, controls off, seven anonymous private-route checks, and 621 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: physical phone proof remains for a Home or Work `Open workspace` tap visibly focusing the intended active job
- Rollback performed/result: not required
- Approval: deployed as a client-only active-work continuity correction with no auth, billing, storage, moderation, provider, or migration boundary changes

## Current Production - Packet 13 Workflow Coherence

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-11 02:02 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `cab4c9e89f6422480a79c781a2e2aa7a41929377`
- Build/artifact ID: Railway-linked production deployment; live `/api/health` is the runtime proof
- Migration version before/after: `0025_project_financial_records` / `0025_project_financial_records` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): none
- Backup/rollback target: prior successful production source `dc8cf73dbce299726f43967b29ad336dddccd273`; rollback is a normal source rollback because no migration changed
- Automated gates: build, lint, security lint, 53 unit tests, E2E, Work lifecycle UI smoke, mobile action UI smoke, dependency audit, and diff check passed
- Post-deploy smoke tests: `/api/health` reported the exact source commit with PostgreSQL, S3-compatible storage, configured Sentry, and configured Web Push. `EXPECTED_SOURCE_COMMIT=cab4c9e89f6422480a79c781a2e2aa7a41929377 npm run monitor:production` passed with matching alerts enabled, controls off, seven anonymous private-route checks, and 606 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema or provider change
- Known risks: founder physical-phone validation remains for the simplified Home -> exact workspace -> job-scoped Photos handoff
- Rollback performed/result: not required
- Approval: accepted as a client-only workflow-subtraction deployment with no auth, billing, storage, moderation, provider, or migration boundary changes

## Current Production - Packet 08 Desktop Workspaces

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-09 23:28 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `be6a6d211eae8bef81c40d55e2054bf49e3148b9`
- Build/artifact ID: Railway deployment `73eadb90-aa92-4b79-9f99-2aa03d68abe2`; live `/api/health` is the runtime proof
- Migration version before/after: `0022_community_audiences` / `0022_community_audiences` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production source `9dbde85050c30414f84aa9461a2a436a837e46e6`; rollback is a normal source rollback because no migration changed
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:guest-preview`, `npm run test:ui:shop-talk-news`, `npm run test:e2e`, and `npm audit --omit=dev` passed. Unit tests passed 46/46. The broader database integration phase was attempted through `npm run test`, but the configured remote test PostgreSQL reset its connection during setup; no server/database code changed in this UI pass.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `be6a6d211eae8bef81c40d55e2054bf49e3148b9`, ready migration `0022_community_audiences`, PostgreSQL, S3-compatible object storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=be6a6d211eae8bef81c40d55e2054bf49e3148b9 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 445 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: this is a visual/layout deployment. Desktop production browser/keyboard verification remains a manual evidence item; the remote test database connection reset must be resolved before a future server/data packet claims aggregate integration evidence.
- Rollback performed/result: not required.
- Approval: accepted as a Gate A desktop workspace and navigation-density improvement with no provider, auth, billing, storage, moderation, or migration boundary changes.

## Current Production - Packet 08 Guest Preview Black-Screen Hardening

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-08 22:57 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `7f6aed13a046da80c5adc45270a02cbdcd75dcdb`
- Build/artifact ID: Railway-linked production deployment serving source `7f6aed13a046da80c5adc45270a02cbdcd75dcdb`; live `/api/health` is the runtime proof
- Migration version before/after: `0022_community_audiences` / `0022_community_audiences` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production source `aa827923410b5e52a328ea59b16fd301dabbbad4`; rollback is a normal source rollback because no migration changed
- Automated gates: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run test:ui:guest-preview`, `npm audit --omit=dev`, and `git diff --check` passed. Full `npm run test` and `npm run test:integration` exceeded local command windows against the remote test DB; the previously stuck `test/shop-talk-moderation.integration.test.js` file was then run individually and passed.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `7f6aed13a046da80c5adc45270a02cbdcd75dcdb`, ready migration `0022_community_audiences`, PostgreSQL, S3-compatible object storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=7f6aed13a046da80c5adc45270a02cbdcd75dcdb npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 613 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: this closes the black-screen failure mode with visible recovery and a mobile guest-preview smoke. Physical iOS Safari/PWA cache behavior should still be rechecked on the reported device; one refresh or app restart may be needed for the old service worker to install the new cache version.
- Rollback performed/result: not required.
- Approval: accepted as a small Gate A preview-loading hardening deployment with no provider, auth, billing, storage, moderation, or migration boundary changes.

## Current Production - Packet 08 Launch Final Train Deployment

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-05 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `5ce29c2f7c2768402a0dce24f3744df254be4b20`
- Build/artifact ID: Railway-linked production deployment serving source `5ce29c2f7c2768402a0dce24f3744df254be4b20`; live `/api/health` is the runtime proof
- Migration version before/after: `0021_shop_talk_post_media` / `0021_shop_talk_post_media` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production source `88d5adab057ba2848e6e4b692f8fba18b3239d55`; rollback is a normal source rollback because no migration changed
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, and `npm audit --omit=dev` passed. The aggregate `npm run test` pass included 44/44 unit tests and 18/18 integration tests.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `5ce29c2f7c2768402a0dce24f3744df254be4b20`, ready migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=5ce29c2f7c2768402a0dce24f3744df254be4b20 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 589 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: physical-device and final manual launch checks remain open evidence items, but the launch-final-train runtime slice is live and healthy.
- Rollback performed/result: not required.
- Approval: accepted as the Packet 08 launch-final-train merge/deploy with no provider, schema, auth, moderation, or billing-boundary regressions.

## Current Production - Packet 08 SE Tool Chrome Cleanup

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-05 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `88d5adab057ba2848e6e4b692f8fba18b3239d55`
- Build/artifact ID: Railway-linked production deployment serving source `88d5adab057ba2848e6e4b692f8fba18b3239d55`; live `/api/health` is the runtime proof
- Migration version before/after: `0021_shop_talk_post_media` / `0021_shop_talk_post_media` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful SE immersive-tool deployment `f3971fe8b12cae0d88f66774ff3211f6bc53c17d`; rollback is a normal source rollback because no migration changed
- Automated gates: `npm run build`, `npm run lint`, `npm run test:ui:tools`, `npm run test:ui:mobile-actions`, `npm run test:e2e`, and `npm audit --omit=dev` passed. `npm run test` still exceeded the local command window in this pass, so aggregate unit+integration completion is not newly claimed here.
- Rendered evidence: refreshed `se-calculator.png` and `se-invoice.png` were written outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass` and show cleaner SE calculator controls plus contained invoice layout with the immersive nav hidden.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `88d5adab057ba2848e6e4b692f8fba18b3239d55`, ready migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=88d5adab057ba2848e6e4b692f8fba18b3239d55 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 606 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: the specific SE tool-shell/readability regressions from the latest phone screenshots are now closed at the deployed runtime, but one final physical-device sweep is still useful before broad launch.
- Rollback performed/result: not required.
- Approval: accepted as a Gate A small-phone tool-polish deployment with no provider, auth, billing, storage, moderation, or migration boundary changes.

## Current Production - Packet 08 SE Tool Fullscreen Ownership

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-05 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `f3971fe8b12cae0d88f66774ff3211f6bc53c17d`
- Build/artifact ID: Railway-linked production deployment serving source `f3971fe8b12cae0d88f66774ff3211f6bc53c17d`; live `/api/health` is the runtime proof
- Migration version before/after: `0021_shop_talk_post_media` / `0021_shop_talk_post_media` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful immersive-tool containment deployment `c9b2a0033bc7155abd031f47db414d71bcfc028f`; rollback is a normal source rollback because no migration changed
- Automated gates: `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:mobile-actions`, and `npm audit --omit=dev` passed. `npm run test` / `npm run test:integration` still exceeded the local command window in this pass, so aggregate integration completion is not newly claimed here.
- Rendered evidence: refreshed `mobile-calculator.png` and `se-calculator.png` were written outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass` and show the Heavy 16th calculator using the handset width instead of the previously reported narrow left rail.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `f3971fe8b12cae0d88f66774ff3211f6bc53c17d`, ready migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry.
- Health/readiness result: healthy production health; no schema migration applied.
- Known risks: this closes the deployed-runtime regression behind the reported small-phone tool screenshots, but one final human recheck on the physical iPhone is still useful before considering the device-specific confidence gap fully closed.
- Rollback performed/result: not required.
- Approval: accepted as a Gate A immersive-tool mobile containment fix with no provider, auth, billing, storage, moderation, or migration boundary changes.

## Current Production - Packet 08 Immersive Tools Small-Phone Containment

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-05 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `c9b2a0033bc7155abd031f47db414d71bcfc028f`
- Build/artifact ID: Railway-linked production deployment serving source `c9b2a0033bc7155abd031f47db414d71bcfc028f`; live `/api/health` is the runtime proof
- Migration version before/after: `0021_shop_talk_post_media` / `0021_shop_talk_post_media` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful physical small-phone compact-guard deployment `8a6377c70fa664ff4dd800beac50df3795aafacd`; rollback is a normal source rollback because no migration changed
- Automated gates: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:mobile-actions`, and `npm audit --omit=dev` passed.
- Rendered evidence: refreshed SE-sized screenshots were written outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass` and `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `c9b2a0033bc7155abd031f47db414d71bcfc028f`, ready migration `0021_shop_talk_post_media`, PostgreSQL, S3-compatible object storage, and configured Sentry.
- Health/readiness result: healthy production health; no schema migration applied.
- Known risks: the shell/tool containment fixes are live, but one final physical iPhone SE recheck is still required before the small-phone confidence gap can be treated as fully closed.
- Rollback performed/result: not required.
- Approval: accepted as a Gate A UI containment fix with no provider, auth, billing, storage, moderation, or migration boundary changes.

## Current Production - Packet 08 Tools Hub Consolidation

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-03 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `85ce42cab4f938b217e21359aecd700a505dd53f`
- Build/artifact ID: Railway-linked production deployment serving source `85ce42cab4f938b217e21359aecd700a505dd53f`; live `/api/health` is the runtime proof
- Migration version before/after: `0018_shop_talk_moderation` / `0018_shop_talk_moderation` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful reachability/naming deployment `c974faf1bd96f16da19c678ad6880965632fd214`; rollback is a normal source rollback because no migration changed
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check` passed. The aggregate test pass included 15/15 DB-backed integration suites.
- Rendered evidence: `npm run test:ui:tools` rendered the updated Tools hub and core tool paths at mobile and desktop sizes; screenshots were written outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `85ce42cab4f938b217e21359aecd700a505dd53f`, ready migration `0018_shop_talk_moderation`, PostgreSQL, S3-compatible object storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=85ce42cab4f938b217e21359aecd700a505dd53f npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 558 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: all launchable supporting Tools utilities are now reachable, but duplicate client/payment/checklist surfaces and server persistence for local-only money/business records remain open.
- Rollback performed/result: not required.
- Approval: accepted as a Gate A UI/reachability improvement with no provider, schema, auth, billing, or security boundary changes.

## Current Production - Packet 08 Shop Talk Human Moderation Console and Report UX

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-03 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `f4db07fee34b760d10d9f16cc7593e163524e1a4`
- Build/artifact ID: Railway-linked production deployment serving source `f4db07fee34b760d10d9f16cc7593e163524e1a4`; live `/api/health` is the runtime proof
- Migration version before/after: `0018_shop_talk_moderation` / `0018_shop_talk_moderation` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful Shop Talk moderation backend deployment `87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5`; rollback is a normal source rollback because no migration changed
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. The aggregate test pass included 15/15 integration suites.
- Rendered evidence: local 430px Playwright QA loaded `/app/admin` with mocked report data, submitted a moderation action, opened the Shop Talk report reason picker, verified reason options, and found no horizontal overflow. Screenshot evidence was written locally at `tmp-moderation-ui-smoke.png`.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `f4db07fee34b760d10d9f16cc7593e163524e1a4`, ready migration `0018_shop_talk_moderation`, PostgreSQL, S3-compatible object storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=f4db07fee34b760d10d9f16cc7593e163524e1a4 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 630 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: staff now have a usable report queue/review surface and users have richer report reasons, but broad public Shop Talk still needs an explicit moderation SLA/process and live evidence that reports are reviewed inside the committed support window.
- Rollback performed/result: not required.
- Approval: accepted as controllable Gate B behind-flag community-safety operations work; Gate A pilot remains governed by existing launch-readiness boundaries.

## Current Production - Packet 08 Shop Talk Moderation and Reporting Backend

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-02 21:23 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5`
- Build/artifact ID: Railway-linked production deployment serving source `87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5`; live `/api/health` is the source-of-truth runtime proof
- Migration version before/after: `0017_shop_talk_reddit_backbone` / `0018_shop_talk_moderation`
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful Shop Talk backbone deployment `dba2acb77a3cc36d9757c895591e81e4bb24cf6e`; rollback requires applying `migrations/0018_shop_talk_moderation.down.sql` after traffic is drained if moderation tables/status columns must be removed
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. The full integration pass used a Railway-backed `TEST_DATABASE_URL` and passed 15/15 suites in 975s.
- Post-deploy smoke tests: live `https://rivt.pro/api/health` returned exact source commit `87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5`, ready migration `0018_shop_talk_moderation`, PostgreSQL, S3-compatible object storage, and configured Sentry. `EXPECTED_SOURCE_COMMIT=87923e9f34723b3fb12cf7f20a6b5b4c96e8cfb5 npm run monitor:production` passed with operational controls off, seven anonymous private-route checks, and 582 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; moderation migration applied.
- Known risks: this is the server-owned moderation/reporting backend. Broad public Shop Talk still needs a human-facing moderation console/SLA, richer report-reason picker UX, and evidence that reports are reviewed within the committed support window.
- Rollback performed/result: not required.
- Approval: accepted as controllable Gate B behind-flag community-safety backend work; Gate A pilot remains governed by existing launch-readiness boundaries.

## Current Production - Packet 08 Orange Trade Talk Visual System

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-30 01:41 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `d99747ebf68daf4745ad1ec015d0da12ed835a85`
- Build/artifact ID: Railway-linked production deployment serving source `d99747ebf68daf4745ad1ec015d0da12ed835a85`
- Migration version before/after: `0014_billing_subscriptions` / `0014_billing_subscriptions` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production source `c4b546de14fce4576815c5a37fa8d367766b4d9f`; no migration rollback required
- Automated gates: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- Rendered evidence: mobile screenshots saved outside the repo at `C:\Users\zboyt\Documents\Trade-Work\artifacts-rivt-auth-mobile.png`, `C:\Users\zboyt\Documents\Trade-Work\artifacts-rivt-home-mobile-logo-final.png`, `C:\Users\zboyt\Documents\Trade-Work\artifacts-rivt-shoptalk-mobile-final.png`, `C:\Users\zboyt\Documents\Trade-Work\artifacts-rivt-work-mobile-final.png`, and `C:\Users\zboyt\Documents\Trade-Work\artifacts-rivt-tools-mobile-final.png`.
- Post-deploy smoke tests: live `/api/health` reported exact source `d99747ebf68daf4745ad1ec015d0da12ed835a85`, ready migration `0014_billing_subscriptions`, PostgreSQL, S3-compatible object storage, and Sentry configured. `EXPECTED_SOURCE_COMMIT=d99747ebf68daf4745ad1ec015d0da12ed835a85 npm run monitor:production` passed with seven anonymous private-route checks, operational controls off, and 542 ms duration.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: this is a visual/UI hardening pass, not a final full-product redesign. Remaining Gate A launch-quality boundary is still physical/manual device evidence for iOS Safari, Android Chrome, desktop keyboard-only, screen reader route checks, and real slow-cellular behavior.
- Rollback performed/result: not required.
- Approval: accepted as controllable Packet 08 visual/UI hardening evidence; broader pilot launch still depends on the remaining physical/manual evidence boundary or explicit risk acceptance.

## Current Production - Packet 08 Launch Readiness Machine Gate Sweep

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-28 18:34 America/New_York
- Deployer: Codex verification against Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `aac69811ef6d9b4088e5f4c95bc4bc3886a904ce`
- Build/artifact ID: Railway-linked production deployment serving source `aac69811ef6d9b4088e5f4c95bc4bc3886a904ce`; no new runtime deployment was performed for this evidence-only sweep before the documentation update
- Migration version before/after: `0013_album_storage_scope` / `0013_album_storage_scope` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production source `aac69811ef6d9b4088e5f4c95bc4bc3886a904ce` if reverting the evidence-only documentation update; no migration rollback required
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:mobile-actions`, `npm run test:ui:work-lifecycle`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, `git diff --check`, `npm run incident:readiness -- --require-ready`, and `npm run launch:readiness -- --require-ready` passed.
- Rendered evidence: screenshots saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`, `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Post-deploy smoke tests: `EXPECTED_SOURCE_COMMIT=aac69811ef6d9b4088e5f4c95bc4bc3886a904ce npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, Sentry configured, operational controls off, and seven anonymous private-route checks. Direct live `/api/health` also reported source `aac69811ef6d9b4088e5f4c95bc4bc3886a904ce`.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: physical iOS Safari, Android Chrome, desktop keyboard-only, screen-reader/manual route evidence, and real slow-cellular evidence remain incomplete. Repeating authenticated contractor publish smoke on the shared production test contractor is blocked until daily publish quota reset or a fresh dedicated test contractor is created.
- Rollback performed/result: not required.
- Approval: accepted as Packet 08 machine-gate launch-readiness evidence only; widening the pilot still requires accepted physical/manual device evidence or written risk acceptance.

## Current Production - Packet 08 Work Lifecycle Bridge

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-28 14:41 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `b6f6496178e55648eddad5226326007ea6c0a032`
- Build/artifact ID: Railway deployment `30ba19e3-b8a2-4ffb-94e8-56289ecf3f3c`
- Migration version before/after: `0013_album_storage_scope` / `0013_album_storage_scope` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production source `7c25c738ed166e22d899579e6112c57f56d3c249`; no migration rollback required
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:work-lifecycle`, `npm run test:ui:mobile-actions`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. The full DB-backed test run used local `TEST_DATABASE_URL`.
- Rendered evidence: Work lifecycle screenshots saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`; existing mobile, Tools, and Shop Talk/Trade News screenshots refreshed at their established temp directories.
- Post-deploy smoke tests: live `/api/health` reported exact source `b6f6496178e55648eddad5226326007ea6c0a032`, ready migration `0013_album_storage_scope`, PostgreSQL, S3-compatible object storage, and Sentry configured.
- Health/readiness result: healthy production health; no schema migration applied.
- Known risks: this slice adds repeatable rendered coverage for the Work lifecycle and active-work tool bridge, but it does not replace deeper production authenticated click-path testing with a stable seeded production test account.
- Rollback performed/result: not required.
- Approval: accepted as controllable Packet 08 Work lifecycle UX hardening evidence.

## Current Production - Packet 08 Live Contractor Click-Path and Mobile Containment

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-28 16:16 America/New_York
- Deployer: Codex through GitHub push to Railway-linked `master`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `c911914f90e748c2a8c58763de3196c4865f9382`
- Build/artifact ID: Railway deployment `f3168081-4b7b-4eb0-970c-c83cf82082dc`
- Migration version before/after: `0013_album_storage_scope` / `0013_album_storage_scope` (no schema migration)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production source `b6f6496178e55648eddad5226326007ea6c0a032` and intermediate source `181703eb8d3ad0c0dbea3e05b619057a38921266`; no migration rollback required
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:ui:work-lifecycle`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. The full DB-backed test run used local `TEST_DATABASE_URL`.
- Rendered/live evidence: authenticated production contractor UI smoke `npm run smoke:contractor-click-path:live` passed with run `contractor-click-20260628201612-637417`; screenshots saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-contractor-click-path-live`.
- Post-deploy smoke tests: live `/api/health` reported exact source `c911914f90e748c2a8c58763de3196c4865f9382`, ready migration `0013_album_storage_scope`, PostgreSQL, S3-compatible object storage, and Sentry configured. `EXPECTED_SOURCE_COMMIT=c911914f90e748c2a8c58763de3196c4865f9382 npm run monitor:production` passed with seven anonymous private-route checks and operational controls off.
- Health/readiness result: healthy production health; no schema migration applied.
- Known risks: this slice adds live authenticated contractor click-path coverage and fixes the UI defects it exposed, but it does not close the remaining physical/deeper manual accessibility-device evidence boundary.
- Rollback performed/result: not required.
- Approval: accepted as controllable Packet 08 live contractor UX hardening evidence.

## Current Production - Packet 08 Server-Owned Profile Search

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-22 14:56 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `cda9733acdaa7ed858b819fc9b5904ee2c237600`
- Build/artifact ID: Railway runtime upload deployment `1f29a48c-89aa-45a0-8554-dfce1d386924`; metadata redeploy `58a361b4-0f0a-41b5-8309-d3a4104fc1eb`
- Migration version before/after: `0011_shop_talk_reaction_events_immutable` / `0011_shop_talk_reaction_events_immutable` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `cda9733acdaa7ed858b819fc9b5904ee2c237600`; operational controls unchanged
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production deployment `5c6c5a06-12b3-4ad8-a365-854a85ebcfdc`; no migration rollback required
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. DB-backed local integration tests continue to skip locally because `TEST_DATABASE_URL` is not configured.
- Rendered evidence: Browser plugin target `iab` was unavailable, so local Playwright fallback captured desktop/mobile profile-search and Crew-navigation screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-profile-search-1782153354986` with zero console warnings/errors.
- Post-deploy smoke tests: live `/api/health` reported exact source `cda9733acdaa7ed858b819fc9b5904ee2c237600`; `EXPECTED_SOURCE_COMMIT=cda9733acdaa7ed858b819fc9b5904ee2c237600 RIVT_MONITOR_TIMEOUT_MS=30000 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, Sentry configured, operational controls off, and seven anonymous private-route checks.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: profile search is limited to published network-profile discovery. Full Crew directory, profile detail, connection request, and safe contact-exchange workflows remain separate Gate A/B product work.
- Rollback performed/result: not required.
- Approval: accepted as controllable Gate A UX hardening evidence only.

## Current Production - Packet 08 Global Search Command Surface

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-22 13:32 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `98f4b6716674de57e6c38c497ea837105ad069b1`
- Build/artifact ID: Railway runtime upload deployment `a4918783-b28c-4ab0-a606-851c631a62c3`; metadata redeploy `5c6c5a06-12b3-4ad8-a365-854a85ebcfdc`
- Migration version before/after: `0011_shop_talk_reaction_events_immutable` / `0011_shop_talk_reaction_events_immutable` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `98f4b6716674de57e6c38c497ea837105ad069b1`; operational controls unchanged
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production deployment `68e6eca4-8574-4c0c-b2a6-d533fc5cab47`; no migration rollback required
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. DB-backed local integration tests continue to skip locally because `TEST_DATABASE_URL` is not configured.
- Rendered evidence: Browser plugin target `iab` was unavailable, so local Playwright fallback captured desktop/mobile search-modal and Work-result screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-global-search-1782149323491` with zero console warnings/errors.
- Post-deploy smoke tests: live `/api/health` reported exact source `98f4b6716674de57e6c38c497ea837105ad069b1`; `EXPECTED_SOURCE_COMMIT=98f4b6716674de57e6c38c497ea837105ad069b1 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, Sentry configured, operational controls off, and seven anonymous private-route checks.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: people/profile search still needs a server-owned discovery endpoint; canonical Shop Talk posts/answers remain a separate server-owned social-network workstream.
- Rollback performed/result: not required.
- Approval: accepted as controllable Gate A UX hardening evidence only.

## Current Production - Packet 08 Claude-Audit UI Consolidation

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-22 10:19 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `92fd0a71d6a39cd21c9b3e233c5caa2c1a37da54`
- Build/artifact ID: Railway runtime upload deployment `eb75395a-45c9-4d8d-b9cc-c9e63230fba9`; metadata redeploy `68e6eca4-8574-4c0c-b2a6-d533fc5cab47`
- Migration version before/after: `0011_shop_talk_reaction_events_immutable` / `0011_shop_talk_reaction_events_immutable` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `92fd0a71d6a39cd21c9b3e233c5caa2c1a37da54`; operational controls unchanged
- Provider/config changes (no secrets): no provider credentials changed; Sentry remains configured
- Backup/rollback target: prior successful production deployment `17cc18db-0ac5-4f23-bf5f-955b98af38cb`; no migration rollback required
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. DB-backed local integration tests continue to skip locally because `TEST_DATABASE_URL` is not configured.
- Post-deploy smoke tests: live `/api/health` reported exact source `92fd0a71d6a39cd21c9b3e233c5caa2c1a37da54`; `EXPECTED_SOURCE_COMMIT=92fd0a71d6a39cd21c9b3e233c5caa2c1a37da54 npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, Sentry configured, operational controls off, and seven anonymous private-route checks.
- Health/readiness result: healthy production health and synthetic monitor; no schema migration applied.
- Known risks: unified People/Jobs/Shop Talk search still needs a real backend endpoint; physical iOS Safari, Android Chrome, desktop keyboard-only, and screen-reader/manual route evidence remain incomplete.
- Rollback performed/result: not required.
- Approval: accepted as controllable Gate A UI hardening evidence only.

## Current Production - Packet 08 Accessibility Boundary Progress

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-22 00:17 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`
- Build/artifact ID: Railway deployment `17cc18db-0ac5-4f23-bf5f-955b98af38cb`
- Migration version before/after: `0011_shop_talk_reaction_events_immutable` / `0011_shop_talk_reaction_events_immutable` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`; operational controls unchanged
- Provider/config changes (no secrets): no provider credentials changed; production smoke tooling gained screenshot, landmark, visible-image-alt, and visible-field-label assertions
- Backup/rollback target: prior successful accessibility deployment `60cc0602-a6d2-4f19-9864-7c78bae96bf7`, or last broader Sentry-configured stable deployment `eaa7409d-0e75-4ae4-8ac7-1aaa8c8e1a68`; no migration rollback required
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed after this documentation update. `npm run test:ui:shop-talk-news` passed before the runtime source commits. DB-backed local integration tests continue to skip locally because `TEST_DATABASE_URL` is not configured.
- Post-deploy smoke tests: `/api/health` reported exact source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`; `npm run monitor:production` passed with PostgreSQL, S3-compatible object storage, Sentry configured, operational controls off, and seven anonymous private-route checks; split production accessibility smoke `ui-a11y-20260622041456-3d6a3d` passed after Railway setup/local browser/Railway cleanup.
- Rendered evidence: the passing smoke captured 72 PNG screenshots outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-a11y-20260622041456-3d6a3d`.
- Cleanup evidence: disposable accounts for run `ui-a11y-20260622041456-3d6a3d` were closed with `accountsClosed: 2`.
- Health/readiness result: health reported healthy PostgreSQL and S3-compatible storage with exact source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`; production synthetic monitor passed.
- Known risks: physical iOS Safari, Android Chrome, desktop keyboard-only, and screen-reader/manual route evidence remain incomplete. Browser screenshot capture from the in-app Browser timed out, but Playwright smoke screenshots were captured successfully.
- Rollback performed/result: not required.
- Approval: accepted as stronger automated accessibility evidence only; overall Gate A still requires accepted physical/deeper manual accessibility-device evidence.

## Gate A Final Incident Approvals - 2026-06-22

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-22 03:48:04 UTC / 2026-06-21 23:48:04 America/New_York
- Approver: Michael
- Approval scope: founder, support, and legal/safety Gate A signoffs for the controlled named-cohort pilot readiness package.
- Evidence: `docs/operations/GATE_A_APPROVAL_PACKET.md`; `docs/operations/incident-routing.json`
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Production source commit: `6d8e276e036553c5f861f1f8ab97cc3333a3494b`
- Provider/config changes: no provider credentials changed; this entry records approval state only.
- Automated gates: `node scripts/incident-readiness-check.js --json` passed with `ready` and zero findings; `node scripts/launch-readiness-check.js --json` passed with `ready` and zero findings; `npm run incident:readiness -- --require-ready` passed; `npm run launch:readiness -- --require-ready` passed.
- Known risks: physical/deeper manual accessibility-device evidence remains incomplete; dedicated phone/SMS paging remains recommended before broader scale.
- Rollback performed/result: not required.
- Approval: founder/support/legal-safety approvals recorded; machine-readable incident and launch readiness gates pass. Broader rollout still requires accepted physical/deeper manual accessibility-device evidence.

## Incident Rehearsal - 2026-06-22

- Scenario: Public health or provider failure rehearsal per `docs/operations/INCIDENT_REHEARSAL_RUNBOOK.md`.
- Environment: Production (`https://rivt.pro`)
- Started at: `2026-06-22T03:14:00Z`
- Ended at: `2026-06-22T03:31:05.8720277Z`
- Incident commander: Michael
- Backup owner: Anya Tingle
- Support communicator: Michael / `support@rivt.pro`
- Production source commit: `6d8e276e036553c5f861f1f8ab97cc3333a3494b`
- Alert destination tested: Sentry Cloud project `4511606746185728` accepted rehearsal event `43fc7567f458490582db1f6642e2e0ea` with HTTP 200; the high-priority Sentry issue alert rule was previously verified on `RIVT Sentry smoke test` at 2026-06-22 02:38 UTC.
- Paging destination tested: Sentry high-priority issue alert route remains the first pilot escalation route; dedicated phone/SMS paging is still recommended before broader scale.
- User impact: none; no kill switch was changed and no customer data was modified.
- Kill switch used: no.
- Commands run: `npm run monitor:production` passed locally against production; `railway ssh --service RIVT --environment production -- npm run smoke:gate-a:live` passed inside the Railway service; a temporary Sentry rehearsal script was streamed to `/tmp`, executed inside the Railway service, and removed.
- Detection time: immediate from command output.
- Triage time: initial credential/network blocker isolated in under 10 minutes; Railway re-auth and service-local smoke resolved it.
- Recovery time: not applicable; this was a controlled rehearsal, not a production outage.
- Root cause: no production incident. The rehearsal proved that local smoke needing the database must run inside Railway or use a public database URL; the service-local run passed.
- Decision log: keep signups and mutations enabled because production health, storage, operational controls, anonymous fail-closed checks, migrations, seed/demo scan, and Sentry capture all passed.
- Follow-up actions: add dedicated phone/SMS paging before broader scale; complete founder/support/legal-safety approvals and physical/deeper manual accessibility-device evidence before named-cohort launch.
- Pass/fail: passed.
- Approval: incident rehearsal evidence accepted as Gate A incident-readiness progress; overall Gate A not approved until final approvals and manual accessibility/device evidence are complete.

## Incident Rehearsal Attempt - 2026-06-22

- Scenario: Public health or provider failure rehearsal, attempted per `docs/operations/INCIDENT_REHEARSAL_RUNBOOK.md`.
- Environment: Production (`https://rivt.pro`)
- Started at: `2026-06-22T03:14:00Z`
- Ended at: `2026-06-22T03:20:29.5545352Z`
- Incident commander: Michael
- Backup owner: Anya Tingle
- Support communicator: Michael / `support@rivt.pro`
- Production source commit: `6d8e276e036553c5f861f1f8ab97cc3333a3494b` from `npm run monitor:production`
- Alert destination tested: production synthetic monitor path was exercised locally; Sentry high-priority issue alert was previously verified on smoke issue `RIVT Sentry smoke test` at 2026-06-22 02:38 UTC
- Paging destination tested: not newly triggered in this attempt
- User impact: none; no kill switch was changed and no customer data was modified
- Kill switch used: no
- Commands run: `npm run monitor:production` passed; `npm run smoke:gate-a:live` failed before touching production because `DATABASE_URL` was missing from the process; a retry loading `.env` also failed because `.env` contains a blank `DATABASE_URL`; Railway CLI variable lookup failed because the CLI session is unauthorized and requires `railway login`
- Detection time: immediate from command output
- Triage time: under 10 minutes; root blocker isolated to missing live smoke database credential / expired Railway CLI auth
- Recovery time: not applicable; this was a rehearsal setup blocker, not a production incident
- Root cause: local workstation lacks a nonblank production `DATABASE_URL`, and Railway CLI cannot refresh its token
- Decision log: do not mark rehearsal as passed; do not invent credentials; record the blocker and require Railway login or a temporary redacted production smoke credential before rerun
- Follow-up actions: re-authenticate Railway CLI or provide a nonblank `DATABASE_URL` in the shell, rerun `npm run smoke:gate-a:live`, verify alert/page receipt, then update `docs/operations/incident-routing.json` with a `status: "passed"` rehearsal
- Pass/fail: failed / blocked
- Approval: no Gate A approval from this attempt

## Current Production - Packet 08 Sentry Error Monitoring Configured

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 22:37 America/New_York
- Deployer: Codex through authenticated Railway CLI and Sentry Cloud project setup
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `6d8e276e036553c5f861f1f8ab97cc3333a3494b`
- Build/artifact ID: Railway deployment `eaa7409d-0e75-4ae4-8ac7-1aaa8c8e1a68`
- Migration version before/after: `0011_shop_talk_reaction_events_immutable` / `0011_shop_talk_reaction_events_immutable` (no schema migration)
- Feature-flag/config version: `SENTRY_DSN` and `ERROR_MONITORING_PROVIDER=sentry` configured on the Railway `RIVT` service; `SOURCE_COMMIT` remains `6d8e276e036553c5f861f1f8ab97cc3333a3494b`; operational controls unchanged
- Provider/config changes: Sentry Cloud project created for RIVT production API errors; no DSN value is recorded in repository documentation
- Backup/rollback target: prior successful deployment `3260e837-ff72-4343-b0bd-4243ac02424f`; migration version unchanged
- Automated gates: `npm run monitor:production` passed after provider configuration; prior source gates for `6d8e276` remain `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit `6d8e276e036553c5f861f1f8ab97cc3333a3494b`, PostgreSQL/S3-compatible dependencies healthy, and `observability.errorMonitoring.mode=configured`; Sentry accepted smoke event `RIVT Sentry smoke test` with HTTP 200 and showed `Error Received`
- Escalation evidence: Sentry alert rule `Send a notification for high priority issues` is connected to project `node-express`, notifies suggested assignees or recently active members on every trigger, and triggered once for the smoke issue at 2026-06-22 02:38 UTC.
- Incident-owner evidence: backup incident owner Anya Tingle is recorded in `docs/operations/incident-routing.json` with email and phone status recorded; the actual phone number is intentionally not stored in the repository.
- Support-hours evidence: founder-provided Gate A support coverage is recorded as Monday-Saturday, 9:00 AM-5:00 PM, America/New_York.
- Recovery-policy evidence: Gate A recovery policy is approved with RPO 1440 minutes, RTO 240 minutes, 30-day backup retention, 30-day restore-drill cadence, next restore drill due `2026-07-21T04:18:59.000Z`, and founder/operations approvals by Michael.
- Incident-routing approval evidence: `docs/operations/incident-routing.json` is approved for the Gate A pilot scope by Michael at `2026-06-22T03:09:36.0366141Z`.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `6d8e276e036553c5f861f1f8ab97cc3333a3494b`; dedicated error monitoring is configured
- Known risks: full Gate A remains blocked by incident rehearsal, support/legal/founder signoff, and physical/deeper manual accessibility-device evidence. Sentry alerting is accepted as the first pilot escalation route; dedicated phone/SMS paging should be added before broader scale. RPO/RTO is approved for Gate A pilot and should be tightened before broader scale or platform-held financial workflows.
- Rollback performed/result: not required
- Approval: Packet 08 Sentry error monitoring setup accepted as controllable Gate A evidence; overall Gate A not approved

## Previous Production - Packet 08 Error Monitoring Readiness Hooks

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 22:21 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `6d8e276e036553c5f861f1f8ab97cc3333a3494b`
- Build/artifact ID: Railway deployment `3260e837-ff72-4343-b0bd-4243ac02424f`
- Migration version before/after: `0011_shop_talk_reaction_events_immutable` / `0011_shop_talk_reaction_events_immutable` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `6d8e276e036553c5f861f1f8ab97cc3333a3494b`; operational controls unchanged
- Provider/config changes: no provider credentials changed; code now supports `SENTRY_DSN` or `ERROR_MONITORING_DSN`, but production health correctly reports `observability.errorMonitoring.mode=setup_required` until a real DSN is set
- Backup/rollback target: prior successful deployment `718003b2-9b27-49fb-a36a-f01ea0528bf0`; migration version unchanged
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit `6d8e276e036553c5f861f1f8ab97cc3333a3494b`, PostgreSQL/S3-compatible dependencies healthy, and non-secret error-monitoring setup status; `npm run monitor:production` passed with seven anonymous private-route checks and observability evidence
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `6d8e276e036553c5f861f1f8ab97cc3333a3494b`; error monitoring reports `setup_required` because the real provider DSN has not been configured
- Known risks: full Gate A remains blocked by real external error monitoring DSN, paging/escalation route, incident rehearsal, RPO/RTO policy approval, backup retention/cadence approval, support/legal/founder signoff, and physical/deeper manual accessibility-device evidence.
- Rollback performed/result: not required
- Approval: Packet 08 error monitoring readiness hooks accepted as controllable Gate A evidence; overall Gate A not approved

## Previous Production - Packet 08 Daily Log Live UI Proof

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 20:49 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `9c614ac2f8691186150e16583e7b204cbada590a`
- Build/artifact ID: Railway deployment `1c138a66-7015-4cfb-a2ad-48135b932c5d`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `9c614ac2f8691186150e16583e7b204cbada590a`; operational controls unchanged
- Provider/config changes: no provider credentials changed; added live Daily Log UI smoke tooling and did not add runtime product behavior
- Backup/rollback target: prior successful deployment `95973719-d8de-42a7-854c-69833221c439`; migration version unchanged
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit `9c614ac2f8691186150e16583e7b204cbada590a`; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, and seven anonymous private-route checks
- Rendered live UI evidence: split smoke `daily-log-ui-20260622004926-05a797` used Railway SSH setup to create disposable invited accounts and real accepted work, local browser-only mode to log in at `https://rivt.pro`, open Tools -> Daily Log, verify `Records-ready`, save to Records, and verify one project timeline note through the live API. Screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-daily-log-live-smoke`.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `9c614ac2f8691186150e16583e7b204cbada590a`; production synthetic monitor reports signups and mutations enabled
- Known risks: full Gate A remains blocked by real external error monitoring/paging, incident rehearsal, RPO/RTO policy approval, backup retention/cadence approval, support/legal/founder signoff, physical/deeper manual accessibility-device evidence, and production-grade server Shop Talk posts/reactions/reputation if promoted into launch scope.
- Rollback performed/result: not required
- Approval: Packet 08 Daily Log live UI proof accepted as controllable Gate A evidence; overall Gate A not approved

## Previous Production - Packet 08 Daily Log Records Bridge

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 20:25 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `d03f2a50e0df9297dc6c0e33c7eb83a6732cdd8b`
- Build/artifact ID: Railway deployment `95973719-d8de-42a7-854c-69833221c439`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `d03f2a50e0df9297dc6c0e33c7eb83a6732cdd8b`; operational controls unchanged
- Provider/config changes: no provider credentials changed; Daily Log now uses existing authenticated project-record APIs only when accepted work exists
- Backup/rollback target: prior successful deployment `63a4f5aa-7b67-4e3e-9331-5ecd6dd8c0a6`; migration version unchanged
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit `d03f2a50e0df9297dc6c0e33c7eb83a6732cdd8b`; anonymous `/api/storage` returned 401 as expected for the private storage endpoint; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, and seven anonymous private-route checks
- Rendered UI evidence: `npm run test:ui:tools` covered Tools hub, Heavy 16th, Estimate Builder, Invoice Draft, Daily Log, server-backed `Save to Records` affordance against a mocked accepted-work/project-record API, local draft save, and Material Takeoff at 1440x900 and 390x844 with no horizontal overflow and zero console/page errors. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `d03f2a50e0df9297dc6c0e33c7eb83a6732cdd8b`; production synthetic monitor reports signups and mutations enabled
- Known risks: rendered Daily Log -> Records proof is local mocked UI evidence. Production project-record APIs were live-smoked in prior Packet 06, but this exact UI path still needs a DB-backed live UI smoke with an accepted-work fixture. Full Gate A remains blocked by real external error monitoring/paging, incident rehearsal, RPO/RTO policy approval, backup retention/cadence approval, support/legal/founder signoff, physical/deeper manual accessibility-device evidence, and production-grade server Shop Talk posts/reactions/reputation if promoted into launch scope.
- Rollback performed/result: not required
- Approval: Packet 08 Daily Log Records bridge slice accepted as controllable UX hardening evidence; overall Gate A not approved

## Previous Production - Packet 08 Daily Engagement Loop

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 19:55 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `aeb23caf2d09d9598adfcf3c7ad330e8bcaa9681`
- Build/artifact ID: Railway deployment `63a4f5aa-7b67-4e3e-9331-5ecd6dd8c0a6`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `aeb23caf2d09d9598adfcf3c7ad330e8bcaa9681`; operational controls unchanged
- Provider/config changes: no provider credentials changed; Daily Log drafts are browser-local and do not add server storage, SMS, email, payment, or tax-provider behavior
- Backup/rollback target: prior successful deployment `d717edd7-bd08-43f9-8f6e-eb213e45f8af`; migration version unchanged
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit `aeb23caf2d09d9598adfcf3c7ad330e8bcaa9681`; anonymous `/api/storage` returned 401 as expected for the private storage endpoint; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, and seven anonymous private-route checks
- Rendered UI evidence: `npm run test:ui:tools` covered Tools hub, Heavy 16th, Estimate Builder, Invoice Draft, Daily Log, and Material Takeoff at 1440x900 and 390x844 with no horizontal overflow and zero console/page errors. `npm run test:ui:shop-talk-news` covered the answer queue, reputation path, Answer now path, answer guidance, reaction toggle regression, Trade News original-source links, no horizontal overflow, and zero console/page errors at 1440x900 and 390x844. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass` and `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `aeb23caf2d09d9598adfcf3c7ad330e8bcaa9681`; production synthetic monitor reports signups and mutations enabled
- Known risks: Daily Log is a device-local draft surface, not a server-backed legal/project record. Shop Talk reputation path is current-surface UX, not durable multi-device reputation. Full Gate A remains blocked by real external error monitoring/paging, incident rehearsal, RPO/RTO policy approval, backup retention/cadence approval, support/legal/founder signoff, physical/deeper manual accessibility-device evidence, and production-grade server Shop Talk posts/reactions/reputation if promoted into launch scope.
- Rollback performed/result: not required
- Approval: Packet 08 daily engagement loop slice accepted as controllable UX hardening evidence; overall Gate A not approved

## Previous Production - Packet 08 Shop Talk Answer Queue

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 19:27 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `73f79ac63e22ceb07492fccd893b805a792d1ede`
- Build/artifact ID: Railway deployment `d717edd7-bd08-43f9-8f6e-eb213e45f8af`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `73f79ac63e22ceb07492fccd893b805a792d1ede`; operational controls unchanged
- Provider/config changes: no provider credentials changed; Shop Talk answer queue remains a UI/community-loop hardening pass, not a provider-backed social/reputation system
- Backup/rollback target: prior successful deployment `f17fbcec-f7a2-4c5f-bceb-b5dc1af1a436`; migration version unchanged
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit `73f79ac63e22ceb07492fccd893b805a792d1ede`; anonymous `/api/storage` returned `Authentication required` as expected for the private storage endpoint; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, and seven anonymous private-route checks. In-app Browser route proof was blocked by lack of authenticated route mocking, so rendered authenticated UI evidence is the dedicated Playwright smoke.
- Rendered UI evidence: `npm run test:ui:shop-talk-news` covered the Shop Talk answer queue, Answer now path, active answer-queue filter, answer guidance, reaction toggle regression, Trade News original-source links, no horizontal overflow, and zero console/page errors at 1440x900 and 390x844. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `73f79ac63e22ceb07492fccd893b805a792d1ede`; production synthetic monitor reports signups and mutations enabled
- Known risks: answer queue uses the current local Shop Talk surface and must not be treated as durable server reputation. Full Gate A remains blocked by real external error monitoring/paging, incident rehearsal, RPO/RTO policy approval, backup retention/cadence approval, support/legal/founder signoff, physical/deeper manual accessibility-device evidence, and production-grade server Shop Talk posts/reactions/reputation if promoted into launch scope.
- Rollback performed/result: not required
- Approval: Packet 08 Shop Talk answer queue slice accepted as controllable UX hardening evidence; overall Gate A not approved

## Previous Production - Packet 08 RIVT Daily Home Check-In

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 19:03 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `436b83fb94f70d2dc0b831d2a7ee09c59d915882`
- Build/artifact ID: Railway deployment `f17fbcec-f7a2-4c5f-bceb-b5dc1af1a436`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `436b83fb94f70d2dc0b831d2a7ee09c59d915882`; operational controls unchanged
- Provider/config changes: no provider credentials changed; Home now writes daily availability through the existing authenticated profile endpoint
- Backup/rollback target: prior successful deployment `4fb062bd-1c3e-474e-90df-fe42f4f2e1fa`; migration version unchanged
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit `436b83fb94f70d2dc0b831d2a7ee09c59d915882`; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, and seven anonymous private-route checks. DB-bound `smoke:ui:live` and `smoke:gate-a:live` could not run from this local machine because local env lacks `DATABASE_URL`, and Railway-injected private Postgres DNS (`postgres.railway.internal`) is not resolvable outside Railway.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `436b83fb94f70d2dc0b831d2a7ee09c59d915882`; production synthetic monitor reports signups and mutations enabled
- Known risks: `RIVT Daily` uses current app signals only; personalized ranking, streaks, durable server-owned Shop Talk reputation, and full daily-engagement analytics remain future work. Full Gate A remains blocked by real external error monitoring/paging, incident rehearsal, RPO/RTO policy approval, backup retention/cadence approval, support/legal/founder signoff, and physical/deeper manual accessibility/device evidence.
- Rollback performed/result: not required
- Approval: Packet 08 RIVT Daily home check-in slice accepted; overall Gate A not approved

## Previous Production - Packet 08 Trade News Real Media and Mobile Layout

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 17:51 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `a59eb47b9b3efc4eb8e60da835fc50d0cc912b5f`
- Build/artifact ID: Railway deployment `4fb062bd-1c3e-474e-90df-fe42f4f2e1fa`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits` (no schema migration)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `a59eb47b9b3efc4eb8e60da835fc50d0cc912b5f`; operational controls unchanged
- Provider/config changes: no provider credentials changed; Trade News now enriches RSS/feed items with public article images when source pages expose usable media
- Backup/rollback target: prior successful deployment `740dfd5a-23ab-4509-bde3-0a0615a1f6fe`; migration version unchanged
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit; live `/api/news?location=Jacksonville%2C%20FL` returned 30 items with 24 `article`/`feed` thumbnails, 6 fallbacks, 0 missing thumbnails, 0 missing source URLs, and 0 Google favicon thumbnails; `npm run monitor:production` passed
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `a59eb47b9b3efc4eb8e60da835fc50d0cc912b5f`; production synthetic monitor reports signups and mutations enabled
- Known risks: publishers may omit or block article images, so RIVT fallback topic thumbnails remain expected; full Gate A remains blocked by real external error monitoring/paging, incident rehearsal, RPO/RTO policy approval, backup retention/cadence approval, support/legal/founder signoff, and physical/deeper manual accessibility/device evidence
- Rollback performed/result: not required
- Approval: Packet 08 Trade News real-media/mobile-layout slice accepted; overall Gate A not approved

## Packet 00 Production Deployment

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-18 22:59 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `4c199d903683e44d17b7985272c399c6d7a6cbd6`
- Build/artifact ID: Railway deployment `0f6a928c-02e6-4d58-b13d-f80894bb4b77`
- Migration version before/after: `runtime-schema-v1` / `runtime-schema-v1` (no schema migration in Packet 00)
- Feature-flag/config version: `SOURCE_COMMIT` pinned to the deployed Git SHA; no feature-flag changes
- Provider/config changes: no provider credentials changed; Google remains configured and Facebook/Apple remain unavailable
- Backup/rollback target: previous successful Railway deployment `399d11d9-5bce-4832-a377-f5dd5f1d0ccc`; source rollback target `99be82a`
- Automated gates: GitHub Actions runs 27802147834, 27802375879, and merged-master run 27802435052 passed
- Post-deploy smoke tests: anonymous private APIs 401; invalid login fails closed; disposable signup/readiness/storage/logout passed and account was deleted; Trade News returned 22 items; desktop/mobile auth render returned 200 with no console errors
- Health/readiness result: healthy PostgreSQL and S3-compatible storage; readiness identified exact source commit and `runtime-schema-v1`
- Provider state: Google configured; Facebook/Apple setup required
- Record counts: 114 app-state and 1 upload at smoke time; no production content was modified except the deleted disposable smoke account
- Known risks: runtime schema mutation, app-state blob persistence, seed content, incomplete provider acceptance, and missing restore drill remain open
- Rollback performed/result: not required
- Approval: Packet 00 accepted; overall Gate A not approved

## Current Production - Packet 01

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-18 23:33 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `166c43a9e24af64737eed22088e0306cc6873b22`
- Build/artifact ID: Railway deployment `1188000e-374c-44db-9d32-b007bf481959`
- Migration version before/after: no SQL ledger (`runtime-schema-v1`) / `0002_domain_foundation`
- Feature-flag/config version: source SHA updated; S3 credentials moved to `rivt-private-66cklzn4qc-f`; backup encryption key added as a Railway secret
- Provider/config changes: new private Railway bucket; existing legacy object copied and verified; no auth/notification provider changes
- Backup/rollback target: encrypted object `backups/postgres/2026-06-19T03-29-15.832Z-pre-packet-01-4c199d9.json.aes256gcm`; prior app deployment `0f6a928c-02e6-4d58-b13d-f80894bb4b77`
- Automated gates: branch runs 27803255310, 27803349568, 27803604764 and merged-master run 27803652474 passed
- Post-deploy smoke tests: exact source SHA; migrations 0001/0002 with zero pending; canonical account bridge; anonymous 401 boundaries; disposable signup and private `/api/v1/me`; upload/head/signed-download content round trip; logout revocation; cleanup verified
- Health/readiness result: healthy PostgreSQL and S3-compatible storage; exact build commit; `0002_domain_foundation`
- Reconciled records: 2 accounts, 2 profiles, 2 identities, 25 trades, 0 organizations, 114 unchanged legacy state blobs
- Known risks: legacy state remains quarantined; old bucket retained for rollback; no timed isolated restore; identity linking and account recovery remain Packet 02 work
- Rollback performed/result: migration down/up is CI-proven; production rollback not required
- Approval: Packet 01 accepted; overall Gate A not approved

## Current Production - Packet 03 Jobs and Discovery

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 01:06 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `4a3a7215b09a8cfe224405f7b274bc10c8f7ac31`
- Build/artifact ID: Railway deployment `61142204-fa92-4c44-a798-27c99932266b`
- Migration version before/after: `0003_auth_onboarding_profiles` / `0004_jobs_discovery`
- Feature-flag/config version: source SHA updated; pilot invite enforcement remains enabled
- Provider/config changes: no provider credentials changed; Google and email remain available, Facebook/Apple unavailable
- Backup/rollback target: prior successful deployment `873af682-3c7c-4755-9a29-5054a394fb08`; checked migrations and closed smoke records
- Automated gates: local `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `npm run lint:security` passed; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is absent
- Post-deploy smoke tests: live smoke `packet03-20260620052132-4ef6a7` passed signup/onboarding, readiness, draft/update/publish/pause/resume/close, cross-contractor 403, idempotent publish replay, tradesperson discovery, private-address non-leak, paused/closed hiding, and disposable account closure
- Health/readiness result: healthy PostgreSQL and S3-compatible storage; readiness reports `0004_jobs_discovery`, four applied migrations, zero pending; health reports exact source commit
- Known risks: Packet 04 applications/offers/active work, messaging, records, reviews, admin operations, and full restore drill remain open
- Rollback performed/result: not required
- Approval: Packet 03 accepted; overall Gate A not approved

## Current Production - Packet 04 Applications and Active Work

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 02:02 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `0ccf88c3ade7511d6d3ad53fc2911cec90648810`
- Build/artifact ID: Railway deployment `04b7e269-f103-4bbe-88cf-6ef82161b6bc`; initial upload deployment `bef21475-e9f7-46f6-af2e-71a040a4b8d5` was replaced after updating `SOURCE_COMMIT`
- Migration version before/after: `0004_jobs_discovery` / `0005_match_acceptance`
- Feature-flag/config version: source SHA updated; pilot invite enforcement remains enabled
- Provider/config changes: no provider credentials changed; Google and email remain available, Facebook/Apple unavailable
- Backup/rollback target: prior successful Packet 03 deployment `61142204-fa92-4c44-a798-27c99932266b`; checked migration rollback for `0005_match_acceptance`
- Automated gates: local `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; GitHub Actions Gate A Safety run `27862175954` passed with disposable PostgreSQL coverage
- Post-deploy smoke tests: live smoke `packet04-20260620061146-411fdf` passed signup/onboarding, readiness, application submit, duplicate application 409, non-owner applicant list 403, contractor applicant list, offer creation, wrong-recipient offer acceptance 403, recipient acceptance, double-accept idempotency, one active-work record, two participants, private-address hidden-before/revealed-after acceptance, unrelated-user access denial, reschedule event, cancel event, and disposable account closure
- Health/readiness result: healthy PostgreSQL and S3-compatible storage; health reports exact source commit; migration status reports `0005_match_acceptance`, five applied migrations, zero pending
- Known risks: messaging, notifications, project records, reviews, admin operations, distributed rate limits, and full restore drill remain open
- Rollback performed/result: not required
- Approval: Packet 04 accepted; overall Gate A not approved

## Current Production - Packet 05 Messaging and In-App Notifications

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 07:46 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `338ce7f7ec921fbcfafe20b4f9b96ecbf3053224`
- Build/artifact ID: Railway deployment `16fb271d-9dc0-4d85-9a55-4765acb07f43`
- Migration version before/after: `0005_match_acceptance` / `0006_messaging_notifications`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `338ce7f7ec921fbcfafe20b4f9b96ecbf3053224`; pilot invite enforcement remains enabled
- Provider/config changes: no provider credentials changed; no SMS/external channels enabled
- Backup/rollback target: prior successful Packet 04 deployment `04b7e269-f103-4bbe-88cf-6ef82161b6bc`; checked migration rollback for `0006_messaging_notifications` in source tests
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit; anonymous `/api/storage` and `/api/readiness` returned 401. Live smoke `packet05-20260620123233-891897` passed signup/onboarding for disposable contractor, tradesperson, and outsider; readiness confirmed migration `0006_messaging_notifications`; accepted active work opened one conversation; outsider access returned empty/404; idempotent message send replayed; unread survived relogin; notification text excluded private address fields; read and read-all passed; mute suppressed a second message notification; report creation passed; block enforcement returned `ACCOUNT_BLOCKED`; two messages and one report persisted; disposable smoke accounts were closed.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit; authenticated readiness in live smoke reported `0006_messaging_notifications`
- Known risks: project records/completion, reviews, admin/support, distributed rate limits, full restore drill, and launch hardening remain open
- Rollback performed/result: not required
- Approval: Packet 05 accepted; overall Gate A not approved

## Current Production - Packet 06 Project Records and Completion

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 09:25 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `993be3899f8eb996229be90cf423cf58e5e27c76`
- Build/artifact ID: Railway deployment `67562c06-40d4-4923-bd82-52b169a0d45e`; initial application upload was `4da1b9b0-9afd-4af9-a088-c244a466a761`, followed by metadata redeploy after `SOURCE_COMMIT` was updated
- Migration version before/after: `0006_messaging_notifications` / `0007_project_completion`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `993be3899f8eb996229be90cf423cf58e5e27c76`; pilot invite enforcement remains enabled
- Provider/config changes: no provider credentials changed; project evidence uses existing private S3-compatible bucket
- Backup/rollback target: prior successful Packet 05 deployment `16fb271d-9dc0-4d85-9a55-4765acb07f43`; checked migration rollback for `0007_project_completion` in source tests
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit. Live smoke `packet06-20260620132532-bdf04b` passed signup/onboarding for disposable contractor, tradesperson, and outsider; readiness confirmed migration `0007_project_completion`; accepted work opened one private project record; outsider project/media URL access returned 404; note write replayed idempotently; malformed PNG was rejected with durable rejected media state and replayed idempotently; text evidence uploaded to managed storage and authorized signed-url route responded; completion submit, contractor confirmation, report reproducibility after relogin, private-address non-leak, second-project dispute, persisted counts, disposable account closure, and smoke object deletion passed.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit; authenticated readiness in live smoke reported `0007_project_completion`
- Known risks: reviews, admin/support, safety moderation, distributed rate limits, full restore drill, and final launch hardening remain open
- Rollback performed/result: not required
- Approval: Packet 06 accepted; overall Gate A not approved

## Packet 07 Pre-Deploy Source State

- Environment: Local source, production deployment pending
- Date/time/timezone: 2026-06-20 America/New_York
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: pending until commit/push
- Migration version before/after: production remains `0007_project_completion`; source adds `0008_reviews_admin_safety`
- Feature-flag/config version: no provider credentials changed; no automated verification provider enabled
- Provider/config changes: none
- Backup/rollback target: prior successful Packet 06 production deployment `67562c06-40d4-4923-bd82-52b169a0d45e`; source migration includes down migration for `0008_reviews_admin_safety`
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; DB-backed tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: not run yet; requires deployment and `npm run smoke:reviews:live`
- Health/readiness result: not checked for Packet 07; production currently reports Packet 06
- Known risks: disposable-PostgreSQL CI and live smoke are required before Packet 07 acceptance
- Rollback performed/result: not required
- Approval: not accepted; deploy and live smoke pending

## Current Production - Packet 07 Reviews, Admin, and Safety

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 10:33 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `01bf1adfedef03ee7ecd7c408d2bab6cbde654fe`
- Build/artifact ID: Railway application deployment `698ce001-b5b2-42c6-9967-9c89e30afe68`; metadata redeploy `b3c91226-d60b-407f-a93e-1e289cbdc968` after updating `SOURCE_COMMIT`
- Migration version before/after: `0007_project_completion` / `0008_reviews_admin_safety`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `01bf1adfedef03ee7ecd7c408d2bab6cbde654fe`; pilot invite enforcement remains enabled
- Provider/config changes: no provider credentials changed; no automated verification provider enabled
- Backup/rollback target: prior successful Packet 06 deployment `67562c06-40d4-4923-bd82-52b169a0d45e`; checked source rollback for `0008_reviews_admin_safety` in migration tests
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: first Packet 07 smoke against deployment `0f708552-8598-4a04-8f45-0126262efce8` caught a pending-onboarding mutation-guard regression; commit `01bf1ad` fixed the guard and was redeployed. Final live smoke `packet07-20260620143318-94c6bd` passed signup/onboarding for disposable contractor, tradesperson, outsider, and admin; normal user admin overview 403; migration `0008_reviews_admin_safety`; completed-work review creation; duplicate/ineligible review rejection; dispute/response/admin resolve; reputation count; unsafe stop-work report; safety report; block-hardened job/reputation access; admin suspension, support access while restricted, admin assist, restriction lift, immutable admin action count, and disposable cleanup.
- Health/readiness result: public health reports PostgreSQL and S3-compatible storage healthy with exact source commit `01bf1adfedef03ee7ecd7c408d2bab6cbde654fe`; authenticated readiness in live smoke reported `0008_reviews_admin_safety`, eight applied migrations, zero pending
- Known risks: Gate A hardening remains: restore drill, distributed limits, observability/alerts, support runbooks, final launch checklist, and remaining legacy bridge cleanup
- Rollback performed/result: not required
- Approval: Packet 07 accepted; overall Gate A not approved

## Current Production - Packet 08 Hardening Audit Controls

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 12:41 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `7e60a9de537fcc555b32f2510c4bed5371ccd264`
- Build/artifact ID: Railway application deployment `cf59e885-5f00-429b-b790-0d390ce66886`; metadata redeploy `2cf8d8d3-b46f-4400-a049-b3a68f64ad14` after updating `SOURCE_COMMIT`
- Migration version before/after: `0008_reviews_admin_safety` / `0008_reviews_admin_safety`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `7e60a9de537fcc555b32f2510c4bed5371ccd264`; operational controls are wired but disabled (`signupsDisabled=false`, `mutationsDisabled=false`)
- Provider/config changes: no provider credentials changed; no external monitoring provider was configured in this deployment
- Backup/rollback target: prior successful Packet 07 deployment `b3c91226-d60b-407f-a93e-1e289cbdc968`; migration version unchanged; cleanup command was non-destructive and converted matching test artifacts to private/closed states
- Automated gates: local `node --check` for new scripts, `npm run lint:security`, `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit. First live hardening audit caught user-facing test artifacts: two `RIVT * Test` public profiles and twelve Packet 03-07 smoke organizations. Guarded production cleanup made the two profiles private and closed the twelve smoke organizations without deleting records. Final `npm run smoke:gate-a:live` passed with exact source, migration `0008_reviews_admin_safety`, seven anonymous private-route checks returning 401, zero seed/demo findings, 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, and 115 legacy app-state rows.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `7e60a9de537fcc555b32f2510c4bed5371ccd264`; authenticated readiness exposes operational-control state and migration status
- Known risks at this release: full Gate A remained blocked by timed isolated restore drill, external monitoring/alerts and incident routing, durable/distributed rate limits, manual accessibility/device matrix, support/legal/founder signoff, and the still-open legacy bridge decision. Later Packet 08 slices closed durable rate limits and the legacy bridge decision.
- Rollback performed/result: not required
- Approval: Packet 08 hardening audit slice accepted; overall Gate A not approved

## Current Production - Packet 08 Durable Rate Limits

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 13:36 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `bf42ee6a51dc91ddeb4c2451ee2434e0548d8615`
- Build/artifact ID: Railway application deployment `14ae3c42-c5c0-4bfb-a873-b496a51c6877`; metadata redeploy `300918e1-5ed5-44f3-8bbb-e2c289c5f97a` after updating `SOURCE_COMMIT`
- Migration version before/after: `0008_reviews_admin_safety` / `0009_durable_rate_limits`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `bf42ee6a51dc91ddeb4c2451ee2434e0548d8615`; auth/write/upload limits now use the PostgreSQL `rate_limit_windows` table
- Provider/config changes: no provider credentials changed; no external monitoring provider was configured in this deployment
- Backup/rollback target: prior successful Packet 08 hardening deployment `2cf8d8d3-b46f-4400-a049-b3a68f64ad14`; migration `0009_durable_rate_limits` has a down migration that drops only `rate_limit_windows`
- Automated gates: `node --check server/security.js`, `node --check server/index.js`, `node --check scripts/live-gate-a-hardening.js`, targeted `node --test test/security.test.js`, local `npm run lint:security`, `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit. Final `npm run smoke:gate-a:live` passed from the Railway runtime with migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 legacy app-state rows, and 0 rate-limit windows before traffic.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `bf42ee6a51dc91ddeb4c2451ee2434e0548d8615`; live hardening audit reports latest migration `0009_durable_rate_limits`
- Known risks at this release: full Gate A remained blocked by timed isolated restore drill, external monitoring/alerts and incident routing, manual accessibility/device matrix, support/legal/founder signoff, and the still-open legacy bridge decision. The subsequent Packet 08 legacy bridge retirement slice closed that decision.
- Rollback performed/result: not required
- Approval: Packet 08 durable rate-limit slice accepted; overall Gate A not approved

## Current Production - Packet 08 Legacy Bridge Retirement

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 15:06 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `00147c8e3f70e246b41ed48b46550ae33cf0eb54`
- Build/artifact ID: Railway application deployment `dd46b5e2-916a-47be-9dde-36cb0c8d9ed6`; metadata redeploy `f2170045-3df8-498e-b29e-fc733cc18b9f` after updating `SOURCE_COMMIT`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `00147c8e3f70e246b41ed48b46550ae33cf0eb54`; no operational-control flags changed
- Provider/config changes: no provider credentials changed; no external monitoring provider was configured in this deployment
- Backup/rollback target: prior successful Packet 08 durable-rate-limit deployment `300918e1-5ed5-44f3-8bbb-e2c289c5f97a`; no migration change
- Automated gates: local `npm run lint`, `npm run build`, `npm run test`, `npm run test:e2e`, `npm run lint:security`, and `npm audit --omit=dev` passed; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit. `npm run smoke:gate-a:live` passed inside the Railway service with migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 0 rate-limit windows before traffic.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `00147c8e3f70e246b41ed48b46550ae33cf0eb54`; live hardening audit reports latest migration `0009_durable_rate_limits`
- Known risks: full Gate A remains blocked by timed isolated restore drill, external monitoring/alerts and incident routing, manual accessibility/device matrix, and support/legal/founder signoff
- Rollback performed/result: not required
- Approval: Packet 08 legacy bridge retirement slice accepted; overall Gate A not approved

## Current Production - Packet 08 Accessibility Matrix Progress

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 18:07 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `7fc6f65b1dad7af803547293cae199135908c5cd`
- Build/artifact ID: Railway deployment `255d59f0-ecdf-4c0d-ac36-583045b767a8`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `7fc6f65b1dad7af803547293cae199135908c5cd`; no operational-control flags changed
- Provider/config changes: no provider credentials changed; external monitoring provider still not configured
- Backup/rollback target: prior successful Packet 08 legacy-bridge deployment `f2170045-3df8-498e-b29e-fc733cc18b9f`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit. Public auth shell at 390x844 measured 46px email/password fields, retained visible labels, showed no console warnings/errors, and had no horizontal overflow.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `7fc6f65b1dad7af803547293cae199135908c5cd`
- Known risks: full Gate A remains blocked by timed isolated restore drill, external monitoring/alerts and incident routing, authenticated/physical accessibility-device matrix, and support/legal/founder signoff
- Rollback performed/result: not required
- Approval: accessibility matrix progress accepted as partial evidence; overall Gate A not approved

## Current Production - Packet 08 Authenticated Accessibility Smoke

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-20 20:58 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `f5a68d9c16364c94dd727bb91e03a25f33e283df`
- Build/artifact ID: Railway deployment `b241d02b-04bf-42d8-a462-243d06f4ab4a`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `f5a68d9c16364c94dd727bb91e03a25f33e283df`; no operational-control flags changed
- Provider/config changes: no provider credentials changed; external monitoring provider still not configured
- Backup/rollback target: prior successful Packet 08 accessibility deployment `255d59f0-ecdf-4c0d-ac36-583045b767a8`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit. Authenticated UI smoke `ui-a11y-20260621005817-8a87eb` created disposable contractor and tradesperson accounts, verified contractor mobile, tradesperson mobile, and contractor desktop shells, and closed both accounts. Top-bar search/messages/notifications/profile controls were present, role toggle and More tab were absent, horizontal overflow was absent, `consoleWarningsOrErrors` was zero, and `smallTargetCount` was zero on all tested viewports. Reduced-motion browser preference was enabled; keyboard focus reached skip link, RIVT home, top-bar controls, profile menu, and primary navigation with named visible focus targets. The smoke now fails on missing top-bar controls, post-login console warnings/errors, sub-44px controls, unnamed keyboard focus targets, or keyboard focus not reaching search/primary navigation. Live hardening audit also passed with zero seed/demo findings. `npm run monitor:production` passed externally with seven anonymous private-route checks and a 554 ms duration. Deployed `npm run restore:drill` correctly refused to run without isolated `RESTORE_DATABASE_URL`.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `f5a68d9c16364c94dd727bb91e03a25f33e283df`; live hardening audit reports latest migration `0009_durable_rate_limits`
- Known risks: full Gate A remains blocked by timed isolated restore drill, external monitoring/alerts and incident routing, physical/deeper manual accessibility-device matrix, and support/legal/founder signoff
- Rollback performed/result: not required
- Approval: authenticated accessibility smoke accepted as partial evidence; overall Gate A not approved

## Current Production - Packet 08 Timed Isolated Logical Restore

- Environment: Production (`https://rivt.pro`) plus temporary isolated Railway PostgreSQL target
- Date/time/timezone: 2026-06-20 22:42 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `e0ac24d143c29f1f17c6570debbd576f49538597`
- Build/artifact ID: Railway application deployment `ab7ee788-da6d-473d-9834-8382af0af057`; metadata redeploy `0d3f94b0-f586-446f-808b-9078c9a40f65` after updating `SOURCE_COMMIT`
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `e0ac24d143c29f1f17c6570debbd576f49538597`; no operational-control flags changed
- Provider/config changes: temporary Railway PostgreSQL service `Postgres-3Ei3` (`fe501310-25bb-4389-a2fb-1a11dc89772c`, deployment `f034530e-2aa3-46d3-a83b-ea3b11df9f30`) was created as an isolated restore target and deleted after verification; no temporary restore variables remain on RIVT or Postgres
- Backup/rollback target: prior successful deployment `b241d02b-04bf-42d8-a462-243d06f4ab4a`; logical restore source was the live production PostgreSQL database at the time of the drill, not a named backup artifact
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed on final source; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit. `npm run restore:logical-copy -- --apply-migrations` ran inside the Railway RIVT service against the isolated target, applied migrations, copied 59 public tables and 1,524 rows, restored sequence positions, and completed in 1,421 ms. `npm run restore:drill` then verified migration `0009_durable_rate_limits`, nine applied migrations, zero pending migrations, exact source/target row-count parity across critical Gate A tables, zero count diffs, and a 220 ms verifier duration. `npm run monitor:production` passed externally with seven anonymous private-route checks and a 549 ms duration. `npm run smoke:gate-a:live` passed with zero seed/demo findings.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `e0ac24d143c29f1f17c6570debbd576f49538597`; live hardening audit reports latest migration `0009_durable_rate_limits`
- Known risks: full Gate A remains blocked by backup-artifact restore/RPO acceptance if required, dedicated error monitoring/alerts and named incident owner routing, physical/deeper manual accessibility-device matrix, and support/legal/founder signoff
- Rollback performed/result: not required
- Approval: timed isolated logical restore accepted as partial restore evidence; overall Gate A not approved

## Local Packet 08 - Backup Artifact Restore Tooling

- Environment: Local repository tooling; no production deploy performed in this slice
- Date/time/timezone: 2026-06-20 23:11 America/New_York
- Deployer: Codex
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: pending local changes
- Build/artifact ID: not deployed
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: no app runtime flags changed
- Provider/config changes: temporary RIVT service restore-control variables (`RESTORE_DATABASE_URL`, `RESTORE_SOURCE_DATABASE_URL`, `CONFIRM_RESTORE_TARGET_ISOLATED`) were found and removed; key-name verification showed only persistent backup/storage variables remain (`BACKUP_ENCRYPTION_KEY`, `DATABASE_URL`, `S3_*`, `SOURCE_COMMIT`)
- Backup/rollback target: new tooling creates a current encrypted S3-compatible logical backup object with `npm run backup:logical-artifact`; live object creation was not executed because Railway CLI auth expired before isolated-target provisioning
- Automated gates: `node --check` passed for `scripts/logical-backup-utils.js`, `scripts/create-logical-backup-artifact.js`, and `scripts/restore-logical-backup-artifact.js`; `npm run test:unit` passed with 23 tests including logical backup encryption/decryption, dependency ordering, count-diff reporting, and matching-target refusal; `npm run lint:security` passed with the new scripts included; `npm run restore:logical-artifact` without env failed cleanly with `RESTORE_DATABASE_URL is required`
- Post-deploy smoke tests: none; no deployment occurred
- Health/readiness result: not rechecked in this slice because Railway CLI returned `Unauthorized. Please run railway login again.`
- Known risks: live backup-artifact restore/RPO evidence remains blocked until Railway is re-authenticated, a fresh temporary isolated PostgreSQL target is provisioned, a current named backup object is created/restored, and the target is deleted after verification
- Rollback performed/result: not required
- Approval: tooling progress accepted as partial evidence only; overall Gate A not approved

## Local Packet 08 - Incident Readiness Gate

- Environment: Local repository tooling plus GitHub workflow source; no production deploy performed in this slice
- Date/time/timezone: 2026-06-20 23:25 America/New_York
- Deployer: Codex
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: pending local changes
- Build/artifact ID: not deployed
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: no app runtime flags changed
- Provider/config changes: no provider credentials changed; no dedicated error-monitoring or paging provider was configured
- Backup/rollback target: prior pushed source `43117cc Add backup artifact restore tooling`; no deploy
- Automated gates: `npm run incident:readiness -- --json` returned blocked with primary owner `Michael <support@rivt.pro>` and synthetic monitoring configured; missing findings were backup owner, support hours, dedicated error monitoring, paging route, incident rehearsal, founder approval, support approval, and legal/safety approval. `npm run test:unit` passed with 25 tests including incident-readiness coverage. `npm run lint:security` passed with the new script included. `node --check scripts/incident-readiness-check.js` passed.
- Post-deploy smoke tests: none; no deployment occurred
- Health/readiness result: not rechecked because Railway CLI remains unauthorized
- Known risks: full Gate A remains blocked until `docs/operations/incident-routing.json` is completed with real owner/escalation/provider/approval evidence and `npm run incident:readiness -- --require-ready` passes
- Rollback performed/result: not required
- Approval: incident-readiness tooling accepted as partial evidence only; overall Gate A not approved

## Local Packet 08 - Accessibility Matrix Script Expansion

- Environment: Local repository tooling; no production deploy performed in this slice
- Date/time/timezone: 2026-06-20 23:55 America/New_York
- Deployer: Codex
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: pending local changes
- Build/artifact ID: not deployed
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: no app runtime flags changed
- Provider/config changes: none
- Backup/rollback target: prior pushed source `a5d7d45 Add incident readiness gate`; no deploy
- Automated gates: `scripts/live-ui-accessibility.js` was expanded to cover 360x800 phone, 390x844 phone, 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and 390x844 200% text-scale scenarios. The script has not yet been rerun against production in this slice.
- Post-deploy smoke tests: none; no deployment occurred
- Health/readiness result: not rechecked because Railway CLI remains unauthorized
- Known risks: full Gate A still requires live-recorded expanded matrix evidence plus physical-device/manual screen-reader coverage
- Rollback performed/result: not required
- Approval: accessibility tooling progress accepted as partial evidence only; overall Gate A not approved

## Current Production - Packet 08 Backup Artifact Restore and Expanded UI Matrix

- Environment: Production (`https://rivt.pro`) plus temporary isolated Railway PostgreSQL target
- Date/time/timezone: 2026-06-21 00:35 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `67094c9853a8f4be2be01ffe30376b669afe6cde`
- Build/artifact ID: Railway application deployment `007b3270-4c08-4c61-8238-3164db747666`; earlier same-session deployment `81c8c39c-0266-435d-b203-485266d2a23b` deployed backup-artifact tooling, and deployments `f53b5fdd-e176-49a3-8e78-ffccf7f47c8d` / `007b3270-4c08-4c61-8238-3164db747666` deployed the Crew/network overflow fixes.
- Migration version before/after: `0009_durable_rate_limits` / `0009_durable_rate_limits`
- Feature-flag/config version: `SOURCE_COMMIT` updated to `67094c9853a8f4be2be01ffe30376b669afe6cde`; no operational-control flags changed
- Provider/config changes: no provider credentials changed; temporary Railway PostgreSQL restore service `Postgres-_FQz` was used only as an isolated restore target and deleted after verification; detached restore volumes `postgres-volume-FH_H` and `postgres-volume-M1Ll` were marked for deletion; leftover temporary restore variables were removed from RIVT/Postgres
- Backup/rollback target: named encrypted backup object `backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm`; prior successful deployment `0d3f94b0-f586-446f-808b-9078c9a40f65`
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; local DB-backed integration tests skipped because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: public `/api/health` passed and reported exact source commit. `npm run backup:logical-artifact` created the named encrypted backup object from 59 tables and 1,524 rows in 630 ms. `npm run restore:logical-artifact -- --apply-migrations` restored the named object into the isolated target, applied nine migrations, restored 59 tables and 1,524 rows, verified table/column/sequence and strict manifest-count parity with zero diffs, and completed in 13,411 ms. `npm run restore:drill` verified migration `0009_durable_rate_limits`, nine applied migrations, zero pending migrations, zero count diffs, and completed in 1,862 ms. `npm run monitor:production` passed with seven anonymous private-route checks. `npm run smoke:gate-a:live` passed with zero seed/demo findings. Expanded authenticated UI smoke `ui-a11y-20260621043529-3efa9b` passed 360x800, 390x844, 768x1024, 1366x768, 1440x900, and 390x844 at 200% root text scale after Crew/network overflow fixes.
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `67094c9853a8f4be2be01ffe30376b669afe6cde`; live hardening audit reports latest migration `0009_durable_rate_limits`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, and physical/deeper manual accessibility-device matrix
- Rollback performed/result: not required
- Approval: backup artifact restore and expanded authenticated UI matrix accepted as production evidence; overall Gate A not approved

## Local Packet 08 - Launch Operations Readiness Gate

- Environment: Local repository tooling; no production deploy performed in this slice
- Date/time/timezone: 2026-06-21 00:50 America/New_York
- Deployer: Codex
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: pending local changes
- Build/artifact ID: not deployed
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: no app runtime flags changed
- Provider/config changes: no provider credentials changed; no dedicated error-monitoring or paging provider was configured
- Backup/rollback target: named encrypted backup object `backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm` is now recorded in `docs/operations/recovery-policy.json`; no new backup object was created in this slice
- Automated gates: `node --check scripts/launch-readiness-check.js` passed; `node --test test/launch-readiness.test.js` passed; `npm run incident:readiness -- --json` returned blocked with expected missing incident owner/support/provider/rehearsal/approval fields; `npm run launch:readiness -- --json` returned blocked with those incident findings plus missing recovery-policy RPO/RTO, retention, cadence, next restore due date, and recovery approvals while recognizing the recent named backup-artifact restore; full local gates passed with `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`
- Post-deploy smoke tests: none; no deployment occurred
- Health/readiness result: not rechecked because this slice added local ops tooling/docs only
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO/retention/cadence policy approval, and physical/deeper manual accessibility-device matrix
- Rollback performed/result: not required
- Approval: launch-readiness tooling accepted as partial evidence only; overall Gate A not approved

## Local Packet 08 - Controllable Top-Bar Interaction Coverage

- Environment: Local repository tooling; no production deploy performed in this slice
- Date/time/timezone: 2026-06-21 01:10 America/New_York
- Deployer: Codex
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: pending local changes
- Build/artifact ID: not deployed
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: no app runtime flags changed
- Provider/config changes: none
- Backup/rollback target: prior pushed source `252081a Add launch operations readiness gate`; no deploy
- Automated gates: `node --check scripts/live-ui-accessibility.js` passed; `npm run lint:security` passed after adding top-bar action audits; `npm run test:e2e` passed after mocked desktop/mobile coverage opened search, notifications, account/profile, and messages/inbox; full local gates passed with `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`
- Post-deploy smoke tests: none; no deployment occurred
- Health/readiness result: not rechecked because this slice only changed test/smoke coverage
- Known risks: the expanded top-bar action audit has not yet been rerun against production with disposable accounts; physical/manual accessibility and external incident/launch operations blockers remain open
- Rollback performed/result: not required
- Approval: controllable UI smoke coverage accepted as local evidence only; overall Gate A not approved

## Current Production - Packet 08 Trade News and Shop Talk Polish

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 01:55 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Runtime source commit: `850337ff3c54f98405c58f74ac5feb39213f1bbd`, followed by documentation/metadata source `97cc5dd6d807a0a44a7eac2cb71c2a602e1ee8f9`
- Build/artifact ID: Railway deployment `9c1a3184-1b5e-44dc-bcae-6b8cffc5fc7b`; a later metadata redeploy set `SOURCE_COMMIT` to `97cc5dd6d807a0a44a7eac2cb71c2a602e1ee8f9`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated after the initial successful app deployment; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful launch-ops deployment; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: production `/api/news` returned curated contractor-relevant news plus live tail items with original source URLs, RIVT-owned fallback thumbnails, zero Google favicon thumbnails, zero missing thumbnails, zero missing source URLs, and zero homeowner drift findings. A later verification on source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1` returned 23 items with the same thumbnail/source-url guarantees.
- Health/readiness result: health remained healthy with PostgreSQL and S3-compatible storage; the final current runtime health now reports exact source commit `4fe22bc6a3cbbd146ac286869562f4c3e968ece1`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, incident rehearsal, RPO/RTO policy approval, support/legal/founder approvals, and physical/deeper manual accessibility-device matrix
- Rollback performed/result: not required
- Approval: Trade News and Shop Talk polish accepted as controllable UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 UI Smoke Regression Fixes

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 02:54 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `4fe22bc6a3cbbd146ac286869562f4c3e968ece1`
- Build/artifact ID: Railway deployment `7fe1c3ea-d5f4-48c4-b757-a46ff8ebc369`; earlier same-session deployments fixed mobile search target (`3577f1f`), notification quick actions (`b1768d8`), base theme toggle target (`a76377f`), responsive theme toggle overrides (`8f13d9c`), and Inbox targets (`30293e9`)
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `4fe22bc6a3cbbd146ac286869562f4c3e968ece1`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful Trade News deployment `9c1a3184-1b5e-44dc-bcae-6b8cffc5fc7b`; no migration change
- Automated gates: after each runtime fix, local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: live authenticated UI smoke used Railway-side setup/cleanup plus local Playwright browser execution because local `railway run` cannot resolve Railway private DNS and the Railway container does not include Playwright browser binaries. Final run `ui-a11y-20260621062332-02b380` passed contractor/tradesperson 360x800 and 390x844 phones, contractor 768x1024 tablet, contractor 1366x768 laptop, contractor 1440x900 desktop, and contractor 390x844 at 200% root text scale. It opened and audited search, notifications, profile/account, and messages/inbox surfaces; every scenario reported top-bar search/messages/notifications/profile present, reduced-motion enabled, keyboard focus reaching named top-bar and primary navigation targets, `consoleWarningsOrErrors: 0`, and `smallTargetCount: 0`. The two disposable accounts were closed after the run.
- Health/readiness result: `https://rivt.pro/api/health` returned exact source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1` with PostgreSQL and S3-compatible storage healthy. `npm run monitor:production` passed externally with seven anonymous private-route checks. `npm run smoke:gate-a:live` passed inside Railway with migration `0009_durable_rate_limits`, zero seed/demo findings, and production counts of 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 78 rate-limit windows.
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, and physical/deeper manual accessibility-device matrix
- Rollback performed/result: not required
- Approval: production UI smoke regression fixes accepted as controllable Gate A evidence; overall Gate A not approved

## Current Production - Packet 08 Tools Studio Release

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 03:16 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `24c37ac7dfc086903c688ec64df684f42e35db6b`
- Build/artifact ID: Railway deployment `ac8d1f8d-ac13-424d-b1ba-a4dc0a0ebdde`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `24c37ac7dfc086903c688ec64df684f42e35db6b`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful UI smoke regression deployment `7fe1c3ea-d5f4-48c4-b757-a46ff8ebc369`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `24c37ac7dfc086903c688ec64df684f42e35db6b`; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 561 ms duration. Local rendered Playwright QA covered Tools hub, Heavy 16th calculator, invoice draft, and desktop hub at 390x844 and 1440x900 with no horizontal overflow and no console errors.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `24c37ac7dfc086903c688ec64df684f42e35db6b`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, and production-grade server invoice/SMS delivery if that is promoted from Gate B
- Rollback performed/result: not required
- Approval: Tools studio accepted as controllable UX hardening and a founder-approved local-utility exception; overall Gate A not approved

## Current Production - Packet 08 Records Workspace Upgrade

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 10:41 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `1679aec006c8cb393b6986aa24ec507c15bc8181`
- Build/artifact ID: Railway deployment `83c95b13-a681-4e31-9768-e87aea6f8312`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `1679aec006c8cb393b6986aa24ec507c15bc8181`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful Tools studio deployment `ac8d1f8d-ac13-424d-b1ba-a4dc0a0ebdde`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `1679aec006c8cb393b6986aa24ec507c15bc8181`; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 464 ms duration. Local rendered Playwright QA covered Records workspace at 390x844 and 1440x900 with no horizontal overflow and no console errors.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `1679aec006c8cb393b6986aa24ec507c15bc8181`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, and production-grade server invoice/SMS delivery if that is promoted from Gate B
- Rollback performed/result: not required
- Approval: Records workspace accepted as controllable UX hardening for server-backed accepted-work records; overall Gate A not approved

## Current Production - Packet 08 UI System Pass

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 11:22 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `8d90ef22be8fee2471435ccf9cab134d04154560`
- Build/artifact ID: Railway deployment `747f71f5-f790-4277-8d26-cc50bcdff77a`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `8d90ef22be8fee2471435ccf9cab134d04154560`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful Records workspace deployment `83c95b13-a681-4e31-9768-e87aea6f8312`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `8d90ef22be8fee2471435ccf9cab134d04154560`; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 465 ms duration. Local rendered Playwright QA covered Home, Work, Crew, Inbox, Tools, Records, and Profile at desktop/mobile breakpoints with no horizontal overflow and no console/page errors; screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-system-pass`.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `8d90ef22be8fee2471435ccf9cab134d04154560`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, and production-grade server invoice/SMS delivery if promoted from Gate B
- Rollback performed/result: not required
- Approval: UI system pass accepted as controllable UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 Shared UI Primitives Pass

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 11:52 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `b2229170be23405138bb66ce479755585730163b`
- Build/artifact ID: Railway deployment `e3ad8e53-e001-418d-b688-48519cd6a8dd`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `b2229170be23405138bb66ce479755585730163b`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful UI system deployment `747f71f5-f790-4277-8d26-cc50bcdff77a`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `b2229170be23405138bb66ce479755585730163b`; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 534 ms duration. Rendered local Playwright QA covered Home, Work, Crew, Inbox, Tools, Records, and Profile at desktop/mobile breakpoints with no horizontal overflow and no console/page errors; final mobile spot-checks verified the corrected profile fact-card sizing and dark-header logo contrast. Screenshot evidence is outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-primitives-pass` and `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-primitives-pass-final`.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `b2229170be23405138bb66ce479755585730163b`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, remaining `src/App.tsx` strangler/component cleanup, and production-grade server invoice/SMS delivery if promoted from Gate B
- Rollback performed/result: not required
- Approval: shared UI primitives pass accepted as controllable UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 Tools Primitive Alignment Pass

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 14:03 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `0680b8f013c167ac4706ad6faf648a0e5cc6df3a`
- Build/artifact ID: Railway deployment `b7740f77-4af0-4ba2-838f-ff85386cb86b`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `0680b8f013c167ac4706ad6faf648a0e5cc6df3a`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful shared-primitives deployment `e3ad8e53-e001-418d-b688-48519cd6a8dd`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `0680b8f013c167ac4706ad6faf648a0e5cc6df3a`; anonymous `/api/storage` returned `Authentication required` as expected for the private storage endpoint; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 494 ms duration
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `0680b8f013c167ac4706ad6faf648a0e5cc6df3a`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, remaining `src/App.tsx` strangler/component cleanup, and production-grade server invoice/SMS delivery if promoted from Gate B
- Rollback performed/result: not required
- Approval: Tools primitive alignment accepted as controllable UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 Shop Talk Command Center Pass

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 14:30 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `4cef7973b247c3377efad3040ddb600110b2678b`
- Build/artifact ID: Railway deployment `f001843b-ab15-4f79-9406-bc36bfd27f31`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `4cef7973b247c3377efad3040ddb600110b2678b`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful Tools primitive alignment deployment `b7740f77-4af0-4ba2-838f-ff85386cb86b`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured. Added and passed repeatable rendered QA command `npm run test:ui:shop-talk-news`.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `4cef7973b247c3377efad3040ddb600110b2678b`; anonymous `/api/storage` returned `Authentication required` as expected for the private storage endpoint; live `/api/news` returned 21 items with zero missing original URLs and zero missing thumbnails; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 491 ms duration.
- Rendered UI evidence: `npm run test:ui:shop-talk-news` covered Shop Talk and Trade News at 1440x900 and 390x844 using authenticated route mocks, verified search inputs, original-source links, no horizontal overflow, and zero console/page errors. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `4cef7973b247c3377efad3040ddb600110b2678b`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, remaining `src/App.tsx` strangler/component cleanup, and production-grade server invoice/SMS delivery if promoted from Gate B
- Rollback performed/result: not required
- Approval: Shop Talk command center and Trade News feed polish accepted as controllable UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 Tools App Surface Pass

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 15:20 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `ad5ff7d2ed174634c4bde82bb0b7b23d8a058e8f`
- Build/artifact ID: Railway deployment `14bb03aa-9e7d-41f1-a0d0-24335fb216b8`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `ad5ff7d2ed174634c4bde82bb0b7b23d8a058e8f`; no operational-control flags changed
- Provider/config changes: no provider credentials changed; invoice email/SMS actions remain device draft links, not server delivery
- Backup/rollback target: prior successful Shop Talk command center deployment `f001843b-ab15-4f79-9406-bc36bfd27f31`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `ad5ff7d2ed174634c4bde82bb0b7b23d8a058e8f`; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 484 ms duration
- Rendered UI evidence: `npm run test:ui:tools` covered Tools hub, Heavy 16th field calculator, Estimate Builder, Invoice Draft, and Material Takeoff at 1440x900 and 390x844 using authenticated route mocks, verified calculator copy output, invoice email/SMS draft affordances, material presets, no horizontal overflow, and zero console/page errors. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `ad5ff7d2ed174634c4bde82bb0b7b23d8a058e8f`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, remaining `src/App.tsx` strangler/component cleanup, and production-grade server invoice/SMS delivery if promoted from Gate B
- Rollback performed/result: not required
- Approval: Tools app surface pass accepted as controllable UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 Heavy 16th Multi-Mode Calculator Pass

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 16:35 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `444fc96b49f9b7cb60e7ca547a300d3df3000891`
- Build/artifact ID: Railway deployment `6bd7f24d-6948-4a2c-a9c2-bf77b1a95abe`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `444fc96b49f9b7cb60e7ca547a300d3df3000891`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful Tools app surface deployment `14bb03aa-9e7d-41f1-a0d0-24335fb216b8`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `444fc96b49f9b7cb60e7ca547a300d3df3000891`; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 513 ms duration
- Rendered UI evidence: `npm run test:ui:tools` now covers the Heavy 16th Length, Spacing, Cuts, and Hardware modes plus Estimate Builder, Invoice Draft, and Material Takeoff at 1440x900 and 390x844. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `444fc96b49f9b7cb60e7ca547a300d3df3000891`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, remaining `src/App.tsx` strangler/component cleanup, and production-grade server invoice/SMS delivery if promoted from Gate B
- Rollback performed/result: not required
- Approval: Heavy 16th multi-mode calculator accepted as controllable Tools UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 Invoice Draft App Upgrade

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 16:59 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `97d9da7adb90a79b00af695fa36460f4888cb5e7`
- Build/artifact ID: Railway deployment `58d6dca4-d5cb-40e7-b18d-5a037c36ec6b`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `97d9da7adb90a79b00af695fa36460f4888cb5e7`; no operational-control flags changed
- Provider/config changes: no provider credentials changed; invoice templates remain local browser storage and email/SMS actions remain device drafts only
- Backup/rollback target: prior successful Heavy 16th deployment `6bd7f24d-6948-4a2c-a9c2-bf77b1a95abe`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `97d9da7adb90a79b00af695fa36460f4888cb5e7`; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 494 ms duration
- Rendered UI evidence: `npm run test:ui:tools` covered invoice template save/load visibility, recipient email/phone fields, delivery draft affordances, printable invoice preview, no horizontal overflow, and zero console/page errors at 1440x900 and 390x844. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `97d9da7adb90a79b00af695fa36460f4888cb5e7`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, remaining `src/App.tsx` strangler/component cleanup, and production-grade server invoice/SMS delivery if promoted from Gate B
- Rollback performed/result: not required
- Approval: Invoice Draft app upgrade accepted as controllable Tools UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 Shop Talk Reaction and Social Pulse Pass

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-06-21 17:23 America/New_York
- Deployer: Codex through authenticated Railway CLI
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `1227e1cdba071889384006fca44403538977b8df`
- Build/artifact ID: Railway deployment `740dfd5a-23ab-4509-bde3-0a0615a1f6fe`
- Migration version before/after: unchanged (`0009_durable_rate_limits`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `1227e1cdba071889384006fca44403538977b8df`; no operational-control flags changed
- Provider/config changes: no provider credentials changed; Shop Talk reactions remain local browser state in this pass and are not durable server reputation
- Backup/rollback target: prior successful Invoice Draft deployment `58d6dca4-d5cb-40e7-b18d-5a037c36ec6b`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, `npm run test:ui:shop-talk-news`, `npm audit --omit=dev`, and `git diff --check` passed; DB-backed integration tests skipped locally because `TEST_DATABASE_URL` is not configured
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `1227e1cdba071889384006fca44403538977b8df`; `npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 547 ms duration
- Rendered UI evidence: `npm run test:ui:shop-talk-news` covered Shop Talk and Trade News at 1440x900 and 390x844 using authenticated route mocks, verified the Social hub pulse, thread upvote toggling, answer upvote toggling, no horizontal overflow, original-source links, and zero console/page errors. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `1227e1cdba071889384006fca44403538977b8df`
- Known risks: full Gate A remains blocked by dedicated error monitoring/paging, completed incident-routing fields and rehearsal, founder/support/legal-safety approvals, RPO/RTO policy approval, physical/deeper manual accessibility-device matrix, remaining `src/App.tsx` strangler/component cleanup, and production-grade server Shop Talk posts/reactions/reputation if promoted from Gate B to launch scope
- Rollback performed/result: not required
- Approval: Shop Talk reaction and social pulse pass accepted as controllable social-hub UX hardening evidence; overall Gate A not approved

## Current Production - Packet 08 Onboarding V2 Hybrid

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-02 01:43 America/New_York
- Deployer: Codex through GitHub push to `master` with Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `fc59728ed34318fb72da9e5506a29cd602b9d5e2`
- Build/artifact ID: Railway deployment ID not captured from the local CLI in this pass; live `/api/health` is the source-of-truth runtime proof.
- Migration version before/after: unchanged (`0016_communities`)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes: none
- Backup/rollback target: prior successful Home getting-started checklist deployment `285ce7a8841b2ca921d98692143e7632333b96cf`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `fc59728ed34318fb72da9e5506a29cd602b9d5e2`; `EXPECTED_SOURCE_COMMIT=fc59728ed34318fb72da9e5506a29cd602b9d5e2 npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, Sentry configured, operational controls disabled, seven anonymous private-route checks, and 661 ms duration.
- Rendered UI evidence: local mobile QA covered the new orange first-visit intro, trade/location guest preview, and logged-in Home checklist/FAB spacing at 430x932. Screenshots are outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-intro-430.png`, `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-preview-430.png`, and `C:\Users\zboyt\AppData\Local\Temp\rivt-onboarding-logged-in-430.png`.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `fc59728ed34318fb72da9e5506a29cd602b9d5e2`, migration `0016_communities`, and configured Sentry.
- Known risks: physical/deeper manual accessibility-device matrix and real paid-checkout/webhook entitlement proof remain launch-quality boundaries. Guest preview remains intentionally preview-only; write actions still require real account setup.
- Rollback performed/result: not required
- Approval: Onboarding V2 hybrid accepted as controllable Gate A activation UX hardening evidence; overall Gate A still depends on the remaining manual launch boundaries.

## Current Production - Packet 08 UI Polish Phase 1 Launch Blockers

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-02 15:43 America/New_York
- Deployer: Codex through GitHub push to `master` with Railway production auto-deploy and `SOURCE_COMMIT` metadata update
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `912332eb7daf561fb2e4c60290b3da5b08268885`
- Build/artifact ID: Railway deployment `116da2b7-75b9-4f73-8dbd-e79a1543f7ca`
- Migration version before/after: unchanged (`0016_communities`)
- Feature-flag/config version: `SOURCE_COMMIT` updated to `912332eb7daf561fb2e4c60290b3da5b08268885`; no operational-control flags changed
- Provider/config changes: no provider credentials changed
- Backup/rollback target: prior successful Tools immersive deployment `d134a1118ebb671cde057b9e8e8f0e132eb8d89a`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run test:ui:tools`, `npm audit --omit=dev`, and `git diff --check` passed. The aggregate `npm run test` command was attempted and timed out locally during the integration half.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `912332eb7daf561fb2e4c60290b3da5b08268885`; `EXPECTED_SOURCE_COMMIT=912332eb7daf561fb2e4c60290b3da5b08268885 npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, Sentry configured, operational controls disabled, seven anonymous private-route checks, and 586 ms duration.
- Rendered UI evidence: in-app Browser QA covered guest preview top-bar Search opening one `Search RIVT` dialog, Tools -> `Records & photos` opening `Job Photos`, and Heavy 16th calculator control sizing at 430px and 390px with no horizontal overflow or console warnings/errors.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `912332eb7daf561fb2e4c60290b3da5b08268885`, migration `0016_communities`, and configured Sentry.
- Known risks: server-side Verified Fix authorization remains a follow-up before that mechanic is abuse-resistant; physical/deeper manual accessibility-device matrix, full local aggregate integration completion, and real paid-checkout/webhook entitlement proof remain launch-quality boundaries.
- Rollback performed/result: not required
- Approval: UI polish phase 1 accepted as controllable Gate A launch-blocker UX hardening evidence; overall Gate A still depends on the remaining manual/external launch boundaries.

## Current Production - Packet 08 Soft Launch Polish Checkpoint

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-08 18:44 America/New_York
- Deployer: Codex through GitHub push to `master` with Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `6cd8f5d6b87d057eb836f10bc79efc69a289d106`
- Build/artifact ID: Railway deployment ID not captured from the local CLI in this pass; live `/api/health` is the source-of-truth runtime proof.
- Migration version before/after: unchanged (`0022_community_audiences`)
- Feature-flag/config version: no provider credentials or operational-control flags changed
- Provider/config changes: none
- Backup/rollback target: prior successful Pro proof packet deployment `0391165b6bba1a36aaaafa5c682c2e27637a4422`; no migration change
- Automated gates: local `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check` passed. The aggregate `npm run test` command was attempted and timed out locally during the integration half; run `npm run test:integration` with `TEST_DATABASE_URL` for full DB-backed evidence.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source commit `6cd8f5d6b87d057eb836f10bc79efc69a289d106`; `EXPECTED_SOURCE_COMMIT=6cd8f5d6b87d057eb836f10bc79efc69a289d106 npm run monitor:production` passed externally with PostgreSQL/S3-compatible dependencies healthy, Sentry configured, operational controls disabled, seven anonymous private-route checks, and 622 ms duration.
- Rendered UI evidence: not captured in this pass; this was a small copy/routing/test-maintenance checkpoint.
- Health/readiness result: health reported PostgreSQL and S3-compatible storage healthy with exact source commit `6cd8f5d6b87d057eb836f10bc79efc69a289d106`, migration `0022_community_audiences`, and configured Sentry.
- Known risks: physical-device accessibility checks, full DB-backed integration run with `TEST_DATABASE_URL`, and final real-user soft-launch acceptance remain launch-quality boundaries.
- Rollback performed/result: not required
- Approval: Soft launch polish checkpoint accepted as minor Gate A UX/truthfulness hardening evidence; overall Gate A still depends on the remaining manual/external launch boundaries.

## Current Production - Mature Guest Demo and Nationwide Readiness Boundary

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-09 20:13 America/New_York
- Deployer: Codex through fast-forward push to `master` with Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `39886b12495c4134b09bbb32b6c7d13058f00122`
- Build/artifact ID: Railway deployment ID not captured; exact live `/api/health` source metadata is the runtime proof.
- Migration version before/after: unchanged (`0022_community_audiences`)
- Feature-flag/config version: no provider credentials, rollout flags, or operational controls changed
- Provider/config changes: none
- Backup/rollback target: prior production feature release `159bdac16009a81b5e0e00f286515f0cf2c32404`; no migration change
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit` (46/46), `npm run test:integration` (18/18 against configured PostgreSQL), `npm run test:e2e`, `npm run test:ui:guest-preview`, `npm run test:ui:mobile-actions`, `npm run test:ui:work-lifecycle`, `npm run test:ui:tools`, `npm run test:ui:shop-talk-news`, `npm run launch:readiness -- --require-ready`, `npm run incident:readiness -- --require-ready`, `npm audit --omit=dev`, and `git diff --check` passed.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact feature source `39886b12495c4134b09bbb32b6c7d13058f00122`; `EXPECTED_SOURCE_COMMIT=39886b12495c4134b09bbb32b6c7d13058f00122 npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, Sentry configured, controls disabled, seven anonymous private-route checks, and 519 ms duration.
- Rendered UI evidence: compact local guest-preview screenshots for contractor and subcontractor entry/workspace states are at `C:\Users\zboyt\AppData\Local\Temp\rivt-guest-preview-pass`; production browser QA opened the contractor one-year sample workspace and verified the 27-job, $68,420 invoiced, 186-record, 11-repeat-crew sample metrics plus active-work and messaging context.
- Health/readiness result: Gate A launch and incident readiness checks passed under their existing pilot policy. The separate nationwide audit remains a NO-GO and is not a certification.
- Known risks: nationwide release remains blocked on real geospatial discovery, durable server ownership for critical business records, upload malware scanning/quarantine, complete legal/data-rights execution, reliable notification delivery, and nationwide moderation/support/on-call capacity.
- Rollback performed/result: not required
- Approval: mature guest demo and trust hardening accepted for the current controlled-launch product; nationwide-final release is not approved.

## Current Production - Packet 08 Field Reliability Train

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-10 01:52 America/New_York
- Deployer: Codex through fast-forward push to `master` with Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `504e1db2e5b6fc9db23883ed17a3cb7444a3a66e`
- Build/artifact ID: Railway deployment ID not captured; exact live `/api/health` source metadata is the runtime proof
- Migration version before/after: unchanged (`0022_community_audiences`)
- Feature-flag/config version: no provider credentials, rollout flags, or operational controls changed
- Provider/config changes: none
- Backup/rollback target: prior production source `93569161379c7e237a590337e49b3829d895618b`; no migration change
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit` (46/46), `npm run test:e2e`, `npm run test:ui:guest-preview`, `npm run test:ui:tools`, `npm run test:ui:mobile-actions`, `npm audit --omit=dev`, and `git diff --check` passed. The configured remote database stalled both `npm run test:integration` and a targeted project-completion integration suite without output; this release changes no server route, migration, or database behavior.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source `504e1db2e5b6fc9db23883ed17a3cb7444a3a66e`; `EXPECTED_SOURCE_COMMIT=504e1db2e5b6fc9db23883ed17a3cb7444a3a66e npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, Sentry configured, controls disabled, seven anonymous private-route checks, and 552 ms duration.
- Public-resource evidence: `rivt-social-card.png`, `robots.txt`, and `sitemap.xml` returned HTTP 200; production HTML contained the absolute Open Graph image and URL.
- Rendered UI evidence: guest-preview smoke covered retryable boot 5xx and signed-out 401 behavior; Tools smoke deliberately rejected the first captured job-photo upload, retried the retained capture, and verified it entered the project timeline; mobile-actions smoke remained green.
- Health/readiness result: production is healthy on the exact source with no operational controls active.
- Known risks: physical weak-signal/offline, update-during-form, and retained-camera-retry checks remain to be performed on iOS Safari/PWA and Android Chrome. The remote test database stall remains an infrastructure/test-runner reliability issue, not a claimed integration pass.
- Rollback performed/result: not required
- Approval: field-reliability train accepted as deployed Gate A reliability hardening evidence; broader/nationwide readiness remains subject to the existing separate boundaries.

## Current Production - Packet 08 Exact Notification Destinations

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-10 07:40 America/New_York
- Deployer: Codex through fast-forward push to `master` with Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `e0b4fb518018989fcf8a433af5c528ff52fe7cba`
- Build/artifact ID: Railway deployment ID not captured; exact live `/api/health` source metadata is the runtime proof
- Migration version before/after: unchanged (`0022_community_audiences`)
- Feature-flag/config version: no provider credentials, rollout flags, or operational controls changed
- Provider/config changes: none
- Backup/rollback target: prior production source `c68491919ddb966da9c3026f565cd41be05a7bf1`; no migration change
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit` (46/46), `npm run test:e2e`, `npm run test:ui:work-lifecycle`, `npm audit --omit=dev`, and `git diff --check` passed. The affected `match-acceptance`, `project-completion`, and `reviews-admin-safety` PostgreSQL suites passed individually. The aggregate test wrapper exceeded its local window during the same slow database phase, so aggregate completion is not claimed.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source `e0b4fb518018989fcf8a433af5c528ff52fe7cba`; `EXPECTED_SOURCE_COMMIT=e0b4fb518018989fcf8a433af5c528ff52fe7cba npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, Sentry configured, controls disabled, seven anonymous private-route checks, and 589 ms duration.
- Authenticated evidence: a non-destructive production login and notifications/active-work read passed for the shared testing account. It had no current notification or active-work records, so this check does not claim a live notification click-through. The production match smoke could not run from this checkout because `DATABASE_URL` was absent.
- Rendered UI evidence: `npm run test:ui:work-lifecycle` proves offer notification to exact Work record, cold-start active-work restoration, project notification to exact Records detail, and visible `Job proof packet` content.
- Health/readiness result: production is healthy on the exact source with no operational controls active.
- Known risks: one newly generated application/offer/project/review notification should still be tapped on a physical production phone to close the final live acceptance boundary for exact destinations.
- Rollback performed/result: not required
- Approval: exact-destination and accepted-work workspace coherence accepted as deployed Gate A UX hardening; broader/nationwide readiness remains subject to the existing separate boundaries.

## Current Production - Packet 08 Job-Scoped Tool Context

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-10 14:09 America/New_York
- Deployer: Codex through fast-forward push to `master` with Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `1f9580ca388ed2c6e28864227d58f3787165f110`
- Build/artifact ID: Railway deployment ID not captured; exact live `/api/health` source metadata is the runtime proof.
- Migration version before/after: unchanged (`0022_community_audiences`)
- Feature-flag/config version: no provider credentials, rollout flags, or operational controls changed.
- Provider/config changes: none.
- Backup/rollback target: prior production source `25b7153a507092ca924463a8aa617fdab7ceb330`; no migration change.
- Automated gates: `npm run build`, `npm run lint`, `npm run test:unit` (46/46), `npm run test:e2e`, `npm run test:ui:work-lifecycle`, `npm audit --omit=dev`, and `git diff --check` passed. The current server-query assertion was added to the integration suite but was not run here because `TEST_DATABASE_URL` is absent from this checkout.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source `1f9580ca388ed2c6e28864227d58f3787165f110`; `EXPECTED_SOURCE_COMMIT=1f9580ca388ed2c6e28864227d58f3787165f110 npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, Sentry configured, controls disabled, seven anonymous private-route checks, and 619 ms duration.
- Rendered UI evidence: the rendered Work lifecycle smoke puts an unrelated job first, then opens Invoice and Daily Log by focused active-work route and verifies both retain the accepted job context without horizontal overflow.
- Health/readiness result: production is healthy on the exact source with no operational controls active.
- Known risks: run the affected PostgreSQL integration suite when `TEST_DATABASE_URL` is configured, then use a physical accepted-work account to open Invoice and Daily Log from the job workspace and confirm the accepted job title is visible before entering data.
- Rollback performed/result: not required.
- Approval: job-scoped tool context is deployed Gate A UX hardening; broader/nationwide readiness remains subject to the existing separate boundaries.

## Current Production - Packet 08 Notification Delivery Truthfulness

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-10 18:23 America/New_York
- Deployer: Codex through fast-forward push to `master` with Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `ecbd470ba9fc126eea685121030ad00f5b3b4ad0`
- Build/artifact ID: Railway deployment ID not captured; exact live `/api/health` source metadata is the runtime proof.
- Migration version before/after: unchanged (`0022_community_audiences`)
- Feature-flag/config version: no provider credentials, rollout flags, or operational controls changed.
- Provider/config changes: none. A secret-safe Railway check found Resend configured and Twilio/VAPID unconfigured.
- Backup/rollback target: prior production source `d45dbfb5d6c74b185cd410f862dc426701e1a0d8`; no migration change.
- Automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test:unit` (46/46), `npm run test:e2e`, `npm run test:ui:mobile-actions`, `npm audit --omit=dev`, and `git diff --check` passed. The aggregate `npm run test` entered the integration phase and stalled without output; `TEST_DATABASE_URL` was absent and no database-backed pass is claimed.
- Post-deploy smoke tests: `https://rivt.pro/api/health` returned exact source `ecbd470ba9fc126eea685121030ad00f5b3b4ad0`; `EXPECTED_SOURCE_COMMIT=ecbd470ba9fc126eea685121030ad00f5b3b4ad0 npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, Sentry configured, controls disabled, seven anonymous private-route checks, and 649 ms duration.
- Rendered UI evidence: mobile Settings smoke verifies the `In-app alert preferences` heading, the background-delivery boundary copy, absence of an `Enable notifications` control, and no horizontal overflow.
- Health/readiness result: production is healthy on the exact source with no operational controls active.
- Known risks: Web Push and general-alert SMS are not implemented. Twilio remains invoice-SMS-only in source and unconfigured in production.
- Rollback performed/result: not required.
- Approval: notification truthfulness accepted as deployed Gate A hardening; background delivery remains reviewed Gate B/provider work.

## Current Production - Packet 09 Gate B Web Push

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-10 19:29 America/New_York
- Deployer: Codex through fast-forward push to `master`, Railway source deployment, secret-safe VAPID configuration, and a clean Railway redeploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `535e21bf1c2b76c7547b9c5ac5dc9ef54b8d5b79`
- Railway deployment ID: `1af25317-a227-4e7a-ad8f-abdffcaeaa9f`
- Migration version before/after: `0022_community_audiences` -> `0024_push_subscription_sessions`
- Provider/config changes: generated one VAPID key pair in memory; stored public/private keys and `mailto:support@rivt.pro` subject in Railway. No key value was printed or committed. Twilio scope did not change.
- Rollback target: source `623034859f0e1babacbb530695ca12c4296f5c3d`; remove VAPID variables to stop queueing/worker delivery, then roll back application source. Roll back migration 0024 before 0023 only if subscription/outbox deletion is accepted.
- Automated gates: build, full lint, security lint, 49/49 unit tests, E2E, mobile Settings QA, zero-vulnerability dependency audit, diff checks, dedicated PostgreSQL push integration, migration lifecycle, and match acceptance passed. The aggregate PostgreSQL run completed 17/19 before two fixture/mapper failures; both were fixed and their affected suites passed individually.
- Post-deploy proof: live `/api/health` returned exact source, migration 0024, PostgreSQL/S3 health, configured Sentry, and configured Web Push. `EXPECTED_SOURCE_COMMIT=535e21bf1c2b76c7547b9c5ac5dc9ef54b8d5b79 npm run monitor:production` passed with controls off and seven anonymous private-route checks in 591 ms.
- Physical-device proof: on 2026-07-10, the founder enabled device alerts on a physical phone, received the test alert in the phone notification tray outside RIVT, and tapped it to return to RIVT. The observed white-square Android status icon is addressed by a follow-up monochrome transparent badge asset; it did not affect delivery or routing.
- Known boundary: logout/revocation exclusion is integration-proven through session-bound deletion but was not reproduced as a second physical delivery attempt. Operator outbox metrics remain follow-up work before broad fan-out.
- Approval: production delivery and click-through accepted for Packet 09; broad push fan-out remains gated on operator outbox monitoring.

## Current Production - Packet 10 Gate B Matching Job Alerts

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-10 21:30 America/New_York
- Deployer: Codex through verified branch push, fast-forward merge to `master`, Railway source deployment, and explicit non-secret rollout configuration
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `43a1fa5eb9528a1fc06a0bea95da81122448c990`
- Railway deployment ID: `79bc9d5c-d20b-4c30-9b1a-955225d77876`
- Migration version before/after: unchanged (`0024_push_subscription_sessions`)
- Provider/config changes: `MATCHING_JOB_ALERTS_ENABLED=true`; `MATCHING_JOB_ALERT_LIMIT=200`. No secret, Web Push key, email, SMS, auth, billing, storage, or moderation configuration changed.
- Rollback target: source `64ac4534b41ba7a5e001ad44fdf93e724f3cfb64`; set `MATCHING_JOB_ALERTS_ENABLED=false` first to stop new fan-out without disabling Work or Web Push.
- Automated gates: build, lint, security lint, 50/50 unit tests, E2E, mobile-action smoke, zero-vulnerability dependency audit, diff checks, focused jobs + Web Push PostgreSQL integration, and the complete aggregate `npm run test` with 19/19 integration assertions passed.
- Performance evidence: an initial recipient-by-recipient implementation took about 64.7 seconds to publish against remote PostgreSQL and was rejected. The deployed bulk notification/outbox implementation reduced the same integration publish path to about 3.6 seconds.
- Post-deploy proof: live `/api/health` returned exact source and reported matching alerts enabled, a 200-recipient cap, and `trade_and_exact_public_service_area`. `EXPECTED_SOURCE_COMMIT=43a1fa5eb9528a1fc06a0bea95da81122448c990 EXPECT_MATCHING_JOB_ALERTS_ENABLED=true npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, Sentry and Web Push configured, controls disabled, seven anonymous private-route checks, and 541 ms duration.
- Privacy/authorization evidence: tests prove wrong-trade, wrong-city, blocked, opted-out, and poster accounts are excluded; payloads contain public job title/trade/city only and omit private address/access data; replay does not duplicate delivery.
- Known boundary: no fake production job was created for evidence. The next controlled legitimate Jacksonville publish must confirm receipt by one eligible physical device, exclusion behavior, and exact-job tap-through before Packet 10 is field-verified.
- Approval: code, database behavior, rollout controls, and production configuration accepted; field verification remains pending.

## Current Production - Packet 15 Standalone Tool Context

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-11 11:46 America/New_York
- Deployer: Codex through verified feature-branch push, fast-forward merge to `master`, and Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Source commit: `1b38d144f83db07a305348e5e633256c666f55c2`
- Migration version before/after: `0025_project_financial_records` -> `0026_standalone_projects`
- Provider/config changes: none; no auth, billing, storage-provider, Web Push, email, SMS, moderation, or rollout configuration changed.
- Rollback target: source `f4e14820b8170fda775d5d062cca1079c420c09c`; apply `migrations/0026_standalone_projects.down.sql` only after confirming deletion of standalone-project links is acceptable.
- Automated gates: build, lint, security lint, 53/53 unit tests, E2E, mobile-actions UI, Tools UI at desktop/mobile/SE widths, zero-vulnerability dependency audit, diff checks, and the complete PostgreSQL run with 19/19 integration suites passed.
- Post-deploy proof: live `/api/health` returned exact source `1b38d144f83db07a305348e5e633256c666f55c2` and ready migration `0026_standalone_projects`; `EXPECTED_SOURCE_COMMIT=1b38d144f83db07a305348e5e633256c666f55c2 npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, configured Sentry and Web Push, matching alerts enabled, controls disabled, seven anonymous private-route checks, and a 592 ms duration.
- Authorization evidence: integration coverage proves another account cannot list or modify a standalone project, attach records to it, or create an album for it; a record referencing both standalone and accepted-work context is rejected.
- Known boundary: switch Quick use -> standalone project -> accepted RIVT work on a physical phone, then capture one real photo and confirm it persists only in the selected destination.
- Approval: Packet 15 runtime, migration, authorization, and rendered-device gates are production verified; physical field acceptance remains open.

## Current Production - Packet 15 Mobile Experience Train

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-11 14:34 America/New_York
- Deployer: Codex through verified feature-branch push, fast-forward merge to `master`, and Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Runtime feature source: `aaf3a8701b4dceb084bdaf007a04ea2bcba74385`
- Migration version before/after: unchanged (`0026_standalone_projects`)
- Provider/config changes: none; no auth, billing, storage, Web Push, email, SMS, moderation, migration, or rollout configuration changed.
- Rollback target: source `0df8397264f3d0c739d22ccae182a33570c9f898`; no database rollback is required.
- Automated gates: build, full lint, security lint, 53/53 unit tests, E2E, mobile-actions, Tools at desktop/mobile/SE, Work lifecycle, Shop Talk/Trade News, both guest-role previews, dependency audit with zero vulnerabilities, diff checks, and the complete PostgreSQL run with 19/19 integration tests passed.
- Rendered evidence: screenshots under `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`, `rivt-tools-pass`, `rivt-work-lifecycle-pass`, `rivt-shop-talk-news-pass`, and `rivt-guest-preview-pass` cover 320px and 390px mobile behavior plus desktop tool rendering.
- Post-deploy proof: `/api/health` returned exact source `aaf3a8701b4dceb084bdaf007a04ea2bcba74385`, ready migration `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured Sentry and Web Push, and enabled matching-job alerts. `EXPECTED_SOURCE_COMMIT=aaf3a8701b4dceb084bdaf007a04ea2bcba74385 npm run monitor:production` passed with controls off, seven anonymous private-route checks, and a 752 ms duration.
- Known boundary: physically review Settings section navigation, Shop Talk feed/discovery order, returning-user provider labels, and Work selectors on iOS and Android.
- Approval: Mobile Experience Train runtime and automated/rendered gates are production verified; physical field acceptance remains open.

## Current Production - Packet 36 Shop Talk Reliability

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-13 America/New_York
- Deployer: Codex through a fast-forward merge to `master` and Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Runtime feature source: `845761451038215d855cced6080f3be7e4a84394`
- Migration version before/after: unchanged (`0026_standalone_projects`)
- Provider/config changes: none; existing Sentry, Web Push, PostgreSQL, and S3-compatible storage configuration was preserved.
- Rollback target: `9d7a6cd80c9e46405b356902c6ac610a60a9a80e`; no migration rollback is required.
- Automated gates: build, lint, security lint, 53/53 unit tests, E2E, mobile-actions UI, dependency audit with zero production vulnerabilities, and diff checks passed. Focused PostgreSQL integration passed exact-post retrieval, community audience denial, and author-earned reputation. The full integration wrapper exceeded the local 15-minute runner limit without a failing assertion; aggregate completion is not claimed.
- Post-deploy proof: live `/api/health` returned exact source `845761451038215d855cced6080f3be7e4a84394`; the expected-source synthetic monitor passed with PostgreSQL/S3-compatible dependencies healthy, Sentry and Web Push configured, matching job alerts enabled, operational controls disabled, seven anonymous private-route checks, and a 619 ms duration.
- Known boundary: tap a physical notification for a Shop Talk post outside the newest feed page, then log out and back in on a subscribed browser and confirm the next push arrives without visiting Settings.
- Rollback performed/result: not required.
- Approval: deployed Gate B Shop Talk reliability hardening; physical notification acceptance remains open.

## Current Production - Packet 40 Camera Private Album Destinations

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-14 America/New_York
- Deployer: Codex through a verified feature-branch push, fast-forward merge to
  `master`, and Railway production auto-deploy.
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Runtime feature source: `c366a69facf764cc36f226014bd3a83da46996c8`
- Migration version before/after: `0026_standalone_projects` ->
  `0027_default_private_photo_album`
- Provider/config changes: none; existing S3-compatible storage, PostgreSQL,
  Sentry, Web Push, billing, and auth configuration were preserved.
- Rollback target: `c65fb9cebfcc1bf2d94bc00cbdb9493209057072`; applying the
  down migration requires confirming that removal of the default-album marker
  is acceptable. Existing photo albums and photos are not deleted.
- Automated gates: build, lint, security lint, 53/53 unit tests, E2E, Tools UI,
  mobile-actions UI, Work lifecycle UI, dependency audit with zero production
  vulnerabilities, and diff checks passed. Integration assertions for the new
  endpoint are present but skipped here because `TEST_DATABASE_URL` was not
  configured in the isolated worktree.
- Post-deploy proof: live `/api/health` returned exact source and ready
  migration `0027_default_private_photo_album`.
  `EXPECTED_SOURCE_COMMIT=c366a69facf764cc36f226014bd3a83da46996c8 npm run
  monitor:production` passed with PostgreSQL/S3-compatible storage healthy,
  Sentry and Web Push configured, matching-job alerts enabled, controls off,
  seven anonymous private-route checks, and a 611 ms duration.
- Product evidence: Camera defaults to the account-owned `Private photos`
  album; the same destination sheet allows selecting and creating additional
  private albums, standalone projects, and accepted RIVT work.
- Known boundary: execute default-album idempotency/account-isolation coverage
  against a disposable PostgreSQL test database and perform a physical capture
  into both the default and a newly created private album.
- Approval: deployed with server-owned account scoping and production migration
  readiness verified; database test-environment evidence remains pending.

## Current Production - Packet 38 Work and People Navigation

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-13 America/New_York
- Deployer: Codex through a verified feature-branch push, fast-forward merge to `master`, and Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Runtime feature source: `1e7141c13170d623e49996a48a74310ace5bfe0f`
- Migration version before/after: unchanged (`0026_standalone_projects`)
- Provider/config changes: none; auth, billing, records, storage, Sentry, Web Push, moderation, and rollout configuration were preserved.
- Rollback target: `aa3897076f0a19907e9d29f2496f59407df39148`; no database rollback is required.
- Automated gates: build, lint, 53/53 unit tests, E2E, mobile-actions UI smoke, dependency audit with zero production vulnerabilities, and diff checks passed. The aggregate test command entered integration with three safe non-database assertions passing and 16 PostgreSQL suites skipped because this clean worktree did not have `TEST_DATABASE_URL`; no database integration pass is claimed for this navigation-only packet.
- Post-deploy proof: live `/api/health` returned exact source `1e7141c13170d623e49996a48a74310ace5bfe0f`, ready migration `0026_standalone_projects`, PostgreSQL/S3-compatible storage, configured Sentry and Web Push, and enabled matching-job alerts. `EXPECTED_SOURCE_COMMIT=1e7141c13170d623e49996a48a74310ace5bfe0f npm run monitor:production` passed with controls off, seven anonymous private-route checks, and a 553 ms duration.
- Product evidence: Work exposes an explicit Jobs/People switch; People retains people, subs, clients, reviews, and invite planning; legacy Crew/network paths resolve to People beneath Work.
- Known boundary: physical iPhone and Android confirmation of Work -> People switching and legacy `/app/crew` route behavior is still needed.
- Approval: runtime and automated navigation checks are production verified; field acceptance remains open.

## Current Production - Packet 43 Tools Truth and Containment

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-15 00:34 America/New_York
- Deployer: Codex through a verified feature-branch push, fast-forward merge
  to `master`, and Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Runtime feature source: `a068728d98d74c73e925144050e076c756ee53b2`
- Railway deployment ID: `f343cb7b-ac98-4403-a348-5a1d7bf4feb5`
- Migration version before/after: unchanged
  (`0027_default_private_photo_album`)
- Provider/config changes: none; auth, billing, PostgreSQL, object storage,
  Sentry, Web Push, email, moderation, and rollout configuration were
  preserved.
- Rollback target: `edcc98e623d01c0fb9d841d18cd754b4b4cd763a`; no database rollback
  is required.
- Automated gates: build, lint, security lint, 55/55 unit tests, E2E,
  desktop/mobile/compact Tools UI, mobile-action UI, dependency audit with
  zero vulnerabilities, diff checks, and the complete PostgreSQL run with
  19/19 integration suites passed.
- Rendered evidence: Tools screenshots under
  `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass` cover desktop, 390px
  mobile, and 320px compact-phone layouts. A first action run exposed a
  Calculator browser-Back route/UI mismatch; the corrected rerun passed.
- Post-deploy proof: live `/api/health` returned exact feature source, ready
  migration `0027_default_private_photo_album`, PostgreSQL/S3-compatible
  storage, configured Sentry and Web Push, and enabled bounded matching-job
  alerts. `EXPECTED_SOURCE_COMMIT=a068728d98d74c73e925144050e076c756ee53b2 npm run
  monitor:production` passed with controls off and seven anonymous
  private-route checks.
- Product boundary: Earnings, Bid Builder, Tax Estimator, Contracts, Job
  Checklist, and Daily Report now fail safely to the Tools hub from stale URLs,
  notifications, and internal transitions. Their records and implementation
  remain intact for reviewed consolidation.
- Accuracy evidence: Mileage and Tax Summary use date-aware published business
  rates for 2024, 2025, and both 2026 periods; unsupported dates are excluded
  and disclosed instead of guessed.
- Known boundary: complete physical iOS/Android acceptance of the reduced
  catalog, then consolidate Price Book into Materials in a separate packet.
- Approval: Packet 43 runtime, rendered-device gates, data preservation, and
  production health are verified.

## Current Production - Packet 47 Jobsite Tools Consolidation

- Environment: Production (`https://rivt.pro`)
- Date/time/timezone: 2026-07-15 America/New_York
- Deployer: Codex through a verified feature-branch push and fast-forward push
  to `master`; Railway production auto-deploy
- Source repository/branch: `Zboytjbxp/rivt`, `master`
- Runtime feature source: `82b243e6bdbb28ffe4ec3d28c4253c044a1d6f22`
- Migration version before/after: unchanged
  (`0027_default_private_photo_album`)
- Provider/config changes: none; auth, billing, PostgreSQL, object storage,
  Sentry, Web Push, email, moderation, and rollout configuration were preserved.
- Rollback target: `97fe5ce9f4c07d02e169655271fcd81ce32d3e2e`; no database rollback is required.
- Automated gates: build, lint, security lint, 55/55 unit tests, E2E,
  desktop/mobile/compact Tools UI, mobile-action UI, accepted-work lifecycle UI,
  dependency audit with zero production vulnerabilities, diff checks, and all
  19 freshly reset PostgreSQL integration suites passed. The aggregate `npm
  test` wrapper later exceeded a two-minute command window while re-running the
  already-passed integration component; no additional failure was observed.
- Post-deploy proof: live `/api/health` returned the exact feature source, ready
  migration 0027, PostgreSQL/S3-compatible storage, configured Sentry and Web
  Push, and enabled bounded matching-job alerts. The expected-source production
  monitor passed with controls off, seven anonymous private-route checks, and a
  593 ms duration.
- Product evidence: one Jobsite launcher now owns Log, Punch, and Safety;
  legacy tool URLs select the matching section while existing record stores,
  synchronization paths, and forms remain unchanged.
- Known boundary: physically confirm existing Daily Log, Punch, and Safety
  records survive section changes and reopening Jobsite on iOS and Android.
- Approval: Packet 47 runtime, automated records safeguards, rendered-device
  gates, and production health are verified; field acceptance remains open.
