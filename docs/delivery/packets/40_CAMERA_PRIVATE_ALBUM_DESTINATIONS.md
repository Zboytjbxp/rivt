# Packet 40 - Camera Private Album Destinations

Status: production verified

## Objective

Make private albums a first-class Camera destination. Every account must have
one safe private album while still being able to create and select additional
albums for unrelated side work, showroom photos, or personal proof.

## Delivered

- Migration `0027_default_private_photo_album` adds a server-owned
  `is_default` marker with a partial unique index so each account can have only
  one default private album.
- Existing accounts receive a `Private photos` album during migration. Camera
  also uses an authenticated idempotent endpoint to ensure the album exists
  for accounts created later or restored from partial data.
- Camera's context picker now presents private albums first, then standalone
  projects, then accepted RIVT work. It supports creating a private album in
  the same sheet and selects the new album immediately.
- Camera starts on a stable home screen with `Private photos` selected, rather
  than opening an unrelated job or unexpectedly jumping into a gallery.
- Bottom Camera actions retain the selected album as the exact destination for
  capture and gallery access, preserving the one-handed field flow.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test` (53 unit tests passed; 16 PostgreSQL suites skipped because
  `TEST_DATABASE_URL` is not configured in this isolated worktree)
- `npm run test:e2e`
- `npm run test:ui:tools`
- `npm run test:ui:mobile-actions`
- `npm audit --omit=dev`
- `git diff --check`

The integration suite includes default-album idempotency and account isolation
coverage. It must be run against a configured disposable PostgreSQL test
database before the packet can claim database-integration verification.

## Production Evidence

- `master` source `c366a69facf764cc36f226014bd3a83da46996c8`
- Ready migration `0027_default_private_photo_album`
- `EXPECTED_SOURCE_COMMIT=c366a69facf764cc36f226014bd3a83da46996c8 npm run monitor:production`
  passed with PostgreSQL and S3-compatible storage healthy, configured Sentry
  and Web Push, matching-job alerts enabled, controls off, and seven anonymous
  private-route checks in 611 ms.

## Boundary

This packet changes the album schema, authenticated album API, and Camera
destination selection. It does not change object storage ownership, project
media authorization, or expose private albums to any other account.
