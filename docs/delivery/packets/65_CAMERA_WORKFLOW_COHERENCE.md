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

Pending merge and production verification.
