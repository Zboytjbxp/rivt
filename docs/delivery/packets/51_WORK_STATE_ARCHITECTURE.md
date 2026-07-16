# Packet 51 - Work State Architecture

## Objective

Make Work understandable without changing its server-owned job lifecycle.
Separate discovery, hiring, accepted work, and history into four explicit user
states so a person sees the task they came to complete instead of every part of
the lifecycle at once.

## Source boundary

- Base source: Packet 50 production evidence commit
  `75a0234006c0d1e827540504540541a47d67199e`.
- Implementation branch: `codex/work-state-architecture`.
- Existing jobs, applications, offers, active-work records, exact links,
  messages, photos, logs, estimates, invoices, templates, and schedules remain
  in place.
- No API, schema, migration, authentication, authorization, billing, storage,
  moderation, or record-shape change is part of this packet.

## Changes

- Replaced Work's stacked status/dashboard presentation with four explicit
  states: Browse, Hiring or Applications, Active, and Archive.
- Browse contains open work, filters, saved searches, and one People handoff.
- Contractor Hiring contains drafts, applicant pipeline, templates, and
  schedule. Applicant cards now open the exact related job.
- Tradesperson Applications loads applications and offers across jobs and
  opens the exact related job, including records outside the current open-work
  list.
- Active is the accepted-work index and exact job workspace. On phones it
  replaces the browse list instead of appearing farther down the same page.
- Archive contains paused/closed postings for contractors and past active-work
  records for tradespeople. Exact non-active work links remain resolvable.
- Removed the device-local vanity metric bar from Work. It mixed unrelated
  local tool totals with server-owned hiring records and competed with the next
  action.
- Updated the Work lifecycle browser test to assert the new stage model and the
  complete offer-to-active-work handoff.

## Acceptance

- Work exposes exactly four primary lifecycle states.
- Browse does not simultaneously render hiring administration, active-work
  controls, archive controls, calendar, and templates.
- Contractor drafts and applicants remain reachable and exact.
- Tradesperson applications and offers remain reachable even when the related
  job is no longer in the open-work list.
- An accepted offer appears in Active and opens the exact server-owned work
  record with Messages, Photos, Daily log, Estimate, and Invoice intact.
- Focused active-work links suppress broad Work chrome on mobile.
- No horizontal overflow appears in the rendered Work lifecycle.

## Verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run lint:security` - passed.
- `npm run test:unit` - 55 passed, zero failures or skips.
- `npm run test:e2e` - fail-closed auth and desktop/mobile job discovery passed.
- `npm run test:ui:work-lifecycle` - passed.
- `npm run test:ui:mobile-actions` - passed after updating the legacy Work
  assertions to follow Work stage navigation.
- `npm run test:integration` with the configured isolated `TEST_DATABASE_URL`
  - all 19 serial PostgreSQL integration suites passed in 1,030 seconds.
- `npm audit --omit=dev` - zero vulnerabilities.
- `git diff --check` - passed before commit.

Rendered Work lifecycle evidence includes contractor draft-to-publish,
applicant-to-offer, tradesperson apply-to-accept, active-work priority, exact
notification handoff, active Photos/Daily log/Invoice bridges, and horizontal
overflow assertions.

## Deployment evidence

- Implementation commit: `f5c8838d6e189d744e230e7e4c2d9c54be8d3887`.
- Merge commit: `25ca2de639a40c6d7956de467a33decc99c520fa`.
- Railway served the exact merge commit at `https://rivt.pro/api/health`.
- The expected-source production monitor passed in 612 ms with PostgreSQL,
  S3-compatible object storage, Sentry, Web Push, matching-job alerts,
  operational controls, and all seven anonymous private-route checks healthy.
- No migration or production data change was required.

## Rollback

Revert the Packet 51 implementation commit. No data or schema rollback is
required because the packet changes only presentation and client routing among
existing records.

## Next packet

Packet 52 should simplify the highest-friction field forms through progressive
task flows, beginning with Estimate and Invoice while preserving their saved
records, email delivery, conversion, and receivable behavior.
