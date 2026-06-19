# Packet 05 — Messaging and In-App Notifications

## Objective

Create reliable job-linked communication and truthful in-app notification state for authorized participants.

Requirements: GA-MSG-001 through GA-MSG-006; GA-UX-003.

## Required Work

1. Add conversations, participants, messages, receipts, notifications, and mute/block policy.
2. Create/open job conversation only for approved relationship states.
3. Persist one message with server sender/time/idempotency.
4. Implement unread/read state per user and notification center entries from domain events.
5. Move Messages to top-bar entry and restore Shop Talk as the approved primary concept, while hiding deferred Shop Talk if Gate A flag is off.
6. Add message attachment metadata path integrated with Packet 06 authorization boundary.
7. Add search only if it can be completed without delaying core reliability; otherwise defer explicitly.
8. Do not wire production SMS in this packet unless founder decision and compliance/provider readiness are approved.

## Acceptance

- Unauthorized/nonparticipant cannot read or send.
- Message retry stores one message.
- Unread survives refresh/relogin and is recipient-specific.
- Block/mute/report behavior is server-enforced.
- Job context is visible and private address is not leaked to unauthorized notifications.
- Offline/provider failure never shows false sent/delivered state.

## Stop Condition

Do not build project albums or external channels. Hand off participant/media authorization contract.
