# Packet 30 - Field Kit Themes

## Goal

Correct the Appearance Studio so it feels like a contractor's personal tool
ecosystem rather than a generic collection of web-app colors.

## Scope

- Replace the first-screen Accent/Chrome/Canvas controls with a clear Field Kit
  selector: orange/black, red/black, yellow/black, teal/black, green/black,
  and blue/black systems.
- Make each field kit apply a composed accent, dark chassis, work surface, and
  glove-friendly density in one tap.
- Add My tool color, a saved device-local color picker for users who want the
  app to match their own tools exactly.
- Retain display mode and finer Chrome, Canvas, and Density choices behind a
  compact Fine tune this kit disclosure.
- Keep every name, logo, and claim original to RIVT; no manufacturer affiliation
  or branded theme is represented.

## Non-goals

- No manufacturer names, logos, protected product graphics, or claims of
  affiliation.
- No fake paid gate. The setting remains device-local until an entitlement is
  server-enforced.
- No auth, billing, moderation, records, or database changes.

## Acceptance

- A user can select one clear Field Kit without learning a design system.
- Field Kit selection changes actual shell tokens, not only the preview.
- Users can choose and persist their own exact tool color.
- Compact Account and full Settings entry points expose the same experience,
  remain one-handed and scrollable on a phone, and do not overflow.

## Local Verification

- `npm run build`
- `npm run lint`
- `npm run test:unit` (53 passing)
- `npm run test:e2e`
- `npm run test:ui:mobile-actions`
- `npm audit --omit=dev`
- `git diff --check`

The aggregate `npm run test` database-integration half is intentionally not
claimed for this client-only packet; it previously exceeded the local runner
window without output.

## Production Evidence

- `codex/field-kit-themes` was fast-forwarded into `master` at
  `d260da9a517f7660c26bd42a5ddb3740dbb52630`.
- Live `/api/health` returned that exact source commit with ready migration
  `0026_standalone_projects`, PostgreSQL, S3-compatible object storage,
  configured Sentry, and configured Web Push.
- `EXPECTED_SOURCE_COMMIT=d260da9a517f7660c26bd42a5ddb3740dbb52630 npm run
  monitor:production` passed with controls off and seven anonymous private-route
  checks in 584 ms.
