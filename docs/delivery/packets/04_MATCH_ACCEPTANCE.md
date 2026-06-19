# Packet 04 — Applications, Offers, and Acceptance

## Objective

Complete the two-sided marketplace handshake from application/invite through mutually accepted Active work.

Requirements: GA-MAT-001 through GA-MAT-008.

## Required Work

1. Add application, offer, participant, and authoritative status-transition schema/API.
2. Tradesperson application draft, submit, view state, and withdraw.
3. Contractor authorized applicant list/profile preview and decline/shortlist as approved.
4. Contractor sends an offer to one real person with start/scope context.
5. Tradesperson accepts or declines; acceptance creates participants and Active work exactly once.
6. Reveal exact address only at the approved accepted state.
7. Add cancellation/reschedule reason/history baseline.
8. Enforce blocked, suspended, closed, duplicate, stale, and wrong-recipient cases.

## Acceptance

- Two-account application/offer journey passes.
- Applicant cannot view another applicant's private data.
- Wrong user cannot accept offer.
- Double acceptance creates one Active relationship.
- Address release is tested before and after acceptance.
- Status timeline records actor, timestamp, and reason.

## Stop Condition

Do not add messaging. Hand off stable participant authorization for Packet 05.
