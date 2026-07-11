# Packet 19 - Job Workspace Simplification

## Goal

Reduce the job-detail filing cabinet to the four decisions people make in the
field: Today, Job, Money, and More.

## In scope

- Present active jobs as Today, Job, Money, and More.
- Present non-active jobs as Job, Activity, Money, and More.
- Keep requirements as a compact Job subview.
- Put changes, checklist, notes, and contacts behind More.
- Put the active-work controls first in Today mode.

## Guardrails

- Preserve every existing detail record and its authorization path.
- Do not remove deep-linkable active-work, project, or financial destinations.
- Active jobs must not open to a generic overview that hides the daily actions.

## Acceptance

- Mobile job selection exposes four primary workspace modes instead of eight
  peer tabs.
- Today places the accepted-work actions before scope and job facts.
- Money and More retain the existing payment, change, checklist, note, and
  contact records.
