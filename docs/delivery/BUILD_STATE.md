# RIVT Build State

Last updated: 2026-06-18 America/New_York
Current gate: Gate A domain foundation
Current phase: Packet 01 implementation and CI complete; production deployment pending
Repository branch: `codex/packet-01-domain-foundation`
Base commit: `99be82a Align public brand copy with RIVT tagline`

## Source State

Packet 00 is merged on `master` at `4c199d903683e44d17b7985272c399c6d7a6cbd6`. The checkpoint preserves:

- Pre-existing Shop Talk/Trade News work: `server/index.js`, `src/App.tsx`, `src/features/network/NetworkHub.tsx`, `src/styles.css`
- Packet 00 safety work: auth/session/API hardening, dependency fixes, tests, and delivery documentation
- Product source of truth: `RIVT_MASTER_BUILD_PROMPT.md`

Do not discard or overwrite the pre-existing Trade News work when committing or splitting this packet.

## Packet 00 Delivered

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
- Added a GitHub Actions Gate A safety workflow for build, full lint, tests, browser verification, and production dependency audit.
- Added a disposable PostgreSQL 16 CI service and cross-user authorization/session/role integration test.
- Restored explicit Contractor/Tradesperson selection inside signup while keeping role immutable afterward.
- Reduced repository lint from 59 findings to zero. Four superseded screens remain explicitly exported and deprecated for Packet 01 parity review.

## Verification Results

Run on 2026-06-18:

- `npm run build`: pass; 1,759 modules; approximately 344 kB JS and 192 kB CSS before gzip.
- `npm run test`: pass locally; 9 tests pass and the disposable-Postgres test skips because `TEST_DATABASE_URL` is intentionally absent locally.
- `npm run test:e2e`: pass; failed login stays signed out and Tradesperson signup sends the correct immutable role/company payload.
- `npm run lint`: pass repository-wide with zero errors or warnings.
- `npm audit --omit=dev`: pass; zero known vulnerabilities.
- In-app Browser QA at 1280x720 and 390x844: auth page renders, signup role selection responds, narrow role copy no longer overlaps, and no console warnings/errors were observed.
- GitHub Actions `Gate A Safety` run 27802147834 for commit `e4d1815`: pass; clean install, PostgreSQL-backed authorization/session tests, full lint, production build, Playwright auth flow, and production dependency audit all completed successfully.
- GitHub Actions `Gate A Safety` run 27802435052 for merged `master` commit `4c199d9`: pass.

## Live Environment Evidence

Deployed on 2026-06-18 through Railway deployment `0f6a928c-02e6-4d58-b13d-f80894bb4b77`:

- `https://rivt.pro/api/health` returned 200 and identified source commit `4c199d903683e44d17b7985272c399c6d7a6cbd6`.
- PostgreSQL and S3-compatible storage reported healthy; authenticated readiness reported `runtime-schema-v1`.
- Anonymous storage, readiness, and app-state requests returned 401.
- Invalid login returned 401 and did not create an authenticated session.
- A marked disposable account completed signup, authenticated readiness/storage access, and logout; it was then deleted from production.
- Trade News returned 22 live items.
- Playwright live checks at 1280x720 and 390x844 returned 200 with the correct title/heading and no console errors.

## Packet 00 Acceptance

Packet 00 is accepted. The broader Gate A release is not approved: normalized domain persistence, migrations, real workflow authorization, backup/restore evidence, and provider acceptance remain open.

## Packet 01 Implemented

- Inventoried production in a read-only transaction without emitting PII: 2 authenticated users, 114 unowned app-state blobs, 53 generic events, and 1 unowned upload.
- Classified all legacy marketplace state as quarantined prototype data; no legacy job, person, message, review, community post, or upload becomes canonical/public.
- Added transactional SQL migrations with checksums, advisory locking, migration status, explicit rollback, and fail-closed startup.
- Added canonical accounts, auth identities, private draft profiles, organizations/memberships, 25-trade taxonomy, consent, append-only audit events, and idempotency records.
- Bridged existing and newly inserted auth users to canonical private accounts without inferring organizations.
- Added `/api/v1` request IDs, validation/error conventions, pagination primitives, actor context, and fail-closed organization-role policy.
- Added clean/snapshot migration apply, idempotent rerun, rollback/reapply, checksum-tamper, account bridge, and authorization tests.
- GitHub Actions runs 27803255310 and 27803349568 passed against disposable PostgreSQL.

## Packet 01 Release Safety

- Created Railway bucket `rivt-private` with actual bucket `rivt-private-66cklzn4qc-f` after discovering the prior app variable used a display name that did not exist in S3.
- Copied and size-verified the single quarantined legacy object into the new bucket.
- Created an AES-256-GCM encrypted logical snapshot directly in private object storage at `backups/postgres/2026-06-19T03-29-15.832Z-pre-packet-01-4c199d9.json.aes256gcm`.
- Downloaded, decrypted, parsed, and reconciled the snapshot in memory: 53 events, 114 app-state rows, 3 sessions, 2 users, 0 guests, and 1 upload.
- Stored the encryption key as a Railway secret; no local backup file or plaintext cloud object was created.
- Staged corrected S3 variables with deployment suppressed so application code and config change together.

## Next Exact Task

Fast-forward the CI-proven Packet 01 branch into `master`, deploy it with the staged storage variables, verify migrations/account bridges/object access, then record the exact build and rollback evidence. Do not implement jobs, messages, or new UI until that release is accepted.

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
