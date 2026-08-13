# RIVT production backup runbook

Status: **provider foundation configured; identities, artifacts, recurrence, and restore proof still inactive**.

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

These targets currently cover the PostgreSQL database only. Project photos,
documents, and other objects in the application `S3_*` bucket do **not** yet
have an independently administered immutable copy. Database recovery must not
be described as complete RIVT disaster recovery until application-object
backup and restore evidence exists as a separately reviewed packet.

The recommended schedule is `7 */12 * * *` (UTC). The seven-minute offset
avoids the top-of-hour deployment/maintenance crowd. Railway may start cron
jobs a few minutes late and skips a new run if the prior run is still active,
which is why the independent hourly freshness alarm is mandatory.

## Prepared source contract

- Dedicated private scheduler service, pinned to the reviewed full source
  commit. The bounded build, command, restart, and 12-hour schedule contract is
  stored in `/railway.backup.json`. The Railway service must explicitly use
  that custom config path; the public RIVT web service must continue using
  `/railway.json`. Service binding, source selection, secrets, and activation
  remain provider-owned configuration and are not created by this packet.
- Scheduled backup command: `npm run backup:scheduled`. It launches the
  one-shot logical-backup process with a 45-minute default hard deadline and a
  non-overridable 60-minute ceiling. Host shutdown signals are forwarded to
  the child. A timed-out or interrupted child is terminated, escalated when
  needed, and bounded by a final fallback so the cron job cannot hang forever.
- Low-level one-shot backup command: `npm run backup:logical-artifact`
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
The backup also takes a PostgreSQL advisory lock before opening its read-only
snapshot, so a second manual or duplicate-service run fails instead of doing
the same work concurrently.

## Provider selection and setup boundary

The founder approved AWS S3 in `us-east-1` as the independent recovery
provider, in a separately administered founder-controlled account, with a private bucket, Versioning,
30-day Object Lock COMPLIANCE retention, least-privilege credentials, and the
recorded one-time and monthly cost ceilings. Backblaze B2 was an earlier
alternative and is not the active plan. The AWS account and an empty dedicated
bucket now exist. Root passkey MFA is enabled, root has no access keys, a
near-zero spend alert is configured at $0.01 (an alert, not a hard cap), and
all four bucket-level Block Public Access settings are on.
Object Ownership is bucket-owner-enforced, Versioning is enabled, default
encryption is SSE-S3, and default Object Lock is 30-day COMPLIANCE. Exact
provider identifiers are intentionally omitted from repository evidence and
must be recorded in access-restricted operator evidence before activation. No IAM
runtime identity, access key, bucket object, lifecycle rule, scheduler, monitor
secret, or restore proof exists yet. A deny-only bucket policy was saved and is
configured to deny non-TLS traffic and writes to the reserved backup prefix
unless the caller supplies `If-None-Match` for create-only semantics. The AWS
console reported a successful save and displayed both deny statements, but no
live negative request has proved enforcement. The policy grants no identity any
access. Automatic or manual deletion of retained backup objects remains outside
the approval.

Completed provider foundation and remaining activation steps:

1. Preserve the private bucket with versioning and provider-enforced Object
   Lock/WORM retention enabled.
2. Preserve the configured 30-day default COMPLIANCE retention. Treat the
   retention on each future retained object version as
   irreversible: neither RIVT nor AWS can shorten it or delete a locked version
   during the retention window.
3. Do not configure lifecycle deletion under the current approval. The source
   verifier checks Versioning and bucket-default COMPLIANCE retention without
   requiring lifecycle permissions. A one-time immutable artifact can therefore
   be proved without deletion authority. Recurring activation remains blocked
   until either (a) a separate explicit approval allows one exact-prefix rule
   to expire current and noncurrent backup versions after the lock expires, or
   (b) a tested hard stop prevents further writes before the spending ceiling.
4. Create three restricted application keys from the reviewed policy fixtures:
   backup writer, monitor reader, and restore reader. The writer may inspect
   only Versioning/default Object Lock, conditionally create a new object, and
   read that exact version's retention; it cannot list or read object content,
   delete, or administer retention. The monitor cannot write or delete. The
   restore key has no list access and is not stored on the web service.
5. Create a dedicated PostgreSQL login with CONNECT/USAGE/SELECT only. Verify
   it can see and select every public table and sequence and has no CREATE,
   INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, sequence UPDATE,
   role, database, replication, superuser, or row-security bypass capability.
   It must also be able to execute `pg_control_system()` so the backup and
   restore paths can prove the runtime PostgreSQL cluster identity; if the
   provider removes that permission, the job must fail closed.
6. Create a private scheduler service from the reviewed full commit, set its
   custom config file path to `/railway.backup.json`, and give it no public
   domain. Before activation, confirm the rendered deployment details show
   `npm run backup:scheduled`, `7 */12 * * *`, one replica, no
   healthcheck, and restart policy `NEVER`. Also confirm the public RIVT web
   service still uses `/railway.json`. Set `BACKUP_JOB_TIMEOUT_MINUTES=45` and
   set conservative provider CPU/RAM limits no higher than 1 vCPU and 1 GB for
   the first measured run; changing those limits requires a reviewed cost and
   capacity update. Record and review the provider-owned source binding,
   variables, limits, and resulting deployment before activation; the
   repository config does not create or activate the service.
7. Add the monitor's read-only provider values/secrets to the dedicated GitHub
   `production-backup-monitor` environment. Restrict that environment to
   `master` and owner-controlled configuration changes, but do not require a
   reviewer on each job run: per-run review would block the hourly unattended
   alarm and withhold its secrets. Use `BACKUP_MONITOR_S3_ACCESS_KEY_ID` and
   `BACKUP_MONITOR_S3_SECRET_ACCESS_KEY`; the key may list/read/head only the
   exact backup prefix and may not write, overwrite, lock, retain, or delete.
8. Set the `production-backup-monitor` environment variable
   `BACKUP_EXPECTED_SOURCE_COMMIT` to the reviewed 40-character production
   source commit. The scheduler's `SOURCE_COMMIT` must equal Railway's
   provider-set `RAILWAY_GIT_COMMIT_SHA`; backup creation fails before reading
   PostgreSQL or writing storage when those values differ or when Railway does
   not supply a deployment SHA. Set the nonsecret repository Actions variable
   `RIVT_BACKUP_ALERT_GITHUB_LOGIN` to the owner who physically receives the
   incident notification; reconciliation intentionally has no access to the
   secret-bearing environment. The workflow checks out that exact commit and
   requires the artifact source binding to equal it. Because the artifact's
   `SOURCE_COMMIT` is supplied by the scheduler environment, acceptance also
   requires separate provider evidence that the running scheduler deployment
   really uses that immutable commit; metadata equality alone is not source
   provenance.
9. Before recurring activation, add a separate read-only provider-control
   auditor for bucket-level Block Public Access, Object Ownership, default
   encryption, and the deny-only bucket policy. The current writer and
   freshness monitor intentionally verify only the controls needed for each
   data-path operation; they do not detect drift in those broader provider
   settings. Keep these audit permissions out of the writer identity.

The 2026-08-12 bounded sizing check found approximately 44.1 MB of application
objects plus a 1.31 MB encrypted database artifact per hypothetical
database-plus-object-byte set. This is a sizing model only; object-byte
packaging, integrity verification, and complete-set restore are not yet built.
At two sets daily for 30 days, the modeled retained footprint is about 2.72 GB;
estimated storage, requests, and Railway egress total about $0.26/month and a
conservative envelope is below $0.50/month before tax and scheduler-compute
uncertainty. This is planning evidence, not a hard AWS cap or new spending
authorization. With no lifecycle expiry, storage grows indefinitely, so the
12-hour scheduler must remain inactive under the current no-deletion boundary.

## First-backup acceptance

1. Confirm the cron is built from the exact reviewed/deployed full commit.
2. Confirm HTTPS, versioning, and COMPLIANCE default retention through the
   reviewed provider configuration. The backup command re-checks those controls
   and fails before writing if they disagree. Confirm the bucket policy rejects
   non-TLS requests and unconditional writes to the exact backup prefix.
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
   Confirm its measured duration stayed below the configured 45-minute hard
   deadline and its peak resource use stayed within the reviewed provider
   limits.
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
- bucket Versioning/default COMPLIANCE retention cannot be queried and verified;
- recurring writes are enabled without approved lifecycle expiry or a tested
  cost-ceiling hard stop;
- latest artifact is older than 14 hours or lacks an immutable version;
- alert receipt is untested or the human route did not receive it;
- restore target isolation is uncertain;
- exact content, row counts, migration state, or 240-minute RTO fails; or
- final recovery approvals predate any changed configuration/evidence.
