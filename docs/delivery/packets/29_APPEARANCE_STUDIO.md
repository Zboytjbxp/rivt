# Packet 29 - Appearance Studio

## Goal

Replace vague, manufacturer-adjacent Field Finishes with a clear, original RIVT
appearance system whose choices visibly affect the whole workspace.

## Scope

- Replace named "finishes" with independent RIVT controls for Accent, Chrome,
  Canvas, Display mode, and Workspace density.
- Keep the Account entry compact and open the complete editor in a dedicated,
  scrollable mobile sheet; retain the full editor in Settings.
- Migrate existing on-device palette selections into the closest Accent,
  Chrome, and Canvas setup so prior choices do not silently reset.
- Drive root design variables for canvas, top bar, navigation, actions,
  surfaces, spacing, and radii from the selected appearance.
- Add mobile smoke coverage that selects all four appearance dimensions and
  verifies the live document variables update without a page reload.

## Non-goals

- No manufacturer logos, names, protected color signatures, or affiliation
  claims. These are original RIVT controls, not tool-brand skins.
- No server persistence or Pro gate. Appearance remains a device preference
  until a server-enforced entitlement decision exists.
- No changes to auth, billing, moderation, records, or production data.

## Acceptance

- Accent, Chrome, Canvas, and Density can each be selected independently.
- A choice visibly changes the real application shell, not merely the editor.
- The compact Account entry identifies the active setup and the full editor
  remains scrollable and has no horizontal overflow at the compact viewport.
- A legacy Field Finish preference resolves to an equivalent RIVT setup.

## Local Verification

- `npm run build`
- `npm run lint`
- `npm run test:unit` (53 passing)
- `npm run test:e2e`
- `npm run test:ui:mobile-actions`
- `npm run test:ui:tools`
- `npm audit --omit=dev`
- `git diff --check`
- `npm run test` was also attempted; its database-integration half produced no
  output and exceeded the 180-second local runner window. This client-only
  packet makes no database verification claim.

## Production Evidence

- `codex/appearance-studio` was fast-forwarded into `master` at
  `36f0735d45922e8a3cc49fb8dc9d255896aade5d`.
- Live `/api/health` returned that exact source commit with ready migration
  `0026_standalone_projects`, PostgreSQL, S3-compatible object storage,
  configured Sentry, and configured Web Push.
- `EXPECTED_SOURCE_COMMIT=36f0735d45922e8a3cc49fb8dc9d255896aade5d npm run
  monitor:production` passed with controls off and seven anonymous private-route
  checks in 569 ms.
