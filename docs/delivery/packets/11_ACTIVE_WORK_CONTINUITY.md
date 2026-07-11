# Packet 11 - Active Work Continuity

## Objective

Make an accepted job feel like one private, durable workspace rather than a set of disconnected screens: the participants can see the project timeline, add proof, close out the work, leave a review, and carry a saved estimate into a job-scoped invoice and external-payment record.

## Scope

1. Add an active-work workspace summary in Work that reads the server-owned project timeline and exposes exact actions for messages, photos, daily log, records, estimate, and invoice.
2. Keep project completion server-owned: tradesperson submits completion; contractor confirms or disputes; confirmation completes active work; each participant can submit one review for the other after completion.
3. Add server-owned project invoice and direct-payment-record tables/routes, limited to active-work participants.
4. Persist invoice line items, totals, delivery state, external-payment records, and estimate-origin metadata. Payment records are evidence supplied by a participant, never proof that RIVT processed or protected payment.
5. Connect Estimate -> Invoice -> external payment record inside the focused job workspace without borrowing another job's context.

## Non-Goals

- No Stripe/ACH/card collection for job payments.
- No escrow, payroll, tax filing, 1099 creation, or payment guarantees.
- No automatic proof that an external payment cleared.
- No fake active work, project records, invoices, or payments.
- No broad rewrite of standalone tools or historic local-only records in this packet.

## Authorization and Privacy

- Only active-work participants may read or create project financial records.
- Only the invoice author can change its draft/sent/void state.
- Either active-work participant may record an external payment, with the actor and timestamp retained.
- Jobsite address, access notes, and other private project content remain inside existing project authorization boundaries.
- Invoice recipient contact details are private project data; they never appear in public jobs, alerts, or matching notifications.

## Acceptance

- Opening accepted work shows the exact project timeline, latest activity, and exact workspace actions.
- Photos, daily logs, messages, Records, Estimate, and Invoice retain the same `activeWorkId`.
- Completion confirmation visibly explains the next review step and supplies an exact review form for the other participant.
- A converted estimate can be saved as a job invoice; its line totals equal the displayed invoice total.
- Invoice and payment records persist across refresh and are visible only to active-work participants.
- Payment status copy states that it is a participant-recorded external payment, not processing by RIVT.
- Build, lint, security lint, unit, integration, E2E, mobile action smoke, dependency audit, and diff checks pass before deployment.

## Rollback

- Roll back the application commit if necessary.
- Database rollback removes the project-financial tables only after deciding whether associated private invoice/payment records may be deleted. No destructive migration runs automatically.

## Separate Field Boundary

Packet 10 matching alerts remain production-configured but require one controlled legitimate Jacksonville publish and physical exact-job tap. Packet 11 does not create a fake production job to satisfy that proof.

## Local Evidence

- `npm run build` - pass
- `npm run lint` and `npm run lint:security` - pass
- `npm run test:unit` - pass (52/52)
- `npm run test:e2e` - pass
- `npm run test:ui:work-lifecycle` and `npm run test:ui:tools` - pass
- `npm audit --omit=dev` and `git diff --check` - pass
- `test/project-completion.integration.test.js` - pass against configured `TEST_DATABASE_URL` (131.9 seconds)
- `test/migrations.integration.test.js` - pass against configured `TEST_DATABASE_URL` (93.1 seconds)
- Full `npm run test` exceeded the ten-minute local wrapper while sequential remote PostgreSQL suites were running; this packet makes no aggregate-pass claim.

## Release Boundary

Do not release the schema or private finance records halfway. Merge the application and migration together, wait for Railway migration `0025` to complete, then verify one legitimate accepted-work record end to end with both participants. The Packet 10 matching-alert physical publish/tap proof remains separate and must use a legitimate Jacksonville job.
