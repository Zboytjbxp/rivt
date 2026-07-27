# Packet 73 — Tools and Work people discovery

## Objective

Make every tool visible without scrolling past duplicated launchers, and make
the people involved in finding and completing work reachable from Work without
hiding them under secondary menus or overstating device-only contact storage.

## Accepted implementation scope

- Replace the Tools featured/list/tray composition with one `All tools`
  launcher containing Heavy 16th, Estimate, Invoice, Jobsite, Camera,
  Materials, and Time & costs exactly once.
- Use a responsive tile grid: four columns on wide desktop, three on
  intermediate widths, and two on mobile. Keep labels, purpose copy, and
  category cues visible rather than relying on icon recognition.
- Reuse the existing three-tool preference as a pinned ordering system.
  Customizing changes which tools appear first; it never hides tools or
  creates a second launcher.
- Add an always-visible Jobs/People switcher at the top of Work. `People`
  opens the existing server-backed People, Subs, Reviews, and Customers hub.
- Promote job-specific contacts from `More` to a first-class `People`
  workspace tab and provide a direct path from it to the shared
  People/Customers hub.
- State plainly that the current site-contact entries are private notes on the
  device and are not crew-shared or account-synced.

## Deliberate boundaries

- This packet does not create a contact schema, migrate device notes, or claim
  server persistence. A server-owned job-contact model needs its own reviewed
  migration, authorization rules, conflict handling, and rollback.
- Customers remain part of the People hub rather than becoming homeowners,
  marketplace users, or a sixth primary product concept.
- The global five-item navigation is unchanged. This packet improves
  discoverability inside Tools and Work without reopening the separate
  Camera/Crew navigation decision.
- No jobs, people, customers, contacts, tool usage, or activity counts are
  seeded or fabricated.

## Acceptance

- All seven launchers are visible in the initial Tools composition at mobile
  and desktop sizes, and each appears exactly once.
- There is no collapsed `More tools` section and no fixed repeated-tool tray.
- Pin customization persists and reorders the unified launcher without
  removing access to an unpinned tool.
- Work exposes Jobs and People before entering a job.
- An active job exposes People alongside Today/Job/Money instead of under
  `More`, and the local-only storage boundary is visible before adding a
  contact.
- Existing calculator, camera, materials, estimate, invoice, jobsite, and
  time/cost tool flows continue to work.

## Verification evidence

- Focused Tools rendered QA passes on desktop, 390px mobile, and 320px compact
  mobile, including launcher uniqueness, pin ordering, and the full existing
  tool regression flow.
- Work lifecycle rendered QA passes with direct People workspace coverage,
  the shared People/Customers path, and the device-only site-contact boundary.
- Mobile action QA passes in light and dark mode with the unified launcher and
  Work/People switcher.
- Production build and lint pass. All 103 unit/frontend tests and all 20
  serial PostgreSQL integration suites pass, including tool records,
  messaging/notifications, Work completion, customers, and migrations.
- Fail-closed authentication plus Jobs/discovery E2E pass at desktop and
  mobile widths. The E2E now locks the unified seven-tool launcher rather than
  expecting the removed duplicate tray.
- The production dependency audit reports zero known vulnerabilities, and
  diff integrity passes. No deployment evidence is claimed in this packet.
