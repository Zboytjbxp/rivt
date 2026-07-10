# Packet 09 - Gate B Web Push

## Objective

Deliver consent-based browser push notifications for existing server-owned RIVT notifications without expanding into SMS, marketing blasts, or unreviewed job-alert fan-out.

## Scope

1. Store browser push subscriptions in PostgreSQL and bind each subscription to the authenticated account and login session.
2. Queue push deliveries transactionally when an in-app notification is created.
3. Deliver through a bounded, retrying outbox worker and prune expired browser subscriptions.
4. Honor existing notification-category preferences and never prompt for browser permission without an explicit user action.
5. Deep-link notification clicks through the existing same-origin exact-destination routes.
6. Expose truthful Settings states for unsupported, blocked, unavailable, enabled, test, and disabled delivery.
7. Remove subscriptions on logout or session revocation so a signed-out device cannot keep receiving account alerts.

## Explicit Non-Goals

- General-alert SMS or Twilio expansion.
- Matching-job broadcast fan-out.
- Email digests or first-answer email.
- Native iOS/APNs or Android/FCM applications.
- Automatic notification permission prompts.

## Acceptance

- VAPID private material stays server-only; the authenticated config endpoint returns only the public key and non-secret status.
- Registration is authenticated, validated, HTTPS-only, idempotent, and session-bound.
- One notification/subscription pair creates at most one outbox row.
- Failed deliveries retry with a cap; HTTP 404/410 removes the dead subscription.
- Revoking a login session removes its subscription and excludes it from future fan-out.
- Settings provides explicit opt-in, test, and turn-off controls with truthful status/error feedback.
- Build, lint, security lint, unit, PostgreSQL integration, E2E, mobile UI smoke, dependency audit, and diff checks pass.
- Production health reports Web Push configured without exposing keys.
- A physical installed RIVT PWA receives a test alert while closed and opens the notification center when tapped.

## Rollback

- Remove VAPID variables to stop new queueing and worker delivery without affecting in-app notifications.
- Roll back application source before rolling back migrations.
- Migration rollback order is 0024 then 0023; this deletes push subscriptions/outbox only and does not alter in-app notifications.

## Stop Condition

Stop after test delivery is proven on one supported physical device. Matching-job broadcasts, digests, and SMS require separate reviewed Gate B slices.

