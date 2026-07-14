# Packet 38 - Work and People Navigation

Status: local verification complete

## Objective

Make the relationship tools easier to find without retaining a sixth competing
primary destination. Jobs and people are two modes of Work; Shop Talk remains
the separate public-community product.

## Delivered

- The shell now exposes four primary destinations: Home, Work, Shop Talk, and
  Tools. `Crew` is no longer a separate desktop or mobile navigation item.
- Work has an explicit `Jobs` / `People` switch. `People` holds saved people,
  subs, clients, reviews, and invite planning, retaining the existing records
  and permissions rather than rebuilding or deleting them.
- People has the matching `Jobs` / `People` switch, so users can move between
  job work and relationship work in one tap.
- Existing `/app/crew` and `/app/network` links resolve to `/app/work/people`.
  Internal legacy `Crew` identifiers remain only for backward-compatible
  routing and data records.
- Global search language now says `people`, and a selected public profile opens
  People directly.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test` (unit pass; database integration suites skipped because this
  clean worktree has no `TEST_DATABASE_URL`)
- `npm audit --omit=dev`
- `git diff --check`

## Boundary

This packet changes navigation and labels only. It does not merge job and
relationship data models, modify server authorization, remove Crew records, or
claim that saved people are a public social graph.
