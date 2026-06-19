# Authentication and Account Lifecycle

Status: accepted  
Owner: RIVT engineering  
Review date: before Packet 02 production deployment

## Context

RIVT's pilot is invitation-only. Email accounts currently become usable immediately, Google identities are linked by email alone, profile state is split between legacy auth columns and browser state, and sessions cannot be inspected or revoked by device. That is not sufficient for real users or account recovery.

## Decision

- Email signup creates an `onboarding` account with an immutable selected role and an unverified email.
- When pilot enforcement is enabled, signup requires a valid hashed invitation with matching optional email/role, expiry, revocation, and use-count checks.
- Email verification and password reset use random 256-bit tokens. Only SHA-256 token hashes are stored. Tokens are single-use, expire, and are rate-limited.
- Production email delivery uses Resend through a provider adapter. Missing provider configuration fails truthfully; verification/reset tokens are never returned by production APIs or logs.
- Google login uses OpenID Connect authorization code flow with state, PKCE, nonce, and signed ID-token verification against Google's JWKS. Identity ownership is keyed by Google's stable `sub`, not email.
- A verified Google email may link to an existing account with the same normalized email. Conflicting provider subjects fail closed and require support review.
- Sessions rotate at authentication and store privacy-reduced device metadata. Users can list sessions, revoke one, or revoke all others. Password reset revokes every existing session.
- Account capability depends on server-owned account status, email verification, onboarding completion, and immutable role.
- Profiles stay private and draft until onboarding completes. Service area is city/region plus radius; no exact address belongs in a profile.
- Contact visibility is explicit and defaults to private. Profile publication is a separate action, not an onboarding side effect.
- Signup consent is versioned and timestamped. Completing onboarding records the accepted document version and request ID.

## Recovery and Enumeration Safety

- Login and recovery responses do not reveal whether an email exists.
- Resend/reset endpoints use generic accepted responses and per-IP/per-account limits.
- Verification/reset token consumption uses a row lock and transaction so replay cannot succeed.
- Password reset requires a new strong password, rotates credentials, consumes the token, and revokes sessions.
- Suspended/closed accounts cannot enter protected domain APIs; support/appeal remains a later explicit route.

## Migration

- Existing Google accounts are marked email-verified because they entered through Google's verified-email flow, but remain private draft profiles.
- Existing legacy email-hash identities are upgraded to provider-subject identities on the next validated Google login.
- Existing draft profiles move accounts back to `onboarding`; users confirm role/profile/consent before Gate A work access.
- No organization is inferred from legacy text. Contractor onboarding creates an organization only from an explicit submitted business name.

## Alternatives

- Passwordless-only auth: deferred; email/password plus Google is already understood by pilot users.
- Store raw verification tokens: rejected due to database compromise risk.
- Trust browser role/onboarding flags: rejected because capabilities must be server-authoritative.
- Require phone/SMS verification in Gate A: deferred until A2P registration and policy are complete; SMS is not an auth dependency.

## Reversal

Migration 0003 is additive and has a tested down migration. Existing `auth_users` remains the credential bridge during Packet 02, so rollback does not delete accounts or legacy state.
