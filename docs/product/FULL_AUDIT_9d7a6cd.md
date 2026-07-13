# RIVT Full Audit — master @ 9d7a6cd (2026-07-13)

Production = origin/master = `9d7a6cd` (confirmed via /api/health; migrations
through 0026). 70 commits since the last audit (9356916): Shop Talk community
rebuild, tools-launcher consolidation, job creation moved into Work, web push
delivery, project invoices + standalone projects, appearance simplification,
navigation cleanup ("packets 32–35"). Method: one deep verification agent over
the full three-train backlog + new-surface regression scan (all claims read in
code, adversarially), plus my live drive: rebuilt Shop Talk, tools hub,
composer at 375×553, theme switching, Work create path, Home.

## Verdict

This is the strongest deploy yet. **Train 1 (field reliability) is 7-for-7
complete and well built. Train 2's headline — web push — is done end-to-end
and passed an adversarial cross-account check.** The rebuilds (Shop Talk,
tools, appearance) survived with one real new hole. Remaining work is a short,
specific list.

## Verified DONE this deploy (no action)

**Field reliability — all seven:**
- Fetch timeouts everywhere (fetchWithTimeout, 15s default / 60s uploads;
  timeout & network → typed error with "Connection problem — check your
  signal"); every API file routes through it.
- Bootstrap 5xx no longer reads as logged-out — "Your account is still here.
  Check your connection, then retry" screen with a working retry.
- Photo uploads: per-file retry, failed batch kept, camera blob retained until
  saved; "N of M didn't upload — retry the failed photos."
- Offline banner copy honest; 429 → human copy honoring Retry-After;
  SW cache build-derived + update reload gated (no mid-form reload);
  1200×630 social card + og:url + robots.txt + sitemap + per-view titles.

**Engagement engine core:**
- **Web push end-to-end:** subscriptions bound to account AND auth session
  (migration 0024), outbox worker with SKIP LOCKED + backoff + dead-sub
  pruning on 404/410, channel preferences honored, revoked sessions excluded.
  Adversarial check: one account's push cannot reach another's subscription;
  logout deletes the device's subscription rows.
- **Job-match notifications on publish** (trade + service area, pref-aware,
  block-aware, fanout-capped) and **application-received / shortlist /
  decline** notifications — the marketplace loop finally makes noise, and it
  all rides push.
- "Log today" pulse on the Home active-work card (due/saved/completion states
  driven by real project entries).

**Rebuild survivals (live-verified):**
- Shop Talk: new Feed/Communities/Trade News IA; composer Post in-viewport at
  375×553; audience enforcement intact server-side; community labels correct.
- Tools: 14 surfaced (5 primary + 9 utilities), ?tool= URLs + browser back to
  hub intact, pinnable 3-slot field tray replaces recents (intentional).
- Job creation lives in Work + the Home path still works; theme
  system/light/dark works and persists (control moved into the profile
  panel); Home community icons now brand-consistent with proper "1 member"
  labels; FAB overlaps eliminated by design (in-flow buttons / reserved
  padding).
- New migrations 0025 (project invoices, immutable payments ledger) and 0026
  (standalone projects) are properly account/participant-scoped — checked.

## What's still open (the next train — small and specific)

1. **Shop Talk notification deep links can silently miss their post** (new,
   medium). There is no GET post-by-id route (verified — only /media, /delete,
   /answers under :postId); the client resolves `initialPostId` against the
   newest-100, filter-narrowed list (`ShopTalkView.tsx:979`,
   `shop-talk.js:424`). A push about an older/filtered post lands on the feed
   instead. Fix: add `GET /api/v1/shop-talk/posts/:postId` (audience-checked)
   + client fallback fetch when initialPostId isn't in the loaded list.
2. **Push silently dies per device after logout→re-login** (medium). Sub rows
   are deleted on logout (correct), but re-registration only happens when the
   ProfileHub notification settings mount. Fix: re-register the existing
   browser subscription once per authenticated app boot.
3. **Reputation is still a client-side name-matching illusion** (medium,
   carried). The /reputation/me endpoint aggregates reactions *given*, not
   earned; the client matches `post.author === displayName`
   (`ShopTalkView.tsx:1015-1037`) — renames zero it, name collisions merge
   strangers. Fix: server aggregation by author_account_id, returned with
   posts.
4. **shop-talk-api swallows every error to null** (low-med) — the new
   timeout/429/403 human copy never reaches Shop Talk users; App shows a
   generic "not saved" toast. Fix: surface the RivtApiError message.
5. **Daily-log pulse magic string** (low-med): "rivt daily log" duplicated in
   TradeFeed.tsx:44 and DailyLogTool.tsx:210 with no shared constant — a copy
   tweak silently kills the pulse. Plus the scheduled "no log by 4pm" push
   isn't built (only the 5s outbox timer exists).
6. **Visual debt compounding** (carried, worse): styles.css +1,021 lines
   (12,733), tools-studio.css +647 (9,585); status hexes 79→83; three fully
   dead CSS families shipped (theme-studio ~330 lines, field-kit,
   appearance-studio, + orphaned shop-talk FAB). One deletion-only pass cuts
   hundreds of lines risk-free.
7. **Bootstrap Promise.all** (low): a timeout on /api/storage alone blocks a
   valid session behind the retry screen — make the two secondary calls
   non-blocking.
8. Engagement backlog not yet built (fine, tracked): first-answer email, Home
   news strip, rotating founder prompts, weekly digest.

## Suggested next train (one branch, small diffs)

(1) GET post-by-id + deep-link fallback · (2) push re-register on boot ·
(3) shop-talk-api error surfacing · (4) shared DAILY_LOG_PREFIX constant ·
(5) make storage/providers non-blocking at boot · (6) server-side earned
reputation · then the dead-CSS deletion PRs and the status-hex sweep as
separate cleanup PRs.

Note: audit docs live on `claude/new-session-2wxmgd` — the verification agent
working from master couldn't see the prior audit file. Standing offer to
cherry-pick the docs/product audit set onto master remains open.
