# Packet 60 - Business Workspace UI and Controlled Release

**Status:** Queued after Packet 59
**Runtime exposure:** Internal, then allowlisted pilot organizations

## Objective

Deliver the complete human-facing Business experience only after server
entitlements, permissions, ownership, and billing are proven. Keep the five
primary RIVT destinations unchanged.

## Mobile information architecture

- Workspace switcher lives in the account surface and always names `Personal`
  or the selected company.
- Work, Camera, Tools, and records show a compact ownership context label.
- Settings > Business contains Overview, People, Shared setup, Usage, and Billing.
- Invite and member actions use thumb-reachable bottom sheets with clear
  permission and seat consequences before confirmation.
- Primary actions remain in the lower reach zone; tables collapse into concise
  rows with a selected-detail sheet.

## Desktop information architecture

- Persistent workspace switcher beside the identity area.
- Overview uses a true workbench: active work and attention on the left,
  receivables, documentation completeness, and team activity on the right.
- People uses roster, selected member detail, and invite drawer.
- Shared setup uses clear subsections for clients, rates, services, templates,
  defaults, and branding.
- Usage and Billing show seats, storage, plan, renewal, invoices, payment
  management, cancellation, and downgrade effects without dark patterns.

## UX requirements

- Every mutation has loading, success, exact destination, and visible next step.
- Empty states explain the first useful action without feature narration.
- Permission failures name who can perform the action.
- Limit states show current usage, limit, and safe resolution.
- Offline and timeout states never claim unsaved work will sync unless a real
  queue owns it.
- Cancellation is self-service and no harder than starting the subscription.
- No `verified`, compliance, payroll, or employee-monitoring claim is implied.

## Controlled release

1. Internal two-organization adversarial QA.
2. Invite 3-5 Jacksonville companies with 2-5 members each.
3. Keep checkout and UI allowlisted per organization for at least 30 days.
4. Measure activation, invited-seat acceptance, shared-record use, support
   time, storage, billing failures, cancellation intent, and data confusion.
5. Publicly expose Business only after release acceptance in the product plan.

## Acceptance

- Compact phone, modern phone, tablet, and desktop layouts pass visual and
  accessibility QA in light and dark modes.
- Every Owner/Admin/Member action matches the server permission matrix.
- Switching workspaces cannot silently move a draft or upload to another owner.
- Company records remain understandable after member removal and downgrade.
- Billing, usage, cancellation, and seat consequences use truthful copy.
- Physical two-account/two-device testing and production allowlist smoke pass.
- Monitoring, support, backup owner, incident response, and rollback are ready.
