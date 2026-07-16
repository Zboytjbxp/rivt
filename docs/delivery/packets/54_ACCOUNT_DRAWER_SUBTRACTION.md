# Packet 54 - Account Drawer Subtraction

## Objective

Reduce the top-bar account drawer to a clear navigation menu instead of a
second Profile and Settings dashboard. Identity, Profile, Settings, staff-only
Admin, and Sign out should be the only concepts in the drawer.

## Source boundary

- Base source: Packet 53 documentation release `dd6c57b`.
- Implementation branch: `codex/account-drawer-subtraction`.
- Profile remains the owner of professional identity, reputation, and work
  history. Settings remains the owner of appearance, alerts, subscription,
  storage, sessions, legal, support, and account controls.
- No API, schema, migration, authentication, authorization, billing, storage,
  moderation, or server-owned record change is part of this packet.

## Changes

- Replaced the account drawer's duplicate profile showcase, metrics, device,
  theme, standing, and setup panels with one compact identity block and five
  role-aware actions.
- Profile and Settings now open their exact destinations. Staff accounts retain
  Admin; non-staff accounts never receive that control.
- Settings accepts an exact initial section so account-menu actions can land on
  the intended surface without making the drawer carry those controls.
- Removed the obsolete ProfileShowcase component, its stylesheet, and the
  account-drawer CSS that only supported the removed dashboard content.
- Mobile regression coverage now proves the drawer stays compact, appearance
  controls live under Settings, Alerts remains reachable, and the menu does not
  overflow.

## Acceptance

- Opening the account control shows identity, Profile, Settings, conditional
  Admin, and Sign out without duplicate metrics or preferences.
- Profile opens the profile destination and Settings opens the settings index.
- Theme and alert controls remain reachable in Settings.
- Admin remains server-role gated and is absent for ordinary accounts.
- The drawer and Settings remain usable without horizontal overflow on mobile.

## Verification

- `npx tsc -b --pretty false` - passed.
- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run lint:security` - passed.
- `npm run test:unit` - 55 passed, zero failures or skips.
- `npm run test:e2e` - fail-closed auth and desktop/mobile discovery passed.
- `npm run test:ui:mobile-actions` - passed, including the compact account
  drawer, Settings theme handoff, Alerts, and mobile overflow checks.
- `npm audit --omit=dev` - zero vulnerabilities.
- `git diff --check` - passed before commit.
- `npm run test:integration` with the configured isolated `TEST_DATABASE_URL`
  - all 19 serial PostgreSQL integration suites passed in 1,030.1 seconds with
  zero failures or skips.

Rendered evidence is stored in
`C:/Users/zboyt/AppData/Local/Temp/rivt-mobile-actions-pass`.

## Rollback

Revert the Packet 54 implementation commit. No database or data rollback is
required because this packet changes client navigation and presentation only.

## Deployment evidence

Pending merge and production verification.

## Next packet

Packet 55 should continue the interface audit's subtraction boundary on the
next highest-friction surface without adding new product concepts.
