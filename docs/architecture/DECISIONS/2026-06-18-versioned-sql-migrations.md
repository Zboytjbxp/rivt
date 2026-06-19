# Versioned SQL Migrations

Status: accepted  
Owner: RIVT engineering  
Review date: before Packet 03

## Context

The server currently creates and alters tables at runtime inside request-path readiness. Production has no durable migration ledger, checksum verification, advisory lock, or repeatable rollback evidence. Gate A requires exact schema provenance and safe deploy behavior.

## Decision

RIVT will use a small SQL-first migration runner owned in the repository.

- Files use `NNNN_name.up.sql` and optional `NNNN_name.down.sql` naming.
- `schema_migrations` records version, name, SHA-256 checksum, duration, and applied time.
- One PostgreSQL advisory lock serializes migration activity.
- Each migration runs in its own transaction.
- An applied checksum mismatch fails startup/readiness; edited history is never silently accepted.
- Application startup applies pending forward migrations before listening.
- Rollback is explicit through the migration CLI and is never automatic during application startup.
- The legacy baseline is intentionally irreversible. Later additive migrations must provide tested down files until Gate A schema stabilizes.
- Readiness reports applied and pending migration versions without exposing credentials or SQL.

## Alternatives

- Continue runtime `CREATE/ALTER`: rejected because drift and partial failure cannot be audited.
- Adopt an ORM and regenerate the application model now: rejected because it would expand Packet 01 into a high-risk rewrite.
- Add a third-party migration framework: reasonable later, but unnecessary for the current SQL-only requirements and would add another abstraction during the legacy transition.

## Impact

- Deploys fail closed when migrations fail or history is tampered with.
- SQL remains reviewable and portable across local, CI, and Railway PostgreSQL.
- CI must test clean apply, idempotent re-run, checksum failure, latest rollback, and re-apply.
- Production rollback still requires application/schema compatibility review; a down file is not permission to discard user data.

## Reversal

The ledger and file convention can be imported into a mature migration tool later. Existing migration versions and checksums remain immutable.
