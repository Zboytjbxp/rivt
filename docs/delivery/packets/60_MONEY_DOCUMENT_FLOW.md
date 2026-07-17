# Packet 60 - Money Document Flow

## Objective

Make the last step of RIVT's Estimate and Invoice tools read like a clear
customer-document handoff: review the exact document, then choose a truthful
delivery action. Keep the field workflow short and avoid presenting a payment
product RIVT does not operate.

## Source Boundary

- Base source: `origin/master` at `f1c3bee`.
- Implementation branch: `codex/money-document-flow`.
- Client money-tool copy, review-stage layout, and rendered UI regression
  coverage only.
- No API, schema, authentication, authorization, billing-provider, payment,
  storage, moderation, or dependency changes.

## Changes

- Estimate's final stage is now plainly called `Preview and send`; its two
  concrete actions are `Make invoice` and `Send email`.
- Invoice's final stage is now `Preview and deliver`, with the complete
  customer document visible immediately in that dedicated stage rather than
  hidden behind an extra disclosure.
- Invoice exposes explicit `Copy invoice` and `Print / save PDF` controls
  alongside device email and text drafts.
- Delivery handoffs report exactly what happened: RIVT opened an email or text
  draft on the user's device. For accepted work, the follow-up is to mark the
  job invoice sent in its private work record.
- RIVT keeps the existing honest boundary: it saves invoice records and can
  record participant-supplied external payment status, but does not collect,
  hold, confirm, or guarantee job payments.

## Acceptance

- Selecting Invoice review reveals a readable customer document without a
  second expand action.
- A contractor can copy the document or open a print/save-PDF flow directly
  from the review stage.
- Missing recipient email or phone produces a specific, actionable message
  rather than a dead delivery link.
- Estimate retains its server-backed email-delivery route and its distinct
  `Make invoice` conversion action.

## Risks And Boundaries

- Browser mail and SMS links hand off to device apps; opening one cannot prove
  that the user ultimately delivered it. The UI must never say that it did.
- Browser printing is device-controlled. `Print / save PDF` is a handoff, not
  an assertion that a PDF was saved.
- This packet does not add online checkout, card/ACH acceptance, payment
  settlement, surcharging, escrow, payment guarantees, or invoice-read
  tracking. Those require reviewed server/provider contracts.

## Verification

- `npm run build` passed.
- `npm run lint` passed.
- `npm run test` passed: 58 unit/frontend tests passed; three non-database
  integration checks passed. The 16 PostgreSQL integration suites skipped
  because this clean worktree does not have `TEST_DATABASE_URL` configured.
- `npm run test:e2e` passed, including the updated visible invoice-preview
  assertions at desktop and mobile viewports.
- `npm run test:ui:tools` and `npm run test:ui:mobile-actions` passed. The
  rendered iPhone SE invoice review shows the full customer document, copy,
  and print/save-PDF actions without a hidden preview disclosure.
- `npm audit --omit=dev` reported zero vulnerabilities.
- Deployment is intentionally outside this packet until the branch completes
  review and merge under the collaboration workflow.
