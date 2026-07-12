# Packet 24 - Active Work Camera Workflow

## Goal

Make active work feel like one job workspace. Daily field actions should name
their exact destination, and Camera should keep destination, feed, and capture
within one lower-screen, one-handed control dock.

## Scope

- Remove the generic `Open project records` detour from the active-work Today
  panel. The person is already in the job workspace.
- Use one exact daily-action row: Messages, Photos, and Daily log. Each route
  carries the active-work identifier into its own scoped surface.
- Replace the ambiguous `Camera` label with `Photos` in the job workspace.
- Move project-feed access out of Camera's high-screen command panels and into
  the bottom dock alongside Destination and Capture.
- Preserve visible active-job or standalone-project context while using Camera.

## Non-goals

- No change to photo upload ownership, object storage, or project access rules.
- No new job-record schema, background upload queue, or offline sync promise.
- No new global navigation item.

## Acceptance

- An active job presents Messages, Photos, and Daily log before rare controls.
- Photos opens the exact active-work camera feed, not generic Records.
- Camera's lower dock exposes accessible Destination, Feed, and Capture actions.
- The job or standalone destination remains visible while capturing or viewing
  its feed.

## Local verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm run test:unit` - passed, 53/53.
- `npm run test:e2e` - passed.
- `npm run test:ui:work-lifecycle` - passed.
- `npm run test:ui:tools` - passed.
- `npm audit --omit=dev` - passed, zero vulnerabilities.
- `git diff --check` - passed.

## Remaining boundary

Run a physical active-job pass on iOS and Android: Messages, Photos, Daily log,
then Camera Destination, Feed, and Capture with one hand.
