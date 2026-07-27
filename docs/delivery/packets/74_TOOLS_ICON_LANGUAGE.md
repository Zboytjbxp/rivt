# Packet 74 — Tools icon language

## Objective

Make the unified Tools launcher faster to scan by giving each tool a distinct,
professionally drawn identity instead of relying on generic or misleading
Lucide metaphors.

## Accepted implementation scope

- Keep the seven-tool launcher, pin ordering, categories, summaries, and tool
  behavior from Packet 73 unchanged.
- Use Phosphor's duotone family for recognizable universal concepts: Camera,
  Estimate, Invoice, Jobsite, and Materials.
- Use small RIVT-owned SVG marks where a generic library icon would weaken the
  product meaning: a tape-measure/ruler mark for Heavy 16th and a clock/cost
  mark for Time & costs.
- Standardize icon sizing, optical weight, container treatment, and motion
  across mobile and desktop using existing `--v2-*` tokens.
- Keep launcher names as the accessible control labels and mark the adjacent
  SVG artwork as decorative.

## Deliberate boundaries

- This packet does not change tool routes, calculations, records, pin
  persistence, launcher order rules, or server data.
- Lucide remains the interface icon set for navigation and ordinary controls.
  Phosphor is scoped to product/tool identity rather than creating a
  repository-wide icon migration.
- No image-generated artwork, brand-logo approximation, fabricated usage
  state, schema change, migration, or production-data change is introduced.

## Acceptance

- Camera no longer reads as a folder, Estimate no longer reads as legal
  scales, Materials no longer reads as a briefcase, and Time & costs no longer
  reads as synchronization.
- Every launcher has one unique `data-tool-icon` identity.
- All seven identity SVGs are hidden from assistive technology because the
  complete tool name remains on the button.
- The icon containers remain legible and contained at desktop, 390px mobile,
  and 320px compact-mobile widths in light and dark themes.
- Existing tool flows and pin customization continue to pass.

## Verification evidence

- Production build and lint pass.
- All unit/frontend tests and all 20 serial PostgreSQL integration suites
  pass.
- Fail-closed authentication plus Jobs/discovery E2E pass at desktop and
  mobile widths.
- Focused Tools rendered QA passes across desktop, 390px mobile, and 320px
  compact mobile. It asserts the exact seven unique identities, decorative
  accessibility behavior, launcher uniqueness, pin ordering, no horizontal
  overflow, and all existing tool flows.
- Light and dark launcher screenshots are captured outside the repository
  under `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- The production dependency audit reports zero known vulnerabilities.
- No deployment evidence is claimed in this packet.
