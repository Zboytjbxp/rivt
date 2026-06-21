# RIVT Build State

Last updated: 2026-06-21 America/New_York
Current gate: Gate A launch hardening
Current phase: Packet 08 controllable UX hardening, Trade News polish, production UI smoke regression fixes, and Tools studio release verified; full Gate A approval remains blocked
Active packet: `docs/delivery/packets/08_GATE_A_HARDENING.md`
Repository branch: `master`
Production release commit: `24c37ac7dfc086903c688ec64df684f42e35db6b`

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

## Packet 03 Production Evidence

- Source commit: `4a3a7215b09a8cfe224405f7b274bc10c8f7ac31`
- Railway deployment: `61142204-fa92-4c44-a798-27c99932266b` (success)
- GitHub Actions disposable PostgreSQL run `27859431951`: pass for Packet 03 source before merge; merged source was deployed after the signup-policy/UI patches.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production readiness: `0004_jobs_discovery`, four applied migrations, zero pending.
- Live smoke `packet03-20260620052132-4ef6a7`: disposable contractor, second contractor, and tradesperson signup/onboarding passed; incomplete publish failed safely; authorized draft/update/publish/pause/resume/close passed; unauthorized mutation returned 403; idempotent publish replay was detected; tradesperson discovery returned the open job without private address; paused/closed jobs were hidden from tradesperson; owner detail included private address; disposable accounts were closed.

## Packet 03 Acceptance

Packet 03 is accepted in production for jobs and discovery. Applications, offers, mutual acceptance, project records, messaging, reviews, and admin operations remain later packets and must not be represented as production-ready.

## Packet 04 Implemented Locally

- Added migration `0005_match_acceptance` for account blocks, applications, application timelines, offers, offer timelines, active work, participants, and active-work status timelines.
- Added typed match/acceptance validation and response mapping in `server/matches.js`.
- Added `/api/v1/jobs/:id/application-draft`, `/api/v1/jobs/:id/applications`, `/api/v1/applications`, `/api/v1/applications/:id/withdraw`, `/api/v1/jobs/:id/applications`, `/api/v1/applications/:id/shortlist`, `/api/v1/applications/:id/decline`, `/api/v1/applications/:id/offer`, `/api/v1/offers`, `/api/v1/offers/:id/accept`, `/api/v1/offers/:id/decline`, `/api/v1/active-work`, `/api/v1/active-work/:id/reschedule`, and `/api/v1/active-work/:id/cancel`.
- Added server-side protections for active account role, organization owner/admin applicant review, one application per job/applicant, one active offer per job, blocked-account interactions, wrong-recipient offer acceptance, stale/closed jobs, idempotent mutations, and exactly-one active-work creation.
- Changed job detail authorization so exact private address remains hidden from browsing tradespeople but is visible to the accepted active-work participant.
- Added a compact Work detail hiring panel: tradespeople can save draft/apply/withdraw and accept/decline offers; contractors can review applicants, shortlist, decline, and send offers; accepted work shows active-work events and cancel/reschedule actions.
- Added PostgreSQL-backed Packet 04 integration coverage for blocked applications, duplicate applications, applicant privacy, wrong-recipient acceptance, double acceptance, address release before/after acceptance, participant creation, and timelines.
- Preserved the Packet 04 stop condition: persistent messaging was not added.

## Packet 04 Local Verification

Run on 2026-06-20 from `master`:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run test`: pass; 18 unit tests pass, non-DB integration tests pass, and DB-backed integration tests including Packet 04 skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile checks pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.

## Packet 04 Production Evidence

- Source commit: `0ccf88c3ade7511d6d3ad53fc2911cec90648810`
- Railway deployment: `04b7e269-f103-4bbe-88cf-6ef82161b6bc` (success); initial source upload was `bef21475-e9f7-46f6-af2e-71a040a4b8d5`, followed by a metadata redeploy after `SOURCE_COMMIT` was updated.
- GitHub Actions Gate A Safety run `27862175954`: pass for Packet 04 source.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production migration status: `0005_match_acceptance`, five applied migrations, zero pending.
- Live smoke `packet04-20260620061146-411fdf`: disposable contractor, tradesperson, and second tradesperson signup/onboarding passed; readiness confirmed migration 0005; tradesperson application passed; duplicate application returned 409; non-owner applicant list returned 403; contractor applicant review passed; contractor sent offer; wrong-recipient acceptance returned 403; recipient acceptance created exactly one active-work record with two participants; double acceptance returned the same active-work record; private address was hidden before acceptance and revealed to the accepted tradesperson after acceptance; unrelated tradesperson could not view the closed accepted job; active-work reschedule/cancel timeline events passed; disposable accounts were closed.
- Added reusable live-smoke command: `npm run smoke:match:live`.

## Packet 04 Acceptance

Packet 04 is accepted in production for applications, offers, mutual acceptance, active-work participants, accepted-address release, and active-work cancel/reschedule events. Persistent messaging, notifications, project records, completion, reviews, and admin operations remain later packets and must not be represented as production-ready.

## Packet 05 Implemented Locally

- Added migration `0006_messaging_notifications` for conversations, conversation participants, durable messages, message receipts, attachment metadata, in-app notifications, notification preferences, and conversation reports.
- Added typed messaging/notification validation and response mapping in `server/messaging.js`.
- Added `/api/v1/active-work/:id/conversation`, `/api/v1/conversations`, `/api/v1/conversations/:id/messages`, `/api/v1/conversations/:id/read`, `/api/v1/conversations/:id/mute`, `/api/v1/conversations/:id/report`, `/api/v1/accounts/:id/block`, `/api/v1/accounts/:id/unblock`, `/api/v1/notifications`, `/api/v1/notifications/read`, and notification preference APIs.
- Created conversations only from accepted active-work relationships and enforced participant-only read/send behavior.
- Added idempotent message send, per-participant receipts/read state, server notifications for offers/accepted work/work transitions/messages, and mute suppression.
- Added server-backed Inbox UI and top-bar notification activity mapping; old local sent-message behavior is no longer used by the Messages route.
- Added message attachment metadata with `pending_authorization` status as the Packet 06 media authorization handoff.
- Added PostgreSQL-backed Packet 05 integration coverage and reusable production smoke command `npm run smoke:messaging:live`.
- Preserved the Packet 05 stop condition: no project albums, external SMS channels, or frontend-only notification success were added.

## Packet 05 Local Verification

Run on 2026-06-20 from `master`:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run lint:security`: pass.
- `npm run test`: pass; 18 unit tests pass, non-DB integration tests pass, and DB-backed integration tests including Packet 05 skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile checks pass with Packet 05 inbox endpoints mocked.
- `npm audit --omit=dev`: pass; zero vulnerabilities.

## Packet 05 Production Evidence

- Source commit: `338ce7f7ec921fbcfafe20b4f9b96ecbf3053224`
- Railway deployment: `16fb271d-9dc0-4d85-9a55-4765acb07f43` (success)
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Anonymous `/api/storage` and `/api/readiness`: 401, preserving authenticated diagnostics.
- Live smoke `packet05-20260620123233-891897`: disposable contractor, tradesperson, and outsider signup/onboarding passed; readiness confirmed migration `0006_messaging_notifications`; accepted active work opened one conversation; outsider conversation list was empty and direct message access returned 404; message send was idempotent; unread count survived contractor relogin; notifications excluded private address details; conversation read cleared unread state; notification read-all passed; mute suppressed a second message notification; report creation passed; block enforcement returned `ACCOUNT_BLOCKED`; two messages and one report persisted; disposable smoke accounts were closed.
- Dedicated reusable production test accounts were created for future manual/smoke checks: one contractor account and one tradesperson account, both email-verified, active, onboarded, and profile-published.
- Added reusable live-smoke command: `npm run smoke:messaging:live`.

## Packet 05 Acceptance

Packet 05 is accepted in production for accepted-work conversations, durable messages, unread/read state, in-app notifications, mute, report, block enforcement, and private-address-safe notification content. Project records, completion evidence, reviews, support/admin, and full launch hardening remain later packets and must not be represented as production-ready.

## Packet 06 Implemented Locally

- Added migration `0007_project_completion` for projects, immutable project entries, authorized project media, completion submissions, and completion resolutions.
- Extended uploads with authenticated account ownership, active-work linkage, project upload status, content SHA-256, storage scope, failure reason, and verification timestamp.
- Added typed project validation/mapping and content-signature checks in `server/projects.js`.
- Added participant-scoped `/api/v1/active-work/:id/project`, `/api/v1/projects/:id`, note, media, media signed-url, completion submit, confirm, dispute, and report APIs.
- Bound all project access through accepted `work_participants`; unrelated authenticated accounts receive 404.
- Added idempotent project opening, notes, media upload/rejection, completion submission, and completion resolution.
- Added malformed-file rejection with durable rejected status; valid project media requires managed object storage and private signed access.
- Added Records mode in Tools with server-backed accepted-work records, note upload, evidence upload, completion submit, confirm/dispute, and report preview.
- Added Packet 06 integration coverage and reusable production smoke command `npm run smoke:projects:live`.
- Preserved the Packet 06 stop condition: no public share links, advanced annotations, or CompanyCam-scale media features were added.

## Packet 06 Local Verification

Run on 2026-06-20 from `master`:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run lint:security`: pass.
- `npm run test`: pass; 18 unit tests pass, non-DB integration tests pass, and DB-backed integration tests including Packet 06 skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile checks pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.

## Packet 06 Production Evidence

- Source commit: `993be3899f8eb996229be90cf423cf58e5e27c76`
- Railway deployment: initial application deploy `4da1b9b0-9afd-4af9-a088-c244a466a761`, followed by metadata deploy `67562c06-40d4-4923-bd82-52b169a0d45e` after updating `SOURCE_COMMIT`.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production migration status: `0007_project_completion`, seven applied migrations, zero pending, verified during live smoke readiness.
- Live smoke `packet06-20260620132532-bdf04b`: disposable contractor, tradesperson, and outsider signup/onboarding passed; readiness confirmed migration `0007_project_completion`; accepted work opened a private project record; outsider project and media URL access returned 404; note idempotency replayed; malformed PNG upload was rejected and idempotent; text evidence uploaded to managed storage; contractor received a media signed-url response; tradesperson submitted completion with evidence; contractor confirmed completion; closeout report matched after relogin and excluded private address; a second project completion was disputed with reason; persisted smoke evidence counted 9 entries, 2 media rows, and 2 resolutions; disposable accounts were closed and the smoke object was deleted from object storage.

## Packet 06 Acceptance

Packet 06 is accepted in production for private accepted-work project records, authorized media evidence, content-signature rejection, notes, completion submission, contractor confirmation/dispute, and reproducible closeout reports. Reviews, admin/support, safety moderation, and final launch hardening remain later packets and must not be represented as production-ready.

## Packet 07 Implemented

- Added migration `0008_reviews_admin_safety` for participant reviews, review events, safety reports, unsafe-work reports, support cases/events, admin role grants, admin action events, and account restrictions/events.
- Added `actor_account_id` to consent acceptances and expanded consent contexts for review submission and stop-work acknowledgement.
- Added typed review/safety/support/admin schemas and mappers in `server/reviews-safety.js`.
- Added participant-only review submission for completed active work, one-review-per-reviewee/work uniqueness, pending approval, dispute, response, admin resolve/hide, and reputation count/average APIs.
- Added report and unsafe/stop-work APIs with participant/relationship authorization, stop-work contextual consent, no-fault unsafe-work records, notifications, and append-only event history.
- Added support-case APIs that remain available to suspended/restricted accounts while regular mutating APIs fail closed.
- Added least-privilege admin API authorization through `admin_role_grants`, admin-only overview/review/support/restriction mutations, and immutable `admin_action_events` requiring actor, reason, subject, and timestamp.
- Hardened block behavior so blocked accounts cannot use job discovery/detail/profile reputation/application routes as alternate contact paths.
- Replaced the normal-user Admin route with a staff-access boundary notice and removed visible overclaims around verified profiles and safety certifications in current shell copy.
- Added Packet 07 integration coverage and reusable live smoke command `npm run smoke:reviews:live`.
- Preserved the Packet 07 stop condition: no public Shop Talk moderation or automated verification-provider claims were added.

## Packet 07 Local Verification

Run on 2026-06-20 from `master`:

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run test`: pass; 18 unit tests pass, non-DB integration tests pass, and DB-backed integration tests including Packet 07 skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass; fail-closed auth and jobs/discovery desktop/mobile checks pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.
- `npm run lint:security`: pass.

The first production smoke attempt on deployment `0f708552-8598-4a04-8f45-0126262efce8` caught an onboarding regression: the new mutation-restriction guard blocked pending accounts from completing onboarding. Commit `01bf1adfedef03ee7ecd7c408d2bab6cbde654fe` fixed the guard so `/api/v1/onboarding/complete` remains available to pending accounts while normal mutating routes still fail closed for inactive or restricted accounts. The full local gate passed again before redeploy.

## Packet 07 Production Evidence

- Source commit: `01bf1adfedef03ee7ecd7c408d2bab6cbde654fe`
- Railway deployment: application deploy `698ce001-b5b2-42c6-9967-9c89e30afe68`, followed by metadata redeploy `b3c91226-d60b-407f-a93e-1e289cbdc968` after updating `SOURCE_COMMIT`.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production migration status: `0008_reviews_admin_safety`, eight applied migrations, zero pending, verified during live smoke readiness.
- Live smoke `packet07-20260620143318-94c6bd`: disposable contractor, tradesperson, outsider, and admin signup/onboarding passed; normal user admin overview returned 403; readiness confirmed migration `0008_reviews_admin_safety`; completed active work accepted one review and rejected duplicate/ineligible reviews; review dispute, response, admin resolve, and reputation count passed; unsafe stop-work report and safety report persisted; block enforcement hid job detail/list and reputation paths; admin suspension blocked normal mutations while support remained available; admin support assist and restriction lift passed; immutable admin-action evidence counted 4 actions; disposable accounts and smoke records were closed.

## Packet 07 Acceptance

Packet 07 is accepted in production for participant reviews, review disputes/resolution, reputation counts, safety reports, unsafe stop-work reports, support cases, least-privilege admin access, account restrictions, admin action events, and extended block enforcement. Gate A launch hardening, restore drill evidence, distributed limits, monitoring/alerts, and final ops checklist remain before first-user launch.

## Packet 08 Hardening Slice Implemented

- Added structured JSON request/domain logging with request IDs, method/path/status/duration, actor ID when authenticated, and safe error fields.
- Added operational controls for `RIVT_SIGNUPS_DISABLED` / `SIGNUPS_DISABLED`, `RIVT_MUTATIONS_DISABLED` / `PLATFORM_MUTATIONS_DISABLED`, and optional `RIVT_CONTROL_REASON`.
- Exposed control state through authenticated readiness and auth-provider status without exposing secrets.
- Preserved support/admin access during platform mutation lockout so restricted users can still reach support and staff can operate incidents.
- Added reusable production hardening audit command `npm run smoke:gate-a:live` for exact source commit, migration status, anonymous fail-closed routes, provider status, operational controls, and user-facing seed/demo sweeps.
- Added guarded cleanup command `npm run cleanup:gate-a:demo` that requires `CONFIRM_GATE_A_DEMO_CLEANUP=true`, preserves records, makes matching test profiles private, closes matching smoke organizations/jobs, and hides matching public reviews instead of deleting data.
- Executed the cleanup in production after the first hardening audit surfaced user-facing test artifacts.
- Added migration `0009_durable_rate_limits` with a shared PostgreSQL `rate_limit_windows` table and rollback.
- Replaced process-local auth/write/upload throttles with PostgreSQL-backed durable limit buckets keyed by privacy-safe subject hashes.
- Updated live hardening audit to require migration 0009 and the durable rate-limit table.

## Packet 08 Verification

Run on 2026-06-20 from `master`:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run lint:security`: pass.
- `npm run test`: pass; unit and non-DB integration coverage pass, while DB-backed local integration tests skip because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.
- `node --check server/security.js`, `node --check server/index.js`, and `node --check scripts/live-gate-a-hardening.js`: pass.
- `node --test test/security.test.js`: pass, including durable limiter header/block behavior.

Local restore tooling remains unavailable on this workstation (`docker`, `psql`, and `pg_dump` are not installed), so the timed isolated restore drill cannot be closed from the current local environment.

## Packet 08 Production Evidence

- Source commit: `bf42ee6a51dc91ddeb4c2451ee2434e0548d8615`
- Railway deployment: application deploy `14ae3c42-c5c0-4bfb-a873-b496a51c6877`, followed by metadata redeploy `300918e1-5ed5-44f3-8bbb-e2c289c5f97a` after updating `SOURCE_COMMIT`.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Production migration status: `0009_durable_rate_limits`, nine applied migrations, zero pending.
- First live hardening audit on the Packet 08 code correctly failed because two published test network profiles and twelve active smoke organizations remained visible.
- Production cleanup made two `RIVT * Test` profiles private and closed twelve Packet 03-07 smoke organizations; no records were deleted.
- Final live hardening audit passed with exact source `bf42ee6a51dc91ddeb4c2451ee2434e0548d8615`, migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, and counts of 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 legacy app-state rows, and 0 rate-limit windows before traffic.

## Packet 08 Legacy Bridge Retirement

Implemented and deployed on 2026-06-20:

- Retired authenticated `/api/app-state` read/write calls with `410 LEGACY_APP_STATE_RETIRED`.
- Retired authenticated `/api/events` generic event writes with `410 LEGACY_EVENTS_RETIRED`.
- Retired `/api/payments/export.csv` because it depended on legacy app-state payment rows that are not canonical payment records.
- Removed the frontend app-state hydration/save loop and removed the obsolete E2E app-state stub.
- Kept authorized managed upload routes in place because profile/project media storage is a separate managed-storage path, not app-state authority.
- Updated database-backed authorization coverage to assert the legacy bridge no longer creates app-state rows for authenticated accounts.

Local verification for this slice:

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run test`: pass; DB-backed suites skipped locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.
- `npm run lint:security`: pass.

Production evidence:

- Source commit: `00147c8e3f70e246b41ed48b46550ae33cf0eb54`
- Railway deployment: application deploy `dd46b5e2-916a-47be-9dde-36cb0c8d9ed6`, followed by metadata redeploy `f2170045-3df8-498e-b29e-fc733cc18b9f` after updating `SOURCE_COMMIT`.
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Live hardening audit executed inside the Railway service with private network access: exact source `00147c8e3f70e246b41ed48b46550ae33cf0eb54`, migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, and counts of 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 0 rate-limit windows before traffic.

## Packet 08 Gate Status

The Packet 08 hardening, durable-rate-limit, and legacy-bridge retirement slices are deployed and accepted as evidence. Full Gate A approval is rejected until the remaining launch blockers are closed: timed isolated restore drill, external monitoring/alerts and incident routing, support/legal/founder signoff, and manual accessibility/device matrix.

## Packet 08 Manual Device/Accessibility Matrix Progress

Started on 2026-06-20 against `https://rivt.pro/`.

- Live health reports source commit `7fc6f65b1dad7af803547293cae199135908c5cd` after deployment `255d59f0-ecdf-4c0d-ac36-583045b767a8`.
- Codex in-app Browser smoke covered the public auth/marketing shell at 1280x720, 390x844, and 360x800.
- The public shell loaded with the expected RIVT title, no console warnings/errors, and no horizontal overflow on tested breakpoints.
- Invalid email/password remained signed out with the generic `Invalid email or password.` message.
- The provided test account did not authenticate, so no new production user was created and the authenticated route/device matrix remains blocked.
- A touch-target issue was fixed and deployed by raising auth input minimum height from 42px to 46px; post-deploy mobile verification measured 46px fields at 390x844.
- Evidence is recorded in `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md`.

Local verification for this slice:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run lint:security`: pass.
- `npm run test`: pass; DB-backed integration tests skip locally because `TEST_DATABASE_URL` is not configured.
- `npm run test:e2e`: pass.
- `npm audit --omit=dev`: pass; zero vulnerabilities.

## Packet 08 Authenticated Accessibility Smoke Progress

Deployed on 2026-06-20:

- Source commit: `f5a68d9c16364c94dd727bb91e03a25f33e283df`
- Railway deployment: `b241d02b-04bf-42d8-a462-243d06f4ab4a`
- `https://rivt.pro/api/health`: 200, source commit matched the release, PostgreSQL and S3-compatible storage healthy.
- Authenticated UI smoke `ui-a11y-20260621005817-8a87eb` created disposable contractor and tradesperson accounts, tested contractor mobile, tradesperson mobile, and contractor desktop shells, then closed both accounts.
- Tested shells had top-bar search, messages, notifications, and profile controls; no role toggle; no More tab; no horizontal overflow; `consoleWarningsOrErrors: 0`; and `smallTargetCount: 0` on all tested viewports. The smoke uses reduced-motion browser preference and now fails on missing top-bar controls, post-login console warnings/errors, sub-44px controls, unnamed keyboard focus targets, or keyboard focus not reaching search/primary navigation.
- Live hardening audit passed after deployment with exact source `f5a68d9c16364c94dd727bb91e03a25f33e283df`, migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, and counts of 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 49 rate-limit windows.
- The authenticated UI smoke matrix was expanded in `scripts/live-ui-accessibility.js` to cover 360x800 phone, 390x844 phone, 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and a 390x844 200% text-scale scenario. It was rerun against production on 2026-06-21 as `ui-a11y-20260621043529-3efa9b`; evidence is recorded in `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md`.

## Packet 08 Synthetic Monitoring Progress

Implemented on 2026-06-20:

- Added `scripts/production-synthetic-monitor.js` and `npm run monitor:production`.
- Added `.github/workflows/production-synthetic.yml` to run the public production synthetic check every 30 minutes and on manual dispatch.
- The monitor verifies public health, deployed source presence, managed PostgreSQL/S3-compatible dependency status, invite-gated email/password provider configuration, operational-control state, and seven anonymous private-route 401 boundaries.
- Hardened the scheduled workflow so it installs dependencies from `package-lock.json`, uploads `production-monitor.log` evidence on every run, opens or updates one GitHub issue titled `Production synthetic check failing` when checks fail, and comments/closes that issue when production recovers.
- Latest local run against `https://rivt.pro` passed with source `f5a68d9c16364c94dd727bb91e03a25f33e283df`, operational controls disabled, seven anonymous private checks, and a 606 ms duration.
- This is partial monitoring progress only. Dedicated error monitoring, alert routing, paging destination, named incident owner, and rehearsal remain launch blockers.

## Packet 08 Incident Readiness Tooling Progress

Implemented on 2026-06-20:

- Added `docs/operations/incident-routing.json` as the machine-readable incident owner, support-hours, alert-destination, rehearsal, and approval source.
- Added `scripts/incident-readiness-check.js` and `npm run incident:readiness`.
- Added unit coverage proving incident readiness passes only with owners, support hours, synthetic monitoring, error monitoring, paging, recent rehearsal, and founder/support/legal-safety approvals.
- Updated the production synthetic GitHub issue workflow so a failing monitor issue includes incident-routing context: primary owner, backup owner, dedicated error-monitoring status, and paging status.
- Current readiness output is blocked, with primary owner recorded as Michael at `support@rivt.pro`, synthetic monitoring configured, and these missing blockers: backup owner, founder-approved support hours, dedicated error monitoring, paging route, incident rehearsal, founder approval, support approval, and legal/safety approval.

## Packet 08 Restore Drill Tooling Progress

Implemented on 2026-06-20:

- Added `scripts/restore-drill.js` and `npm run restore:drill`.
- Added `scripts/restore-logical-copy.js` and `npm run restore:logical-copy` to create a verified restored target through the application runtime when local `pg_dump`/`psql` tooling is unavailable.
- Added `scripts/logical-backup-utils.js`, `scripts/create-logical-backup-artifact.js`, and `scripts/restore-logical-backup-artifact.js`.
- Added `npm run backup:logical-artifact` to create an AES-256-GCM encrypted gzip logical backup object in private S3-compatible storage, with a manifest containing source commit, table counts, row counts, and object key evidence.
- Added `npm run restore:logical-artifact` to restore a named backup object into an isolated target, apply migrations when requested, verify table/column parity, restore sequences, and fail on count drift from the backup manifest by default.
- The verifier requires `CONFIRM_RESTORE_TARGET_ISOLATED=true` and `RESTORE_DATABASE_URL`; it refuses to run without an isolated target.
- The verifier checks migration status, requires migration `0009_durable_rate_limits`, verifies critical Gate A table presence, counts rows, can compare source/target counts with `RESTORE_SOURCE_DATABASE_URL`, and reports duration.
- A no-target artifact restore run correctly fails cleanly with `RESTORE_DATABASE_URL is required`.
- Unit coverage now verifies backup encryption/decryption, dependency ordering, count-diff reporting, and restore source/target identity refusal.

Timed isolated logical restore executed on 2026-06-20:

- Temporary Railway PostgreSQL target: `Postgres-3Ei3` (`fe501310-25bb-4389-a2fb-1a11dc89772c`, deployment `f034530e-2aa3-46d3-a83b-ea3b11df9f30`), deleted after verification.
- Production runtime source: `e0ac24d143c29f1f17c6570debbd576f49538597`, current Railway deployment `0d3f94b0-f586-446f-808b-9078c9a40f65`.
- `npm run restore:logical-copy -- --apply-migrations` ran inside the Railway RIVT service with explicit one-command restore env vars, applied migrations to the isolated target, copied 59 public tables and 1,524 rows, restored sequence positions, and completed in 1,421 ms.
- `npm run restore:drill` then verified the isolated target with strict source/target row-count parity, migration `0009_durable_rate_limits`, nine applied migrations, zero pending migrations, zero count diffs across critical Gate A tables, and a 220 ms verifier duration.
- Cleanup: the temporary target database was deleted, no temporary restore variables remain on RIVT or Postgres, and production health remained healthy on commit `e0ac24d143c29f1f17c6570debbd576f49538597`.
- This closes the timed isolated logical restore evidence gap. It does not by itself prove restoration from a specific backup artifact or define the final RPO/RTO policy.

Backup-artifact restore tooling progress on 2026-06-20:

- Local `npm run test:unit` passed with 23 tests, including the new logical backup utility tests.
- Local `npm run lint:security` passed with the new backup artifact scripts included.
- Temporary restore-control variables (`RESTORE_DATABASE_URL`, `RESTORE_SOURCE_DATABASE_URL`, and `CONFIRM_RESTORE_TARGET_ISOLATED`) were found on the RIVT service and removed. Remaining key-name check showed only persistent backup/storage names: `BACKUP_ENCRYPTION_KEY`, `DATABASE_URL`, `S3_*`, and `SOURCE_COMMIT`.
- Attempting to provision a fresh temporary Railway PostgreSQL target for the named-artifact restore rehearsal failed because the Railway CLI session is expired (`Unauthorized. Please run railway login again.`). No backup artifact was created and no restore target remains from this attempt.

## Packet 08 Backup Artifact Restore and Expanded UI Matrix Evidence

Completed on 2026-06-21 after Railway re-authentication:

- Deployed current source to production and verified `https://rivt.pro/api/health` reported exact source `67094c9853a8f4be2be01ffe30376b669afe6cde` with PostgreSQL and S3-compatible storage healthy.
- Created a current named encrypted backup artifact from production with `npm run backup:logical-artifact`: object `backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm`, source commit `332dbc05e1978976d31395a6e482911e34931251`, 59 tables, 1,524 rows, 630 ms creation duration.
- Restored that named object into isolated Railway PostgreSQL service `Postgres-_FQz`, applied nine migrations through `0009_durable_rate_limits`, restored 59 tables and 1,524 rows, verified table/column/sequence and strict manifest-count parity with zero diffs, and completed restore verification in 13,411 ms.
- Ran `npm run restore:drill` against the isolated restored target: migration `0009_durable_rate_limits`, nine applied migrations, zero pending migrations, zero count diffs, and 1,862 ms verifier duration.
- Deleted temporary restore service `Postgres-_FQz` and marked detached restore volumes `postgres-volume-FH_H` and `postgres-volume-M1Ll` for deletion. No temporary `RESTORE_*` or `CONFIRM_*` variables remain on the RIVT service, and a leftover `RESTORE_DATABASE_URL` variable was removed from the production Postgres service.
- `npm run monitor:production` passed on deployed commit `67094c9853a8f4be2be01ffe30376b669afe6cde` with seven anonymous private-route checks and managed PostgreSQL/S3-compatible dependencies healthy.
- `npm run smoke:gate-a:live` passed on deployed commit `67094c9853a8f4be2be01ffe30376b669afe6cde` with migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 64 rate-limit windows.
- Expanded authenticated UI smoke `ui-a11y-20260621043529-3efa9b` created disposable contractor and tradesperson accounts, tested 360x800 phone, 390x844 phone, 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and a 390x844 200% text-scale scenario, then closed both accounts. All scenarios reported top-bar search/messages/notifications/profile present, reduced-motion enabled, keyboard focus reaching named top-bar and primary navigation targets, `consoleWarningsOrErrors: 0`, and `smallTargetCount: 0`.
- The expanded UI smoke caught a real 360px Crew overflow in the V2 network shell. Two CSS fixes were deployed (`d7129b4` and `67094c9`) to force mobile network children and metric cards to shrink without off-screen bleed; the final smoke passed after those fixes.
- Required local gates passed after the production fix: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.
- `npm run incident:readiness -- --json` remains blocked by missing backup owner, support hours, dedicated error monitoring, paging route, incident rehearsal, and founder/support/legal-safety approvals.

## Packet 08 Launch Operations Readiness Progress

Implemented on 2026-06-21:

- Added `docs/operations/recovery-policy.json` as the machine-readable RPO/RTO, backup-retention, restore-cadence, latest named artifact restore, and recovery-approval source.
- Added `scripts/launch-readiness-check.js`, `npm run launch:readiness`, and unit coverage in `test/launch-readiness.test.js`.
- Added `docs/operations/LAUNCH_OPS_CHECKLIST.md` so the final go/no-go checklist is explicit across incident ownership, restore policy, support, providers, accessibility, and pilot cohort controls.
- Added `docs/operations/INCIDENT_REHEARSAL_RUNBOOK.md` with public-health, storage, and abuse/safety rehearsal scenarios plus an evidence template.
- Updated `docs/operations/RUNBOOKS.md` so it no longer describes the named backup-artifact restore as incomplete and now documents the launch readiness gate.
- `npm run launch:readiness -- --json` currently blocks with the expected non-code findings: incident routing not approved, backup owner missing, support hours missing, dedicated error monitoring missing, paging missing, incident rehearsal missing, incident approvals missing, recovery policy not approved, RPO/RTO missing, backup retention missing, restore cadence missing, next restore drill missing, and recovery approvals missing. It does recognize the recent named backup-artifact restore as current evidence.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.

## Packet 08 Controllable UI Smoke Coverage Progress

Implemented on 2026-06-21 after deciding to keep external Gate A finish blockers noted and move to controllable work:

- Hardened `scripts/live-ui-accessibility.js` so authenticated smoke now opens the top-bar search dialog, notifications panel, profile/account panel, and messages/inbox route, then applies the same title, overflow, unnamed-control, tap-target, top-bar-signal, and console-warning/error checks to those opened surfaces.
- Hardened `test/jobs-discovery.e2e.mjs` with mocked API coverage that opens top-bar search, notifications, account/profile, and messages/inbox across desktop and mobile viewports. The test also mocks `/api/v1/sessions` so the account panel can open without leaking to an unmocked local API.
- `npm run test:e2e` passed after the new top-bar interaction checks.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.

## Packet 08 Trade News and Shop Talk Polish Progress

Implemented on 2026-06-21 as controllable UX hardening:

- Replaced the Trade News Google favicon fallback with topic-aware RIVT-owned thumbnail assets in `public/news/` so cards render reliable editorial imagery for safety, code, HVAC, workforce, licensing, permitting, and general trade briefs.
- Added a curated contractor-relevant news layer ahead of live RSS aggregation in `/api/news`, with original-source links for OSHA heat inspection emphasis, NFPA 2026 NEC changes, EPA/R-410A HVAC timing, ABC workforce shortage signals, Florida DBPR renewal context, and Jacksonville permitting context.
- Kept live feed aggregation behind the curated items, filtered obvious consumer/homeowner drift out of the live tail, and changed its no-media fallback to RIVT topic thumbnails instead of `google.com/s2/favicons`.
- Reworked the Trade News card layout with larger readable headlines, summary previews, date/source separation, original-source links, non-cropped thumbnails, and cleaner selected/detail states.
- Reworked the Trade News detail hero on mobile so metadata no longer collides with the thumbnail artwork.
- Rendered QA with a mocked authenticated account while letting `/api/news` hit the real local API at `127.0.0.1:8787`: desktop `1280x800` and mobile `390x844` both showed curated cards, no Google favicon thumbnails, working original-source URLs, detail hero images, and zero console errors. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-trade-news-desktop.png` and `C:\Users\zboyt\AppData\Local\Temp\rivt-trade-news-mobile.png`.
- Deployed the slice to Railway production as deployment `9c1a3184-1b5e-44dc-bcae-6b8cffc5fc7b` from commit `850337ff3c54f98405c58f74ac5feb39213f1bbd`.
- Live `https://rivt.pro/api/news` verification after deployment returned 21 items with `GoogleFavicons: 0`, `MissingThumbnails: 0`, `MissingUrls: 0`, and `HomeownerMentions: 0`; the first card used `/news/permit-watch.svg` and linked to the Jacksonville permitting source.
- A follow-up metadata redeploy set production `SOURCE_COMMIT` to the Trade News documentation commit `97cc5dd6d807a0a44a7eac2cb71c2a602e1ee8f9`; subsequent UI-smoke fix deployments preserved the same `/api/news` behavior.
- Final live `/api/news` verification on production source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1` returned 23 items with `GoogleFavicons: 0`, `MissingThumbnails: 0`, and `MissingUrls: 0`; the first curated item uses `/news/permit-watch.svg` and links to the Jacksonville permitting source.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.

## Packet 08 Production UI Smoke Regression Fixes

Completed on 2026-06-21 as controllable Gate A hardening:

- Because `railway run` from the local workstation cannot resolve Railway private DNS (`postgres.railway.internal`) and the Railway container does not include Playwright browser binaries, live authenticated UI smoke used a split run: production setup/cleanup inside Railway and browser-only verification from the local Playwright runtime against `https://rivt.pro`.
- Setup run `ui-a11y-20260621062332-02b380` created disposable contractor and tradesperson accounts through the production service. After final verification, cleanup closed both disposable accounts.
- The production smoke caught and fixed five real UI regressions:
  - Search dialog `Cancel` action measured 18px tall on a 360px phone; commit `3577f1f` raised the mobile search action target to the 44px floor.
  - Notification quick actions measured 38px tall; commit `b1768d8` raised those panel actions to the 44px floor.
  - Theme toggles measured 36-42px across account, sidebar, onboarding, and top-bar surfaces; commits `a76377f` and `8f13d9c` corrected the base and responsive overrides.
  - Inbox refresh/open/mark-read controls measured 18-38px; commit `30293e9` raised Inbox header, alert, composer, empty-state, and job-row actions to the 44px floor.
  - The search dialog overflowed horizontally at 200% root text scale on a 390px phone; commit `4fe22bc` constrained the search panel and input flex behavior.
- Final browser-only production smoke passed against `https://rivt.pro` after deployment `7fe1c3ea-d5f4-48c4-b757-a46ff8ebc369` and source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1`.
- Passed viewports: contractor and tradesperson 360x800 phones, contractor and tradesperson 390x844 phones, contractor 768x1024 tablet, contractor 1366x768 laptop, contractor 1440x900 desktop, and contractor 390x844 phone at 200% root text scale.
- Every scenario reported top-bar search/messages/notifications/profile present, reduced-motion enabled, keyboard focus reaching named top-bar and primary navigation targets, `consoleWarningsOrErrors: 0`, and `smallTargetCount: 0`.
- Post-fix production checks passed: `npm run monitor:production` reported exact source `4fe22bc6a3cbbd146ac286869562f4c3e968ece1`, PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, and seven anonymous private-route checks; `npm run smoke:gate-a:live` passed inside Railway with migration `0009_durable_rate_limits`, seven anonymous private-route checks returning 401, zero seed/demo findings, 3 active accounts, 0 public network profiles, 0 open jobs, 2 open support cases, 0 active restrictions, 115 quarantined legacy app-state rows, and 78 rate-limit windows.
- Required local gates passed after each runtime fix: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.

## Packet 08 Tools Studio Release

Completed on 2026-06-21 as controllable UX hardening after the founder asked to flesh out Tools while continuing Gate A:

- Rebuilt the visible Tools tab into a working utility studio instead of a launchpad with dead-end actions.
- Added standalone local/browser tools for Heavy 16th field calculations, estimate building, invoice drafting, and material takeoff.
- Kept Records server-backed and tied to accepted active work/project records; Records still opens from Tools but does not fabricate project or payment rows.
- Kept invoice drafting honest for Gate A: users can copy or download a draft, but the UI explicitly states that email/text delivery is not production-ready. No fake SMS, fake email delivery, fake payment processing, escrow, payroll, or 1099 behavior was added.
- Updated desktop/mobile E2E coverage so `/app/tools` opens every new tool surface and verifies the no-fake-delivery invoice note.
- Rendered local Tools QA with Playwright at 390x844 mobile and 1440x900 desktop, including hub, calculator, and invoice surfaces. The pass found no horizontal overflow and zero console errors. Screenshot evidence was saved outside the repo at `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-visual-qa`.
- Required local gates passed after this slice: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev`. DB-backed local integration tests still skip on this workstation because `TEST_DATABASE_URL` is intentionally absent.
- Deployed the runtime slice to Railway production as deployment `ac8d1f8d-ac13-424d-b1ba-a4dc0a0ebdde` from commit `24c37ac7dfc086903c688ec64df684f42e35db6b`.
- Live `https://rivt.pro/api/health` returned 200 with exact build commit `24c37ac7dfc086903c688ec64df684f42e35db6b`; `npm run monitor:production` passed with PostgreSQL/S3-compatible dependencies healthy, operational controls disabled, seven anonymous private-route checks, and 561 ms duration.
- `npm run smoke:gate-a:live` cannot run directly from this workstation because local execution lacks `DATABASE_URL`, and `railway run` from the workstation still cannot resolve Railway private DNS (`postgres.railway.internal`). This is the same known split-run limitation from the production UI smoke work, not a Tools-specific regression.

## Next Exact Task

Continue Gate A launch hardening with the remaining external and manual blockers: configure real dedicated error monitoring and paging/escalation, fill backup owner/support-hours/approval fields in `docs/operations/incident-routing.json`, approve RPO/RTO/retention/cadence fields in `docs/operations/recovery-policy.json`, run an incident rehearsal, then pass `npm run incident:readiness -- --require-ready` and `npm run launch:readiness -- --require-ready`. Complete the physical/deeper manual accessibility-device matrix before named-cohort launch.

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
