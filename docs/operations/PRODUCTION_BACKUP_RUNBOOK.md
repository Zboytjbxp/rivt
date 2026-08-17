# RIVT production backup runbook

Status: **one immutable PostgreSQL artifact and an active-key-only restore are
proved; recurring backup and freshness monitoring are inactive, and
application-object-byte recovery is missing**.

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

## Packet 100 coordinated recovery-set boundary

Packet 100 prepares source for a database-plus-application-object recovery set.
It is not merged, deployed, configured, scheduled, or approved for live use.
Its guarded local harness and tests make no provider request, read no production
data, incur no charge, and do not inspect ambient provider credentials.

The source commands are intentionally dormant and detached from `npm start`,
Railway service configuration, cron, and GitHub workflows. They may be invoked
against a live environment only after a separately reviewed bounded approval
names the exact source commit, source and destination coordinates, identities,
write window, byte/object limits, interruption allowance, and cost ceiling.
Configuration must use the active backup-encryption key only; an evidentiary
complete-set restore must reject previous-key aliases.

The coordinated source path is:

1. acquire an exclusive application-object advisory barrier through the
   read-only `BACKUP_DATABASE_URL`; require the application `DATABASE_URL` to
   report the same PostgreSQL system identifier, database OID, and database
   name as supplemental evidence; then hold a fresh random exclusive advisory
   challenge through the backup URL and require a shared try through the app
   URL to fail. Only that live contention proves one active lock manager and
   rejects a same-identity physical replica. Capture one logical-v2 snapshot
   while all runtime object and uploads-table mutations are paused;
2. bind its encrypted artifact, logical manifest, uploads-table digest, and
   exact reviewed source commit;
3. enumerate the entire source object store twice, stream-hash every referenced
   object, compute missing legacy hashes, and classify provider-only and
   removed-but-still-present objects;
4. fail before immutable writes if either inventory differs, any stored
   reference is missing or mismatched, any item is unresolved, or a configured
   count/byte/time limit is exceeded;
5. preserve independent AES-GCM authentication for each object member and
   concatenate those bounded ciphertext members into one encrypted archive
   with contiguous authenticated offsets and no gaps or trailing bytes;
6. conditionally create exactly three protected keys—database, archive, then
   completion—and verify each exact immutable version, checksum, COMPLIANCE
   retention, and retention floor; and
7. write the authenticated encrypted completion record last.

The source-reader, protected-writer, monitor/backup-reader, and isolated-
restore data identities must be distinct and must not be the RIVT web-service
identity. Create configuration additionally binds distinct retirement-control
and auditor identity digests, each different from every data/application
principal. Those local digests are neither credentials nor provider proof. A
future live AWS implementation must derive and verify both identities with no
backup decryption or source-data authority. Use only reviewed IAM fixtures.
Normal command output must remain
aggregate and secret-safe; exact object keys, provider coordinates, version
IDs, and object-level metadata belong only in restricted operator evidence.
The checked-in create CLI includes a provider-neutral authorization lease but
intentionally refuses protected writes until a separately reviewed control
adapter attests the rendered exact three-key writer policy and writer
principal. Every exact-key `PutObject` and `GetObjectRetention` allow shares
the same inclusive-start, exclusive-end UTC window; `If-None-Match` applies
only to creates. The exact provider plan is durably recorded before the
adapter factory opens; factory construction must perform no provider I/O;
the revoker exists before activation begins; ambiguous activation and every
later failure trigger idempotent retirement; and final success evidence is
forbidden until policy absence and denied direct/multipart writes are proved.
Local tests inject only a no-provider fake; they do not authorize a live write.

The selected Option 2 source contract also requires an independent retirement
registration to become durable before the protected-writer factory opens. The
registration binds the exact authority plan, random run identity, retirement
deadline, later proof deadline, still-valid writer-session expiry, and distinct
control/auditor identities. The controller store retains a bounded private
retirement descriptor while restricted evidence carries only its SHA-256
identity. The provider-neutral reconciler uses compare-and-swap revisions,
fencing tokens, bounded attempt leases, due-record sweeps, and conflict
quarantine. It can retry an ambiguous registration, an expired claim, or
simulated controller-process loss without letting a stale claim become final
evidence. The v2 restricted reservation and final v5 receipt bind registration
and independently finalized retirement. This is a crash-reconciliation source
contract only: no controller is deployed, no provider store is configured, and
local evidence is fixed to `providerless-injected-fake`.

The checked-in restore command now includes a providerless isolated RIVT
route-reader. It repeats target identity inside a read-only transaction,
invokes the production upload-URL handler for one exact owner/reference per
completed scope, and follows only the opaque injected delivery capability
returned by that handler. Local tests prove this handler-level path without
provider I/O. They do not exercise cookie/session middleware, live HTTP or
provider delivery and cannot close the live acceptance requirement. Local
receipts are fixed to `handler-injected-store`; operational acceptance requires
`live-cookie-session-http-provider-delivery` from the coordinated live path.

During a future bounded capture, prohibit deployments, schema/data migrations,
direct SQL changes, provider-console object changes, and all out-of-repository
storage mutations. The application barrier covers RIVT runtime and reviewed
smoke-cleanup paths; it cannot coordinate an external administrator bypass.
Do not waive either the supplemental runtime-identity comparison or the fresh
cross-URL contention challenge. Never substitute a read replica whose
advisory-lock namespace differs.

Immediately before writer activation, use a separately reviewed control
auditor to prove no incomplete multipart upload exists for any of the three
exact keys and that multipart initiation/parts are denied. Both attestations
must be present in the durable restricted receipt before the first protected
write. The adapter must remove and read back the exact policy on success and on
every error after activation is attempted. If retirement or its readback is
ambiguous, stop and preserve the restricted receipt; do not treat component or
completion writes as accepted evidence. The source also proves every captured key is addressable below the exact
isolated-restore prefix before releasing the capture barrier.

For a future approved live proof, preserve restricted exact references from the
sanitized one-shot backup receipt. Restore that exact completion version into
both a new isolated PostgreSQL database and an empty isolated object prefix.
The restricted v5 receipt must bind the v2 reservation, controller registration
and retirement finalization, and the completion, database artifact, and archive
versions, hashes, and accepted COMPLIANCE-retention timestamps. Render the
reader policy with three exact key-to-version content grants plus only the exact-
key retention metadata authority required by the verifier. Archive
metadata may be inspected before database work, but open the exact archive
body only after the database restore settles so an idle provider stream cannot
expire during migrations.
Acceptance requires all eight application scopes, active-key-only decryption,
exact object count and bytes, zero missing/mismatched/unresolved/unexpected
entries, exact readback hashes, representative isolated RIVT route reads,
database manifest/content parity, measured recovery time, target cleanup,
post-proof health, and monitor state. Cleanup is limited to the temporary
restore database and objects created under the isolated restore prefix; never
delete a protected backup version or production object.

Stop immediately and preserve the launch hold if the database/object binding,
source commit, coordinate identity, active key, source inventory, immutable
version, checksum, retention, isolation, application read, limits, cleanup,
health, or monitor evidence is absent or ambiguous. Partial component writes
without an authenticated completion record are not a recovery set.

Current state: source-in-progress and live-unproven. The provider-neutral
authorization/revocation lifecycle and Option 2 crash-reconciliation source
contract are implemented locally. Durable controller registration precedes
writer construction; CAS/fencing, deadline-sweep, ambiguous-registration, and
simulated process-loss paths fail closed. The concrete exact-key AWS provider
control adapter and independently deployed controller remain intentionally
absent, so create fails closed before protected writes. Provider-derived writer,
account, bucket-owner, control, and auditor identity proof, provider persistence,
forced-termination evidence, IAM propagation, and live control/data-plane
transcripts are still missing. Restore has providerless handler-level route source,
but no live cookie/session HTTP/provider proof. The existing PostgreSQL-only
proof remains valid for that limited scope, but
`operationalReadiness.applicationObjectByteRecovery` remains `missing`.

## Targets

- Backup cadence: every 12 hours.
- Freshness alarm: no verified artifact may be older than 14 hours.
- RPO: at most 24 hours of database changes.
- RTO: restore plus verification within 240 minutes.
- Immutable retention: at least 30 days in COMPLIANCE mode.
- Failure domain: backup copy outside Railway.
- Source-enforced storage-growth ceiling: one deterministic object per 12-hour
  UTC slot, no new PostgreSQL artifact above 16 MiB, and no upload attempt that
  begins outside one explicitly configured UTC calendar month.

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

Backup creation additionally fails closed unless
`BACKUP_WRITE_WINDOW_START_AT` and `BACKUP_WRITE_WINDOW_END_AT` describe one
exact UTC calendar month. Object names are deterministic for the `00:00` and
`12:00` UTC slots, and the conditional create request permits at most one
accepted application write in each slot. A provider `412 Precondition Failed`
is reported only as `BACKUP_CADENCE_LIMIT_REACHED`. New encrypted PostgreSQL
artifacts have a non-configurable 16 MiB upload ceiling; the older 512 MiB
read ceiling remains only for compatibility with named restore artifacts.
For one unchanged, approved normalized endpoint, region, bucket, prefix, and
addressing mode, these controls bound a 31-day
proving window to at most 62 accepted writes and 992 MiB uploaded by RIVT's
writer. The window is also bound to a SHA-256 identity of those exact five
nonsecret destination coordinates. The irreversible upload helper independently rejects any key other
than the deterministic current-slot key. The nonsecret destination digest is
a drift check against a separately protected approval value, not an
authorization boundary; an actor able to change both values can recompute it.
The local check occurs immediately before the S3 request; exact
provider-time enforcement remains a live IAM conformance requirement. These
controls do not cap duplicate-attempt S3 requests or Railway/database compute,
are not a provider account spending cap, and do not authorize a write.

## Provider selection and setup boundary

The founder approved AWS S3 in `us-east-1` as the independent recovery
provider, in a separately administered founder-controlled account, with a private bucket, Versioning,
30-day Object Lock COMPLIANCE retention, least-privilege credentials, and the
recorded one-time and monthly cost ceilings. Backblaze B2 was an earlier
alternative and is not the active plan. The AWS account and dedicated bucket
now hold one immutable PostgreSQL logical artifact whose active-key-only
restore passed on 2026-08-16. The one-shot writer and restore credentials are
inactive, temporary Railway vault secrets are blank, and the isolated restore
target and local helpers were removed. These facts do not activate recurrence
or the independent monitor. Root passkey MFA is enabled, root has no access
keys, a near-zero spend alert is configured at $0.01 (an alert, not a hard
cap), and all four bucket-level Block Public Access settings are on.
Object Ownership is bucket-owner-enforced, Versioning is enabled, default
encryption is SSE-S3, and default Object Lock is 30-day COMPLIANCE. Exact
provider identifiers for the 2026-08-16 proof are intentionally omitted from
this current-state update and remain in access-restricted operator evidence.
No lifecycle rule, recurring
scheduler identity, or active monitor read credential/configuration exists.
The protected GitHub monitor environment already contains the active
backup-encryption secret, but it cannot inspect AWS until a separate read-only
identity and exact destination configuration are supplied. A deny-only bucket policy was saved
and is configured to deny non-TLS traffic and writes to the reserved backup
prefix unless the caller supplies `If-None-Match` for create-only semantics.
The reviewed source fixture adds a third deny intended to refuse multipart
initiation and part uploads. The AWS console previously reported a successful save and
displayed the original two deny statements; the revised three-statement policy
has not been applied or live-tested. The policy grants no identity any access.
Automatic or manual deletion of retained backup objects remains outside the
approval.

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
   (b) a separately approved total-storage control prevents cumulative growth.
   The source now provides a one-calendar-month proving window, deterministic
   12-hour slots, and a fixed 16 MiB per-write cap. That bounds RIVT's writer
   for one approved month but does not make indefinite recurrence safe: every
   renewed month would retain more data without expiry.
4. Create restricted identities from the reviewed policy fixtures only when
   their exact use is approved. For the one-time rotation proof, replace the
   writer fixture placeholders with the one deterministic object key and the
   exact half-open UTC approval window. Reject a rendered object key containing
   IAM wildcard or policy-variable syntax (`*`, `?`, or `${...}`). Its `PutObject` grant requires
   `If-None-Match`, and its separate retention read is limited to that same
   object. Replace the restore fixture placeholders with that one object key
   and returned immutable version ID; it has no list or prefix-wide content
   access. The writer cannot read content, list, delete, initiate multipart
   uploads or upload multipart parts after the bucket deny is applied, or
   administer retention. The
   monitor cannot write or delete. No runtime identity belongs on the web
   service. A recurring writer policy is not designed or approved by this
   one-shot fixture.
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
   Configure a canonical UTC calendar-month
   `BACKUP_WRITE_WINDOW_START_AT`/`BACKUP_WRITE_WINDOW_END_AT` pair. Renewal is
   a deliberate monthly operator action and must never be automated under the
   current no-deletion boundary. Bind the same approval to the exact bucket
   and prefix through `BACKUP_WRITE_WINDOW_DESTINATION_SHA256`; changing either
   destination component requires a new reviewed binding.
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

## One-time backup-key rotation acceptance

This is the only currently approved data-path operation. Keep
`/railway.backup.json` unbound and its recurring cron inactive.

1. Start from the exact reviewed and deployed backup-only commit. Calculate the
   deterministic current-slot object key without opening AWS or PostgreSQL and
   keep that identifier only in access-restricted operator evidence.
2. Instantiate the writer policy with that exact object key and the approved
   half-open UTC start/end timestamps. Apply the reviewed bucket policy with
   the TLS deny, create-only precondition deny, and multipart-initiation/part
   deny. Confirm the effective writer policy has no prefix-wide object resource,
   that its rendered exact key contains no IAM wildcard or policy-variable
   syntax, and that no incomplete multipart upload already exists for that key.
3. Before the real backup, prove with provider authorization simulation and
   harmless denied requests that the identity cannot list, read content,
   delete, write another key, write before/after the window, write without
   `If-None-Match`, initiate multipart upload, or upload a multipart part. A
   negative request that would
   leave a retained object is not harmless and requires separate approval.
4. Invoke the one-shot backup directly from the exact deployed backup-only
   source; do not bind the recurring Railway config. Preserve only the
   sanitized success receipt. Disable the writer credential immediately after
   the accepted write and exact-version retention check.
5. Instantiate the temporary restore policy for only the returned object key
   and version ID. Restore to the manually confirmed isolated database using
   only the active key, preserve only the sanitized receipt, then disable and
   remove the restore credential and temporary database.
6. Remove the predecessor encryption key only after the exact active-key-only
   backup and isolated restore proofs pass. Any ambiguity or failed check keeps
   the predecessor available and the launch hold active.

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
The new source caps make one proving month mathematically bounded; they do not
approve that month or change the long-term activation block.

## Recurring scheduler acceptance (future approval required)

This section is not authorized for the current key rotation. It remains a
future acceptance contract after complete recovery coverage, lifecycle/cost
decisions, and a separately reviewed recurring writer design.

1. Confirm the cron is built from the exact reviewed/deployed full commit.
   Confirm its approved UTC write window is current, exact, and limited to one
   calendar month. Confirm the deterministic slot key and 16 MiB fixed cap are
   present in that exact source.
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
  bodies, or workflow output. The current legacy web service still holds the
  active backup key; the target state moves backup authority to dedicated
  scheduler/monitor/restore boundaries and removes it from the web service only
  after that separately reviewed migration is complete.

## Stop conditions

Keep the launch hold active if any of these are true:

- backup job or monitor source does not equal the reviewed commit;
- database role can write or cannot read every required public table;
- bucket Versioning/default COMPLIANCE retention cannot be queried and verified;
- writer authority is not limited to one exact object and the approved UTC
  window, its rendered object key contains IAM wildcard or policy-variable
  syntax, or it does not require `If-None-Match`;
- the bucket policy does not explicitly deny multipart initiation and part
  uploads on the reserved backup prefix, that deny has not been live-tested,
  or an incomplete multipart upload already exists for the exact one-shot key;
- restore content-read authority is broader than the one selected object and
  version;
- `/railway.backup.json` is bound or recurring scheduling is active during the
  one-time rotation;
- recurring writes are enabled without approved lifecycle expiry or a tested
  cost-ceiling hard stop;
- latest artifact is older than 14 hours or lacks an immutable version;
- alert receipt is untested or the human route did not receive it;
- restore target isolation is uncertain;
- exact content, row counts, migration state, or 240-minute RTO fails; or
- final recovery approvals predate any changed configuration/evidence.
