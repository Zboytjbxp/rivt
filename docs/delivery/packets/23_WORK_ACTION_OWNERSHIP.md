# Packet 23 - Work Action Ownership

## Goal

Give job creation one predictable home: Work. Home remains a daily-status
surface, while Shop Talk remains the place to ask the trade community.

## Scope

- Remove the generic Home floating action button for both roles.
- Keep the contractor onboarding step for a first job, but do not repeat that
  action as a persistent Home affordance.
- Move the contractor's persistent mobile action into Work as a thumb-reachable
  `Post job` control directly above the mobile navigation.
- Keep the desktop Work header action, renamed to `Post job` for one verb
  across form entry points.

## Non-goals

- No sixth navigation item or new global action menu.
- No change to job creation, role authorization, drafts, or publishing rules.
- No change to Shop Talk's separate Ask action.

## Acceptance

- Home contains no generic creation FAB.
- Contractors can start a job from Work on desktop and mobile.
- The mobile Work action is visible, tappable, and clear of the persistent
  navigation at a compact 320px viewport.
- Tradespeople do not see a contractor-only posting control.

## Local verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run lint:security` - passed.
- `npm run test:unit` - passed, 53/53.
- `npm run test:e2e` - passed.
- `npm run test:ui:mobile-actions` - passed, including Home FAB absence and
  mobile Work action reachability.
- `npm audit --omit=dev` - passed, zero vulnerabilities.
- `git diff --check` - passed.
- `npm run test` was attempted and exceeded the local command window during
  its database-integration phase; this client-only packet does not claim a
  new aggregate or DB-backed integration pass.

## Remaining boundary

Merge and deploy only after the compact Work action is confirmed on a physical
phone alongside the existing active-work controls.
