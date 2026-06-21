# Gate A Acceptance Contract

Gate A is approved only with automated and manual evidence against production-like infrastructure. Screenshots alone are insufficient.

## Current Evidence Snapshot - 2026-06-20

Gate A is not approved yet.

Packet 08 hardening evidence now exists for:

- Production source proof: `https://rivt.pro/api/health` reports exact source `f846f700ee23c911a250b16afe1623723c9e760a`.
- Migration proof: production readiness and live hardening audit report `0009_durable_rate_limits`, nine applied migrations, and zero pending migrations.
- Anonymous fail-closed proof: live hardening audit checks seven private endpoints and receives `401` for anonymous requests.
- Seed/demo proof: first hardening audit caught visible test artifacts; guarded cleanup made matching test profiles private and closed smoke organizations without deletion; final audit reports zero user-facing seed/demo findings.
- Operational controls: signup and platform-mutation kill switches are wired and exposed through readiness/provider status; both are currently disabled.
- Durable limits: auth, write, and upload throttles use shared PostgreSQL `rate_limit_windows` buckets keyed by privacy-safe subject hashes.
- Legacy bridge retirement: authenticated `/api/app-state`, `/api/events`, and `/api/payments/export.csv` bridge routes were retired in source `00147c8e3f70e246b41ed48b46550ae33cf0eb54` and remain absent from the current deployed source; live hardening smoke still reports zero seed/demo findings and anonymous fail-closed behavior.
- Manual and scripted accessibility/device smoke: `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md` records 1280x720, 390x844, and 360x800 public-shell checks with no console warnings/errors or horizontal overflow; one sub-44px auth input target-size defect was fixed and post-deploy verification measured 46px fields at 390x844. Authenticated production smoke `ui-a11y-20260621005027-1e207f` also covered contractor mobile, tradesperson mobile, and contractor desktop shells with top-bar search/messages/notifications/profile present, no role toggle, no More tab, no horizontal overflow, zero post-login console warnings/errors, zero small tap-target findings, reduced-motion preference enabled, and keyboard focus reaching named top-bar and primary-navigation targets. The smoke now fails on those authenticated-shell regressions instead of only reporting them.
- Production synthetic monitoring: `npm run monitor:production` passes against `https://rivt.pro` and `.github/workflows/production-synthetic.yml` schedules the same public health/provider/fail-closed check every 30 minutes.
- Restore-drill tooling: `npm run restore:drill` now exists and requires an explicitly confirmed isolated `RESTORE_DATABASE_URL`; it verifies migration `0009_durable_rate_limits`, critical table presence, row counts, optional source/target count parity, and duration.
- Local automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` pass on the Packet 08 source.

Blocking evidence still missing before named customer/pilot launch:

- Timed restore into isolated PostgreSQL with measured recovery time and recovery point. The verifier exists, but no isolated target has been provisioned/restored yet.
- Dedicated error monitoring, alert rules, paging/incident owner routing, and one incident rehearsal. The scheduled GitHub synthetic check is only a first external tripwire.
- Physical-device and deeper manual accessibility matrix evidence, including mobile Safari/Chrome, 200% text/zoom, keyboard-only, reduced motion, screen-reader labels, and end-to-end route flows after login.
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
