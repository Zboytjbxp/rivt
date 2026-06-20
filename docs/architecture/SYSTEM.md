# RIVT System Architecture

Status: Gate A architecture delta

## Current System

```text
Browser / React
  ├─ 10k-line App.tsx state and handlers
  ├─ modern feature components plus retired fallback components
  ├─ seed community/news surfaces pending canonical packet work
  └─ canonical /api/v1 domain workflows; no app-state hydrate/save loop

Express process on Railway
  ├─ email auth and Google OAuth
  ├─ session cookie
  ├─ canonical /api/v1 domain endpoints plus managed upload/provider endpoints
  ├─ retired legacy app-state/event/payment-export endpoints returning 410
  ├─ runtime CREATE/ALTER schema
  └─ serves Vite dist

PostgreSQL
  ├─ auth_users / auth_sessions / guest_sessions
  ├─ quarantined app_state JSON blobs retained for rollback/retention only
  ├─ quarantined app_events retained for rollback/retention only
  └─ uploads

S3-compatible storage
  └─ private objects with signed URLs
```

The current storage model isolates browser-cookie sessions, not authenticated users and organizations. It cannot safely support a two-sided marketplace.

## Gate A Target

```text
Responsive React PWA
  ├─ route/domain feature modules
  ├─ typed API client and query/mutation state
  ├─ local drafts/cache with visible sync state
  └─ no authentication or authorization decisions

Express API
  ├─ authentication/session boundary
  ├─ authorization and account-state policy
  ├─ jobs/applications/offers state machines
  ├─ messaging/notifications
  ├─ projects/media/completion/reviews
  ├─ support/moderation/audit
  └─ provider adapters and background work

PostgreSQL
  ├─ normalized canonical domain records
  ├─ constraints, transactions, migrations
  ├─ idempotency and audit events
  └─ reconciliation/repair support

Private object storage
  ├─ user/project-owned object metadata
  ├─ signed upload/download authorization
  └─ originals plus safe derivatives later
```

## Gate A Domain Tables

Initial migration design should cover:

- `users`, `auth_identities`, `sessions`, `email_verification_tokens`, `password_reset_tokens`
- `organizations`, `organization_memberships`
- `profiles`, `trades`, `profile_trades`, `service_areas`, `availability_status`
- `jobs`, `job_locations`, `job_requirements`, `job_status_events`
- `applications`, `offers`, `work_participants`
- `conversations`, `conversation_participants`, `messages`, `message_receipts`
- `projects`, `project_entries`, `media_objects`
- `completion_submissions`, `completion_confirmations`
- `reviews`, `review_responses`, `review_disputes`
- `notifications`, `blocks`, `reports`, `consent_acceptances`, `audit_events`, `idempotency_keys`

Exact schemas require a reviewed migration design. Do not generate all tables in one unreviewed migration.

## Ownership Rules

- Every private record has an authenticated owner or organization plus explicit participants.
- A session belongs to one active user and rotates at authentication.
- Job mutation requires contractor/organization capability.
- Applications belong to the applicant and target job; unique active application per applicant/job.
- Offers target one applicant/profile and require mutual acceptance.
- Conversations and project records require participant authorization.
- Media metadata identifies owner, project/job, purpose, and private object key.
- Admin access is a separate capability and immutable audit event.

## Migration Strategy

1. Stop fail-open/local authentication and require authenticated ownership for private APIs.
2. Introduce versioned migration runner and migration ledger.
3. Add canonical account/profile tables while preserving existing auth users.
4. Add one domain vertical slice at a time; read/write canonical tables for that slice.
5. Treat `app_state` as legacy input only. Do not dual-write indefinitely.
6. Classify existing rows as real, test, guest, or unknown before migration.
7. Do not migrate seeded marketplace entities into public production records.
8. Reconcile counts/ownership and preserve rollback until each slice is verified.

## API Conventions

- `/api/v1/...` for new domain endpoints.
- JSON error: `{ "error": { "code": "...", "message": "...", "requestId": "...", "details": {} } }`.
- Mutation endpoints accept idempotency key where retries can duplicate work.
- Cursor pagination for lists.
- ISO UTC timestamps and explicit money currency.
- Server derives actor from authenticated session; never accepts actor/user ownership from client payload.
- Consistent `401` unauthenticated, `403` unauthorized, `404` hidden/not found, `409` state conflict, `422` validation, `429` rate limit.

## Immediate Security Corrections

- Remove local fabricated auth fallback.
- Rotate session ID after login/OAuth/signup; shorten and manage expiry.
- Require authenticated user middleware for all private routes.
- Restrict CORS to approved origins and define CSRF defense.
- Add rate limits and request/body/file constraints.
- Replace OAuth default role/company/location with pending onboarding.
- Validate OAuth identity claims safely.
- Upgrade vulnerable Multer and declare direct parser dependency.
- Do not reveal provider secrets or raw upstream bodies in user-facing errors.
