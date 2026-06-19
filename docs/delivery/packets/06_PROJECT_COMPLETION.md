# Packet 06 — Project Records and Completion

## Objective

Turn accepted work into a durable private record with safe uploads, completion evidence, confirmation, and exportable closeout.

Requirements: GA-PRJ-001 through GA-PRJ-007.

## Required Work

1. Add projects, entries, media, completion submission/confirmation, and audit schema/API.
2. Bind project access to accepted work participants.
3. Harden upload: authenticated ownership, content/size policy, private object key, safe filename, per-file status, idempotency, and signed access.
4. Upgrade Multer already handled in Packet 00; add content-signature/scanning strategy and representative malformed-file tests.
5. Add photo/file/note entries and immutable activity timeline.
6. Tradesperson submits completion note/evidence/checklist; contractor confirms or disputes.
7. Generate reproducible closeout report from canonical server records.
8. Preserve original evidence; no public share links or advanced annotation in Gate A.

## Acceptance

- User A cannot obtain User B file URL by ID/key tampering.
- Failed/aborted/retried upload remains understandable and does not duplicate.
- Completion requires eligible participant and valid work state.
- Confirmation/dispute records actor/time/reason.
- Closeout report remains reproducible after refresh/relogin.
- Database/storage outage paths preserve truthful state.

## Stop Condition

Do not add CompanyCam-scale advanced media features. Keep Gate A private and dependable.
