# Packet 87 — Customer document and payment acceptance

## Objective

Drive the deployed Contacts → Estimate → Invoice → Payment path with a
disposable authenticated production account, record exactly what the live
system proves, and fix any release-quality defect exposed by the mobile
acceptance pass.

## Live acceptance evidence

- Production source under test:
  `92a8451b8190f5119384a4970fb1a324503df995`.
- Disposable run:
  `ui-a11y-20260729010727-ca5a44`.
- A contractor account created `Acceptance Customer 0728` as a Customer
  Contact. The live Contacts view reported one synced account-owned Contact.
- Estimate selected that exact saved Contact, populated its company and email,
  priced a $225.00 proposal, saved the draft to the RIVT account, and rendered
  a customer estimate that explicitly said it was not a payment request.
- `Convert to invoice` preserved the selected Contact, scope, total, and the
  converted line-item explanation. The resulting invoice saved to the RIVT
  account.
- Invoice Review independently offered Stripe ACH or exact sender
  instructions. A new account without completed Stripe Connect onboarding was
  stopped with `Finish Stripe bank-payment setup before sending an invoice
  with a pay button`; RIVT did not invent a payment link or claim readiness.
- The direct-payment path required usable instructions, reflected the exact
  instructions in the customer preview, and opened one accessible Send sheet
  with Email, Text, and Email-then-text availability based on the real Contact
  fields. No email was sent to the disposable `example.test` address.
- The live browser reported no console warning/error and no horizontal
  overflow at the mobile acceptance viewport. The only sub-44px target was the
  pre-app service-worker Refresh control.
- The acceptance cleanup closed both disposable accounts and revoked their
  sessions. No temporary account remains active.

## Defect found and fixed

The service-worker update notice could indefinitely cover the top of an
in-progress mobile Estimate or Invoice and provided no way to defer the
refresh. The notice is now:

- compact instead of full-width on mobile;
- dismissible with a labeled 44px control;
- automatically cleared after 15 seconds;
- still explicit that Refresh loads the ready update.

Refreshing remains user-controlled so a newly activated service worker cannot
silently discard an in-progress form.

## Verification

- `npm run build` — passed.
- `npm run lint` — passed.
- `npm run test:unit` — passed, 123/123.
- `npm run test:e2e` — passed for fail-closed authentication,
  Jobs/discovery, and offline recovery.
- `npm run test:ui:tools` — passed.
- `npm run test:ui:mobile-actions` — passed.
- `npm audit --omit=dev` — passed with zero vulnerabilities.
- `git diff --check` — passed.
- `npm run test` repeated the 123 unit/frontend checks successfully but its
  database segment timed out because this workstation has no configured
  isolated `DATABASE_URL`. Packet 86's unchanged server/data path retains its
  prior 22/22 PostgreSQL integration evidence; this packet changes only the
  static update notice and its frontend contract test.

## Remaining physical and financial boundary

This run used the signed-in production web app and a real production database,
but the controllable browser is not a physical Android or iPhone. The
following cannot be represented as complete without human hardware and
financial authorization:

1. Android Chrome Contact Picker selection and the browser permission sheet;
2. iPhone Safari/PWA CSV/vCard fallback and device text-draft handoff;
3. customer opening a real connected merchant's Stripe ACH Checkout and
   authorizing a bank debit;
4. delayed settlement, failure, refund, and dispute display for that payment.

Stripe sandbox and webhook evidence already proves those provider state
transitions. The final commercial acceptance still requires one owner-controlled
invoice and an authorized payer; RIVT must not create or submit that debit
automatically.

Packet status: **Live application path verified; physical device and authorized
ACH completion remain human-owned.**
