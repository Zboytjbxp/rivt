# RIVT Master Product and Build Contract

Version: 1.3
Status: Source of truth for product, design, engineering, safety, and launch
Audience: Any AI coding agent, engineering team, designer, operator, or reviewer
Last audited: 2026-06-18

### How to interpret this contract

This document describes both the near-term launch and the longer product target. It is not permission to build every section at once.

Instruction precedence, highest first:

1. Safety, privacy, legal boundaries, authorization, and data-preservation rules.
2. The approved release gate and active phase in `docs/delivery/BUILD_STATE.md`.
3. Explicit acceptance criteria and state-machine invariants.
4. Architecture and design-system requirements.
5. Research references and future-platform guidance.

If two requirements conflict, stop the affected implementation, record the conflict and recommended resolution in a decision record, and continue only with unaffected work. Never resolve a conflict by silently choosing the easier requirement.

Normative language:

- **Must / required** means the release cannot pass its applicable gate without evidence.
- **Should** means the default expectation; a documented decision may justify a different approach.
- **May / future** means intentionally optional or deferred.

The current release gate controls scope. Future requirements should influence safe data and architecture choices, but they must not produce unfinished navigation, dead controls, placeholder providers, or speculative complexity in the current product.

## 1. Mission

Build RIVT, the professional network and operating platform for skilled trades.

RIVT connects licensed contractors, trade business owners, subcontractors, independent skilled tradespeople, and specialty crews. It helps them find work, find qualified help, build trusted professional relationships, document projects, communicate, manage records, and operate more of their business in one place.

RIVT is not a homeowner marketplace, consumer lead marketplace, staffing agency, employer-of-record service, payroll provider, escrow service, or generic social network. Homeowners are not users in the launch product. Never add homeowner-facing language, flows, personas, navigation, or acquisition assumptions unless the product owner explicitly changes this boundary.

Positioning: **Where skilled trades connect.**

Product promise: A contractor can find credible help and coordinate work without resorting to scattered texts, Facebook groups, spreadsheets, and staffing markups. A tradesperson can turn real skills and reputation into better opportunities, stronger relationships, and a durable professional identity.

## 2. Non-Negotiable Product Principles

1. Trades only. Every screen and workflow must serve contractors or tradespeople.
2. Network plus marketplace. Jobs create immediate utility; profiles, crews, Shop Talk, tools, records, and reputation create repeat use.
3. Trust is evidence, not decoration. Distinguish self-reported, uploaded, reviewed, verified, expired, rejected, and unavailable claims.
4. Mobile first, field usable. Design for sunlight, cellular connections, one-handed use, dirty hands, interruptions, and short attention windows.
5. Premium means clarity. Remove repetition, avoid nested cards, show one primary action per decision, and progressively disclose complexity.
6. Never fake readiness. No dead buttons, fake success, demo records in production, placeholder provider checks, or interfaces unsupported by real persistence.
7. Preserve user work. Drafts, uploads, messages, invoices, and form progress must survive ordinary interruptions and recoverable failures.
8. Privacy by default. Reveal only the minimum information needed at each relationship stage.
9. Human accountability. High-impact moderation, verification, suspension, and dispute decisions must be reviewable and auditable.
10. Build for measurable outcomes, not feature count.

## 3. User Model and Roles

### Contractor

A contractor, trade business owner, or authorized company representative who can post work, find and invite tradespeople or crews, hire, coordinate projects, document work, generate invoices or records, and maintain a professional network. A Contractor-role account is not automatically licensed. The profile and each job must represent license status accurately and must not imply that a credential covers work, people, jurisdictions, or scopes it does not cover.

### Tradesperson

An independent subcontractor, skilled trades worker, freelancer, or crew member who can discover opportunities, apply, accept invitations, share a profile or portfolio, communicate, complete and document work, build reputation, and participate in Shop Talk.

### Admin and Support

Internal roles with least-privilege permissions. Separate support, moderator, verifier, finance-ops, analyst, and super-admin capabilities. Do not create one omnipotent shared admin account.

### Role rules

- Primary role is selected during onboarding and is not changed casually from the application header.
- Remove contractor/tradesperson mode toggles from the normal UI.
- If dual-role support is introduced later, use separately configured professional identities and an explicit profile-switching flow with audit history.
- Authorization is enforced on the server. Hiding a control is not authorization.

## 4. Launch Scope

### Gate A — First-customer pilot

- Email/password authentication and verified Google OAuth.
- Secure account recovery, email verification, session management, sign out, and account deletion request.
- Role-correct onboarding and profile setup.
- Contractor job creation, editing, publishing, pausing, and closing.
- Tradesperson job discovery, essential filtering, applying, withdrawing, and application drafts.
- Applicant review, invite, hire offer, acceptance handshake, cancellation, and status history.
- Job-linked messaging with unread state and attachments.
- Basic professional search and profile sharing.
- Project records with photos, files, notes, timestamps, and exportable closeout report.
- Completion confirmation, proof, two-sided review flow, response/dispute handling, and reputation display.
- In-app notifications for launch-critical job and message events.
- Managed PostgreSQL persistence and managed object storage.
- Admin-only readiness, user support, moderation, audit, and safe recovery tools needed for pilot workflows.
- Responsive PWA shell, installability, offline-safe read behavior, and update handling.
- Legal consent, privacy, terms, community guidelines, SMS consent, report/block, and data controls.
- Production monitoring, backups, restore drill, error tracking, analytics, runbooks, and staged release controls.

Pilot users must be explicitly invited and supported. A pilot may launch without every later module, but it may not launch with fake success, data-loss risk, broken authorization, missing recovery, or unsupported safety/legal claims.

### Gate B — Jacksonville public launch

- Crew/network connections, saved/recent collaborators, trusted crews, direct professional outreach, blocks, and reports.
- Job templates, saved searches, alerts, improved matching, deadlines, rescheduling, and day-of readiness.
- Full project documentation: albums/phases, annotations, activity history, share links, and reports.
- Shop Talk Q&A with search, trade filters, voting, reporting, Verified Fix, safety treatment, and moderation.
- Trade News as a separate Shop Talk mode with provenance, date, thumbnail, summary, original article link, and source governance.
- Focused tools: validated construction calculator, estimates, invoices, mileage/per-diem, and project documentation.
- Invoice PDF, persistent records, and reliable in-app/email delivery; SMS links only after compliant production messaging is approved.
- Notification center, batching, preferences, quiet hours, and production-safe channel delivery.
- Launch-scope license/insurance evidence workflows with definitions, expiration, review, and appeal.
- Complete support, moderation, verification, incident, analytics, and marketplace-health operations for public access.

### Gate C — Expansion platform

- Recurring and bulk job workflows, deeper organization controls, advanced reports, broader integrations, and multi-market operations.
- AI-assisted matching, estimating, summaries, moderation triage, and compliance-resource suggestions only after evaluation and human-control requirements pass.
- Subscription entitlements after pricing, liquidity, billing support, and downgrade behavior are approved.
- Native applications only when PWA evidence justifies their cost and shared API contracts are stable.

All later sections describe the complete target platform unless they explicitly name Gate A, Gate B, or Gate C. Every requirement must be tagged to a gate in the traceability matrix before implementation.

### Explicitly deferred unless already reliable

- Homeowner access.
- On-platform job payment processing, escrow, payroll, employer-of-record, tax filing, or automatic 1099 issuance.
- Automated legal, licensing, insurance, tax, safety, or code-compliance conclusions.
- Public follower-count social mechanics, entertainment feed, stories, or engagement bait.
- Fully automated bans or verification approvals without appeal.
- Nationwide launch before one market reaches defined liquidity and support thresholds.

## 5. Information Architecture

### Mobile navigation

Exactly five persistent destinations:

1. Home
2. Work
3. Crew
4. Shop Talk
5. Tools

Messages, notifications, global search, and profile are compact top-bar actions. Settings, legal, support, feedback, billing, notification preferences, account security, and sign out live under the profile menu. Do not use a catch-all More drawer for primary workflows.

### Desktop navigation

Use a restrained left sidebar with the same conceptual destinations. Secondary destinations belong in contextual subnavigation or the profile menu. Maintain naming parity between mobile and desktop.

### Contextual creation

- Work: Post job for contractors; saved/search actions for tradespeople.
- Crew: Invite or share profile based on role and relationship state.
- Shop Talk: Ask a question.
- Tools: Create the selected artifact, never a generic global plus button.

### Global search

Search jobs, people/companies, crews, Shop Talk, and tools. Group results by type, expose filters, support recent searches, handle no results directionally, and never mix private records into public discovery.

## 6. Core Domain Model

Design normalized, migration-backed entities for at least:

- users, authentication identities, sessions, devices
- organizations, organization memberships, invitations, roles
- professional profiles, trade specialties, service areas, availability
- licenses, insurance records, certifications, verification cases, evidence files
- connections, blocks, reports, saved people, crews, crew memberships
- jobs, job locations, job requirements, templates, recurrence rules, status events
- applications, invitations, offers, acceptance confirmations, cancellations, reschedules
- conversations, participants, messages, attachments, delivery/read state
- project records, albums, photos, files, annotations, notes, tags, activity events
- completion submissions, completion confirmations, reviews, disputes, responses
- Shop Talk posts, answers, votes, flair, Verified Fix state, reports, moderation actions
- news sources, articles, ingestion history, deduplication, editorial state
- invoices, line items, recipients, delivery attempts, payment log entries, exports
- notifications, preferences, batches, channel attempts, consent history
- subscriptions, entitlements, trials, billing state if subscriptions are enabled
- support tickets, internal notes, account actions, audit logs
- feature flags, experiments, jobs/queues, provider events, webhooks, dead letters

Every important status must be represented as a state machine with allowed transitions, actor, timestamp, reason, and idempotency rules. Do not infer business state from button labels or scattered booleans.

## 7. Key State Machines

### Job

Draft -> Published -> Receiving applications -> Offer pending -> Accepted -> Active -> Completion pending -> Completed -> Payment recorded -> Closed

Also support Paused, Cancelled, Expired, Disputed, and Archived with explicit transition rules. A filled or closed job must stop accepting applications immediately.

### Application and hiring

Draft -> Submitted -> Viewed -> Shortlisted or Declined -> Offer sent -> Accepted or Declined -> Confirmed

The contractor selecting a person is not enough. The tradesperson must accept the work. Both users receive a clear confirmation with start date, job context, address-access rules, and messaging access.

### Verification

Not started -> Submitted -> Under review -> Needs information -> Approved -> Expiring -> Expired

Also support Rejected and Revoked. Show what was checked, by whom/provider, when, and when it expires. Never label uploaded evidence as verified before review.

### Invoice delivery

Draft -> Finalized -> Queued -> Sent -> Delivered or Failed -> Viewed -> Paid externally or Disputed -> Closed

Delivery failure must be visible, retryable, and logged. Logging payment is recordkeeping, not proof that RIVT processed funds.

## 8. Experience Requirements

### First-run experience

- Ask only what is required to create the right role-specific experience.
- Explain why location, trade, and contact verification are requested.
- Save each completed step.
- Allow safe exit and resumption.
- End at a useful first action, not a generic dashboard.
- Provide a dismissible checklist that remains accessible later.

### Empty states

Every empty list needs a purpose-specific icon, plain explanation, and one relevant next action. Never show demo content to avoid emptiness.

### Loading and feedback

- Show the application shell immediately and use skeletons for content.
- Use inline progress for uploads and long operations.
- Use consistent success, error, warning, and info toasts.
- Never clear user input after a failed submission.
- Distinguish queued, sending, sent, delivered, failed, viewed, and read.

### Forms

- Use progressive steps for long workflows.
- Validate on blur and submit without punishing normal typing.
- Place errors beside the affected field and summarize when needed.
- Preserve drafts locally and on the server when authenticated.
- Warn before abandoning unsaved changes.
- Use native mobile input modes, autocomplete, sensible defaults, and minimal typing.

### Cards and interaction semantics

- Static information must look static.
- Interactive rows need a clear affordance and pressed/focus state.
- Avoid cards nested inside cards.
- One dominant action per card.
- Green means successful, active, or ready; amber means pending or caution; red means error/destructive; teal means informational. Neutral facts use neutral surfaces.

## 9. Design System

Use the approved RIVT logo assets exactly, not generated approximations. Support correct light and dark variants. Maintain the locked tagline: **Where skilled trades connect.**

Create code tokens for:

- semantic color roles in both themes
- typography scale, line height, and weights
- 8px spacing family with documented exceptions
- radii no larger than 8px unless required by the approved mark or native control
- elevation and border rules
- motion duration and easing
- focus rings and accessibility states
- minimum 44x44px touch targets
- responsive breakpoints and content widths

Build reusable primitives for button, icon button, input, select, segmented control, chip, badge, avatar, toast, dialog, drawer, bottom sheet, empty state, skeleton, error state, confirmation, data table, pagination/infinite loading, file uploader, media viewer, status timeline, JobCard, PersonCard, and NewsCard.

Both themes are complete products. Test every route in light and dark. Never ship a toggle for an incomplete theme.

## 10. Project Documentation, CompanyCam-Inspired Capability

Build an original RIVT project-record system, informed by the field utility of professional photo documentation products without copying protected branding or interface expression.

Required capabilities:

- Create a project record independently or from an accepted job.
- Capture/upload multiple photos and videos with background-safe retries.
- Preserve original media privately; create optimized derivatives for list, card, and detail use.
- Timestamp records and optionally capture location only with informed permission.
- Add captions, tags, trade, phase, room/area, and creator.
- Annotate images with arrows, boxes, measurements, and text while preserving originals.
- Organize media into albums, phases, before/after pairs, and completion sets.
- Show an immutable activity timeline for uploads, edits, comments, approvals, and exports.
- Share through expiring, revocable links with configurable access and no accidental project-wide exposure.
- Produce branded PDF reports containing selected media, captions, dates, and project details.
- Search by project, address fragment, job, tag, creator, date, and caption.
- Queue offline capture and synchronize later without duplicates.
- Detect upload conflicts, retry safely, and display unresolved failures.
- Enforce role-based access and server-side ownership checks on every media request.

## 11. Tools as Focused Mini-Apps

Each tool opens as a focused workspace with its own state, history, settings, and share/export behavior. It must not feel like a form embedded in a noisy dashboard.

### Construction calculator

- Large, glove-friendly keypad and readable result.
- Feet/inches/fractions and metric modes.
- Heavy/light fraction adjustment, halve/double, memory, history, undo, and copy.
- Separate miter, crown, spacing, stair, concrete, drywall, roofing, flooring, and conversion modes only when calculations are validated with test vectors.
- Show assumptions and formulas where mistakes have safety or cost consequences.
- Never present a calculator output as engineering, code, or safety approval.

### Estimates and invoices

- Customers/recipients, line items, labor/material/tax/discount, notes, terms, numbering, status, PDF, duplicate, edit, archive.
- Start empty when opened directly; prefill only when intentionally launched from a job.
- Email the artifact and optionally send an SMS link using consented channels.
- Track delivery attempts and failures.
- Keep immutable snapshots of finalized versions and audit subsequent revisions.

## 12. Shop Talk and Trade News

### Shop Talk

Launch as practical Q&A, not an engagement feed. Require one flair from Question, Discussion, Help Wanted, Share, or Job Question. Search is the first step to asking. Filter by trade and location only when relevant.

Only the asker can mark one response as Verified Fix. This means accepted by the asker, not professionally certified by RIVT. Display that distinction. Support reassignment, voting, reporting, moderation warning banners, and locked threads.

Use community titles such as First Assist, Mentor, Top Hand, and Crew Lead. Do not use regulated licensing titles as gamification.

### Trade News

- Separate toggle or tab inside Shop Talk.
- Original-source link must work and open safely.
- Show source, publication date, headline, concise excerpt, relevant thumbnail, and topic/trade tags.
- Deduplicate syndicated stories.
- Store canonical URL and ingestion provenance.
- Respect publisher terms, robots rules, licensing, attribution, and excerpt limits.
- Never fabricate a thumbnail or imply endorsement.
- Clearly label sponsored, partner, editorial, automated-summary, and community-submitted content.
- Remove stale or broken sources and provide a report-link action.

## 13. Trust, Safety, and Marketplace Integrity

- Exact street address is hidden before mutual acceptance except where the contractor explicitly shares it.
- Phone/email visibility follows relationship stage and user choice.
- Blocked users cannot discover, message, invite, apply to, or receive notifications about each other.
- Report flows exist for users, jobs, messages, media, reviews, and Shop Talk content.
- Reviews require a completed relationship and are protected against duplicates and retaliatory manipulation.
- Verification badges have definitions and expiration behavior accessible from the badge itself.
- High-risk content involving electrical, gas, structural, legal, licensing, tax, or safety advice receives contextual caution and reporting tools.
- Detect spam, scraping, credential stuffing, mass invitation, review rings, duplicate accounts, suspicious location changes, and abusive upload patterns.
- Rate limits are role/action aware and return understandable retry guidance.
- Appeals exist for content removal, verification rejection, and account enforcement.

## 14. Authentication, Authorization, and Security

Use OWASP ASVS as the application-security verification baseline.

- OAuth uses authorization code flow, state, nonce where applicable, exact redirect allowlists, and secure server-side exchange.
- Passwords use a modern adaptive hash; never log or expose credentials.
- Sessions use secure, HttpOnly, SameSite cookies or an equivalently reviewed design; rotate after authentication and privilege changes.
- Support session/device review and remote revocation.
- Require step-up authentication for security changes, destructive account actions, admin actions, and sensitive exports.
- Apply CSRF protection where cookie authentication is used.
- Validate and authorize every API request server-side.
- Store secrets only in managed environment configuration; provide rotation runbooks.
- Encrypt transport everywhere and sensitive data at rest where appropriate.
- Prevent injection, XSS, SSRF, path traversal, insecure direct object references, unsafe redirects, and mass assignment.
- Apply strict upload type/size checks, malware scanning, metadata handling, signed URLs, private buckets, and lifecycle rules.
- Content Security Policy, secure headers, dependency scanning, secret scanning, and lockfile review are release requirements.
- Admin actions are immutable audit events. Logs must not contain tokens, passwords, raw identity documents, or excessive personal data.

## 15. Privacy, Consent, and Data Lifecycle

- Collect only needed data and explain its purpose in context.
- Record versioned acceptance of Terms, Privacy Policy, community rules, and job consent.
- Record SMS consent with source, timestamp, purpose, and phone number. Honor STOP/HELP and provider requirements.
- Provide notification preference and marketing-consent separation.
- Define retention periods for accounts, messages, project records, verification evidence, logs, analytics, support data, and backups.
- Support account deletion, legal holds, export, correction, and anonymization where appropriate.
- Explain what deletion can and cannot remove from shared business records or legally retained audit history.
- Remove precise location metadata from publicly served media unless explicitly needed and consented.
- Keep production data out of lower environments; use synthetic fixtures.

## 16. Messaging and Notification Reliability

- Persist messages before acknowledging success.
- Use idempotency keys and provider event IDs.
- Maintain channel attempt state and retry policy.
- Verify webhook signatures and tolerate duplicate/out-of-order events.
- Dead-letter permanently failed jobs for operator review.
- Do not retry permanent failures indefinitely.
- Respect quiet hours, channel preferences, blocks, account state, and consent before enqueueing.
- Batch low-priority marketplace activity; keep direct messages, offers, security, and account events distinct.
- Provide unsubscribe/opt-out controls appropriate to each channel.
- Twilio credentials and sender identities stay server-side.

## 17. Reliability and Failure Recovery

For every workflow, specify normal, loading, empty, partial, stale, offline, permission-denied, validation-error, provider-failure, and retry states.

Required recovery behavior:

- Network interruption: preserve work, show offline state, retry safely.
- Double tap/reload: idempotent mutation; no duplicate job, application, message, invoice, charge, or upload.
- Upload failure: per-file status, resumable/retryable queue, remove/replace control.
- Database outage: fail closed for writes, degrade read experiences where safe, never claim success.
- Object-storage outage: preserve metadata intent and queue or clearly reject; never create broken success records.
- Email/SMS outage: core in-app action succeeds when appropriate, delivery is marked queued/failed, operators can replay.
- OAuth/provider outage: retain email login/recovery path and show truthful status.
- Stale client: detect incompatible version, save drafts, refresh safely.
- Service worker update: notify, activate without data loss, prevent mixed incompatible bundles.
- Migration failure: stop deployment, preserve previous release, document rollback/forward-fix path.
- Queue backlog: alert before user-facing SLA breach and expose operator replay tools.
- Corrupted derivative: keep original, regenerate derivative.
- Lost device/session theft: revoke sessions and invalidate sensitive links.
- Account suspension: block protected actions consistently while allowing appeal/support access.

Define recovery point objective, recovery time objective, backup frequency, retention, encryption, ownership, and restore-test schedule. A backup is not considered working until a restore drill succeeds.

## 18. Architecture Requirements

The implementation may improve the current stack, but changes require written rationale, migration plan, cost impact, operational ownership, rollback plan, and proof that user data and URLs remain safe.

Recommended boundaries:

- Responsive React PWA frontend with typed API client and route-level splitting.
- Server API as the authorization and business-rule boundary.
- PostgreSQL as transactional source of truth.
- Private S3-compatible object storage with signed access and derivatives.
- Durable queue for notifications, media processing, exports, imports, and webhooks.
- Provider adapters for identity, email, SMS, billing, storage, analytics, and error reporting.
- Admin surface isolated by authorization and preferably deployment boundary.

Use database migrations, foreign keys, constraints, transactions, indexed access paths, cursor pagination, UTC timestamps, stable identifiers, and soft deletion only where recovery/audit needs justify it.

API contracts must be versionable, typed, documented, idempotent for retried mutations, and consistent in error shape. Never expose provider-specific details directly to UI components.

## 19. Performance and Accessibility Budgets

- Meet WCAG 2.2 AA for launch workflows.
- Complete keyboard use, visible focus, semantic landmarks, meaningful labels, error announcements, reduced motion, 200% zoom/text resizing, and non-color status cues.
- Test screen-reader behavior on authentication, navigation, forms, messaging, job application, invoice, and moderation/report flows.
- Set measurable budgets for LCP, INP, CLS, JS bundle, image weight, API p95, search p95, and upload acknowledgment.
- Use responsive derivatives, lazy loading, virtualized or paginated long lists, request cancellation, and route-level code splitting.
- Avoid blocking initial render on nonessential providers.
- Monitor real-user performance by device/network class without collecting unnecessary personal data.

## 20. Analytics and Marketplace Health

Create a versioned event taxonomy with event owner, purpose, properties, privacy classification, and validation. Never ship ad hoc event names.

Measure:

- signup completion and time to first value by role
- profile completion and verification funnel
- jobs posted, qualified applications per job, time to first qualified response, time to acceptance
- invite acceptance and offer acceptance
- active-job completion and cancellation reasons
- message response time and unread aging
- project-record adoption and upload success
- Shop Talk search success, unanswered rate, response quality, Verified Fix rate
- news source/link health and useful click-through
- invoice creation, delivery success, view, and external-payment recording
- retention by role, trade, market, acquisition source, and achieved-value milestone
- reports, blocks, disputes, fraud signals, support volume, resolution time
- marketplace liquidity and concentration by geography/trade

Define north-star and guardrail metrics. Recommended north-star: **successful trusted work connections completed per active market**, supported by time-to-match and repeat-collaboration rate. Guard against spam, low-quality applications, unsafe advice, complaint rate, and support burden.

## 21. Support and Internal Operations

Provide an in-product help center with searchable articles, contextual help, contact support, ticket status, and emergency/security reporting. Do not offer live channels unless staffing and response hours are real.

Support console requirements:

- Search users, organizations, jobs, messages metadata, invoices, reports, and provider events with strict access controls.
- See a timeline of relevant account and workflow events.
- Add internal notes distinct from user-visible replies.
- Impersonation is disabled by default; if ever introduced, require approval, visible banner, reason, time limit, and audit.
- Resend verification, revoke sessions, replay failed notifications, restore eligible soft-deleted records, and escalate cases.
- Redact sensitive evidence based on staff role.
- Use reason codes for account changes.
- Track first response, resolution, reopen, escalation, and satisfaction.

Create runbooks for login failure, account takeover, offensive content, unsafe advice, failed upload, missing message, invoice delivery failure, suspected fraud, privacy request, legal request, provider outage, and data incident.

## 22. Admin Safety

- Separate production and nonproduction access.
- Require MFA and step-up authentication.
- Least privilege and periodic access review.
- Two-person approval for permanent deletion, bulk enforcement, secret rotation, large exports, and high-impact configuration changes.
- Preview affected records before bulk operations.
- Make destructive actions reversible when legally and technically possible.
- Provide kill switches for registration, posting, applications, uploads, messaging, SMS/email, news ingestion, billing, and risky feature families.
- Feature flags have owner, purpose, audience, creation date, expiration/review date, and safe default.

## 23. Content, Copy, and Terminology

Create a locked terminology glossary. Use Contractor, Tradesperson, Crew, Job, Application, Invite, Offer, Active work, Project record, Shop Talk, Verified Fix, Invoice, and Payment record consistently.

Voice is direct, capable, respectful, and plainspoken. Avoid corporate HR language, Silicon Valley hype, childish gamification, condescension, fake urgency, and legal conclusions. Buttons describe the action. Errors say what happened and what the user can do next.

All user-facing strings must be centralized or localization-ready. Include dates, time zones, currencies, pluralization, long names, large numbers, and future translation expansion in layout testing.

## 24. Monetization and Entitlements

Do not let pricing weaken marketplace liquidity before the network has density. Define entitlements server-side. A hidden button is not a paywall.

If subscriptions launch:

- Free trial requires clear start/end and no surprise charge.
- Base and premium capabilities are plainly compared.
- Existing records remain accessible after downgrade unless legal/security constraints require otherwise.
- Failed payment enters a documented grace period and recovery flow.
- Cancellation is self-service and honest.
- Webhooks are signed, replay-safe, idempotent, and reconciled.
- Pricing, tax, invoices, refunds, and support ownership are documented.

RIVT does not take a percentage of job payments at launch and does not imply escrow or payment protection.

## 25. Testing Contract

Testing is part of the feature, not a final cleanup step.

Required layers:

- Unit tests for calculations, permissions, state transitions, ranking, notification policy, and formatting.
- Database tests for constraints, migrations, tenant isolation, deletion, and concurrency.
- Contract tests for API shapes and provider adapters.
- Integration tests using sandbox/fake providers.
- End-to-end tests for each critical role journey.
- Accessibility tests plus manual keyboard/screen-reader review.
- Visual regression at representative mobile, tablet, laptop, and wide desktop sizes in both themes.
- Security tests for authorization bypass, object ownership, upload abuse, rate limits, session handling, webhooks, and sensitive logging.
- Load tests for search, feeds, job spikes, messages, notification batches, and media upload.
- Backup restore and disaster recovery exercises.
- Mobile device testing on current Android Chrome and iOS Safari, including installed PWA behavior.

Critical end-to-end journeys:

1. New contractor signs up, verifies, completes onboarding, posts a job, reviews applicant, sends offer, receives acceptance, messages, records project, confirms completion, sends invoice, and reviews.
2. New tradesperson signs up, builds profile, finds job, saves draft, applies, accepts offer, messages, uploads completion proof, receives review, and adds portfolio item.
3. User finds and connects with another professional without a job posting.
4. User asks Shop Talk question, receives answer, marks Verified Fix, and reports unsafe content.
5. User opens Trade News, sees valid image/source metadata, and reaches the canonical article.
6. User captures project photos offline, reconnects, syncs once, annotates, shares an expiring report, and revokes it.
7. User creates an invoice, delivery fails, sees failure, retries, recipient views, and payment is recorded externally.
8. User blocks another user; all discovery, messaging, and invite pathways enforce the block.
9. Support resolves a recoverable account issue without accessing prohibited private data.
10. Deployment rolls back while existing sessions, drafts, and records remain coherent.

## 26. Definition of Done

A feature is complete only when:

- Real backend persistence and authorization exist.
- Loading, empty, success, error, offline, retry, and permission states are designed.
- Responsive behavior works on small and large screens.
- Light and dark modes are correct if both are offered.
- Keyboard, screen reader, focus, contrast, touch target, and text scaling requirements pass.
- Analytics and audit events are intentional and privacy reviewed.
- Tests cover normal and high-risk paths.
- Monitoring and operator recovery exist.
- Copy is final and terminology consistent.
- No placeholder, seed, fake status, dead button, or console error remains.
- Documentation and runbook are updated.
- Acceptance evidence includes test output and screenshots of representative states.

The phrase "implemented" is forbidden when only UI, mock data, local storage, hardcoded success, or an unverified provider call exists. Report the exact maturity level: designed, frontend-only, API-backed, persisted, provider-connected, production-verified, or launch-approved.

## 27. Launch and Operations Checklist

### Product

- Scope frozen; deferred work recorded.
- All primary role journeys pass against production-like infrastructure.
- Empty market experience is useful and honest.
- No production seed/demo content.
- Support and moderation staffing expectations match what the UI promises.

### Security and privacy

- Threat model reviewed.
- OWASP ASVS launch subset verified.
- Secrets rotated and scanning clean.
- Admin MFA and least privilege active.
- Terms, Privacy, consent records, SMS rules, retention, deletion/export, and incident contacts ready.
- External security review or focused penetration test completed for auth, authorization, uploads, messaging, and admin.

### Data and reliability

- Production migrations rehearsed on a sanitized copy/representative dataset.
- Automated backups running; restore drill passed and timed.
- Object-storage lifecycle, CORS, private access, and signed URLs verified.
- Queue retries, dead letters, replay, and alerts tested.
- RPO/RTO documented.

### Providers

- OAuth production consent and redirects verified.
- Domain email authentication configured.
- Twilio sender/registration, consent, STOP/HELP, templates, and delivery callbacks verified.
- Billing webhook and entitlement reconciliation verified if enabled.
- Provider spend limits, alerts, quotas, contacts, and fallback behavior documented.

### Performance and quality

- CI is green and required.
- Cross-browser/device matrix passed.
- Accessibility launch audit passed.
- Performance budgets met on representative cellular conditions.
- Error-free critical paths and no uncaught console errors.

### Deployment

- Staging mirrors production boundaries.
- Release is immutable and traceable to source revision.
- Health, readiness, and dependency checks exist.
- Feature flags default safely.
- Rollback rehearsed.
- Database changes are backward compatible during rollout or have a documented maintenance strategy.
- Status communication templates exist.

### Business operations

- Jacksonville launch geography and trade coverage explicitly configured.
- Supply and demand recruitment plan has owners and targets.
- Marketplace liquidity thresholds define when to expand.
- Support, moderation, fraud, verification, and incident on-call ownership is assigned.
- Unit economics, provider costs, support cost, and abuse cost are monitored.

## 28. Expansion Gates

Do not expand to another market solely because signups increase. Require:

- Minimum active contractors and tradespeople by priority trade.
- Healthy qualified applications per job.
- Acceptable median time to first qualified response and time to fill.
- Repeat collaboration and completion rates.
- Sustainable support, report, dispute, and fraud rates.
- Reliable provider delivery and infrastructure headroom.
- Local regulatory/content guidance reviewed.

Use a city/trade launch scorecard and record the decision.

## 29. AI Coding Agent Execution Rules

Before writing code, the agent must:

1. Audit the repository, current deployment architecture, migrations, environment contract, and active branches.
2. Map every requirement to existing, partial, missing, or intentionally deferred capability.
3. Identify conflicts, risky assumptions, hidden mock behavior, security gaps, and migration needs.
4. Produce a dependency-ordered execution plan with acceptance criteria and rollback notes.
5. Preserve unrelated user changes and existing data.

During implementation:

- Work in vertical slices that produce a real, testable user outcome.
- Prefer existing sound patterns; replace only when the benefit and migration are clear.
- Never silently change product boundaries.
- Never place secrets in source, logs, screenshots, tests, or client bundles.
- Never generate replacement RIVT logos.
- Do not clone competitor branding or protected interface expression.
- Keep schema, API, UI, tests, analytics, docs, and operations aligned in the same slice.
- Mark partial implementations visibly in engineering status, not in the customer UI.
- Use feature flags for incomplete production code.

After each slice:

- Run lint, type checks, unit/integration/end-to-end tests, and proportional security checks.
- Test mobile and desktop rendered UI, both themes, empty/populated/error states, and keyboard use.
- Report files changed, migrations, environment changes, deployment impact, test evidence, residual risks, and exact maturity level.

Do not call the product complete because it builds, renders, or has many screens. Completion means the launch gates and Definition of Done are satisfied with evidence.

## 30. Final Product Standard

RIVT should feel like a serious professional product made with respect for the people using it. It should be fast enough for a parking lot, clear enough for a first-time user, reliable enough for a work record, safe enough for professional identity, and useful even before marketplace density is perfect.

The experience should connect five reinforcing loops:

1. Work creates professional relationships.
2. Relationships become trusted crews and repeat collaborators.
3. Completed work creates records, portfolios, and reputation.
4. Shop Talk and tools create value between jobs.
5. Better identity and reputation improve future matching and business outcomes.

Every proposed feature must strengthen at least one loop without damaging trust, clarity, safety, or operational sustainability.

## 31. Legal and Marketplace Boundary Controls

RIVT facilitates professional discovery, communication, documentation, and recordkeeping. Product language and behavior must not accidentally create promises or legal relationships the business does not intend.

- Require users to be at least 18 and legally able to enter contracts.
- Do not describe tradespeople as RIVT employees, agents, dispatched workers, or guaranteed labor.
- Do not control how work is performed, mandate schedules, set compensation, provide supervision, or imply worker classification. Give parties tools to agree on scope while preserving their independent responsibilities.
- Do not promise that a license, insurance policy, certification, identity, background check, review, or profile makes someone qualified for a particular job.
- License requirements vary by trade, scope, and jurisdiction. Show source, jurisdiction, checked date, and limitations; route uncertain cases to official authorities.
- Insurance requirements must distinguish policy existence, document upload, third-party verification, coverage type, limits, named insured, effective dates, exclusions, and job-specific applicability.
- Never imply RIVT provides workers' compensation, general liability, bonding, warranty, legal protection, code compliance, or payment protection unless a real reviewed product does so.
- Give users clear independent-contractor and tax-record disclaimers without burying them in every screen.
- Preserve evidence of agreements and status changes while making clear that RIVT is not the contracting party.
- Before entering a new state, review contractor licensing, labor marketplace, background-check, privacy, auto-renewal, messaging, tax, and consumer/commercial communication requirements.
- Legal text must be drafted or approved by qualified counsel before launch. An AI-generated policy is a working draft, not legal approval.

## 32. Ranking, Matching, and AI Governance

AI may assist matching, duration estimates, search, summaries, moderation triage, and compliance-resource suggestions. It must not become an unreviewable authority.

- Define every ranking objective and its guardrails. Optimize for credible mutual fit and completed work, not clicks or application volume.
- Tell users the main factors behind recommendations in plain language.
- Separate eligibility filters from ranking signals.
- Never use protected characteristics or obvious proxies for discriminatory ranking.
- Audit outcomes by geography, trade, account age, and other lawful cohorts for systematic exclusion.
- New users must have a fair path to discovery; avoid reputation lock-in and winner-take-all ranking.
- Sponsored or featured placement must be labeled and must not masquerade as organic matching.
- Allow users to correct the profile and preference data affecting recommendations.
- AI estimates display assumptions, uncertainty, and editable inputs. They never create binding scope, price, timeline, legal, code, safety, or compliance conclusions.
- AI summaries link to original records and must not replace messages, contracts, evidence, or source articles.
- Human review is required for bans, verification denial/revocation, dispute resolution, and other materially adverse decisions.
- Log model/provider/version, prompt/template version, relevant inputs or references, output, user override, and decision outcome without retaining unnecessary sensitive content.
- Maintain evaluation datasets for hallucination, unsafe trade advice, bias, prompt injection, data leakage, and refusal behavior.
- Treat uploaded documents, web content, messages, and Shop Talk posts as untrusted input; never allow their content to override system instructions or access secrets/tools.
- Provide a global kill switch and non-AI fallback for each AI-supported feature.
- Publish an understandable explanation of where AI is used and how users can report a bad result.

## 33. Data Classification and Ownership

Classify data before implementation:

- Public: intentionally published profile and community content.
- Account-private: preferences, drafts, saved items, devices, security settings.
- Relationship-private: applications, offers, job address, messages, shared records.
- Organization-confidential: internal crews, financial records, exports, business documents.
- Restricted: government identity evidence, background-check data, insurance/license evidence, security logs, secrets.

For each class define allowed actors, storage locations, encryption, logging prohibition, retention, export, deletion, support visibility, and incident severity. Enforce classifications through server policy and tests.

Users retain ownership of their uploaded content subject to the licenses needed to operate shared workflows. Define what happens to jointly relevant job records when one party deletes an account. Never transfer private artifacts into public portfolios without affirmative selection.

## 34. SLOs, Observability, and Incident Management

Define service-level objectives before launch, including:

- authentication availability and success rate
- core API availability
- message persistence latency
- notification enqueue and delivery latency by priority
- upload acceptance and processing success
- search freshness and latency
- invoice generation and delivery success
- backup completion and restore readiness

Use structured logs, traces, metrics, synthetic checks, real-user monitoring, and provider health signals with correlation IDs. Alert on user impact, not every noisy exception. Dashboards must show current status and recent deploy/config changes.

Incident system requirements:

- Severity levels with examples, response target, incident commander, communication owner, and escalation path.
- Security/privacy incidents follow a separate evidence-preserving response plan.
- Public status communication distinguishes investigating, identified, monitoring, and resolved.
- Maintain an internal timeline, decisions, impacted users, mitigations, and follow-up actions.
- Conduct blameless post-incident review for meaningful events; assign owners and deadlines.
- Test incident contact paths and provider escalation before launch.
- Do not expose private operational details in public status messages.

## 35. Cost, Quotas, and Abuse Economics

Design usage limits from both user value and worst-case cost.

- Set per-user, per-organization, per-IP/device, and global limits for authentication attempts, searches, invitations, applications, messages, uploads, exports, AI calls, email, and SMS.
- Limit file count, file size, video duration, retained originals, derivative generation, and public-link traffic by entitlement.
- Estimate normal and adversarial unit cost for every metered provider.
- Create budget alerts, provider caps, anomaly detection, and emergency channel shutdown without disabling core records.
- Prefer in-app delivery for nonurgent notifications and prevent notification fan-out loops.
- Prevent repeated export/report generation from creating uncontrolled compute or storage cost.
- Apply retention and archival tiers to old media with transparent user expectations.
- Never make a rate limit silently discard user work. Preserve drafts and explain reset/recovery.

## 36. Marketplace Liquidity and Cold-Start Experience

RIVT must remain honest and useful when a trade or location has few users.

- Never fabricate jobs, people, reviews, activity, scarcity, or demand.
- Clearly distinguish community prompts, editorial content, partner content, and user activity.
- If no matching work exists, offer saved search, alert setup, profile sharing, network discovery, tools, Shop Talk, and service-area expansion.
- If a contractor has no applicants, offer scope-quality review, targeted real invites, timing/location adjustments, and shareable job links.
- Measure qualified supply and demand separately by trade and travel radius.
- Prevent broad marketing expansion from creating empty local experiences.
- Allow launch operators to focus acquisition on configured trades/zip clusters without exposing internal density labels.
- Build referral attribution and anti-abuse controls before offering rewards.

## 37. Organization, Team, and Ownership Edge Cases

- A company can have multiple authorized members with role-specific permissions.
- Invitations expire and can be revoked.
- Removing a member immediately ends access without deleting organization records.
- Transfer of organization ownership requires step-up authentication, recipient acceptance, notifications, and audit.
- Define who owns jobs, conversations, project records, templates, invoices, customer contacts, and exports created by a company member.
- Personal and organization identities remain visibly distinct.
- A user leaving one company may retain their personal reputation/portfolio only where permissions and agreements allow it.
- Prevent duplicate organizations through safe claim/merge review rather than automatic destructive merging.
- Provide a documented process for owner death, incapacity, business sale, or inaccessible administrator.

## 38. Communications, Discoverability, and Anti-Harassment

- Users control whether they are discoverable, available, open to messages, and open to invitations.
- First-contact messages have throttles and abuse detection.
- Restrict attachment/link privileges for new or untrusted relationships where appropriate.
- Mask or warn on suspicious URLs and never render active untrusted HTML.
- Give recipients one-tap mute, block, and report controls without notifying the reported user.
- Preserve sufficient evidence for investigation even when a message is hidden from the recipient, subject to retention policy.
- Prevent blocked users from circumventing blocks through organizations, alternate profiles, group threads, or new invitations.
- Emergency threats and credible safety issues have a documented escalation policy; RIVT must not imply it is an emergency service.

## 39. Release Engineering and Change Safety

- Use trunk-based or short-lived branch development with protected production branch, required review/checks, and traceable deployments.
- Build artifacts once and promote the same immutable artifact through environments.
- Separate code deploy from feature release through flags when risk warrants it.
- Use expand/migrate/contract schema changes for zero-downtime compatibility.
- Test old client/new server and new client/old server compatibility across the deployment window.
- Automatically run smoke tests after deploy and rollback on defined critical failures when safe.
- Record configuration changes alongside code deployments.
- Preview database migration duration and locking behavior.
- Do not delete fields/tables until old releases, background jobs, exports, and rollback windows no longer depend on them.
- PWA assets use correct cache versioning; `index.html` is not trapped behind stale cache-first behavior.
- Feature flags and temporary compatibility code have removal tickets and expiry dates.

## 40. Final Pre-Build Challenge

Before accepting this specification, the implementing team or agent must answer in writing:

1. What is the smallest launch that proves RIVT creates trusted completed work, not merely signups?
2. Which features remain useful before local marketplace liquidity exists?
3. Which claims could expose users or RIVT to physical, legal, financial, privacy, or reputational harm?
4. Where can a user reasonably believe RIVT verified, guaranteed, paid, insured, licensed, or employed someone when it did not?
5. Which workflows can lose money, evidence, messages, files, drafts, or access during a retry or outage?
6. What can an abusive user automate cheaply, and what would it cost RIVT or another user?
7. Which admin action could cause the largest irreversible harm?
8. What happens when every external provider is unavailable independently?
9. How will the team know within minutes that a launch-critical workflow is failing?
10. What evidence must exist before launch approval is signed?

Unanswered items become explicit blockers or documented accepted risks with an owner and review date.

## 41. Research-Derived Product Lessons

The implementing team must study the linked first-party references in Section 42 before finalizing information architecture or interaction design. Extract principles, not pixels. Do not copy proprietary layouts, illustrations, wording, data, icons, photos, brand assets, or distinctive interface expression.

### Field documentation and construction operations

**CompanyCam** demonstrates that project evidence becomes useful when capture is immediate and organization is automatic. RIVT should make camera/upload the shortest path, associate media with project, person, phase, and time, then support annotations, timelines, controlled sharing, reports, and conversation around evidence. RIVT must go further on mutual marketplace permissions and portable professional proof.

**Raken** demonstrates the value of a structured daily record: progress, collaborators, photos, notes, labor, materials, equipment, and segmented reports. RIVT should offer a lightweight field log attached to active work, with optional sections and fast repeat entry rather than forcing enterprise paperwork on every side job.

**Fieldwire** demonstrates field-first restraint: tasks, plans, forms, reports, and as-builts are valuable because they reduce emails and rework. RIVT should keep each active-work screen centered on today's scope, people, evidence, blockers, and next action. Do not turn RIVT into a full general-contractor drawing-management suite at launch.

**Procore and Autodesk Construction Cloud** demonstrate the value of a connected project lifecycle, strong permission boundaries, integrations, and consistent records. They also demonstrate what RIVT must avoid for its early audience: enterprise density, configuration overload, and office-first dashboards.

**Bluebeam** demonstrates that construction professionals value precise markup, version awareness, and trusted documents. RIVT photo annotation and PDF/report features should preserve originals, identify revisions, and make exported evidence understandable outside RIVT.

**ServiceTitan, Buildxact, Workyard, and busybusy** demonstrate the business value of continuity from scheduling and field activity into costing, reporting, estimates, and records. RIVT should connect job -> active work -> evidence -> completion -> invoice/payment record without forcing users to re-enter the same facts.

**MaintainX and SafetyCulture-style operational systems** demonstrate that repeatable checklists are most useful when attached to a real asset or job, assigned, time-aware, and reportable. RIVT should use small contextual checklists for job readiness and closeout, not a generic library of paperwork on the home screen.

### Construction networks and bidding

**BuildingConnected, PlanHub, ConstructConnect, Dodge Construction Network, and The Blue Book** demonstrate that construction discovery depends on trade, location, qualification, project stage, bid status, relationship history, and confidence in coverage. RIVT should use these domain concepts while staying focused on contractor-to-contractor short-term work and trusted connections rather than becoming a commercial plan room.

RIVT should treat the contractor's known network as a first-class asset. A user should be able to search broadly, then save, group, invite, re-engage, and privately note trusted collaborators. Public reputation and private relationship history are different data products and must not be conflated.

### Flexible labor and independent-contractor platforms

**Field Nation** demonstrates a clear work-order lifecycle, talent pools, success signals, availability, schedule management, and the value of rebuilding with known providers. RIVT should make repeat collaboration easier than starting from zero while avoiding platform-controlled job payment and IT-service-specific assumptions.

**WorkMarket** demonstrates organized contractor pools, onboarding, qualification evidence, work tracking, and compliance support. RIVT should learn from the evidence and workflow continuity, while never advertising automated compliance certainty.

**Instawork, Wonolo, Veryable, Bacon Work, Bluecrew, WorkWhile, GigSmart, PeopleReady JobStack, and Qwick** demonstrate the importance of speed, availability, attendance/reliability, worker choice, favorites/rebooking, clear expectations, and support when a worker does not arrive. RIVT must adapt these ideas to independent trade work, not copy W-2 staffing, shift control, payroll, or employer-of-record behavior.

The useful RIVT pattern is: publish precise scope -> show credible fit -> communicate expectations -> mutually confirm -> support day-of readiness -> document completion -> build a reusable relationship. Do not optimize for the maximum number of low-intent applications.

### Mature SaaS interaction patterns

**Linear** demonstrates speed, keyboard-capable navigation, consistent command structure, restrained hierarchy, and dense information without visual noise. RIVT should adopt its decisiveness but maintain larger field-friendly controls and plain trade language.

**Slack** demonstrates persistent conversations, unread state, notification control, search, and contextual threads. RIVT messaging should remain job/person contextual and should not inherit channel sprawl.

**Notion and Airtable** demonstrate flexible views over shared underlying data. RIVT can eventually support list, board, calendar, and map views where they materially help, but must ship one excellent default before exposing configuration.

**Stripe** demonstrates transparent status, recovery-oriented errors, trustworthy records, and careful treatment of sensitive actions. RIVT should use the same standard for verification, invoice delivery, subscriptions, and external-payment records.

**Dropbox** demonstrates that sync and sharing are confidence problems as much as technical problems. RIVT must show upload/sync state, access scope, link expiry, and recovery clearly.

### Research-driven anti-patterns

- Do not copy enterprise homepages that show every module at once.
- Do not use vanity dashboards when the user needs one field action.
- Do not sell homeowner leads or make professionals compete to pay for contact details.
- Do not use staffing language that implies employment, dispatch, supervision, or guaranteed labor.
- Do not equate high activity with high quality.
- Do not hide fees, work status, address rules, cancellation consequences, or verification limitations.
- Do not use public ratings as the only trust mechanism.
- Do not make workers rebuild the same reputation separately for every interaction.
- Do not put project records, tools, community, and marketplace data in one undifferentiated feed.
- Do not import a competitor feature unless it strengthens a defined RIVT user journey and has an operational owner.

## 42. Visual and Product Reference Library

These links are research references for the product team and coding agent. They are not production assets. Links may change; record the access date when using one in a design decision. Use official pages and screenshots to understand hierarchy, workflow, responsive behavior, and state communication. Never use competitor logos, screenshots, photos, illustrations, or copyrighted copy inside RIVT.

### Project evidence and field operations

1. **CompanyCam feature system** — study capture, annotation, galleries/timelines, project feed, labels, reports, and communication. [Reference page](https://companycam.com/features) | [Official preview image](https://companycam.imgix.net/images/CompanyCam-SEO_2021-04-02-180256.jpg?auto=format&crop=focalpoint&domain=companycam.imgix.net&fit=crop&fp-x=0.5&fp-y=0.5&h=630&ixlib=php-3.3.1&q=82&w=1200)
2. **CompanyCam photo/video capture** — study camera-first entry and automatic project organization. [Reference page](https://companycam.com/features/photo-and-video-capture)
3. **CompanyCam galleries and timelines** — study chronological evidence and controlled presentation. [Reference page](https://companycam.com/features/galleries-timelines)
4. **CompanyCam project feed** — study activity continuity without turning the full product into a social feed. [Reference page](https://companycam.com/features/project-feed)
5. **Raken features** — study daily reports, collaborator reports, segmented reports, photos, notes, labor, production, materials, and equipment. [Reference page](https://www.rakenapp.com/features)
6. **Raken photo documentation** — study field capture attached to daily records. [Reference page](https://www.rakenapp.com/features/photo-documentation)
7. **Raken daily reports** — study repeatable, low-friction field reporting. [Reference page](https://www.rakenapp.com/features/daily-reports)
8. **Fieldwire field-first product** — study restrained task, drawing, form, and report navigation. [Reference page](https://www.fieldwire.com/) | [Official preview image](https://www.fieldwire.com/images/Fieldwire.png)
9. **Fieldwire reports** — study exportable field records and status summaries. [Reference page](https://www.fieldwire.com/construction-reports/)
10. **Fieldwire forms** — study contextual forms rather than global paperwork. [Reference page](https://www.fieldwire.com/construction-forms/)
11. **Bluebeam product** — study markup precision, documents, revisions, and collaboration. [Reference page](https://www.bluebeam.com/product/) | [Official preview image](https://www.bluebeam.com/wp-content/uploads/2023/05/legal-opengraph.png)
12. **Procore platform** — study connected project lifecycle, permissions, navigation, and system status; reject enterprise clutter. [Reference page](https://www.procore.com/platform) | [Official preview image](https://images.ctfassets.net/8pep15rt0kef/5NvqPgcjpUzWgk2adokDeK/b59eb316185f4e7b36794d0e73250bd1/Hero__1_.png?w=1200&h=630&fm=jpg&q=80&fit=fill&f=faces)
13. **Autodesk Construction Cloud** — study cross-phase continuity and secure collaboration. [Reference page with official product imagery](https://construction.autodesk.com/)
14. **Workyard** — study field time, job progress, forms, costing, and reporting connections. [Reference page](https://www.workyard.com/) | [Official preview image](https://cdn.prod.website-files.com/651e2518a5f27a1fc3e2f229/6524cb4b6b6d9e1cca99f9d6_Open%20Graph.jpg)
15. **busybusy** — study low-friction mobile field entry and visible status. [Reference page](https://busybusy.com/) | [Official preview image](https://busybusy.com/wp-content/uploads/2021/10/PRoduct-MGMT.png)
16. **MaintainX** — study work-order clarity, checklists, activity history, and operational handoff. [Reference page](https://www.getmaintainx.com/) | [Official preview image](https://cdn.prod.website-files.com/65ae6673d2c6ecb99ee249d1/682cc13bc85b61fe2f91f274_Website%20Open%20Graph%20Image%20%281%29.webp)
17. **Buildxact** — study estimate-to-project continuity and contractor-friendly density. [Reference page](https://www.buildxact.com/us/) | [Official preview image](https://www.buildxact.com/us/wp-content/uploads/sites/2/2025/05/1_Digital-Signatures__NA_V1.gif)
18. **ServiceTitan features** — study connected contractor operations and role-specific workflow; reject call-center/enterprise assumptions not relevant to RIVT. [Reference page](https://www.servicetitan.com/features) | [Official preview image](https://images.ctfassets.net/3q1a0w8cwuwf/7ISRCzbAIAcs4MGNvrYSWN/67264761ca3557c758165afc41dc04a9/ServiceTitan_Logo_Black_2.png)

### Construction discovery, relationships, and bidding

19. **BuildingConnected** — study builder network, bid board, qualification, risk context, and relationship reuse. [Reference page](https://construction.autodesk.com/products/buildingconnected/)
20. **BuildingConnected bid-board tour** — study information grouping and pipeline status. [Visual product tour](https://construction.autodesk.com/product-tour/bid-management-bid-board-pro-tour/)
21. **PlanHub** — study contractor/subcontractor paths, project filters, bid coverage, relationship management, and mobile access. [Reference page](https://planhub.com/) | [Official preview image](https://planhub.com/wp-content/uploads/2025/02/PlanHub-Preconstruction-Software-Home5.jpg)
22. **ConstructConnect** — study project discovery and decision-support hierarchy. [Reference page](https://www.constructconnect.com/) | [Official preview image](https://www.constructconnect.com/hubfs/ConstructConnect-LinkPreviewImage.png)
23. **Dodge Construction Network** — study construction intelligence, project stage, and local market data. [Reference page](https://www.construction.com/)
24. **The Blue Book Network** — study company profiles, qualification discovery, and trade-directory mental models. [Reference page](https://www.thebluebook.com/)

### Professional labor marketplaces and contractor networks

25. **Field Nation** — study two-sided entry, clear work lifecycle, trusted talent pools, schedule visibility, ratings, and repeat providers. [Reference page](https://fieldnation.com/) | [Official preview image](https://fieldnation.com/wp-content/uploads/2024/08/fieldnation-com-share.jpg)
26. **Field Nation company workflow** — study post -> choose -> approve -> relationship outcome. [Reference page](https://fieldnation.com/find-talent/how-it-works)
27. **Field Nation talent pools** — study success signals and private pools of known professionals. [Reference page](https://fieldnation.com/find-talent)
28. **WorkMarket** — study independent-contractor organization, qualification, onboarding, assignment, and compliance evidence. [Reference page](https://www.workmarket.com/)
29. **WorkMarket organize talent** — study private talent clouds and repeat assignment. [Reference page](https://www.workmarket.com/features/organize-talent)
30. **Instawork** — study fast demand creation, worker choice, availability, reliability communication, and role-specific onboarding. [Reference page](https://www.instawork.com/business) | [Official preview image](https://cdn.prod.website-files.com/63fd26f2fd0da53e0276079c/649a16c8f69460000a219a25_Instawork-OG-Image-blue.png)
31. **Wonolo** — study simple marketplace entry, re-engaging known workers, support visibility, and flexible work framing. [Reference page](https://www.wonolo.com/) | [Official preview image](https://framerusercontent.com/assets/PBgIa3TL1hQKy1ZdIQ2vbm12CE.png)
32. **Veryable** — study post -> select -> rate -> build labor pool, adapting only the relationship loop. [Reference page](https://www.veryableops.com/) | [Official preview image](https://cdn.prod.website-files.com/656f7666617c2816db7ae5c9/67a3bbb61fb23b06df531c40_Veryable%20Icon_02.png)
33. **Bacon Work** — study local opportunity discovery and mobile-first temporary-work communication. [Reference page](https://www.baconwork.com/) | [Official preview image](https://cdn.prod.website-files.com/5b32bcf34b8475e132296c72/62e2f45dae2240bc8b90216a_home_open_graph_image-01.jpg)
34. **PeopleReady JobStack** — study job discovery, readiness, and role clarity; do not import staffing-company assumptions. [Reference page](https://www.peopleready.com/jobstack/) | [Official preview image](https://www.peopleready.com/wp-content/uploads/2024/06/JobStackHomepage_FeaturedImage_650x400-scaled.jpg)
35. **Bluecrew** — study mobile workforce communication while explicitly rejecting W-2/workforce-as-a-service semantics for RIVT. [Reference page](https://www.bluecrewjobs.com/)
36. **WorkWhile** — study availability, reliability, and support framing; do not copy platform employment controls. [Reference page](https://www.workwhile.ai/)
37. **GigSmart** — study fast worker discovery and straightforward role entry. [Reference page](https://gigsmart.com/business/)
38. **Qwick** — study qualification display, fast matching, and support status while rejecting hospitality/payroll assumptions. [Reference page](https://www.qwick.com/business/) | [Official preview image](https://www.qwick.com/images/logo.png)
39. **LinkedIn Talent Solutions** — study professional identity, search, and outreach while avoiding resume/corporate-HR language. [Reference page](https://business.linkedin.com/talent-solutions) | [Official preview image](https://business.linkedin.com/content/dam/me/business/en-us/talent-solutions-lodestone/body/refcards/LTS-hero-hire-social-share.jpg)

### Premium SaaS interaction references

40. **Linear** — study hierarchy, speed, command consistency, and state density. [Reference page](https://linear.app/) | [Official preview image](https://linear.app/static/og/homepage.jpg)
41. **Slack** — study conversation state, unread behavior, search, and notification preferences. [Reference page](https://slack.com/features) | [Official preview image](https://a.slack-edge.com/737c9d1/marketing/img/homepage/revamped-24/unfurl/hp-revamp-unfurl.en-GB.jpg)
42. **Notion** — study progressive workspace complexity and uncluttered first-run states. [Reference page](https://www.notion.com/product) | [Official preview image](https://www.notion.com/front-static/meta/teams-and-agents.jpg)
43. **Airtable** — study multiple useful views over a shared data model and filter visibility. [Reference page](https://www.airtable.com/platform) | [Official preview image](https://cdn.sanity.io/images/hlcyrtq5/production/31cc8168da9f4351d9433fe63c198e56af597f3a-2400x1260.webp)
44. **Stripe** — study trustworthy status, recoverable errors, sensitive-action confirmation, and records. [Reference page](https://stripe.com/payments) | [Official preview image](https://images.stripeassets.com/fzn2n1nzq965/6JEjxpwMd1OIIk6RosReNU/3d5c5f5217a7cce4af750ebfe599b6fc/Payments-social-card.png?q=80)
45. **Dropbox** — study upload/sync confidence, sharing scope, and file recovery. [Reference page](https://www.dropbox.com/features) | [Official preview image](https://cfl.dropboxstatic.com/static/metaserver/static/images/logo_catalog/dropbox_opengraph_image%402x.png)

### Safety, legal, security, and platform standards

46. **OSHA Construction** — safety context and official resources. [Official reference](https://www.osha.gov/construction)
47. **OSHA Recommended Practices for Safety and Health Programs** — use as a source for safety-program framing, not automated compliance approval. [Official reference](https://www.osha.gov/safety-management)
48. **IRS independent-contractor definition** — classification boundary reference; obtain counsel for product decisions. [Official reference](https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-defined)
49. **FTC background-check guidance** — required review before any background-check workflow. [Official reference](https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know)
50. **Florida DBPR** — Jacksonville launch reference for official professional licensing resources. [Official reference](https://www2.myfloridalicense.com/)
51. **NIST AI Risk Management Framework** — govern AI matching, estimates, summaries, and moderation assistance. [Official reference](https://www.nist.gov/itl/ai-risk-management-framework)
52. **CISA Secure by Design** — use safe defaults and make security a product responsibility. [Official reference](https://www.cisa.gov/securebydesign)
53. **OWASP ASVS** — application security acceptance baseline. [Official reference](https://owasp.org/www-project-application-security-verification-standard/)
54. **WCAG 2.2** — accessibility acceptance baseline. [Official reference](https://www.w3.org/TR/WCAG22/)
55. **MDN Web App Manifest** — installable PWA requirements. [Official reference](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
56. **web.dev Service Workers** — caching, updates, and offline behavior reference. [Official reference](https://web.dev/learn/pwa/service-workers)

For each adopted pattern, add a decision record with: user problem, reference studied, principle adopted, RIVT-specific adaptation, rejected elements, accessibility impact, privacy/security impact, success metric, and screenshot/test evidence. A reference link by itself is not design justification.

## 43. Phased, Token-Aware Build Protocol

This product must be built in controlled phases. Do not attempt the entire application in one AI session, one giant prompt response, one unreviewable change set, or one deployment. Daily AI token limits, context compression, provider limits, and human review capacity are real engineering constraints.

### Persistent project-control artifacts

Create and maintain these repository documents before implementation:

- `docs/product/PRODUCT_CONTRACT.md` — approved product boundaries and terminology.
- `docs/product/REQUIREMENTS_TRACEABILITY.md` — requirement -> implementation -> test -> release status.
- `docs/architecture/SYSTEM.md` — current architecture, boundaries, diagrams, and provider adapters.
- `docs/architecture/DECISIONS/` — dated architecture and product decision records.
- `docs/delivery/BUILD_STATE.md` — current phase, completed slices, next exact slice, blockers, commands, and environment status.
- `docs/delivery/RISKS.md` — open risks with owner, severity, mitigation, and review date.
- `docs/delivery/DEFERRED.md` — explicitly deferred features and why.
- `docs/operations/RUNBOOKS.md` — production support and recovery.
- `docs/quality/ACCEPTANCE.md` — executable and manual launch gates.

At the start of every AI session, read the source of truth, `BUILD_STATE.md`, relevant decisions, git status, current branch, recent commits, and the files in the active slice. Never reconstruct project status from conversation memory alone.

At the end of every AI session, update `BUILD_STATE.md` with what actually works, what remains partial, tests run, screenshots/evidence, environment changes, migration state, deployment state, risks introduced, and the next smallest safe task. This handoff is required even when no code ships.

### Session size rules

- One session works on one vertical slice or one tightly related defect group.
- Prefer a slice that completes one user outcome across UI, API, data, tests, and operations.
- Do not touch unrelated modules for aesthetic cleanup.
- Do not start a second major feature because the first finished early; use remaining capacity for QA, edge states, documentation, and debt removal.
- Before context becomes constrained, stop coding at a stable checkpoint, run verification, and write the handoff.
- If a phase is too large, split it by user journey, not by arbitrary frontend/backend layers.
- A token limit is not permission to skip tests, error states, security, or documentation. Reduce scope instead.
- Never produce thousands of lines of speculative code that cannot be inspected in the same session.

### Phase 0 — Discovery, preservation, and baseline

Goals: understand what exists, protect user work, and establish truthful status.

- Audit branches, deployments, schema, providers, secrets contract, storage, auth, routes, feature flags, tests, and production behavior.
- Inventory every screen/button and classify it as real, partial, mock, broken, duplicate, or obsolete.
- Identify production data and migration/backup risks.
- Capture baseline mobile/desktop screenshots, accessibility findings, performance, API health, and critical-flow results.
- Create the persistent project-control artifacts.
- Freeze brand assets and terminology.

Exit gate: the team can explain the current system, preserve/restore data, run it locally, identify the production revision, and map every launch requirement to evidence or a gap.

### Phase 1 — Platform foundation and design system

- Establish typed API/error contracts, auth/session foundation, route structure, authorization middleware, database migration discipline, provider interfaces, observability, and feature flags.
- Build the responsive application shell, five-destination navigation, top-bar actions, profile menu, themes, core components, state semantics, loading/error/empty patterns, toast system, and accessibility baseline.
- Make PWA manifest/update behavior safe.

Exit gate: authenticated role-correct shell is stable on target mobile/desktop browsers; components pass visual/accessibility tests; no launch feature is still built on a fragile global mock state.

### Phase 2 — Identity, onboarding, profiles, and organizations

- Complete signup/login/recovery/sign-out/session/device flows.
- Build role-specific resumable onboarding, organization membership, profile editing, trade/service area, availability, portfolio foundation, privacy, and profile-strength guidance.
- Add explicit trust-state vocabulary without premature verification claims.

Exit gate: two new users can create distinct role-correct identities, resume onboarding, manage sessions, and view accurate profiles with real persistence.

### Phase 3 — Network and crew relationships

- Build the Gate A subset first: professional search, profile views/sharing, direct outreach where allowed, blocks/reports, and organization-safe permissions.
- After the Gate A subset is verified, build the Gate B relationship layer: connection requests, filters, saved people, trusted collaborators, crews, and crew invitations.
- Add private relationship notes/history only with clear ownership and access rules.

Exit gate: users can find, evaluate, contact, connect, organize, block, and report real accounts without a job posting, with authorization tests.

### Phase 4 — Marketplace core

- Job drafts/templates, progressive posting, requirements, location privacy, publishing, search/filter/save/alerts, applications, invites, offers, mutual acceptance, status timeline, cancellation/reschedule, and deadlines.
- Add marketplace limits, idempotency, and cold-start states.

Exit gate: contractor and tradesperson complete the full post-to-accepted-work journey; duplicate/retry, block, expired, closed, and permission cases pass.

### Phase 5 — Messaging and notifications

- Job/person contextual conversations, attachments, unread/read state, search, mute/block/report, delivery state, conversation starters, and notification center/preferences/quiet hours.
- Wire email/SMS only after consent, sender configuration, callbacks, retry, and provider failure behavior are tested.

Exit gate: communication persists exactly once, permissions follow relationship state, preferences are honored, and provider outages do not create false success.

### Phase 6 — Active work and project documentation

- Build the Gate A subset first: active-work hub, day-of readiness, scope/current status, reliable camera/upload, basic timeline, closeout evidence, and exportable report.
- Build the Gate B documentation layer after pilot readiness: field logs, albums/phases, annotations, comments, richer activity history, offline queue, before/after pairing, and controlled share links.

Exit gate: a mobile user captures evidence offline, synchronizes once, sees truthful state, creates a report, shares/revokes access, and preserves originals.

### Phase 7 — Completion, reviews, reputation, and disputes

- Completion evidence/checklist, mutual confirmation, review window, two-sided review approval/dispute, responses, proof badges, reputation definitions, appeals, and admin queues.

Exit gate: only eligible relationships create one review per party; enforcement and disputes are audited; badge meanings are accurate.

### Gate A checkpoint — First-customer pilot readiness

After the Gate A portions of Phases 0–7 pass, stop feature development and harden the pilot:

- Run the Gate A security, privacy, legal, accessibility, device, backup/restore, incident, support, provider, and critical-journey checks.
- Verify all pilot-facing buttons and routes against production-like services.
- Confirm pilot users, support ownership, daily review cadence, feedback capture, rollback, and kill switches.
- Deploy first to internal test accounts, then a very small named design-partner cohort.
- Record product gaps, manual interventions, marketplace behavior, safety concerns, and support burden.

Gate A approval is evidence that the core work loop is safe enough to learn from real invited users. It is not approval for public acquisition or an excuse to expose unfinished Gate B navigation.

### Phase 8 — Shop Talk and Trade News

- Search-first Q&A, flair, voting, Verified Fix, trade filters, badges, report/moderation, safety warnings, and community guidelines.
- Add curated/ingested Trade News with provenance, canonical links, thumbnails, deduplication, broken-link handling, source policy, and labeling.

Exit gate: community and news modes are distinct, links and thumbnails work, unsafe content can be handled, and no source is scraped or reproduced beyond allowed use.

### Phase 9 — Standalone tools and business records

- Construction calculator modes with validated formulas/test vectors.
- Estimates, invoices, PDFs, recipient records, email/in-app/SMS-link delivery, delivery state, revisions, payment records, CSV/tax summary, and project prefill.

Exit gate: each tool works as a focused mini-app; math is tested; artifacts persist; delivery failure is recoverable; financial language is accurate.

### Phase 10 — Trust providers and public-launch operations

- Identity/license/insurance evidence workflows and provider integrations chosen for launch.
- Support console, moderation, verification, appeals, account enforcement, audit, replay tools, and admin safety.

Exit gate: least privilege, MFA/step-up, decision history, provider reconciliation, support runbooks, and rollback are verified.

### Phase 11 — Gate B hardening and Jacksonville public launch

- Incorporate Gate A pilot findings and close every Gate B blocker.
- Complete public-launch security review, accessibility audit, load/performance tests, backup restore, incident drill, provider limits, legal approval, analytics validation, moderation, and support readiness.
- Release from named design partners to a capped Jacksonville beta, then broader local access only according to marketplace and operations scorecard gates.

Exit gate: every launch checklist item has evidence, owner, date, and approval. Remaining risks are explicit and accepted by the responsible owner.

### Phase 12 — Gate C expansion platform

- Add subscription entitlements and billing only after pricing, liquidity, support, downgrade, cancellation, refund, tax, dispute, reconciliation, and chargeback behavior are approved.
- Add advanced organizations, recurring/bulk workflows, deeper integrations, evaluated AI assistance, and additional markets in separately gated slices.
- Re-run legal, operational, security, accessibility, performance, cost, and marketplace-liquidity review for each material expansion.

Exit gate: the expansion capability is production-verified without weakening the Jacksonville core, user ownership, trust definitions, or support sustainability.

### Phase progression rules

- A phase may begin in discovery while the previous phase is being verified, but launch-critical dependencies cannot be bypassed.
- Do not expose an incomplete feature merely because its screen exists. Keep it behind a feature flag or out of navigation.
- Every phase ends with lint/type/test results, migration status, API checks, responsive screenshots, accessibility checks, error-state proof, documentation updates, and a deploy/rollback decision.
- Do not mark all tasks complete in bulk. Update status as evidence is produced.
- The human product owner reviews working software at each phase gate. Written plans do not substitute for rendered and functional proof.

## 44. Ten Additional Risks Found in the Final Adversarial Pass

The following ten areas were not sufficiently explicit in the earlier specification. They are now required product considerations.

### 1. No-show, late arrival, and replacement workflow

Construction work can fail before it starts. Add day-of confirmation, arrival instructions, optional check-in, running-late communication, no-show reporting, grace periods, backup invite/replacement flow, and clear status history. Do not auto-punish based on GPS or one party's unreviewed claim. Repeated reliability signals require context, appeal, and anti-retaliation protections.

### 2. Scope change and change-order control

The original job description will sometimes change. Add a proposed scope change with author, description, price/time impact if parties record one, attachments, acceptance/decline, revision history, and a frozen prior version. Messages alone are not a reliable change-order record. RIVT records agreement but does not provide legal approval.

### 3. Site readiness, access, and hidden-friction details

Add structured optional fields/checklist for parking, gate/access, occupied site, working hours, contact on arrival, power/water, restroom, ladder/lift/scaffold expectations, cleanup, debris disposal, material availability, permit responsibility, PPE, pets/tenants, and other site constraints. Reveal sensitive instructions only to accepted parties. A concise readiness summary should prevent surprises without making job posting a wall of fields.

### 4. Weather and external disruption

Outdoor work needs weather-aware communication, but weather cannot silently cancel work. Allow weather watch, contractor delay proposal, mutual reschedule, reason codes, and notification. Preserve the original schedule and decision history. If weather data is integrated, show source/time and treat forecasts as advisory.

### 5. Crew composition and substitution

A hired profile may represent one person, while the arriving workforce may be a crew. Define whether substitutions or added crew members are allowed, require disclosure/acceptance, show who is expected on site, and apply identity/credential/address-access rules to each person. Never let an accepted user silently forward private job details to unknown workers.

### 6. Tools, vehicle, materials, and capability expectations

Profile tool ownership is self-reported and changes over time. Job requirements must distinguish required-to-bring, supplied-on-site, optional, and special equipment. Confirm critical requirements before acceptance or start. Do not infer competence or certification from tool ownership.

### 7. Language, literacy, and voice-first field use

Use plain language, readable numbers, icons plus text, and short summaries. Support speech-to-text/photo-first notes where platform capabilities allow, with visible review before sending. Prepare all strings for translation, but never machine-translate contracts, safety instructions, or legal/compliance text without approved review. Let users state preferred communication language without using it to reduce opportunity unfairly.

### 8. Calendar conflicts, travel feasibility, and availability freshness

Availability becomes stale quickly. Add last-confirmed time, conflict detection, travel-time awareness using approximate locations before acceptance, and calendar export/integration later. Do not expose continuous precise location. Warn rather than block when travel estimates or calendars may be incomplete.

### 9. Interoperability and exit safety

Contractors already use calendars, accounting systems, contacts, cloud drives, and project software. Define stable exports for jobs, contacts, invoices, payment logs, project reports, and media manifests. Use provider adapters and documented APIs/webhooks when integrations are justified. Users must be able to leave without losing an intelligible record of their business.

### 10. Reputation freshness, context, and new-user fairness

One global star average is inadequate. Show recent, role-specific evidence such as communication, reliability, scope completion, documentation, and repeat collaboration only when the sample is meaningful. Display date range and count. Older history may remain visible but should not overpower recent behavior. New users need profile completeness, credentials, references/evidence where lawful, and successful early interactions as alternative trust paths.

Each of these ten areas must be mapped to product scope. If deferred from launch, the data model and current UI must avoid assumptions that make the later safe implementation impossible.

## 45. Jacksonville Wedge and Marketplace Operating Model

RIVT launches in Jacksonville, Florida as a deliberately constrained local network. “All trades” is the eventual taxonomy, not an acquisition strategy for day one.

- Before Gate A recruitment, choose a small number of priority trade clusters using founder access, local demand, repeat-work potential, safety/legal complexity, and realistic support capacity.
- Configure launch counties/zip clusters and travel radii rather than hardcoding city strings throughout the application.
- Maintain the complete trade taxonomy for profile accuracy, but do not market inactive categories as if liquidity exists.
- Recruit both sides in matched cohorts: specific contractors with upcoming work and enough relevant professionals to respond.
- Record how each pilot user entered, what trade/location they represent, and what first-value event they reached.
- Provide a concierge fallback for pilot support, but record manual interventions so the team learns what the product must automate.
- Do not hide low density. Use honest saved alerts, direct invitations, profile sharing, Shop Talk, project records, and tools to provide value while supply develops.
- Expansion requires the scorecard in Section 28, not founder intuition alone.

The pilot's primary proof is not registrations. It is a small number of legitimate, mutually accepted, safely documented work relationships with repeat intent and manageable support burden.

## 46. Work Agreement, Regulatory Context, and Physical-Safety Incidents

RIVT must not assume that parties can legally “work under the hiring contractor's license.” License lending, supervision, employee classification, permits, and qualifying-agent rules vary by jurisdiction and scope. Remove that claim from product copy unless qualified counsel approves precise jurisdiction-specific language.

For accepted work, provide a versioned work summary containing parties, scope, location disclosure, schedule, compensation expectation if recorded, supplied/required tools and materials, insurance requirement, site rules, completion expectation, cancellation terms, and accepted changes. Both parties acknowledge the same version. An acknowledgment is not presented as legal advice, a permit, a construction contract approved for every jurisdiction, or RIVT's guarantee.

Support optional, clearly labeled records for:

- Purchase-order or external-contract reference.
- Permit and inspection responsibility.
- Prevailing-wage, certified-payroll, union, government-project, or customer-specific requirements.
- Lien notice or waiver documents supplied by the parties.
- Change orders and schedule revisions.
- Electronic signatures only after the signature method, consent, attribution, record retention, and applicable legal review are complete.

Add an **Unsafe condition / Stop work** action to active work. It must:

- Put safety ahead of completion metrics or reputation pressure.
- Let either party record a concise reason and supporting evidence.
- Notify the other party without declaring fault.
- Preserve the current job state and route to reschedule, cancellation, support, or emergency guidance.
- State clearly that RIVT is not an emergency service; immediate danger should use local emergency services.

Add a restricted incident-record pathway for injury, property damage, theft, harassment, or serious near miss. Collect only information needed for routing and evidence preservation, limit internal access, prevent public posting, maintain legal-hold capability, and provide no automated liability conclusion. Define insurance-notification and law-enforcement guidance with counsel before exposing it.

## 47. Location, Service Area, Mapping, and Sensitive-Site Privacy

Location is a matching tool and a safety risk. Model it deliberately.

- Store normalized address fields separately from geocoded coordinates and user-facing labels.
- Validate addresses without overwriting user-entered unit, gate, site, or rural directions.
- Before acceptance, expose only a coarse area such as city/region and approximate distance. Do not send exact coordinates to the client and merely hide them with CSS.
- After acceptance, reveal exact address only to authorized participants and explicitly log meaningful access where warranted.
- Allow a contractor to delay exact-address release for sensitive sites until final confirmation while still providing enough travel context.
- Remove precise EXIF/GPS data from public or broadly shared media by default.
- Define coordinate precision, geocoder retention, cache rules, provider terms, cost limits, and outage fallback.
- Nearby search uses server-side geospatial queries, sensible distance rounding, pagination, and anti-scraping controls.
- Service areas may be radius, selected regions, or travel-time preference; they are not continuous location tracking.
- Treat schools, hospitals, utilities, secure facilities, occupied homes, and protected customer sites as sensitive-location classes with tighter sharing and media defaults.
- Map screenshots, tiles, and directions must follow provider licensing and attribution rules.

## 48. Public Website, Search Indexing, Link Previews, and Brand Presence

Separate the public marketing surface from the authenticated application even when they share a deployment.

Public surface requirements:

- Clear trades-only positioning and role-specific value without claiming unavailable density or verification.
- Working product, safety, pricing, support, legal, and contact pages appropriate to the current gate.
- Accurate title, description, canonical URL, favicon, approved RIVT logo, social preview image, and organization metadata.
- Sitemap and robots policy that intentionally include public pages and exclude application, drafts, messages, addresses, records, admin, and private profiles.
- Public professional profiles are opt-in, previewable, revocable, and limited to fields the user affirmatively publishes.
- Do not expose phone, email, precise location, license documents, insurance documents, or relationship-private content to crawlers.
- Handle deleted/private profiles with correct status, cache invalidation, and search-removal guidance.
- Shared job or project links use safe previews that do not leak private descriptions, addresses, recipients, or images before authorization.
- Structured data must represent what RIVT actually offers; do not mark job postings public if they require authenticated access or are no longer open.
- Marketing analytics and cookies remain separate from essential application telemetry and follow consent requirements.

## 49. Network Bootstrap, Contact Import, Referrals, and Invitation Safety

Early users need a way to bring real professional relationships into RIVT without turning RIVT into a spam engine.

- Contact import is optional, purpose-limited, previewed before action, and never uploads an entire address book silently.
- Prefer on-device selection or privacy-preserving matching when feasible; do not retain non-user contacts indefinitely.
- A user chooses each recipient or a clearly defined small group, sees the exact message, and can cancel before sending.
- Invitations identify the sender and RIVT, explain why the recipient was contacted, and include opt-out/report controls.
- Apply daily and recipient-level limits; suppress repeated invitations after decline, complaint, bounce, block, or opt-out.
- Do not create public profiles, ratings, or “members” for people who have not joined.
- Referral rewards, if introduced, require fraud controls, qualification events, reversal rules, tax/accounting review, and transparent terms.
- Let new users share a profile or job through a normal link without granting access to unrelated contacts or records.

## 50. Email, Domain, SMS, and Push Deliverability

Reliable communication requires operational discipline beyond calling a provider API.

- Separate transactional, security, marketplace, community, and marketing message categories.
- Configure and monitor SPF, DKIM, DMARC, aligned From domains, return paths, and support/reply handling.
- Maintain bounce, complaint, suppression, unsubscribe, and invalid-recipient state; never keep retrying a permanent failure.
- Warm new sending domains/streams conservatively and monitor domain/provider reputation.
- Every template has owner, category, version, preview, plain-text alternative, localization readiness, and test coverage for links and sensitive-data leakage.
- Security messages cannot be disabled; marketing consent does not authorize marketplace or SMS messages, and vice versa.
- Push permissions are requested after value/context, not on first paint. Provide in-app fallback and device-token cleanup.
- SMS follows recorded consent, purpose limitation, sender registration, quiet hours where appropriate, STOP/HELP handling, and short-link safety.
- Delivery dashboards distinguish accepted by provider, delivered where callbacks support it, bounced/failed, and opened/read only when the signal is lawful and meaningful.
- Define support ownership and fallback communication for provider or domain-reputation incidents.

## 51. Vendor Risk, Data Residency, and Provider Exit

For every external provider, maintain a register containing purpose, data classes shared, regions/residency, subprocessors, authentication method, contract/DPA status, retention/deletion behavior, quotas, cost model, outage behavior, support path, and replacement difficulty.

- Restricted identity and verification data must not flow through general analytics, AI, or support tools.
- Verify whether provider data is used for model training or unrelated purposes and disable it where required.
- Use provider adapters and internal canonical records so a provider switch does not rewrite core product state.
- Store provider identifiers as references, not as the only source of business truth.
- Export or reconcile data before termination.
- Test degraded behavior and credential rotation.
- Track provider end-of-life notices and API-version deadlines.
- Define which providers are launch-critical and which features can be disabled independently.
- Review vendor security and privacy posture proportionate to shared data and blast radius.

## 52. Evidence Integrity, Legal Requests, and Record Authenticity

Project evidence, agreements, reviews, and messages may become important in disputes. RIVT must preserve integrity without promising courtroom admissibility.

- Keep original uploads immutable; edits and annotations create derived versions linked to the original.
- Store creator, server receipt time, client-captured time if available, file hash, media metadata policy, and revision history.
- Clearly distinguish user-entered timestamps/location from server-observed values.
- Exported reports identify included records, generation time, timezone, and omissions; they must not silently alter source evidence.
- Correcting a record creates an auditable correction rather than erasing relevant history, subject to privacy/deletion law.
- Define legal-hold authority, scope, approval, user-notice rules, release, and audit.
- Create a documented process for subpoenas, preservation requests, law-enforcement requests, emergency disclosures, and user notice with qualified counsel.
- Support staff cannot alter evidence or private messages to “fix” a dispute.
- Public portfolio copies are separate from private project evidence and require explicit selection and permission.

## 53. Ownership, Service Catalog, and Operational Accountability

Every production capability needs a named owner even if one founder temporarily holds several roles.

Maintain a service/feature catalog with:

- Product owner and intended user outcome.
- Engineering/service owner.
- Data owner and classification.
- Support and moderation owner.
- Security/privacy reviewer.
- Dependencies and providers.
- SLO and dashboard.
- On-call/escalation expectation.
- Runbook and rollback/kill switch.
- Cost center/budget alert.
- Current gate, maturity level, and deprecation plan.

The application must not promise 24/7 human support, instant verification, dispute mediation, emergency response, or a resolution time unless staffing and escalation actually meet that promise. Publish real support hours and emergency/security contact behavior before public launch.

## 54. Requirement Traceability and Acceptance Matrices

Convert prose into a traceability matrix before implementation. Every normative requirement receives a stable ID, release gate, owner, status, implementation links, automated-test links, manual evidence, risk, and last-reviewed date.

For every user-facing route and major component, test a matrix covering:

- Anonymous, Contractor, Tradesperson, organization member, blocked/suspended, support, and admin access as applicable.
- New, complete, expired, restricted, and deleted account states.
- Loading, empty, partial, populated, stale, offline, validation error, permission denied, rate limited, provider failure, server failure, and recovery.
- Small phone, large phone, tablet, laptop, and wide desktop at supported zoom/text sizes.
- Light, dark, reduced-motion, keyboard-only, and representative screen-reader use.
- Slow cellular, interrupted request, double submission, stale client, and resumed draft.
- Authorized object access and attempted cross-user/cross-organization access.
- Analytics, audit, notification, and support visibility expected from the action.

A screenshot proves appearance only. Acceptance of a working feature also requires persisted state, authorization evidence, API/database verification, refresh/relogin behavior, and failure recovery.

## 55. Founder Decisions That Must Be Locked Before Public Launch

The coding agent must not invent answers to these business decisions. Record an explicit owner-approved decision and date for each:

1. Gate A pilot size, invitation criteria, support model, and target completion date.
2. Initial Jacksonville counties/zip clusters and priority trade clusters.
3. Whether companies, individuals, or both are the contracting identity of record.
4. Exact license, insurance, identity, and background-check claims offered at each gate.
5. Review publication, dispute, response, removal, and appeal policy.
6. Cancellation/no-show policy and whether any account consequence exists.
7. Support hours, safety escalation, moderation coverage, and response targets.
8. Media/message/business-record retention and account-deletion behavior.
9. Public-profile indexing default and searchable fields.
10. Pilot/public pricing, free trial, premium entitlements, downgrade, cancellation, and refund rules.
11. Whether SMS is essential for Gate A or deferred until compliant registration is complete.
12. Approved providers, budgets, and data-sharing constraints.
13. Shop Talk and Trade News editorial/moderation ownership.
14. The exact event that counts as RIVT's successful work connection and north-star outcome.
15. Legal review and launch-approval authority.

Until decided, build reversible interfaces and data models, keep affected features behind flags, and label the decision as open in `RISKS.md` or `DECISIONS/`. Do not expose internal indecision to customers through placeholder copy.

## 56. Token-Efficient Execution Packets

The master contract is too large to paste blindly into every AI session. Generate a bounded execution packet for the active slice containing:

- RIVT mission and non-negotiable boundaries.
- Current release gate and phase.
- Exact requirement IDs in scope.
- Relevant architecture decisions and domain states.
- Files/modules owned by the slice and files that must not be changed.
- Acceptance matrix rows required for the slice.
- Current production/migration/provider constraints.
- Tests and evidence required before handoff.
- Known risks and explicitly deferred adjacent work.
- Required `BUILD_STATE.md` update format.

The execution packet supplements this contract; it cannot weaken safety, privacy, authorization, data-preservation, or product-boundary requirements. Include links to the source sections rather than copying unrelated material. This reduces daily token use, prevents context drift, and makes completion claims auditable.

When an AI session approaches its practical context/token limit, it must stop at a verified checkpoint, update the persistent handoff, and name the next exact task. It must not rush unfinished code, skip tests, or begin a broad rewrite to “use the remaining tokens.”

## 57. Existing-System Rebuild and Data-Migration Strategy

RIVT already has code, a live domain, deployed services, a PostgreSQL database, object storage, provider configuration, and potentially real records. Treat this as a live-system modernization, not an empty greenfield project.

Before replacing architecture or UI:

- Identify the authoritative repository, protected branch, deployment source, deployed commit, production environment, database, storage bucket, domain/DNS, OAuth callbacks, messaging sender, and owner for each account.
- Reconcile unmerged branches and AI-generated changes deliberately. Never assume another tool's branch reached production.
- Produce a current route/API/schema/storage inventory and identify data written by legacy code.
- Snapshot and test restore before destructive migrations.
- Define whether each legacy feature is retained, migrated, wrapped, replaced, archived, or removed.
- Preserve stable public URLs where practical; otherwise add intentional redirects.
- Map legacy statuses and records to canonical new states, including unknown/invalid values and rollback behavior.
- Use backward-compatible migrations and feature flags to transition vertical slices.
- Avoid long-lived dual writes; if unavoidable, define source of truth, reconciliation, monitoring, and exit date.
- Never reset production merely to simplify development.
- Validate record counts, ownership, file accessibility, timestamps, and key business totals before and after migration.
- Keep legacy code out of new navigation once its replacement is verified, but do not delete it until rollback and data dependencies expire.
- Display and log the running application version/build identifier in an internal diagnostics surface so operators can prove what is deployed.

Maintain a deployment ledger containing source commit, build artifact, migrations, configuration version, feature flags, deployer, deployment time, smoke-test result, and rollback target. “It is on GitHub” is not evidence that it is live.

## 58. Maintainable Code and Test-Data Architecture

The implementation must remain understandable to future humans and AI agents.

- Organize code around product domains and explicit boundaries, not one giant application component, route switch, stylesheet, or global state object.
- Keep UI rendering separate from API/provider concerns and business-state transitions.
- Centralize authorization policy on the server and share only safe capability descriptions with clients.
- Use typed domain contracts and validation at trust boundaries.
- Prefer small composable components and services with descriptive names over premature generic abstraction.
- No production business state may rely solely on component state, process memory, browser local storage, or hidden mock fixtures.
- Local/IndexedDB storage may cache data and preserve drafts, but reconciliation and user-visible sync status are required.
- Use synthetic factories for tests and demos. Clearly mark nonproduction environments; never copy real messages, identity evidence, addresses, or media into fixtures.
- Seed scripts must refuse to run against production by default and require an explicit protected override for any approved administrative dataset.
- Test clocks, IDs, provider responses, location, and network behavior deterministically.
- Document nonobvious invariants near the owning domain code and in decision records, not as narration scattered through components.
- Track technical debt created by a phase with owner and removal condition; do not hide it behind “temporary” comments.
- Remove unused dependencies, dead routes, duplicate components, obsolete brand strings, and unreachable feature flags after safe migration.

Code review must ask: can this fail safely, can it be observed, can it be tested without production providers, can another developer find the source of truth, and can it be changed without breaking unrelated workflows?

## 59. Marketplace Abuse and Fraud Threat Model

Create and regularly update an abuse-case register. At minimum consider:

- Fake, borrowed, altered, expired, or scope-mismatched license/insurance/certification evidence.
- Stolen identities, account resale, shared credentials, synthetic profiles, and duplicate accounts.
- Bait-and-switch scope, location, pay expectation, crew composition, or identity.
- Contractors seeking regulated work without appropriate responsibility or professionals claiming unsupported qualifications.
- Nonpayment, payment reversal, false payment records, invoice fraud, wage theft allegations, and coercive off-platform terms.
- No-shows, coordinated cancellations, retaliatory reviews, review rings, reputation extortion, and quid-pro-quo ratings.
- Spam applications, mass invitations, scraping, lead harvesting, contact export abuse, and competitor data extraction.
- Harassment, discrimination, threats, stalking, doxing, unsafe-site targeting, and exposure of occupied/sensitive locations.
- Phishing links, malware files, fraudulent invoices, impersonated support, and social engineering.
- Shop Talk misinformation involving electrical, gas, structural, equipment, legal, tax, licensing, or safety risk.
- Stolen project photos, portfolio misrepresentation, confidential customer imagery, and intellectual-property complaints.
- Referral, trial, subscription, SMS, email, storage, export, and AI-credit abuse.
- Admin/support misuse, excessive internal access, unauthorized exports, and manipulation of enforcement evidence.

For each abuse case define prevention, detection signal, user report path, internal evidence, automated limits, human decision point, user communication, appeal, retention, recovery, and metric. Avoid secret “trust scores” that create adverse decisions without explanation or review.

Safety controls must not become discriminatory proxies or make legitimate new users undiscoverable. Measure false positives, appeals, reversals, and disparate impact alongside prevented abuse.

## 60. Canonical Jobs, Profiles, and Trade Taxonomy

These domain details anchor the product and prevent a generic job-board implementation.

### Job posting model

Use progressive steps: Basics -> Scope and requirements -> Schedule and location -> Compensation/terms -> Review and publish. Preserve a draft after each meaningful change.

Canonical fields include:

- Job title and searchable trade category/specialty.
- Work type: side work, short-term help, project crew, longer engagement, or other approved type.
- Public location label and private exact address/site instructions.
- Scope/description with optional structured tasks and exclusions.
- Difficulty level 1–5 with plain labels: Easy, Moderate, Challenging, Advanced, Expert.
- Difficulty is the contractor's scope estimate, not a license, safety rating, wage level, or eligibility gate. Any qualified user may express interest unless a real legal/credential requirement applies.
- Desired skills and experience, crew size, and whether helpers are allowed.
- Tools/equipment/materials: contractor supplied, tradesperson required to bring, optional, and special access/equipment.
- Insurance expectation using explicit states: required, preferred, not required/unspecified where legally appropriate; never infer coverage.
- Preferred start date/time, flexibility, application deadline/open-ended state, estimated duration, schedule, timezone, and recurrence when enabled.
- Compensation expectation such as fixed amount, hourly range, day rate, request quote, or discuss; label estimates and clarify that direct payment is handled by the parties.
- Site readiness/access fields from Section 44, privacy-aware contact-on-arrival, and permit/inspection responsibility where relevant.
- Completion expectation, documentation required, cancellation terms, and optional external contract/PO reference.

Before publish, show one concise preview matching what tradespeople will see, a private-information summary, missing critical details, usage/rate-limit state, and the exact consent being accepted.

### Job discovery and cards

Default discovery prioritizes selected trades, service area/travel preference, availability, recency, and credible fit. Do not hide all new-user jobs or users behind reputation ranking.

A compact job card must make the decision scannable:

- Status and urgency/deadline.
- Trade, title, public area, approximate distance where available.
- Start/date flexibility and estimated duration.
- Compensation expectation.
- Difficulty with text and icon, not color alone.
- Key requirements such as insurance, tools, credentials, or crew size.
- Posted time and saved/applied/invited relationship state.
- One primary action appropriate to the user's role and current state.

Filters include trade, distance/service area, date/start window, difficulty, duration/work type, compensation type/range where lawful, insurance/credential requirement, and saved/applied status. Filters live in a mobile bottom sheet with active removable chips; search and result count remain visible.

### Contractor/company profile

- Business and contact name, approved logo/photo, business description, website, public contact choices, service area, trades/specialties, and member since.
- Organization members and authorized account role where applicable.
- License, insurance, certification, and identity states with definitions/evidence visibility rules.
- Jobs posted/completed, response behavior, repeat collaborators, reviews, documentation quality, and other reputation signals only when accurately defined and sample size is meaningful.
- Portfolio/project examples only with permission.

### Tradesperson/crew profile

- Full/professional name, photo, concise bio, trades/specialties, experience description, location/service area, travel preference, and availability freshness.
- Individual versus crew identity, expected crew members, crew size/capabilities, and substitution rules.
- Tools/equipment and vehicle claims labeled self-reported.
- License, insurance, identity, background-check, safety-learning, and certification states with evidence definitions and expiration.
- Completed RIVT work, repeat collaborations, reviews, Shop Talk contribution, and response/reliability signals with context and count.
- Portfolio gallery with project description, date/period, trade, selected media, provenance/permission, and optional link to an eligible completed RIVT record.

### Trade taxonomy

Maintain a versioned hierarchical taxonomy with broad trades, specialties, synonyms, related tools/credentials, and jurisdictional-regulation metadata. At minimum prepare for electrical, plumbing, HVAC/mechanical, carpentry, cabinetry, framing, roofing, flooring, drywall, painting/finishing, welding/metalwork, concrete/masonry, tile, insulation, landscaping, equipment operation, low voltage, fire protection, solar, glazing, demolition, restoration, general labor, and other approved commercial/industrial specialties.

- Taxonomy search supports common jobsite terminology and spelling variants without changing the user's chosen professional label.
- Do not hardcode trade names independently across forms, filters, profiles, news, Shop Talk, and analytics.
- Taxonomy changes are migrated/versioned so saved searches and historical records remain intelligible.
- A trade selection does not confer qualification, license, union status, experience level, or permission to perform regulated work.

## 61. Safety Learning and Credential Semantics

RIVT may provide short, practical safety-learning modules because safer expectations and visible learning effort can improve trust. The product must not misrepresent lightweight in-app learning as an OSHA card, license, accredited certification, employer training, site-specific orientation, or proof of competence.

- Initial topics may include PPE awareness, ladder basics, fall-hazard awareness, hazard communication, electrical awareness, and stop-work/reporting expectations after expert review.
- Every module has qualified content owner/reviewer, source references, jurisdiction/scope, version, review date, passing rule, attempt policy, accessibility review, and retirement/replacement process.
- A badge says exactly “Completed RIVT [module] on [date/version]” or another counsel-approved description.
- Updated material may require re-acknowledgment; expired/retired badges remain historically accurate but do not appear current.
- Never rank a lightweight badge above actual verified credentials, and never allow it to satisfy a job's legal requirement.
- Unsafe quiz answers may provide education but do not become public punitive profile data.
- Site owners/contractors remain responsible for required site-specific training, supervision, PPE, and compliance.

## 62. Reviews, Recognition, and Reputation Definitions

Reputation must help real decisions without becoming a game or a weapon.

- Reviews unlock only after an eligible completed relationship and one review per party per job.
- Capture overall experience plus a small set of role-relevant dimensions such as communication, reliability, scope accuracy/work quality, site readiness, and documentation. Do not collect dimensions that RIVT cannot explain fairly.
- The other party receives the review under the approved blind/approval/dispute policy; timing and publication rules must be consistent and visible.
- Disputed reviews retain evidence, permit a response, receive status, and cannot be silently edited by support.
- Display count, recency, role context, and distribution; avoid a misleading precise average for tiny samples.
- Private notes and internal fraud/safety signals never appear as public review text.
- A **Shout-out** is lightweight positive recognition for a specific helpful behavior, not a substitute for a completed-work review or verified credential. Limit frequency and detect reciprocal farming.
- Shop Talk recognition identifies useful community contribution. “Verified Fix” means accepted by the asker, not certified safe by RIVT.
- Reliability signals distinguish confirmed event, party allegation, excused event, disputed event, and resolved outcome.
- Users can report review extortion, retaliation, discriminatory content, conflicts of interest, and fabricated relationships.

## 63. Role-Correct Screen Composition

Do not render the same dashboard with labels swapped.

### Global application shell

- Compact top bar: approved RIVT wordmark, global search, messages with unread state, notification bell with unread state, and profile avatar/menu.
- No Contractor/Tradesperson toggle.
- Mobile bottom navigation contains exactly Home, Work, Crew, Shop Talk, and Tools.
- Desktop sidebar uses the same concepts and naming.
- No duplicate Post action in both header and bottom navigation. Use one contextual action.
- Dashboard statistics appear only where they help Home; do not repeat them atop every tab.

### Contractor Home

Prioritize active work requiring attention, new/aging applicants, upcoming starts, completion/invoice/review actions, crew availability/recent collaborators, and a concise “since last visit” summary. An empty contractor Home should guide the user to complete profile/service area or post/invite for real work.

### Tradesperson Home

Prioritize accepted/upcoming work, offers/invites requiring response, high-fit nearby opportunities, application updates, unanswered questions in their trades, profile/availability freshness, and a concise “since last visit” summary. Never show Post job as the primary tradesperson action.

### Work

Contractor subviews: Posted/Drafts, Applicants, Offers/Invites, Active, Completion, Closed/Templates as applicable to the gate. Tradesperson subviews: Discover/Saved, Applications, Offers/Invites, Active, Completion, History. Use counts only for actionable status, not decorative badges.

### Crew

Discovery, Connections/Trusted, Crews, and Invites appropriate to the role and gate. Person cards use the standardized identity, trade/location, evidence, availability, relationship context, and one primary action.

### Shop Talk

An explicit Talk/Trade News segmented control. Talk is search-first Q&A. Trade News shows real source links and thumbnails. The two modes do not interleave unlabeled content.

### Tools

A restrained launcher for focused mini-apps and recent user-created artifacts. Do not display marketplace job cards inside Tools by default. Each tool has its own full workspace, history, settings, and close/back model.

### Messages and notifications

Open from the top bar and remain full destinations with search/filter and back behavior. They do not consume two of the five bottom-navigation positions. Empty, permission, muted, blocked, failed-delivery, and offline states are explicit.

## 64. Contract Governance, Versioning, and Change Control

This master contract is a controlled product artifact. Adding requirements forever without resolving priority would make it unusable.

- Assign a document owner and approving founder.
- Maintain a short changelog containing version, date, author, reason, affected gates/phases, and decisions superseded.
- Give normative requirements stable IDs in the traceability matrix; editing prose must not silently erase their history.
- Mark superseded requirements rather than leaving contradictory copies active.
- Every material change states whether it expands scope, clarifies existing scope, fixes risk, or defers/removes work.
- Scope additions after a gate is frozen require impact review for schedule, cost, migrations, testing, support, security, and legal review.
- Research references inform decisions but do not automatically become requirements.
- Review links and provider assumptions periodically because product pages, laws, standards, APIs, and pricing change.
- Generate a concise release-gate brief and active execution packet from this contract; do not ask implementers to infer priority from document length.
- Archive prior approved versions so the team can explain why the product changed.

## 65. Complete Account and Authentication Lifecycle

Authentication is more than signup and login. Define and test:

- Email change: step-up authentication, verify the new address, notify the old address, revoke risky sessions when appropriate, and preserve recovery path.
- Phone change: verify the new number, notify the old channel where safe, update SMS consent separately, and prevent recycled-number exposure.
- Password change/reset: notify the user, rotate/revoke sessions according to risk, rate-limit requests, and prevent account enumeration.
- OAuth linking/unlinking: never allow removal of the last usable login method; show connected identity and last-used time without exposing provider secrets.
- Duplicate accounts: detect cautiously, never merge automatically, require proof/control of both identities, preview affected organizations/content, preserve audit, and provide rollback/escalation.
- Lost-provider access: offer a separately verified recovery route; support staff cannot bypass proof casually.
- Compromised account: one-tap session revocation, credential reset, sensitive-action review, profile-change review, and security-event timeline.
- New-device and suspicious-login notification with useful time/device/location approximation and “not me” recovery.
- Optional passkeys/MFA/recovery codes only when implementation and recovery are complete; do not force a factor users cannot safely recover during the pilot.
- Account closure/deletion: step-up confirmation, outstanding work/dispute warning, export option, organization-ownership transfer, shared-record treatment, cooling-off/recovery period where lawful, and final notification.
- Deceased/incapacitated owner or defunct company: documented support/legal escalation without ad hoc data transfer.

Account state must be explicit: invited, unverified, active, restricted, suspended, deletion pending, deleted/anonymized, and legally retained. Every API enforces the state consistently.

## 66. Device, Browser, Permission, Network, Time, and Unit Behavior

RIVT is used in uncontrolled field conditions. Define a support matrix for current Android Chrome, iOS Safari/installed PWA, and current desktop Chrome/Edge/Safari/Firefox as appropriate. Record tested versions and graceful behavior outside the supported range.

- Camera, photo-library, microphone, notification, location, clipboard, file, and storage permissions are requested only at the action that needs them.
- Permission denial explains what still works and how to change the setting; never trap the user.
- File upload supports compression, visible quality choice where relevant, per-file progress, cancellation, retry, duplicate detection, and resumable/chunked behavior for large media when supported.
- Detect low bandwidth/offline state without assuming `navigator.onLine` proves reachability.
- Respect reduced-data preferences where available and offer upload-later behavior; do not autoplay/download large video.
- Monitor local storage/IndexedDB quota, explain eviction risk, and reconcile drafts/media queue with server state.
- Background sync is opportunistic and platform-dependent. Never promise uploads continue after the browser/PWA is killed unless verified on that platform.
- Avoid unnecessary GPS polling, wake locks, animation, and media processing that drain battery or overheat devices.
- Display queued/pending state across app restart and prevent duplicate upload on resume.
- Store canonical timestamps in UTC with source timezone; render dates in the relevant job timezone and user's local timezone where ambiguity matters.
- Handle daylight-saving transitions, overnight shifts, ambiguous/nonexistent local times, locale date formats, first day of week, and 12/24-hour preferences.
- Store canonical measurement values with units. Support U.S. customary and metric display/conversion without losing precision or silently changing entered values.
- Currency is explicit on every monetary record and never inferred solely from device locale.

## 67. Data Integrity, Reconciliation, and Repair

The system needs ways to detect and repair inconsistency after retries, partial outages, provider delays, migrations, or bugs.

- Define database invariants and enforce critical ones with constraints and transactions.
- Maintain idempotency records for retryable mutations and provider webhook events.
- Run reconciliation jobs for notification/provider state, subscriptions/entitlements, media metadata versus stored objects, organization membership, counts/aggregates, and workflow statuses.
- Detect orphaned files, dangling references, impossible state transitions, duplicate active offers, duplicate reviews, and records missing ownership.
- Rebuild derived counts/search indexes from canonical records rather than hand-editing them.
- Provide dry-run repair tools, affected-record preview, reason/actor, audit output, and rollback where possible.
- Quarantine uncertain records instead of deleting or silently guessing.
- Alert on reconciliation drift and track time-to-repair.
- Test concurrency around applying/hiring, offer acceptance, job close, review creation, account merge, invoice numbering, and organization ownership.
- Backfills and repairs are versioned, resumable, rate-limited, observable, and safe to rerun.
- Never let an admin console mutate production through arbitrary unaudited database commands as a normal support workflow.

## 68. Continuous User Research and Product Validation

The pilot is a research program, not merely an early release.

- Define the assumptions each phase is testing and what evidence would disprove them.
- Interview both sides separately: contractors who post work, contractors who do not, tradespeople who apply, tradespeople who decline, successful matches, cancellations, no-shows, and users who stop returning.
- Observe real task completion on representative phones; stated preference alone is not usability evidence.
- Obtain consent for recordings/screenshots and keep research data separate from public profiles and operational decisions.
- Use a structured feedback taxonomy: usability, missing information, trust, safety, marketplace quality, performance, bug, support, pricing, and feature request.
- Link high-value feedback to the affected journey and user segment without exposing identity broadly.
- Measure task success, time, error/recovery, abandonment, support need, and comprehension of trust/legal language.
- Do not let the loudest user or largest feature list set roadmap priority. Combine frequency, severity, strategic fit, safety, effort, revenue/liquidity impact, and confidence.
- Close the loop with pilot users when material feedback changes the product.
- Use satisfaction measures such as CSAT/NPS only as supporting signals; they do not replace behavioral and qualitative evidence.
- Maintain a decision log for rejected requests so they are not repeatedly rediscovered without context.

## 69. Analytics Data Governance and Metric Quality

Analytics must be trustworthy, privacy-aware, and useful enough to drive decisions.

- Maintain a versioned event dictionary with stable name, trigger, owner, gate, allowed properties, data classification, identity rules, and retention.
- Distinguish client intent, server acceptance, provider delivery, and completed business outcome; do not count button clicks as completed work.
- Validate events in development/CI and monitor missing, duplicate, delayed, or malformed events in production.
- Use canonical server events for critical marketplace and financial metrics.
- Define user, organization, anonymous-device, session, job, and market identifiers; document identity stitching and deletion behavior.
- Keep restricted evidence, message bodies, addresses, contact details, tokens, and free-form sensitive content out of analytics.
- Separate essential operational telemetry from optional marketing/product analytics and honor applicable consent.
- Restrict warehouse/dashboard access, audit exports, and use aggregate/minimum-cohort rules where small markets could reveal individuals.
- Define every dashboard metric's numerator, denominator, timezone, late-event policy, exclusions, and owner.
- Reconcile executive metrics to source-of-truth database queries before using them for expansion or pricing decisions.
- Track instrumentation changes alongside releases so apparent growth is not a measurement artifact.

## 70. External API, Webhook, and Integration Governance

Do not expose a public developer platform until core contracts and authorization are stable. Internal provider adapters still follow these rules.

- Every integration has explicit user value, data-flow diagram, scopes, owner, support boundary, rate/cost budget, and disable path.
- User-facing connections use least-privilege OAuth where available; API keys are scoped, named, encrypted, partially masked, rotatable, revocable, and never retrievable in plaintext after creation.
- Webhooks are signed, timestamp checked, replay protected, idempotent, ordered where necessary, retryable, observable, and delivered from documented egress where feasible.
- Outbound webhook payloads minimize data and support secret rotation, delivery logs, replay, pause, and endpoint verification.
- Version APIs and payloads; publish deprecation notice, migration guidance, sunset date, and usage visibility before breaking consumers.
- Provide sandbox/test mode and synthetic fixtures before allowing integrations to touch production workflows.
- Prevent integrations from bypassing user blocks, privacy, role permissions, consent, retention, or audit.
- Calendar/accounting/cloud-drive integrations must define conflict, deletion, ownership, duplicate, and source-of-truth behavior.
- Integration failure must not corrupt the canonical RIVT record or prevent users from accessing/exporting it.
- Maintain an integration certification and periodic reauthorization/review process for third parties when a public platform exists.

## 71. Subscription Financial Operations

RIVT does not process job payments at launch, but subscription billing still creates financial obligations.

- Maintain an internal subscription/entitlement ledger reconciled against the billing provider.
- Define plan, price, currency, billing interval, trial, coupon, tax treatment, effective date, and grandfathering as versioned products.
- Review sales-tax/VAT obligations and provider tax capabilities before selling outside approved jurisdictions.
- Define invoice/receipt ownership, revenue-recognition/accounting export, refunds, credits, proration, failed-payment recovery, chargebacks, disputes, and write-offs with professional accounting advice.
- A provider payment success does not grant entitlement until the signed event is validated and idempotently applied; reconciliation repairs missed events.
- Downgrade/cancellation must not destroy user-owned records. Define read/export access and over-limit behavior.
- Show billing administrator, next charge, amount/currency, payment-method summary, invoices, plan changes, and cancellation clearly.
- Protect refund, credit, plan override, and complimentary access with permissions, reason codes, limits, and audit.
- Monitor MRR/ARR only after definitions are fixed; also monitor gross margin, provider cost, support cost, fraud/chargeback cost, churn, and cohort retention.
- Keep job-payment records visibly separate from RIVT subscription billing.

## 72. Product Experiments, Rollouts, and Deprecation

- Every experiment states hypothesis, eligible population, primary metric, guardrails, duration/sample expectation, owner, and stop condition.
- Do not experiment with safety warnings, consent, legal rights, accessibility, account security, verification truth, pricing disclosure, or destructive behavior without appropriate review.
- Avoid dark patterns, forced continuity, fake scarcity, hidden control groups, or degrading the product merely to increase a metric.
- Feature assignment is stable enough to interpret and does not leak between organization members unexpectedly.
- Experiments use the feature-flag and analytics governance already defined; clean them up after decision.
- Staged rollouts define internal, pilot, percentage/cohort, market, and full-release gates with monitoring and rollback.
- Deprecation includes usage inventory, user communication, export/migration path, support plan, data treatment, API/client compatibility, and removal date.
- Release notes explain meaningful user-visible changes in plain language and distinguish fixes, new capabilities, policy changes, and removals.
- Do not advertise a capability before the intended cohort can use it reliably.

## 73. Business Continuity and Customer Communication

RIVT needs continuity beyond server backups.

- Maintain an inventory of domain, DNS, email, cloud, repository, deployment, database, storage, billing, messaging, OAuth, analytics, support, app-store, and legal accounts with business ownership and recovery contacts.
- Avoid one person's device, email, password manager, or payment card being the only recovery route for a critical service.
- Use company-controlled accounts, MFA, emergency access, periodic access review, and documented ownership transfer.
- Maintain minimum operational runway forecasts using infrastructure, provider, legal, insurance, support, moderation, and acquisition costs.
- Define what features are disabled gracefully if spending limits or provider credits are reached.
- Maintain appropriate business, cyber, and professional insurance decisions with qualified advisors; never let coverage assumptions live only in founder memory.
- Provide a public or customer-facing status channel appropriate to scale, plus incident and maintenance templates.
- Planned maintenance has scope, expected impact, timing/timezone, fallback, owner, user notice, and cancellation criteria.
- Security-sensitive incidents may require different communication timing/content, but silence cannot substitute for an incident plan.
- Notify affected users directly when their action or data is materially impacted, using verified contact channels and avoiding phishing-like links.
- Define customer-success ownership for onboarding, activation, stalled jobs, failed first value, renewal risk, and offboarding without promising enterprise service at a low subscription price.
- Test founder/key-person absence and critical-account recovery before public launch.

## 74. Brand, Content Rights, and Intellectual Property

- Use only the approved final RIVT logo exports and documented variants. The reference board is not itself a complete production asset set unless ownership and export quality are confirmed.
- Confirm trademark/name clearance and counsel-approved filing strategy separately from domain ownership and social-handle availability.
- Maintain a brand asset register with owner, source file, export sizes, usage, color/theme variant, license/ownership evidence, and replacement process.
- Fonts, icon libraries, stock media, maps, illustrations, sound, code samples, templates, and third-party data require documented licenses compatible with commercial web/mobile use.
- Competitor screenshots and preview images in Section 42 are research links only. Never bundle, cache, trace, recreate, or present them as RIVT assets.
- AI-generated visual assets require provenance records, human review, brand review, and checks for misleading people, unsafe work, protected marks, and incompatible training/use terms where available.
- User uploads remain subject to clear ownership/license terms. Users must have a copyright/privacy report path for stolen portfolio media, confidential project images, trademarks, impersonation, or other infringement.
- Define notice, counter-notice, repeat-infringer, preservation, and removal procedures with counsel before public user-generated media scales.
- Trade News stores only permitted metadata/excerpts/media and links to the canonical publisher. Respect source licenses and takedown requests.
- Public marketing claims, testimonials, customer logos, ratings, counts, and performance statistics require source evidence and permission.
- Do not copy competitor code, text, taxonomies, proprietary data, or distinctive visual composition. Record the principle adopted and RIVT-specific design rationale.

## 75. Software Supply Chain and Build Provenance

- Maintain a software bill of materials for production artifacts and review direct/transitive dependency licenses.
- Pin reproducible dependency versions with a committed lockfile; review lockfile changes and installation scripts.
- Use automated dependency, vulnerability, secret, and license scanning with an owned triage/patch process.
- Evaluate package maintenance, ownership, release history, download source, permissions, bundle impact, and replacement path before adoption.
- Avoid unnecessary SDKs, trackers, UI frameworks, and packages for trivial utilities.
- Isolate builds, restrict CI credentials, use short-lived credentials where possible, and prevent untrusted pull requests from accessing production secrets.
- Produce immutable build artifacts with source commit, build environment, dependency manifest, and integrity/provenance metadata.
- Verify downloaded binaries, actions, containers, and deployment plugins; pin third-party CI actions by trusted immutable reference where practical.
- Never run copied shell commands, migrations, package scripts, or AI-generated automation against production without review and a rollback plan.
- AI-generated code receives the same review, tests, security analysis, ownership, and license expectations as human-written code.
- Establish critical-vulnerability response targets and an emergency upgrade/rollback procedure.
- Remove abandoned or compromised dependencies promptly and test the provider/package exit paths described elsewhere in this contract.
