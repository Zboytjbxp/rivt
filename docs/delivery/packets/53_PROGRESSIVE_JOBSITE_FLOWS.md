# Packet 53 - Progressive Jobsite Flows

## Objective

Make Daily Log, Punch List, and Safety easier to complete in the field without
changing their saved records, ownership boundaries, active-work context, or
legacy routes. Each Jobsite section should expose the current task before its
advanced detail.

## Source boundary

- Base source: Packet 52 documentation release `82dcc44`.
- Implementation branch: `codex/progressive-jobsite-flows`.
- Existing Daily Log entries, Punch List records, Safety signoffs, project
  context, standalone context, and legacy links remain authoritative.
- No API, schema, migration, authentication, authorization, billing, storage,
  moderation, or record-shape change is part of this packet.

## Changes

- Daily Log now follows Today, Work, and Review. Site/date/crew context appears
  first, work completed and next step are the central task, and blockers,
  materials, and safety details stay behind an optional disclosure.
- Punch List now exposes Open, Add item, and Resolved as separate task views
  instead of placing creation, active work, and history in one long form.
- Safety now follows Check, Details, and Sign off. One checklist category is
  visible at a time, with explicit previous/next category controls and the
  existing signoff record preserved.
- Daily Log keeps Save and the current next step in a thumb-reachable lower
  action dock. Punch and Safety retain their existing lower action behavior.
- Existing Jobsite section routes, records, exports, history, and context
  ownership are unchanged.
- The rendered Tools harness now exercises every progressive stage and the
  optional Daily Log detail disclosure at desktop, mobile, and compact-phone
  widths.

## Acceptance

- Daily Log exposes Today, Work, and Review as three understandable tasks.
- Blockers, materials, and safety detail do not compete with the basic daily
  entry unless the user opens them.
- Punch List never shows add, open, and resolved workflows simultaneously.
- Safety shows one checklist category at a time and keeps completion progress
  visible.
- Existing records, legacy links, exports, signoffs, and exact work context
  remain reachable.
- Frequent actions remain in the phone thumb zone without horizontal overflow.

## Verification

- `npx tsc -b --pretty false` - passed.
- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run lint:security` - passed.
- `npm run test:unit` - 55 passed, zero failures or skips.
- `npm run test:e2e` - fail-closed auth and desktop/mobile discovery passed.
- `npm run test:ui:tools` - passed at 1440x900, 390x844, and 320x568 after
  traversing Daily Log, Punch List, and Safety progressive tasks.
- `npm run test:ui:mobile-actions` - passed.
- `npm audit --omit=dev` - zero vulnerabilities.
- `git diff --check` - passed before commit.
- `npm run test:integration` with the configured isolated `TEST_DATABASE_URL`
  - all 19 serial PostgreSQL integration suites passed in 1,031.8 seconds with
  zero failures or skips.

Rendered evidence is stored in
`C:/Users/zboyt/AppData/Local/Temp/rivt-tools-pass` and covers desktop, normal
mobile, and compact-phone behavior without document overflow.

## Rollback

Revert the Packet 53 implementation commit. No database or data rollback is
required because the packet changes client task sequencing and presentation
only.

## Deployment evidence

- Implementation commit: `fa3063a14a94d3bc1c256c0dafd94b59db82306a`.
- Merge commit: `af13e52232ec0199a35d11f7f059942fed25b7a5`.
- Railway served the exact merge commit at `https://rivt.pro/api/health` with
  migration 27 ready.
- The expected-source production monitor passed in 574 ms with PostgreSQL,
  S3-compatible object storage, Sentry, Web Push, matching-job alerts,
  operational controls, and all seven anonymous private-route checks healthy.
- No migration or production data change was required.

## Next packet

Packet 54 should reduce the account drawer to identity, Profile, Settings,
staff-only Admin, and Sign out. Profile metrics remain in Profile; device,
security, notification, subscription, and appearance controls remain in
Settings.
