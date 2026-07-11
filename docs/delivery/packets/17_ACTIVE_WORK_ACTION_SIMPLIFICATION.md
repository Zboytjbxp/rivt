# Packet 17 - Active Work Action Simplification

## Goal

Make an accepted job read as one field workspace rather than a flat list of
competing controls.

## In scope

- Lead with one project-record action.
- Keep Messages, Camera, and Daily log together as the three daily field
  actions.
- Place Estimate and Invoice in a compact Money group.
- Collapse reschedule and cancel behind a deliberate `Job controls` disclosure.
- Keep every action bound to the exact active-work record.

## Guardrails

- Do not change active-work, project-media, invoice, or tool authorization.
- Do not replace exact job context with a generic Records or first-job fallback.
- Do not hide a daily action below the fold on a phone-sized viewport.

## Acceptance

- At 390px, the active-work record action and all three daily actions are
  visible without expanding rare controls.
- Camera, Daily log, Invoice, Messages, and Records still resolve to the
  accepted job selected by the active-work ID.
- Reschedule and cancel are reachable but not presented as routine daily work.
