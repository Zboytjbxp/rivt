# RIVT Nationwide Final Launch Audit

Date: 2026-07-09
Audit basis: `origin/master` at `c325819` plus the uncommitted `codex/nationwide-launch-hardening` preview changes
Standard applied: final nationwide public product, not a Jacksonville pilot or soft launch

## Executive verdict

**NO-GO for a nationwide final launch today.**

RIVT now has a credible, server-owned core: real authentication, email verification, contractor/tradesperson roles, jobs, applications, mutual offers, active work, job-linked messaging, project media, completion records, reviews, subscriptions, Shop Talk communities/posts/answers/reactions, reporting, and an internal moderation console. The current product can support a controlled Jacksonville launch after its existing device checklist is completed.

Nationwide changes the acceptance bar. RIVT would be exposing work opportunities, private jobsite information, business records, user uploads, subscriptions, and public community content across many jurisdictions and time zones. Six systems are not mature enough for that exposure yet:

1. Work discovery is city/state text filtering, not real radius-based geospatial matching.
2. Too many business-critical records still have device-local or dual ownership.
3. User uploads are signature-checked but explicitly stored as `not_scanned` for malware.
4. Privacy, deletion/export rights, UGC policy, and nationwide legal language are incomplete.
5. Background notifications, digests, job alerts, and retryable delivery infrastructure are incomplete.
6. Nationwide moderation, support, paging, capacity, and SLO evidence do not exist yet.

This is not a recommendation to rewrite RIVT. It is a recommendation to preserve the working vertical slices and finish the infrastructure around them before claiming nationwide readiness.

## What is strong now

### Identity and access

- Server-issued protected sessions, session rotation, revocation, and shared-device cleanup exist.
- Passwords use async scrypt with per-password salt and timing-safe comparison.
- Email verification is required before write-heavy onboarding paths.
- Google OAuth is live; Apple is configuration-gated instead of exposing a dead button.
- Sensitive write endpoints use durable PostgreSQL-backed rate limiting.
- Contractor, tradesperson, support, moderator, and admin authorization is enforced server-side.

### Work lifecycle

- Jobs, application drafts, applications, offers, mutual acceptance, active work, cancellations, and reschedule requests are server-owned.
- Exact addresses remain private until the accepted-work relationship.
- Messages, photos, daily logs, project entries, completion, disputes, and reviews are tied to accepted work.
- Recent exact-destination work correctly routes active-job photos and notifications to the intended record instead of a generic section.

### Community and moderation

- Shop Talk posts, answers, Verified Fix, reactions, media, reports, and user-created communities are server-owned.
- Public, contractor-only, and tradesperson-only community audiences are enforced in read and write paths.
- A human-facing report queue and moderation actions exist.

### Billing and truthfulness

- Stripe Checkout, webhook verification, reconciliation, customer portal, cancellation, and resume flows exist.
- Cancellation is available in product without calling or emailing support.
- The public security page explicitly avoids fake certifications or penetration-test claims.
- Demo content is isolated to explicit guest-preview mode and labeled as fictional sample data.

### Operations

- Production health exposes the deployed commit and dependency status.
- Sentry error capture and external synthetic monitoring exist.
- Logical backup/restore tooling and an approved pilot RPO/RTO policy exist.
- Gate A launch and incident-readiness scripts currently pass.

## Nationwide launch blockers

### N0-1: Work discovery does not implement location radius

Severity: P0

Evidence:

- `src/features/work/job-api.ts:445` maps job distance to `0`.
- `src/features/work/WorkWorkspace.tsx:1187` also creates a zero-distance value.
- `server/index.js:3076-3077` filters by city and region strings only.
- Profiles store `service_radius_miles`, but no latitude/longitude, geohash, PostGIS, or distance query exists.

Risk:

Nationwide users will see inaccurate "nearby" work and filters can silently exclude adjacent cities or include distant jobs with matching city text. Service radius currently looks more capable than the matching engine behind it.

Required before nationwide:

- Geocode a privacy-safe public location centroid for profiles and jobs.
- Store normalized coordinates and timezone.
- Use PostGIS or an equivalent indexed distance query.
- Apply service radius on the server, not only in client controls.
- Define behavior for rural areas, ZIP boundaries, and failed geocoding.
- Add distance accuracy, privacy, and pagination integration tests.

### N0-2: Business records still have mixed device/server ownership

Severity: P0

Evidence examples:

- Work change orders, saved searches, checklists, milestones, notes, contacts, and templates use localStorage in `src/features/work/WorkWorkspace.tsx:191-969`.
- Inbox templates, pinned/archived state, message reactions, and client threads use localStorage in `src/features/inbox/InboxCenter.tsx:32-611`.
- Reviews, crew members, and crew invites retain localStorage paths in `src/features/network/NetworkHub.tsx:280-813`.
- Bid, expense, time, invoice template, calculator, and report paths still read local records in `src/features/tools/*` and `src/features/report/reportUtils.ts:38-42`.
- `JobDetailHub` and `JobPipeline` still read a parallel `rivt.jobs.v1` store.

Risk:

Records can disappear after clearing browser storage, fail to appear on a second device, conflict with server state, or leak confusing stale information on shared devices. A nationwide business product cannot make users guess which records are durable.

Required before nationwide:

- Classify every local key as harmless preference, recoverable draft, cache, or durable business record.
- Move durable business records to server-owned schemas and APIs.
- Give drafts explicit local-only labels, timestamps, autosave, and recovery/export controls.
- Remove parallel job/review/crew/client sources once migration is complete.
- Add offline conflict policy and idempotent retry for recoverable drafts.
- Add cross-device and shared-device tests.

### N0-3: Uploaded files are not malware-scanned

Severity: P0

Evidence:

- `server/projects.js:33-67` validates file signatures but returns `reviewStatus: "not_scanned"`.
- Project media is inserted with `review_status = 'not_scanned'` at `server/index.js:4056-4058`.
- Shop Talk media uses the same state in `server/shop-talk.js:602-614`.
- The database explicitly supports `not_scanned`, `accepted`, and `rejected` in migrations `0007` and `0021`, but no scanner worker is present.

Risk:

Nationwide public uploads create a malware-hosting and unsafe-download surface. MIME checks are necessary but not sufficient.

Required before nationwide:

- Quarantine uploads until an antivirus/malware provider returns a result.
- Scan asynchronously with retry, timeout, and provider-failure handling.
- Never issue a signed download URL for quarantined or rejected objects.
- Add EXIF/privacy policy for photos and document metadata.
- Add content abuse reporting and takedown retention rules.
- Test EICAR rejection, scanner outage, oversized files, polyglots, and authorization.

### N0-4: Legal and data-rights surface is pilot-level

Severity: P0

Evidence:

- `public/legal/terms.html` contains only five short product sections.
- `public/legal/privacy.html` describes categories at a high level but does not define retention, deletion, processors, state privacy rights, cookies, appeals, or response timelines.
- No authenticated account-deletion endpoint exists.
- Profile Settings creates a support case for export at `src/features/profile/ProfileHub.tsx:1569-1576`; it is not a self-service export workflow.
- There is no published DMCA/takedown policy for nationwide user-generated content.

Risk:

Nationwide operation triggers varying privacy, auto-renewal, contractor, licensing, content, and consumer-subscription obligations. The current documents are honest but incomplete.

Required before nationwide:

- Counsel-reviewed Terms, Privacy, Subscription/Auto-Renewal, Acceptable Use, Community Guidelines, Copyright/DMCA, and state licensing language.
- Self-service account export and deletion with identity confirmation, hold exceptions, audit trail, and completion notice.
- Documented retention schedule for accounts, messages, photos, audit logs, billing, support, and moderation evidence.
- Vendor/subprocessor list and data-processing terms.
- Age eligibility and minors policy.
- State-by-state legal language matrix; never imply RIVT verifies a license unless a named process did so.

### N0-5: Notification delivery is not nationwide-grade

Severity: P0

Evidence:

- Profile Settings explicitly says background push is not available yet at `src/features/profile/ProfileHub.tsx:947`.
- `usePushNotifications` stores subscription state locally; no durable Web Push token table or send worker exists.
- No outbox, job queue, digest runner, bounce processor, retry worker, or dead-letter path is present in server code or dependencies.
- Saved searches are local-only and do not power server job alerts.

Risk:

Offers, work changes, safety notices, replies, and messages can depend on the user reopening the app. Synchronous notification creation without a delivery outbox cannot provide reliable retries under provider failure.

Required before nationwide:

- Transactional outbox written in the same transaction as the source event.
- Worker with idempotent delivery, bounded retries, dead-letter state, and metrics.
- Durable Web Push subscriptions and browser revoke cleanup.
- Email digest and instant job-alert preferences, quiet hours, unsubscribe, SPF/DKIM/DMARC, bounce and complaint processing.
- Server-owned saved searches and radius-aware matching.
- Delivery-status and deep-link integration tests for every notification type.

### N0-6: Nationwide moderation/support/on-call capacity is not established

Severity: P0

Evidence:

- The current incident-routing plan describes a Gate A pilot and Sentry as the first pilot escalation route.
- `docs/operations/GATE_A_APPROVAL_PACKET.md:75-76` defers dedicated phone/SMS paging until broader scale.
- The approved support window is not 24/7 and current staffing is founder plus one backup owner.
- No moderation SLA, after-hours escalation, law-enforcement request process, or mass-abuse runbook is published.

Risk:

Nationwide public jobs, messages, images, and trade advice create urgent safety, harassment, fraud, doxxing, and illegal-content reports outside Jacksonville support hours.

Required before nationwide:

- At least two trained on-call responders plus a moderation rotation.
- Pager destination independent of Sentry email/activity state.
- Severity definitions and SLAs for account takeover, private-address exposure, credible threats, unsafe advice, payment fraud, and illegal content.
- Escalation and evidence-preservation procedures.
- Abuse-volume dashboards and queue-age alerts.
- Rehearse account takeover, provider outage, storage exposure, malicious upload, and moderation surge scenarios.

## High-priority nationwide gaps

### N1-1: Security headers and external assessment

- The Express setup uses CORS and an origin guard, but `server/index.js:322-351` does not configure an application CSP, HSTS, frame-ancestors, Referrer-Policy, or Permissions-Policy middleware.
- Hosting may add some headers, but that has not been captured as immutable production evidence.
- No completed independent penetration test is claimed, correctly, on the Security page.

Required: define and test headers, complete an external penetration test, resolve findings, and publish the assessment scope without inventing a certification.

### N1-2: Public-signup abuse controls are incomplete

- Durable rate limits and email verification are good.
- No CAPTCHA/bot challenge, disposable-email policy, first-job review policy, signup risk score, or automated enumeration defense dashboard is evident.

Required: risk-based signup controls that preserve accessibility, first-post/job velocity limits, new-account review signals, and abuse-rate monitoring.

### N1-3: Analytics cannot prove national liquidity or retention

- The server records `onboarding.completed`, but there is no product analytics pipeline for activation, search-to-apply, first response, accepted work, completion, retention, notification delivery, or metro liquidity.

Required: server-truth analytics with a data dictionary, privacy controls, region/trade cohorting, and dashboards. Do not use client-only vanity events as launch proof.

### N1-4: Region, time, currency, and compliance are US-pilot defaults

- Several app fallbacks still default to Jacksonville in `src/App.tsx:206,390,455,2167,2229` and `server/shop-talk.js:153`.
- Job currency is fixed to USD in `server/jobs.js:174`.
- No timezone field or dual-time rendering exists for jobs/messages.
- Safety training and tax tools are US-specific but do not consistently surface jurisdiction/year limitations.

Required: region configuration, timezone storage, normalized addresses, currency formatting, state-specific licensing text, and clear jurisdiction labels. Remove Jacksonville from generic fallback logic.

### N1-5: Scale architecture has no capacity evidence

- `server/index.js` remains about 5,400 lines and owns many domains.
- `ToolsStudio.tsx` is about 3,500 lines; global and tools CSS exceed 20,000 lines combined.
- No background worker/queue exists.
- No documented load test, connection-pool capacity, rate-limit contention test, media concurrency test, or SLO dashboard exists.

Required: measured capacity before structural rewrites. Load test the real critical paths, set SLOs, tune PostgreSQL indexes/pool limits, add workers where delivery requires them, then continue strangler extraction domain by domain.

### N1-6: Accessibility evidence is incomplete

- Automated mobile/tablet/desktop accessibility smoke exists and is valuable.
- `REQUIREMENTS_TRACEABILITY.md` still marks physical iOS Safari, Android Chrome, keyboard-only, and screen-reader route evidence as outstanding.

Required: VoiceOver, TalkBack, keyboard-only, 200% zoom, reduced motion, color contrast, switch-control/touch-target, camera/file picker, and billing round-trip evidence on real devices.

### N1-7: Billing and paid entitlements need a nationwide contract

- Stripe subscription state and cancellation are real.
- The data model currently has only free/pro entitlement states.
- Tax treatment, invoices/receipts for RIVT subscription charges, failed-payment support, refund policy, dunning, and state auto-renewal copy are not captured as nationwide evidence.
- Product value still depends on records that are partly device-local.

Required: finalize paid entitlements only after durable records are truthful; add dunning/support/refund runbooks, tax analysis, receipt flow, and entitlement audit tests.

### N1-8: Account security needs a stronger high-risk path

- Session controls are good, but user MFA/passkeys are absent.
- Admin/support access is role-gated but no step-up authentication is evident for moderation, restrictions, account-type changes, export, or deletion.

Required: passkeys or TOTP, step-up auth for high-risk actions, admin device/session policy, and recovery-code/support recovery procedures.

## Product and UX audit by surface

### Landing, preview, auth, onboarding

Current status: strong direction after this pass.

- Preview now shows a clearly labeled one-year sample account for contractor and subcontractor roles.
- It demonstrates completed jobs, work value, job records, repeat relationships, reputation, active work, messaging, communities, and real app navigation.
- Demo data remains client-only and cannot be confused with live production activity.
- The background refresh bug that erased demo active work and messages is fixed.
- Auth now links to factual Security, Privacy, and Terms pages.

Remaining:

- Add a guided "show me the full workflow" tour that walks one accepted job from offer to messages, photos, invoice, completion, and review.
- Do not add more marketing slides. Let users interact with the mature workspace.
- Complete Apple provider configuration before advertising Apple login.

### Home

- Mature-demo outcome metrics are useful and clearly labeled.
- Authenticated Home has active-work and return-loop affordances.
- Continue subtracting generic cards when the same action already exists in navigation.
- Nationwide Home should prioritize urgent work, unread messages, and alerts, not network vanity counts.

### Work

- Core lifecycle is real.
- Geospatial discovery, saved-search alerts, deadlines/timezones, and server-owned workspace subrecords are the primary gaps.
- Every active-work tool launch must remain scoped to the selected active-work id.

### Crew and profiles

- Public profile discovery and limited privacy-safe fields exist.
- Server-owned connection/bench semantics are still less mature than work relationships.
- Remove remaining local crew/review/invite mirrors.
- Verification must remain evidence-state based.

### Messages and notifications

- Exact deep links and read state are substantially improved.
- Delivery infrastructure, push, quiet hours, digests, and retry evidence remain blockers.
- Pinned/archived/message reactions can remain preferences only if clearly non-critical; client threads cannot.

### Shop Talk

- Reddit-model backbone is real: user-created communities, audiences, posts, answers, votes, Verified Fix, photos, reports, and moderation.
- Nationwide requires malware scanning, moderation coverage, copyright/takedown operations, block enforcement audits, anti-spam automation, and search/index scalability.
- Safety warnings must never imply professional or code approval.

### Tools and records

- Heavy 16th, photos/records, daily log, estimate, invoice, time, expenses, and materials provide real single-user value.
- Job Photos is the strongest paid-value wedge because it is tied to accepted work and cloud storage.
- Consolidate duplicate money/work-log surfaces only after durable records and job scoping are complete.
- Every tool must declare whether data is cloud-synced, device-only, or an unsaved draft.
- Tax, rate, contract, and safety outputs need jurisdiction/year disclaimers and source/version metadata.

### Profile, billing, trust, support

- Honest subscription management and public Security page are strong.
- Legal documents, self-service data rights, step-up auth, and nationwide support operations are not complete.
- Never replace missing process with a badge.

### Mobile, tablet, desktop, PWA

- The app has extensive phone work and a functioning desktop shell.
- Real-device acceptance is incomplete.
- Background push/offline sync is not ready for a nationwide PWA promise.
- Native iOS/Android wrappers are not a launch blocker; truthful, reliable PWA behavior is.

## Nationwide acceptance gates

RIVT may call itself nationwide-ready only when all items below have evidence:

1. Radius-based server discovery passes privacy, accuracy, and load tests.
2. No durable business record depends solely on localStorage.
3. Upload quarantine and malware scanning are live and fail closed.
4. Self-service export/deletion and counsel-reviewed nationwide policies are live.
5. Notification outbox, retries, push/email delivery, alerts, quiet hours, and unsubscribe work.
6. Moderation and incident queues have measured SLAs and at least two on-call humans.
7. Independent penetration test findings are resolved or risk-accepted in writing.
8. Physical accessibility matrix passes on representative iOS, Android, keyboard, and screen readers.
9. Capacity tests establish launch limits and SLO dashboards alert before exhaustion.
10. Product analytics can measure liquidity, activation, retention, safety, and support by region/trade.
11. Billing tax, dunning, refund, receipts, auto-renewal, and entitlement behavior are reviewed and tested.
12. A staged multi-region rollout proves one new metro can launch by configuration without code forks.

## Recommended build order

### Train 1: Data truth and location

- Inventory/local-state classification.
- Server ownership for work subrecords, clients, crew, saved searches, and money records.
- Geocoding, timezone, coordinates, and radius matching.
- Cross-device/offline conflict tests.

### Train 2: Upload and account trust

- Malware quarantine/scanner worker.
- Self-service export/deletion.
- Retention schedule and audit trail.
- Security headers and step-up authentication.

### Train 3: Delivery and moderation operations

- Notification outbox/worker, Web Push, email digests, job alerts, bounce handling.
- Moderation SLA dashboards and paging.
- Abuse/risk controls and surge runbooks.

### Train 4: Legal, accessibility, and billing

- Counsel-reviewed nationwide policy set.
- Physical accessibility acceptance.
- Billing tax/dunning/refund/receipt completion.
- Jurisdiction/version labeling for regulated tools.

### Train 5: Scale proof and rollout

- Load/capacity tests and SLOs.
- Product analytics and metro liquidity dashboards.
- Launch a second metro by configuration, then expand in measured cohorts.

## Final call

The correct next claim is: **RIVT is approaching a controlled Jacksonville launch with a real, trustworthy core.**

The incorrect claim is: **RIVT is a finished nationwide platform.**

The gap is now concrete and solvable. Finish the six N0 systems, prove the twelve acceptance gates, and preserve the current rule that RIVT never substitutes fake success, fake verification, or fake activity for missing infrastructure.
