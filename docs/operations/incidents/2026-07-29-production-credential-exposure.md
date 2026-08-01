# Production Credential Exposure - 2026-07-29

- Status: contained; closure, payment-provider closure, reviewed deployment, final approval, and strict Stage 1 preflight remain open
- Severity: critical
- Environment: Railway production
- Incident owner: Michael
- Source at detection: `92a8451b8190f5119384a4970fb1a324503df995`
- Detected at: between `2026-07-29T19:01:00-04:00` and
  `2026-07-29T21:42:25-04:00` (repository-bounded; exact operator-observed time
  was not recorded)
- Declared at: `2026-07-29T21:42:25-04:00` (first formal repository
  declaration; any earlier verbal declaration is unverified)
- Last updated: 2026-07-31 America/New_York
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

No unauthorized use is currently known. The bounded Stripe platform-account
and configured production destination/delivery views, Resend, Sentry, Google
Cloud audit/activity, Railway workspace audit/deployment history, application-
ledger, and retained PostgreSQL evidence reviewed so far contain no identified
misuse indicator within their named query and retention bounds.
Historical
successful PostgreSQL access and direct bucket reads cannot be reconstructed,
and several application-generated secrets have no provider audit trail. RIVT
therefore cannot prove that no historical access or exfiltration occurred.
Because transcript confidentiality cannot be used as a security boundary,
every exposed credential is treated as compromised.

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
| Stripe Connect webhook | Rotated for the existing `Your account` destination; prior secret retired | Final Railway cutover deployment `6eded406-8c0e-4abc-adf4-cbe61408025d` succeeded on commit `ae6cc63321df70d322a63d4c821e721a2ddedf52`; a locally signed no-charge/no-payment probe was accepted and provider inventory confirms the prior secret expired. This did not prove Stripe delivery for connected contractor accounts. |
| Google OAuth | Rotated; prior secret deleted | Provider UI verifies `support@rivt.pro` owns project `rivt-499402`; the June 13 secret was disabled and then deleted on July 30; final provider inventory contains exactly one enabled July 30 replacement; Railway deployment `0898208b-707f-49c3-b9b9-d0938e157542` serves exact source `04f13e006cae545a33002d2225f90ab0d8b7e9c9`; health, provider-configuration, callback, and production-monitor checks pass |
| Resend | Rotated; prior key deleted | Replacement sending-only key is restricted to `rivt.pro`; a proof email was delivered; the provider dashboard confirmed deletion of the prior key and shows one replacement key remaining |
| Object storage | Rotated; prior copied pair invalidated | Railway bucket `rivt-private` (`83403a81-f912-431e-b0fc-40a238f347e8`) retained identical object count and bytes across the one-time reset; both managed references persisted; deployment `4010a6b9-891a-4d87-9a25-a8cb93c64ee2` and an existing-object read passed |
| Web Push VAPID | Rotated; previous pair retired | An already opted-in owner-controlled physical device received a real alert through the transition bridge; both previous-key variables were then removed, Railway deployment `a29ff982-c10c-4ec3-b8e6-9fd323e65837` succeeded, and the running service reports the active pair present and previous pair absent |
| Backup encryption | Rotated; previous key retired | Fresh active-key artifact `2026-07-30T03-58-45.931Z`, the 2026-07-29 legacy artifact, and the retained 2026-07-25 artifact all restored without count differences; deployment prefix `638e213e` is healthy on commit `854eef63b4d169746faf87157aaa9f3c1345329d`, and runtime checks report the restore URL and both previous-key aliases absent |
| Authentication metadata pepper | Rotated | Replacement is deployed; the old value has no compatibility fallback and is no longer configured for active use |
| Sentry DSN | Rotated; prior key disabled | Replacement key `RIVT production replacement 2026-07-31` is the only enabled production key used by Railway; deployments `599620ce-18fc-4e86-b638-88283dd18857` and `c6ddf9c8-91a3-4953-a47c-70c72deb154e` succeeded; exact-source event `52d1e8add9f7492eb440de033209da0e` was indexed as a high-priority production issue and triggered the existing alert; the prior `Default` key was disabled; post-retirement event `7ed1315e474448ce9807dbb4bd6bf420` was then accepted and indexed |

## Immediate containment

- Removed the temporary local output file.
- Stopped all secret-enumerating Railway commands.
- Paused the previously approved Railway Stage 1 activation. That approval is
  expired and unusable; no changed or current source, configuration, evidence,
  cost, or activation inherits it.
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
- The rotated signing secret belongs to the existing `Your account`
  destination. Local signature acceptance proves only RIVT's verifier and does
  not prove that Stripe will send connected-contractor account events to it.
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
- VAPID rotation and previous-key retirement are complete. At this stage of the
  response, Sentry and the remaining bounded provider/data-access review were
  still open. Sentry was completed later; the current open boundaries are
  listed in the provider-review synthesis below. Railway Stage 1 remains
  paused.

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
  At this stage of the response, provider rotations and bounded access-log
  review were still open. Rotations were completed later; the current open
  boundaries are listed in the provider-review synthesis below. This work does
  not clear the incident or launch hold. Combined local source review is now
  complete; exact-runtime CI, Stripe delivery remediation, final approval, and
  strict activation preflight remain open.

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
  only; at that stage it did not rotate the then-pending Sentry key or prove
  replacement-event ingestion. The later provider rotation and proof are
  recorded below.
- This is defense in depth. Call sites must still avoid arbitrary user text,
  and this change cannot retroactively remove values from historical provider
  logs or prove that every future unidentified PII shape will be recognized.

## Sentry DSN rotation evidence

- A replacement client key named
  `RIVT production replacement 2026-07-31` was created in the existing
  `node-express` project. The prior `Default` key remained enabled during the
  cutover; no project, organization, plan, or paid resource was created.
- Railway deployment `599620ce-18fc-4e86-b638-88283dd18857` installed the
  replacement DSN on source
  `eca3a5caa08a9961a60e516551e465d5473139aa`. Follow-up deployment
  `c6ddf9c8-91a3-4953-a47c-70c72deb154e` serves the exact verifier-hardening
  source `f505e5fcdd9874a172bb61b59ab083a2ff86e6d0`. Public health reported
  `ok: true`, migration `0042_push_vapid_generation` ready, PostgreSQL and
  S3-compatible storage healthy, and Sentry configured. The exact-source
  production monitor passed in 590 ms.
- The verifier fails closed unless it runs in production against an exact
  40-character deployed source. It prints no DSN. If provider delivery is
  ambiguous, it now preserves only a safe unique marker, timestamp,
  environment, and source commit so the operator can search Sentry before
  retrying.
- The first replacement-key proof was accepted as event
  `52d1e8add9f7492eb440de033209da0e`, indexed in environment `production` on
  release `f505e5fcdd98`, and marked High priority. The existing rule
  `Send a notification for high priority issues` recorded one alert for that
  exact marker at `2026-07-31T04:13:00Z`.
- Only after that exact event and alert were visible was the prior `Default`
  client key disabled. A second unique post-retirement proof was accepted as
  event `7ed1315e474448ce9807dbb4bd6bf420` and indexed in production on the same
  exact release, proving the running service still reaches Sentry through the
  enabled replacement. Because Sentry grouped the two verifier events into
  one already-high issue, the second event was ingestion proof and did not
  create a second alert transition.
- Sentry's audit log shows only the expected replacement-key creation/rename
  and prior-key disable actions during the incident window. Fourteen-day
  provider usage reported 20 accepted errors, zero filtered errors, zero
  rate-limited errors, zero invalid errors, and no significant two-hour spike.
  No misuse indicator was identified in those available records. This does
  not prove that an exposed ingestion DSN was never used; it establishes that
  no anomalous key-management action or volume spike is visible in the
  provider evidence available to this account.
- Local verification passed production build, application lint, 158
  unit/frontend tests, all three browser E2E journeys, diff integrity, and the
  production dependency audit with zero known vulnerabilities. The aggregate
  local integration command passed its three database-independent checks and
  skipped 19 database-backed checks because `TEST_DATABASE_URL` was absent;
  the most recent isolated CI run remains the 22/22 PostgreSQL integration
  proof recorded above.
- Sentry credential rotation is complete. The broader incident and
  `ACTIVE_LAUNCH_HOLD` remain open. Combined local source review is complete;
  exact-runtime CI, Stripe delivery remediation, fresh Stage 1 evidence and
  approval, and strict preflight remain required.

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
- No misuse indicator has been identified in the bounded evidence reviewed.
  The PostgreSQL error review is complete for the repository-backed incident
  window, subject to the historical auditing limitation above. Provider review
  status and remaining blind spots are enumerated below. The incident is not
  represented as proof of no access or no exfiltration.

## Provider-review synthesis (bounded review complete; incident open)

The exposure review window begins at the conservative repository bound
`2026-07-29T23:01:00Z`. The conservative latest repository-evidence upper bound
for the Stripe credential retirements is `2026-07-30T03:08:57Z`; the wider
application-ledger review continues through the recorded owner-acceptance time
`2026-07-31T12:22:03.895Z`.

Codex completed the initial read-only review at `2026-07-31T13:07:24.122Z`,
the Railway follow-up at `2026-07-31T19:10:46.1221413Z`, and the Google Cloud
follow-up at `2026-07-31T19:32:50.0134267Z` under Michael's incident
authorization against deployed production source
`f505e5fcdd9874a172bb61b59ab083a2ff86e6d0`. No provider setting, credential,
customer record, payment, deployment, or paid resource was changed. Provider
identifiers used for the review were the live-mode RIVT Stripe account
`acct_1TnnyAIz6JDg8Lda`, Resend domain `rivt.pro`, Sentry project
`node-express`, Google Cloud project `rivt-499402`, Railway service `RIVT`, and
Railway bucket `83403a81-f912-431e-b0fc-40a238f347e8`.

| Credential/provider | Evidence reviewed | Bounded result | Remaining limit/status |
|---|---|---|---|
| Stripe API, Billing, and Connect | Live-mode Workbench request and `Your account` event views, active-key and production-destination inventory, the selected ACH destination's Overview and Event deliveries views, suspicious-activity view, and aggregate read-only production billing/invoice/payment reconciliation | The only API request visible in the bounded incident window was the controlled replacement-key `GET /v1/account` at `2026-07-30T02:55:35Z` (July 29 EDT). No `Your account` event was visible from `2026-07-29T23:01:00Z` through `2026-07-30T03:08:57Z`, and the suspicious-activity view contained zero cases. The production ACH destination is scoped to `Your account`; no `Connected accounts` destination is configured. Its Event deliveries view reported `No event deliveries found`, and its Overview reported total `0` for `This week`. Within the named aggregate database queries, the only matching event rows were one controlled billing rotation probe and two controlled unknown/no-charge Connect rotation probes; no additional webhook row, recorded billing/invoice audit action, or nonzero reconciliation counter was found. | **Reviewed/bounded for the platform account, current production destination inventory, selected-destination delivery view, and retained application tables.** The absence of a separate `Connected accounts` destination means there was no separate configured destination delivery view to inspect; it is not proof that no Connect-side activity occurred outside retained or logged evidence. |
| Resend | Available 15-day API/email logs and active-key inventory, reviewed through `2026-07-31T13:07:24.122Z` | The retained window fully covers the incident interval. Its incident-window records are the expected sending-only key restriction check (`401`) and controlled delivery proof. Earlier visible sends predate exposure and are consistent with documented verification/UI tests. Exactly one sending-only replacement key remains. | **Reviewed/bounded.** No unexplained provider activity was found in the available log window. |
| Sentry | Provider audit log, key inventory, event ingestion, alert proof, and 14-day usage | Only expected replacement-key creation/rename and prior-key disable actions were present; usage showed no significant spike and zero filtered, rate-limited, or invalid events. | **Reviewed/bounded.** An ingestion DSN does not provide proof that it was never copied or attempted elsewhere. |
| Google OAuth | Credential inventory and controlled callbacks from the rotation; aggregate read-only application identity/login/transaction reconciliation; and Google Cloud Logs Explorer queries under the founder-controlled support account for project `rivt-499402` | The application ledger has zero Google identity creation/update or Google login during the exposure window, zero pending OAuth transactions, and one post-retirement login/update matching the controlled physical sign-in. The exact `2026-07-29T23:01:00Z` through `2026-07-30T03:08:57Z` query returned zero retained entries across the Admin Activity, Data Access, System Event, and Policy Denied log IDs. The post-window query through `2026-07-30T15:00:00Z` returned nine Client Auth Configuration API events for the same OAuth client: three `AddClientSecret`, three `UpdateClientSecret`, and three `DeleteClientSecret`, all attributed to the founder-controlled support account and consistent with the documented replacement/cleanup sequence. No other actor or method appeared in that query. | **Reviewed/bounded for the queried retained audit entries.** Zero matching entries does not prove no OAuth authorization-code or token exchange occurred, no action occurred outside the queried/logged event types, or no historical access occurred. The presence or completeness of Data Access logging is not inferred from the query. |
| Railway | Pro workspace Audit Logs, paged through the complete `2026-07-29T16:00:00Z` through `2026-07-30T16:00:00Z` filtered view; representative event details; and secret-safe deployment evidence | In the exact `2026-07-29T23:01:00Z` through `2026-07-30T03:08:57Z` exposure window, Railway recorded five `SSHSession.authenticated` events and nine `Deployment.created` events. Every event was attributed to the founder-controlled Railway account; no other actor, variable/configuration change, credential regeneration, service/bucket/volume change, or tunnel event appears in-window. A representative in-window SSH event used the same source IP and SSH-key fingerprint as a controlled July 31 maintenance event, supporting but not proving same-operator attribution. Immediately after the repository upper bound, the same account performed the documented database-password and bucket-credential regenerations. | **Reviewed/bounded for retained workspace actions.** Railway documents that Pro workspace audit logs retain 30 days and cover project/service/deployment/variable/workspace changes. The workspace log does not establish the physical human behind a valid account/key/IP, supply a separate dashboard-login history in this view, or prove that an action outside Railway's logged event set did not occur. |
| PostgreSQL | Retained platform logs plus aggregate read-only application/payment reconciliation | No authentication failure, `FATAL`, or `PANIC` record was found in the retained reviewed windows; canonical billing, invoice, payment-request, direct-payment, and Connect consistency counters were zero. | **Historical evidence unavailable; owner acceptance recorded.** Successful historical connections, reads, and writes cannot be reconstructed. |
| Railway Bucket/object storage | Rotation continuity, stable object count/bytes, restore evidence, and controlled existing-object read | Rotation and continuity passed with no known customer-data loss. | **Historical evidence unavailable; owner acceptance recorded for direct reads.** Historical per-object direct reads cannot be reconstructed. |
| Web Push VAPID private key | Rotation, retirement, outbox/readiness state, and three controlled physical-device deliveries | Current registrations and outbox state are clean and all controlled devices delivered through the active generation. | **Unobservable; owner acceptance recorded at `2026-07-31T19:39:34.5524830Z`.** There is no provider audit trail proving the exposed private key was not used outside RIVT. |
| Backup-encryption key | Rotation, previous-key retirement, and controlled restore proofs | Active and retained artifacts restore successfully; the previous key is absent from runtime. | **Unobservable; owner acceptance recorded at `2026-07-31T19:39:34.5524830Z`.** Existing evidence cannot prove an encrypted artifact and exposed key were never copied or used offline. |
| Authentication metadata pepper | Rotation and runtime/configuration verification | The replacement is active and the old value has no compatibility fallback. | **Unobservable; owner acceptance recorded at `2026-07-31T19:39:34.5524830Z`.** There is no provider ledger for offline correlation attempts using the exposed value. |

This table completes the bounded provider/forensic review. It does not prove
that no historical access, exfiltration, token exchange, or offline secret use
occurred. The Stage 1 sequence has been replayed onto the Packet 87 candidate
and the combined local gates pass. The incident and launch hold remain open
pending final exact-source security review, exact-runtime CI, Stripe delivery
remediation, fresh plan / provider / cost / recovery evidence, a new exact-plan
approval, and a passing strict preflight. Deployment and Stage 1 activation
remain separately authorized actions.

The aggregate database review used a repeatable-read, read-only transaction over
the named billing, subscription, entitlement, invoice, payment-request,
direct-payment, Connect, OAuth-identity, and audit tables. It selected counts and
timestamps rather than raw payloads or customer identifiers. `billing_events`
is an idempotency table rather than an append-only forensic ledger, duplicate
deliveries may be discarded, and current-state tables cannot reconstruct a
historical direct database mutation that left no retained row. A zero aggregate
counter therefore means no inconsistency was present in the queried retained
state; it is not proof that an action absent from those tables never occurred.

## Incident-owner acceptance of forensic limits

- At `2026-07-31T12:22:03.895Z`, incident owner Michael stated: "I accept that
  all available provider evidence was reviewed and no misuse indicator was
  found, but historical successful PostgreSQL access and direct bucket reads
  cannot be reconstructed. RIVT cannot honestly prove that no historical access
  or exfiltration occurred."
- Later reconciliation found the statement's provider-review premise incomplete.
  Therefore only its PostgreSQL/direct-bucket historical limitation remains
  valid closure evidence. The overall conclusion also remains: RIVT makes no
  claim that historical access or exfiltration did not occur.
- This acceptance closes only the PostgreSQL/direct-bucket forensic-limit
  requirement. It does not accept the VAPID, backup-key, or authentication-
  pepper blind spots; reconstruct missing history; lower the incident severity;
  close the incident; clear `ACTIVE_LAUNCH_HOLD`; authorize deployment; or
  approve paid infrastructure work.
- At `2026-07-31T19:39:34.5524830Z`, incident owner Michael stated: "I accept
  these three forensic limits: RIVT cannot prove the retired VAPID private key
  was never used outside RIVT; cannot prove an encrypted backup and retired
  backup key were never copied and used offline; and cannot prove the retired
  authentication metadata pepper was never used offline. This acceptance does
  not prove no misuse occurred and does not authorize deployment or added
  cost."
- This second acceptance closes only the three named unobservable-secret owner-
  decision requirements. It does not reconstruct missing evidence, prove that
  no misuse occurred, close the incident, clear `ACTIVE_LAUNCH_HOLD`, authorize
  deployment, or approve cost.
- Combined local source review is complete. Formal exact-source security scan,
  exact-runtime CI, Stripe delivery remediation, fresh Stage 1 evidence and
  approval, and a passing strict preflight remain required before incident
  closure.

## Exact-source review and provider containment - 2026-08-01

- The sealed exact-source security scan
  `7e499cf8-be43-4b6d-ace9-e61f0978a27c` completed with zero findings and
  `25/25` review coverage for exact range
  `29e3c613f2eb95a6583b52c671275e5046dde0d3` through
  `6c9e803522c3bfd0ff9af1fdd1ba4e02b07e2324`. Commit
  `72e7ad7907d3725ff1232cce9af730e7e577dcfe` records the receipt and is the
  later draft-PR candidate that passed hosted source/database CI; its
  receipt/documentation follow-ups were not represented as sealed scan input.
- GitHub Actions run `30678574155`, job `91310753926`, passed the Node 20
  production build, lint, `252` unit/frontend checks, and PostgreSQL 16
  integration suite (`25/25`). Its later readiness step correctly stopped on
  the still-active incident hold and unapproved payment-provider state; this
  was a fail-closed policy result, not a source or database-CI defect.
- Railway automatic deploys remain disabled and Wait for CI remains enabled.
  The reviewed candidate is pushed only to draft pull request #14 and has not
  been merged or deployed.
- Production invoice bank payments were found unexpectedly enabled and were
  immediately disabled. Public health then reported `enabled:false`,
  `configured:false`, `webhookConfigured:true`, and `mode:setup_required` on
  unchanged production source
  `29e3c613f2eb95a6583b52c671275e5046dde0d3`. A count-only, read-only
  production transaction found zero project or tool invoice payment-request
  rows. No database-backed RIVT payment request was available to reconcile or
  expire; provider-side sessions without a durable row were not enumerated.
- A dedicated Stripe `Connected accounts` destination and signing secret now
  exist, but a real Stripe-signed delivery that causes a matching durable
  payment-state transition has not been proved. Scope attestation remains
  unset, ACH remains disabled, and payment-provider approval remains pending.
  The nonsecret receipt is
  `docs/delivery/evidence/railway-stage1/PROVIDER_CONTAINMENT_2026-08-01.md`.
- The exact-source security-review and hosted source/database-CI exit criteria
  are complete. The incident remains open for payment-provider closure,
  reviewed deployment, final approval, and the remaining exit criteria below.

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
- the recorded previous-key restore proof completed before retirement is
  preserved, and current active-key restore evidence remains valid;
- every row in the provider-review synthesis is either bounded as reviewed or
  has a named owner decision, with incident-owner acceptance recorded for each
  historical limit that cannot be reconstructed;
- the incident record contains only nonsecret evidence and timestamps;
- a follow-up prevents secret-bearing environment enumeration in operator
  workflows; and
- the combined Packet 87 plus Stage 1 exact-source candidate receives final
  independent review and required exact-runtime CI evidence;
- fresh provider snapshot, operator review, cost/recovery plan, owner-approved
  digest, and strict preflight pass; and
- the Stripe `Connected accounts` destination gap is resolved or invoice bank
  payments are demonstrably disabled before launch-hold clearance.

Incident closure alone does not authorize deployment, spending, or Stage 1
activation.

## Evidence rules

Record provider name, action time, operator, result, exact deployed source, and a
nonsecret provider identifier or fingerprint where available. Never record a
credential value, database URL, signing secret, private key, recovery code,
presigned object URL, session cookie, or full authorization header.
