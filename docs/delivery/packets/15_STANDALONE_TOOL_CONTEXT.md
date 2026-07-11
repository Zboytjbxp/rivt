# Packet 15 - Standalone Tool Context

## Goal

Make Camera, Estimate, and Invoice useful for work acquired anywhere while
preventing tools from silently attaching drafts, prices, clients, or photos to
an unrelated RIVT marketplace job.

## In scope

- Three explicit tool contexts: Quick use, standalone project, and accepted
  RIVT work.
- Account-owned standalone projects with optional client, location, and trade.
- Context-linked estimate and invoice records.
- One project album per standalone project, using the existing authenticated
  private upload path.
- Bottom-thumb action docks for Camera, Estimate, and Invoice.
- Context-partitioned local drafts and exact deep-link context handoff.
- Safe attach-later handoff from Quick use when the destination has no existing
  Estimate or Invoice draft.
- A shared interaction standard for later field-tool work.

## Guardrails

- Never infer a project from the first job, first active-work record, or most
  recently loaded job.
- Standalone projects and albums are private to their owning account.
- Accepted-work context is authorized through active-work participation.
- A tool record cannot reference standalone and RIVT work at the same time.
- Quick-use records do not become marketplace records unless the user chooses a
  destination.
- Existing project-media upload authorization and server-confirmed success
  behavior remain intact.

## Acceptance

- Opening Invoice from Tools starts in Quick use with no unrelated job/client
  prefill.
- Selecting a standalone project scopes Invoice and Camera to that exact
  project.
- Opening from accepted work scopes the tool to that exact active-work ID.
- Server integration rejects cross-account standalone project and album use.
- Database migration applies and rolls back cleanly.
- At 390x844, context controls and primary Camera/Invoice actions remain in the
  viewport with no horizontal overflow.

## Verification evidence

- `npm run build` passed.
- `npm run lint` and `npm run lint:security` passed.
- `npm run test:unit` passed 53/53.
- `npm run test:e2e` passed auth and jobs/discovery at desktop and mobile.
- `npm run test:ui:mobile-actions` passed with Quick-use isolation,
  standalone-client prefill, and one-handed action-dock assertions.
- `npm run test:ui:tools` passed at desktop, mobile, and SE widths, including
  exact RIVT-camera context, capture/retry, and project-feed return.
- `test/tool-records.integration.test.js` passed account ownership,
  cross-account denial, context-linked estimates, ambiguous-context rejection,
  and standalone album ownership.
- The full integration run passed 18/19 suites; its only failure was the
  migration fixture's prior-version count. After making the fixture derive the
  latest version and adding migration-0026 rollback assertions,
  `test/migrations.integration.test.js` passed.

## Deployment boundary

Pending code review, merge to `master`, Railway migration 0026, exact-source
health proof, production monitor, and a physical-phone Camera/Estimate/Invoice
context check.
