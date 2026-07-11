# Workflow Action Matrix

This is the release checklist for primary RIVT actions. A control is only
coherent when its label, destination, confirmation, and next useful action
agree.

| Surface | Action | Exact destination | Visible feedback / next step |
| --- | --- | --- | --- |
| Home | Open workspace | Selected accepted job in Work | Job detail is selected and scrolled into view; workspace actions remain in that job detail. |
| Home | Ask / Post work FAB | Shop Talk composer / job editor | Composer or editor opens for the current role. |
| Home | Community card | Exact Shop Talk community | Community feed is selected, not the generic directory. |
| Work | Open workspace | Selected active job detail | The Work list/detail layout scrolls to the selected job. |
| Work detail | Open project records | Exact accepted-job project record | Project records open with the accepted-work id; label does not imply the current Work detail is being reopened. |
| Work detail | Messages, Photos, Daily log | Exact active-work conversation/tool context | Destination carries the active-work id. |
| Tools | Core / recent tool | Named tool app | Compact tool header names the app and any current job context. Back returns to Tools. |
| Shop Talk | Post, answer, community | Exact composer, post, or community | Server acknowledgement or error is shown; no local-only success is presented as published. |
| Notifications | Notification row | Exact object from its action route | Row is marked read, panel closes, and route intent survives data hydration. |
| Settings | Notification controls | Settings > Notifications | In-app controls and device-alert control are before theme and subscription controls. |

## Audit rules

1. A summary card gets one primary action. Its job-specific actions belong in
   the detailed workspace.
2. A button label must name the destination it opens. Use `Open project
   records`, not `Open workspace`, when the action leaves Work for Records.
3. Never route a user to a generic tab if an id is available.
4. After a successful action, show either the changed state in place or the
   exact changed record. Do not rely on a toast alone.
5. Do not add an action to solve a discoverability problem before checking
   whether it already exists in the persistent nav, top bar, or workspace.
