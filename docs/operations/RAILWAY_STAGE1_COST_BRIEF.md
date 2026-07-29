# Railway Stage 1 cost brief

Observed: 2026-07-29 19:01 America/New_York

## Status and authority

This is a read-only planning artifact for Packet 94. It is not approval,
activation evidence, a deployment receipt, or permission to change Railway.
No service, replica, variable, resource limit, usage limit, volume, bucket,
deployment, domain, production data, or billing setting was changed while
preparing it.

The next provider action remains blocked until Michael receives and explicitly
approves a fresh, exact cost and outage statement. The approval expires after
24 hours and must bind the exact candidate source and rollback target.

## Current observed account facts

The Railway workspace reported:

- Pro plan fee: **US$20 per billing cycle**;
- included usage: **US$20 per billing cycle**;
- current billing cycle: **July 9 through August 9**;
- current metered resource usage: **US$2.18**;
- current resource-usage estimate: **US$4.06**;
- Railway Agent usage: **US$0.00**;
- Railway Agent hard limit: **US$20**;
- Compute hard limit: **not configured**; and
- Compute email alert: **not configured**.

The read-only project snapshot reported:

- production: one public RIVT service and one PostgreSQL service, each with
  one running replica in `us-east4`;
- staging: one RIVT service and one PostgreSQL service, each with one running
  replica in `us-east4`;
- no worker service in either environment;
- production still runs source `92a8451b8190f5119384a4970fb1a324503df995`;
- production remains connected to `master`, while staging remains connected
  to `codex/stripe-ach-pilot-staging`;
- the Packet 94 branch is connected to neither Railway environment;
- production has one attached PostgreSQL volume using approximately 370 MB;
- staging has one attached PostgreSQL volume using approximately 161 MB;
- production has one unattached `READY` volume using approximately 166 MB
  from a 5 GB capacity; and
- production has two storage buckets using approximately 40.4 MB and 35
  bytes. No bucket credentials or object contents were read.

The unattached volume's current used bytes imply approximately
**US$0.025/month** at the published storage rate, not US$0.75/month. Railway
bills actual volume storage used rather than the configured capacity. Its
purpose and recovery relationship are still unknown, so this artifact does
not authorize deletion.

## Current published planning rates

| Resource | Rate |
| --- | ---: |
| RAM | US$10 per GB-month |
| CPU | US$20 per vCPU-month |
| Service egress | US$0.05 per GB |
| Volume and incremental volume-backup storage | US$0.15 per GB-month |
| Bucket storage | US$0.015 per GB-month |

Railway bills replicas independently by actual usage. Pro is a US$20 monthly
minimum that includes the first US$20 of combined eligible usage. Taxes,
optional support, Agent usage, and other add-ons are separate.

## Proposed Stage 1 cost envelope

This proposal intentionally excludes Stage 2 redundancy.

| Item | Proposed bound |
| --- | --- |
| Existing production web | one replica, unchanged |
| New production worker | one private replica |
| Worker public domain | none |
| Worker volume | none |
| Worker region | same `us-east4` region |
| Worker RAM limit | 0.5 GB |
| Worker CPU limit | 0.25 vCPU |
| Worker serverless sleep | disabled for delivery reliability |
| Initial observation window | 60 minutes |
| Maximum worker-unavailable window | 15 minutes |

The full-capacity worker calculation is:

```text
RAM: 0.5 GB x US$10 = US$5.00/month
CPU: 0.25 vCPU x US$20 = US$5.00/month
Egress reserve: 1 GB x US$0.05 = US$0.05/month
Conservative incremental maximum = US$10.05/month
```

Using the live Railway estimate:

```text
Current estimated resource usage = US$4.06/month
Worker conservative maximum      = US$10.05/month
Staged resource estimate         = US$14.11/month
Pro included usage               = US$20.00/month
Expected invoice subtotal        = US$20.00/month before tax
```

The expected incremental invoice charge is therefore **US$0 before tax**
while total eligible usage stays below the included US$20. That is an
expectation, not a guarantee.

## Proposed cost controls requiring approval

Before Stage 1, the operator should propose all of the following together:

- Compute email alert: **US$12**;
- Compute hard limit: **US$20**, workspace-wide;
- Railway Agent hard limit: **US$0**;
- manual intervention threshold: **US$18**;
- one-time activation maximum: **US$1**;
- incremental monthly maximum: **US$10.05**;
- total approved monthly ceiling: **US$21 before tax**; and
- no paid add-on, committed-spend plan, additional replica, backup product,
  PITR product, support tier, WAF/CDN vendor, or monitoring vendor.

The US$21 ceiling provides a small allowance for metering and persistent
storage after a Compute stop. Hitting the Compute hard limit can stop every
Railway workload in the workspace, including the public app and database.
That outage behavior must be explicitly accepted; a hard limit must not be
described as harmless.

The Agent limit is separate. Setting it to zero prevents Railway Agent usage
from creating a second cost path and does not stop application workloads.

## Approval still required

This brief is not sufficient to activate. The final approval must be created
from a provider observation no more than 24 hours old and must name:

- exact project and production environment;
- exact candidate and rollback commits;
- exact web and worker services, roles, region, replica counts, config paths,
  and resource limits;
- the staged manual deployment sequence and 60-minute observation window;
- the US$1 one-time, US$10.05 incremental-monthly, and US$21 total-monthly
  ceilings;
- the US$20 workspace Compute stop and its full-workspace outage behavior;
- the US$0 Agent limit;
- the operator and rollback owner; and
- the no-real-charge acceptance flow.

Stage 2, database HA/PITR, a second web replica, paid monitoring, and any
other provider product require separate pricing and separate approval.

## Official references

- <https://docs.railway.com/pricing/plans>
- <https://docs.railway.com/pricing/understanding-your-bill>
- <https://docs.railway.com/pricing/cost-control>
- <https://docs.railway.com/projects/project-usage>
- <https://docs.railway.com/volumes/reference>
- <https://docs.railway.com/storage-buckets/billing>
