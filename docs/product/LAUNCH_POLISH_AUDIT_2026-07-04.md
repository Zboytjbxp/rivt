# RIVT Launch Polish Audit — master @ ef32b88 (2026-07-04)

Method: full read of ToolsStudio/ShopTalkView/ProfileHub/AuthScreens/App and server
modules by five parallel reviewers, **plus a live drive of the real app** (fresh
signup → onboarding → post → answer → verified fix → estimate → invoice → settings)
at 390×664 with a real PostgreSQL backend at migration 0021. Findings marked
**[LIVE]** were reproduced on screen, not just in code.

Verdict up front: the platform core is genuinely solid — server-owned communities,
posts, answers, verified-fix (403 for non-authors), moderation queue, honest member
counts, fail-closed billing, 2-tap cancellation. What remains is a launch-honesty
and mobile-reachability cleanup, concentrated in Tools and copy.

## Top 20 findings (prioritized)

### Launch blockers

**1. Shop Talk composer's Post button is unreachable on phones. [LIVE]**
At 390×664 the "Create a post" modal is ~880px tall with **no scrollable
ancestor** (measured: button at y=837, viewport 664, overflow chain empty).
A phone user cannot tap Post — the primary Shop Talk write action is dead on
mobile. I could only submit via programmatic click.
Fix: make the modal body `overflow-y: auto` with a sticky footer action bar.

**2. Estimate→Invoice banner contradicts the invoice total. [LIVE]**
`src/features/tools/EstimateTool.tsx:53` rounds the estimate target up to the
next $25 ($1,100), but converted line items sum unrounded ($1,088). Both numbers
render on the same screen: "TOTAL DUE $1,088" directly under "Converted from
estimate target $1,100". Fix: quote the actual line sum in `sourceNote`
(EstimateTool.tsx:134) or add a rounding-adjustment line.

**3. Converted invoices expose internal margin — and price-guidance flags it as "LOOKS HIGH". [LIVE]**
`EstimateTool.tsx:111-125` emits "Overhead" and "Margin and contingency" as
client-facing lines; the invoice tool then runs hourly-labor guidance against
them: on screen, "Overhead $92 — IN RANGE — General skilled labor: $45–$95 per
hour" and "Margin and contingency $226 — LOOKS HIGH". Comparing a margin dollar
line to an hourly rate is nonsense and shows a client the contractor's profit.
Fix: fold overhead/margin proportionally into labor/materials rates; only apply
price guidance to labor-type lines.

**4. Bid builder hides its total and Accept button on every phone.**
`tools-studio.css:3180` — `.v2-bid-summary-stack { display:none }` under 900px
removes the bid total, breakdown, and the only "Accept bid" button. Same
anti-pattern hides the mileage YTD summary (css:3235) and safety sign-off history
(css:3724). Fix: sticky bottom summary bar on mobile, never `display:none`.

**5. "Sync will retry" is fiction in 13 tools.**
"Saved on this device. Sync will retry when your account is reachable." /
"Cloud sync will catch up when reachable." (ToolsStudio.tsx:419, 734, 1082, 2060;
BidBuilderTool.tsx:216,262; InvoiceDraftTool.tsx:218; etc.) — there is **no retry
queue**; `upsertToolRecord` drops failed writes (tool-records-api.ts:52-69), and
failed deletes silently resurrect. Fix: honest copy ("Could not sync — saved on
this device only") or build the queue. Related: local backfill only runs when the
server has zero records of a type, so partial loss is permanent.

**6. Bid builder's "✓ Job created! Open the Work tab to find it." is false.**
`BidBuilderTool.tsx:358, 266-290` writes to localStorage `rivt.jobs.v1`; the Work
tab renders server jobs only. The promised job never appears. Fix: remove the
accept-bid→job path or wire it to the real jobs API.

**7. Consent screen claims an ID gate that doesn't exist.**
"Government ID check required before posting or accepting work"
(`src/brandConfig.ts:43`, shown at onboarding consent) has zero server-side
implementation — my fresh unverified-ID account posted immediately. Under the
trust-language contract this is an overclaim in the inverse direction: promising
users protection that isn't there. Fix: remove the line until an ID provider is
live, or soften to what's true today.

**8. Settings storage always reports 0 B (production).**
`src/App.tsx:518` reads `storageBody.usedBytes` but the server returns
`accountStorage.usedBytes` (server/index.js:985-989) — the check always fails and
zeros render regardless of real uploads. Also: the 90% "uploads are rejected"
warning (ProfileHub.tsx:368) describes enforcement that no upload route performs.
Fix: read the right key; soften or implement the quota.

**9. Support is a dead end; the feedback form fakes success.**
`ProfileHub.tsx:1222-1228` shows "Sent!" without transmitting anything, next to
"Notes are reviewed by the RIVT team" and "Replies go to {email}" (:1287-1288).
No support mailto/help page exists anywhere in the product, while storage copy
says "contact support". Fix: POST feedback to the server + one real support
mailto row; until then remove the form.

**10. Legal documents are unreachable and consent review is a no-op.**
Terms/Privacy/Subcontractor Agreement rows have no links (ProfileHub.tsx:1332-1343),
"Request data export" has no onClick (:1383-1386), "Review consent" is wired to
`() => {}` (ProfileRoute.tsx:193). For a public launch the ToS/Privacy must be
readable in-product. Fix: link real docs; wire or remove the two buttons.

**11. Notification toggles are decorative.**
Four Settings toggles (Job matches/Messages/Shout-outs/Safety updates,
ProfileHub.tsx:1705-1728) are `useState` only — reset on reload, honored by
nothing. Fix: persist server-side and honor them, or drop the panel. (The
"Trade personalization" switch in the same panel triggers a full page reload
with no visible effect — see #14.)

**12. Onboarding renders duplicated step panels with contradictory numbers. [LIVE]**
Every step shows a summary panel ("STEP 1 OF 4 — What are you here to do first?")
immediately above the real panel ("STEP 2 — What are you here to do first?") —
same question twice, numbers off by one, through "STEP 4 OF 4"/"STEP 5"
(AuthScreens.tsx:1152 vs :1181-1348). Also [LIVE]: a mid-onboarding reload loses
all progress (state is client-only until completion). Fix: derive numbers from
`setupSteps.indexOf(id)+1`, render one panel per step, persist step data as you go.

### High-value polish

**13. Earnings dashboard ships permanently at $0.**
`App.tsx:343` — `paymentRecords` has no setter; the dashboard's "Total earned /
Payment history" panels can never populate (EarningsDashboardTool.tsx:122-133).
Fix: read real `payment_record` tool-records, or flag the tool off for launch.

**14. Two whole engagement systems are dead code.**
(a) The Home "Get RIVT working for you" checklist can never render — condition
inverted: `!onboardingComplete && …` but Home only mounts when onboarding is
complete (TradeFeed.tsx:248). (b) The persona system reads localStorage
`rivt.profile.v1` that only the unreachable `LocalSetupPrompt` writes
(usePersona.ts:10, App.tsx:372) — personalization in ShopTalk/Work/Tools never
activates for real accounts. Fix: flip the checklist condition; derive persona
from the server profile's primary trade; delete LocalSetupPrompt.

**15. New accounts are pre-seeded with fake progress.**
`App.tsx:334-340` seeds "Signed scope", "Legal consent accepted" records and a
completed "Customer-site conduct" training for every session, driving non-zero
progress meters (`SETUP_RECORD_BASELINE = 2`, TradeFeed.tsx:29 compensates).
Violates the no-fake-data rule. Fix: start empty, delete the baseline constant.

**16. Feed cards contradict the server: wrong community, phantom votes. [LIVE]**
My post in user-created "Jacksonville Carpentry" renders as "Carpentry Talk"
(TradePostCard.tsx:19-31 derives from `trade`, ignoring `communityName`).
Card votes live in localStorage and diverge from the server reaction ledger the
detail view uses (TradePostCard.tsx:47-76 vs useCommunityReactions); local
verify fabricates `Math.max(upvotes, 3)` (App.tsx:1011). Fix: prefer
`post.communityName`; route card votes through the server reactions; drop the
`,3`.

**17. Device-local "rep" and badges masquerade as durable reputation.**
"{n} rep", "First Assist/Trade Mentor/Top Hand" badges compute from per-device
localStorage while the server's real `reactionSummary` is received and discarded
(ShopTalkView.tsx:945-954, :586, community-utils.ts:135-144). Risk R-024's exact
failure mode. Fix: drive from server data or remove the labels for launch.

**18. Tools hub carries 21 tools; ~7 duplicate each other.**
Three line-item builders (Estimate/Bid/Invoice), two daily logs writing the same
`daily_report` record type (DailyLogTool.tsx:73 vs ToolsStudio.tsx:2232 — the log
downloads reports just to filter them out), two SE-tax calculators with different
answers (ToolsStudio.tsx:903-912 vs :2558-2559), three disconnected money
dashboards, duplicated per-trade price catalogs (ToolsStudio.tsx:514-595 vs
BidBuilderTool.tsx:13-91), and a mileage double-deduction path (expense category
+ mileage tool both feed Tax summary). Consolidation plan in the build prompt.

**19. Invoice money hygiene.**
Whole-dollar display rounding makes lines not sum to subtotal
(InvoiceDraftTool.tsx:9-11); negative qty/rate accepted and rendered "$-325"
(:351-352); three different currency formatters in one flow; quantities render
"8.0 × $65"; mobile line grid gives the 58px column to rate so "$2,500" clips
(tools-studio.css:6366-6369). No dismiss/"start blank" on the conversion banner,
and two stacked conversion banners render at once [LIVE]
(InvoiceDraftTool.tsx:303 + :309). Fix bundle in build prompt Phase 1.

**20. Copy/pluralization sweep. [LIVE unless noted]**
"1 members / 1 posts" on community pages (ShopTalkView.tsx:1036-1037, 1123);
"QUE Question / LOO Looking for Sub" chip stutter in the composer
(ShopTalkView.tsx:410 renders `label.slice(0,3)` beside the label); "Joined"
rendered twice on community pages; landing cards say "Example question" twice
per card; auth preview leaks policy-speak to users ("without pretending anything
is live work", "RIVT shows an honest empty state"); contractor's own Settings
rate card says "so contractors know what to expect when they view your profile";
"Founding beta" plan tile contradicts "Free plan" card on the same screen
(App.tsx:277 vs PlanCard); raw env vars shown to users ("Configure
STRIPE_SECRET_KEY…", ProfileHub.tsx:1023); duplicate Service-radius controls
with different option sets (ProfileHub.tsx:1459 vs :1465); phone-mockup clock
clips to "9:2"; Heavy 16th's 4th mode tab clips to "HARDWAR"; hub list content
bleeds through the translucent bottom tab bar; signup-error banner is
low-contrast pink-on-light [LIVE].

## What to REMOVE
- Daily report tool (merge into Daily log — same server record type). ToolsStudio.tsx:2167-2445.
- Tax estimator tool (merge into Tax summary; keep one SE-tax formula). ToolsStudio.tsx:898-962.
- `LocalSetupPrompt.tsx` + its CSS/state (unreachable duplicate setup flow).
- Pre-seeded fake records/training + `SETUP_RECORD_BASELINE` (App.tsx:334-340).
- "Overhead"/"Margin and contingency" as invoice line items.
- "Government ID check required…" consent line (brandConfig.ts:43) until real.
- Fake feedback form (until wired), dead "Request data export"/"Review consent" buttons.
- `Math.max(reply.upvotes, 3)` (App.tsx:1011).
- Dead CSS: ~194 orphaned selectors ≈ 1,250 lines (17%) of tools-studio.css
  (calc-*, v2-materials-est-*, v2-mileage-tracker-*, v2-photos-*, v2-punch-*,
  v2-invoice-gen-*, suite-*, sheet-*).
- Dead code: `_incrementHelpfulVote`, `_authorRepMap`, `_selectedTradeThreads`,
  `_reactionLedgerLabel` (ShopTalkView), `activatePro`/`getIsPro` (usePro.ts),
  write-only `setCommunityReports` (App.tsx:346), `_answerQueueCount` (App.tsx:758),
  duplicate `PaymentRecord` types, stranded section comments, dead
  `.v2-invoice-line` block (css:1983), keyword bucket-guessing in
  `postBelongsToCommunity` (ShopTalkView.tsx:319-333).
- "Sync will retry"/"cloud will catch up" claims (13 tools) unless queue is built.

## What to RENAME
- "Enter network" → "Open RIVT" (AuthScreens.tsx:1403).
- "Build your trade network" onboarding rail headline → goal-specific copy.
- "Draft, print, send from email." hub card → "Draft, print, or share by email."
- "<title> subcontractor / specialty costs" invoice line → "Subcontracted work".
- "Save bid to device" → "Save bid" (it syncs; button contradicts its own toast).
- Storage "Quota tied to plan" → "Storage limit" + honest beta fallback.
- Answer-queue nudge "N {trade} questions" → "questions in your trades" (it counts General too, TradeFeed.tsx:123-125/342).
- Trade News "1 articles · 1 sources" → plural helper everywhere.

## What to CONSOLIDATE
- Line-item builders: Estimate (quick range) + Bid builder (line items) → one
  Estimate tool with two modes; both convert to Invoice; Invoice is the single
  canonical money document. Payment tracker becomes an Invoice tab fed by
  invoices instead of manual re-entry.
- One shared `useSyncedToolRecords` hook replaces 13 copy-pasted sync effects
  (~500 lines); one shared `currency()`/`quantity()` formatter (4 divergent today).
- One SE-tax formula; Tax summary is the single tax surface.
- Availability: Home chip (localStorage) + server `availabilityStatus` + dead
  `_handleSetAvailability` (App.tsx:848-867) → one server-backed control.
- Shop Talk filters: post-type chips (QUE/LOO/SAF/GEN) + flair chips + legacy
  lane chips (All/Questions/Sub Requests/Safety/General render simultaneously
  with the flair row [LIVE]) → one flair system.
- Service radius: keep the server-backed select, delete `ServiceAreaSelector`.
- Profile completion: compute from the server profile prop, not localStorage.

## Blocker vs polish
- **Blockers (must fix before public launch):** #1–#12.
- **Strong polish (fast follows, same pass if capacity allows):** #13–#17, #19.
- **Scheduled polish:** #18, #20, removals/renames not covered above.

## What already works (don't touch)
Server-owned community creation with dedupe-409 + 1/day limit (verified live:
POST /communities 201, creator auto-owner, real "1 members" count), NOT NULL
`community_id`, server answers + author-only verified-fix 403, full
report→admin-action moderation loop, image-post upload hardening (magic bytes,
sha256, signed URLs), fail-closed entitlements, 2-tap honest cancellation,
onboarding completion persisted server-side, role-correct goal routing
("Find help for a job" → Work feed, kept its promise [LIVE]), honest empty
states across Work/Home/Crew, Heavy 16th mode tabs now readable at 390px.
