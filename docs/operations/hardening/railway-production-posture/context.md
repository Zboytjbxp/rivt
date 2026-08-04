# Railway production-posture evidence context

Analysis ID: `hardening_20260729_railway_production_posture`

Target source revision:
`ae49a903db149023ac690f686bf0bac4c2197994`

Live production source observed by the inherited Packet 88 evidence:
`92a8451b8190f5119384a4970fb1a324503df995`

Source drift: `present`. The target branch is five commits ahead of production
and includes undeployed security and recovery implementation. Nothing in this
portfolio describes branch-only behavior as live. Packet 92 updates delivery
documentation after the collection below was hashed; the digest binds the
pre-analysis evidence snapshot. Untracked `.codex-*` workspace files were
excluded and were not modified.

Collection identity:

- Kind: repository document and source collection
- Artifact count: 17
- Collection SHA-256:
  `db8eab9cc6aaa8cbfb50ca6c5f1b6c3bf620ffbb30188977c087a4c916760d17`
- Artifact hashes: raw bytes from the Windows checkout at the pre-analysis
  snapshot, including checkout line endings. They are not Git-blob hashes.
- Digest construction: SHA-256 of the UTF-8 sequence
  `<repository path><TAB><artifact SHA-256>`, joined by LF in the order below.

## Repository evidence inventory

| Evidence | Reader-facing title | Repository path | SHA-256 |
| --- | --- | --- | --- |
| `RP92-E001` | RIVT product and launch contract | `RIVT_MASTER_BUILD_PROMPT.md` | `91c8469bdbafcee81abdcc959dc7d76d51d8c20e0317ecf685f4e57f02df5783` |
| `RP92-E002` | Current build and launch boundary | `docs/delivery/BUILD_STATE.md` | `bacd5a51acdf1fa7f27508536d295c8fbc406f586265889f4956a2e14f956874` |
| `RP92-E003` | Infrastructure and launch risks | `docs/delivery/RISKS.md` | `2490d774d595f6c5e7f72c90cd6d28644d61002d98b80ebd06c62a4a826263a5` |
| `RP92-E004` | Requirement maturity map | `docs/product/REQUIREMENTS_TRACEABILITY.md` | `d4c8fd593ea823235790a382e1d896e1fc8c2189b8087df8bb4271c9e1f26e0d` |
| `RP92-E005` | Packet 88 infrastructure assessment boundary | `docs/delivery/packets/88_SECURITY_INFRASTRUCTURE_HARDENING.md` | `8fb0c44c9aebbb71843461c58da71fb2cde64d6ca612bc4c20e31f0b3cc0d64c` |
| `RP92-E006` | Packet 89 recovery design | `docs/delivery/packets/89_RECOVERY_CLOSURE_DESIGN.md` | `d49b91016ecf729940dd539d195b7740fdd1edcb74d9082bc92d998b5145073c` |
| `RP92-E007` | Packet 91 recovery activation decision | `docs/delivery/packets/91_RECOVERY_ACTIVATION_DECISION.md` | `7aedfbe86366a25325287b49730b4c71b52146c03b747f7012b32076086f7cda` |
| `RP92-E008` | Security and infrastructure assessment | `docs/operations/SECURITY_INFRASTRUCTURE_ASSESSMENT.md` | `eb35a7879ae3ab9554e6ffac8da1f1cfdcbd661db52ae6eadc59403e0af2645f` |
| `RP92-E009` | Approved Gate A recovery targets | `docs/operations/recovery-policy.json` | `c4fe8224e4ea9aff0d9a7b7927b6d8a9b736e210bdbdd1347007a536dd034466` |
| `RP92-E010` | Provider compliance evidence gaps | `docs/operations/PROVIDER_COMPLIANCE_REGISTER.md` | `4d7a302e2817cb6604d54d2d8761a45c221782b891d613df4db27b619f74444e` |
| `RP92-E011` | Jacksonville controlled-launch shape | `docs/launch/JACKSONVILLE_SOFT_LAUNCH_SCRIPT.md` | `970bc01125f040d880ef026f746142cb8625ae215f32a501eab810a603499463` |
| `RP92-E012` | Railway build and deployment definition | `railway.json` | `e54899dbb789ecb41262cc9dbbf31924f376a68368154feecb9b3ba4cda7107d` |
| `RP92-E013` | Runtime and verification commands | `package.json` | `5cd71662e5f54c380a561090a308746becab12c28243e01970b0243b29912fe6` |
| `RP92-E014` | Express runtime, pool, startup, health, and shutdown | `server/index.js` | `746a7db5abe7d264e9c8fb9339bfa140f7e9da8d6ab5fecd47343a12cafec0e3` |
| `RP92-E015` | Serialized migration runner | `server/migrations.js` | `0d3602ca1f5afd8c0d3f8d22b1db879c3b1d51df2ddaabf05516e3d91adc8cee` |
| `RP92-E016` | Per-process database maintenance | `server/database-maintenance.js` | `bd4a0112e77b2cfc9782c760150c75efd5b4cb05adabd8a2743468ec650d7b1f` |
| `RP92-E017` | Durable push-delivery outbox worker | `server/push-notifications.js` | `aa6895b8dcb6cc8c1135743de50c754bda754198ec3cdb98794848ce08376c23` |

## Read-only operational observations

These are inherited evidence inputs, not new provider checks or changes:

- `RP92-O001` — Packet 88 observed Railway Hobby, one production
  application replica, one PostgreSQL replica, and one `us-east4` region.
  WAF Under Attack mode and CDN were disabled.
- `RP92-O002` — The attached PostgreSQL volume used 360.448 MB of 500 MB.
  A separate unattached 5 GB volume existed. No volume was changed.
- `RP92-O003` — Recovery evidence recorded 109 tables, 8,760 rows, 89
  objects, and 40,385,105 object bytes. These are footprint observations, not
  request-rate or capacity evidence.
- `RP92-O004` — An owner-provided Railway billing screenshot showed US$2.00
  current use and a US$3.85 estimate against US$5.00 included usage. This is a
  point-in-time billing-UI observation, not an invoice, forecast, or resource
  utilization measurement.
- `RP92-O005` — The Jacksonville rollout script describes approximately 35
  invited users over the first three days. This is a launch plan, not a
  concurrency measurement or demand forecast.
- `RP92-O006` — On 2026-07-29, Michael supplied a Railway billing screenshot
  showing that he independently upgraded the workspace/account to Pro. The
  screenshot is evidence of plan activation only. It does not establish
  replica count, database HA/PITR, edge settings, autoscaling, contractual
  support response, a final invoice, or an end-to-end RIVT availability SLO.

## Current-source findings

- `RP92-S001` — The Railway deployment starts one Node/Express process and
  gates deployment on `/api/health`.
- `RP92-S002` — Each process creates a PostgreSQL pool with a default maximum
  of 10 connections.
- `RP92-S003` — After database readiness, the same process starts migrations,
  the push-delivery worker, and hourly database maintenance.
- `RP92-S004` — Migrations use a PostgreSQL advisory lock.
- `RP92-S005` — Push claims use a transaction plus
  `FOR UPDATE SKIP LOCKED`, which supports coordinated claiming.
- `RP92-S006` — Database maintenance is bounded, but its timer is
  per-process. Every web replica would start one.
- `RP92-S007` — Uploads are bounded to 10 MiB by default but use in-memory
  buffering, so replica memory must include concurrent upload headroom.
- `RP92-S008` — Graceful shutdown drains HTTP work and closes the pool, but
  multi-replica failover and rolling-deploy behavior have not been tested.

## Inferences

- `RP92-I001` — The observed database volume was approximately 72.1% full.
  This is arithmetic, not a growth forecast or provider saturation metric.
- `RP92-I002` — With default settings, `N` application replicas can expose
  approximately `10 × N` application-pool connections before including
  migration, administrative, proxy, or database-HA connections. Actual
  database connection capacity is unknown.
- `RP92-I003` — Migration and push claiming are coordination-aware, but
  replica-safe startup, maintenance contention, worker recovery, health
  routing, and graceful drain are not proven.
- `RP92-I004` — The stored data footprint is small, but footprint alone
  cannot establish capacity. No current request rate, peak concurrency,
  CPU/RAM, database wait, p95/p99 latency, storage-growth, or load-test
  evidence exists.

## External provider references

Provider documentation was reviewed on 2026-07-29 and is not part of the
repository collection digest:

- `RP92-P001` — [Railway plans and pricing](https://docs.railway.com/pricing/plans)
- `RP92-P002` — [Railway scaling and replicas](https://docs.railway.com/deployments/scaling)
- `RP92-P003` — [Railway public-network limits](https://docs.railway.com/networking/public-networking/specs-and-limits)
- `RP92-P004` — [Railway WAF](https://docs.railway.com/networking/waf)
- `RP92-P005` — [Railway production-readiness checklist](https://docs.railway.com/overview/production-readiness-checklist)
- `RP92-P006` — [Railway databases](https://docs.railway.com/databases)
- `RP92-P007` — [Railway PostgreSQL connection pooling](https://docs.railway.com/databases/postgresql-connection-pooling)
- `RP92-P008` — [Railway point-in-time recovery](https://docs.railway.com/volumes/point-in-time-recovery)
- `RP92-P009` — [Railway storage-bucket limits](https://docs.railway.com/storage-buckets)
- `RP92-P010` — [Railway support](https://docs.railway.com/platform/support)
- `RP92-P011` — [AWS App Runner availability change](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)
- `RP92-P012` — [Amazon ECS Express Mode](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html)
- `RP92-P013` — [Amazon ECS service autoscaling](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html)
- `RP92-P014` — [Amazon RDS Multi-AZ](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html)
- `RP92-P015` — [Amazon RDS point-in-time restore](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)
- `RP92-P016` — [Amazon RDS SLA](https://aws.amazon.com/rds/sla/)
- `RP92-P017` — [AWS Fargate pricing](https://aws.amazon.com/ecs/pricing/)
- `RP92-P018` — [Application Load Balancer pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)

## Evidence limitations

- No live provider account was accessed during Packet 92.
- Michael independently activated Railway Pro during the packet. Codex did
  not initiate, approve, or configure the purchase.
- No plan, replica, region, database, volume, PITR, WAF, CDN, DNS, bucket,
  monitoring, or billing setting changed.
- No load, failover, PITR, restore, penetration, or DDoS test ran.
- Railway's public documentation does not prove the exact physical failure
  domains, acknowledgement-loss bound, cutover behavior, price, or
  contractual availability of a proposed RIVT HA topology.
- Published rates cannot determine the final Railway or AWS bill without
  measured resource use and an approved configuration.
- AWS App Runner is closed to new customers. Any current AWS comparison must
  use ECS Express Mode or another supported ECS/EKS design.
- Provider component SLAs are not RIVT end-to-end availability evidence.
