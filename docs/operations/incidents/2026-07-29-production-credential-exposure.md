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
- Last updated: 2026-08-03 America/New_York
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

## 2026-08-03 recurrence

During a separate read-only deployment-path audit on 2026-08-03, a prohibited
broad Railway production-configuration command again returned rendered live
credential values into restricted automation output. The command was stopped.
No value from that output is reproduced in this record, source, tests, or
evidence. No misuse indicator is currently known, but the affected current
credentials are again treated as compromised and the prior rotation evidence
does not close this recurrence.

The name-only inventory identifies PostgreSQL, the shared Stripe live API
credential, the billing and Connect webhook signing secrets, Resend, Google
OAuth, the authentication metadata pepper, the VAPID private key, backup
encryption, and the distinct rate-limit pepper. The inspected S3 settings were
provider references rather than revealed access values. Public configuration
identifiers are not classified as credentials. The existing
`ACTIVE_LAUNCH_HOLD` remains active, and feature
merges, release deployment, Railway Stage 1, new ACH activity, and public
launch remain paused.

Michael approved emergency one-class-at-a-time rotation on 2026-08-03 with an
incremental cost ceiling of `$2` before tax and up to 30 minutes of cumulative
interruption. The approval includes owner-controlled email, OAuth, and push
proofs; no-charge Stripe deliveries that may create audit/idempotency rows; a
rolled-back database validation; one fresh encrypted backup; one isolated
restore; and revocation of old credentials only after replacements verify. It
does not authorize ACH, real payments, customer communication, customer-data
deletion, public launch, or feature-release deployment.

The safe operational order is PostgreSQL, Stripe API and both webhook secrets,
Resend, Google OAuth, distinct authentication/rate-limit peppers, VAPID, then
backup encryption. Rotation is proceeding one class at a time; only the
classes with fresh recurrence evidence below are claimed complete.

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
- rate-limit pepper
- Sentry ingestion DSN

## 2026-08-03 recurrence rotation status

| Credential class | Current status |
|---|---|
| PostgreSQL | Rotated and verified on 2026-08-03; the exposed predecessor and one automation-exposed intermediate password are invalid; the final replacement was never read or copied |
| Stripe API, billing webhook, and Connect webhook | Live API key plus both webhook signing secrets rotated and verified on 2026-08-03; the exposed API key is expired and both webhook predecessors completed Stripe's one-hour retirement window. Fresh post-retirement probes and exact-source monitoring passed |
| Resend | Rotated and verified on 2026-08-03; the sending-only `rivt.pro` replacement delivered owner-controlled proofs before and after predecessor deletion, the owner confirmed both receipts, and provider inventory shows exactly one replacement key |
| Google OAuth | Rotated and verified on 2026-08-03; the same production web client retained its reviewed origin and callback, owner-controlled sign-ins passed before disablement, after disablement, and after deletion, and provider inventory shows exactly one enabled secret |
| Authentication metadata pepper | Rotated and verified on 2026-08-03; a fresh independent value replaced the prior value without overlap, exact-source monitoring passed, the existing owner session remained valid, and a fresh owner-controlled Google OAuth sign-in returned authenticated through new session issuance |
| Rate-limit pepper | Rotated and verified on 2026-08-03; production now uses a fresh dedicated value instead of falling back to the authentication metadata pepper, exact-source monitoring and bounded public-job limiter probes passed before and after the independent authentication-pepper cutover, and final masked inventory shows one row for each separate pepper |
| Web Push VAPID | Pending active/previous bridge rotation and owner-controlled physical-device proof |
| Backup encryption | Pending active/previous rotation, one fresh encrypted artifact, and one isolated restore proof |
| S3 application access | No new rotation triggered by this recurrence because only provider references, not access values, were returned |

No 2026-08-03 replacement or retirement is complete until its new evidence is
recorded below this table. Historical evidence from the earlier incident must
not be read as closure of the recurrence.

### PostgreSQL recurrence rotation evidence — 2026-08-03

- **Provider and scope:** Railway project `8b0be329-5bd6-40df-8bce-7b745c6d36d8`,
  production environment `b353080f-fb82-46ea-93f8-8eb88a57e009`, PostgreSQL
  service `518129de-bb84-49df-89a0-4660b4cabd8d`, role `postgres`, attached
  volume `dbc470a5-8928-4b07-82a7-a468a516326f`, and dependent RIVT service
  `4e672e30-a351-41a5-91da-c1d07f50f370`.
- **Operator and authority:** Codex operated the provider UI under Michael's
  explicit 2026-08-03 emergency approval. The action began at 18:58 EDT
  (22:58 UTC) and narrow verification completed at 19:06 EDT (23:06 UTC).
- **Cutover:** Railway's provider-defined no-overlap `Regenerate Password`
  operation synchronized the managed connection reference and redeployed the
  existing PostgreSQL service. A replacement password was unintentionally
  rendered into automation inspection output, was immediately treated as
  exposed, and was invalidated by a second regeneration before the application
  cut over. The final replacement was not read, copied, logged, or stored by
  the operator. Final PostgreSQL deployment
  `a7e22798-b737-49d7-8b9a-5da4a7197b99` succeeded at
  `2026-08-03T22:59:59.707Z`.
- **Exact-source application pickup:** the existing production source was
  redeployed only to resolve the updated managed database reference. Railway
  deployment `47f99b41-3f90-47e3-b82a-037d80601244` became active from the same
  production commit `29e3c613f2eb95a6583b52c671275e5046dde0d3`; no feature
  release was deployed.
- **Runtime proof:** immediate and delayed `GET /api/health` checks returned
  HTTP 200 with `ok: true`, migration `0042_push_vapid_generation` in `ready`
  state, database `postgres`, object storage `s3-compatible`, and the exact
  expected source commit. `npm run monitor:production` passed with error
  monitoring, email, Google OAuth, session security, and web push configured;
  anonymous private checks remained fail-closed. Invoice bank payments
  remained `enabled: false`, `configured: false`, and `setup_required`.
- **Rolled-back database proof:** an application-container validation created
  one temporary row inside a transaction, read exactly one matching row,
  rolled back, and confirmed the temporary relation was removed. The sanitized
  receipt was
  `{"ok":true,"transaction":"rolled_back","rowsRead":1,"tempRelationRemoved":true}`.
  No customer table or permanent row was changed.
- **Retirement and recovery:** Railway's no-overlap regeneration invalidated
  both the exposed predecessor and the exposed intermediate password. The
  recovery path was the bound last-known-good RIVT source with the new managed
  reference; it was not invoked because the normal redeploy and all checks
  passed. Restoring either retired password is not an allowed rollback.
- **Interruption and cost:** database-backed operations had a conservative
  cutover window of approximately 2 minutes 8 seconds while the site remained
  online on its prior instance. No service, volume, plan, or recurring resource
  was added. Railway did not quote a separate charge for the two provider
  regenerations and one application redeploy; only ordinary usage-based compute
  applies, within the approved `$2` incident ceiling.
- **Approval boundary:** this action did not enable ACH, attempt a real payment,
  contact a customer, delete customer data, launch publicly, or deploy the
  feature release.

### Stripe live API-key recurrence rotation evidence — 2026-08-03

- **Provider and scope:** Stripe live account `acct_1TnnyAIz6JDg8Lda`, standard
  live secret-key class, replacement Workbench label
  `RIVT Production Server - August 2026 Security Rotation`, and the single
  dependent Railway variable `STRIPE_SECRET_KEY`. No credential value,
  authorization header, or secret-derived fingerprint is recorded.
- **Operator and authority:** Codex operated the provider and Railway UIs under
  Michael's explicit 2026-08-03 emergency rotation approval. Stripe created the
  replacement on August 3; Railway recorded the cutover change at
  `2026-08-04T00:06:37.458Z`, and post-retirement verification completed at
  approximately 20:10 EDT (`2026-08-04T00:10Z`).
- **Overlap and cutover:** the exposed July key remained active while the new
  standard live key was created. The one-time value moved directly from the
  signed-in Stripe page into Railway's masked `STRIPE_SECRET_KEY` editor without
  being printed to chat, shell output, logs, or this record. Only that named
  variable changed. The predecessor was expired only after the replacement
  deployment, health check, and direct provider-authentication proof passed.
- **Exact-source application pickup:** Railway deployment
  `3481b13c-2249-4535-b64c-ece8ae4ca78e` succeeded from the unchanged production
  commit `29e3c613f2eb95a6583b52c671275e5046dde0d3`. The automatic variable-change
  deployment `5676be8d-e45c-4663-b1c4-c76e21a26011` was skipped by the configured
  CI wait policy, so the operator explicitly redeployed the last-known-good
  release. No feature release was deployed.
- **Runtime and provider proof:** public `GET /api/health` returned HTTP 200 with
  `ok: true`, migration `0042_push_vapid_generation` ready, database `postgres`,
  object storage `s3-compatible`, and the exact expected commit. Before
  predecessor expiry, a read-only application-container `GET /v1/account`
  returned HTTP 200 for account `acct_1TnnyAIz6JDg8Lda` with Stripe request ID
  `req_3yQqdwY6xuw8HI`. After expiry, the same read-only proof again returned
  HTTP 200 for the same account with request ID `req_wc1PPyy0GZO3Yr`.
  `npm run monitor:production` passed after cutover and after retirement. Invoice
  bank payments remained `enabled: false`, `configured: false`, and
  `setup_required`; no Stripe mutation or payment operation was attempted.
- **Retirement and recovery:** Stripe removed
  `RIVT Production Server - July 2026 Rotation` from the active key inventory
  after the replacement proved healthy, while the August replacement remained
  present. The recovery path before retirement was to correct or replace the new
  key while leaving the old key active. After retirement, rollback may reuse the
  last-known-good application source but must not restore the retired key.
- **Interruption and cost:** the prior production instance remained online while
  Railway built the replacement; no interruption was observed. No service,
  database, bucket, plan, or recurring resource was added. Stripe quoted no
  charge for key creation, read-only account checks, or key expiration, and only
  ordinary Railway redeploy usage applies within the approved `$2` ceiling.
- **Approval boundary:** this action did not rotate either webhook signing
  secret, enable ACH, attempt a real payment, contact a customer, delete customer
  data, launch publicly, or deploy the feature release.

### Stripe billing-webhook recurrence rotation evidence — 2026-08-03

- **Provider and scope:** Stripe live account `acct_1TnnyAIz6JDg8Lda`, billing
  event destination `we_1TnpZWIz6JDg8LdahYHPwX0o`, endpoint
  `https://rivt.pro/api/stripe/webhook`, `Your account` scope, and the four
  subscription-billing events `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`, and
  `customer.subscription.deleted`. Only Railway variable
  `STRIPE_WEBHOOK_SECRET` changed. No signing-secret value or secret-derived
  fingerprint is recorded.
- **Operator and authority:** Codex operated the signed-in Stripe and Railway
  interfaces under Michael's explicit 2026-08-03 emergency rotation approval.
  Cutover verification began at approximately 20:24 EDT (`2026-08-04T00:24Z`),
  and post-retirement verification completed at approximately 21:37 EDT
  (`2026-08-04T01:37Z`).
- **Overlap and cutover:** Stripe rolled the destination signing secret with
  its provider-defined one-hour predecessor-expiry window. The replacement
  moved directly from Stripe's one-time reveal into Railway's masked
  `STRIPE_WEBHOOK_SECRET` editor without being printed to chat, shell output,
  logs, or this record. Only that named variable was staged. The previous
  secret remained available only through Stripe's bounded overlap while the
  replacement was deployed and tested.
- **Exact-source application pickup:** Railway's automatic variable-change
  deployment `5642fb82-505a-43c6-bda3-626ffff52b52` was skipped by the CI wait
  policy. Explicit redeployment `7bb9c3d5-b048-47d0-b33d-30905452dbf6`
  succeeded from unchanged production commit
  `29e3c613f2eb95a6583b52c671275e5046dde0d3`; no feature release was
  deployed.
- **Runtime proof:** public `GET /api/health` returned HTTP 200 with `ok: true`,
  migration `0042_push_vapid_generation` ready, PostgreSQL and S3-compatible
  storage, and the exact expected source. Before predecessor expiry, locally
  signed unknown event
  `evt_rivt_billing_webhook_rotation_probe_1785803272580` returned HTTP 200,
  `received: true`, and `duplicate: false`. After the one-hour retirement
  window, the same bounded proof with event
  `evt_rivt_billing_webhook_post_retirement_probe_1785807472571` again returned
  HTTP 200, `received: true`, and `duplicate: false`. Each proof created only
  its named immutable `billing_events` replay/audit row; neither event type can
  update a customer, subscription, invoice, payment, or Stripe object.
  `npm run monitor:production` passed after cutover and after retirement with
  all seven anonymous private-route checks fail-closed. Invoice bank payments
  remained `enabled: false`, `configured: false`, `webhookConfigured: true`,
  and `setup_required`.
- **Retirement and recovery:** the selected Stripe one-hour expiry elapsed
  before the final proof. The provider page then exposed the normal active
  signing-secret controls and a fresh roll flow with no pending-expiry state.
  Before retirement, recovery was to correct or reroll the replacement while
  the predecessor still verified signatures. After retirement, the
  last-known-good source may be redeployed, but the retired predecessor must
  not be restored.
- **Interruption and cost:** the prior production instance remained available
  while Railway built the exact-source replacement; no interruption was
  observed. No service, database, bucket, plan, payment, or recurring resource
  was created. Stripe quoted no charge for the roll, and only ordinary Railway
  redeploy usage applies within the approved `$2` ceiling.
- **Approval boundary:** this action did not rotate the Connected-accounts
  webhook, enable ACH, attempt a real payment, contact a customer, delete
  customer data, launch publicly, or deploy the feature release.

### Stripe Connect-webhook recurrence rotation evidence - 2026-08-03

- **Provider and scope:** Stripe live account `acct_1TnnyAIz6JDg8Lda`,
  Connected-accounts destination `we_1TzS8YIz6JDg8LdaXdJA6Dzm`, endpoint
  `https://rivt.pro/api/stripe/connect/webhook`, snapshot payload, API version
  `2026-06-24.dahlia`, and these nine events:
  `charge.dispute.created`, `charge.refunded`,
  `checkout.session.async_payment_failed`,
  `checkout.session.async_payment_succeeded`, `checkout.session.completed`,
  `checkout.session.expired`, `payment_intent.payment_failed`,
  `payment_intent.processing`, and `payment_intent.succeeded`. Only Railway
  variable `STRIPE_CONNECT_WEBHOOK_SECRET` changed. No signing-secret value or
  secret-derived fingerprint is recorded.
- **Operator and authority:** Codex operated the signed-in Stripe and Railway
  interfaces under Michael's explicit 2026-08-03 emergency rotation approval.
  Railway recorded the staged-variable deployment at
  `2026-08-04T01:48:59.147Z`; cutover proof completed at approximately 21:54
  EDT (`2026-08-04T01:54Z`).
- **Overlap and cutover:** Stripe rolled the destination signing secret with
  its provider-defined one-hour predecessor-expiry window. The replacement
  moved directly from Stripe's one-time reveal into Railway's masked
  `STRIPE_CONNECT_WEBHOOK_SECRET` editor without being printed to chat, shell
  output, logs, or this record. Exactly one Railway variable was staged. At
  cutover, the predecessor remained available only during the bounded provider
  overlap and was not claimed retired before that window elapsed.
- **Exact-source application pickup:** Railway's automatic variable-change
  deployment `3b206913-9eb5-4b27-a84e-513a0fcbac2b` was skipped by the CI wait
  policy. Explicit deployment `6152da11-1323-47a9-a258-d9013f040522`
  succeeded from unchanged production commit
  `29e3c613f2eb95a6583b52c671275e5046dde0d3`; no feature release was
  deployed.
- **Runtime proof:** public `GET /api/health` returned HTTP 200 with `ok: true`,
  migration `0042_push_vapid_generation` ready, PostgreSQL and S3-compatible
  storage, and the exact expected source. Locally signed unknown event
  `evt_rivt_connect_webhook_rotation_probe_1785808354434` returned HTTP 200,
  `received: true`, and `duplicate: false`. It created only its named immutable
  `stripe_connect_events` idempotency/audit row; its deliberately unknown type
  cannot update an account, invoice, payment, refund, dispute, or Stripe
  object. `npm run monitor:production` passed with all seven anonymous
  private-route checks fail-closed. Invoice bank payments remained
  `enabled: false`, `configured: false`, `webhookConfigured: true`, and
  `setup_required`.
- **Retirement and recovery:** after the one-hour overlap ended, the provider
  destination showed one active masked signing-secret slot and no predecessor
  or pending-expiry state. Post-retirement probe
  `evt_rivt_connect_webhook_post_retirement_probe_1785812006253` returned HTTP
  200 with `received: true` and `duplicate: false`. The exact-source production
  monitor then passed again with all seven anonymous private routes
  fail-closed. The Connected-accounts predecessor is retired and must never be
  restored; recovery from a future failure is another fresh roll, not the
  exposed secret.
- **Interruption and cost:** the prior production instance remained available
  while Railway built the exact-source replacement; no interruption was
  observed. No service, database, bucket, plan, payment, or recurring resource
  was created. Stripe quoted no charge for the roll, and only ordinary Railway
  redeploy usage applies within the approved `$2` ceiling.
- **Approval boundary:** this action did not enable ACH, attempt a real payment,
  contact a customer, delete customer data, launch publicly, or deploy the
  feature release.

### Resend recurrence rotation evidence - 2026-08-03

- **Provider and scope:** the replacement key is named
  `RIVT Production Sending - August 2026 Recurrence`, has Sending access only,
  and is restricted to the verified `rivt.pro` domain. Only Railway variable
  `RESEND_API_KEY` changed. No credential value, token prefix, or
  secret-derived fingerprint is recorded.
- **Operator and authority:** Codex operated the signed-in Resend and Railway
  interfaces under Michael's explicit 2026-08-03 emergency rotation approval.
  The action used only owner-controlled email proofs and did not contact a
  customer.
- **Cutover:** the replacement value moved directly from Resend's one-time
  reveal into Railway's masked variable editor without being printed to chat,
  shell output, logs, or this record. Railway's automatic variable deployment
  `62614aa2-fea0-417a-adab-21f560faecbb` was skipped by the CI wait policy.
  Explicit exact-source redeployment
  `7a0873cf-d1db-4a26-8687-0475c7b1ce7a` succeeded from unchanged production
  commit `29e3c613f2eb95a6583b52c671275e5046dde0d3` with image digest
  `sha256:8074916995723690145064cce772902039c084c69be416e92b72359fe2d5d033`.
  No feature release was deployed.
- **Pre-retirement proof:** deployed production sent owner-only proof
  `rivt-resend-recurrence-pre-retirement-1785812675006`, Resend message
  `e2f24752-f016-413e-b949-56107fac0b82`. Resend reported it delivered at
  2026-08-03 11:04 PM EDT, and Michael confirmed receipt before predecessor
  deletion.
- **Retirement and inventory:** after the replacement and first proof verified,
  predecessor `RIVT Production rotation 2026-07-29`, provider resource
  `c79cf180-6401-484d-9389-ac262444a8a1`, was deleted. Resend inventory then
  showed exactly one key: the named August replacement with Sending access and
  the `rivt.pro` restriction. The deleted predecessor must never be restored.
- **Post-retirement proof:** deployed production sent owner-only proof
  `rivt-resend-recurrence-post-retirement-1785813474437`, Resend message
  `cf7ef6c1-5648-49e9-b829-fd1b2cca0839`. Resend reported it delivered at
  2026-08-03 11:17 PM EDT, and Michael confirmed receipt after predecessor
  deletion.
- **Runtime boundary:** the exact-source production monitor passed before and
  after retirement. Invoice bank payments remained `enabled: false`,
  `configured: false`, `webhookConfigured: true`, and `setup_required`.
- **Interruption and cost:** no interruption was observed. No service,
  database, bucket, plan, payment, or recurring resource was created. Only
  ordinary Railway redeploy usage applies within the approved `$2` ceiling;
  no exact provider cost is claimed.
- **Approval boundary:** this action did not enable ACH, attempt a real payment,
  contact a customer, delete customer data, launch publicly, or deploy the
  feature release.

### Google OAuth recurrence rotation evidence - 2026-08-03

- **Provider and unchanged client boundary:** the existing Google Cloud project
  `rivt-499402`, owned by `support@rivt.pro`, retained existing OAuth web client
  `Web client 1` and client ID
  `723503499133-chk58c9so5otflgl33o4b8nljok7io02.apps.googleusercontent.com`.
  Authorized origin `https://rivt.pro` and redirect
  `https://rivt.pro/api/auth/google/callback` were unchanged. No new OAuth
  client, origin, redirect, provider project, or account was created.
- **Cutover:** Google added the same-client replacement at 2026-08-03 11:23:53
  PM EDT. Only Railway variable `GOOGLE_CLIENT_SECRET` changed. Railway's
  automatic variable deployment `2e3c8ed3-3a2d-4cf7-aa8b-d54780ad69d2` was
  skipped by the CI wait policy. Explicit exact-source redeployment
  `c00add12-8048-4407-8e6f-9880a357eed8` succeeded from unchanged production
  commit `29e3c613f2eb95a6583b52c671275e5046dde0d3` with image digest
  `sha256:5af9fd1934e0d4f4185633e8d4ae151a7448fed8604f0bf5d72de28fcb00a99f`.
  No feature release was deployed.
- **Pre-retirement proof:** the owner-controlled linked account
  `zboytjbxp@gmail.com` completed a fresh Google sign-in and returned
  successfully to `rivt.pro` while both same-client secrets were enabled.
- **Disablement proof:** predecessor secret created 2026-07-30 7:08:18 AM EDT
  was disabled only after the replacement passed the first sign-in. The same
  owner-controlled linked account then completed another fresh Google sign-in
  and returned successfully to `rivt.pro` while the predecessor was disabled.
- **Deletion and final proof:** the predecessor was deleted only after the
  disabled-state proof passed. A third fresh owner-controlled Google sign-in
  then returned successfully to `rivt.pro`. Final provider inventory showed
  exactly one enabled secret on the unchanged production web client. The
  deleted predecessor must never be restored.
- **Runtime boundary:** the exact-source production monitor passed before and
  after retirement. Invoice bank payments remained `enabled: false`,
  `configured: false`, `webhookConfigured: true`, and `setup_required`.
- **Interruption and cost:** no interruption was observed. No service,
  database, bucket, plan, payment, OAuth client, or recurring resource was
  created. Only ordinary Railway redeploy usage applies within the approved
  `$2` ceiling; no exact provider cost is claimed.
- **Approval boundary:** this action did not enable ACH, attempt a real payment,
  contact a customer, delete customer data, launch publicly, or deploy the
  feature release.

### Rate-limit pepper recurrence rotation evidence - 2026-08-03

- **Prior state and separation:** Railway had no distinct `RATE_LIMIT_PEPPER`,
  so the durable limiter used the configured `AUTH_METADATA_PEPPER` fallback.
  Production now has a fresh, independently generated dedicated
  `RATE_LIMIT_PEPPER`. No value, suffix, hash, or other secret-derived
  identifier is recorded.
- **Exact-source cutover:** Railway's automatic variable deployment
  `d4eaa8e9-c5c9-471d-9fa5-fc387f972b05` was skipped by the CI wait policy.
  Explicit deployment `5105fe71-4bfe-47b3-a2b5-cb23286d932f` succeeded from
  unchanged production source
  `29e3c613f2eb95a6583b52c671275e5046dde0d3` with image digest
  `sha256:d54ed8045a948741a5b471363edcb20ab83c4b8f7ddacf26ed87882fca14be34`.
  No feature release was deployed.
- **Runtime proof:** the exact-source production synthetic monitor passed with
  authentication configured. Invoice bank payments remained `enabled: false`,
  `configured: false`, and `setup_required`. The existing owner session
  remained valid through the cutover.
- **Durable limiter proof:** two bounded
  `GET /api/public/jobs?limit=1` requests returned HTTP 200. Their durable
  limiter headers reported limit `90`, remaining `89` then `88`, and the same
  reset value, proving consecutive requests shared the same active limiter
  window after the dedicated-pepper cutover.
- **Focused verification:** the focused security/authentication suite passed
  all 60 tests, and `npm run lint:security` passed.
- **Separation boundary:** this section closes only the rate-limit-pepper class
  for the recurrence. Authentication-metadata closure is separately evidenced
  below; the former shared fallback is not represented as proof of that
  independent rotation.

### Authentication metadata pepper recurrence rotation evidence - 2026-08-03

- **Independent replacement:** a fresh independent `AUTH_METADATA_PEPPER`
  replaced the prior value. There was no previous-value overlap and no rollback
  was used. No value, suffix, hash, fingerprint, OAuth state, nonce, or
  challenge is recorded.
- **Exact-source cutover:** Railway's automatic variable deployment
  `21316a72-8c11-4579-bc9b-c188f5d1e47d` was skipped by the CI wait policy.
  Explicit deployment `16b0deb5-d5f5-4812-afec-70de53a33575` succeeded from
  unchanged production source
  `29e3c613f2eb95a6583b52c671275e5046dde0d3` with image digest
  `sha256:5471d1280f330d2b1be7bbfc068a8dda7be5ee77ec491fc669c99f4ebada6b69`.
  No feature release was deployed.
- **Runtime proof:** the exact-source production synthetic monitor passed with
  authentication, session security, and Google OAuth configured. Invoice bank
  payments remained `enabled: false`, `configured: false`,
  `webhookConfigured: true`, and `setup_required`. The existing owner session
  remained valid.
- **New-session proof:** a fresh owner-controlled Google OAuth sign-in completed
  and returned authenticated to `rivt.pro`, proving new session issuance after
  the no-overlap cutover. No OAuth state, nonce, challenge, authorization code,
  token, or cookie is retained in this evidence.
- **Final separation inventory:** Railway's masked name-only inventory showed
  exactly one `AUTH_METADATA_PEPPER` row and exactly one `RATE_LIMIT_PEPPER`
  row. This proves the current two-variable configuration only; it does not
  establish provider version history.
- **Independent limiter continuity:** two post-cutover
  `GET /api/public/jobs?limit=1` requests returned HTTP 200. Their durable
  limiter headers reported limit `90`, remaining `89` then `88`, and the same
  reset value, showing the separately configured rate-limit pepper continued
  to drive one shared active limiter window.
- **Focused verification:** the focused security/authentication suite passed
  all 60 tests, and `npm run lint:security` passed.
- **Remaining boundary:** both pepper classes are now independently configured
  and closed for the 2026-08-03 recurrence. Web Push VAPID and backup encryption
  remain pending; this evidence does not close the broader incident, clear
  `ACTIVE_LAUNCH_HOLD`, or authorize launch.

## Historical rotation status before the 2026-08-03 recurrence

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
| Sentry DSN | Rotated; prior key disabled | Replacement key `RIVT production replacement 2026-07-31` is the only enabled production key used by Railway; deployments `599620ce-18fc-4e86-b638-88283dd18857` and `c6ddf9c8-91a3-4953-a47c-70c72deb154e` succeeded; exact-source event `52d1e8add9f7492eb440de033209da0e` was indexed as a high-priority production issue and triggered the existing alert; the prior `Default` key was disabled; post-retirement event `7ed1315e474448ce9807dbb4bd6bf420` was then accepted and indexed |

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

## Authentication metadata pepper evidence before the 2026-08-03 recurrence

- During the initial incident, the authentication metadata pepper was replaced
  in production. At that time it protected privacy-preserving request metadata
  and, because no dedicated rate-limit pepper existed, rate-limit subject
  hashes; it is not a password or session-encryption key.
- The application has no previous-pepper fallback, so replacing the production
  value removed the exposed value from active use. Exact-source production
  health remained green.
- The later 2026-08-03 recurrence exposed the then-current authentication
  metadata pepper again. The historical replacement above did not close that
  recurrence; the independent recurrence replacement and new-session proof are
  recorded in the current evidence section above.
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
- VAPID rotation and previous-key retirement are complete. At this point in
  the response Sentry and the bounded provider/data-access review were still
  open; those later reviews are reconciled below. The current exit criteria,
  not this historical checkpoint, control closure. Railway Stage 1 remains
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
  `ACTIVE_LAUNCH_HOLD` remain open. The later bounded provider-review synthesis
  and exact incident-owner forensic-limit acceptances are recorded below;
  neither closes the incident nor proves that historical misuse did not occur.

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
  window, subject to the historical auditing limitation above. The incident is
  not represented as proof of no access or no exfiltration.

## Later bounded review and incident-owner forensic-limit acceptance

The later `origin/codex/railway-stage1-packet87-integration` incident record
preserves factual provider-review and owner-decision evidence collected after
the sections above. It is historical incident evidence, not proof for the
current release-candidate source, CI result, provider configuration, cost, or
deployment readiness.

- Read-only reviews of the bounded Stripe platform-account and configured
  production destination views, Resend, Sentry, Google Cloud audit/activity,
  Railway workspace audit/deployment history, retained PostgreSQL logs, and
  minimized application-ledger aggregates found no identified misuse indicator
  within their named query and retention bounds. Successful historical
  PostgreSQL access and direct bucket reads cannot be reconstructed, and the
  application-generated secrets below have no complete provider audit trail.
  These limits prevent RIVT from proving that no historical access,
  exfiltration, token exchange, or offline secret use occurred.
- At `2026-07-31T12:22:03.895Z`, the incident-owner role stated: "I accept that
  all available provider evidence was reviewed and no misuse indicator was
  found, but historical successful PostgreSQL access and direct bucket reads
  cannot be reconstructed. RIVT cannot honestly prove that no historical access
  or exfiltration occurred." Later reconciliation found the statement's
  provider-review premise incomplete at the moment it was made. Only its exact
  acceptance of the PostgreSQL/direct-bucket historical limitation and its
  no-proof-of-no-misuse conclusion are retained as closure evidence.
- At `2026-07-31T19:39:34.5524830Z`, the incident-owner role stated: "I accept
  these three forensic limits: RIVT cannot prove the retired VAPID private key
  was never used outside RIVT; cannot prove an encrypted backup and retired
  backup key were never copied and used offline; and cannot prove the retired
  authentication metadata pepper was never used offline. This acceptance does
  not prove no misuse occurred and does not authorize deployment or added
  cost."
- These owner decisions close only the five named unavailable/unobservable
  forensic-decision requirements. They do not reconstruct missing history,
  reduce incident severity, close this incident, clear `ACTIVE_LAUNCH_HOLD`,
  authorize deployment, authorize launch, or approve cost.
- On 2026-08-01, production invoice bank payments were recorded as disabled and
  the owner approved only that exact disabled configuration. That approval did
  not enable ACH, authorize a deployment or worker, clear this incident, or
  authorize launch. It is time-bound provider evidence and must be refreshed
  before clearance; any future ACH enablement separately requires a dedicated
  `Connected accounts` destination, Stripe-signed delivery/state-transition
  proof, scope attestation, and new approval.

## Recovery plan

Follow
[`CREDENTIAL_ROTATION_RUNBOOK.md`](../CREDENTIAL_ROTATION_RUNBOOK.md).
Deploy and verify the narrow compatibility hotfix before rotating the
backup-encryption or VAPID keys. Rotate one provider at a time, verify the new
credential, then revoke the old credential. Never restore a compromised
credential during application rollback.

## Exit criteria

Completed containment and rotation evidence above remains required history.
The still-open exit boundary is:

- complete and verify the still-pending 2026-08-03 recurrence rotations for Web
  Push VAPID and backup encryption; both pepper classes are independently
  rotated and no longer part of this open item;
- finish the consolidated release-candidate forward-port, then obtain a final
  independent exact-source review and disposable-PostgreSQL CI evidence for
  that exact documentation-inclusive candidate; historical branch SHAs, scan
  receipts, test counts, and CI runs are not candidate proof;
- obtain a fresh Railway/provider snapshot, operator review, cost and recovery
  plan, owner-approved evidence digest, rollback target, and passing strict
  activation preflight for the exact final candidate;
- perform any deployment only under separate exact authorization, then capture
  reviewed exact-runtime source, migration, health, monitor, and rollback
  evidence for the final candidate;
- immediately before launch-hold clearance, prove invoice bank payments remain
  disabled, or separately complete the `Connected accounts` Stripe delivery,
  durable state-transition, scope-attestation, and new approval boundary;
- revoke or replace the exposed reusable production pilot invite through a
  separately authorized live operation and record only its nonsecret record
  identifier;
- remove retired private incident-contact data from any hosted synthetic issue
  through a separately authorized live operation;
- point the backup incident role to an access-controlled private route and
  record a recent successful route test with content-bound evidence;
- preserve a nonsecret incident record, confirm each unavailable historical
  limit has the exact owner decision above, and obtain the incident owner's
  final closure decision; and
- clear `ACTIVE_LAUNCH_HOLD` only through its reviewed, explicit process after
  every criterion above is evidenced.

Incident closure alone does not authorize deployment, spending, Railway Stage
1 activation, ACH enablement, or public launch.

## Evidence rules

Record provider name, action time, operator, result, exact deployed source, and a
nonsecret provider identifier or fingerprint where available. Never record a
credential value, database URL, signing secret, private key, recovery code,
presigned object URL, session cookie, or full authorization header.
