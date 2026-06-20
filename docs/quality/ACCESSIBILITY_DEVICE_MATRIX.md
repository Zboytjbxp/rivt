# Gate A Accessibility and Device Matrix

Date: 2026-06-20

Gate A status: partial evidence only. This report does not approve named customer or pilot launch.

## Live Target

- URL: `https://rivt.pro/`
- Live health checked: `2026-06-20T22:03:09Z`
- Live source commit reported by `/api/health`: `00147c8e3f70e246b41ed48b46550ae33cf0eb54`
- Browser tool: Codex in-app Browser controlled by Playwright runtime

## Completed Smoke Coverage

| Surface | Viewport | Result |
|---|---:|---|
| Public auth/marketing shell | 1280x720 | Loaded with title `RIVT | Where skilled trades connect`; no console warnings/errors; no horizontal overflow. |
| Public auth/marketing shell | 390x844 | Loaded; no console warnings/errors; no horizontal overflow. |
| Public auth/marketing shell | 360x800 | Loaded; no console warnings/errors; no horizontal overflow. |
| Auth form labels | 1280x720 / 390x844 / 360x800 | Email and password controls have visible labels. |
| Invalid email/password | 390x844 | Remains signed out with generic `Invalid email or password.` message; no local fallback observed. |

## Findings and Fixes

- Finding: public auth email/password fields rendered at `42px` height, below the Gate A 44px target-size floor.
- Fix in this packet: raised `.auth-form-grid input` `min-height` to `46px` in `src/styles.css`.
- No horizontal page overflow was found in the tested public shell breakpoints.
- No live console warnings or errors were observed in the tested public shell breakpoints.

## Blocked Coverage

The authenticated manual route matrix is still blocked because the provided testing account does not authenticate on production and no new production user was created during this audit.

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

This pass reduces one touch-target defect and records live public-shell evidence, but `GA-UX-006` remains `Partial`. Gate A remains blocked until the authenticated and physical/manual matrix is completed with a usable pilot/admin test account or a reviewed disposable-user test plan.
