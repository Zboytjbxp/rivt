# Recovery retention, erasure, legal hold, and key custody

Status: **draft - owner and counsel approval required**

This document is an engineering proposal, not legal advice. It creates no
provider configuration and authorizes no spending or production-data access.

## Separate lifecycle concepts

RIVT must keep these distinct in code, operations, and customer copy:

1. **Primary-data retention** - how long live records serve a documented
   product, commercial, safety, or legal need.
2. **Account closure** - disables access and publication but retains records.
   It must never be presented as deletion.
3. **Verified erasure** - promptly unpublishes and then purges eligible
   database and provider data with durable retry and reconciliation.
4. **Immutable-backup lifecycle** - a locked recovery set cannot surgically
   delete one user. An at-least-30-day lock is proposed, after which lifecycle
   deletion and reconciliation may take additional time.

## Proposed engineering defaults

These periods remain open until owner and counsel approval.

| Data class | Proposed primary retention | Proposed deletion behavior |
| --- | ---: | --- |
| Sessions, OAuth/password secrets, push tokens | Active account only | Revoke immediately; purge within 24 hours after verified erasure |
| Public profile, credentials, avatar, portfolio/evidence | While active | Unpublish within 1 hour; purge eligible rows/files within 30 days |
| Imported contacts and private notes | Until user deletion or erasure | Purge within 30 days unless narrowly held |
| Draft estimates, invoices, templates, draft jobs/tool records | 90 days after archive/inactivity | Warn before scheduled purge; erasure can accelerate |
| Shared messages and ordinary job coordination | 3 years after closure | Preserve justified counterpart record; remove private fields and pseudonymize departing user |
| Final invoices, accepted estimates, completed-job proof, change orders, settlements/refunds/disputes | 7 years after completion | Minimize retained fields; tax/counsel approval required |
| Public Shop Talk content | Until delete/moderation | Hide immediately; purge or pseudonymize within 30 days; remove cache/search copies |
| Moderation, safety, fraud, support | 3 years after case closure | Extend only under a documented hold; commercial disputes may follow 7 years |
| Request/error logs | 30 days | Provider-enforced expiry |
| Security/authentication logs | 90 days | Provider-enforced expiry |
| Minimal deletion receipts | 2-3 years | Keep case ID, dates, scope, and result; no unnecessary identity/content |
| Product analytics | At most 13 months | No direct PII |
| Pending attachments | 24 hours | Durable purge and reconciliation |
| Failed, rejected, removed uploads | No ongoing purpose | Delete promptly, retry to confirmation, exclude from backup |
| Immutable recovery snapshots | Proposed at least 30 days | Disaster recovery only; lifecycle-delete and reconcile after lock expiry; suppression ledger must run before reopening a restore |

## Erasure and restore-purge ledger

A verified erasure must:

1. immediately revoke sessions and remove public visibility;
2. create a minimal server-owned erasure case and exact data-scope ledger;
3. purge eligible primary PostgreSQL rows and object versions;
4. request provider deletion where RIVT cannot delete directly;
5. retry failures durably until confirmed;
6. reconcile database tombstones against object inventory;
7. retain only documented legal/commercial exceptions;
8. record a minimized completion receipt.

Every restore must obtain and apply a separately retained, append-only,
authenticated erasure-suppression ledger that is newer than the restore point
and independently available during recovery. Recovery fails closed when that
ledger is missing or stale. This control must be designed and tested before it
can prevent a valid but older immutable snapshot from bringing deleted
profiles, content, contacts, or files back into service.

Account closure alone does not execute this workflow.

## Legal hold

- No hold exists by default.
- Only a named officer or counsel may create one.
- Required fields: case ID, purpose, exact subjects/records/objects, start,
  authority, reviewer, 90-day review/expiry, and release authority.
- A hold never restores publication or ordinary user access.
- Prefer a separate encrypted hold vault over extending every recovery set.
- Release triggers eligible purge within 30 days.
- Every extension requires explicit review.

## Key custody

The current environment-held symmetric master key is not the target
production custody model.

Before activation:

1. create a random data-encryption key per recovery set;
2. encrypt that key to one recovery public key kept in the scheduled runtime;
3. split the corresponding recovery private key using a reviewed
   cryptographic 2-of-3 threshold secret-sharing scheme;
4. keep every private-key share out of production configuration;
5. record key ID and epoch in authenticated completion data;
6. test reconstruction, decryption, re-splitting, and witnessed destruction
   before activation.

Proposed cryptographic 2-of-3 custodians are:

- Michael;
- a named successor;
- an independent trusted custodian or counsel.

Shares should live on separate hardware-backed or offline media, not one
password manager or cloud provider. Three independently usable wrapped keys
would be 1-of-3 and do not satisfy this proposal.

Rotate annually, on custodian departure, provider change, or suspected
exposure. Keep an old recovery key only until every snapshot or valid hold
using it expires, then record witnessed destruction.

## Break-glass recovery

1. Open an incident case and name the approved snapshot.
2. Obtain approval from two custodians.
3. Reconstitute the recovery key from two shares only on an isolated
   workstation.
4. enable a time-limited recovery-reader identity;
5. verify completion metadata and ciphertext integrity;
6. restore into isolated resources;
7. apply erasure and legal-hold ledgers;
8. reconcile database and object integrity;
9. obtain explicit approval before reopening;
10. revoke credentials, wipe the workspace, and rotate on suspected
    exposure;
11. complete an immutable access review within one business day.

## Decisions required

- approve or change each period and trigger above;
- define closure versus erasure and any reversal period;
- define counterpart rights for shared jobs/messages;
- approve legal-hold authority, review, expiry, release, and storage;
- define archive versus delete for professional evidence;
- approve DSAR identity checks, export format, response SLA, and evidence;
- require durable provider/object deletion retry and reconciliation;
- require an independent, current, authenticated suppression ledger before
  every restored service opens;
- normalize and purge historical full Stripe webhook payloads;
- decide treatment of legacy hashless objects;
- require every canonical `stored` byte to be encrypted and backed up, retain
  scan state, and quarantine/re-scan unscanned bytes after restore;
- update public privacy/legal copy to match approved behavior.

Until these decisions are approved and implemented, immutable backup
Compliance mode must not be enabled for customer data.
