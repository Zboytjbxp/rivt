# Packet 75 — App icon system

## Objective

Make RIVT faster to recognize and navigate by separating product identity
icons from ordinary action icons across the five primary surfaces.

## Accepted implementation scope

- Give Home, Work, Camera, Shop Talk, and Tools distinct Phosphor identities
  in the desktop sidebar, mobile navigation, and global search results.
- Keep selected destinations visually stronger through a duotone state while
  preserving the visible navigation label and existing route.
- Distinguish the Work Jobs/People switcher and the Shop Talk
  Feed/Communities/Trade News switcher with section-specific identities.
- Standardize global search, messages, and notifications as command icons
  rather than reusing destination metaphors.
- Keep ordinary operational controls such as close, refresh, delete, filters,
  voting, and form actions in the established lightweight Lucide command
  language.
- Repair icon-only accessible names/tooltips found during the inventory and
  restore the Work Jobs/People switcher to a 44px minimum target.

## Deliberate boundaries

- This is a semantic icon system, not a repository-wide library replacement.
  Forcing one family into every control would weaken familiar action
  affordances without improving recognition.
- The existing Tools launcher identities from Packet 74 remain unchanged.
- No route, navigation order, feature behavior, record, authorization rule,
  server API, schema, migration, or production data changes.
- The approved RIVT logo assets are untouched.

## Acceptance

- Desktop and mobile primary navigation expose exactly five unique identities
  in product order: Home, Work, Camera, Shop Talk, and Tools.
- Search, messages, and notifications remain visually distinct from
  destinations; icon-only top-bar commands keep accessible labels and hover
  tooltips.
- Work exposes distinct Jobs and People identities with 44px targets.
- Shop Talk exposes distinct Feed, Communities, and Trade News identities at
  Standard, Large, and Extra Large text sizes.
- All icon artwork adjacent to a visible label is decorative to assistive
  technology.
- Mobile and desktop layouts remain contained in light and dark themes.

## Verification evidence

- Production build and lint pass.
- All 103 unit/frontend tests and all 20 serial PostgreSQL integration suites
  pass.
- Fail-closed authentication plus Jobs/discovery E2E pass at desktop and
  mobile viewports.
- Mobile-actions, Work lifecycle, Shop Talk/Trade News, and Tools rendered QA
  pass. The mobile suite locks the five destination identities, three command
  identities, Jobs/People distinction, Shop Talk section distinction,
  top-bar tooltips, three text sizes, light/dark themes, no horizontal
  overflow, and a non-clipping Shop Talk Post action.
- Screenshot evidence is retained outside the repository under
  `C:\Users\zboyt\AppData\Local\Temp\rivt-mobile-actions-pass`,
  `C:\Users\zboyt\AppData\Local\Temp\rivt-work-lifecycle-pass`,
  `C:\Users\zboyt\AppData\Local\Temp\rivt-shop-talk-news-pass`, and
  `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- The production dependency audit reports zero known vulnerabilities.
- This branch is verified locally and is not represented as deployed until a
  reviewed merge and exact-source production proof occur.
