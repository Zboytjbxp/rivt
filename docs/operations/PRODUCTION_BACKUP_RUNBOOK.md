# RIVT production backup runbook

Status: **prepared in source; not configured or launch evidence**.

This runbook separates four different jobs that must not share credentials:

1. the RIVT web service owns customer traffic and the application `S3_*`
   bucket;
2. the backup cron reads PostgreSQL through `BACKUP_DATABASE_URL` and writes
   encrypted artifacts through `BACKUP_DESTINATION_S3_*`;
3. GitHub's hourly freshness monitor reads backup metadata/content through a
   separate read-only key; and
4. a temporary restore environment reads one named artifact version and writes
   only to an isolated restore database.

No successful command in this document clears launch readiness by itself.
Provider evidence, a received alert, a named-version restore, and new approvals
must all agree with the final deployed source.

## Targets

- Backup cadence: every 12 hours.
- Freshness alarm: no verified artifact may be older than 14 hours.
- RPO: at most 24 hours of database changes.
- RTO: restore plus verification within 240 minutes.
- Immutable retention: at least 30 days in COMPLIANCE mode.
- Failure domain: backup copy outside Railway.

The recommended schedule is `7 */12 * * *` (UTC). The seven-minute offset
avoids the top-of-hour deployment/maintenance crowd. Railway may start cron
jobs a few minutes late and skips a new run if the prior run is still active,
which is why the independent hourly freshness alarm is mandatory.

## Prepared source contract

- Dedicated private scheduler service, pinned to the reviewed full source
  commit. Its provider-owned configuration is intentionally not stored in this
  packet.
- Backup command: `npm run backup:logical-artifact`
- Read-only verification: `npm run backup:verify`
- Low-level exact-artifact restore primitive (diagnostics only):
  `npm run restore:logical-artifact -- --apply-migrations`
- Evidentiary restore plus verification, run once:
  `npm run restore:drill -- --apply-migrations`
- Independent monitor command: `npm run backup:monitor`, invoked by
  `.github/workflows/backup-freshness.yml`. The workflow captures command
  output privately, validates a strict sanitized receipt, and never publishes
  raw provider output or uploads it as an artifact.

The job exits after one snapshot. A process that remains active is a failed run,
because Railway will skip the next scheduled execution.

## Provider selection and setup boundary

No independent recovery provider is selected or approved. The current design
recommends AWS S3 Versioning plus Object Lock in a separately administered US
account; Backblaze B2 was an earlier alternative and is not the active plan.
Do not create an account, bucket, service, key, schedule, or retained object
until the founder receives and approves one exact proposal naming the provider,
account owner, US region, retention/deletion mode, access and key-custody roles,
one-time cost ceiling, monthly cost ceiling, rollback, and isolated restore
test.

After that explicit approval, the selected provider setup must:

1. Create a private bucket with versioning and provider-enforced Object
   Lock/WORM retention enabled at creation time.
2. Apply the separately approved retention mode and period. Do not use
   COMPLIANCE mode until its irreversible retention and cost consequences are
   understood and approved.
3. Add one exact-prefix lifecycle rule that expires current and noncurrent
   versions only after the 30-day retention floor.
4. Create three restricted application keys: backup writer, monitor reader,
   and restore reader. The monitor cannot write or delete; the writer cannot
   administer retention; the restore key is not stored on the web service.
5. Create a dedicated PostgreSQL login with CONNECT/USAGE/SELECT only. Verify
   it can see and select every public table and sequence and has no CREATE,
   INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, sequence UPDATE,
   role, database, replication, superuser, or row-security bypass capability.
   It must also be able to execute `pg_control_system()` so the backup and
   restore paths can prove the runtime PostgreSQL cluster identity; if the
   provider removes that permission, the job must fail closed.
6. Create a private scheduler service from the reviewed full commit, set its
   command to `npm run backup:logical-artifact`, give it no public domain, and
   set the 12-hour schedule. Record and review the provider-owned configuration
   before activation; this repository packet does not create it.
7. Add the monitor's read-only provider values/secrets to the dedicated GitHub
   `production-backup-monitor` environment. Restrict that environment to
   `master` and owner-controlled configuration changes, but do not require a
   reviewer on each job run: per-run review would block the hourly unattended
   alarm and withhold its secrets. Use `BACKUP_MONITOR_S3_ACCESS_KEY_ID` and
   `BACKUP_MONITOR_S3_SECRET_ACCESS_KEY`; the key may list/read/head only the
   exact backup prefix and may not write, overwrite, lock, retain, or delete.
8. Set the `production-backup-monitor` environment variable
   `BACKUP_EXPECTED_SOURCE_COMMIT` to the reviewed 40-character production
   source commit. Set the nonsecret repository Actions variable
   `RIVT_BACKUP_ALERT_GITHUB_LOGIN` to the owner who physically receives the
   incident notification; reconciliation intentionally has no access to the
   secret-bearing environment. The workflow checks out that exact commit and
   requires the artifact source binding to equal it. Because the artifact's
   `SOURCE_COMMIT` is supplied by the scheduler environment, acceptance also
   requires separate provider evidence that the running scheduler deployment
   really uses that immutable commit; metadata equality alone is not source
   provenance.

Historical free-tier estimates are not a current quote or spending
authorization. Recalculate storage, requests, retrieval, provider egress,
Railway egress/compute, monitoring, restore, taxes, and retained-version growth
for the selected provider immediately before approval.

## First-backup acceptance

1. Confirm the cron is built from the exact reviewed/deployed full commit.
2. Confirm HTTPS, versioning, COMPLIANCE default retention, and the exact
   lifecycle prefix through the reviewed provider configuration. The backup
   command re-checks those controls and fails before writing if they disagree.
   The freshness verifier cannot pass before the first artifact exists.
3. Run one backup. Do not paste raw keys, object identifiers, digests, database
   URLs, or encryption material into tickets or public logs.
4. Map the dedicated monitor environment secret holding the active
   key into the runtime variable `BACKUP_ENCRYPTION_KEY`; only during an
   approved rotation, map the prior secret into
   `BACKUP_ENCRYPTION_KEY_PREVIOUS`. Run `npm run backup:monitor` through the
   freshness workflow with its separate
   monitor-reader provider credentials, not with the writer credential. It
   must identify a current immutable version, recompute its digest, require
   that artifact's key identity to match the active key, AEAD-authenticate and
   decrypt it with the active key only, validate its restore structure and
   source-commit binding, and report age <=14 hours with
   `encryptionKeyMode: active-only`. Only the sanitized receipt may be retained
   or published.
5. Confirm the job exited and no connection or process remains active.
6. Let the next scheduled run complete before treating cadence as observed.

## Missed-backup alarm acceptance

1. Run the GitHub workflow's `alert_test=true` path. That job receives no
   checkout, environment, provider credential, or encryption key, and it does
   not read or change any backup object.
2. Confirm the exact title/marker/label/author-matched bot-owned incident issue
   opens or reopens, and the private backup
   owner physically receives the alert.
3. Record only the sanitized workflow URL/time/result in repository evidence.
4. Run a normal successful verification and confirm automation closes only the
   exact owned issue. An alert-test run must never close it. More than one
   exact owned issue is an ambiguous state and must fail closed without issue
   mutation.

An issue existing in GitHub is not proof a human received it. Physical receipt
must be recorded separately.

## Named-version restore drill

1. Provision a temporary isolated PostgreSQL target only after its cost is
   approved.
2. Select the newest successful artifact by exact object key, immutable version
   ID, and SHA-256 digest. Never restore an unversioned name or “latest” alias.
3. Set the dedicated `RESTORE_SOURCE_S3_*` read credentials and the exact
   production/source database identity used by the isolation check.
4. Set `CONFIRM_RESTORE_TARGET_ISOLATED=true` only after manually comparing the
   source and target host/port/database identities.
5. Run `npm run restore:drill -- --apply-migrations` once. The drill always
   requires the selected artifact to match and decrypt with the active key;
   an artifact requiring `BACKUP_ENCRYPTION_KEY_PREVIOUS` is rejected before
   the target database is opened. It then verifies every supported public
   table, row count, canonical content digest, and sequence in the same
   process. Preserve only a sanitized receipt that reports
   `encryptionKeyMode: active-only`.
6. Record its separate measured restore, verification, and combined durations.
   Combined time must be <=240 minutes. Never substitute an operator-entered
   duration or disable strict comparison.
7. Delete the temporary restore database and remove its credentials after
   evidence is captured. COMPLIANCE-locked backup versions are not deleted.

## Key rotation

- Generate a new random 32-byte active key; never use a sentence/password.
- Move the prior active value to `BACKUP_ENCRYPTION_KEY_PREVIOUS` only for the
  bounded compatibility window.
- Create a new artifact under the new key, verify it in active-only mode, and
  restore-test that exact version in the active-only restore drill.
- Remove the prior key only after every retained artifact that still requires
  it has expired, or after the owner explicitly accepts losing RIVT's ability
  to restore those artifacts and designates a newly created, active-key-only,
  isolated-restore-verified artifact as the recovery point.
  A verification or restore receipt reporting `active-or-previous` is not
  evidence that qualifies the predecessor for removal.
- Never store active and prior keys in source, documentation, artifacts, issue
  bodies, workflow output, or the web-service environment.

## Stop conditions

Keep the launch hold active if any of these are true:

- backup job or monitor source does not equal the reviewed commit;
- database role can write or cannot read every required public table;
- bucket protection/lifecycle cannot be queried and verified;
- latest artifact is older than 14 hours or lacks an immutable version;
- alert receipt is untested or the human route did not receive it;
- restore target isolation is uncertain;
- exact content, row counts, migration state, or 240-minute RTO fails; or
- final recovery approvals predate any changed configuration/evidence.
