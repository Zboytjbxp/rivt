# Security Hardening Review: RIVT object-storage auditability

> **Status: proposed design only.** This portfolio does not implement an
> object-storage gateway, audit inserts, migration, provider setting, bucket,
> immutable log, or paid resource. It is not evidence that the incident's
> historical access gap has been closed.

## Evidence Basis

This review is derived from the
[2026-07-29 credential-exposure incident](../../incidents/2026-07-29-production-credential-exposure.md),
the append-only audit schema and test coverage, and the object-storage callers
at source revision
`04360c6dd469908ec0c1e8245d9910163630e72f`. The exact 13-file inventory and
collection digest are in [`context.md`](context.md).

The observed picture is reassuring but incomplete. No object-storage misuse
indicator has been found, yet the available Railway Bucket history cannot
prove an object was never downloaded. In source, the application already has
an append-only `audit_events` table, while S3 writes, reads, deletions, and
signed-link issuance are owned by several feature modules. That makes
object-audit coverage a convention rather than a single enforced boundary.

## Constraints

- Reuse existing application and database boundaries where practical.
- The recommended application option must not require a new table, service,
  bucket, or paid resource.
- Never log object keys, signed URLs, filenames, content, credentials,
  authorization headers, provider exceptions, or raw IP addresses.
- A signed-link event means RIVT issued authorization; it does not prove the
  browser downloaded the object.
- Any migration, provider setting, immutable retention, or recurring expense
  requires a separate review, rollback, and owner approval.
- Historical access that was never recorded cannot be reconstructed by a
  future design.
- Performance budgets and provider-log costs are currently unknown and must be
  measured or quoted rather than assumed.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Establish accountable object-storage access | Credential-exposure forensic limit; existing append-only ledger; direct S3 authority across projects, albums, Shop Talk, profiles, documents, messaging, and legacy uploads | **1.** Local per-route audit inserts; **2.** central gateway using existing `audit_events`; **3.** provider/external immutable logging | Select Option 2 for application accountability; evaluate Option 3 later only if actual provider-access proof justifies its privacy, operations, and cost | [Complete proposal](proposals/object-access-accountability.md) |

## Recommendation Summary

I recommend **Option 2: a centralized object-storage gateway backed by the
existing append-only `audit_events` table**. We can use one application module
to own `PUT`, server-side `GET`, `DELETE`, and signed-link issuance, construct a
strictly bounded audit event, batch list-page link events, and fail closed
before returning a link or server-read bytes. A security test can then reject
direct object SDK or signing calls elsewhere in `server/`.

This changes the important ownership boundary without adding a table or paid
service. It still cannot see a browser's later provider request, provider
console access, leaked credentials, backup scripts, or other out-of-band
activity. **Option 3** is the higher-assurance answer to that separate problem,
but no provider capability, retention design, residency, deletion behavior, or
price has been approved. It must remain a later decision, not an implied free
upgrade.

**Option 1** is a credible emergency baseline when immediate delivery matters
more than recurrence risk. Its weakness is that every current and future route
continues to own the security rule independently. If used temporarily, it
should adopt the same four action names and safe metadata contract proposed for
the gateway.

## Next Decisions

- Decide whether to select Option 2 for implementation planning. This document
  does not authorize implementation.
- Decide whether provider-level proof of actual object access is a launch
  requirement or a later higher-assurance control.
- Verify the production bucket is private and `S3_PUBLIC_BASE_URL` is unset;
  do not print configuration values while verifying.
- Decide whether legacy upload routes should be migrated or retired.
- Set measurable latency and availability thresholds for audit-dependent
  links and reads.
- Before considering Option 3, obtain an exact provider design and monthly
  price covering ingestion, retention, queries, and egress, then obtain owner
  approval.

Structured analysis: [`hardening.json`](hardening.json).
