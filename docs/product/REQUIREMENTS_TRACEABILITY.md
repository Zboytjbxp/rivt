# Gate A Requirements Traceability

Status values:

- **Verified:** persisted and tested against the live/production-like service.
- **Partial:** real implementation exists but Gate A behavior or safety is incomplete.
- **Prototype:** UI/local or application-blob behavior only.
- **Missing:** no meaningful implementation found.
- **Blocker:** current behavior is unsafe or contradicts Gate A.

Evidence must eventually link to implementation, automated tests, manual acceptance proof, and deployed build.

## Foundation

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-FND-001 | Managed PostgreSQL and private object storage are required | Verified | Live `/api/health` and `/api/storage` report PostgreSQL and S3-compatible storage healthy. |
| GA-FND-002 | Versioned database migrations own schema changes | Verified | Production runs checksummed transactional migrations with advisory locking; apply/rerun/rollback/reapply/tamper tests pass and status reports `0005_match_acceptance` with zero pending. |
| GA-FND-003 | Core records use normalized, user-owned domain tables | Partial | Canonical account/profile/organization/trade, job, application, offer, active-work, participant, and timeline foundations are live-smoked; messages/project records/reviews remain packet work. |
| GA-FND-004 | Authenticated tenant/ownership authorization protects every private API | Partial | Legacy private routes require a DB-backed user; canonical job mutations require active organization owner/admin membership and pass CI/live cross-user smoke. Remaining domains still need the same authorization model. |
| GA-FND-005 | API uses consistent typed errors and validation | Partial | `/api/v1` has request IDs, Zod validation, stable errors, and pagination primitives; legacy APIs retain transitional shapes. |
| GA-FND-006 | Retryable writes are idempotent | Partial | Canonical idempotency storage is used by job create/update/transition, application, offer, and active-work mutation APIs; Packet 04 live smoke proved double-accept safety; remaining domains adopt it per packet. |
| GA-FND-007 | Auditable domain events use authenticated actor and subject | Partial | Job, application, offer, and active-work routes emit authenticated audit/status events with append-only triggers and live-smoked timelines; remaining domains adopt it per packet. |
| GA-FND-008 | Internal diagnostics identify deployed source revision and dependency readiness | Verified | Health/readiness identify exact source `0ccf88c`, dependencies, applied migrations, and pending count in production. |

## Authentication and Account

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-AUTH-001 | Email signup creates a real account with password policy | Partial | Scrypt hashing, explicit role, 8-character minimum, and auth throttling exist; verification, recovery, and breached-password screening remain. |
| GA-AUTH-002 | Invalid login fails closed | Verified | Local fallback was removed; Playwright and deployed production smoke both prove a rejected login remains unauthenticated. |
| GA-AUTH-003 | Email ownership verification | Missing | No token/table/routes or verified-email state. |
| GA-AUTH-004 | Password reset and recovery | Missing | No recovery workflow. |
| GA-AUTH-005 | Google OAuth validates identity and continues onboarding | Partial | New OAuth users are created with pending role and blank company/location, then complete onboarding; live provider and account-linking tests remain. |
| GA-AUTH-006 | OAuth uses safe redirect/state/nonce design and account linking rules | Partial | State exists; no nonce/PKCE, identity-linking policy, or robust redirect-intent record. |
| GA-AUTH-007 | Session rotates after authentication and uses bounded lifetime | Partial | Signup/login/OAuth rotate sessions and default to 30-day expiry; DB-backed rotation passes in GitHub Actions, while device/session management remains deferred. |
| GA-AUTH-008 | Logout revokes server session and clears local auth | Verified | Local E2E coverage and a deployed disposable-account smoke prove logout clears the server session and subsequent `/api/auth/me` is anonymous. |
| GA-AUTH-009 | Auth endpoints are rate-limited and resist enumeration/CSRF | Partial | Auth/write/upload limits and approved-origin checks exist with SameSite cookies; enumeration review and explicit CSRF threat evidence remain. |
| GA-AUTH-010 | Account state and role are server-authoritative | Partial | Server role is required, pending during OAuth onboarding, and immutable afterward; legacy app-state authority must still be removed during normalization. |

## Profiles and Onboarding

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-PRO-001 | Resumable contractor/tradesperson onboarding | Prototype | Rich UI exists in `App.tsx`; persistence is app-state, and an effect forces onboarding complete. |
| GA-PRO-002 | Role-correct professional profile persists independently | Prototype | Account/profile values are split between `auth_users`, React state, session storage, and app-state. |
| GA-PRO-003 | Trade specialties use canonical taxonomy | Partial | Versioned 25-trade taxonomy and profile relationship tables pass migration tests; profile UI/API adoption remains. |
| GA-PRO-004 | Service area and location privacy | Prototype | Free-form location only; no normalized/geospatial service-area model. |
| GA-PRO-005 | Availability and controlled contact visibility | Prototype | Display fields exist; no authoritative availability/contact policy. |
| GA-PRO-006 | Profile photos/portfolio use authorized private media | Prototype | Generic uploads exist; no profile/portfolio ownership model. |

## Application Shell and UX

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-UX-001 | Compact role-correct shell and routes | Partial | Modern shell exists, but legacy views/routes and bridges remain. |
| GA-UX-002 | Mobile nav is Home, Work, Crew, Shop Talk, Tools | Partial | Packet 03 shell uses exactly Home, Work, Crew, Shop Talk, Tools in primary navigation; desktop/mobile E2E and live release evidence pass. Legacy bridge code remains until the App strangler finishes. |
| GA-UX-003 | Messages, notifications, search, and profile use top-bar entry | Partial | Search, messages, notifications, and profile use top-bar entry; Packet 05 source wires Messages/Notifications to server-owned inbox state, pending production smoke evidence. |
| GA-UX-004 | No role toggle or duplicate global Post action | Partial | Signup/onboarding role selection exists appropriately; legacy components still carry older nav/action patterns. |
| GA-UX-005 | Every screen has loading, empty, error, offline, permission, and retry states | Partial | Work now has server loading, directional empty, error, retry, filter, and detail states with local E2E coverage; remaining screens still need the matrix. |
| GA-UX-006 | Responsive, keyboard, screen-reader, light/dark acceptance | Partial | Themes and skip link exist; no automated UI suite or complete manual evidence. |

## Jobs and Discovery

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-JOB-001 | Contractor creates a job draft and publishes it | Verified | Packet 03 `jobs` tables, typed APIs, progressive editor, publish consent, idempotency, CI, E2E, and live smoke pass. |
| GA-JOB-002 | Contractor edits, pauses, closes, and views status history | Verified | Server state machine supports draft/open/paused/closed with append-only status events; Work UI exposes edit/publish/pause/resume/close; live smoke passed. |
| GA-JOB-003 | Job captures canonical scope, difficulty, tools/materials, schedule, pay expectation, location, and privacy | Verified | Canonical fields, validation, versioning, public location, private address, schedule/deadline, budget, duration, and requirements are implemented and live-smoked. |
| GA-JOB-004 | Only authorized contractor/organization members mutate a job | Verified | Job mutations require active owner/admin membership for the owning organization; CI and live smoke verify cross-contractor mutation returns 403. |
| GA-JOB-005 | Tradesperson discovers only real, open, permitted jobs | Verified | Tradesperson list API returns only published open jobs; seeded jobs/talent are removed from `src/data.ts`; live smoke verified open discovery and paused/closed hiding. |
| GA-JOB-006 | Search/filter works over server-owned records | Verified | `/api/v1/jobs` supports paginated server filtering by query, trade, difficulty, work type, location, insurance, and status; Work UI calls typed API; live smoke verified trade/region discovery. |
| GA-JOB-007 | Exact address remains server-private until accepted relationship | Verified | Packet 04 live smoke verified exact address was hidden before acceptance, revealed to the accepted tradesperson after offer acceptance, and unavailable to an unrelated tradesperson. |
| GA-JOB-008 | Published/paused/closed status transitions are server-enforced | Verified | Server enforces valid lifecycle transitions and rejects invalid duplicate/closed transitions; unit, E2E, and live smoke pass. |
| GA-JOB-009 | Job events are timestamped with actor/reason | Verified | Status events and audit events include authenticated actor/reason/timestamp and are immutable via trigger; lifecycle live smoke passed. |
| GA-JOB-010 | Rate limits and duplicate-submit protection | Partial | Job create/publish daily limits and idempotency-key replay protection are implemented and live-smoked; distributed rate-limit hardening remains later ops work. |

## Applications, Offers, and Active Work

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-MAT-001 | Tradesperson submits one application per job | Verified | Packet 04 production smoke verified application submit and duplicate application rejection; schema enforces one application per job/applicant. |
| GA-MAT-002 | Tradesperson withdraws application | Partial | Authenticated withdraw API, timeline event, and Work UI action exist; acceptance smoke did not exercise withdrawal before hire. |
| GA-MAT-003 | Contractor sees authorized applicants and profiles | Verified | Packet 04 production smoke verified non-owner applicant list returned 403 and the owning contractor saw exactly the applicant profile preview. |
| GA-MAT-004 | Contractor sends an offer/invite to a specific applicant/person | Verified | Packet 04 production smoke verified applicant-specific offer creation and one active-offer boundary. |
| GA-MAT-005 | Tradesperson accepts/declines offer | Partial | Recipient-only accept/decline APIs and UI actions exist; production smoke verified accept and wrong-recipient rejection, while decline remains source/CI coverage only. |
| GA-MAT-006 | Accepted offer creates participants and Active work exactly once | Verified | Packet 04 production smoke verified offer acceptance created one active-work record with two participants and repeated acceptance returned the same active-work record. |
| GA-MAT-007 | Cancellation/reschedule records actor and reason | Verified | Packet 04 production smoke verified active-work reschedule and cancel events with reasons; append-only status events are migration-enforced. |
| GA-MAT-008 | Block/suspension/closed-job rules prevent action | Partial | Packet 04 source and DB-backed CI cover account blocks; production smoke verified wrong-recipient and closed accepted job boundaries. Broader suspension policy remains a later safety/admin packet. |

## Messaging and Notifications

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-MSG-001 | Job-linked conversation exists only for authorized participants | Partial | Packet 05 source adds conversations and participants tied to accepted active work with server participant checks; DB-backed CI and production smoke pending. |
| GA-MSG-002 | Message persists once with sender and server timestamp | Partial | Packet 05 source adds idempotent message API, server sender/timestamps, receipts, and frontend Inbox wiring; DB-backed CI and production smoke pending. |
| GA-MSG-003 | Unread/read state is persistent per participant | Partial | Packet 05 source persists message receipts, participant read state, and notification read state; DB-backed CI and production smoke pending. |
| GA-MSG-004 | Message attachments use private authorized media | Partial | Packet 05 source adds attachment metadata rows with `pending_authorization`; actual private media authorization is explicitly handed off to Packet 06. |
| GA-MSG-005 | Block/report/mute rules apply to messaging | Partial | Packet 05 source enforces shared-conversation block/report/mute behavior on server routes; DB-backed CI and production smoke pending. |
| GA-MSG-006 | Gate A in-app notifications represent real domain events | Partial | Packet 05 source creates in-app notifications for offers, accepted work, work transitions, and messages; client-only activity feed remains fallback UI only. |

## Project Records and Completion

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-PRJ-001 | Accepted work owns a project record/timeline | Prototype | Records UI exists; no project-record domain table. |
| GA-PRJ-002 | Photo/file/note upload is user/job authorized | Blocker | S3 upload is real but keyed by unauthenticated session and arbitrary job ID. |
| GA-PRJ-003 | File type/size/content safety and private signed access | Partial | Size/MIME and signed URLs exist; MIME trusts client, wildcard images are allowed, no scanning/derivatives. |
| GA-PRJ-004 | Completion submission contains note/evidence/checklist | Prototype | Closeout state/handlers exist in app-state. |
| GA-PRJ-005 | Contractor confirms or disputes completion | Prototype | Client handler exists; no server authorization/state. |
| GA-PRJ-006 | Closeout report is reproducible and exportable | Prototype | Clipboard/window report behavior exists; no immutable server report. |
| GA-PRJ-007 | Original evidence and audit history are preserved | Missing | No media revision/evidence model. |

## Reviews and Safety

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-REV-001 | Only completed participants may review once | Prototype | Review UI/flags exist; no participant eligibility or uniqueness. |
| GA-REV-002 | Two-sided review response/dispute state persists | Prototype | Concepts/views exist; no normalized records. |
| GA-REV-003 | Public reputation includes count/context and no fake data | Partial | Packet 03 removes seeded jobs/talent/review counts from current data and Work/Crew E2E asserts seeded names are absent; canonical review reputation remains future packet work. |
| GA-SAFE-001 | Versioned signup and contextual work consent | Prototype | Boolean/trust copy in app-state; no consent version/timestamp/actor. |
| GA-SAFE-002 | Block and report user/job/message | Prototype | Community reports and account locks exist only as blob/admin simulation. |
| GA-SAFE-003 | Unsafe condition / stop-work record | Missing | No workflow. |
| GA-SAFE-004 | Verification claims use accurate states | Partial | Seed talent verification/insurance claims were removed from current data; remaining profile/training copy still needs evidence-state review in the safety packet. |

## Admin and Operations

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-ADM-001 | Internal routes require least-privilege admin authorization | Blocker | Admin UI is a normal view over client state; no admin roles/authorization. |
| GA-ADM-002 | Support can inspect safe account/workflow timeline | Missing | Generic events exist without safe support policy or actor identity. |
| GA-ADM-003 | Moderation/account actions use reason and immutable audit | Prototype | Lock/report handlers mutate app-state. |
| GA-OPS-001 | Build and lint gates pass | Verified | Production build and repository-wide ESLint pass locally and in GitHub Actions with zero errors or warnings. |
| GA-OPS-002 | Direct production dependencies are declared and vulnerability gate passes | Verified | `fast-xml-parser` is direct, Multer is 2.2.0, and `npm audit --omit=dev` reports zero vulnerabilities locally and in GitHub Actions. |
| GA-OPS-003 | Health, readiness, and build version are distinct | Verified | Deployed health and authenticated readiness report dependencies, migration version, and exact source commit `0ccf88c`. |
| GA-OPS-004 | Backup and timed restore drill pass | Unknown | Documentation requests it; no evidence found in repo. |
| GA-OPS-005 | Structured logs, error monitoring, alerts, and incident routing | Missing | Console logging/basic responses only. |
| GA-OPS-006 | Critical rate limits and upload abuse limits | Partial | Auth/write/upload limits and an explicit upload MIME/size/count policy exist; durable/distributed limits and domain quotas remain. |
| GA-OPS-007 | Automated tests cover critical journeys and authorization | Partial | Unit/integration and Playwright journeys pass; disposable-Postgres auth/job/match authorization coverage passes in GitHub Actions. Broader domains remain packet work. |
| GA-OPS-008 | Deployed commit, migrations, flags, and rollback are recorded | Partial | Packet 00-04 commits, Railway deployment IDs, config changes, migration status, smoke evidence, and rollback targets are recorded; a full timed isolated restore drill remains open. |

## Current Gate A Summary

- Production infrastructure is reachable and managed storage is healthy.
- Authentication, canonical profiles/onboarding, jobs/discovery, and match acceptance have production evidence.
- Messaging, notifications, project records/completion, reviews, admin operations, and full launch hardening remain Gate A packet work.
- The app must continue to avoid fake seed data, frontend-only success, and homeowner flows.
