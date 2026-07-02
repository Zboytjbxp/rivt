# Codex build prompt — Shop Talk true Reddit model

**Please review and critique this plan before building.** Flag Gate-A risk,
schema decisions you'd make differently, and anything mis-scoped. Then build on
a `codex/*` branch with the Packet-level evidence standard (integration tests +
live smoke), and hand back per AI_COLLABORATION_WORKFLOW.md.

## Product intent (founder direction — do not water down)

Shop Talk is a Reddit-style trades community. **Users create their own
communities** — "Jacksonville Carpentry", "North FL Tile Setters", whatever they
want — and talk to locals and their trade inside them. Every post lives in a
community. Conversations (answers/replies) are durable and server-owned. The
current implementation is a Reddit *skin*: fixed seeded community list, posts
tagged by trade string with no community linkage, answers that never leave the
device. Close that gap.

## Verified current state (master @ cc2f944)

- `communities` (migration 0016): id/slug/name/description/member_count. No
  `created_by`, no roles, no creation endpoint. **Seeded rows carry fabricated
  member counts (124000, 98000, …) in production** — violates the no-fake-
  activity contract rule and must be fixed in this work.
- `community_members`: (community_id, account_id, joined_at). No role column.
- `shop_talk_posts` (0015): has `trade` text; **no `community_id`**. Community
  feeds currently scope by trade-name matching in the client.
- Reactions: server-owned with immutable event ledger (0010/0011), keyed
  strings (`post:<id>`, `answer:<postId>:<answerId>`).
- **No answers table.** Answer/reply UI state is device-local only; a dead
  client-side reply subsystem persists drafts to localStorage (flagged for
  deletion in UI_POLISH_BUILD_PROMPT Phase 3.2 — coordinate, don't collide).
- Shop Talk is feature-flagged out of Gate A pilot navigation (GATE_A_SCOPE);
  public exposure is Gate B. This work builds behind that flag.

## Guardrails

- Nothing here weakens Gate A auth/trust/moderation/production safety.
- All writes authenticated + ownership-checked server-side; same idempotency,
  typed-error, audit-event, and migration standards as Packets 03–07.
- No fake data: fabricated member counts are removed, not rebranded.
- Deferral rule stands: hidden behind the existing flag until Gate B — no
  "coming soon" surfaces in pilot nav.

---

## Part 1 — Schema (new migrations, versioned, with down-migrations)

**1a. Community ownership + roles**
- `communities`: add `created_by_account_id uuid NULL REFERENCES accounts(id)`
  (NULL = platform-seeded), `archived_at timestamptz NULL`.
- `community_members`: add `role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('member','moderator','owner'))`.
- **Honesty migration:** reset seeded `member_count` values to the real count
  of `community_members` rows (effectively ~0 today). Keep `member_count`
  maintained transactionally on join/leave (or compute on read — your call;
  state the tradeoff in your critique).

**1b. Posts belong to communities**
- `shop_talk_posts`: add `community_id uuid REFERENCES communities(id)`.
- Backfill existing posts by mapping `trade` → the matching seeded trade
  community (Electrical → electrical-talk, etc.; unmatched → a designated
  general community). Then enforce `NOT NULL`.
- Keep `trade` as a denormalized filter field; index `(community_id,
  created_at DESC, id DESC)`.

**1c. Answers (the conversation layer)**
- New `shop_talk_answers`: `id uuid PK`, `post_id FK ON DELETE CASCADE`,
  `author_account_id FK`, `author_name`, `body` (length-checked),
  `verified_fix boolean NOT NULL DEFAULT false`, `created_at`, `updated_at`,
  soft-delete (`deleted_at` or status) so moderation can hide without losing
  the audit trail. Indexes: `(post_id, created_at)`, author index.
- Constraint: at most one `verified_fix = true` per post (partial unique
  index).

## Part 2 — API (server-owned, authenticated)

**Communities**
- `POST /api/v1/communities` — create. Validation: name/description lengths
  (existing checks), slug auto-generated + normalized from name, reserved-slug
  list (admin, rivt, api, mod, …), profanity screen consistent with existing
  moderation posture. Creator becomes `owner` and auto-joins.
  **Rate limit: 1 community per account per day** (durable limiter,
  migration-0009 style). Audit event on create.
- **Dedupe-first create:** the create call should return near-matches
  (trigram/ILIKE on name+slug) so the client can prompt "Jacksonville Trades
  already exists — join instead?" before committing. Creation proceeds only on
  explicit confirm.
- `PATCH /api/v1/communities/:slug` — owner/moderator edits description;
  archive (owner or platform admin). Archived = read-only, hidden from
  discovery, not deleted.
- Existing join/leave endpoints gain role awareness (owner can't leave while
  sole owner — transfer or archive first).

**Answers**
- `GET /api/v1/shop-talk/posts/:id/answers`
- `POST /api/v1/shop-talk/posts/:id/answers` — authenticated, idempotent,
  length-checked, rate-limited.
- `PATCH .../answers/:answerId` — author edit window; soft-delete by author or
  moderator.
- `POST .../answers/:answerId/verified-fix` — **post author only, enforced
  server-side** (the client-only gate was flagged in the d134a11 audit;
  the server is the real fix). Clearing it: post author or moderator.
- Answer reactions ride the existing reaction ledger (`answer:<postId>:<id>`),
  one reaction per actor per target enforced server-side (closes the R-024
  precondition).

**Posts**
- `POST /api/v1/shop-talk/posts` now requires a `community_id` the author has
  access to post in (member-or-anyone posture: default = any authenticated
  user may post in any non-archived community; members-only can come later).
- `GET /api/v1/shop-talk/posts?community=<slug>` — real scoped feed.

**Moderation hooks (minimum viable for user-created spaces)**
- Report-community pathway reusing the existing report machinery.
- Moderator actions on posts/answers within their community: hide (soft),
  lock post. Platform admin retains override. Full mod-queue UX is Gate B
  scope (GATE_B_C_ROADMAP B1.3) — build the data hooks now, not the console.

## Part 3 — Frontend (behind the existing Shop Talk flag)

- **Create-community flow:** entry point in the community directory
  ("Can't find your community? Start it"). Search-first UX: typing shows
  existing matches to join; create only after the dedupe prompt. Name +
  optional description; slug shown, auto-generated.
- **Composer picks a community** (default: the community page you're on, else
  last-used/primary-trade community). Posting from a community page posts
  there.
- **Community pages** scope by `community_id` (drop trade-name matching),
  show real member/post counts (correctly pluralized — coordinate with polish
  2.3), owner/moderator affordances (edit description, archive).
- **Answers wired to server:** thread view reads/writes
  `shop_talk_answers`; Verified Fix control renders only for the post author
  and calls the server endpoint. Delete the dead localStorage reply subsystem
  as part of this (coordinates with polish Phase 3.2 — one of you does it,
  not both).
- Guest mode: read-only; all writes gated by the existing signup prompt.
- Fallback/demo content stays clearly separated per the established rule
  (no prompt/demo posts for authed users when the server returns empty).

## Part 4 — Fragmentation guardrails (product, cheap, do now)

A tiny user base spread across 50 empty communities is worse than 8 alive ones.
Reddit gates creation with account age/karma; our equivalents:
- Dedupe-first create (above) — the main defense.
- 1/day/account creation limit + minimum account age if trivially available.
- Discovery ranks by recent activity, not raw member_count, so live rooms
  surface and dead ones sink.
- Empty-community state prompts the creator with a first-post nudge and a
  share action ("invite your crew"), not boilerplate.
- Platform admin can archive/merge duplicates (merge = repoint posts'
  community_id + redirect slug; can be admin-script-only initially, but the
  data model must not preclude it).

## Acceptance criteria

- A user can create "Jacksonville Carpentry", it appears in discovery, another
  user can find it, join it, post in it, get an answer, and the post author
  can mark the Verified Fix — all server-persisted, visible from a second
  device/account.
- Non-authors receive 403 on verified-fix attempts (server-enforced, tested).
- One reaction per actor per post/answer enforced server-side.
- No fabricated member counts anywhere; counts reflect real rows.
- Every post has a community; community feeds scope by community_id.
- Duplicate-name creation shows the join-instead prompt before creating.
- Creation rate limit works (integration-tested), audit events recorded.
- Pilot nav unchanged (still behind the flag); nothing new exposed in Gate A.
- Migration up/down tested in CI; migration-count assertions updated.

## Verification

- Integration tests to the Packet standard: cross-user authorization (edit/
  delete/verify boundaries), idempotency, rate limits, dedupe, backfill
  correctness, one-verified-fix-per-post constraint.
- Live smoke (flagged env): create → discover → join → post → answer →
  verified-fix → react → moderate-hide → archive, with cleanup.
- `npm run build/lint/test:unit/test:e2e` + `npm audit --omit=dev`; note the
  local integration-suite timeout caveat explicitly if hit; verify via CI.
- Handoff block: Branch / Commit / Pushed / Deployed / Verified / Boundary.

## Explicit non-goals (this pass)

- Public exposure (Gate B), full moderation console (Gate B), members-only/
  private communities, community avatars/theming, cross-posting, community
  rules pages, karma systems, threaded reply nesting deeper than one level
  (answers are flat replies to the post; nesting is a later decision).
