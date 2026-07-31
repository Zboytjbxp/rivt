# Railway Stage 1 Cost Brief

## Status

**No Stage 1 activation is currently approved.**

The earlier Railway approval and its cost observations are expired. They must not be reused as
authorization, as a current billing estimate, or as proof that today's Railway controls still
match the proposed activation.

Stage 1 remains a prepared change only. A fresh human review is required before any service is
created, changed, restarted, scaled, or deployed.

## What Stage 1 changes

Stage 1 separates RIVT's background worker from the public web service. The intent is to keep
background work, including notification delivery, from competing with customer-facing requests.
This is an operational reliability change, not approval to add unrelated Railway resources.

The activation plan must identify exactly two application roles:

- `web` — serves RIVT and is the only role allowed to run database migrations.
- `worker` — processes background work and must not run web migrations.

Both roles must be reviewed with their full effective Railway configuration, including whether
push delivery is required.

## Fresh cost facts required

Immediately before approval, the operator must record all of the following from the **current
Railway billing cycle**:

- current month actual usage;
- Railway's current estimate before Stage 1;
- estimated incremental cost for the remainder of the current cycle;
- any one-time activation allowance;
- the resulting staged current-cycle estimate;
- the retained monthly cost after the test;
- the separate Codex Agent usage and Agent monthly limit;
- the currently visible provider hard limit, or a manual stop amount if no verified hard limit
  exists.

The staged estimate must reconcile exactly:

```text
staged current-cycle estimate
= current estimate before Stage 1
+ current-cycle incremental estimate
+ one-time activation estimate
```

The figures are recorded in US dollars and rounded to two decimal places. The plan must explicitly
state that the staged estimate includes the one-time activation amount.

The following ceiling check is separate and also required:

```text
staged current-cycle estimate + Agent monthly limit
<= freshly approved total monthly ceiling
```

Agent usage is not Railway compute usage. It must be recorded separately so the two costs cannot
be accidentally blended.

## Hard-limit warning

A Railway workspace compute hard limit can stop the application and its database when reached.
If the operator verifies such a limit, the plan must record:

- that its scope is `workspace_compute`;
- that it can stop the whole workspace;
- that the resulting full-workspace outage mechanism is understood and accepted.

If a provider-enforced hard limit cannot be verified, the plan must instead document the residual
cost risk and a positive manual stop amount. A dashboard estimate or notification by itself is not
a hard limit.

## Approval boundary

Fresh approval is bound to the exact plan through `approval.approvedPlanSha256`. The digest covers
the plan's owner, approval window, cost ceilings, topology, recovery facts, provider snapshot
binding, and operator-control-review binding.

The owner-approved digest must also be preserved outside the editable plan and supplied
independently to the final preflight. Recomputing the plan's internal digest after changing an
authority or cost field is not approval.

This control assumes a trusted operator. It detects drift between a separately preserved approval
record and the plan, but it does not cryptographically authenticate the person invoking the
command. A second-person comparison and owner-performed final provider action remain mandatory.

Approval is valid only when all of these are true:

1. The provider snapshot is freshly captured from Railway.
2. The operator control review is fresh and names its reviewer and review time.
3. The cost facts describe the current billing cycle and reconcile exactly.
4. The plan digest is computed after all reviewable fields are final.
5. A human approves that exact digest, cost ceiling, test duration, and outage allowance.
6. The approval has not expired when the preflight and activation occur.

Editing any bound field after approval requires a new digest and a new human approval.

## Safe preparation workflow

Use the tracked examples only as field maps. Copy them to an external or explicitly ignored
working directory before filling them. The preflight intentionally rejects tracked artifact
paths.

1. Capture a new Railway provider snapshot into a new file.
2. Complete a new operator control review from the Railway controls currently visible.
3. Fill a new activation plan from those two fresh artifacts and current cost facts.
4. Hash and bind both evidence artifacts in the plan.
5. Print the approval digest from the complete plan.
6. Obtain explicit human approval for that exact digest and its limits, and preserve the approved
   digest independently.
7. Change the plan to `authorized_preflight`, record the approval, and run the strict preflight
   with the separately preserved digest.
8. Activate only if the preflight reports ready.
9. Record the real outcome in a new activation-evidence file.

Never place provider credentials, environment variables, connection strings, webhook secrets, API
keys, or raw Railway identifiers in these artifacts. Use generated fingerprints where the schema
requires identity binding.
