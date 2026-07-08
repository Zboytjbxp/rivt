# RIVT Exact-Destination & QoL Audit — master @ 96c713e (2026-07-05)

Production = origin/master = `96c713e` (confirmed via /api/health, migration
0022). Rule under test: **every button, notification, card, and CTA should land
on the exact object it names, not a generic section.** Method: three parallel
code reviewers (notification deep-links; active-work + camera; community
audiences + chrome) all citing file:line, plus a live drive (community-audience
create, tools back-nav, 375px SE sweep). Codex's 15 commits since my last audit
acted on the QoL findings — this pass verifies that work and finds what's left.

## Verdict: **GO for Jacksonville soft launch. No hard blockers.**

Codex's exact-destination work is largely successful and verified: messages,
offers, active-work status, Shop Talk answers/verified-fix/upvotes, and
unsafe-work notifications all now deep-link to the exact object; the job-photo
route bug is genuinely fixed; community audiences are enforced server-side (not
UI-only); shared-device state holds; SE layout is clean. The remaining gaps are
the founder's exact target pattern ("generic section instead of exact object")
but none hard-block — they're the top fast-follow list.

---

## What Codex got RIGHT (verified this pass — no action)

- **Notifications deep-link to the exact object** for: `message` → exact
  conversation (auto-selected); `active_work` accepted/cancel/reschedule → the
  exact job thread; `unsafe_work_report` → exact thread; **Shop Talk answer /
  verified-fix / upvote → the exact post** (previously audit-log-only; now
  emits `createInAppNotification` with `metadata.postId` and deep-links via
  `setShopTalkPostId`). (`server/shop-talk.js:242/798/893/1013`, handler
  `App.tsx:1865-1983`.)
- **Community audiences are genuinely enforced server-side** — a tradesperson
  cannot see/join/post/answer in a contractors-only community; the audience
  predicate repeats in the list query, join, post-create, post-list, answer-
  list, answer-create, and verified-fix paths. CHECK constraint + backfill +
  Zod enum all present. (`server/communities.js:150-155,83-86,257`,
  `shop-talk.js:315-343,717-762`, `migrations/0022`.)
- **Job-photo route bug FIXED** — photo deep-links land in a job-scoped gallery,
  Records auto-selects the focused record; no path shows a generic all-jobs
  view. (`ToolsStudio.tsx:2746,2862-2870`.)
- **Camera persistence verified** — uploads go to the exact active job's
  project, show immediately (optimistic + refetch), and **persist server-side**
  across leave/return (remount refetches, guarded by activeWorkId). Still-
  processing photos are filtered out, not rendered blank.
  (`JobPhotosTool.tsx:670,699-734,832-843,855.`)
- **Shared-device state holds** — `clearRivtLocalState()` purges every `rivt.*`
  key except theme on logout AND session-revoke; active-work/focus reset. No
  cross-account photo/draft leak. (`App.tsx:226-234,1213-1268.`)
- **Tools-as-apps back-nav works** — back/swipe returns to the Tools hub (not
  Home/job), and the new "Recent" row surfaces. Verified live at 375px.
- **Calculator units, recent tools, unread-message badge, filter persistence**
  from my last QoL audit all landed.
- **SE (375px) is clean** — zero page-level horizontal overflow on Home / Work /
  Shop Talk / Tools; the offscreen items are intended horizontal carousels.

---

## Remaining findings (fast-follow, none hard-block)

### The founder's exact-target pattern — tools from an active job land generic

**D1 — Invoice/Estimate/Materials/Time/Expense from an active job are NOT scoped
to that job.** *Real · Medium (High for tradesperson) · blocks launch: no.*
`ToolsStudio.tsx:2715` derives `activeJob = jobs.find(status!=="Paid / Closed")
?? jobs[0]` and passes it to Invoice/Estimate/Materials/Time/Expense — ignoring
`focusedActiveWorkId`. Only Photos and Daily-log are scoped. **Repro:** as a
tradesperson with 2+ open jobs, accept an offer, tap **Invoice** on the active-
work card — the invoice prefills site/job-ref from an *unrelated* open job, not
the accepted one. **Fix:** resolve `activeJob` from the focused active-work's
`job` when `focusedActiveWorkId` is set, before the generic heuristic. This is
the single highest-value exact-destination fix.

**D2 — Tradesperson "Open workspace" shows the wrong job in the Work detail
panel; in-detail Invoice/reschedule/cancel unreachable.** *Real · Medium ·
blocks launch: no.* An accepted job is Closed and drops out of the tradesperson's
open-work browse, so `findJobForActiveWork` (`App.tsx:1321`) returns null,
`detailJob` falls back to an unrelated job (`WorkWorkspace.tsx:1414`), and the
active-work card that carries Invoice/reschedule/cancel only renders for the
accepted job — so those actions can't be reached. The top "You're active now"
strip is correct, but has no Invoice button. **Fix:** merge the active-work's
`job` (already on `CanonicalActiveWork.job`) into the Work detail resolution
keyed by `focusedActiveWorkId`.

### Notifications with a lying or conditional CTA

**N1 — `review` notification says "Open review" but lands on the generic Reviews
tab.** *Real · Medium · blocks launch: no (but trust-critical).* Verified
myself: label at `useActivityFeed.ts:55` promises "Open review"; handler
`App.tsx:1962-1963` just does `handleNavigate("Reviews")` — no review focus, and
no `reviewId` is propagated to the client. The one genuine label-lie in the set.
**Fix:** propagate `reviewId` (already the `sourceId`), set a `focusedReviewId`
before navigating, scroll/expand it — mirror the `focusedActiveWorkId` pattern.

**N2 — `offer` deep-link is conditional on the job being in the local `jobs`
array.** *Real (conditional) · Medium · blocks launch: no.* `App.tsx:1971-1976`
— if `jobs.find(jobId)` misses (the offer's job may not be in the tradesperson's
loaded list), it falls to a bare `handleNavigate("Work")` (generic tab). **Fix:**
stash `jobId` and resolve/select after `reloadJobs()`, or route through the
accepted active-work workspace.

### Lower severity / polish

- **N3** `project` completion → the exact job's Records, but ignores
  `metadata.submissionId` (job-scoped, not submission-scoped). Low.
- **N4** No `support` notifications are emitted at all — the "Open support"
  handler + label are dormant; a user whose case gets an admin reply gets no
  in-app deep link. Low/med gap (not a dead-end). `server/index.js:2578-2621`.
- **N5** No community-activity notifications exist (by design so far). Low.
- **F3** Camera has no job picker when multiple active jobs exist — the second
  active job's live feed is only reachable via deep-link/Records, not a switcher.
  `JobPhotosTool.tsx:646`. Low-med.
- **F5** A freshly-uploaded still-processing photo (null signedUrl) is filtered
  out (correctly not blank) but *vanishes* until a later refetch surfaces the
  URL. Low polish. `JobPhotosTool.tsx:855`.
- **F7** `focusedActiveWorkId` is sticky across non-Work nav — opening Photos
  generically from the hub afterward jumps into the last active job's gallery
  (same account only). Low. `ToolsStudio.tsx:3262`.
- **Chrome dedup** (all low, founder's "remove duplicate CTAs" ask):
  - Home has **three** links to Shop Talk (Communities "See all" + two Trending
    "See all"s) plus the bottom-nav Shop Talk — delete the redundant Trending
    footer link `TradeFeed.tsx:627-633`.
  - FAB duplicates the get-started checklist's primary action while onboarding
    is visible (`TradeFeed.tsx:635-643`).
  - Dead unused onboarding `body` copy on every checklist step
    (`TradeFeed.tsx:126-133,252-333`).
  - **Recent-tools shows "Heavy 16th" immediately above the primary list that
    also leads with "Heavy 16th"** — same tool twice back-to-back (live-observed
    at 375px). Dedupe the recent row against the primary launchers.
- **Community edge (low):** a name that slug-collides with a hidden
  (contractors-only) community the creator can't see bypasses the friendly
  duplicate warning and hits an uncaught unique-violation → **500** instead of a
  clean 422. Catch PG `23505` in the create INSERT. `server/communities.js`.

---

## Recommended fast-follow train (post-launch or day-of, all small)

1. **D1** Scope Invoice/Estimate/Materials/Time/Expense to the focused active
   work (the founder's core exact-destination gap).
2. **D2** Resolve the accepted job in the tradesperson Work detail.
3. **N1** Deep-link `review` notifications to the exact review (trust-critical).
4. **N2** Make the `offer` deep-link resolve after reloadJobs.
5. Chrome dedup: kill the redundant Shop Talk link + dedupe recent-tools vs
   primary list.
6. Community slug-collision 500 → 422.
7. Polish: N3/N4 (support notifications), F3 (camera job picker), F5/F7.

## Codex build prompt (fast-follow)

> Branch `codex/exact-destination-followup` off master (96c713e). All small
> diffs, no schema changes. Theme: close the last "generic section instead of
> the exact object" gaps.
>
> 1. **Scope tools to the focused active job.** In `ToolsStudio.tsx:2715`,
>    when `focusedActiveWorkId` is set, derive `activeJob` from that active-
>    work's `job` (`CanonicalActiveWork.job`) before the `jobs[0]` fallback, so
>    Invoice/Estimate/Materials/Time/Expense prefill from the accepted job — not
>    an unrelated open one.
> 2. **Resolve the accepted job in Work detail (tradesperson).** Merge the
>    active-work's `job` into WorkWorkspace's detail/list resolution keyed by
>    `focusedActiveWorkId` so `detailJob` and its Invoice/reschedule/cancel card
>    render for the accepted job even when it's absent from the open-work browse
>    (`App.tsx:1321`, `WorkWorkspace.tsx:1414`).
> 3. **Deep-link `review` notifications.** Propagate `reviewId` (the `sourceId`)
>    in metadata; in `handleOpenNotification` (`App.tsx:1962`) set a
>    `focusedReviewId` before `handleNavigate("Reviews")` and have the Reviews
>    view scroll/expand it — mirror `focusedActiveWorkId`. Fixes the "Open
>    review" label-lie.
> 4. **`offer` deep-link fallback.** In `App.tsx:1971`, if no local job match,
>    stash `jobId` and select it after `reloadJobs()` resolves.
> 5. **Chrome dedup.** Delete the redundant Trending "See all in Shop Talk"
>    footer (`TradeFeed.tsx:627-633`); dedupe the recent-tools row so it doesn't
>    repeat a tool that also leads the primary launcher list; drop the unused
>    onboarding `body` fields.
> 6. **Community slug-collision.** Catch PG `23505` in the community-create
>    INSERT (`server/communities.js`) and return `422 COMMUNITY_NAME_UNAVAILABLE`
>    instead of a 500.
>
> Verify: build/lint/unit/e2e + mobile-actions smoke. Live probes: (a) as a
> tradesperson with 2+ open jobs, accept an offer → tap Invoice on the active
> card → invoice prefills the ACCEPTED job; (b) tap a review notification →
> lands on that exact review; (c) Home shows one Shop Talk "See all", no
> back-to-back duplicate Heavy 16th; (d) create a community whose name collides
> with a hidden one → clean error, no 500. Deploy, confirm /api/health, run
> monitor:production.
>
> Non-goals: support notifications, camera job picker, community-activity
> notifications, still-processing-photo polish — separate ticket.

---

**Doc location note:** this is on `claude/new-session-2wxmgd` with the earlier
audits, NOT master — the same gotcha that hid the last handoff from a fresh
Codex checkout. Say the word and I'll cherry-pick the audit/spec docs onto
master so Codex sees them by default.
