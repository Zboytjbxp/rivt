# Packet 68 - Job Lifecycle Coherence

## Goal

Make the contractor-to-tradesperson work lifecycle explain what just happened,
who acts next, and where the accepted or completed job now lives.

## Scope

- Confirm every application, shortlist, decline, offer, acceptance,
  reschedule, and cancellation action with a specific next-step message.
- Treat a listed fixed-price application as applicant selection and job
  confirmation rather than making both parties feel that the price is being
  negotiated a second time.
- Wait for active work, job lists, and inbox state to refresh after lifecycle
  changes so completed work does not remain presented as active on Home.
- Preserve the existing server-owned application, offer, active-work, and
  closeout authorization boundaries.

## Acceptance

- A successful action leaves a visible confirmation naming the next actor or
  destination; a failed action leaves the server error and no false success.
- A contractor choosing a fixed-price applicant sends a confirmation at the
  listed price, and the tradesperson confirms the job without re-entering pay.
- Accepting an offer opens the private workspace and refreshes Home, Work, and
  Inbox state before the action completes.
- Completing or cancelling work refreshes lifecycle state so stale active-work
  cards are removed.

## Verification

- `npm run build` passed.
- `npm run lint` passed.
- `npm run test:unit` passed: 59 tests.
- `npm run test:e2e` passed.
- `npm run test:ui:mobile-actions` passed at the 375px mobile viewport.
- `npm audit --omit=dev` passed with zero vulnerabilities.
- `npm run test` exited successfully: three non-database integration checks
  passed and sixteen PostgreSQL suites were skipped because
  `TEST_DATABASE_URL` is not configured in this clean worktree.

## Non-goals

- No schema, migration, billing, payment-processing, or trust-language change.
- No replacement of the existing server-side application, offer, or closeout
  state machine.
