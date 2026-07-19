# Packet 66 - Accessible Display Modes

Status: release-ready

## Scope

- Add persistent display controls under Settings > Theme for larger text,
  higher contrast, and color-safe status cues.
- Keep the controls device-local so they apply before and after authentication
  without changing account, authorization, or production data behavior.
- Preserve text, icon, and shape labels as the primary meaning of status. The
  color-safe option supplements those cues with a blue/amber/magenta palette;
  it does not claim to simulate or solve every form of color-vision deficiency.

## Acceptance

- Each control uses an accessible switch role and exposes its current state.
- Preferences survive reloads and apply at the document root.
- Larger text raises the small-text floor and control legibility without
  changing viewport-width-based font sizing.
- Higher contrast strengthens muted copy, borders, and keyboard focus.
- Color-safe status cues remain distinguishable without relying on
  red-versus-green alone.
- Existing light, dark, and system theme behavior remains intact.

## Evidence

- `npm run build` - pass
- `npm run lint` - pass
- `npm run test:unit` - pass (59 tests)
- `npm run test:e2e` - pass
- `npm run test:ui:mobile-actions` - pass
- `npm audit --omit=dev` - pass (0 vulnerabilities)
- `npm run test:integration` - produced no output during a bounded run and was
  stopped; no integration pass is claimed

## Boundary

- No server, schema, authentication, authorization, billing, storage, or
  moderation behavior changed.
- Physical iOS/Android testing with system text enlargement, keyboard-only
  navigation, screen-reader review, and validation with people who have low
  vision or color-vision deficiencies remain launch-readiness evidence, not
  claims made by this packet.
