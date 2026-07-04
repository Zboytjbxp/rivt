# RIVT Jacksonville Soft-Launch Audit — Two-Pass Review

**Commit audited:** `3c66aac6b48b5b167e13f05ab1949ccfdab14d92` (confirmed via `/api/health` on both `origin/master` and production rivt.pro at time of audit)

**Method:** Five parallel code-review agents (each given a scoped area and required to cite exact file:line, quote copy, and explicitly state when something is already fixed) + live browser verification at 375×553 and 390×664 against a real PostgreSQL-backed local instance running this exact commit. Every P0/P1 finding below was either (a) reproduced live — network requests intercepted, real taps performed, real screenshots captured — or (b) confirmed by direct source read, not just agent say-so. Two findings from agents were checked against live behavior and one was found to be **wrong** (see "Corrections to agent findings" below) — that correction is folded into the findings, not hidden.

Two passes were run: **Pass 1** is a normal senior product/code audit across all 12 requested areas. **Pass 2** is a self-critique — "what 10 things might Pass 1 have missed" — covering session lifecycle, browser-navigation edge cases, and cross-cutting behaviors no single feature-scoped agent would have been asked about.

---

## Executive verdict: **GO after fixes**

The platform core (auth, onboarding gating, communities, server-owned answers, moderation, live Stripe billing with honest cancel/resume, legal docs, support case creation) is genuinely solid — five separate reviewers independently confirmed this and none found a regression in that core. But this pass found **four new P0s** that were missed by the prior launch-QA train, all with real user-trust impact, plus one live-confirmed **session-security gap** that two independent methods (my own repro + a separate agent's code trace) converged on. None require a large rewrite — every fix below is a small, mergeable diff.

**Do not soft-launch until the P0s below are fixed.** They are small: three are single-function guard clauses or a button-wiring split, one is a copy fix.

---

## PASS 1 — Findings

### P0 — Launch blockers

**P0-4. The Heavy 16th calculator's kerf and pieces controls are completely unreachable through the shipped UI — on every device, not just mobile.**
- **What user sees:** The calculator's top-left button is labeled "Tools," not a menu icon. Tapping it always navigates away to the Tools hub. There is no other control anywhere on screen to open the drawer that holds "Blade kerf 1/8 in" and the "Pieces" +/- stepper — both are advertised, load-bearing features (the copy-result output literally includes "Cut length: … after 1/8 in kerf" and "Pieces: N"), and neither can be set by any user through any interaction path.
- **Why it matters:** This isn't a responsive-design gap — it's a single hardcoded call site. Root cause: the component's drawer-toggle button does `onClick={onBack ?? (() => setDrawerOpen(...))}` — i.e., it only opens the drawer when no `onBack` prop is supplied. The **only** place this component is ever rendered (`ToolsStudio.tsx:2362`) always passes `onBack`. So `setDrawerOpen(true)` is structurally unreachable in production, on desktop or mobile. **I confirmed this live**: tapped the calculator's top-left button — it read "Tools" (not a hamburger icon) and navigated straight back to the Tools hub, exactly as the code predicts. A separate, lower-specificity CSS rule that would have hidden the drawer on mobile even if it could open (`tools-studio.css:6113-6116` groups `.is-open` into the same `display:none` declaration as the closed state) is a second, independent blocker layered on top.
- **File:line:** `src/features/tools/FieldCalculatorTool.tsx:295-300` (button), `:107` (`onBack?` prop), `:359-375` (kerf toggle + pieces stepper, both only inside the unreachable drawer); single call site `src/features/tools/ToolsStudio.tsx:2362` (`<FieldCalculatorTool activeJob={activeJob} onBack={() => setActiveTool("hub")} />`); CSS double-block at `tools-studio.css:6113-6116`.
- **Recommended fix:** Give the calculator its own dedicated drawer-toggle button, separate from "back to Tools hub" — don't overload one button for two purposes via a prop-presence check. Delete/fix the CSS rule at `tools-studio.css:6113-6116` so it can't mask the real fix once the button is separated.
- **Acceptance criteria:** From the Heavy 16th calculator, a user must be able to open the tool drawer and change "Blade kerf" and "Pieces" without leaving the calculator, on both desktop and phone widths.

**P0-1. A Shop Talk post can silently fail to save while telling the user it succeeded.**
- **What user sees:** Type a post, tap Post, see it appear at the top of the feed with a normal-looking success state (vote/comment counters, community label). Nothing indicates anything went wrong.
- **Why it matters:** If the server rejects the post for *any* reason — a locked/archived community (real 409 path confirmed at `server/shop-talk.js:228`), a transient 5xx, a dropped connection, a rate limit — the client falls through to inserting a client-only "local" post and shows a positive "Shop Talk post created" toast regardless. **I reproduced this live**: intercepted `POST /api/v1/shop-talk/posts` to return a simulated 500, posted through the real UI, and the post appeared in the feed with a normal success state — then vanished on page reload, proving it was never persisted and no one else ever saw it. For a tradesperson posting an urgent job-site question, this is actively harmful: they believe they've asked for help and move on.
- **File:line:** `src/App.tsx:1143-1204` (`handleNewShopTalkPost`) — `let postToAdd = localPost` (1177) is only overwritten inside `if (serverPost)` (1188); when `serverPost` is `null` the function falls through to insert `postToAdd` into the feed (1195-1198) and fire a success `addActivity(...)` (1199-1204) with no failure branch at all. Compare the correct pattern already used elsewhere in the same file: `handleAddCommunityAnswer` (`App.tsx:986-993`) shows "Shop Talk answer not saved" and returns early on failure.
- **Recommended fix:** Only build/show `localPost` on the guest/offline branch. For authenticated + onboarded users, if `createShopTalkPost` returns `null`, show an explicit failure toast ("Your post could not be saved — try again") and do not insert anything into `communityPosts`.
- **Acceptance criteria:** With the create-post endpoint forced to fail (test via route interception or a temporarily locked community), the UI must show a failure state and the post must NOT appear in the feed; a successful post must still work exactly as before.

---

**P0-2. Every fresh account starts with fabricated "records" and "training" progress it never earned.**
- **What user sees:** Immediately after finishing onboarding, before touching any tool, the Account panel shows "Records 2/6" and a Training progress bar at "25%" complete.
- **Why it matters:** This is fabricated trust data shown to a real authenticated user on day one — a brand-new Jacksonville pilot contractor is told they already have a signed scope and completed training they never did. This is precisely the category of issue the product contract explicitly forbids (no fake activity, no fake progress).
- **File:line:** `src/App.tsx:335-337` — `useState<Set<string>>(() => new Set(["Signed scope", "Legal consent accepted"]))`; `src/App.tsx:339-340` — `useState<Set<string>>(() => new Set(["Customer-site conduct"]))`. Rendered raw at `src/app-shell/AppPanels.tsx:199-208` and `src/features/profile/ProfileHub.tsx:1719-1731`. Note the team already half-knows this is fake: `src/features/home/TradeFeed.tsx:29` defines `SETUP_RECORD_BASELINE = 2` specifically to subtract this baseline back out when deciding whether to show the Home "Get started" checklist — but that correction is applied in exactly one place and not to the Account panel/Settings counters that show the raw, inflated number.
- **Recommended fix:** Initialize both sets empty (`new Set()`), or derive them from real server state. Apply the existing `SETUP_RECORD_BASELINE` subtraction everywhere the raw count is displayed, or better, remove the fake baseline entirely so every surface agrees.
- **Acceptance criteria:** A freshly onboarded account (no jobs, no manual actions) shows 0/0 records and 0% training everywhere the count/percentage is rendered.

---

**P0-3. "Safety Training" certificates are never persisted anywhere — refresh the page and they're gone.**
- **What user sees:** Completing an OSHA-style safety quiz shows "Certificate earned" and copy stating *"This certificate is now on your safety record."* A "Certified" badge appears. Reload the page (or log in from another device) and the certificate is gone with no way to recover it.
- **Why it matters:** This claims a durable, safety-relevant credential ("on your safety record") for something that is pure in-memory React state — not localStorage, not the server. On a trades platform, safety-certification claims that silently evaporate are a serious, specific trust break, worse than a generic bug.
- **File:line:** `src/App.tsx:342` — `useState<Record<string, SafetyQuizResult>>({})`, confirmed via direct read: no localStorage write, no fetch/POST call anywhere in the codebase for this state (grepped `safetyQuizResults` — every reference is `useState`/prop-drilling only). Overclaiming copy at `src/features/profile/ProfileHub.tsx:220-225` ("Certificate earned" / "This certificate is now on your safety record") and `:334-337` ("Certified" badge). No `safety_quiz`/`certification` table or endpoint exists in `server/index.js`.
- **Recommended fix:** Minimum viable for launch: persist to `localStorage` matching the existing pattern used for the rate-card/cert tracker (still device-local, but at least survives reload) **and** soften the copy to not claim a durable "safety record" until server-backed. Better: add a small `safety_quiz_results` server table so the claim is actually true.
- **Acceptance criteria:** Passing a safety quiz and reloading the page must still show the certificate; if server persistence isn't shipped for launch, the copy must not claim "on your safety record" until it is.

---

### P1 — Fix before or immediately after soft launch

**P1-1 (security/UX). Sessions revoked from another device are not detected — the app silently mislabels a logged-out session as a "sync" problem.**
This was found **two independent ways**: I reproduced it live (cleared the session cookie mid-session, navigated to Crew, got "Couldn't sync - saved on this device only." instead of any re-auth prompt) and a separate code-review agent independently traced the same gap from source. Convergent evidence from two different methods.
- **What user sees:** A user calls "Sign out other devices" (a real, shipped Settings feature — `server/index.js:4963`, button at `ProfileHub.tsx:1917`) from one device. On another device/tab left open, nothing happens immediately — but the next background sync (tool records, inbox poll every 30s) shows *"Couldn't sync - saved on this device only."* instead of any indication that the session was actually revoked and they need to sign in again.
- **Why it matters:** This undermines the actual security value of the "sign out other devices" feature — a user revoking a lost/stolen device gets no confirmation the other session actually lost access, and whoever is on that other device (attacker or the same user) gets misleading "just a sync hiccup" messaging instead of being prompted to re-authenticate.
- **File:line:** No global 401 interceptor exists in `src/lib/api.ts:29-35` (`makeRequest` throws a typed error on any non-ok response with no special 401 handling). The only 401 handling anywhere is the one-time initial-load check at `src/App.tsx:549-554`, which does not run on subsequent background fetches. Every other call site (`src/features/tools/tool-records-api.ts:40-50,52-69`; `src/App.tsx:654-677` inbox poll) treats a 401 identically to a network/offline failure, surfacing the generic "Couldn't sync" copy (e.g. `ToolsStudio.tsx:419`).
- **Recommended fix:** Add a 401 interceptor in the shared fetch wrapper(s) that dispatches a global "session expired" event (mirroring the existing `rivt:notification-pref` CustomEvent pattern already in the codebase) — `App.tsx` listens for it, clears `authUser`, and shows "Your session ended — sign in again," instead of letting every call site degrade independently to misleading device-storage copy.
- **Acceptance criteria:** Revoking a session (via "sign out other devices" or natural expiry) and then triggering any background fetch in the other tab must show a real re-authentication prompt, not a sync-failure message.

**P1-2. Bid builder's line-item row overflows the viewport by ~20px at 375px width — live-measured, not just read from CSS.**
- **What user sees:** On an iPhone SE/mini-class phone, the qty/rate/remove-button end of each bid line item extends past the right edge of the screen.
- **Why it matters:** A core money-entry flow is clipped on the smallest supported phone class.
- **File:line:** `src/features/tools/tools-studio.css:3108-3113` (base `1fr 56px 56px 80px 72px 32px`), mobile override at `:3210` reduces to `1fr 48px 48px 68px 64px 28px` — **live-measured on this exact commit at 375px viewport: row renders at 395px width (20px overflow)**. The bid total/subtotal/markup/save-button summary panel (a separate element, previously the subject of a fix) is confirmed visible and functional at this width — this is a different, smaller, still-real gap in the editable line-item row specifically.
- **Recommended fix:** Add `min-width: 0` to `.v2-bid-line input` and reduce the fixed-px columns further at the existing ≤900px breakpoint, or drop one visually-redundant column (qty and rate can share a compact "qty × rate" combined cell) on narrow widths.
- **Acceptance criteria:** At 375px viewport, `.v2-bid-line`'s rendered width must not exceed its parent container's width.

**P1-3. Settings' cert-tracker and rate-card input grids overflow the panel by 44-61px at 375px width — this contradicts one reviewer's "already fixed" conclusion; live measurement is the tiebreaker.**
- **What user sees:** License #, Issue date, and Notes fields (cert tracker) and the Minimum ($) field (rate card) render partially or fully cut off the right edge of the screen on an iPhone SE/mini-class phone. The user cannot see what they're typing in those fields.
- **Why it matters:** Two reviewers reached different conclusions reading the same CSS — one confirmed a ≤640px breakpoint exists and concluded "fixed, no action needed"; another correctly noted the breakpoint only reaches 2 columns, not 1, and flagged it P2 as "degraded, not fully clipped." **I live-measured the actual rendered DOM on this exact commit and both are incomplete**: the 2-column breakpoint at `:1611-1613`/`:1482-1486` is real and does fire (confirmed: computed `grid-template-columns: 197px 197px`), but the grid's *own container* (`.v2-cert-form`) renders at 404px width inside a 347px-wide parent panel that has `overflow-x: hidden` — so the overflow is real and is being silently clipped rather than causing a visible scrollbar. Root cause: no `min-width: 0` anywhere in the chain from the 347px panel down to the grid, so the native `<input>` elements' intrinsic minimum width (particularly the `type="date"` fields) forces the grid wider than its parent allows, and the panel's `overflow-x: hidden` hides rather than reveals the resulting clip.
- **File:line:** `src/features/profile/profile-hub.css:1392-1396` (`.v2-rate-card-inputs`), `:1482-1486` (breakpoint); `:1513-1517` (`.v2-cert-inputs`), `:1607-1613` (breakpoints); parent chain `.v2-cert-form` → `.v2-profile-panel.v2-profile-panel-wide` (the `overflow-x: hidden` panel that clips it). Live-measured: grid width 404px inside a 347px parent at 375px viewport (screenshot on file).
- **Recommended fix:** Add `min-width: 0` to `.v2-cert-form`, `.v2-rate-card-form`, and/or directly to `.v2-cert-inputs input` / `.v2-rate-card-inputs input`. Re-screenshot at 375px to confirm before closing.
- **Acceptance criteria:** At 375px viewport, no input inside the cert tracker or rate card may render with any part of its bounding box beyond the viewport's right edge.

**P1-4. Duplicate, contradictory "Service radius" controls in Settings.**
- **What user sees:** A real `<select>` (10/25/50/75/100 mi) that saves to the server, directly followed by a second chip-style picker (10/25/50/100 mi/"Any distance") with a different option set.
- **Why it matters:** The second control (`ServiceAreaSelector`) writes only to `localStorage["rivt.serviceRadius.v1"]`, confirmed via repo-wide grep to be read by nothing else in the codebase — it is a fully dead, no-op control sitting immediately next to the real one. A user who adjusts it believes they've changed their job-matching radius; nothing happens. For a trades platform built around geographic service-area matching, this is a functional trap, not just visual clutter.
- **File:line:** Real control: `src/features/profile/ProfileHub.tsx:1633`. Dead control: `ProfileHub.tsx:692-718` (`ServiceAreaSelector`), rendered at `:1639`.
- **Recommended fix:** Delete `ServiceAreaSelector` and its render call.
- **Acceptance criteria:** Exactly one service-radius control remains in the profile editor.

**P1-5. Pro subscription copy states a benefit backwards: "90-day time history" is the FREE tier's limitation, not something Pro adds.**
- **What user sees:** The Upgrade modal's Included list literally contains the string "90-day time history," and — because the modal templates a sentence from whatever `reason` triggered it — a free user hitting the time-history paywall sees the literal sentence **"90-day time history is included with Pro."**
- **Why it matters:** `TimeTrackerTool.tsx:193` confirms the actual logic: the 90-day cutoff applies only when the user is **not** Pro; Pro removes the cap entirely (unlimited history). The copy tells a paying user they're buying the exact limitation Pro is supposed to remove — this is the sort of thing a sharp customer notices immediately and loses trust over.
- **File:line:** `src/features/pro/UpgradeModal.tsx:43,83`; `src/features/profile/ProfileHub.tsx:1132`; confirmed real cap logic at `src/features/tools/TimeTrackerTool.tsx:193,260-262,282`.
- **Recommended fix:** Change the Included-list string to "Unlimited time history" and change the `reason` prop passed at `TimeTrackerTool.tsx:282` to match, so the templated sentence reads correctly.
- **Acceptance criteria:** No Pro-benefit copy anywhere states a number that is actually the free tier's cap.

**P1-6. Two Pro benefits are copy-only — not actually gated in code.**
- **What user sees:** The Upgrade modal lists "Cloud project photos and records" and "Invoice, estimate, daily log, and closeout tools" as reasons to pay $9/month.
- **Why it matters:** A repo-wide grep for `isPro` returns only 4 files (`ExpenseLoggerTool.tsx`, `TimeTrackerTool.tsx`, `usePro.ts`, `ProfileHub.tsx`) — no photo/album/upload code and no invoice/estimate/daily-log/closeout component checks `isPro` anywhere. Free users get identical functionality in all of these today. Charging real Jacksonville contractors for tools freely available on the tier below is a trust and possibly refund-request risk.
- **File:line:** `src/features/pro/UpgradeModal.tsx:45-46`.
- **Recommended fix:** Remove these two claims from the Included list until real gating exists, leaving the two genuinely-enforced differentiators (unlimited time history, CSV export) plus the real portal/self-serve-cancellation benefit.
- **Acceptance criteria:** Every line in the Pro Included list corresponds to a real, code-enforced difference between Free and Pro.

**P1-7. No reconciliation path if the Stripe webhook never arrives after checkout.**
- **What user sees:** After paying, the app polls billing status up to 5 times over ~7.5 seconds. If the webhook hasn't landed by then, the user sees "Payment is still processing" — and manually clicking "Refresh billing status" will never resolve anything, because entitlement is written *only* by the webhook handler, with no fallback that reconciles against the Stripe Checkout Session directly using the `session_id` already present in the success-redirect URL.
- **Why it matters:** A webhook misconfiguration (wrong `STRIPE_WEBHOOK_SECRET`, a delivery outage) would silently strand a paying customer with no automatic recovery — they've been charged, RIVT knows nothing about it, and there's no self-serve fix.
- **File:line:** `src/features/profile/ProfileHub.tsx:997-1043,1140`; `server/billing.js:139-148,382-395` (entitlement written only from `customer.subscription.*` webhook events).
- **Recommended fix:** Add a fallback in the success-poll path (or a small dedicated endpoint) that, given the `session_id` query param Stripe already appends, calls Stripe's Checkout Session API directly to reconcile entitlement if the webhook hasn't landed within the poll window.
- **Acceptance criteria:** Simulating a missed webhook (or just slow delivery) must not permanently strand a paid user — reconciliation succeeds within a bounded retry window without requiring manual support intervention.

**P1-8. Work Calendar tab is decorative — no job is ever placed on any date, and "Active jobs" includes Closed jobs.**
- **What user sees:** A month grid that highlights only "today"; below it, a section titled "Active jobs" that actually lists Open + Draft + Paused + Closed jobs together.
- **File:line:** `src/features/work/WorkWorkspace.tsx:410-466`, esp. `421-424` (grid never consults `preferredStartDate`/`applicationDeadline`) and `447-462` (list concatenates all four statuses under an "Active jobs" heading).
- **Recommended fix:** Either place jobs on their real dates, or remove the Calendar tab for soft launch rather than ship a non-functional grid; rename "Active jobs" to something status-neutral or filter to `Open` only.
- **Acceptance criteria:** Either every visible date-relevant job appears on its correct calendar cell, or the tab is hidden until it does; the "Active jobs" list only shows jobs matching its label.

**P1-9. Desktop empty-state placeholder pane renders stacked with the mobile empty state.**
- **What user sees:** A contractor/tradesperson with zero jobs, on a phone, sees both "No open jobs" (from the list) and "Select a posting to review it" (a leftover two-pane desktop message) stacked on the same screen.
- **File:line:** `src/features/work/WorkWorkspace.tsx:1873-1879` (`.v2-work-detail-placeholder`); the mobile breakpoint at `work-workspace.css:1046-1063` only toggles `.v2-work-detail`, never `.v2-work-detail-placeholder`.
- **Recommended fix:** Add `.v2-work-detail-placeholder { display: none; }` inside the same `@media (max-width: 900px)` block, gated the same way as `.v2-work-detail`.
- **Acceptance criteria:** A mobile user with zero jobs sees exactly one empty state, not two.

---

### P2 — Polish (batch into the next train, not launch-blocking)

- **Feed card vs. detail view inconsistency.** `TradePostCard.tsx` derives community label from a hardcoded `trade`→community lookup (ignoring the real `communityName`/`communitySlug` the server returns) and keeps its own `localStorage["rivt.postVotes.v1"]` vote count that's disconnected from the real server reaction ledger (which always initializes `upvotes: 0` client-side, `App.tsx:251-252`). A post filed in "Side Work" can show "Electrical Talk" on its card, and two visitors can see two different, both-wrong vote counts for the same post. `TradePostCard.tsx:19-31,47-76,101-103,130`; root cause `src/App.tsx:251-252`.
- **Reputation badges ("rep", "Trade Mentor", "Top Hand") are computed from dead localStorage, not the real server reputation the app already fetches.** The real `reactionSummary` prop is received and discarded (`ShopTalkView.tsx:588`, destructured to `_reactionSummary`); rep is instead computed from a dead map only ever written by an unreached function (`_incrementHelpfulVote`, `ShopTalkView.tsx:802-814`). Only "First Assist" (driven by the real `verifiedFix` boolean) actually works. `ShopTalkView.tsx:588,802-814,947-969,1533`.
- **"Mark as answered" is 100% cosmetic** — in-memory-only `useState`, no persistence, no server call, vanishes on reload/navigation, sitting right next to the real, server-backed Verified Fix control. `ShopTalkView.tsx:657,1471-1524`.
- **"Shout-outs" reputation feature can never reach its recipient and isn't persisted.** Framed as a trust signal ("build trust," "Reputation momentum," "Peer proof") but stored only in local `useState` filtered by `to === accountProfile.displayName` — which never matches a real recipient session. No server endpoint exists (`grep` for "shout" in `server/index.js` returns nothing). `src/App.tsx:348,1464-1476`; `NetworkHub.tsx:1467-1471`; `ProfileHub.tsx:1749-1759`.
- **Onboarding's "Topics you want in your feed" step is promised but discarded.** `topicInterests`/`onboardingGoal` are sent to the server but only ever written into an audit-log JSONB blob (`server/index.js:1242-1251`) — never persisted to the profile, never read back by any feed-ranking code.
- **Two unrelated "cert" concepts share the word "certified"** — the self-reported License & Cert Tracker vs. the (non-persisted, see P0-3) safety-quiz "Certified" badge — increasing the risk of future conflation between self-reported and verified claims.
- **Profile completion % mixes server-backed and device-local-only signals** (Bio/Rate card/Safety cert checks read `localStorage`), so the same account can show a different completion percentage on a different device or after clearing storage.
- **Job-posting access notes never surface anywhere.** A contractor fills in private gate/parking/lockbox instructions (`accessNotes`) that are saved but never rendered to the accepted tradesperson anywhere in the app.
- **Job templates still require manual copy-paste** into a blank editor rather than pre-filling it; "Invite to Job" only copies a canned clipboard message disconnected from any real job record; the pre-filled application message auto-fills a full first-person sentence into the "message to contractor" field as if the applicant wrote it.
- **Push-notification toggles ("Job alerts," "Messages," etc.) persist correctly server-side, but only the "Messages" toggle actually gates anything** — there is no real push-delivery infrastructure in the repo at all (no `web-push` dependency, no subscription table, no send route); the other three toggles are inert once saved.
- **Duplicated "Synced to your RIVT account."/"Couldn't sync" string pattern** copy-pasted ~34 times across 8 unrelated tool/network files instead of a shared helper — mostly correctly branches on real success/failure, so this is a maintainability note, not a correctness bug (with one narrow exception: `InboxCenter.tsx:143-145` infers an initial "Synced" state from message count rather than an actual sync check).
- **Community post/member counts show ungrammatical "1 members"/"1 posts"** (`ShopTalkView.tsx:1038-1039,1125`) and will silently under-count once total Shop Talk posts exceed the server's 100-row cap used for client-side counting (`server/shop-talk.js:311`).
- **Duplicate onboarding "Consent agreement" heading** rendered twice on the same screen (`AuthScreens.tsx:1042` and `:1444`); footer copy "One question per screen" shown on a 6-field profile step (`:1477` vs `:1318-1375`).
- **Two unrelated availability controls with incompatible vocabularies** — a server-backed Settings dropdown (available/limited/unavailable) vs. a localStorage-only Home-feed chip (available/limited/booked) that never reads or writes the same value.
- **Post-job wizard shows red required asterisks on fields that don't actually block "Continue"** — validation is deferred entirely to the final Publish step, so a user can click through every step with "required" fields blank. `JobEditorModal.tsx:118-125,281-282`.
- **Community creation has a small TOCTOU race** on the 1/day rate limit (plain `SELECT count(*)` outside a lock, not launch-relevant at soft-launch scale). `server/communities.js:170-204`.

---

### P3 — Later / cleanup, no user-facing impact

Dead `accountProfile.plan` field still set in `App.tsx:277,440,1327` and threaded through `ProfileRoute.tsx`, but confirmed **not read anywhere** in `ProfileHub.tsx` — the real plan tile already derives correctly from `usePro()`. Safe to delete, not urgent. Unused `betaLabel` string in `brandConfig.ts:5`. Dead `_handleSetAvailability` function (`App.tsx:887-906`). Uploaded Shop Talk post photos default to `review_status: 'not_scanned'` with no scanning pipeline ever transitioning that field — acceptable given the working report+admin-hide safety net, but worth a documented decision either way.

---

## Corrections to agent findings (trust-but-verify in action)

One agent read the CSS for the Settings cert-tracker/rate-card grids, found a `@media (max-width: 640px)` rule, and concluded **"FIXED — no action needed."** A second agent read the same CSS more carefully and correctly noted the breakpoint only reaches 2 columns (not 1) and flagged it P2 as "degraded, not clipped." I live-measured the actual rendered page at 375px on this exact commit and found **both readings were incomplete**: the 2-column breakpoint genuinely fires, but the grid's container still overflows its own 347px-wide parent panel by 57px because nothing in the ancestor chain sets `min-width: 0` to let native inputs shrink below their intrinsic width — and the parent panel's `overflow-x: hidden` clips this silently rather than showing a scrollbar, which is exactly why static CSS review alone missed it. This is now P1-3 above, with the precise root cause and a screenshot on file. This is the reason this audit combined agent code review with live rendering rather than trusting either alone.

**Second correction — a false P0 caused by a working-tree mixup during audit compilation, not a real product bug.** After the five review agents were dispatched against a working tree checked out at `3c66aac`, this audit switched that same working tree to a separate long-running branch (`claude/new-session-2wxmgd`, which does **not** contain `3c66aac` as an ancestor and is ~500 lines diverged in the tools feature alone) in order to write and commit this report. One agent — auditing the Tools suite — was still running at that moment and its later file reads landed on the wrong branch's code. It reported a P0 ("`.v2-bid-summary-stack { display: none; }` inside `@media (max-width: 800px)` — the bid total and Save button are hidden on every phone width") that does not exist on the audited commit: `git show 3c66aac:src/features/tools/tools-studio.css` at the equivalent selector shows `position: sticky` inside `@media (max-width: 900px)`, not `display: none` — matching this report's own live screenshot (`92-bid-builder-375.png`) showing the Bid Total, Subtotal, Markup, Total, and Save Bid button all rendering correctly at 375px. A second claim from the same agent (calculator mode-tabs shrinking to "30px height, 8px font") was checked the same way and is also false: `3c66aac`'s actual CSS at that selector is `min-height: 42px`, matching what an earlier, uncontaminated agent in this same audit already confirmed fixed. Neither false claim was added to the findings above. This is logged here rather than silently discarded, because it is a real methodology lesson: **do not switch a working tree that a background agent is still reading from.** Future passes should audit from a dedicated worktree or wait for all agents to complete before changing branches.

---

## PASS 2 — Self-critique: "What 10 things might Pass 1 have missed?"

Re-examined the build from angles no single feature-scoped agent was asked about:

1. **Session lifecycle / mid-session expiry** → found P1-1 above (401s mislabeled as sync failures), confirmed by two independent methods.
2. **Browser back-button behavior mid-flow** → tested: opening the Create Job modal and pressing browser-back does not trap the user or lose confirmed data; it navigates the underlying route back a level (no history entry was pushed for the modal itself). Not a launch blocker, but worth knowing: no explicit "discard draft?" confirmation exists if a user is mid-form and navigates back. **P3** — add a `beforeunload`/confirm guard on the job editor if this proves to be an issue in the field.
3. **Top-bar Search honesty** → the search icon opens a launcher with three real, honest shortcuts ("Search work," "Search Shop Talk," "Open Tools") rather than a fake live-search box that returns nothing. **No finding — confirmed honest.**
4. **Notifications panel honesty** → opened it fresh: real empty state ("No activity yet. Use any feature in the app and activity will appear here."), no fabricated notifications. **No finding — confirmed honest.**
5. **Dark mode persistence** → toggled Dark in Settings, navigated to Home: persisted correctly across navigation. **No finding — confirmed working.**
6. **Signed-out device / shared-device residue** → `handleLogout` never clears `localStorage`. A wide set of PII-bearing caches (certs, business info, cached bio, service radius, job/tool records) survive sign-out and would be visible to the next person on a shared/public device (e.g., a shop laptop) before their own data syncs in. **P2** — clear all `rivt.`-prefixed localStorage keys on logout (the existing data-export key enumeration in `ProfileHub.tsx` could be reused to identify what to purge).
7. **XSS/content-injection in user-generated Shop Talk content** → confirmed no `dangerouslySetInnerHTML` anywhere in the Shop Talk feature; all post/answer bodies render through plain JSX text nodes, which auto-escape. **No finding — confirmed safe.**
8. **Photo-post content moderation before it goes live** → uploaded post media defaults to `review_status: 'not_scanned'` with no pipeline anywhere that ever transitions it — images go live to the whole feed instantly with only the after-the-fact user-report+admin-hide safety net as protection. Not new-launch-blocking given report/moderation works, but worth an explicit decision. **P3, tracked above.**
9. **Env-var/setup strings leaking into billing error copy** → re-checked specifically for this exact commit: confirmed clean. All billing failure copy is generic ("Subscriptions are temporarily unavailable," "Billing portal is not available yet.") with zero raw `STRIPE_*`/`VITE_*` names rendered anywhere in the client.
10. **Whether the fake-post-success bug (P0-1) has a sibling in the answer-submission path** → checked: `handleAddCommunityAnswer` (`App.tsx:986-993`) is implemented correctly (shows "Shop Talk answer not saved" and returns early on failure) — the bug is specific to post creation, not a systemic pattern across all Shop Talk writes. Confirms P0-1 is a localized regression, not evidence of a wider anti-pattern.

---

## Smallest safe merge train

Everything below is a small diff — no rewrites, no schema changes except the optional safety-cert table (which can ship as a fast-follow if localStorage persistence is judged sufficient for soft launch).

**Train 1 (blockers, do first):**
1. Guard `handleNewShopTalkPost` against a failed server create (P0-1).
2. Zero out the fake records/training baseline (P0-2).
3. Persist safety quiz results to localStorage at minimum, soften "on your safety record" copy if server persistence isn't shipped this train (P0-3).
4. Split the calculator's drawer-toggle button from its "back to Tools" button so kerf/pieces are reachable (P0-4).

**Train 2 (trust/security, same week):**
4. Global 401 interceptor + "session ended, sign in again" prompt (P1-1).
5. Fix "90-day time history" copy inversion (P1-5) — one string.
6. Remove the two ungated Pro benefit claims from the Included list (P1-6).
7. Delete the dead `ServiceAreaSelector` control (P1-4).
8. `min-width: 0` fix for the cert/rate-card grids (P1-3) and the bid-line grid (P1-2) — CSS only.
9. Hide the mobile placeholder-pane duplicate empty state (P1-9).
10. Stripe webhook-miss reconciliation fallback using `session_id` (P1-7).
11. Calendar tab: hide or fix (P1-8).

**Train 3 (polish, can follow launch):** everything in the P2 list.

---

## Codex-ready build prompt (highest-priority merge train only)

> **Branch `codex/launch-qa-pass2`.**
>
> 1. `src/App.tsx` `handleNewShopTalkPost` (~line 1143): only construct/insert the client-only `localPost` fallback when `isGuest || !authUser || !onboardingComplete`. For authenticated+onboarded users, if `createShopTalkPost(...)` returns `null`, call `addActivity` with a failure message (e.g. "Shop Talk post could not be saved — try again") and do NOT call `setCommunityPosts`. Do not touch the guest/local-post path — it should keep working as-is.
> 2. `src/App.tsx` lines 335-340: change both `useState` initializers to empty sets (`new Set()`), removing the fabricated "Signed scope" / "Legal consent accepted" / "Customer-site conduct" baseline. Then check `src/features/home/TradeFeed.tsx:29,134` (`SETUP_RECORD_BASELINE`) — since the fake baseline is gone, this subtraction constant should become `0` or be removed entirely so the Home checklist and the Account panel/Settings counters agree.
> 3. `src/App.tsx:342` (`safetyQuizResults`): persist to `localStorage` under a `rivt.` prefixed key, following the same read/write pattern already used for the rate-card tracker in `ProfileHub.tsx`, so a passed quiz survives reload. If time doesn't allow server persistence this train, also soften the copy at `ProfileHub.tsx:224` from "This certificate is now on your safety record" to something accurate to a device-local claim.
>
> 3b. `src/features/tools/FieldCalculatorTool.tsx:295-300`: give the calculator its own drawer-toggle button, distinct from the "back to Tools hub" button — don't derive the click behavior from whether `onBack` was passed. `ToolsStudio.tsx:2362` should be able to pass both a working `onBack` and a working drawer toggle simultaneously. Then remove/fix the CSS at `tools-studio.css:6113-6116` that groups `.is-open` into the same `display:none` rule as the closed state, so it can't re-mask this once the button logic is fixed. Manually verify by opening the calculator and confirming the kerf toggle and pieces stepper are reachable and change the displayed total.
> 4. Add a global 401 handler: in `src/lib/api.ts`'s shared fetch wrapper (and the ad hoc fetches in `tool-records-api.ts` / inbox API), on a 401 response dispatch `window.dispatchEvent(new CustomEvent("rivt:session-expired"))`. In `src/App.tsx`, add a listener (next to the existing `rivt:notification-pref` listener) that clears `authUser`/`canonicalAccount`/`onboardingComplete` and shows a real "Your session ended — sign in again" prompt instead of routing to the generic sync-failure copy.
> 5. `src/features/pro/UpgradeModal.tsx:43,83` and `src/features/profile/ProfileHub.tsx:1132`: change "90-day time history" to "Unlimited time history" in the Included list and in the `reason` prop passed from `TimeTrackerTool.tsx:282`, so the templated upgrade-modal sentence reads correctly.
> 6. `src/features/pro/UpgradeModal.tsx:45-46`: remove "Cloud project photos and records" and "Invoice, estimate, daily log, and closeout tools" from the Pro Included list (not currently gated in code) unless real gating ships alongside this train.
> 7. `src/features/profile/ProfileHub.tsx:692-718,1639`: delete the `ServiceAreaSelector` component and its render call; keep only the existing `<select>` bound to `draft.serviceRadiusMiles`.
> 8. `src/features/profile/profile-hub.css`: add `min-width: 0` to `.v2-cert-form`, `.v2-rate-card-form`, and their respective `input` selectors so the existing ≤640px 2-column breakpoints actually fit a 375px viewport without clipping. Verify with a real screenshot at 375×553, not just a CSS read.
> 9. `src/features/tools/tools-studio.css:3121-3135,3210`: add `min-width: 0` to `.v2-bid-line input` and tighten the mobile column widths further so the row fits inside 375px (verified live at 395px currently, 20px over).
> 10. `src/features/work/work-workspace.css` (~line 1046-1063): add `.v2-work-detail-placeholder { display: none; }` inside the existing `@media (max-width: 900px)` block, so it only shows when `.show-detail` is active, matching `.v2-work-detail`'s behavior.
> 11. `src/features/profile/ProfileHub.tsx` (billing success handler, ~line 997-1043) and `server/billing.js` (~line 139-148): add a fallback that reconciles entitlement against Stripe's Checkout Session API using the `session_id` query param if the webhook-driven `billing_entitlements` row hasn't landed after the existing poll window.
> 12. `src/features/work/WorkWorkspace.tsx:410-466`: either wire the calendar to actually place jobs by `preferredStartDate`, or hide the Calendar tab for this launch; separately, either rename "Active jobs" or filter that list to `status === "Open"` only.
>
> Verify with: `npm run build && npm run lint && npm run lint:security && npm run test:unit && npm run test:e2e && npm run test:ui:mobile-actions` plus the full DB-backed `npm run test:integration` against a configured `TEST_DATABASE_URL` (do not skip this — it caught nothing wrong last train, but it's cheap insurance). Manually re-verify P0-1 by intercepting the create-post request to fail and confirming a real failure toast with nothing added to the feed; re-verify P1-3/P1-2 with an actual 375×553 screenshot, not a CSS read.
