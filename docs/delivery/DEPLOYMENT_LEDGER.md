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
