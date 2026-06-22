# Gate A Acceptance Contract

Gate A is approved only with automated and manual evidence against production-like infrastructure. Screenshots alone are insufficient.

## Current Evidence Snapshot - 2026-06-21

Gate A is not approved yet.

Packet 08 hardening evidence now exists for:

- Production source proof: `https://rivt.pro/api/health` reports exact source `67094c9853a8f4be2be01ffe30376b669afe6cde`.
- Migration proof: production readiness and live hardening audit report `0009_durable_rate_limits`, nine applied migrations, and zero pending migrations.
- Anonymous fail-closed proof: live hardening audit checks seven private endpoints and receives `401` for anonymous requests.
- Seed/demo proof: first hardening audit caught visible test artifacts; guarded cleanup made matching test profiles private and closed smoke organizations without deletion; final audit reports zero user-facing seed/demo findings.
- Operational controls: signup and platform-mutation kill switches are wired and exposed through readiness/provider status; both are currently disabled.
- Durable limits: auth, write, and upload throttles use shared PostgreSQL `rate_limit_windows` buckets keyed by privacy-safe subject hashes.
- Legacy bridge retirement: authenticated `/api/app-state`, `/api/events`, and `/api/payments/export.csv` bridge routes were retired in source `00147c8e3f70e246b41ed48b46550ae33cf0eb54` and remain absent from the current deployed source; live hardening smoke still reports zero seed/demo findings and anonymous fail-closed behavior.
- Manual and scripted accessibility/device smoke: `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md` records 1280x720, 390x844, and 360x800 public-shell checks with no console warnings/errors or horizontal overflow; one sub-44px auth input target-size defect was fixed and post-deploy verification measured 46px fields at 390x844. Expanded authenticated production smoke `ui-a11y-20260621043529-3efa9b` covered contractor/tradesperson 360x800 and 390x844 phones, contractor 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and contractor 390x844 with 200% root text scale. It verified top-bar search/messages/notifications/profile present, no role toggle, no More tab, no horizontal overflow after fixing Crew/network shell overflow, zero post-login console warnings/errors, zero small tap-target findings, reduced-motion preference enabled, and keyboard focus reaching named top-bar and primary-navigation targets. The smoke now fails on those authenticated-shell regressions instead of only reporting them.
- Production synthetic monitoring: `npm run monitor:production` passes against `https://rivt.pro` and `.github/workflows/production-synthetic.yml` schedules the same public health/provider/fail-closed check every 30 minutes. The workflow now installs from lockfile, uploads `production-monitor.log` evidence on every run, opens or updates a single GitHub incident issue when checks fail, and comments/closes that issue after recovery.
- Incident readiness gate: `docs/operations/incident-routing.json` and `npm run incident:readiness` now make incident owner, support-hours, alert destination, rehearsal, and approval gaps machine-checkable. The synthetic incident issue body includes routing context. Current readiness has primary owner `Michael <support@rivt.pro>`, backup owner Anya Tingle, support hours, synthetic monitoring, Sentry error monitoring, first pilot escalation, and incident-routing approval configured. Scenario A rehearsal was attempted on 2026-06-22: `npm run monitor:production` passed, but the required live Gate A smoke was blocked because the local production `DATABASE_URL` is blank and Railway CLI auth is expired. Current readiness remains blocked by a passed incident rehearsal and founder/support/legal-safety approvals.
- Timed isolated logical restore: temporary Railway PostgreSQL target `Postgres-3Ei3` was provisioned, migrated, populated from production through `npm run restore:logical-copy -- --apply-migrations`, and then strictly verified through `npm run restore:drill`. The copy covered 59 public tables and 1,524 rows in 1,421 ms; the verifier confirmed migration `0009_durable_rate_limits`, nine applied migrations, zero pending migrations, source/target parity across critical Gate A tables, zero count diffs, and a 220 ms verifier duration. The temporary target was deleted and no temporary restore variables remain.
- Named backup artifact restore: `npm run backup:logical-artifact` created AES-256-GCM encrypted object `backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm` in private S3-compatible storage from 59 tables / 1,524 rows in 630 ms. `npm run restore:logical-artifact -- --apply-migrations` restored that named object into isolated Railway target `Postgres-_FQz`, applied nine migrations through `0009_durable_rate_limits`, restored 59 tables / 1,524 rows, verified table/column/sequence and strict manifest-count parity with zero diffs in 13,411 ms, and `npm run restore:drill` verified the target in 1,862 ms. The temporary target was deleted, detached restore volumes were marked for deletion, and temporary restore variables were removed.
- Launch readiness gate: `docs/operations/recovery-policy.json`, `docs/operations/LAUNCH_OPS_CHECKLIST.md`, `docs/operations/INCIDENT_REHEARSAL_RUNBOOK.md`, and `npm run launch:readiness` now combine incident readiness with recovery-policy evidence. The recovery policy is approved for Gate A with RPO 24 hours, RTO 4 hours, 30-day backup retention, 30-day restore-drill cadence, and next restore drill due `2026-07-21T04:18:59.000Z`. The current gate remains blocked by a passed incident rehearsal, founder/support/legal-safety approvals, and deeper manual accessibility/device evidence.
- Controllable UI interaction coverage: `test/jobs-discovery.e2e.mjs` now opens top-bar search, notifications, account/profile, and messages/inbox at desktop and mobile viewports with mocked server responses. `scripts/live-ui-accessibility.js` was also hardened to audit those same opened top-bar surfaces during the next disposable-account production run.
- Local automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` pass on the Packet 08 source.

Blocking evidence still missing before named customer/pilot launch:

- One passed incident rehearsal and final founder/support/legal-safety approvals. `npm run incident:readiness -- --require-ready` must pass before launch.
- `npm run launch:readiness -- --require-ready` must pass before launch after the incident rehearsal and approvals are recorded.
- Physical-device and deeper manual accessibility matrix evidence, including mobile Safari/Chrome, route-level keyboard-only workflows, screen-reader labels, and end-to-end route flows after login.
- Founder/legal/support approval owners, launch communications, and support hours.

## Required Automated Gates

```text
npm ci
npm run build
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm audit --omit=dev
npm run incident:readiness -- --require-ready
npm run launch:readiness -- --require-ready
```

Test scripts not currently present must be created in Packet 00. The production dependency audit must have no unaccepted high/critical vulnerabilities.

## Foundation Scenarios

| ID | Scenario | Expected |
|---|---|---|
| A-FND-01 | Anonymous request to private API | `401`; no record created or disclosed |
| A-FND-02 | User A requests User B job/message/file | `403` or privacy-preserving `404`; audit signal |
| A-FND-03 | Same idempotency key submitted twice | One business mutation and stable response |
| A-FND-04 | Database unavailable during write | Truthful failure; no success toast; user work preserved |
| A-FND-05 | Object storage unavailable during upload | Per-file failure/retry; no broken-success metadata |
| A-FND-06 | Deployed health inspected | Build commit, migration version, service/readiness visible internally |

## Authentication Scenarios

| ID | Scenario | Expected |
|---|---|---|
| A-AUTH-01 | Invalid email/password | Remains signed out; generic error; no local fallback |
| A-AUTH-02 | API/network unavailable during login | Remains signed out; retry guidance |
| A-AUTH-03 | New email signup | Account pending verification; no protected posting/applying |
| A-AUTH-04 | Verification token replay/expiry | Single use; expired token rejected safely |
| A-AUTH-05 | Password reset | Token single-use; session policy applied; notification emitted |
| A-AUTH-06 | Google first login | Pending onboarding; no invented role/company/location |
| A-AUTH-07 | Login after pre-auth browsing | Session ID rotates; prior cookie cannot access authenticated records |
| A-AUTH-08 | Logout then refresh/back | Protected data inaccessible; session revoked |
| A-AUTH-09 | Repeated auth attempts | Rate limited without account enumeration |

## Contractor Journey

1. Sign up, verify email, select Contractor, complete required profile.
2. Create a job draft and resume after refresh/relogin.
3. Publish with canonical scope, public area, private address, requirements, and consent.
4. Confirm a different account can discover the public job but cannot see exact address.
5. Review a real applicant and send an offer.
6. Confirm address remains private until offer acceptance rule passes.
7. Message accepted participant and upload a project photo.
8. Review completion evidence, confirm or dispute, then leave one eligible review.

Expected: all records persist, every actor/transition is authorized/audited, duplicate taps do not duplicate records, and role-inappropriate actions are absent.

## Tradesperson Journey

1. Sign up, verify email, select Tradesperson, complete trade/service-area profile.
2. Discover matching real job and view requirements/privacy explanation.
3. Save application draft, refresh, resume, submit once, and withdraw on another test job.
4. Receive offer, decline one test offer and accept another.
5. Access exact address and job conversation only after acceptance.
6. Submit message, attachment, completion note/photo/checklist.
7. View confirmation and leave one eligible review.

## State and Abuse Scenarios

- Closed/paused job rejects new applications.
- Blocked users cannot discover/contact/invite/apply through alternate route.
- Suspended user cannot mutate protected workflows but can access support/appeal.
- Applicant cannot accept an offer intended for another user.
- Contractor cannot review a user with no completed relationship.
- File ID/object key tampering cannot produce another user's URL.
- Exact address is absent from list/search/API payloads before authorized release.
- Double submit, refresh, browser back, stale client, and network retry preserve valid state.

## Responsive and Accessibility Matrix

For every Gate A route verify:

- 360x800 and 390x844 phones.
- Representative iOS Safari and Android Chrome.
- 768px tablet, 1366x768 laptop, and 1440px desktop.
- Light/dark, 200% zoom/text, reduced motion, keyboard-only.
- Screen-reader labels and announcement on auth, posting, application, offer, messaging, upload, completion, review, report, and errors.
- No overlap, clipped text, inaccessible off-screen controls, horizontal page scroll, or touch target below 44px without justified exception.

## Manual Pilot Approval Evidence

- Requirement traceability rows moved to production-verified with test links.
- Source commit/build ID and deployment ledger.
- Migration apply/rollback rehearsal.
- Backup restore drill result and measured time.
- Security/authorization test report.
- Accessibility report.
- Target-device screenshots for normal, empty, loading, error, and offline states.
- Provider configuration/limit review with secrets redacted.
- Support and incident rehearsal.
- Founder, engineering, operations, and legal/safety approval owners recorded.
