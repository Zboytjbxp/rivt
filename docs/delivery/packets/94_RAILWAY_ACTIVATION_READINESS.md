# Packet 94 - Railway activation readiness

> **Forward-port note (2026-08-02):** this packet records the historical
> `codex/railway-activation-readiness` implementation and evidence boundary.
> Its SHAs, provider observations, CI result, and cost worksheet do not prove
> the later `codex/release-candidate-consolidation` candidate. The consolidated
> candidate remains local, unmerged, undeployed, and subject to the active
> credential-incident launch hold, fresh CI, a fresh provider snapshot, and a
> new exact-source/cost approval.

## Objective

Convert Packet 93's replica-safe source foundation into a fail-closed,
cost-bounded, reversible Railway activation package without mutating Railway,
production data, or deployment.

## Source and production boundary

- Packet 93 final pushed tip and Packet 94 source base:
  `037c5a0f7adaed0009c86fb35b4aad3055681135`
- Verified implementation commit:
  `e5d952ca454a2857c131e1b860ad9cd07dc6399a`
- Live production source confirmed read-only during this packet:
  `92a8451b8190f5119384a4970fb1a324503df995`
- Packet branch:
  `codex/railway-activation-readiness`

Nothing in this packet is live. It may not be represented as deployed until
it is reviewed, merged to `master`, deployed, and proved on the exact runtime.

A read-only Railway CLI status observation confirmed one RIVT application
service beside one PostgreSQL service in `us-east4`, with no worker service.
The live app remains on the exact source above and the earlier
`npm start`/Nixpacks-style contract with `/` health, no pre-deploy command,
and no drain. App sleep is disabled and the app service has no attached
volume. A separate unattached `READY` 5 GB production volume also exists. Its
purpose, recovery value, and ongoing cost require review; it is not
characterized as orphaned and this packet does not authorize deletion.
Historical `plan:hobby` deployment metadata is not authoritative for the
owner's current Pro plan. No variables, credentials, or production data were
read.

## Why this packet exists

Railway Pro activation proves only that the account has the Pro plan. It does
not prove the application's service roles, replica count, drain, database
capacity, HA, PITR, DDoS posture, monitoring, rollback, or cost ceiling.

Packet 93 separated the code into explicit `web`, `worker`, and `migrate`
roles. Before any provider activation, four remaining source/operator seams
had to be closed:

1. one global Railway config attached an HTTP health check to a worker with
   no HTTP listener;
2. an `npm start` parent could intercept Railway's `SIGTERM`;
3. connection safety trusted an operator-entered database ceiling without
   comparing it with PostgreSQL; and
4. the worker could start while push delivery was silently unconfigured and
   an outbound delivery had no hard socket deadline.

## Implementation

Packet 94 adds:

- a web-specific `railway.json` using the role-bound
  `node server/runtime.js web` start, the sole schema-mutating one-shot
  advisory-locked pre-deploy migration, HTTP health check, and 30-second
  provider drain;
- a separate `railway.worker.json` using the role-bound
  `node server/runtime.js worker` start and a non-mutating
  `worker-check` pre-deploy readiness command, with no HTTP health check;
- hosted startup refusal when `RIVT_PROCESS_ROLE` is absent or conflicts with
  the role bound into the service start command;
- hosted migration refusal unless the command is running as the configured
  web service pre-deploy step; a worker or standalone migrate role cannot own
  schema changes;
- a startup query of PostgreSQL's global `max_connections`, reserved slots,
  current-database connection limit, and current-role connection limit;
- fail-closed comparison of `RIVT_DB_MAX_CONNECTIONS` with PostgreSQL's
  effective ceiling: the minimum of global usable slots and every applicable
  non-unlimited database/role limit;
- mandatory `RIVT_PUSH_REQUIRED=true` on a hosted worker, so a false value or
  invalid/missing VAPID blocks both worker readiness and activation before a
  delivery controller can claim work;
- a bounded 1-10 second outbound push timeout, defaulting to 8 seconds;
- a hosted-worker shutdown budget capped below Railway's 30-second drain and
  required to reserve a nominal five-second scheduling margin after the
  bounded push deadline; the forced shutdown remains the actual bound if
  database work stalls;
- config and unit/integration coverage for the new invariants; and
- a Gate A workflow timeout aligned with the measured serial integration
  suite instead of terminating the gate after 15 minutes.

No replica or region is encoded in either Railway config. That omission is
intentional: repository source must not create capacity or choose a provider
region without current evidence and explicit cost authorization.

## Selected staged activation

The future procedure has two separately approved stages:

1. manually deploy the public web first, retain its migration and readiness
   evidence, and only then manually start one private worker from the exact
   same candidate source;
2. after stable Stage 1 proof, obtain a new approval and increase web to two
   same-region replicas.

Stage 1 reduces process-composition risk but is not web redundancy. Stage 2
is not launch-ready by configuration alone; it still requires shared-session,
single-replica failure, database headroom, edge, cost, and rollback proof.
Git-triggered service deploys are not treated as an ordered transaction, so
worker autodeploy must remain disabled or disconnected through the web-first
migration and readiness gate.

The exact procedure, cost worksheet, approval wording, account fact sheet,
acceptance checks, DDoS caveats, and rollback are in
`docs/operations/RAILWAY_ACTIVATION_RUNBOOK.md`. The redacted preflight plan
is bound to a fresh read-only provider snapshot and local source/config facts,
but a passing comparison proves only that the proposed plan matches those
pre-activation observations. It does not prove that activation ran or passed.
The separate empty evidence schema at
`docs/operations/templates/railway-activation-evidence.example.json` is
filled only from a future approved activation and cannot be inferred from the
plan.

The preflight also reconciles the candidate and transition replica counts
with the validated service records and current provider snapshot. Cost
authority is at most 24 hours old and must choose either a verified Railway
workspace Compute hard limit—recording its amount, scope, workspace-stop
behavior, owner acceptance, and separate Agent limit—or an explicitly
accepted residual-risk path with a manual stop no higher than the approved
monthly ceiling.

## Cost and authority boundary

Michael's instruction not to incur cost without permission remains
controlling. Apart from the bounded read-only status observation above, this
packet performs no:

- Railway account, service, replica, environment, region, resource, domain,
  WAF, database, volume, backup, PITR, or cost-limit change;
- AWS, Cloudflare, monitoring, or other provider action;
- production-data read/write, migration, failover, restore, or synthetic
  load;
- merge to `master`; or
- deployment.

A future approval must name the exact provider project/environment, services,
replicas, resources, region, duration, cleanup owner, source, rollback target,
maximum one-time cost, incremental monthly ceiling, and total monthly hard
limit. It must also record the exact workspace scope and outage behavior of
any provider-enforced hard limit: exhausting a workspace-wide Compute limit
can stop every workload in that scope. Dashboard estimates and alerts are not
hard caps; if an acceptable enforced limit is unavailable, the approval must
explicitly accept residual cost risk and set an immediate manual stop value.
A generic "proceed" or "Pro includes it" is insufficient.

## Confirmed provider boundaries

Official Railway documentation reviewed on 2026-07-29 establishes:

- Pro has a US$20 monthly minimum including the first US$20 of usage; actual
  resources can create overage;
- replicas are manually configured and same-region traffic is distributed
  among them;
- pre-deploy commands run in separate containers before application start;
- health checks require HTTP 200 and are deployment checks, not continuous
  monitoring;
- config-as-code can override dashboard configuration;
- a drain window is separate from the application's graceful shutdown;
- private networking avoids a public database path;
- Under Attack Mode is an emergency browser challenge that can block
  non-browser/API traffic, including webhooks; and
- Railway database HA/PITR products and their failure behavior must be
  confirmed on the exact account rather than inferred from the Pro badge.

## Risk and requirement state

- `R-055` remains High/open. No replica, HA, PITR, load, failover, edge,
  baseline, alert, cost, or runtime proof was created.
- `R-056` remains High/open. Private networking is required by the runbook,
  but public-client certificate authentication remains unproved.
- `R-057` remains Medium/open. The new evidence schema excludes secrets and
  customer data, but deployed telemetry retention/redaction remains unproved.
- `GA-OPS-009` remains a public-launch **Blocker**.
- `GA-OPS-005` remains **Partial**.
- `GA-OPS-007` remains **Partial**. Focused local tests do not replace the
  full repository, integration, browser, or exact-runtime acceptance gates.
- `GA-OPS-008` remains **Partial** because a runbook and source config are not
  provider or deployment evidence.

## Acceptance boundary

Packet 94 is accepted only when:

- web and worker config paths are role-correct and do not encode capacity;
- both roles use a role-bound direct Node start and bounded provider drain;
- web is the sole schema-migration owner, while the worker's pre-deploy
  command is a non-mutating current-schema/provider/database/shutdown
  readiness check;
- the worker has no HTTP health check;
- PostgreSQL's effective global/database/role connection ceiling is read
  before startup and can reject an overstated declaration;
- a hosted worker fails closed unless push delivery is explicitly required
  and VAPID is valid;
- outbound push attempts have a hard deadline;
- the hosted worker validates a nominal post-request scheduling margin inside
  the provider drain, without claiming that an unbounded external database
  operation is guaranteed to complete before forced shutdown;
- the runbook keeps provider mutation, cost, production data, and deployment
  behind an exact future approval;
- Stage 1 is manually ordered web-first and then worker from the same source,
  rather than assuming a Git push orders two Railway services;
- rollback never invents a down migration or destructive data operation;
- preflight binds a proposed plan to fresh read-only provider and local
  source/config facts without treating that consistency result as activation
  evidence, while the separate evidence template remains empty, redacted,
  source-bound, and cannot be mistaken for a passing receipt;
- repository build, lint, tests, E2E, audit, and diff integrity pass; and
- build state, traceability, and risks keep all hosting blockers honest.

## Verification evidence

The final implementation commit passed before documentation:

- `npm run build`;
- `npm run lint`;
- `npm run lint:security`;
- 39/39 focused role, push, preflight, and runtime-entrypoint tests;
- `npm run test`: 222/222 unit/frontend tests and 27/27 serial PostgreSQL
  integration tests;
- `npm run test:e2e`: four browser paths;
- `npm audit --omit=dev`: zero production dependency vulnerabilities;
- all three JSON evidence templates parse; and
- diff integrity.

The first public branch CI run (`30495709509`) passed install, build, and
lint, then cancelled the forced-shutdown unit test before integration began.
The root cause predated this packet: the timer that resolves an awaited
forced-shutdown promise was unreferenced, allowing clean Linux Node to end the
event loop first. Follow-up commit
`3283048b262ed539f4fde925dafafb7689b2a3fc` keeps that deadline active.
Focused security coverage passes 47/47 locally after the correction.

The second public CI run (`30496419975`) passed all 222 unit tests and reached
healthy PostgreSQL, then failed closed in integration because the workflow's
implicit 100-connection declaration exceeded the disposable database's 97
usable slots after three reserved connections. Commit
`96624b099687969b3d6a17a54f861b3c10e7e4c7` explicitly declares that
observed CI ceiling. The application ceiling check remains unchanged.

Public Gate A run `30497239166` then passed every workflow step on exact
verification tip `d6806dac2bb7d8504fbe5c10762fdbfe967393be`:
build, lint, the full unit and serial PostgreSQL integration aggregate,
launch-readiness enforcement, three browser paths, and the production
dependency audit. The standard runner was free because the repository is
public, and the approximately 57 MB Actions cache remained inside GitHub's
10 GB repository allowance. This $0 repository proof did not change Railway.

The final documentation tip `c357f513ccd21bafd69aa7fe68d23f9e157832d7`
also passed the complete public Gate A workflow in run `30497449412`.

## Zero-cost Stage 1 cost observation

A later read-only CLI and dashboard observation on 2026-07-29 confirmed that
the workspace currently reports US$2.18 of metered usage and a US$4.06
resource estimate for the July 9-August 9 billing cycle, against the Pro
plan's US$20 minimum and included usage. Railway Agent usage is US$0.00.
Compute has no configured hard limit or email alert; the separate Agent hard
limit is US$20.

The observation also confirmed the current one-web/one-PostgreSQL production
and staging topology, no worker, approximately 370 MB in the attached
production database volume, approximately 161 MB in the attached staging
database volume, and approximately 166 MB in the unattached 5 GB production
volume. Railway bills actual volume bytes used, making the unattached
volume's current planning cost approximately US$0.025/month rather than the
US$0.75 full-capacity amount. Its purpose remains unverified, so no deletion
is authorized. Two production storage buckets contain approximately 40.4 MB
and 35 bytes; no credentials or objects were read.

`docs/operations/RAILWAY_STAGE1_COST_BRIEF.md` records the zero-cost
worksheet. One proposed private worker capped at 0.5 GB RAM and 0.25 vCPU,
with a 1 GB monthly egress reserve and no volume, has a conservative
US$10.05 monthly ceiling. Added to Railway's US$4.06 estimate, the staged
resource model is US$14.11, so the expected invoice remains the existing
US$20 Pro minimum before tax. The proposal is not authorization.

The future approval should pair a US$12 Compute alert, a workspace-wide
US$20 Compute hard limit, a US$0 Agent hard limit, and a US$18 manual
intervention threshold with a US$1 one-time maximum, US$10.05 incremental
monthly maximum, and US$21 total monthly ceiling before tax. The owner must
explicitly accept that a Compute hard-limit stop can take the entire
workspace, including production, offline. No provider setting was changed.

Local source evidence is not deployment evidence.

## Status

**Activation package implemented and fully repository-verified locally.
Railway status was observed read-only; no provider change,
variable/credential access, production-data operation, incremental cost,
merge, or deployment occurred. The branch is pushed for review. Public launch
remains blocked.**
