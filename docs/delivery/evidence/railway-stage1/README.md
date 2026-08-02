# Railway Stage 1 Evidence

This directory documents the evidence boundary for the Railway Stage 1 split. It intentionally
contains **no live activation artifacts and no completed activation receipt**.

The tracked files under `docs/operations/templates/` are blank field maps only:

- `railway-activation-plan.example.json`
- `railway-provider-snapshot.example.json`
- `railway-operator-control-review.example.json`
- `railway-activation-evidence.example.json`

They contain null placeholders, no live provider inventory, no real identifiers, no source
commits, no cost observations, no approval digest, and no authorization.

## Important: the prior approval is expired

The old Stage 1 approval and its cost facts are expired. Do not copy their amounts, timestamps,
provider observations, or approval digest into a new packet. A new activation requires a fresh
Railway snapshot, fresh operator review, current-cycle cost reconciliation, and a new human
approval bound to the exact finished plan.

## Where working artifacts belong

Do not fill or overwrite the tracked examples. Copy them to either:

- a location outside this repository; or
- a path that Git explicitly ignores.

The strict preflight rejects tracked artifact paths. Snapshot capture also uses create-only file
semantics so it cannot silently replace an earlier observation.

Treat completed working artifacts as sensitive operational records even though they must never
contain credentials or raw secrets. Store them only in the approved evidence location.

## Artifact responsibilities

### Provider snapshot

Capture this from Railway immediately before review. The generated snapshot is the authoritative
source for provider inventory and includes fingerprinted service and deployment identities,
effective service configuration, replica count, region, volume state, deployment state, rollback
availability, and configuration hashes.

The tracked provider-snapshot example deliberately cannot pass strict validation until capture
replaces its null placeholders with fresh observed values. Do not manually invent those values.

### Operator control review

A named human operator records what the Railway controls currently show, including:

- `reviewedAt` and `reviewedBy`;
- environment and connected branch;
- deploy mode and effective configuration source;
- serverless setting and current billing-cycle dates;
- exactly one `web` and one `worker` service with the full reviewed configuration;
- `pushRequired` for both services;
- private/direct database state, observed connection ceilings, and the
  proposed web, worker, migration, reserved, and overlapping live-service pool
  bounds;
- monitoring and alert-receiver state;
- current cost, Agent usage, and hard-limit facts.

The operator-control-review example deliberately remains unreviewed. Its required identity and
review fields stay null until a real operator performs the review.

### Activation plan

The plan binds the provider snapshot and operator review by SHA-256. It also records:

- candidate, live, and rollback commits;
- database connection budgets for steady state and the transition;
- push-key fingerprints for both roles;
- a fresh recovery checkpoint and rollback compatibility;
- all required monitoring;
- an exact current-cycle cost reconciliation;
- the separate Agent usage and limit;
- the approved test window and worker unavailability allowance;
- rollback ownership and the current deployment fingerprint.

The example remains `draft`, has `approval.approved` set to `false`, and has no approval digest.
It is not executable authorization.

### Activation evidence

Create this only during an actually authorized activation. Record observed timestamps,
fingerprinted deployment identities, health and worker checks, push delivery, database headroom,
rollback availability, final cost reconciliation, and the honest outcome.

Do not mark an activation accepted unless every required check genuinely passed. A rollback is an
honest outcome and must include its actual reason. The tracked example is an incomplete draft, not
a completed receipt.

## Approval sequence

1. Capture the provider snapshot into a new external or ignored file.
2. Complete the operator review from currently visible Railway controls.
3. Copy and complete the activation plan.
4. Calculate each evidence file's SHA-256 and enter the bindings.
5. Confirm the plan and operator review agree field for field.
6. Reconcile the current-cycle cost exactly:

   ```text
   stagedEstimateUsd
   = currentMonthEstimateBeforeUsd
   + currentCycleIncrementalEstimateUsd
   + oneTimeActivationEstimateUsd
   ```

7. Confirm `stagedEstimateUsd + agentMonthlyLimitUsd` is within the proposed total ceiling.
8. Print the plan's approval digest only after every bound field is final.
9. Obtain fresh human approval naming that exact digest and its limits, and preserve that digest
   separately from the editable plan.
10. Record the approval fields, change the status to `authorized_preflight`, and run the strict
    preflight with the same evidence files plus the independently preserved digest.
11. Activate only when the strict preflight reports ready.
12. Complete a new activation-evidence record from actual observations.

Any post-approval change to the plan invalidates the digest and requires a new approval. Never
recompute a changed plan's internal digest and present that recomputation as owner authorization.
The digest comparison assumes a trusted operator; it is not a digital signature. Preserve the
approval in an access-controlled record, require an independent comparison, and keep the final
provider action owner-controlled.

## Never record

Never put passwords, API keys, access tokens, database URLs, private keys, webhook signing
secrets, raw provider identifiers, or environment-variable values in these files. Use the
preflight's generated fingerprints and redacted fields only.
