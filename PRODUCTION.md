# App Production Readiness

This build is configured for managed storage only. Local browser backup, JSON app-state files, and local upload fallback are intentionally disabled for customer safety.

Set `APP_NAME` and `APP_SLUG` when the final brand is chosen. The current defaults are `RIVT` and `rivt`.

Each authenticated device gets a rotating HTTP-only `{APP_SLUG}_session` cookie with a bounded lifetime. Sessions belong to a canonical account, can be inspected and revoked, and are invalidated after password recovery. Browser state is not an authority for role, onboarding, profile visibility, or account capabilities.

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

Versioned migrations create and update the account, profile, audit, and legacy-bridge tables on startup. Check status before release:

```bash
npm run migrate:status
```

Legacy compatibility tables still include:

- `app_state`
- `app_events`
- `uploads`

`app_state.id`, `app_events.session_id`, and `uploads.session_id` now use the authenticated account ID. New domain packets must use canonical account and organization foreign keys rather than browser-generated ownership.

## Authentication and Email

Email signup is disabled unless transactional delivery is configured truthfully:

```bash
APP_ORIGIN=https://rivt.pro
SESSION_MAX_AGE_MS=2592000000
AUTH_METADATA_PEPPER=<long-random-secret>
REQUIRE_PILOT_INVITE=true
RESEND_API_KEY=
EMAIL_FROM=RIVT <support@rivt.pro>
EMAIL_DELIVERY_MODE=resend
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://rivt.pro/api/auth/google/callback
```

Verify `rivt.pro` with the email provider before inviting users. Never use capture delivery in production. Generate invitation codes from an authorized operations terminal with `npm run invite:create -- --email=user@example.com --role=contractor`; only the one-time raw code is printed.

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

- `GET /api/v1/me`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/email/verify`
- `POST /api/v1/auth/email/resend`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/reset`
- `POST /api/v1/onboarding/complete`
- `PATCH /api/v1/profile`
- `POST /api/v1/profile/publish`
- `POST /api/v1/profile/unpublish`
- `PUT /api/v1/profile/avatar`
- `GET /api/v1/sessions`
- `DELETE /api/v1/sessions/:id`
- `POST /api/v1/sessions/revoke-others`

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
- Email signup sends a verification message from the verified RIVT domain.
- A verification link is single-use and unlocks onboarding, not work access by itself.
- Google sign-in completes with the production redirect URI and creates no fabricated role, company, or location.
- Password reset revokes every existing device session.
- Contractor and tradesperson test accounts complete role-correct onboarding and remain correct after relogin.
- A test job can be posted, refreshed, and still appear.
- A test file upload returns a signed URL.
- Stripe, identity, and notification provider endpoints no longer return setup-required responses.
