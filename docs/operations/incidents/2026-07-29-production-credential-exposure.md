# Production Credential Exposure - 2026-07-29

- Status: containment in progress
- Severity: critical
- Environment: Railway production
- Incident owner: Michael
- Source at detection: `92a8451b8190f5119384a4970fb1a324503df995`
- Detected at: between `2026-07-29T19:01:00-04:00` and
  `2026-07-29T21:42:25-04:00` (repository-bounded; exact operator-observed time
  was not recorded)
- Declared at: `2026-07-29T21:42:25-04:00` (first formal repository
  declaration; any earlier verbal declaration is unverified)
- Last updated: 2026-07-30 America/New_York
- Approved interruption window: up to 30 minutes
- Approved incremental cost: the initial $0.10 object-storage allowance was
  followed by authorization to continue the remaining incident work unless
  incremental cost would exceed $2 total. Completed actions remained below
  that ceiling; no exact measured provider cost is claimed.

## Summary

During an authenticated production-configuration inspection, an operator command
returned production environment-variable values into a restricted automation
transcript. The temporary local output file was removed. No secret value is
included in this record.

No unauthorized use is currently known; provider and audit-log review remains
open. Data-access and exfiltration impact is under investigation, and no
conclusion has been reached. Because transcript confidentiality cannot be used
as a security boundary, every exposed credential is treated as compromised.

The detection window is bounded by a documented 19:01 Railway observation that
explicitly read no credentials or variables and the first formal critical
incident commit at 21:42:25. The credential-containment worktree was created at
21:19:41, confirming containment was underway before the formal declaration,
but that repository event is not represented as the exact human detection
moment.

## Potentially exposed credential classes

- PostgreSQL connection credential
- Stripe live API credential
- Stripe billing and Connect webhook signing secrets
- Google OAuth client secret
- Resend API credential
- S3-compatible object-storage access credentials
- Web Push VAPID private key
- backup-encryption key
- authentication metadata pepper
- Sentry ingestion DSN

## Rotation status

| Credential class | Status | Nonsecret evidence |
|---|---|---|
| PostgreSQL | Rotated; prior credential superseded | RIVT now uses the managed `${{Postgres.DATABASE_URL}}` reference; in-place PostgreSQL password regeneration and final RIVT redeployment succeeded; pre-change, reference-cutover, and post-rotation rolled-back temporary-table transactions passed |
| Stripe API | Rotated; prior key expired | Railway deployment `54b5dcfc-1a94-4fae-bfca-423fe5ed9a47` succeeded; replacement authenticated to Stripe with a read-only HTTP 200 account response before the superseded key was expired |
| Stripe billing webhook | Rotated; prior secret retired | Destination `we_1TnpZWIz6JDg8LdahYHPwX0o` at `https://rivt.pro/api/stripe/webhook`; Railway deployment `d44d4449-f13e-477c-8fa6-182d8aa21282` succeeded; harmless probe accepted; provider inventory confirms the prior secret expired |
| Stripe Connect webhook | Rotated; prior secret retired | Final Railway cutover deployment `6eded406-8c0e-4abc-adf4-cbe61408025d` succeeded on commit `ae6cc63321df70d322a63d4c821e721a2ddedf52`; final no-charge/no-payment probe accepted; provider inventory confirms the prior secret expired |
| Google OAuth | Rotated; prior secret deleted | Provider UI verifies `support@rivt.pro` owns project `rivt-499402`; the June 13 secret was disabled and then deleted on July 30; final provider inventory contains exactly one enabled July 30 replacement; Railway deployment `0898208b-707f-49c3-b9b9-d0938e157542` serves exact source `04f13e006cae545a33002d2225f90ab0d8b7e9c9`; health, provider-configuration, callback, and production-monitor checks pass |
| Resend | Rotated; prior key deleted | Replacement sending-only key is restricted to `rivt.pro`; a proof email was delivered; the provider dashboard confirmed deletion of the prior key and shows one replacement key remaining |
| Object storage | Rotated; prior copied pair invalidated | Railway bucket `rivt-private` (`83403a81-f912-431e-b0fc-40a238f347e8`) retained identical object count and bytes across the one-time reset; both managed references persisted; deployment `4010a6b9-891a-4d87-9a25-a8cb93c64ee2` and an existing-object read passed |
| Web Push VAPID | Rotated; previous pair retired | An already opted-in owner-controlled physical device received a real alert through the transition bridge; both previous-key variables were then removed, Railway deployment `a29ff982-c10c-4ec3-b8e6-9fd323e65837` succeeded, and the running service reports the active pair present and previous pair absent |
| Backup encryption | Rotated; previous key retired | Fresh active-key artifact `2026-07-30T03-58-45.931Z`, the 2026-07-29 legacy artifact, and the retained 2026-07-25 artifact all restored without count differences; deployment prefix `638e213e` is healthy on commit `854eef63b4d169746faf87157aaa9f3c1345329d`, and runtime checks report the restore URL and both previous-key aliases absent |
| Authentication metadata pepper | Rotated | Replacement is deployed; the old value has no compatibility fallback and is no longer configured for active use |
| Sentry DSN | Pending | None yet |

## Immediate containment

- Removed the temporary local output file.
- Stopped all secret-enumerating Railway commands.
- Paused the separately approved Railway Stage 1 activation. That approval does
  not apply to any changed source or configuration.
- Preserved the existing encrypted production backup artifact. No backup was
  deleted, replaced, or re-encrypted.
- Created a narrow hotfix from the exact production source. It adds:
  - active/previous backup-key restore compatibility while keeping new writes on
    the active key;
  - an active/previous VAPID delivery bridge and opted-in subscription migration.
- Before deployment and credential rotation, made no production provider
  changes, customer-data changes, real payment attempts, paid resource changes,
  or destructive operations while preparing the hotfix.
- A follow-up database integration run used a newly created, guarded
  `rivt_it_*` database on the existing PostgreSQL server and a clean child
  environment containing no production provider credentials. All 22 tests
  across the 20 integration files passed with zero failures or skips. The
  temporary database was dropped in a `finally` cleanup, and an independent
  post-run query confirmed zero `rivt_it_%` databases remain. Production schema
  and records were not altered. Final local build, lint, unit, and browser-gate
  totals are recorded after the launch-hold and E2E isolation follow-up.
- Follow-up commit `854eef63b4d169746faf87157aaa9f3c1345329d`
  corrected JSON value replay in logical restores. Railway deployment
  prefix `0b020e13` served that exact source and public `/api/health` returned
  `ok: true`.
- The operational launch checker now fails closed while this incident remains
  open. `incident:readiness` still passes the standing routing configuration,
  while `launch:readiness --require-ready` exits nonzero with
  `ACTIVE_LAUNCH_HOLD`. The hold is recorded in
  `docs/operations/incident-routing.json` and may be cleared only after every
  exit criterion in this incident record is verified.
- Final local verification passes production build, application and security
  lint, 137 unit/frontend tests, and the complete three-journey browser E2E
  chain twice consecutively. The E2E harness now uses strict ports and waits
  for each local server to exit, preventing one journey from leaking into the
  next. `npm audit --omit=dev` reports zero vulnerabilities, and diff integrity
  passes.
- Earlier containment deployment `4af32f02-fd17-4899-9b62-74ac4c565590`
  succeeded from a clean archive of commit
  `a3be803cc5ad2563d100870663dbf6dc51307126`. The expected-source production
  monitor passed in 730 ms with that exact commit, PostgreSQL and S3-compatible
  storage healthy, Sentry, Web Push, and Stripe Connect Accounts v2 configured,
  matching-job alerts enabled, operational controls open, and seven anonymous
  private-route checks closed. This deployment created no new service, bucket,
  volume, payment, or production-data mutation.

## PostgreSQL credential rotation evidence

- The RIVT app's `DATABASE_URL` was a hardcoded private Railway internal URL,
  not a managed service reference. No URL or credential value was recorded.
- Before any database credential change, a transaction executed from the
  production container, created a temporary table, inserted and read a test
  value, and rolled back successfully.
- The app's `DATABASE_URL` was changed to the nonsecret Railway reference
  `${{Postgres.DATABASE_URL}}`. RIVT deployment
  `57200994-0a49-4561-a4cd-44b101bddc0f` succeeded on commit
  `ae6cc63321df70d322a63d4c821e721a2ddedf52`; health remained green and a
  second production-container temporary-table insert/read/rollback passed.
- Railway Database Config's built-in **Regenerate Password** action superseded
  the prior PostgreSQL credential. PostgreSQL deployment
  `f3e84068-3973-4d16-9614-dad4c8a74792` succeeded in place with the same data
  and attached volume. It created no replacement database or paid resource.
- RIVT deployment `cc76aae6-9098-4901-a939-438309efd776` then succeeded on the
  same commit. Public health returned `ok: true`, migration ready, database
  `postgres`, and object storage `s3-compatible`.
- A final production-container transaction created a temporary table, inserted
  and read a test value, and rolled back successfully after rotation. Across
  all three database checks, no permanent data, payment, paid resource, or
  secret-bearing output was created.
- PostgreSQL is rotated and the prior credential is superseded. The incident
  remains open and Railway Stage 1 remains paused.

## Object-storage credential rotation evidence

- The exact production target was Railway bucket `rivt-private`, bucket ID
  `83403a81-f912-431e-b0fc-40a238f347e8`.
- RIVT variables `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` were converted
  from copied values to the nonsecret managed references
  `${{rivt-private.ACCESS_KEY_ID}}` and
  `${{rivt-private.SECRET_ACCESS_KEY}}`. RIVT deployment
  `ab392f35-04b0-464f-87cc-6146ebaf71fc` succeeded on exact source
  `ae6cc63321df70d322a63d4c821e721a2ddedf52`.
- Before reset, a read-only check authenticated successfully, reported 88
  objects totaling 40,385,070 bytes, and downloaded one existing 35-byte
  object whose received size matched its recorded size. It created, overwrote,
  and deleted nothing.
- Railway bucket credentials were reset exactly once. The reset immediately
  invalidated the prior copied access pair. RIVT deployment
  `4010a6b9-891a-4d87-9a25-a8cb93c64ee2` then succeeded on the same exact
  source.
- Public post-reset health returned `ok: true`, migration ready, database
  `postgres`, and object storage `s3-compatible`. A second read-only check
  authenticated with the replacement credentials, again reported 88 objects
  totaling 40,385,070 bytes, and downloaded an existing 35-byte object with a
  matching received size. The Railway UI confirmed both managed references
  persisted after deployment.
- No new service, bucket, or object was created, and no object was overwritten
  or deleted. Write capability was intentionally not exercised because the
  approval was explicitly read-only. The work remained within the approved
  $0.10 operational ceiling; no exact measured cost is claimed.
- Runtime maintenance remains a fast-follow rather than an incident blocker:
  the repository pins Node 20, while the AWS SDK will require Node 22 after
  January 2027. Upgrade and reverify Node 22 before that support boundary.
- Object-storage credentials are rotated. The incident remains open and
  Railway Stage 1 remains paused.

## Stripe API key rotation evidence

- Human verification completed and a replacement production server key was
  created without exposing its value in this record.
- Railway deployment `54b5dcfc-1a94-4fae-bfca-423fe5ed9a47` succeeded on
  commit `ae6cc63321df70d322a63d4c821e721a2ddedf52`.
- Public health remained green with invoice bank payments configured.
- A read-only Stripe account request authenticated with HTTP 200 using the
  replacement key.
- The superseded production key was expired only after the replacement passed
  both deployment health and direct provider authentication.

## Stripe Connect webhook rotation evidence

- Stripe Connect webhook signing-secret rotation completed after a
  defense-in-depth final re-roll.
- Final Railway cutover deployment
  `6eded406-8c0e-4abc-adf4-cbe61408025d` succeeded on commit
  `ae6cc63321df70d322a63d4c821e721a2ddedf52`.
- Public health was green: migration ready, PostgreSQL, S3-compatible storage,
  Web Push configured, and invoice bank webhook configured.
- Both cutover attempts were checked with deliberately unknown, locally signed
  no-charge/no-payment probes. The final probe returned HTTP 200 with
  `{"received":true,"duplicate":false}`. The checks left two clearly named
  idempotency-ledger records.
- Stripe provider inventory now confirms the prior Connect signing secret is
  expired; only the active replacement remains usable.
- Stripe live API key rotation is complete.
- The incident remains open and Railway Stage 1 remains paused.

## Resend credential rotation evidence

- A replacement least-privilege sending credential was configured for the
  verified `rivt.pro` sending domain and deployed without recording its value.
- A proof email sent with the replacement credential reached an
  owner-controlled inbox.
- The superseded Resend key was deleted after delivery proof. The provider
  dashboard confirmed deletion with its success toast, and key inventory then
  showed one replacement key remaining.
- Email credential rotation is complete. The broader incident remains open and
  Railway Stage 1 remains paused.

## Authentication metadata pepper evidence

- The authentication metadata pepper was replaced in production. It protects
  privacy-preserving request metadata and rate-limit subject hashes; it is not
  a password or session-encryption key.
- The application has no previous-pepper fallback, so replacing the production
  value removed the exposed value from active use. Exact-source production
  health remained green.
- The broader incident remains open and Railway Stage 1 remains paused.

## Google OAuth credential rotation evidence

- The Google provider UI verifies that `support@rivt.pro` owns production
  project `rivt-499402`. Production-project owner access is no longer a
  blocker.
- Two unused replacement-secret candidates were deleted in the provider before
  either was installed. No value from those candidates or the final replacement
  is recorded in repository evidence.
- The final replacement is installed in Railway deployment
  `0898208b-707f-49c3-b9b9-d0938e157542`, which succeeded on exact source
  `04f13e006cae545a33002d2225f90ab0d8b7e9c9`.
- Public `/api/health` returned `ok: true` with the expected source,
  PostgreSQL, and S3-compatible storage. The secret-safe
  `/api/auth/providers` probe reported Google configured with no missing
  fields and session security healthy. The expected-source production monitor
  passed.
- The owner-controlled authorization-code callback proof is recorded in the
  callback section below.
- The production monitor now fails closed unless Google OAuth, server-side
  session security, and Sentry error monitoring all report configured. The
  enhanced expected-source monitor passed against the current production
  deployment in 562 ms.
- After callback proof, the prior secret created June 13 was disabled and then
  deleted in the provider on July 30. Final provider inventory contains exactly
  one enabled secret: the July 30 replacement. Google OAuth secret rotation is
  complete. The broader incident and `ACTIVE_LAUNCH_HOLD` remain open for
  unrelated remaining evidence.

## Web Push VAPID rotation evidence

- The active/previous delivery bridge was deployed before the VAPID rotation so
  already opted-in subscriptions could move without pretending delivery had
  been proven.
- The incident owner confirmed that a real alert reached an already opted-in
  owner-controlled physical device. This is the measured migration boundary
  required before retiring the previous pair.
- `VAPID_PREVIOUS_PUBLIC_KEY` and `VAPID_PREVIOUS_PRIVATE_KEY` were deleted
  from Railway configuration. Railway deployment
  `a29ff982-c10c-4ec3-b8e6-9fd323e65837` succeeded on exact source
  `599c352b3c69592a8afcf1182e73e8ebbce5dfdb`.
- Secret-safe runtime checks report the active public/private pair present and
  both previous-key variables absent. No key value was printed or recorded.
- The expected-source production monitor passed in 592 ms with PostgreSQL and
  S3-compatible storage healthy, Sentry, Web Push, and Stripe Connect Accounts
  v2 configured, matching-job alerts enabled, operational controls open, and
  seven anonymous private-route checks closed.
- VAPID rotation and previous-key retirement are complete. The broader
  incident remains open for Sentry and the remaining bounded
  provider/data-access review; Railway Stage 1 remains paused.

## Google OAuth callback evidence

- Railway deployment `0898208b-707f-49c3-b9b9-d0938e157542` continues to
  serve exact source `04f13e006cae545a33002d2225f90ab0d8b7e9c9` with the
  final replacement Google client secret installed.
- A first owner-controlled callback at 14:16:37 UTC on July 30 used an OAuth
  transaction that had remained open beyond RIVT's 10-minute lifetime. It
  redirected to the honest authentication error in 10 ms, before a provider
  token exchange, and is not counted as credential proof.
- A completely fresh journey for `zboytjbxp@gmail.com` then completed at
  14:18:31 UTC. The callback returned its redirect in 131 ms, established the
  server session, and the controlled browser rendered the authenticated RIVT
  Home workspace. No password, token, code, cookie, or secret was recorded.
- The replacement credential is proven. The prior secret created June 13 was
  disabled and then deleted in the provider on July 30. Final provider
  inventory contains exactly one enabled secret: the July 30 replacement.
- A second fresh owner-controlled Google sign-in completed after retirement
  and rendered the authenticated RIVT Home workspace. This proves the remaining
  replacement still serves production authorization-code callbacks after the
  prior secret's deletion.
- At approximately 14:33 UTC on July 30, production `/api/health` returned
  `ok: true`, `/api/auth/providers` reported Google configured, and
  `npm run monitor:production` passed against build
  `04f13e006cae545a33002d2225f90ab0d8b7e9c9`.
- Google OAuth secret rotation is complete. The overall incident and
  `ACTIVE_LAUNCH_HOLD` remain open for unrelated remaining evidence.

## Backup-encryption rotation and restore evidence

- Active/previous key-ring compatibility was deployed before rotating the
  backup-encryption key. New backup writes use only the active key; the previous
  key is decrypt-only during the transition.
- Follow-up commit `854eef63b4d169746faf87157aaa9f3c1345329d`
  fixed JSON value replay in logical restores. Railway deployment
  prefix `0b020e13` served that source and public `/api/health` returned
  `ok: true`.
- A fresh active-key backup identified by timestamp
  `2026-07-30T03-58-45.931Z` restored into an isolated temporary database with
  109 tables and 8,768 rows. Manifest comparison returned zero differences,
  and an independent critical-table source/target comparison also returned
  zero differences.
- The 2026-07-29 legacy backup was restored into an isolated temporary database
  while the active-key input was deliberately nonmatching and the previous key
  was supplied. It restored 109 tables and 8,760 rows with zero manifest
  differences, proving the intended previous-key recovery path rather than an
  accidental active-key success.
- The retained 2026-07-25 legacy artifact, whose source commit was
  `3b827444137356f367a97cc941d7a25f6d7f51d5`, also restored through the
  previous-key path. The isolated target reported migration
  `0028_compensation_workflow`, 82 tables, 7,028 rows, and zero manifest
  differences. The independent critical-table drill passed, and the temporary
  restore bundle was removed afterward.
- `BACKUP_ENCRYPTION_KEY_PREVIOUS` was deleted from Railway configuration.
  Railway deployment prefix `b9920864` then served commit
  `854eef63b4d169746faf87157aaa9f3c1345329d`; public health returned `ok: true`.
  Post-deployment runtime checks reported `primaryPreviousPresent=false` and
  `aliasPreviousPresent=false`, proving that the running process no longer
  carries either supported previous-key alias. The previous backup key is
  retired.
- `RESTORE_DATABASE_URL` was also deleted from Railway configuration.
  Follow-up Railway deployment prefix `638e213e` succeeded on the same exact
  commit, public health returned `ok: true`, and runtime checks confirmed the
  restore URL and both previous-key aliases absent.
- Temporary restore service `Postgres-rq6Q`, service-ID prefix `84b`, was
  deleted and is absent from the project service inventory. Its attached
  volume, ID prefix `d3c`, was explicitly deleted and reports
  `isPendingDeletion=true` with `deletedAt`
  `2026-08-01T04:21:26.274Z`. Railway keeps that volume recoverable during its
  deletion window, so physical removal is not yet claimed.
- Backup restore coverage now proves fresh active-key writes and the named
  2026-07-29 and 2026-07-25 previous-key artifacts, and the previous backup key
  is retired. The broader incident remains open and Railway Stage 1 remains
  paused until the remaining credential blockers are verified.

## Stripe billing webhook rotation evidence

- Stripe billing webhook signing-secret rotation completed for endpoint
  `https://rivt.pro/api/stripe/webhook`, using Railway variable
  `STRIPE_WEBHOOK_SECRET`, and destination ID
  `we_1TnpZWIz6JDg8LdahYHPwX0o`.
- The replacement was created with a one-hour overlap. Stripe provider
  inventory now confirms the prior signing secret is expired.
- Railway deployment `d44d4449-f13e-477c-8fa6-182d8aa21282` succeeded on
  commit `ae6cc63321df70d322a63d4c821e721a2ddedf52`.
- Public `/api/health` returned `ok: true`, reported the expected `ae6cc63`
  commit prefix, and showed migration ready, database `postgres`, and object
  storage `s3-compatible`.
- Harmless locally signed unknown event probe
  `evt_rivt_webhook_rotation_probe_1785380796626` returned HTTP 200 with
  `{"received":true,"duplicate":false}`. It created one permanent
  `billing_events` idempotency/evidence row but made no Stripe API call and
  caused no charge, refund, customer, subscription, invoice, analytics, or
  business-state change. No paid resource was created.
- The incident remains open and Railway Stage 1 remains paused.

## Operator-tooling containment evidence

- The local production-smoke wrapper no longer calls Railway's whole-service
  variable-list operation. It now accepts only a temporarily supplied,
  explicitly named public database URL and, when separately enabled, the named
  storage values required for cleanup.
- The wrapper removes the public database aliases from the child environment
  and excludes storage credentials unless storage cleanup is explicitly
  requested. Operator guidance requires clearing every temporary value after
  the command, including after failure.
- A security unit test recursively scans executable scripts and CI workflows
  and fails if a Railway whole-environment enumeration command is introduced.
  The focused security suite passes 27/27.
- This satisfies the technical-prevention follow-up for operator workflows.
  It does not clear the incident or launch hold; provider rotations, bounded
  access-log review, and final Stage 1 re-review remain open.

## Structured-log containment evidence

- The central application logger now applies recursive redaction immediately
  before structured records are serialized. Sensitive key names, direct
  customer PII, credential-bearing URLs, authorization values, private-key
  blocks, common provider-key shapes, and email addresses embedded in
  provider/database error text are removed.
- Circular values no longer make defensive logging fail, and caller-supplied
  fields cannot overwrite the logger's real severity, event, service, or
  timestamp. Request IDs, account IDs, provider object IDs, statuses, counts,
  and migration names remain available for operations.
- Focused regression coverage proves protected values are absent from the
  serialized line and legitimate operational fields remain intact. The
  logger tests, security lint, and all 140 unit/frontend checks pass.
- The Sentry event constructor now reuses those same field-name and string
  redaction boundaries before serializing exception messages, stack frames,
  nested context, and tags. A regression reproduces the former leak with a
  browser-report-shaped error containing provider keys, authorization data,
  credential-bearing URLs, query secrets, and email addresses; none survive
  in the captured Sentry request while request IDs and safe operational context
  remain available. Current-head verification passes 141 unit/frontend tests,
  build, application/security lint, the complete browser E2E chain, and the
  production dependency audit with zero known vulnerabilities.
- The redaction fix is live at source
  `ecd6af85d94f3f907ccdecf07c600356f34613fc` through Railway deployment
  `fbcd0e9c-aead-4c91-926b-0be7d27161d1`. Exact-source public health passed,
  and the production monitor passed in 645 ms. Railway incident `OA5Z6SQY`
  delayed the build queue without interrupting the prior healthy release. No
  live secret or customer data was injected to prove redaction; the
  deterministic regression is the proof.
- A secret-safe read-only check inside the running production container found
  the intended `SENTRY_DSN` variable configured and the legacy
  `ERROR_MONITORING_DSN` alias absent. This is configuration-shape evidence
  only; it does not rotate the pending Sentry key or prove replacement-event
  ingestion.
- This is defense in depth. Call sites must still avoid arbitrary user text,
  and this change cannot retroactively remove values from historical provider
  logs or prove that every future unidentified PII shape will be recognized.

## Bounded access-log review evidence

- A secret-safe Railway review of the current RIVT deployment covered 101 HTTP
  requests from 11:16 through 13:33 UTC on 2026-07-30: 55 successful
  responses, 15 redirects, 31 expected client-denial responses, zero server
  errors, zero upstream failures, and no response larger than 5 MB. Raw source
  addresses and request details remain inside Railway and are not recorded
  here.
- The production application audit ledger since July 29 contains two account
  signups and two onboarding completions across two authenticated actors, with
  no system-generated audit action. This is a bounded application-ledger
  observation, not proof about activity that the application did not log.
- PostgreSQL logs after credential rotation, covering 03:23 through 13:04 UTC
  on July 30, contain no authentication failure, `FATAL`, or `PANIC` event.
  Secret-safe template classification accounts for the full error-shaped set:
  20 expected append-only audit-trigger rejections, four expected check-
  constraint validation failures with their 24 statement-context records,
  12 SSL unexpected-EOF connection closures, and one Railway collation-refresh
  temporary-file permission error.
- The immediately preceding PostgreSQL deployment was separately reviewed from
  23:00 UTC on July 29 through the 03:23 UTC credential cutover. Its 66 log
  records contain no authentication failure, `FATAL`, or `PANIC` event:
  five expected append-only audit-trigger rejections, one expected read-only
  transaction rejection, one expected check-constraint validation failure,
  seven statement-context records, and 10 SSL unexpected-EOF closures.
- PostgreSQL historical forensic coverage is limited: connection,
  disconnection, statement-duration, and statement auditing were not enabled,
  and `pgaudit` was not installed. Successful historical connections, reads,
  and writes therefore cannot be reconstructed reliably.
- Railway Buckets do not provide the project with historical per-object access
  logs, versioning, or object locks, and RIVT does not yet emit its own
  object-operation audit events. Stable object count/bytes and successful
  continuity reads do not prove that an exposed credential was never used for
  a direct read.
- A design-only
  [object-storage audit hardening portfolio](../hardening/object-storage-audit/hardening.md)
  recommends routing application object operations through one gateway backed
  by the existing append-only `audit_events` ledger. It explicitly separates
  that no-new-service application control from later provider/external
  immutable logging whose cost, privacy, residency, and retention have not
  been approved. No part of that proposed design is represented as implemented.
- No misuse indicator has been identified in the evidence reviewed so far.
  The bounded PostgreSQL error review is complete for the repository-backed
  incident window, subject to the historical auditing limitation above. The
  review remains open for provider logs and the unavoidable database/object-
  storage forensic limitations. The incident is not represented as proof of
  no access or no exfiltration.

## Recovery plan

Follow
[`CREDENTIAL_ROTATION_RUNBOOK.md`](../CREDENTIAL_ROTATION_RUNBOOK.md).
Deploy and verify the narrow compatibility hotfix before rotating the
backup-encryption or VAPID keys. Rotate one provider at a time, verify the new
credential, then revoke the old credential. Never restore a compromised
credential during application rollback.

## Exit criteria

This incident remains open until:

- the hotfix is verified and exact-source production health passes;
- every exposed provider-managed credential has been replaced and the old
  credential has been revoked or disabled;
- application-generated secrets have been replaced and removed from active use;
- previous backup/VAPID material is constrained to transition-only use and then
  retired at a measured safe boundary; if either remains configured, the
  incident may be contained but not closed;
- authentication, database, storage, email, payments/webhooks, OAuth, Web Push,
  monitoring, and backup restore access are verified without printing secrets;
- the existing backup artifact is still recoverable through the approved
  previous-key path;
- provider, PostgreSQL, and object-access logs have been reviewed for
  unauthorized access or exfiltration;
- the incident record contains only nonsecret evidence and timestamps;
- a follow-up prevents secret-bearing environment enumeration in operator
  workflows; and
- Stage 1 is re-reviewed against its new exact source and configuration.

## Evidence rules

Record provider name, action time, operator, result, exact deployed source, and a
nonsecret provider identifier or fingerprint where available. Never record a
credential value, database URL, signing secret, private key, recovery code,
presigned object URL, session cookie, or full authorization header.
