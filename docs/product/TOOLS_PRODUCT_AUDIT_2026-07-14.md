# RIVT Tools Product Audit

**Date:** 2026-07-14
**Audited source:** `origin/master` at `edcc98e`
**Scope:** Every current tool mode, Tools navigation, mobile and compact-phone
layouts, one-handed use, workflow clarity, duplication, product fit, and launch
risk. This is a review and product-direction document; it does not change
runtime behavior.

## Executive verdict

RIVT should not be rebuilt from scratch and should not pivot away from its
trades network. The strongest direction is narrower and more useful:

> RIVT is the place tradespeople find work, work together, and keep the field
> record from first measurement through final invoice.

The current Tools area contains useful work, but it presents too much of that
work as separate products. `ToolMode` contains 21 modes, the hub exposes 14
launchers, and six more implementations remain reachable only by deep link or
internal state. Several tools duplicate one another or store parallel versions
of the same business record. That is why Tools can feel overbuilt even though
individual screens are often good.

The recommended correction is a product-architecture change, not a cosmetic
reskin:

- Keep five clear daily tools: **Calculator, Camera, Estimate, Invoice, Daily
  Log**.
- Combine related utilities into **Materials** and **Time & Costs**.
- Fold punch, safety, receivables, earnings, and tax summaries into the workflow
  they support instead of advertising them as separate apps.
- Retire duplicate, stale, or high-liability modes before launch.

This reduces the visible product from 14 tool launchers to seven coherent apps
without removing the capabilities that users are most likely to value.

## Audit method

The audit combined:

1. Source inspection of all modes in `src/features/tools/` and their storage,
   API, routing, and job-context behavior.
2. Rendered Playwright passes at desktop `1440x900`, mobile `390x844`, and
   compact phone `320x568`.
3. Full-page inspection below the fold, including forms, previews, sticky
   actions, secondary controls, and empty states.
4. Comparison with the product patterns documented by CompanyCam, Joist,
   Jobber, Fieldwire, Buildxact, and the IRS's current mileage guidance.

The rendered pass found no universal horizontal-overflow failure. The larger
problem is information architecture: long forms, duplicated actions, repeated
summaries, and unrelated tools competing equally for attention.

## Current inventory

`src/features/tools/ToolsStudio.tsx` currently defines these 21 modes:

`hub`, `calculator`, `estimate`, `invoice`, `materials`, `daily-log`,
`job-photos`, `time-tracker`, `expense-logger`, `earnings`, `bid-builder`,
`mileage`, `price-book`, `safety-checklist`, `tax-estimator`, `punch-list`,
`contracts`, `job-checklist`, `payments`, `daily-report`, and `tax-summary`.

The hub promotes five primary tools and nine utilities. Six additional modes
still exist without a normal launcher. The implementation is concentrated in
large surfaces: `ToolsStudio.tsx` is roughly 167 KB and `tools-studio.css` is
roughly 254 KB before its extracted tool components are counted.

## Product principles for the rebuild

Every retained app should satisfy all of these rules:

1. **One obvious job.** Its name describes the result, not an internal feature.
2. **Useful without a RIVT job.** A contractor may use it for off-platform work.
3. **Optional work context.** Standalone, private project, or accepted RIVT job
   is chosen explicitly and never guessed from `jobs[0]`.
4. **One-handed primary action.** The most common action lives in the lower
   thumb zone and remains reachable above safe-area chrome.
5. **Progressive complexity.** Common fields first; advanced assumptions and
   reports are collapsed until requested.
6. **One record, one owner.** Estimate, invoice, payment status, photo, log, and
   cost data do not have parallel disconnected stores.
7. **Truthful state.** Saved, sent, synced, paid, certified, and calculated mean
   exactly what the server or calculation can prove.
8. **Clear completion.** Every primary action gives feedback, opens the exact
   destination, and presents a visible next step.

## Per-tool decisions

| Current mode | Verdict | Why | Recommended home |
|---|---|---|---|
| Hub | **Rebuild** | Users must interpret Core apps, Utilities, a floating field tray, recent items, and a global Camera destination. | Seven-app launcher with Recent, five daily tools, and one compact All tools list. |
| Heavy 16th Calculator | **Keep and promote** | Best compact implementation; fast, one-screen, supports fractions, heavy/light, halve/double, and metric. | Daily tool. Add a small first-use explanation for `L`/`H`, then stay quiet. |
| Estimate | **Keep and redesign** | Valuable and now sends real email, but the form exposes too many assumptions at once and creates a very long mobile screen. | Daily tool. Use progressive steps: customer/scope, price, review/send. Advanced cost model collapses. |
| Invoice | **Keep and redesign** | Core paid value, but templates lead the screen and editing, sending, preview, and payment status feel like separate products. | Daily tool plus invoice list. Put details behind sections and keep Save/Send in one bottom action dock. |
| Daily Log | **Keep and simplify** | Strong field record, but form, summary, checklist, raw preview, and export actions repeat the same entry several ways. | Daily tool. Quick log first; photos/weather/checklist optional; one completed entry preview. |
| Job Photos / Camera | **Keep and promote** | Distinctive daily-use wedge and strongest proof workflow. Home is good; project feed duplicates top and bottom capture/upload controls. | Daily tool and primary nav destination. Recent photos first, albums second, capture dominant at bottom. |
| Materials | **Keep and merge** | Useful calculations, but area/waste/cost and sheet-count calculators read as separate forms stacked together. | Materials app with Takeoff and Sheets modes. |
| Price Book | **Merge** | A standalone price list has weak value because Estimate and Materials do not consume it consistently. | Materials app library, reusable from Estimate and Invoice line items. |
| Time Tracker | **Keep** | Clear purpose, low cognitive load, and direct field value. | Time & Costs app, Time tab. |
| Expense Logger | **Keep and merge** | Useful but should share project/client context and reporting with mileage and time. | Time & Costs app, Expenses tab. |
| Mileage | **Keep and merge after accuracy fix** | Useful record, but its hardcoded 2025 `$0.70/mi` rate is stale in July 2026. | Time & Costs app, Mileage tab, with date-aware rate data and an explicit estimate disclaimer. |
| Tax Summary | **Merge** | It summarizes time/expense/mileage data and is not a daily standalone destination. | Time & Costs reporting view. Never present as tax advice. |
| Punch List | **Merge** | Photos, assignments, and closeout issues belong to a project record, not a free-floating utility. | Camera/project workspace, Issues tab. |
| Safety Checklist | **Merge or hold** | A generic 25-item list can imply safety completeness without job-, trade-, or jurisdiction-specific review. | Customizable Daily Log/project checklist. Do not label it comprehensive. |
| Receivables / Payments | **Merge** | Manual invoice entry is disconnected from the actual Invoice tool. | Invoice list with Draft/Sent/Viewed/Overdue/Paid status. |
| Earnings | **Hold until server-real** | Empty or disconnected totals do not help. Value appears only when invoices and payments are authoritative. | Money summary derived from real invoices/payments; no separate launcher. |
| Bid Builder | **Retire and migrate** | Third overlapping line-item/pricing flow with less polish than Estimate. | Migrate useful drafts into Estimate; remove deep link after a compatibility window. |
| Tax Estimator | **Retire for launch** | Hardcoded 2025 assumptions are stale and create financial-guidance risk. | No public launcher. A future maintained report needs dated rates and a clear non-advice boundary. |
| Contracts | **Retire for launch** | Legal templates include lien waivers and subcontract agreements without reviewed jurisdictional coverage or adequate legal boundary. | Remove deep-link access pending counsel-approved templates. |
| Job Checklist | **Retire or rebuild as user content** | Hardcoded trade/code instructions can become outdated or wrong by jurisdiction. | User-created project templates, not RIVT-authored code guidance. |
| Daily Report | **Retire and migrate** | Duplicates Daily Log and writes the same conceptual record through another UI. | Daily Log history/export. |

## Mobile and one-handed findings

### Tools hub

The compact hub currently asks users to understand three classification
systems: Core apps, Utilities, and the persistent field-tools tray. Camera is
also a primary navigation item, so it is promoted twice. The tray overlays the
content and navigation on compact screens.

**Change:** remove the persistent overlay tray from Tools. Show a small Recent
row, then the five daily tools, then Materials and Time & Costs. Keep Camera in
the main navigation and allow one optional quick action in the nav only if a
future usability test proves it necessary.

### Calculator

The compact calculator is the standard the other tools should match: the result,
measurement mode, fractions, helpers, and number pad fit without a scrolling
form. Essential controls are reachable and stable.

**Change:** preserve its layout. Do not add spacing, hardware, stair, or other
calculators back into this screen.

### Estimate

At `320x568`, Estimate becomes a roughly 2,000-pixel document. Customer copy,
scope, labor, material, overhead, margin, contingency, target range, saved
state, and conversion controls all compete in one stream. A sticky action area
can cover content while the user is still editing.

**Change:** use three progressive stages with autosave:

1. Customer and scope.
2. Simple labor/material price, with Advanced pricing collapsed.
3. Customer-safe review with Save, Send, and Convert to invoice.

Keep internal assumptions out of the customer-facing preview and make Back
preserve the draft.

### Invoice

Invoice is approximately 2,250 pixels tall on compact mobile. Saved templates
appear before the document users came to create. Line items, totals, delivery,
and print preview are far apart.

**Change:** open to an invoice list when no draft is active and to the active
document when one exists. Keep Customer, Items, Terms, and Preview as collapsible
sections. Put Save and Send in one bottom dock. Receivables status belongs in
this list, not another tool.

### Daily Log

Daily Log repeats the work as a form, generated summary, checklist, raw-text
preview, and multiple export controls. That makes a two-minute habit feel like
paperwork.

**Change:** default to a short entry: note, photos, hours/crew, Save. Weather,
checklist, and structured details expand only when needed. After save, show one
entry card with Add photo, Edit, and Export report.

### Camera

Camera's landing direction is strong: recent photos first and a dominant bottom
capture action. In the project feed, however, capture/upload actions appear at
both the top and bottom.

**Change:** keep a single bottom dock: Destination, Feed, Capture. Filters stay
compact under the title. Capture remembers the last explicit destination but
always shows that destination before opening the native camera.

### Supporting utilities

Long generic checklists and stacked calculators are not suitable for repeated
one-handed use. Native number spinners and two-column input grids also become
fragile on narrow devices.

**Change:** supporting apps use tabs or segmented modes, `inputMode="decimal"`
for money/measurements, 48-pixel minimum targets, and a fixed lower primary
action. No required action may exist only in a top-right corner.

## Recommended information architecture

### Five daily tools

1. **Calculator**: field fraction math.
2. **Camera**: project/private capture, albums, feed, issues.
3. **Estimate**: scope and price, save/send, convert to invoice.
4. **Invoice**: invoice list, edit/send, payment status.
5. **Daily Log**: quick field record and report.

### Two supporting apps

6. **Materials**: takeoff, sheets, waste, and price book.
7. **Time & Costs**: time, expenses, mileage, and summary reporting.

### Capabilities embedded in workflows

- Punch items and job safety notes live with the project record.
- Receivables and earnings derive from Invoice.
- Tax summary derives from Time & Costs and remains an estimate, not advice.
- Saved customers, projects, rates, and line items are shared resources rather
  than separate per-tool stores.

## Research implications

The comparison products support this consolidation:

- CompanyCam centers capture around a selected project and places the camera in
  the bottom mobile navigation. Photos, timelines, checklists, reports, and
  communication share the same project context.
- Joist treats estimate, invoice, payment, and project progress as one connected
  money workflow rather than unrelated calculators.
- Jobber emphasizes assigned work and reusable quote line items instead of a
  catalog of tiny utilities.
- Fieldwire treats punch items as project issues with photos, messages, and
  ownership.
- Buildxact connects takeoff data, reusable templates, and estimating.

RIVT does not need to copy these products. It should borrow their strongest
lesson: records become valuable when they move through one coherent workflow.

## Launch-risk corrections

These should happen before the visual rebuild because they affect truth and
liability:

1. Replace the hardcoded mileage value with date-aware, centrally maintained
   rate data. The IRS rate is `$0.725/mi` for 2026-01-01 through 2026-06-30 and
   `$0.76/mi` beginning 2026-07-01.
2. Remove normal and deep-link launch paths for Contracts, Tax Estimator, Job
   Checklist, Bid Builder, Daily Report, and unfinished Earnings.
3. Add a compatibility/export path before deleting any existing device-local
   drafts or storage keys.
4. Ensure every money or record tool states whether the current record is
   server-saved, device-only, or unsaved.
5. Correct the stale `BUILD_STATE.md` header, which still describes Packet 42
   as awaiting deployment even though its deployment and founder acceptance are
   recorded later in the same file.

## Proposed build trains

### Train 0: Truth and containment

- Fix mileage rates and shared date-aware calculation.
- Block the six retire/hold modes from public/deep-link launch.
- Inventory their existing local drafts and decide migrate, export, or abandon
  before removing code.
- Correct delivery-state documentation.

### Train 1: Tools hub and shell

- Replace Core/Utilities/tray with Recent, five daily tools, and two supporting
  apps.
- Remove the content-overlay field tray.
- Standardize one compact tool header and one lower action dock.
- Add rendered smoke coverage for all seven retained apps at `320x568`,
  `390x844`, and desktop.

### Train 2: Money workflow

- Rebuild Estimate progressively.
- Rebuild Invoice around list, edit, send, and status.
- Merge Receivables into Invoice.
- Connect saved Estimate -> Invoice -> payment status without re-entry.
- Derive earnings only from authoritative records.

### Train 3: Field record workflow

- Keep Camera's bottom dock and remove duplicate feed controls.
- Simplify Daily Log to a fast entry with optional detail.
- Fold Punch and reviewed safety templates into the project workspace.
- Ensure every photo/log action returns to the exact project and confirms where
  the record landed.

### Train 4: Measure and cost workflow

- Merge Materials with Price Book.
- Merge Time, Expenses, Mileage, and summaries into Time & Costs.
- Reuse customers, projects, rates, and line items across retained apps.

### Train 5: Subtraction and migration cleanup

- Remove retired components only after saved-record handling is explicit.
- Delete orphaned CSS and localStorage keys.
- Update navigation, search, recent-tool history, analytics, tests, and docs to
  contain only retained destinations.

## Acceptance criteria

The rebuild is successful when:

- A new user can explain the difference between all seven apps without opening
  them.
- Camera opens to capture in no more than two taps from anywhere.
- Calculator accepts and solves a fraction without scrolling on `320x568`.
- A basic estimate can be drafted in under two minutes, with advanced pricing
  optional.
- Estimate -> send -> invoice -> status is one continuous record flow.
- Daily Log can be saved one-handed in under one minute.
- Every primary action has visible feedback, an exact destination, and a next
  step.
- No retained mobile screen has horizontal overflow, inaccessible controls, or
  a primary action covered by the bottom nav/keyboard.
- Desktop uses a deliberate list/detail or editor/preview layout rather than a
  stretched mobile column.
- Contracts, tax advice, code guidance, and safety claims never exceed the
  provider review and data RIVT can prove.

## Non-goals

This direction does not add homeowner flows, payroll, escrow, accounting-ledger
replacement, legal-document automation, code-compliance guarantees, or broad
scheduling/dispatch. Those would dilute the field-network and proof workflow
before RIVT has launched.

## Decision requested

Approve the seven-app direction and the retirement list before implementation.
That decision is the acceptance boundary for the next build train; visual
polish should follow the simplified architecture rather than precede it.
