# Packet 42 - Camera and Tools Landing Hierarchy

## Objective

Make the independent Camera and Tools home surfaces faster to scan and more
predictable in the field. Camera should lead with real recent photos, keep the
selected save destination quiet, and retain Capture as the dominant lower
control. Tools should show quick access, all five core apps, and one compact
drawer for everything else.

## Scope

- Add an authenticated, account-scoped recent private-album capture endpoint.
- Show real newest private captures before album cards on independent Camera.
- Keep accepted RIVT work and standalone-project Camera sessions scoped to
  their exact work rather than mixing in unrelated private albums.
- Keep Camera destination as a compact contextual row and preserve the lower
  Destination, Feed, and Capture dock.
- Move Tools quick access back into normal document flow.
- Keep Calculator, Estimate, Invoice, Daily log, and Camera visible in the
  core-app grid regardless of pinned shortcuts.
- Consolidate supporting utilities into one `All tools` disclosure.

## Non-goals

- No new storage provider, album ownership model, migration, or upload flow.
- No placeholder images, fabricated recent captures, or fabricated counts.
- No new tool type or change to Tool Pro entitlement behavior.
- No change to accepted-work, standalone-project, or album authorization.

## Acceptance criteria

1. `GET /api/v1/albums/recent` returns at most six newest stored private
   captures owned by the authenticated account and excludes standalone-project
   albums and other accounts.
2. Independent Camera order is recent photos, quiet destination, then albums.
   Selecting a recent capture opens its exact album.
3. A scoped Camera session remains scoped and does not show unrelated private
   album discovery.
4. Capture remains the visually dominant lower control on compact phones.
5. Tools has one in-flow Quick access row, all five core apps visible, and one
   `All tools` disclosure rather than a second persistent toolbar.
6. Tool and mobile-action rendered smoke coverage asserts the revised labels,
   core-app count, recent Camera heading, and recent-albums API shape.

## Verification evidence

- `npm run build` - passed locally.
- `npm run lint` - passed locally.
- `npm run test` - unit suite passed; PostgreSQL integration suites skipped
  because this isolated worktree has no `TEST_DATABASE_URL`.
- `npm run test:e2e` - passed locally.
- `npm run test:ui:tools` - passed locally.
- `npm run test:ui:mobile-actions` - passed locally.
- `npm audit --omit=dev` - pending final packet verification.
- `git diff --check` - pending final packet verification.

## Boundary and risk

- This packet is local-only until reviewed, merged, and deployed. Do not claim
  production behavior or a disposable-PostgreSQL integration pass yet.
- Before release, run the full integration suite with a disposable
  `TEST_DATABASE_URL`, then test Camera with several private albums on iOS and
  Android: newest thumbnails, exact album opening, destination switching, and
  lower Capture reachability.
