# RIVT Build State

Last updated: 2026-06-18 America/New_York
Current gate: Gate A foundation
Current phase: Packet 00 implementation in progress; local safety acceptance complete, deployment not started
Repository branch: `codex/gate-a-foundation`
Base commit: `99be82a Align public brand copy with RIVT tagline`

## Working Tree

The branch contains uncommitted Packet 00 work plus pre-existing product changes that remain preserved:

- Pre-existing Shop Talk/Trade News work: `server/index.js`, `src/App.tsx`, `src/features/network/NetworkHub.tsx`, `src/styles.css`
- Packet 00 safety work: auth/session/API hardening, dependency fixes, tests, and delivery documentation
- Product source of truth: `RIVT_MASTER_BUILD_PROMPT.md`

Do not discard or overwrite the pre-existing Trade News work when committing or splitting this packet.

## Implemented Locally

- Removed browser-side fabricated authentication and session-storage auth fallback.
- Failed login/network requests remain signed out; local guest access is disabled.
- Private legacy API routes now require a valid database-backed user session and scope records to the authenticated user ID.
- Signup, login, and Google OAuth rotate the session ID; session lifetime defaults to 30 days.
- New Google users enter `pending` onboarding without a fabricated role, company, or location.
- Existing Google users retain established role/company/location; role becomes immutable after onboarding.
- Added approved-origin CORS/origin checks and baseline auth/write/upload rate limits.
- Restricted uploads to an explicit MIME allowlist and retained file-size/count limits.
- Replaced synthetic identity/Stripe success responses with honest `not_implemented` failures.
- Added safe build/dependency health output and authenticated readiness output.
- Declared `fast-xml-parser` directly and upgraded Multer to `2.2.0`.
- Added Node unit/integration tests and a Playwright fail-closed authentication test.
- Added a GitHub Actions Gate A safety workflow for build, focused lint, tests, browser verification, and production dependency audit.

## Verification Results

Run on 2026-06-18:

- `npm run build`: pass; 1,759 modules; approximately 344 kB JS and 192 kB CSS before gzip.
- `npm run test`: pass; 9/9 unit and integration tests.
- `npm run test:e2e`: pass; failed login remains on the auth screen and no guest-demo entry is rendered.
- Focused lint for `server/index.js`, `server/security.js`, and all new tests: pass with zero errors.
- `npm audit --omit=dev`: pass; zero known vulnerabilities.
- `npm run lint`: repository still fails with 58 errors and 1 warning, concentrated in the pre-existing `src/App.tsx` legacy monolith. This remains a Gate A release blocker.

## Live Environment Evidence

Last checked before Packet 00 implementation:

- `https://rivt.pro/` returned 200.
- PostgreSQL and S3-compatible storage reported healthy.
- Google auth reported configured; Facebook and Apple were not configured/implemented.
- The running source revision was not exposed.

Packet 00 has not been deployed. Live behavior must not be assumed to include these local fixes.

## Remaining Packet 00 Work

1. Decide and document the temporary lint baseline or resolve the 58 existing errors; zero repository errors are required before pilot release.
2. Add database-backed integration coverage for session rotation, role immutability, and cross-user authorization.
3. Review changes, commit intentionally, push the branch, and verify the new CI workflow.
4. Deploy to staging/production and record the source commit.
5. Run authenticated live readiness and smoke tests, including existing Shop Talk/Trade News behavior.
6. Record deployment and rollback evidence in `DEPLOYMENT_LEDGER.md`.

## Next Exact Task

Complete the remaining Packet 00 CI/database-backed authorization evidence. Do not begin normalized marketplace schema or new product features until Packet 00 is accepted and deployed.

## Blocking Founder Decisions

Needed before Gate A recruitment, not before finishing Packet 00:

- Pilot user count and named cohort.
- Priority Jacksonville trade clusters and configured service area.
- Support hours and escalation owner.
- Email provider and sender-domain plan.
- Whether SMS is deferred from Gate A.
- Review/dispute policy.
- Pilot retention/deletion policy.
- Legal-review owner and approval path.

## Required Handoff Format

At the end of each packet record:

1. Source commit/branch and working-tree state.
2. Requirements moved and new maturity state.
3. Files/migrations/config changed.
4. Commands/tests run with results.
5. Live/staging deploy status and build identifier.
6. Screenshots/manual acceptance evidence.
7. New risks or decisions.
8. Exact next packet/task.
