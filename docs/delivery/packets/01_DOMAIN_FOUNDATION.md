# Packet 01 — Domain Foundation

## Objective

Introduce versioned migrations, canonical ownership, account/profile foundations, and domain conventions without migrating every feature at once.

Requirements: GA-FND-002, GA-FND-003, GA-FND-006, GA-FND-007, GA-PRO-003.

## Required Work

1. Select/add a migration runner and migration ledger; stop expanding runtime schema creation.
2. Inventory/classify live `app_state`, auth, event, and upload rows before migration.
3. Design/review initial account, identity, session, organization, profile, trade taxonomy, consent, audit, and idempotency tables.
4. Migrate existing real auth users safely without creating public profiles from test/guest rows.
5. Add typed `/api/v1` conventions, validation, error shape, request IDs, actor context, pagination primitives, and transaction helpers.
6. Add ownership/authorization policy tests and migration apply/rollback tests.
7. Keep legacy `app_state` readable only where needed; no indefinite dual-write.

## Acceptance

- Clean database and representative legacy snapshot migrate successfully.
- Rerunning migrations is safe and migration status appears in readiness.
- Authenticated actor and account state are available to every new domain route.
- Cross-user/organization policy tests fail closed.
- Synthetic fixtures only; production seed protection exists.

## Stop Condition

Do not implement jobs or messages. Hand off reviewed schema decisions and next migration boundary.

## Implementation Evidence

- Production inventory: `01_PRODUCTION_INVENTORY.md`
- ADRs: `2026-06-18-versioned-sql-migrations.md` and `2026-06-18-legacy-quarantine-account-bridge.md`
- Migrations: `0001_legacy_baseline.up.sql`, `0002_domain_foundation.up.sql`, and tested down migration
- Runtime: `server/migrations.js`, `server/api.js`, `server/authorization.js`
- Tests: API/authorization unit tests plus disposable-Postgres migration and account-boundary integration tests
- CI: GitHub Actions 27803255310 and 27803349568 passed
- Release backup: encrypted, cloud-only snapshot round-trip verified before deployment

Production deployment and smoke evidence remain required before Packet 01 acceptance.
