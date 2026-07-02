# RIVT Gate B / Gate C Roadmap

Status: Proposed planning baseline (post-Gate-A)
Anchors: `docs/delivery/GATE_A_SCOPE.md`, `docs/delivery/DEFERRED.md`,
`docs/product/PRODUCT_CONTRACT.md`, `docs/delivery/RISKS.md`
Rule zero: nothing in this roadmap may weaken Gate A auth, billing truthfulness,
trust language, uploads, records, moderation, or production-safety guarantees.
Gate A hard blockers carry forward permanently.

---

## Framing

- **Gate B — Jacksonville public launch.** Invitation removed. Anyone in the
  Jacksonville area can sign up. The product must survive strangers: abuse,
  emptiness, moderation load, and word-of-mouth in a small, tight-knit trades
  market where one burned contractor talks to fifty.
- **Gate C — scalable expansion platform.** A second metro can launch by
  configuration, not code. Monetization turns on. Ops, moderation, and support
  scale past founder-in-the-loop.

**The critical strategy call for Gate B: lead with what works at zero density.**
A public marketplace with no liquidity is a bad first impression that a small
market never forgets. Tools deliver value to one user alone. Shop Talk delivers
value at ten users. The marketplace needs hundreds. So Gate B's public sequence
is: (1) open signup quietly with Tools + Shop Talk as the daily-use wedge,
(2) grow supply (tradespeople) through community, (3) push contractor job
posting only once qualified supply exists per trade cluster. Marketplace-first
launch is the #1 avoidable failure mode.

**Daily-use test for every feature:** does it help a working contractor or
tradesperson on a Tuesday when they are not hiring and not job-hunting? Tools,
answers, alerts, and reputation pass. Dashboards, badges-for-badges, and AI
gimmicks do not.

---

# GATE B — Jacksonville public launch

## B1. Must-have product features

1. **Public signup with abuse controls.** Remove invite gate. Add signup
   velocity limits, disposable-email-domain rejection, and a review queue for
   suspicious accounts. Email verification stays mandatory before any write.
2. **Shop Talk fully public and fully server-owned.** Posts and communities are
   already server-owned (migrations 0015/0016) and reactions server-backed
   (0010). The gap is **answers/replies — still local-only** — and that gap is
   disqualifying for a public community: answers are the product. Server tables
   for answers, one-reaction-per-actor enforced server-side, author-gated
   Verified Fix, edit/delete windows. (Closes the R-024 preconditions.)
3. **Moderation that works at public scale.** Report → queue → action (hide,
   lock, warn, restrict) with audit trail; block enforcement in community
   surfaces, not just messages; profanity/link-spam heuristics on post/answer
   creation. A public UGC surface without a working queue is a liability, not a
   feature.
4. **Notifications that bring people back.** In-app center plus a daily/weekly
   **email digest** (deliverability-hardened) and **job alerts**: "new jobs in
   my trade within my radius" is the single highest daily-use feature for
   tradespeople and the MVP of saved searches. SMS only if founder-approved
   (see B5).
5. **Job discovery quality.** Filters that matter to a tradesperson: trade,
   distance, start window, duration/scope size, pay-signal if the contractor
   provided one. Fast list view; no map requirement.
6. **Profile credibility (evidence-state, not claims).** Portfolio photos on
   profiles (reusing the authenticated upload path), credential uploads with
   the existing self-reported → uploaded → reviewed states, response-time and
   completed-work counts from real data. No "verified" badge in Gate B without
   a manual review process behind it — the word stays tied to process.
7. **Crew basics.** Save/follow a tradesperson or contractor, a "my bench"
   list, and connect requests with mutual accept. This is the retention hook
   for contractors between hires. Advanced groups stay deferred.
8. **Tools kept sharp.** Promote the finished-but-stranded tools worth keeping
   (Time Tracker, Expense Logger, Materials, Bid Builder, Earnings — per the
   d134a11 audit), delete the rest. Tools remain local/browser-only per R-023;
   no server invoice sending or tax claims.
9. **Onboarding v2 funnel instrumented.** The events named in
   `ONBOARDING_STRATEGY.md` (`onboarding.*`, `activation.*`) actually recorded,
   so Gate B iterates on data instead of vibes.

## B2. Features to defer (from B)

- Subscriptions/checkout (Gate C; entitlements stay truthful and dark).
- Background checks / ID-verification providers (Gate C; manual review only).
- Advanced crew groups, recurring/bulk jobs, saved-search sophistication beyond
  trade+radius alerts.
- Public share links for records/albums (data-leak surface; defer).
- SEO indexing of profiles (until opt-in consent + anti-scraping posture).
- Native apps, AI anything, Facebook/Apple OAuth (unless Google+email funnel
  data shows a real gap).
- Nationwide/multi-metro anything.

## B3. UX improvements

- Execute polish Phases 2–4 from `UI_POLISH_BUILD_PROMPT.md` (Phase 1 merged at
  cc2f944): one filter taxonomy in Shop Talk, single Report flow, "Work" naming,
  dead-code subtraction, calculator ergonomics/fraction strip, FAB safe-area.
- **Cold-start empty states.** Public users will hit empty communities and thin
  job lists. Every empty state needs a next action ("Be the first to answer",
  "Set a job alert"), not boilerplate. No fake counts — the "124K members · 1
  post" optics must be gone before public eyes.
- **Time-to-first-value under 60s** for each role: tradesperson → alert set +
  first community joined; contractor → first job drafted (publish can wait).
- Notification center UX (read/unread, per-category mute) and digest
  unsubscribe that actually works — deliverability reputation depends on it.
- Messages discoverability on mobile (currently top-bar only; consider the
  nav-slot question deliberately rather than by default).
- Accessibility pass on the new public surfaces (focus order in modals, contrast
  on orange-on-white accents, hit targets ≥44px — calculator standard applies
  app-wide).

## B4. Backend/data requirements

- Server-owned Shop Talk answers/replies + reaction constraints (B1.2) with
  integration + live smoke evidence to the same standard as Packets 04–07.
- Moderation schema: reports, queue states, actions, actor audit; admin console
  capacity for a second internal user (support/mod) with least privilege.
- Notification infrastructure: outbox table, digest job runner, per-user
  preferences; email provider with SPF/DKIM/DMARC and bounce handling.
- Saved-search/alert tables (trade, radius, cadence) + the matcher job.
- **Upload hardening completion (R-007):** profile/portfolio surfaces wired to
  ownership checks and a malware-scanning provider decision — this is named in
  the risk register as required "before broad launch"; Gate B is broad launch.
- **CSRF/enumeration threat review + rate-limit tuning under real traffic
  (R-012)** — explicitly scheduled, not assumed.
- Analytics event pipeline (server-side events table is fine; no third-party
  tracker requirement) for funnel + liquidity metrics.
- Search: Postgres FTS over jobs/posts/profiles is sufficient; no search
  infrastructure adventure at this stage.
- Continue the strangler migration (R-014) opportunistically — any surface
  touched for Gate B gets extracted from App.tsx, no wholesale rewrite.

## B5. Provider/compliance needs

- **Email at volume:** production ESP with domain reputation, bounce/complaint
  webhooks, suppression list.
- **SMS (only if approved):** Twilio production + TCPA-compliant opt-in,
  quiet hours, STOP handling. Default recommendation: ship email + in-app
  first; add SMS when job-alert engagement proves demand.
- **Counsel review before public:** trust language signoff (R-016 explicitly
  requires it), public-launch Terms/Privacy, UGC/DMCA policy and takedown
  contact for public Shop Talk.
- **Malware scanning provider** (R-007) selected and wired.
- Florida-specific: DBPR license lookup stays a manual/review process feeding
  evidence states; no automated licensing claims (contract rule).
- Incident readiness green (R-022): dedicated error monitoring, paging, named
  backup owner, recorded support hours, one rehearsed incident. Currently
  blocked — this is a Gate B entry condition, not a nice-to-have.
- Backup policy approvals recorded (R-017): RPO/RTO, retention, drill cadence.

## B6. Monetization decisions

- **Stay free through Gate B. Do not charge for marketplace access while
  liquidity is forming** — pricing against an empty network kills it.
- Decide (not build) the Gate C model now, and instrument for it: target is
  **contractor-side subscription** (posting volume / bench tools) with
  tradespeople free — aligned with who captures value and avoids lead-fee
  dynamics the contract forbids. No percentage of job payments, ever (contract).
- Permitted in B: "Founding member" framing (early users get grandfathered
  pricing later), a price-sensitivity survey, and dark-shipped entitlement
  plumbing. Forbidden in B: any checkout UI, any pay-gated feature, any
  implied paid tier.

## B7. Risks and failure modes

- **Liquidity failure (top risk):** public marketplace opens empty →
  contractors post, hear silence, leave, and tell other contractors. Mitigate
  with the community-first sequence, per-trade-cluster supply thresholds before
  contractor recruitment, and honest "new here" framing.
- **Moderation incident week one:** a public trades forum will get spam,
  harassment, and dangerous advice. An unanswered safety-critical bad answer
  is a brand event. Mitigate: queue SLA, safety-flag priority lane, founder
  escalation path.
- **Scraping/harvesting:** public profiles + contact visibility = lead-gen
  bots. Mitigate: contact details stay relationship-gated (already contract),
  rate limits on profile enumeration, no SEO indexing yet.
- **Abuse of public signup:** fake contractors posting fake jobs to collect
  applicants' info. Mitigate: first-job review queue for new accounts,
  velocity limits, report pathway prominence.
- **Support overwhelm:** no backup owner today (R-022). Public launch without
  paging + a second responder is self-inflicted.
- **Trust-language drift:** public marketing pressure to say "verified pros."
  The evidence-state vocabulary must survive the landing page, not just the
  app.
- **Emptiness optics:** seeded member counts vs. real post counts (flagged in
  the d134a11 audit) read as fake at public scale — fix before launch.

## B8. Acceptance criteria (Gate B exit = ready to call the launch healthy)

- `npm run launch:readiness -- --require-ready` and
  `npm run incident:readiness -- --require-ready` pass; R-007, R-012, R-016,
  R-017, R-022, R-024 closed with evidence in the risk register.
- A stranger-to-stranger work loop (no concierge, no founder contact) completes
  in production: signup → profile → post/apply → accept → message → complete →
  review.
- Shop Talk: answers server-owned, moderation queue live with a measured
  response SLA, zero client-only social state presented as durable.
- Liquidity floor (tune numbers with founder): e.g. ≥3 trade clusters each with
  ≥15 active tradespeople; ≥5 legitimate jobs/week posted; median first
  qualified response < 48h; mutual-acceptance rate not degrading week-over-week.
- Retention signal: D30 return rate for activated users; digest/alert
  click-through measurable and non-trivial.
- Abuse under control: spam/report volume per 100 WAU below agreed threshold;
  no unreviewed first-jobs older than the SLA.
- All Gate A hard blockers still hold on the deployed commit.

## B9. Build behind feature flags now (during Gate A hardening)

- Server-owned Shop Talk **answers/replies** schema + API (biggest lead-time
  item; UI stays flagged off in pilot nav).
- Moderation queue tables + minimal admin console actions.
- Saved-search/alert tables + digest job (send to internal accounts only).
- Notification outbox + in-app center behind flag.
- Signup abuse controls (velocity, domain checks) — inert while invite gate is
  on, tested before it matters.
- Analytics events pipeline + onboarding funnel events.
- Region/metro config object (Jacksonville as config, per contract) — cheap
  now, expensive later.
- Entitlement plumbing kept truthful and dark (already started via the
  truthful-entitlement cleanup).

## B10. Do not expose until later

- Checkout, pricing pages, paid tiers (Gate C).
- "Verified" badges of any kind until a named review process exists.
- SMS until provider + consent flow are production-accepted.
- Public share links, SEO indexing, profile embeds.
- Background-check or ID-provider language.
- Any AI-labeled feature.
- Multi-metro selectors or "coming to your city" promises.
- Per DEFERRED.md rule: deferral means hidden, not "coming soon" buttons.

---

# GATE C — Scalable expansion platform

## C1. Must-have product features

1. **Metro playbook as software.** Second metro launches by configuration:
   region config, trade clusters, seeding checklists, local moderation
   settings. Success = zero code changes to open a city.
2. **Subscriptions live (contractor-side).** Tiered contractor plans (posting
   volume, bench size, closeout exports); tradespeople free. Server-owned
   entitlements (already truthful), Stripe billing + webhooks + dunning +
   grandfathered founding-member pricing. Still no job-payment processing,
   escrow, payroll, or 1099 — contractually out.
3. **Real verification program.** ID-verification provider (e.g. Stripe
   Identity/Persona class) and optional license-record review pipeline feeding
   the existing evidence states; "Verified identity" becomes a purchasable/
   earnable state with a documented process. Background checks only with FCRA
   counsel signoff — treat as its own sub-project or skip.
4. **Saved searches/alerts full version.** Multi-criteria, instant + digest
   cadence, push-capable.
5. **Advanced crews.** Groups/rosters, relationship notes, rehire shortcuts,
   crew availability — the contractor retention product.
6. **PWA hardened to near-native.** Push notifications, offline shell, media
   upload queue (deferred from A), installability. Native apps only if push +
   camera friction proves blocking — native is a cost center, not a milestone.
7. **Recurring/bulk work** for contractors with steady sub needs.
8. **Reputation maturity.** Cross-device durable reputation, answer quality
   signals, review response norms — built only on the server-owned social
   foundation from B.

## C2. Features to defer (from C)

- AI matching/estimates/moderation-assist: pilot behind internal flags only,
  and never in trust-bearing copy until precision is proven; AI compliance
  suggestions stay out (contract lists automated compliance decisions as
  non-goals).
- Homeowner anything: permanently out (contract).
- Job payments/escrow/payroll: permanently out (contract) — revisit only as a
  founder-level strategy decision with counsel, not a roadmap item.
- Marketplace ads/promoted placement: poisons trust ranking; defer until the
  subscription model is proven insufficient.
- Public API/integrations program.

## C3. UX improvements

- Metro switcher / service-area expansion UX (tradespeople working across
  regions).
- Contractor dashboard: pipeline across jobs, bench, and messages in one
  operational view (this is where a paid tier earns its price).
- Notification preference maturity (per-community, per-search granularity).
- Performance budget: cold-start and feed TTI targets on mid-range Android over
  LTE — expansion users won't all be on iPhone 15s.
- Localization scaffolding decision (Spanish for FL/TX trades markets is a
  real product question, not an afterthought).

## C4. Backend/data requirements

- Multi-region data model: region-scoped queries, geo distance (PostGIS or
  geohash), region-aware rate limits and moderation queues.
- Billing: subscription tables, webhook processing, entitlement enforcement at
  API level, revenue reporting.
- Job/queue infrastructure for digests, alerts, webhooks, media processing
  (outgrow single-process cron).
- Push notification service (Web Push) + token lifecycle.
- Observability at scale: error monitoring + tracing (already a named R-022
  item), per-endpoint SLOs, capacity dashboards.
- Read-path scaling: caching for hot feeds; read replicas when metrics demand.
- Data lifecycle: retention policy execution, account deletion/export
  (user-data rights), archive strategy for closed work.
- Finish the strangler migration (R-014) — Gate C velocity dies in a 1,700-line
  App.tsx.
- Admin console as a real internal product: moderation, support, verification
  review, region ops.

## C5. Provider/compliance needs

- Stripe (billing + tax on SaaS subscriptions), dunning/receipt compliance.
- ID-verification provider agreement + data-handling review (biometric/PII).
- FCRA compliance program if background checks proceed (adverse-action
  process); otherwise explicitly decide not to.
- State-by-state licensing language matrix as metros open (the Florida
  assumptions do not travel; "licensed" means different things per state and
  trade).
- Security posture maturation: pen test, dependency policy, incident program
  with rehearsal cadence (extends R-022), SOC2-lite trajectory if commercial
  customers ask.
- Privacy: published retention windows, deletion SLA, subprocessor list.

## C6. Monetization decisions

- Turn on contractor subscriptions with founding-member grandfathering; free
  tier stays genuinely useful (liquidity protection) — gate volume/power, not
  access.
- Tradesperson "Pro" (profile boosts, advanced alerts) only after contractor
  side proves; never gate applying to work behind payment.
- Verification fee (at-cost-ish) is acceptable and trust-aligned; lead fees and
  payment percentages remain off the table.
- Kill criterion: if paid conversion craters activation or liquidity in the
  first cohort, roll back pricing before expanding metros — pricing errors are
  recoverable only while small.

## C7. Risks and failure modes

- **Premature expansion (top risk):** opening metro #2 before Jacksonville
  shows repeat-collaboration and retention is vanity growth that doubles ops
  load with zero proof. Gate C entry requires Jacksonville health, not
  Jacksonville existence.
- **Monetization backfire:** charging into thin liquidity; mitigated by the
  free-tier floor and kill criterion above.
- **Verification liability:** a "verified" user causes harm → the word must
  map to a documented, insurable process; counsel-reviewed scope of claim.
- **Ops scaling:** moderation/support per-metro costs grow linearly while
  revenue lags; watch support tickets per 100 WAU as a first-class metric.
- **Feature bloat regression:** this codebase already demonstrated the
  layering-without-removal failure mode (two searches, stranded tools). Gate C
  needs a standing subtraction discipline — every addition names what it
  replaces.
- **Data model debt:** region and billing retrofits are the expensive kind;
  hence the B9 config work now.

## C8. Acceptance criteria (Gate C exit = expansion is a playbook)

- Second metro launched via configuration with zero schema/code forks, reaching
  agreed liquidity floors within its ramp window.
- Billing live ≥ one quarter: involuntary churn < agreed %, entitlement
  mismatches zero in audit, refund/dispute rate trivial.
- Verification program live with documented process, measured review SLA, and
  counsel-approved claims.
- Push + digest engagement sustaining DAU/WAU at or above Jacksonville
  baseline in the new metro.
- SLOs met for a full quarter; incident program rehearsed; on-call rotation
  ≥ 2 humans.
- Strangler migration complete for all daily surfaces (App.tsx no longer the
  router-of-everything).

## C9. Build behind feature flags now (cheap Gate-C insurance during A/B)

- Region config abstraction (again — the single best early investment).
- Entitlement checks at API boundaries (enforcing "free" explicitly, so paid
  enforcement is a config change, not a rewrite).
- Event/analytics schema designed with region + plan dimensions.
- Web Push token capture scaffold (dark).
- Verification evidence-state machine extended with provider-shaped states
  (pending-provider, provider-passed, provider-failed) unused until C.

## C10. Do not expose until later (or ever)

- Any AI-labeled trust or matching claims until precision is proven and
  reviewed — and automated compliance decisions never (contract).
- Background-check language before FCRA program exists.
- Multi-metro marketing before the playbook passes in metro #2.
- Job-payment/escrow/payroll surfaces: not approved, full stop.
- Homeowner flows: permanently out.

---

## Sequencing summary

1. **Now (during Gate A close):** B9 flag work — Shop Talk answers schema,
   moderation queue, alerts/digest plumbing, abuse controls, analytics, region
   config, dark entitlements. Plus polish Phases 2–4.
2. **Gate B entry conditions:** R-007/R-012/R-016/R-017/R-022/R-024 closed;
   counsel signoff; incident readiness green.
3. **Gate B launch order:** quiet open signup → Tools + Shop Talk wedge →
   per-cluster supply thresholds → contractor job-posting push.
4. **Gate B → C trigger:** Jacksonville liquidity + retention floors held for
   an agreed window, support load sustainable, monetization model decided and
   instrumented.
5. **Gate C:** billing on → verification program → metro #2 by config →
   scale ops.
