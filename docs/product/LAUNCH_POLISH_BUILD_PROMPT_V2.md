# Codex build prompt — Launch polish pass (from ef32b88 audit)

Source audit: `docs/product/LAUNCH_POLISH_AUDIT_2026-07-04.md` (file:line for
every item). Work on `codex/*` branches per AI_COLLABORATION_WORKFLOW.md, one
branch per phase, handoff block per phase (Branch/Commit/Pushed/Deployed/
Verified/Boundary). No new features — this is subtraction, honesty, and
reachability. Nothing here may weaken Gate A auth/trust/moderation.

Verification for every phase: `npm run build && npm run lint && npm run
test:unit && npm run test:e2e` + the phase's targeted proof listed below.
Mobile checks at **390×664** (not tall viewports).

---

## Phase 1 — Mobile reachability + money truth (blockers #1–#6)

1.1 **Shop Talk composer scroll.** Give the create-post modal a scrollable body
(`overflow-y:auto`, `max-height: 100dvh`) and a sticky footer bar holding
Cancel/Post. Post button must be tappable at 390×664 and 390×740.
Proof: extend `scripts/mobile-actions-ui-smoke.mjs` to open the composer at
390×664 and assert the Post button's bounding box is inside the viewport.

1.2 **Estimate→Invoice total agreement.** In `convertToInvoice`
(EstimateTool.tsx:85-136): distribute overhead/margin/contingency
proportionally into the labor and materials lines (no "Overhead"/"Margin and
contingency" client-facing lines), and make `sourceNote` quote the actual
line-item sum. If the rounded target is kept as the recommended price, add one
"Rounding adjustment" line so banner total == invoice total exactly.

1.3 **Price guidance only on labor lines.** Guidance chips (IN RANGE/LOOKS
HIGH) must only evaluate lines flagged as hourly labor (qty=hours), never
lump-sum/materials/adjustment lines.

1.4 **Invoice money hygiene.** One shared currency formatter
(Intl.NumberFormat, 2 decimals, used by Estimate/Invoice/Bid/priceGuidance);
compute totals in cents; clamp qty/rate to ≥0 at the handler; integer-aware
quantity display (8 not 8.0); single conversion banner (delete the duplicate
`syncMessage` init at InvoiceDraftTool.tsx:127) with a dismiss + "Start blank
invoice" action; clear `convertedEstimateDraft` on every `setActiveTool`
transition, not just `openToolFromHub` (ToolsStudio.tsx:2707-2710).
Mobile line grid: qty narrow, rate wide (fix tools-studio.css:6366; delete the
dead 1983 block).

1.5 **Bid builder mobile summary.** Replace `display:none` on
`.v2-bid-summary-stack` (css:3180), `.v2-mileage-summary` (css:3235),
`.v2-safety-summary` (css:3724) with a sticky bottom summary on ≤900px.

1.6 **Kill the false job claim.** Remove accept-bid→localStorage-job and the
"✓ Job created! Open the Work tab" toast (BidBuilderTool.tsx:266-290, 358).
If bid→job is wanted later it goes through the real jobs API.

1.7 **Sync honesty.** Replace all "Sync will retry"/"cloud sync will catch up"
strings with truthful copy on failure ("Couldn't sync — saved on this device
only"), and collapse the permanent notice+syncMessage pairs into one transient
status line. (Building a real retry queue is out of scope this pass.)

Acceptance: composer posts from a 390×664 tap-only run; converted invoice total
equals its banner; no Overhead/Margin lines; no guidance chip on non-labor
lines; bid total visible and accept reachable on mobile; no false sync/job copy
greps remain (`grep -r "Sync will retry\|catch up when reachable\|Open the Work tab to find it"` → 0).

## Phase 2 — Trust & support honesty (blockers #7–#12)

2.1 **Remove the ID-gate overclaim.** Delete/replace
`brandConfig.ts:43` (`idGateLabel`) and its render in the consent step. State
only what is enforced today (email verification).

2.2 **Storage truth.** Read `accountStorage.usedBytes/objectCount` in
App.tsx:518-543; render the meter from real data; soften the 90% warning to
match reality or implement the quota check at upload; "Storage limit" wording
with an honest "no cap set during beta" fallback when env is unset.

2.3 **Real support channel.** One Settings row with a real support mailto (env-
configured address) and honest response expectation. Wire the feedback form to
a server endpoint (reuse the report/audit-event machinery) or delete the form
and its "Sent!/reviewed by the RIVT team/Replies go to" copy.

2.4 **Legal reachability.** Terms/Privacy/Subcontractor rows link to real
documents (hosted markdown is fine); wire or remove "Request data export" and
"Review consent".

2.5 **Notification toggles.** Persist per-account preferences server-side and
honor them in the notification poll/browser-notification path — or remove the
panel this pass. Move "Trade personalization" out of Notifications; kill the
full-page reload.

2.6 **Onboarding steps.** One panel per step; numbers derived from
`setupSteps.indexOf(id)+1`; persist step data (goal, profile fields) to the
server as each step advances so reload resumes; send `goal` and
`topicInterests` in the completion payload or cut the topics step.
Also: "Enter network" → "Open RIVT"; fix the clipped RIVT wordmark and the
"9:2" clock in the auth mockups; raise signup-error banner contrast.

Acceptance: consent screen contains no unenforced claims; storage shows real
bytes after an upload (integration-test the endpoint mapping); support mailto
opens; legal docs open; toggles survive reload and provably gate one
notification type; onboarding survives mid-flow reload; step numbers agree.

## Phase 3 — Dead engagement systems + fake data (#13–#17)

3.1 Flip the Home checklist condition (TradeFeed.tsx:248) to
`onboardingComplete && !dismissed && nextStep`; verify it renders for a fresh
account and disappears when dismissed/complete.
3.2 Persona from server profile (primary trade) instead of localStorage;
delete `LocalSetupPrompt.tsx` + state + CSS.
3.3 Delete pre-seeded records/training (App.tsx:334-340) and
`SETUP_RECORD_BASELINE`; progress meters start at zero.
3.4 Feed-card truth: card community label prefers `post.communityName`;
card votes go through the server reaction path used by the detail view; delete
the localStorage vote store and the `Math.max(upvotes,3)` inflation; delete the
keyword heuristics in `postBelongsToCommunity`.
3.5 Reputation honesty: drive "rep" and contributor badges from the server
`reactionSummary` + verified-fix counts, or remove the badges/rep chip for
launch. Remove "Mark as answered" (cosmetic, in-memory only) or wire it to a
server status.
3.6 Earnings dashboard: feed from real `payment_record` tool-records or remove
it from the hub this pass.
3.7 Join/leave: await `setCommunityMembership`, revert local state on failure.

Acceptance: fresh account shows checklist and zero progress; persona chips
activate from the server trade; a post in a user-created community shows that
community's name on its card; card and detail vote counts agree after reload;
no rep/badge renders from device-local data.

## Phase 4 — Tools consolidation + subtraction (#18–#20)

4.1 Merge Daily report into Daily log (they share the `daily_report` record
type); one daily surface. Migrate nothing — both read the same records.
4.2 Merge Tax estimator into Tax summary; one SE-tax formula module.
4.3 Extract `useSyncedToolRecords` hook; replace the 13 copies. Extract shared
line-editor + currency/quantity utils (Estimate/Bid/Invoice).
4.4 Hub trim to ~14 tools: hide Contracts (no persistence, unreviewed legal
templates, no disclaimer) and Job checklists behind a flag; Earnings per 3.6.
Fix the hub storage note (ToolsStudio.tsx:3276) to describe reality.
4.5 Delete the ~1,250 lines of orphaned tools-studio.css and flatten the
4-layer `.v2-tool-launch-*` override archaeology; then fix remaining sub-40px
touch targets (expense/time/mileage row buttons, contract pills, checklist
rows; TimeTrackerTool.tsx:261 inline 12px).
4.6 Copy sweep: plural helper ("1 members/1 posts/1 articles"); remove the
`label.slice(0,3)` chip prefixes; collapse the duplicate legacy lane chips
(All/Questions/Sub Requests/Safety/General) into the flair row; single "Joined"
chip; "Example question" once per card; de-policy the guest preview copy;
role-correct rate-card copy; plan tile driven by `usePro()`; user-facing
billing-unavailable copy (no env var names); one service-radius control;
Theme panel only on Settings; fix "HARDWAR" tab clipping; opaque bottom tab
bar (or padding so list content doesn't bleed through); punch-list photo
payloads capped/off localStorage.

Acceptance: hub shows ≤14 tools, all reachable, none duplicated; CSS orphan
scan (script it) reports <3%; no sub-40px interactive targets in Tools at
390×664; `npm run test:ui:tools` green; grep proofs for removed strings.

---

## Sequencing and ownership
Phase 1 and 2 are the launch gate (blockers #1–#12) — do them first and in
order. Phases 3–4 can follow in the same release train. One `codex/*` branch
per phase; do not batch phases into one mega-branch. If any item conflicts
with in-flight Shop Talk work, the server-owned direction in
SHOP_TALK_REDDIT_MODEL_BUILD_PROMPT.md wins.

## Explicit non-goals this pass
Sync retry queue, real ID verification, notification digest emails, members-
only communities, invoice sending on RIVT's behalf, payment processing, new
tools of any kind.
