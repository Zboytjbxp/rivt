# Packet 08 — Gate A Hardening and Pilot Release

## Objective

Prove the complete invitation-only pilot against production-like and live infrastructure. Add no new product scope.

Requirements: all Gate A IDs, especially GA-OPS-001 through GA-OPS-008.

## Required Work

1. Close remaining traceability gaps or explicitly reject launch.
2. Reach zero lint errors; all automated test commands pass.
3. Security review: auth, sessions, authorization, uploads, privacy/address, rate limits, CSRF/CORS, dependencies, secrets, admin.
4. Run two-account critical journeys and abuse/state matrix.
5. Complete accessibility/device/network testing and fix blockers.
6. Rehearse migrations, rollback, backup restore, provider outage, auth incident, failed upload, and unsafe-condition escalation.
7. Add deployment ledger/build ID and prove live source revision.
8. Confirm production contains no user-facing seed/demo records.
9. Confirm support hours/owners, pilot users, legal decisions, monitoring/alerts, spend limits, kill switches, and communications.
10. Deploy internal cohort, then named design partners only after signed approval.

## Acceptance

- `docs/quality/ACCEPTANCE.md` evidence is complete.
- Every Gate A traceability row is production-verified or has written launch rejection.
- Live build and migration version match approved source.
- Restore and rollback are timed and successful.
- No critical/high unaccepted security or dependency finding.
- Pilot can be disabled without losing records.

## Stop Condition

Stop after Gate A approval and named-cohort release. Observe and document pilot behavior before beginning Gate B.
