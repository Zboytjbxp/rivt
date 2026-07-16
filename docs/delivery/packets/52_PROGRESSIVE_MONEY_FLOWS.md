# Packet 52 - Progressive Money Flows

## Objective

Make Estimate and Invoice easier to complete on a phone without changing their
math, saved records, delivery behavior, conversion path, or receivables truth.
Each tool should expose the next task instead of displaying the entire form at
once.

## Source boundary

- Base source: Packet 51 production evidence commit
  `3121b8920de0b23c25e0e33b99482f3b0f735d23`.
- Implementation branch: `codex/progressive-money-flows`.
- Existing estimate calculations, rate guidance, draft persistence, email and
  text handoff, Estimate-to-Invoice conversion, project invoices, external
  payment records, and work-context ownership remain authoritative.
- No API, schema, migration, authentication, authorization, billing, storage,
  moderation, or record-shape change is part of this packet.

## Changes

- Estimate now follows three explicit steps: Price, Customer, and Review.
  Pricing assumptions stay together; customer and delivery fields appear only
  when needed; internal guidance is separated from the customer-facing copy.
- Invoice now follows Items, Customer, and Review. Line construction no longer
  competes with recipient fields, payment follow-up, and the printable preview
  in one continuous form.
- Both flows use a thumb-reachable action dock that always exposes the current
  total, Save, the next step, and only the review actions relevant at the end.
- Invoice's Draft/Receivables switch moved out of the bottom action zone. It is
  now a stable section switch above the task flow, so it cannot cover Save,
  Copy, or Print on phones.
- Existing work-context selection remains explicit. Quick use does not inherit
  an unrelated job or client, while a selected standalone project or accepted
  RIVT job continues to prefill its own context.
- Browser coverage now follows each progressive step before asserting customer
  fields, Estimate conversion, Invoice delivery, and printable output.

## Acceptance

- Estimate exposes Price, Customer, and Review as three clear tasks.
- Invoice exposes Items, Customer, and Review as three clear tasks.
- Customer fields are not mixed into the initial pricing or line-item task.
- Internal price guidance is never presented as customer-facing invoice copy.
- Estimate conversion still opens an Invoice with cents-exact totals.
- Invoice draft persistence, project invoice records, external-payment status,
  email/text handoff, copy, and print remain reachable.
- Save and next-step controls remain inside the normal and compact-phone thumb
  zone without horizontal overflow.
- Draft/Receivables navigation does not cover the current task actions.

## Verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run lint:security` - passed.
- `npm run test:unit` - 55 passed, zero failures or skips.
- `npm run test:e2e` - fail-closed auth and desktop/mobile job discovery passed,
  including Estimate conversion and Invoice review.
- `npm run test:ui:tools` - passed at 1440x900, 390x844, and 320x568.
- `npm run test:ui:mobile-actions` - passed with explicit Invoice step and
  standalone-context assertions.
- `npm audit --omit=dev` - zero vulnerabilities.
- `git diff --check` - passed before commit.
- `npm run test:integration` with the configured isolated `TEST_DATABASE_URL`
  - all 19 serial PostgreSQL integration suites passed in 1,031 seconds with
  zero failures or skips.

Rendered evidence is stored by the Tools and mobile-action harnesses in the
system temporary directory and covers Estimate, Invoice, standalone context,
compact-phone layout, action reachability, and horizontal overflow.

## Rollback

Revert the Packet 52 implementation commit. No data or schema rollback is
required because the packet changes presentation and client task sequencing
only.

## Deployment evidence

- Implementation commit: `f02817c2d04fdca2d2383959f3b6cbc3511f3705`.
- Merge commit: `d39dc391cf7f5d88a3ed592f3dc3eccfc44da2dd`.
- Railway served the exact merge commit at `https://rivt.pro/api/health` with
  migration 27 ready.
- The expected-source production monitor passed in 548 ms with PostgreSQL,
  S3-compatible object storage, Sentry, Web Push, matching-job alerts,
  operational controls, and all seven anonymous private-route checks healthy.
- No migration or production data change was required.

## Next packet

Packet 53 should simplify Daily Log and Safety into progressive field tasks,
preserving the consolidated Jobsite app and every existing server-owned or
device-owned record contract.
