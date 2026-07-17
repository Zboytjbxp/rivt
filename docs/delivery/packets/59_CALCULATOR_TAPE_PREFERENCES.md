# Packet 59 - Calculator Tape Preferences

## Objective

Make Heavy 16th behave like a field calculator built around the way a tape is
actually read. Keep inches-only entry first-class, move persistent preferences
out of the keypad, and make Heavy / Light qualifiers truthful by default.

## Source Boundary

- Base source: Packet 58 production source `fe393887abe17a2e5c162769a62851897feb81bb`.
- Implementation branch: `codex/calculator-tape-preferences`.
- Client calculator behavior, preference storage, styles, and rendered UI
  regression coverage only.
- No API, schema, authentication, authorization, billing, storage,
  moderation, or dependency changes.

## Changes

- Calculator settings now persist measurement mode, inches-only versus
  feet-and-inches notation, fraction-key order, and Heavy / Light behavior.
- Metric is a deliberate persistent setting rather than a competing keypad
  control. Imperial users can keep every long measurement in inches.
- Fraction keys retain a consistent size but now visually distinguish quarter,
  eighth, and sixteenth marks. Users can choose tape order or grouped marks.
- Heavy and Light are tape qualifiers by default. A single mark stays visible
  in the result; two matching marks resolve to one sixteenth, and opposing
  marks cancel. Explicit thirty-second precision remains an opt-in setting.
- Double resolves a single Heavy / Light mark to a sixteenth. Half is disabled
  for a single qualifier rather than presenting false thirty-second precision.
- Rendered tools coverage now exercises settings, inches above twelve, and a
  paired-Heavy calculation that resolves to the correct sixteenth result.

## Acceptance

- A user can enter and retain measurements such as `27 5/16\"` in inches-only
  mode without a twelve-inch cap.
- Metric, notation, fraction ordering, and Heavy / Light settings survive
  reopening the calculator on the same device.
- `9 5/16\" H + 1/4\" H` evaluates to `9 5/8\"`, with no temporary
  thirty-second result.
- The compact-phone calculator shows every fraction key as an available tap
  target, including `5/8`, without restoring the decorative ruler control.

## Verification

- `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`,
  `npm run test:ui:tools`, `npm run test:ui:mobile-actions`, and
  `npm audit --omit=dev` pass locally.
- Rendered Tools QA includes desktop, mobile, and SE calculator screenshots;
  the compact SE view keeps `5/8` visible and every calculator control
  reachable without page scrolling.
- `npm run test` passed 58 unit/frontend checks and three no-database
  integration checks. Sixteen PostgreSQL integration suites were skipped
  because this worktree has no `.env` or `TEST_DATABASE_URL`.
- Production deployment and production monitoring are intentionally pending.
- No production deployment is included in this packet.
