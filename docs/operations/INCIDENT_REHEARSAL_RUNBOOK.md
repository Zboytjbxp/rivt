# RIVT Incident Rehearsal Runbook

Run this rehearsal before any named customer cohort and repeat it at least every 30 days during Gate A. The goal is to prove that RIVT can detect, triage, communicate, protect users, recover, and record evidence without improvising. The checked-in incident policy declares only the expected control. A real rehearsal result belongs in a separately protected provider-evidence revision and must be approved afterward; do not paste an observed result or a later approval into source policy.

## Rehearsal Preconditions

- Primary and backup incident owners are available.
- Support inbox is accessible.
- Production synthetic monitor is enabled.
- Error-monitoring provider and paging route are configured or the rehearsal remains failed.
- Operational kill switches are known:
  - `RIVT_SIGNUPS_DISABLED=true`
  - `SIGNUPS_DISABLED=true`
  - `RIVT_MUTATIONS_DISABLED=true`
  - `PLATFORM_MUTATIONS_DISABLED=true`
  - `RIVT_CONTROL_REASON="short operator-facing reason"`
- Latest rollback target is recorded in `docs/delivery/DEPLOYMENT_LEDGER.md`.
- Latest named backup-artifact restore evidence is recorded.

## Protected Workflow Record

Packet 98 PR #19 merged into the release candidate and adds
`.github/workflows/incident-rehearsal.yml` as a manual-only,
provider-verifiable record of the human rehearsal. It is not a scheduled
monitor and it does not create the human exercise by itself.

Before an authorized dispatch, independently confirm:

- the workflow is active on protected default branch `master`;
- production serves that exact source commit;
- GitHub environment `production-rehearsal` has the intended required
  reviewers and a `master` branch restriction;
- `RIVT_PRODUCTION_SOURCE_COMMIT` names the exact deployed commit;
- `RIVT_RAILWAY_PROJECT_ID`, `RIVT_RAILWAY_ENVIRONMENT_ID`, and
  `RIVT_RAILWAY_SERVICE_ID` identify only the intended production resources;
- `RIVT_REHEARSAL_RAILWAY_TOKEN` is a narrowly controlled rehearsal
  credential;
- the public half of a dedicated, non-passphrase rehearsal SSH identity is
  registered with the intended Railway workspace; setup supplies its private
  half to protected environment secret
  `RIVT_REHEARSAL_RAILWAY_SSH_PRIVATE_KEY`, removes every known temporary
  local copy, and records that GitHub cannot reveal the stored value for an
  independent post-upload pair or exclusivity check;
- the reviewed Railway relay ED25519 fingerprint remains
  `SHA256:+S1xg92FrnHz6pY3bpkmh1OGtWQGNANXilPzlxA7B1g`; and
- the operator has separately explained and received approval for the
  dispatch and any expected usage cost.

Railway documents that a workspace SSH key grants access to every service in
that workspace. Treat this as a high-impact production credential: use a
dedicated key, keep the private half only in the protected GitHub environment,
restrict reviewers, and rotate or remove it when the rehearsal path is retired.
When activated, the checked-in workflow consumes an identity that must first
be separately approved; it does not register, replace, or delete a Railway
key.

Current configuration checkpoint (2026-08-03; not a rehearsal receipt):

- `production-rehearsal` requires reviewer `Zboytjbxp` and permits only branch
  `master`. `prevent_self_review=false` because no second repository
  administrator exists. GitHub now reports `can_admins_bypass=false`, so
  administrators cannot skip the configured protection rules. The reviewer
  gate remains single-owner and is not independent approval.
- Railway workspace key `rivt-production-rehearsal-20260803` is registered as
  `ssh-ed25519` with fingerprint
  `SHA256:oOWKlKo88YhJsRDhUMJNNK6+wD2aGdYgRATtyS6+XVE`.
- The setup supplied the newly generated private key to protected environment
  secret `RIVT_REHEARSAL_RAILWAY_SSH_PRIVATE_KEY`, and GitHub lists that secret
  name. GitHub does not expose its stored value, so post-upload content,
  key-pair matching, and exclusivity were not independently verified. The known
  temporary local key material was removed after setup.
- The rehearsal token and exact source/resource variables remain absent, the
  workflow is not on `master`, and no run has been dispatched. Do not dispatch
  until each still-open checklist item above is separately satisfied and the
  dispatch itself is explained and approved.

The operator must complete the human exercise first, then truthfully confirm
the workflow's required attestations and provide a bounded non-secret decision-
log reference. The workflow checks production health, runs the external
production monitor, executes the live Gate A smoke inside the existing Railway
service, and verifies the checked-in incident-control identity. It withholds
raw production output and uploads no artifact.

The Railway smoke does not trust CLI target selection by itself. Before Node
or database access, its remote guard must observe the expected
`RAILWAY_GIT_COMMIT_SHA`, project ID, environment ID, service ID, literal
`RAILWAY_ENVIRONMENT_NAME=production`, and the fixed `https://rivt.pro`
origin. Any missing, stale, or mismatched value stops the run before the smoke
can query PostgreSQL.

A green workflow run proves that the exact automated checks passed and that
the dispatcher supplied the required attestations. It does not independently
prove that the human statements were true. Review the decision log, alert
delivery, roles, recovery, and follow-up before accepting the rehearsal.

## Scenario A: Public Health Or Provider Failure

Use this scenario for the first rehearsal because it exercises the most important launch muscles without touching customer data.

1. Declare the rehearsal start time in the incident notes.
2. Confirm the current production source commit from `https://rivt.pro/api/health`.
3. Trigger or simulate a synthetic-monitor failure in a controlled way.
4. Verify an incident issue, alert, or page reaches the assigned owner.
5. Assign incident commander and support communicator.
6. Run:

```text
npm run monitor:production
npm run smoke:gate-a:live
```

The protected workflow automates the source, health, monitor, and live-smoke
portion of this scenario and records required human attestations. Complete and
review the remaining human steps; do not label the rehearsal passed solely
because the workflow is green.

7. Decide whether to set an operational kill switch.
8. If a kill switch is set, verify users see truthful disabled state and support/admin routes remain available.
9. Record user impact, affected surface, and first-detected time.
10. Clear the simulated failure and verify monitor recovery.
11. Record root cause, decision log, recovery time, and follow-up work.

Pass criteria:

- Alert/page reaches the right person.
- Operator can identify current source commit and dependency state.
- Support route remains available during any lockout.
- Recovery is verified by monitor and health output.
- Notes include timestamps, owner, decision log, and follow-up.

## Scenario B: Private Upload Or Storage Failure

Run this once storage-heavy pilot workflows are active.

1. Confirm S3-compatible storage health from `/api/health`.
2. Upload a permitted project record file as an authorized participant.
3. Attempt to access that file as a nonparticipant and confirm denial.
4. Simulate or observe a storage failure without exposing signed URLs.
5. Verify the user-facing state is honest: queued, failed, or retryable.
6. Confirm no cross-user object URL is issued.
7. Record request IDs and object metadata without secrets.

Pass criteria:

- Authorized access works.
- Unauthorized access fails.
- Operator can troubleshoot without leaking object keys, signed URLs, or private job data.

## Scenario C: Unsafe Condition Or Account Abuse

Run this before expanding beyond the first cohort.

1. File a test report for spam, harassment, suspicious behavior, or unsafe advice.
2. Verify admin/support queue receives the report.
3. Apply a warning or temporary restriction with a reason.
4. Verify restricted users can still access support/appeal paths.
5. Verify blocked users cannot message, invite, apply, or route around the restriction.
6. Record every admin action and decision.

Pass criteria:

- Reason-required admin action is stored.
- User access is restricted only where intended.
- Support/appeal path stays available.

## Evidence Template

Copy this into `docs/delivery/DEPLOYMENT_LEDGER.md` or a dated incident note after the rehearsal.

```text
## Incident Rehearsal - YYYY-MM-DD

- Scenario:
- Environment:
- Started at:
- Ended at:
- Incident commander:
- Backup owner:
- Support communicator:
- Production source commit:
- Alert destination tested:
- Paging destination tested:
- User impact:
- Kill switch used:
- Commands run:
- Detection time:
- Triage time:
- Recovery time:
- Root cause:
- Decision log:
- Follow-up actions:
- Pass/fail:
- Approval:
```

## Updating The Gate

Do **not** edit `docs/operations/incident-routing.json` to claim that the
rehearsal passed. That file is immutable source intent `S` and pins the exact
control, adapter, provider, scenario, and commander role.

After a separately authorized rehearsal:

1. Preserve the GitHub Actions workflow/run identifiers and sanitized receipt
   in the protected evidence revision `E` at the plan-bound path.
2. Require the `incident-rehearsal` adapter to verify the active dedicated
   workflow, protected default branch, exact source commit, exact
   `workflow_dispatch` run title, one successful `rehearsal` job, and every
   critical step.
3. Record incident, recovery, and payment approvals plus any launch-hold
   decision only in a later protected approval revision `A`. Approvals must
   postdate `E` and bind the exact materialized configuration digests.
4. Run the provider-evidence gate and then:

```text
npm run incident:readiness -- --json
npm run launch:readiness -- --json
```

Only use `--require-ready` after every provider receipt, paging/private-route
delivery proof, recovery control, post-evidence approval, and explicit
launch-hold decision is complete. A green rehearsal alone cannot clear the
hold or make RIVT launch-ready.
