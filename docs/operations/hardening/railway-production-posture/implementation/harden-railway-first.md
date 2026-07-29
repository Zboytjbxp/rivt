# Implementation Plan: Harden Railway first

## Selected Design And Constraints

Selected design: keep RIVT on Railway, make the application replica-safe,
then prove two web replicas, a dedicated worker, bounded pooling, PostgreSQL
HA/PITR, webhook-safe edge controls, independent recovery, and explicit
SLO/cost gates. AWS remains a triggered exit architecture.

Michael independently activated Railway Pro on 2026-07-29. That satisfies the
plan prerequisite only; no new replica, HA/PITR, edge, or support-SLO claim is
accepted from plan activation.

Authorized by this handoff:

- repository planning and future source changes;
- local generated-data tests;
- cost-free evidence collection and review of owner-supplied exports.

Not authorized:

- any further plan/committed-spend change, replica, worker, database, proxy,
  PITR, volume, WAF, CDN, DNS, monitoring, AWS, load-test, or support
  purchase/configuration;
- production read/write, migration, data access, or deployment;
- any action that could create incremental cost.

A generic “proceed” does not authorize those actions. Every live or
potentially chargeable stage requires Michael's explicit approval immediately
before execution, naming the configuration, maximum cost, expiry, and
rollback.

## Source Revision And Drift Check

- Packet source: `ae49a903db149023ac690f686bf0bac4c2197994`
- Live production source:
  `92a8451b8190f5119384a4970fb1a324503df995`
- Source drift: present; the branch is five commits ahead and contains
  undeployed security/recovery work.

Before each work package:

1. fetch the current remote state;
2. compare the target, branch, and live `/api/health` source commit;
3. revalidate process startup, pool, migration, push, maintenance, upload,
   and shutdown behavior;
4. stop if the observed architecture no longer matches this plan.

No branch-only behavior may be described as deployed.

## Affected Components

- `server/index.js` — process role, pool budget, readiness, measurements,
  shutdown;
- `server/migrations.js` — one-shot migration contract and status;
- `server/push-notifications.js` — claim/reclaim and worker-drain evidence;
- `server/database-maintenance.js` — worker-only database lease;
- `server/monitoring.js` — privacy-safe SLO/resource signals;
- `scripts/production-synthetic-monitor.js` and new generated-data proving
  scripts;
- `scripts/launch-readiness-check.js` — fail closed on `GA-OPS-009` until
  exact live evidence passes;
- `railway.json` and future role-specific start definitions;
- operational SLO, capacity, cost, failover, recovery, and rollback records.

## Ordered Work Packages

### Work Package 1: Baseline and policy

1. Add privacy-safe aggregate measurements for request route family/status/
   duration, PostgreSQL pool state/wait, event-loop delay, process RSS/heap,
   upload bytes/rejections/peak memory, worker backlog/age/failure, maintenance
   duration, dependency probes, and shutdown duration.
2. Collect seven consecutive days without email, phone, address, message,
   object key, signed URL, raw query, free-text body, or customer identifier.
3. Obtain owner-supplied aggregate provider CPU/RAM/volume/egress/bucket use.
4. Derive the expected-launch workload from the baseline.
5. Ask the owner to approve the product SLO, proving profile, and cost ceiling.

Exit: seven days collected, telemetry passes PII review, policy decisions are
recorded, and no provider mutation occurred.

### Work Package 2: Replica-safe process roles

Introduce an allowlisted production `RIVT_PROCESS_ROLE`:

- `web` — HTTP, static assets, and readiness only;
- `worker` — push delivery and leased maintenance; no public listener;
- `migrate` — migrations/status only, then exit;
- an explicit combined role may exist for local development/test but must
  never be a production default.

Production startup fails closed when the role is absent or invalid.

Retain the migration advisory lock, require web readiness to observe the
expected migration version, retain transactional push claims, add worker
claim/reclaim/drain evidence, and add a database advisory lease around each
maintenance interval.

### Work Package 3: Connection and memory budgets

Record and enforce:

```text
maximum application connections =
  (web replicas x web pool max)
+ (worker replicas x worker pool max)
+ migration/admin reserve
+ provider proxy/health reserve
```

The approved total remains below the database limit with at least 30%
reserve. Measure peak RSS/heap under bounded concurrent 10 MiB uploads; a
second web replica cannot be created until both budgets pass.

### Work Package 4: Local multi-process proof

Using generated data only:

- run two web processes against one test database and preserve sessions;
- run concurrent migration contenders and apply each version once;
- run two workers and claim every outbox item once;
- terminate a worker after claim and prove safe reclaim;
- run two maintenance contenders and execute one batch;
- send SIGTERM and prove bounded HTTP/worker drain;
- reject invalid roles, pending migrations, unavailable database/object
  storage, and insecure production session state.

Exit: all tests pass without provider resources and rollback to the explicit
local combined mode is documented.

### Work Package 5: Provider quote and disposable proving

Before starting, obtain a new explicit approval that names the Railway
environment, exact temporary resources, region, duration/expiry, maximum CPU,
RAM, connections, requests, bytes, egress, storage, and incremental cost.

Attach the current provider estimate and pricing timestamp. Refuse to start
when the worst-case planned cost exceeds the signed ceiling.

Run two web replicas and one worker with generated accounts/content, terminate
one replica under load, exercise migration promotion/rollback, and prove
valid signed webhooks while rejecting invalid signatures, methods, sizes,
rates, and direct-origin bypass.

Exit: exact temporary resources are removed by ID and any retained
volume/PITR cost and expiry are reported.

### Work Package 6: Controlled production activation

This requires a separate approval after Work Package 5 passes:

1. attest a current independent recovery point;
2. activate process roles without increasing capacity;
3. verify the exact deployed commit and web/worker/migrate behavior;
4. activate the approved bounded connection pool;
5. activate the approved database HA/PITR topology;
6. run two database failovers and one isolated PITR restore;
7. add the second web replica;
8. apply webhook-safe edge controls;
9. run the pilot and headroom profiles;
10. observe one complete error-budget window before broadening launch.

Stop immediately on data-integrity, authorization, payment, messaging,
upload, monitoring, recovery, or budget failure.

## Compatibility And Migration

- Preserve public API, session, PostgreSQL schema, object-key, webhook, and
  application data contracts.
- Keep the OCI image, twelve-factor configuration, PostgreSQL migrations/
  restores, S3-compatible object abstraction, custom DNS, and aggregate
  telemetry provider-neutral.
- Process-role changes must not require a data migration.
- Any later schema change needs a reviewed forward-repair and rollback plan;
  never improvise a production down migration.
- Do not dual-run AWS merely to claim portability. Reopen it only after a
  recorded migration trigger.

## Tactical Protections During Migration

- Keep the existing migration advisory lock until a one-shot runner is proved.
- Keep transactional `FOR UPDATE SKIP LOCKED` push claims.
- Keep current upload size/count and route rate limits while measuring memory.
- Keep valid signed webhooks off browser challenges; enforce exact route,
  method, signature, body-size, idempotency, and bounded rate checks.
- Keep the previous healthy application topology and recovery evidence intact
  until every new stage passes.
- Never delete a database, attached/unreviewed volume, PITR set, or immutable
  independent recovery copy during rollout or rollback.

## Tests And Security Validation

The generated-data workload includes:

- anonymous public-discovery reads;
- authenticated Home, Work, Crew, Shop Talk, and Tools reads;
- profile, job, application, messaging, contact, estimate, and invoice writes;
- bounded photo/document upload;
- signed Stripe webhook receipt and idempotent replay with approved test
  fixtures;
- push enqueue/claim plus session continuity.

Security validation covers role fail-closed behavior, account authorization
isolation, webhook signature/origin controls, migration version gating,
duplicate-suppression, worker reclaim, upload/rate limits, secret-free
telemetry, and exact cleanup.

No real ACH debit, SMS/email delivery, production customer data, or
chargeable side effect is allowed without separate approval.

## Performance And Resource Benchmarks

Proposed, tunable gates:

| Gate | Proposed threshold |
| --- | --- |
| Product availability | 99.9% rolling 30 days |
| Load error rate | At most 0.1% HTTP 5xx excluding injected upstream faults |
| Pilot profile | 35 concurrent sessions for 30 minutes |
| Headroom profile | 350 concurrent sessions for 10 minutes |
| Resource reserve | At least 30% CPU, memory, database-connection, and storage-growth headroom |
| Web termination | User-visible error interval at most 60 seconds; no lost committed write |
| Database failover | No unexplained acknowledged-write loss; service restored within 10 minutes |
| PITR/independent recovery | Existing 24-hour RPO and four-hour RTO |
| Worker recovery | No permanent loss or duplicate user-visible outcome; backlog returns to baseline |
| Cost | Measured and worst-case remaining cost remain inside the signed ceiling |

These are not observed demand, customer promises, or provider guarantees.
Michael must approve them, and latency targets are set only after the
seven-day baseline.

Review monthly: product/provider SLO burn, incidents, p95/p99 change,
database saturation, storage growth, worker backlog, restore results,
resource-family invoice, operator hours, and new contractual requirements.

## Rollout And Rollback

Promote one reversible stage at a time in the Work Package 6 order. Each stage
has an exact source/configuration identity, acceptance result, maximum cost,
owner, and rollback checkpoint.

On failure:

1. stop promotion and future staged activity;
2. return traffic to the last healthy commit/configuration;
3. gracefully drain and remove only exact new replicas/workers;
4. restore the last known pool and edge route while preserving webhooks;
5. preserve the latest database, volume, PITR set, and independent backup;
6. if a database change cannot roll back in place, restore to a new isolated
   target and cut over only under the recovery runbook;
7. record retained-resource cost and verify health, readiness, sessions,
   messaging, payments, uploads, monitoring, and recovery.

Provider budget alerts are not hard spend caps and must not be described as
such.

## Acceptance Criteria

- seven-day privacy-safe capacity baseline and owner-approved SLO/cost policy;
- fail-closed roles and reviewed connection/upload-memory budgets;
- local multi-process migration, worker, maintenance, shutdown, session,
  upload, and negative readiness tests pass;
- written Railway HA/failure-domain/durability/support answers and a
  cost-capped quote;
- two web replicas pass rolling deploy and termination tests;
- two database failovers, isolated PITR, and independent database-plus-object
  restore meet approved loss/time bounds;
- webhook-safe edge controls pass valid/invalid fixtures;
- pilot and headroom profiles pass within resource and cost ceilings;
- alerts and rollback are rehearsed on the exact deployed source.
- `launch:readiness --require-ready` evaluates `GA-OPS-009` and fails closed
  when any hosting evidence is missing or stale.

`R-054` closes only after the live topology and every acceptance item above
are evidenced. This planning handoff does not close it.

## Open Decisions

1. Approve or revise the proposed 99.9% product SLO.
2. Set the maximum Railway quote and test/production monthly ceilings.
3. Define the acceptable acknowledged-write-loss boundary.
4. Obtain Railway's written database failure-domain and replication answer.
5. Name the on-call owner while provider support has no SLO.
6. Set the loaded hourly rate for the 12-month Railway/AWS TCO model.
