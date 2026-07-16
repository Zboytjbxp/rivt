# Packet 48 - Final Tools Subtraction and Launch QA

## Objective

Prove that the consolidated Tools catalog is understandable, reachable, and
mobile-safe, then exercise RIVT's primary launch workflows without deleting
useful field capability merely to reduce a launcher count.

## Final Tools boundary

The visible catalog has reached its useful floor of seven destinations:

- Core apps: Heavy 16th, Estimate, Invoice, Jobsite, and Camera.
- Grouped utilities: Materials and Time & costs.
- Three user-selected core apps appear in the one-hand Field tools tray. Pinned
  apps do not repeat in the core-app grid.

Older tool modes remain compatibility aliases, not visible competing apps:

- `price-book` opens Materials.
- `time-tracker`, `expense-logger`, `mileage`, and `tax-summary` open the
  matching Time & costs section.
- `payments` opens Invoice on Receivables.
- `daily-log`, `punch-list`, and `safety-checklist` open the matching Jobsite
  section.

Contained experimental or liability-prone tools remain unreachable from the
public catalog and safely fall back to Tools. Their stored records and source
are not deleted in this packet.

## Subtraction verdict

No additional visible destination should be removed for launch. Each of the
seven remaining destinations owns a distinct field workflow. Further useful
subtraction should happen inside a destination when evidence identifies
duplicate controls, not by hiding Camera, calculation, estimating, invoicing,
job documentation, materials, or cost tracking.

## Automated launch-wide coverage

- Rendered Tools QA covers the hub and every final destination at 1440x900,
  390x844, and 320x568. It asserts the final launcher counts, the absence of
  old duplicate launchers, legacy-link routing, section docks, back navigation,
  and zero document-level horizontal overflow.
- Mobile-action QA covers Home, Work draft readiness, Camera and Invoice
  standalone context, contained Crew behavior, search, and appearance at phone
  and compact-phone widths.
- Work-lifecycle QA covers contractor and tradesperson paths, applying,
  accepted work, scoped job tools, active-work priority, and exact notification
  routes for active work and project photos.
- Shop Talk and Trade News QA covers feed, communities, answers, and news on
  desktop and mobile. Its mock server was updated to reflect the current
  server-owned post and answer read paths instead of relying on removed client
  fallback prompts.
- Guest-preview QA covers contractor and subcontractor entry, preview, login,
  and connection recovery, including 320px rendering.

## Verification result

- Production build, lint, security lint, 55 unit tests, E2E, dependency audit,
  and diff checks pass.
- Tools, mobile-action, accepted-work lifecycle, Shop Talk/Trade News, and
  guest-preview rendered suites pass.
- A freshly reset PostgreSQL database reports migration 27 applied with zero
  pending migrations; all 19 sequential integration suites pass.
- The packet changes QA assertions, test fixtures, and delivery evidence only.
  It does not require a runtime deployment to alter user behavior.
- Packet 48 merged to `master` and Railway served exact source
  `b0fe53b22af2e75f81a765d11030b0eaecac00af`. The production synthetic
  monitor passed with migration 27 ready, PostgreSQL and S3-compatible storage
  healthy, Sentry and Web Push configured, matching-job alerts enabled,
  operational controls open, and seven anonymous private-route checks in
  622 ms.

## Physical-device boundary

Automation does not replace these final human checks:

- Capture a real camera image on iOS and Android and confirm it persists in the
  selected accepted job, standalone project, or private album after reopening.
- Confirm existing Invoice/Receivables and Jobsite Log/Punch/Safety records
  remain after switching sections, leaving Tools, and signing in on another
  device where the record type is server-owned.
- Complete one production active-work chain with two real accounts: estimate,
  convert/send invoice, update receivable, add photo and daily log, then close
  the work and confirm both participants see the expected state.
- Confirm iOS installed-PWA push behavior separately from in-app notifications;
  browser-tab behavior alone is not lock-screen push evidence.

## Non-goals

- No schema, authorization, storage-key, billing, or production-data change.
- No deletion or migration of existing tool records.
- No new tool and no visual redesign during the audit packet.
- No claim that mocked browser flows prove physical camera, email delivery,
  payment settlement, or cross-device persistence.
