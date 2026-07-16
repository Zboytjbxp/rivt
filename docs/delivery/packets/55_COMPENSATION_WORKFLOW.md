# Packet 55 - Compensation Workflow

## Objective

Let a contractor publish fixed-price, hourly, open-to-offers, or
request-quotes work while keeping the final accepted pay explicit. Let a
tradesperson maintain reference rates and propose terms without treating a
profile rate as a binding bid.

## Source boundary

- Base source: Packet 54 production release
  `657aa80eda8c1ea1de0771dc5918d2fcd0511193`.
- Implementation branch: `codex/compensation-workflow`.
- Jobs, applications, offers, active work, and profile authorization remain
  server-owned. This packet does not add payment processing, escrow, payroll,
  tax handling, or a guarantee that either party will pay or perform.
- Migration `0028_compensation_workflow` owns all new persistence and has a
  reviewed rollback migration.

## Changes

- Job compensation now has four explicit modes: fixed price, hourly, open to
  offers, and request quotes. Only fixed and hourly listings require a posted
  amount; open-to-offers may show an optional target; request-quotes carries no
  listing amount.
- Applications can include one complete proposed amount/unit pair. The
  contractor must review and enter the final agreed amount and unit before an
  offer can be sent. Accepted work preserves those final terms independently
  from the original listing and application proposal.
- Tradespeople can maintain per-trade hourly, day, and minimum-charge reference
  rates with network, applications-only, or private visibility. Search and
  application responses expose only the visibility allowed for that context.
- Work labels distinguish posted pay, targets, quote requests, proposals, and
  agreed pay. Rate cards are explicitly described as reference information,
  not an automatic bid or contract.
- Rendered Work lifecycle coverage now exercises a proposal, edited final
  offer, and accepted agreed compensation on mobile.
- The private accepted-work workspace now distinguishes contractor and
  tradesperson responsibilities, renders the active-work lifecycle instead of
  the closed public-listing status, releases the participant-authorized jobsite
  address to both sides, and exposes the existing project closeout workflow.

## Acceptance

- A contractor can publish a realistic hourly rate below the former fixed-job
  minimum, publish open-to-offers with or without a target, or request quotes
  without inventing a budget.
- A tradesperson must provide a positive amount and unit together when a quote
  is required; partial and zero-dollar proposals fail validation.
- A contractor cannot send an offer without positive final compensation.
- The accepted-work record returns the exact final agreed amount/unit even when
  the listing and applicant proposal differed.
- Private rates never appear in search or applications; applications-only
  rates appear only with an application; network rates may appear in people
  discovery.
- Closing a listing after acceptance does not label active work as closed.
  Accepted participants can open the exact jobsite, daily records, money tools,
  and role-appropriate completion or review action from Work.

## Verification

- `npm run build` - passed after the final implementation changes.
- `npm run lint` - passed after the final implementation changes.
- `npm run lint:security` - passed after the final implementation changes.
- `npm run test:unit` - 57 passed, including hourly-rate and positive-proposal
  regression coverage.
- `npm run test:e2e` - passed.
- `npm run test:ui:mobile-actions` - passed.
- `npm run test:ui:work-lifecycle` - passed with proposal and final-offer UI.
- The active-work lifecycle extension passed with separate contractor and
  tradesperson workspace assertions, exact private address, daily actions, and
  closeout routing at mobile width.
- `npm audit --omit=dev` - zero vulnerabilities.
- Migration apply/rollback/reapply and the compensation match-acceptance,
  jobs, messaging-notifications, project-completion, and
  reviews-admin-safety PostgreSQL suites passed against the configured
  isolated `TEST_DATABASE_URL`.
- `npm run test:integration:fresh` - all 19 serial PostgreSQL suites passed
  with zero failures or skips after resetting the isolated test database
  through migration `0028_compensation_workflow`.
- The focused match-acceptance PostgreSQL suite additionally proves the exact
  private address is returned to the accepted tradesperson and remains covered
  by participant authorization.

## Rollback

1. Stop writes using the new compensation fields.
2. Confirm that discarding new compensation modes, proposals, agreed terms,
   and rate cards is acceptable, then run
   `migrations/0028_compensation_workflow.down.sql` before reverting the
   implementation commit. The down migration is intentionally destructive to
   Packet 55-only data and must not be run casually.
3. Revert the Packet 55 implementation commit and redeploy the previous source.

## Deployment evidence

Deployed through Railway production deployment
`748dcef5-42a9-4e63-af86-c51a56ebdb96`. Live `/api/health` served exact source
`b9f7458978db70cd9c7d21d950376eaaa1a04d16` with migration
`0028_compensation_workflow` ready, PostgreSQL and S3-compatible storage
healthy, and Sentry and Web Push configured. The expected-source production
monitor passed in 612 ms with rollout controls off and seven anonymous
private-route checks.

The remaining acceptance boundary is a physical two-account pass through
fixed, hourly, open-to-offers, and request-quotes work. The automated
two-account PostgreSQL lifecycle already proves listing target, applicant
proposal, final offer, and accepted agreed compensation remain distinct.
That physical pass should also submit completion as the tradesperson and
confirm or request changes as the contractor.

## Next packet

After production verification, audit the compensation language and mobile
editing flow with one real contractor and one tradesperson. Do not add payment
processing as part of that review.
