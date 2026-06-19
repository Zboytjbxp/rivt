# Packet 02 — Authentication, Onboarding, and Profiles

## Objective

Complete the real account journey and replace split/local profile state with canonical server-owned profiles.

Requirements: GA-AUTH-001 through GA-AUTH-010; GA-PRO-001 through GA-PRO-006.

## Required Work

1. Email signup with policy and pending-verification state.
2. Email verification token lifecycle and resend limits.
3. Login/logout plus password reset/recovery.
4. Google OAuth with safe identity validation and pending onboarding—no fabricated role/company/location.
5. Role-correct resumable onboarding with versioned consent.
6. Canonical contractor/tradesperson profile, trades, service area, availability, privacy/contact choices, and profile media.
7. Server-authoritative role/account state and protected posting/applying capability.
8. Account/session device list and revocation appropriate to Gate A.
9. Remove auth/profile session-storage fallback as a source of truth.

## Acceptance

- All authentication scenarios in `ACCEPTANCE.md` pass.
- Two distinct users complete role-correct onboarding and remain correct after refresh/relogin.
- Unverified/incomplete accounts cannot perform gated work actions.
- Role cannot be switched through client payload or app-state.
- Profile fields/media are owned, private/public as configured, and cross-user protected.

## Stop Condition

Do not build job persistence in remaining tokens. Update exact account/profile API and migration evidence.

## Implementation Evidence

- Source branch: `codex/packet-02-auth-onboarding-profiles`
- Accepted commit: `762bf2c`
- Migration: `0003_auth_onboarding_profiles`
- GitHub Actions Gate A run: `27807558330` (pass)
- Local gates: lint, production build, unit/integration suite, and fail-closed browser test pass
- Production status: not deployed; provider configuration and controlled live acceptance remain required
