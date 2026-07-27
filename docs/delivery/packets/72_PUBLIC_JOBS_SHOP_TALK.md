# Packet 72 — Public Jobs and Shop Talk discovery

## Objective

Make RIVT's two marketplace-defining surfaces discoverable and shareable
without silently publishing existing member content, exposing private jobsite
or contact data, fabricating activity, or weakening authenticated actions.

## Accepted implementation scope

- Add explicit `members` versus `public` web visibility to canonical jobs and
  Shop Talk posts. Existing and unspecified records remain member-only.
- Add explicit answer-author consent for answers submitted to a public Shop
  Talk thread.
- Publish server-rendered `/jobs`, `/jobs/:id`, `/shop-talk`, and
  `/shop-talk/:id` pages with canonical links, Open Graph/Twitter metadata,
  structured data, responsive tokenized presentation, and dynamic sitemap
  entries.
- Expose bounded, rate-limited read-only public APIs for those same projections.
- Keep job exact addresses, contact details, account identifiers, private
  communities, unconsented answers, hidden content, closed jobs, and inactive
  accounts outside the public projection.
- Require the owner to confirm attached media is suitable for the public web.
- Reject obvious email, phone, and street-address strings when an author asks
  RIVT to publish editable job or Shop Talk copy publicly.
- Add owner-facing visibility controls, honest publication disclosures, and
  public-share actions in Work and Shop Talk.
- Keep guest/sample posts ineligible for public-web publication.

## Deliberate boundaries

- Public viewing does not grant anonymous application, answer, vote, report,
  moderation, contact, or private-address access. Those actions remain
  authenticated and server-authorized.
- Role-limited communities cannot publish to the public web. The existing
  server audience value `public` is presented to members as `All RIVT`; public
  web publication remains a separate choice.
- Existing member-only answers are never retroactively exposed. A thread with
  an unconsented answer cannot be changed to public.
- The private-data detector is an additional publishing guard, not a promise
  that arbitrary prose can be perfectly classified. The UI disclosure and
  owner acknowledgement remain part of the contract.
- No existing production record is migrated to public visibility. No seed
  jobs, posts, answers, members, or engagement are created.

## Acceptance

- Existing and newly unspecified jobs/posts remain absent from public APIs and
  search pages.
- A public open job exposes only city/region, scope, requirements, and honest
  compensation context; its exact address and contact/account identifiers are
  absent.
- A public Shop Talk post belongs to an all-RIVT community, and only answers
  with explicit answer-author consent appear publicly.
- Closing/hiding content or changing its visibility removes it from public
  discovery.
- Public list/detail pages are indexable only when available; unavailable or
  malformed detail URLs return an honest no-index page.
- Mobile and desktop pages have no horizontal overflow in light or dark mode.
- The migration applies and rolls back without losing the preceding customer
  book migration.

## Verification evidence

- Production build, lint, 103 unit/frontend tests, fail-closed authentication
  and jobs/discovery E2E, and zero-vulnerability production dependency audit
  pass.
- All 20 serial PostgreSQL integration suites pass against the configured test
  service in 21 minutes, including canonical Work, server-owned Shop Talk,
  messaging/notifications, public discovery, and migration lifecycle.
- The full migration lifecycle applies migration `0034_public_discovery`,
  verifies its columns, rolls it back, then continues through the existing
  rollback/reapply chain.
- Work lifecycle, Shop Talk/Trade News, Tools, mobile-actions, and guest-preview
  rendered QA pass.
- Direct browser inspection at mobile and desktop sizes confirms light/dark
  public list/detail rendering, no horizontal overflow, structured data, and
  omission of the test job's exact private address.
- No merge, deployment, public indexing, or production-data visibility change
  is claimed in this packet until founder review.
