# Packet 37 - Workflow Coherence and Field Tool Reachability

Status: local verification complete

## Objective

Make a field action understandable in the same moment it is taken: the user
should see the exact destination, know that it opened, and have the next useful
choice in reach without hunting through a second surface.

## Delivered

- Opening focused accepted work now places a compact `Job workspace open`
  arrival confirmation directly above the job tabs. It names the selected job,
  explains that photos, daily logs, and the job thread are the next actions,
  and can be dismissed. The existing route, job authorization, and work data
  remain unchanged.
- The mobile Camera home dock now presents three thumb-zone actions with text:
  the current save destination, `Open project feed`, and `Capture`. It no
  longer relies on icon-only controls at the top of a long field screen.
- Camera galleries now have a mobile-only lower action dock for return,
  upload, and capture. The duplicate top action row is suppressed only on
  mobile, while the desktop gallery retains its existing controls.
- The Camera workbench reserves safe-area clearance for the persistent gallery
  dock so the newest photo and its actions do not sit under the device chrome.

## Verification

- `npm run test:ui:mobile-actions`
- `npm run build`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm audit --omit=dev`
- `git diff --check`

The mobile action smoke now asserts that Camera's named lower controls remain
visible at the compact 390x844 field viewport. This worktree has no
`TEST_DATABASE_URL`, so database integration is intentionally not claimed;
the packet changes no server route, schema, persistence, or authorization
logic.

## Boundary

This is a focused coherence pass, not a global workflow rewrite. Existing
notification routing, job lifecycle rules, project-feed persistence, and
standalone-work context stay as implemented. A future audit can apply the
same exact-destination and next-step rule to remaining tools and settings.
