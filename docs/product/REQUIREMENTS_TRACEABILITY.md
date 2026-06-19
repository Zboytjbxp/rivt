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
| GA-FND-002 | Versioned database migrations own schema changes | Partial | SQL migration ledger, checksums, advisory lock, transactional apply, status, and rollback pass in CI; production deployment remains. |
| GA-FND-003 | Core records use normalized, user-owned domain tables | Partial | Canonical account/profile/organization/trade foundations exist and legacy blobs are quarantined; marketplace domains remain in `app_state` until their packets. |
| GA-FND-004 | Authenticated tenant/ownership authorization protects every private API | Partial | Legacy private routes require a DB-backed user and scope state/events/uploads/export to user ID; disposable-DB cross-user isolation passes in GitHub Actions. Normalized domain authorization remains. |
| GA-FND-005 | API uses consistent typed errors and validation | Partial | `/api/v1` has request IDs, Zod validation, stable errors, and pagination primitives; legacy APIs retain transitional shapes. |
| GA-FND-006 | Retryable writes are idempotent | Partial | Canonical idempotency storage and request primitives exist; domain mutations will adopt them per packet. |
| GA-FND-007 | Auditable domain events use authenticated actor and subject | Partial | Append-only canonical audit storage and actor context exist; domain routes must emit events per packet. |
| GA-FND-008 | Internal diagnostics identify deployed source revision and dependency readiness | Partial | Safe health and authenticated readiness responses now include build/dependency/migration metadata; deployment must provide and verify the source commit. |

## Authentication and Account

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-AUTH-001 | Email signup creates a real account with password policy | Partial | Scrypt hashing, explicit role, 12-character minimum, and auth throttling exist; verification, recovery, and breached-password screening remain. |
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
| GA-UX-002 | Mobile nav is Home, Work, Crew, Shop Talk, Tools | Blocker | Current `PrimaryDestination` is Home, Work, Network, Inbox, Tools; Messages occupies primary nav and Shop Talk is nested/bridged. |
| GA-UX-003 | Messages, notifications, search, and profile use top-bar entry | Partial | Search, notifications, and profile exist; messages remain primary nav and notification data is prototype state. |
| GA-UX-004 | No role toggle or duplicate global Post action | Partial | Signup/onboarding role selection exists appropriately; legacy components still carry older nav/action patterns. |
| GA-UX-005 | Every screen has loading, empty, error, offline, permission, and retry states | Prototype | Some empty/toast states exist; no systematic acceptance matrix. |
| GA-UX-006 | Responsive, keyboard, screen-reader, light/dark acceptance | Partial | Themes and skip link exist; no automated UI suite or complete manual evidence. |

## Jobs and Discovery

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-JOB-001 | Contractor creates a job draft and publishes it | Prototype | Post modal mutates React/app-state and uses seeded IDs; no job API/table. |
| GA-JOB-002 | Contractor edits, pauses, closes, and views status history | Prototype | Some statuses and handlers exist in blob state; no server state machine. |
| GA-JOB-003 | Job captures canonical scope, difficulty, tools/materials, schedule, pay expectation, location, and privacy | Partial | Type/modal include a subset; missing authoritative validation, private address model, deadlines, and versioned scope. |
| GA-JOB-004 | Only authorized contractor/organization members mutate a job | Missing | No domain authorization. |
| GA-JOB-005 | Tradesperson discovers only real, open, permitted jobs | Blocker | Seed jobs initialize every account; filters operate client-side over seeded/blob state. |
| GA-JOB-006 | Search/filter works over server-owned records | Prototype | Client-side filter only. |
| GA-JOB-007 | Exact address remains server-private until accepted relationship | Missing | Text policy exists but no separate private location record. |
| GA-JOB-008 | Published/paused/closed status transitions are server-enforced | Missing | Client directly rewrites status strings. |
| GA-JOB-009 | Job events are timestamped with actor/reason | Prototype | UI activity is inferred/hardcoded; generic events are not authoritative. |
| GA-JOB-010 | Rate limits and duplicate-submit protection | Missing | No server limits/idempotency. |

## Applications, Offers, and Active Work

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-MAT-001 | Tradesperson submits one application per job | Prototype | `ApplicationRecord` in app-state; no current-user identity or DB uniqueness. |
| GA-MAT-002 | Tradesperson withdraws application | Missing | No real workflow. |
| GA-MAT-003 | Contractor sees authorized applicants and profiles | Prototype | Seed talent is selected by trade; not real users/applicants. |
| GA-MAT-004 | Contractor sends an offer/invite to a specific applicant/person | Prototype | Invite targets highest seeded match rather than an authenticated selected user. |
| GA-MAT-005 | Tradesperson accepts/declines offer | Missing | No mutual acceptance endpoint/state machine. |
| GA-MAT-006 | Accepted offer creates participants and Active work exactly once | Missing | Client status changes do not establish an authoritative relationship. |
| GA-MAT-007 | Cancellation/reschedule records actor and reason | Prototype | Schedule hold and statuses exist; no mutual flow or history. |
| GA-MAT-008 | Block/suspension/closed-job rules prevent action | Missing | No domain enforcement. |

## Messaging and Notifications

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-MSG-001 | Job-linked conversation exists only for authorized participants | Prototype | Draft/string arrays in app-state; no conversations/messages tables. |
| GA-MSG-002 | Message persists once with sender and server timestamp | Missing | No message API. |
| GA-MSG-003 | Unread/read state is persistent per participant | Prototype | Activity count exists in client state only. |
| GA-MSG-004 | Message attachments use private authorized media | Missing | Uploads are session-scoped, not conversation-participant authorized. |
| GA-MSG-005 | Block/report/mute rules apply to messaging | Missing | UI concepts exist but no server policy. |
| GA-MSG-006 | Gate A in-app notifications represent real domain events | Prototype | Activity feed/toasts are client-generated and stored in app-state. |

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
| GA-REV-003 | Public reputation includes count/context and no fake data | Blocker | Seed jobs/talent carry ratings and review counts. |
| GA-SAFE-001 | Versioned signup and contextual work consent | Prototype | Boolean/trust copy in app-state; no consent version/timestamp/actor. |
| GA-SAFE-002 | Block and report user/job/message | Prototype | Community reports and account locks exist only as blob/admin simulation. |
| GA-SAFE-003 | Unsafe condition / stop-work record | Missing | No workflow. |
| GA-SAFE-004 | Verification claims use accurate states | Blocker | Seed talent uses boolean `verified`, `identityVerified`, and `insured`; UI includes “OSHA-aligned safety certs.” |

## Admin and Operations

| ID | Requirement | Current | Evidence / gap |
|---|---|---:|---|
| GA-ADM-001 | Internal routes require least-privilege admin authorization | Blocker | Admin UI is a normal view over client state; no admin roles/authorization. |
| GA-ADM-002 | Support can inspect safe account/workflow timeline | Missing | Generic events exist without safe support policy or actor identity. |
| GA-ADM-003 | Moderation/account actions use reason and immutable audit | Prototype | Lock/report handlers mutate app-state. |
| GA-OPS-001 | Build and lint gates pass | Verified | Production build and repository-wide ESLint pass locally and in GitHub Actions with zero errors or warnings. |
| GA-OPS-002 | Direct production dependencies are declared and vulnerability gate passes | Verified | `fast-xml-parser` is direct, Multer is 2.2.0, and `npm audit --omit=dev` reports zero vulnerabilities locally and in GitHub Actions. |
| GA-OPS-003 | Health, readiness, and build version are distinct | Verified | Deployed health and authenticated readiness report dependencies, migration version, and exact source commit `4c199d9`. |
| GA-OPS-004 | Backup and timed restore drill pass | Unknown | Documentation requests it; no evidence found in repo. |
| GA-OPS-005 | Structured logs, error monitoring, alerts, and incident routing | Missing | Console logging/basic responses only. |
| GA-OPS-006 | Critical rate limits and upload abuse limits | Partial | Auth/write/upload limits and an explicit upload MIME/size/count policy exist; durable/distributed limits and domain quotas remain. |
| GA-OPS-007 | Automated tests cover critical journeys and authorization | Partial | Unit/integration and Playwright auth/signup journeys pass; disposable-Postgres rotation, cross-user isolation, and immutable-role coverage pass in GitHub Actions. Broader domain journeys remain packet work. |
| GA-OPS-008 | Deployed commit, migrations, flags, and rollback are recorded | Partial | Packet 00 commit, Railway deployment ID, config change, smoke evidence, and rollback target are recorded; versioned migrations and a performed rollback drill remain. |

## Current Gate A Summary

- Production infrastructure is reachable and managed storage is healthy.
- The application is a broad interactive prototype with substantial UI coverage.
- Gate A domain persistence, authorization, and workflow integrity are mostly missing.
- Authentication now fails closed locally and in automated browser coverage; new OAuth identities enter pending onboarding without fabricated account data.
- Packet 00 safety foundations are CI-proven but not yet deployed; normalized domain persistence remains the next implementation priority after live verification.
