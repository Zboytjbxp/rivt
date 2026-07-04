# Codex Handoff: Shop Talk Reddit-Model Architecture Review

**Status:** Pending Codex critique before implementation  
**User Direction:** "I don't want shop talk being local only... like carpentry, Jacksonville, for example, and then they can talk to locals through that or whatever."

## What's Been Done

Claude completed a comprehensive audit of the RIVT app (master @ d134a11) and created three new product/delivery documents on branch `claude/audit` (commit 2e61be4):

1. **docs/product/UI_POLISH_BUILD_PROMPT.md** — 4-phase UI/UX cleanup (launch blockers → credibility → subtraction → hardening)
2. **docs/product/GATE_B_C_ROADMAP.md** — Jacksonville public launch (Gate B) and expansion platform (Gate C)
3. **docs/product/SHOP_TALK_REDDIT_MODEL_BUILD_PROMPT.md** — Complete Reddit-style community model for Shop Talk

All committed and pushed to `origin/claude/audit`.

## What We Need From You: Critique Before Implementation

**File:** `docs/product/SHOP_TALK_REDDIT_MODEL_BUILD_PROMPT.md`

Review this 180-line architecture spec and provide critique on:

1. **Schema design** (Part 1)
   - `communities.created_by_account_id` + `archived_at`
   - `community_members.role` (member/moderator/owner)
   - `shop_talk_posts.community_id` with NOT NULL after backfill
   - New `shop_talk_answers` table with `verified_fix` constraint (max 1 per post)
   - Removal of fabricated member counts from seeded communities

2. **API contract** (Part 2)
   - Dedupe-first community creation (search → confirm before creating)
   - 1 new community per account per day rate limit
   - Community join/leave ownership checks
   - Answer CRUD endpoints (GET/POST/PATCH/DELETE)
   - Server-enforced Verified Fix gate (not client-only)
   - Moderation report pathway

3. **Frontend contract** (Part 3)
   - Community creation flow behind dedupe-first UX
   - Composer picks community (default = current page or last-used)
   - Community pages with real member/post counts
   - Answers wired to server (delete dead localStorage subsystem)

4. **Fragmentation guardrails** (Part 4)
   - 1/day creation limit
   - Minimum account age if available
   - Discovery ranked by recent activity (not member count)
   - Admin merge/archive for duplicates

5. **Risk & scope alignment**
   - All work behind existing `GATE_A_SCOPE` Shop Talk feature flag
   - Closes risk R-024 (Shop Talk reputation must be server-backed)
   - Removal of fabricated data (violates contract rule, R-003 related)
   - Integration tests + live smoke to Packet standard

6. **Any red flags:** schema conflicts, deployment risks, missing pieces, scope creep, or better approaches?

## After Critique

Once you approve the spec (flagging any necessary changes), plan your implementation:

- **Branch:** `codex/shop-talk-reddit-model`
- **Scope:** Migrations (Part 1) + API (Part 2) + Frontend wiring (Part 3)
- **Feature flag:** Keep everything behind existing Shop Talk flag until Gate B
- **Evidence standard:** Packet-level integration tests + live smoke (see RISKS.md R-024)
- **Handoff:** Point to pushed commit with branch/SHA/verified/boundary per AI_COLLABORATION_WORKFLOW.md

## Context

- **Product contract:** "Where skilled trades connect" — pilot proof-of-concept for Jacksonville
- **User feedback:** Shop Talk must support user-created communities (not just seeded read-only), server-owned conversations (not device-local), and allow strangers to find each other via topics they care about
- **Risk register:** R-024 flags Shop Talk social actions being local-only; this work makes reputation server-backed and enforceable
- **Longest-lead item:** Shop Talk answers schema is the critical path for Gate B — build this first

## Questions for Your Critique

1. Do you want to build migrations, API, and frontend in one branch, or split?
2. Should dedupe-first search live on the frontend or backend (or both)?
3. Verified Fix: should it be strictly one per post, or allow transfer/override by mods?
4. Member count maintenance: transactional update on join/leave, or compute on read?
5. Any deployment edge cases (e.g., backfill of 0-count communities to real count)?

---

**Ready to build?** Provide your critique + any adjustments, then kick off on `codex/shop-talk-reddit-model`.
