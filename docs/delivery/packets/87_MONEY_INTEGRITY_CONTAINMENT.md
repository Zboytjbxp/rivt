# Packet 87 — Money integrity containment

## Objective

Close the launch-blocking path where an edited invoice, its bank-payment link,
and the status shown in Receivables can disagree.

This packet is intentionally a containment packet. It prevents contradictory
money states without changing production data or introducing a new canonical
receivables schema. The full invoice/receivables consolidation follows only
after this fail-closed boundary is verified.

## Accepted implementation scope

- Treat the saved Invoice record as the customer-document amount for
  standalone invoices.
- Treat the participant-authorized project invoice as the customer-document
  amount for accepted-work invoices.
- Refuse invoice edits, deletion, delivery, or payer redirection whenever the
  displayed invoice amount and the active bank-payment request can diverge.
- Keep an in-flight bank debit immutable until Stripe reports a terminal
  result.
- Reject new manual `payment_record` writes. Preserve account-authorized reads
  and deletion so older user-entered records are not silently destroyed.
- Replace the mutable Receivables ledger with an honest read-only legacy
  reference. Legacy manually entered rows are excluded from totals and cannot
  override invoice or Stripe state.
- Mark the matching project invoice sent after successful provider delivery,
  without requiring a second manual “Mark sent” action.
- Serialize invoice delivery with the invoice and its payment rows, derive the
  provider retry identity from the exact rendered document, and replay an
  identical already-sent document without a second provider delivery.
- Preserve matching existing payment links, signed webhook settlement,
  refund/dispute behavior, and idempotent retry behavior.
- Reject browser-supplied invoice payment or delivery state. The server owns
  `draft`/`sent` delivery truth and provider-owned bank-payment metadata.
- Require an active, email-verified sender for provider email delivery.
- Treat void as terminal, and prevent recorded external payments from being
  erased by moving an invoice back to draft or void.
- Keep webhook truth monotonic when Stripe events arrive out of order:
  settlement cannot become failure, and an earlier refund or dispute cannot
  be overwritten by a later success event.
- Refuse new Stripe Connect onboarding and bank-payment links unless the live
  event destination is explicitly attested as `Connected accounts`; a signing
  secret by itself does not prove that direct-charge events reach RIVT.
- Bound Stripe and email-provider waits to eight seconds, including response-
  body reads, and report an honest timeout instead of occupying a database
  transaction indefinitely or claiming an unconfirmed success.

## Explicitly out of scope

- No database migration or production-data rewrite.
- No automatic cancellation, replacement, or repair of an existing payment
  request.
- No real payment, provider mutation, deployment, or paid CI run.
- No new Receivables table or combined reporting API.
- No attempt to represent a partially paid invoice in an email that still
  prints the original total as fully due. That case fails closed until the
  customer document can show total, paid, and remaining balance correctly.
- No provider-side Stripe event-destination change or existing external-
  payment confirmation workflow change.

## Money invariants

1. A customer must never see one invoice total and be sent to a bank-payment
   page for a different amount.
2. A deleted or void invoice must never retain a usable RIVT payment redirect.
3. A processing bank debit must not be edited, deleted, or manually marked
   paid.
4. Stripe settlement, failure, refund, and dispute events remain the authority
   for Stripe-processed payment state.
5. Older manual Receivables rows may remain visible as reference data, but they
   must not contribute to current balances or claim that an invoice was paid.
6. A delivery success may update the matching invoice to sent; a delivery
   failure must not.
7. A lost HTTP response or repeated tap must not send an unchanged invoice
   twice or downgrade an already-delivered document back to draft.
8. A signing secret and feature flag must not enable new bank-payment links
   unless connected-account event delivery is explicitly attested.
9. A stalled Stripe or email request must release the server path within a
   bounded deadline and must not be recorded as a confirmed success.

## Required server behavior

- `POST /api/v1/tool-records` returns `410 PAYMENT_RECORD_RETIRED` for new or
  updated `payment_record` records.
- A standalone Invoice save returns a conflict while an active request would
  be invalidated by the new amount, and while its payment is processing.
- A standalone Invoice delete returns a conflict while its request is active
  or processing.
- Browser writes cannot set an Invoice to paid/sent or provide authoritative
  delivery/bank-payment metadata.
- Invoice delivery verifies the payment-request amount against the exact saved
  customer document immediately before sending.
- Project Invoice delivery verifies the tool record, canonical project
  invoice, and payment request describe the same full amount.
- `/pay/:requestId` refuses a deleted/mismatched standalone invoice and a
  void/mismatched project invoice.
- Reusing an active project payment request first proves that its amount still
  equals the current unpaid balance.
- Repeating the same project status is a no-op and does not duplicate timeline,
  notification, or audit entries.
- Refunded, disputed, processing, paid, void, or externally paid project
  invoices cannot be reopened through a conflicting manual status change.

## Required client behavior

- Save, Copy payment link, and Send expose the blocking reason instead of
  proceeding when amounts disagree.
- A user can either restore the invoice amount or cancel an open payment link
  before editing it. A processing payment explains that the user must wait for
  the bank result.
- Receivables contains no Add invoice, Mark paid, or fabricated total controls.
- Existing manual rows, if any, are labeled “Legacy manually entered records,”
  read-only, and excluded from totals.

## Acceptance tests

1. Create a $100 standalone payment link, change the draft to $125, and prove
   save, send, and payer redirect fail closed while the original record remains
   unchanged.
2. Prove an open or processing standalone request prevents invoice deletion.
3. Prove failed, expired, or cancelled requests no longer lock correction.
4. Prove a matching standalone invoice/link still saves, sends, and redirects.
5. Prove a project tool draft cannot email a different total from its canonical
   project invoice.
6. Prove a partial-payment balance link cannot be attached to a customer
   document that still claims the full total is due.
7. Prove processing settlement and existing refund/dispute webhook paths still
   work.
8. Prove no Receivables Add or Mark paid action renders.
9. Prove older manual rows remain readable and are explicitly excluded.
10. Prove `payment_record` create/update returns 410 while account-isolated
    read/delete remains available.
11. Prove concurrent sends with different browser request keys produce one
    provider delivery, and an identical retry repairs a stale local draft label
    back to sent.
12. Prove a browser cannot forge paid/sent state, delivery evidence, or
    bank-payment metadata, and a lost-response autosave cannot demote a
    genuinely delivered invoice.
13. Prove an unverified account cannot send an estimate or invoice email.
14. Prove repeated same-status updates create no duplicate project effects,
    void is terminal, and a recorded partial external payment prevents draft
    or void.
15. Prove out-of-order Stripe failure/success/refund/dispute events cannot
    erase the most consequential accepted payment state.
16. Prove missing or incorrect Stripe webhook scope keeps provider readiness
    false even when the key, signing secret, flag, and merchant account exist.
17. Prove the inbound signed webhook remains available for delayed events from
    existing requests while creation of new links is disabled.
18. Prove Stripe and email header/body stalls return explicit bounded timeout
    failures rather than hanging or claiming delivery.

## Rollback

- Revert the Packet 87 source commit.
- No schema rollback or data restoration is required because this packet
  performs no migration and does not rewrite existing rows.
- Reverting does not restore correctness for any mismatched link; launch must
  remain held until the containment or a stronger canonical model is active.

## Three-things review

Before advancing, explicitly review:

1. whether every document delivery channel is bound to an immutable document
   version rather than mutable draft fields;
2. whether provider success followed by database failure can leave a delivery
   or checkout session without a durable local intent;
3. whether partial payments, external payments, refunds, disputes, and voids
   can all be represented from one invoice ledger without another manual
   status silo.

## Packet 87 pre-integration verification (historical)

Local implementation is complete on exact baseline
`29e3c613f2eb95a6583b52c671275e5046dde0d3`.

Passed locally:

- production build;
- full application lint and focused security lint;
- 164 unit/frontend tests;
- all three browser E2E journeys;
- rendered Tools/Invoice, mobile-actions, and Work-lifecycle suites;
- production dependency audit with zero known vulnerabilities;
- diff-integrity check.

The complete freshly reset PostgreSQL integration gate passed on a disposable,
loopback-only PostgreSQL 16.14 database: 22 tests passed, including all 19
database-backed suites, with zero failures or skips. The database used a new
temporary cluster and was stopped and removed after the run. Production and
the older Railway test URL were not used. The passing cases include invoice
concurrency, identical-document replay, sender verification,
server-owned-state enforcement, refund/void/external-payment locks, webhook
ordering, and same-status no-op behavior.

Independent final review found no remaining Packet 87 code blocker. Its
conditional database requirement is now satisfied locally.

The later combined Packet 87 plus Railway Stage 1 candidate passed 252/252
unit/frontend tests, all three browser E2E journeys, the Tools, Shop Talk/Trade
News, mobile-actions, and Work-lifecycle rendered suites, and 25/25 disposable-
database integration tests on the local Node 24/PostgreSQL 18 environment.
Those combined results supersede the historical counts and three-suite list
above without rewriting the original packet evidence.

This packet adds a narrow content-derived provider-idempotency and transaction
boundary for invoice email. It does not replace Packet 90's broader durable
outbox/reconciliation requirement for every external side effect.

No production data, provider configuration, paid resource, deployment, or
live payment was changed.

Packet status: **Integrated and locally re-verified with Stage 1 source-safety;
the source candidate has a complete sealed exact-tree security review, while
merge, deployment, provider-scope proof, and exact-source acceptance remain
pending**.

## 2026-08-01 local security follow-up

Sealed diff scan `7d0d53ee-e18b-4c94-92fc-08fa324ff3f4` reviewed all 23
candidate paths and drove local remediation for protected invite entry,
sanitized synthetic-monitor evidence, public operational-document safety, and
strict typed receipts for payment state, the private backup route, synthetic
monitoring, error monitoring, paging, incident rehearsal, and recovery.
Receipt paths reject symlinks, non-files, repository escapes, canonical aliases,
and reuse by resolved path or content where independent proof is required.
Checked-in receipts cannot pass without exact control/provider/digest
identities from a trusted in-process provider verifier. The ordinary readiness
CLI does not inject those identities; the later protected runner described
below is a separate, fail-closed candidate integration. The historical
disabled-mode payment approval remains preserved but
does not authenticate its own receipt for the stricter current gate. Build,
full lint, 327/327
unit/frontend checks, 88/88 focused security regressions, final browser E2E,
dependency audit, and diff integrity pass. The aggregate command skipped 21
database-backed suites because this worktree has no isolated test database;
that gap remains explicit. Readiness remains blocked on genuine independent
provider evidence and the active launch hold. This follow-up made no
production, provider, deployment, Git publication, resource, data, or paid
change.

## 2026-08-01 working-tree security checkpoint

Codex Security scan `65a8c581-8136-459c-9926-58220a85430d` recorded a
pre-latest-candidate no-cost working-tree review with one medium and three low
findings. It is not final exact-tree evidence for the current candidate. The local
candidate now binds scheduled synthetic checks to an independently maintained
full production revision, limits incident issue reuse and closure to the exact
GitHub Actions bot-owned issue, detects quoted invite JSON in public documents,
and enforces the receipt-bound restore-plus-verification duration against the
approved RTO. The separate future enabled-payment verifier contract remains
deferred; bank payments remain disabled and no payment readiness is inferred.

Focused security regressions pass 91/91. The combined candidate passes build,
full application/security/public-document lint, the aggregate test command,
browser E2E, the production dependency audit with zero known vulnerabilities,
and diff integrity. The aggregate run passed 352 unit/frontend checks and
three non-database integration checks; its PostgreSQL-backed suites skipped at
that time because no isolated `TEST_DATABASE_URL` was configured. A later
fresh, loopback-only PostgreSQL 18 run closed that local gap: the database was
reset through migration 42 and `npm run test:integration` passed 25/25 tests
with zero failures, cancellations, or skips before the disposable server was
stopped. Exact GitHub Node 20/PostgreSQL 16 CI for the final published
candidate remains pending. Strict launch
readiness remains blocked on the active hold and genuine provider, monitoring,
incident, approval, backup, and recovery proof. The protected GitHub
`production` Environment variable `RIVT_PRODUCTION_SOURCE_COMMIT` must be set
to the independently verified live 40-character commit before the scheduled
monitor can run successfully. This closure made no commit, push, merge,
deployment, provider mutation, production request, data change, resource
creation, or paid change.

## 2026-08-01 release-candidate evidence hardening (unpublished)

The current working tree prepares a protected, read-only provider-evidence
workflow. Its compiled disabled-payment adapter compares the protected Railway
configuration, live RIVT health, and Stripe Accounts v2 in the same process.
It now uses a short-lived nonce-, timestamp-, and source-commit-bound HMAC,
derived from both Stripe secrets and exact enabled/scope values, to prove the
running service loaded the same configuration without publishing a reusable
secret-derived value. The candidate public stable fingerprint was removed and
independent follow-up suppressed that candidate as remediated. The same runner
has compiled adapters for the GitHub synthetic check and Sentry ingestion;
private-route, paging, rehearsal, and recovery adapters remain unsupported and
fail closed.

Backup freshness now AEAD-decrypts the newest protected artifact and validates
its snapshot structure as restore-usable before accepting freshness. The
backup-role preflight rejects sequence `USAGE` or `UPDATE` privileges and
recursively reachable `SET`-able roles. Fresh local verification passes build,
application/security/public-document lint, 425/425 unit/frontend checks, 25/25
disposable loopback PostgreSQL integration tests, all three browser E2E
journeys, all five required UI smoke suites, and the production dependency audit
with zero vulnerabilities. Final source-candidate scan
`scan_696c3b127e03_20260802T024900Z` is sealed with 28/28 worklist coverage,
four closed intermediate-patch candidates, zero reportable findings, and no
deferred work. The final evidence-only documentation update is separately
covered by public-document safety and diff-integrity checks.

This source capability is not accepted provider evidence. It has not been
run from protected `master`, approved through the
`production-evidence` environment, merged, or deployed. Packet 87 still requires
an exact-candidate hosted database run and read-only provider verification before
deployment, and ACH remains disabled/setup-required. No signed connected-account
delivery or matching durable payment transition is claimed. Strict launch
readiness remains RED with exactly 19 blockers and incident readiness remains
blocked with exactly 8 findings. No deployment, provider mutation, ACH
enablement, production-data action, resource creation, or cost occurred.
