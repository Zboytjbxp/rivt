# Stripe Connect ACH Pilot Runbook

## Safety boundary

- RIVT creates direct ACH charges on the invoice author's connected Stripe
  merchant account.
- RIVT takes no application fee and does not hold, escrow, guarantee, insure,
  or protect job funds.
- Stripe Checkout completion is not settlement. Only signed asynchronous
  success contributes to the paid invoice balance.
- Never copy a sandbox secret, account, event destination, or signing secret
  into the live environment.

## Rollout controls

The server requires all of these before it can create onboarding or payment
links:

- `STRIPE_CONNECT_ACH_ENABLED=true`
- `STRIPE_SECRET_KEY`
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- at least one UUID in `STRIPE_CONNECT_ACH_PILOT_ACCOUNT_IDS`

`STRIPE_CONNECT_ACH_ALLOW_ALL=true` is a separate explicit open-enrollment
override. Do not set it during the pilot. A user interface control is not
authorization; the server checks the authenticated account UUID before every
onboarding, account-management, and link-creation request.

## Operator status

Run this against the intended environment:

```text
npm run payments:pilot:status
```

Add `-- --require-ready` for a failing readiness gate. The command reports
only aggregate account, payment, and webhook states. It does not print pilot
UUIDs, email addresses, Stripe account IDs, or secrets.

Before inviting a pilot, require:

- rollout mode `pilot`
- controlled-pilot readiness `true`
- exactly the approved pilot-account count
- no unexpected open or processing payments
- recent webhook delivery after an intentional test

## Staging proof

1. Use an isolated Railway environment and isolated PostgreSQL service.
2. Confirm its database URL is different from production before migration.
3. Use Stripe sandbox keys and the sandbox connected-account destination.
4. Use a staging-only application origin and signing secret.
5. Create a staging trades account and add only its UUID to the pilot list.
6. Complete Stripe-hosted sandbox onboarding manually when Stripe requires
   CAPTCHA, identity, business, or bank input.
7. Create and pay one invoice with Stripe's successful ACH fixture.
8. Confirm RIVT remains `processing` until the signed asynchronous success,
   then becomes `paid`.
9. Repeat with Stripe's failing ACH fixture and confirm the invoice reopens.
10. Verify replayed and out-of-order events do not duplicate or regress state.

## Live pilot activation

1. Michael completes Stripe platform and connected-merchant identity/business
   verification.
2. Create a live connected-account event destination for exactly the events
   handled by RIVT.
3. Install the live destination's signing secret in Railway.
4. Set one approved account UUID in
   `STRIPE_CONNECT_ACH_PILOT_ACCOUNT_IDS`.
5. Keep `STRIPE_CONNECT_ACH_ALLOW_ALL=false`.
6. Set `STRIPE_CONNECT_ACH_ENABLED=true`.
7. Run the operator readiness command and production monitor.
8. Create a low-value pilot invoice, observe processing, and wait for signed
   settlement before treating it as paid.

## Stop and rollback

1. Set `STRIPE_CONNECT_ACH_ENABLED=false` to stop new onboarding and links.
2. Keep the webhook secret and public return route active while any payment
   is open or processing.
3. Do not delete connected accounts or payment records.
4. Resolve refunds and disputes in Stripe; verify RIVT reopens the invoice.
5. Do not roll back migrations `0030` or `0029` after real account/payment
   data exists without an approved export and retention plan.
