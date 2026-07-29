# Packet 93 — Railway replica-safety source controls

## Objective

Remove the application-level hazards that currently make horizontal replicas
unsafe, and add a privacy-safe capacity evidence foundation without changing
Railway, production data, or spend.

This is a source-only packet. It does not add a Railway service or replica,
change a database or provider setting, run a charge-bearing load test, migrate
production data, or deploy.

## Source and production boundary

- Packet source base:
  `b5569621e7b7e80c00cfb57cfdbb4fa0c07249aa`
- Packet target:
  `234f73455e2283d20ef06c09077123ee1afa61d1`
- Live production source:
  `92a8451b8190f5119384a4970fb1a324503df995`
- Packet branch:
  `codex/railway-replica-safety`

Nothing in this packet may be represented as live until it is reviewed,
merged to `master`, deployed, and proved against the exact live source.

## Confirmed vulnerable path

The pre-packet application process combines:

- the public HTTP listener;
- automatic migration application;
- push-delivery polling;
- hourly database maintenance; and
- a default 10-connection PostgreSQL pool.

Adding application replicas in that shape multiplies connection pools and
background schedulers, allows every web process to mutate schema during
startup, and gives shutdown no bounded proof that a worker attempt completed
or was safely left retryable.

## Required invariant

Hosted execution must be explicit and fail closed:

- `web` serves HTTP and verifies that the migration ledger is current without
  applying schema changes;
- `worker` opens no HTTP listener, runs push delivery and leased maintenance,
  and drains active work during shutdown;
- `migrate` applies checksummed migrations under the existing advisory lock
  and exits;
- `combined` remains available only for local development and tests;
- every hosted role has an explicit pool size and the declared topology
  retains at least 30% of the database connection ceiling;
- maintenance runs under a cross-process PostgreSQL lease;
- push-delivery completion/failure updates are fenced to the claimed attempt;
  and
- capacity telemetry accepts only fixed-schema aggregate fields and never
  emits paths, query strings, account IDs, message text, file names, or other
  free text.

## Source implementation

Packet 93 introduces:

- an allowlisted process-role contract and role-specific capabilities;
- role-specific PostgreSQL pool construction;
- an explicit connection-budget calculation for declared web, worker, and
  migration topology;
- a runtime entry point that separates HTTP, background work, and one-shot
  migrations;
- a non-mutating migration-ledger assertion for web and worker startup;
- a PostgreSQL transaction-scoped advisory lease for maintenance;
- push-delivery attempt fencing and worker shutdown that awaits the active
  batch;
- aggregate request-family, latency-bucket, memory, event-loop, pool, upload,
  worker-backlog, maintenance, and dependency telemetry; and
- request logging that records an allowlisted route family rather than a raw
  path or actor identifier.

The fixed-schema telemetry is disabled unless explicitly enabled. Enabling it
later is a configuration decision; this packet does not turn on a provider or
send telemetry anywhere.

## Preserved behavior and explicit limits

- Existing API, session, migration ledger, schema, and local combined-runtime
  behavior remain the compatibility boundary.
- PostgreSQL `SKIP LOCKED` plus attempt fencing prevents two workers from
  finalizing the same database attempt. External push delivery is still
  at-least-once because a provider can accept a request before the database
  records success.
- A maintenance lease prevents overlapping cleanup work; it does not prove
  provider or database high availability. It is an overlap lease, not a
  durable once-per-hour global schedule: staggered workers can each execute a
  later bounded, idempotent prune after the prior lease is released.
- Aggregate capacity telemetry supplies a safe evidence format; it is not a
  seven-day baseline, an alert, an SLO, a load result, or proof of headroom.
- Shutdown outcome and end-to-end duration remain in the bounded structured
  `runtime.shutdown_*` events, where the coordinator knows whether a deadline
  forced termination; they are intentionally not represented by an
  unsupported capacity counter.
- PostgreSQL pool acquisition and idle-client lifetimes are bounded, but
  non-local TLS still follows the pre-existing provider-compatible
  `rejectUnauthorized: false` path. `R-055` remains open until an exact
  provider-supported CA-authenticated private/public path and negative
  certificate test are proved.
- Source role separation is a prerequisite for replicas, not authorization to
  create them.

## Cost, provider, and deployment boundary

Michael's instruction that no cost-bearing action occur without permission
remains controlling. Packet 93 performs no:

- Railway service, replica, plan, region, volume, HA, PITR, WAF, CDN, DNS, or
  environment-variable change;
- AWS or other provider action;
- production read/write, migration, failover, restore, or synthetic load
  operation;
- monitoring-vendor activation; or
- deployment.

Any provider configuration, staged topology, generated load, or incremental
cost still requires explicit approval immediately before the action.

## Risk and requirement state

- `R-054` remains High/open. Replica-safe source is one exit prerequisite;
  two deployed web replicas, worker topology, capacity evidence, PostgreSQL
  failure-domain/HA/PITR evidence, edge controls, load, failover, recovery,
  alerts, and rollback remain unproved.
- `R-056` remains Medium/open. The new capacity format avoids arbitrary free
  text by construction, but existing diagnostic/error systems still require
  retention, access, and sampled redaction review.
- `GA-OPS-009` remains a public-launch **Blocker**.
- `GA-OPS-005` remains **Partial** until the aggregate signal is deployed,
  retained, alerted, and used to collect an approved baseline.
- `GA-OPS-008` remains **Partial** because this source-only packet is not a
  provider or deployment proof.

## Acceptance boundary

Packet 93 is accepted only when:

- missing, invalid, or hosted `combined` roles fail before binding a listener;
- `web`, `worker`, and `migrate` capabilities are exact and covered;
- hosted pool and topology inputs are explicit and a connection plan with
  less than 30% headroom is rejected;
- web startup detects missing, drifted, or pending migrations without
  mutating the migration ledger;
- concurrent migration execution retains the existing advisory-lock safety;
- concurrent workers cannot finalize one claimed attempt twice and shutdown
  awaits an active batch;
- concurrent maintenance schedulers produce one lease holder and one safe
  skip, and shutdown awaits an active cycle;
- telemetry accepts only its fixed aggregate schema and adversarial private
  inputs cannot appear in serialized output;
- repository build, lint, full tests, E2E, and production dependency audit
  pass;
- build state, requirement maturity, and risks record the exact source/live
  and no-cost boundaries; and
- the branch is committed and pushed without a deployment or provider change.

## Verification evidence

On 2026-07-29, exact local verification of implementation commit
`234f73455e2283d20ef06c09077123ee1afa61d1` passed:

- `npm run build`;
- `npm run lint`;
- `npm run lint:security`;
- 79/79 focused runtime/security tests;
- `npm run test` — 204/204 unit/frontend tests and 26/26 PostgreSQL
  integration suites in 1,489.1 seconds;
- `npm run test:e2e` — authentication fail-closed, jobs/discovery
  desktop+mobile, offline recovery, and production CSP paths;
- `npm audit --omit=dev` — zero reported vulnerabilities; and
- diff integrity.

These are local source results. They do not establish a deployed role
topology, provider configuration, capacity baseline, HA, failover, PITR,
edge, load, production-data, or production-runtime result. Branch
`codex/railway-replica-safety` was pushed through documentation commit
`b1b5fa3`; it has not been merged or deployed.

## Status

**Source implementation verified, committed, and pushed for review.
Source-only, no provider change, no paid action, no production-data
operation, and not deployed.**
