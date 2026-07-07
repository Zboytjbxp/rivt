# RIVT Quality-of-Life Audit — master @ 35ae759 (2026-07-05)

Production = origin/master = `35ae759` (confirmed via /api/health). Lens: make
everyday use faster, easier, more efficient — friction reduction, not bug
hunting. Method: three parallel code reviewers (navigation/deep-link/badges;
tools & records daily-use; list-feed & input ergonomics) all citing file:line
against this exact commit, plus a live drive (community-create flow,
notifications panel, tools hub, taps-to-task). No branch switch occurred during
the audit, so no cross-branch contamination.

## Heads-up before anything else

**The community-privacy option you described (contractors-only / tradespeople-
only / public) is NOT in the live build.** I verified both ways: creating a
community on production goes straight to a public community with no audience
choice (and no confirm step), and `server/communities.js` + the migrations have
no audience/visibility/private concept at all. It's either sitting on an
unmerged branch or still to be built — worth confirming before you count it as
shipped. Everything below is what IS live on 35ae759.

Also a correction to one of your examples: **Shop Talk answer/reaction
notifications don't exist yet** — those events only write audit-log rows
(`server/shop-talk.js:664,739`), they never call `createInAppNotification`, so
there's nothing to tap through for the single most active part of Shop Talk.
The tap-through you shipped works for `message` and `offer`; it dead-ends for
`project` and `review` (see Theme C).

---

## The one theme that matters most: **the app forgets everything**

Every one of the three reviews landed on the same root cause independently.
Filters reset, tool settings reset, half-built drafts vanish, and the same
rate/client/units get re-typed across tools — all because working state lives
in ephemeral React `useState` that dies on navigation, and the tools don't read
the data the app already has. Fixing this ONE pattern removes the largest daily
annoyance for a Jacksonville tradesperson, and almost every piece is a small
diff. This is the spine of the build plan.

---

## Theme A — "Remember my stuff" (stickiness) — highest leverage, mostly small

| # | Friction today | Fix | file:line | effort/impact |
|---|---|---|---|---|
| A1 | Calculator metric/imperial resets to imperial on **every open** (metric users re-tap MET→ON all day) | persist `inputMode` to localStorage, read in initializer | `FieldCalculatorTool.tsx:143` | S / **high** |
| A2 | Estimate rate/overhead%/margin%/contingency% reset to hardcoded 65/12/18/7 every open | persist last-used, seed from them | `EstimateTool.tsx:36-43` | S / **high** |
| A3 | Invoice payTo (your own company!), paymentMethod, terms, taxPct reset every mount | make these sticky defaults + a "Duplicate last invoice" | `InvoiceDraftTool.tsx:114-120` | S/M / **high** |
| A4 | Working tool forms (Estimate has NO persistence; Invoice/Bid persist only saved records) are **lost on nav-away** — real data loss mid-workday | debounced autosave of the live draft to localStorage, rehydrate on mount (WorkWorkspace already does this for change orders/notes) | `EstimateTool.tsx:166-173`, `InvoiceDraftTool.tsx:113-128` | M / **high** |
| A5 | Work filters (trade/difficulty/type/location/verified) reset on every reload/new session | persist the filter tuple to localStorage, hydrate initializers | `App.tsx:402,419-424` | S / med |
| A6 | Shop Talk sort + trade/flair filters reset on **every visit** (worse — the view unmounts) | persist to localStorage (bookmarks already persist right next to them) | `ShopTalkView.tsx:632-661` | S / med |
| A7 | Bid default markup % resets to 15 every mount | persist last-used | `BidBuilderTool.tsx:167` | S / low |
| A8 | Camera capture intent resets to "progress" every mount | persist last intent | `JobPhotosTool.tsx:661` | S / low |

**Do this as one shared "field defaults" localStorage store** (units, hourly
rate, overhead/margin, payTo/payment method, last client, default markup) that
every tool initializer reads. `TaxEstimatorTool` (`ToolsStudio.tsx:919-929`) is
the model already in the codebase.

## Theme B — "See what needs me" (attention/badges)

| # | Friction | Fix | file:line | effort/impact |
|---|---|---|---|---|
| B1 | Messages icon has **no unread badge** — unread work threads are invisible from the top bar. The count is ALREADY computed and only used to fire an OS notification | pass the existing `inboxConversations.reduce(...unreadCount)` value into an AppShell `messageCount` prop, render a badge like the bell already has | value at `App.tsx:957`; render at `AppShell.tsx:214-216` (bell badge pattern at `:217-220`) | S / **high** |
| B2 | No "applications awaiting review" signal anywhere — a contractor drills into each job to find who applied | Home card ("N applicants waiting on Job X") and/or a Work-nav badge; the pipeline data exists in WorkWorkspace | `AppShell.tsx` nav + `TradeFeed.tsx` | M / **high** |
| B3 | Messages auto-selects the newest thread, not the newest **unread** one — user still hunts for the unread row | "jump to unread" affordance; `unreadCount` is already rendered per row | `App.tsx:861-865`, `InboxCenter.tsx:1044` | S / med |

The `tradeQuestions` nudge on Home (`TradeFeed.tsx:378-387` — "N {trade}
questions need a hand", tappable) is the model B1/B2 should copy: a count that
is also a one-tap shortcut, not just a number.

## Theme C — "One tap to the thing" (deep-linking / navigation)

| # | Friction | Fix | file:line | effort/impact |
|---|---|---|---|---|
| C1 | `project` + `review` notifications are labeled "Open records"/actionable but **go nowhere** — they fall through to a toast when the referenced active-work isn't in the client cache, and even in the happy path land on Work instead of Tools/Profile | add two handler branches before the `addActivity` fallback honoring `/app/tools` and `/app/profile` | handler `App.tsx:1225-1271` (fallback at `:1270`); labels `useActivityFeed.ts:14-35` | S / med |
| C2 | Shop Talk answer/reaction/verified-fix produces no notification at all — the busiest part of Shop Talk can't notify or deep-link | server emits `createInAppNotification` with `metadata.postId` (already have postId at `shop-talk.js:669`); add a client branch calling the existing `onOpenPost` deep-link | `server/shop-talk.js:664,739`; existing open-by-postId at `App.tsx:2027` | M / **high** |
| C3 | Camera from the hub is ~3 taps to shutter (hub card → camera-home → Shoot → shutter) | hub Camera card deep-links straight into live capture when an active job exists | `ToolsStudio.tsx:3199-3202`, `JobPhotosTool.tsx:873-905` | M / med |
| C4 | Tools hub shows a fixed list; 15 of 20 tools are 2 taps (behind collapsed Money/Site/Business groups); no personalization | add a "Recent" row (localStorage MRU stamped on `openToolFromHub`); optionally long-press to pin | render `ToolsStudio.tsx:3282-3302`, stamp `:2717` | M / med |
| C5 | No "review applicants" or "resume draft" quick action on Home | add cards (draft data already at `TradeFeed.tsx:150`) | `TradeFeed.tsx` | S–M / med |

## Theme D — "Don't make me re-type" (cross-tool data reuse)

The app already stores clients, rate cards, and trade — but the tools don't read
them. Every row here is data the user re-types that the app already has.

| # | Friction | Fix | file:line | effort/impact |
|---|---|---|---|---|
| D1 | A full synced **Client store exists** (`client-records.ts`) but **no tool imports it** — the same client is re-typed as Invoice billTo/email/phone, Bid jobRef, Mileage jobRef, Contract clientName | a shared "Client" picker that prefills from `client-records.ts` | `client-records.ts:11-27`; consumers `InvoiceDraftTool.tsx:372-377`, `BidBuilderTool.tsx:290`, `ToolsStudio.tsx:468,1417` | M / **high** |
| D2 | Saved hourly rate (`readPrimaryHourlyRate`) is ignored by every pricing tool — Estimate hardcodes 65, Invoice uses job.pay/65, Bid uses hardcoded per-trade rates (three different wrong defaults for one number) | seed all three from `readPrimaryHourlyRate()` | `rateCard.ts:90`; `EstimateTool.tsx:37`, `InvoiceDraftTool.tsx:95`, `BidBuilderTool.tsx:18-90` | S / **high** |
| D3 | Job editor doesn't prefill trade — hardcoded "Electrical" for everyone | pass `primaryProfileTrade`, use as default | `JobEditorModal.tsx:94` | S / med |
| D4 | Daily log re-types trade as free text though profile has it | seed from `rivt.profile.v1.primaryTrade` (Price book/Bid already do) | `DailyLogTool.tsx:295` | S / med |
| D5 | Labor hours live in 4 tools with no flow (TimeTracker/DailyLog hours can't become an Invoice line) | "Add to invoice" from a completed time session / daily log | TimeTracker `:196`, Invoice lines | L / high |
| D6 | Price book prices only copy a string to clipboard — Bid/Invoice lines are hand-typed | "Insert from price book" on a line | `ToolsStudio.tsx:771-778` | M / med |

## Theme E — small ergonomics (cheap polish, real daily wins)

- **E1** Shop Talk answer composer has no keyboard submit — add Cmd/Ctrl+Enter (Inbox composer already does Enter-to-send). `ShopTalkView.tsx:1550`. S/med.
- **E2** Instant deletes with no confirm/undo on: payment milestones, change orders, site contacts, job notes, invoice lines, bid lines. Prefer a 5s Undo toast (cheaper than a modal, better UX). `WorkWorkspace.tsx:299,605,712,799,881`, `InvoiceDraftTool.tsx:214`, `BidBuilderTool.tsx:227`. M/med.
- **E3** Calculator "Copy result" dumps a 3-line branded block ("RIVT Heavy 16th\nResult:…\nMetric:…") — copy just the value (`5' 6 1/2"`) so pasting into a text to a helper is clean. `FieldCalculatorTool.tsx:318-331`. S/med.
- **E4** No refresh anywhere on Shop Talk (fetches once on mount, silently goes stale); Work has retry-on-error only. Add a refresh button (RefreshCw already imported) + mobile pull-to-refresh. `App.tsx:827-831`. M/med.
- **E5** Currency fields use `type="number"` (spinners, rejects locale decimals) — switch money fields to `inputMode="decimal"` (ExpenseLogger already does). `EstimateTool.tsx:167-173`. S/low.

---

## Recommended first train — "Remember & Surface" (all small, high daily payoff)

The tightest high-impact set, almost all effort-S, no schema changes:

1. **B1** Unread-message badge (value already computed — nearly free).
2. **A1** Sticky calculator units.
3. **A2** Sticky estimate rate/percentages.
4. **A3** Sticky invoice payTo/terms/method/tax + "Duplicate last invoice".
5. **A5 + A6** Persist Work and Shop Talk filters.
6. **A4** Autosave working tool drafts (prevents mid-day data loss).
7. **D2** Seed all pricing tools from the saved rate card.
8. **C1** Fix the project/review notification dead-ends.
9. **D3** Prefill job trade from profile.
10. **E3** Copy calculator value only.

Second train (more surface area): B2 applicants badge/card, C2 Shop Talk
notifications + deep-link, D1 shared Client picker, C4 recent-tools row, C3
camera one-tap, D5 hours→invoice, E1/E2/E4 ergonomics.

## Codex build prompt (first train)

> Branch `codex/qol-remember-surface` off master (35ae759). Theme: the app
> forgets everything — make it remember, and surface what needs attention.
> All small diffs, no schema changes.
>
> 1. **Unread-message badge.** Pass the already-computed unread total
>    (`App.tsx:957`, `inboxConversations.reduce(...unreadCount)`) into AppShell
>    as `messageCount`; render a badge on the Messages icon
>    (`AppShell.tsx:214-216`) matching the bell badge (`:217-220`).
> 2. **Shared "field defaults" store.** Add a tiny localStorage-backed helper
>    (units, hourlyRate, overhead/margin/contingency %, invoice payTo/
>    paymentMethod/terms/taxPct, bid markup). Seed from it and write back on
>    change in: FieldCalculatorTool (`:143` inputMode), EstimateTool
>    (`:36-43`), InvoiceDraftTool (`:114-120`), BidBuilderTool (`:167`). Model:
>    TaxEstimatorTool `ToolsStudio.tsx:919-929`.
> 3. **Seed pricing tools from the rate card.** Use `readPrimaryHourlyRate()`
>    (`rateCard.ts:90`) as the default in EstimateTool (`:37`), InvoiceDraftTool
>    (`:95`), BidBuilderTool (`:18-90`) instead of hardcoded 65/per-trade.
> 4. **Autosave working tool drafts.** Debounced localStorage autosave +
>    rehydrate-on-mount for the live (unsaved) form in EstimateTool
>    (`:166-173`) and InvoiceDraftTool (`:113-128`). Same pattern WorkWorkspace
>    uses for change orders/notes (`:213,783`). Clear the draft on
>    submit/export.
> 5. **Persist list filters.** Work filter tuple (`App.tsx:402,419-424`) and
>    Shop Talk sort/trade/flair (`ShopTalkView.tsx:632-661`) to localStorage,
>    hydrate initializers.
> 6. **Add "Duplicate last invoice"** in InvoiceDraftTool from the sticky
>    defaults + last line items.
> 7. **Fix project/review notification dead-ends.** In handleOpenNotification
>    (`App.tsx:1225-1271`), add branches BEFORE the `:1270` toast fallback:
>    `sourceType==="project"` → open Tools/Records (use `metadata.submissionId`),
>    `sourceType==="review"` → navigate profile. Honor their `actionHref`.
> 8. **Prefill job trade.** Pass `primaryProfileTrade` into JobEditorModal;
>    replace hardcoded `"Electrical"` default (`:94`).
> 9. **Calculator copy = value only.** `FieldCalculatorTool.tsx:318-331` — copy
>    the primary measurement string, drop the branded 3-line block.
>
> Verify: build/lint/unit/e2e + mobile-actions smoke. Live probes: (a) set
> calculator to metric, leave & reopen → still metric; (b) build an estimate,
> tap to Messages and back → estimate intact; (c) create an invoice, create a
> second → payTo/terms prefilled; (d) unread thread shows a badge on Messages;
> (e) a project notification opens Records, not a dead toast. Fresh 375×553
> screenshots of the tools hub and Messages badge. Deploy, confirm
> /api/health, run monitor:production. Hand off with Branch/Commit/Pushed/
> Deployed/Verified/Probes/Boundary.
>
> Non-goals this train: applicants badge, Shop Talk notifications, shared
> Client picker, recent-tools row, hours→invoice, undo toasts, pull-to-refresh
> — second train (tracked in this doc).

---

**Where this doc lives:** branch `claude/new-session-2wxmgd` (with the earlier
audits). If you want Codex to read it from a fresh master checkout, I can
cherry-pick it onto master — say the word (this is the same branch-location
gotcha that bit the last handoff).
