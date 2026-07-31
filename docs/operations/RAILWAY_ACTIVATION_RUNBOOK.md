# Railway Activation Runbook

This runbook governs a future manual Railway Stage 1 role split. It is a
fail-closed operating procedure, not standing permission to change Railway.

Current status: **source prepared and re-reviewed only**. Railway activation,
provider mutation, spending, deployment, high availability, redundancy,
incident exit, and launch readiness are not claimed.

## Authority boundary

Do not begin an activation while any of these are true:

- the production credential incident remains unaccepted for the exact
  activation scope;
- `ACTIVE_LAUNCH_HOLD` has not been intentionally addressed;
- the final candidate is not a clean reviewed commit on `master`;
- required evidence is missing, stale, or stored unsafely;
- the plan has not passed the strict preflight;
- the owner has not separately authorized the exact passing plan and its
  current cost/window limits.

An earlier approval cannot be reused after a commit, credential, provider
setting, topology, cost, billing-cycle, monitoring, recovery, or rollback
change.

## Prepared service design

| Service | Checked-in config | Runtime | Predeploy | Health | Stage 1 replicas |
| --- | --- | --- | --- | --- | --- |
| Web | `railway.json` | `node server/runtime.js web` | `node server/runtime.js migrate` | `/api/health` | 1 |
| Worker | `railway.worker.json` | `node server/runtime.js worker` | `node server/runtime.js worker-check` | none | 1 |

Both services:

- use Node 20 from `.nvmrc`;
- build with Nixpacks and `npm run build`;
- restart on failure with at most 10 retries;
- use a 30-second Railway drain;
- run in the same explicitly reviewed region;
- have no application volume;
- have serverless mode disabled;
- set `RIVT_PUSH_REQUIRED=true`;
- deploy only through the `manual_staged` trigger while autodeploy is
  `staged_manual_apply`.

The web predeploy is the only migration owner. `worker-check` is read-only and
must see the migration ledger already current before the worker starts.
Hosted `combined` mode is forbidden.

One web plus one worker is a responsibility split, not redundancy. Do not use
this runbook to add a second web replica. That is a separate `redundancy`
stage, approval, cost, and acceptance exercise.

## Required configuration contract

Record presence and fingerprints only; never copy secret values into an
artifact or repository document.

Both hosted services need the role/topology/database contract:

- `RIVT_PROCESS_ROLE`
- `RIVT_WEB_REPLICAS`
- `RIVT_WORKER_REPLICAS`
- `RIVT_WEB_PG_POOL_MAX`
- `RIVT_WORKER_PG_POOL_MAX`
- `RIVT_MIGRATE_PG_POOL_MAX`
- `RIVT_DB_RESERVED_CONNECTIONS`
- `RIVT_DB_MAX_CONNECTIONS`
- `DATABASE_URL` using the reviewed private direct endpoint
- `HTTP_SHUTDOWN_TIMEOUT_MS`
- `PUSH_DELIVERY_TIMEOUT_MS`
- `RIVT_PUSH_REQUIRED=true`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Keep VAPID public-key and subject fingerprints identical between web and
worker. Keep the private key secret and server-side. Preserve any other
service credentials through provider references; this runbook never authorizes
reading or exporting their values.

## Artifact handling

The activation plan, provider snapshot, and operator-control review must be:

- outside the repository, or inside a path that Git explicitly ignores;
- newly created for the activation window;
- strict JSON;
- free of secrets, raw provider IDs, customer data, private URLs, access
  tokens, keys, passwords, or copied environment values;
- retained only according to the incident/evidence policy.

The preflight refuses an artifact path inside the repository unless the path
is explicitly ignored. Provider capture also refuses to overwrite an existing
file.

Environment enumeration is prohibited. Do not run or record a broad variable
or secret inventory. Use only the allowlisted status capture below.

## Step 1 - Freeze and identify source

1. Fetch public remote history.
2. Confirm the worktree is clean, local HEAD is the final candidate, and that
   candidate equals freshly resolved `origin/master`.
3. Record:
   - final prepared implementation commit;
   - final candidate commit;
   - exact live-before commit from fresh production health;
   - rollback commit from the current successful, redeployable web
     deployment.
4. Confirm candidate history contains both the prepared implementation and the
   live-before commit.
5. Hash `railway.json` and `railway.worker.json` for the plan.
6. Do not continue if any source, config, or branch fact changes afterward.

## Step 2 - Prove current health, schema, push, and recovery

1. Capture fresh `/api/health` evidence:
   - HTTP 200;
   - exact live-before source;
   - current migration version.
2. Confirm migration `0042_push_vapid_generation` is in the required history
   and rollback compatibility or a reviewed forward repair is documented.
3. Run the production push-readiness check read-only. Require:
   - generation schema ready;
   - all eligible registrations active-generation and delivery-proven;
   - zero previous, unknown, unrecognized, retired, or inactive eligible
     registrations;
   - no due, stale, processing, or recent terminal outbox work.
4. Record a compatible recovery checkpoint no more than 24 hours old.
5. Confirm the restore procedure was reviewed and the rollback source can use
   the current schema.

Do not create a backup, restore target, subscription, push delivery, or
production row unless separately authorized.

## Step 3 - Capture a sanitized Railway snapshot

Create a new external or ignored path, then run:

```text
npm run railway:activation:preflight -- --capture-provider-snapshot <railway-status.json> --environment production --web-service RIVT
```

The command invokes only read-only `railway status --json`, keeps allowlisted
facts, replaces provider identities with SHA-256 fingerprints, scans for
sensitive values, and writes the artifact once.

The snapshot must be no more than 15 minutes old when evaluated. If it becomes
stale, capture a new file; do not overwrite the old one.

## Step 4 - Perform the operator control review

Create a separate external or ignored strict JSON artifact with:

- `schemaVersion: 1`;
- `source: "operator_activation_control_review_v1"`;
- review time and reviewer;
- production environment name and fingerprint matching the snapshot;
- connected branch `master`;
- autodeploy mode `staged_manual_apply`;
- effective config source `checked-in Railway configuration`;
- serverless disabled;
- current billing-cycle start and end;
- exactly one reviewed `web` control and one reviewed `worker` control,
  including config path, start/predeploy command, health path, replica count,
  region, volume, serverless, push-required, drain, and manual trigger;
- private/direct database state, observed global and effective connection
  ceilings, declared planning ceiling, and the web, worker, migration, and
  reserved connection bounds currently shown for the proposed configuration,
  including the live service's pool bound during deployment overlap;
- monitoring facts for public uptime, worker heartbeat, push backlog,
  dead-letter, resources, tested alert receiver, and on-call owner;
- current-month actual and estimate, Railway Agent usage/limit, and provider
  hard-limit facts.

This review must be no more than 15 minutes old when evaluated. It is a human
review of provider controls that the sanitized status snapshot cannot prove.

## Step 5 - Build the strict activation plan

Set:

- `schemaVersion: 1`;
- `status: "authorized_preflight"`;
- `activationStage: "split"`;
- the exact source, service, database, push, recovery, monitoring, cost,
  rollback, provider-binding, and operator-review facts;
- planned test duration and planned worker-unavailable minutes;
- new owner approval identity/times and positive maximums for:
  - one-time activation cost;
  - incremental retained monthly cost;
  - total monthly cost;
  - test duration;
  - worker-unavailable duration.

Cost evidence must distinguish:

- current-month actual;
- current-month estimate before activation;
- current-cycle incremental estimate;
- one-time activation estimate;
- staged estimate, explicitly including the one-time estimate;
- retained monthly cost;
- Railway Agent usage and separate monthly limit;
- verified workspace-compute hard limit and its whole-workspace outage effect,
  or explicitly accepted residual risk plus a manual stop.

The hard limit or manual stop, together with the Agent limit, must fit under
the owner's total approved ceiling. Do not round down or hide tax, residual
network/storage risk, or the fact that a workspace limit may stop both the app
and database.

## Step 6 - Bind owner approval to the plan

With the strict plan complete except for its final approval digest, print the
digest:

```text
npm run railway:activation:preflight -- --plan <activation-plan.json> --print-approval-digest
```

Give the owner the complete plain-language plan, including cost and outage
effects. Record approval only for that exact digest, and preserve the
owner-approved digest separately from the editable plan. Do not derive the
independent command value from the plan during evaluation. Approval is valid
for at most 24 hours and must expire at or before the approved activation
boundary.

If any material fact changes, regenerate the digest and obtain a new
approval.

### Approval trust boundary

The digest is an accidental-drift and audit control, not cryptographic proof
of who typed the command. The preflight assumes the invoking operator is
trusted and cannot stop a malicious operator with source/provider access from
substituting both a plan and its digest. Preserve the owner's approval in a
separate access-controlled record, have a second person compare that record to
the command value, and require the owner to perform the final Railway action.
A future owner-controlled signing key or hardware approval can remove this
procedural trust; it is not claimed by this packet.

## Step 7 - Run the read-only preflight

```text
npm run railway:activation:preflight -- --plan <activation-plan.json> --provider-snapshot <railway-status.json> --operator-control-review <operator-review.json> --approved-plan-digest APPROVED_PLAN_SHA256 --require-ready
```

Proceed only if:

- the command exits successfully;
- findings are empty; and
- status is exactly
  `plan_snapshot_and_operator_review_consistent_pending_owner_activation`.

This status does not activate anything. Ask the owner for the final go/no-go
decision for the exact still-current plan.

Blocked evaluation exits nonzero by default even when `--require-ready` is
omitted. `--report-only` is the explicit diagnostic exception and must never
be used as an activation gate.

## Step 8 - Future manual activation

Perform this section only after the owner gives that separate go decision.

1. Verify the plan, approval, snapshot, review, source, billing, and cost facts
   are still current.
2. Keep autodeploy off.
3. Manually stage the web service from the candidate commit and checked-in
   `railway.json`.
4. Wait for the one web predeploy migration to finish.
5. Require exact-source web health, current migration, database health, and
   monitored stability before touching the worker.
6. Manually stage the worker from the same candidate commit and checked-in
   `railway.worker.json`.
7. Require successful `worker-check`, worker heartbeat, required push mode,
   acceptable backlog, and database headroom.
8. Monitor for the owner-approved duration:
   - web health and error rate;
   - worker heartbeat and shutdown behavior;
   - push backlog, dead letters, and actual delivery;
   - PostgreSQL connection peak and headroom;
   - current cost against the manual stop/hard limit.
9. Stop and roll back on any failed invariant or when an approved time/cost
   boundary is reached.

Never manually start the worker before the web migration and exact-source
health are complete.

## Rollback

The plan must bind rollback to the current successful, redeployable web
deployment and source, name the rollback owner, and prove either:

- a visible Railway rollback/redeploy action; or
- an exact-source rebuild fallback.

Rollback sequence:

1. stop or remove the newly staged worker first;
2. restore the bound web deployment/source;
3. verify public health, migration compatibility, PostgreSQL, storage, and
   authentication;
4. verify push backlog is not being processed by two workers;
5. run the production monitor and targeted smoke;
6. record redacted evidence and actual cost;
7. keep the launch hold in place unless separately cleared.

If the old source is not schema-compatible, use only the pre-reviewed forward
repair. Do not improvise a destructive down migration.

## Evidence after an authorized activation

Repository evidence may record:

- candidate and live source SHAs;
- redacted artifact hashes and timestamps;
- commands/results without secrets;
- deployment status and opaque/fingerprinted provider references;
- health, migration, monitoring, push-readiness, capacity, rollback, and
  actual-cost results;
- the owner's exact authorized boundary.

Do not commit the raw plan, provider snapshot, operator review, secret values,
raw provider identifiers, or customer data.

## Exit states

- **Blocked:** any required fact, approval, freshness check, or invariant
  fails.
- **Prepared:** source and runbook are reviewed, but no fresh passing plan or
  owner activation exists.
- **Pending owner activation:** the exact preflight status above passes, but no
  provider mutation has occurred.
- **Activated for Stage 1:** may be claimed only after the separately
  authorized provider changes, exact-source health, worker/capacity/push
  checks, time-bounded monitoring, actual-cost review, and evidence update all
  pass.

This document currently ends in **Prepared**, not Activated.
