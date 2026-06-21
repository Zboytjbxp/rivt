# Gate A Accessibility and Device Matrix

Date: 2026-06-20

Gate A status: partial evidence only. This report does not approve named customer or pilot launch.

## Live Target

- URL: `https://rivt.pro/`
- Live health checked after deploy: `2026-06-21T00:27:02Z`
- Live source commit reported by `/api/health`: `5f3334b231114efb377899ea79bad6a48b353a21`
- Railway deployment: `508c2a9c-5748-4341-9ec8-cdf427dac1fc`
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
| Authenticated contractor shell | 1366x768 | Disposable production contractor account signed in; top-bar search, messages, notifications, and profile controls present; no role toggle or More tab; no horizontal overflow; `consoleWarningsOrErrors: 0`; `smallTargetCount: 0`. |

## Findings and Fixes

- Finding: public auth email/password fields rendered at `42px` height, below the Gate A 44px target-size floor.
- Fix in this packet: raised `.auth-form-grid input` `min-height` to `46px` in `src/styles.css`.
- Post-deploy verification: at 390x844, live email and password fields measured `46px` high with visible labels and no console warnings/errors.
- No horizontal page overflow was found in the tested public shell breakpoints.
- No live console warnings or errors were observed in the tested public shell breakpoints.
- Follow-up finding: authenticated shell smoke initially found sub-44px Work status tabs and Shop Talk action buttons. Fixes raised `.v2-section-tabs button`, `.v2-detail-tabs button`, and shared Shop Talk action buttons to a `44px` minimum width.
- Post-deploy authenticated verification: live smoke `ui-a11y-20260621002702-cbe0e5` passed at 390x844 contractor, 390x844 tradesperson, and 1366x768 contractor with `consoleWarningsOrErrors: 0` and `smallTargetCount: 0` on all three viewports. This smoke now fails on missing top-bar controls, post-login console warnings/errors, or sub-44px controls. Disposable accounts were closed after the run.

## Blocked Coverage

Scripted authenticated shell coverage now exists through disposable production accounts. Full manual route and physical-device coverage remains incomplete.

Remaining manual Gate A coverage:

- Authenticated contractor and tradesperson routes on production.
- Physical or emulated iOS Safari and Android Chrome.
- 768px tablet, 1366x768 laptop, and 1440px desktop routes after login.
- 200% text/zoom pass.
- Keyboard-only pass across auth, posting, application, offer, messaging, upload, completion, review, report, and error flows.
- Reduced-motion pass.
- Screen-reader label and announcement pass across the same flows.
- Loading, empty, permission, retry, and offline states on authenticated screens.

## Decision

This pass records live public-shell evidence and scripted authenticated shell evidence, but `GA-UX-006` remains `Partial`. Gate A remains blocked until the deeper manual route matrix and physical-device coverage are completed, including 200% text, keyboard-only, reduced-motion, and screen-reader passes.
