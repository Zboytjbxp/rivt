# Gate A Accessibility and Device Matrix

Date: 2026-06-21

Gate A status: partial evidence only. This report does not approve named customer or pilot launch.

## Live Target

- URL: `https://rivt.pro/`
- Live health checked after deploy: `2026-06-21T04:35:29Z`
- Live source commit reported by `/api/health`: `67094c9853a8f4be2be01ffe30376b669afe6cde`
- Railway deployment: `007b3270-4c08-4c61-8238-3164db747666`
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

Live run `ui-a11y-20260621043529-3efa9b` created disposable contractor and tradesperson accounts, exercised every scenario above, and closed both accounts after the run.

The script was hardened after that live run to open and audit the top-bar action surfaces rather than only checking that the controls exist:

- `Ctrl+K` global search dialog.
- Notifications panel, including its quick actions.
- Profile/account panel, including the sign-out control.
- Messages top-bar button routing to the server-owned Inbox page.

This expanded top-bar action coverage still needs to be rerun against production with disposable accounts before it becomes live evidence.

Local mocked E2E coverage now also opens top-bar search, notifications, profile/account, and messages/inbox at desktop and mobile viewports through `npm run test:e2e`.

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
- Controllable follow-up: top-bar controls were upgraded from presence-only smoke to interaction smoke in `scripts/live-ui-accessibility.js`, and `test/jobs-discovery.e2e.mjs` now verifies search, notifications, account/profile, and messages/inbox open correctly with mocked server responses.

## Blocked Coverage

Expanded scripted authenticated shell coverage now exists through disposable production accounts. Full manual route and physical-device coverage remains incomplete.

Remaining manual Gate A coverage:

- Physical or emulated iOS Safari and Android Chrome.
- Keyboard-only pass across auth, posting, application, offer, messaging, upload, completion, review, report, and error flows.
- Reduced-motion pass.
- Screen-reader label and announcement pass across the same flows.
- Loading, empty, permission, retry, and offline states on authenticated screens.

## Decision

This pass records live public-shell evidence and expanded scripted authenticated shell, reduced-motion, 200% text-scale, and keyboard-focus evidence, but `GA-UX-006` remains `Partial`. Gate A remains blocked until the deeper manual route matrix and physical-device coverage are completed, including route-level keyboard-only workflows, physical mobile browsers, and screen-reader passes.
