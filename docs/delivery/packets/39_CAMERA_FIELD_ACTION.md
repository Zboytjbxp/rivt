# Packet 39 - Camera Field Action and One-Hand Capture

Status: local verification complete

## Objective

Make Camera a first-class field command without turning it into a sixth product
area. It must be reachable from the compact shell with one hand, start with an
explicit proof destination, and preserve the exact accepted-work handoff when
opened from a job.

## Delivered

- Camera replaces the former Crew slot in the compact primary navigation after
  People moved under Work. It is visually treated as a field command, while
  Work remains the home for jobs and people.
- Opening Camera from navigation starts without an accidental job preselected.
  The user chooses accepted RIVT work or a standalone project before capture.
- Opening Photos from an active-work surface uses `/app/camera?activeWork=...`
  and retains that exact job through capture, gallery, and notification routes.
- The Camera overlay keeps the save destination visible in its lower control
  zone beside the gallery return action, capture-type controls, shutter,
  latest capture, and camera switch. These frequent actions remain in the
  thumb zone on compact devices.
- `/app/camera` is recognized as a photo destination by activity/notification
  routing, so photo notices retain an `Open photos` action instead of falling
  through to a generic project record.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:ui:mobile-actions`
- `npm run test:ui:work-lifecycle`
- `npm run test:ui:tools`
- `npm audit --omit=dev`
- `git diff --check`

The rendered camera smoke covers desktop, standard mobile, and an SE-class
viewport. It selects the exact work destination, deliberately retries one
failed upload, and verifies that the saved photo returns to that project feed.
The work-lifecycle smoke also verifies that a photo notification using the new
Camera route opens the selected job instead of generic Records.

## Boundary

This packet changes client navigation, camera presentation, and UI test mocks.
It does not change media ownership, project authorization, storage providers,
or the server upload contract. Camera remains usable for both accepted RIVT
work and separately acquired standalone projects.
