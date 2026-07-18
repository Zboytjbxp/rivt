# Packet 64 - Tools Mobile Landing

## Objective

Make Tools a usable mobile launch surface. A field user must see the core
tools in the page, be able to edit their one-hand shortcut tray, and reach the
remaining utilities through a control whose label matches its behavior.

## Scope

- Keep Camera, Heavy 16th, Jobsite, Estimate, and Invoice visibly available in
  the mobile hub.
- Keep the field tray as a shortcut layer, not the only way to discover Camera,
  Heavy 16th, or Jobsite.
- Expose the tray's `Edit` action at handset widths.
- Replace the misleading plus-labeled Utilities shortcut with `More`, which
  opens the actual More tools section.
- Update rendered tools and mobile action coverage for the complete core-app
  set and phone tray editing.
- Exclude generated nested Codex worktrees from the repository lint scope.

## Acceptance boundary

- At handset widths, the main Tools page visibly contains all five core apps
  without requiring a fixed tray interaction.
- The tray's Edit action is reachable on a phone, opens its picker, and can
  return to the normal shortcut state.
- Selecting More opens and scrolls to the More tools section; it does not
  merely scroll to a collapsed or duplicate Utilities label.
- A tall handset uses the available viewport for the in-flow Tools content
  instead of presenting a large empty middle region.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run test:ui:tools`
- `npm run test:ui:mobile-actions`
- `npm audit --omit=dev`

The aggregate `npm run test` command may exceed the local ten-minute command
limit while its PostgreSQL suite is running. Record that timeout separately;
do not represent it as a passing full integration run without a configured,
completed database result.

## Risk boundary

This packet changes Tools presentation and client-side section state only. It
does not change tool persistence, job context, server contracts, permissions,
billing, storage, or authentication.
