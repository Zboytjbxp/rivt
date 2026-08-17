# Packet 100A - Durable retirement-controller restart proof

Status: **accepted at the source-only restart-proof boundary on exact candidate
`14f0a6df7e445378d90bd62af7ef6812c0455694`; not merged, deployed,
configured, scheduled, provider-proved, or operationally approved**

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
- [x] Exact-head PostgreSQL integration proves a killed process after durable
  registration is reconciled by a fresh process as
  `abandoned-or-unknown`/completion-ineligible.
- [x] Exact-head PostgreSQL integration proves an expired `retiring` lease is
  reclaimed with a higher fence and a stale process cannot finalize.
- [x] Exact-head PostgreSQL integration proves effect-before-response retry and
  concurrent sweeps are idempotent and exercise the test authority marker once.
- [x] Build, repository lint, aggregate tests, browser journeys, production
  dependency audit, diff integrity, JSON validation, and sensitive-pattern checks
  pass on the final source.

## Accepted evidence

- GitHub Actions push run `32077077458` and PR run `32077080310` exercised the
  exact candidate `14f0a6df7e445378d90bd62af7ef6812c0455694`. Both passed
  build, repository lint, and the aggregate test step before launch readiness
  stopped the workflow on the intentional blockers.
- Exact-head tests passed 544/544 unit tests and 30/30 integrations. The
  PostgreSQL integration contains six nested durable-controller cases covering
  migration lifecycle, killed-process reopen/reconciliation, expired-lease
  recovery with a higher fence and stale-finalizer rejection, atomic
  effect-before-response retry, concurrent-sweeper exclusion, and database
  constraints plus guarded rollback.
- Focused Packet/recovery/readiness tests passed 296/296. Final local source
  verification also passed all three browser E2E journeys and
  `npm audit --omit=dev` with zero vulnerabilities. Those two gates were
  skipped in each CI run after readiness failed closed; they are local evidence,
  not CI evidence.
- Both exact-head readiness runs reported only
  `ACTIVE_LAUNCH_HOLD`, `RECURRING_BACKUP_INACTIVE`,
  `BACKUP_FRESHNESS_MONITOR_INACTIVE`,
  `APPLICATION_OBJECT_RECOVERY_MISSING`, and
  `RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE`.

## Explicit non-claims

This packet does not create or use an AWS identity, policy, bucket, object,
credential, controller service, provider datastore, schedule, monitor, Railway
service, GitHub workflow, or production database. It does not prove an
independent deployment/failure domain, provider persistence, live forced
termination, real policy retirement, application-object recovery, or launch
readiness. The real subprocess termination occurred only against disposable,
providerless PostgreSQL in exact-head CI. Writer-control evidence
remains `providerless-injected-fake`; the existing five launch blockers remain
unchanged.

## Rollback

Source rollback removes the new adapter, helper, tests, and nested migration
files. Database rollback is explicit-only and refuses to proceed while any
controller record exists. No application migration or production rollback is
created by this packet.
