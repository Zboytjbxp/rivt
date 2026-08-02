# Gate A Acceptance Contract

Gate A is approved only with automated and manual evidence against production-like infrastructure. Screenshots alone are insufficient.

## Local security-remediation evidence - 2026-08-01

- Earlier working-tree scan `65a8c581-8136-459c-9926-58220a85430d` produced 19
  artifacts and reported one medium and three low findings. Its findings were
  remediated. The pre-follow-up candidate scan
  `scan_696c3b127e03_20260802T024900Z` is sealed with 28/28 worklist coverage,
  four closed intermediate-patch candidates, zero reportable findings, and no
  deferred work. It predates the 2026-08-02 executable provider-evidence
  follow-up. That follow-up has local regression coverage and independent
  review, but no new sealed scan is claimed.
- Manual invite values are accepted only through protected input, are stored as
  hashes, and are never echoed; generated 256-bit codes remain the default.
- Synthetic monitoring writes a fixed-schema summary and neither artifacts nor
  incident issues contain response bodies or raw exception output.
- Public-document safety rejects non-approved email routes, literal invite
  authority, arbitrary placeholders, and private operational-role identity
  across all supported tracked text assets.
- Payment, incident, and recovery readiness require strict typed,
  content-bound provider receipts. This includes payment state, the private
  backup route, synthetic monitoring, error-monitor ingestion, paging delivery,
  the recent incident rehearsal, and all six recovery controls. Symlink,
  non-file, repository-external, canonical-alias, and impermissibly reused path
  or content evidence is rejected. A matching checked-in receipt is not
  provider proof. Readiness also requires an exact identity supplied by a
  trusted in-process provider verifier; the ordinary readiness CLI
  intentionally supplies no such identity and remains blocked. The current
  candidate prepares a protected read-only provider workflow for the GitHub
  synthetic check, Sentry ingestion, and disabled Railway/Stripe state, but it
  has not run as accepted provider evidence and all unsupported adapters fail
  closed.
- The candidate public stable Stripe configuration fingerprint was removed and
  independently suppressed as remediated. The protected runner now proves
  live-runtime agreement with a short-lived nonce-, timestamp-, and
  source-commit-bound HMAC derived from both Stripe secrets and exact
  enabled/scope values; the rate-limited POST route returns no proof or other
  secret-derived value.
- Backup freshness now AEAD-decrypts the newest protected artifact and
  structural-validates it as restore-usable before accepting freshness.
  Backup-role preflight rejects sequence `USAGE` or `UPDATE` and recursively
  reachable `SET`-able roles.
- Fresh verification passed `npm run build`, `npm run lint`,
  `npm run lint:security`, 425/425 unit/frontend checks, all three browser E2E
  journeys, all five required UI smoke suites, and `npm audit --omit=dev` with
  zero vulnerabilities.
- A fresh disposable loopback-only PostgreSQL 18 database at migration 42
  passed all 25 integration suites with zero failures, cancellations, or skips
  in about 22 seconds, and the cluster was stopped. This is local database
  evidence only. Exact-candidate GitHub Node 20/PostgreSQL 16 evidence has not
  been run and remains required.
- Incident readiness remains blocked with exactly 8 findings, and strict
  launch readiness remains RED with exactly 19 blockers, including
  `PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED`. The historical disabled-mode approval
  remains recorded but does not authenticate its own repository receipt. No
  deployment, provider mutation, ACH enablement, production-data action,
  resource creation, or cost is accepted by this entry.

## Current Evidence Override - 2026-08-01

The June 30 snapshot below is historical and is not current launch authority.
Follow-up security review proved that the old launch gate could pass without
continuous-backup controls and that the public incident route did not prove an
access-controlled backup contact. The current candidate now fails closed until
all of the following have real, current, content-bound evidence:

- provider-authenticated proof of the exact disabled payment state;
- a tested private backup incident route;
- tested synthetic-monitor, error-monitoring, and paging delivery;
- a recent provider-authenticated incident rehearsal;
- a recurring backup schedule and a successful backup inside the RPO;
- tested missed-run alerting and retry timing inside the RPO;
- enforced retention and an independently hosted backup copy;
- a current evidence-bound restore drill and fresh approvals; and
- the active incident launch hold is explicitly cleared.

The exact strict launch-readiness result currently contains 19 blockers:

1. `ACTIVE_LAUNCH_HOLD`
2. `BACKUP_ROUTE_UNVERIFIED`
3. `SYNTHETIC_MONITOR_MISSING`
4. `ERROR_MONITORING_MISSING`
5. `PAGING_ROUTE_MISSING`
6. `INCIDENT_REHEARSAL_MISSING`
7. `APPROVAL_FOUNDER_CONFIGURATION_MISMATCH`
8. `APPROVAL_SUPPORT_CONFIGURATION_MISMATCH`
9. `APPROVAL_LEGALSAFETY_CONFIGURATION_MISMATCH`
10. `RECOVERY_POLICY_NOT_APPROVED`
11. `BACKUP_SCHEDULE_UNVERIFIED`
12. `RECENT_BACKUP_CHECKPOINT_MISSING`
13. `MISSED_BACKUP_ALERT_UNVERIFIED`
14. `BACKUP_RETENTION_UNENFORCED`
15. `BACKUP_FAILURE_DOMAIN_NOT_INDEPENDENT`
16. `RECENT_BACKUP_ARTIFACT_RESTORE_MISSING`
17. `RECOVERY_APPROVAL_FOUNDER_MISSING`
18. `RECOVERY_APPROVAL_OPERATIONS_MISSING`
19. `PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED`

The historical approval of the disabled bank-payment configuration remains
preserved and did not enable ACH. It is not sufficient provider authentication
for the stricter current gate, which remains red until a trusted in-process
provider verifier supplies the exact typed receipt identity. Current red gates
are intentional evidence safeguards, not test regressions. Production ACH
remains disabled with runtime mode `setup_required`. No deployment, merge,
provider mutation, production-data action, resource creation, or added cost is
claimed by the current local candidate.

## Historical Evidence Snapshot - 2026-06-30

Gate A machine readiness is approved for the recorded incident, recovery, support, and legal/safety scopes. Physical-device and deeper manual accessibility evidence remains the next non-machine launch-quality boundary before broader rollout.

Machine validation refresh on 2026-06-30:

- `npm run build` OK
- `npm run lint` OK
- `npm run test` OK
- `npm run test:e2e` OK
- `npm run test:ui:shop-talk-news` OK
- `npm run test:ui:work-lifecycle` OK
- `npm run test:ui:tools` OK
- `npm run test:ui:mobile-actions` OK
- `npm audit --omit=dev` OK
- `npm run incident:readiness -- --require-ready` OK
- `npm run launch:readiness -- --require-ready` OK
- Railway production variables checked without printing secret values; PostgreSQL, S3-compatible storage, Resend email, Stripe live billing, and webhook variables are present.
- `npm run monitor:production` OK against `https://rivt.pro` after Railway deployment.

Historical machine validation refresh on 2026-06-29:

- `npm run build` ✅
- `npm run lint` ✅
- `npm run test` ✅
- `npm run test:e2e` ✅
- `npm audit --omit=dev` ✅
- `npm run incident:readiness -- --require-ready` ✅
- `npm run launch:readiness -- --require-ready` ✅
- `npm run monitor:production` against `https://rivt.pro` ✅ (`buildCommit=985e49a66a4c0966e9ec33c51e7c206e3e56985b`, controls not disabled)

Packet 08 hardening evidence now exists for:

- Production source proof: `https://rivt.pro/api/health` reports exact source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d`.
- Migration proof: production readiness and live hardening audit report `0011_shop_talk_reaction_events_immutable`, applied migrations, and zero pending migrations.
- Anonymous fail-closed proof: live hardening audit checks seven private endpoints and receives `401` for anonymous requests.
- Seed/demo proof: first hardening audit caught visible test artifacts; guarded cleanup made matching test profiles private and closed smoke organizations without deletion; final audit reports zero user-facing seed/demo findings.
- Operational controls: signup and platform-mutation kill switches are wired and exposed through readiness/provider status; both are currently disabled.
- Durable limits: auth, write, and upload throttles use shared PostgreSQL `rate_limit_windows` buckets keyed by privacy-safe subject hashes.
- Legacy bridge retirement: authenticated `/api/app-state`, `/api/events`, and `/api/payments/export.csv` bridge routes were retired in source `00147c8e3f70e246b41ed48b46550ae33cf0eb54` and remain absent from the current deployed source; live hardening smoke still reports zero seed/demo findings and anonymous fail-closed behavior.
- Manual and scripted accessibility/device smoke: `docs/quality/ACCESSIBILITY_DEVICE_MATRIX.md` records 1280x720, 390x844, and 360x800 public-shell checks with no console warnings/errors or horizontal overflow; one sub-44px auth input target-size defect was fixed and post-deploy verification measured 46px fields at 390x844. Expanded authenticated production smoke `ui-a11y-20260621043529-3efa9b` covered contractor/tradesperson 360x800 and 390x844 phones, contractor 768x1024 tablet, 1366x768 laptop, 1440x900 desktop, and contractor 390x844 with 200% root text scale. It verified top-bar search/messages/notifications/profile present, no role toggle, no More tab, no horizontal overflow after fixing Crew/network shell overflow, zero post-login console warnings/errors, zero small tap-target findings, reduced-motion preference enabled, and keyboard focus reaching named top-bar and primary-navigation targets. The smoke now fails on those authenticated-shell regressions instead of only reporting them.
- Expanded 2026-06-22 production accessibility smoke: `ui-a11y-20260622041456-3d6a3d` passed against source `d4e6f06a70e3dad8f59d54b6698b79ab08d6fd2d` after Railway deployment `17cc18db-0ac5-4f23-bf5f-955b98af38cb`. It covered eight role/viewport scenarios, six route audits per scenario, four opened top-bar surface audits per scenario, 200% root text scale, reduced motion, keyboard focus targets, landmarks, visible-image alt checks, visible-field naming checks, touch targets, console warnings/errors, and horizontal overflow. It captured 72 screenshots at `C:\Users\zboyt\AppData\Local\Temp\rivt-ui-a11y-20260622041456-3d6a3d`, found and verified fixes for a sub-44px Shop Talk search input and 200% text Inbox metric clipping, and cleaned up two disposable production accounts.
- Production synthetic monitoring: `npm run monitor:production` passes against `https://rivt.pro` and the deployed workflow schedules the public health/provider/fail-closed check every 30 minutes. The current undeployed candidate changes retained evidence to the allowlisted `production-monitor-summary.json` and limits generated incident issues to allowlisted failure metadata. Until this candidate is separately reviewed, merged, and deployed, the hosted workflow retains its prior raw-log behavior; production response/error exclusion is therefore candidate evidence, not a deployed claim.
- Incident readiness gate: `docs/operations/incident-routing.json` and `npm run incident:readiness` make incident roles, access-controlled contact-route references, support hours, alert destinations, rehearsal, and approval gaps machine-checkable without publishing personal contact data. The synthetic incident issue body includes only public role and route IDs. Current readiness is blocked because the backup role has no access-controlled route reference or successful route test from the last 30 days with matching repository evidence. Historical rehearsal and role approvals remain recorded, but they do not satisfy that missing live route proof.
- Timed isolated logical restore: temporary Railway PostgreSQL target `Postgres-3Ei3` was provisioned, migrated, populated from production through `npm run restore:logical-copy -- --apply-migrations`, and then strictly verified through `npm run restore:drill`. The copy covered 59 public tables and 1,524 rows in 1,421 ms; the verifier confirmed migration `0009_durable_rate_limits`, nine applied migrations, zero pending migrations, source/target parity across critical Gate A tables, zero count diffs, and a 220 ms verifier duration. The temporary target was deleted and no temporary restore variables remain.
- Named backup artifact restore: `npm run backup:logical-artifact` created AES-256-GCM encrypted object `backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm` in private S3-compatible storage from 59 tables / 1,524 rows in 630 ms. `npm run restore:logical-artifact -- --apply-migrations` restored that named object into isolated Railway target `Postgres-_FQz`, applied nine migrations through `0009_durable_rate_limits`, restored 59 tables / 1,524 rows, verified table/column/sequence and strict manifest-count parity with zero diffs in 13,411 ms, and `npm run restore:drill` verified the target in 1,862 ms. The temporary target was deleted, detached restore volumes were marked for deletion, and temporary restore variables were removed.
- Historical launch-readiness checkpoint: the June 22 policy and restore evidence produced a passing result under the earlier gate. That result is superseded by the 2026-08-01 override above; the current gate correctly reports blocked until continuous-backup and private-route evidence are complete.
- Approval packet: `docs/operations/GATE_A_APPROVAL_PACKET.md` summarizes the final founder/support/legal-safety approval scopes, evidence, known risk acceptance, and exact signoff fields. The packet was used for final signoff; `docs/operations/incident-routing.json` remains the machine-readable source of approval status.
- Controllable UI interaction coverage: `test/jobs-discovery.e2e.mjs` now opens top-bar search, notifications, account/profile, and messages/inbox at desktop and mobile viewports with mocked server responses. `scripts/live-ui-accessibility.js` also audits those same opened top-bar surfaces during disposable-account production runs and now records screenshot, landmark, image-alt, and field-label evidence.
- Local automated gates: `npm run build`, `npm run lint`, `npm run lint:security`, `npm run test`, `npm run test:e2e`, and `npm audit --omit=dev` pass on the Packet 08 source.

Blocking evidence still missing before broader rollout:

- Physical-device and deeper manual accessibility matrix evidence, including mobile Safari/Chrome, route-level keyboard-only workflows, screen-reader labels, and end-to-end route flows after login.
- Launch communications and final review of physical/deeper manual accessibility-device evidence.
- The remaining manual execution checklist is `docs/quality/PHYSICAL_ACCESSIBILITY_CHECKLIST.md`.

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
