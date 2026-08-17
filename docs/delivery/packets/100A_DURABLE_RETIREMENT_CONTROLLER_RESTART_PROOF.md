# Packet 100A - Durable retirement-controller restart proof

Status: **source-only implementation candidate; local unit verification passes;
database-backed subprocess proof awaits exact-head CI**

## Purpose

Replace Packet 100's in-memory controller-process-loss simulation with a real,
providerless persistence and process-restart proof. The retirement controller
must preserve registration, revision, fencing, private descriptor binding, and
deadline state after the writer or controller process is forcibly terminated.
This packet does not deploy that controller or grant it provider authority.

## Scope

- Add a PostgreSQL store for the existing `create`, `load`, fenced
  `compareExchange`, and bounded `listDue` controller contract.
- Require an injected pool, an exact reviewed runtime database-identity digest,
  and exact application, backup, and restore prohibited database identities.
  Read no environment variables and perform no I/O during construction.
- Keep controller records in the dedicated `rivt_recovery_control` namespace.
  The reviewed forward/rollback SQL lives in a nested migration directory that
  the application migrator does not scan.
- Use synchronous commits for store mutations, a single conditional `UPDATE`
  for CAS, deterministic due ordering, and a fixed 1,000-record sweep ceiling.
- Add a bounded, dependency-injected one-shot sweep helper. Direct execution is
  deliberately inert and returns only a fixed safe failure until a separately
  reviewed controller composition is supplied.
- Prove persistence and restart behavior with disposable PostgreSQL and direct
  Node subprocesses. Test-only providerless authority markers are not provider
  credentials or operational evidence.

## Acceptance boundary

- [x] Store construction is I/O-free and has no environment or ambient-credential
  fallback.
- [x] URL and runtime identity guards reject application, backup, or restore
  database reuse even when roles differ.
- [x] Registration create, exact load, single-statement fenced CAS, deterministic
  due selection, schema mismatch, corrupt rows, and fixed limits have focused
  tests.
- [x] Forward SQL creates a private fixed schema with JSON/shadow-field checks;
  rollback refuses to remove any durable record and never uses `CASCADE`.
- [x] The one-shot helper bounds each retirement operation and emits only
  aggregate state counts and allowlisted failure codes. Nonce, private descriptor,
  run identifier, database URL, and provider details are absent.
- [ ] Exact-head PostgreSQL integration proves a killed process after durable
  registration is reconciled by a fresh process as
  `abandoned-or-unknown`/completion-ineligible.
- [ ] Exact-head PostgreSQL integration proves an expired `retiring` lease is
  reclaimed with a higher fence and a stale process cannot finalize.
- [ ] Exact-head PostgreSQL integration proves effect-before-response retry and
  concurrent sweeps are idempotent and exercise the test authority marker once.
- [ ] Build, repository lint, aggregate tests, browser journeys, production
  dependency audit, diff integrity, JSON validation, and sensitive-pattern checks
  pass on the final source.

## Explicit non-claims

This packet does not create or use an AWS identity, policy, bucket, object,
credential, controller service, provider datastore, schedule, monitor, Railway
service, GitHub workflow, or production database. It does not prove an
independent deployment/failure domain, live forced termination, real policy
retirement, application-object recovery, or launch readiness. Local evidence
remains `providerless-injected-fake`; the existing five launch blockers must
remain unchanged.

## Rollback

Source rollback removes the new adapter, helper, tests, and nested migration
files. Database rollback is explicit-only and refuses to proceed while any
controller record exists. No application migration or production rollback is
created by this packet.
