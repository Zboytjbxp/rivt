# Packet 42 - Estimate Email Delivery

## Objective

Turn Estimate from a pricing worksheet into an honest, customer-facing delivery
flow. A contractor can save an estimate, review exactly what the customer will
receive, and send that saved snapshot by email without exposing internal
overhead, margin, or contingency.

## Scope

- Add an authenticated `POST /api/v1/estimates/:localId/send` route for an
  account-owned saved estimate.
- Validate the recipient, saved total, and customer-facing line-item snapshot
  before attempting delivery.
- Use the existing transactional email provider with a client idempotency key,
  record sent or failed delivery state on the estimate record, and replay the
  same successful idempotency key without another email.
- Give the Estimate tool a customer, recipient, validity, scope, note, and
  in-app customer preview before the Send action is enabled.
- Keep the compact action dock usable on SE-class devices: Send remains the
  labeled primary action while secondary actions collapse to familiar icons.
- Add PostgreSQL integration coverage for validation, successful delivery,
  duplicate replay, customer-safe content, and cross-account denial.

## Non-goals

- No payment link, checkout, payment request, escrow, payroll, or job-payment
  workflow.
- No electronic signature, customer approval portal, public estimate URL, or
  automatic estimate-to-invoice conversion after delivery.
- No new email provider, migration, or background retry queue. Delivery uses
  the existing configured transactional provider and the current saved
  `tool_records` payload.

## Acceptance Criteria

1. A saved estimate can be sent only by its owning account and only with a
   valid customer email and a positive, internally consistent saved total.
2. The email is itemized and customer-safe: it includes scope, visible line
   items, total, validity, and sender identity; it never includes overhead,
   margin, contingency, provider secrets, or a fake payment/approval claim.
3. A confirmed provider response changes the saved record to `sent`; a
   provider failure records `delivery_failed` and reaches the user as an error,
   not a success toast.
4. The same idempotency key replays the prior confirmed result without sending
   another email. The client preserves its key while retrying unchanged fields
   after a weak-signal failure.
5. Sending is unavailable until recipient and price are complete, while Save
   remains available for incomplete work.
6. Compact mobile keeps a reachable, visibly primary Send action and does not
   let generic dock rules undo the Estimate-specific layout.

## Verification Evidence

- `npm run build` passed.
- `npm run lint` passed.
- `npm run test:ui:tools` passed.
- `npm run test:ui:mobile-actions` passed.
- `npm run test:unit` passed (53 tests).
- `npm run test:e2e` passed.
- `npm audit --omit=dev` passed with zero production vulnerabilities.
- `test/tool-records.integration.test.js` includes delivery validation,
  customer-safe email, idempotent replay, and cross-account authorization
  cases.
- The isolated `rivt_test` database reset cleanly through migration `0027`.
  `npm run test:integration` passed all 19 suites, including the delivery
  cases. The migration lifecycle test was updated to explicitly roll back
  `0027_default_private_photo_album` before asserting the existing `0026`
  rollback sequence.
- The reviewed branch was fast-forward merged to `master` and Railway deployed
  production deployment `8b04379c-b828-430b-9a54-55aad5608048`. Live health
  and `npm run monitor:production` both confirmed exact source
  `4793b1b3dd240fb709e88c820d649ea5f31f5031`.

## Boundary and Risk

- Resend/provider setup controls whether a real delivery can succeed. An
  unconfigured or failing provider returns a real error and leaves the record
  marked as failed; the UI must never call this sent.
- This is delivery only. A customer replying, accepting, signing, paying, or
  generating an invoice remains a separate explicit workflow.
- Founder-controlled inbox acceptance completed on 2026-07-14: the real
  estimate email arrived successfully. Do not induce a provider outage in
  production; the captured-provider integration case proves the failed state
  and same-key replay behavior.
