# Packet 57 - Unlimited Inches Calculator

## Objective

Make Heavy 16th match field convention for tradespeople who work entirely in
inches and sixteenths. Inches mode must never force a measurement into feet.

## Source boundary

- Base source: Packet 56 production source `441b3cf`.
- Implementation branch: `codex/calculator-standalone-app`.
- No API, schema, authentication, authorization, billing, storage, moderation,
  or server-owned record behavior changes.
- No dependency changes.

## Changes

- Inches mode accepts up to five whole-inch digits instead of stopping at two.
- Measurements above twelve inches remain literal, such as `27 5/16"`, in the
  display, equation tape, completed history, copied result, and restored result.
- Feet notation is still available, but only after deliberately selecting
  `FT`. Switching between `IN` and `FT` changes notation without changing the
  measurement.
- New history entries remember their chosen imperial notation. Existing saved
  history remains compatible and restores in inches mode.
- Rendered QA now proves the complete `27 5/16"` -> `2' 3 5/16"` ->
  `27 5/16"` round trip at desktop, mobile, and compact-phone viewports.

## Acceptance

- Entering `27` and `5/16` displays exactly `27 5/16"` in inches mode.
- The same measurement displays `2' 3 5/16"` only after selecting feet.
- Returning to inches restores `27 5/16"` without rounding or data loss.
- Math, scale, copy, history, and metric conversion continue to operate on the
  same underlying measurement.
- The compact path retains all fractions and keypad controls in viewport.

## Verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run lint:security` - passed.
- `npm run test` - 58 unit/frontend tests and three non-database integration
  checks passed; sixteen PostgreSQL suites skipped because this worktree does
  not contain `TEST_DATABASE_URL`.
- `npm run test:e2e` - passed.
- `npm run test:ui:tools` - passed at desktop, mobile, and SE viewports.
- `npm run test:ui:mobile-actions` - passed.
- `npm audit --omit=dev` - passed with zero vulnerabilities.
- `git diff --check` - passed.
- Production `/api/health` served exact feature source
  `cfe99f6bb0ea95e87506e2e7b33eeaec100ef0a9`; the expected-source monitor
  passed in 576 ms with all managed dependencies and private-route checks
  healthy.
