# Packet 16 - Workspace Focus Handoff

## Goal

Make the accepted-work handoff visibly complete on a phone. A user who selects
`Open workspace` must land at the exact active job detail instead of remaining
at the top of Work with an apparently unchanged screen.

## In scope

- Route Work's active-work summary through the same route-level exact-work
  handoff used by Home and notifications.
- Preserve the active-work ID and canonical job ID in the URL and hydration
  state.
- Scroll the resolved job workspace into view after it renders.
- Move accessible focus to the job title, without a second scroll.
- Extend the rendered lifecycle smoke to assert the exact URL, in-viewport
  job heading, and focus handoff.

## Guardrails

- Do not change active-work authorization, job visibility, or the server API.
- Do not reintroduce generic Records or an unrelated open job as a fallback.
- Do not use a toast as the sole indication that the workspace opened.

## Acceptance

- From Home or Work, `Open workspace` resolves to
  `/app/work?activeWork=<id>&job=<id>`.
- The matching active job heading is visible immediately after the route
  settles on a 390px phone viewport.
- The active job title receives programmatic focus for keyboard and assistive
  technology users.
