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

## Provider Outage

1. Identify provider, affected capability, first failure, and user impact.
2. Disable only the affected feature where possible.
3. Preserve queued work and expose truthful queued/failed state.
4. Use fallback channel only when consent and security allow it.
5. Reconcile delayed/duplicate callbacks after recovery.
