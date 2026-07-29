# Railway activation runbook

Last reviewed: 2026-07-29 America/New_York

## Status and authority boundary

This is an operator runbook, not an authorization or a deployment receipt.
Packet 94 changed source and documentation only. A later read-only Railway
status export inspected service metadata, but no provider setting, data,
service, replica, deployment, traffic, or paid resource was changed or
created.

Michael's standing instruction is controlling: **no action that can create a
charge may be taken without his explicit permission immediately before that
action**. A generic "proceed" does not authorize the provider stage below.
The approval must identify the exact project, environment, services,
resources, duration, and maximum cost.

The source prepared by Packet 94 is:

- branch: `codex/railway-activation-readiness`;
- implementation commit: `e5d952ca454a2857c131e1b860ad9cd07dc6399a`;
- live production observed before this packet:
  `92a8451b8190f5119384a4970fb1a324503df995`.

These values must be re-read immediately before a future activation. Never
activate from an assumed branch or stale SHA.

## Current read-only provider facts

A read-only `railway status --json` observation on 2026-07-29 reported:

- production source `92a8451b8190f5119384a4970fb1a324503df995`;
- one application replica and one PostgreSQL service;
- no worker service;
- the existing application still using its prior `npm start`/Nixpacks-style
  effective deployment settings rather than the Packet 94 split config;
- application sleep disabled;
- no volume attached to the application service; and
- a separate unattached, `READY`, 5 GB production volume.

These are time-bound read-only observations, not activation evidence and not
permission to change anything. The unattached volume must not be called
orphaned or deleted by inference. Identify its owner, purpose, data/recovery
relationship, retention need, and ongoing cost before any action. Historical
deployment metadata that says `plan:hobby` is not authoritative evidence of
the workspace's current plan; use the current billing/account view.

## What Railway Pro does and does not establish

Railway Pro raises available platform limits and has a US$20 monthly minimum
that includes the first US$20 of resource usage. It does not, by itself,
create replicas, database high availability, point-in-time recovery,
application monitoring, a WAF policy, a capacity baseline, or a tested
rollback.

Published usage rates reviewed on 2026-07-29 were:

- memory: US$10 per GB-month;
- CPU: US$20 per vCPU-month;
- service egress: US$0.05 per GB;
- volume storage and incremental native volume-backup bytes: US$0.15 per
  GB-month; and
- storage-bucket bytes, including a configured PITR archive bucket:
  US$0.015 per GB-month, plus applicable service egress for archive uploads.

Those rates are planning inputs, not a quote. The dashboard estimate and the
owner's written ceiling control any future action. Compute and Agent limits
are separate; Agent usage also consumes the Pro included credit and must be
recorded.

Official references:

- <https://docs.railway.com/pricing/plans>
- <https://docs.railway.com/pricing/understanding-your-bill>
- <https://docs.railway.com/pricing/cost-control>
- <https://docs.railway.com/deployments/optimize-performance>
- <https://docs.railway.com/deployments/healthchecks>
- <https://docs.railway.com/deployments/pre-deploy-command>
- <https://docs.railway.com/deployments/deployment-teardown>
- <https://docs.railway.com/networking/private-networking>
- <https://docs.railway.com/networking/waf>
- <https://docs.railway.com/volumes/backups>
- <https://docs.railway.com/volumes/point-in-time-recovery>
- <https://docs.railway.com/storage-buckets/billing>

## Selected staged topology

The safe transition is intentionally smaller than the final launch target.

### Stage 1 - split the process

- Existing public service: **one** `web` process.
- New private service: **one** `worker` process.
- Migration: the web deployment owns the single schema-mutating pre-deploy
  command. The worker runs only the non-mutating `worker-check` and must start
  only after the web migration and readiness receipts are current.
- PostgreSQL: existing private endpoint, after its exact capacity, backup,
  PITR, and failure-domain settings are recorded.
- Region: keep the web, worker, and database in the same current region.

Stage 1 separates HTTP from push delivery and maintenance. It is not
application redundancy and does not close `GA-OPS-009`.

### Stage 2 - add web redundancy

Only after Stage 1 is stable and under a separate cost approval:

- increase the public web service to **two same-region replicas**;
- retain one worker unless measured backlog requires a reviewed change;
- prove shared session behavior, graceful drain, request distribution,
  database headroom, and rollback on the exact deployed source.

Do not start with multi-region web replicas. A single-region PostgreSQL
dependency would add cross-region latency and would not create end-to-end
regional failover.

## Source configuration contract

Railway config-as-code can override dashboard values. Each service must point
at the right file:

| Service | Config path | Start | Pre-deploy | Health |
| --- | --- | --- | --- | --- |
| Web | `/railway.json` | `node server/runtime.js web` | `node server/runtime.js migrate` | HTTP 200 at `/api/health` |
| Worker | `/railway.worker.json` | `node server/runtime.js worker` | `node server/runtime.js worker-check` | No HTTP health check |

Both configs use a direct Node start so the process receives `SIGTERM`.
Both allow a 30-second Railway drain while RIVT keeps its bounded shutdown
coordinator. The worker intentionally has no public domain and no HTTP health
path. Its activation evidence comes from structured startup, capacity, queue,
and shutdown events.

Railway documents a pre-deploy command as a separate container that runs
before the application starts. Only the web command mutates schema. RIVT's
migration command retains the checksummed migration ledger and PostgreSQL
advisory lock. The worker's `worker-check` is deliberately non-mutating: it
checks the database ceiling, current migration ledger, required VAPID
configuration, and shutdown budget before the worker is eligible to start.

Deploy the web and retain both its migration receipt and ready deployment
identity before manually deploying the worker from the same exact candidate
commit. A GitHub push can deploy services independently and does not provide
cross-service ordering. Worker autodeploy must therefore remain disabled (or
its source trigger disconnected) through the web migration and readiness
gate. Do not treat staged changes, reference-variable dependencies, or a
passing local plan linter as a cross-service deployment transaction.

## Environment contract

Set shared topology values identically on web and worker. Set only the
role-specific `RIVT_PROCESS_ROLE` per service.

| Variable | Web | Worker | Rule |
| --- | --- | --- | --- |
| `RIVT_PROCESS_ROLE` | `web` | `worker` | Never use hosted `combined` |
| `RIVT_WEB_REPLICAS` | same value | same value | Must equal actual deployed web count |
| `RIVT_WORKER_REPLICAS` | same value | same value | Must equal actual deployed worker count |
| `RIVT_WEB_PG_POOL_MAX` | same value | same value | Must match reviewed budget |
| `RIVT_WORKER_PG_POOL_MAX` | same value | same value | Must match reviewed budget |
| `RIVT_MIGRATE_PG_POOL_MAX` | same value | same value | Includes one pre-deploy pool |
| `RIVT_DB_RESERVED_CONNECTIONS` | same value | same value | App/operator safety allowance |
| `RIVT_DB_MAX_CONNECTIONS` | same value | same value | No greater than observed usable PostgreSQL ceiling |
| `RIVT_PUSH_REQUIRED` | `false` | `true` | Worker must fail closed without valid VAPID |
| `PUSH_DELIVERY_TIMEOUT_MS` | `8000` | `8000` | Allowed range is 1,000-10,000 ms |
| `HTTP_SHUTDOWN_TIMEOUT_MS` | `20000` | `20000` | Reserves a nominal post-push margin and stays below the 30-second drain; forced shutdown is still the bound if database work stalls |
| `RIVT_CAPACITY_TELEMETRY_ENABLED` | `true` | `true` | Fixed-schema aggregate evidence only |
| `RIVT_CAPACITY_TELEMETRY_INTERVAL_MS` | reviewed value | reviewed value | Default 300,000 ms; retain cost/volume bounds |

Use Railway private networking for `DATABASE_URL`. This activation requires
the **direct private PostgreSQL endpoint**. Do not use a public TCP proxy,
PgBouncer/pooled endpoint, or an unverified HA proxy: startup's
`max_connections` observation and the connection worksheet must describe the
same PostgreSQL server that accepts the application sessions. A future
pooler/HA endpoint requires a separately reviewed budget and failover test.
Record only a redacted host fingerprint, port, endpoint kind, and TLS mode;
never record the URL or credentials. Keep secrets out of screenshots, logs,
evidence JSON, shell history, and this repository.

Do not invent any pool or connection value. Query PostgreSQL first:

```sql
SELECT
  current_setting('max_connections')::integer AS max_connections,
  current_setting('superuser_reserved_connections')::integer
    AS superuser_reserved_connections,
  COALESCE(NULLIF(current_setting('reserved_connections', true), ''), '0')::integer
    AS reserved_connections,
  (SELECT datconnlimit
   FROM pg_database
   WHERE datname = current_database())::integer AS database_connection_limit,
  (SELECT rolconnlimit
   FROM pg_roles
   WHERE rolname = current_user)::integer AS role_connection_limit;
```

RIVT now repeats this check during every web, worker, and migration startup.
Startup fails if the declared database ceiling is above PostgreSQL's observed
effective ceiling: the minimum of global usable slots and any non-unlimited
database or role limit.

Confirm that the selected endpoint is direct PostgreSQL. Also record the
database product/image and version, region and failure domain, volume
attachment, HA topology and failover endpoint behavior (even when HA is
disabled), and every global/database/role-reserved connection limit. A
PgBouncer or HA endpoint is a stop condition for this activation until its
frontend/client ceiling, backend/server ceiling, pool mode, failover
behavior, and startup-query measurement layer are added to a reviewed plan.

The steady-state connection plan is:

```text
(web replicas x web pool)
+ (worker replicas x worker pool)
+ RIVT reserved connections
```

The migration pool is zero after deployment. It must retain at least 30%
headroom. The transition worksheet must separately show:

```text
(old combined replicas x old combined pool)
+ (candidate web replicas x web pool)
+ (candidate worker replicas x worker pool)
+ (concurrent web migration processes x migration pool)
+ operator/admin/RIVT reserved allowance
```

Use the greatest conservative phase total even though the staged procedure
is designed not to run every component concurrently. Record the old
deployment's actual pool, the pre-deploy process count, deployment overlap,
observed active connections, and the phase in which the peak occurred. A safe
steady-state calculation is not sufficient for an unsafe replacement or
rollback overlap.

## Mandatory no-write preflight

Stop before provider mutation if any item is missing:

1. Exact `origin/master`, proposed deploy SHA, and live `/api/health` SHA are
   recorded and reconciled.
2. The implementation and documentation commits have passed review.
3. Railway project, production environment, service IDs, config paths,
   region, actual replica counts, resource limits, restart policy, drain,
   private networking, effective config source, connected branch/watch
   patterns, per-service deployment trigger, autodeploy state, overlap,
   runtime, domains, app-sleep state, volume attachments, deployment IDs,
   applied configuration hashes, alert routing, and current usage are
   recorded from Railway. Web and worker must have no attached volume before
   replica activation. Worker autodeploy must be off until web acceptance.
4. PostgreSQL product/image/version, private direct-endpoint use, redacted
   endpoint fingerprint/port/TLS mode, every applicable connection limit,
   volume, region/failure domain, failover endpoint behavior, HA state,
   backup and PITR details, and last restore drill/RTO are recorded from the
   account. The native-volume-backup record includes schedule, retention,
   last success, protected volume, bytes, restore target/scope, and the
   volume-deletion limitation. The PITR record separately includes enable
   time, bucket/region, base/full/incremental schedule, restore-window start
   and end, last successful archive, WAL continuity, and sibling-service/HA
   restore behavior. A sustained archive outage can shorten the effective
   restore window; the dashboard window is not sufficient proof by itself.
5. The transition and steady-state connection budgets both retain at least
   30% headroom. The transition worksheet separately records old combined
   count/pool, candidate web count/pool, candidate worker count/pool, the one
   web migration count/pool, and reserve.
6. The exact merged candidate migrations are reviewed as expand/contract
   compatible with the old rollback source, or a reviewed forward-repair path
   exists. A successful advisory lock is not schema rollback proof.
7. VAPID configuration is valid; web and worker public-key and subject
   SHA-256 fingerprints match; and the future worker uses
   `RIVT_PUSH_REQUIRED=true`. Record fingerprints only, never key material.
8. Fixed-schema capacity telemetry is enabled with reviewed provider
   retention, access, volume, and cost controls.
9. Continuous public uptime plus worker heartbeat, push backlog, dead-letter,
   CPU, RAM, disk, and egress alerts are configured; their receiver and
   on-call owner are tested. The plan records restart-exhaustion behavior,
   detection interval, alert-delivery bound, backlog threshold, and the
   owner-approved maximum worker-unavailable interval. `ON_FAILURE` with ten
   retries can leave the worker stopped after exhaustion. Deployment health
   and logs alone do not satisfy monitoring.
10. A fresh recovery point and rollback owner exist. The prior deployment's
    removed-image expiry is calculated from Railway's 120-hour Pro retention,
    the rollback action is visibly available, and an exact rebuild fallback
    binds source SHA, config hash, build inputs, and redacted variable hash.
    This does not substitute for the still-open independent-recovery blocker.
11. A current read-only dashboard estimate or manual rate worksheet is
    captured without secrets. Do not apply or stage provider configuration
    merely to obtain an estimate, because that action can trigger a build or
    deployment.
12. The owner-approved project change ceiling and Railway's workspace-level
    Compute hard limit are recorded as different controls. Crossing the hard
    limit can stop every workload in that workspace; it is not a precise
    per-project budget and does not cap Agent charges. Alerts/estimates are
    not caps. If that outage mechanism is unacceptable or no suitable
    enforced limit exists, approval must accept residual risk and set a
    numeric manual stop value. Residual risk includes actual metered usage,
    other workspace services, Agent usage, taxes, egress, PITR upload,
    native-backup bytes, deployment overlap, pre-deploy compute, and partial
    billing-cycle effects.
13. Michael signs the exact approval record below no more than 24 hours
    before activation; it remains unexpired for the whole approved window.
14. A fresh, redacted, read-only Railway provider snapshot is captured
    without overwriting prior evidence:
    `npm run railway:activation:preflight -- --capture-provider-snapshot <new-snapshot-path> --environment production --web-service RIVT`.
    The capture mode runs only `railway status --json`, discards fields
    outside the strict allowlist, and replaces raw provider IDs with SHA-256
    fingerprints. Bind its printed artifact hash and observation time to the
    plan. The plan and supplied snapshot then pass:
    `npm run railway:activation:preflight -- --plan <plan-path> --provider-snapshot <snapshot-path> --require-ready`.

The verification mode is a local **plan/snapshot verifier**. It checks the
redacted plan, exact local repository facts, and a supplied, short-lived
read-only provider snapshot for consistency. Unlike the separate capture
mode above, verification does not log into Railway or acquire a snapshot.
Neither mode verifies a deployment, inspects PostgreSQL, tests an alert, or
proves live acceptance. A passing result says that the supplied artifacts
agree; it does not establish post-deploy behavior. Every provider or runtime
claim still needs a timestamped, redacted observation in the evidence
receipt.

## Cost worksheet and approval record

Complete this with current dashboard evidence. Do not put credentials,
database URLs, signing secrets, contact data, or customer data in it.

```text
Approval status: NOT AUTHORIZED / AUTHORIZED
Approved by:
Approved at:
Expires at:

Railway workspace name + redacted ID:
Railway project name + redacted ID:
Environment name + redacted ID:
Region:
Source commit:
Live rollback commit/deployment ID:
Recovery checkpoint ID + age:
Maximum worker-unavailable minutes:

Stage:
Web service ID/config path/replicas/resource limits:
Worker service ID/config path/replicas/resource limits:
Web/worker deployment IDs and exact source/image:
Web/worker deployment triggers and autodeploy states:
Connected branch and watch paths:
Effective config source and applied config hashes:
App-sleep/serverless states:
Database service ID/product/resource limits:
Web/worker volume attachments (must be none):
Unattached volume ID/purpose/owner/size/recovery role/retained cost:
Database direct-private endpoint fingerprint/port/TLS mode:
Database version/region/failure domain/HA/failover behavior:
Database global/database/role/reserved limits:
Native volume-backup schedule/retention/last success/bytes/restore scope:
PITR enabled/window/WAL continuity/last archive/bucket/region/restore behavior:

Billing-cycle start/end:
Current month actual usage:
Current month estimated bill:
Pro included usage remaining:
Agent usage:
Staged one-time maximum:
Staged incremental monthly maximum:
Total monthly approved ceiling:
Provider-enforced hard limit and workspace scope:
Provider hard-limit behavior verified:
Full-workspace outage mechanism accepted:
Residual cost risk accepted:
Manual stop at:
Test duration and traffic ceiling:
Resources retained after test:
Expected retained monthly cost:

Operator:
Rollback owner:
Approval wording:
```

Approval must name a numeric one-time maximum and incremental monthly
maximum. "Included in Pro", "should be free", or an unpriced dashboard
preview is not an acceptable ceiling. Railway alerts and estimates are not
caps. A workspace Compute hard limit can create a full-workspace outage, so
the approval must either accept that exact mechanism or accept the residual
risk and a numeric manual stop. Native volume backups are billed at the
volume rate (US$0.15/GB-month reviewed above); bucket/PITR storage is a
different meter (US$0.015/GB-month reviewed above) and PITR uploads can add
service egress.

## Future activation procedure

Every step below is future work and requires the completed approval above.

### 1. Freeze and reconcile

1. Freeze unrelated production changes.
2. Fetch `origin/master`; record its exact SHA.
3. Read `/api/health`; record live source and migration version.
4. Confirm the proposed source is reviewed and reachable from `master`.
5. Export redacted current config metadata and capture the current deployment
   ID for rollback.

### 2. Protect recovery and cost

1. Verify the approved recovery checkpoint is current.
2. Verify rollback owner and communication channel.
3. Verify the cost limit, alerts, expiry, and resource cleanup owner.
4. Stop if the estimate exceeds either approved ceiling.

### 3. Prove trigger safety, then stage shared settings

Railway variable and configuration changes can trigger a deployment. Before
editing anything, prove from current provider evidence that autodeploy and
every source/reference-variable trigger are disabled and that the edits will
remain unapplied. If that cannot be proved, do not pre-stage settings; make
the reviewed changes only inside the approved manual web deployment window.

1. Add the reviewed shared topology/pool/ceiling values.
2. Keep actual declared replica counts equal to the existing topology.
3. Confirm the existing service still has its current role until the staged
   release is intentionally applied.
4. Set the web config path and effective deployment settings, but do not
   trigger a release until its exact diff and configuration hash are
   recorded.
5. Confirm no secret is visible in the change set or evidence.

### 4. Create and validate the worker definition

1. Create an empty worker service or otherwise disable its source trigger
   before connecting the approved source. Creating capacity is itself inside
   the approved cost window.
2. Set config path `/railway.worker.json`.
3. Set `RIVT_PROCESS_ROLE=worker` and `RIVT_PUSH_REQUIRED=true`.
4. Use the direct private `DATABASE_URL`.
5. Do not attach a public domain or HTTP health check.
6. Disable worker autodeploy/app sleep and record connected branch, watch
   paths, trigger mode, effective config, and configuration hash.
7. Confirm that no worker deployment exists or is running. Do not use a
   simultaneous GitHub push, batch, or reference-variable change to start it.
8. Do not start or retain it if the dashboard estimate changed beyond the
   approved ceiling.

### 5. Deploy web first, then the worker

1. Manually deploy the existing public service from the exact candidate
   commit with `RIVT_PROCESS_ROLE=web` and `/railway.json`.
2. Observe exactly one web pre-deploy migration process; retain its deployment
   and migration receipts. Stop if another migration or worker deployment
   starts.
3. Require Railway deployment success, `/api/health` HTTP 200, expected
   source/migration identity, and `processRole=web`.
4. Wait for the former combined deployment to drain fully, confirm
   connections fall inside the reviewed bound, and retain the web deployment
   ID/configuration hash. Do not add a second web replica in Stage 1.
5. Only after the web gate passes, manually deploy one worker from the same
   exact candidate commit. Its non-mutating pre-deploy command must be
   `node server/runtime.js worker-check`.
6. Require the worker startup/heartbeat/backlog evidence below. Keep worker
   autodeploy disabled until the entire Stage 1 receipt is accepted.
7. Stop and roll back if a readiness race, unexpected deployment trigger,
   source/config mismatch, or connection peak occurs. Do not repair the
   sequence by launching another deployment.

### 6. Stage 1 acceptance

Require all of the following on the exact source:

- `/api/health` returns 200 and the expected source/migration identity;
- the recorded deployment IDs, applied config hashes, triggers, watch paths,
  app-sleep states, domains, and volume attachments match the approved plan;
- the web starts with `processRole=web`;
- the worker starts with `processRole=worker`, a current migration ledger,
  valid push provider, and the expected private pool size;
- one test account can sign in and retain its session across a web restart;
- Stripe billing and Connect webhook endpoints return their expected safe
  validation responses;
- one consenting test push queues and reaches its test device once;
- worker backlog returns to baseline and no attempt is finalized twice;
- maintenance lease evidence shows bounded, non-overlapping work;
- uploads and signed object reads work on a non-sensitive test artifact;
- graceful `SIGTERM` logs a completed drain within the provider window;
- continuous monitoring detects a stopped/exhausted worker and delivers an
  alert inside the approved bound, while total worker unavailability remains
  below its approved maximum;
- error, capacity, resource, and cost signals remain inside approved bounds;
  and
- the owner-visible app smoke covers Contacts -> Estimate -> Invoice ->
  Payment without using a real charge unless separately approved.

Stage 1 failure means rollback, not improvisation.

### 7. Stage 2 approval and acceptance

Obtain a new exact cost approval before changing web replicas from one to
two. Then require:

- both actual web replicas identify the exact source and role;
- observed requests reach both replica IDs;
- shared sessions and authorization work regardless of replica;
- terminating either replica leaves the public path available;
- the surviving topology stays inside connection, latency, memory, CPU, and
  error ceilings;
- Stripe webhooks are not blocked or duplicated by the edge path;
- rollback to one web replica is rehearsed; and
- at least seven days of privacy-safe baseline evidence are collected before
  claiming capacity or SLO readiness.

## Rollback

Rollback never runs a down migration and never deletes production data.

### Stage 1 rollback

1. Stop the new worker so it cannot continue background work.
2. If Railway still exposes the recorded combined deployment image within
   the documented 120-hour Pro removed-image retention window, use that exact
   rollback action and record the resulting deployment ID.
3. If that action is missing, expired, or fails, rebuild the exact rollback
   source with the recorded config, build inputs, and redacted variable hash.
   A branch name or an unpinned "previous" image is not an exact fallback.
4. Roll the existing public service back to the recorded combined role and
   prior environment contract.
5. Retain PostgreSQL, volumes, object storage, backups, and recovery evidence.
6. Verify `/api/health`, migration identity, sessions, one safe API read,
   Stripe webhook reachability, push backlog state, and error rate.
7. Record any migration that remains forward-only and open a reviewed repair
   plan. Do not improvise a schema downgrade.

### Stage 2 rollback

1. Return the public service to one web replica.
2. Keep the healthy worker only if its Stage 1 proof remains valid.
3. If worker health is uncertain, use the full Stage 1 rollback.
4. Verify the same health, session, API, webhook, backlog, and cost checks.

If the source rollback cannot safely read the current schema, stop the
release and use the reviewed forward-fix/recovery plan. Do not delete rows,
restore over live production, or mutate a recovery point without a separate
production-data authorization.

## Edge, TLS, and DDoS cautions

- Railway provides public TLS and layer-4 mitigation. That is not a full
  application-layer DDoS or bot-control proof.
- Railway Under Attack Mode is an emergency browser challenge. It can block
  non-browser clients, Stripe webhooks, public API clients, external uptime
  monitors, and other machine traffic. Do not claim that it blocks or protects
  Railway's internal deployment health check without provider-specific proof.
  Never enable it as an always-on control without an explicit bypass-safe
  design and webhook proof.
- Keep PostgreSQL on private networking. `R-055` remains open for any public
  database client that cannot authenticate the expected certificate.
- A later Cloudflare or equivalent edge stage must preserve original client
  identity safely, authenticate trusted proxies, exempt only the exact
  webhook paths needed, and pass replay/signature/rate-limit tests.

## Evidence receipt

Use
`docs/operations/templates/railway-activation-evidence.example.json` as a
schema guide. Use
`docs/operations/templates/railway-activation-plan.example.json` for the
owner-approved plan. Use
`docs/operations/templates/railway-provider-snapshot.example.json` only as
the strict shape for the short-lived, read-only current-state CLI artifact.
Its deliberately stale time, zero fingerprints, and
`EXAMPLE_NOT_EVIDENCE` values must all be replaced from a fresh observation;
the example file itself must never be supplied as activation evidence.

The plan contains intended candidate values, the provider snapshot contains
the current pre-activation Railway state, and the evidence receipt contains
independently observed activation/post-deploy provider and runtime values.
Never copy a plan value into an observed field without actually checking it
and recording the observation method and time. A valid receipt must bind:

- exact source, deployment, service, environment, config-path, role, region,
  and replica identities;
- redacted configuration hashes rather than secret values;
- migration version and every pre-deploy outcome;
- actual and declared PostgreSQL ceilings, pools, replicas, transition
  overlap, and headroom;
- web health plus worker startup/backlog/lease/drain evidence;
- session, API, Stripe webhook, push, upload, and rollback results;
- approved and observed cost ceilings; and
- explicit pass/fail/rollback status with operator and timestamps.

Machine-observed evidence includes exact deployment/source/config identities,
health/API responses, database query output, worker telemetry, and monitor
delivery. Provider-observed evidence includes Railway IDs, effective settings,
billing, backup/PITR, and rollback availability read from the account.
Manual observations must name the operator, time, and procedure. An empty
template, plan-linter pass, screenshot of the Pro badge, successful build, or
passing local test is not deployment evidence.

## Exit state

Packet 94 exits when the source guardrails, runbook, approval boundary,
rollback, and empty evidence schema are reviewed and locally verified.
`GA-OPS-009`, `R-054`, `R-055`, and `R-056` remain open. Public-launch
readiness requires later, separately approved provider, capacity, failure,
recovery, edge, cost, and production-runtime proof.
