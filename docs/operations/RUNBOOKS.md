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

After the current candidate is reviewed, merged, and deployed, every workflow run will upload `production-monitor-summary.json` as evidence. That file contains only validated, allowlisted monitor metadata; production response bodies and raw error or stack output will not be written to workflow artifacts. On failure, GitHub Actions will open or update the marker-owned incident issue titled `Production synthetic check failing` with the workflow run, commit, triage checklist, and the same allowlisted failure code, check ID, endpoint, and numeric HTTP status metadata. On recovery, the workflow will comment on that marker-owned issue and close it. Until that deployment, treat this paragraph as candidate behavior rather than a claim about the hosted workflow.

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
- Primary incident role with a configured organizational or private contact route.
- Backup incident role with an access-controlled private route, a successful test from the last 30 days, and matching content-bound evidence.
- Founder-approved support coverage hours.
- External synthetic monitoring.
- Dedicated error monitoring.
- Paging/escalation route.
- A passed incident rehearsal within the last 30 days.
- Founder, support, and legal/safety approvals with valid, non-future timestamps recorded after the final incident evidence they approve.

A checked-in receipt and matching digest are necessary but cannot authenticate a
provider event by themselves. The evaluator accepts a private-route receipt only
when its exact control/provider/digest identity is supplied by a trusted provider
verifier in the running process. The ordinary readiness CLI supplies no trusted
identity and deliberately cannot report incident readiness as passed from
repository evidence alone. The current candidate adds a protected, read-only
provider-evidence workflow, but its private-route, paging, rehearsal, and recovery
adapters remain unsupported and fail closed. Do not treat the workflow's presence
as provider proof; each adapter must query its provider and inject the verified
identity in the same process. Checked-in files, environment flags, and
operator-authored allowlists must not be used as that trust source.

Current state: support hours, synthetic monitoring, error monitoring, paging,
and a recent rehearsal are recorded. Incident readiness is **blocked** because
the backup role does not yet have an access-controlled route with a recent,
content-bound successful test. The historical approvals also cannot substitute
for approval of later evidence. This is separate from the launch hold,
recovery, and payment-provider gates described below.

## Launch Readiness Gate

Launch readiness combines incident routing, the approved recovery policy, and
the machine-readable payment-provider launch state. Run:

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
- A recently verified recurring backup schedule, cadence, owner, evidence reference, and SHA-256 evidence digest.
- A non-future latest successful named backup no older than the approved RPO, with object key, table/row counts, evidence reference, and SHA-256 evidence digest.
- A physically tested missed-backup alert with a named destination, retry allowance, current evidence reference, and SHA-256 evidence digest.
- Backup cadence plus alert/retry allowance that does not exceed the approved RPO.
- Provider- or automation-enforced retention with a current evidence reference and SHA-256 evidence digest.
- A backup copy in a provider-independent failure domain with current evidence and a SHA-256 evidence digest.
- Restore-drill cadence and owner; the latest restore must be no older than that cadence, and the next due date must fall after the latest restore but no later than its cadence deadline.
- A passed named backup-artifact restore with positive table/row counts and a repository-relative evidence file whose SHA-256 digest matches the policy.
- Current, non-future founder and operations approvals recorded after every bound evidence timestamp and bound to the exact recovery configuration and evidence digests.
- A reviewed `docs/operations/payment-provider-readiness.json` record proving
  either that invoice bank payments are disabled in production or that fresh,
  signed `Connected accounts` delivery is working.
- A strict typed payment-provider receipt that binds the verification timestamp,
  mode, feature flag, destination and runtime scope, signed-delivery state,
  source commit, enabled/configured state, and webhook state. Its exact
  control/provider/digest identity must come from a trusted provider verifier.
- Named payment-provider approval recorded after verification and bound to the
  exact reviewed mode/evidence digest.

Checked-in payment JSON and a matching digest cannot authenticate provider state.
The ordinary readiness CLI injects no trusted payment-provider identity and
therefore fails closed. The current candidate prepares a protected manual
`Production Provider Evidence` workflow whose compiled disabled-payment adapter
queries Railway variables, the live RIVT health contract, and Stripe Accounts v2
in the same read-only process. It also compares a one-way runtime configuration
fingerprint so staged Railway values cannot be mistaken for the configuration
served by the live process. The workflow is not deployed, configured, or executed
evidence until its exact source is reviewed on protected `master`, its
`production-evidence` environment is approved, and a passing run is recorded.

Current state: recovery readiness is deliberately **blocked**. The latest named-
artifact restore remains useful restore evidence, but RIVT has not recorded real
provider evidence for the recurring schedule, a latest successful backup inside
the RPO, a tested missed-run alert, enforced retention, or an independent backup
failure domain. Historic recovery approvals are superseded until those exact
controls and evidence digests are reviewed. The separate `ACTIVE_LAUNCH_HOLD`
also remains in force. Payment-provider readiness is evaluated independently.

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

A restore drill and continuous backup readiness prove different things:

- The restore drill proves that one named artifact can be decrypted, replayed, and verified.
- Continuous backup readiness proves backups keep occurring frequently enough, a missed run is detected in time, retention is enforced, and a provider outage does not remove every copy.

Before asking for recovery-policy approval, record all of the following in
`docs/operations/recovery-policy.json` without secrets:

1. The recurring schedule cadence and owner, plus a current provider evidence reference and its SHA-256 digest.
2. The latest successful named backup completion time, object key, table/row counts, evidence reference, and SHA-256 digest. Its completion time must be real, non-future, and inside the RPO.
3. A physical missed-run alert test, including destination, retry allowance, test time, evidence reference, and SHA-256 digest. Cadence plus retry allowance must fit inside the RPO.
4. Provider- or automation-enforced retention, including enforcement mode, verification time, evidence reference, and SHA-256 digest.
5. An independently hosted backup copy, including primary and backup providers, verification time, evidence reference, and SHA-256 digest.
6. A named-artifact restore no older than the approved cadence, with positive table/row counts and a repository-relative evidence file whose SHA-256 digest matches the policy. Its next drill date must be after that restore and no later than the cadence deadline.
7. New founder and operations approvals created only after the final configuration digest is known and every bound evidence event is complete. Approval timestamps must be parseable, current, non-future, and later than every evidence timestamp. Any evidence or configuration change invalidates those approvals.

Provider setup is a separate, costed operational action and must be explicitly
approved before it is performed. Repository documentation alone cannot satisfy
these checks. Run `npm run launch:readiness -- --require-ready`; it must fail
closed until all real evidence is present and the active launch hold is cleared.
Each recovery receipt must also match the control's substantive provider facts:
schedule cadence and owner; backup artifact key and counts; alert destination and
retry allowance; retention window, owner, and enforcement mode; both failure-
domain providers; or the restored artifact and measured restore/verification
metrics. As with private routing, those receipts require identities supplied by
a trusted in-process provider verifier. The ordinary readiness CLI has no such
integration, and the current protected provider workflow intentionally leaves
the recovery adapters unsupported. Recovery therefore remains blocked even if
matching JSON and hashes are checked in.

1. Restore PostgreSQL and representative private objects into isolated nonproduction.
2. Verify users, jobs, relationships, messages, project records, and object access.
3. Measure recovery time and recovery point.
4. Record missing records, configuration, and repair actions.
5. A successful backup job without restore proof does not close the requirement.

Gate A requires proof that one exact immutable backup object can be restored.
The old direct database-to-database logical copier is retired because it could
bypass artifact integrity and retention evidence. Create the encrypted logical
backup artifact only from the dedicated scheduled job:

```text
npm run backup:logical-artifact
```

The command reads only `BACKUP_DATABASE_URL`, requires a strict random 32-byte
`BACKUP_ENCRYPTION_KEY`, uses only `BACKUP_DESTINATION_S3_*`, and writes a
lossless v2 PostgreSQL-text snapshot inside AES-256-GCM. It rejects roles that
can write, roles that cannot see every supported public table/column, RLS,
application tables outside `public`, inheritance/partition layouts, remote TLS
downgrades, and incomplete protection. Public output contains only bounded
receipts and hashed artifact/destination identities, never raw bucket names,
keys, versions, digests, URLs, or encryption material.

The hourly metadata/content verifier requires the protected active backup key
and optional previous key so it can AEAD-authenticate, decrypt, and validate
the newest payload before treating it as fresh. It runs:

```text
npm run backup:verify
```

Restore that named artifact into a freshly provisioned isolated target:

```text
CONFIRM_RESTORE_TARGET_ISOLATED=true \
RESTORE_DATABASE_URL="postgresql://restore-target" \
RESTORE_SOURCE_DATABASE_URL="postgresql://read-only-source" \
RESTORE_BACKUP_S3_KEY="<exact-private-key>" \
RESTORE_BACKUP_S3_VERSION_ID="<exact-private-version>" \
RESTORE_BACKUP_SHA256="<exact-private-digest>" \
npm run restore:drill -- --apply-migrations
```

The drill invokes the exact-artifact restore and verification in one measured
process. Before any migration or destructive statement it compares runtime
PostgreSQL cluster and database identities and refuses the production/source
cluster even when connection strings use different aliases. It authenticates
the v2 artifact, restores inside one rollback-safe transaction, then compares
the complete supported public schema, every row count, canonical content
digest, and sequence state. There is no count/compare bypass and no
operator-supplied duration. The combined measured time must stay inside the
approved RTO. Do not persist restore URLs, object identity, confirmation, or
keys as normal app-service variables; pass them only through the approved
temporary restore environment.

Latest Packet 08 evidence: temporary Railway PostgreSQL target `Postgres-3Ei3` was migrated, populated with 59 public tables and 1,524 rows in 1,421 ms, strictly verified with migration `0009_durable_rate_limits`, zero pending migrations, zero source/target count diffs across critical Gate A tables, and a 220 ms verifier duration, then deleted. A named backup-artifact restore also passed on 2026-06-21: encrypted object `backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm` restored into isolated Railway target `Postgres-_FQz`, applied nine migrations through `0009_durable_rate_limits`, restored 59 public tables and 1,524 rows, verified strict manifest parity with zero diffs in 13,411 ms, passed `npm run restore:drill` in 1,862 ms, and then the temporary target was deleted.

## Provider Outage

1. Identify provider, affected capability, first failure, and user impact.
2. Disable only the affected feature where possible.
3. Preserve queued work and expose truthful queued/failed state.
4. Use fallback channel only when consent and security allow it.
5. Reconcile delayed/duplicate callbacks after recovery.
