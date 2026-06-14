# App Production Readiness

This build is configured for managed storage only. Local browser backup, JSON app-state files, and local upload fallback are intentionally disabled for customer safety.

Set `APP_NAME` and `APP_SLUG` when the final brand is chosen. The current defaults are `RIVT` and `rivt`.

Each browser gets an HTTP-only `{APP_SLUG}_session` cookie. App state, event logs, payment export data, and uploads are scoped to that session so early testers do not share one global record. Full account-based ownership should replace this once Google/Apple/email auth and identity checks are connected.

## Local Development

```bash
npm install
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- API health: `http://127.0.0.1:8787/api/health`
- Storage readiness: `http://127.0.0.1:8787/api/storage`

Without `DATABASE_URL` and S3-compatible storage variables, the API returns setup-required responses instead of saving locally.

## Required Storage

App records use PostgreSQL:

```bash
APP_NAME=RIVT
APP_SLUG=rivt
DATABASE_URL=
```

The server creates these tables automatically on startup:

- `app_state`
- `app_events`
- `uploads`

`app_state.id` stores the session id for the current beta build. `app_events.session_id` and `uploads.session_id` keep logs and files scoped to the same session.

Uploads use private S3-compatible object storage and signed download URLs:

```bash
S3_BUCKET=
S3_REGION=
S3_ENDPOINT=
S3_PUBLIC_BASE_URL=
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_SIGNED_URL_SECONDS=900
MAX_UPLOAD_MB=10
```

Use AWS S3, Cloudflare R2, Supabase Storage S3 compatibility, or another S3-compatible provider. For private files, leave `S3_PUBLIC_BASE_URL` blank and use the signed URLs returned by the API.

## Railway Setup

The repo includes `railway.json` for a single Railway web service:

- Build command: `npm run build`
- Start command: `npm start`
- Process healthcheck: `/`

The process healthcheck only proves the site is online. Customer readiness is still controlled by `/api/health` and `/api/storage`.

1. Create a Railway project for the web app.
2. Add a Railway PostgreSQL service.
3. Set `DATABASE_URL` on the web service from the PostgreSQL service variables.
4. Add S3-compatible storage credentials from AWS S3, Cloudflare R2, Supabase Storage, or another managed provider.
5. Deploy with:

```bash
npm run build
npm start
```

Do not use Railway volumes for customer records or customer-uploaded files in this app.

## What Railway Still Needs

Before the app can return healthy for real users, the web service environment must include:

```bash
DATABASE_URL=
S3_BUCKET=
S3_REGION=
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

Recommended storage behavior:

- Use a managed PostgreSQL instance in Railway for `DATABASE_URL`.
- Use private object storage for uploads and signed URLs.
- Leave `S3_PUBLIC_BASE_URL` blank unless your storage provider requires a public asset URL.
- Keep `S3_FORCE_PATH_STYLE=false` unless your S3 provider documents path-style access.

## Production Run

```bash
npm run build
npm start
```

The Express server serves the built frontend from `dist/` and exposes the `/api/*` routes.

## Provider Accounts Needed Before Real Customers

- Managed PostgreSQL connection string
- S3-compatible object storage bucket and access keys
- Stripe subscription billing keys
- Persona, Stripe Identity, or iDenfy identity verification keys
- Resend or SendGrid email keys
- Twilio SMS keys if phone verification/notifications are required. Prefer `TWILIO_MESSAGING_SERVICE_SID` for production SMS delivery, with `TWILIO_PHONE_NUMBER` as a fallback during setup.

## Current API Surface

- `GET /api/health`
- `GET /api/storage`
- `GET /api/app-state`
- `PUT /api/app-state`
- `POST /api/events`
- `GET /api/payments/export.csv`
- `GET /api/uploads`
- `POST /api/uploads`
- `GET /api/uploads/:id/url`
- `POST /api/identity/verify`
- `POST /api/subscriptions/checkout`
- `POST /api/notifications/test`

## First-User Gate

Do not invite first users until:

- `/api/health` returns `ok: true`.
- `/api/storage` returns `ok: true`.
- A test job can be posted, refreshed, and still appear.
- A test file upload returns a signed URL.
- Stripe, identity, and notification provider endpoints no longer return setup-required responses.
