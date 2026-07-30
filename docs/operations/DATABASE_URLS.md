# RIVT Database URLs

RIVT uses two different database URL concepts. They should not be treated as interchangeable.

## `DATABASE_URL`

`DATABASE_URL` is the app runtime database connection string. In Railway production it points at the private Railway network host (`postgres.railway.internal`). That is correct for the deployed API, but it will not resolve from a local laptop.

Do not commit this value and do not paste it into chat.

## `DATABASE_PUBLIC_URL`

`DATABASE_PUBLIC_URL` belongs to the Railway Postgres service. It is the production database URL that local live-smoke scripts can reach from this workstation.

For a local production smoke, copy only the named `DATABASE_PUBLIC_URL` value from the Railway
Postgres service into the current terminal session. Do not list, export, or snapshot the service's
whole environment:

```powershell
$env:DATABASE_PUBLIC_URL="<copy only DATABASE_PUBLIC_URL from Railway>"
npm run with:railway-public-db -- npm run smoke:projects:live
npm run with:railway-public-db -- npm run smoke:gate-a:live
Remove-Item Env:\DATABASE_PUBLIC_URL
```

The wrapper validates the temporary value, passes it to only the child process as `DATABASE_URL`,
and removes the public-url aliases from that child's environment. It does not call the Railway CLI
or enumerate any service variables.

For project/media smokes that upload a temporary object and need to clean it up, opt into the app service's S3 variables:

```powershell
$env:DATABASE_PUBLIC_URL="<copy only DATABASE_PUBLIC_URL from Railway>"
$env:S3_BUCKET="<copy only S3_BUCKET from Railway>"
$env:S3_REGION="<copy only S3_REGION from Railway>"
$env:S3_ENDPOINT="<copy only S3_ENDPOINT from Railway>"
$env:S3_ACCESS_KEY_ID="<copy only S3_ACCESS_KEY_ID from Railway>"
$env:S3_SECRET_ACCESS_KEY="<copy only S3_SECRET_ACCESS_KEY from Railway>"
$env:RIVT_RAILWAY_INCLUDE_STORAGE="true"
npm run with:railway-public-db -- npm run smoke:projects:live
Remove-Item Env:\DATABASE_PUBLIC_URL, Env:\S3_BUCKET, Env:\S3_REGION, Env:\S3_ENDPOINT
Remove-Item Env:\S3_ACCESS_KEY_ID, Env:\S3_SECRET_ACCESS_KEY, Env:\RIVT_RAILWAY_INCLUDE_STORAGE
```

Only the named S3 variables are passed when `RIVT_RAILWAY_INCLUDE_STORAGE=true`. The wrapper strips
them from ordinary database-only smoke processes. Clear every temporary value immediately after
the command, including after a failed run.

## `TEST_DATABASE_URL`

`TEST_DATABASE_URL` is the isolated test database used by local integration tests. It belongs in ignored local `.env`, not in the repo.

Local integration tests load `.env` automatically:

```powershell
npm run test:integration
```

If you use an extra worktree, copy the ignored `.env` into that worktree before running integration tests.

## Why Codex Mentions This

When a test or live-smoke needs database access, Codex checks for a reachable URL. If `DATABASE_URL`
is blank or points at Railway's internal host, local database scripts cannot run. The wrapper
limits the production value to the one child process; the ignored `.env` keeps the local test
database available without committing secrets.
