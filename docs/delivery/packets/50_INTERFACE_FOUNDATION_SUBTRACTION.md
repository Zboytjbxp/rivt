# Packet 50 - Interface Foundation and Subtraction

## Objective

Reduce visual-system debt before changing Work or field-tool workflows. Remove
verified orphan styles, establish a named overlay scale, and route the remaining
custom Shop Talk and tool-context sheets through one accessible dialog behavior.

## Source boundary

- Base source: Packet 49 audit commit
  `c7c0b36407cc423b082273fcb2f561c617e719d5`.
- Implementation branch: `codex/interface-foundation-subtraction`.
- No route, record, database, authorization, authentication, billing, storage,
  moderation, or product-workflow behavior changes in this packet.
- Work lifecycle and field-tool progressive-flow redesign remain separate
  packets so this foundation can be reverted independently.

## Changes

- Deleted the verified-orphaned `.theme-studio*`, `.appearance-studio*`, and
  `.field-kit*` experiment families from `src/styles.css`.
- Deleted the orphaned `.shop-talk-fab` family.
- Added a named z-index scale for content, sticky controls, shell chrome,
  scrims, toasts, dialogs, and recovery surfaces.
- Added shared `DialogBackdrop` and `DialogSurface` primitives using RIVT's
  existing focus-trap helper, Escape handling, backdrop dismissal, focus
  restoration, and accessible dialog semantics.
- Migrated the Shop Talk report sheet and Tools work-context picker to the
  shared dialog behavior without changing their content or business logic.
- Removed negative tracking from shared page, panel, and avatar primitives.

## Acceptance

- Verified orphan families have zero TSX/CSS references and are absent from
  the built stylesheet.
- Report and work-context sheets trap focus, close on Escape/backdrop, restore
  focus, and retain their existing actions.
- Camera keeps its one-handed lower capture controls.
- Tools and Shop Talk remain free of horizontal overflow at mobile and desktop
  widths.
- No stored record, server API, permission, or route changes.

## Verification

- `npm run build`
- `npm run lint`
- `npm run lint:security`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:ui:tools`
- `npm run test:ui:shop-talk-news`
- `npm run test:ui:mobile-actions`
- `npm run test:integration` with the configured isolated `TEST_DATABASE_URL`
- `npm audit --omit=dev`
- `git diff --check`

Rendered evidence covers Tools and Camera at 1440x900, 390x844, and 375x553,
plus Shop Talk at desktop and mobile widths.

The isolated PostgreSQL run completed 19/19 integration suites with zero
failures or skips. The duplicate runner created by an initial command-runner
timeout was stopped before the definitive clean serial run; no Railway service
or production data was touched.

## Deployment evidence

- Feature commit: `0b3fb5d43f91bc4720b7e74add546a642db31f9d`.
- Merge commit: `5b69d4bebd764271033cd461786a677cc0b98fa1`.
- Railway `/api/health` served the exact merge commit with migration
  `0027_default_private_photo_album` ready.
- The expected-source production monitor passed with PostgreSQL and private
  S3-compatible storage healthy, Sentry and Web Push configured, matching-job
  alerts enabled, rollout controls open, and all seven anonymous private-route
  probes passing in 586 ms.

## Rollback

Revert the Packet 50 implementation commit. The deleted selectors were
unreferenced, and the two migrated sheets retain their original class names,
so rollback requires no data or schema operation.

## Next packet

Packet 51 should simplify Work into four explicit user states: Browse, Hiring,
Active, and Archive. It must preserve current job/application APIs and exact
destination behavior while eliminating the stacked lifecycle presentation.
