# Legacy Quarantine and Canonical Account Bridge

Status: accepted  
Owner: RIVT engineering  
Review date: before Packet 02 deployment

## Context

Production has two authenticated users but 114 unowned app-state blobs containing repeated prototype jobs, people, community content, and UI state. Ownership cannot be reconstructed safely. Promoting those values would create fake or misattributed marketplace activity.

## Decision

- `app_state`, `app_events`, legacy `uploads`, and `guest_sessions` remain quarantined legacy stores.
- No legacy marketplace entry becomes a canonical public record in Packet 01.
- Existing `auth_users.id` values become canonical `accounts.id` values.
- Each existing auth user receives one `auth_identity` and one `profiles` row with `visibility = 'private'` and `onboarding_status = 'draft'`.
- Existing display name and free-form location may be preserved in the private draft profile so the user can confirm them.
- Free-form organization names are not converted into organizations or memberships automatically.
- Existing `auth_users` and `auth_sessions` remain the login/session authority through Packet 02. New domain tables reference `accounts`.
- Canonical trade taxonomy is versioned product configuration, not marketplace seed content.

## Ownership Model

- An account represents one authenticated person.
- An organization represents a trade business and exists only after an explicit create/join action.
- Membership grants organization capability; account role alone never grants access to another organization's records.
- A profile belongs to exactly one account and is private until onboarding and publication requirements pass.
- New private domain records carry an account or organization owner and server-derived actor context.

## Safety and Privacy

- No profile is made discoverable by migration.
- No company relationship is inferred from matching text.
- No legacy message, job, review, or media object is shown to another user.
- Legacy deletion requires a retention decision, backup reference, and separate reviewed operation.

## Reversal

The canonical foundation migration is additive and can be rolled back while `auth_users` remains authoritative. Rollback drops only Packet 01 canonical tables and never deletes legacy auth or app-state data.
