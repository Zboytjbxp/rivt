# Packet 100 - Receivables account isolation

## Objective

Close the release-blocking privacy path where an unscoped legacy Receivables
row stored in one browser could survive an account switch and appear beside a
different account's server-owned payment records.

## Source and production boundary

- Branch: `codex/receivables-tenant-boundary`
- Source base: release-candidate branch head
  `dfbb37831b3a22717c0c68ecbe4654ad8efa56cc`
- Fix source:
  `8ee0d306502f783d323373b6d42d521ce18d9970`
- Finding: unowned legacy `rivt.payments.v1` rows could be merged into an
  authenticated Receivables view after an account switch (Low/P3).

This packet is source, regression-test, and documentation work only. It does
not authorize or perform deletion of browser or customer data, assignment of
legacy data to an account, a schema or data migration, provider access or
configuration, ACH or any other payment activity, a merge, deployment,
public launch, launch-hold clearance, or added cost.

## Root cause

Receivables initialized from the browser-wide `rivt.payments.v1` key and then
appended locally stored rows that did not match the authenticated account's
server response. Those legacy rows had no trustworthy owner identifier. A
person signing into Account B in a browser previously used by Account A could
therefore see Account A's legacy title, amount, date, status, or notes.

The same fallback also made an account API outage unsafe: the view could keep
or reveal browser-local rows even though RIVT could not confirm that they
belonged to the signed-in account.

## Implementation boundary

- Authenticated Receivables starts empty and renders only account-owned
  `payment_record` rows returned by the authenticated tool-record API.
- The read supplies the rendered account ID through the existing
  expected-account request header, so a stale tab cannot silently use a cookie
  that now represents another account.
- The Receivables component is keyed to the current account so server results
  from the prior account are cleared when the account changes.
- A failed account read clears Receivables and shows a retryable account-check
  error. It never falls back to the unowned legacy browser key.
- The old `rivt.payments.v1` value is quarantined in place. This packet neither
  deletes it nor assigns it to whichever account happens to be signed in.
- The existing read-only legacy-record presentation, invoice/Receivables
  navigation, and server-owned payment-record behavior remain available for
  records the authenticated API proves belong to the current account.

## Explicitly out of scope

- No automatic migration of ownerless browser rows.
- No inference of ownership from a matching title, amount, date, email,
  contact, job, or account currently using the browser.
- No new editable Receivables ledger, payment total, settlement claim, or
  payment-provider state.
- No database, API-route, provider, credential, production-data, billing,
  payment, deployment, launch, or cost-bearing action.

Any future recovery of the quarantined legacy rows requires a separate,
explicit ownership-confirming design and reviewed migration boundary.

## Regression evidence in the source

Commit `8ee0d306502f783d323373b6d42d521ce18d9970` adds rendered browser coverage
that:

1. seeds an ownerless Account A legacy row in `rivt.payments.v1`;
2. proves Account A and Account B server reads carry their respective expected
   account IDs;
3. switches from Account A to Account B and proves Account A server rows are
   removed before Account B Receivables renders;
4. proves the ownerless browser row never appears for either account;
5. forces the payment-record API to fail and proves both the prior server row
   and ownerless browser row remain hidden; and
6. proves the quarantined browser value is not silently deleted.

The focused rendered smoke passed on 2026-08-08 across desktop, 390px mobile,
and a 320px compact-phone viewport. The account-switch sequence intentionally
resets account-scoped UI before Account B reopens Receivables; no Account A or
ownerless row appeared during the reset, the B read, or the forced outage.

## Risk and requirement state

- `R-063` is open until the exact candidate passes the required gates and the
  accepted source is deployed and account-switch behavior is reverified.
- `GA-FND-003`, `GA-UX-005`, `GA-OPS-007`, and `GA-OPS-008` remain Partial.
- `GA-OPS-004` and `GA-OPS-009` remain Blocker.
- Packet 99's production-credential incident, backup/recovery work,
  `ACTIVE_LAUNCH_HOLD`, ACH-disabled posture, feature-release pause, and public
  launch block remain unchanged.

## Acceptance boundary

Packet 100 is accepted only when:

1. authenticated Receivables renders only rows proven by the current
   account-bound API read;
2. ownerless legacy browser rows never appear during a successful read, an API
   outage, or an account switch;
3. Account A server rows cannot remain visible after the rendered identity
   changes to Account B;
4. every Receivables read supplies the current expected account ID;
5. the existing legacy browser value remains untouched unless a separate
   ownership-confirming migration is reviewed and approved;
6. invoice/Receivables navigation and legitimate current-account server rows
   retain their prior behavior;
7. the focused rendered regression and repository-required build, lint, test,
   browser E2E, and dependency-audit gates pass;
8. an independent security re-review finds no remaining account-switch bypass;
   and
9. build state, requirements, and risks preserve every existing operational
   and launch blocker without claiming deployment.

## Three-things review

Before advancing, explicitly review:

1. whether a slow response started under Account A can repopulate the view
   after the UI changes to Account B;
2. whether offline, timeout, 401, 409, or 5xx behavior can reintroduce unowned
   browser data or leave a prior account's server rows visible; and
3. whether any future legacy-data recovery could assign private financial
   notes to an account without affirmative ownership proof.

## Rollback

Revert commit `8ee0d306502f783d323373b6d42d521ce18d9970` and this packet's documentation.
No schema rollback, data restoration, provider rollback, or payment action is
required because this packet changes none of those systems. Reverting would
restore the cross-account privacy defect, so deployment and public launch must
remain blocked until this fix or a stronger account-owned replacement is
accepted.

## Verification status

Implementation and regression coverage are committed at
`8ee0d306502f783d323373b6d42d521ce18d9970`.

- `npm run test:ui:tools`: pass across desktop, 390px mobile, and 320px compact
  viewports, including Account A -> Account B switching and a 503 fail-closed
  check.
- `npm run build`: pass.
- `npm run lint`: pass, including the public-document safety check.
- `npm run test`: exit 0; 603/603 unit/frontend tests pass and the non-database
  integration harness passes 4/4, while 23 database-backed cases are honestly
  skipped because `TEST_DATABASE_URL` is not configured in this isolated
  worktree.
- `npm run test:e2e`: pass for authentication fail-closed, Jobs/discovery,
  offline recovery, and production CSP journeys.
- `npm run lint:security`: pass, including the operator-command policy.
- `npm run test:ui:shop-talk-news`: pass.
- `npm run test:ui:mobile-actions`: pass.
- `npm run test:ui:work-lifecycle`: pass.
- Independent read-only security re-review: pass; no remaining source bypass
  found. A deliberately delayed Account A response after a B remount remains a
  non-blocking dynamic coverage opportunity; keyed remount plus effect cleanup
  closes it by static trace.
- `npm audit --omit=dev`: pass with zero known vulnerabilities after bounded,
  compatible transitive patch updates in commit
  `b1c99e7fb54762c26f079b26bea3be7d51ae4566` (`nanoid` 3.3.16 -> 3.3.18 and
  `brace-expansion` 5.0.8 -> 5.0.9). No direct dependency, API, or runtime
  behavior changed.

Exact-source database CI, pull-request evidence, accepted-source merge,
deployment, and physical account-switch revalidation are not recorded.

Packet status: **Active - local engineering and dependency gates pass;
database CI, merge, deployment, and physical revalidation remain pending**.
