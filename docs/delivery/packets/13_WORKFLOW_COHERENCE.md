# Packet 13 - Workflow Coherence

## Goal

Make the five primary product areas feel like one deliberate workflow instead
of several overlapping dashboards. Each primary action must provide clear
feedback, open the exact record it refers to, and leave the next useful action
visible without duplicating navigation that already exists elsewhere.

## In scope

- Reduce duplicate active-work controls on Home and Work to one clear handoff
  into the exact job workspace.
- Keep job-specific actions inside the workspace where their job context is
  visible, rather than exposing the same actions in several summary cards.
- Reduce explanatory chrome in the Tools launcher while preserving Recent and
  core apps.
- Keep notification controls near the top of Settings and audit their
  discoverability.
- Record a workflow action matrix for Home, Work, Tools, Shop Talk, and
  Settings.

## Guardrails

- Do not remove a capability merely because its duplicate summary action is
  removed. The exact action remains available from the relevant workspace.
- Do not change authorization, billing, uploads, moderation, or server data
  behavior.
- Do not add a new navigation destination. Preserve Home, Work, Crew, Shop
  Talk, and Tools.

## Acceptance

- An accepted-work summary has one primary action: open the exact workspace.
- Home and Work no longer repeat four job actions before the user reaches that
  workspace.
- Tools launcher headings describe groups without marketing copy.
- Settings exposes notification controls before visual customization.
- Build, lint, unit, E2E, mobile UI smokes, dependency audit, and diff check
  pass before deployment.

## Local evidence

- `npm run build` passed.
- `npm run lint` and `npm run lint:security` passed.
- `npm run test:unit` passed (53 tests), including a rendered Home assertion
  that the accepted-work summary has one `Open workspace` handoff and does not
  duplicate Messages, Photos, or Daily log.
- `npm run test:e2e`, `npm run test:ui:work-lifecycle`, and
  `npm run test:ui:mobile-actions` passed. The lifecycle smoke opens Home's
  exact accepted-work workspace first, then opens that workspace's exact
  job-scoped photo feed.
- `npm audit --omit=dev` and `git diff --check` passed.

## Risk and deployment boundary

No server route, authorization rule, migration, provider, or stored-data
behavior changes in this packet. Production served source
`cab4c9e89f6422480a79c781a2e2aa7a41929377`; its monitor passed with PostgreSQL,
S3-compatible storage, configured Sentry, configured Web Push, matching alerts
enabled, controls off, and seven anonymous private-route checks. The remaining
evidence is a founder visual check of the simplified Home/Work handoff.
