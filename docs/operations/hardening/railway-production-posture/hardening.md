# Security Hardening Review: Railway production posture

Analysis ID: `hardening_20260729_railway_production_posture`

## Evidence Basis

Opportunities identified. RIVT does not need a full AWS migration now.
Michael independently activated Railway Pro during this packet, satisfying
the plan prerequisite, but the last observed single-app/single-database/
single-region topology is not accepted for public launch.

Selected direction: harden Railway first, preserve AWS as a measured exit
architecture, and retain Packet 91's separate independent immutable-recovery
boundary.

Selection authorizes repository planning only. It does not authorize a plan
upgrade, provider/account access, resource creation, production data access,
load test, configuration change, spend, or deployment.

- Target source: `ae49a903db149023ac690f686bf0bac4c2197994`
- Live production source: `92a8451b8190f5119384a4970fb1a324503df995`
- Evidence collection:
  `db8eab9cc6aaa8cbfb50ca6c5f1b6c3bf620ffbb30188977c087a4c916760d17`
- Full inventory and limitations: [context](context.md)

The immediate scaling constraint is application composition, not a published
Railway resource limit. One Node process currently starts HTTP, migrations,
push delivery, and database maintenance, and each process defaults to a
10-connection PostgreSQL pool. Blindly adding replicas would multiply pools
and maintenance timers before multi-replica behavior is proved.

## Constraints

- No potentially chargeable action or provider mutation without Michael's
  explicit approval immediately beforehand.
- No branch-only behavior may be represented as live production.
- No provider limit, component SLA, plan feature, or published price counts
  as end-to-end RIVT proof.
- Keep signed provider webhooks reachable and signature-verified.
- Do not change the approved 24-hour RPO/four-hour RTO in this packet.
- Do not use real customer data in synthetic load tests.
- Keep deployment, data, DNS, plan, provider, and billing settings unchanged.

The current data footprint is small, but no request rate, peak concurrency,
CPU/RAM, storage-growth, database-wait, p95/p99 latency, or load evidence
exists. An AWS migration cannot be justified by capacity evidence that has
never been collected.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Establish a measured production hosting posture | Pro active; last observed single Railway app/database/region; coupled web/background work; no capacity/SLO/load/failover proof | 1. Keep single-node baseline; 2. Harden Railway; 3. Migrate to AWS now | Select Option 2 for repository handoff only; reject Option 1 for public launch; retain Option 3 as a triggered exit architecture | [Production hosting posture](proposals/production-hosting-posture.md) |

## Recommendation Summary

Harden Railway first:

- split web, worker, maintenance, and migrate roles;
- measure seven days before setting latency targets;
- set an explicit database-connection and upload-memory budget;
- prove two web replicas and durable worker recovery;
- document and test PostgreSQL HA, PITR, and independent recovery;
- add webhook-safe edge protection;
- operate against an approved product SLO and cost ceiling.

The selected implementation handoff is
[Harden Railway first](implementation/harden-railway-first.md).

AWS remains the exit architecture. The current comparator is ECS Express
Mode/Fargate + ALB + RDS Multi-AZ because AWS App Runner is closed to new
customers. A full move is not justified until a contractual, reliability,
capacity, operating, or fully loaded cost trigger is measured.

Proposed tunables:

- product availability: 99.9% rolling 30 days;
- error budget: 43 minutes 12 seconds;
- retained recovery: 24-hour RPO / four-hour RTO;
- pilot proving profile: 35 concurrent sessions for 30 minutes;
- headroom proving profile: 350 concurrent sessions for 10 minutes;
- load 5xx ceiling: 0.1%, excluding injected upstream faults;
- minimum CPU/memory/connection/growth headroom: 30%;
- migration review when Railway consumes more than 50% of the error budget or
  causes an SLO miss for two consecutive months;
- resource migration review near 70% sustained optimized limits;
- TCO migration review when AWS is at least 20% lower for three consecutive
  measured months.

These are proposed engineering thresholds, not observed load, provider
guarantees, owner-approved spend, or customer promises.

Railway Pro is now active by the owner's action and has a known US$20 monthly
floor including the first US$20 of usage. The actual
two-web/worker/HA/PITR topology must still be staged and quoted because each
database/consensus/proxy service consumes metered resources.

The theoretical AWS two-task Fargate plus ALB web-layer floor is about
US$34.45/month before RDS Multi-AZ, WAF/CDN, S3, logging, transfer, backup,
support, or sensible sizing. RDS requires an official configuration-specific
quote. Comparing incomplete line items would be dishonest.

## Next Decisions

Before any paid or live action:

1. approve or revise the proposed 99.9% product SLO;
2. choose the maximum monthly Railway amount that may be quoted;
3. obtain written Railway database failure-domain, durability, failover, PITR,
   support, and cost answers;
4. approve the generated-data load/failover test profile and maximum test
   cost;
5. name the operator responsible for incidents when provider support has no
   SLO.

Open launch blockers remain:

- independent database-plus-object recovery (`R-051`);
- malware scanning/quarantine (`R-052`);
- data retention/DSAR/provider governance (`R-053`);
- edge, redundancy, HA, autoscaling, load, and failover (`R-054`);
- public database TLS verification for non-private clients (`R-055`);
- capacity/SLO/cost baseline and owner approvals.

Documentation and decision evidence only. No application, provider,
production, account, network, DNS, plan, database, storage, backup, billing,
or deployment setting changed.
