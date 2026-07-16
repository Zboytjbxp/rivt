# RIVT Business Tier Product and Build Plan

**Status:** Approved product direction; implementation-ready specification, not a live offer
**Prepared:** 2026-07-16
**Current product gate:** Gate B controlled engagement
**Runtime boundary:** Business remains hidden until the Gate C release criteria in this document pass

## 1. Decision

RIVT should use three plans, but only two should be purchasable during the Jacksonville launch:

| Plan | Launch availability | Customer | Price direction |
| --- | --- | --- | --- |
| Free | Live | Any individual tradesperson or contractor | $0 |
| Pro | Live | A serious individual operator | Keep the existing $9 founding price; test $14.99 monthly and $149 annually after launch |
| Business | Hidden until Gate C | A contractor with office or field teammates | $39 monthly including 3 seats; $8 per additional active seat |

Business is not a larger Pro plan. Pro helps one person document and run their work. Business creates a shared company workspace with ownership, permissions, standards, and oversight across people.

RIVT must never charge a tradesperson to browse or apply for work, never take a percentage of job compensation, and never put ordinary Shop Talk participation behind payment.

## 2. Why this model fits RIVT

The closest contractor products charge substantially more once they coordinate teams. CompanyCam currently positions its solo/small-team product at $79 monthly and its three-user team product at $129 monthly. RIVT does not yet offer CompanyCam's full depth, integrations, or offline system, so matching those prices would be premature. RIVT can instead win with a low-friction path:

1. Free proves the network and daily field tools.
2. Pro turns one person's work into durable proof and professional paperwork.
3. Business removes coordination cost for a small company.

The $39 three-seat entry price is intentionally founder-friendly. It is high enough to support shared storage and team operations, but low enough for a two- or three-person contractor to try without a sales call. Additional seats align revenue with the operational cost and value of a growing crew.

Market references used for packaging, not copied feature-for-feature:

- [CompanyCam plans](https://help.companycam.com/en/articles/14477655-companycam-plans-explained) separate individual documentation from team assignment, templates, guest access, and company controls.
- [CompanyCam pricing](https://companycam.com/pricing) establishes that team coordination products command substantially more than RIVT's proposed entry price.
- [Jobber subscription management](https://help.getjobber.com/hc/en-us/articles/14537623807127-How-to-Subscribe) packages users and operational depth by plan and supports self-service billing.
- [Stripe Billing pricing](https://stripe.com/billing/pricing) currently adds 0.7% of recurring billing volume, in addition to payment processing.

## 3. The plan promise

### Free: Find work and use the field essentials

Free is a complete, honest product. It includes:

- Browse, post, apply to, and manage RIVT work.
- Create and join Shop Talk communities; post, answer, vote, and save.
- Direct messages tied to accepted work.
- Core Calculator, Camera, Estimate, Invoice, Jobsite, Money, and Records entry points.
- Standalone projects and accepted-work context.
- Basic cloud synchronization and a modest storage allocation.
- Recent record history and basic document output.
- Profile, portfolio, rate card, reviews, notifications, and job alerts.

Free must not be made frustrating to manufacture upgrades. Limits must be understandable capacity limits, not disabled basic workflow.

### Pro: Protect your work and send better paperwork

Pro is for one person. It includes:

- Full individual history rather than the free recent-history window.
- Expanded individual cloud storage.
- CSV and professional report exports.
- Reusable estimate and invoice defaults, line items, rate cards, and document branding.
- Complete proof packets and closeout exports.
- Advanced saved alerts and notification controls.
- Priority distribution that is relevance-based and capped, never a guarantee and never an exclusion of free users.
- Priority routing of Shop Talk questions to relevant proven contributors, without promising an answer.
- All individual records accessible across signed-in devices.

Pro does not include team seats, shared company ownership, or employee surveillance.

### Business: Run one company workspace

Business includes Pro for the owner plus:

- Three active seats, with paid additional seats.
- A shared company workspace and clear personal/workspace context switch.
- Owner, Admin, and Member roles enforced by the server.
- Invitations, seat activation, deactivation, and transfer of ownership.
- Shared company clients, rate card, services, estimate defaults, invoice defaults, templates, and branding.
- Shared company projects, accepted-work records, albums, photos, daily logs, punch items, safety records, expenses, time, invoices, and receivables.
- Assignment of jobs, projects, tasks, and records to members.
- A company activity trail showing who created, edited, sent, exported, or deleted a record.
- Company dashboard for active work, attention items, receivables, documentation completeness, and team activity.
- Permission-aware company exports and closeout packets.
- Pooled storage and usage visibility.
- One billing owner, invoices, renewal date, seat count, and self-service cancellation.

Business does not include payroll, employee time-clock compliance guarantees, escrow, 1099 preparation, background checks, homeowner CRM, or payment processing between RIVT users.

## 4. Recommended limits

Limits are product policy and must be versioned in server configuration rather than scattered through components.

| Capability | Free | Pro | Business |
| --- | --- | --- | --- |
| People | 1 | 1 | 3 included, then $8/seat |
| Storage | 1 GB | 25 GB | 100 GB pooled |
| Record history | Recent 90 days, with permanent access to accepted-work records | Full individual history | Full company history |
| CSV export | No | Yes | Yes, permission-aware |
| Proof/closeout export | Basic | Branded and complete | Branded, complete, company-wide |
| Reusable templates | 1 per document type | Unlimited individual | Unlimited shared company |
| Saved job alerts | 1 | 10 | 25 shared or personal |
| Priority distribution | Standard relevance | Modest capped boost | Modest capped company boost |
| Shared clients/rates/templates | No | No | Yes |
| Assign work to teammates | No | No | Yes |
| Audit activity | Personal record timestamps | Personal history | Company activity trail |

Accepted-work records must remain readable regardless of plan. A limit may prevent new uploads or edits after a downgrade, but it must never erase proof or hide a contractual work record.

## 5. Unit economics and pricing guardrails

### Direct variable cost model

Track these costs per paying workspace every month:

- Stripe card processing: 2.9% + $0.30 per successful charge.
- Stripe Billing: 0.7% of recurring billing volume.
- Object storage capacity, operations, and egress.
- PostgreSQL storage and query load.
- Transactional email and push delivery.
- Error monitoring and logs.
- Support time, refunds, and chargebacks.

At the current $9 Pro price, Stripe's published card and Billing fees are approximately $0.62 before infrastructure, leaving about $8.38. At $14.99 they are approximately $0.84, leaving about $14.15. At $39 they are approximately $1.70, leaving about $37.30 before infrastructure and support.

Storage itself is unlikely to be the primary cost at RIVT's proposed limits. Support and operational complexity will dominate. The product should target:

- Pro variable gross margin of at least 80%.
- Business variable gross margin of at least 75% after included seats and pooled storage.
- No unlimited-storage promise.
- Alerts at 70%, 85%, and 100% of storage allocation.
- A documented overage policy before enforcing any overage charge.

### Price rollout

1. Keep verified founding Pro accounts at $9 while Jacksonville is controlled.
2. Instrument usage and interview paying users about the proof/paperwork outcomes they use.
3. Test public Pro at $14.99 monthly and $149 annually only after entitlement copy matches real gates.
4. Launch Business at $39 monthly with 3 seats only after the full team acceptance suite passes.
5. Add annual Business at $390 after one quarter of stable monthly billing.

Do not add coupons, trials, or multiple Business variants at launch. Complexity can wait for demand.

## 6. Ownership model

The ownership boundary must be visible in both data and UI.

### Personal ownership

An account owns:

- Its identity, authentication methods, profile, reputation, personal rate card, and personal preferences.
- Standalone personal projects and private albums explicitly created outside a company workspace.
- Personal Shop Talk activity and saved content.

An employer must never own or delete a person's RIVT identity or community reputation.

### Business workspace ownership

An organization owns records created in its workspace:

- Company jobs and applications received.
- Company clients, services, rates, templates, estimates, invoices, and receivables.
- Company projects, albums, photos, logs, punch lists, safety records, expenses, and closeout exports.
- Company audit events and member assignments.

Every owned record needs `organization_id`, `created_by_account_id`, and where relevant `assigned_to_account_id`. The UI must label the current owner as `Personal` or the organization name before the user saves or sends anything.

### Leaving a company

- The member keeps their RIVT account, profile, reputation, personal work, and personal Shop Talk activity.
- The company keeps company-owned records and audit history.
- The member loses access immediately when removed, except to records they are independently entitled to as an accepted-work participant.
- A removal event records who removed the member and when.
- Personal data must not be silently copied into the business workspace.

## 7. Roles and permissions

Use the roles already present in the database: `owner`, `admin`, and `member`. Do not add more roles until real customers demonstrate a need.

| Action | Owner | Admin | Member |
| --- | --- | --- | --- |
| View assigned company work | Yes | Yes | Yes |
| Add photos/logs/punch/safety to assigned work | Yes | Yes | Yes |
| View all company projects | Yes | Yes | Configurable; default assigned only |
| Create/edit jobs and clients | Yes | Yes | No |
| Create/send estimates and invoices | Yes | Yes | No by default |
| Edit shared rates/templates | Yes | Yes | No |
| Invite or remove members | Yes | Yes, except owner | No |
| Change a member role | Yes | Admin/member only | No |
| View company reports and exports | Yes | Yes | Assigned records only |
| View billing and invoices | Yes | No | No |
| Change plan, seats, or payment method | Yes | No | No |
| Transfer ownership or close workspace | Yes | No | No |

Every protected API must check organization membership and permission server-side. Hiding a button is not authorization.

## 8. Entitlement contract

Create one server-owned product catalog. Recommended keys:

```text
history.full
exports.csv
exports.branded
templates.unlimited
alerts.saved.max
storage.bytes.max
distribution.priority
shop_talk.expert_routing
workspace.shared
workspace.seats.included
workspace.members.manage
workspace.records.shared
workspace.assignments
workspace.audit.read
workspace.billing.manage
```

The API should return resolved entitlements, not ask the client to infer them from `plan === "pro"`.

Example response:

```json
{
  "plan": "business",
  "status": "active",
  "subjectType": "organization",
  "subjectId": "organization-uuid",
  "limits": {
    "storageBytes": 107374182400,
    "includedSeats": 3,
    "savedAlerts": 25
  },
  "features": {
    "history.full": true,
    "exports.csv": true,
    "workspace.shared": true,
    "workspace.members.manage": true
  }
}
```

Clients may use this response to render UI, but APIs must independently enforce the same catalog.

## 9. Billing and subscription logic

The current billing schema is account-owned and only allows `free` or `pro`. Business needs a versioned billing subject.

### Required schema direction

Add:

- `billing_products` or a code-owned versioned catalog for plan/interval/price IDs.
- `billing_accounts` with `subject_type` (`account` or `organization`) and `subject_id`.
- Organization-owned subscriptions and entitlements.
- `organization_seats` or active membership counts tied to subscription quantity.
- Plan version, currency, interval, included seats, and grandfathering metadata.

Do not overload the current account entitlement row in a way that makes one person's Pro subscription accidentally grant Business to every organization they join.

### State machine

```text
free
  -> checkout_pending
  -> active
  -> past_due_grace
  -> restricted
  -> cancelled_at_period_end
  -> free_read_only_over_limits
```

- Checkout is created only by an eligible owner.
- Checkout metadata includes subject type, subject ID, plan version, and account ID.
- Webhooks are signed, idempotent, and reconciled after checkout.
- Seat changes update Stripe quantity and are audited.
- Failed payments enter a 14-day grace period with clear owner-only notices.
- Cancellation remains self-service and takes effect at period end.
- Resuming before period end restores renewal without recreating the workspace.
- Existing records remain readable after cancellation.

### Downgrade behavior

If Business downgrades to Pro or Free:

1. No records are deleted.
2. Existing members retain individual accounts but lose company workspace access unless they remain selected members under an allowed plan.
3. The owner chooses which member remains if a future plan includes fewer seats.
4. Shared records become read-only when the workspace no longer has the required entitlement.
5. Owners can export company records during and after the paid period.
6. New uploads, invitations, and shared edits pause when over limits.
7. The UI shows exactly what is restricted and how to export or reactivate.

## 10. API surface

Recommended endpoints, all authenticated and organization-authorized:

```text
GET    /api/v1/plans
GET    /api/v1/entitlements
GET    /api/v1/organizations/:id
PATCH  /api/v1/organizations/:id
GET    /api/v1/organizations/:id/members
POST   /api/v1/organizations/:id/invitations
POST   /api/v1/organization-invitations/:token/accept
PATCH  /api/v1/organizations/:id/members/:accountId
DELETE /api/v1/organizations/:id/members/:accountId
POST   /api/v1/organizations/:id/ownership-transfer
GET    /api/v1/organizations/:id/activity
GET    /api/v1/organizations/:id/usage
POST   /api/v1/billing/checkout
POST   /api/v1/billing/portal
POST   /api/v1/billing/reconcile
POST   /api/v1/billing/subscription/cancel
POST   /api/v1/billing/subscription/resume
```

The existing billing paths may remain, but checkout must accept only a server-validated product key and organization ID. It must never accept an arbitrary Stripe price ID from the client.

## 11. UI information architecture

### Mobile

Business does not add a sixth primary navigation destination. The five primary concepts remain Home, Work, Camera, Shop Talk, and Tools under the current product direction.

Add a compact workspace switcher in the account area:

```text
Personal
Tingle Construction
-------------------
Manage company
```

The switcher changes data context, not identity. Every creation flow shows a quiet ownership label near the title:

```text
Saving to: Tingle Construction
```

Business management lives in Settings > Business:

- Overview
- People
- Shared setup
- Usage
- Billing (owner only)

Use bottom sheets for member invites, assignments, and context selection. Primary actions stay in the lower thumb zone. Destructive member removal and cancellation require a clear confirmation but no support contact.

### Desktop

Business uses a real workbench:

- Left: company navigation and workspace switcher.
- Center: current section content.
- Right: contextual detail or activity panel.

The Overview should not be a wall of vanity metrics. It answers:

1. What is active?
2. What needs attention?
3. What is unpaid?
4. What documentation is incomplete?
5. Who is assigned?

### Core screens

#### Business overview

- Active projects with owner/assignee and documentation state.
- Attention queue: unanswered applicant, overdue invoice, missing daily log, failed upload, safety item.
- Receivables summary using real invoice data.
- Team activity with human-readable events.
- Storage and seat usage shown quietly.

#### People

- Searchable roster with role, status, assignment count, and last active timestamp.
- Invite button.
- Member detail drawer with role and assigned projects.
- Removed members separated from active roster.
- Owner transfer is a distinct high-risk flow.

#### Shared setup

- Company identity and document branding.
- Services and rate card.
- Estimate/invoice defaults.
- Reusable templates.
- Notification defaults.

#### Usage and billing

- Current plan and plan version.
- Active seats / included seats.
- Storage used / allocation.
- Renewal date and amount.
- Payment method summary.
- Billing invoices via Stripe portal.
- Add/remove seats.
- Cancel or resume with plain-language consequences.

## 12. UX states and copy rules

Every Business screen needs:

- Loading skeleton that preserves layout.
- Honest empty state with one next action.
- Permission state explaining who can perform the action.
- Offline/error state that does not claim a save succeeded.
- Over-limit state that preserves read/export access.
- Pending invitation, expired invitation, removed member, and last-owner protection states.

Examples:

- Empty roster: `Invite the first teammate` / `Share jobs and records without sharing your password.`
- Member permission: `Only the company owner can manage billing.`
- Storage limit: `Uploads are paused. Existing records are safe and available to export.`
- Downgraded workspace: `Company records are read-only. Reactivate Business or export your records.`

Avoid `team productivity`, `unlock growth`, and generic SaaS copy. Use field outcomes: fewer handoff calls, consistent pricing, proof in one place, and knowing what needs attention.

## 13. Analytics and business health

Instrument server-owned events with plan and organization dimensions:

```text
business.checkout_started
business.checkout_completed
business.invitation_sent
business.invitation_accepted
business.member_removed
business.role_changed
business.record_shared_created
business.assignment_created
business.export_created
business.limit_warning_shown
business.subscription_cancelled
business.subscription_resumed
```

Measure:

- Visitor -> Free -> Pro -> Business conversion.
- Time from Business activation to first accepted invitation.
- Weekly active organizations and active seats.
- Shared records created per organization.
- Percentage of active jobs with photos/logs/closeout proof.
- Invoice/receivable usage.
- Storage cost and support minutes per workspace.
- Gross margin, failed-payment recovery, refund rate, and churn.
- Cancellation reasons, collected without blocking cancellation.

Business is successful when multiple people actively share work records, not when an owner merely pays.

## 14. Build sequence

### Phase 0: Current Gate B boundary

- Complete Packet 55 physical two-account compensation acceptance.
- Keep Business hidden.
- Do not alter the current Pro checkout or production entitlement behavior.
- Approve this plan, price direction, storage allocations, and data ownership model.

### Phase 1: Entitlement foundation behind flags

- Add a versioned server product catalog.
- Return resolved Free/Pro entitlements without changing current access.
- Replace direct client `isPro` gates with named entitlement checks.
- Add contract tests proving current Free and Pro behavior remains unchanged.

### Phase 2: Organization lifecycle behind flags

- Add invitations, acceptance, member management, last-owner protection, ownership transfer, and audit events.
- Build server authorization tests for owner/admin/member.
- Add workspace context and organization-owned records incrementally.
- No paid Business checkout yet.

### Phase 3: Shared workspace

- Shared clients, rates, templates, projects, records, assignments, and activity.
- Mobile context labels and desktop workbench.
- Data migration/ownership rules for existing contractor organization records.
- Full loading, empty, error, offline, and permission states.

### Phase 4: Business billing in Stripe test mode

- Organization billing subject.
- Versioned Business price and seat quantity.
- Checkout, portal, signed webhooks, reconciliation, seat proration, cancellation, resume, failed-payment grace, and downgrade restrictions.
- Cross-account and cross-organization adversarial tests.

### Phase 5: Controlled Business pilot

- Invite 3-5 Jacksonville companies with 2-5 people each.
- Keep price/entitlements feature-flagged per organization.
- Measure activation, shared record usage, support cost, and churn intent for at least 30 days.
- Only then expose Business pricing publicly.

## 15. Release acceptance criteria

Business may become visible only when all are true:

- Every entitlement is server-enforced and contract-tested.
- Owner/admin/member permission matrix passes integration tests.
- Invitation and removal flows work across two real accounts and two devices.
- Last owner cannot be removed or downgraded accidentally.
- Personal and company records cannot leak across contexts or organizations.
- Stripe test-mode checkout, quantity changes, cancellation, resume, webhook replay, reconciliation, failed payment, and downgrade all pass.
- Existing records remain readable and exportable after downgrade.
- Storage and seat usage are accurate.
- Mobile screens pass at compact and modern-phone sizes with one-handed primary actions.
- Desktop Business screens use a workbench layout rather than widened mobile cards.
- Accessibility checks cover focus, dialogs, status messaging, and 44px targets.
- Terms, Privacy, support, incident response, backups, monitoring, and a second responder are launch-ready.
- Product copy lists only functionality that is actually live.

## 16. Current code gap summary

What exists now:

- Account-owned Stripe customers, subscriptions, and Free/Pro entitlements.
- Signed webhook handling, checkout reconciliation, cancellation, resume, and portal access.
- Organizations and active `owner/admin/member` memberships.
- Server-side organization checks on contractor job workflows.
- Settings sections for plan and business profile data.

What is missing:

- Organization-owned billing.
- Business as a valid plan or entitlement.
- A central named entitlement catalog.
- Seats, invitations, transfer, and member lifecycle APIs.
- Shared-company ownership across tool records.
- Workspace context switching.
- Business usage, activity, and billing UI.
- Tested downgrade and failed-payment behavior for a shared workspace.

This is why the correct next move is the entitlement foundation after Packet 55 closes, not a visible Business pricing card.

## 17. Non-goals

- No homeowner accounts or homeowner lead marketplace.
- No payroll, tax filing, employee classification, or time-clock compliance promise.
- No escrow, job payment custody, or percentage fee on work.
- No AI estimate guarantee or automated compliance decision.
- No surveillance-style location tracking.
- No enterprise SSO or multi-location hierarchy in the first Business release.
- No fourth pricing tier until real usage demonstrates a distinct buyer and outcome.
