# Object-Storage Audit Hardening Context

This directory is a derived design review. It is not an implementation record,
not a migration, and not proof that object access is now audited. The source
root inspected for this review was:

`C:\Users\zboyt\Documents\Trade-Work\.worktrees\credential-rotation-hotfix`

The source revision was
`04360c6dd469908ec0c1e8245d9910163630e72f`. The incident document and the
working tree had moved beyond that revision while this analysis was prepared.
The inventory below records the exact bytes reviewed. Unrelated structured-log
redaction changes in the working tree were not used as evidence for the
object-storage design.

## Evidence identity

- Collection label: RIVT object-storage incident and source evidence
- Collection SHA-256:
  `c3842eeb2a8212fe99cfaa3b4a1813b4e2fcbfaf6569cc85c82d516b444a5da1`
- Artifact count: 13
- Source drift: present
- Integrity method: SHA-256 of each file; collection digest is SHA-256 of the
  newline-delimited, path-sorted `<file-sha256><two spaces><path>` manifest with
  a trailing newline.

## Evidence inventory

| ID | Reader-facing title | Kind | Repository-relative path | SHA-256 |
| --- | --- | --- | --- | --- |
| `E01` | Credential-exposure incident and forensic limits | Incident document | `docs/operations/incidents/2026-07-29-production-credential-exposure.md` | `592230371b0851ee88092d568e96abfa51ea1308bd9c6b8ddb3da1882e607791` |
| `E02` | Legacy upload schema and object identifiers | Source | `migrations/0001_legacy_baseline.up.sql` | `328934d9f5f374dac0278208a68f0bfb7b33f2e738f36a107db9c8dfd655159d` |
| `E03` | Existing append-only application audit ledger | Source | `migrations/0002_domain_foundation.up.sql` | `1c09a9b84530f60289be078e7601f92a1a06ae0023f95b44d049acbcb9ab8f34` |
| `E04` | Append-only audit-ledger regression coverage | Test | `test/migrations.integration.test.js` | `1172e8de73334ea470bc7728f06e5bcb7df82ecca6ee841ef9f72f0134f645b9` |
| `E05` | Shared S3 client, signed-link helper, and project media routes | Source | `server/index.js` | `83b77b9f8b41860e8594020a725328f02b84c80a453bb34da79e15d24305ac32` |
| `E06` | Album photo object writes and link issuance | Source | `server/albums.js` | `03479f4fe68fb306613d86bbe7f1c01ef98c9968bc9fe5672c32c541708a7682` |
| `E07` | Shop Talk media object writes and link issuance | Source | `server/shop-talk.js` | `9bd99690d2d105ece14f8b8d449ff695879de5ccbb912057ce77221898fd8959` |
| `E08` | Anonymous public Shop Talk image links | Source | `server/public-discovery.js` | `2ed8574438f2f5b41cadde7fcd52f1c88280b4431f74c03aa09a11ebd5af00b2` |
| `E09` | Profile, credential, portfolio, and avatar objects | Source | `server/professional-profile.js` | `88bc135d9a7a468c3f78f9d55b9c8806ac261873e01e4fb05b0e988e599556f6` |
| `E10` | Document-logo object read, write, and delete paths | Source | `server/document-brand.js` | `b7668395e6d0268f5f1c6b3167bc3e1ecabb7df65c860ac679b23c91fd8d9264` |
| `E11` | Invoice and estimate delivery caller | Source | `server/tool-records.js` | `8706c143fb07396555544c85e3d4f9caa6ef6597cb8194b0211e5580274a1fe5` |
| `E12` | Message and contact-note attachment objects | Source | `server/messaging-continuity.js` | `f4fff56591dd5e9f5bd1078b51b7959e7350a1b4b8ae079d4a875ff441315549` |
| `E13` | Legacy upload object routes | Source | `server/legacy-integrations.js` | `68a20a6c3092287725d0250363f7c60303e94a769c8dbe1d9162ecc1fcd9fde0` |

## Observed facts

- `E01` records that Railway Buckets do not give this project historical
  per-object access logs, versioning, or object locks, and that stable object
  counts cannot prove an object was never read.
- `E03` creates `audit_events` with request, actor, organization, action,
  subject, timestamp, and JSON metadata fields. A database trigger rejects
  updates and deletes.
- `E04` exercises the append-only trigger.
- `E05` owns the S3 client and a shared signed-link helper, but direct SDK
  commands are also used by `E06`, `E07`, `E09`, `E10`, `E12`, and `E13`.
- `E08` issues signed links for anonymous public discovery. The resulting
  browser fetch goes directly to object storage and does not return through the
  RIVT server.
- `E05` maps legacy upload rows with the raw object key and an optional public
  URL. Whether `S3_PUBLIC_BASE_URL` is unset and the production bucket is
  private is a runtime question, not proven by source.
- `E10` contains the normal server-side object read used for document delivery,
  and `E11` invokes that delivery path.

## Inferences used by the proposal

- Object-operation audit ownership is dispersed across route modules. Adding
  isolated audit statements can improve today's routes but cannot make future
  direct SDK callers structurally impossible.
- A single gateway can bind an application actor and stored-object identifier
  to every app-originated S3 operation while reusing the existing audit ledger.
- Application logging can prove that RIVT issued a signed link; it cannot prove
  that the recipient downloaded the object or observe direct provider-console,
  leaked-credential, backup-script, or other out-of-band access.
- Provider or external immutable logging is the only option in this portfolio
  that can materially improve evidence for out-of-band storage access. Its
  exact availability, retention, privacy behavior, and price have not been
  verified and must be reviewed before any provider change.

## Limits

- This is source and incident-evidence analysis, not a penetration test or
  performance benchmark.
- No provider configuration, bucket policy, environment value, production log,
  or billing plan was changed or inspected by this work.
- No exact provider-logging cost is claimed.
- No migration or source change described in the proposal has been applied.
- The current incident evidence does not support a claim of no access or no
  exfiltration.
