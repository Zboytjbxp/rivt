# Packet 98 - Protected incident-rehearsal workflow

## Objective

Add the protected, provider-verifiable workflow required to record a real
human incident rehearsal without turning healthy automated checks into fake
proof that the human exercise occurred.

## Source and production boundary

- Branch: `codex/incident-rehearsal-workflow`
- Candidate pull request: `#19`
- Candidate base: `c8d1596d0a1dd371f3951fdf484cac8704391f38`
- Release-candidate merge: `f5b42b68fd133f2880cd0e8792e98f2742bed8d3`
- Provider-configuration follow-up: `codex/packet98-provider-configuration`
- Workflow: `.github/workflows/incident-rehearsal.yml`
- Protected environment required before use: `production-rehearsal`

The source implementation packet did not authorize or perform external
configuration. Michael separately approved the bounded, no-cost environment
and SSH-identity configuration recorded below. Neither approval authorizes a
workflow dispatch, production-data action, deployment, migration, backup,
restore, incident closure, launch-hold clearance, ACH activation, or public
launch.

## Root problem

Packet 97 implemented a read-only GitHub adapter that can verify one exact
workflow run. The dedicated workflow did not yet exist. A health check alone
would also be insufficient and misleading: the complete rehearsal requires a
controlled failure, human alert receipt, assigned incident roles, a recovery
observation, a kill-switch decision, and a decision log.

The existing live Gate A script also used `migrationStatus()`, which can create
the migration ledger before entering its later read-only transaction. That
behavior was inappropriate for a workflow represented as non-mutating.

## Implementation boundary

- Provide one manual-only job named `rehearsal` on protected default
  `master`, bound to the exact source commit production reports.
- Require explicit human attestations for the controlled failure, real alert
  receipt, role assignment, recovery, and recorded kill-switch decision.
- Require one bounded, non-secret decision-log reference.
- Expose exactly the four critical step names required by the Packet 97
  adapter.
- Check public health and the external synthetic monitor, run the live Gate A
  smoke inside the existing Railway service, and recheck the public source
  commit afterward.
- Forward the exact expected source and resource identities into a remote
  fail-closed guard. Before Node or database access, the selected runtime must
  independently report the expected commit, project, environment, service,
  literal `production` environment, and fixed `https://rivt.pro` origin. A
  stale, racing, or wrongly selected active instance cannot be mislabeled as
  the reviewed source.
- Replace the live smoke's ledger-creating migration status call with the
  read-only `assertMigrationsCurrent()` check.

## Security boundary

- GitHub permissions are limited to `contents: read`.
- Checkout and Node actions are pinned to exact commits, and checkout does not
  persist credentials.
- The Railway CLI is downloaded from one exact official release URL and its
  archive must match the pinned SHA-256 digest before extraction.
- The dedicated Railway token and SSH private key are scoped only to the
  remote-smoke step. The private key is materialized with mode `0600`, checked
  as a usable non-passphrase identity, passed explicitly with
  `--identity-file`, and deleted on exit.
- The Railway relay is fixed to `ssh.railway.com` by the pinned CLI, and its
  ED25519 host key is pinned in the workflow as
  `SHA256:+S1xg92FrnHz6pY3bpkmh1OGtWQGNANXilPzlxA7B1g`; a changed relay key
  fails closed until separately verified and reviewed.
- Railway project, environment, and service identifiers must be UUIDs and
  must match the selected remote runtime before application code executes.
- Raw production output is captured in private runner-temporary files,
  withheld from logs, deleted on exit, and never uploaded as an artifact.
- The workflow contains no deploy, migration, backup, restore, provider
  configuration, or payment command.

## Acceptance boundary

Packet 98 is accepted only when:

- the workflow identity, trigger, job, exact critical steps, branch/source
  binding, attestations, credentials, dependency pins, and non-mutation
  properties are locked by tests;
- focused tests, repository gates, independent security review, and pull-
  request CI pass;
- the full human rehearsal remains required and is not replaced by automated
  health checks; and
- documentation does not claim that the workflow has run, that a provider
  receipt exists, or that launch readiness improved without evidence.

## Activation boundary

The workflow cannot produce trusted evidence before it exists on protected
`master` and production serves the same exact source. Before an authorized
dispatch, the owner must independently confirm the exact source and Railway
resource variables plus a narrowly controlled Railway token.

The separately approved 2026-08-03 configuration completed only the protected
environment and SSH-identity portion of that boundary:

- GitHub environment `production-rehearsal` requires reviewer `Zboytjbxp` and
  has one custom deployment policy for branch `master`.
- `prevent_self_review` is `false` because `Zboytjbxp` is the only repository
  administrator. The normal deployment path enters this single-owner approval
  gate, but GitHub currently reports `can_admins_bypass=true`; the gate is
  neither independent nor unbypassable.
- Railway workspace `zboytjbxp's Projects` contains dedicated key
  `rivt-production-rehearsal-20260803`, type `ssh-ed25519`, fingerprint
  `SHA256:oOWKlKo88YhJsRDhUMJNNK6+wD2aGdYgRATtyS6+XVE`.
- The setup supplied the newly generated private key to protected environment
  secret `RIVT_REHEARSAL_RAILWAY_SSH_PRIVATE_KEY`, and GitHub lists that secret
  name. GitHub does not expose its stored value, so post-upload content,
  key-pair matching, and exclusivity were not independently verified. The known
  temporary local key files were deleted.
- The protected environment currently has no rehearsal Railway token and no
  exact source/project/environment/service variables. The workflow has not
  run.

Railway documents that a workspace SSH key can access every service in that
workspace, so this credential remains high impact and must be rotated or
removed when the rehearsal path is retired. This configuration observation is
not a hand-authored provider receipt, protected evidence revision `E`, or
proof that the human rehearsal occurred.

The current master gate evaluates source-only readiness and cannot consume the
later protected evidence revision `E` and approval revision `A`. Resolve that
release-boundary sequencing in a separate reviewed packet without suppressing
readiness, fabricating a receipt, or weakening branch protection.

## Verification recorded

- Focused provider/workflow and migration-safety tests: 41 passed, 0 failed.
- Build, lint, security lint, 551 unit/frontend tests, the aggregate test
  command, all four E2E journeys, production-dependency audit, and diff-
  integrity checks: passed locally.
- The aggregate integration phase passed four available cases and skipped 23
  PostgreSQL-backed cases because no isolated `TEST_DATABASE_URL` was present.
  PR #19 Gate A run `30821741994` passed on exact implementation source
  `d700980fb2dc63f05b1eded05f4fa801d13112b4`, including the full disposable-
  PostgreSQL integration suite and all browser journeys.
- Fresh sealed working-tree security diff review: complete coverage, zero
  reportable findings. It independently closes the prior Railway CLI wrong-
  instance/source-binding concern because the corrected remote guard fails
  before Node/database access on any runtime identity mismatch.
- Incident readiness remains blocked by eight missing operational evidence or
  approval records. Launch readiness remains blocked with 21 findings led by
  `ACTIVE_LAUNCH_HOLD`.
- PR #19 Gate A run `30821741994` passed all engineering steps. The separate
  launch-readiness enforcement remained correctly inapplicable because this
  packet targets the release-candidate branch, not `master`.
- PR #19 merged into the release candidate as
  `f5b42b68fd133f2880cd0e8792e98f2742bed8d3`. Release-candidate run
  `30823461905` passed every engineering check and stopped only at the
  intentional launch-readiness enforcement.
- Read-only provider verification at `2026-08-03T14:53:39Z` confirmed the
  environment reviewer, `master` policy, protected secret name, Railway key
  name/type/fingerprint, removal of local key material, and zero matching
  workflow runs. It did not access the private-key value or production data.
- The documentation-only follow-up passes production build, application and
  security lint, 551/551 unit/frontend tests, all four database-independent
  integration checks, all four browser E2E journeys, diff integrity, and the
  production dependency audit with zero known vulnerabilities. Twenty-three
  PostgreSQL-backed cases skip locally without `TEST_DATABASE_URL`; unchanged
  release-candidate code passed them in Gate A run `30823461905`.
- No workflow run, protected evidence revision `E`, later approval revision
  `A`, incident closure, hold clearance, deployment, or launch is claimed.
