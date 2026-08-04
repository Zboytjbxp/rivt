# RIVT Gate A Approval Packet

Prepared: 2026-06-22; superseded for approval mechanics by Packets 96-97 on
2026-08-03.

This packet is a signoff aid for the first named Gate A customer cohort. It
does not approve launch by itself. Do not record later approvals in
`docs/operations/incident-routing.json`: that file is source intent `S`.
Fresh provider evidence belongs in protected revision `E`; approvals and the
launch-hold decision belong in a later protected revision `A` and must bind the
exact materialized configuration.

## Current Gate Status

- Public launch is blocked by an active credential-containment launch hold.
- Launch readiness currently reports 21 findings, not merely missing
  founder/support/legal-safety approvals.
- Incident, recovery, and disabled-payment controls are declared in source,
  but fresh protected `E` receipts and later protected `A` approvals do not
  exist.
- Paging downstream delivery and the private backup route are not yet
  observable through an approved evidence provider.
- No independent immutable recovery provider is selected; schedule,
  retention, failure-domain, alert, current artifact, and restore proof remain
  missing.
- Historical provider checks, rehearsal notes, backups, device checks, and
  approvals are useful context but do not prove the final candidate ready.

## Evidence Already Recorded

- Production health: `https://rivt.pro/api/health` reports exact source `6d8e276e036553c5f861f1f8ab97cc3333a3494b`, PostgreSQL, S3-compatible storage, and Sentry monitoring healthy.
- Production monitor: `npm run monitor:production` passed with seven anonymous private-route checks.
- Live Gate A smoke: `railway ssh --service RIVT --environment production -- npm run smoke:gate-a:live` passed inside Railway with zero seed/demo findings and seven anonymous private-route checks.
- Incident rehearsal: Scenario A passed; Sentry accepted event `43fc7567f458490582db1f6642e2e0ea`.
- Recovery: RPO 24 hours, RTO 4 hours, 30-day backup retention, 30-day restore-drill cadence, and named backup-artifact restore evidence are approved.
- Support owner role: founder-support-owner via `support@rivt.pro`.
- Backup owner role: backup-incident-owner; private contact-route status is recorded outside the repo.

## Approval 1: Founder

Recommended signoff scope:

> I approve RIVT Gate A for a controlled named-cohort pilot only, with no homeowner flows, no platform-held payments, no escrow, no payroll, no tax filing, and no fake/demo user-facing data.

Founder approval confirms:

- The launch remains trades-only: contractors, subcontractors, skilled tradespeople, independent trade workers, and crews.
- Pilot access remains limited by invite/cohort controls.
- RIVT does not process job payments in Gate A.
- Operational kill switches are known and can be used if support, safety, or provider issues appear.
- Remaining manual accessibility/device evidence is a known constraint and must be completed before broad launch.

## Approval 2: Support

Recommended signoff scope:

> I approve the Gate A support plan for the named-cohort pilot: support@rivt.pro, Monday-Saturday, 9:00 AM-5:00 PM America/New_York, with the founder-support-owner as primary support owner and the backup-incident-owner role as backup incident owner.

Support approval confirms:

- `support@rivt.pro` is the pilot support inbox.
- The first 48 hours of the named pilot should be watched closely.
- Safety, account lockout, identity, payment-log, and abuse issues escalate through the incident route.
- Sentry high-priority issue alerts are accepted as the first pilot escalation route, with dedicated phone/SMS paging deferred until before broader scale.

## Approval 3: Legal/Safety

Recommended signoff scope:

> I approve the Gate A legal/safety posture for a controlled trades-only pilot, acknowledging that RIVT is a network and workflow platform, not a payment processor, staffing employer, escrow provider, tax preparer, permit authority, or legal advisor.

Legal/safety approval confirms:

- RIVT stays trades-only and does not invite homeowners.
- Work is performed under the hiring contractor's license and responsibility.
- RIVT does not guarantee license, insurance, permit, code, tax, or employment compliance.
- RIVT provides consent/disclaimer language and contextual safety signals, but users remain responsible for compliance.
- Payment history and invoice tools are records/drafts only; RIVT does not move funds, issue 1099s, or hold escrow.
- Shop Talk and trade news are informational/community surfaces, not professional legal, engineering, medical, or safety advice.
- Reports, restrictions, support cases, and admin safety workflows are available for abuse and unsafe behavior.

## Known Risk Acceptance

These items should remain visible even if Gate A approvals are recorded:

- Physical iOS Safari / Android Chrome evidence and route-level manual screen-reader evidence remain incomplete.
- Sentry alerting is the first pilot escalation route; dedicated phone/SMS paging should be added before broader scale.
- Google OAuth, S3-compatible storage, PostgreSQL, and Sentry are live providers; any provider outage can affect users.
- Tools such as invoice drafts and calculators are local/utility support, not guaranteed professional outputs.
- RIVT should keep the pilot small enough that Michael can personally support and observe it.

## Exact Approval Boundary

After every plan-bound provider receipt in `E` has been verified, create the
one separately protected approval manifest `A`. It must contain the named-role
incident, recovery, and disabled-payment approvals, timestamps later than
`E`, exact configuration digests, and an explicit decision on the exact source
incident hold. Do not use a generic approval sentence and do not clear the hold
while any other readiness finding remains.

Then run the protected provider-evidence workflow and:

```text
npm run incident:readiness -- --require-ready
npm run launch:readiness -- --require-ready
```

A failed readiness result is a stop condition. This document never authorizes
deployment, provider access, spending, ACH activation, incident closure, hold
clearance, or launch.

