# Gate A Accessibility and Device Matrix

Date: 2026-06-22

Gate A status: partial evidence only. This report does not approve named customer or pilot launch.

## Live Target

- URL: `https://rivt.pro/`
- Live health checked after deploy: `2026-06-22T04:17Z`
- Live source commit reported by `/api/health`: `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`
- Railway deployment: `17cc18db-0ac5-4f23-bf5f-955b98af38cb`
- Browser tool: Codex in-app Browser controlled by Playwright runtime

## Completed Smoke Coverage

| Surface | Viewport | Result |
|---|---:|---|
| Public auth/marketing shell | 1280x720 | Loaded with title `RIVT | Where skilled trades connect`; no console warnings/errors; no horizontal overflow. |
| Public auth/marketing shell | 390x844 | Loaded; no console warnings/errors; no horizontal overflow. |
| Public auth/marketing shell | 360x800 | Loaded; no console warnings/errors; no horizontal overflow. |
| Auth form labels | 1280x720 / 390x844 / 360x800 | Email and password controls have visible labels. |
| Invalid email/password | 390x844 | Remains signed out with generic `Invalid email or password.` message; no local fallback observed. |
| Authenticated contractor shell | 390x844 | Disposable production contractor account signed in; top-bar search, messages, notifications, and profile controls present; no role toggle or More tab; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |
| Authenticated tradesperson shell | 390x844 | Disposable production tradesperson account signed in; top-bar search, messages, notifications, and profile controls present; no role toggle or More tab; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |
| Authenticated contractor shell | 360x800 | Expanded smoke passed after Crew/network overflow fixes; top-bar search, messages, notifications, and profile controls present; no role toggle or More tab; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |
| Authenticated tradesperson shell | 360x800 | Expanded smoke passed after Crew/network overflow fixes; top-bar search, messages, notifications, and profile controls present; no role toggle or More tab; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |
| Authenticated contractor shell | 768x1024 | Expanded smoke passed; top-bar search, messages, notifications, and profile controls present; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |
| Authenticated contractor shell | 1366x768 | Disposable production contractor account signed in; top-bar search, messages, notifications, and profile controls present; no role toggle or More tab; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |
| Authenticated contractor shell | 1440x900 | Expanded smoke passed; top-bar search, messages, notifications, and profile controls present; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |
| Authenticated contractor shell at 200% text | 390x844 | Expanded smoke passed with `html { font-size: 32px !important; }`; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |
| Authenticated keyboard/reduced-motion smoke | 390x844 / 1366x768 | Browser context uses reduced-motion preference; keyboard focus reaches skip link, RIVT home, top-bar controls, profile menu, and primary navigation with named visible focus targets. |

## Scripted Matrix Expansion

`scripts/live-ui-accessibility.js` now runs the authenticated smoke matrix as explicit scenarios:

- 360x800 compact phone for contractor and tradesperson.
- 390x844 standard phone for contractor and tradesperson.
- 768x1024 tablet for contractor.
- 1366x768 laptop for contractor.
- 1440x900 wide desktop for contractor.
- 390x844 contractor pass with 200% root text scale.

Live run `ui-a11y-20260621062332-02b380` created disposable contractor and tradesperson accounts through the production service, exercised every scenario above against `https://rivt.pro`, and closed both accounts after the final run.

The script now opens and audits the top-bar action surfaces rather than only checking that the controls exist:

- `Ctrl+K` global search dialog.
- Notifications panel, including its quick actions.
- Profile/account panel, including the sign-out control.
- Messages top-bar button routing to the server-owned Inbox page.

This expanded top-bar action coverage passed in production during run `ui-a11y-20260621062332-02b380` after the tap-target and text-scale fixes below.

Local mocked E2E coverage now also opens top-bar search, notifications, profile/account, and messages/inbox at desktop and mobile viewports through `npm run test:e2e`.

## 2026-06-22 Expanded Production Accessibility Smoke

Run `ui-a11y-20260622041456-3d6a3d` passed against `https://rivt.pro` after Railway deployment `17cc18db-0ac5-4f23-bf5f-955b98af38cb` and source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`.

The script now captures screenshot evidence when `RIVT_UI_SMOKE_SCREENSHOT_DIR` is set and fails on these additional accessibility regressions:

- Missing visible `main` or navigation landmarks.
- Visible images without `alt`.
- Visible form controls without a label, `aria-label`, `aria-labelledby`, `name`, `placeholder`, or `title`.
- Sub-44px visible controls.
- Horizontal overflow, including 200% root text scale.
- Missing top-bar search, messages, notifications, or profile controls.
- Reintroduced More navigation or authenticated role toggle.
- Post-login console warnings/errors.
- Keyboard focus targets without useful names.

The passing run covered eight role/viewport scenarios:

- Contractor and tradesperson at 360x800.
- Contractor and tradesperson at 390x844.
- Contractor at 768x1024.
- Contractor at 1366x768.
- Contractor at 1440x900.
- Contractor at 390x844 with 200% root text scale.

Each scenario audited Home, Work, Crew, Shop Talk, Tools, and Home again, then opened and audited the top-bar search dialog, notifications panel, account/profile panel, and messages/inbox route.

Every scenario reported:

- `consoleWarningsOrErrors: 0`
- `smallTargetCount: 0`
- `missingImageAltCount: 0`
- `unlabeledFieldCount: 0`
- Top-bar search/messages/notifications/profile present.
- No role toggle.
- No More tab.
- Reduced-motion preference.
- Keyboard focus reaching named top-bar and primary-navigation targets.
- No horizontal overflow.

Screenshot evidence: `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-a11y-20260622041456-3d6a3d` with 72 PNG files.

Disposable production smoke accounts from this run were closed after verification with `accountsClosed: 2`.

## Findings and Fixes

- Finding: public auth email/password fields rendered at `42px` height, below the Gate A 44px target-size floor.
- Fix in this packet: raised `.auth-form-grid input` `min-height` to `46px` in `src/styles.css`.
- Post-deploy verification: at 390x844, live email and password fields measured `46px` high with visible labels and no console warnings/errors.
- No horizontal page overflow was found in the tested public shell breakpoints.
- No live console warnings or errors were observed in the tested public shell breakpoints.
- Follow-up finding: authenticated shell smoke initially found sub-44px Work status tabs and Shop Talk action buttons. Fixes raised `.v2-section-tabs button`, `.v2-detail-tabs button`, and shared Shop Talk action buttons to a `44px` minimum width.
- Post-deploy authenticated verification: live smoke `ui-a11y-20260621005817-8a87eb` passed at 390x844 contractor, 390x844 tradesperson, and 1366x768 contractor with `consoleWarningsOrErrors: 0` and `smallTargetCount: 0` on all three viewports. This smoke now fails on missing top-bar controls, post-login console warnings/errors, sub-44px controls, unnamed keyboard focus targets, and keyboard focus failing to reach search or primary navigation within 32 Tab presses. Disposable accounts were closed after the run.
- Follow-up finding: expanded authenticated smoke found 360x800 Crew overflow in the V2 network shell. The first issue was intrinsic grid/flex sizing that let `.v2-network-header`, `.v2-network-grid`, and `.v2-network-panel` exceed their parent; the second was a mobile metric row with three `min-width: 110px` cards.
- Fixes in this packet: added explicit `min-width: 0` shrink rules for network page children and converted the mobile metrics row to a real three-column grid with no fixed metric-card minimum.
- Post-deploy expanded verification: live smoke `ui-a11y-20260621043529-3efa9b` passed at 360x800, 390x844, 768x1024, 1366x768, 1440x900, and 390x844 with 200% text-scale.
- Follow-up finding: production top-bar interaction smoke found sub-44px controls in opened surfaces: search dialog `Cancel` measured 18px, notification quick actions measured 38px, theme toggles measured 36-42px across responsive contexts, and Inbox actions measured 18-38px.
- Fixes in this packet: raised mobile search actions, notification quick actions, theme toggles and responsive overrides, and Inbox header/alert/composer/empty/job-row actions to the 44px target floor.
- Follow-up finding: the search dialog overflowed horizontally on a 390x844 phone at 200% root text scale.
- Fix in this packet: constrained the search panel to `calc(100vw - 32px)` and adjusted search input flex behavior for narrow mobile panels.
- Post-deploy regression verification: live smoke `ui-a11y-20260621062332-02b380` passed at 360x800, 390x844, 768x1024, 1366x768, 1440x900, and 390x844 with 200% text-scale on production source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1`. Every scenario reported `consoleWarningsOrErrors: 0`, `smallTargetCount: 0`, reduced-motion preference, top-bar search/messages/notifications/profile present, and keyboard focus reaching named top-bar and primary navigation targets.
- Controllable follow-up: local mocked E2E coverage also opens top-bar search, notifications, account/profile, and messages/inbox at desktop and mobile viewports through `npm run test:e2e`.
- 2026-06-22 finding: hardened production smoke found the Shop Talk search input below the 44px touch-target floor on a 360px phone.
- Fix in this packet: added a 44px minimum height for `.shop-talk-search input` in `src/styles.css`.
- 2026-06-22 finding: the Inbox metric summary clipped labels at 200% text on a 390x844 phone.
- Fix in this packet: allowed metric labels to wrap in `src/components/ui.css` and stacked `.v2-inbox-summary` to a single column below 480px in `src/features/inbox/inbox-center.css`.
- Post-deploy regression verification: live smoke `ui-a11y-20260622041456-3d6a3d` passed all expanded checks on production source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d` with screenshot evidence captured.

## Blocked Coverage

Expanded scripted authenticated shell coverage now exists through disposable production accounts and includes opened top-bar interaction surfaces. Full manual route and physical-device coverage remains incomplete.

Remaining manual Gate A coverage:

- Physical or emulated iOS Safari and Android Chrome.
- Keyboard-only pass across auth, posting, application, offer, messaging, upload, completion, review, report, and error flows.
- Reduced-motion pass.
- Screen-reader label and announcement pass across the same flows.
- Loading, empty, permission, retry, and offline states on authenticated screens.
- The manual checklist for this remaining boundary is `docs/quality/PHYSICAL_ACCESSIBILITY_CHECKLIST.md`.

## Decision

This pass records live public-shell evidence plus expanded scripted authenticated shell, opened top-bar interaction, reduced-motion, 200% text-scale, tap-target, missing-image-alt, unlabeled-field, landmark, screenshot, and keyboard-focus evidence, but `GA-UX-006` remains `Partial`. Gate A remains blocked until the deeper manual route matrix and physical-device coverage are completed, including route-level keyboard-only workflows, physical mobile browsers, and screen-reader passes.
