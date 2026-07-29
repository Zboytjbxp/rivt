# Packet 90 — Local recovery foundation

## Objective

Implement the provider-neutral foundation of the owner-selected
cross-provider immutable-backup design without reading production object
contents, creating provider resources, deploying, or authorizing spend.

This packet makes two previously weak boundaries testable:

1. a logical PostgreSQL artifact can preserve exact database values and prove
   content equality rather than row-count equality alone;
2. a complete object snapshot can be streamed, encrypted, authenticated, and
   restored through injected storage interfaces before RIVT selects or pays
   for a backup provider.

The implementation handoff is
`docs/operations/hardening/recovery-closure/implementation/cross-provider-immutable-backup.md`.
It is bound to evidence collection
`f170d32f0da2b2527ff003afebae195112dea6d20aaaa01c4f9d27ae47589080`
at source revision `5a561a836834bae09d404628e7b0447b216bbfda`.

## Authority and cost boundary

- Option 3, cross-provider client-side encrypted immutable backup, is the
  selected target architecture.
- This packet authorizes local implementation and local tests only.
- It does not approve the proposed US$1 proving drill, a provider/account,
  region, retention period, credential creation, scheduled service, or
  recurring cost.
- It performed no production read or write, provider API call, resource
  creation, database migration, deployment, DNS change, plan change, or
  charge-bearing action.
- `R-051` remains Critical/open. Local harness success is not production
  recovery evidence.

## Database artifact v2

- Snapshot capture now runs inside one PostgreSQL read-only,
  repeatable-read transaction with canonical UTC, date, interval, bytea, and
  floating-point output settings.
- Every column is captured as PostgreSQL text using its exact formatted type.
  This avoids JavaScript number, timestamp, bytea, and JSON coercion loss.
- The encrypted artifact contains deterministic per-table and whole-database
  SHA-256 content digests in addition to counts.
- Restore remains backward-compatible with v1 artifacts. A v1 restore is
  labeled `unavailable_legacy` for content verification rather than being
  represented as cryptographically verified.
- A v2 restore validates artifact integrity before mutation, restores inside
  a transaction, recomputes counts and content digests, and commits only when
  every comparison passes.
- The fidelity integration test covers UUID, bigint beyond JavaScript's safe
  range, high-precision numeric, date, microsecond timestamp/timestamptz,
  JSON/JSONB, bytea, arrays, Unicode, newlines, and nulls.

## Provider-neutral object harness

- The harness has no cloud client or network dependency. Source and
  destination stores are injected; production/provider adapters are outside
  this packet.
- A strict 32-byte master key is expanded with HKDF-SHA-256 using separate
  domains for object encryption, opaque object naming, and completion
  metadata.
- Source files stream in bounded chunks through AES-256-GCM into mode-0600
  temporary ciphertext. Size and plaintext hash are verified before the
  ciphertext is offered to a destination.
- Backup object names are HMAC-derived and opaque. Raw source keys, hashes,
  IVs, authentication tags, filenames, and provider errors are not emitted
  in normal logs or outer object metadata.
- A source binding explicitly names the logical bucket, provider, region,
  bucket identity, and endpoint fingerprint. RIVT does not infer a physical
  bucket from database rows.
- Preflight limits cap object count, per-object bytes, total bytes, and
  concurrency. Missing data, conflicts, malformed metadata, digest mismatch,
  size mismatch, collision, or completion tampering fail closed.
- Destination and isolated-restore adapters must explicitly guarantee atomic
  writes; concurrent workers stop taking new work and fully settle before
  temporary staging is removed after a failure.
- The encrypted completion object is written last and is the only valid
  snapshot marker. A partial upload cannot be represented as a complete
  backup.
- Restore authenticates the completion object, streams and authenticates
  every ciphertext, verifies plaintext and ciphertext digests/sizes, and can
  write exact source keys only to an isolated injected restore store.

## Relational object inventory boundary

The current database records logical storage bucket and object key, but not
the physical provider bucket. The manifest builder therefore requires
explicit runtime source binding and handles the canonical `uploads` table as
follows:

- stored objects are included conservatively, including currently
  unreferenced stored objects;
- pending objects are counted as excluded incomplete uploads and are never
  copied as stored content;
- removed, rejected, and failed uploads are recorded as excluded tombstones;
- duplicate database rows for one physical object are grouped;
- conflicting metadata for one physical source key fails the manifest;
- legacy objects missing a trustworthy SHA-256 or required metadata keep the
  snapshot from claiming full verification.

## Three-things review

1. **Physical storage is not in each row.** A plausible manifest could read
   from the wrong bucket. The harness now requires an explicit source binding
   and includes its digest in authenticated completion metadata.
2. **Legacy metadata is incomplete.** Some legacy/album records lack a usable
   content hash. The harness reports that gap and refuses to call the
   snapshot fully verified; a later authorized provider pass must stream-hash
   or explicitly classify those objects.
3. **Immutability can preserve mistakes and cost money.** A cloud Object Lock
   upload could retain bad or partial ciphertext. The selected adapter design
   must validate encrypted mode-0600 staging before immutable upload, write
   completion last, and define orphan cleanup/cost behavior before provider
   activation.

Deletion, account erasure, professional evidence, legal hold, and immutable
retention interactions also remain an owner/legal policy decision.

## Verification

- `npm run build` passed.
- `npm run lint` and `npm run lint:security` passed.
- `npm run test:unit` passed 173/173 tests.
- `npm run test:integration` passed 24/24 PostgreSQL tests with zero skips in
  approximately 1,374 seconds.
- `npm run test:e2e` passed all four fail-closed authentication,
  jobs/discovery, offline-recovery, and production-CSP paths. One initial
  run competed with the other heavy gates and reached its wrapper timeout;
  the required isolated rerun passed.
- `npm audit --omit=dev` reported zero production vulnerabilities.
- `npm run launch:readiness -- --require-ready` and
  `npm run incident:readiness -- --require-ready` passed. These validate the
  current machine-readable policy records; they do not override `R-051`.
- The structured hardening record parses as valid JSON, and
  `git diff --check` passed.
- The guarded local runner reported:
  `providerIo=false`, `productionDataRead=false`,
  `chargeBearingAction=false`, `objectCount=3`,
  `totalPlaintextBytes=81`, `completionWrittenLast=true`, and
  `contentVerified=true`.
- The unit and integration components are the exact commands invoked by
  `npm run test`; both passed independently. The long PostgreSQL component
  was not rerun a second time solely to duplicate the aggregate wrapper.

## Acceptance and next approval

The local foundation is accepted when this branch is committed and pushed.
That does not close recovery.

The next stage requires a new, explicit owner decision covering provider,
separate account, US region, DPA/subprocessor terms, retention/deletion
policy, encryption-key custody, recovery credentials, estimated recurring
cost, and the exact bounded proving drill. No provider setup or production
object read may begin from a generic instruction to proceed.

Packet status: **Local provider-neutral foundation complete; independent
backup, production object-byte recovery, recurrence, and provider proof
remain blocked on explicit approval. Not deployed.**
