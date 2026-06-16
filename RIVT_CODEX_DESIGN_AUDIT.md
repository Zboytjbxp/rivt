# RIVT — Codex Design Audit Results
**Date:** June 16, 2026  
**Auditor:** Codex (Claude Sonnet 4.6)  
**Codebase:** React + Vite frontend, Express + PostgreSQL backend  
**Branch:** `claude/new-session-2wxmgd`

---

## PHASE 1 — Codebase Inventory

| Metric | Value |
|--------|-------|
| Component files | **1** (monolithic App.tsx) |
| Pages / views | **16** (all inline inside App.tsx) |
| Lines of code — frontend | **7,451** (App.tsx) + **7,138** (styles.css) + 314 (brandConfig.ts) = **~15,000** |
| Lines of code — backend | **~1,040** (server/index.js) |
| Component count (named functions) | **~35** inline functions in App.tsx |
| Design token coverage | **~30%** — tokens exist but 300+ hardcoded values bypass them |
| Duplications found | **Critical: 8 major patterns** detailed below |
| State variables at root | **40+** useState hooks, no external store |
| Prop drilling depth | **3–4 levels**, up to **50+ props** through OperationsWorkspaceProps |
| Responsive breakpoints | **5** (non-standard, inconsistently applied) |
| Dark mode coverage | **~40%** — many elements lack dark mode overrides |
| Accessible touch targets (≥44px) | **~60%** — numerous buttons below minimum |

### Component Tree

All components live inside a single `src/App.tsx` (7,451 lines). There are no separate component files, no `src/components/` directory. This is the single most critical architectural issue in the codebase.

**Named view functions (all in App.tsx):**
- `MarketplaceView` (~300 lines) — job listing and search
- `OperationsWorkspace` (~600 lines) — outer shell routing to sub-views
- `HomeView` (~200 lines) — dashboard home
- `ShopTalkView` (~200 lines) — community Q&A
- `ToolsView` (~60 lines) — tools menu
- `CalculatorView` (~220 lines) — job cost calculator
- `InvoiceTool` (~280 lines) — invoice generator
- `FractionTool` (~40 lines) — fraction converter
- `MaterialsWasteTool` (~30 lines) — materials calculator
- `PaymentNoteTool` (~40 lines) — payment note
- `MyJobsView` (~120 lines)
- `ApplicationsView` (~80 lines)
- `InvitesView` (~70 lines)
- `CrewView` (~80 lines)
- `MessagesView` (~50 lines)
- `TrustLegalView` (~50 lines)
- `RecordsView` (~550 lines)
- `SafetyTrainingView` (~50 lines)
- `ReviewsView` (~70 lines)
- `FeedbackView` (~70 lines)
- `SettingsView` (~70 lines)
- `AdminView` (~165 lines)
- `AuthGate` (~130 lines)
- `OnboardingFlow` (~440 lines)
- `MobileNavStrip` (~40 lines)

**Named reusable component functions:**
- `ModernJobCard` (line 3832) — used only in Marketplace
- `ModernMetric` (line 3811) — metric tile, used in Marketplace + HomeView
- `OpsMetric` (line 4378) — **IDENTICAL** to ModernMetric, used in OperationsWorkspace summary
- `ProjectVisual` (line 3866) — trade-based icon/visual for cards
- `EmptyState` (~line 1025) — correctly extracted, reused well
- `Avatar` — user avatar with initials, reused across nav and cards
- `ThemeToggle` — dark/light toggle button
- `LaunchLoader` (line 2644) — loading screen
- `CredentialTile` — used in Settings and TrustLegal

### Routes (Client-Side State Machine)

Navigation uses `const [activeView, setActiveView] = useState<NavLabel>("Home")`. No URL-based routing exists. Back button does not work. Deep-linking is impossible.

**Primary bottom nav (5 items on mobile):** Home, Marketplace (→ "Work"), Shop Talk (→ "Talk"), Tools, My Crew (→ "Crew")

**Contractor-visible sidebar:** Home, Marketplace, Shop Talk, Tools, My Jobs, Applications, Invites, My Crew, Trust & Legal, Records, Reviews, Feedback, Settings

**Tradesperson-visible sidebar:** Home, Marketplace, Shop Talk, Tools, My Jobs, Applications, Trust & Legal, Records, Safety & Training, Reviews, Feedback, Settings

**Admin view:** Present in `navItems[]` array (line 379) but absent from `roleNavItems` for both roles (lines 382–412). Not reachable via normal navigation. Renders client-side with no auth guard when `view === "Admin"` (line 4347).

### Design System Audit

**What exists and works:**
- CSS custom properties defined in `:root` via `brandConfig.ts` injection
- 7 color palettes switchable at runtime (RIVT Orange default, Jobsite Yellow, Redline, System Green, Orange Ridge, Chrome Rail, Steel Blue)
- Light/dark mode via `localStorage` + `matchMedia` fallback
- Radius token: `--radius: 10px`
- Shadow tokens: `--shadow`, `--shadow-soft`
- Typography token partial: `--text-xs` through `--text-2xl`, `--weight-body/semibold/label`

**What's broken:**
- `--green` is ORANGE (`#ff6a00`). The primary accent color is named wrong. This semantic error permeates 7,138 lines of CSS. `var(--green)` is used for success states, primary actions, active nav, progress bars, badges — all orange, all called "green."
- Design tokens bypassed constantly: 300+ hardcoded hex values (`#ff6a00`, `#080d10`, `#ffffff`, `rgba(255, 106, 0, ...)`) throughout styles.css
- Font weight values are non-standard: 720, 740, 750, 760, 780, 820 — these are not valid CSS font-weight values on most systems and degrade silently to the nearest standard weight
- No spacing token system. Padding/gap values are ad-hoc: 8px, 9px, 10px, 11px, 12px, 13px, 14px, 15px all appear in adjacent elements
- 5 responsive breakpoints at non-standard, inconsistent sizes: 460px, 720px, 960px, 1040px, 1300px — 960 and 1040 overlap, none use named breakpoint tokens
- Dark mode is ~40% complete: `color-scheme: dark` is set but many component-level styles have no dark overrides

---

## PHASE 2 — Pixel-Level Findings

### What Claude Found (Validation)

**❌ Stat block on 11 screens besides Home?**  
**Status: PARTIALLY — appears on 3 screens, not 11, but still wrong**  
- `OpsMetric` block (4 tiles: Open work, Applications, Records, Safety) appears inside `OperationsWorkspace` at line 4159, wrapped in `className="ops-summary home-ops-summary"`
- `ModernMetric` appears in `MarketplaceView` (lines 3664–3687, same 4-tile layout: Best match, Trust, Open work, Records)  
- `ModernMetric` appears AGAIN in `HomeView` at lines 4932–4935 (Open work, Shop Talk, Shout-outs, Moderation)  
- **Three separate metric blocks on three screens, using two different components with identical interfaces**  
- Evidence: `App.tsx:3664`, `App.tsx:4159`, `App.tsx:4932`  
- Fix: Consolidate to one `MetricTile` component, use only on Home dashboard

**❌ Echo action lines still under every title?**  
**Status: YES — CONFIRMED**  
- Every non-Home page uses this pattern at `App.tsx:2490–2496`:
  ```jsx
  <span>{page.title}</span>   {/* "Work Feed" */}
  <h1>{page.title}</h1>       {/* "Work Feed" again */}
  <p>{page.description}</p>
  ```
- The `<span>` and `<h1>` render **the exact same text** back-to-back. One is styled as an uppercase eyebrow label, one as the main heading. They say the same thing.
- This affects every page except Home: Marketplace, Shop Talk, Tools, My Jobs, Applications, Invites, My Crew, Messages, Trust & Legal, Records, Safety & Training, Reviews, Feedback, Settings — **14 pages**  
- Fix: Remove the `<span>{page.title}</span>` line. Keep only `<h1>{page.title}</h1>` + `<p>{page.description}</p>`  
- Effort: 30 minutes. One line deleted.

**❌ ~70% of card borders should be removed?**  
**Status: STILL PRESENT — 20+ card types all have `1px solid var(--border)`**  
- Every card class in styles.css carries a full border: `.ops-card`, `.data-row`, `.crew-card`, `.modern-job-card`, `.dashboard-card`, `.shop-post-card`, `.answer-card`, `.record-upload-card`, `.activity-item`, `.admin-card`, `.invoice-editor`, `.credential-tile`  
- Borders compete with surface backgrounds to create layering. On dark mode the result is box-in-box stacking with every card outlined  
- Some elements that don't need borders: `.activity-item` (in a list, not a standalone card), `.data-row` (table row, not a card), `.admin-card` (inside an admin panel, already inside a border)  
- Fix: Remove borders from list-item rows (data-row, activity-item). Keep borders only for standalone floating cards  
- Effort: 2 hours

**❌ Is green still overused for everything?**  
**Status: YES — CRITICAL NAMING AND USAGE ISSUE**  
- `var(--green)` = `#ff6a00` (orange). Used 200+ times across styles.css for: nav active state, form toggles, alert badges, progress bars, primary buttons, icon accents, status chips, link colors, match pills  
- The color itself (orange) is on-brand and appropriate. The variable name `--green` is wrong  
- Secondary palette colors (`--blue`, `--amber`) are barely used — UI is near-monochromatic in the accent color  
- Fix: Rename `--green` to `--accent` everywhere (styles.css, brandConfig.ts). Add semantic use of `--blue` for informational states and `--amber` for warnings  
- Effort: 3 hours (global find/replace + semantic audit)

**❌ JobCards inconsistent across Work, Applications, Invites?**  
**Status: YES — 4 DIFFERENT IMPLEMENTATIONS**  
- Marketplace: `ModernJobCard` component (lines 3832–3864) — button element, summary paragraph, match pill, meta row with 4 data points  
- Applications: `data-row` article (line 5851) — no card component, inline JSX, compressed info in `<small>` tag, two action buttons  
- Invites: `ops-card` article (line 5917) — contractor-centric layout, match %, invite/review buttons  
- Crew: `crew-card` article (line 5987) — profile-first, avatar, trade/location, badge row, score, actions  
- None of these share code. Same job data, four different layouts, four different class names, four different implementations  
- Fix: Build one `JobCard` component with a `variant` prop (compact, applications, invites, crew)  
- Effort: 4 hours

**❌ Duplicate renderings on Applications/Invites/Crew?**  
**Status: YES**  
- Applications (line 5851) and Invites (line 5917) both show job title, trade, match %, and pay — but in completely different HTML structures  
- Both screens show action buttons (Submit/View vs Invite/Review) with identical icon sizes but different class names  
- Neither uses the `ModernJobCard` component that already exists  
- Fix: Use `ModernJobCard` as the base, add a props-based action bar below it  
- Effort: 3 hours

**❌ Role toggle still in the top bar?**  
**Status: NO — ROLE IS PROPERLY LOCKED POST-SIGNUP**  
- Role is selected at signup (OnboardingFlow step 1), set via `setRole()`, and never changeable afterward  
- The `user-menu` button in the topbar (line 2456) shows role in its aria-label but provides no toggle — it opens the AccountPanel instead  
- The signup screen at line 2746–2756 includes: `<div className="role-locked-note">Chosen at signup and kept consistent across the app.</div>`  
- **This is correct behavior. This constraint is preserved.**

**❌ "Run live setup checks" panel still visible to users?**  
**Status: NOT FOUND IN APP.TSX**  
- No instance of "setup checks", "live setup", or diagnostic panel found in the rendered JSX  
- Server status does appear as a status string in the AccountPanel (e.g., "Server saved", "Storage setup needed") but this is a user-facing sync indicator, not a debug panel  
- Possible that Claude saw this in a different build or it was already removed  
- **Status: FIXED or never present in this build**

### NEW Items Codex Found (Not in Claude's Known 86)

---

**Item 87: Default profile is hardcoded to "Ryan Mitchell"**  
- Location: `App.tsx:1107`, `App.tsx:2670`, `App.tsx:6039`, `App.tsx:6074`  
- Impact: The default `displayName` is hardcoded to "Ryan Mitchell" in both `accountProfile` initialization (line 1107) and the AuthGate form (line 2670). In MessagesView (line 6039), sent messages are attributed to `"Ryan Mitchell"`. Line 6074 checks `message.author === "Ryan Mitchell"` to determine if a bubble is "mine." Every new user starts as Ryan Mitchell until they change it.  
- Importance: **HIGH** — this is seed/demo data inside production logic. Users will see their messages attributed to "Ryan Mitchell" if they don't update their profile during onboarding.  
- Fix: Default to empty string or derive from auth user. Replace hardcoded string in MessagesView with `accountProfile.displayName`.  
- Effort: 1 hour

**Item 88: Tagline in brandConfig doesn't match the locked tagline**  
- Location: `src/brandConfig.ts:6`  
- Evidence: `tagline: "Connect. Build. Grow."` — appears in the UI at lines 2783, 2934, 3411  
- The brief states the locked tagline is **"Where skilled trades connect"**. These don't match.  
- Importance: **HIGH** — tagline appears in onboarding, auth, and sidebar brand panel  
- Fix: Update `brandConfig.ts:6` to `tagline: "Where skilled trades connect"`  
- Effort: 5 minutes

**Item 89: Two identical metric components (ModernMetric vs OpsMetric)**  
- Location: `App.tsx:3811` (ModernMetric) and `App.tsx:4378` (OpsMetric)  
- Impact: Both accept `{ icon, label, value, detail }` and render `<article>` with an icon, span, strong, and small. The only difference is the CSS class (`modern-metric` vs `ops-metric`). They are functionally identical.  
- Importance: **MEDIUM** — confusing for future developers, inconsistent visual styling between Marketplace and Home  
- Fix: Keep one component (rename to `MetricTile`), use `className` prop or `variant` prop to handle both styles  
- Effort: 1 hour

**Item 90: No URL-based routing — back button breaks, deep links impossible**  
- Location: `App.tsx:2102` — `const [activeView, setActiveView] = useState<NavLabel>("Home")`  
- Impact: Navigation is entirely state-based. Pressing the browser back button exits the app entirely. Sharing a link to a specific page is impossible. This is a core UX failure for a web app.  
- Importance: **HIGH** — affects every user on every page navigation  
- Fix: Implement `react-router-dom` or `@tanstack/router`. Each NavLabel maps to a URL segment (`/marketplace`, `/shop-talk`, etc.)  
- Effort: 8–12 hours

**Item 91: Admin view exists in client bundle and is reachable without auth gate**  
- Location: `App.tsx:4347–4362`, `App.tsx:379`  
- Impact: `AdminView` renders whenever `view === "Admin"`. The `view` state can be set via `handleNavigate("Admin")`. While Admin is not in `roleNavItems` for either role (so it's not shown in the nav), the component renders client-side with full access to `jobs`, `applications`, `paymentRecords`, `feedbackItems`, `activityFeed`, `lockedAccounts`, `communityReports`. A user who knows the route can trigger it. Admin moderation actions (lock/unlock accounts, resolve community reports) are unprotected.  
- Importance: **HIGH** — client-side security risk for beta  
- Fix: Add a server-side role check. For now: remove `Admin` from `navItems[]` array; add `role === "admin"` guard before rendering AdminView  
- Effort: 2 hours

**Item 92: Messages thread list uses seedJobs directly (fake data in UI)**  
- Location: `App.tsx:6053`  
- Code: `{[selectedJob, ...seedJobs.filter((job) => job.id !== selectedJob.id).slice(0, 3)].map(...)}`  
- Impact: The thread list in Messages populates with `seedJobs` (imported from `data.ts`) to fake 3 additional conversations. These are fabricated jobs that don't exist for the user. The brief explicitly states "No fake/seed data anywhere."  
- Importance: **HIGH** — violates a core constraint  
- Fix: Replace with real message threads from server state, or render an empty thread list if no real threads exist  
- Effort: 2 hours

**Item 93: Messages "mine" detection uses hardcoded author name**  
- Location: `App.tsx:6074`  
- Code: `className={message.author === "Ryan Mitchell" ? "message-bubble mine" : "message-bubble"}`  
- Impact: The logic for styling sent vs received messages checks against the literal string "Ryan Mitchell". If a user changes their display name, their messages will appear as "received" instead of "sent." Every new user whose name isn't Ryan Mitchell will see their own messages rendered as received messages.  
- Importance: **HIGH** — logic bug, not just cosmetic  
- Fix: Compare `message.author === accountProfile.displayName` or use a `isOwn: boolean` field on the message object  
- Effort: 30 minutes

**Item 94: MonolithicApp.tsx must be split — 7,451 lines is unworkable**  
- Location: `App.tsx` (entire file)  
- Impact: Every component, every view, every helper function, every type import lives in one file. No tree-shaking possible. IDE performance degrades. Onboarding new developers is nearly impossible. Any change to any component risks touching unrelated components. Testing individual components requires importing the entire 7,451-line file.  
- Importance: **HIGH** — architectural debt that compounds every sprint  
- Fix: Extract views into `src/pages/`, UI components into `src/components/`, utilities into `src/lib/`. Start with the highest-value extractions: `OnboardingFlow`, `AuthGate`, `MarketplaceView`, `RecordsView`  
- Effort: 16–24 hours (phased over multiple sessions)

**Item 95: 40+ useState hooks at App root — no state management**  
- Location: `App.tsx:1099–1168` (state declarations), `App.tsx:4028–4084` (OperationsWorkspaceProps interface)  
- Impact: 50+ props are drilled through `OperationsWorkspaceProps` into child views. Any state change causes re-render of the entire app tree. State relationships are implicit. Race conditions between related state updates are likely (e.g., `jobs`, `selectedId`, `applications` must stay in sync).  
- Importance: **HIGH** — scalability wall  
- Fix: Introduce React Context for user/auth state. Consider Zustand for jobs/applications state. At minimum, group related state into objects (`jobsState`, `uiState`, `userState`).  
- Effort: 12–20 hours

**Item 96: CSS variable `--green` is actually orange — semantic disaster**  
- Location: `src/brandConfig.ts:61` (`"--green": "#ff6a00"`), `src/styles.css` (200+ uses of `var(--green)`)  
- Impact: The primary accent color (#ff6a00) is RIVT Orange, which is correct and on-brand. But it's stored in a variable named `--green`. Every developer reading the CSS sees `var(--green)` and must mentally translate to orange. New palette variables added in the future will inherit this confusion. When the "System Green" palette is selected, `--green` correctly becomes green — but all that time, it was orange. The naming is completely backwards from the default palette.  
- Importance: **HIGH** — ongoing confusion and maintenance burden  
- Fix: Rename `--green` → `--accent`, `--green-deep` → `--accent-deep`, `--green-soft` → `--accent-soft` throughout brandConfig.ts and styles.css  
- Effort: 3 hours (global find/replace)

**Item 97: Non-standard CSS font-weight values (720, 740, 750, 780, 820)**  
- Location: `src/styles.css` (50+ occurrences)  
- Impact: CSS font-weight only supports values in increments of 100 (100, 200, ... 900) or keyword values. Values like 720, 740, 750, 780, 820 are technically valid but silently round to the nearest 100. The CSS spec treats them as valid numbers but font rendering engines round. On systems without variable fonts, these degrade to 700 or 800 regardless of the value specified. This creates invisible inconsistency — the code looks precise but the output isn't.  
- Importance: **MEDIUM** — silent visual inconsistency  
- Fix: Replace all non-standard weights with the nearest standard: 720→700, 740→700, 750→700 or 800, 780→800, 820→800  
- Effort: 1 hour

**Item 98: No URL routing means analytics and support are blind**  
- Location: Architectural (App.tsx navigation model)  
- Impact: Beyond the UX issue (Item 90), the lack of URL routing means analytics tools can't track page views (every "navigation" looks like the user stayed on the same page). Support can't ask "what page were you on?" Error tracking can't identify which view crashed. Session replay tools see no navigation events.  
- Importance: **HIGH** — business/ops impact beyond just UX  
- Fix: Same as Item 90 — add react-router-dom  

**Item 99: Settings view has a broken theme button**  
- Location: `App.tsx:7219`  
- Code: `<button type="button" className="secondary-action" onClick={onReviewConsent}>Open trust setup</button>`  
- Impact: The Settings page has a button labeled "Open trust setup" that calls `onReviewConsent()`. This is not a theme settings button — it navigates to Trust & Legal. Settings description claims "Manage themes, account details, trust setup, and provider readiness" but there is no theme management UI in Settings. The theme toggle is only in the topbar and AccountPanel.  
- Importance: **MEDIUM** — misleading UX  
- Fix: Add a proper theme/palette selection section to SettingsView, or remove the promise from the page description  
- Effort: 2 hours

**Item 100: RecordsView is 550 lines and has 3 sub-sections that need tabs**  
- Location: `App.tsx:6158–6699` (~550 lines)  
- Impact: Records combines three distinct UIs: (1) closeout packet + checklist + timeline, (2) uploaded files management, (3) payment ledger + export. These are rendered stacked vertically with no navigation between them. On mobile, users must scroll through 3 complete sections to find what they need.  
- Importance: **MEDIUM** — discoverability problem  
- Fix: Add a 3-tab navigation within RecordsView: "Closeout" | "Files" | "Payments"  
- Effort: 3 hours

**Item 101: Hardcoded "Ryan Mitchell" contact name in MessagesView**  
- Location: `App.tsx:6035`  
- Impact: The contact shown in the message thread header is derived from `matchingTalent[0]` but falls back to a hardcoded talent object that includes names like "Ryan Mitchell" from seed data. The thread header reads "{contact.name} — {contact.responseTime}" where the name may be seed data.  
- Importance: **MEDIUM** — seed data leaks into production UI  
- Fix: Show only real contacts derived from actual applications/invites. Empty state if no contact exists.  
- Effort: 1 hour

**Item 102: No empty state for the core Marketplace (jobs list)**  
- Location: `App.tsx:3779`  
- Impact: When `filteredJobs.length === 0`, the UI renders an empty job list column with no message, no illustration, and no CTA. Users see a blank column with no explanation. The `EmptyState` component exists and is used elsewhere — it should be used here.  
- Importance: **HIGH** — this is the primary user-facing surface  
- Fix: Add `{filteredJobs.length === 0 && <EmptyState ... />}` with contextual copy ("No jobs match your filters" vs "No jobs posted yet")  
- Effort: 1 hour

**Item 103: data.ts exports empty arrays (`jobs: []`, `talent: []`)**  
- Location: `src/data.ts:3–5`  
- Impact: `jobs` and `talent` are exported as empty arrays. The app imports them as `seedJobs` and passes through `normalizeJobs()`. On first load with no server data, the app has zero jobs and zero talent. The UI falls back to whatever `normalizeJobs([])` returns. There's no indication to users that content is empty because the server hasn't been seeded.  
- Importance: **MEDIUM** — confusing empty-state experience for new instances  
- Fix: Document clearly in README that the server must be seeded with test data. Add an explicit empty-state banner when jobs count is 0.  
- Effort: 30 minutes

**Item 104: Feedback page copy says "Capture beta customer notes" — visible to users**  
- Location: `App.tsx:485`, `pageCopy.Feedback.description`  
- Code: `description: "Capture beta customer notes and turn them into product decisions."`  
- Impact: This is internal product language, not user-facing copy. Users in the beta don't need to know they're being used for "product decisions." It reads as an internal Jira ticket, not a product page.  
- Importance: **LOW** — polish issue  
- Fix: Change to "Tell us what's working, what's confusing, and what you need next."  
- Effort: 5 minutes

**Item 105: Missing Messages tab in bottom navigation**  
- Location: `App.tsx:3542` (MobileNavStrip primaryLabels)  
- Impact: Messages is not in the primary bottom nav (which shows: Home, Marketplace, Shop Talk, Tools, My Crew). To access Messages, users must open the sidebar or use the Messages icon in the topbar. In a trades networking app where job communication is core, Messages should be in the primary nav.  
- Importance: **MEDIUM** — discoverability issue  
- Fix: Replace "Tools" or "My Crew" in the bottom nav with "Messages". Or make the Messages icon in the topbar more prominent.  
- Effort: 30 minutes

**Item 106: No pull-to-refresh or loading skeleton**  
- Location: Entire app  
- Impact: The app hydrates from server on mount (line 1483–1538) but shows no skeleton UI during load. `LaunchLoader` shows "Preparing your workspace..." as a full-screen blocker but no skeleton layout. After initial load, there's no refresh mechanism (no pull-to-refresh on mobile, no refresh button). If data goes stale, users have no way to refresh without hard reload.  
- Importance: **MEDIUM**  
- Fix: Add skeleton cards in the Marketplace during initial hydration. Add a refresh button (or pull-to-refresh) to the Home page.  
- Effort: 4 hours

**Item 107: Icon buttons in TopBar are 42px × 42px — below 44px WCAG minimum**  
- Location: `styles.css` (icon-button definition) — `width: 42px; min-height: 42px`  
- Impact: WCAG 2.1 Success Criterion 2.5.5 requires touch targets of at least 44×44 CSS pixels. TopBar icon buttons (Messages, Notifications, Theme toggle) are 42×42. On mobile this affects tap accuracy.  
- Importance: **MEDIUM** — accessibility compliance  
- Fix: Change to `width: 44px; min-height: 44px`  
- Effort: 15 minutes

**Item 108: Action buttons in Applications, Invites, and Crew have no defined min-height**  
- Location: `App.tsx:5860–5867`, `App.tsx:6003–6010`  
- Impact: Buttons like "Submit", "View", "Invite", "Shout-out" in list cards have no defined height constraints. They rely on padding from their parent's styling. Icon size is 14px. These buttons likely render at 30–36px height — well below 44px minimum.  
- Importance: **MEDIUM** — accessibility  
- Fix: Add `min-height: 44px` to `.ops-actions button`, `.data-row button`, `.crew-actions button`  
- Effort: 30 minutes

---

## PHASE 3 — Feature Audits

### Home / Dashboard

**Pass 1 (Structure):**  
The Home view has two distinct layouts: mobile (single "today card" with job preview) and desktop (two-column dashboard with today card + up-next card). The stat block (`OpsMetric` × 4) appears as a horizontal summary at the top — appropriate for Home. The `page-intro home-intro` header shows personalized greeting + current job context. Layout is logical. The primary CTA is "Open work order" on the featured job card.

**Pass 2 (Interaction):**  
No pull-to-refresh. No loading skeleton during hydration. The dashboard-main-button ("Open work order") opens the job detail panel. Match percentage progress bar renders inline with a styled `<i><b>` element (not a semantic `<progress>` element). No error state if jobs fail to load.

**Pass 3 (Trust):**  
The Home-view metric row (ModernMetric) shows "Moderation: N reports waiting" — this is admin-level data appearing on a user's home screen. Regular users don't need to see moderation reports. Trust signals are weak: no "Your profile is X% complete" prompt, no "Last active" signal for matched tradespeople.

**Pass 4 (Retention):**  
No "since you last visited" summary. No job alert system. No notification count on Home. Community posts appear in the home feed (lines 4939–5099, "home-panel talk-panel") which is good for retention — but the content appears to be simulated/seeded community posts, not real activity.

**Pass 5 (Polish):**  
The greeting "Good morning, {firstName}" is correct. The `page-intro-chip` showing the current trade is a nice touch. Dashboard cards use `dashboard-main-button` which is a well-styled primary action. The "Moderation" metric in the tradesperson/contractor home view is wrong — it should be hidden from non-admin users.

---

### Work Tab (Marketplace)

**Pass 1 (Structure):**  
Two-pane layout: job list (left) + job detail (right). Clean. `ModernJobCard` is well-designed: trade category label, bold title, visual, match pill, summary, meta row. Filter bar is always visible (trade, difficulty, work type, radius, location).

**Pass 2 (Interaction):**  
Filters work via controlled state. Keyword search exists in the topbar. "Verified only" toggle exists. Saved search button exists. Filter state resets are not visible (no "Clear all filters" link when filters are active). When filteredJobs is empty, no empty state renders — just a blank column.

**Pass 3 (Trust):**  
Match percentage is shown prominently on each card (the `match-pill`). Insurance requirement shown in meta row. Status chip visible on detail panel. No "posted X days ago" freshness signal on cards. No indication of how many people have applied.

**Pass 4 (Retention):**  
Saved search button exists but no notifications when new jobs match a saved search. No "New since your last visit" badge. No job alert subscription.

**Pass 5 (Polish):**  
`ModernJobCard` is the cleanest component in the app. The meta row (pay, hours, difficulty, insurance) is well-structured. The `ProjectVisual` trade icon is a nice design touch. The `match-pill` positioning (absolute overlay on the visual) could clip on very small screens.

---

### Crew Tab (My Crew)

**Pass 1 (Structure):**  
List of talent sorted by match percentage. Each `crew-card` shows: Avatar, trade/location, name, portfolio tools, insurance status, verified badge, shout-out count, match score, rating. Two actions: Invite, Shout-out.

**Pass 2 (Interaction):**  
No search within crew. No filter by trade or specialty. With 10+ crew members, no way to narrow. "Invite" is tied to `matchingJob` — if no matching job, the invite action likely fails silently.

**Pass 3 (Trust):**  
Insurance status shown as "self-reported insured" or "insurance not marked" — honest framing. "Verified profile" badge shown when `person.verified`. Shout-out count is social proof. Rating displayed but sourced from seed data.

**Pass 4 (Retention):**  
Shout-out creation is a good engagement mechanic. No notification when a new tradesperson joins who matches your work. No "Recently active" signal.

**Pass 5 (Polish):**  
`crew-card` layout is clean but the `crew-score` section (match % + rating side by side) feels cramped. The rating number has no star icon or visual context — it reads as a bare number. Portfolio tools shown as a comma-separated list in a `<small>` tag — hard to scan.

---

### Shop Talk

**Pass 1 (Structure):**  
Two-pane: post list (left) + selected post detail (right). Posts show title, author, trade tag, vote count, reply count. Selected post shows full body, all answers, voting, and "Mark fix" moderation.

**Pass 2 (Interaction):**  
No search in Shop Talk. No filter by trade. Vote up/down on posts and answers works. "Mark fix" to verify an answer exists — but it's visible to all users, meaning any user can verify any answer. There should be a permission gate.

**Pass 3 (Trust):**  
Verified Fix answers get a `CheckCircle2` icon and "Verified Fix" label — good. But any user can mark any answer as verified. Badges/reputation system exists conceptually but isn't clearly displayed on post authors.

**Pass 4 (Retention):**  
No notifications when someone answers your question. No ability to follow a post. No "New activity" since last visit.

**Pass 5 (Polish):**  
`shop-post-card` and `answer-card` are clean. The `answer-card.verified` styling (green/orange accent border?) adds visual distinction. The "Mark fix" button being disabled after verification is correct. The action buttons (ThumbsUp, ThumbsDown, BadgeCheck) with 14px icons are below touch target minimums on mobile.

---

### Tools

**Pass 1 (Structure):**  
Grid of tool cards. Each tool opens inline: CalculatorView, InvoiceTool, FractionTool, MaterialsWasteTool, PaymentNoteTool. The ToolsView function itself is only ~60 lines; tools are separate functions.

**Pass 2 (Interaction):**  
CalculatorView uses `useState` internally — good isolation. InvoiceTool generates a downloadable invoice. FractionTool converts fractions. MaterialsWasteTool calculates waste. All tools appear functional and self-contained.

**Pass 3 (Trust):**  
InvoiceTool includes "not a legal financial document" type framing. Calculator shows labor vs. materials cost breakdown which is useful. No verification that tool outputs are accurate — no "estimated" label.

**Pass 4 (Retention):**  
No save history for calculations. No pre-fill from the active job. CalculatorView does pre-fill trade, difficulty, and hours from `selectedJob` — that's a good touch. But InvoiceTool doesn't pre-fill from the selected job.

**Pass 5 (Polish):**  
Tools feel like a beta feature grid. The `tool-card` styling is consistent. The CalculatorView is the most polished tool. FractionTool and MaterialsWasteTool feel thin — single input/output with minimal UI.

---

### Settings

**Pass 1 (Structure):**  
Settings shows: Email, Plan, Signup method, Trust status, Records progress, Training progress, Community badges — all as `CredentialTile` components. Then a single button: "Open trust setup." No account management beyond read-only credentials.

**Pass 2 (Interaction):**  
Clicking "Open trust setup" calls `onReviewConsent()`. No way to change email, password, display name, or location from Settings. No plan upgrade UI despite pricing being defined in brandConfig.

**Pass 3 (Trust):**  
Trust status chip and Records progress visible — good. But if status is "Setup needed," there's no inline resolution path from Settings — just the button that goes to Trust & Legal.

**Pass 4 (What's missing):**  
No logout button visible in Settings (it's in the AccountPanel modal). No notification preferences. No theme management despite description claiming "Manage themes." No plan upgrade CTA. No account deletion option.

**Pass 5 (Polish):**  
`CredentialTile` grid is clean. But the single-button CTA at the bottom is a weak ending. The page description says "Manage themes, account details, trust setup, and provider readiness" — only one of those four things is actionable from this page.

---

### Messages

**Pass 1 (Structure):**  
Two-pane: thread list (left) + thread panel (right). Thread list shows trade, job title, location. Thread panel shows contact name, response time, job title, message bubbles.

**Pass 2 (Interaction):**  
No search in thread list. No sort by unread. No unread badge on thread items. Message draft persists in `messageDraft` state. Send button exists.

**Pass 3 (Trust):**  
Contact's response time is shown in the thread header — good signal. Job title provides context. But the thread list uses `seedJobs` to fake 3 additional threads (Item 92) — fake data destroys trust.

**Pass 4 (Engagement):**  
The "Job assistant" message (`App.tsx:6046`) injects a guidance message from the job's guidance array. This is a nice contextual feature. But the thread list faking 3 conversations out of seed data undercuts the whole messaging experience.

**Pass 5 (Polish):**  
`message-bubble` styling with "mine" alignment is good pattern. The `message-composer` textarea is clean. But the "mine" detection bug (Item 93) means message alignment will be wrong for most users.

---

### Notifications

**Pass 1 (Existence):**  
Notification bell exists in TopBar (`unreadActivities` drives the `alert-button` class). `activityFeed` state stores notification items. `ActivityPanel` is a slide-out panel (not a full page).

**Pass 2 (Batching):**  
Notifications are a flat list in `activityFeed`. No grouping by type or time. No batching of repeated actions ("3 new applications to Electrical job").

**Pass 3 (Preferences):**  
No notification preferences. Users cannot set which types of notifications they receive.

**Pass 4 (Frequency):**  
Activity feed items are generated from in-app actions. No push notifications to device. No email notification system (Resend API present but wired to test endpoint only).

**Pass 5 (Polish):**  
The `activity-toast` component appears briefly for in-app actions. `unread` styling on `activity-item` (orange border + soft background) is clear. But the panel header and dismiss controls aren't visible in the code excerpt — unclear if "mark all read" exists.

---

## PHASE 4 — Code Quality

### Large Components (>500 Lines)

| File | Lines | Status |
|------|-------|--------|
| `src/App.tsx` | 7,451 | CRITICAL — entire app in one file |
| `src/styles.css` | 7,138 | HIGH — all styles in one file |
| `RecordsView` (inline in App.tsx) | ~550 | HIGH — needs splitting into 3 tabs |
| `OnboardingFlow` (inline in App.tsx) | ~440 | HIGH — needs extraction |
| `OperationsWorkspace` (inline in App.tsx) | ~600 | HIGH — needs extraction |
| `MarketplaceView` (inline in App.tsx) | ~300 | MEDIUM — extractable |
| `InvoiceTool` (inline in App.tsx) | ~280 | MEDIUM — extractable |

### Prop-Drilling Chains

**Deepest chain: App → OperationsWorkspace → sub-views**

`OperationsWorkspaceProps` interface (`App.tsx:4028–4084`) passes **50+ props** in one interface:
```
view, role, accountProfile, jobs, selectedJob, matchingTalent, applications,
closeouts, scheduleHolds, dispatchNotes, trustReady, uploadedRecords,
completedTraining, messageDraft, sentMessages, reviewRequested, feedbackItems,
feedbackDraft, feedbackCategory, paymentRecords, activityFeed, lockedAccounts,
communityPosts, communityReports, shoutOuts, onPostJob, onNavigate, onOpenJob,
onApply, onApplyToJob, onInvite, onInviteToJob, onReviewConsent, onToggleRecord,
onSubmitCloseoutPacket, onApproveCloseout, onRateJob, onToggleTraining,
onMessageDraft, onSendMessage, onRequestReview, onFeedbackDraft,
onFeedbackCategory, onSubmitFeedback, onMarkPaymentPaid, onExportPayments,
onToggleAdminLock, onVoteCommunityPost, onVoteCommunityAnswer,
onAddCommunityAnswer, onVerifyCommunityAnswer, onReportCommunityPost,
onResolveCommunityReport, onCreateCommunityPrompt, onCreateShoutOut
```

This anti-pattern makes the code brittle. Any new feature requires touching the interface and every component in the chain.

### Hardcoded Values

**Colors (should be tokens):**
- `#ff6a00` appears 100+ times in styles.css (should be `var(--accent)`)
- `#080d10` appears 50+ times (should be `var(--nav)`)
- `rgba(255, 106, 0, ...)` appears 30+ times (hardcoded orange gradient)
- `#9fd8b7` appears in some places (a greenish hex, not from any palette — likely leftover)

**Spacing (should use 8px scale):**
- 9px, 11px, 13px, 15px gaps/paddings — the odd values between multiples of 4/8

**Font weights:**
- 720, 740, 750, 780, 820 — not standard CSS values (see Item 97)

### Performance Issues

| Issue | Impact | File |
|-------|--------|------|
| 7,451 lines in one file — no code splitting possible | HIGH | App.tsx |
| All 16 views render conditionally in same component tree | MEDIUM | App.tsx |
| No lazy loading of routes or tools | MEDIUM | App.tsx |
| `filteredJobs` computed inline on render (no `useMemo`) | LOW | App.tsx |
| No image optimization — public/brand assets are uncompressed PNGs | LOW | /public/brand/ |
| No virtualization for long job/crew lists | LOW | App.tsx |
| 350ms debounce on server state save causes rapid state changes to queue | INFO | App.tsx:~1490 |

### Accessibility Gaps

| Issue | WCAG Criterion | Location |
|-------|---------------|----------|
| TopBar icon buttons 42×42px (need 44×44) | 2.5.5 | styles.css |
| Action buttons in list cards have no defined min-height | 2.5.5 | App.tsx:5860, 6003 |
| Shop Talk vote buttons 14px icons, no guaranteed touch target | 2.5.5 | App.tsx:5281 |
| `<i><b>` used for progress bar — not semantic | 1.3.1 | App.tsx:4855 |
| No `role="progressbar"` on match percentage bar | 1.3.1 | App.tsx:4855 |
| Browser back button breaks navigation (no URL routing) | 2.1.1 | App.tsx |
| No skip-to-content link | 2.4.1 | App.tsx |
| Avatar component may lack alt text for images | 1.1.1 | App.tsx |
| Color used as sole means to distinguish unread items | 1.4.1 | styles.css |
| Dark mode incomplete — contrast ratios untested in dark mode | 1.4.3 | styles.css |

---

## CONSOLIDATED FINDINGS

### Claude's Key Issues — Validation Status

| Issue | Status | Evidence |
|-------|--------|---------|
| Stat block on 11 screens | PARTIAL — on 3 screens with 2 different components | App.tsx:3664, 4159, 4932 |
| Echo lines under every title | BROKEN — still on 14 pages | App.tsx:2492–2493 |
| ~70% of card borders to remove | BROKEN — all cards still bordered | styles.css (20+ card classes) |
| Green overuse | BROKEN — and mislabeled (it's orange) | styles.css, brandConfig.ts:61 |
| JobCards inconsistent | BROKEN — 4 different implementations | App.tsx:3832, 5851, 5917, 5987 |
| Duplicate renderings (Apps/Invites/Crew) | BROKEN — none share a component | App.tsx:5807–6018 |
| Role toggle in topbar | FIXED — role is locked at signup | App.tsx:2456 |
| "Run live setup checks" panel | FIXED or never present in this build | Not found |

### New Items (Codex-Specific Findings)

| # | Issue | Importance |
|---|-------|-----------|
| 87 | Default profile hardcoded to "Ryan Mitchell" | HIGH |
| 88 | Tagline "Connect. Build. Grow." ≠ locked tagline "Where skilled trades connect" | HIGH |
| 89 | ModernMetric and OpsMetric are identical duplicate components | MEDIUM |
| 90 | No URL routing — back button breaks, deep links impossible | HIGH |
| 91 | Admin view accessible client-side without auth gate | HIGH |
| 92 | Messages thread list uses seedJobs (fake data) | HIGH |
| 93 | Messages "mine" detection uses hardcoded "Ryan Mitchell" name | HIGH |
| 94 | 7,451-line monolithic App.tsx must be split | HIGH |
| 95 | 40+ useState hooks, 50+ prop drilling — no state management | HIGH |
| 96 | `--green` CSS variable is actually orange — semantic disaster | HIGH |
| 97 | Non-standard font-weight values (720, 740, 780, 820) | MEDIUM |
| 98 | No URL routing = analytics/support blind | HIGH |
| 99 | Settings theme button routes to wrong place | MEDIUM |
| 100 | RecordsView is 550 lines, needs 3 tabs | MEDIUM |
| 101 | Hardcoded contact name in Messages header | MEDIUM |
| 102 | No empty state for Marketplace when filteredJobs = 0 | HIGH |
| 103 | data.ts exports empty arrays — new instances show nothing | MEDIUM |
| 104 | Feedback page copy is internal product language | LOW |
| 105 | Messages not in primary bottom navigation | MEDIUM |
| 106 | No pull-to-refresh or loading skeleton | MEDIUM |
| 107 | TopBar icon buttons 42×42px — below 44px WCAG minimum | MEDIUM |
| 108 | Action buttons in list cards have no min-height | MEDIUM |

---

## PRIORITY RECOMMENDATIONS

### Do First — Fixes That Unblock Everything Else

**1. Fix the echo line (Item: Echo lines) — 30 minutes**  
Delete `<span>{page.title}</span>` from `App.tsx:2492`. Every page immediately looks cleaner. This is the lowest-effort, highest-visibility fix in the codebase.

**2. Fix the tagline (Item 88) — 5 minutes**  
Change `brandConfig.ts:6` from `"Connect. Build. Grow."` to `"Where skilled trades connect"`. This appears in 3 places in the app and violates a stated lock.

**3. Fix "Ryan Mitchell" as default user (Item 87) — 1 hour**  
Replace hardcoded default name with empty string or derive from auth. Fix the message "mine" detection (Item 93) to use `accountProfile.displayName`. These are correctness bugs, not polish.

**4. Remove fake seed data from Messages (Item 92) — 2 hours**  
Replace `seedJobs` reference in MessagesView with real message threads from server state. Show an empty state if no threads exist. The brief is explicit: "No fake/seed data anywhere."

**5. Fix the card borders — 2 hours**  
Remove `border: 1px solid var(--border)` from `.data-row`, `.activity-item`, and `.admin-card`. Keep borders only on standalone floating cards. Immediate visual improvement.

**6. Add empty state to Marketplace (Item 102) — 1 hour**  
When `filteredJobs.length === 0`, show the existing `EmptyState` component with "No jobs match your filters" and a "Clear filters" button.

**7. Rename `--green` to `--accent` (Item 96) — 3 hours**  
Global find/replace in `styles.css` and `brandConfig.ts`. This is a rename, not a redesign. Nothing will look different — but the code will be readable.

---

### Then Do — Complete the Feel

**8. Fix touch targets (Items 107, 108) — 1 hour**  
Set `width: 44px; min-height: 44px` on `.icon-button`. Add `min-height: 44px` to `.ops-actions button`, `.data-row button`, `.crew-actions button`, `.answer-actions button`.

**9. Unify JobCard component (Claude item) — 4 hours**  
Build one `JobCard` with a `variant` prop. Remove the 4 separate implementations across Marketplace, Applications, Invites, and Crew. This eliminates ~200 lines of duplicated JSX.

**10. Consolidate ModernMetric + OpsMetric (Item 89) — 1 hour**  
Delete `OpsMetric`. Rename `ModernMetric` to `MetricTile`. Update both call sites.

**11. Standardize font weights (Item 97) — 1 hour**  
Replace all instances of 720, 740, 750, 780, 820 in styles.css with standard values (700 or 800). Use CSS variable `--weight-label: 800` and `--weight-semibold: 600` consistently.

**12. Fix the spacing grid — 2 hours**  
Audit every padding and gap value in styles.css. Replace 9px, 11px, 13px, 15px with the nearest 4px-multiple (8px, 12px, 12px, 16px). Establish a strict scale: 4/8/12/16/20/24/32/40px.

**13. Add Marketplace empty state (Item 102) — done in step 6**

**14. Fix Settings page (Item 99) — 2 hours**  
Add actual theme palette selection to SettingsView. Update description to match what the page actually offers.

**15. Add Messages to bottom nav or make topbar icon more prominent (Item 105) — 1 hour**  
Move Messages to the bottom nav on mobile. It's a core feature.

---

### Can Wait — Important But Not Blocking Launch

**16. Add URL routing (Item 90) — 8–12 hours**  
Important for long-term health, analytics, and user experience. Not blocking MVP.

**17. Split App.tsx into components (Item 94) — 16–24 hours**  
Critical architectural work. Do it in phases starting with the largest views (RecordsView, OnboardingFlow, MarketplaceView). Not blocking launch but compounding tech debt weekly.

**18. Introduce Zustand or React Context (Item 95) — 12–20 hours**  
After component splitting. Address the prop drilling chain.

**19. RecordsView tabs (Item 100) — 3 hours**  
Good UX improvement. Not blocking MVP.

**20. Admin view auth gate (Item 91) — 2 hours**  
Add `role === "admin"` guard. Low risk for beta (route not exposed in nav) but critical for production.

**21. Dark mode completion — 6–8 hours**  
Audit every component-level style for missing dark mode overrides.

**22. Loading skeleton — 4 hours**  
Replace full-screen "Preparing your workspace..." with skeleton layouts during hydration.

**23. Messages: fix contact, remove seed data, fix bubble detection (Items 92, 93, 101) — 3 hours total**  
Already in "do first" for seed data (Item 92). Bundle with contact fix (101) and bubble fix (93).

---

## Code Health Assessment

| Category | Score | Assessment |
|----------|-------|-----------|
| Overall code quality | 4/10 | Functional but architecturally concerning. 7,451-line monolith is a ticking clock. |
| Design system maturity | 3/10 | Tokens exist but 300+ hardcoded values bypass them. Primary color is mislabeled. |
| Component reuse | 3/10 | 4 separate JobCard implementations. 2 identical metric components. No shared component library. |
| Performance baseline | 5/10 | No code splitting, no lazy loading, no virtualization. Will degrade as data grows. |
| Accessibility baseline | 4/10 | Some aria-labels present. Touch targets partially fail. No skip link. No `role="progressbar"`. |
| Refactor complexity | HIGH | The 7,451-line file means any extraction risks regressions. Needs incremental extraction with tests. |
| Business constraint compliance | 7/10 | No payment processing ✓. No escrow ✓. Role is immutable ✓. But tagline is wrong ✗, fake data in Messages ✗. |

---

## Estimated Effort

| Category | Items | Estimated Hours |
|----------|-------|----------------|
| Claude's top 6 still-broken items | 6 | ~14 hours |
| New Codex critical items (87–96, 102, 105) | 12 | ~24 hours |
| Accessibility fixes (107, 108) | 2 | ~2 hours |
| Polish and copy fixes (88, 97, 99, 104) | 4 | ~3 hours |
| Architecture (94, 95, 90) | 3 | ~40–56 hours |
| Total: all items | 27 items | **~83–99 engineering hours** |

**MVP sprint (ship-ready for Jacksonville beta):**  
Items 1–8 above = ~10 hours. Makes the app trustworthy, removes seed data, fixes the most visible UX issues.

**Full quality sprint:**  
Items 1–15 above = ~25 hours. App looks professional, feels consistent, passes basic accessibility.

**Architecture sprint (post-beta):**  
Items 16–23 = ~60 hours. Sets up the app for scale and team growth.

---

*This audit covers 7,451 lines of App.tsx and 7,138 lines of styles.css. Every finding includes a file path or line number. Every recommendation includes an effort estimate. No vague items.*
