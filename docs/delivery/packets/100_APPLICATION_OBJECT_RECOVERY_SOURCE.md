# Packet 100 - Application-object recovery source

Status: **source implementation only; not merged, deployed, scheduled, or
proved against a provider**

Current source state: **in progress**. The live command remains deliberately
inert until a separately reviewed provider authorization adapter attests an
exact three-key writer policy. A nonempty restore also remains deliberately
inert until a separately reviewed isolated RIVT route-read adapter is supplied;
the local target-database-reference byte check is not mislabeled as an
application-route read. Local source tests never satisfy either live boundary.

## Purpose

Build the fail-closed, provider-neutral source needed to recover RIVT's
PostgreSQL logical records and application-owned object bytes as one bound
recovery set. This is an operational implementation packet. It does not
activate a product packet and does not change the production application.

The production-credential exposure incident remains the governing operational
packet. The explicit launch hold remains active.

## Hard boundary

Work in this packet is limited to repository source, tests, IAM examples, and
operator documentation. It performs:

- no provider I/O;
- no production-data read;
- no charge-bearing action;
- no credential creation or use;
- no merge or deployment;
- no scheduler, workflow, or recurring-backup activation; and
- no launch, payment, customer communication, or production-data mutation.

The guarded local harness must report `providerIo: false`,
`productionDataRead: false`, and `chargeBearingAction: false`. Passing local
tests does not change
`operationalReadiness.applicationObjectByteRecovery`; that recovery leaf stays
`missing` until a separately approved bounded live recovery set and complete
isolated restore are proved.

## Recovery-set contract

One accepted recovery set binds all of the following to the same logical-v2
database snapshot:

1. the authenticated encrypted PostgreSQL artifact and logical manifest;
2. the uploads-table digest from that same snapshot;
3. the reconciled application-object manifest;
4. the exact source-store inventory observed before immutable writes;
5. the reviewed source commit and source/destination coordinate identities;
6. one immutable encrypted application-object archive version plus every
   member's offset, length, content digest, metadata, and authentication tag;
   and
7. one authenticated completion record written only after every component is
   accepted.

The set covers stored references for all current object scopes:

- legacy uploads;
- project evidence;
- albums;
- Shop Talk;
- document-brand media;
- professional profiles;
- message attachments; and
- contact-note attachments.

Excluded/tombstoned rows remain explicitly classified. The source inventory
must also classify provider-only objects and removed-but-still-present bytes.
No unmatched, missing, or unexplained object may be silently omitted.

## Security properties

- Stream every source object. Compute missing legacy SHA-256 values and compare
  every existing declared hash.
- Stage and authenticate the complete set before the first immutable provider
  write. Repeat the full source inventory and fail on key-set, size, or object
  identity drift.
- Prove every exact source key fits beneath the configured isolated-restore
  prefix before releasing the capture barrier or authorizing an immutable
  write.
- Hold an exclusive PostgreSQL advisory-lock barrier from the database
  snapshot through both source inventories and byte staging. Every runtime
  upload, removal, and uploads-table mutation uses the shared side of that
  same barrier and fails closed while capture is active. Before snapshot or
  provider access, require `DATABASE_URL` and `BACKUP_DATABASE_URL` to report
  the same PostgreSQL system, database OID, and database name as supplemental
  identity evidence. While the backup lease remains held, take a fresh random
  exclusive advisory-lock challenge through `BACKUP_DATABASE_URL` and require
  a shared try through `DATABASE_URL` to fail. This live contention proof—not
  identity equality alone—rejects a physical replica or clone with a separate
  lock manager.
- Encrypt database and object payloads client-side with AES-256-GCM using
  domain-separated keys derived from one strict 32-byte recovery master key.
- Keep raw object keys, object metadata, provider coordinates, and exact
  version IDs inside authenticated encrypted manifests or restricted operator
  evidence. Normal output is aggregate and secret-safe.
- Derive opaque recovery-set and destination keys. Reject collisions and use
  conditional create-only writes.
- Concatenate the independently authenticated encrypted members into one
  bounded archive. Require contiguous offsets, no gaps/overlaps/trailing
  bytes, exact per-member and aggregate hashes, and one exact immutable
  archive version/checksum/COMPLIANCE-retention receipt.
- Limit the protected writer to exactly three deterministic keys: database,
  application-object archive, and completion. The normal CLI must fail before
  writes unless a separately trusted adapter attests the rendered exact-key
  policy, reviewed principal, and half-open UTC window.
- Write the authenticated encrypted completion record last. Its absence means
  the set is incomplete even if component objects exist.
- Durably reserve restricted evidence at an absolute path outside the
  repository before provider work, sync the file and its parent entry with the
  platform-supported durability primitive, then bind the
  exact completion, database, and archive versions, hashes, and accepted
  COMPLIANCE-retention timestamps. An `EEXIST` retry must preserve the prior
  receipt.
- Fail before provider writes on an invalid database artifact, manifest,
  source commit, uploads digest, recovery key, coordinate binding, or limit.
- Enforce bounded object count, per-object bytes, total bytes, concurrency,
  database-artifact bytes, and provider pagination.

## Isolated restore acceptance

The source verifier must require exact completion and component versions. It
must authenticate the completion record, decrypt and validate the database
artifact, and restore every stored application object to an empty, isolated
target. Acceptance requires:

- a restore target with an identity distinct from the source and protected
  destination;
- exact restored object count and total bytes;
- exact SHA-256 readback for every object;
- an exact final restored inventory with zero unexpected objects;
- an isolated PostgreSQL restore and database manifest/content verification;
- application-level reads of representative restored objects;
- measured restore and verification time against the approved RTO;
- temporary target cleanup; and
- zero missing, mismatched, unresolved, or unexpected entries.

A wrong key, tampered ciphertext, missing or altered version, metadata drift,
nonempty target, identity collision, partial restore, cleanup failure, or
resource-limit violation must fail closed.

## Provider adapters and identities

Provider adapters in this packet are dormant and dependency-injected. Merely
importing or testing them must not inspect ambient AWS credentials or make a
network request. Future live execution requires separately reviewed,
least-privilege identities:

- source reader: list the exact source inventory and read each exact bound
  source version/identity; no write or delete;
- protected writer: create only the exact database, application-object
  archive, and completion keys and read only their retention state; no list,
  content read, overwrite, delete, or multipart upload;
- monitor/backup reader: list/read only the recovery prefix and exact retained
  versions; no write or delete; and
- isolated restore writer: operate only inside one empty temporary restore
  prefix, with cleanup limited to objects it created.

Those four credentials and coordinate identities must be distinct. None is a
web-runtime credential.

The repository renders and validates the exact three-key policy but does not
apply it. The default create command returns
`RECOVERY_WRITER_AUTHORIZATION_REQUIRED`; only a later, separately reviewed
provider adapter may attest policy activation and allow the first write.
The default nonempty restore returns `APPLICATION_READ_SMOKE_REQUIRED` unless
a separately reviewed isolated RIVT route-read adapter is injected. Raw
isolated-store readback remains a distinct lower-level integrity check.

## Source acceptance

- [x] Database and application-object manifests are bound to one exact
  logical-v2 snapshot and reviewed source commit.
- [x] All eight object scopes and excluded-row/provider-only classifications
  have focused coverage.
- [x] Missing legacy hashes are computed; declared hashes are verified.
- [x] Source inventory drift is detected before any immutable write.
- [x] Database artifact, every object component, and the completion record are
  encrypted, authenticated, immutable, version-specific, and retention-bound.
- [ ] Full isolated database-plus-object restore verification is implemented.
  The integrity/cleanup path is implemented, but the real isolated RIVT
  route-read adapter remains intentionally absent; raw store readback cannot
  close this item.
- [x] Adversarial tests cover missing objects, collisions, tampering, wrong
  keys, metadata changes, partial sets, identity collisions, and limits.
- [x] IAM examples keep source, writer, monitor, and restore authority
  distinct and least-privilege.
- [x] Local harness and automated tests prove source behavior without provider
  I/O, production reads, charges, or ambient credential use.
- [x] Commands remain detached from `npm start`, Railway configs, cron, and
  GitHub workflows.
- [x] Build, lint, focused/unit tests, E2E where relevant, dependency audit,
  diff integrity, and sensitive-data checks pass.

Current local evidence: build and repository lint pass; the focused Packet and
readiness set passes 220/220; the full unit gate passes 468/468; three
dependency-free integration checks pass while 20 PostgreSQL integrations are
explicitly skipped because this clean worktree has no `TEST_DATABASE_URL`; all
three browser E2E journeys pass; the production dependency audit reports zero
vulnerabilities; the local harness reports no provider I/O, production-data
read, or charge-bearing action; JSON, diff-integrity, and added-source
sensitive-pattern checks pass.

The unchecked restore item and the separately missing live writer-
authorization adapter keep this packet `source-in-progress`. No provider or
operational acceptance is inferred from the checked local items.

## Live evidence required later

Source acceptance is not operational acceptance. A future live proof needs a
new, explicit, bounded approval and must record only safe summaries in the
repository. Restricted evidence must bind the exact reviewed/deployed commit,
database artifact and object manifest, source inventory, immutable versions,
retention, active-key-only decryption, all eight scopes, object counts/bytes,
zero mismatches/unresolved/unexpected entries, isolated database and object
targets, actual application-route read smoke, durations/RTO, cleanup, health,
and monitor state. The restricted receipt must supply the completion,
database-artifact, and archive key/version/hash/retention bindings used to
render the three exact-version reader grants. Current operational approval
must postdate that proof.

Until all live evidence exists, recurring backup, freshness monitoring,
complete-service recovery, launch readiness, and cost safety are not claimed.
The live capture window must also prohibit deployments, migrations, direct SQL
changes, and provider-console/object operations that bypass the application
barrier.
