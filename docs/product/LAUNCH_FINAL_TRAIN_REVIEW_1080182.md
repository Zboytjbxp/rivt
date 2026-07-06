# Adversarial Review — Launch Final Train (commit 1080182, deployed to production)

Reviews the work delivered against `docs/product/CODEX_LAUNCH_FINAL_TRAIN_PROMPT.md`
(11 items: A1-A6 functional, B1-B5 look-and-feel). Method: two independent
code reviewers each re-derived every claim from source (not from commit
messages), plus direct verification of the highest-stakes items (security,
compact-device fraction entry, localStorage purge) via live testing and
manual source reads on the exact production commit. One reviewer's claim
was independently spot-checked and confirmed correct before inclusion.

**This train is already live on rivt.pro.** This review is about what still
needs a follow-up patch, not a merge/no-merge gate.

## Verdict: 6/6 functional items shipped correctly (one has a real residual
bug). 5/5 look-and-feel items were attempted; only 2 are actually complete.
**B2 (status-color tokenization — called "the biggest feels-amateur fix" in
the spec) is essentially unstarted.** None of this blocks the current
production build from being live — nothing here is a regression from
pre-train behavior — but the visual-polish goal is only partially met.

---

## Part A — Functional (all verified against source + one live-tested)

| # | Item | Verdict |
|---|---|---|
| A1 | Compact-phone fraction entry | ✅ **Correct — exceeds spec.** Live-tested: one tap sets "5/8"" (0.625"), not the ≤2-tap bar asked for. 15-button grid, 40px+ targets. Smoke test assertion added. |
| A2 | Stripe reconcile endpoint | ✅ **Correct and secure.** Cross-account check is real: ties back to `client_reference_id`/`metadata.account_id` set server-side at checkout creation (not client-forgeable), rejects mismatches with 403, reuses the webhook's own provisioning function. Integration test covers the cross-account 403 and idempotency. Cosmetic miss: no support mailto in the final "still processing" message. |
| A3 | Logout PII purge | ✅ **Correct.** Both `handleLogout` and session-expiry clear every `rivt.`-prefixed key except theme. Gap: `clearRivtLocalState()` has no try/catch — in a private-browsing mode where `localStorage` throws, this could break sign-out. Small, worth a follow-up line. |
| A4 | network-records 401 guard | ✅ **Correct**, all 3 call sites. |
| A5 | Server-backed feed-card votes | ⚠️ **Partially done — a real regression.** The part that mattered most (no more per-device localStorage votes, cross-account visibility, correct community label) is genuinely fixed and verified. But **"Trending in the trades" (Home) and "Hot" sort (Shop Talk) still rank by `post.upvotes - post.downvotes`, and those fields are permanently hardcoded to 0** (`App.tsx:354-355`) — nobody rewired the two sort functions to the real reaction ledger. Confirmed directly: `TradeFeed.tsx:37-39` computes `netScore` from the dead fields; the sort is a silent no-op (posts show in insertion order, not vote order). This wasn't explicitly called out in my original spec — but it's the kind of thing "server-backed votes" implies and a user would expect fixed. |
| A6 | Convert-to-invoice $0 guard | ✅ **Correct, functionally.** `disabled={target <= 0}` genuinely blocks $0 invoices. Cosmetic miss: no visual disabled styling, button just doesn't respond to taps. |

## Part B — Look and feel (quantified, not eyeballed)

| # | Item | Verdict |
|---|---|---|
| B1 | Missing tokens | ⚠️ **Mostly done.** All 5 tokens defined; the exact 3 broken sites (`network-hub.css:725,1322`, `tools-studio.css:3933`) now resolve to a real 20px radius — confirmed directly, this was a real live bug and it's fixed. Missed: 4 sites still use raw `100px` instead of the new pill token; `--green` was never aliased, so `styles.css` quiz colors still fall back to raw `#1a9e4a`. |
| B2 | Status colors → tokens | ❌ **Essentially not done.** Every named "heaviest" site (`profile-hub.css:210,699,847-853,878`, `network-hub.css:309`) is byte-identical to before the train. Quantified: **79 of 122 raw status-color hex instances remain** across profile-hub/network-hub/work-workspace/tools-studio/styles.css. The spec's own acceptance grep (expected: 0 hits) currently returns 81. Dark mode still glares neon green/red on these surfaces — the exact problem the spec called the single biggest "feels amateur" fix. |
| B3 | One primary CTA | ✅ **Correct.** `.primary-action` went from hardcoded black `#080d10` to `var(--v2-accent)`/`var(--v2-on-accent)`, confirmed via before/after diff. No black CTA reachable from any live screen (one unreachable dead-CSS exception, zero component usages). |
| B4 | FAB clearance + opaque chrome | ⚠️ **Partially done.** 4 of 5 nav-bar opacity sites bumped to 99%; the one still at 96% is `html[data-rivt-compact-device="true"] .v2-mobile-nav` — the small-phone-specific rule, i.e. the exact device class this whole train targeted. FAB clearance was never engineered to the spec'd `padding-bottom: calc(fab+nav+24px+safe-area)` formula — it currently "works" by coincidence at most widths, but the reviewer traced a real edge case: a new user (start-card FAB variant, taller) on a device with a real safe-area inset (e.g. iPhone home indicator) can have their last feed card partially covered. Not confirmed live, but the arithmetic is concrete (≈200px needed vs. ≈180px available). |
| B5 | Shop Talk directory quieting | ⚠️ **Partially done.** Join buttons: correct (pre-existing, matches spec). Chip stutter: removed. Meta-line truncation: fixed correctly with a clean 420px breakpoint. Pluralization: **fixed in only 1 of 3 known sites** — the community list row got the new `pluralize()` helper, but the community detail-page header (`ShopTalkView.tsx:1041-1042`, "1 members"/"1 posts") and Trade News ("1 articles · 1 sources", `:1339`) still show the exact bug the spec named. Home community-card avatar colors: fixed and consistent. Per-post author avatar colors (`TradePostCard.tsx` `avatarTone()`): still random per-user hex, untouched — same complaint one level down, wasn't literally in scope but worth a follow-up line.

---

## What this means practically

Nothing here is worse than before the train — every functional fix is a net improvement, and B1/B3/B4/B5 partial completions are still improvements, just not 100% of what was asked. The one item that actually needs attention soonest is **B2**, because it was flagged as the single highest-leverage visual fix and is functionally untouched — the dark-mode "neon" look the audit called out is still there today on rivt.pro.

## Recommended follow-up patch (small, same pattern as before)

1. **B2, for real this time**: mechanical replacement of the 79 remaining raw hex sites → `var(--v2-success)`/`var(--v2-danger)`/`var(--v2-warning)`. Start with the 5 sites explicitly named in the original spec (`profile-hub.css:210,699,847-853,878`; `network-hub.css:309`) — these are the exact lines a re-check will grep for.
2. **A5 residual**: rewire `netScore()` (`TradeFeed.tsx:37-39`) and the "Hot" sort (`ShopTalkView.tsx:882-885`, `community-utils.ts:37-38`) to read from the real reaction ledger (`getPostReactionState`/`getAnswerReactionState`) instead of the dead `post.upvotes/downvotes` fields.
3. **B5 residual**: apply the existing `pluralize()` helper to `ShopTalkView.tsx:1041-1042` and `:1339` — same fix, two more call sites.
4. **B4 residual**: bump `html[data-rivt-compact-device="true"] .v2-mobile-nav` to the same 99% alpha as the other 4 nav rules; convert `.trade-feed` bottom padding to include `env(safe-area-inset-bottom)` in the formula, matching what Shop Talk's sidebar already does correctly.
5. **B1 residual**: sweep the 4 remaining raw `100px` pill sites to `var(--v2-radius-pill)`; add `--green: var(--v2-success);` to `styles.css :root`.
6. Small robustness nits, batch together: try/catch around `clearRivtLocalState()`; disabled-state CSS on the Convert-to-invoice button; support mailto in the billing-reconcile failure message.

None of these are launch blockers — they're all real but small, and none regress anything live. This is a good candidate for a single fast follow-up train rather than an emergency fix.
