# RIVT Claude Instructions

Follow `AGENTS.md`, `RIVT_MASTER_BUILD_PROMPT.md`, the active packet named in
`docs/delivery/BUILD_STATE.md`, and
`docs/operations/AI_COLLABORATION_WORKFLOW.md`.

## Production provider-output safety

- Never enumerate, export, print, redirect, or capture a complete production
  provider environment. Read-only and JSON output can still contain live
  secrets.
- Never run `railway environment config` or any `railway variable`/`railway
  variables` enumeration or export against production, and never place a
  secret in a CLI argument.
- Use only the sanitized provider-snapshot workflow documented in
  `docs/operations/RAILWAY_ACTIVATION_RUNBOOK.md`.
- If a credential appears in output, stop without repeating or storing it,
  preserve the launch hold, and follow
  `docs/operations/CREDENTIAL_ROTATION_RUNBOOK.md`.
