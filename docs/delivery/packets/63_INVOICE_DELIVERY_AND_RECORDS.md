# Packet 63 - Invoice Delivery and Records

## Objective

Replace the device-only Invoice Draft email handoff with a server-confirmed
transactional email flow. An invoice must be persisted before it is sent, and
the app may only report delivery after the configured provider accepts it.

## Scope

- Add an authenticated, account-owned `POST /api/v1/invoices/:localId/send`
  route with idempotency support.
- Validate recipient email, positive total, and a customer-facing invoice
  snapshot before delivery.
- Persist delivery state, recipient, provider message id, and failure details
  on the invoice record.
- Present distinct `Save draft`, `Email invoice`, and `Print or Save PDF`
  actions in the Invoice review surface.
- Preserve direct-payment language. RIVT records an invoice and emails it; it
  does not collect, hold, verify, or protect payment funds in this packet.

## Acceptance boundary

- A send request cannot claim success before the email provider responds.
- Replaying the same idempotency key does not send duplicate email.
- An account cannot send another account's invoice.
- Customer email contains only customer-facing invoice fields; internal
  overhead, margin, and contingency remain out of the delivery snapshot.
- Failed delivery is recorded as a failed attempt and has a human-readable
  error path in the editor.

## Verification

- `npm run build`
- Scoped lint passes while generated local Codex worktrees are excluded; the
  repository-wide lint command currently treats those unrelated nested
  worktrees as additional TypeScript roots.
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:ui:mobile-actions`
- `node --env-file-if-exists=.env --test --test-concurrency=1 test/tool-records.integration.test.js`
- `npm audit --omit=dev`
- `npm run test:integration` was started with configured `TEST_DATABASE_URL`
  and exceeded the local ten-minute command limit without reporting a
  failure. The targeted invoice integration suite completed successfully.

## Risk boundary

This packet adds email delivery only. It does not add online invoice payment,
escrow, payment processing, tax calculation, or automatic payment status.
