# Codex build prompt — Launch Final Train

Source audit: `docs/product/FINAL_LAUNCH_AUDIT_14b9023.md`. All file:line
references below were verified against master @ `14b9023` (current
production). Full context for every item lives in that audit doc.

---

## Context

You are building the last train before the Jacksonville soft launch. The
prior QA train fixed all four P0s; this train fixes the one regression it
introduced, three carried P1s, and the top five look-and-feel items. After
this, launch is a go.

## Ground rules

- Branch: `codex/launch-final-train` off current `origin/master` (14b9023).
  One branch, one train. Do not batch unrelated work into it.
- Nothing here may weaken Gate A auth/trust/moderation. No new features.
- Every fix is a small diff. If any item turns out to need a big refactor,
  STOP on that item, note it in the handoff, and ship the rest.
- Commit style: short imperative subject per logical fix (not one mega
  commit), per AI_COLLABORATION_WORKFLOW.md.

---

## Part A — Functional fixes

### A1. Restore fraction entry on compact phones (P1 regression — do this first)

**Problem:** On compact devices (the `data-rivt-compact-device` flag set at
`src/App.tsx:477-486`: coarse pointer + screen ≤375px or viewport ≤360px —
iPhone SE/12-13 mini class), the calculator's sixteenths strip is
`display:none` at `tools-studio.css:6488-6491`, and the ruler rail is also
hidden (`:6427-6430`, plus `:5889` hides it ≤1180px for everyone). The FRAC
chip only clears the fraction (`FieldCalculatorTool.tsx:300`). Net effect:
on an iPhone SE the only way to enter 5/8" is tapping H/L (±1/32) twenty
times. The flagship tool lost its core input on exactly the devices the
hardening commits targeted.

**How:**
1. Delete the `display:none` rule for `.fraction-strip` in the compact
   block (`tools-studio.css:6488-6491`).
2. Add compact sizing instead: let the 15 fraction buttons wrap to 2 rows
   (`flex-wrap: wrap` or a `grid-template-columns: repeat(8, 1fr)` /
   `repeat(auto-fit, minmax(38px, 1fr))` grid), min-height ≥ 40px per
   button, font ≥ 12px. Shrink something decorative instead if vertical
   space runs out (brand mark, topbar padding) — never the primary input.
3. Leave the ruler rail hidden on compact — it duplicates the strip.

**Acceptance:** On a 360×640 and a 375×553 viewport with the compact flag
active, entering "5/8" takes at most 2 taps and every fraction button's
tap target is ≥40px tall. Add an assertion to
`scripts/mobile-actions-ui-smoke.mjs`: at 375×553 with the compact flag
forced, `.fraction-strip` buttons exist, are visible, and the "5/8" button's
bounding box is inside the viewport.

### A2. Stripe checkout reconciliation when the webhook is missed (P1)

**Problem:** Entitlements are written ONLY by the webhook
(`server/billing.js` — the `checkout.session.completed` branch at :382-392
only upserts the customer; subscription events do the provisioning). The
success redirect includes `session_id={CHECKOUT_SESSION_ID}`
(`billing.js:35`) but nothing ever reads it. `ProfileHub.tsx:990-1006`
polls `GET /billing/status` 5× over ~7.5s, then permanently shows "Payment
is still processing…". If the webhook is delayed/misconfigured, a charged
customer stays non-Pro forever with no self-serve recovery.

**How:**
1. Server: add `POST /api/v1/billing/reconcile` (authenticated, rate-limited
   like other billing routes, idempotent). Body: `{ sessionId }`. Retrieve
   the Checkout Session from Stripe (`checkout.sessions.retrieve` with
   `expand: ['subscription']`), verify `session.client_reference_id` /
   customer maps to the calling account (reject otherwise — do not let one
   account reconcile another's session), and if the session is paid and has
   a subscription, upsert the same `billing_entitlements` row the webhook
   path writes (reuse the existing provisioning function — do not duplicate
   the logic). Return the fresh billing status. Audit-event on success.
2. Client: in the ProfileHub `?billing=success` handler, capture
   `session_id` from the URL before it's stripped. If the existing 5-poll
   loop ends without `active`, call the reconcile endpoint once with the
   session id, then refresh billing status. Only if THAT also fails show
   the "still processing" copy, now with the support mailto appended.
3. Integration test: simulate the missed webhook (no entitlement row),
   call reconcile with a stubbed Stripe session retrieval, assert the
   entitlement row is written and status flips to active; assert a
   mismatched-account session returns 403 and writes nothing.

**Acceptance:** With webhook delivery disabled in a test, a completed
checkout still ends with Pro active via the reconcile path; cross-account
reconcile attempts are rejected; the happy path (webhook arrives first) is
unchanged.

### A3. Purge rivt.* localStorage on logout and session expiry (P1)

**Problem:** `handleLogout` (`src/App.tsx:1075`) and the session-expired
handler (`App.tsx:512-536`) reset React state only. PII persists for the
next user on a shared device: `rivt.profile.v1`, `rivt.business.v1`,
`rivt.clients.v1` (`client-records.ts:9,79`), `rivt.clientThreads.v1`
(`InboxCenter.tsx:37`), `rivt.jobs.v1`, `rivt.reviews.v1`, certs, rate
cards, per-job contacts/notes, etc.

**How:** Add one helper (e.g. `purgeLocalAccountData()` in
`src/lib/app-helpers.ts`): iterate `localStorage` keys, remove every key
starting with `rivt.`, EXCEPT the device-level theme preference key (check
`src/app-shell/useAppTheme.ts` for its exact name and exclude it — theme is
a device setting, not account data). Call it in `handleLogout`'s `finally`
block and in the session-expired handler. Wrap in try/catch like the other
storage helpers.

**Acceptance:** After Sign out (and separately after a simulated 401
session expiry), `Object.keys(localStorage).filter(k => k.startsWith("rivt."))`
contains only the theme key. Logging back in as a different account shows
none of the previous account's certs/business/clients/drafts.

### A4. Fire session-expired from network-records-api (3-line fix)

**Problem:** `src/features/network/network-records-api.ts:29-30,49-50,67`
uses raw `fetch` and swallows 401s, so Crew surfaces still mislabel a
revoked session as "Couldn't sync - saved on this device only"
(`NetworkHub.tsx:884,925,967,1002,1197`) instead of triggering the global
sign-out that `tool-records-api.ts:44,64,83` and `shop-talk-api.ts` already
fire.

**How:** In each of the three helpers, before the existing failure return:
`if (response.status === 401) notifySessionExpired();` (import from
`src/lib/api.ts` — same pattern as `tool-records-api.ts:44`).

**Acceptance:** Clearing the session cookie and then touching any Crew
sync path signs the user out with the "Session ended" prompt, same as
Tools/Shop Talk already do.

### A5. Feed-card votes and community label from the server (P1)

**Problem:** Three connected lies on the Shop Talk/Home feed cards:
- `src/App.tsx:335` (posts) and `:318` (answers) hardcode
  `upvotes: 0, downvotes: 0` when mapping server posts, so real tallies
  never reach the cards.
- `TradePostCard.tsx:47-51,54,65-76` keeps its own per-device votes in
  `localStorage["rivt.postVotes.v1"]` — card score = 0 + local adjustment,
  different on every device, never persisted, contradicts the detail pane
  (which uses the real server reaction path, `ShopTalkView.tsx:893-895`).
- `TradePostCard.tsx:56` derives the community label from a hardcoded
  trade→community map (`:19-31`), ignoring `post.communityName` which the
  server returns and App already threads through (`App.tsx:343`).

**How:**
1. Thread the existing reaction state into the card: pass
   `getPostReactionState(post.id)` (or the summary values) and the existing
   `onVotePost` handler from the container into `TradePostCard`. Render
   score from server counts + the actor's own reaction, exactly like the
   detail pane does. Optimistic update on tap, revert on failure (the
   reaction hook already supports this — reuse `useCommunityReactions`, do
   not build a second path).
2. Delete the `rivt.postVotes.v1` store and all its read/write code.
3. Community label: `post.communityName ?? communityFor(post.trade)` —
   prefer the server value, keep the map only as fallback for local drafts.
4. Where the card renders in TradeFeed (Home), the same props must flow —
   check `TradeFeed.tsx`'s usage of `TradePostCard` and thread through.

**Acceptance:** Vote on a post from the feed card, reload → count persists
and matches the detail pane exactly. A post created in a user-created
community shows that community's name on its card. `git grep
"rivt.postVotes"` → zero hits. Cross-account: user B sees user A's vote
reflected in the count.

### A6. Disable "Convert to invoice" at $0 (nit, 2 lines)

`EstimateTool` now starts honestly empty, but "Convert to invoice" is
enabled at $0.00 and creates a $0 invoice. Disable the button when the
computed target is 0 (`disabled={targetCents === 0}` plus the disabled
style already used elsewhere).

**Acceptance:** Button disabled on the empty estimate; enabled the moment
any line produces a nonzero target.

---

## Part B — Look-and-feel fixes

### B1. Define the missing design tokens (fixes a real rendering bug)

`--v2-radius-xl` is used with NO fallback at `network-hub.css:725,1322` and
`tools-studio.css:3933` but never defined — those modals and the tools
lightbox render with square corners today. Also missing/aliased-by-fallback:
`--v2-radius-pill`, `--v2-destructive`, `--green`, `--v2-font-mono`, and
there is no `--v2-on-accent`.

**How:** In `src/app-shell/tokens.css` (and its `[data-theme="dark"]` block
where relevant) add:
```
--v2-radius-xl: 20px;
--v2-radius-pill: 999px;
--v2-destructive: var(--v2-danger);
--v2-on-accent: #fff;
--v2-font-mono: "IBM Plex Mono", ui-monospace, monospace;
```
and `--green: var(--v2-success);` wherever the legacy quiz scope needs it
(styles.css `:root`). Then replace the literal pill radii (`999px`/`99px`/
`9999px`/`100px`, ~127 sites) with `var(--v2-radius-pill)` — mechanical sed,
verify no visual diff. Point `--calc-on-accent` (tools-studio.css:5144) at
`var(--v2-on-accent)`.

**Acceptance:** Network modals and tools lightbox render rounded corners.
`git grep -- "--v2-radius-xl" src/app-shell/tokens.css` hits. No remaining
`999px` literals in feature CSS.

### B2. Status colors → tokens (the biggest "feels amateur" fix)

~60 uses of raw Tailwind palette colors glare in dark mode because they
never adapt: greens `#22c55e ×25, #16a34a, #15803d, #1a9e4a, #3a9e5f` →
`var(--v2-success)`; reds `#ef4444 ×35, #dc2626, #b91c1c, #c0392b` →
`var(--v2-danger)`; ambers `#f59e0b, #b45309, #d97706` →
`var(--v2-warning)`. Heaviest files: `profile-hub.css` (:210, :699,
:847-853, :878), `pro.css`, `network-hub.css:309`, `work-workspace.css`,
`shop-talk.css`.

**How:** Mechanical replacement, file by file, eyeballing each surface in
light AND dark after. Do not change any layout property in the same commit.

**Acceptance:** `git grep -E "#22c55e|#ef4444|#16a34a|#dc2626|#f59e0b"
src/features/` → zero. Dark-mode screenshots of Settings (cert expiry
warnings), Work (status pills), and Pro card show desaturated token colors,
not neon.

### B3. One primary CTA — retire the black legacy button on auth/onboarding

Two competing primary buttons coexist: `.v2-primary-button` (orange, the
brand) vs `.primary-action` (styles.css:2398 — black `#080d10`, hardcoded)
— and the black one lives on the auth/onboarding screens a new user sees
FIRST (~16 tsx call sites).

**How:** Restyle `.primary-action` to alias the v2 look (accent background,
`var(--v2-on-accent)` text, radius-md, 44px min-height) — a CSS-only change
is lower-risk than renaming 16 call sites. Same for `.secondary-action` →
match `.v2-secondary-button`. Check every auth/onboarding screen in both
themes afterward.

**Acceptance:** No black primary CTA anywhere in signup/onboarding; the
carousel, signup form, and onboarding steps all show the same orange
primary button as the rest of the app.

### B4. FAB clearance + opaque chrome (stop content bleeding through)

Two related artifacts, both themes:
- The floating "Post work"/"Ask" pill overlaps feed-card titles on Home —
  no bottom clearance is reserved.
- List content ghosts through the translucent bottom nav (and top bar in
  spots) on Home/Tools/Settings.

**How:**
1. Add `padding-bottom: calc(<fab height> + <nav height> + 24px +
   env(safe-area-inset-bottom))` to the scrolling feed containers that host
   the FAB (Home feed, Shop Talk feed).
2. Make the bottom tab bar background opaque (`var(--v2-bg)` or surface
   token, keep the top border) — or if the glass look is wanted, raise its
   background alpha to ≥0.97 AND still add the scroll padding. Same
   decision for the top bar. One approach, applied to both bars, both
   themes.

**Acceptance:** At 390×664, scroll Home to every position — no feed text
is ever readable through either bar, and the last card can scroll fully
above the FAB.

### B5. Quiet the Shop Talk directory

Four small changes to `ShopTalkView.tsx` + `shop-talk.css`:
1. **Join buttons → secondary style.** The joined/unjoined directory rows
   currently stack 5+ high-saturation orange pills. Use the quiet secondary
   button for "Join"; keep orange only for the page's single primary action
   (Ask). "Joined" stays the muted chip it already is.
2. **Pluralize counts.** Add a tiny helper `plural(n, "member")` and fix
   "1 members / 1 posts" at `ShopTalkView.tsx:1038-1039` and `:1125` (and
   Trade News "1 articles · 1 sources" if present).
3. **Stop mid-word truncation.** The meta line "0 members · 0 posts · C…"
   ellipsizes the description one letter in at 390px. Hide the third
   segment below ~420px (`display:none` on a wrapping span) instead of
   truncating it.
4. **Chip stutter.** `ShopTalkView.tsx:411` renders `label.slice(0,3)`
   ("QUE") next to the full label ("Question"). Delete the slice span —
   the full label alone.
Also fix the Home community-card counts (TradeFeed): a bare "0"/"1" under
each name → labeled "1 member" / hide the count when 0, and give the
community avatar circles a single consistent brand-neutral background
(one token) instead of per-community random purple/brown/gray.

**Acceptance:** Directory at 390px dark mode: one orange element max on
screen; "1 member"; no "· C…" fragments; composer chips show "Question"
once. Home cards show labeled or no counts; avatar circles one color
family.

---

## Verification (all required before handoff)

```
npm run build && npm run lint && npm run lint:security
npm run test:unit && npm run test:e2e
npm run test:ui:mobile-actions        # includes the new A1 assertion
TEST_DATABASE_URL=<configured> npm run test:integration   # do not skip
npm audit --omit=dev
```

Live probes (dev stack, not just tests):
1. Compact-flag device 375×553: enter 5/8" in ≤2 taps on the calculator.
2. Vote from a feed card → reload → count persists and matches detail.
3. Sign out → localStorage has no rivt.* keys except theme.
4. Simulated missed webhook → reconcile flips Pro active.
5. Fresh screenshots at 375×553 AND 390×664, light AND dark: Home,
   Shop Talk directory, calculator, an auth/onboarding screen. Attach to
   the handoff.

Deploy per PRODUCTION.md, confirm rivt.pro `/api/health` serves the new
commit, run `npm run monitor:production`.

## Handoff format

```
Branch: codex/launch-final-train
Commit: <sha>
Pushed: yes/no
Deployed: yes/no (+ /api/health commit)
Verified: <exact commands that passed; call out integration explicitly>
Probes: <results of the 5 live probes>
Boundary: <anything intentionally skipped + why>
```

## Explicit non-goals for this train

Dead-CSS deletion PRs (separate follow-up — pure deletions in styles.css
~300 classes and tools-studio.css ~213), full type-scale/shadow/motion
sweeps, Calendar/templates/access-notes/shout-outs P2 batch, ReportViewer
tokens, palette-source unification (styles.css ↔ brandConfig ↔ tokens).
All tracked in FINAL_LAUNCH_AUDIT_14b9023.md.
