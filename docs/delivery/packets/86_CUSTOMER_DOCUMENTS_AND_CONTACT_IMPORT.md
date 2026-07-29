# Packet 86 — Customer documents and contact import

## Objective

Finish the Estimate and Invoice customer handoff while making the canonical
RIVT Contacts directory easier to populate from a phone without creating
separate contact books or overstating browser access.

## Accepted implementation scope

- Keep one authenticated, account-owned Contacts directory as the source for
  Work, Estimate, Invoice, Materials, jobs, and private projects.
- Let supported mobile browsers open the operating-system contact picker from
  Contacts and from the shared customer picker. The user chooses exactly which
  people and which contact fields RIVT receives.
- Let Contacts import a complete exported address book from CSV or vCard for
  work-phone and bulk-migration use. Bulk import remains in Contacts rather
  than being repeated inside every document form.
- Preserve exact email/phone duplicate detection and report created, existing,
  and invalid records honestly.
- Remove the unexplained generated logo tile from customer documents when no
  business logo was uploaded.
- Make document appearance and business identity discoverable from Estimate
  and Invoice without inventing a logo or hiding the existing server-owned
  brand settings.
- Replace the clipped email-only document action with a clear Send choice that
  distinguishes server-sent email from a device-opened text draft.
- Let the invoice sender offer one or more real payment paths. The customer
  chooses among the methods shown on the finished invoice; an Estimate remains
  a price proposal and does not request payment.
- Reduce duplicated review copy and separate draft-save failures from payment
  or delivery validation.

## Privacy and honesty contract

- RIVT never receives an address book automatically. The Contact Picker API
  requires a user gesture and supports only user-selected contacts; browsers
  intentionally do not provide a programmatic “import all” command.
- On browsers without the Contact Picker API, the phone-picker action is not
  presented. CSV/vCard import and manual creation remain available.
- A text option opens the device's message draft. RIVT does not label that
  message sent or delivered.
- An external cash/check/card/transfer instruction is displayed as sender
  guidance, not as a RIVT-processed payment.
- Stripe ACH remains available only when the authenticated connected account
  is ready and a server-created payment link exists.
- A document cannot be sent without a usable recipient channel and, for an
  invoice, at least one usable payment path.

## Acceptance

- Contacts can import selected phone contacts on supported Android browsers
  and CSV/vCard files on all supported browsers, with duplicate and invalid
  counts reported.
- Estimate and Invoice can import one selected phone contact through their
  shared Customer picker without exposing a bulk-address-book control in the
  document flow.
- Imported Contacts persist through the canonical server API and remain
  available to every existing Contact consumer.
- A document with no uploaded logo renders a clean text letterhead, not a
  generated colored initials box.
- Invoice payment methods are independent offered options, and the preview
  shows only the real options that will reach the customer.
- Estimate and Invoice review actions fit at 320px and 390px without clipping;
  Send exposes truthful Email and Text choices.
- Build, lint, unit/frontend tests, database integration, E2E, focused Tools
  and mobile rendered checks, dependency audit, and diff integrity pass before
  merge or deployment.

## Three-things review

Before advancing, explicitly review:

1. whether any import path can read contacts the user did not select or retain
   imported device data outside the canonical account-owned directory;
2. whether email, text, print, and payment instructions stay consistent with
   the exact saved document snapshot;
3. whether a contact imported during an Estimate/Invoice can be reused
   everywhere without creating a second customer identity or silently
   assigning unrelated relationship roles.

## Verification

- `npm run build` — passed.
- `npm run lint` — passed.
- `npm run test:unit` — passed, 122/122.
- `npm run test:integration` — passed, 22/22 against the configured isolated
  PostgreSQL database.
- `npm run test:e2e` — passed for fail-closed authentication, Jobs/discovery,
  and offline recovery.
- `npm run test:ui:tools` — passed at desktop, 390px, and compact-phone
  viewports with the Estimate/Invoice payment, branding, and Send contracts.
- `npm run test:ui:mobile-actions` — passed with the Contacts import/privacy
  contract and no horizontal overflow.
- `npm audit --omit=dev` — passed with zero vulnerabilities.
- `git diff --check` — passed.

## Three-things review result

1. Device import is user-initiated and receives only fields returned by the
   operating-system picker. Bulk import requires a file the user explicitly
   selects; no background address-book read or second device-only contact
   store was introduced.
2. Email uses the exact server-owned document snapshot. Text remains a
   user-controlled device draft, print uses the same customer preview, and the
   invoice server refuses a bank option without a current payment link or a
   direct-payment option without usable instructions.
3. Every imported person is written through the canonical account-owned
   Contacts API. The contextual document picker adds or reactivates the
   customer relationship on an exact existing match instead of creating an
   invoice-only identity.

Packet status: **Verified locally; production deployment pending**.
