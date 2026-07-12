# Packet 21 - Shop Talk Command Center

## Objective

Make Shop Talk feel like one focused community product: a feed for discussion,
a clear community directory, and fresh field news. This packet keeps the
server-owned community, audience, post, answer, reaction, and moderation
contracts unchanged.

## Scope

- Replace the binary Shop Talk / Trade News control with three destinations:
  `Feed`, `Communities`, and `Trade News`.
- Replace stacked post-type, flair, tag, saved, and sort rows with one
  explicit filter panel.
- Move community discovery out of the feed. The directory presents compact
  rows, search, joining, real counts, and a visible Create action.
- Keep community creation search-first and retain public, contractors-only,
  and tradespeople-only audience choices.
- Pin Ask above the mobile navigation and reserve feed clearance beneath it.
- Prefer live trade sources over the original curated fallback, reduce the
  cache window to ten minutes, and provide a manual refresh control.
- Update rendered UI smoke coverage for all three destinations.

## Non-goals

- No change to community audience enforcement, post/answer persistence,
  moderation policy, or action authorization.
- No invented activity, member counts, posts, or news.
- No new package or migration.

## Acceptance

- At phone width, Feed shows one search-and-filter control area and an Ask
  control that does not cover post content or bottom navigation.
- Communities shows a visible Create action for signed-in users, compact
  community rows, real member/post counts, and the existing audience choices.
- Trade News fetches live sources first, falls back only when sources fail,
  and can be manually refreshed.
- Build, lint, unit, E2E, Shop Talk rendered UI smoke, dependency audit, and
  diff check pass before release.
