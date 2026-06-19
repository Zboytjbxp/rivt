CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('onboarding', 'active', 'suspended', 'closed')),
  primary_role text NOT NULL CHECK (primary_role IN ('pending', 'contractor', 'tradesperson')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('email', 'google', 'facebook', 'apple')),
  provider_subject text NOT NULL,
  subject_kind text NOT NULL DEFAULT 'provider_subject'
    CHECK (subject_kind IN ('provider_subject', 'legacy_email_hash')),
  email text,
  email_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject),
  UNIQUE (account_id, provider)
);

CREATE TABLE profiles (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  location_text text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'network')),
  onboarding_status text NOT NULL DEFAULT 'draft' CHECK (onboarding_status IN ('draft', 'complete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_by_account_id uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  membership_role text NOT NULL CHECK (membership_role IN ('owner', 'admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, account_id)
);

CREATE INDEX organization_memberships_account_idx
  ON organization_memberships (account_id, status);

CREATE TABLE trades (
  code text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_trades (
  account_id uuid NOT NULL REFERENCES profiles(account_id) ON DELETE CASCADE,
  trade_code text NOT NULL REFERENCES trades(code),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, trade_code)
);

CREATE UNIQUE INDEX profile_trades_one_primary_idx
  ON profile_trades (account_id) WHERE is_primary;

CREATE TABLE consent_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  document_key text NOT NULL,
  document_version text NOT NULL,
  context text NOT NULL CHECK (context IN ('signup', 'profile', 'job_post', 'application', 'offer_acceptance')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (account_id, document_key, document_version, context)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid,
  actor_account_id uuid REFERENCES accounts(id),
  organization_id uuid REFERENCES organizations(id),
  action text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_events_actor_idx ON audit_events (actor_account_id, occurred_at DESC);
CREATE INDEX audit_events_subject_idx ON audit_events (subject_type, subject_id, occurred_at DESC);

CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  scope text NOT NULL,
  key_hash text NOT NULL,
  request_hash text NOT NULL,
  state text NOT NULL DEFAULT 'started' CHECK (state IN ('started', 'completed', 'failed')),
  response_status integer,
  response_body jsonb,
  locked_until timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, scope, key_hash)
);

CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys (expires_at);

INSERT INTO trades (code, name, category, sort_order) VALUES
  ('electrical', 'Electrical', 'MEP', 10),
  ('plumbing', 'Plumbing', 'MEP', 20),
  ('hvac', 'HVAC', 'MEP', 30),
  ('carpentry', 'Carpentry', 'Woodwork', 40),
  ('framing', 'Framing', 'Woodwork', 50),
  ('cabinetry', 'Cabinetry', 'Woodwork', 60),
  ('welding', 'Welding', 'Metalwork', 70),
  ('roofing', 'Roofing', 'Exterior', 80),
  ('siding', 'Siding', 'Exterior', 90),
  ('painting_finishing', 'Painting and Finishing', 'Finishes', 100),
  ('flooring', 'Flooring', 'Finishes', 110),
  ('tile', 'Tile', 'Finishes', 120),
  ('drywall', 'Drywall', 'Finishes', 130),
  ('insulation', 'Insulation', 'Building Envelope', 140),
  ('concrete_masonry', 'Concrete and Masonry', 'Structural', 150),
  ('sitework', 'Sitework', 'Civil', 160),
  ('landscaping', 'Landscaping', 'Site', 170),
  ('equipment_operator', 'Equipment Operator', 'Site', 180),
  ('low_voltage', 'Low Voltage', 'Systems', 190),
  ('fire_protection', 'Fire Protection', 'Systems', 200),
  ('solar', 'Solar', 'Energy', 210),
  ('glazing', 'Glazing', 'Exterior', 220),
  ('demolition', 'Demolition', 'Site', 230),
  ('general_labor', 'General Labor', 'General', 240),
  ('other', 'Other Skilled Trade', 'General', 250);

INSERT INTO accounts (id, status, primary_role, created_at, updated_at)
SELECT id,
       CASE WHEN role = 'pending' THEN 'onboarding' ELSE 'active' END,
       CASE WHEN role IN ('pending', 'contractor', 'tradesperson') THEN role ELSE 'pending' END,
       created_at,
       updated_at
FROM auth_users;

INSERT INTO auth_identities (
  account_id, provider, provider_subject, subject_kind, email, email_hash, created_at, updated_at
)
SELECT id,
       CASE WHEN provider IN ('email', 'google', 'facebook', 'apple') THEN provider ELSE 'email' END,
       email_hash,
       'legacy_email_hash',
       email,
       email_hash,
       created_at,
       updated_at
FROM auth_users;

INSERT INTO profiles (
  account_id, display_name, location_text, visibility, onboarding_status, created_at, updated_at
)
SELECT id, display_name, location, 'private', 'draft', created_at, updated_at
FROM auth_users;

CREATE FUNCTION bridge_auth_user_to_account() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO accounts (id, status, primary_role, created_at, updated_at)
  VALUES (
    NEW.id,
    CASE WHEN NEW.role = 'pending' THEN 'onboarding' ELSE 'active' END,
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

CREATE TRIGGER auth_users_account_bridge_insert
  AFTER INSERT ON auth_users
  FOR EACH ROW EXECUTE FUNCTION bridge_auth_user_to_account();
