# Packet 61 - Calculator Fraction Hierarchy

## Objective

Make Heavy 16th fraction choices read immediately like a tape: quarters are
the strongest marks, eighths are medium marks, and sixteenths are compact
marks. Keep every key equally reachable and balanced on compact phones.

## Source Boundary

- Base source: `origin/master` at `3d39902`.
- Implementation branch: `codex/calculator-fraction-hierarchy`.
- Calculator presentation, semantic labels, and rendered UI regression
  coverage only.
- No calculator arithmetic, server, schema, authorization, billing, storage,
  or dependency changes.

## Changes

- Quarter buttons carry a long, strong tape mark and a lightly emphasized
  key surface.
- Eighth buttons use a clearly shorter, medium-weight mark.
- Sixteenth buttons use the shortest mark, preserving a quiet but visible
  tape cadence.
- Every preset exposes its tape family through semantic data and an accessible
  label; selected state preserves the same hierarchy.

## Acceptance

- `1/4`, `1/8`, and `1/16` are recognizable at a glance without relying on
  color alone.
- Quarter, eighth, and sixteenth targets stay equal in size.
- The rendered mobile Tools test verifies quarter > eighth > sixteenth mark
  height and width at handset viewports.

## Verification

- `npm run build` passed.
- `npm run lint` passed.
- `npm run test` passed: 58 unit/frontend tests and three non-database
  integration checks. Sixteen PostgreSQL integration suites are skipped because
  this worktree does not have `TEST_DATABASE_URL` configured.
- `npm run test:e2e`, `npm run test:ui:tools`, and
  `npm run test:ui:mobile-actions` passed.
- `npm audit --omit=dev` reported zero known vulnerabilities.
- The rendered SE calculator confirms the long quarter, medium eighth, and
  short sixteenth tape marks at equal tap-target sizes.
- Deployment evidence is pending.
