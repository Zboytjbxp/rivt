# Data retention and deletion matrix

Status: **draft - legal, owner, and operational approval required**
Engineering review: 2026-07-29

RIVT does not yet have a complete purge/export/deletion program. This matrix
identifies the decisions and implementation evidence required before public
launch. Proposed periods are conservative engineering defaults from Packet
91; they are not approved and are not legal advice. The full proposal is
`docs/operations/RECOVERY_RETENTION_AND_KEY_CUSTODY_DRAFT.md`.

| Data class | Examples | Current behavior | Required decision / control | Status |
|---|---|---|---|---|
| Identity and authentication | Account, profile, verified email, password material, OAuth links, sessions | Canonical PostgreSQL; sessions can be revoked | Active account only for sessions/secrets; revoke immediately and proposed purge within 24 hours of verified erasure. Profile/evidence proposed while active, immediate unpublish, eligible purge within 30 days | Proposed / approval required |
| Imported non-user contacts | Names, email, phone, address, company, notes | Account-owned Contacts; archive exists | Proposed until user deletion/erasure, then purge within 30 days unless narrowly held; approve notice, invitation use, correction/export/deletion, duplicate merge | Proposed / approval required |
| Jobs and accepted Work | Listings, applications, offers, agreed pay, milestones, logs | Durable and versioned | Drafts proposed 90 days after archive/inactivity; final commercial/proof records proposed 7 years; approve participant rights and hold behavior | Proposed / approval required |
| Messages and private notes | Conversations, attachments, contact notes, reactions | Durable; some attachment expiry state | Ordinary shared coordination proposed 3 years after closure; approve counterpart copy, pseudonymization, attachment purge, and abuse evidence | Proposed / approval required |
| Shop Talk and public content | Posts, answers, reactions, reports, publication state | Durable; moderation state; owner delete/hide paths | Hide immediately; proposed purge/pseudonymization within 30 days with cache/search removal; moderation evidence proposed 3 years | Proposed / approval required |
| Photos and uploads | Project proof, album photos, avatars, logos, credentials, message files | Private S3 keys; some soft-removal paths | Follow owning record; failed/rejected/removed bytes delete promptly with durable retry. Malware quarantine, EXIF, orphan reconciliation, and byte-level recovery remain open | Proposed / approval required |
| Estimates and invoices | Customer snapshots, line items, delivery, payment instructions | Durable account records | Drafts proposed 90 days after archive/inactivity; final/accepted commercial records proposed 7 years, subject to tax/counsel approval | Proposed / approval required |
| Stripe and payment state | Checkout IDs, payment intent, settlement/refund/dispute state, webhook data | New Billing events retain minimized identifiers/status only; historical rows may contain full provider payloads | Review and migrate historical payloads; approve financial-record period, provider-vs-RIVT deletion, and dispute/legal-hold rules | Open |
| Reviews, safety, support, moderation | Reports, restrictions, disputes, support cases | Some append-only evidence | Proposed 3 years after closure, with commercial disputes potentially 7 years; approve appeal, access, hold, and erasure exceptions | Proposed / approval required |
| Logs and telemetry | Request IDs, errors, client beacons, analytics, synthetic runs | Provider and application logs; sensitive-key and common value-pattern redaction | Proposed 30-day request/error logs, 90-day security/auth logs, analytics at most 13 months without direct PII; verify provider expiry and scrubbing | Proposed / approval required |
| Rate limits and idempotency | HMAC subject hashes, request hashes, cached responses | Expiring rows; bounded cleanup added | Confirm cleanup evidence and ensure cached response bodies contain minimum data | Implemented, monitor |
| Backups | Encrypted PostgreSQL artifact, object keys and metadata | 30-day retention is approved for current logical artifacts only; fresh artifact is inside the 24-hour RPO; exact artifact not restored; no object bytes | Disaster recovery only; coordinated immutable object sets propose an at-least-30-day lock plus lifecycle reconciliation; require an independently retained current suppression ledger before reopening; add complete object recovery, threshold key custody, recurrence, and proof | Blocked |

## Required workflows

- server-owned account export with identity verification and an audit trail;
- deletion/closure orchestration across PostgreSQL, object storage, Stripe,
  Resend, Sentry, push endpoints, analytics, and backups;
- legal-hold and safety/fraud exceptions with named authority and expiry;
- a separately retained, append-only, authenticated erasure-suppression ledger
  newer than the restore point that fails closed before traffic;
- bounded scheduled purge jobs with dry-run, metrics, retry, and reconciliation;
- orphaned-object and failed-deletion reconciliation;
- provider deletion requests and completion evidence;
- user-facing privacy copy and support SLA for access, correction, export,
  deletion, and appeal.

No production purge or migration should run until the policy, migration,
rollback, dry-run evidence, and legal review are approved.
