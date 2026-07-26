# Packet 71 — Pre-launch activation, accessibility, performance, and PWA

## Objective

Remove the highest-confidence activation and accessibility blockers found in
the `d68644a` launch audit without fabricating activity, exposing private
content, adding a local-auth fallback, or selecting third-party vendors on the
founder's behalf.

## Accepted implementation scope

- Revive the post-onboarding role checklist and make every action resolve to a
  real account, profile, community, Work, Shop Talk, or Tools destination.
- Give primary text actions a dedicated WCAG AA fill token in light and dark.
- Add vendor-neutral, PII-filtered analytics seams that remain disabled until a
  provider and public ingestion credentials are explicitly configured.
- Resolve trade persona from the canonical server profile with device storage
  used only as an offline cache.
- Keep the community directory useful when the server returns no communities,
  without inventing members, posts, or activity.
- Give an empty tradesperson Work view a real profile action.
- Issue signed, expiring, attributed invite links while preserving the
  Jacksonville pilot-code gate.
- Self-host launch fonts, prevent both theme logos downloading together,
  reduce layout shift, defer non-landing data, and memoize shell search data.
- Respect reduced motion, repair dialog focus behavior, raise small-type and
  coarse-pointer floors, and strengthen subtle text contrast.
- Precache the generated app shell and same-origin assets, add install
  discovery, and keep API/account data network-owned.
- Add generic report Open Graph metadata without exposing report content.

## Deliberate boundaries

- A cached app shell may open when the network is unavailable, but RIVT does
  not cache authenticated API responses or pretend a local profile is an
  authenticated account. Full authenticated offline editing needs a separate,
  reviewed data-conflict and device-security contract.
- No public job or Shop Talk route is introduced in this packet.
- No server-side Jacksonville posts or members are seeded.
- No analytics payload is delivered until the founder chooses a vendor and
  supplies its public ingestion configuration.
- Lifecycle marketing email, D1/D7 scheduling, and a limited unverified-account
  mode require consent, authorization, and lifecycle policy work and are not
  represented as complete here.

## Acceptance

- Fresh onboarded contractor and tradesperson accounts render their correct
  next checklist step; dismissal remains device-persisted.
- The computed primary-action fill/text contrast is at least 4.5:1 in both
  themes.
- Persona resolves from a server trade with no local-storage profile present.
- A tradesperson with no work sees an actionable profile path.
- Built HTML contains no Google Fonts request.
- Reduced-motion computed styles expose no non-trivial animation duration.
- Existing Tools, Shop Talk/Trade News, mobile-actions, and Work lifecycle
  rendered QA stays green.
- Baseline and updated light/dark mobile screenshots are retained under
  `docs/delivery/evidence/pre-launch-perfect-pass/`.

## Verification evidence

- `npm run lint`, `npm run build`, and all 99 unit/frontend tests pass.
- Fail-closed authentication and jobs/discovery end-to-end tests pass.
- Focused account-lifecycle and server-owned Shop Talk integration suites pass.
- Tools, Shop Talk/Trade News, mobile-actions, and Work lifecycle rendered
  smokes pass; mobile-actions asserts primary-action contrast in both themes
  and reduced-motion computed behavior.
- `npm audit --omit=dev` reports zero known production vulnerabilities.
- The aggregate `npm run test` wrapper was bounded at five minutes after its
  serial integration runner stalled at the pre-existing
  messaging/notifications boundary. It is not claimed as a complete pass.
