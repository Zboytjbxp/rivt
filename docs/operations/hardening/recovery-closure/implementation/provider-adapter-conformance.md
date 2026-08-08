# Immutable provider-adapter conformance

## Purpose

This is the mandatory contract for any live backup provider adapter. Packet
90's injected store interface is a local cryptographic foundation; setting
`atomicPut = true` is not provider proof.

Conformance uses disposable generated data and separately authorized
resources. It must not use production content.

This supplements Packet 90 at commit
`8ba8702b40fe57d88550a07ed816fc56d4575cf3` and its implementation handoff,
which is bound to evidence collection
`f170d32f0da2b2527ff003afebae195112dea6d20aaaa01c4f9d27ae47589080`.

## Capability receipt

Before a write, the adapter must obtain and bind:

- provider and service;
- account/project/tenant;
- region;
- immutable bucket/container identity;
- endpoint fingerprint and TLS verification mode;
- versioning status;
- Object Lock/WORM status;
- default retention mode and duration;
- native SHA-256 and conditional-create support;
- read-after-write metadata-consistency behavior;
- single-put and multipart limits;
- adapter version and source revision;
- credential role identifier, never a secret.

The encrypted completion record must authenticate the source binding,
destination binding, and retention-policy digest.

## Create contract

`createObject` must:

1. require `ifAbsent=true`;
2. require exact content length and SHA-256;
3. require an approved retention-policy identifier and minimum
   retain-until time;
4. accept one shared abort signal and an absolute deadline;
5. expose no truncated object as successful;
6. return the immutable version ID, provider-accepted SHA-256, stored length,
   provider server time, retention mode, retain-until time, and a
   non-sensitive request-correlation digest;
7. re-HEAD the exact returned version through the metadata-auditor identity;
8. fail unless version, length, SHA-256, lock mode, and retention match.

An ETag is not a SHA-256 integrity receipt. If the provider cannot attest
SHA-256, the metadata-auditor or recovery identity must independently read
back and hash the ciphertext.

## Conditional creation and ambiguity

Executable tests must prove:

- two concurrent writes for one key produce exactly one accepted version;
- a pre-existing object is never changed;
- a completion-key collision fails;
- an interrupted or timed-out write leaves no visible partial object;
- ambiguous success is reconciled using the exact version/checksum/retention
  receipt before any retry;
- each run uses a unique unpredictable snapshot ID;
- no retry can create two accepted completions for one recovery set.

## Retention and effective-permission proof

Every data version and completion version must have Versioning and the
approved retention.

The writer's effective credentials must fail to:

- overwrite an accepted key;
- read or list customer object bodies;
- delete an accepted version;
- shorten retention;
- bypass Governance mode;
- change bucket policy or lifecycle.

The production application identity must fail to read or mutate the
destination. The completion version must be retained at least as long as
every object it references.

A policy screenshot or provider documentation is not evidence of effective
permission. The negative operations must be exercised.

## Retry, timeout, and cancellation

Initial tunable limits:

- one retry owner only;
- no more than three attempts for a retry-safe operation;
- jittered exponential delay;
- approximately 15-second metadata-call deadline per attempt;
- connection timeout plus size-aware absolute object deadline;
- hard backup-run ceiling below the 24-hour RPO;
- hard restore-run ceiling preserving the four-hour RTO.

Retry only timeout, throttling, or documented transient service failures.
Never retry authorization, checksum, retention, collision, malformed
response, or policy failures. A conditional write may be retried only after
ambiguous-success reconciliation.

The first worker failure must abort every active stream/upload through one
shared signal. All workers must settle before temporary ciphertext is
removed.

## Stable errors

Provider details must map to:

- `NOT_FOUND`
- `PRECONDITION_FAILED`
- `CHECKSUM_REJECTED`
- `RETENTION_NOT_ENFORCED`
- `ACCESS_DENIED`
- `TIMEOUT`
- `THROTTLED`
- `TRANSIENT`
- `PERMANENT`
- `BUDGET_EXCEEDED`
- `ABORTED`
- `CLEANUP_INCOMPLETE`

Raw provider messages must not enter logs or evidence.

## Durable state and observability

The run state is:

`planned -> preflight_passed -> copying -> data_verified ->
completion_written -> independently_attested -> restore_verified ->
cleanup_verified`

Required allowlisted evidence:

- opaque run ID, source revision, adapter version;
- provider-server and local start/end times;
- expected/copied/verified counts and bytes;
- database and object-manifest digests;
- attempt/retry counts by normalized error category;
- duration and maximum concurrency;
- request, byte, egress, and local cost-meter totals;
- exact-version and retention attestation result;
- completion-last proof;
- orphan count, bytes, estimated cost, and expiry;
- RPO/RTO result;
- alert-delivery result;
- cleanup status.

### Repository receipt privacy

New public or protected repository receipts must not contain a bucket name, object
key, filename, account identifier, provider URL, signed URL, or exact storage
version. The adapter keeps exact provider identifiers for new evidence only in encrypted,
access-restricted operator evidence and publishes a one-way 64-character
`artifactIdentitySha256` as the sole artifact correlator.

This is a prospective contract. Existing historical repository records are not
retroactively erased.

Completion and restore receipts each bind their own exact opaque identity.
They are not required to be equal because scheduled completion and periodic
restore cadences differ. If readiness later requires proof that one selected
backup was restored, the evidence plan must bind both receipts through an
explicit recovery-set or selected-artifact relationship rather than infer that
relationship from timing.

Only aggregate positive safe-integer counts and bounded byte/duration totals
may accompany the identity. A digest and aggregate counts prove receipt
binding, not complete object coverage or successful recovery; those claims
still require the isolated database-plus-object acceptance checks below.

Alert when:

- no independently attested valid set exists within 24 hours;
- a run fails or remains incomplete;
- checksum, version, or retention mismatches;
- the local cost ceiling approaches or refuses an operation;
- immutable orphan bytes grow unexpectedly;
- a key or credential fails;
- the monthly restore fails or becomes due.

## Abort and cleanup

On backup failure:

1. signal abort and stop new operations;
2. abort every exact multipart upload ID;
3. wait for every worker;
4. remove ciphertext staging;
5. do not write completion;
6. write a separately named encrypted abort record when possible;
7. enumerate the exact snapshot prefix through the auditor;
8. delete only mutable trial versions by exact version ID;
9. record locked partials as immutable orphans with bytes, expiry, and cost;
10. prove zero unresolved multipart uploads.

On restore failure:

- delete every exact object written to the isolated target;
- verify deletion;
- return `CLEANUP_INCOMPLETE` for any cleanup failure;
- preserve exact cleanup identifiers only in encrypted, access-restricted
  operator evidence. General logs retain only hashes and aggregate counts.

An abort record must never count as a completion.

## Conformance suite

- [ ] capability receipt is complete and authenticated;
- [ ] atomic interruption exposes no successful partial object;
- [ ] concurrent conditional-create race has exactly one success;
- [ ] checksum corruption fails closed;
- [ ] exact version/checksum/length HEAD attestation passes;
- [ ] data and completion retention pass;
- [ ] writer forbidden-operation tests return `ACCESS_DENIED`;
- [ ] production identity cannot access destination;
- [ ] transient retries stay bounded;
- [ ] ambiguous success creates no duplicate accepted version;
- [ ] timeout cancels active streams;
- [ ] multipart abort leaves zero active uploads;
- [ ] local budget refusal performs no next provider operation;
- [ ] logs contain no source key, filename, account ID, signed URL,
  credential, or content;
- [ ] restore failure leaves no unreported plaintext.

## Physical-drill acceptance

### Authorization

- [ ] The founder role approved the provider, account, US region, exact resources,
  maximum source bytes, maximum incremental cost, and expiration.
- [ ] DPA, subprocessors, region, deletion, and incident route are recorded.
- [ ] Retention, erasure, legal hold, and key custody are approved.
- [ ] writer, auditor, recovery, retention, and admin identities are separate
  and negative-tested.
- [ ] restore targets are new, empty, isolated, and non-production.
- [ ] PostgreSQL uses private networking or CA-verified TLS.

### Source completeness

- [ ] one v2 database snapshot has exact source revision and time;
- [ ] database artifact SHA-256 and immutable version are recorded;
- [ ] object manifest is from that exact database snapshot;
- [ ] `metadataGaps.length === 0`;
- [ ] `needsSourceHashCount === 0`;
- [ ] all canonical stored-object classes are represented;
- [ ] all canonical `stored` bytes are included even when unscanned, their
  scan state is preserved, and restored unscanned bytes remain quarantined
  until re-scanned;
- [ ] count/bytes/data-class totals are approved before I/O;
- [ ] free disk safely exceeds maximum ciphertext staging plus reserve.

### Coordinated backup

- [ ] database and object snapshot share one recovery-set ID;
- [ ] destination binding and policy digest are authenticated;
- [ ] every write is conditional, encrypted, and SHA-256 verified;
- [ ] exact version and retention receipt exists for every object;
- [ ] set completion references the database artifact and object completion;
- [ ] completion is the final accepted write;
- [ ] independent auditor verifies all metadata;
- [ ] RPO is no more than 1,440 minutes;
- [ ] injected partial run produces no valid completion.

### Isolated recovery

- [ ] production credentials are absent;
- [ ] only exact immutable versions are read;
- [ ] database schema, rows, sequences, table digests, and aggregate digest
  match;
- [ ] every object restores with exact plaintext SHA-256 and size;
- [ ] database references resolve to restored objects;
- [ ] available file classes are represented without content in evidence;
- [ ] RTO is no more than 240 minutes;
- [ ] wrong key, missing version, tampered ciphertext, and provider outage
  fail closed.

### Cleanup and recurrence

- [ ] no production write occurred;
- [ ] isolated resources are deleted by exact IDs and inventory proves it;
- [ ] temporary credentials are revoked;
- [ ] zero multipart uploads remain;
- [ ] immutable accepted versions remain as intended;
- [ ] immutable orphans, if any, have bytes/cost/expiry evidence;
- [ ] alert delivery is demonstrated;
- [ ] evidence is privacy-safe and independently reviewed;
- [ ] at least one subsequent scheduled run is independently attested;
- [ ] monthly isolated restore scheduling and ownership are operational.

One manual drill does not prove recurrence.
