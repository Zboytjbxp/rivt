# Packet 67 - Text Scale and Featured Work

Status: implementation verified; PostgreSQL gate pending

## Scope

- Replace the binary larger-text preference with Standard, Large, and Extra
  large display scales.
- Apply the selected scale to the full interface typography system, including
  legacy feature CSS and fixed-size inline text that previously bypassed the
  shared tokens.
- Add an owner-curated Featured Work gallery to professional profiles using
  photos the account already owns in RIVT albums.
- Let authenticated users viewing a tradesperson or contractor profile see
  only the photos that profile owner explicitly selected.

## Privacy and authorization

- Private albums remain private and are never published automatically.
- Accepted-job evidence and project records are not inferred as profile work.
- The server verifies album-photo ownership before a photo can be featured.
- A profile can feature at most six photos; duplicate photos are rejected.
- Removing a featured item does not delete the underlying private photo.
- Public-profile reads remain authenticated and expose only the curated work
  sample record plus a signed media URL.

## Acceptance

- Settings offers Standard, Large, and Extra large text sizes.
- The selection persists on the device and applies before and after sign-in.
- Existing binary larger-text preferences migrate to Large.
- No raw fixed `font-size: Npx` declaration remains in application CSS.
- Profile owners can feature and remove work photos without exposing an album.
- The opposing party sees the same curated gallery on profile inspection.
- Cross-account attempts to feature another account's photo are rejected.
- Migration 0029 applies and rolls back cleanly.

## Evidence

- `npm run build` - passed
- `npm run lint` - passed
- `npm run test` - passed; 59 unit/frontend checks passed and the local
  integration runner reported 3 non-database checks passed with 16
  database-dependent checks skipped because `TEST_DATABASE_URL` is absent
- `npm run test:e2e` - passed, including auth fail-closed and responsive
  jobs/discovery coverage
- `npm run test:ui:mobile-actions` - passed; rendered screenshots saved under
  `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`
- `npm audit --omit=dev` - passed with zero vulnerabilities
- `npm run test:integration` - not fully run because `TEST_DATABASE_URL` is
  unavailable in this worktree; migration 0029 and cross-account work-sample
  behavior therefore remain a required database gate

## Boundary

- This packet does not make albums, job photos, records, or evidence public.
- Featured photos are self-selected presentation, not verified workmanship or
  a RIVT endorsement.
- Physical low-vision testing at all three sizes and production database
  verification remain required before deployment.
