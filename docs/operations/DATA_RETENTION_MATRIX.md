# Data retention and deletion matrix

Status: **draft — legal and operational approval required**
Engineering review: 2026-07-28

RIVT does not yet have a complete purge/export/deletion program. This matrix
identifies the decisions and implementation evidence required before public
launch. It does not invent retention periods and is not legal advice.

| Data class | Examples | Current behavior | Required decision / control | Status |
|---|---|---|---|---|
| Identity and authentication | Account, profile, verified email, password material, OAuth links, sessions | Canonical PostgreSQL; sessions can be revoked | Retention after closure; account deletion/export; fraud/security exception; provider-link deletion | Open |
| Imported non-user contacts | Names, email, phone, address, company, notes | Account-owned Contacts; archive exists | Lawful basis/notice; invitation use; correction/export/deletion; duplicate merge; closed-account purge | Open |
| Jobs and accepted Work | Listings, applications, offers, agreed pay, milestones, logs | Durable and versioned | Commercial-record period; participant rights; archive vs deletion; dispute/legal hold | Open |
| Messages and private notes | Conversations, attachments, contact notes, reactions | Durable; some attachment expiry state | User deletion, counterpart copy, abuse evidence, attachment-byte purge, closed-account behavior | Open |
| Shop Talk and public content | Posts, answers, reactions, reports, publication state | Durable; moderation state; owner delete/hide paths | Public cache/search removal, moderation evidence period, copyright/takedown, answer ownership | Open |
| Photos and uploads | Project proof, album photos, avatars, logos, credentials, message files | Private S3 keys; some soft-removal paths | Malware quarantine; EXIF policy; object purge retries; orphan reconciliation; byte-level backup/restore | Open |
| Estimates and invoices | Customer snapshots, line items, delivery, payment instructions | Durable account records | Tax/commercial retention, correction/voiding, customer copy, export/deletion exception | Open |
| Stripe and payment state | Checkout IDs, payment intent, settlement/refund/dispute state, webhook data | New Billing events retain minimized identifiers/status only; historical rows may contain full provider payloads | Review and migrate historical payloads; approve financial-record period, provider-vs-RIVT deletion, and dispute/legal-hold rules | Open |
| Reviews, safety, support, moderation | Reports, restrictions, disputes, support cases | Some append-only evidence | Safety/fraud retention, appeal, access, legal hold, deletion exceptions | Open |
| Logs and telemetry | Request IDs, errors, client beacons, analytics, synthetic runs | Provider and application logs; sensitive-key and common value-pattern redaction | Approve retention/access, prefer allowlisted structured fields, verify provider scrubbing/deletion, and account for arbitrary free-text PII that pattern filtering can miss | Open |
| Rate limits and idempotency | HMAC subject hashes, request hashes, cached responses | Expiring rows; bounded cleanup added | Confirm cleanup evidence and ensure cached response bodies contain minimum data | Implemented, monitor |
| Backups | Encrypted PostgreSQL artifact, object keys and metadata | 30-day policy; fresh artifact inside the 24-hour RPO; exact artifact not restored; no object bytes | Restore the exact fresh artifact, establish approved recurring evidence, add object-byte recovery, key rotation/escrow, immutable copy, and purge propagation | Blocked |

## Required workflows

- server-owned account export with identity verification and an audit trail;
- deletion/closure orchestration across PostgreSQL, object storage, Stripe,
  Resend, Sentry, push endpoints, analytics, and backups;
- legal-hold and safety/fraud exceptions with named authority and expiry;
- bounded scheduled purge jobs with dry-run, metrics, retry, and reconciliation;
- orphaned-object and failed-deletion reconciliation;
- provider deletion requests and completion evidence;
- user-facing privacy copy and support SLA for access, correction, export,
  deletion, and appeal.

No production purge or migration should run until the policy, migration,
rollback, dry-run evidence, and legal review are approved.
