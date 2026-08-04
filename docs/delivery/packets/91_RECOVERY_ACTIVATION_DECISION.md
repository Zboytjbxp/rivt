# Packet 91 - Independent recovery activation decision

## Objective

Turn Packet 90's provider-neutral recovery foundation into a decision-ready
activation boundary without accessing a cloud provider, reading production
object bytes, creating resources, spending money, or deploying.

This packet decides what RIVT should build next. It does not activate it.

It supplements Packet 90 at commit
`8ba8702b40fe57d88550a07ed816fc56d4575cf3` and the existing implementation
handoff bound to evidence collection
`f170d32f0da2b2527ff003afebae195112dea6d20aaaa01c4f9d27ae47589080`.

## Authority and cost boundary

- Michael authorized a no-cost planning and repository-documentation pass.
- No provider account, project, region, bucket, identity, key, budget, or
  recurring service is approved by that instruction.
- No production database or object content may be read.
- No provider API may be called.
- No resource may be created or configured.
- No charge-bearing action may occur without Michael approving the exact
  provider, account, region, operation, maximum source bytes, and maximum
  incremental cost immediately beforehand.
- No deployment is part of this packet.

## Decision

The selected architecture remains a separately administered,
cross-provider, client-side-encrypted immutable backup.

**Recommended provider: AWS S3 with Versioning and Object Lock in a dedicated
US account. Compliance mode remains prohibited until the full-object
retention, erasure, legal-hold, and key-custody policy is approved.**

This is a technical recommendation, not an owner approval or an account
configuration record.

Google Cloud Storage is the closest alternative. Its built-in Storage Object
Creator role provides a particularly clean create-only writer. AWS is the
recommended fit for RIVT because:

1. S3 Compliance mode explicitly prevents protected-version deletion or
   retention reduction, including by the root user;
2. S3 exposes the exact conditional-create, version, checksum, and retention
   primitives required by the adapter contract;
3. the repository already pins the AWS S3 client, reducing implementation and
   dependency risk.

Azure Immutable Blob Storage is capable but has more policy-state traps:
unlocked policies and version-level policy choices can leave weaker effective
protection than the interface implies.

Provider documentation reviewed:

- [AWS S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [AWS Object Lock management](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html)
- [AWS PutObject conditional creation](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)
- [AWS checksum support](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)
- [Google Cloud Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock)
- [Google Cloud Object Retention Lock](https://docs.cloud.google.com/storage/docs/object-lock)
- [Google Cloud IAM roles](https://docs.cloud.google.com/storage/docs/access-control/iam-roles)
- [Azure immutable version-level WORM](https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-version-level-worm-policies)
- [Azure immutable container-level WORM](https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-container-level-worm-policies)

## Retention and recovery decision

The existing approved recovery targets remain:

- maximum RPO: 24 hours;
- maximum RTO: 4 hours;
- current encrypted logical-artifact retention: 30 days;
- isolated logical restore cadence: monthly.

Applying an at-least-30-day lock to coordinated database-and-object recovery
sets is proposed, not approved. Object Lock supplies a not-before deletion
date; lifecycle deletion may occur later and must be reconciled. That proposed
backup period is a disaster-recovery control, not a decision about how long
live product records should be kept. Primary-data retention, account closure,
verified erasure, legal hold, and immutable-backup lifecycle remain separate
concepts.

The proposed data-class periods, deletion behavior, purge-ledger rule, and
key-custody model are in
`docs/operations/RECOVERY_RETENTION_AND_KEY_CUSTODY_DRAFT.md`. They remain
pending owner and counsel approval.

## Cost model and authorization design

The 2026-07-28 read-only point-in-time inventory is 89 objects totaling
40,385,105 bytes (about 40.4 MB decimal). Packet 90 uses fresh encryption and
opaque names for each snapshot, so the conservative model assumes a complete
daily copy rather than storage deduplication.

Thirty daily copies are approximately:

- 1.212 GB decimal of retained object ciphertext before the database artifact
  and completion records;
- 2,670 object writes, plus approximately 30 completion writes;
- an illustrative public-list-price calculation captured 2026-07-29 for S3
  Standard in US East of about US$0.028 storage plus US$0.014 object writes
  at this corpus;
- approximately US$0.061 of Railway object egress at the published
  US$0.05/GB rate, before database bytes, runner compute, retries,
  verification reads, immutable orphans, taxes, or growth.

This is an engineering estimate, not a bill or authorization. It excludes the
database artifact, runner compute, verification reads, retries, taxes,
minimum-storage rules, immutable orphans, and lifecycle deletion lag. A live
model must conservatively include at least one extra daily copy plus retained
orphans and refresh pricing immediately before the run.

Recommended future approval boundaries:

1. **Synthetic adapter conformance:** separate explicit provider/account,
   resource, and low-dollar approval. It must use generated non-production
   bytes only.
2. **One physical proving drill:** separate approval for production reads,
   exact source-byte ceiling, isolated restore resources, and maximum
   incremental cost. The previously proposed US$1 Railway ceiling remains
   unapproved.
3. **Recurring service:** separate recurring approval. A suggested initial
   ceiling for owner consideration is US$2/month, with forecast alerts before
   that ceiling and a local preflight that refuses the next billable
   operation when its conservative estimate would exceed the recorded
   authorization. Provider budget alerts are not treated as hard stops.

Official cost references:

- [AWS S3 pricing](https://aws.amazon.com/s3/pricing/)
- [Google Cloud Storage pricing](https://cloud.google.com/storage/pricing)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
- [Railway pricing and egress](https://docs.railway.com/pricing)
- [Railway cost controls](https://docs.railway.com/pricing/cost-control)

## Required implementation order

1. Close the local adapter gaps listed in
   `docs/operations/hardening/recovery-closure/implementation/provider-adapter-conformance.md`.
2. Obtain owner decisions for provider/account/US region, DPA and
   subprocessors, retention/deletion, key custody, recovery identities, and
   exact cost ceilings.
3. With a new explicit authorization, create only disposable synthetic
   conformance resources and prove effective permissions, checksums,
   conditional creation, immutable retention, interruption behavior, cleanup,
   and budget refusal.
4. Review the evidence before enabling Compliance retention for customer
   data.
5. With another explicit authorization, create one coordinated database and
   object recovery set, then restore it into isolated targets and verify it
   inside four hours.
6. Only after the one-time drill passes, approve daily scheduling, failure
   paging, and a monthly isolated restore.

## Decisions still required

Michael must explicitly approve or reject:

1. AWS S3 Object Lock as the provider and a named dedicated account and US
   region.
2. The provider DPA, subprocessors, transfer terms, and incident route.
3. The proposed retention/deletion matrix, at-least-30-day object-set lock,
   lifecycle deletion/reconciliation, and maximum backup-only erasure delay.
4. A reviewed cryptographic 2-of-3 threshold-key scheme, its three
   custodians, reconstruction test, and separate operator roles.
5. A synthetic conformance cost ceiling.
6. The one-time physical proving drill's production-read and cost ceiling.
7. A recurring monthly cost ceiling and alert thresholds.
8. Treatment of legacy objects without trustworthy SHA-256 values. Every
   canonical `stored` byte must still be encrypted and backed up; scan state
   must be retained and unscanned bytes quarantined/re-scanned after restore.
9. A CA-verified or private PostgreSQL path for every backup and restore.

## Acceptance boundary

Packet 91 is complete when its documents are internally consistent,
machine-readable records validate, repository gates pass, and the branch is
pushed.

Completion does not close `R-052` or `GA-OPS-004`. It proves that the next
stage has a bounded, reviewable contract. It does not prove an independent
backup, immutable provider configuration, object-byte recovery, scheduled
recurrence, or public-launch readiness.

## Verification

- `npm run build` passed.
- `npm run lint` and `npm run lint:security` passed.
- `npm run test` passed 173/173 unit/frontend tests and 24/24 serial
  PostgreSQL integration suites with zero skips or failures.
- `npm run test:e2e` passed fail-closed authentication, Jobs/discovery at
  desktop and mobile widths, offline recovery, and production CSP.
- `npm audit --omit=dev` reported zero production vulnerabilities.
- `npm run launch:readiness -- --require-ready` and
  `npm run incident:readiness -- --require-ready` passed. Those policy checks
  do not override the explicitly open `R-052` recovery boundary.
- The structured hardening JSON parses, every newly bound local evidence path
  exists, and `git diff --check` passes.

Packet status: **Decision-ready, no-cost activation design complete; live
provider activation and recovery proof remain blocked on explicit owner,
governance, and cost approvals. Not deployed.**
