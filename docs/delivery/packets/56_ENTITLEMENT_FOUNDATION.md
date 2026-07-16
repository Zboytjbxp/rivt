# Packet 56 - Entitlement Foundation

**Status:** Queued; do not activate until Packet 55 physical acceptance closes
**Product source:** `docs/product/RIVT_BUSINESS_TIER_PLAN.md`
**Runtime exposure:** Free and Pro only; Business remains hidden

## Objective

Replace scattered `isPro` checks and implicit plan assumptions with one
versioned, server-owned entitlement contract. Preserve every current Free and
Pro behavior exactly while creating the safe foundation needed for a future
organization-owned Business workspace.

This packet does not sell, advertise, or enable Business. It does not add
seats, organization billing, shared company records, or a new Stripe price.

## Entry boundary

- Packet 55 physical two-account acceptance for fixed, hourly,
  open-to-offers, and request-quotes work is complete and recorded.
- `BUILD_STATE.md` explicitly names this file as the active packet.
- Production Free and Pro behavior has a written baseline before gates move.
- The Business product, ownership, permissions, downgrade, and UX decisions in
  `docs/product/RIVT_BUSINESS_TIER_PLAN.md` are founder-approved.

## Source boundary

- Existing billing remains account-owned during this packet.
- Existing signed webhook, reconciliation, portal, cancel, and resume paths
  remain authoritative.
- Existing organization authorization remains unchanged.
- Authorization and paid access are server-enforced. Client controls may
  explain an entitlement but may not grant it.
- Accepted-work records remain readable regardless of plan.

## Server product catalog

Add a versioned catalog in one server module. Each plan resolves a stable set
of named entitlements and numeric limits. At minimum:

- `history.full`
- `exports.csv`
- `exports.branded`
- `templates.unlimited`
- `alerts.saved.max`
- `storage.bytes.max`
- `distribution.priority`
- `shop_talk.expert_routing`
- `workspace.shared`
- `workspace.seats.included`
- `workspace.members.manage`
- `workspace.records.shared`
- `workspace.assignments`
- `workspace.audit.read`
- `workspace.billing.manage`

Free and Pro values must reproduce current production behavior. Business may
be represented in the source catalog only as `available: false`; no API may
resolve it for a production account during this packet.

## API contract

Return the authenticated account's resolved plan and entitlements through one
authoritative response, either within `/api/v1/me` or a dedicated
`GET /api/v1/entitlements` endpoint:

```json
{
  "catalogVersion": 1,
  "plan": "pro",
  "billingSubject": { "type": "account", "id": "..." },
  "entitlements": {
    "history.full": true,
    "exports.csv": true,
    "templates.unlimited": true,
    "alerts.saved.max": 10,
    "storage.bytes.max": 26843545600,
    "workspace.shared": false
  }
}
```

The client must not infer plan access from Stripe status, price IDs, local
storage, a role label, or an organization membership.

## Client contract

- Add typed entitlement names and one `useEntitlements` access layer.
- Replace direct boolean `isPro` gates only after a parity test exists for the
  touched behavior.
- Keep plan labels, upgrade prompts, and limit messages driven by the same
  resolved contract.
- Unknown entitlement names fail closed in production and surface a developer
  error in tests.
- Loading must not flash paid controls before the entitlement response loads.
- A failed optional entitlement refresh must not fake logout or destroy a
  valid session.

## UX rules

- Free remains useful; limits explain capacity, not punishment.
- Upgrade prompts name the immediate outcome, such as `Export CSV`, rather
  than presenting a generic paywall.
- A denied action states the current limit and the plan that changes it.
- No Business card, checkout button, `Coming soon` teaser, or team claim is
  visible in production.
- Cancellation and billing management remain self-service and use the current
  honest copy.

## Data and migration

Prefer no migration in this packet. The catalog is code-owned and existing
`billing_entitlements` remains the account subscription snapshot. If a schema
change becomes necessary, stop and revise this packet with an explicit
migration, rollback, and production-data review before editing SQL.

## Acceptance

- Free and Pro users retain the exact access they had before this packet.
- Every paid access decision touched by the packet is enforced on the server.
- A client cannot obtain a paid capability by changing plan text, role,
  organization ID, local storage, or request payload fields.
- Catalog version and resolved limits are deterministic and contract-tested.
- Unknown, inactive, past-due, canceled, and malformed subscription states
  resolve fail closed without hiding existing accepted-work records.
- Business cannot be purchased, assigned, or resolved.
- Existing checkout, webhook, reconciliation, cancel, resume, and portal
  integration suites remain green.
- Compact mobile and desktop Settings show truthful Free/Pro plan state with
  no layout regression.

## Verification

Run and record:

```text
npm run build
npm run lint
npm run lint:security
npm run test:unit
npm run test:e2e
npm run test:ui:mobile-actions
npm run test:integration
npm audit --omit=dev
```

The full integration wrapper must use the configured isolated
`TEST_DATABASE_URL`. Live billing probes must use Stripe test mode unless the
probe is an already-approved production read-only check.

## Rollback

Revert the entitlement adapter and return callers to the current Free/Pro
resolution. Because this packet should not migrate data, rollback must not
alter subscriptions, entitlements, customer records, or organization data.

## Next packet

After production parity is verified, build the organization invitation and
member lifecycle behind a disabled Business feature flag. Do not begin shared
company record ownership or organization billing in this packet.
