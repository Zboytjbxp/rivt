# RIVT Gate A Launch Operations Checklist

This checklist is the go/no-go operating contract for the first named customer cohort. It complements `npm run launch:readiness`; the command checks the machine-readable incident and recovery files, while this document tells the operator what to complete and where evidence belongs.

Do not mark Gate A approved while any required item is `TBD`, missing an owner, missing evidence, or only verified in a local/dev environment.

## 1. Incident Ownership

- Primary incident owner recorded in `docs/operations/incident-routing.json`.
- Backup incident owner recorded with real name and email.
- Support hours recorded in Eastern time and approved by founder.
- Paging/escalation destination configured and tested.
- Dedicated error-monitoring provider configured and tested.
- Synthetic monitor is running outside Railway and opens a GitHub incident issue on failure.
- One incident rehearsal passed in the last 30 days.
- Founder, support, and legal/safety approvals are recorded.

Evidence:

- `npm run incident:readiness -- --require-ready`
- Test alert screenshot or provider event link.
- Rehearsal notes in the deployment ledger or incident folder.

## 2. Backup, Restore, And Recovery Policy

- RPO target approved in minutes.
- RTO target approved in minutes.
- Backup retention window approved in days.
- Restore-drill cadence approved in days.
- Latest named backup-artifact restore passed in the last 30 days.
- Next restore-drill due date recorded.
- Founder and operations approvals recorded in `docs/operations/recovery-policy.json`.

Evidence:

- `npm run launch:readiness -- --require-ready`
- Named backup object key.
- Restore target name and deletion proof.
- Restore duration and verification duration.

## 3. Customer Support Readiness

- `support@rivt.pro` inbox is accessible from the support device.
- Support owner can receive and reply from the support inbox.
- Support response promise is documented in-app or launch emails.
- Escalation path exists for identity, payment-log, safety, and account-lock issues.
- User-facing launch communication includes RIVT's trades-only positioning and no-homeowner policy.

Evidence:

- Test inbound email and reply.
- Support-hours entry in `incident-routing.json`.
- Launch email or pilot invite copy.

## 4. Provider And Configuration Review

- Railway production health passes on `https://rivt.pro/api/health`.
- Managed PostgreSQL and private S3-compatible storage report healthy.
- Google OAuth is configured for production domain and no local fallback is enabled.
- Twilio/SMS is either configured with compliant sender registration or explicitly deferred from Gate A.
- Stripe/subscription billing is either configured for production or explicitly deferred from Gate A.
- Operational kill switches are known and documented.
- No temporary `RESTORE_*` or `CONFIRM_*` variables are left on production services.

Evidence:

- `npm run smoke:gate-a:live`
- `npm run monitor:production`
- Redacted provider configuration screenshots or settings export.

## 5. Accessibility And Device Readiness

- Automated authenticated UI smoke passes at 360px, 390px, tablet, laptop, desktop, and 200 percent text scale.
- Physical Android Chrome smoke completed.
- Physical iPhone Safari smoke completed.
- Keyboard-only route traversal completed on desktop.
- Screen-reader label pass completed for auth, Home, Work, Crew, Shop Talk, Tools, messages, notifications, and profile menu.
- No off-screen controls, horizontal scroll, clipped critical text, or tap target below 44px.

Evidence:

- `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md`
- Device screenshots or notes with date, device, browser, account role, and result.

## 6. Pilot Cohort Control

- Pilot size is named.
- Target Jacksonville trade clusters are named.
- Pilot invitation method is ready.
- Any invite code, if used, is documented and revocable.
- Support inbox and incident owner are watching during the first 48 hours.
- Feedback intake path is visible in the app.
- Rollback plan and previous good deployment are recorded.

Evidence:

- Deployment ledger entry.
- Pilot roster or invite-count note.
- Founder go/no-go approval.

## Required Go/No-Go Commands

Run these before opening the named pilot:

```text
npm run build
npm run lint
npm run lint:security
npm run test
npm run test:e2e
npm audit --omit=dev
npm run monitor:production
npm run smoke:gate-a:live
npm run incident:readiness -- --require-ready
npm run launch:readiness -- --require-ready
```

The final two commands are expected to fail until the external operational decisions are complete.
