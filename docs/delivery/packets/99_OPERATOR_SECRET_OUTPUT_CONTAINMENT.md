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

## Historical release-boundary checkpoint - 2026-08-04

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
classes, Resend, Google OAuth, both independent pepper classes, Web Push
VAPID, and the bounded backup-encryption key rotation have current credential-
rotation evidence. Recurring independent recovery remains unproved. The
broader incident and `ACTIVE_LAUNCH_HOLD` remain open; ACH, the feature
release, Railway Stage 1, and public launch remain paused.

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
owner-controlled proofs. The predecessor backup-encryption key was retired
only after active- and predecessor-key restore proofs passed. The remaining
recovery boundary is an independently retained, current database-and-object
set plus an isolated complete-set restore under separate explicit approval.

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

## Independent-backup provider-foundation addendum - 2026-08-12

- A separately administered AWS account and one empty dedicated S3 bucket now
  exist in the approved US region. Root passkey MFA is enabled, root has zero
  access keys, and a near-zero spend alert is configured at $0.01; it is an
  alert, not a hard spending cap.
- The empty bucket has all four bucket-level Block Public Access settings,
  bucket-owner-enforced ownership with ACLs disabled, Versioning, SSE-S3, and
  Object Lock enabled with default 30-day COMPLIANCE retention. No object has
  yet received or validated that retention. A deny-only bucket policy was
  saved and is configured to deny non-TLS traffic and non-conditional writes
  on the reserved backup prefix. The AWS console reported a successful save
  and displayed both deny statements, but live negative-request enforcement
  remains unproved. That policy grants no identity access.
- The undeployed writer correction uses explicit SHA-256 integrity checking,
  requires a provider VersionId and matching checksum, and reads only that
  exact version's provider-applied retention. Its policy fixture permits only
  `GetBucketVersioning`, `GetBucketObjectLockConfiguration`, `PutObject`, and
  `GetObjectRetention`; static regressions reject list, content-read, delete,
  retention-administration, and bucket-mutation permissions.
- No IAM runtime identity or key, backup object, lifecycle rule, scheduler,
  AWS monitor read credential/configuration, restore target, deployment,
  payment, customer communication, or launch action exists from this addendum.
  The pre-existing protected GitHub monitor environment holds the backup
  encryption secret but cannot inspect AWS independently. The no-deletion
  boundary keeps recurrence disabled, and PostgreSQL-only source coverage
  keeps `R-052` and `GA-OPS-004` open until object-byte backup and exact
  complete-set restore are proved.

## Independent-backup source storage-growth-containment addendum - 2026-08-13

- Backup creation now requires one canonical UTC calendar-month write window
  and rejects an expired, future, malformed, or non-calendar-month window before
  opening either an AWS or PostgreSQL client. It rechecks the window
  immediately before the upload attempt and binds the approval to one exact
  normalized endpoint/region/bucket/prefix/addressing-mode identity. The
  irreversible upload helper itself rejects any key other than the current
  deterministic slot.
- The writer uses one deterministic key per 12-hour UTC slot. Combined with
  `If-None-Match: *`, retries, redeployments, or duplicate scheduler invocations
  cannot create a second RIVT object in the same slot; provider `412` responses
  become a sanitized `BACKUP_CADENCE_LIMIT_REACHED` receipt.
- New encrypted PostgreSQL artifacts have a non-configurable 16 MiB write cap.
  The maximum source-authorized storage growth in a 31-day proving window is
  therefore 62 objects / 992 MiB. Existing named restores retain their separate 512 MiB
  compatibility read limit.
- This is source-only containment, not a provider spending cap. It cannot stop
  direct use of a stolen AWS credential, and renewed monthly windows would
  accumulate storage forever while lifecycle deletion is forbidden. Duplicate
  attempts may still incur S3 request and Railway/database compute cost, and
  exact provider-time enforcement remains unproved until live IAM conformance.
  Runtime
  identity creation, a first write, scheduler activation, monthly renewal,
  lifecycle expiry, deployment, and any added cost remain outside this
  addendum and require their own approval/evidence.
- Local verification passes production build; application and
  public-document lint; 14/14 pretest checks; 641/641 unit/frontend tests;
  four database-independent integration checks; all four browser E2E
  journeys; diff integrity; and the production dependency audit with zero
  known vulnerabilities. Twenty-three PostgreSQL integration suites are
  explicitly skipped locally without `TEST_DATABASE_URL`. Gate A Safety run
  `31668298490` passed against source revision
  `4d3831d8afba424e8f8f536d3a4f9c0c59631aa0`, including 28/28
  disposable-PostgreSQL integration tests and all four browser journeys. The
  run's launch-readiness report remains blocked on the recorded operational
  evidence; no launch-ready conclusion is inferred.

## Backup-receipt privacy forward-port - 2026-08-13

- The current unmerged forward-port replaces exact backup object identifiers
  in typed repository receipts with a deterministic SHA-256 artifact identity
  and rejects non-positive, fractional, or unsafe table and row counts.
- New typed receipts keep exact identifiers only in encrypted or otherwise
  access-restricted operator evidence. Existing historical repository records
  are not retroactively erased; this change is prospective and does not claim
  that historical identifiers never appeared in repository evidence.
- Runtime restore results now preserve the exact `tableCount`, `rowCount`, and
  `verificationDurationMs` fields consumed by the strict receipt materializer,
  and the sanitizer-to-materializer seam is covered by the focused tests.
- Focused backup freshness, readiness, materializer, and restore verification
  passes 152/152. Local build, application/security/public-document lint,
  645/645 unit/frontend tests, four database-independent integration checks,
  all four browser E2E journeys, diff integrity, and the production dependency
  audit pass. Twenty-three PostgreSQL suites skip locally because
  `TEST_DATABASE_URL` is absent. Gate A run `31699823161` passed against exact
  source revision `0756fa455d1da3a665a484528c9178331838c65d`; later
  documentation-only descendants do not reinterpret that run as exact-head
  proof. The source is unmerged, undeployed, and does not create an AWS
  identity, object, scheduler, restore target, payment, customer communication,
  or added cost.
