# Production Credential Rotation Runbook

Use this runbook for confirmed or suspected production-secret exposure. It is
designed to preserve service and recovery while preventing secrets from entering
logs, terminals, screenshots, commits, chat, or incident notes.

## Non-negotiable rules

1. Obtain explicit approval for the incident scope, interruption window, and
   maximum cost before changing provider state.
2. Stop if a provider quotes a new charge, recovery cannot be preserved, the
   target environment is uncertain, or a destructive action is required.
3. Never print, list, export, or snapshot all Railway variables.
4. Never run the secret-bearing Railway commands `railway environment config`
   or `railway variable list` against production.
5. Change one named variable through an authenticated provider or Railway form.
   Do not use a shell command containing the secret.
6. Keep secret values only in the provider's one-time display, the approved
   secret manager, or a direct clipboard-to-password-field transfer. Do not
   place them in source files, command history, notes, or test fixtures.
7. Verify the new credential before revoking the old one whenever the provider
   supports overlap.
8. Application rollback may restore code, but must never restore a compromised
   credential.
9. Do not create, delete, or re-encrypt backup objects without separate approval.
10. Record only nonsecret evidence.

## Before rotating

- Declare the incident and name the operator.
- Record the current production source and rollback source.
- Confirm the exact Railway project, environment, service, database, and bucket.
- Confirm the existing backup artifact and its retention.
- Deploy any compatibility code required for key overlap.
- Run build, lint, tests, E2E, and the production dependency audit.
- Verify `/api/health` reports the exact hotfix source.
- Prepare a provider-by-provider checklist with a verification and rollback step.

## Safe order

The order may change when a provider's risk or recovery model requires it. The
default sequence is:

1. Object-storage access key and PostgreSQL password, with exact service targets
   confirmed.
2. Stripe API credential and both webhook signing secrets.
3. Resend sending credential.
4. Google OAuth client secret.
5. Authentication metadata pepper.
6. VAPID key pair after the compatibility bridge is live.
7. Backup-encryption key after active/previous restore support is live.
8. Sentry DSN last because it is an ingestion identifier rather than a
   privileged account credential.

## Provider procedure

For each provider:

1. Open the provider in an already authenticated browser session.
2. Confirm production versus test mode and the exact account/resource.
3. Create or rotate one credential. Stop if this requires a paid feature.
4. Transfer the new value directly into the one intended Railway variable.
5. Deploy the already-reviewed exact source with that configuration.
6. Verify the affected path without a real charge or customer communication:
   - PostgreSQL: health and a read-only application query.
   - object storage: health and existing authorized object access; do not create
     or delete an object.
   - Stripe API: provider/account status and webhook endpoint configuration; do
     not create a real payment.
   - webhook secrets: use provider test delivery where available.
   - Resend: provider configuration; send only to an owner-controlled address
     when that is within the approved no-cost allowance.
   - Google OAuth: configuration plus an owner-controlled login when no new
     consent or external communication is required.
   - authentication pepper: health plus fail-closed authentication/rate-limit
     checks.
   - Web Push: active-key delivery and continuity for an already opted-in
     owner-controlled device.
   - backup encryption: decrypt the retained named artifact through the
     previous-key path in an isolated target only when separately approved.
   - Sentry: health/configuration and a provider test event when no paid quota
     change is required.
7. Revoke or disable the old credential.
8. Verify the old credential no longer works using the provider's status or
   revocation evidence without retrieving or printing its value.
9. Record time, operator, outcome, nonsecret identifier, and exact source.

### No-overlap provider exception

Railway bucket credential reset invalidates the old access pair immediately, and
a direct PostgreSQL password change is also a no-overlap cutover. For either
one, do not pretend the generic verify-before-revoke sequence is possible:

1. Confirm the exact bucket or database role and dependent service.
2. Review the cutover and rollback sequence before changing provider state.
3. Use the approved maintenance window.
4. Reset or change the credential, update only the intended Railway variable,
   and deploy the already-reviewed exact source immediately.
5. Verify health and the narrow read-only application path.
6. Stop and use the reviewed recovery path if health fails.

The provider action itself invalidates the old credential, so there is no
separate old-credential revocation step.

## Backup-encryption transition

- `BACKUP_ENCRYPTION_KEY` (or its existing alias) is the active write key.
- `BACKUP_ENCRYPTION_KEY_PREVIOUS` is decrypt-only during the transition.
- New artifacts include a nonsecret key identifier but retain the v1 envelope
  format so the pre-hotfix reader can still decrypt them with the active key.
- Legacy artifacts without a key identifier try active, then previous.
- Do not remove the previous key until every retained artifact has a verified
  recovery path or has expired under the approved retention policy.

## Web Push transition

- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are active.
- `VAPID_PREVIOUS_PUBLIC_KEY` and `VAPID_PREVIOUS_PRIVATE_KEY` form the
  transitional previous pair.
- The previous pair is all-or-nothing and uses the existing VAPID subject.
- Delivery tries the active pair first and retries the previous pair only after
  a definitive `401` or `403` authentication rejection.
- Never retry the previous key after timeouts, `404`, `410`, `429`, or `5xx`;
  the first request may have succeeded and fallback could duplicate an alert.
- Existing opted-in clients migrate on app open when their subscription key
  differs. The migration must never opt in a user who did not grant permission.
- The previous pair is a temporary continuity bridge, not final revocation.
  Before launch completion, add per-subscription key-generation tracking so
  retirement is measurable.

## Completion and follow-up

- Run exact-source production health and synthetic monitoring.
- Run authenticated owner-controlled smokes for every affected provider.
- Review logs for authentication, webhook, storage, email, OAuth, push, or
  monitoring errors without expanding log access or exposing payload secrets.
- Close the incident only when provider-managed old credentials are revoked,
  application-generated old secrets are retired from active use, transitional
  backup/VAPID material reaches its measured retirement boundary, and recovery
  is preserved. If transition-only material remains configured, mark the
  incident contained rather than closed.
- Re-run launch readiness and obtain a new exact-source Stage 1 approval.
