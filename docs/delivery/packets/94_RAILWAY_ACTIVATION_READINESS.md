# Packet 94 - Railway activation readiness

## Objective

Define the fail-closed evidence and approval boundary for a possible future
Railway Stage 1 split after the active credential incident is accepted and the
launch hold is intentionally addressed.

This packet prepares the review process only. It does not approve or perform
activation, mutate a provider, spend money, deploy source, establish high
availability, prove redundancy, or declare RIVT launch-ready.

## Source and production boundary

- The Railway sequence was replayed onto the committed Packet 87 line ending
  at `070243f`; the committed integration base before the provider-safety
  follow-up is `9490c860736fbbf3ab916e488bfc994cca60753e`.
- The runtime/gate evidence candidate is pushed as
  `2253bca16883e736cd06b9b47d4539ffa4a86e32` on
  `codex/railway-stage1-packet87-integration` in draft PR #14. It is not merged
  to `master` and the packet source is not deployed.
- The final prepared implementation and candidate commits must be filled with
  the clean, reviewed commit that actually contains the complete preflight.
  A working-tree state is never an activation candidate.
- The plan must separately record the exact live-before source and rollback
  source proven by fresh production health and a current successful,
  redeployable Railway deployment.
- Packet 87 remains active. The production incident, Stripe connected-account
  event-delivery blocker, and `ACTIVE_LAUNCH_HOLD` remain open unless they are
  closed through their own evidence and authority.

## Prepared topology

The source is prepared for a first split stage of:

- one `web` service using `railway.json`;
- one `worker` service using `railway.worker.json`;
- one migration process, owned by the web service's predeploy;
- direct private PostgreSQL access with explicit role-specific pool limits and
  at least 30 percent headroom in steady state and during overlap;
- no attached application volumes;
- serverless mode disabled;
- `RIVT_PUSH_REQUIRED=true` on both services;
- the same reviewed region for web and worker;
- 30-second Railway drain and manual staged deployment triggers.

This one-web/one-worker split separates responsibilities. It is not a
redundancy or high-availability claim. A later `redundancy` stage would require
two web replicas and one worker and must receive a new plan and approval.

## Mandatory external evidence

All activation artifacts must be stored outside the repository or at an
explicitly ignored path. They must contain no secrets, raw provider
identifiers, customer data, credential-bearing URLs, private keys, tokens, or
environment values.

The preflight requires three strict JSON artifacts:

1. **Activation plan**
   - status `authorized_preflight`;
   - activation stage `split` for Stage 1;
   - exact source, Railway, database, push, recovery, monitoring, cost,
     rollback, provider-snapshot, and operator-review facts;
   - owner identity, approval window, plan hash, approved cost ceilings, test
     duration, and maximum worker-unavailable duration.
2. **Fresh Railway provider snapshot**
   - schema source `railway_cli_status_v1`;
   - captured only through the allowlisted, read-only
     `railway status --json` path;
   - sanitized to opaque SHA-256 fingerprints and allowlisted service facts;
   - no more than 15 minutes old at evaluation;
   - written once without overwriting an existing artifact.
3. **Fresh operator control review**
   - schema source `operator_activation_control_review_v1`;
   - no more than 15 minutes old at evaluation;
   - records the reviewed environment fingerprint, `master` branch,
     `staged_manual_apply` autodeploy mode, checked-in effective
     configuration, serverless state, billing cycle, both service controls,
     private database connection ceilings and role pool bounds, monitoring
     controls, and current cost/limit facts.

Environment enumeration is forbidden under the current incident boundary.
Only the sanitized status-capture path is allowed for provider inventory.

## Approval binding

- Approval is valid for at most 24 hours, cannot be future-dated, and must not
  be expired.
- The owner must approve positive limits for one-time cost, incremental
  retained monthly cost, total monthly cost, test duration, and worker
  unavailability.
- `approvedPlanSha256` is calculated over the complete strict plan while
  normalizing only the approval identity, time, and digest fields needed to
  sign it. Changing source, topology, configuration hashes, cost, monitoring,
  recovery, rollback, or provider bindings invalidates the approval.
- Evaluation also requires the owner-approved digest as an independent command
  value. Recomputing a changed plan's internal digest cannot replace that
  separately preserved approval during an honest operator review.
- The current preflight is not a cryptographic owner-authentication system. It
  assumes a trusted invoking operator, a separately access-controlled approval
  record, an independent comparison, and an owner-performed final provider
  action. A caller able to replace both plan and command digest can bypass the
  ceremony; this limitation is explicit rather than presented as technical
  nonrepudiation.
- The plan is separately SHA-256-bound to the exact provider snapshot and
  operator-control review supplied for evaluation.
- The planned activation window must fit inside the approved duration and
  worker-unavailable limits.
- Any new commit, provider change, credential change, stale snapshot, changed
  cost, changed billing cycle, or changed activation window requires a new
  digest and approval.

## Readiness checks

The preflight blocks unless all of the following are true:

- the worktree is clean, local HEAD equals the candidate commit, that candidate
  equals freshly resolved `origin/master`, and candidate history contains both
  the prepared implementation and live-before source;
- the connected provider branch is `master`;
- autodeploy is `staged_manual_apply`, the deployment trigger for each service
  is `manual_staged`, and effective config is exactly
  `checked-in Railway configuration`;
- the fresh provider snapshot and fresh operator review agree with the plan
  and with each other;
- fresh live health returns HTTP 200 for the recorded live-before commit and
  reports a migration version;
- the current web deployment is successful, redeployable, and bound as the
  rollback source and deployment;
- checked-in web and worker configuration hashes match the plan;
- the database is private and direct, declares an observed ceiling, uses one
  migration process, has positive pool bounds and a positive reserve, agrees
  with the operator-reviewed connection controls, and retains at least 30
  percent headroom at steady state and transition peak;
- schema changes are compatible with the rollback source or a reviewed forward
  repair exists;
- web and worker VAPID public-key and subject fingerprints match;
- the recovery checkpoint is no more than 24 hours old, the restore procedure
  is reviewed, and the rollback schema is compatible;
- uptime, worker heartbeat, push-backlog, dead-letter, resource, alert-receiver,
  and on-call controls are complete;
- current actual cost, current estimate, incremental estimate, one-time
  estimate, staged estimate, retained monthly cost, Railway Agent usage and
  limit, and provider enforcement facts are fresh and internally consistent;
- the staged estimate explicitly includes the one-time activation estimate and
  every cost remains inside the newly approved limits;
- if no verified provider hard limit exists, residual risk is explicitly
  accepted and a manual stop below the approved ceiling is recorded;
- a named rollback owner and either a visible provider rollback action or an
  exact rebuild fallback are ready.

## Manual staged activation design

A successful preflight is permission to ask the owner whether to start the
recorded window. It is not an activation command.

If the owner separately authorizes the exact passing plan, the future operator
sequence is:

1. confirm the passing artifacts are still fresh and unchanged;
2. manually stage the web service from the recorded candidate commit;
3. let the web predeploy apply the single migration and wait for exact-source
   health;
4. manually stage the worker using its checked-in config;
5. verify worker readiness, heartbeat, database headroom, push backlog,
   required VAPID generation, and cost;
6. run the time-bounded acceptance checks;
7. either retain the split within the approved amount or immediately execute
   the recorded rollback.

Autodeploy remains off during this sequence. Activation is from `master` only.

## Acceptance boundary

The strongest successful preflight status is:

`plan_snapshot_and_operator_review_consistent_pending_owner_activation`

That status means only that source, plan, fresh read-only provider evidence,
fresh operator review, approval, and local facts are mutually consistent. It
does not mean:

- a Railway setting changed;
- a service deployed;
- the worker ran;
- migration `0042_push_vapid_generation` was newly applied;
- Web Push delivery was re-proven during activation;
- a charge occurred or stayed below the estimate;
- rollback was exercised;
- redundancy, high availability, incident exit, launch readiness, or launch
  approval was achieved.

## Verification

Before any owner activation decision:

- complete the Packet 93 source verification;
- create a final clean candidate commit on `master`;
- capture new external/ignored artifacts inside the activation window;
- calculate and approve the final plan digest;
- run:

```text
npm run railway:activation:preflight -- --plan <plan.json> --provider-snapshot <railway-status.json> --operator-control-review <operator-review.json> --approved-plan-digest APPROVED_PLAN_SHA256 --require-ready
```

- independently confirm the output status and zero findings;
- preserve only redacted hashes, timestamps, costs, results, and deployment
  evidence in repository documentation after an authorized activation.

The combined candidate passes 252/252 unit/frontend checks, its other local
source gates, 25/25 disposable-database integration tests, and all 22 strict
preflight checks, including negative approval-drift, database overlap,
failed-Git, and default-exit tests. GitHub Actions run `30680447818`, job
`91316269376`, independently passed the Node 20 build/lint/unit checks and the
full PostgreSQL 16 integration set before launch readiness correctly stopped
on `ACTIVE_LAUNCH_HOLD` and `PAYMENT_PROVIDER_NOT_APPROVED`. Hosted E2E and
audit were skipped after that intentional stop; their local counterparts pass.

Railway automatic deployments are now off and Wait for CI is on, satisfying
the pre-merge provider-control proof. The payment-provider work was containment
only: a Connected-accounts destination and dedicated secret were configured,
then production ACH was verified disabled and setup-required on unchanged
`master` source. Signed delivery, scope attestation, and a durable matching
payment transition remain unproven. No live Stage 1 plan, fresh provider
snapshot, operator review, owner approval, worker, or Stage 1 activation
exists. The previous approval is expired and unusable. Stripe Connected-
accounts delivery remains a separate fail-closed payment/launch prerequisite
and is not cleared by Stage 1 preflight alone.

## Three-things review

1. Provider status does not expose every control needed for a safe activation;
   the independent operator review closes the gap for autodeploy, serverless,
   monitoring, billing, and cost facts.
2. An internal content hash alone can be recomputed after a plan changes. The
   separately preserved digest catches accidental or unilateral drift during
   trusted operation, but owner authentication remains procedural until a
   separately controlled signing key or hardware approval is adopted.
3. A hard cost limit can protect spend by stopping the whole workspace,
   including the app and database. The plan must record that outage mechanism
   and acceptance instead of presenting the limit as risk-free.

Packet status: **Runtime/gate evidence commit `2253bca` is pushed to draft PR
#14 and locally verified. Codex Security scan
`7e499cf8-be43-4b6d-ace9-e61f0978a27c` sealed
the implementation range `29e3c613..6c9e8035` with zero reportable findings;
later receipt/documentation commits were not part of that sealed range. The
runtime/gate evidence commit passed hosted source/database CI. Launch readiness remains
intentionally blocked. Production ACH is disabled; signed Connected-accounts
delivery, scope attestation, fresh exact-plan approval, strict preflight,
incident decision, merge, packet deployment, and separately authorized worker
activation remain pending**.
