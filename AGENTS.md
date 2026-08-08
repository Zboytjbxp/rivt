# RIVT Repository Instructions

## Source of truth

- Product contract: `RIVT_MASTER_BUILD_PROMPT.md`
- Current execution state: `docs/delivery/BUILD_STATE.md`
- Gate A requirements: `docs/product/REQUIREMENTS_TRACEABILITY.md`
- Active packet: follow the exact file named in `BUILD_STATE.md`

## Working rules

- RIVT is trades-only; do not add homeowner users or homeowner lead flows.
- Preserve unrelated and pre-existing working-tree changes.
- Work on one Gate A packet at a time and stop at its acceptance boundary.
- For Codex/Claude branch ownership, handoffs, authorship, and deploy rules, follow `docs/operations/AI_COLLABORATION_WORKFLOW.md`.
- Never present seed/demo data, fake success, local auth fallback, or frontend-only state as production-ready.
- Authorization is server-side; hidden controls are not authorization.
- Do not create or migrate production data without a reviewed migration and rollback.
- Do not regenerate or approximate approved RIVT logos.
- Keep the five primary concepts: Home, Work, Crew, Shop Talk, Tools. Messages, notifications, search, and profile use the top bar.

## Production provider-output safety

- Never enumerate, export, print, redirect, or capture an entire production
  provider environment, even when the command is described as read-only or
  JSON-only.
- The Railway commands `railway environment config` and every `railway
  variable`/`railway variables` enumeration or export are prohibited against
  production. Do not place a secret in a CLI argument or shell command.
- For Railway activation evidence, use only the sanitized snapshot path in
  `docs/operations/RAILWAY_ACTIVATION_RUNBOOK.md`. Change one named secret at a
  time through an authenticated provider or Railway form.
- If a credential appears in tool output, stop immediately. Do not repeat,
  summarize, store, screenshot, or paste it. Preserve the launch hold and
  follow `docs/operations/CREDENTIAL_ROTATION_RUNBOOK.md`.

## Verification

After relevant changes run:

```text
npm run build
npm run lint
npm run test
npm run test:e2e
npm audit --omit=dev
```

Update `BUILD_STATE.md`, requirement maturity, risks, and deployment evidence before ending a packet.
