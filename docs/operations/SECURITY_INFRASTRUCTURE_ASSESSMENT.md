# RIVT security and infrastructure assessment

Assessment date: 2026-07-28
Assessment branch: `codex/security-infrastructure-hardening`
Production source observed during the assessment: `92a8451`

## Verdict

RIVT is **not approved for public launch by this assessment**. The application
has meaningful security controls, and this packet closes several code-level
gaps, but no internet application is “bulletproof.” Launch remains blocked on
restoring the fresh backup, object-byte recovery, upload malware controls,
application-layer edge protection, redundancy evidence, data-governance
approval, and provider/account verification.

This is an engineering assessment, not a penetration-test report, legal
opinion, compliance certification, or guarantee against attack.

## Locally verified controls

- PostgreSQL and private S3-compatible storage are required in production;
  missing storage fails closed.
- Authentication uses scrypt password hashes, salted credentials, opaque
  hashed tokens, secure cookies, rotation, verification, and generic invalid
  credential responses.
- Unsafe browser mutations use Fetch Metadata plus exact Origin/Referer
  checks. Stripe callbacks are signature verified.
- Zod schemas bound canonical JSON inputs. JSON, URL-encoded, multipart file,
  multipart field, part, and header counts are bounded.
- The unused generic legacy upload writer is retired; uploads must enter a
  current, account-owned workflow with its own validation and authorization.
- Authenticated storage status reports only the requesting account's usage;
  global record counts are no longer exposed to ordinary accounts.
- Uploads use private object keys, ownership checks, file-size limits,
  content-signature detection, and SHA-256. These controls are **not** malware
  scanning.
- Durable write/auth/upload/public-payment limits exist in PostgreSQL. A
  cheaper per-instance API burst limit now rejects obvious bursts before JSON
  parsing, and login uses both IP and normalized-account buckets.
- Helmet sets HSTS, frame denial, `nosniff`, referrer policy, a bounded
  browser Permissions Policy, and a restrictive CSP. Executable boot scripts
  and styles are external; `script-src` no longer needs `unsafe-inline`.
  Public static-page style blocks are authorized by exact CSP hashes instead
  of a broad inline-style allowance. Configured analytics endpoints widen
  `connect-src` only to validated exact HTTPS origins (or local HTTP during
  development), and a production-build browser test checks that the policy
  does not block the app.
- HTTP request, header, keep-alive, header-count, and per-socket request limits
  are explicit. SIGTERM/SIGINT drain in-flight requests before database
  shutdown.
- Deployment health is `/api/health` and stays `503` until cached bounded live
  PostgreSQL/object-storage probes pass, migrations are ready, and production
  session metadata security is configured. Probe output is categorical and
  excludes provider errors, credentials, bucket names, and database URLs.
- Migration history now fails closed on checksum drift instead of rewriting
  the ledger to match source.
- Stripe, Resend, OAuth, and analytics requests have bounded timeouts.
- Expired rate-limit rows drain in shared, bounded, non-blocking batches and
  retry earlier while a backlog remains; expired idempotency rows are removed
  in separate bounded maintenance batches. These controls reduce database
  accumulation but do not replace application-layer edge protection.
- Application and monitoring telemetry applies sensitive-key redaction plus
  value-pattern redaction. It does not reliably detect every name, address, or
  other PII embedded in arbitrary free-text messages and stacks.
- The unsigned query-string Report Viewer has been removed. It could not
  cryptographically prove source data or sign-off; its old route now returns
  `410 Gone` and the landing page no longer promises a report share link.
- Encrypted logical PostgreSQL backup and isolated restore tooling exists.
  A fresh artifact now satisfies the recorded 24-hour freshness input, but
  that exact artifact has not been restored and the logical format does not
  restore object bytes.

Unless a row below explicitly says it was observed live in Railway, the
Packet 88 additions in this section are verified on the review branch and are
not production evidence until merge, exact-source deployment, and post-deploy
monitoring pass.

## Local verification

- `npm run build`, `npm run lint`, and `npm run lint:security` pass.
- `npm run test:unit` passes 150/150 checks, and the final exact-worktree
  `npm run test` aggregate passes its complete PostgreSQL-backed integration
  sequence.
- `npm run test:e2e` passes fail-closed auth, jobs/discovery, offline
  recovery, and production-CSP browser paths.
- Rendered `tools`, `mobile-actions`, `shop-talk-news`, and `work-lifecycle`
  smokes pass.
- `npm run incident:readiness -- --require-ready` and
  `npm run launch:readiness -- --require-ready` pass their machine-readable
  evidence contracts.
- `npm audit --omit=dev` reports zero production vulnerabilities, and
  `git diff --check` passes.
- A scoped pattern scan of the current tracked and intended untracked source
  reported no candidate live Stripe keys, webhook secrets, credentialed
  PostgreSQL URLs, private keys, or AWS access-key identifiers. This is not a
  git-history, provider-secret, or exhaustive credential audit.

## Hosting, edge, transport, and cost boundary

| Area | Current evidence | Launch state |
|---|---|---|
| Public TLS | A read-only production check confirmed a live certificate negotiating TLS 1.3 and HTTP-to-HTTPS redirect behavior. RIVT adds one-year HSTS with subdomains and preload. | Transport is live; certificate renewal, domain ownership, and expiry alerting remain operational evidence. |
| Database TLS and path | The production application `DATABASE_URL` uses Railway's private internal hostname. Non-local application and backup clients still set `rejectUnauthorized: false`. | The app-to-database path is private; certificate authentication remains open for any public TCP-proxy backup/restore path. |
| Plan and topology | The Railway account is on the Hobby plan. Production currently has one application replica and one PostgreSQL replica, both in `us-east4`. | Verified single-region, single-replica topology; not high availability. |
| DDoS / WAF | Railway's WAF is available, but Under Attack mode is disabled. RIVT also has durable endpoint limits and local burst control. Railway warns that Under Attack mode blocks non-browser traffic, including webhooks and API clients. | Do not enable blindly: Stripe/provider webhooks and RIVT API clients require a scoped design and validation. Application-layer edge protection remains open. |
| CDN | Railway CDN capability is available but disabled for this service. | No CDN resilience or cache-offload claim. Enabling it is an account change and requires cost/behavior approval. |
| Container build | Railway Railpack builds an OCI workload; `.nvmrc` selects Node 22 and `npm ci` consumes the lockfile. | Present. Explicit non-root/read-only filesystem/capability evidence is provider-owned and still unverified. |
| Redundancy | Read-only account inspection confirms one application replica and one PostgreSQL replica in one region. Source adds health checks and graceful drain only. | **Open:** no replica, zone, regional, database, or object-store failover has been demonstrated. |
| Autoscaling | The Hobby deployment is fixed at one application replica; no horizontal autoscale thresholds or scale-down behavior are configured or evidenced. | **Open; any replica or plan change may affect cost.** |
| PostgreSQL volume and cost | The attached production database volume uses 360.448 MB of 500 MB. A separate unattached 5 GB volume also exists. The application uses private service networking. | Investigate the unattached volume and budget impact; do not delete, resize, or attach anything without owner approval. |
| Network ingress/egress | Railway publishes egress and resource pricing. CDN is disabled, and the private database path avoids a public TCP proxy for normal app traffic. Bucket operations/egress have separate provider rules. | No spend estimate is inferred from source. Review actual invoices and configure budgets only with owner approval. |
| PITR/backups | Railway PITR is a provider/account feature with storage and egress implications. RIVT's separate AES-256-GCM logical artifact was refreshed on 2026-07-29 UTC with 109 tables and 8,760 rows. | Freshness is recorded, but the exact artifact has not been restored and object bytes are outside its recovery scope. PITR remains off; enabling or resizing requires cost approval. |

Official provider references:

- Railway public networking:
  <https://docs.railway.com/networking/public-networking/specs-and-limits>
- Railway production readiness:
  <https://docs.railway.com/overview/production-readiness-checklist>
- Railway config as code:
  <https://docs.railway.com/config-as-code/reference>
- Railway pricing:
  <https://docs.railway.com/pricing>
- Railway bill calculation:
  <https://docs.railway.com/pricing/understanding-your-bill>
- Railway cost controls:
  <https://docs.railway.com/pricing/cost-control>
- Railway bucket billing:
  <https://docs.railway.com/storage-buckets/billing>
- Railway PostgreSQL:
  <https://docs.railway.com/databases/postgresql>
- Railway point-in-time recovery:
  <https://docs.railway.com/volumes/point-in-time-recovery>

## Launch blockers

1. A fresh logical artifact is now recorded inside the approved 24-hour RPO,
   but that exact artifact has not been restored to an isolated target.
2. Logical backup artifacts include PostgreSQL records and S3 keys/metadata,
   not the file bytes. Photos, attachments, logos, and evidence have no proven
   byte-level restore.
3. Upload rows explicitly remain `not_scanned`. Magic-byte checks do not detect
   malware, weaponized documents, or all active content.
4. Railway WAF capability exists but Under Attack mode is disabled and cannot
   be blindly enabled because it can block Stripe/provider webhooks and other
   non-browser API clients. No scoped application-layer edge design is
   approved.
5. Production is one application replica plus one PostgreSQL replica in
   `us-east4`. Database HA/PITR, object versioning, multi-zone/region
   redundancy, autoscaling, and failover recovery are not verified.
6. The provider register and retention matrix are not approved. Regions,
   DPAs, subprocessors, deletion, incident notice, and transfer controls need
   account evidence.
7. Public privacy, terms, and security documents do not yet describe current
   public content, imported contacts, Stripe Connect ACH, subprocessors,
   retention, deletion/export rights, or controller identity completely.
8. Server-side account export, deletion, legal-hold exceptions, and retention
   purge orchestration are incomplete.
9. Log/Sentry redaction uses sensitive-key and value-pattern filtering, but it
   cannot prove removal of every name, address, signed URL, or other PII
   embedded in arbitrary free-text messages and stacks.
10. Public/participant media deletion and orphan-object reconciliation are not
    complete; some object deletion failures are swallowed.

## Changes requiring explicit owner approval

The following were **not** enabled or purchased:

- Railway WAF/CDN or another WAF/CDN/bot/DDoS service and any required routing
  or DNS change;
- additional Railway replicas, autoscaling, resource reservations, private
  networking changes, connection proxy, PostgreSQL HA/PITR, or volume changes;
- cross-account/cross-region backup storage, object lock/versioning, or
  scheduled backup execution;
- malware/CDR scanning service or a dedicated scanner worker;
- new logging/APM/paging/spend-management vendor;
- legal counsel, privacy certification, PCI assessment, or external
  penetration test.

Before approval, obtain a written cost estimate, rollback path, data-flow
impact, and named owner for each change.

## Fresh backup evidence

- Michael explicitly authorized one fresh production backup in this task.
- At `2026-07-29T02:56:41.908Z`, the production backup command created
  `backups/postgres/2026-07-29T02-56-41.908Z-unknown.json.gz.aes256gcm` in
  private managed object storage.
- The AES-256-GCM artifact covers 109 PostgreSQL tables and 8,760 rows and was
  created in 2,081 ms.
- Its embedded `sourceCommit` is `unknown`. A separate read-only Railway
  runtime check confirmed
  `RAILWAY_GIT_COMMIT_SHA=92a8451b8190f5119384a4970fb1a324503df995`.
  Packet 88 patches future backup creation to fall back to this immutable
  Railway value; the existing artifact was not rewritten.
- No restore target, PITR, replica, WAF/CDN, DNS, volume, autoscale, plan,
  recurring schedule, or application deployment changed.
- This artifact refreshes logical-backup freshness only. It does not prove
  that this exact artifact is restorable, does not recover object bytes, and
  does not establish full launch readiness.
- `npm run launch:readiness -- --require-ready` passes after the
  recovery-policy evidence update. Its policy/freshness result is narrower
  than this assessment and does not override the launch-blocker verdict.

## Senior-review questions

- What exact abuse budget should apply per anonymous IP, authenticated account,
  login identity, upload byte, and payment token at the edge and application?
- Which records are legally required, which are user-deletable, and which need
  immutable retention or a legal hold?
- What failure domain can the Jacksonville launch tolerate: process, zone,
  region, database, object store, DNS, email, or Stripe?
- What is the maximum approved monthly spend and automatic shutdown/alert
  behavior before any autoscale or PITR feature is enabled?
- Who owns security response, privacy response, restoration, vendor escalation,
  and customer notification when the founder is unavailable?
