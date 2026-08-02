# Production synthetic source binding

The scheduled production monitor must compare the revision reported by
`https://rivt.pro/api/health` with a trusted statement of what production is
supposed to serve. The repository's current commit is not that statement:
production can legitimately lag the default branch, and a commit cannot safely
contain its own future hash.

The `Production Synthetic Check` job therefore uses the protected GitHub
Environment named `production` and reads its environment variable
`RIVT_PRODUCTION_SOURCE_COMMIT` as `EXPECTED_SOURCE_COMMIT`.

## One-time rollout

1. Independently read the exact full source commit from production
   `/api/health` after confirming that deployment is the intended release.
2. In the GitHub `production` Environment, set
   `RIVT_PRODUCTION_SOURCE_COMMIT` to that exact 40-character commit.
3. Run the workflow manually once and confirm its sanitized artifact records
   identical `expectedBuildCommit` and `buildCommit` values.

The `production` Environment must allow this scheduled read-only monitor to
start without a manual deployment approval. If that Environment intentionally
requires reviewers, move only the monitor variable and job to a dedicated
administrator-controlled monitoring Environment; do not weaken deployment
approval rules merely to make the monitor run.

No provider variable is created or changed by this source patch. Until the
protected variable exists and contains a valid full commit, the monitor fails
with `INVALID_CONFIGURATION` before contacting production. That failure is
intentional and must not be bypassed.

## Every later deployment

After a reviewed deployment finishes, independently confirm the new live
revision through `/api/health`, then update the protected environment variable
to that exact value. Never set it to the workflow checkout SHA merely because
that commit is newest, and never update it before production is verified.
