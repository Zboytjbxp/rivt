# Independent immutable-backup activation

## Status

Recommended design only. No provider, account, region, resource, credential,
cost, production read, or deployment is authorized by this document.

This supplements Packet 90 at commit
`8ba8702b40fe57d88550a07ed816fc56d4575cf3` and its implementation handoff,
which is bound to evidence collection
`f170d32f0da2b2527ff003afebae195112dea6d20aaaa01c4f9d27ae47589080`.

## Target architecture

RIVT should retain one coordinated recovery set outside the Railway
administrative failure domain:

1. capture one read-only, repeatable-read PostgreSQL artifact;
2. derive the exact object manifest from that same database snapshot;
3. stream, hash, and client-side encrypt every required object;
4. create immutable, uniquely named destination versions conditionally;
5. bind the database artifact, object versions, checksums, retention receipts,
   source identity, destination identity, policy digest, and key epoch into
   one encrypted set-level completion record;
6. independently attest the completion and every exact object version;
7. restore only exact accepted versions into new isolated targets;
8. apply the erasure and legal-hold ledgers before a restored service can
   reopen.

An incomplete run has no valid set-level completion record and is never
presented as a backup.

## Provider recommendation

Use AWS S3 Versioning and Object Lock in a dedicated US account:

- block all public access;
- use bucket-owner-enforced object ownership;
- give the scheduled writer conditional create-only authority;
- separate writer, metadata auditor, offline recovery reader, retention
  administrator, isolated restore writer, and break-glass administrator;
- use Governance mode only for disposable synthetic conformance;
- prohibit Compliance mode for customer-data snapshots until full-object
  retention, deletion, legal-hold, and key-custody approval;
- after approval, retain versions for at least the approved lock period, then
  lifecycle-delete and reconcile them after lock expiry. Deletion may occur
  later than the lock date and cost models must include that lag.

Google Cloud Storage remains an evaluated design alternative, pending owner
approval, if its built-in create-only writer role is preferred. Changing the recommended
provider requires a new comparison and approval, not a code rewrite of the
provider-neutral core.

## Trust boundaries

The production application identity must not administer or recover the
independent backup.

| Identity | Allowed | Forbidden |
| --- | --- | --- |
| Source reader | Read exact production source objects and database snapshot | Destination administration, production writes |
| Backup writer | Conditional create with checksum and approved retention | Read/list bodies, overwrite, delete, reduce retention |
| Metadata auditor | List/HEAD exact versions and inspect retention receipts | Read customer bytes, write, delete |
| Offline recovery reader | Read exact completed versions during an approved drill or incident | Normal scheduled use, write, delete |
| Retention administrator | Configure approved immutability and lifecycle | Read customer content |
| Isolated restore writer | Create and verify in new isolated targets | Production target access |
| Break-glass administrator | Time-limited account recovery under two-person approval | Routine backup execution |

## Activation phases

### Phase A - no-cost local closure

Before any provider call:

- authenticate the destination account, region, bucket, endpoint, TLS mode,
  versioning, immutability, and retention-policy digest in completion data;
- replace `atomicPut=true` self-attestation with executable adapter tests;
- require exact version, length, SHA-256, lock mode, and retain-until receipts;
- add deadlines, cancellation, bounded retry, ambiguous-write
  reconciliation, and stable error codes;
- stop converting permission or timeout errors into missing-object results;
- bind database and object artifacts into one recovery-set completion;
- add a signed cost authorization and local request/byte/cost meter;
- add an encrypted abort/orphan ledger;
- surface restore cleanup failures;
- bind key ID and epoch;
- add absolute count/byte/temp-disk limits;
- resolve legacy hashless objects;
- include every canonical `stored` byte regardless of scan state, retain its
  scan state, and require quarantine/re-scan after restore before exposure;
- keep public database paths blocked until CA-verified TLS is proved.

### Phase B - synthetic provider conformance

Requires a new explicit owner approval naming:

- provider, account, region, and disposable resource;
- generated non-production byte and request limits;
- maximum incremental cost and expiration;
- cleanup behavior and retained-orphan maximum.

It must prove the contract in
`provider-adapter-conformance.md`, including denied operations with the
effective writer credentials.

### Phase C - physical proving drill

Requires a second explicit approval naming:

- exact production source and read-only access;
- maximum source count and bytes;
- current pricing estimate and maximum incremental cost;
- new private empty restore targets;
- recovery identities and key custodians;
- cleanup identifiers and rollback owner.

The run must create one coordinated recovery set and restore database plus
every required object byte into isolated targets. The accepted evidence must
show an RPO no greater than 1,440 minutes and an RTO no greater than 240
minutes without customer identifiers, source keys, filenames, content, signed
URLs, or secrets.

### Phase D - recurrence

Requires separate recurring-cost and operational approval:

- daily backup scheduling;
- durable state and alerting when no independently attested valid snapshot
  exists within 24 hours;
- paging for failure, retention mismatch, checksum mismatch, key failure,
  orphan growth, or cost-ceiling refusal;
- at least one independently attested scheduled run;
- monthly isolated restore;
- quarterly identity, retention, key-custody, provider-contract, and cost
  review.

## Cost safety

Every live runner must require an unexpired authorization containing:

- provider/account/region/bucket;
- currency and maximum incremental cost;
- maximum source and destination bytes;
- maximum object and API request counts;
- maximum egress and retrieval bytes;
- maximum KMS/secret operations;
- retention period;
- maximum retained orphan bytes and storage-days;
- lifecycle deletion lag of at least one additional daily copy;
- pricing source and estimate timestamp.

The runner must refuse before provider I/O when the worst-case plan exceeds
the authorization and refuse the next billable operation when measured plus
worst-case remaining cost would exceed it. Provider alerts are additional
signals, not enforcement.

## Rollback

Before Compliance retention:

- stop future writes;
- revoke temporary identities;
- abort exact multipart upload IDs;
- delete exact mutable trial versions and verify deletion;
- record every unresolved object and its expiry/cost;
- delete disposable restore resources by exact provider ID.

After Compliance retention:

- retained versions cannot be removed early;
- disable future writes and allow accepted versions to expire under the
  approved policy;
- preserve the encrypted completion, abort, and orphan evidence until its
  associated versions are confirmed lifecycle-deleted;
- never represent inability to delete a locked object as successful cleanup.

## Closure rule

One successful manual drill proves one recovery event. `R-051` closes only
after a complete independent set restores successfully, a scheduled daily run
is independently attested, failures page the owner, and the monthly restore
process meets the four-hour RTO.
