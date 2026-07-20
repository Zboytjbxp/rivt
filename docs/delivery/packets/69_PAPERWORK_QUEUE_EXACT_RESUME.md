# Packet 69 - Paperwork Queue Exact Resume

## Goal

Make unfinished estimates and invoices visible on Home and reopen the exact
saved record instead of starting a new document or selecting unrelated work.

## Scope

- Add an honest Home paperwork queue for saved estimate and invoice drafts.
- Open each queue item in its matching tool with the exact local record id.
- Restore the record's accepted-work or standalone-project context without
  changing the user's normal preferred tool destination.
- Preserve record ids while editing so subsequent saves update the selected
  draft rather than creating duplicates.
- Keep all existing estimate and invoice sending, export, authorization, and
  server-persistence boundaries unchanged.

## Acceptance

- Home shows real saved estimate and invoice drafts only when they exist.
- Tapping a queue item opens the selected document with its saved customer,
  amount, work context, and editing state.
- Saving after resuming updates the same record id.
- A standalone-project draft restores that project for the current tool open
  without silently changing the user's persistent destination preference.
- Empty accounts receive no fabricated paperwork or fake urgency.

## Verification

- `npm run build` passed.
- `npm run lint` passed.
- `npm run test:unit` passed: 59 tests.
- `npm run test:e2e` passed.
- `npm run test:ui:mobile-actions` passed at the 375px mobile viewport.
- `npm run test:ui:tools` passed with exact-record source assertions.
- `npm audit --omit=dev` passed with zero production vulnerabilities.
- `npm run test` exited successfully: three non-database integration checks
  passed and sixteen PostgreSQL suites were skipped because
  `TEST_DATABASE_URL` is not configured in this clean worktree.

## Non-goals

- No schema, migration, billing, payment-processing, authorization, or email
  provider change.
- No new draft type or fabricated Home assistant state.
