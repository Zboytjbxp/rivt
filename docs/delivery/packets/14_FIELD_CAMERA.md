# Packet 14 - Field Camera

## Goal

Turn Records & photos into a field camera that is practical one-handed and
unambiguous about where each live-job photo is saved.

## In scope

- Full-height camera viewfinder with persistent active-job context.
- Bottom-thumb capture controls: capture intent, shutter, last capture, and a
  functional front/back camera switch.
- Capture intent is selected at the moment of capture, not on a separate
  gallery dashboard.
- A saved/failed state explicitly names the current job record; failed captures
  remain retryable without re-shooting.
- Reduce camera-home duplicate category controls while preserving albums,
  project feed, compare, filtering, and authorization.

## Guardrails

- Keep authenticated project media uploads and existing participant
  authorization unchanged.
- Do not claim an upload is saved until the existing server upload resolves.
- Camera-switch UI must control a real media constraint; no decorative flash or
  toggle controls.

## Acceptance

- Opening camera from active work names the exact job before capture.
- A user can choose Progress/Before/After/Issue/Material/Closeout, take a
  photo, switch lenses, retry a failed upload, and exit to the same project
  feed with one hand.
- Tool UI smoke verifies the capture overlay has the job label, intent control,
  functional switch, retry route, saved state, and no horizontal overflow at
  desktop, phone, and SE viewports.
