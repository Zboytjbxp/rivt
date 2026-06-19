# Packet 07 — Reviews, Safety, and Pilot Operations

## Objective

Complete eligible two-sided reputation and the minimum internal controls needed to support invited users safely.

Requirements: GA-REV-001 through GA-REV-003; GA-SAFE-001 through GA-SAFE-004; GA-ADM-001 through GA-ADM-003.

## Required Work

1. Add review, response/dispute, report, block, restriction, support case, and immutable audit schema/API.
2. Enforce one review per completed participant/job and approved publication/dispute policy.
3. Display count/context and eliminate seeded ratings/review counts.
4. Persist consent version/time/actor and contextual posting/acceptance acknowledgment.
5. Implement block/report across discovery, job, offer, message, and profile paths.
6. Add Unsafe condition / Stop work record without assigning fault.
7. Build separate admin/support authorization with least privilege, reason codes, and audit—not a normal client view.
8. Remove/rename overclaims such as boolean “verified” and “OSHA cert”; use accurate evidence states.

## Acceptance

- Ineligible/duplicate review rejected.
- Dispute/response history cannot be silently edited.
- Block applies across alternate routes.
- Restricted user cannot mutate but can access support/appeal as approved.
- Stop-work preserves evidence and routes safely.
- Normal user cannot access admin API/UI.
- Every admin mutation includes actor, reason, subject, and time.

## Stop Condition

Do not build public Shop Talk moderation or automated verification providers.
