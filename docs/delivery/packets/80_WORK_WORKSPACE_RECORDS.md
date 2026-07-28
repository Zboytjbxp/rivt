# Packet 80 — Work workspace records

## Objective

Finish the accepted-job workspace as a durable two-participant system.
Punch-list items, payment milestones, change orders, and job notes must be
real project records rather than browser-only lists.

## Completion contract

- Checklist, milestone, change-order, and note records belong to the
  canonical accepted-work project and sync through authenticated APIs.
- Both job participants can see shared records and immutable history.
  Private notes remain visible only to their author.
- Both participants can manage checklist items. Only the contractor can
  manage milestones or decide change orders. A tradesperson can request and
  correct their own pending change order but cannot approve it.
- Every create, content edit, state change, archive, and restore is
  versioned. A stale device receives a conflict and reloads the current
  record instead of overwriting it.
- Shared changes create real notifications for the other participant.
  Private notes never create a counterpart notification.
- Every editable field can be corrected. Archive is reversible. Archived
  records remain in authorized history and can be restored.
- Unsubmitted form drafts remain device-local and are described as drafts.
  A draft is removed only after the canonical record saves.
- Older device-only records use an explicit move action. Each local record
  is removed only after its server record succeeds; failed records remain
  retryable on that device.
- Payment milestones are records, not payment processing. “Paid” is
  explicitly described as a manual status.
- Shared records and their immutable history are included in the closeout
  report. Private notes are excluded.

## Authorization and data contract

- Every route requires an authenticated actor and accepted-work participant
  membership. Outsiders receive the existing fail-closed not-found response.
- Private-note reads and writes are author-only.
- Milestone writes are contractor-only.
- Change-order approval and rejection are contractor-only; decided requests
  are locked against tradesperson edits.
- Optimistic concurrency uses a required record version on every update,
  archive, and restore.
- Mutations are idempotent and audit events are append-only.
- Migration `0038_project_workspace_records` is additive and reversible. Its
  rollback removes only the two new workspace tables after the application
  has stopped using them.

## Three issues considered after implementation

1. **Archive without recovery is still data loss in practice.** The initial
   implementation preserved audit history but did not let a user restore the
   record. The packet now includes an authorized, version-safe restore path
   and an Archived records section.
2. **Status-only editing leaves costly mistakes permanent.** Users can now
   correct checklist wording, milestone amount/due terms, change-order
   scope/requester/cost, and note text/visibility without recreating the
   record. Corrections remain in history.
3. **A shared record that changes silently is not a usable collaboration
   tool.** Shared create/edit/state/archive/restore actions notify the other
   job participant. Private notes intentionally do not.
4. **Closeout evidence must include the work that governed the job.** Shared
   workspace records and immutable events are now exported in the closeout
   report, while private notes remain excluded.

## Acceptance

- Contractor and tradesperson reads, writes, private-note isolation,
  decision boundaries, outsider denial, stale-version conflict, archive,
  restore, notification, and append-only history are proven in the project
  integration lifecycle.
- Migration rollback and reapply are proven in the migration lifecycle.
- The 390px Work lifecycle creates, edits, archives, restores, and renders a
  checklist record; it also verifies milestone money to exact cents and
  manual-payment copy.
- Light and dark screenshots show the record panel above a reachable fixed
  navigation bar with no horizontal clipping.
- Build, lint, unit/frontend, full database integration, E2E, focused
  rendered suites, dependency audit, diff integrity, deployment, migration,
  and exact-source production health must pass before this packet is marked
  Verified.

## Local verification evidence

- Production build and application/security lint pass.
- All 104 unit/frontend tests pass.
- All 21 serial database integration tests pass in the aggregate repository
  run.
- Migration `0038_project_workspace_records` rolls back and reapplies in the
  versioned migration lifecycle.
- The project integration lifecycle passes the complete record,
  authorization, notification, conflict, archive/restore, append-only
  history, exact-cent, and closeout-report contract.
- Fail-closed authentication and Jobs/discovery E2E pass.
- Focused Tools, Shop Talk/Trade News, mobile-action, guest-preview, and
  Work-lifecycle rendered suites pass.
- Work evidence is retained outside the repository at
  `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`, including
  light, dark, and Extra Large text screenshots.
- The production dependency audit reports zero known vulnerabilities and
  diff integrity passes.
- Fast-forward merge to `master` and Railway application deployment
  `dc493a93-4df9-4787-bf8a-7892c2ca0898` succeeded.
- Exact-source release `48f49354-cf8b-4dd1-a5c5-29e59b68f155`
  reports feature source
  `ec784d5a35c60294792853e479d3fdb492e8c3d1`.
- Production health reports migration `0038_project_workspace_records`
  ready with PostgreSQL and S3-compatible storage healthy.
- The exact-source production monitor passes all seven anonymous private
  checks; anonymous workspace-record access returns `401`.
- The disposable authenticated production project smoke passes participant
  access, outsider denial, media evidence, confirmed and disputed completion,
  persistence, relogin continuity, and cleanup. Workspace-record mutation
  authorization, conflicts, archive/restore, notifications, and report
  inclusion remain proven by the production-schema integration lifecycle.
