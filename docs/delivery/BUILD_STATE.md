# RIVT Build State

Last updated: 2026-06-19 America/New_York
Current gate: Gate A jobs and discovery
Current phase: Packet 03 implemented locally; awaiting commit, CI, and production release evidence
Repository branch: `codex/packet-03-jobs-discovery`
Production release commit: `696a332 Fix Railway production build dependencies`

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
- Deployed corrected S3 variables with Packet 01 and verified an authenticated upload, S3 head request, signed download, content match, and cleanup.

## Packet 01 Production Evidence

- Source commit: `166c43a9e24af64737eed22088e0306cc6873b22`
- Railway deployment: `1188000e-374c-44db-9d32-b007bf481959`
- Merged-master GitHub Actions run 27803652474: pass
- Production readiness: `0002_domain_foundation`, two applied migrations, zero pending
- Canonical bridge: 2 accounts, 2 private draft profiles, 2 identities, 25 trades, 0 inferred organizations
- Legacy reconciliation: 114 app-state blobs unchanged
- Anonymous storage/readiness/app-state/v1 account requests: 401
- Disposable Tradesperson signup, `/api/v1/me`, object upload/download, and logout passed; all smoke records and objects were deleted

## Packet 01 Acceptance

Packet 01 is accepted. The old object-storage bucket remains temporarily as a rollback source and should be deleted only after the isolated restore drill and retention decision.

## Packet 02 Implemented

- Added migration `0003_auth_onboarding_profiles` for verification/recovery challenges, OAuth transactions, profile ownership, resumable onboarding, and device/session controls.
- Added single-use, hashed email-verification and password-recovery tokens with expiry, replay protection, resend replacement, and session revocation after password reset.
- Added Google OIDC state, nonce, PKCE, JWKS signature validation, and safe identity linking.
- Added canonical `/api/v1/me`, profile, onboarding, and session/device APIs with server-authoritative role and ownership checks.
- Added role-correct onboarding, profile editing, email verification/recovery, and session management to the frontend without restoring browser-owned account state.
- Added a Resend email adapter, pilot invitation controls, production security configuration checks, and invitation CLI.
- Preserved the Packet 02 stop condition: no job or messaging persistence was added.

## Packet 02 Verification

- Local `npm run lint`, `npm run build`, `npm run test`, and `npm run test:e2e`: pass.
- Local PostgreSQL-backed tests skip when `TEST_DATABASE_URL` is absent by design.
- GitHub Actions Gate A run `27807673862` for accepted source commit `d417908`: pass.
- CI evidence includes PostgreSQL 16 migration lifecycle, account lifecycle/onboarding, cross-user authorization, browser fail-closed behavior, production bundle, full lint, and production dependency audit.
- Railway's first release attempt (`7a072390-c2c9-4a5a-89f1-5ecaeda29602`) failed before traffic moved because the production install omitted React type packages needed by the build. Commit `696a332` corrected their dependency classification; the complete local gate passed again before redeployment.

## Packet 02 Production Evidence

- Release commit: `696a332ee55355f49a43960b9962be2cc37c966c`
- Railway deployment: `2fe13f14-4852-48cd-bd19-c33f64ccc96a` (success)
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy
- Migration status: `0003_auth_onboarding_profiles`, three applied migrations, zero pending
- Resend sender domain: `rivt.pro` verified with DKIM and the `send.rivt.pro` SPF/MX return path; DMARC published at monitoring policy
- Railway email provider: sending-only production key restricted to `rivt.pro`; direct delivery and application verification/recovery messages delivered
- `/api/auth/providers`: Google, email, and session security configured; pilot invitations required; Facebook and Apple remain explicitly unavailable
- Live acceptance: invite-gated signup, email verification, canonical onboarding, profile update/publish, two-session revocation, logout, password recovery/reset, and Google authorization handoff passed
- Cleanup: two disposable accounts were closed and anonymized, three disposable invites were revoked, profiles were made private, sessions were revoked, and append-only audit history was preserved

## Packet 02 Acceptance

Packet 02 is accepted in production. The account journey, canonical profiles, provider configuration, and live release checks are complete for this packet. Facebook and Apple are not presented as available providers and remain deferred until their credentials and acceptance checks exist.

## Packet 03 Implemented Locally

- Added migration `0004_jobs_discovery` for canonical contractor-owned jobs, public job areas, private exact addresses, normalized requirements, and append-only job status events.
- Added typed job domain validation, publish-readiness checks, deterministic match scoring, server-side filtering, private-address-safe mapping, and lifecycle transition rules.
- Added `/api/v1/jobs` create/list/detail/update/publish/pause/resume/close APIs with authenticated actor context, organization owner/admin authorization, idempotency-key replay, optimistic version checks, daily job/publish limits, status events, and audit events.
- Migrated the Work UI from local job posting to the typed jobs API with progressive draft save, edit, publish, pause, resume, close, loading, empty, error, retry, filter, detail, and private-address owner states.
- Removed current seeded jobs, seeded talent, and fake review counts from `src/data.ts`; Work/Crew now use real empty states instead of fabricated people or jobs.
- Corrected the primary shell to Home, Work, Crew, Shop Talk, Tools, with search, messages, notifications, and profile in the top bar.
- Added job lifecycle unit tests, PostgreSQL-backed job integration tests, migration lifecycle coverage for migration 0004, and desktop/mobile Work shell E2E coverage.
- Preserved the Packet 03 stop condition: applications/offers/mutual hiring were not implemented.

## Packet 03 Local Verification

Run on 2026-06-19 from `codex/packet-03-jobs-discovery`:

- `npm.cmd run lint`: pass.
- `npm.cmd run lint:security`: pass.
- `npm.cmd run test`: pass; 18 unit tests pass, 3 non-DB integration tests pass, and 4 PostgreSQL integration tests skip locally because `TEST_DATABASE_URL` is not configured.
- `npm.cmd run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile Work acceptance pass.
- `npm.cmd run build`: pass; Vite builds 1,762 modules.
- `npm.cmd audit --omit=dev`: pass; zero vulnerabilities.

## Packet 03 Pending Evidence

- Disposable PostgreSQL CI must run the new migration/job integration tests before acceptance.
- Packet 03 has not been deployed to Railway yet.
- Live `/api/health`, migration readiness, draft/publish/pause/resume/close smoke, tradesperson discovery smoke, and private-address non-leak smoke remain required before marking Packet 03 production-accepted.

## Next Exact Task

Commit and push Packet 03, wait for GitHub Actions disposable-PostgreSQL evidence, then deploy to Railway and run the Packet 03 live smoke. If accepted, begin Packet 04 applications/offers/active work without reintroducing frontend-only job state.

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
