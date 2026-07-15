# Packet 43 - Tools Truth and Containment

## Objective

Make the public Tools surface smaller and more trustworthy without deleting
stored records or forcing a risky all-at-once redesign. Public navigation must
open only supported tools, and mileage deductions must use the IRS business
rate that applies on each trip date rather than one stale global value.

## Scope

- Define one shared public tool catalog used by URL parsing, notification deep
  links, internal tool transitions, and the Tools container.
- Keep the supported public tools reachable while containing six unfinished or
  overlapping implementations: Earnings, Bid Builder, Tax Estimator,
  Contracts, Job Checklist, and Daily Report.
- Redirect stale URLs and notification targets for contained tools to the Tools
  hub instead of exposing an incomplete surface.
- Preserve contained implementations and every existing tool record for a
  later reviewed consolidation or migration.
- Calculate mileage deductions by trip date using published IRS business
  mileage periods for 2024, 2025, and both 2026 rate periods.
- Exclude dates without a built-in published rate instead of guessing, and tell
  the user that those miles require review.
- Add source-level and rendered Tools smoke coverage for both behaviors.

## Non-goals

- No stored tool record is deleted, rewritten, or migrated.
- No database migration, authorization change, billing change, or production
  provider configuration is included.
- This packet does not yet merge Price Book into Materials or Time, Expenses,
  Mileage, and Tax Summary into one Time & Costs app.
- This packet does not provide tax advice or assume an unpublished future IRS
  mileage rate.
- Existing public tool forms are not visually redesigned in this packet.

## Acceptance Criteria

1. Public tool URLs, notifications, and internal navigation accept one shared
   allowlist; a contained mode resolves to the Tools hub.
2. Calculator, Camera, Estimate, Invoice, Materials, Daily Log, Time Tracker,
   Expense Logger, Mileage, Price Book, Safety Checklist, Punch List, Payment
   Tracker, and Tax Summary remain reachable.
3. Existing records and contained implementation code remain untouched so a
   later consolidation can migrate or expose them deliberately.
4. Mileage uses $0.67 for 2024, $0.70 for 2025, $0.725 for 2026-01-01 through
   2026-06-30, and $0.76 beginning 2026-07-01.
5. Trips outside supported published periods are excluded from the estimate
   and surfaced as needing rate review.
6. Unit tests cover the public catalog and rate boundaries, and rendered Tools
   smoke proves a contained deep link falls back to the hub on a compact phone.

## Verification Evidence

- `npm run build` passed.
- `npm run lint` passed.
- `npm run test:unit` passed (55 tests).
- `npm run test:ui:tools` passed at desktop, mobile, and compact-phone
  viewports, including the contained-route assertion.
- `npm run test:integration` passed all 19 PostgreSQL suites against the
  isolated `rivt_test` database.
- `npm run test:e2e`, `npm run test:ui:mobile-actions`, and
  `npm run lint:security` passed.
- `npm audit --omit=dev` reported zero vulnerabilities, and
  `git diff --check` reported no whitespace errors.
- The first mobile-action run exposed a controlled-route regression: browser
  Back changed the URL from Calculator to the Tools hub while the calculator
  stayed mounted. The Tools container now treats App URL state as
  authoritative; the rerun passed and preserves Calculator -> Tools Back.

## Boundary and Risk

- Containment is reversible and does not remove data. The hidden component
  implementations still compile until their capabilities are merged or
  formally retired in a later packet.
- IRS rates are product configuration backed by published guidance, not a tax
  determination. The UI labels the result as an estimate and asks users to
  confirm current guidance.
- The next train should consolidate Price Book into Materials first, then
  combine Time, Expenses, Mileage, and Tax Summary into Time & Costs. Those
  changes require their own record-compatibility review.

## Production Evidence

- Feature commit: `a068728d98d74c73e925144050e076c756ee53b2`.
- Railway deployment: `f343cb7b-ac98-4403-a348-5a1d7bf4feb5`.
- Production health returned the exact feature source, PostgreSQL,
  S3-compatible object storage, configured Sentry, configured Web Push, and
  ready migration `0027_default_private_photo_album`.
- The expected-source synthetic monitor passed all seven anonymous
  private-route checks with rollout controls disabled.
