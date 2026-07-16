# RIVT Full Interface Audit

**Date:** 2026-07-15
**Audited source:** `origin/master` at
`042f2314d92b609a5cdd498d464689f985280444`
**Scope:** Every reachable customer and staff surface, including navigation,
menus, panels, settings, authentication, onboarding, primary destinations,
tools, responsive behavior, interaction feedback, accessibility patterns, and
visual-system consistency.
**Change type:** Audit only. No runtime behavior changed in this packet.

## Executive verdict

RIVT does not need another wholesale rewrite. It has a credible product core:
server-owned work and community records, exact work context, honest billing,
useful field tools, a strong fraction calculator, and a genuinely good
one-handed Camera capture dock.

The interface is nevertheless carrying too much of that product at once.
Feature completeness is ahead of interface clarity. Work exposes browsing,
hiring, project administration, closeout, and record keeping in one very long
surface. Estimate, Invoice, Daily Log, and Safety show advanced decisions before
the common task is complete. The account drawer behaves like a second dashboard.
Desktop often stretches a mobile composition instead of becoming a purposeful
workspace.

This is the source of the "overbuilt" feeling. The right correction is not to
remove useful records or rebuild the backend. It is to:

1. expose one primary task at a time;
2. put advanced capability behind a clear `More` or secondary stage;
3. use one navigation level per decision;
4. make the next action obvious after every save, send, accept, or upload;
5. compose desktop as a workbench rather than a wide phone;
6. consolidate the visual and interaction primitives so the same action looks
   and behaves the same everywhere.

No new release-blocking authorization or data-integrity defect was discovered
in this visual audit. The highest-priority findings are product-comprehension,
mobile ergonomics, accessibility consistency, and maintainability risks that
will make future screens harder to polish unless addressed now.

## Audit method

The audit combined:

- inventory of all routes and primary/secondary navigation paths;
- source inspection of customer, staff, shell, settings, and tool components;
- full-page rendered inspection using the current guest preview, mobile
  actions, Work lifecycle, Shop Talk/News, and Tools screenshot suites;
- compact phone, normal phone, tablet-width, and desktop composition checks;
- below-the-fold inspection of forms, sticky controls, drawers, empty states,
  and post-action states;
- consistency checks for hierarchy, naming, cards, buttons, typography,
  spacing, color, focus handling, destructive actions, and status feedback;
- a workflow test applied to every primary action: **clear feedback, exact
  destination, visible next step**.

One fresh guest-preview run captured the current screens but its temporary Vite
server stopped before the final recovery assertion. That is test-harness
instability, not evidence of a product defect. The audit therefore uses the
captured screens plus the previously passing current-commit suites and source
inspection; it does not claim a new end-to-end release verification.

## Product principles to enforce

Every revised screen should follow these rules:

1. **One first task.** The first viewport should answer what the user can do
   now, not explain every capability.
2. **One primary action.** Orange is reserved for the most likely next action.
3. **One navigation level per decision.** Tabs within tabs within a card are a
   signal to split states or hide secondary controls.
4. **Progressive complexity.** Advanced assumptions, templates, reports, and
   administration appear after the basic task is valid.
5. **Exact context.** A job, project, album, post, conversation, estimate, or
   invoice opens directly and remains visibly named.
6. **One-handed mobile use.** Frequent actions live in the lower thumb zone;
   upper controls are navigation or infrequent settings.
7. **Desktop is a workspace.** Use list/detail, main/rail, or editor/preview
   compositions instead of a centered mobile column.
8. **Truth before theater.** Do not imply verification, delivery, persistence,
   activity, or completeness that the server cannot prove.
9. **No duplicate action.** A persistent nav item, FAB, card button, and empty
   state should not all invoke the same command.
10. **Completion is visible.** Save, send, publish, accept, upload, and delete
    must acknowledge success or failure and show the logical next action.

## Global findings

### P1. Work exposes too many products in one screen

Work currently contains a Work/People switch, status filters, metrics, search,
filters, browse cards, a selected job, workspace actions, detail tabs, applicant
management, address/privacy information, templates, editing, pause/close
controls, change orders, milestones, contacts, notes, checklists, payments, and
related jobs.

This is feature complete but not cognitively coherent. A contractor or
tradesperson should not need to understand the entire job lifecycle to complete
the current step.

**Direction:** rebuild Work around four explicit states:

- **Browse:** find work and people;
- **Hiring:** drafts, applicants, offers, and decisions;
- **Active:** one job workspace with Messages, Photos, Log, Estimate, Invoice,
  and schedule;
- **Archive:** completed, cancelled, declined, and closed records.

Secondary project administration belongs in a single `More` surface inside the
selected job. Preserve all records and routes; reduce simultaneous exposure.

**Primary source:** `src/features/work/WorkWorkspace.tsx` and
`src/features/work/work-workspace.css`.

### P1. Long-form field tools show advanced work before common work

Estimate, Invoice, Daily Log, and Safety are useful, but their mobile screens
stack nearly every field, explanation, calculation, preview, and secondary
action into one document. Sticky controls make actions reachable but do not
solve decision overload.

**Direction:**

- Estimate: `Price -> Customer -> Review and send`;
- Invoice: `Draft -> Send -> Track`, with templates in a menu;
- Daily Log: quick entry first, `More details` for weather/materials/safety;
- Safety: grouped, collapsible sections with progress and exceptions first.

The record model and server persistence should remain unchanged.

**Primary sources:** `src/features/tools/EstimateTool.tsx`,
`src/features/tools/InvoiceDraftTool.tsx`,
`src/features/tools/DailyLogTool.tsx`, and
`src/features/tools/ToolsStudio.tsx`.

### P1. The account drawer is a second dashboard

The account panel contains identity, standing, records, safety certificates,
training progress, community badges, device security, appearance, staff links,
Settings, and sign out. This is too much for a quick panel and makes Profile and
Settings ownership unclear.

**Direction:** account drawer contains only:

- identity and `View profile`;
- `Settings`;
- `Admin` for staff;
- `Sign out`.

Move metrics to Profile, device/security/theme to Settings, and keep
notifications in the notification panel.

**Primary source:** `src/app-shell/AppPanels.tsx`.

### P1. Desktop is still often a widened mobile product

The shell has a desktop sidebar and several desktop-aware layouts, but Home,
Tools, and parts of Shop Talk still leave large unused areas or stretch a
single task column. The result feels like a mobile application placed inside a
desktop frame.

**Direction:**

- Home: active work and attention in the main column; communities, activity,
  and recent tools in a persistent rail;
- Tools: recent/core launcher rail plus selected app workspace;
- Shop Talk: community discovery on the left, feed center, selected thread on
  the right only when opened;
- Work: queue/list left and selected lifecycle state right.

### P1. The CSS system has accumulated measurable interface debt

Current source metrics:

- 21 CSS files and 39,964 lines;
- 859 raw hex-color matches;
- 1,484 hardcoded pixel font sizes;
- 160 media rules across 13 distinct width values;
- 84 type declarations at 12px or smaller;
- 65 fixed or sticky declarations;
- 64 z-index declarations using 32 distinct values, from 1 through 10001;
- `styles.css` is 12,733 lines and `tools-studio.css` is 10,326 lines.

These numbers explain the recurring specificity, clipping, overlay, and
dark-mode drift. They are not a mandate for a risky rewrite.

**Direction:** make deletion-only and mechanical cleanup packets before adding
more visual layers:

1. remove verified orphan selector families;
2. replace raw semantic status colors with tokens;
3. enforce a small z-index scale;
4. reduce breakpoints to named phone/tablet/desktop/wide boundaries;
5. enforce a 13px minimum for production interface copy;
6. move feature-owned CSS out of the legacy global file when that feature is
   next touched.

### P1. Dialog and destructive-action behavior is inconsistent

RIVT has a reusable focus-trap hook, but not every `role="dialog"` surface uses
it. Shop Talk reporting and the tool-context picker are examples of hand-built
dialog behavior outside the shared pattern. Native `window.confirm` remains in
Crew/client deletion, crew removal, Shop Talk post deletion, and checklist
reset.

**Direction:** build shared `Dialog`, `Drawer`, and confirmation primitives
using existing dependencies. They must own focus, Escape, outside click,
scroll lock, labels, close controls, and reduced-motion behavior. Do not add a
new dependency without a separate decision.

### P1. Tiny labels and all-caps metadata make dense screens harder to scan

Small uppercase eyebrows work in moderation, but they are repeated in nearly
every card, tool, status block, and form. At compact widths, 9-12px metadata
becomes an accessibility and field-readability problem.

**Direction:** use uppercase only for status/category labels, not narration.
Set 13px as the minimum interface size, with body copy at 15px or greater.

### P2. Fixed controls solve reach but create overlay competition

Bottom navigation, field tray, tool section dock, action dock, FABs, and modal
footers may all exist in the same route. The large number of independent
z-index values makes regressions likely.

**Direction:** each screen may have the global bottom nav plus at most one
local bottom dock. Local docks must reserve content padding and disappear or
become in-flow on desktop.

### P2. Card nesting creates visual noise

Several screens place cards inside panels inside cards, each with a border,
radius, heading, and explanatory paragraph. The effect is less premium because
the hierarchy relies on boxes rather than spacing and type.

**Direction:** sections are unframed; cards are reserved for repeated records,
selected work items, and modals. Remove at least one container layer whenever a
panel contains only one child card.

### P2. Some empty states reference commands that are not visible

Home can say `Use Ask to start one` while Ask lives inside Shop Talk. Empty
states should either provide the action or use destination-oriented copy such
as `Open Shop Talk`.

**Direction:** audit every empty state for a reachable button and exact label.

## Navigation, shell, menus, and panels

| Surface | Verdict | What works | What changes |
|---|---|---|---|
| Desktop sidebar | Keep | Stable primary destinations and identity | Remove secondary dashboard-like content; show active work only when truly active |
| Mobile bottom nav | Keep | Five clear daily destinations | Do not add more items; selected label and icon remain stable; one local dock maximum |
| Top bar | Keep | Search, messages, notifications, account are predictable | Give badges consistent placement and 44px targets; no translucent content ghosting |
| Global search | Refine | Cross-product search and commands are valuable | Group People, Work, Shop Talk, and Commands; show why a result matches; exact destination only |
| Notification panel | Refine | Exact deep links are largely established | Make every actionable row one tap target; non-action rows must not look clickable; consistent unread state |
| Account drawer | Redesign | Quick access is useful | Identity, Profile, Settings, Admin, Sign out only |
| Theme control | Move | System/Light/Dark is the right final scope | Settings only; remove obsolete theme-studio styling after verifying zero references |
| Search/modal scrims | Consolidate | Current screens generally close properly | One shared dialog/drawer implementation and z-index scale |

## Authentication, landing, preview, and onboarding

### Landing and preview entry

**Verdict:** preserve the bold orange/black identity, reduce the amount of
proof copy and the size of the first headline on short phones.

The entry experience successfully communicates that RIVT is for the trades,
but the first viewport can become brand headline plus cards plus multiple
entry actions. The preview should sell the completed product without feeling
like fabricated production evidence.

**Change:** one literal offer, one support sentence, one strong product scene,
and two commands: `Create account` and `Preview RIVT`. `Log in` remains a clear
secondary command, not a small footer link.

### Login and signup

**Verdict:** keep the dark authentication surface and provider choices; tighten
spacing and ensure the primary email path is visible without excessive scroll
on a compact phone.

Provider buttons, login/signup switching, password recovery, invite code, and
validation errors should share one field and error system. Error messages must
name the field or action rather than collapse to a generic account failure.

### Product demo

**Verdict:** useful and honest when prominently labeled `Sample workspace`.

Avoid phrasing such as `after a year of real use`, which can be read as evidence
about an actual account. Use `A complete sample workspace` and show the role
switch near the top. Keep a persistent exit and create-account action.

### Onboarding

**Verdict:** reduce from a marketing sequence plus form sequence to four
decisions:

1. role and immediate goal;
2. trade, service area, and basic profile;
3. communities and alert preference;
4. first action and completion.

Required consent belongs at the relevant submission boundary, not as another
promotional screen. Completion must remain server-persisted and never reappear
for an already-completed account.

**Primary source:** `src/features/auth/AuthScreens.tsx`.

## Home

**Verdict:** keep the daily-work concept; reduce hero dominance and make the
layout useful when activity is sparse.

### Keep

- greeting and factual availability;
- active work or the most important attention item;
- joined communities and real activity;
- recent tools when they are genuinely recent.

### Change

- prevent the availability pill from clipping beside a long name;
- use a smaller greeting on phones and desktop workspaces;
- do not show multiple routes to Ask/Post Work/People when nav already owns
  those destinations;
- replace large empty Trending areas with a compact honest state and a direct
  `Open Shop Talk` action;
- on desktop, use a main/rail composition rather than a wide single feed;
- reserve bottom space whenever a local action dock or FAB is present.

**Primary source:** `src/features/home/TradeFeed.tsx` and
`src/features/home/trade-feed.css`.

## Work and People

**Verdict:** redesign the information architecture, not the feature set.

### Browse

Show search, essential filters, and job cards. Match scores must be derived and
explainable; avoid decorative percentages. A card has one primary action.

### Hiring

Show contractor drafts and applicant queues. One job opens its applicants and
offer state. Templates, editing, and pause/archive controls belong in `More`.

### Active workspace

Show the selected job name and state at all times. Primary actions are:
Messages, Photos, Daily Log, Estimate, and Invoice. Schedule changes and cancel
work are secondary. The workspace should replace browse content instead of
appearing far below it.

### People

Keep People inside Work, but treat it as a roster/workbench:

- searchable people list;
- selected profile/detail;
- saved connections and invitations;
- client records clearly separated from work-message threads.

Do not revive `My bench` terminology or a sixth primary destination.

**Primary sources:** `src/features/work/WorkWorkspace.tsx` and
`src/features/network/NetworkHub.tsx`.

## Shop Talk and Trade News

**Verdict:** preserve the Reddit-like server-owned model, simplify the visible
controls.

### Feed

- one search field;
- one compact filter/sort row, not two parallel chip systems;
- post cards with community, author, time, title/body/media, vote/comment/save;
- one context-aware Ask action in the lower thumb zone;
- selected thread opens as a full mobile route or desktop detail panel.

### Thread

The current detail is dense with status, identity, reputation, tags, guidance,
reporting, composer, character count, and answer controls. Keep identity and
trust signals, but collapse guidance and secondary metadata. Put Report in a
menu. Keep answer submission close to the input and support keyboard submit.

### Communities

Creation, search-first deduplication, public/contractor/tradesperson audiences,
joining, and server enforcement are strong. Community cards should be compact
rows or informative tiles, not tall mostly-empty cards. Use one neutral avatar
system with a restrained category accent.

### Trade News

Keep it a peer section, not a visually unrelated toggle. Use compact article
rows with real images when available, source, age, title, and a short summary.
Refresh state must say when the feed was checked and distinguish live from
curated fallback.

**Primary sources:** `src/features/shop-talk/ShopTalkView.tsx` and
`src/features/shop-talk/shop-talk.css`.

## Camera

**Verdict:** preserve the capture interaction; enrich and simplify the landing.

Camera is the best one-handed pattern in the app because Destination, Feed,
and Capture live in a persistent lower dock and Capture is visually dominant.
Do not move frequent capture controls back to the top.

### Keep

- explicit accepted-job, standalone-project, or private-album context;
- default private album and user-created private albums;
- recent real photo previews;
- retry behavior for failed uploads;
- one-handed lower capture dock.

### Change

- recent photos first;
- albums/projects second, with truthful covers and counts;
- current destination shown quietly, not as a large explanatory card;
- empty landing should offer `Capture photo` and `Create album`, not blank
  space;
- after capture, show the stored destination and `View photo` / `Take another`.

**Primary source:** `src/features/tools/JobPhotosTool.tsx`.

## Tools hub

**Verdict:** the seven-destination floor is correct; clarify its presentation.

### Visible product

- Heavy 16th;
- Estimate;
- Invoice;
- Jobsite;
- Camera;
- Materials;
- Time & costs.

Do not remove another capability without user evidence. Do not expose legacy
aliases or contained experiments as launchers.

### Change

- one compact `Quick access` row from real recency/pins;
- all five core apps always visible;
- one `All tools` list for Materials and Time & costs;
- no duplicate Utilities panel plus field tray;
- on desktop, launcher rail and selected app workspace;
- all labels describe outcomes, not internal implementation.

**Primary source:** `src/features/tools/ToolsStudio.tsx` and
`src/features/tools/tools-studio.css`.

## Per-tool audit

| Tool or section | Verdict | Primary issue | Required direction |
|---|---|---|---|
| Heavy 16th | Keep as reference | Dense result/unit block on very small phones | Preserve one-screen keypad, fraction strip, H/L, half/double, metric, and lower reach |
| Estimate | Redesign | Long page and backwards information order | Three stages: Price, Customer, Review/send; sticky live total; advanced assumptions collapsed |
| Invoice Draft | Redesign | Templates lead; editing, preview, delivery, and tracking compete | Draft, Send, Track; templates in menu; one bottom Save/Send dock |
| Receivables | Keep within Invoice | Feels like a separate tool | Invoice list/status view using the same invoice records |
| Jobsite Log | Simplify | Too many fields and repeated preview/export controls | Quick log first; More details; one saved-entry preview |
| Jobsite Punch | Keep | Assignment and closeout can become form-heavy | Open items first; add item in lower dock; completed collapsed |
| Jobsite Safety | Redesign | 25-item continuous checklist overwhelms | Group/collapse, show exceptions and progress, clarify non-comprehensive boundary |
| Camera | Enhance landing | Sparse home when little data | Recent photos, albums/projects, quiet destination, dominant bottom Capture |
| Materials Takeoff | Keep | Stacked modes need clearer separation | Takeoff and Sheets segmented control; common result dock |
| Price library | Polish | Browser-default search/control styling | Shared fields, compact rows, supplier/current-date context |
| Time | Keep | Clear but visually card-heavy | Timer first; history below; work context visible |
| Expenses | Keep | Form and receipt actions compete | Receipt or amount first; details next; recent entries below |
| Mileage | Keep | Context and rate explanation can crowd form | Start/end or manual entry first; dated rate detail collapsed |
| Summary | Keep inside Time & costs | Reporting can look like a fourth independent app | One report surface derived from Time/Expenses/Mileage records |

## Inbox and client communication

**Verdict:** messages are a core top-bar utility; the Client sub-product needs a
clearer boundary.

Accepted-work conversations are server-owned participant messaging. Client
threads and client records currently feel closer to a lightweight CRM and can
include device state. Mixing them under the same `Messages / Clients` switch
makes persistence and audience hard to understand.

**Direction:**

- Inbox opens newest unread conversation, not merely newest;
- accepted-work messages remain primary;
- client records live under Work > People unless a server-owned client-message
  model is intentionally built;
- local UI preferences such as pin/archive may remain device-specific only when
  clearly non-business-critical;
- unread badges and exact conversation deep links remain consistent.

**Primary source:** `src/features/inbox/InboxCenter.tsx`.

## Profile, Settings, trust, and billing

### Profile

**Verdict:** make it a professional trust surface, not an account-stat panel.

Lead with real name, trade, location/service area, availability, portfolio,
evidence states, reviews, and completed work. Only display verification labels
that map to a documented process. Editing is secondary.

### Settings

Current sections are Account, Alerts, Profile, Theme, Plan, Business, and
Security. The separation is reasonable but the content remains card-heavy.

**Direction:**

- `Account`: identity, role-change request, email;
- `Notifications`: device alerts, email, job/community preferences;
- `Profile`: public professional information;
- `Appearance`: System, Light, Dark only;
- `Plan and storage`: billing, cancel/resume, human storage usage and limits;
- `Business`: rate, certifications, service area;
- `Security and data`: sessions, sign out other devices, export/delete.

Replace infrastructure language such as `S3-compatible object storage` with
user language such as `Cloud storage used` and a factual amount/limit.

### Billing

Keep the honest cancellation/resume workflow. Plan benefits must match real
entitlements. A successful checkout must reconcile and visibly confirm the
active plan. Do not repeat billing controls in the account drawer.

**Primary source:** `src/features/profile/ProfileHub.tsx`.

## Admin and moderation

**Verdict:** preserve the functional density; adapt mobile to a sequential
queue-and-review workflow.

The moderation console appropriately shows queue filters, report detail,
actions, notes, and support cases. On mobile, selecting a report should replace
the queue with a clear Back action rather than squeezing master and detail into
one long page. Action outcomes need a persistent audit confirmation.

**Primary source:** `src/features/admin/ModerationConsole.tsx`.

## Visual-system consistency

### Typography

- use five production sizes: 13, 15, 17, 21, and 26/34 display;
- no interactive or explanatory text below 13px;
- reserve display type for page-level identity, not cards and side panels;
- reduce all-caps labels to status, category, and compact eyebrow use;
- keep letter spacing at zero for ordinary labels and body text.

### Color

- use one RIVT accent token and its hover/pressed states;
- use semantic success/warning/danger/info tokens everywhere;
- do not use raw manufacturer-inspired palettes or alternate brand skins;
- maintain only System, Light, and Dark modes;
- test every status chip and soft background in both modes.

### Spacing and containers

- use a 4/8/12/16/24/32 spacing scale;
- unframe page sections;
- card radius stays within the established compact scale;
- use borders for separation only when spacing/dividers are insufficient;
- eliminate cards nested directly inside decorative cards.

### Buttons

- primary orange: one per task region;
- secondary: bordered or surface button;
- icon button: familiar icon with accessible name and tooltip where needed;
- destructive: explicit red text/border, confirmation through shared dialog;
- minimum touch target 44px; frequent field actions should be 48-56px.

### Responsive layout

Adopt named boundaries rather than feature-specific guesses:

- Compact phone: up to 375px;
- Phone: 376-640px;
- Tablet/split: 641-900px;
- Desktop: 901-1180px;
- Wide: over 1180px.

Existing special cases can remain until their owner is redesigned, but no new
unnamed breakpoint should be added.

### Layering

Use one documented z-index scale:

- content: 0;
- sticky content: 10;
- top/bottom shell: 20;
- drawers/scrims: 40;
- dialogs: 60;
- toasts: 80;
- emergency/recovery overlay: 100.

## What to preserve

- five primary destinations: Home, Work, Camera, Shop Talk, Tools;
- top-bar Search, Messages, Notifications, and Account;
- server-owned work, community, notification, billing, and tool records;
- exact work context and deep links;
- Work > People rather than a sixth Crew destination;
- public, contractor-only, and tradesperson-only community audiences;
- Camera's lower capture dock and explicit destination;
- Heavy 16th's one-screen calculator interaction;
- the seven-destination Tools floor and compatibility aliases;
- honest sample-workspace labeling;
- clear, easy subscription cancellation.

## What to subtract

- metrics, training, appearance, and device details from the account drawer;
- duplicate filter rows in Shop Talk;
- duplicate utilities/tray representations on Tools;
- repeated page descriptions after the first visit where the action is clear;
- nested card layers around single sections;
- templates as the first Invoice decision;
- advanced pricing assumptions before basic Estimate entry;
- technical provider language in Settings;
- native confirm dialogs and one-off modal behavior;
- verified orphan CSS families and raw semantic colors;
- tiny metadata and decorative uppercase labels;
- multiple local bottom docks on one route.

## Recommended implementation trains

### Train 1: Foundation and subtraction

1. Verify and delete orphan theme/appearance/field-kit CSS families.
2. Define semantic type, z-index, breakpoint, and status-color rules.
3. Replace tiny text and raw status colors in the highest-traffic surfaces.
4. Add shared Dialog, Drawer, Confirm, and segmented Tabs primitives.
5. Add screenshot assertions for fixed-layer overlap and horizontal overflow.

**Acceptance:** no runtime workflow changes; build/lint/tests pass; visual
snapshots cover light/dark compact phone and desktop; no confirmed selector is
removed while referenced.

### Train 2: Shell, account, and settings

1. Slim account drawer.
2. Normalize top-bar badges and panel rows.
3. Group search results by object type.
4. Simplify Settings sections and user-facing storage language.
5. Consolidate modal focus/close behavior.

**Acceptance:** every panel is keyboard-contained, closes predictably, and has
no duplicate route ownership.

### Train 3: Work lifecycle

1. Separate Browse, Hiring, Active, and Archive states.
2. Make `Open workspace` replace or scroll directly to the workspace.
3. Place the active job name/state in a persistent context bar.
4. Keep five common workspace actions; move administration to More.
5. Recompose desktop as list/detail.

**Acceptance:** contractor and tradesperson can explain their current state,
reach the exact job, complete the next action, and return without hunting.

### Train 4: Field tools task flows

1. Estimate three-stage flow.
2. Invoice Draft/Send/Track flow.
3. Daily Log quick mode and Safety grouping.
4. One local bottom dock per app.
5. Desktop editor/preview layouts.

**Acceptance:** common task completes without opening advanced controls; no
record format or persistence regression; all frequent actions are thumb-safe.

### Train 5: Shop Talk refinement

1. One feed filter system.
2. Compact directory rows/cards.
3. Simplified thread and answer composer.
4. Sequential mobile thread route and useful desktop detail panel.
5. Trade News rows with freshness and source clarity.

**Acceptance:** Ask, create community, join, open exact post, answer, vote,
save, report, and open article all have one obvious path.

### Train 6: Desktop composition

1. Home main/rail workspace.
2. Tools launcher/workspace split.
3. Shop Talk discovery/feed/thread composition.
4. Work queue/detail composition.
5. People roster/detail composition.

**Acceptance:** 1440px views use space intentionally, have no floating mobile
column, and preserve the same routes and records as mobile.

### Train 7: Launch-wide accessibility and physical-device QA

1. Keyboard/focus/Screen Reader labels.
2. 200% zoom and dynamic text checks.
3. reduced motion and contrast checks in light/dark;
4. one-hand checks on compact and large phones;
5. physical iOS/Android Camera, push, upload, and active-work lifecycle.

## Screen-level acceptance checklist

Every screen must pass all of these before redesign work is called complete:

- the screen's purpose is obvious in five seconds;
- there is no more than one primary orange action in the active task region;
- the most common action is reachable with one hand on mobile;
- no content is hidden under fixed chrome;
- no horizontal document overflow at 320, 375, 390, 430, 768, 1024, or 1440;
- body and interactive text is at least 13px;
- every control has an accessible name and 44px target;
- every modal traps focus and has a visible close action;
- save/send/upload/publish/accept/delete provides feedback;
- navigation opens the exact object promised by the label;
- the post-action state shows a visible next step;
- empty, loading, offline, permission-denied, and error states are distinct;
- server-owned and device-only state are described truthfully;
- dark and light themes preserve status meaning and contrast;
- desktop uses an intentional workspace composition.

## Launch call and boundary

This audit does not reverse Packet 48's launch QA result and does not identify a
new hard authorization, billing, or persistence blocker. It does identify a
clear next product phase: interface subtraction and state-based workflows.

The safest sequence is Foundation -> Shell/Settings -> Work -> Field Tools ->
Shop Talk -> Desktop -> Accessibility QA. Work and Field Tools should not be
redesigned simultaneously in one large branch; their stored records and
cross-links make incremental trains safer.

Physical-device testing remains necessary for real camera capture, keyboard
behavior, installed iOS push, Android push icons, large-text accessibility, and
one-handed reach. Browser screenshots cannot prove those conditions.
