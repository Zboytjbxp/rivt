# RIVT Figma-Style Design Audit

Date: 2026-07-08
Branch inspected: `codex/exact-destination-followup`
Method: Figma connector check, live local app screenshots, Playwright viewport pass, CSS/token inspection.

## Figma Status

The Figma connector is authenticated as `zboytjbxp@gmail.com`, but the available seat is view-only and no editable Figma design file was supplied. That means Codex cannot create or edit a Figma audit board from this session.

This audit continues without blocking on Figma. The useful work right now is code-backed design QA: compare rendered screens to the intended visual system, then turn the findings into concrete code changes.

## Evidence Captured

Rendered viewports:

- 320 x 568, old iPhone SE class
- 375 x 667, small iPhone
- 390 x 844, modern small phone
- 768 x 1024, tablet
- 1366 x 768, desktop

CSS/design-system measurements:

- CSS files inspected: 21
- `src/styles.css`: 10,315 lines
- Raw hex color matches: 819
- Unique raw hex colors: 271
- Media query matches: 120
- Font-size declarations: 1,559
- Raw pixel font-size declarations: 1,361

These numbers do not mean every declaration is wrong, but they do show that the design system is not fully enforced. The product has good visual direction, but too many screens still bypass shared tokens.

## Executive Verdict

RIVT is much closer than it was. The current visual direction has the right ingredients: strong orange, bold type, five clear product areas, cleaner tools, real Shop Talk/community direction, and a more professional top-level shell.

The remaining design problem is not one bad screen. It is a consistency problem:

- Preview/onboarding UI sometimes looks like real app UI.
- Mobile pages technically fit, but inner content still clips.
- Desktop still feels like a stretched mobile app in places.
- Tokens exist, but raw colors and font sizes keep leaking through.
- Many cards explain themselves too much instead of acting like tools.
- Some labels promise exact job-scoped actions, while the destination is still generic.

The fix is not more decoration. It is tighter rules, fewer patterns, and stricter destination logic.

## Priority Findings

### 1. Preview UI Looks Too Much Like Real App UI

The first-run orange onboarding is bold and on-brand, but the phone mockups, labels, and fake nav-like elements look close enough to the real app that users and tests can mistake preview content for actual navigation.

Impact:

- Users on small phones can feel trapped in a marketing sequence.
- Automated checks click text inside preview mockups instead of real app controls.
- It blurs the line between "preview" and "product."

Fix:

- Keep the orange brand energy, but make preview mockups visibly illustrative.
- Put `Log in`, `Create account`, and `Browse preview` in a stable bottom action area.
- Limit onboarding preview cards to one clean visual per slide.
- Avoid showing real app navigation labels inside mockups unless they are clearly non-interactive.

### 2. Small Phones Still Clip Inner Content

The Playwright pass found no document-level horizontal overflow, but many individual elements were still off-viewport or clipped inside cards at 320 and 375 widths. This matches the real iPhone SE photos.

Impact:

- Screens look broken even when the page technically has no horizontal scroll.
- Text truncates in community rows, guest banners, stat chips, and tool panels.
- Users may miss actions because they are visually cut off, not because the page failed to load.

Fix:

- Add a 320 x 568 and 375 x 667 visual smoke gate for core screens.
- Treat clipped inner content as a failure, not just document overflow.
- Replace fixed-width rows with wrapping or one-column layouts under 375px.
- Hide low-value metadata at tiny widths instead of truncating it.

### 3. Desktop Uses Space Poorly

The desktop Home view has a strong sidebar and topbar, but the main content leaves large dead space while cards sit far to one side. Tools are better, but still mostly a larger version of mobile cards.

Impact:

- Office/admin users, contractors, and spouses using laptops will feel like they are using a mobile PWA on desktop.
- Premium SaaS competitors use desktop as a productive workspace, not just a widened phone layout.

Fix:

- Give desktop a real workspace layout:
  - Left: primary content/feed/work list
  - Right: active work, notifications, recent tools, or job context
  - Center widths should be intentional, not accidental
- Home should surface active work and pending actions on desktop, not mostly whitespace.

### 4. Guest Banner and Topbar Consume Too Much Mobile Space

On small phones, the topbar plus guest banner takes a lot of the first viewport. The guest banner also truncates its own message.

Impact:

- Users see chrome before content.
- The first useful card starts too low.
- Guest mode copy becomes noisy after the first screen.

Fix:

- Use a compact guest chip after the first page load.
- Move `Sign up` into a smaller persistent action.
- Let users dismiss or collapse the guest banner for the session.

### 5. Token Drift Is Still a Design-System Risk

There are 271 unique raw hex colors across CSS. Some are legitimate one-offs, but many duplicate semantic states that should be tokens.

Impact:

- Dark/light behavior becomes inconsistent.
- Status colors drift.
- Future redesigns require hunting magic values instead of updating tokens.

Fix:

- Sweep raw colors into semantic tokens:
  - accent
  - surface
  - surface-muted
  - text
  - text-muted
  - border
  - success
  - warning
  - danger
  - info
- Enforce token usage in feature CSS as touched.

### 6. Typography Has Too Many Local Rules

There are 1,559 font-size declarations and 1,361 raw pixel font-size declarations across CSS.

Impact:

- The app feels more "assembled" than designed.
- Tiny labels and dense captions create the AI-generated dashboard texture.
- Screens do not scale consistently across old SE, modern phones, and desktop.

Fix:

- Use a five-step scale:
  - caption: 13px
  - body: 15px or 16px
  - title: 21px
  - screen title: 28px to 34px
  - display: 40px+ only for onboarding/marketing
- Stop using sub-13px text outside intentionally tiny icon labels.
- Use tabular numbers for money, stats, calculator output, and hours.

### 7. Too Many Cards Still Explain Themselves

The app is better than before, but Home, Work, Tools, Profile/Settings, and Shop Talk still have repeated card containers, helper text, and status modules.

Impact:

- The app feels more like a generated SaaS dashboard than a field tool.
- Real content competes with explanatory scaffolding.

Fix:

- For every card, ask:
  - Does it contain a record?
  - Does it trigger an action?
  - Does it represent a status the user must act on?
- If no, remove it or convert it to a simple line.

### 8. Shop Talk Needs a Cleaner Reddit-Like Hierarchy

The direction is right, but the directory view is still too card-heavy and metadata clips on small screens. Community pages, search, and post feeds should feel primary.

Impact:

- Shop Talk can feel like a settings directory instead of a live community.
- Join buttons visually compete with Ask/post actions.

Fix:

- Default Shop Talk to a feed with community context.
- Make Discover a search-first community browser.
- Add clear community pages with posts, about, audience, and join state.
- Keep Join as secondary style. Reserve orange for Ask/Post.
- Support post thumbnails/media as a normal feed pattern.

### 9. Tools Are Cleaner, But Need Stronger Per-App Identity

The Tools hub is much improved. The issue now is detail screens and job-scoped flows:

- Calculator feels closest to a dedicated app.
- Invoice/Estimate still read as form surfaces.
- Camera should feel like a jobsite capture app, not a generic album.
- Records should not be the destination when the user asks for job photos.

Fix:

- Each tool gets a dedicated app shell:
  - compact top command bar
  - full-screen workspace
  - no global nav if it interferes with the task
  - job context only when job-scoped
- Camera becomes job-first:
  - active job feed
  - take photo
  - upload state
  - visible result in the same job feed
  - comments/tags/date/user

### 10. Exact-Destination Logic Must Become a Design Rule

Several recent bugs are not isolated. They share one root cause: a button label promises a specific object, but the destination opens a generic section.

Examples:

- `Photos` from active work must open that job's photos, not generic Records.
- Notifications must open the exact thread, post, review, offer, or job.
- Tools opened from a job should stay scoped to that job.

Fix:

- Create an exact-destination checklist for every button:
  - What object does the label imply?
  - Does the handler carry that object's id?
  - Does the destination preselect it?
  - Is there a fallback if the object is missing?
- Add route/state smoke tests for notifications and active-work actions.

### 11. Topbar Logo Is Too Small On Mobile

The detailed RIVT lockup is not readable in the tiny topbar. It looks good as a splash/login mark, but not as a 50px-wide utility logo.

Fix:

- Use a simplified wordmark or icon mark in the app chrome.
- Keep the full tagline lockup for login, splash, marketing, and PDFs.

### 12. Figma Source Of Truth Is Missing

Even though we can keep building without Figma, RIVT would benefit from one design source of truth once the launch train settles.

Fix when ready:

- Create a Figma file with:
  - current screenshot audit board
  - color tokens
  - type scale
  - spacing scale
  - app shell
  - buttons
  - cards/rows
  - Shop Talk post card
  - Job card
  - Person card
  - Tool app shell
  - Camera/job feed screen

## Recommended Build Order

### Phase 1: Mobile Reliability And Exact Destinations

- Fix every active-work button to open the exact job-scoped destination.
- Compact the guest banner/topbar.
- Add 320 and 375 viewport checks for Home, Work, Shop Talk, Tools, Camera, and Calculator.
- Treat inner clipping as a failure.

### Phase 2: Token And Typography Consolidation

- Move raw semantic colors into tokens.
- Reduce font-size declarations as files are touched.
- Make card radius, border, and shadow rules consistent.

### Phase 3: Shop Talk Community Redesign

- Feed first.
- Community pages second.
- Discover/search third.
- Post thumbnails/media as normal behavior.
- Audience states clearly visible: public, contractors-only, tradespeople-only.

### Phase 4: Tools As Dedicated Apps

- Camera/job feed first.
- Invoice/Estimate second.
- Calculator polish third.
- Records becomes a job archive, not the default destination for every photo action.

### Phase 5: Desktop Workspace

- Home and Work get real desktop layouts.
- Tools get denser desktop cards and grouped sections.
- Profile/Settings become a trust and account workspace, not only a drawer-like mobile screen.

## Bottom Line

RIVT does not need more visual effects. It needs fewer competing patterns.

The product should feel like this:

- one clear nav system
- exact destinations
- fewer cards
- larger readable type
- strict color meanings
- job-scoped tools
- Shop Talk as a real community feed
- camera as a jobsite capture app
- desktop as a real workspace

If those rules hold, the app will stop feeling like a collection of screens and start feeling like a professional trades platform.
