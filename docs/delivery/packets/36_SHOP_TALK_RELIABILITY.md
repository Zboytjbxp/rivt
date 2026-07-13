# Packet 36 - Shop Talk Reliability and Exact Destinations

Status: local verification complete; deployment pending

## Objective

Make Shop Talk notifications and reputation durable and exact: an older or
filtered post must open its own thread, an authenticated browser must restore
an existing device-push subscription after sign-in, API failures must keep
their useful server explanation, and the daily-log Home pulse must share one
contract with the writer.

## Delivered

- Authenticated `GET /api/v1/shop-talk/posts/:postId` loads one exact,
  audience-authorized post without weakening the existing community audience
  rules. The client fetches and hydrates an initial notification target that is
  outside the newest feed page or current filter.
- Existing browser Push subscriptions re-register on an authenticated app boot
  without prompting for permission or requiring a Settings visit after login.
- Shop Talk client calls now surface typed timeout, rate-limit, authorization,
  and server errors instead of converting every failure to a generic null.
- Daily Log and Home use `DAILY_LOG_PREFIX` from one shared module rather than
  matching independent copy strings.
- Session bootstrap treats `/api/v1/me` as the only authentication gate;
  optional storage/provider hydration no longer turns a healthy session into a
  retry screen.
- Earned Shop Talk reputation is calculated server-side from the author IDs on
  posts and answers. Client badges no longer depend on display-name matching or
  browser-local reputation state.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:unit` (53/53)
- `npm run test:e2e`
- `npm run test:ui:mobile-actions`
- `node --env-file-if-exists=.env --test --test-concurrency=1 test/shop-talk-posts.integration.test.js`
- `npm audit --omit=dev` (zero vulnerabilities)
- `git diff --check`

The focused PostgreSQL integration proves exact-post retrieval, a
contractor-only audience denial for an ineligible actor, and author-earned
reaction reputation. `npm run test:integration` was also attempted with the
configured test database but exceeded the local 15-minute wrapper limit
without emitting a failing assertion; this packet makes no aggregate-pass
claim until it is rerun in a longer-lived runner.

## Boundary

This packet does not add scheduled digests, first-answer transactional email,
or background daily-log reminders. It preserves existing community audience,
reaction, moderation, authentication, and Web Push authorization boundaries.
