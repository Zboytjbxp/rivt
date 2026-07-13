# Packet 31 - Appearance Simplification

## Goal

Return RIVT to one recognizable visual identity. Appearance is a small
device-level preference, not a collection of tool-inspired kits, custom colors,
or a paid customization surface.

## Scope

- Keep exactly three choices: System, Light, and Dark.
- Present them as direct, clearly labeled controls in Account and Settings.
- Remove Field Kit, custom-color, canvas, chrome, and density controls from the
  active UI and runtime theme state.
- Clear retired appearance preferences from device storage so an earlier custom
  setup cannot continue to alter the application after this release.
- Keep the same RIVT tokens and interaction hierarchy in both display modes.

## Non-goals

- No per-manufacturer styling, logos, names, or implied affiliations.
- No paid appearance entitlement or plan distinction.
- No changes to authentication, billing, moderation, records, or server data.

## Acceptance

- Account and Settings expose only System, Light, and Dark.
- Choosing a mode updates the application immediately and persists as a
  device-local preference.
- Retired custom appearance state is not attached to the document and cannot
  override current RIVT tokens.
- The three choices remain readable, tappable, and free of horizontal overflow
  on a phone.

## Local Verification

- `npm run build`
- `npm run lint`
- `npm run test:unit` (53 passing)
- `npm run test:e2e`
- `npm run test:ui:mobile-actions`
- `npm audit --omit=dev` (0 vulnerabilities)
- `git diff --check`

The aggregate `npm run test` database-integration half is intentionally not
claimed for this client-only packet; it has exceeded the local runner window
without output in this environment.

## Boundary

Legacy Field Kit CSS and configuration definitions are inert after this packet:
the app no longer reads or applies them. Their deletion is a separate
deletion-only cleanup so this product decision stays small and reversible.
