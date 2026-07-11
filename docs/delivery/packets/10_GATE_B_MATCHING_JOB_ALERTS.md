# Packet 10 - Gate B Matching Job Alerts

## Objective

Use the production Web Push path to alert eligible tradespeople when a contractor first publishes matching work, without exposing private jobsite data or creating broad marketplace spam.

## Scope

1. Match active, fully onboarded tradespeople by selected trade and exact public city, region, and country.
2. Exclude the job poster, either side of an account block, opted-out accounts, wrong trades, and wrong cities.
3. Create one server-owned `new_jobs` notification per recipient with an exact job deep link.
4. Queue device delivery through the existing durable Web Push outbox and preference path.
5. Expose a tradesperson-only `Matching jobs` preference in Settings.
6. Cap fan-out with `MATCHING_JOB_ALERT_LIMIT` and fail closed behind `MATCHING_JOB_ALERTS_ENABLED`.
7. Record recipient count, cap, and match rule in the audit trail without recording private address data.

## Explicit Non-Goals

- Radius or travel-time matching before a reviewed geocoding/location model exists.
- Region-wide alerts when the city does not match.
- Alerts when paused work is resumed.
- Email, SMS, saved searches, instant digests, or promoted placement.
- Private address, access note, or postal-code disclosure in any notification.

## Acceptance

- Only the initial draft-to-open publish transition can create matching-job alerts.
- A matching active tradesperson receives one notification and exact `/app/work?job=<id>` destination.
- Wrong-trade, wrong-city, blocked, and opted-out accounts receive none.
- Replaying the publish idempotency key does not create another notification.
- Notification title, body, action, metadata, and audit metadata contain public job context only.
- Recipient notification and push-outbox rows are inserted in bulk; publish does not perform one database round trip per recipient.
- Default fan-out is 200, is operator-configurable, and is hard-capped at 500.
- Public health truthfully reports whether matching-job alerts are enabled, the cap, and the current exact-area rule.
- Build, lint, security lint, unit, jobs/push PostgreSQL integration, E2E, dependency audit, and diff checks pass.

## Rollback

- Set `MATCHING_JOB_ALERTS_ENABLED=false` to stop new alerts without disabling the Work feed or Web Push generally.
- Roll back application source if needed. This packet adds no migration and does not alter existing notification records.

## Stop Condition

Stop after one controlled production job publish proves exactly one eligible test tradesperson receives and opens the alert while excluded accounts do not. Radius alerts, email, SMS, and digest expansion require later reviewed packets.

## Local Evidence

- `npm run build`
- `npm run lint`
- `npm run lint:security`
- `npm run test:unit` (50/50)
- `npm run test:e2e`
- `npm run test:ui:mobile-actions`
- `npm audit --omit=dev` (0 vulnerabilities)
- `git diff --check`
- `npm run test` (complete PostgreSQL aggregate; 19/19 integration assertions)
- Focused jobs and Web Push integration suites pass together. The first recipient-by-recipient implementation took about 64.7 seconds to publish against remote PostgreSQL; the accepted bulk implementation reduced the same publish path to about 3.6 seconds.
