# Gate A Scope

Status: Proposed execution baseline
Release type: Invitation-only Jacksonville pilot

## Required Capabilities

### Platform foundation

- Authenticated, user-owned normalized domain records in PostgreSQL.
- Private managed object storage with authenticated authorization checks.
- Versioned migrations; no startup-created production schema as the long-term migration mechanism.
- Typed API contracts, consistent errors, idempotent mutations, audit events, and production diagnostics.
- Safe responsive shell, light/dark themes, accessibility baseline, and honest loading/empty/error/offline states.

### Identity and profile

- Email signup, email verification, login, logout, password reset, and secure sessions.
- Google OAuth without fabricated role/company/location defaults.
- Resumable role-correct onboarding.
- Contractor and tradesperson profiles with trades, service area, bio, availability, and controlled contact visibility.
- Role immutable through normal user settings.

### Work marketplace

- Contractor creates, edits, publishes, pauses, and closes a job.
- Tradesperson discovers and filters real open jobs.
- Tradesperson applies and withdraws.
- Contractor reviews applicants and sends an offer/invite.
- Tradesperson accepts or declines; accepted work becomes Active.
- Status history and exact-address privacy are enforced server-side.

### Coordination and records

- Persistent job-linked messages and unread state.
- Authenticated attachments.
- Active-work record with photos/files/notes and activity history.
- Completion submission and contractor confirmation.
- Exportable closeout report.
- One eligible review per party with response/dispute status.

### Safety and operations

- Consent at signup and contextual reminder before posting/accepting.
- Block and report user/content pathways.
- Unsafe condition / stop-work record.
- Internal support, moderation, audit, account restriction, and replay/recovery capability required by pilot.
- Monitoring, backups, tested restore, rate limits, dependency remediation, incident runbooks, and rollback.

## Feature-Flagged or Deferred

- Public Shop Talk and Trade News.
- Advanced project albums, annotations, offline media queue, and public share links.
- Calculator suite, estimates, invoices, payment exports, and tax summaries.
- Advanced crews, saved searches, alerts, recurring/bulk work, subscriptions, identity/background providers, and AI.

Existing prototypes may remain in source while migration is underway, but they must be absent from pilot navigation unless their Gate A requirement and acceptance evidence pass.

## Gate A Release Sequence

1. Foundation and authentication safety.
2. Normalized domain schema and migration path.
3. Onboarding and profiles.
4. Jobs and discovery.
5. Applications, offers, acceptance, and status history.
6. Messaging and in-app notifications.
7. Project records, completion, and reviews.
8. Admin/support, security, recovery, and pilot hardening.

## Hard Blockers

- Browser-fabricated authentication fallback exists.
- Product endpoints do not require authenticated ownership.
- Core jobs/applications/messages/reviews remain a mutable JSON application-state blob.
- Production contains fake marketplace records presented as real.
- Critical lint, security, authorization, backup/restore, or migration checks fail.
- A visible pilot control has no real backend or truthful failure state.
