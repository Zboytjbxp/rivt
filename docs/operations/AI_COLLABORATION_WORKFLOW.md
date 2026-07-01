# AI Collaboration Workflow

Use this workflow whenever Codex and Claude both touch the RIVT repository.

The goal is simple:

- keep authorship honest
- avoid unpushed local-only work
- avoid one AI rewriting another AI's history
- make `master` deploys traceable

## Default Rules

1. `master` is the deploy branch.
2. Default work happens on AI-specific branches, not directly on `master`.
3. One branch has one owner.
4. Only the branch owner may amend, squash, rebase, or force-push that branch.
5. No one rewrites already-public `master` history unless Michael explicitly asks for it.

## Branch Naming

Use explicit branch prefixes:

- `codex/<topic>`
- `claude/<topic>`

Examples:

- `codex/shop-talk-read-path`
- `claude/paywall-redesign`
- `codex/tools-fraction-calculator`

For urgent deploys, direct work on `master` is allowed only if all three are true:

- the change is small and clearly scoped
- the owner intends to deploy immediately
- the owner accepts that authorship will belong to whoever makes that commit

## Ownership Rules

Branch ownership is strict:

- Codex owns `codex/*`
- Claude owns `claude/*`
- whoever creates a direct `master` commit owns that commit

If one AI needs to continue another AI's work:

- do not amend the earlier AI's commit
- do not re-author the earlier AI's commit
- create a new commit on top
- if needed, create a new branch from the latest shared tip and continue there

Good:

- Claude builds on top of `codex/shop-talk-read-path` with a new Claude commit
- Codex fixes a bug on top of a Claude commit with a new Codex commit

Bad:

- Claude amends a Codex commit to change authorship
- Codex rebases away Claude's already-pushed public commits

## Start-of-Session Checklist

Before either AI starts work:

1. `git fetch origin`
2. confirm current branch with `git branch --show-current`
3. confirm sync state with `git branch -vv`
4. confirm working tree with `git status --short`
5. branch from current `origin/master` unless intentionally continuing another branch

If the tree is dirty and the changes are not yours:

- stop and identify whether they are user work, Codex work, or Claude work
- do not clean them up automatically

## Commit Rules

Every meaningful change should end in a real commit before handoff.

Do not hand off important work as "verified locally" while it only exists in the working tree.

Commit message style:

- short imperative subject
- describe the feature or fix, not the tool

Examples:

- `Wire Shop Talk frontend to server-owned posts and communities`
- `Fix mobile invoice preview overflow`
- `Add Stripe paywall upgrade modal`

## Verification Before Push

Before pushing a branch or `master`, run:

```text
npm run build
npm run lint
npm run test
npm run test:e2e
npm audit --omit=dev
```

If a command is intentionally skipped, say so explicitly in the handoff.

## Push and Merge Rules

Preferred path:

1. AI works on its own branch
2. AI pushes that branch
3. other AI or Michael reviews from that branch
4. branch is merged to `master`
5. Railway deploys from `master`

Avoid GitHub squash merges when mixed AI authorship matters.

Preferred merge styles:

- fast-forward
- merge commit
- rebase-and-merge only when it preserves correct authorship and the branch owner performs it

Use squash only when:

- one AI owns the whole branch
- that same AI performs the squash
- the branch is not already relied on as a public authored history record

## Handoff Format

When one AI hands work to the other, include:

1. branch name
2. latest commit SHA
3. whether the commit is pushed
4. whether it is deployed
5. exact commands that passed
6. any known boundaries or intentionally deferred work

Minimum handoff example:

```text
Branch: codex/shop-talk-read-path
Commit: abc1234
Pushed: yes
Deployed: no
Verified: build, lint, test, test:e2e, audit
Boundary: replies remain local-only; server-backed posts and communities are wired
```

## Production Deploy Rules

After merge or direct push to `master`:

1. confirm `git rev-parse HEAD`
2. verify production build commit via `https://rivt.pro/api/health`
3. run `npm run monitor:production`
4. if the change affects authenticated workflows, run an authenticated live smoke or an equivalent targeted proof
5. record the result in:
   - `docs/delivery/BUILD_STATE.md`
   - `docs/product/REQUIREMENTS_TRACEABILITY.md`
   - `docs/delivery/DEPLOYMENT_LEDGER.md` when it is a real deployment event

Important distinction:

- pushed is not deployed
- deployed backend is not proof the frontend bundle changed
- production proof should reference the live build commit, not assumptions

## What To Never Do

Never:

- amend another AI's commit to change authorship
- force-push public `master` to clean up attribution
- claim local working-tree changes are live
- present fallback/demo data as canonical production behavior
- ask one AI to "fix" another AI's authorship by rewriting already-public history

## Recommended RIVT Default

For this repo, use this default:

- Codex does implementation and deploy verification on `codex/*` or small approved `master` hotfixes
- Claude does review, critique, planning, and feature work on `claude/*`
- all non-trivial Claude work should start from fresh `origin/master`
- all handoffs must point to a pushed commit, not just local files

If Michael wants one AI to finish the other's work fast, the safe rule is:

- continue forward with a new commit
- never rewrite backward
