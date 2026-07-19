# Packet 65 - Camera Workflow Coherence

## Objective

Keep Camera inside the familiar RIVT shell while browsing destinations and
photos, then switch to an immersive surface only while the actual shutter is
open. Remove a redundant Work empty-state panel that repeated an action the
user had already completed.

## Scope

- Preserve the global top and bottom navigation on the Camera landing and
  gallery surfaces.
- Enter immersive mode only while the Camera capture surface is open.
- Keep Camera's one-handed Destination, Feed, and Capture controls above the
  global mobile navigation without obscuring content.
- Increase the Camera workbench's bottom clearance for the two navigation
  layers.
- Remove the duplicate Work detail placeholder when a tradesperson already
  sees the honest zero-results state.
- Remove decorative gradients from immersive Camera chrome and its context
  card so the live preview remains visually dominant.
- Replace the Heavy 16th fraction-key cap and outline treatment with a calmer
  hierarchy based on fixed position, type size, and neutral surface contrast.

## Acceptance boundary

- Opening Camera from the primary navigation leaves the primary navigation
  visible and stable.
- Destination, Feed, and Capture are visible, tappable, and in the mobile
  viewport without covering the global navigation.
- Opening the shutter hides the app shell for focused capture; closing it
  restores the same Camera landing context.
- A Work browse result with zero matching jobs shows one empty state, not a
  second instruction to select a nonexistent job.

## Verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run test:unit` - passed, 58/58.
- `npm run test:e2e` - passed.
- `npm run test:ui:mobile-actions` - passed with rendered Camera action and
  viewport assertions.
- `npm audit --omit=dev` - passed with zero vulnerabilities.
- Follow-up visual refinement re-ran build, lint, 58/58 unit/frontend tests,
  E2E, mobile-action UI, and dependency audit successfully on 2026-07-19.
- `npm run test:integration` - attempted with `TEST_DATABASE_URL` configured;
  the runner produced no output and exceeded the 304-second command limit.
  This is recorded as an incomplete aggregate run, not a pass. This packet has
  no server, migration, or database behavior changes.

## Risk boundary

This packet changes client navigation presentation, Camera capture-state
reporting, mobile spacing, and one Work empty-state condition. It does not
change persistence, uploads, authorization, authentication, billing,
moderation, storage contracts, schemas, or production data.

## Deployment evidence

- Feature commit `ce13fdccc9e0683b905cb550f7d961e0f0186ab8` was
  fast-forwarded into `master` and pushed to `origin/master`.
- Railway deployed that exact runtime source. The live
  `https://rivt.pro/api/health` response reported ready migrations,
  PostgreSQL, S3-compatible object storage, configured Sentry, and configured
  Web Push.
- `npm run monitor:production` passed against the deployed commit in 601 ms,
  with signup and mutation controls open, matching-job alerts enabled, and all
  seven anonymous private-route checks healthy.
- Follow-up visual-refinement commit
  `e86767c350e2defa15dd2a1c18ea8fbf960dbc5d` was merged into `master` as
  `9c66537f282c18fdce2fec9909d0672747cd6a19` and pushed on 2026-07-19.
- Production served that exact merge source. Build, lint, 58/58 unit/frontend
  tests, E2E, rendered mobile-action QA, and the zero-vulnerability dependency
  audit passed on the merged tree. The production monitor passed in 581 ms
  with PostgreSQL, object storage, Sentry, Web Push, matching-job alerts, and
  all seven anonymous private-route checks healthy.
