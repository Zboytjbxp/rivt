# Packet 33 - Tools Subtraction

Status: locally verified

## Objective

Reduce repeated launchers and secondary-tool clutter without deleting records,
breaking deep links, or weakening the one-handed field shortcut tray.

## Delivered

- Field shortcuts remain the fastest path to three user-selected tools.
- Tools pinned in the field tray no longer repeat immediately in the core-app
  grid; with the default setup, Estimate and Invoice are the only additional
  core apps shown.
- The separate Recent section was removed because it duplicated both pinned
  shortcuts and the core-app list.
- Plan, Track, and Site boxes were consolidated into one Utilities drawer.
  Materials, time, expenses, mileage, price book, punch list, safety,
  receivables, and tax summary remain reachable.
- Existing tool implementations, saved records, direct routes, and active-job
  context behavior remain available.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:ui:tools`
- `git diff --check`

The rendered mobile Tools smoke now asserts three pinned defaults, two
non-duplicated core apps, one Utilities drawer, and access to representative
planning, money, and site utilities.

## Boundary

This is launcher subtraction, not record migration or tool deletion. Deeper
mergers such as Invoice plus Receivables require a separate data-contract
packet.
