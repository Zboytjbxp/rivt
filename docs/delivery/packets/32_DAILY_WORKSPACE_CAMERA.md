# Packet 32 - Daily Workspace and Camera

Status: locally verified

## Objective

Make accepted work and field capture behave like explicit destinations on a
phone. Opening a job workspace must reveal its next actions immediately, and
Camera completion and destination controls must remain reachable in the lower
thumb zone.

## Delivered

- A focused accepted-work route suppresses the broad Work dashboard controls
  on mobile and promotes the exact job's Today panel ahead of general job
  facts.
- Messages, Photos, Daily log, Estimate, and Invoice retain the selected
  active-work identifier through the existing exact-context routes.
- Camera capture now repeats the exact save destination beside the shutter
  controls and provides a lower-screen Done action.
- Camera context cards distinguish accepted RIVT work, standalone projects,
  and private album capture without implying that off-platform work belongs to
  a marketplace job.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:ui:tools`
- `npm run test:ui:work-lifecycle`
- `npm run test:ui:mobile-actions`
- `git diff --check`

Rendered evidence includes SE-class Camera capture, standalone Camera context,
the focused accepted-work Today panel, and exact-job tool handoffs.

## Boundary

This packet changes client navigation hierarchy and capture ergonomics only.
It does not change authorization, uploads, project ownership, or persistence.
Physical one-handed confirmation remains required before nationwide launch.
