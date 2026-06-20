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
- Known risks: full Gate A remains blocked by timed isolated restore drill, external monitoring/alerts and incident routing, durable/distributed rate limits, manual accessibility/device matrix, support/legal/founder signoff, and final legacy app-state bridge disposition
- Rollback performed/result: not required
- Approval: Packet 08 hardening audit slice accepted; overall Gate A not approved
