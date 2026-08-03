# Packet 97 - Provider-control contract hardening

## Objective

Finish the no-cost source boundary that must exist before RIVT can collect
fresh launch evidence. Bind every provider-evidence claim to a reviewed source
control, add an externally verifiable incident-rehearsal adapter, and replace
ambiguous adapter gaps with explicit fail-closed blockers.

## Source and production boundary

- Branch: `codex/provider-evidence-adapters`
- Candidate base: `7655bff50a991bd82b2dfd7cf44676aac36e9a27`
- Authority sequence remains `S -> E -> A`.
- This packet performs source, test, and documentation work only.

It does not authorize or perform a provider call, credential use, production
data access, workflow dispatch, rehearsal, backup, restore, provider-resource
creation, deployment, launch-hold clearance, incident closure, ACH activation,
public launch, or added cost.

## Root causes

Packet 96 made the `S -> E -> A` lifecycle structurally reachable, but three
source-boundary gaps remained:

1. The checked-in policies did not declare all 12 stable evidence controls.
2. Source controls named only a control ID and receipt type. The protected plan
   could therefore choose the adapter/provider within the compiled registry
   instead of being pinned by reviewed source policy.
3. Nine compiled adapters returned the same generic
   `ADAPTER_NOT_IMPLEMENTED` result, concealing materially different blockers.

The architecture review also found that current Sentry rule/event APIs can
prove a trigger but not downstream delivery, and that RIVT has not selected or
approved an independent backup provider, account, region, retention mode, or
recurring cost. Those facts must remain blockers rather than being converted
into optimistic evidence.

## Implementation boundary

- Declare the exact five incident, six recovery, and one payment control in
  source policy.
- Pin each control to one compiled adapter ID and one machine provider ID.
- Reject plan claims whose control, type, adapter, or provider differs from
  source policy.
- Keep provider observations and post-evidence approvals out of source `S`.
- Represent unproved recovery controls as pending evidence or provider
  selection, while preserving the approved RPO/RTO/cadence intent.
- Derive time-varying restore due dates from fresh restore evidence rather than
  freezing them into immutable source policy.
- Verify a fresh incident rehearsal through a read-only GitHub Actions adapter
  bound to the protected branch, exact source commit, dedicated workflow/run,
  successful critical steps, and provider timestamp.
- Keep paging and private-route delivery unsupported until the downstream
  delivery is observable. A configured alert rule or sent-email record alone
  is not human receipt.
- Keep recovery adapters unsupported until the selected provider exposes the
  required account/resource, immutable-retention, completion, delivery, and
  restore proof seams.

## Acceptance boundary

Packet 97 is accepted only when:

- the checked-in source policies expose exactly 12 unique, adapter/provider-
  pinned controls;
- missing, unknown, duplicate, or substituted adapters/providers fail closed;
- the GitHub rehearsal adapter accepts only the exact protected-branch,
  exact-source, successful workflow proof and rejects stale, failed, partial,
  or mismatched runs;
- unobservable delivery and unselected recovery providers remain explicit
  blockers;
- no source policy contains provider observations or post-evidence approvals;
- focused tests, all repository gates, independent security review, and pull-
  request CI pass; and
- documentation does not claim deployment, provider readiness, recovery
  readiness, incident closure, hold clearance, or launch.

## Remaining owner decision

Independent recovery still requires a separate explained approval naming the
provider, account, US region, retention/deletion mode, access and key-custody
roles, expected one-time and monthly cost ceilings, rollback, and isolated
restore drill. Packet 91 recommends AWS S3 Object Lock while an older runbook
still names Backblaze B2. Packet 97 resolves the documentation contradiction
but does not select or activate either provider on Michael's behalf.

## Verification recorded

- Focused provider/materializer tests: 41 passed, 0 failed.
- Build, lint, repository test aggregate, four-journey E2E, production-
  dependency audit, and diff-integrity checks: passed.
- Independent working-tree security review: no reportable candidate. One
  non-reportable extreme-date crash edge was hardened and covered by a new
  fail-closed regression.
- Launch readiness: still blocked with 21 findings led by
  `ACTIVE_LAUNCH_HOLD`.
- Pull-request CI: required before release-candidate merge.
