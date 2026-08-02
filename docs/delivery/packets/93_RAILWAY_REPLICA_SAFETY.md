# Packet 93 - Railway replica safety

## Objective

Re-review the checked-in Railway runtime so a future, separately authorized
Stage 1 split can run one HTTP service and one background worker without
duplicating migrations, scheduled maintenance, or Web Push delivery.

This packet records source preparation only. It does not activate a Railway
service, change provider configuration, incur an approved cost, deploy a
commit, add high availability, prove redundancy, or clear any launch hold.

## Source and production boundary

- The Railway sequence was replayed onto the committed Packet 87 line ending
  at `070243f`; the integration base is
  `9490c860736fbbf3ab916e488bfc994cca60753e`, and the reviewed provider-safety
  follow-up is `0b78de26aa7c7ee60e8cc5b3cdb608be6c7c2c3f`.
- The final activation candidate SHA must be recorded only after all current
  review changes are committed and reviewed. Neither SHA above is described
  here as deployed production source.
- Packet 87 remains the active product packet. The production credential
  incident, `ACTIVE_LAUNCH_HOLD`, Stripe connected-account event-delivery
  blocker, and Railway Stage 1 pause remain in force.

## Accepted implementation scope

- Pin the repository runtime to Node 20 through `.nvmrc` and build both Railway
  services with Nixpacks using `npm run build`.
- Keep hosted process roles explicit:
  - `web` serves HTTP and owns the migration predeploy;
  - `worker` handles background Web Push delivery and maintenance;
  - `migrate` runs schema migration and exits;
  - `combined` remains a local/test convenience and is rejected for hosted
    runtime use.
- Keep the checked-in web service contract in `railway.json`:
  - start `node server/runtime.js web`;
  - predeploy `node server/runtime.js migrate`;
  - health path `/api/health`;
  - 300-second health timeout;
  - restart on failure, at most 10 retries;
  - 30-second provider drain.
- Keep the checked-in worker service contract in `railway.worker.json`:
  - start `node server/runtime.js worker`;
  - predeploy `node server/runtime.js worker-check`;
  - no HTTP health path;
  - restart on failure, at most 10 retries;
  - 30-second provider drain.
- Make `worker-check` non-mutating. It verifies the migration ledger,
  database-connection budget, hosted shutdown budget, and required Web Push
  provider, then exits without starting work or applying a migration.
- Permit only one migration process during a staged transition. The worker
  never owns or races schema migration.
- Keep database pools role-specific and reject any planned steady-state or
  transition topology that does not retain at least 30 percent connection
  headroom.
- Preserve the bounded worker shutdown contract: the application shutdown
  deadline must remain below Railway's 30-second drain and reserve at least
  five seconds beyond a single push-delivery deadline.
- Preserve single-owner database maintenance and attempt-fenced, drainable
  push work so overlapping deployments cannot turn the same claimed attempt
  into two successful deliveries.

## Migration 0042 and Web Push preservation

- Migration `0042_push_vapid_generation` is part of the required schema
  history. It records a privacy-safe VAPID-generation fingerprint on each
  subscription and supports indexed readiness classification.
- Browser registration claims a generation only when the subscription key
  matches the configured public key. A malformed or retired generation is not
  promoted to active.
- Successful delivery records the generation that actually authenticated.
  Active-first fallback must not relabel a subscription until delivery proves
  which generation worked.
- Both future hosted services must set `RIVT_PUSH_REQUIRED=true`.
  Missing, incomplete, mismatched, or invalid VAPID configuration therefore
  blocks startup or predeploy instead of silently disabling device alerts.
- `npm run push:readiness -- --json` remains a separate fail-closed production
  gate. It must report the generation schema ready, no eligible previous,
  unknown, unrecognized, retired, or inactive registrations, delivery proof
  for every eligible active-generation registration, and no due, stale,
  processing, or recent terminal outbox work.
- The previously recorded three-device push proof is incident evidence, not
  permission to skip a fresh activation-window readiness check.

## Provider, cost, and deployment boundary

This packet performs no Railway API mutation and authorizes none. In
particular, it does not:

- create, resize, restart, redeploy, or delete a service, database, volume, or
  bucket;
- change replicas, regions, variables, autodeploy, serverless mode, billing
  limits, or deployment triggers;
- write production data or run a production migration;
- consume an earlier cost approval after the credential incident or after
  source/configuration changes;
- claim that one web replica plus one worker is high availability or
  redundancy.

Any future provider action requires Packet 94, the activation runbook, a fresh
owner-approved and hash-bound plan, fresh provider evidence, and a new manual
activation decision.

## Acceptance

- The repository contains separate checked-in web and worker Railway
  configurations with one migration owner.
- Hosted combined-role startup is unavailable.
- Web and worker startup fail closed on required push configuration.
- Worker predeploy is read-only and migration-aware.
- Database topology, shutdown timing, migration compatibility, and Web Push
  generation preservation are represented in the activation preflight.
- Source review does not mutate Railway or imply production acceptance.

## Verification

Before this packet can be cited by an activation plan:

- run the repository build, lint, unit/integration, E2E, and dependency-audit
  gates required by `AGENTS.md`;
- run the focused runtime, process-role, migration, Web Push, push-readiness,
  and Railway preflight tests;
- record the final clean candidate commit and checked-in configuration hashes;
- run `git diff --check`;
- complete Packet 94's fresh read-only provider and operator-control review.

Current combined evidence: build, application/security lint, 252/252
unit/frontend checks, focused Railway/runtime/push/security checks, all three
browser E2E journeys, Tools/Shop Talk/Trade News/mobile-actions/Work-lifecycle
UI smoke, dependency audit, and diff integrity pass. A disposable loopback-only PostgreSQL 18
cluster with `RIVT_DB_MAX_CONNECTIONS=97` passed 25/25 integration tests with
zero failures or skips; production and Railway were not used. Local runtime
was Node 24 and PostgreSQL 18. Gate A now reads Node 20 from `.nvmrc` and uses
PostgreSQL 16, but an exact-source CI run remains a later gate.

## Three-things review

1. A role split prevents duplicate background work, but it does not make a
   single web replica redundant. A separate redundancy stage needs its own
   cost, capacity, rollback, and owner approval.
2. A successful worker predeploy proves configuration and schema readiness at
   that moment; it does not prove later device delivery. Push readiness and
   monitored delivery remain separate gates.
3. Safe steady-state database usage is insufficient if an old deployment can
   overlap a new one. The activation plan must include the transition peak and
   still retain 30 percent database headroom.

Packet status: **Combined source prepared and locally verified; fresh exact-
plan approval, strict preflight, incident decision, and separately authorized
provider activation remain pending**.
