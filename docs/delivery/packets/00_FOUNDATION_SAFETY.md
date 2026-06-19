# Packet 00 — Foundation Safety

## Objective

Make the current application fail closed, establish tests/CI-ready commands, remediate known dependency risk, and expose build/migration readiness. Do not build new marketplace features.

Requirements: GA-FND-004, GA-FND-005, GA-FND-008, GA-AUTH-002, GA-AUTH-007, GA-AUTH-009, GA-OPS-001, GA-OPS-002, GA-OPS-003, GA-OPS-006, GA-OPS-007, GA-OPS-008.

## Required Work

1. Preserve and integrate the existing uncommitted Shop Talk/news changes; do not revert unrelated work.
2. Remove the frontend's local fabricated-auth fallback. Any failed auth remains signed out.
3. Add authenticated-user middleware and protect private legacy endpoints immediately. Guest browsing may access only explicitly public read endpoints.
4. Rotate session ID on successful signup/login/OAuth and use a reviewed bounded expiry.
5. Restrict production CORS and document CSRF strategy.
6. Add baseline rate limiting for auth, state write, upload, events, and provider test/send routes.
7. Upgrade Multer to a fixed supported version; declare/pin direct `fast-xml-parser`; rerun production audit.
8. Add unit/integration/E2E test commands and minimal harness.
9. Fix lint or establish a temporary explicit legacy baseline while ensuring every changed/new file has zero errors. Gate A must reach zero repository errors before release.
10. Add internal health/readiness response with build commit and migration version without exposing secrets.
11. Add deployment-ledger template and write the current known state.

## High-Risk Files

- `server/index.js`
- `src/App.tsx`
- `package.json`, lockfile, lint/test configuration
- new middleware/test/build metadata modules

Refactor only what is necessary for the safety outcome. Do not split all of `App.tsx` in this packet.

## Acceptance

- Invalid credentials and network failures never authenticate locally.
- Anonymous calls to private routes return `401`.
- Login rotates the session identifier.
- Build passes; new tests pass; changed files lint clean; dependency audit has no unaccepted high/critical issue.
- Approved-origin and rate-limit tests pass.
- Health/readiness identifies the build and dependency status safely.
- Existing Shop Talk/news behavior remains intact behind its current route/flag state.

## Stop Condition

Stop after foundation acceptance and documentation. Do not start normalized job schema in remaining tokens.
