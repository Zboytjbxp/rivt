# Packet 58 - Calculator Key Balance

## Objective

Give Heavy 16th one consistent input rhythm on phones. Fraction presets and
whole-number keys must feel like parts of the same calculator instead of a
large fraction panel stacked above a compressed keypad.

## Source boundary

- Base source: Packet 57 production source `14dc2b2`.
- Implementation branch: `codex/calculator-standalone-app`.
- CSS layout and rendered-regression coverage only.
- No calculator math, API, schema, authentication, authorization, billing,
  storage, moderation, or dependency changes.

## Changes

- The mobile calculator now allocates proportional height to three fraction
  rows and four whole-number/operator rows.
- Fraction and whole-number keys share a balanced visual height while retaining
  distinct five-column and four-column layouts.
- Fraction labels are slightly larger for jobsite readability.
- Compact phones preserve every fraction and keypad action without scrolling.
- Rendered QA fails if a representative fraction key and whole-number key drift
  more than eighteen percent apart in height.

## Acceptance

- Fraction keys no longer appear approximately twice as tall as number keys.
- All keys remain at least forty pixels high on the compact SE layout and at
  least forty-four pixels high for the primary keypad where space permits.
- The calculator remains edge-to-edge, owns the handset viewport, and has no
  horizontal or vertical overflow.

## Verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run lint:security` - passed.
- `npm run test` - 58 unit/frontend tests and three non-database integration
  checks passed; sixteen PostgreSQL suites skipped because this CSS-only
  worktree does not contain `TEST_DATABASE_URL`.
- `npm run test:e2e` - passed.
- `npm run test:ui:tools` - passed at desktop, mobile, and SE viewports.
- `npm run test:ui:mobile-actions` - passed.
- `npm audit --omit=dev` - passed with zero vulnerabilities.
- `git diff --check` - passed.
- Production `/api/health` served exact source
  `fe393887abe17a2e5c162769a62851897feb81bb` with migration 0028 ready.
- `EXPECTED_SOURCE_COMMIT=fe393887abe17a2e5c162769a62851897feb81bb npm run monitor:production`
  passed in 619 ms with managed dependencies, observability, engagement
  controls, and all seven anonymous private-route checks healthy.
