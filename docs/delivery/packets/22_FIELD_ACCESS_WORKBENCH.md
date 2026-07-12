# Packet 22 - Field Access Workbench

## Goal

Make the field actions people reach for most often easier to open with one
hand, while keeping photo destinations explicit and reducing Crew to its real
job: a roster and invite workbench.

## Scope

- Add a mobile Field Tools tray with three device-local shortcuts and an
  explicit `All tools` route. Defaults are Camera, Heavy 16th, and Daily log;
  users can swap up to three shortcuts without changing primary navigation.
- Keep the five primary destinations unchanged. The tray lives inside Tools;
  it does not create a sixth mobile-nav destination or silently replace Crew.
- Make Camera's frequent controls thumb-reachable. The bottom dock now exposes
  the selected destination, a destination chooser, and Capture.
- Require a clear accepted-work or standalone-project context before Camera
  opens live capture from its generic entry. Private albums remain available
  from the camera home, but no generic entry silently attaches a photo to a
  job.
- Reduce Crew's default page to roster-first. Invite planning is available on
  demand; Shop Talk prompts and decorative trust/reputation panels are removed
  from this surface because they have their own destinations.

## Non-goals

- No primary-navigation customization or additional permanent mobile tab.
- No new persistence model for shortcut preferences. `rivt.fieldTools.v1` is a
  device preference only, not a work record.
- No server/database schema change and no change to active-work authorization.
- No removal of Crew, Subs, Reviews, or Clients. Usage evidence is required
  before changing a primary navigation concept.

## Acceptance

- Tools opens with a bottom-reachable Field Tools tray above the mobile nav.
- Camera, Heavy 16th, and Daily log can be opened from the default tray; the
  user can swap any of those shortcuts for another available tool.
- Generic Camera capture asks for a destination before opening the shutter.
- Camera opened from exact active work retains that exact job and exposes
  bottom-reachable `Destination` and `Capture` controls.
- Crew's default page contains the roster plus a collapsed invite planner; it
  no longer repeats Shop Talk or reputation content.

## Local verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run lint:security` - passed.
- `npm run test:unit` - passed, 53/53.
- `npm run test:e2e` - passed.
- `npm run test:ui:tools` - passed at desktop, mobile, and SE viewports.
- `npm run test:ui:mobile-actions` - passed.
- `npm audit --omit=dev` - passed, zero vulnerabilities.
- `npm run test` was attempted but exceeded the local command window before
  its integration half produced output. This client-only packet does not claim
  a new database integration pass.

## Remaining boundary

Run a physical one-hand test on iOS and Android before release: Tools tray,
generic Camera destination choice, exact active-work Camera, and collapsed
Crew invite planning. Deploy evidence belongs in the deployment ledger only
after the branch is merged and production health reports the runtime commit.
