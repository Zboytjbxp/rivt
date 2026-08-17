# Packet 100 - Application-object recovery source

Status: **source implementation only; not merged, deployed, scheduled, or
proved against a provider**

Current source state: **in progress**. The source now includes a provider-neutral
authorization lease and the selected Option 2 crash-reconciliation source
contract. Before any writer adapter can open, the command must durably register
the exact run and authority binding with an independently owned retirement-
controller interface, then durably record that registration. The provider-
neutral reconciler uses compare-and-swap revisions, fencing tokens, bounded
attempt leases, deadline sweeps, conflict quarantine, and idempotent retry to
handle ambiguous registration and simulated controller-process loss. Its v2
reservation and final v5 restricted receipt bind registration and retirement
finalization, but expose only the identity digest of the bounded controller-
private retirement descriptor. Local controller evidence is fixed to
`providerless-injected-fake`; source tests cannot mint AWS simulation or live
evidence. The live command remains deliberately inert until both a separately
reviewed AWS exact-key control adapter and an independently deployed retirement
controller are supplied. Live use must also bind provider-derived writer,
account, bucket-owner, control, and auditor identity and prove forced-
termination reconciliation through real provider control and data planes.
Nonempty restore now includes a providerless
isolated route-reader that invokes the same authenticated upload-URL handler as
the production application against an identity-bound read-only target client,
then follows an opaque injected delivery capability and verifies exact bytes.
Local tests prove that handler-level boundary with injected database and object
stores. They do not prove cookie/session middleware, a live HTTP request,
provider URL signing or delivery, or either live recovery boundary. The local
receipt is fixed to `handler-injected-store`; it cannot mint the live-only
`live-cookie-session-http-provider-delivery` evidence level.

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
  policy and reviewed principal. Its exact creates and exact-key retention
  reads must share the same half-open UTC window; `If-None-Match` applies only
  to creates.
- Durably record the exact policy/key-set plan before the adapter factory is
  opened. Require factory construction to perform no provider I/O, register the
  revoker before activation, treat activation errors as potentially mutating,
  retire and verify authority on every post-attempt failure, and require policy
  absence plus denied direct/multipart writes before final success evidence. An
  ambiguous revocation is the controlling failure.
- Before the writer adapter is constructed, durably register an independently
  owned retirement controller against the exact plan, random run binding,
  retirement deadline, later proof deadline, and still-valid writer-session
  expiry. Bind distinct control and auditor identity digests and a bounded
  controller-private retirement descriptor; expose only the descriptor identity
  digest in restricted evidence. Reconcile expired, ambiguous, or abandoned
  runs with compare-and-swap revisions and fencing; quarantine conflicting
  bindings; never let a stale claim or non-retired run become completion-
  eligible.
- Write the authenticated encrypted completion record last. Its absence means
  the set is incomplete even if component objects exist.
- Durably reserve v2 restricted evidence at an absolute path outside the
  repository before provider work, sync the file and its parent entry with the
  platform-supported durability primitive, then bind the exact controller
  registration/finalization plus completion, database, and archive versions,
  hashes, and accepted COMPLIANCE-retention timestamps in the final v5 receipt.
  An `EEXIST` retry must preserve the prior evidence.
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
- protected writer: only within the same reviewed half-open UTC window, create
  the exact database, application-object archive, and completion keys and read
  only their retention state; no list, content read, overwrite, delete, or
  multipart upload;
- monitor/backup reader: list/read only the recovery prefix and exact retained
  versions; no write or delete; and
- isolated restore writer: operate only inside one empty temporary restore
  prefix, with cleanup limited to objects it created.

Those four data-plane credentials and coordinate identities must be distinct.
None is a web-runtime credential. Create configuration now also requires
distinct retirement-control and auditor identity digests, each different from
every data-plane and application principal. They are source-contract bindings,
not credentials or provider proof. Future AWS implementations must derive and
verify both identities from the provider. Neither may read source data, decrypt
the set, or write arbitrary protected objects.

The repository renders and validates the exact three-key policy and supplies a
provider-neutral authorization/revocation lease plus the Option 2 retirement-
controller client and deterministic reconciler. It does not apply a provider
policy or deploy a controller. Construction performs no I/O. The exact plan and
controller registration must both be durable before the writer factory opens;
ambiguous registration requests exact retirement without opening writer
authority. A due sweep can reclaim an expired fenced attempt after simulated
controller-process loss, while stale revisions/fences and conflicting bindings
fail closed. Only a verified independently finalized retirement can precede
final v5 evidence. The default create path still rejects the missing controller
or protected-writer adapter. Only later, separately reviewed implementations may
install/read back the exact AWS policy, prove initial inertness and multipart
absence, remove/read back the policy, and produce real denial evidence. This is
a crash-reconciliation source contract, not an operational controller or live
AWS proof.
The default nonempty restore uses the providerless isolated RIVT route-reader.
It rechecks target-database identity inside a read-only transaction, requires
one exact authenticated-owner representative for every completed storage
scope, invokes the production upload-URL handler, and follows only the opaque
delivery capability produced by that handler. Raw isolated-store readback
remains a distinct lower-level integrity check. This source path is not live
cookie/session HTTP or provider-delivery evidence. Its sanitized success
receipt records `applicationReadSmokeEvidenceLevel: handler-injected-store`.

## Source acceptance

- [x] Database and application-object manifests are bound to one exact
  logical-v2 snapshot and reviewed source commit.
- [x] All eight object scopes and excluded-row/provider-only classifications
  have focused coverage.
- [x] Missing legacy hashes are computed; declared hashes are verified.
- [x] Source inventory drift is detected before any immutable write.
- [x] Database artifact, every object component, and the completion record are
  encrypted, authenticated, immutable, version-specific, and retention-bound.
- [x] Full isolated database-plus-object restore verification source is
  implemented, including exact target identity, read-only representative
  resolution, handler-level production route selection, exact scope equality,
  byte verification, and cleanup. Local injected-store proof is not live
  cookie/session HTTP or provider evidence.
- [x] Adversarial tests cover missing objects, collisions, tampering, wrong
  keys, metadata changes, partial sets, identity collisions, and limits.
- [x] IAM examples keep source, writer, monitor, and restore authority
  distinct and least-privilege; the exact writer create and retention-read
  grants share one reviewed half-open UTC window.
- [x] Local harness and automated tests prove source behavior without provider
  I/O, production reads, charges, or ambient credential use.
- [x] Commands remain detached from `npm start`, Railway configs, cron, and
  GitHub workflows.
- [x] Provider-neutral writer lifecycle source registers revocation before
  activation, revokes on ambiguous activation and every later failure, and
  permits final restricted evidence only after exact inertness proof.
- [x] The exact writer plan is durable before the adapter factory opens; a
  failed evidence write opens no factory.
- [x] Option 2 provider-neutral source durably registers independent retirement
  before writer construction; CAS/fencing, attempt-lease recovery, deadline
  sweep, ambiguous registration, quarantine, and completion-ineligibility paths
  have adversarial local coverage. Source-only evidence is fixed to
  `providerless-injected-fake`.
- [ ] The concrete AWS writer/control adapter, provider-derived writer/account/
  bucket/control/auditor bindings, independently deployed controller, provider
  persistence, forced-termination proof, effective-policy and multipart audit,
  and live control/data-plane evidence are implemented and adversarially proved.
- [x] Build, lint, focused/unit tests, E2E where relevant, dependency audit,
  diff integrity, and sensitive-data checks pass.

Current Option 2 evidence: 19/19 retirement-controller tests, 281/281 focused
Packet and readiness tests, 529/529 unit tests, and
`npm run prelint:security` pass. The retained writer-policy correction remains
covered by 10/10 focused tests. Repository JSON, diff integrity, and added-
source sensitive-pattern checks pass. The preceding source passed build,
repository lint, the aggregate test command, the zero-vulnerability production
dependency audit, three dependency-free integrations, and all browser journeys;
those broader closeout gates are not represented as a new frozen-source run
here. The guarded harness remains providerless and reported no provider I/O,
production-data read, or charge-bearing action.

The separately missing AWS provider control adapter and independently deployed
controller keep this packet `source-in-progress`. No provider or operational
acceptance is inferred from the checked local items, including the providerless
controller and handler-level route proofs.

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
must postdate that proof. The application-route evidence must include real
cookie/session middleware and a live HTTP/provider delivery path; the local
in-process handler adapter cannot substitute for it. Launch readiness accepts
only the evidence-level value
`live-cookie-session-http-provider-delivery` on that coordinated restore;
missing or `handler-injected-store` evidence fails closed. It separately
requires `writerAuthorityEvidenceLevel: live-aws-control-and-data-plane` and
restricted `retired_verified` finalization by an `independent-controller`;
missing, providerless, or control-plane simulation evidence cannot pass.

Until all live evidence exists, recurring backup, freshness monitoring,
complete-service recovery, launch readiness, and cost safety are not claimed.
The live capture window must also prohibit deployments, migrations, direct SQL
changes, and provider-console/object operations that bypass the application
barrier.
