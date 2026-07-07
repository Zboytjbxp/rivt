# RIVT Database URLs

RIVT uses two different database URL concepts. They should not be treated as interchangeable.

## `DATABASE_URL`

`DATABASE_URL` is the app runtime database connection string. In Railway production it points at the private Railway network host (`postgres.railway.internal`). That is correct for the deployed API, but it will not resolve from a local laptop.

Do not commit this value and do not paste it into chat.

## `DATABASE_PUBLIC_URL`

`DATABASE_PUBLIC_URL` belongs to the Railway Postgres service. It is the production database URL that local live-smoke scripts can reach from this workstation.

Use the wrapper instead of copying the secret by hand:

```powershell
npm run with:railway-public-db -- npm run smoke:projects:live
npm run with:railway-public-db -- npm run smoke:gate-a:live
```

The wrapper calls the Railway CLI, reads `DATABASE_PUBLIC_URL` from the `Postgres` service, injects it into the child process as `DATABASE_URL`, and does not print the secret.

For project/media smokes that upload a temporary object and need to clean it up, opt into the app service's S3 variables:

```powershell
$env:RIVT_RAILWAY_INCLUDE_STORAGE="true"
npm run with:railway-public-db -- npm run smoke:projects:live
Remove-Item Env:\RIVT_RAILWAY_INCLUDE_STORAGE
```

That still does not print secrets. It only injects the S3 variables needed by the smoke cleanup path.

If Railway is not authenticated locally, run:

```powershell
railway login
railway link
```

Then confirm the linked project is `RIVT` and the environment is `production`:

```powershell
railway status
```

## `TEST_DATABASE_URL`

`TEST_DATABASE_URL` is the isolated test database used by local integration tests. It belongs in ignored local `.env`, not in the repo.

Local integration tests load `.env` automatically:

```powershell
npm run test:integration
```

If you use an extra worktree, copy the ignored `.env` into that worktree before running integration tests.

## Why Codex Mentions This

When a test or live-smoke needs database access, Codex checks for a reachable URL. If `DATABASE_URL` is blank or points at Railway's internal host, local database scripts cannot run. The wrapper above removes the manual step for production live-smokes; the ignored `.env` keeps the local test database available without committing secrets.
