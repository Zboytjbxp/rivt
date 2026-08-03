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

## Source scope

- make the root AI instructions forbid broad provider-variable enumeration;
- give Claude the same repository-level instruction boundary;
- carry the rule into the Codex/Claude collaboration workflow;
- reject committed command-capable automation that constructs the prohibited
  Railway environment/variable enumeration operations;
- add focused regression coverage and wire it into the existing security gate;
- record the recurrence and Michael's exact operational authorization without
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
5. This packet does not claim any credential rotation, provider verification,
   deployment, incident closure, launch approval, or added-cost action.

## Rollback

The source-only policy guard can be reverted as one commit if it blocks a
documented safe command. Reverting it never restores or authorizes an exposed
credential. Provider rollback must always use another fresh credential; it
must never reinstall material exposed in the transcript.

## Verification

- `npm run build`: pass
- `npm run lint`: pass
- `npm run lint:security`: pass, including the operator command policy
- `npm test`: 551 unit/frontend tests and four non-database integration checks
  pass; 23 database integration cases skip because `TEST_DATABASE_URL` is not
  configured in this isolated worktree
- `npm run test:e2e`: four journeys pass
- `npm audit --omit=dev`: zero production dependency vulnerabilities
- `git diff --check`: pass

These are source checks only. They do not replace the pending provider
rotations, owner-controlled proofs, fresh encrypted backup, or isolated
restore.
