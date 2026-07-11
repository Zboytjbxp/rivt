# Packet 18 - Work Mobile Priority

## Goal

Make Work useful at a glance on a phone by prioritizing the job a person is
currently performing over browsing and administrative job lists.

## In scope

- Put the accepted active-work card immediately below the Work heading.
- Keep its exact workspace handoff unchanged.
- Make remaining contractor status views explicitly secondary as `Other work`.
- Suppress decorative contractor summary metrics while active work is present.

## Guardrails

- Do not remove Open, Draft, Paused, Closed, Pipeline, Calendar, or Templates.
- Do not alter job, active-work, offer, or project authorization.
- Do not duplicate the daily actions already shown inside the exact workspace.

## Acceptance

- A phone with active work sees that job before the status picker, metrics, or
  search controls.
- Opening the workspace retains the canonical active-work route and visible
  exact-job detail.
- Browsing and job administration remain available after the active-work card.
