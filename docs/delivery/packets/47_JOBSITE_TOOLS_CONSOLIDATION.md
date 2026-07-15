# Packet 47 - Jobsite Tools Consolidation

## Objective

Make daily field documentation one coherent Jobsite app without deleting,
moving, or rewriting existing Daily Log, Punch List, or Safety records.

## Product boundary

- One Jobsite launcher replaces the separate Daily Log, Punch List, and Safety
  launchers.
- Log preserves the existing notes, weather, labor, blockers, checklist,
  project-timeline save, copy, and draft behavior.
- Punch preserves the existing open/resolved items, assignments, export, and
  persistence behavior.
- Safety preserves the existing daily checklist, sign-off, saved records, and
  account synchronization behavior.
- A persistent lower section dock keeps Log, Punch, and Safety reachable with
  one hand on mobile; desktop renders the same sections in flow above the
  workspace.
- Legacy `?tool=daily-log`, `?tool=punch-list`, and
  `?tool=safety-checklist` links select their matching Jobsite section.
- Existing storage keys, project records, tool records, and authorization
  boundaries remain unchanged.

## Acceptance

- Tools shows one Jobsite launcher and no separate Punch List or Safety
  utility launcher.
- Jobsite opens Log by default and switches among Log, Punch, and Safety
  without returning to the Tools hub.
- Existing active-work Daily Log links open Jobsite on Log with the exact job
  context intact.
- Legacy Punch List and Safety links open the matching section.
- Section controls remain visible and tappable at 1440x900, 390x844, and
  320x568 without horizontal overflow or covering the working surface.
- Build, lint, tests, rendered Tools QA, mobile-action QA, active-work
  lifecycle QA, security lint, dependency audit, diff checks, and PostgreSQL
  integration verification are recorded before release.

## Non-goals

- No database migration, record conversion, storage-key rewrite, or new
  record type.
- No redesign of the three internal forms beyond their shared navigation
  shell.
- No change to safety-training certificates or the profile training area.
- No merge of Camera, Materials, Time & costs, Invoice, or Estimate into this
  app.
