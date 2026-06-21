# Gate A Operations Runbooks

These are minimum pilot procedures. Add provider-specific commands and owners before launch.

## Deployment Verification

1. Record branch, commit, artifact/build ID, migration version, and environment.
2. Run build, lint, automated tests, dependency/secret checks.
3. Apply reviewed migrations with backup/rollback ready.
4. Deploy the immutable artifact.
5. Verify `/api/health`, readiness, build ID, and migration status.
6. Execute authenticated contractor and tradesperson smoke journeys.
7. Verify private cross-user access is denied.
8. Record evidence and rollback target in the deployment ledger.

Packet 08 adds a reusable live hardening check:

```text
railway ssh --service RIVT --environment production npm run smoke:gate-a:live
```

Set `EXPECTED_SOURCE_COMMIT` only when intentionally checking an exact source SHA. A passing hardening check does not replace the timed restore drill, external monitoring, or manual device/accessibility evidence.

## Production Synthetic Monitoring

GitHub Actions runs `Production Synthetic Check` every 30 minutes and can also be triggered manually. It executes:

```text
npm run monitor:production
```

The check runs outside Railway and verifies:

- `https://rivt.pro/api/health` returns `ok=true`, managed PostgreSQL, S3-compatible storage, and a deployed source commit.
- `/api/auth/providers` reports invite-gated email/password auth and operational-control state.
- Anonymous requests to private routes still return `401`.

If `EXPECTED_SOURCE_COMMIT` is set, the monitor also requires production to match that exact source. If the platform is intentionally locked during an incident or maintenance window, set `ALLOW_OPERATIONAL_LOCKOUT=true` for that monitor run and record the reason in incident notes.

This scheduled synthetic check is a first external tripwire. It does not replace a dedicated error-monitoring provider, paging policy, or named incident owner.

## Operational Kill Switches

Use these only during a real incident, launch pause, or controlled maintenance window:

- `RIVT_SIGNUPS_DISABLED=true` or `SIGNUPS_DISABLED=true` blocks new signups.
- `RIVT_MUTATIONS_DISABLED=true` or `PLATFORM_MUTATIONS_DISABLED=true` blocks regular platform mutations.
- `RIVT_CONTROL_REASON="short operator-facing reason"` explains the control state in authenticated readiness/provider status.

Support and admin routes remain available during platform mutation lockout so users can appeal/get help and staff can operate the incident. Record every enable/disable action in the deployment ledger or incident notes.

## Durable Rate Limits

Gate A auth, write, and upload throttles use the PostgreSQL `rate_limit_windows` table introduced in migration `0009_durable_rate_limits`.

- Subjects are hashed before storage; do not add raw IPs, emails, or account names to this table.
- Auth limits default to `AUTH_RATE_LIMIT` per 15 minutes.
- Write limits default to `WRITE_RATE_LIMIT` per minute.
- Upload limits default to `UPLOAD_RATE_LIMIT` per hour.
- Threshold changes are production config changes and must be recorded in the deployment ledger.
- A sudden spike in this table is an operational signal; correlate with structured request logs and provider alerts once monitoring is wired.

## Authentication Incident

1. Disable affected provider or new login through kill switch if exploitation/data exposure is plausible.
2. Preserve logs and session/account audit evidence.
3. Revoke affected sessions and rotate provider credentials if needed.
4. Communicate through verified channels without sending login links from an untrusted domain.
5. Restore only after fail-closed tests pass.

## Failed Upload

1. Confirm metadata row, object presence, ownership, provider status, and request ID.
2. Never expose another user's signed URL during diagnosis.
3. Retry idempotently or allow the user to retry the individual file.
4. Quarantine mismatched/orphaned objects for reviewed repair; do not delete blindly.

## Missing or Incorrect Job State

1. Inspect canonical status events and idempotency record.
2. Compare authorized actor, application, offer, participant, and current job state.
3. Use a dry-run repair with reason and audit; never edit the database ad hoc as normal support.
4. Notify affected participants if their workflow changed.

## Unsafe Condition / Incident

1. Tell users RIVT is not emergency service; immediate danger uses local emergency services.
2. Preserve the report and restrict access.
3. Pause relevant work action without assigning fault.
4. Escalate to named safety/legal/support owner.
5. Record every internal access and decision.

## Backup Restore Drill

1. Restore PostgreSQL and representative private objects into isolated nonproduction.
2. Verify users, jobs, relationships, messages, project records, and object access.
3. Measure recovery time and recovery point.
4. Record missing records, configuration, and repair actions.
5. A successful backup job without restore proof does not close the requirement.

Current blocker: the local workstation used for Packet 08 does not have `docker`, `psql`, or `pg_dump`, so the timed restore drill is not complete. Do not approve Gate A until a real isolated target is provisioned and the restore is timed.

## Provider Outage

1. Identify provider, affected capability, first failure, and user impact.
2. Disable only the affected feature where possible.
3. Preserve queued work and expose truthful queued/failed state.
4. Use fallback channel only when consent and security allow it.
5. Reconcile delayed/duplicate callbacks after recovery.
