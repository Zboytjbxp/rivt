# Production Credential Exposure - 2026-07-29

- Status: containment in progress
- Severity: critical
- Environment: Railway production
- Incident owner: Michael
- Source at detection: `92a8451b8190f5119384a4970fb1a324503df995`
- Detected at: not yet recorded
- Declared at: not yet recorded
- Last updated: 2026-07-29 America/New_York
- Approved interruption window: up to 30 minutes
- Approved incremental cost: up to $0.10 for the two object-storage
  deployments and read-only validation authorized on 2026-07-29; completed
  work remained within this ceiling, no exact measured cost is claimed, and
  this approval does not extend to other incident actions

## Summary

During an authenticated production-configuration inspection, an operator command
returned production environment-variable values into a restricted automation
transcript. The temporary local output file was removed. No secret value is
included in this record.

No unauthorized use is currently known; provider and audit-log review remains
open. Data-access and exfiltration impact is under investigation, and no
conclusion has been reached. Because transcript confidentiality cannot be used
as a security boundary, every exposed credential is treated as compromised.

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
| Stripe billing webhook | Rotated; prior secret retirement scheduled | Destination `we_1TnpZWIz6JDg8LdahYHPwX0o` at `https://rivt.pro/api/stripe/webhook`; Railway deployment `d44d4449-f13e-477c-8fa6-182d8aa21282` succeeded; harmless probe accepted |
| Stripe Connect webhook | Rotated; prior secret retirement scheduled | Final Railway cutover deployment `6eded406-8c0e-4abc-adf4-cbe61408025d` succeeded on commit `ae6cc63321df70d322a63d4c821e721a2ddedf52`; final no-charge/no-payment probe accepted |
| Google OAuth | Pending | None yet |
| Resend | Pending | None yet |
| Object storage | Rotated; prior copied pair invalidated | Railway bucket `rivt-private` (`83403a81-f912-431e-b0fc-40a238f347e8`) retained identical object count and bytes across the one-time reset; both managed references persisted; deployment `4010a6b9-891a-4d87-9a25-a8cb93c64ee2` and an existing-object read passed |
| Web Push VAPID | Pending | Local compatibility hotfix verified; production deploy pending |
| Backup encryption | Pending | Retained artifact created `2026-07-29T02:56:41Z`; hotfix deploy pending |
| Authentication metadata pepper | Pending | None yet |
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
- Verified the local hotfix with production build, application and security
  lint, 133 unit/frontend checks, three browser E2E journeys, diff integrity,
  rendered mobile-action QA, and a zero-vulnerability production dependency
  audit. Nineteen PostgreSQL suites were skipped because the isolated worktree
  has no test database, so this record does not claim fresh DB-backed
  integration evidence.

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
- The prior Connect signing secret was scheduled for expiry after a one-hour
  overlap. Its scheduled retirement does not close the incident before expiry
  is confirmed.
- Stripe live API key rotation is complete.
- The incident remains open and Railway Stage 1 remains paused.

## Stripe billing webhook rotation evidence

- Stripe billing webhook signing-secret rotation completed for endpoint
  `https://rivt.pro/api/stripe/webhook`, using Railway variable
  `STRIPE_WEBHOOK_SECRET`, and destination ID
  `we_1TnpZWIz6JDg8LdahYHPwX0o`.
- The replacement was created with a one-hour overlap, and the prior signing
  secret was scheduled for expiry. Its expiry has not yet been confirmed.
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
