# Codex build prompt — RIVT onboarding v2 (swipeable hybrid)

**Please review and critique this plan before building. Flag anything you'd do
differently, any Gate-A/compliance risk, and any file you think I've mis-scoped.
Then build it on a `codex/*` branch, verify, and hand back per
AI_COLLABORATION_WORKFLOW.md.**

## Goal

Michael wants first-run onboarding that (a) *feels* like modern app onboarding —
full-screen pages you swipe through — and (b) actually gets a low-patience trades
audience to real value fast. Current onboarding is long, static (tap not swipe),
and opens on a login form. We're replacing the entry experience and paginating
the post-login setup into swipeable steps. Keep the Home "getting started"
checklist — it's good.

Decisions already made (do not re-litigate):
- Pre-signup = **hybrid**: 2–3 skippable full-screen swipe slides → live personalized guest preview.
- Post-login setup = **break the 5-section form into swipeable one-question-per-screen steps** with a progress bar.

## Research principles to honor (from a fresh 2025–26 review)

- Get to the "aha" (real jobs + community in their trade) in **under 60s**.
- Carousels are weak as pure marketing — so ours must be **short (≤3), skippable, value-led (one idea + one line per slide), with progress dots**, and end in a real preview, not more marketing.
- **Defer signup** to the moment of intent (apply / post / message / save).
- **Personalize early**: trade + location up front drives the preview.
- **Every form field costs ~3–5% completion** — paginating helps *perceived* length; also trim where safe.

---

## Part 0 — Fix first (dev-only crash, but do it before anything else)

`src/App.tsx:1278` calls `.trim()` through an optional chain that only guards the
account, not the field:

```ts
const homeProfileHasBio = Boolean(canonicalAccount?.profile.headline.trim() || canonicalAccount?.profile.bio.trim());
```

The dev-bypass mock (`src/App.tsx:359-364`, cast `as unknown as CanonicalAccount`)
omits `headline`/`bio`, so Home **crashes to a blank screen under dev bypass** —
which is how we screenshot/test. Production is safe (the real type requires those
as strings), so this is not a prod bug, but it blocks testing.

Fix both:
1. Guard the field access: `canonicalAccount?.profile.headline?.trim()` and `...bio?.trim()`.
2. Make the dev mock complete enough to satisfy the real shape (add `headline`, `bio`, `visibility`, `serviceArea`, full `trades` entries, `capabilities`) so the `as unknown` cast stops hiding drift.

---

## Part 1 — Pre-signup entry (hybrid)

Replace the current stacked `EntryShowcase` + login-first `AuthGate` layout in
`src/features/auth/AuthScreens.tsx`.

**A. Swipe intro — max 3 slides, full-screen, 430px-first**
- Horizontally swipeable (touch + drag), **progress dots**, a persistent **Skip** in a corner.
- One idea + one short line each. Suggested 3:
  1. "Trade talk, built for the trades." — ask questions, get answers from people who've done the work.
  2. "Find work. Build your crew." — real jobs and real tradespeople near you; address stays private until accepted.
  3. "Run the job from your phone." — calculator, invoices, daily logs, photos, records.
- Prefer real job-site photography over abstract illustration (credibility for this audience). If we don't have art yet, use clean typographic slides on brand — do **not** block on assets.
- Last slide's primary CTA and Skip both go to the **guest preview** (not a signup wall).

**B. Live personalized guest preview (the aha)**
- Before/at entry to the preview, ask **trade + location** (icon tiles for trade, "use my location" or ZIP for location) — glove-friendly tap targets, no free-text where avoidable.
- Then show the **real app shell in guest mode** seeded to that trade + location: real Shop Talk feed + Work items for their trade. Reuse existing guest browsing; keep guest write-gating.
- Honest states only: if there's nothing real to show for a trade/area, say so — **no fake jobs/people presented as real** (Gate A rule).

**C. Signup only at intent**
- Keep "Browse first" as the default path in.
- Signup wall triggers on apply / post / message / save (existing `GuestSignUpPrompt` pattern is fine).
- When signup *is* shown: **default to signup, not login**; offer Google + Email (existing providers); name + auth only.

**D. Kill the scary entry error**
- The red "RIVT could not verify your session…" must **not** render as an error on first visit for an anonymous user. Only show it after a genuine failed auth *attempt*. Treat "no session yet" as the normal anonymous state.

## Part 2 — Post-login setup as swipeable steps

Refactor `OnboardingFlow` in `src/features/auth/AuthScreens.tsx` from one long
scroll into **one-question-per-screen swipeable steps** with a top progress bar
and Back/Next (swipe + buttons). Keep the same collected data and the existing
`OnboardingResult` payload + routing to `preferredStartView` — this is a
presentation change, not a data change.

Suggested step order (merge where natural to keep it short):
1. Role (skip/lock if already chosen at signup — it usually is).
2. "What are you here to do first?" (goal selector → sets start view).
3. Trade + service area (the personalization that matters).
4. Topics for the feed (optional; allow Next without forcing many).
5. Consent + email-verify status → "Enter network" (routes to `preferredStartView`).

Keep all existing server validation and compliance gates intact. Keep the
completion indicator but express it as step progress, not a dense "% ready" panel.

## Part 3 — Home checklist (keep, one polish)

`TradeFeed` "Get RIVT working for you" checklist is good — leave the logic. One
visual nit: the floating **"+ Ask" FAB overlaps the checklist's "Ask the trades"
button** on mobile. Adjust FAB position / z-order or the checklist's bottom
padding so they don't collide.

---

## Guardrails (Gate A)

- No fake jobs/people/claims presented as real; guest/preview states stay visibly preview-only.
- Onboarding preference state can be frontend-only **only** for UI routing; anything touching permissions/identity/visibility/billing/work stays server-owned.
- Keep reactions server-backed; don't reintroduce demo/prompt posts for authed users when the server returns empty.
- Mobile-first 430px is the primary target.

## Acceptance criteria

- New anonymous visitor at 430px: no login form first, no red error; ≤3 swipeable slides (skippable); reaches a real, trade-personalized preview in well under 60s.
- Signup only appears at a real action.
- Post-login setup is swipeable step-by-step, still collects the same data, still routes to the goal's start view.
- Home checklist unchanged in behavior; FAB no longer overlaps it.
- Dev-bypass Home no longer crashes.

## Verification before handoff

- `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm audit --omit=dev`.
- Screenshot the new entry + setup at 430px and confirm: heights are reasonable (entry not a 2,500px scroll), zero page errors.
- Handoff block: Branch / Commit / Pushed / Deployed / Verified / Boundary.
