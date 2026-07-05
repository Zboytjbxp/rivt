# RIVT Final Launch Audit — master @ 14b9023 (2026-07-05)

Production = origin/master = `14b9023` (confirmed via /api/health). Method: two
parallel code reviewers (P1-backlog verification + design-system consistency)
plus a live drive at 390×664 and 375×553 with full light/dark screenshot sweep
of all six surfaces, composer/estimate/invoice functional probes, and visual
review of every capture. All data was collected against 14b9023 before any
branch switch (lesson from the prior contamination incident applied).

## Verdict: **GO after one small train.** Look-and-feel: one focused polish train gets it to "premium."

Codex's 16 commits since 3c66aac fixed all four previous P0s and more, verified
live and in code:
- Fake post-success → real failure guard (App.tsx:1353) ✓
- Seeded fake records/training → gone ✓
- Safety certs → persisted (rivt.safetyQuizResults.v1) ✓
- Calculator → **rewritten**; the unreachable-drawer P0 is moot, and the new
  fractions-only calculator is a big visual/usability upgrade (verified live)
- Composer Post button in-viewport at 375×553 (y=486) ✓ · Estimate→Invoice
  exact at $1,100.00==$1,100.00 (empty-start defaults are honest; $0 conversion
  allowed — nit) ✓ · Tools back-nav via ?tool= URLs works ✓ · 401s now fire a
  global session-expired sign-out (api.ts:25-45, App.tsx:512-536) ✓ ·
  375px cert/rate-card clipping fixed ✓ · bid-line min-width fixed ✓ ·
  Pro copy fixed ("Full time-history access") ✓ · dead ServiceAreaSelector
  deleted ✓

## Remaining P1s (the launch train)

1. **Compact-phone fraction entry regression (new, from c9b2a00).** On
   iPhone SE/mini-class devices (`data-rivt-compact-device`), the sixteenths
   strip is `display:none` (tools-studio.css:6488) and the ruler rail is also
   hidden — the flagship calculator cannot enter 5/8" except by tapping ±1/32
   twenty times. Fix: keep `.fraction-strip` visible on compact (wrap to 2
   rows). This is the one functional regression the hardening commits
   introduced, on exactly the devices they targeted.
2. **Stripe webhook-miss reconciliation (carried).** ProfileHub polls 5× then
   strands a paying user on "Payment is still processing" forever; the
   success-URL `session_id` is never read; no reconcile endpoint exists
   (billing.js:382-392 only upserts customer on checkout.session.completed).
   Fix: `POST /api/v1/billing/reconcile` retrieving the session from Stripe.
3. **Logout leaves PII in localStorage (carried).** handleLogout (App.tsx:1075)
   and the new session-expired handler clear React state only; rivt.profile/
   business/clients/clientThreads/jobs/reviews persist for the next user on a
   shared device. Fix: purge `rivt.`-prefixed keys in both handlers.
4. **Feed-card votes never server-backed (carried).** Cards keep localStorage
   votes; App.tsx:335/318 hardcode upvotes:0 from the server, so real tallies
   never render and card ≠ detail. Fix: thread the reaction ledger into
   TradePostCard, delete rivt.postVotes.v1.
5. **401 residual:** network-records-api.ts (3 helpers) still bypasses
   notifySessionExpired → Crew mislabels revoked sessions as sync failures.
   3-line fix mirroring tool-records-api.

P2 carried (post-launch batch): decorative Calendar tab + Closed jobs under
"Active"; mobile Work placeholder stacking; templates don't prefill; access
notes never shown; card community label from trade map; rep badges/mark-as-
answered device-local; availability chip desync (dead `_handleSetAvailability`
already exists — wire it); shout-outs still undeliverable (panel was hidden,
not fixed); canned application message; "1 members"/QUE-chip/dual filter rows;
calculator ÷0 and stale-operand nits; convert-to-invoice enabled at $0.

## Look-and-feel findings (screenshot review, all 6 surfaces × light+dark)

Dark mode is coherent app-wide (tokens work) and the new calculator looks
genuinely professional. What reads as unfinished:

**From screenshots:**
- **FAB occludes content.** "Post work"/"Ask" pill overlaps feed-card titles on
  Home (both themes); no bottom clearance is reserved for it.
- **Unlabeled numbers on Home community cards** — a bare "0"/"1" under each
  name reads broken; either label ("1 member") or hide zero-counts.
- **Random avatar-circle colors** (purple, brown, gray, black) on community
  icons — off the orange/neutral brand palette, reads as placeholder art.
- **Join-button wall in Shop Talk** — five stacked high-saturation orange
  pills dominate the directory; Join should be the quiet secondary style,
  orange reserved for the page's one primary action.
- **Meta lines truncate mid-word** in the directory ("0 posts · C…") — drop
  the third segment at narrow widths instead of ellipsizing one letter in.
- **Content bleeds through the translucent bottom nav / top bar** (light mode
  Home/Tools/Settings) — ghosted text behind chrome looks like a rendering
  bug; make bars opaque or add scroll padding.

**From the design-system review (full detail in agent report; top counts):**
~475 hardcoded color literals vs the token system; **three competing palette
sources** (styles.css :root is silently overridden at runtime by brandConfig
inline styles, and both disagree with tokens.css) so legacy screens sit on a
different off-white than the shell; neon Tailwind greens/reds (#22c55e/#ef4444
×60) that glare in dark mode instead of the desaturated tokens; **a real
rendering bug** — `--v2-radius-xl` used but never defined → square corners on
network modals + tools lightbox (network-hub.css:725,1322; tools-studio.css:
3933); **89 button families** including a black legacy `.primary-action` vs
the orange `.v2-primary-button` — both live on the auth/onboarding screens a
new user sees first; 872 raw `font-size:13px` plus a 13/14/15/16/17/18 smear;
four pill-radius spellings; 80 ad-hoc box-shadows; ~55% of styles.css and ~35%
of tools-studio.css dead; 76 transition variants.

## The polish train (small, ranked, mergeable)

1. Define missing tokens (`--v2-radius-xl`, `--v2-radius-pill`,
   `--v2-destructive`→danger, `--v2-on-accent`) — fixes the square-corner bug
   day one (~8 lines).
2. Status colors → tokens (~120 mechanical replacements): kills the neon
   green/red in dark mode — single biggest "feels amateur" fix.
3. Retire black `.primary-action` for `.v2-primary-button` on auth/onboarding
   (~30 lines): one brand CTA color on the first screens users see.
4. FAB clearance + opaque (or padded) nav bars: no more content bleed/overlap.
5. Shop Talk directory: secondary-style Join buttons, labeled counts,
   palette-consistent community icon colors, drop the truncating meta segment.
6. One palette source of truth: sync styles.css :root ↔ brandConfig ↔ tokens
   (~40 lines).
7. Pill radius + 13px type sweep (mechanical seds), motion tokens (120/180ms).
8. Dead-CSS deletion: styles.css (~300 classes) + tools-studio.css (~213,
   the orphaned old calculator) — two pure-deletion PRs that make everything
   above stick.

## Codex build prompt (single train)

> Branch `codex/launch-final-train` off master. **Functional:** (1) show
> `.fraction-strip` on compact devices as a 2-row wrap — remove
> tools-studio.css:6488-6491 display:none and add compact sizing; (2) add
> `POST /api/v1/billing/reconcile` (retrieve Checkout Session by session_id,
> provision like the webhook); call it from ProfileHub after the 5-poll
> timeout using the URL's session_id; (3) purge `rivt.`-prefixed localStorage
> keys in handleLogout and the session-expired handler; (4) mirror the 401
> notifySessionExpired guard in network-records-api.ts; (5) thread server
> reaction state into TradePostCard and delete rivt.postVotes.v1;
> (6) disable "Convert to invoice" when the estimate total is $0.
> **Polish (items 1-5 of the polish train above):** missing tokens, status-
> color tokenization, auth CTA unification, FAB clearance + opaque bars, Shop
> Talk directory quieting. **Verify:** build/lint/unit/e2e + mobile-actions
> smoke + fresh 375×553 screenshots of Home/Shop Talk/calculator, and a live
> compact-device probe that a fraction can be entered in ≤2 taps. Defer the
> dead-CSS deletion PRs to a separate follow-up train (pure deletions, easy
> review).

## Deferred (documented, not blocking)
Calendar/templates/access-notes/shout-outs/availability-sync P2 batch; dead-CSS
deletion PRs; type-scale + shadow + motion full sweeps; ReportViewer token
adoption; the `max-device-width` vs JS compact-flag duplication cleanup.
