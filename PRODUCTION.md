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

### Storage ownership and cost (what bills you)

Media uploads (photos, documents, project evidence) are **never stored in the browser**. They are uploaded to the backend-managed S3-compatible object store and only metadata is written to PostgreSQL (`uploads`, `project_media`).

Your bill for this is controlled by your object-storage provider account:

- **Primary provider in this deployment:** Railway Object Storage (private bucket, S3-compatible API).
- **Where it is charged:** The provider’s storage and bandwidth usage on your account.
- **What does not bill per user in the app code:** upload size is aggregated under the platform bucket, not charged per user account by the application.

Current app behavior:

- `/api/v1/projects/:id/media` saves objects with a `PutObject` write and returns metadata rows.
- `/api/v1/projects/:id/media/:mediaId/url` returns short-lived signed URLs for access.
- `/api/storage` returns account usage and upload counts sourced from metadata.

Per-user quota defaults are controlled by environment:

```bash
ACCOUNT_STORAGE_GB_LIMIT=
STORAGE_GB_LIMIT=
```

If neither is set, `Plan quota` in settings shows `Quota tied to plan`.

Set `ACCOUNT_STORAGE_GB_LIMIT` when you are ready to enforce an account hard cap.

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

Production sender verification was completed on 2026-06-19. The Resend API key is sending-only and restricted to `rivt.pro`; the verified sender remains `RIVT <support@rivt.pro>`. Keep the existing Google Workspace root MX record intact. Resend uses only the `send.rivt.pro` return-path MX/SPF records.

If `EMAIL_DELIVERY_MODE=resend` and either `RESEND_API_KEY` or `EMAIL_FROM` is missing, signup and password recovery must fail closed with `EMAIL_PROVIDER_UNAVAILABLE` / provider setup-required status. Do not bypass verification, return raw verification tokens, or switch to capture delivery for production users.

## Billing Entitlements

Do not unlock paid features from frontend-only state. RIVT Pro access is granted only by the server-owned `billing_entitlements` table after Stripe checkout and webhook verification. The frontend calls `/api/v1/billing/checkout`, Stripe redirects the user to hosted Checkout, and `/api/stripe/webhook` updates the entitlement from signed Stripe events.

```bash
STRIPE_SECRET_KEY=
STRIPE_PRO_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUCCESS_URL=https://rivt.pro/app/profile/settings?billing=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://rivt.pro/app/profile/settings?billing=cancelled
STRIPE_PORTAL_RETURN_URL=https://rivt.pro/app/profile/settings
VITE_ALLOW_LOCAL_PRO=false
```

Stripe setup required before charging:

1. Create the RIVT Pro product and recurring price in Stripe.
2. Set the price ID as `STRIPE_PRO_PRICE_ID` on the Railway web service.
3. Add a Stripe webhook endpoint at `https://rivt.pro/api/stripe/webhook`.
4. Subscribe the endpoint to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
5. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Enable Stripe Customer Portal and confirm `STRIPE_PORTAL_RETURN_URL` points back to the RIVT account settings screen.

After the variables are saved and the Railway web service is redeployed, run the live billing smoke from an operator terminal. Keep the credentials in the process environment only; do not commit them or paste them into docs:

```bash
RIVT_SMOKE_EMAIL=<testing-account-email> RIVT_SMOKE_PASSWORD=<testing-account-password> npm run smoke:billing:live
RIVT_SMOKE_EMAIL=<testing-account-email> RIVT_SMOKE_PASSWORD=<testing-account-password> RIVT_BILLING_EXERCISE_REDIRECTS=true npm run smoke:billing:live
```

The first command verifies authenticated billing status and that unsigned Stripe webhook payloads are rejected by signature verification rather than setup failure. The second command also creates Stripe-hosted Checkout and Customer Portal sessions without entering a card or charging the account. Do not consider billing launch-ready until one real paid checkout has completed and the signed Stripe webhook updates the server-owned entitlement.

`VITE_ALLOW_LOCAL_PRO=true` is local-development only and must not be set on the production Railway service. If Stripe keys, the Pro price, or webhook signing are missing, paid tools must fail closed with truthful setup copy rather than simulated success.

Uploads use private S3-compatible object storage and signed download URLs. RIVT production currently targets Railway Object Storage, which exposes an S3-compatible endpoint (`https://t3.storageapi.dev` in Railway's current storage service). Cloudflare R2, AWS S3, Backblaze B2, Supabase Storage S3 compatibility, or another managed S3-compatible provider can be used only if the same private-bucket and signed-URL behavior is preserved.

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

For Railway Object Storage, copy the bucket name, endpoint, access key, and secret key from the Railway storage service into the web service variables. Keep `S3_REGION=auto` when Railway reports `auto`, keep `S3_FORCE_PATH_STYLE=false` unless the provider explicitly requires path-style requests, and leave `S3_PUBLIC_BASE_URL` blank for private customer files. The API intentionally fails closed with `503 OBJECT_STORAGE_UNAVAILABLE` / setup-required health output when object storage is missing; there is no local upload fallback.

## Railway Setup

The repo includes `railway.json` for a single Railway web service:

- Build command: `npm run build`
- Start command: `npm start`
- Process healthcheck: `/`

The process healthcheck only proves the site is online. Customer readiness is still controlled by `/api/health` and `/api/storage`.

1. Create a Railway project for the web app.
2. Add a Railway PostgreSQL service.
3. Set `DATABASE_URL` on the web service from the PostgreSQL service variables.
4. Add private S3-compatible object storage. For the current RIVT setup, use Railway Object Storage and add its S3 variables to the web service: `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_FORCE_PATH_STYLE`.
5. Deploy with:

```bash
npm run build
npm start
```

Do not use Railway volumes for customer records or customer-uploaded files in this app.

## Railway Managed Storage

The production service is configured with the following managed dependencies. Keep these variables present during every deploy:

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
- Use Railway Object Storage, or an equivalent private S3-compatible bucket, for uploads and signed URLs.
- Leave `S3_PUBLIC_BASE_URL` blank unless your storage provider requires a public asset URL.
- Keep `S3_FORCE_PATH_STYLE=false` unless your S3 provider documents path-style access.
- Treat `/api/health` or `/api/storage` reporting missing S3 values as a launch blocker. Profile avatar and project media endpoints must return setup-required/503 responses rather than writing locally.

Do not copy secret values into this document, source control, build logs, or support tickets.

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
- `GET /api/v1/billing/status`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/portal`
- `POST /api/stripe/webhook`

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
- `POST /api/subscriptions/checkout` (retired legacy compatibility route; must not grant entitlements)
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
- Stripe billing status reports configured provider keys, a test Checkout Session can be created, the Stripe webhook can update `billing_entitlements`, and Customer Portal opens for an active subscription.
- Identity and notification provider endpoints no longer return setup-required responses, or they are explicitly deferred from the soft-beta launch scope in writing.
