# Packet 96 - Provider-evidence approval lifecycle

## Objective

Make the exact-source launch-readiness path structurally reachable without
weakening Packet 95's authority boundary. Source `S` defines immutable policy,
evidence revision `E` supplies only plan-bound provider receipts, and a later
approval revision `A` records approvals and the launch-hold decision only after
the evidence exists.

## Source and production boundary

- Branch: `codex/provider-evidence-approval-lifecycle`
- Candidate base: `4e50a0e0b90b585819401565b8bd8cf40e8875d2`
- Authority sequence: `S -> E -> A`
- Approval manifest:
  `docs/delivery/evidence/railway-stage1/approval/<S>/<E>/launch-readiness.json`

This packet is source, test, workflow, and documentation work only. It does
not authorize a merge to `master`, deployment, provider call, credential
access, production-data action, added cost, launch-hold clearance, Railway
Stage 1, ACH activation, incident closure, or public launch.

## Root cause

Packet 95 correctly made source policy immutable and removed policy authority
from the provider-evidence overlay. It also kept approvals in source `S`.
Launch readiness requires those approvals to be recorded after the evidence
they approve, but `E` must descend from immutable `S`. A valid approval could
therefore not both postdate the evidence and remain part of `S`. The full gate
was fail-closed but structurally unable to become ready.

## Authority model

- `S` supplies incident, recovery, and payment policy plus stable evidence
  control identities. It cannot contain later provider observations or the
  final approval decision.
- `E` descends from `S` and supplies only provider-plan receipts whose paths,
  types, identities, and SHA-256 digests are bound by the reviewed plan.
- `A` descends from `E` and may add exactly one manifest at the path bound to
  the exact `S` and `E` revisions. It supplies only named approvals and the
  explicit launch-hold decision.
- Launch readiness receives a materialized in-memory view. Policy intent comes
  from `S`, observed facts come from `E`, and approvals/hold disposition come
  from `A`; no later root becomes a general-purpose policy root.

## Implementation boundary

- Validate clean, exact-revision, repository-root `S`, `E`, and `A` worktrees
  before dependencies, provider credentials, adapters, or readiness execute.
- Attest through the read-only GitHub branch API that both `E` and (in
  launch-ready mode) `A` are protected before either branch is accepted as a
  trust root.
- Require `S` to be an ancestor of `E` and `E` to be an ancestor of `A`.
- Restrict `A` history to one exact, regular-file approval manifest with no
  symlink, extra-file, merge-history, or path ambiguity.
- Bind `A` to the exact source-policy digest, evidence-plan digest, evidence
  overlay digest, receipt identities, receipt digests, and the exact incident
  named by the source launch hold.
- Require approvals and the hold decision to be current, non-future, and
  strictly later than `E`.
- Materialize only the 12 explicitly supported controls: five incident
  controls, six recovery controls, and one payment-provider state control.
  Unknown, missing, duplicated, or schema-mismatched control identities fail
  closed.
- Allow a valid `A` hold clearance to suppress only
  `ACTIVE_LAUNCH_HOLD`. It cannot suppress any incident, recovery, payment,
  evidence, or infrastructure finding.
- Require a full distinct approval commit only in launch-ready mode.
  Provider-only verification rejects approval inputs and cannot clear a hold.
- Keep the payment-disabled invariant and every Packet 95 source/evidence
  separation control intact.

## Acceptance boundary

Packet 96 is accepted only when:

- the `S -> E -> A` sequence is validated before provider access;
- no approval or launch-hold decision can originate from `S` or `E` during the
  full launch-ready path;
- `A` cannot alter source policy, evidence receipts, the provider plan, or any
  file outside its single exact manifest;
- approval timestamps cannot predate or equal `E` and cannot be future-dated;
- the materializer rejects every missing, unknown, duplicate, or mismatched
  control rather than silently ignoring it;
- the actual readiness evaluator can consume a valid materialized fixture and
  reach ready, while every negative fixture remains blocked;
- a hold clearance affects only the source hold finding;
- provider-only mode remains independent from approval authority;
- the protected workflow validates `A` before installing dependencies or
  exposing provider credentials;
- focused tests, repository gates, independent review, and pull-request CI
  pass; and
- documentation continues to show every real provider, recovery, incident,
  resilience, and deployment blocker.

## Current status

**The local implementation, independent security review, and pull-request CI
are complete, so Packet 96 is accepted for merge into the release candidate.
Review found and closed three bypass/failure paths: a preinstall
validator dependency that would fail on a clean runner, a hold decision not
bound to the source incident, and missing machine attestation that the `E` and
`A` branches are protected. Focused S/E/A coverage passes 133/133, the complete
unit suite passes 538/538, build and both lint gates pass, all four browser E2E
journeys pass, and the production dependency audit reports zero known
vulnerabilities. The combined integration command passes its available checks
but skips 23 PostgreSQL-backed cases because this isolated worktree has no
`TEST_DATABASE_URL`; Gate A run `30794141827` supplied and passed that disposable
PostgreSQL proof.**

**No protected provider evidence or post-evidence approval has been collected.
`npm run launch:readiness -- --require-ready` remains correctly blocked with 21
findings, including the active launch hold. The checked-in operations policies
do not yet declare the complete 12-control materializer contract, and nine
provider adapters remain separate bounded work. A branch's GitHub `protected`
flag proves that some protection applies, not the exact required review and
restriction strength; that governance must be confirmed before using real `E`
or `A`. Launch readiness, incident closure, deployment, and activation remain
blocked.**

The first PR run passed build, lint, security lint, the disposable-PostgreSQL
test aggregate, browser E2E, formatting, and dependency audit, then failed only
because the workflow enforced the intentionally blocked production-readiness
result on a PR whose base was the release-candidate branch. Gate A now continues
to evaluate and display readiness on every PR, but enforces success only on a
PR into `master` or a push to `master`. This permits candidate assembly without
weakening the actual release boundary. Corrected Gate A run `30794141827`
passed all required code, database, browser, formatting, and dependency checks.
