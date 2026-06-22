# Deployment Ledger

Add one entry per staging/production deployment.

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
- Health/readiness result: health reports PostgreSQL and S3-compatible storage healthy with exact source commit `6d8e276e036553c5f861f1f8ab97cc3333a3494b`; dedicated error monitoring is configured
- Known risks: full Gate A remains blocked by support hours, incident rehearsal, RPO/RTO policy approval, backup retention/cadence approval, support/legal/founder signoff, and physical/deeper manual accessibility-device evidence. Sentry alerting is accepted as the first pilot escalation route; dedicated phone/SMS paging should be added before broader scale.
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
