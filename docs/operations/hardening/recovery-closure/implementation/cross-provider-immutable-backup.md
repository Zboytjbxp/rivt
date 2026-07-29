# Cross-provider immutable backup implementation handoff

## 1. Selected Design And Constraints

The owner selected Option 3 from
`proposals/complete-recovery-boundary.md`: client-side encrypted, versioned,
retention-enforced backups in an administrative boundary separate from the
primary Railway account.

This packet implements only the provider-neutral, local recovery foundation:

- one repeatable-read logical database snapshot with deterministic per-table
  content digests;
- one complete object manifest derived from canonical `uploads` records;
- bounded streaming encryption, copy, and restore verification through
  injected storage adapters;
- a completion record written only after every expected object succeeds;
- privacy-safe evidence containing aggregate counts, byte totals, and digests
  but no object keys, account identifiers, file names, or file contents.

No provider resource creation, production object read, production restore,
deployment, plan change, or charge-bearing action is authorized. A local mock
success is tooling evidence only. It must not be represented as production
recovery evidence or closure of R-051.

The selected durable design still requires owner approval for provider,
region, recurring cost, retention, credential custody, and an isolated proving
drill.

## 2. Source Revision And Drift Check

The design evidence collection is bound by SHA-256
`f170d32f0da2b2527ff003afebae195112dea6d20aaaa01c4f9d27ae47589080`
at target source revision
`5a561a836834bae09d404628e7b0447b216bbfda`.

Implementation starts from `c35563caab2c65269f98b826663cdbba794b780a`.
The commits between those revisions contain derived recovery-design and
delivery documentation only. Before implementation, the relevant recovery
source still matched the evidence collection:

- `scripts/logical-backup-utils.js`;
- `scripts/create-logical-backup-artifact.js`;
- `scripts/restore-logical-backup-artifact.js`;
- upload schemas and object-storage flows cited as E014-E024 in `context.md`.

Any later drift in those files requires a new source comparison before
provider integration or recovery acceptance.

## 3. Affected Components

- `scripts/logical-backup-utils.js`
  - canonical value encoding, row ordering, table digests, snapshot digest
    verification, and shared cryptographic helpers.
- `scripts/create-logical-backup-artifact.js`
  - one read-only repeatable-read transaction covering schema, rows, counts,
    and sequence state.
- `scripts/restore-logical-backup-artifact.js`
  - post-restore content-digest verification for new artifacts while retaining
    count-only compatibility for version-1 artifacts.
- `scripts/recovery-object-utils.js`
  - canonical object-manifest validation, bounded encrypted copy, completion
    record, and restore verification using injected source and destination
    adapters.
- `scripts/run-local-recovery-harness.js`
  - guarded local-only proof that rejects production mode and any mode other
    than explicitly confirmed in-memory fixtures.
- `test/logical-backup-utils.test.js`
  - canonicalization, digest, transaction-query, and backward-compatibility
    coverage.
- `test/logical-backup-utils.integration.test.js`
  - PostgreSQL fidelity, read-only transaction, repeatable-read isolation, and
    exact digest round-trip coverage.
- `test/recovery-object-utils.test.js`
  - local in-memory storage fixtures for success and fail-closed cases.
- `package.json`
  - local unit/integration/security-lint/harness coverage only; no automatic
    provider job.

No production route, customer-facing UI, schema migration, or deployed
infrastructure component is part of this packet.

## 4. Ordered Work Packages

1. Add canonical database serialization that is explicit about null, booleans,
   numbers, strings, binary data, dates, arrays, and objects.
2. Select database rows in stable primary-key/unique-key order, falling back to
   canonical row ordering only when no usable key exists.
3. Produce SHA-256 per-table content digests and one aggregate database
   content digest inside the encrypted manifest.
4. Read schema, rows, counts, and sequences in one
   `REPEATABLE READ READ ONLY` transaction; rollback on every failure.
5. Verify new content digests after restore; accept legacy artifacts only
   through the existing strict count path and label that weaker verification.
6. Query canonical upload metadata into a provider-neutral object manifest,
   explicitly classifying stored, removed, failed, missing-hash, and
   non-recoverable records.
7. Reject duplicate source identities, invalid SHA-256 values, negative or
   oversized lengths, unsupported states, and manifests above configured
   count/byte ceilings.
8. Stream each source object through plaintext hashing and AES-256-GCM into a
   mode-0600 temporary ciphertext file. Validate source size/hash before
   replaying that verified ciphertext to an injected destination adapter.
   This prevents an immutable destination from permanently retaining an
   unverified partial object.
9. Upload verified ciphertext with collision protection and a transport
   checksum. Write an encrypted completion record only after the complete
   manifest succeeds.
10. Restore selected or complete encrypted objects through streaming
    decryption and compare plaintext bytes and SHA-256 without opening or
    rendering customer content.
11. Emit redacted evidence and exercise missing objects, altered bytes,
    truncated ciphertext, wrong keys, partial destinations, duplicate
    manifests, and limit breaches locally.

## 5. Compatibility And Migration

- Existing `rivt-logical-backup-v1` snapshots remain restorable.
- New artifacts retain the existing encrypted envelope version and introduce
  version-2 snapshot/manifest formats containing mandatory integrity
  digests. New restore code verifies those digests and reports
  `unavailable_legacy` for version-1 artifacts.
- Object recovery has a new versioned manifest/envelope format and does not
  alter the `uploads` table in this packet.
- `upload_status = 'stored'` with a non-empty object key is the recoverable
  source set. Removed/rejected/failed/pending rows are counted by state but are
  not silently copied.
- A stored record without a trustworthy 64-character SHA-256 value fails a
  fully verified snapshot. Legacy classification/backfill remains a separate,
  reviewed migration with rollback.
- Destination object names are opaque derivations. Physical source-bucket
  identity, source keys, and source digests are encrypted inside the
  completion data and never written to logs. Bucket identity is supplied
  explicitly because it is not persisted per upload and cannot be inferred
  from key prefixes.

## 6. Tactical Protections During Migration

- Provider I/O is absent from the default test runner and is never inferred
  from ambient credentials.
- The local harness takes injected adapters; tests use in-memory fixtures.
- Future live adapters must require an explicit provider-I/O flag, exact
  source and destination identities, different-boundary verification, byte
  and object ceilings, and a written owner authorization identifier.
- Concurrency and object/total byte ceilings are mandatory and fail closed.
- Destination and restore adapters must explicitly guarantee atomic writes.
  On failure, workers stop taking new objects and all active workers settle
  before temporary ciphertext is removed.
- A source length/hash mismatch, missing object, incomplete destination,
  decryption failure, or completion-record mismatch fails the snapshot.
- Completion is a final write. Partial objects without the completion record
  are not a valid backup. Verified locked blobs left by a failed completion
  write are cost-bearing orphans, not a valid snapshot, and need an explicit
  provider retention/cleanup policy before live rollout.
- Temporary files contain ciphertext only, use mode 0600, and are removed in
  `finally`; plaintext is never staged to disk.
- Logs contain snapshot ID, counts, byte totals, durations, and status only.
  They omit keys, names, account IDs, database URLs, credentials, and content.
- Database backup rolls back its read transaction on failure.

## 7. Tests And Security Validation

- Canonical database digests are invariant to object-property order and stable
  across supported PostgreSQL value representations.
- Row-content changes with unchanged counts produce different table and
  database digests.
- Database capture issues `BEGIN ... REPEATABLE READ ... READ ONLY`, then
  `COMMIT`; errors issue `ROLLBACK`.
- A restored target must match both strict counts and available table digests.
- Legacy snapshots remain count-verifiable and are never mislabeled as
  content-verified.
- Object tests cover complete round trip, no plaintext in destination
  envelopes, wrong key, missing object, size mismatch, hash mismatch,
  duplicate source object, invalid metadata, byte ceiling, count ceiling,
  truncated ciphertext, partial copy, and missing completion record.
- Static linting, full unit/integration/E2E gates, production dependency audit,
  and diff hygiene must pass before push.

## 8. Performance And Resource Benchmarks

Local acceptance uses deterministic fixtures and records:

- peak object concurrency (default 1, hard maximum 4);
- configured and observed object count;
- configured and observed plaintext bytes;
- copy and verification duration;
- evidence that objects are processed as streams rather than one full corpus
  buffer.

The local result is not a provider throughput, cost, or restore-time claim.
Provider benchmarks require separate cost authorization and an isolated
environment.

## 9. Rollout And Rollback

Local rollout:

1. merge provider-neutral code and tests;
2. continue generating database artifacts with optional stronger digests;
3. keep provider object-copy scheduling disabled;
4. review the implementation and local evidence;
5. obtain explicit choices and cost authorization before any provider proof.

Rollback is a source revert. There is no schema or provider resource to undo in
this packet. Version-1 database artifacts remain supported.

Future provider rollout must be canary-first, private, separately credentialed,
cost-capped, and reversible. It must verify exact cleanup identifiers on abort.

## 10. Acceptance Criteria

- New database artifacts are captured from one repeatable-read, read-only
  transaction.
- New manifests include deterministic table and aggregate content digests.
- Restore requires digests for version-2 artifacts and clearly distinguishes
  version-1 `unavailable_legacy` verification.
- The object harness copies and restores every valid local fixture using
  bounded streaming AES-256-GCM encryption.
- No completion record exists after any partial or mismatched copy.
- Evidence output contains no source key, name, account identifier, or content.
- No network/provider operation, deployment, production read, or incremental
  charge occurs.
- Required repository gates pass and Packet 90 records exact evidence.
- R-051 remains open until the independently administered provider control and
  a real isolated restore both pass.

## 11. Open Decisions

1. Which separate provider/account and US region will own immutable backups?
2. What recurring monthly cost ceiling is approved?
3. Is 30-day retention correct for every object class, including professional
   evidence, deletion requests, and legal holds?
4. Who holds the append-only credential, recovery credential, and offline
   encryption-key escrow, including break-glass succession?
5. How should legacy stored uploads without valid SHA-256 values be backfilled
   or explicitly excluded?
6. Does the owner separately approve the proposed, cost-capped provider proving
   drill after local review?
