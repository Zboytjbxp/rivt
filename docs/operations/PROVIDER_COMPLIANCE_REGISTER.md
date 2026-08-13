# Provider compliance register

Status: **verification required — not approved for a public launch claim**
Owner: Michael
Last engineering review: 2026-08-12

This register records evidence that must be collected from the actual provider
accounts and contracts. Public documentation alone does not prove RIVT's
selected region, account configuration, retention, or contractual coverage.

| Provider / service | Purpose and data | Current code state | Account/contract evidence required | Status |
|---|---|---|---|---|
| Railway application | Hosts API and frontend; receives account and request data | Enabled | Service region, TLS termination, runtime isolation, logs/retention, incident notice, DPA/subprocessors, deletion, replicas/autoscale configuration | Verification required |
| Railway PostgreSQL | Canonical accounts, contacts, jobs, messages, posts, documents, payment state, audit data | Enabled | Region, private networking, encryption at rest, TLS certificate verification, backups/PITR, HA, retention/deletion, DPA/subprocessors | Verification required |
| Railway object storage | Photos, attachments, logos, evidence, encrypted logical artifacts | Enabled | Region, encryption, versioning/object lock, byte-level backups, durability, deletion, lifecycle rules, DPA/subprocessors | Verification required |
| Stripe Billing | RIVT subscription checkout and billing state | Configurable/enabled in production health | DPA, PCI responsibility, retention/deletion, region/transfers, dispute/refund support, webhook retention | Verification required |
| Stripe Connect / ACH | Connected trade-business accounts and customer ACH Checkout | Configurable/enabled in production health | Platform/merchant liability, NACHA authorization, KYC, card-capability reason, disputes/refunds, retention, DPA/subprocessors, incident notice | Verification required |
| Resend | Verification, recovery, lifecycle, estimate, and invoice email | Configurable | DPA, region, subprocessors, content retention, deletion, bounce/complaint data, incident notice | Verification required |
| Sentry | Server/client error telemetry | Configurable/enabled in production health | DPA, region, retention, scrubbing, source-map access, subprocessors, deletion, incident notice | Verification required |
| Browser Web Push endpoints | Notifications to opted-in devices | Configurable/enabled in production health | Browser-vendor data flow, endpoint retention, consent/revocation, message-content minimization | Verification required |
| Google OAuth | Optional identity login | Configurable | OAuth scopes, DPA/terms, data retention/deletion, region/transfers, incident process | Verification required |
| Apple OAuth | Optional identity login | Configurable | OAuth scopes, terms, data retention/deletion, region/transfers, incident process | Verification required |
| Have I Been Pwned | K-anonymous breached-password range check | Configurable | Terms, request logging/retention, availability, privacy description; confirm only five-character hash prefixes leave RIVT | Verification required |
| GitHub Actions | Source, CI, test artifacts, synthetic schedule | Enabled | Organization access, branch protection, secret scope, log/artifact retention, DPA/subprocessors, incident notice | Verification required |
| Independent backup foundation | Coordinated encrypted PostgreSQL and object-byte recovery sets | Dedicated AWS account and empty US-region S3 bucket now have root passkey MFA, zero root access keys, a near-zero spend alert at $0.01 (not a cap), Block Public Access, bucket-owner-enforced ownership, Versioning, SSE-S3, and default 30-day Object Lock COMPLIANCE. A deny-only policy was saved and is configured to deny non-TLS traffic plus non-conditional writes on the reserved backup prefix; live negative-request enforcement remains unproved. No runtime identity/key, retained object, lifecycle, scheduler, monitor, or restore exists; current source is PostgreSQL-only. | DPA/subprocessors/transfers, live least-privilege credential-conformance proof, separate object-byte coverage, approved bounded recurrence/expiry, threshold key custody, incident route, exact cost owner/ceiling, received alert, and isolated complete-set restore proof | Foundation configured / activation blocked |
| Product analytics | Funnel events with no direct PII | No-op without a key | Vendor decision, region, DPA, retention/deletion, access controls, event schema review | Not enabled / decision required |
| Twilio | Legacy SMS relay | Retired route; should remain disabled | Do not enable without consent, STOP/HELP, registration, DPA, retention, abuse controls, and cost approval | Disabled |

## Approval rule

A provider is not “approved” until a named reviewer records:

1. account/project and region;
2. DPA/SCC or applicable contractual terms;
3. subprocessor review;
4. encryption and access controls;
5. retention and deletion behavior;
6. recovery/durability evidence;
7. incident-notification route and timeframe;
8. cost owner and budget alert;
9. review date and evidence location.

Do not place secrets, API keys, DSNs, bank details, or signed URLs in this
register.
