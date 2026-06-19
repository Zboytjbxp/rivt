# Architecture and Product Decisions

Use one file per material decision: `YYYY-MM-DD-short-title.md`.

Each record contains:

- Status: proposed, accepted, superseded, rejected.
- Context and user problem.
- Decision.
- Alternatives considered.
- Safety, privacy, security, accessibility, cost, migration, and operations impact.
- Release gate and requirements affected.
- Reversal/exit strategy.
- Owner and review date.

Required early decisions include migration runner, API validation/test stack, session design, organization identity model, email provider, SMS deferral, profile indexing, review policy, and pilot retention.

Accepted decisions:

- `2026-06-18-versioned-sql-migrations.md`
- `2026-06-18-legacy-quarantine-account-bridge.md`
