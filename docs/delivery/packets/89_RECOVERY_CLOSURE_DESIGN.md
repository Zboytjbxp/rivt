# Packet 89 — Recovery closure design

## Objective

Turn Packet 88's open database-and-object recovery risk into a decision-ready,
cost-bounded recovery design without creating infrastructure, accessing object
contents, restoring production data, or incurring an approved provider charge.

The design portfolio is rooted at
`docs/operations/hardening/recovery-closure/`. It compares:

1. a restore-only baseline that proves the database artifact but leaves object
   bytes dependent on the primary bucket;
2. a same-provider, full-corpus Railway snapshot that can prove a one-time
   object restore but is not a durable independent backup;
3. a cross-provider, client-side encrypted, versioned and immutable object
   backup, which is the recommended launch architecture.

Implementation is intentionally outside this packet until the owner selects an
option and separately approves any cost-bearing provider action.

## Observed recovery boundary

- Design target and branch base:
  `5a561a836834bae09d404628e7b0447b216bbfda`.
- Branch: `codex/recovery-closure-plan`.
- The fresh encrypted PostgreSQL artifact records 109 tables and 8,760 rows.
  It remains un-restored, so it is current RPO evidence rather than proof that
  this exact artifact can be recovered.
- That logical artifact contains database rows, object keys, and object
  metadata; it does not contain the corresponding photo, attachment, logo, or
  evidence bytes.
- Read-only aggregate inventory found 89 objects totaling 40,385,105 bytes
  across the current managed buckets. No object names, object contents, or
  credentials were read to produce this aggregate.
- The existing Railway bucket does not provide the independent versioned,
  immutable recovery boundary required by the recommended design.
- The prior named isolated database restore remains cadence evidence. It does
  not prove this fresh artifact or object-byte recovery.

These are observed boundaries. They do not establish recovery success, high
availability, disaster-recovery certification, or public-launch readiness.

## Recommended architecture

Adopt the cross-provider immutable-backup option for launch:

- encrypt files before they leave the RIVT recovery worker;
- write scheduled snapshots to a separate provider/account/administrative
  boundary;
- require versioning plus retention-enforced immutability or Object Lock;
- separate append-only backup credentials from recovery credentials;
- retain an encrypted manifest that ties database rows to exact object
  digests;
- restore to isolated targets and compare database counts plus object hashes;
- exercise and record the restore on a defined cadence.

Use the same-provider full-corpus Railway snapshot only as a one-time proving
stage before the durable cross-provider design is active. A complete copy and
restore of all currently observed 89 objects can establish that RIVT's object
manifest and recovery procedure work. It cannot be represented as independent
or immutable disaster recovery.

The restore-only baseline is not recommended for launch because a successful
database restore would still leave customer files dependent on the primary
bucket.

## Cost and authority boundary

No provider resource, restore target, bucket, object copy, scheduled job,
PITR setting, plan change, or deployment is authorized by this packet. No
provider mutation, production-data mutation, object-content access, or
incremental cost occurred while producing the design.

The following is the requested authorization boundary for a later one-time
proving stage. It is a proposal for owner approval, not evidence that approval
was granted:

> I approve up to US$1.00 of incremental Railway resource usage for one
> recovery drill: one temporary PostgreSQL service capped at 1 vCPU/1 GB for
> at most two hours, plus one temporary private bucket for a complete copy of
> the currently observed 89-object / 40,385,105-byte corpus. Do not upgrade
> plans, enable PITR or recurring features, expose a public endpoint, change
> DNS, or deploy unrelated application changes. Abort if caps cannot be
> confirmed, the database restore exceeds 15 minutes, the object inventory
> grows beyond 44,423,616 bytes (10% buffer), or the work cannot stay within
> this authorization; empty and delete all temporary resources and verify
> cleanup afterward.

The US$1.00 ceiling is tunable before approval. It must not be inferred from
the instruction to proceed with design work. If the selected architecture
requires a new provider or recurring storage, the owner must receive and
approve a separate recurring-cost estimate, data-flow review, retention
choice, credential model, and rollback plan before setup.

## Acceptance boundary for the one-time proving stage

Only after explicit approval, a proving stage is acceptable when it:

1. creates exactly one private, isolated PostgreSQL target with the stated
   resource and time caps and no public endpoint;
2. restores the exact fresh artifact and verifies 109 tables, 8,760 rows,
   expected migrations, critical tables, and zero count differences;
3. copies every object in the approved inventory to the temporary private
   target, records cryptographic digests without logging names or contents,
   and proves restoration for the required photo, attachment, logo, and
   completion-evidence categories;
4. treats every missing object, hash mismatch, unexpected inventory growth,
   timeout, or scope uncertainty as a failed drill rather than partial
   success;
5. empties and deletes every temporary resource, verifies its removal by exact
   provider identifier, and records the final incremental charge;
6. leaves production routing, DNS, application source, databases, buckets,
   plans, and customer-visible behavior unchanged.

A passing proving stage would close only the one-time restore-procedure
question. R-051 remains open until the durable, scheduled, independently
administered object-byte backup and recovery control is selected,
implemented, and successfully restored.

## Rollback and abort rules

- Stop before resource creation if the provider cannot enforce the written
  caps or private-network boundary.
- Stop before reading object bytes if the owner has not approved the complete
  inventory scope.
- Do not retry a timed-out database restore against production or a public
  database endpoint.
- On any failure, preserve redacted diagnostic evidence, then empty and delete
  the temporary bucket and delete the temporary database service.
- Verify cleanup by exact provider identifiers. Do not rely on a hidden UI
  control or the absence of a resource name from one screen.
- Escalate any missing or mismatched production object as a recovery incident;
  do not rewrite metadata or fabricate a replacement object.

## Three-things review

1. A database-only success can hide an unrecoverable file corpus. Database and
   object evidence must be joined by immutable digests and exercised together.
2. A same-account copy can validate tooling without surviving account
   compromise, credential misuse, or provider-wide loss. It must not be
   described as independent disaster recovery.
3. A technically valid immutable backup can still create uncontrolled spend,
   retention, privacy, deletion, and access obligations. The recurring design
   needs explicit owner, legal, and cost decisions before implementation.

## Current evidence and status

- No application or infrastructure implementation was started.
- No provider setting or resource was changed.
- No deployment occurred.
- No provider charge was authorized or intentionally incurred.
- No production object content was accessed.
- The recovery hardening portfolio is the decision artifact for the next
  owner review.
- R-051 remains a public-launch blocker.

## Verification

- `npm run build` passed.
- `npm run lint` and `npm run lint:security` passed.
- The first `npm run test` aggregate reached its local 20-minute command
  ceiling while its serial PostgreSQL tests were still progressing; it was
  not counted as a pass or a product failure.
- The same aggregate components then completed independently:
  `npm run test:unit` passed 150/150 tests and
  `npm run test:integration` passed 23/23 tests in 1,444 seconds.
- `npm run test:e2e` passed all four fail-closed auth, jobs/discovery,
  offline-recovery, and production-CSP paths.
- `npm audit --omit=dev` reported zero production vulnerabilities.
- `npm run launch:readiness -- --require-ready` passed. That machine gate
  validates the approved policy record; it does not override R-051 or prove
  object-byte recovery.
- The hardening artifacts parse and cross-link correctly, all three options
  cover security, performance, memory, reliability, operability, and
  migration, every diagram exists, and no local absolute path appears in a
  distributable artifact.
- `git diff --check` passed after the documentation updates.

Packet status: **Design complete; blocked on owner option selection and
explicit cost approval. Not implemented and not deployed.**
