# RIVT Launch QA — Jacksonville soft-launch go/no-go (2026-07-04)

Scope: production build (rivt.pro = master @ 07aa710, verified via /api/health)
plus repo review of the unmerged `codex/launch-polish-phase-1` branch (ffb7957).
Method: code review of every diff since the ef32b88 audit, adversarial review of
the phase-1 branch, and a live drive of master at 390×664 and 375×553 (login,
Shop Talk composer, estimate→invoice, create-job wizard, Settings, sign-out),
plus read-only production checks (health, legal pages).

## Verdict: **NO-GO on the current production build. GO after one merge train** (est. small — the hard work is already done and verified).

The core problem is not missing work — it's that the work is sitting unmerged:
`codex/launch-polish-phase-1` fixes 5 of the 6 worst mobile/truth blockers,
**merges cleanly with master** (verified via merge-tree; only BUILD_STATE.md
overlaps and auto-merges), and is not deployed. Production today cannot post
to Shop Talk from a phone.

---

## P0 — launch blockers (all verified live or in code on production master)

**P0-1. Phones cannot post in Shop Talk.** [LIVE on master]
The create-post modal has no scrollable ancestor; the Post button sits at
y=837 in a 664px viewport (unreachable by touch; verified again this pass).
The fix on ffb7957 is correct: scrollable `.new-post-modal-body`, pinned
footer with safe-area padding, and a real in-viewport assertion added to
`scripts/mobile-actions-ui-smoke.mjs`. **Action: merge + deploy.**
Files: src/features/shop-talk/ShopTalkView.tsx, shop-talk.css.

**P0-2. Converted invoices contradict themselves and expose margin.** [LIVE on master]
"TOTAL DUE $1,088" under a banner claiming "$1,100"; "Overhead"/"Margin and
contingency" as client-facing lines; guidance chips calling the margin line
"LOOKS HIGH vs $45–$95/hr". All fixed on ffb7957 (cents-exact proportional
distribution, guidance restricted to labor lines). **Action: merge + deploy,
with one pre-merge one-liner:** EstimateTool builds the labor line with
`qty: Math.max(0.5, laborHours)` but divides by `Math.max(1, qty)` — for
0 < laborHours < 1 the mismatch returns. Files: src/features/tools/
EstimateTool.tsx (~:89,:121), InvoiceDraftTool.tsx, money.ts.

**P0-3. Bid builder hides its total and only action on every phone; false
"✓ Job created!" claim; fictional "Sync will retry" copy in 13 tools.**
[on master] All fixed on ffb7957 (summaries visible on mobile, fake job path
deleted, honest sync-failure copy, zero stale strings by grep). **Action:
merge + deploy.** Note post-merge: the `position: sticky` on the mobile
summaries is inert (no scroll container to stick within) — works, doesn't
float; cosmetic fast-follow.

**P0-4. A paying Pro user sees Plan: "Founding beta".**
`src/App.tsx:277` hardcodes the Account-facts plan tile to
`brandConfig.pricing.betaPlan.label`; it renders (ProfileHub.tsx:1572)
directly above the PlanCard that says "RIVT Pro". The founder's own account
exhibits this today. Fix: drive the tile from `usePro()` ("RIVT Pro"/"Free"),
or delete the tile.

**P0-5. No post-checkout confirmation.**
Stripe success returns to `/app/profile/settings?billing=success`
(server/billing.js:35) but nothing reads that param — zero grep hits. If the
webhook lags the redirect, a buyer lands on a Settings page saying "Free
plan" seconds after paying. Fix: read the param, show "Payment confirmed —
finalizing your subscription…", and re-poll billing status.

**P0-6. "Quick apply" doesn't apply.**
WorkWorkspace.tsx:1138-1146 — the button only opens the detail pane; nothing
is submitted. A tradesperson's primary action silently does something else.
Fix: rename to "View & apply" (1-line) or actually submit.

## P1 — fix before or within days of launch

- **Env-var strings reachable in prod UI**: "Stripe is wired in but not live
  yet. Configure STRIPE_SECRET_KEY…" (ProfileHub.tsx:1073-1075) shows to all
  free users if `checkoutConfigured` ever flips false (key rotation mishap);
  "Missing: STRIPE_SECRET_KEY" in UpgradeModal.tsx:63-66 and the portal error
  path; "Set VITE_VAPID_PUBLIC_KEY…" (ProfileHub.tsx:976-978). Replace all
  with user copy ("Subscriptions are temporarily unavailable.").
- **Pro benefits overclaim**: Included list claims "Cloud-backed project
  photos and records" and all tools (free plan has them too); "Records and
  photos — Higher limits" contradicts "No storage cap is set during beta" on
  the same page; "Full time and expense history" — expense history is not
  gated. The only real gates are 90-day time history + CSV expense export +
  customer portal. Rewrite the Included list to the real gates
  (UpgradeModal.tsx:42-48, ProfileHub.tsx:1090-1092).
- **Shout-out false delivery claim**: toast says "…is now part of their crew
  record" (App.tsx:1476) but reviews are free-text names stored to the
  author's own records — never delivered; "Reviews you've received"
  (NetworkHub.tsx:1170) can never populate. Reword to "Saved to your records"
  and hide the received panel until delivery exists.
- **Invites promised, not built**: routes.ts copy "Invite nearby tradespeople
  who fit the job" — no invite mechanism exists in Work. Cut or reword.
- **Fabricated "% match"**: localStorage heuristic renders on every job row,
  including a contractor's own postings ("40% match"), and can disagree with
  the aside's `job.match`% on the same card (WorkWorkspace.tsx:1068-1079,
  1127-1137). Gate to tradespeople, one number, or remove for launch.
- **No renewal wording**: "$9/month … Cancel anytime" never states renewal
  timing; Pro state "Pro active through {date}" uses the renewal date and
  reads as expiry. Add "Renews {date}".
- **Cancel controls gated on `activatedAt`** (ProfileHub.tsx:1104): an active
  sub with null activeUntil would hide portal/cancel entirely; and lapsed
  subscribers have no portal path to past invoices.

## P2 — polish (batch after launch)

Pluralization "1 members / 1 posts / 1 articles" (ShopTalkView.tsx:1036-39,
1123; Trade News) · "QUE Question / LOO Looking for Sub" chip stutter
(ShopTalkView.tsx:411) · dual legacy filter rows in Shop Talk search ·
"marketplace" vs "Work" (ProfileHub.tsx:1062, empty-job.ts:25) · "review" vs
"shout-out" one-feature-two-names (NetworkHub.tsx:1214-1263) · four permanent
"Synced to your RIVT account." status lines on empty Crew · "Invite to Job"
copies to clipboard with zero feedback (NetworkHub.tsx:757) · page title stays
"Crew" on Reviews/Clients tabs · decorative Calendar tab (no job ever placed
on the grid; lists Closed under "Active") · templates don't prefill the
editor · canned prefilled application message (make it a placeholder) ·
desktop "Select a posting" placeholder pane visible on empty mobile Work ·
duplicate Service-radius controls in Settings (still present) · stale
brandConfig `launchPreviewPlan` $1/day copy (unused — delete before someone
wires it) · onboarding proof card "no card while we build density" now that
live billing exists (AuthScreens.tsx:1235) · feed card community label/vote
divergence + device-local rep badges (tracked from prior audit, Phase 3) ·
Heavy 16th "HARDWAR" tab clip + 26px fraction strip.

## Confirmed fixed on production master (no action)

ID-gate overclaim replaced with truthful email+consent line (brandConfig.ts) ·
storage panel reads real `accountStorage` usage with honest "No storage cap is
set during beta" · legal pages live and linked (rivt.pro/legal/*.html, real
content, correct not-a-marketplace positioning) · real support: /api/v1/support/
cases + "Email support directly at support@rivt.pro" mailto · notification
prefs server-backed with honest browser-permission states · onboarding: single
derived step numbers, duplicate headings removed, goal/topics persisted,
role-goal routing keeps its promise · honest device-export copy · sign-out
works cleanly · "Trade Talk" naming: zero occurrences; Shop Talk consistent.

## What to remove / rename / consolidate (subtraction list)

Remove: env-var strings from UI · "% match" footer badge (or gate+reconcile) ·
Invites nav promise · "is now part of their crew record" claim · stale
launchPreviewPlan/base-plan pricing in brandConfig · duplicate
ServiceAreaSelector · Calendar tab (until real) · canned application message.
Rename: "Quick apply" → "View & apply" · "marketplace" → "Work" · pick
"shout-out" everywhere · Pro state "active through" → "Renews {date}".
Consolidate: one plan source (`usePro()`) for tile + card · one currency
formatter (BidBuilder still has its own whole-dollar one) · one Shop Talk
filter system · Crew sync-status lines → transient toasts.

## Physical-device test list (post-merge, before announcing)

1. iPhone (Safari) + one small Android (Chrome): Shop Talk composer —
   keyboard open, body scrolls, Post tappable above the home indicator
   (safe-area inset); rotate mid-compose.
2. Create-job wizard steps 2–3 with keyboard open at SE-class heights
   (Continue reachable; it's inline-scroll so verify keyboard doesn't trap it).
3. Stripe live checkout round-trip on mobile Safari: pay → return banner →
   Pro state; then cancel → resume from the phone; verify plan tile.
4. Photo post from camera (HEIC path) in Shop Talk and Records; upload over
   cellular; 10 MB limit error copy.
5. Tap-target sweep with a work glove if possible: Heavy 16th fraction strip,
   expense/time row buttons, calculator bottom row at SE heights.
6. Sticky bottom summaries (bid/mileage/safety) vs iOS bottom toolbar overlap.
7. Push/notification permission prompts on iOS PWA vs Safari tab.
8. Pull-to-refresh vs in-app scroll containers (composer, wizard).
9. Sign up on-device with a real email (deliverability of verification mail),
   complete onboarding, kill the app mid-onboarding and relaunch.

## Codex build prompt (next pass — keep it this small)

> **Branch `codex/launch-go-train`.** (1) Merge `codex/launch-polish-phase-1`
> into master (clean merge, verified). Pre-merge one-liner: in
> EstimateTool.tsx use the same qty for build and divide
> (`Math.max(0.5, laborHours)` both places). (2) Plan tile from `usePro()`
> (App.tsx:277 / ProfileHub.tsx:1572) — "RIVT Pro"/"Free plan"; delete
> `launchPreviewPlan` + base-plan leftovers from brandConfig. (3) Handle
> `?billing=success`: confirmation banner + billing-status re-poll until
> entitlement lands. (4) Replace every env-var string in UI with user copy
> (ProfileHub.tsx:1073, :976; UpgradeModal.tsx:63; portal error path).
> (5) Rewrite Pro Included list to the enforced gates only; drop "Higher
> limits"; add "Renews {date}" to the active state. (6) "Quick apply" →
> "View & apply"; remove Invites promise copy; shout-out toast → "Saved to
> your records" and hide "Reviews you've received"; gate the % match badge
> to tradespeople with one reconciled number (or remove). (7) P2 copy sweep
> if capacity: plural helper, QUE-chip stutter, marketplace→Work,
> shout-out naming, Crew sync-line noise, mobile Work placeholder pane.
> Verify: build/lint/test:unit/test:e2e + `mobile-actions-ui-smoke` at
> 390×664, then deploy and confirm rivt.pro /api/health commit; run the
> physical-device list in LAUNCH_QA_GO_NOGO_2026-07-04.md before announcing.

## Go/no-go

**No-go on 07aa710**: the primary device class cannot post in Shop Talk, the
flagship Tools flow contradicts its own totals, and a paying subscriber sees
the wrong plan name.
**Go** once the train above ships and the device list passes: the platform
core (auth, onboarding, communities, answers, verified fix, moderation, jobs,
live billing with honest 2-tap cancel, support, legal) is genuinely solid and
honestly presented. Nothing found requires new features — it is one merge,
five small diffs, and a copy sweep.
