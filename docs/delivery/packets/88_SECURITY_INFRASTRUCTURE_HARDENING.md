# Packet 88 — Security and infrastructure hardening

## Objective

Raise the code-level safety floor for the public application and document the
hosting, data-governance, recovery, transport, scaling, and provider evidence
that must exist before RIVT can be approved for public launch.

This packet does not promise a “bulletproof” system. Its acceptance boundary is
an evidence-backed engineering assessment, locally verified controls, and an
explicit list of unresolved operational and provider risks. It is not a legal
opinion, penetration-test report, compliance certification, or guarantee
against attack.

## Local hardening scope

- Keep Helmet-backed HSTS, frame denial, `nosniff`, referrer policy, a bounded
  browser Permissions Policy, and a restrictive Content Security Policy. Boot
  scripts and styles are external so the application does not require an
  inline-script exception; public static page styles use exact CSP hashes
  rather than a broad inline allowance.
- Bound JSON, URL-encoded, multipart-file, multipart-field, part, and header
  inputs before expensive application work.
- Retire the unused generic legacy upload writer so uploads must use a current,
  account-owned workflow with explicit validation and authorization.
- Add a cheap per-instance API burst guard ahead of JSON parsing while
  preserving PostgreSQL-backed durable auth, write, upload, and public-payment
  limits. Login uses both source and normalized-account subjects. Expired
  limiter rows drain in shared, bounded, non-blocking batches with an earlier
  retry while backlog remains; this is database hygiene, not edge DDoS
  protection.
- Bound HTTP request, header, keep-alive, per-socket request, and provider
  request time. Drain in-flight requests during graceful shutdown.
- Make deployment readiness depend on cached, bounded live PostgreSQL and
  object-storage probes, completed migrations, and valid production session
  metadata security. The production monitor asserts the same contract.
- Fail closed on migration checksum drift rather than rewriting migration
  history to match source.
- Remove expired rate-limit and idempotency rows in bounded maintenance
  batches.
- Strengthen application and monitoring redaction with sensitive-key and
  value-pattern filtering, while retaining the explicit limitation that
  arbitrary free text can still contain PII. Remove the unsigned query-string
  Report Viewer, whose source data and sign-off could not be
  cryptographically proven; its old route returns `410 Gone` and public copy
  no longer advertises it.
- Serve root boot assets from the service-worker cache, allow only validated
  configured analytics origins in `connect-src`, and exercise the built app
  under the production CSP in a real browser.
- Record the current provider-verification and data-retention decisions in
  `docs/operations/PROVIDER_COMPLIANCE_REGISTER.md` and
  `docs/operations/DATA_RETENTION_MATRIX.md`.

These changes are local to `codex/security-infrastructure-hardening` at the
time of this packet. They are not production evidence until review, complete
gates, merge, exact-source deployment, and post-deploy monitoring succeed.

## Launch blockers

1. A fresh encrypted logical backup now exists inside the approved 24-hour
   RPO, but that exact artifact has not been restored to an isolated target.
   The prior named isolated restore remains valid cadence evidence; it is not
   proof that the newly created artifact is restorable.
2. The logical backup captures PostgreSQL data plus object keys and metadata,
   not the object bytes. Photos, attachments, logos, and evidence therefore
   have no demonstrated byte-level restore.
3. Upload rows remain explicitly `not_scanned`. Content signatures and size
   limits do not replace malware scanning, quarantine, or content disarm and
   reconstruction.
4. Railway WAF capability exists, but Under Attack mode is disabled and is not
   safe to enable blindly because it can block non-browser Stripe/provider
   webhooks and API clients. No scoped application-layer WAF/bot design is
   approved.
5. Read-only account inspection confirms one production application replica
   and one PostgreSQL replica in `us-east4` on the Hobby plan. Zone or database
   failover, PostgreSQL HA/PITR, object versioning, autoscale thresholds,
   connection pooling, and resource limits are not verified.
6. The production application uses Railway's private internal
   `DATABASE_URL`. Non-local application and backup clients still allow TLS
   with `rejectUnauthorized: false`, leaving certificate authentication open
   for any public TCP-proxy backup/restore path.
7. The provider register and retention matrix are drafts. Regions, DPAs,
   subprocessors, deletion, incident notice, recovery, and transfer controls
   require actual account and contract evidence.
8. Server-owned account export, deletion, retention purge, legal-hold
   exceptions, failed-object deletion reconciliation, and provider deletion
   completion are incomplete.
9. Public legal documents do not yet fully describe imported non-user
   contacts, public/indexed content, Stripe Connect ACH, current providers,
   controller identity, retention, deletion/export rights, and breach
   handling.

## Cost and authority boundary

No paid service, provider feature, production resource, DNS setting, database,
bucket, replica, autoscale rule, PITR setting, WAF, malware scanner, or
production data may be created or changed without Michael's explicit approval
immediately beforehand.

The following remain owner decisions because they can change cost, data flow,
or blast radius:

- Railway WAF/CDN or another WAF/CDN/bot provider and any required routing or
  DNS cutover;
- additional Railway replicas, autoscaling, resource reservations, private
  networking, connection proxying, PostgreSQL HA/PITR, or volume changes;
- object versioning/lock, cross-account or cross-region backups, and scheduled
  backup execution;
- malware/CDR scanning, paging, logging, APM, or spend-management vendors;
- legal review, privacy certification, PCI assessment, or an external
  penetration test.

Every approved provider change needs a written cost estimate, rollback path,
data-flow effect, acceptance test, and named owner before execution.

## Verified read-only Railway facts

- Current plan: Hobby.
- Region and replica count: one production application replica and one
  PostgreSQL replica in `us-east4`.
- Storage: the attached production PostgreSQL volume uses 360.448 MB of
  500 MB; a separate unattached 5 GB volume exists. Nothing was attached,
  resized, or deleted.
- Edge: Railway WAF is available, Under Attack mode is disabled, and CDN is
  available but disabled.
- Transport: the live public endpoint negotiated TLS 1.3 with a valid
  certificate and redirected HTTP to HTTPS.
- Database path: the production application uses Railway's private internal
  `DATABASE_URL`.
- Static CSP: public static-page style blocks are authorized by exact hashes.
- No setting, plan, replica, volume, WAF/CDN mode, database, DNS, or paid
  service was changed.

## Required evidence

- Fresh encrypted backup evidence within the 24-hour RPO and an isolated
  restore from that exact artifact.
- A representative restore of actual object bytes, not only database rows and
  object metadata.
- Malware-scanning/quarantine behavior with fail-closed upload tests and an
  operator recovery path.
- Provider-account approval evidence for scoped WAF behavior, HA, PITR, object
  durability/versioning, autoscaling, limits, budgets, alerts, and the
  unattached-volume disposition. Read-only plan, region, replica, private
  database path, TLS, WAF/CDN availability, and volume facts are recorded
  above.
- Approved provider register, retention/deletion policy, legal documents, and
  account export/deletion workflows.
- Production build, lint, security lint, full unit/integration aggregate, E2E,
  dependency audit, diff integrity, exact-source deployment health, and
  production monitor.

## Three-things review

Before this packet can advance, explicitly review:

1. whether a paid resilience or security control is being enabled without a
   price, rollback, and owner-approved spend boundary;
2. whether public provider documentation is being mistaken for evidence of
   RIVT's actual account region, contract, encryption, retention, or recovery
   configuration;
3. whether passing code tests or a security scan is being overstated as
   compliance certification, penetration-test assurance, high availability,
   or recovery proof.

## Current evidence and status

- Base source: `09b7bc55a5ea59ebaabcb87b6faeae71c9728aa2`.
- Branch: `codex/security-infrastructure-hardening`.
- With Michael's explicit approval, production created encrypted logical
  artifact
  `backups/postgres/2026-07-29T02-56-41.908Z-unknown.json.gz.aes256gcm` at
  `2026-07-29T02:56:41.908Z`. It covers 109 tables and 8,760 rows, completed
  in 2,081 ms, and is encrypted with AES-256-GCM in private managed object
  storage.
- The artifact honestly embeds `sourceCommit: unknown`. A separate read-only
  runtime check confirmed Railway `RAILWAY_GIT_COMMIT_SHA` was
  `92a8451b8190f5119384a4970fb1a324503df995`. The branch patches the backup
  script to use that Railway value as a future fallback without rewriting the
  existing artifact.
- The new artifact refreshes the machine-readable RPO input.
  `npm run launch:readiness -- --require-ready` passes after the policy record
  update. That narrow machine gate does not prove this artifact is restorable
  and does not close the packet's broader launch blockers.
- The new artifact has not been restored. It does not include or prove
  recovery of the underlying object bytes.
- No production deployment, restore target, PITR, replica, WAF/CDN, DNS,
  volume, autoscale, plan, or recurring backup configuration change is
  claimed.
- Final exact-worktree local gates pass: `npm run build`, `npm run lint`,
  `npm run lint:security`, 150/150 unit/frontend checks, the full
  PostgreSQL-backed `npm run test` aggregate, `npm run test:e2e`, all four
  rendered UI smokes (`tools`, `mobile-actions`, `shop-talk-news`, and
  `work-lifecycle`), `npm audit --omit=dev` with zero reported production
  vulnerabilities, incident readiness, launch readiness, diff integrity, and
  a scoped current-source credential-pattern scan with no reported matches.
  Review, merge, exact-source deployment, post-deploy health, and production
  monitoring remain to be recorded.

Packet status: **Blocked for public launch; local hardening and assessment
verified, not deployed.**
