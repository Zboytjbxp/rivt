# Packet 41 - Camera Home Album Previews

## Objective

Make the independent Camera home useful at a glance without weakening the
explicit work-context model. A person should see their private albums and
their most recent captures before opening a gallery, while an accepted RIVT
job or standalone project remains scoped to that exact work.

## Scope

- Return the latest stored upload as an authenticated cover photo with each
  account-owned album list row.
- Render private albums as compact photo cards on the independent Camera home.
- Show an actual latest-capture preview when Camera is scoped to a private
  album, and keep the lower Destination, Feed, and Capture dock unchanged.
- Keep accepted RIVT work and standalone projects isolated from private album
  discovery so the current context never becomes ambiguous.
- Normalize Camera with the other primary navigation items instead of making
  the global Camera destination visually larger than its peers.

## Non-goals

- No new storage provider, retention policy, upload flow, or authorization
  model.
- No client-side placeholder photos or fabricated capture counts.
- No change to project, album, or upload ownership.

## Acceptance criteria

1. `GET /api/v1/albums` returns the account's latest stored upload as a
   nullable cover photo for each album without exposing another account's
   media.
2. Independent Camera shows each private album with its real cover where one
   exists, a truthful count, and an exact tap target to that album.
3. Camera scoped to accepted RIVT work or a standalone project does not mix in
   private-album cards; its capture and feed actions stay scoped.
4. Camera's lower one-handed dock remains the primary capture control zone.
5. Mobile smoke verifies the default private album is present and Camera does
   not use the retired elevated navigation treatment.

## Verification evidence

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run test:ui:tools`
- `npm run test:ui:mobile-actions`
- `npm audit --omit=dev`
- `git diff --check`
- Production health served exact source
  `0849eaacc0b70302bf70c487c058c33b62f99c42` with ready migration
  `0027_default_private_photo_album`.
- `EXPECTED_SOURCE_COMMIT=0849eaacc0b70302bf70c487c058c33b62f99c42 npm run monitor:production`
  passed with PostgreSQL/S3-compatible storage, configured Sentry/Web Push,
  matching-job alerts enabled, controls off, and seven anonymous private-route
  checks.

## Boundary and risk

- The aggregate test command skipped PostgreSQL integration suites because
  this clean worktree has no disposable `TEST_DATABASE_URL`. This packet must
  not claim a database-backed integration pass until that URL is configured.
- Before field acceptance, capture a real photo into the default album, create
  a second private album, capture into it, and confirm both covers and album
  boundaries on iOS and Android.
