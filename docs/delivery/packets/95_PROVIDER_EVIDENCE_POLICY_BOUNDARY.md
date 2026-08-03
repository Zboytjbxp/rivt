# Packet 95 - Provider-evidence policy boundary

## Objective

Remediate Codex Security finding `csf_04e2d7dfe8fbe53f254d821c` while
preserving one authority boundary: pinned source defines launch policy; a
later provider-evidence revision may prove facts but may not define, weaken,
or self-approve that policy.

## Source and production boundary

- Branch: `codex/provider-evidence-policy-boundary`
- Source base: `f5e71b75c713c5a92eb20c8a1098009ca742c163`
- Reviewed diff:
  `29e3d3a5e8773ff66fb5f255190e979431583074..f5e71b75c713c5a92eb20c8a1098009ca742c163`
- Finding: `csf_04e2d7dfe8fbe53f254d821c` (Medium/P2)

This packet is source, test, and documentation work only. It does not
authorize a merge, deployment, provider call, credential access,
production-data operation, added cost, launch-hold clearance, Railway Stage
1, ACH activation, or incident closure.

## Root cause

The evidence overlay allowlisted both incident-routing and recovery-policy
documents. The provider gate then passed the evidence checkout as the single
root from which launch readiness loaded both policy and evidence. A valid
evidence revision could therefore clear the incident hold or weaken recovery
targets and have those rewritten policy values reach the readiness sink.

## Implementation boundary

- Remove incident and recovery policy documents from evidence-overlay
  modification authority.
- Define `policyRoot` as a clean repository top-level pinned to the exact
  deployed `sourceCommit`; it supplies incident, recovery, payment policy,
  and approvals.
- Define `evidenceRoot` as a clean repository top-level pinned to the exact
  `evidenceCommit`; it supplies only allowlisted delivery records and
  source-bound, plan-bound receipts.
- Fail closed on missing, dirty, non-repository, linked, or revision-mismatched
  roots before provider adapters or readiness execute.
- Preserve overlay ancestry, receipt digest/freshness/uniqueness, provider-plan
  verification, and the payment-disabled invariant.
- Record both revisions, both root roles, and root validation state in gate
  output without exposing filesystem paths or credentials.
- Preserve the direct no-overlay, one-tree compatibility path for local
  readiness. The full provider gate never falls back from source policy to
  overlay policy.

## Regression and exploit evidence

Tests were written and run red before implementation:

- an evidence revision clearing `launchHold.active` was accepted;
- an evidence revision weakening RPO/RTO to one year was accepted;
- launch readiness received the evidence root as its policy root; and
- a missing explicit source-policy root did not fail closed.

After implementation:

- incident and recovery rewrites fail with `OVERLAY_PATH_NOT_ALLOWED`;
- a missing policy root fails with `POLICY_ROOT_REQUIRED`;
- dirty and wrong-revision policy roots fail before adapters and readiness;
- an exported-helper regression proves required policy validation cannot report
  success when no evidence overlay is present;
- a split-root readiness test proves an overlay policy copy cannot clear the
  immutable source hold;
- the packaged original PoC exits at its former vulnerability assertion
  because `overlay.ok` is now `false`; and
- all seven payment-weakening variants remain rejected.

## Risk and requirement state

- `R-060` is mitigated in the local candidate. It remains open until reviewed
  disposable-PostgreSQL pull-request CI, merge, and exact deployed-source
  evidence complete.
- `R-051`, `R-052`, `R-055`, and `GA-OPS-009` remain open/blocking.
- `GA-OPS-004` remains Blocker.
- `GA-OPS-005`, `GA-OPS-007`, and `GA-OPS-008` remain Partial.
- This packet creates no recovery, provider, deployment, resilience, or
  production-activation evidence.

## Acceptance boundary

Packet 95 is accepted only when:

- overlays cannot modify incident or recovery policy semantics;
- launch policy is loaded only from pinned source `S` and allowed receipts
  only from evidence root `E`;
- original policy-rewrite variants fail closed;
- receipt-only positive cases still pass;
- payment weakening remains rejected;
- root-role ambiguity fails before provider credentials are used or provider
  calls occur;
- output names both revisions and root roles;
- no launch-ready caller uses one generic root for policy and evidence;
- focused security fix revalidation and independent review pass;
- targeted and repository gates pass; and
- build state, traceability, and risks preserve the active launch hold and all
  existing blockers.

## Verification evidence

- Provider overlay/runner suites: 66/66 pass.
- Original PoC: no longer reproduces; it exits nonzero because the former
  `overlay.ok === true` assertion observes `false`.
- Independent change-aware security re-review: pass with no remaining bypass,
  regression, or API-compatibility blocker.
- `npm run build`: pass.
- `npm run lint` and `npm run lint:security`: pass.
- `npm run test:unit`: pass, 486/486.
- `npm run test`: exits zero; 486/486 unit tests and 4/4
  database-independent integration checks pass. The 23 PostgreSQL suites are
  explicitly skipped because this isolated worktree has no
  `TEST_DATABASE_URL`; they remain mandatory in disposable-PostgreSQL PR CI.
- `npm run test:e2e`: pass, all four journeys.
- `npm audit --omit=dev`: pass, zero known vulnerabilities.
- `git diff --check`: pass, with only checkout line-ending warnings.

`npm run launch:readiness -- --require-ready` is expected to remain blocked by
`ACTIVE_LAUNCH_HOLD`; that fail-closed result is safety evidence, not launch
readiness.

## Status

**Local implementation and fix verification complete; disposable-PostgreSQL
pull-request CI, merge review, and exact deployed-source proof remain pending.
Not merged or deployed, with no provider, cost, or production-data action
authorized by this packet.**
