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
- Observed: 2026-06-18 America/New_York
- Source commit: Unknown from running service
- Health: 200, PostgreSQL/S3-compatible storage healthy
- Migration version: Not exposed
- Build ID: Not exposed
- Provider state: Google configured; Facebook/Apple setup required
- Record counts: 114 app-state, 53 events, 1 upload at observation
- Approval state: Not Gate A approved
