# Packet 62 - Tool Context and Estimate Dock Usability

## Objective

Keep new tool work connected only to active RIVT work, while preserving
completed work as history. Make the Estimate builder's mobile action dock
show one clear next action per progressive step without covering the form or
review content.

## Source Boundary

- Base source: `origin/master` at `8f5c494`.
- Implementation branch: `codex/context-dock-fix`.
- Tool context selection and Estimate mobile interaction only.
- No server, schema, authorization, billing, storage, or dependency changes.

## Changes

- `ToolContextPicker` now exposes only records whose canonical work status is
  `active` under **Active RIVT work**.
- Completed and cancelled work remains available through its record/history
  surfaces, but cannot be selected as the destination for a new Estimate,
  Invoice, Camera capture, or other new tool artifact.
- Estimate's action dock varies by step: Price exposes Customer, Customer
  exposes Review, and Review exposes Send email. The invoice conversion
  action remains in the Review content where it is readable and does not
  compete with the delivery action.
- Tool workbenches reserve enough mobile bottom clearance for the fixed dock
  and device safe area, so fields and review content can scroll fully above
  it.

## Acceptance

- A completed job is never listed as active RIVT work in the tool destination
  picker.
- An active accepted job remains selectable as a tool destination.
- Estimate's fixed dock has one primary forward action for the current step
  and does not overlap the final content or the device navigation area.
- Review keeps a visible **Convert to invoice** handoff and a separate
  **Send email** delivery action.

## Verification

- `npm run build` passed.
- `npm run lint` passed.
- `npm run test` passed: 58 unit/frontend tests and three non-database
  integration checks. Sixteen PostgreSQL integration suites are skipped because
  this clean worktree does not have `TEST_DATABASE_URL` configured.
- `npm run test:e2e`, `npm run test:ui:tools`, and
  `npm run test:ui:mobile-actions` passed.
- `npm audit --omit=dev` reported zero known vulnerabilities.
- Railway served exact runtime source `279a21bdd58091d0147d7dda9242a19ee210e54b`.
  `npm run monitor:production` passed with PostgreSQL, S3-compatible storage,
  Sentry, Web Push, matching-job alerts, and all seven anonymous private-route
  checks healthy.
