# Packet 20 - Core Surface Subtraction

## Goal

Make the daily app surfaces easier to scan by removing repeated recovery
actions and explanatory launcher copy without removing any capability.

## In scope

- Keep Home focused on active work, onboarding only when incomplete,
  communities, the feed, and its single role-aware floating action.
- Remove Home's duplicate recent-tools, offline/device-state, and answer-queue
  panels. Those destinations remain directly available from the top bar, Tools,
  and Shop Talk.
- Keep Tools as `Recent`, five core field apps, then compact expandable
  utility groups.
- Make Recent include every tool actually used, including a core app.
- Remove the hub-level storage note. Storage state belongs in the actual
  record or tool context, not the launcher.

## Guardrails

- Do not remove a tool implementation or hide it without an accessible route.
- Do not remove notification, message, or Shop Talk destinations.
- Do not alter server-owned work, billing, identity, or moderation state.

## Acceptance

- Home has no repeated launcher for a destination already represented in the
  persistent navigation or floating action.
- Tools opens with a compact launcher and all utility tools remain reachable
  from their collapsed groups.
- Recent tools reflects the last tools opened, whether core or utility.
