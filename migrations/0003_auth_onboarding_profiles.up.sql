ALTER TABLE auth_users
  ADD COLUMN email_verified_at timestamptz,
  ADD COLUMN last_login_at timestamptz;

INSERT INTO trades (code, name, category, sort_order) VALUES
  ('excavation', 'Excavation', 'Civil', 260),
  ('fencing', 'Fencing', 'Exterior', 270),
  ('gutters', 'Gutters', 'Exterior', 280),
  ('windows_doors', 'Windows and Doors', 'Exterior', 290),
  ('driveways_pavers', 'Driveways and Pavers', 'Civil', 300),
  ('pool_spa', 'Pool and Spa', 'Systems', 310),
  ('security_systems', 'Security Systems', 'Systems', 320)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  active = true,
  updated_at = now();

UPDATE auth_users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE provider = 'google';

ALTER TABLE auth_sessions
  ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN user_agent_hash text,
  ADD COLUMN ip_hash text,
  ADD COLUMN device_label text NOT NULL DEFAULT 'Unknown device';

CREATE INDEX auth_sessions_active_user_idx
  ON auth_sessions (user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_verification_tokens_account_idx
  ON email_verification_tokens (account_id, created_at DESC);

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_tokens_account_idx
  ON password_reset_tokens (account_id, created_at DESC);

CREATE TABLE oauth_transactions (
  state_hash text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('google')),
  code_verifier text NOT NULL,
  nonce text NOT NULL,
  redirect_path text NOT NULL DEFAULT '/',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oauth_transactions_expiry_idx ON oauth_transactions (expires_at);

CREATE TABLE signup_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  email_hash text,
  allowed_role text CHECK (allowed_role IN ('contractor', 'tradesperson')),
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by_account_id uuid REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX signup_invites_active_idx
  ON signup_invites (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE profiles
  ADD COLUMN service_area_city text NOT NULL DEFAULT '',
  ADD COLUMN service_area_region text NOT NULL DEFAULT '',
  ADD COLUMN country_code text NOT NULL DEFAULT 'US',
  ADD COLUMN service_radius_miles integer NOT NULL DEFAULT 25
    CHECK (service_radius_miles BETWEEN 1 AND 250),
  ADD COLUMN availability_status text NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'limited', 'unavailable')),
  ADD COLUMN contact_email_visibility text NOT NULL DEFAULT 'private'
    CHECK (contact_email_visibility IN ('private', 'connections')),
  ADD COLUMN phone_e164 text,
  ADD COLUMN phone_visibility text NOT NULL DEFAULT 'private'
    CHECK (phone_visibility IN ('private', 'connections')),
  ADD COLUMN avatar_upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL;

UPDATE accounts a
SET status = 'onboarding', updated_at = now()
FROM profiles p
WHERE p.account_id = a.id AND p.onboarding_status = 'draft' AND a.status = 'active';

CREATE OR REPLACE FUNCTION bridge_auth_user_to_account() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO accounts (id, status, primary_role, created_at, updated_at)
  VALUES (
    NEW.id,
    'onboarding',
    CASE WHEN NEW.role IN ('pending', 'contractor', 'tradesperson') THEN NEW.role ELSE 'pending' END,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_identities (
    account_id, provider, provider_subject, subject_kind, email, email_hash, created_at, updated_at
  )
  VALUES (
    NEW.id,
    CASE WHEN NEW.provider IN ('email', 'google', 'facebook', 'apple') THEN NEW.provider ELSE 'email' END,
    NEW.email_hash,
    'legacy_email_hash',
    NEW.email,
    NEW.email_hash,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (account_id, provider) DO NOTHING;

  INSERT INTO profiles (
    account_id, display_name, location_text, visibility, onboarding_status, created_at, updated_at
  )
  VALUES (NEW.id, NEW.display_name, NEW.location, 'private', 'draft', NEW.created_at, NEW.updated_at)
  ON CONFLICT (account_id) DO NOTHING;

  RETURN NEW;
END;
$$;
