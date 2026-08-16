# Gate A Operations Runbooks

These are minimum pilot procedures. Add provider-specific commands and owners before launch.

For controlled Gate B engagement operations, including community moderation, device alerts, matching-job privacy, and exact active-work record recovery, use [GATE_B_CONTROLLED_ENGAGEMENT.md](GATE_B_CONTROLLED_ENGAGEMENT.md).

For suspected production-secret exposure, stop secret-enumerating commands and
use [CREDENTIAL_ROTATION_RUNBOOK.md](CREDENTIAL_ROTATION_RUNBOOK.md). The
credential runbook requires exact environment confirmation, recovery
preservation, one-provider-at-a-time verification, and old-credential
revocation without recording secret values.

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

Every workflow run uploads `production-monitor.log` as evidence. If the monitor fails, GitHub Actions opens or updates one incident issue titled `Production synthetic check failing` with the workflow run, commit, triage checklist, and latest monitor output. When the synthetic check recovers, the workflow comments on that issue and closes it.

This scheduled synthetic check and GitHub issue loop are first external tripwires. They do not replace a dedicated error-monitoring provider, paging policy, or named incident owner.

## Incident Readiness Gate

Incident ownership and alert routing are tracked in `docs/operations/incident-routing.json`. Run:

```text
npm run incident:readiness -- --json
```

Before named-cohort launch, the strict gate must pass:

```text
npm run incident:readiness -- --require-ready
```

The gate requires:

- Approved incident-routing status.
- Primary and backup incident owners with real names and emails.
- Founder-approved support coverage hours.
- External synthetic monitoring.
- Dedicated error monitoring.
- Paging/escalation route.
- A passed incident rehearsal within the last 30 days.
- Founder, support, and legal/safety approvals.

Current state: primary and backup owners, support hours, synthetic monitoring,
dedicated error monitoring, paging, a current passed rehearsal, and the required
incident-routing approvals are recorded. The separate production-credential
incident and its explicit `ACTIVE_LAUNCH_HOLD` remain open, so these routing
prerequisites do not authorize launch.

## Launch Readiness Gate

Launch readiness combines incident routing with the approved recovery policy. Run:

```text
npm run launch:readiness -- --json
```

Before named-cohort launch, the strict gate must pass:

```text
npm run launch:readiness -- --require-ready
```

The gate requires everything from incident readiness plus:

- Approved RPO target in minutes and basis.
- Approved RTO target in minutes and basis.
- Backup retention window and owner.
- Restore-drill cadence, owner, and next due date.
- A passed named backup-artifact restore from the last 30 days.
- Founder and operations approvals for the recovery policy.
- `operationalReadiness.postgresqlLogicalRecovery` is `passed`.
- `operationalReadiness.recurringBackup` is active.
- `operationalReadiness.backupFreshnessMonitor` is active.
- `operationalReadiness.applicationObjectByteRecovery` is `passed`.
- A current `operationalApproval` records who approved this complete recovery
  posture and when.

Current state: policy targets, retention, cadence, policy approvals, and a fresh
PostgreSQL logical restore are recorded. Operational readiness is still
`blocked`: recurring backup and independent backup-freshness monitoring are
inactive, application-object-byte recovery is missing, and current operational
approval is pending. The explicit launch hold is also active. The approved RPO
and RTO are targets for PostgreSQL logical records, not a complete-service
recovery guarantee.

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

The 2026-08-16 drill completed the PostgreSQL logical portion only: one
active-key-only artifact restored 109 tables and 8,862 rows with zero
count/content diffs in 53.956 seconds. It did not restore application photos,
documents, or other object bytes and therefore does not satisfy the complete
drill described in steps 1-2.

Follow `docs/operations/PRODUCTION_BACKUP_RUNBOOK.md`. Gate A requires proof
that a named, immutable backup object can be restored; a direct database copy
does not satisfy that requirement.

Create the encrypted logical backup artifact through the dedicated read-only
backup role and independent protected destination:

```text
npm run backup:logical-artifact
```

The command requires `BACKUP_DATABASE_URL`, strict TLS verification with a CA,
a dedicated read-only PostgreSQL role, a 32-byte backup encryption key, a full
source commit, and a protected versioned destination. It fails closed if those
controls or the object-retention contract cannot be verified.

Verify the newest retained artifact without writing to the source or backup
destination:

```text
npm run backup:verify
```

The verifier selects the newest eligible artifact, verifies its exact object
version and retention, recomputes its digest, authenticates and decrypts it,
and checks freshness and source binding. It does not create launch evidence by
itself.

Restore that named artifact into a freshly provisioned isolated target:

```text
CONFIRM_RESTORE_TARGET_ISOLATED=true RESTORE_DATABASE_URL="postgresql://restore-target" RESTORE_SOURCE_DATABASE_URL="postgresql://source" RESTORE_BACKUP_S3_KEY="<exact-object-key>" RESTORE_BACKUP_S3_VERSION_ID="<exact-version-id>" RESTORE_BACKUP_SHA256="<exact-sha256>" npm run restore:drill -- --apply-migrations
```

The drill refuses to run without explicit isolation confirmation, proves the
source and target database identities differ, restores only the exact selected
object version and digest, checks schema/content/sequence parity, and enforces
the configured RTO. Never persist restore credentials or confirmation on the
normal application service.

## Provider Outage

1. Identify provider, affected capability, first failure, and user impact.
2. Disable only the affected feature where possible.
3. Preserve queued work and expose truthful queued/failed state.
4. Use fallback channel only when consent and security allow it.
5. Reconcile delayed/duplicate callbacks after recovery.
