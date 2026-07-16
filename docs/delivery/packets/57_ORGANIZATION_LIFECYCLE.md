# Packet 57 - Organization Lifecycle and Permissions

**Status:** Queued after Packet 56
**Runtime exposure:** Disabled Business foundation

## Objective

Turn the existing `owner/admin/member` organization memberships into a
complete, server-enforced lifecycle suitable for a paid company workspace.
No Business checkout or shared tool ownership is exposed in this packet.

## Changes

- Add invitation creation, email delivery, acceptance, expiration, resend,
  and revocation with single-use tokens stored as hashes.
- Add member activation, deactivation, role changes, and explicit removal.
- Protect the last active owner from removal, deactivation, or downgrade.
- Add ownership transfer requiring recent authentication and acceptance by
  the receiving owner.
- Record actor, target, organization, action, timestamp, request ID, and safe
  metadata in an organization audit trail.
- Centralize organization permission checks instead of relying on hidden UI.
- Rate-limit invitation and membership mutation endpoints.

## Permission matrix

| Action | Owner | Admin | Member |
| --- | --- | --- | --- |
| View active company work | Yes | Yes | Assigned/all by policy |
| Create and edit company records | Yes | Yes | Yes |
| Invite or remove members | Yes | Yes, except owners | No |
| Change roles | Yes | Member only | No |
| Transfer ownership | Yes | No | No |
| View audit activity | Yes | Yes | No |
| Manage billing | Yes | No | No |

## Acceptance

- Every mutation is rejected server-side when the actor lacks permission.
- Cross-organization identifiers return no data and cannot be mutated.
- An invitation cannot be replayed, guessed, accepted by a different email,
  or used after expiration/revocation.
- The final active owner cannot leave or be removed without a completed
  ownership transfer.
- Session revocation removes organization access immediately.
- Integration tests cover Owner/Admin/Member, two organizations, two accounts,
  expired invites, role changes, removal, and ownership transfer.

## Next packet

Packet 58 assigns company ownership to shared records behind the same disabled
Business feature flag.
