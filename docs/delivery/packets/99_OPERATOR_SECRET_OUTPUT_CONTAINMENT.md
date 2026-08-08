# Packet 99 - Operator secret-output containment

## Goal

Prevent a repeat of the 2026-08-03 production-configuration output incident,
record its exact operational boundary without retaining credential values, and
keep deployment and launch fail closed while every newly exposed credential is
rotated and reverified.

## Trigger

During a read-only Railway deployment-path audit, a broad production
configuration command returned rendered credential values into a restricted
automation transcript. The command was stopped and its output is not copied
into source, documentation, chat, tests, or evidence. No misuse indicator is
known, but transcript confidentiality is not accepted as a security boundary.

## Current release boundary - 2026-08-04

- Production and `origin/master` remain at
  `7ee9b30a77bbed2cb1ca4aeda330066884e3d59b` on Node 20. PR #22 is
  source-only backup tooling, not recurrence or restore proof.
- Release candidate `codex/final-release-candidate-20260804` is at
  `aa5b5361374bce0ae51d71cbe4b6d8031a605c61` in draft PR #25, containing merge
  `6726bbbad92e018cbd9992bebfc556c5f7dd7e60` and scheduler-source merge
  `b17043a6c2f7b708675f3a155ac2dbf09dcd8e86`. It pins Node 22 and is not
  deployed.
- Backup recurrence remains pending. No scheduler service, independent backup
  provider, recurring artifact, or isolated current-artifact restore is
  activated or proved. ACH is disabled, `ACTIVE_LAUNCH_HOLD` is active,
  `GA-OPS-004` and `GA-OPS-009` remain blockers. Exact-candidate local
  engineering gates pass, launch readiness remains blocked with exactly 21
  findings, and draft PR #25 Gate A Safety run `30955179943` supplies the
  database-backed proof: 14/14 pretest safety checks, 603/603 unit tests, 28/28
  disposable-PostgreSQL integration tests, and 4/4 browser E2E journeys pass.
  The final exit 1 is the intended launch-readiness refusal for the 21 open
  operational blockers.

## Source scope

- make the root AI instructions forbid broad provider-variable enumeration;
- give Claude the same repository-level instruction boundary;
- carry the rule into the Codex/Claude collaboration workflow;
- reject committed command-capable automation that constructs the prohibited
  Railway environment/variable enumeration operations;
- add focused regression coverage and wire it into the existing security gate;
- record the recurrence and the founder role's exact operational authorization without
  recording any credential value.

## Operational containment

- The existing `ACTIVE_LAUNCH_HOLD` remains active.
- Feature merges, release-candidate deployment, Railway Stage 1, new ACH
  activity, and public launch remain paused.
- The affected classes are PostgreSQL, Stripe API, Stripe billing and Connect
  webhook signing, Resend, Google OAuth, authentication metadata and rate-limit
  peppers, Web Push VAPID, and backup encryption.
- S3 application credentials were provider references rather than revealed
  values in this recurrence; no new S3 rotation is claimed or authorized by
  this packet.
- Provider changes occur one credential class at a time under the separately
  recorded owner approval, with a `$2` incremental-cost ceiling and up to 30
  minutes of cumulative interruption.

## Acceptance

1. No tracked agent instruction or command-capable automation authorizes the
   prohibited Railway enumeration path.
2. The static command-policy regression fails on both prohibited command
   families and passes on the sanitized provider-snapshot path.
3. `npm run lint:security` and the focused unit test pass without provider
   access.
4. No credential value, provider secret, database URL, private key, session,
   or customer data is written to the repository or test output.
5. The source-control acceptance boundary does not by itself claim any
   credential rotation, provider verification, deployment, incident closure,
   launch approval, or added-cost action. Later operational actions require
   separate explicit owner authorization and provider evidence in the incident
   record and deployment ledger.

## Operational closeout status

The separately authorized one-class-at-a-time recurrence rotations are tracked
in `docs/operations/incidents/2026-07-29-production-credential-exposure.md` and
`docs/delivery/DEPLOYMENT_LEDGER.md`. PostgreSQL, Stripe API and both webhook
classes, Resend, Google OAuth, both independent pepper classes, and Web Push
VAPID have current recurrence evidence. Backup-encryption rotation remains
pending. The broader incident and `ACTIVE_LAUNCH_HOLD` remain open; ACH, the
feature release, Railway Stage 1, and public launch remain paused.

## Rollback

The source-only policy guard can be reverted as one commit if it blocks a
documented safe command. Reverting it never restores or authorizes an exposed
credential. Provider rollback must always use another fresh credential; it
must never reinstall material exposed in the transcript.

## Verification

- Historical Packet 99 checks are preserved in the release evidence history.
- Exact local verification for candidate
  `aa5b5361374bce0ae51d71cbe4b6d8031a605c61` passes production build;
  application, security, and public-documentation lint; 617/617 unit and
  precheck tests; all four browser E2E journeys; all four required UI smokes;
  the production dependency audit with zero known vulnerabilities; and diff
  integrity. The integration aggregate reports 27 cases, with four passing and
  23 skipped because local `TEST_DATABASE_URL` is absent. Launch readiness is
  blocked with exactly 21 findings. PR #25 Gate A Safety run `30955179943`
  adds the database-backed final-candidate result: 14/14 pretest safety checks,
  603/603 unit tests, 28/28 disposable-PostgreSQL integration tests, and 4/4
  browser E2E journeys pass. Its final exit 1 is the required launch-readiness
  refusal for those 21 operational blockers.

These are source checks only. They do not replace provider evidence or
owner-controlled proofs. The remaining recurrence boundary is a fresh
encrypted backup, isolated restore proof, and safe retirement of the exposed
backup-encryption predecessor under separate explicit approval.

## Final-diff security remediation addendum - 2026-08-08

- Completed diff scan `ad843b09-ef72-4a08-b2ab-d792bc914821` found two
  low-severity issues in the un-deployed candidate: stale invoice delivery
  proof after a top-level document edit, and possible rendering of an
  ownerless legacy Receivables row in a reused browser profile.
- Remediation commit `6b2f7d8a64b17899f87c8d409353689738fdf294`
  binds delivery proof to the complete canonical invoice and makes
  authenticated Receivables server-only, account-bound, and fail-closed.
  Identical lost-response autosaves and current-account server history remain
  supported. Ownerless legacy rows are quarantined without deletion.
- Candidate commit `e06a6218e6c9047569e3140d24a7f25a9c710de8`
  also updates transitive `nanoid` from `3.3.16` to `3.3.18` after the
  production dependency gate identified advisory `GHSA-2v37-7h3g-55p8`.
- Local source, browser, and dependency gates pass. Although the local
  integration aggregate skips 23 PostgreSQL cases because no local disposable
  database is available, draft PR #25 Gate A Safety run `31269498552` passed
  all 28 disposable-PostgreSQL integration tests, including the new invoice
  route regression, alongside 14/14 prechecks, 604/604 unit tests, and all
  four browser journeys. The run stopped only at the deliberate launch-
  readiness enforcement; this remediation has no remaining engineering proof
  gap.
- This addendum does not change the active packet, clear the incident or
  launch hold, enable ACH, authorize a payment, call a provider, deploy the
  feature release, delete legacy browser data, or add cost.
