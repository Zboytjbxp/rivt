# Packet 49 - Full Interface Audit

## Objective

Audit every reachable RIVT screen, tool, menu, panel, navigation surface,
setting, staff surface, and responsive layout before beginning another visual
implementation train. Separate useful capability from unnecessary exposure so
future redesign work preserves server-owned records and working workflows.

## Source boundary

- Audited source: `origin/master` at
  `042f2314d92b609a5cdd498d464689f985280444`.
- Audit branch: `codex/full-interface-audit`.
- Runtime code, schema, authorization, data, billing, and production deployment
  are unchanged by this packet.
- Packet 48 remains the latest production-verified launch QA boundary.

## Deliverables

- `docs/product/FULL_INTERFACE_AUDIT_2026-07-15.md`
- This delivery packet
- Updated `docs/delivery/BUILD_STATE.md`

## Audit coverage

- Shell: desktop sidebar, mobile nav, top bar, search, notifications, account
  drawer, modal/scrim behavior.
- Entry: landing, guest preview, role demos, login, signup, password recovery,
  onboarding.
- Primary destinations: Home, Work/People, Camera, Shop Talk/Trade News, Tools.
- Tools: Heavy 16th, Estimate, Invoice/Receivables, Jobsite Log/Punch/Safety,
  Camera, Materials/Price library, Time & costs.
- Secondary destinations: Inbox/clients, Profile, Settings, trust/legal,
  training, reviews, feedback, moderation, support.
- Cross-device checks: compact phone, normal phone, tablet/split, desktop, and
  light/dark visual-system behavior.
- Workflow standard: clear feedback, exact destination, and visible next step.

## Verdict

RIVT has a coherent product core and should not be rewritten. Its primary UX
liability is simultaneous exposure of too much working capability. Work,
Estimate, Invoice, Daily Log, Safety, the account drawer, and desktop
compositions need the strongest simplification.

The seven-destination Tools floor remains valid. Heavy 16th and Camera's lower
capture dock are reference interactions to preserve. The next phase should
subtract interface layers and reveal complexity progressively rather than
delete records or reintroduce duplicate apps.

No new P0 authorization, billing, or data-integrity finding was established by
this interface audit. No Gate B requirement changes maturity in this packet.

## Risks recorded

- Work's nested states and controls make the accepted-work lifecycle harder to
  understand than its backend state model.
- Fixed docks, FABs, and shell chrome use too many independent z-index values,
  increasing clipping and overlap risk.
- Tiny metadata and repeated uppercase labels reduce field readability.
- Unshared dialog and destructive-confirmation patterns create accessibility
  inconsistency.
- Large legacy CSS layers make visual corrections prone to specificity drift.
- Desktop Home, Tools, and Shop Talk underuse available space.

## Recommended next packet

Packet 50 should be Foundation and Subtraction only:

1. remove verified orphan CSS families;
2. establish semantic type, breakpoint, z-index, and status-color rules;
3. introduce shared dialog/drawer/confirm/tab primitives using existing
   dependencies;
4. add overlap, overflow, compact-phone, desktop, and light/dark visual gates;
5. make no Work or tool record-flow redesign in the same packet.

After Packet 50, proceed in separate trains for Shell/Settings, Work lifecycle,
field-tool task flows, Shop Talk, desktop composition, and physical-device
accessibility QA.

## Verification

This is a documentation-only packet. Verify with:

- `git diff --check`
- Markdown/source-path review
- clean Git status after commit

Runtime build, lint, unit, E2E, integration, dependency audit, deployment, and
production monitoring are not repeated because no executable or dependency
file changes in this packet.

## Deployment evidence

None required. This packet does not change the application and must not be
described as a production feature deployment.

## Acceptance boundary

Complete when the full audit, per-screen verdicts, preserve/subtract lists,
implementation trains, acceptance checklist, risks, and current build state are
committed and pushed on the audit branch. Implementation begins only in a new
packet/branch with its own verification evidence.
