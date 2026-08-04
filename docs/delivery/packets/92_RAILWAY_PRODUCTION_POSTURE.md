# Packet 92 — Railway production posture and AWS exit decision

## Objective

Answer whether RIVT should migrate from Railway to AWS now, and bind the
selected hosting direction to measurable availability, capacity, failover,
cost, and migration gates.

This is a repository decision and implementation-handoff packet. Codex does
not change a provider or production system. During the packet, Michael
independently activated Railway Pro.

## Source and production boundary

- Packet target:
  `ae49a903db149023ac690f686bf0bac4c2197994`
- Live production source:
  `92a8451b8190f5119384a4970fb1a324503df995`
- Packet branch:
  `codex/railway-production-posture`
- Evidence collection:
  `db8eab9cc6aaa8cbfb50ca6c5f1b6c3bf620ffbb30188977c087a4c916760d17`

The branch is five commits ahead of live production and includes undeployed
security/recovery work. Packet 92 does not represent branch-only behavior as
deployed.

## Decision

**Stay on Railway and harden it. Do not migrate the whole platform to AWS
now.**

The Pro upgrade satisfies the plan prerequisite, but the last observed
Railway topology is still **not** accepted for public launch. It remains one
application process, one PostgreSQL service, and one region without proved
HA, PITR, edge rules, capacity, or failover. The owner-supplied screenshot
does not establish that this topology changed.

AWS remains the exit architecture. A present-day AWS comparison uses ECS
Express Mode/Fargate, ALB, RDS Multi-AZ, S3, WAF/CloudFront, and CloudWatch.
AWS App Runner is closed to new customers.

## Why

- The observed database/object footprint and Jacksonville rollout are small,
  but no traffic/resource/load evidence exists.
- No measured result shows Railway resource limits require migration.
- One current process runs HTTP, migrations, push delivery, and maintenance.
  Adding replicas before role separation would multiply connection pools and
  maintenance timers.
- Railway can support an incremental two-web/worker/HA/PITR design if its
  exact cost and failure behavior pass written and executable proof.
- AWS would add a container registry, ECS/VPC/IAM/ALB/WAF/CloudWatch/Route 53
  operating surface plus database/object migration and dual-running risk.
- AWS does not by itself fix application process roles, recovery, malware
  controls, privacy, or product SLO evidence.

## Portfolio

Packet 92 adds:

- [evidence context](../../operations/hardening/railway-production-posture/context.md);
- [machine-readable analysis](../../operations/hardening/railway-production-posture/hardening.json);
- [summary](../../operations/hardening/railway-production-posture/hardening.md);
- [three-option comparison](../../operations/hardening/railway-production-posture/proposals/production-hosting-posture.md);
- [selected implementation handoff](../../operations/hardening/railway-production-posture/implementation/harden-railway-first.md);
- architecture diagrams for current, baseline, hardened Railway, and AWS
  topologies.

## Selected sequence

1. Collect a privacy-safe seven-day baseline.
2. Obtain owner approval for the product SLO and cost ceiling.
3. Split `web`, `worker`, and `migrate` process roles.
4. Prove migrations, worker claims, maintenance leases, shutdown, database
   pools, and in-memory uploads under multiple local processes.
5. Obtain a staged Railway quote for Pro, two web replicas, one worker,
   pooling, HA PostgreSQL, PITR, edge controls, monitoring, and recovery.
6. With a new explicit approval, prove generated-data load and failover in an
   expiring cost-capped environment.
7. With another explicit approval, activate one reversible production stage
   at a time.
8. Run two database failover tests, one PITR restore, independent
   database/object recovery, webhook-safe edge checks, and pilot/10× load
   gates before public launch.

## Proposed SLO and thresholds

These are tunable engineering proposals, not current promises or provider
facts:

- 99.9% core read/write availability over rolling 30 days;
- 43 minutes 12 seconds error budget;
- existing 24-hour RPO and four-hour RTO;
- 35 concurrent synthetic sessions for 30 minutes;
- 350 concurrent synthetic sessions for 10 minutes;
- no more than 0.1% HTTP 5xx excluding injected upstream faults;
- at least 30% CPU, memory, connection, and storage-growth headroom;
- no unexplained acknowledged-write loss;
- app replica recovery within 60 seconds;
- database failover within 10 minutes;
- latency targets set only after a real seven-day baseline.

No load test ran in this packet.

## Cost boundary

Railway Pro is now active by the owner's action. It has a published US$20
monthly floor including the first US$20 of usage. Exact RIVT HA cost is
unknown because app, worker, database, consensus, proxy, volume, egress,
PITR, monitoring, and edge use must be staged and measured.

The theoretical AWS floor for two continuously running minimum Fargate tasks
plus the ALB hourly charge is approximately US$34.45/month before RDS
Multi-AZ, WAF/CDN, storage, logging, transfer, backup, support, or appropriate
production sizing. RDS requires an official configuration-specific quote.

Codex did not initiate or approve the Pro purchase and made no other
provider/cost change. Any further potentially chargeable action still
requires explicit approval immediately beforehand.

## Migration triggers

Reopen the AWS decision only when measured evidence shows one of:

- a legal/customer/insurer requirement Railway cannot satisfy affordably;
- Railway consumes more than 50% of the monthly error budget or causes an SLO
  miss for two consecutive months;
- two failed RPO/RTO drills;
- unacceptable database failure-domain or acknowledged-write-loss behavior;
- automatic horizontal scaling becomes required;
- sustained optimized resource use approaches 70% of approved limits;
- database operating burden exceeds the approved time budget;
- fully loaded AWS TCO is at least 20% lower for three consecutive measured
  months;
- a workload requires provider controls that justify moving that workload.

The percentages and time windows require owner approval before becoming
policy.

## Risk and requirement state

- `R-055` remains High/open. Packet 92 creates the exit criteria; it does not
  create HA, edge protection, load, failover, or autoscaling evidence.
- `R-052`, `R-053`, `R-054`, and `R-056` remain open and are not weakened by
  this hosting decision.
- `GA-OPS-009` is added as a public-launch Blocker for hosting capacity,
  redundancy, failover, and migration-decision evidence.
- `GA-OPS-004` remains a Blocker for complete recovery.
- `GA-OPS-005` remains Partial for operational monitoring.
- `GA-OPS-008` remains Partial until exact source deployment/configuration
  evidence exists.

## Acceptance boundary

Packet 92 is accepted when:

- the evidence hash and source/live distinction are correct;
- `hardening.json` parses;
- every portfolio link resolves;
- all Mermaid diagrams are syntactically reviewable;
- build, lint, tests, E2E, production dependency audit, and diff integrity
  pass;
- build state, risk, and requirement maturity are updated;
- the branch is committed and pushed;
- owner-supplied Pro activation is recorded separately from Codex actions;
- no provider/production/account/cost/deployment action was performed by
  Codex.

## Verification evidence

On 2026-07-29:

- hardening JSON/schema/enums/options/evidence references: pass;
- five local Markdown artifact link sets: pass;
- four Mermaid architecture files: structural review pass;
- 17-artifact evidence-manifest reconstruction: pass,
  `db8eab9cc6aaa8cbfb50ca6c5f1b6c3bf620ffbb30188977c087a4c916760d17`;
- `npm run build`: pass;
- `npm run lint`: pass;
- `npm run test`: pass — 173 unit tests and 24 integration suites;
- `npm run test:e2e`: pass — authentication, jobs/discovery,
  offline-recovery, and production-CSP flows;
- `npm audit --omit=dev`: pass — zero vulnerabilities;
- `npm run launch:readiness` and `npm run incident:readiness`: pass for their
  current policy inputs.

The current launch-readiness script does not evaluate new `GA-OPS-009`
hosting capacity/HA/failover evidence. Its green result is therefore not
public-launch approval; `GA-OPS-009` remains a manual Blocker until the
selected implementation gates are automated and passed.

## Status

**Railway-first decision and implementation handoff complete. Pro is active
by owner action; public launch remains blocked. No provider change, paid
action, or deployment was performed by Codex.**
