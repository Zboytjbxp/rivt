# Packet 34 - Shop Talk Hierarchy

Status: locally verified

## Objective

Make Shop Talk read as one complete community product: feed first, a visible
post command, discoverable community creation, exact community pages, and a
separate live-news reader.

## Delivered

- The floating Ask button was removed. A labeled Post command now sits beside
  search and filters where users expect feed actions.
- Empty community feeds provide a direct Create post action.
- Community discovery uses a literal heading and concise description; the
  existing public, contractors-only, and tradespeople-only creation choices
  remain intact.
- Opening a community puts its identity, audience, membership, and join state
  before the scoped feed on mobile.
- Feed, Communities, and Trade News remain distinct top-level views. Trade
  News still fetches live sources on activation and exposes manual refresh.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:ui:shop-talk-news`
- `git diff --check`

The rendered smoke asserts the Post command, community creation, exact
community-page ordering on mobile, feed reactions, answers, and Trade News.

## Boundary

This packet changes client hierarchy and labels only. Community audiences,
membership, posting, answers, reactions, reports, moderation, and news-source
contracts remain server-owned and unchanged.
