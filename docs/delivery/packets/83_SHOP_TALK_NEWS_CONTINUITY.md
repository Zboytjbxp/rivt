# Packet 83 — Shop Talk and Trade News continuity

## Objective

Finish the continuity boundary between Trade News and Shop Talk:

1. Trade News coverage choices, follows, and saved articles belong to the
   signed-in account instead of one browser.
2. A news discussion stores the article as structured server data, so RIVT
   can find the real thread without scanning only the posts currently loaded.

## Acceptance boundary

- Scope, coverage location, topic/trade filters, followed trades/topics, and
  saved articles persist across sessions and devices.
- Existing `rivt.news.*` choices remain on the device until the user explicitly
  moves them to the account; failed migration never clears local values.
- Saved articles retain only publisher metadata already shown by RIVT. They
  never become copied articles, invented summaries, or fabricated media.
- New article discussions store the canonical article URL, publisher, and
  publication date separately from the member's comment.
- Article lookup is server-side and indexed. A feed page or community filter
  cannot hide an existing discussion and cause a duplicate.
- Article discussions live only in a public-audience RIVT community so the
  single canonical thread is visible to both account roles. Public-web
  visibility remains a separate opt-in.
- Existing URL-in-body discussions remain readable and are still recognized
  from loaded legacy posts; no production post body is silently rewritten.
- Duplicate creation races fail honestly and return the existing thread ID.

## Schema and authorization

- Migration `0041_shop_talk_news_continuity` adds account-owned Trade News
  preferences and saved-article records plus structured article fields and an
  indexed active-discussion uniqueness boundary on `shop_talk_posts`.
- Preference and saved-article APIs require the authenticated owning account.
- Discussion lookup applies the same community-audience and moderation rules
  as normal Shop Talk reads.
- Creation uses server canonicalization and rejects non-HTTP(S) links.

## Rollback

Roll the application back first. The down migration removes Packet 83
preference/saved-article tables and structured article columns/indexes only.
It does not delete Shop Talk posts, answers, communities, or article links
that remain in legacy post bodies.

## Required evidence

- Build, lint, unit, serial integration, E2E, rendered mobile/desktop checks,
  migration rollback/reapply, and dependency audit.
- Production exact-source health with migration `0041` ready.
- Disposable authenticated production proof covering account continuity,
  owner isolation, structured discussion creation, indexed lookup, duplicate
  prevention, answer visibility, and cleanup.

## Three-things review

The post-implementation review found and closed three continuity gaps before
this packet advanced:

1. A structured article discussion that was later explicitly published to
   the web could lose its article link because public discovery only parsed
   legacy URLs from the post body. Public discovery now renders the stored
   structured article URL and publisher metadata while preserving the
   separate public-consent boundary.
2. Two devices could race to start the same discussion. The server already
   prevented the duplicate, but the losing device initially saw only an
   error. The conflict response now returns the canonical post ID and the
   client opens that existing discussion with honest one-conversation copy.
3. An account that already had server preferences could silently replace
   different legacy choices found on a new device. Cache signatures now
   distinguish server-synced state from unrecognized device state and offer
   an explicit move-or-overwrite choice. Failed moves retain every local
   value for retry.

## Local verification

- `npm run build`
- `npm run lint`
- `npm run lint:security`
- `npm run test:unit` — 112 passing
- `npm run test` — all 22 serial PostgreSQL integration suites passing
- `npm run test:e2e`
- `npm run test:ui:tools`
- `npm run test:ui:shop-talk-news`
- `npm run test:ui:mobile-actions`
- `npm run test:ui:work-lifecycle`
- `npm audit --omit=dev` — zero vulnerabilities
- `git diff --check`

The Trade News rendered smoke covers a fresh signed-in account, explicit
legacy-device migration, account-backed saved-article snapshots, structured
discussion creation and indexed reuse, desktop and 390px mobile layouts, and
light/dark presentation. Migration integration coverage rolls `0041` back and
reapplies it.
