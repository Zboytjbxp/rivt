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
the pre-follow-up candidate has a complete sealed exact-tree security review,
while the executable provider-evidence follow-up has local regression coverage
and independent review but no new sealed scan; merge, deployment, provider-scope
proof, and exact-source acceptance remain pending**.

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

## 2026-08-01 release-candidate evidence hardening (PR candidate; unmerged)

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
with zero vulnerabilities. At that checkpoint, source-candidate scan
`scan_696c3b127e03_20260802T024900Z` is sealed with 28/28 worklist coverage,
four closed intermediate-patch candidates, zero reportable findings, and no
deferred work. That checkpoint's evidence-only documentation update is
separately covered by public-document safety and diff-integrity checks.

This source capability is not accepted provider evidence. At that checkpoint it
had not produced an accepted protected run. Its protected-`master` execution
model is superseded by the 2026-08-02 `production-evidence-source` design below;
the current workflow must not run from `master`. Packet 87 still requires
an exact-candidate hosted database run and read-only provider verification before
deployment, and ACH remains disabled/setup-required. No signed connected-account
delivery or matching durable payment transition is claimed. Strict launch
readiness remains RED with exactly 19 blockers and incident readiness remains
blocked with exactly 8 findings. No deployment, provider mutation, ACH
enablement, production-data action, resource creation, or cost occurred.

## 2026-08-02 provider-evidence correctness follow-up (unmerged)

The disabled-payment adapter now reads the Stripe Accounts v2 event
destination with snapshot API version `2026-06-24.dahlia`. It requires an
enabled live webhook endpoint, `@accounts` scope, the exact RIVT webhook URL,
and exactly the nine money-state events implemented by Packet 87. It rejects
the former legacy v1 one-event webhook shape. The runtime evidence route now
verifies HMAC authorization before applying a process-local five-request-per-
minute limiter, so a read-only proof attempt cannot insert or update the
durable `rate_limit_windows` ledger.

The `@accounts` value is the exact contract for the pinned Dahlia API version,
as documented by Stripe's
[versioned event-destination reference](https://docs.stripe.com/api/v2/core/event-destinations/object.md?api-version=2026-06-24.dahlia).
Changing the Stripe API version requires a fresh contract review rather than a
mechanical enum rename.

This inventory proof cannot establish that the installed signing secret
belongs to the destination because Stripe does not re-expose that secret. It
also cannot replace a real Stripe-signed delivery and matching durable payment
transition. Production ACH therefore remains disabled/setup-required, and the
signed-delivery boundary remains open.

Provider evidence now has an explicit two-revision trust model. `S` is the
exact deployed runtime commit and remains the source revision supplied to every
provider adapter. `E` may be a later descendant used only to add source-bound,
append-only receipts and tightly allowlisted documentation or readiness-policy
updates. The overlay rejects executable or workflow drift, deletion, rename,
unsafe file modes, symlinks, submodules, receipt rewrite/reuse, digest mismatch,
and any payment-policy change that would leave the approved disabled/setup-
required state. It enumerates every commit and changed path in `S..E`, requires
one linear no-merge history, and applies the same path/status/mode policy to
each commit, so a forbidden intermediate change cannot disappear behind a
later revert. Because executable files at `E` must be identical to `S`, the
code being trusted is still the deployed code from `S`; `E` is never described
as deployed, and all provider observations remain bound to `S`.

The privileged workflow is loaded from a separately protected
`production-evidence-source` branch pinned to `S`, not from `E`. The
`production-evidence` environment must restrict deployments to that branch and
require human review. `E` must be the current head of a separately protected
`production-evidence-overlay` branch, consumed only as data, never connected to
Railway, and never used to open a preview-environment PR. Every protected-plan
claim must reference exactly one exact-case, source-bound, append-only receipt.
Current hosted state has none of those controls configured: `master` is
unprotected, no ruleset exists, both evidence branches are absent, and the
environment is absent. Until the two branches, environment restriction, human
reviewer, source variable, plan secret, and read-only credentials exist and are
independently checked, the workflow fails closed and no run is accepted.

Railway documents that a connected GitHub branch deploys automatically when
autodeploy is enabled and that disabling autodeploy stops those commit-triggered
deployments. RIVT's repository config does not prove the effective dashboard
setting and supplies no checked-in watch-pattern safeguard. The dedicated
non-Railway overlay branch is therefore required even while the recorded current
production setting says autodeploy is off. See Railway's
[GitHub autodeploy](https://docs.railway.com/deployments/github-autodeploys) and
[config-as-code](https://docs.railway.com/config-as-code/reference) references.

The protected workflow exposes two honest modes. `providers-only` may exit
successfully only when every requested provider claim is verified and
`ACTIVE_LAUNCH_HOLD` remains active. That result is provider evidence only, not
launch readiness. `launch-ready` still requires the full readiness evaluation
and remains blocked by unsupported paging, private-route, rehearsal, and
recovery adapters plus every other unresolved launch condition. The protected
environment and plan have not produced an accepted provider run. Focused
regression coverage now exercises the exact Accounts v2 destination contract,
the nonpersistent authenticated limiter, the `S`/`E` overlay restrictions, and
the provider-only active-hold rule. Final local verification passes build, full
lint, 464/464 unit/frontend checks, all three browser E2E journeys, dependency
audit with zero known production vulnerabilities, and diff integrity. Three
non-database integration checks pass; 21 database-backed checks are explicitly
skipped because this isolated worktree has no `TEST_DATABASE_URL`. Exact-
candidate hosted database verification remains required. Strict launch
readiness still reports exactly 19 blockers and incident readiness exactly 8
findings. The earlier sealed scan does not include this follow-up diff.

The branch behind PR #14 is ready for review but remains unmerged and undeployed. No provider
mutation, ACH enablement, production-data change, resource creation, or cost
occurred in this follow-up.

## 2026-08-02 hosted acceptance follow-up (unmerged)

Hosted Gate A run `30739332112` passed the exact Node 20/PostgreSQL 16 full
application and database suite and the fail-closed authentication and
Jobs/discovery browser journeys. It then exposed a real slow-offline startup
path: Chromium can keep the boot identity request pending for its full
15-second timeout even after entering an explicit offline state. The app now
restores a valid, age-bounded device snapshot before starting that request when
`navigator.onLine` is already false and revalidates it when connectivity
returns, including when the online transition happened just before the event
listener was attached. A pre-hydration zero-delay active-work refresh can no
longer erase the newly restored work; explicit sign-out and account-reset paths
still clear it.

The offline acceptance journey now requires the cached workspace to appear in
under 10 seconds, opens the visible Active-work stage before checking the
cached job, and records only non-sensitive state/cache diagnostics if it fails.
The full offline open, cached active-work access, reconnect, retry, and sign-out
journey passes 10/10 local stress runs. Final local verification passes build,
full lint, 465/465 unit/frontend checks, all three browser E2E journeys, the
production dependency audit with zero known vulnerabilities, and diff
integrity. Three non-database integration checks pass; 21 PostgreSQL-backed
checks are explicitly skipped because this worktree has no isolated
`TEST_DATABASE_URL`. A fresh hosted exact-candidate database and browser run
remains required. Launch readiness remains deliberately blocked on exactly 19
findings and incident readiness on exactly 8 findings. The branch remains
unmerged and undeployed, and this work made no provider, production-data,
resource, ACH, or paid change.

## 2026-08-02 offline identity-boundary remediation (unmerged)

The combined candidate now has one terminal client account boundary. Changing
or ending the canonical account increments an account generation, clears every
account-owned in-memory projection, cancels that account's queued flush, and
prevents late asynchronous results from entering the next account. Sensitive
browser requests and offline replays carry the originating account ID in
`X-RIVT-Expected-Account-Id`; authenticated server middleware returns a bounded
conflict when it does not match the current actor. Offline sign-out stores a
bounded pending-logout marker and will not restore the retired snapshot while
the server outcome is unknown.

The offline snapshot clock is now `lastServerValidatedAt`, advanced only by a
successful authenticated server response. Offline hydration cannot renew the
30-day retention window. Invalid, expired, rejected, signed-out, or replaced
account snapshots are purged. Financial decisions, messaging, publication,
delivery, and payments remain online-only; this change does not expand offline
write scope.

Sealed Codex Security diff scan
`fcd23f03-6523-4098-a98f-b14c0f11a73d` reported and validated two low findings:

- `csf_a4d5362e0fc95aca92016557`: Account A active work could remain visible
  briefly after Account B became canonical.
- `csf_bf35f40d5cd566c3d54d002f`: offline reads could renew the intended
  30-day snapshot expiry.

Both are fixed. Offline sign-out resurrection was reproduced as a correctness
defect outside the scan's physical-access threat model and fixed as well.
Independent follow-up review closed account-transition races in Stripe checkout
and portal redirects, Web Push, profile and session controls, Inbox controls,
job transitions, onboarding and Shop Talk callbacks, plus a same-account
reaction pending-state regression. Final independent review found no remaining
P0/P1 code blocker.

`npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`,
`npm audit --omit=dev`, and diff integrity pass. The result includes 467/467
unit/frontend checks, three passing non-database integration checks, and all
three browser journeys. Twenty-one PostgreSQL-backed integration checks are
explicitly skipped locally because this worktree has no `TEST_DATABASE_URL`.
GitHub Gate A Safety run `30758475166` verified exact commit
`50bbcabf453768220a817de1ad2727ff57783078` on Node 20/PostgreSQL 16: build,
lint, the complete unit and database-backed integration suite, all three browser
journeys, and the production dependency audit passed. Its overall result is red
only because the final launch-hold enforcement correctly refused release. The
browser coverage proves that delayed Account A checkout, portal, Push enable/test/
disable, session revocation, onboarding, Shop Talk, and queue completions do not
redirect, sign out, mutate, or render into Account B.

No merge, deployment, provider mutation, production-data action, ACH enablement,
launch-hold change, resource creation, or cost occurred. Production remains on
the previously recorded source until an explicit later approval.
