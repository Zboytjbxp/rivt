# Packet 01 Production Inventory

Observed: 2026-06-18 America/New_York  
Environment: RIVT production PostgreSQL  
Method: read-only transaction through Railway's public database endpoint  
PII handling: no emails, names, message text, job text, object keys, or payload values were emitted

## Row Inventory

| Table | Rows | Classification |
|---|---:|---|
| `auth_users` | 2 | Real authenticated accounts; both Google contractor accounts |
| `auth_sessions` | 3 | Active sessions belonging to authenticated accounts |
| `app_state` | 114 | Legacy prototype blobs; none owned by an authenticated account |
| `app_events` | 53 | Generic activity events across 20 legacy/current session IDs |
| `uploads` | 1 | 35-byte text object; not owned by a current authenticated session |
| `guest_sessions` | 0 | Empty legacy table |

No marked Codex smoke accounts remained after production verification.

## Legacy State Classification

- All 114 `app_state.id` values are UUID-shaped.
- Zero `app_state.id` values match either authenticated account UUID.
- 113 blobs contain the broad prototype state shape, including jobs, applications, community posts, messages, uploads, controls, and UI state.
- The blobs contain 296 job entries across 71 rows, 3 application entries, 279 community entries, 2 sent-message entries, no payment entries, and 233 upload-record entries.
- Repeated whole-state fingerprints and the lack of authenticated ownership show that these are browser/prototype snapshots, not trustworthy canonical marketplace records.
- Two generic activity events currently link to active authenticated sessions. Events are not sufficiently typed or attributable to migrate as domain audit history.

## Migration Decision

1. Do not convert any legacy state job, person, application, message, community, payment, or upload entry into a canonical public record.
2. Preserve legacy tables read-only while each domain slice is replaced.
3. Bridge only the two authenticated users into canonical `accounts`, `auth_identities`, and private draft `profiles` using the same account UUID.
4. Do not infer or auto-create organizations from free-form legacy company names.
5. Keep the unowned object and metadata quarantined pending an explicit retention/deletion decision.
6. Record reconciliation counts before and after every production migration.

## Production Safety Boundary

Packet 01 may add schema and private account bridges. It must not publish profiles, jobs, messages, reviews, community posts, or media from legacy state. Any later migration that attempts to promote a legacy row requires a separate reviewed mapping and user confirmation path.
