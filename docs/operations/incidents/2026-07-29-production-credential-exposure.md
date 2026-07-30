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
- Approved incremental cost: $0; stop before any quoted or usage-based charge

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
| PostgreSQL | Pending | None yet |
| Stripe API | Blocked | Live API key rotation was not completed; Stripe remained at the human-verification/CAPTCHA spinner |
| Stripe billing webhook | Pending | Rotation not yet completed |
| Stripe Connect webhook | Rotated; prior secret retirement scheduled | Final Railway cutover deployment `6eded406-8c0e-4abc-adf4-cbe61408025d` succeeded on commit `ae6cc63321df70d322a63d4c821e721a2ddedf52`; final no-charge/no-payment probe accepted |
| Google OAuth | Pending | None yet |
| Resend | Pending | None yet |
| Object storage | Pending | None yet |
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
- Stripe live API key rotation remains blocked at Stripe's
  human-verification/CAPTCHA spinner and was not completed. Stripe billing
  webhook rotation remains pending.
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
