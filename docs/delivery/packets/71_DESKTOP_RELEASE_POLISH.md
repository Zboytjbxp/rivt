# Packet 71 - Desktop Release Polish

## Goal

Make the five-destination RIVT shell feel deliberate on wide screens without changing the proven mobile workflows or moving People out of Work.

## Product boundary

- Preserve Home, Work, Camera, Shop Talk, and Tools as the five primary destinations.
- Keep People and crew management under Work.
- Do not add new data, permissions, claims, or desktop-only product behavior.
- Desktop composition begins at 1181px; compact-device and mobile layouts remain authoritative below that boundary.
- Light and dark themes must use the shared `--v2-*` tokens.

## Work

1. Reset document scroll when the primary destination changes and offset focused Work anchors below the sticky top bar.
2. Move the rare update notice away from desktop page headers while preserving the existing mobile placement.
3. Restore a scan-friendly Tools workspace: three field launchers, two money launchers, and the existing full-width shortcut and More Tools surfaces.
4. Turn Camera into a compact desktop workbench with bounded album cards, two-column destination/album composition, and a stable action dock.
5. Give the global Shop Talk feed a useful community-discovery rail, remove the empty reserved column, and stop Communities from mounting the Trade News detail pane.
6. Replace dark-only sidebar job colors and hardcoded community tones with shared theme tokens.
7. Extend guest-preview rendered QA at 1440x900 in light and dark.

## Acceptance

- Production build and lint pass.
- All unit tests pass.
- Fail-closed authentication and jobs/discovery E2E pass.
- Guest preview, Tools, Shop Talk/Trade News, and mobile-action rendered QA pass.
- Desktop QA proves scroll reset, no horizontal overflow, bounded Camera albums, a three-card field-tools row, a visible Shop Talk community rail, and no News detail pane in Communities.
- Dependency audit reports zero known production vulnerabilities.

## Known verification boundary

- The serial database integration command was attempted from a clean process state but did not return output or complete within the available run window. No pass is claimed.
- Work lifecycle rendered QA currently receives expected fail-closed HTTP 503 responses from the locally disabled Stripe Connect status route and treats those console responses as errors. No lifecycle assertion failed, but that smoke is not claimed green.

## Deployment evidence

- Merged to `master` and released as exact production source
  `a2095df7eef356942b66bba0759694a714ce7921`.
- Railway application deployment:
  `e0c5b4a4-4d82-4f1d-adc5-5eb17b7222fd`.
- Railway exact-source metadata deployment:
  `7aa5f117-c026-4f8f-8b0a-6f7d4efad003`.
- Production monitor passed against `https://rivt.pro` with ready migration
  `0030_stripe_connect_accounts_v2` and seven anonymous private-route checks.
- Authenticated production run `ui-a11y-20260726031210-b81689` passed all
  eight role/viewport scenarios and closed both disposable accounts.

## Rollback

- Revert the packet commit. No migrations, server contracts, storage keys, or production data are changed.
