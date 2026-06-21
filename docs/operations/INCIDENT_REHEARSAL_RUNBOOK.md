# RIVT Incident Rehearsal Runbook

Run this rehearsal before any named customer cohort and repeat it at least every 30 days during Gate A. The goal is to prove that RIVT can detect, triage, communicate, protect users, recover, and record evidence without improvising.

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

After a passed rehearsal, update `docs/operations/incident-routing.json`:

```json
{
  "status": "passed",
  "completedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "scenario": "public-health-provider-failure",
  "commander": "Name",
  "evidence": "docs/delivery/DEPLOYMENT_LEDGER.md#incident-rehearsal---yyyy-mm-dd"
}
```

Then run:

```text
npm run incident:readiness -- --json
npm run launch:readiness -- --json
```

Only use `--require-ready` after provider, paging, support-hours, and approval fields are also complete.
