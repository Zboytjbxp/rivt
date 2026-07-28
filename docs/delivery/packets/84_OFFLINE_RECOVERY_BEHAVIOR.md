# Packet 84 — Offline recovery behavior

## Objective

Make RIVT preserve field work through a lost or stalled connection without
claiming that every product action works offline.

## Acceptance boundary

- A previously authenticated device can reopen a limited cached workspace
  while the browser is explicitly offline. The cache is account-scoped,
  cleared by explicit sign-out, and never substitutes for a server session
  while the browser reports a connection.
- New punch-list items and job notes can be saved to an account-scoped device
  outbox. Their original idempotency key is retained from the first attempt
  through replay so an ambiguous timeout cannot create a duplicate.
- Daily-log drafts remain immediately available on the device and can queue a
  coalesced account sync. Repeated saves replace the pending snapshot instead
  of producing a backlog of stale drafts.
- Accepted-work and private-album photo files can be retained in IndexedDB and
  replayed with their original destination, caption, filename, MIME type, and
  idempotency key.
- Every pending operation has one honest state: queued, syncing, failed, or
  conflicted. Users can retry or discard failed work; a conflict never
  overwrites the server silently.
- The outbox replays only for the owning account, runs on authenticated app
  start and browser `online`, and uses bounded exponential retry.
- Milestones, change orders, state transitions, approvals, archive/restore,
  completion, reviews, messages, Shop Talk/publication, estimate/invoice send,
  payment links, payments, refunds, and disputes remain online-only.
- Calculator tape measurements remain intentionally on this device. RIVT does
  not relabel them as account-synced records.

## Storage and authorization

- No server migration is required. IndexedDB contains only user-entered
  pending payloads and cached field-session projections already available to
  the signed-in account.
- Every outbox row carries the canonical account ID and is filtered before
  display or replay. Cookies remain the server authorization boundary.
- Explicit sign-out clears cached account/work projections. Unsynced outbox
  rows remain account-scoped for recovery by that same account and cannot be
  replayed by a different account.
- Photo queue limits are enforced by count, individual file size, total byte
  size, and age so the browser cannot become an unbounded file store.

## Recovery and rollback

- Retriable network, timeout, rate-limit, and 5xx failures remain queued with
  bounded backoff.
- Authentication and validation failures become failed items requiring user
  action. HTTP 409 becomes conflicted and must be reviewed rather than
  overwritten.
- A successful 2xx replay removes only that exact outbox row.
- Application rollback leaves IndexedDB rows intact. A later compatible build
  can resume them; unsupported rows remain visible as failed rather than being
  deleted.

## Required evidence

- Unit coverage for retry classification, backoff, coalescing, account
  isolation, limits, and expiry.
- Rendered offline/online coverage proving a daily log and field record queue,
  survive reload, replay once, and show honest state.
- Rendered photo coverage proving a Blob survives reload and uploads to the
  original destination once.
- Build, lint, full test aggregate, E2E, dependency audit, focused rendered
  suites, exact-source production health, and production monitor.

## Three-things review

Before advancing, explicitly review:

1. account switching and sign-out with unsynced private work;
2. ambiguous timeouts after a server commit and idempotent replay;
3. storage exhaustion, stale queued photos, and user-controlled cleanup.

## Implementation evidence

- The account-scoped outbox is implemented in `src/lib/offline-queue.ts` and
  surfaced through `OfflineQueueProvider` plus the global recovery panel.
- Work punch-list/note creates, Daily Log upserts, accepted-work photos, and
  private-album photos retain their first idempotency key through replay.
- The production service worker atomically precaches the entry shell and
  required fonts; a partial install cannot delete the previous good cache.
- Browser E2E proves cached offline reopen, account isolation, sign-out cache
  clearing, and outbox retention. Rendered Work/Tools tests prove forced
  failure, reload survival where applicable, idempotent retry, and one final
  canonical result.

## Three-things review result

1. **Account switching and sign-out:** provider state and IndexedDB reads are
   filtered by canonical account ID. Sign-out removes the cached session but
   retains unsynced outbox work for the same account's later recovery. A
   different account cannot see or replay it.
2. **Ambiguous timeout after commit:** every supported write creates its
   idempotency key before the first network attempt and stores that same key
   with the device payload. Work, Daily Log, and photo smokes assert equality
   between the failed attempt and successful replay.
3. **Storage exhaustion and age:** photos are bounded to 25, 10 MB each, and
   100 MB per account. At 30 days they become visible failed rows rather than
   disappearing. Native quota denial produces actionable copy, and every row
   has an explicit discard action.

Packet status: **Local verification complete; production deployment pending**.
