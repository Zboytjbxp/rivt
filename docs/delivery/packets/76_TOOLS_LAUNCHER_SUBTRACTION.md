# Packet 76 — Tools launcher subtraction

## Objective

Remove launcher-management chrome that does not help a person choose or use a
tool.

## Accepted implementation scope

- Keep one visible launcher containing Camera, Estimate, Heavy 16th, Invoice,
  Jobsite, Materials, and Time & costs.
- Remove device-only pin customization, pinned labels, category labels, the
  pin-limit state, and explanatory pin-order copy.
- Use one stable, field-ready order: Camera, Estimate, Heavy 16th, Invoice,
  Jobsite, Materials, then Time & costs.
- Preserve every tool name, summary, icon identity, route, context picker,
  record, and saved tool data.

## Deliberate boundaries

- The existing `rivt.fieldTools.v1` device preference is no longer read or
  written. An old local-storage value may remain on a device, but it has no
  product effect and is not account or server data.
- No tool behavior, authorization, server API, schema, migration, or
  production data changes.
- Tool icons and the shared app icon system remain unchanged.

## Acceptance

- The Tools hub exposes exactly seven tool cards once each.
- No Customize, Done, Pin, Unpin, Pinned, Field, Business, or pin-limit UI is
  present in the launcher.
- Every card remains one named button with a decorative identity icon,
  summary, and clear open action.
- The fixed order is identical across desktop and mobile.
- Light/dark and responsive layouts remain contained with no horizontal
  overflow.

## Verification evidence

- Production build and lint pass.
- Focused rendered Tools QA passes across desktop, 390px, and 320px in light
  and dark themes and locks the fixed order plus removed management chrome.
- Screenshot evidence is retained outside the repository under
  `C:\Users\zboyt\AppData\Local\Temp\rivt-tools-pass`.
- All 103 unit/frontend tests and all 20 serial PostgreSQL integration suites
  pass.
- Fail-closed authentication plus Jobs/discovery E2E pass at desktop and
  mobile viewports.
- The production dependency audit reports zero known vulnerabilities and the
  final diff integrity check passes.
- This branch is verified locally and is not represented as deployed until a
  reviewed merge and exact-source production proof occur.
