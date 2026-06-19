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

## Current Production

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
