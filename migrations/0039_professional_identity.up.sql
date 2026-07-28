ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN ('legacy', 'project', 'album', 'shop-talk', 'document-brand', 'professional-profile'));

CREATE TABLE profile_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('license', 'certification', 'training', 'insurance', 'other')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  issuer text NOT NULL DEFAULT '' CHECK (char_length(issuer) <= 160),
  credential_number text NOT NULL DEFAULT '' CHECK (char_length(credential_number) <= 120),
  issue_date date,
  expiry_date date,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  evidence_upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL,
  evidence_state text NOT NULL DEFAULT 'self_reported'
    CHECK (evidence_state IN ('self_reported', 'evidence_on_file')),
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'network')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date),
  CHECK (
    (evidence_state = 'self_reported' AND evidence_upload_id IS NULL)
    OR (evidence_state = 'evidence_on_file' AND evidence_upload_id IS NOT NULL)
  )
);

CREATE INDEX profile_credentials_account_idx
  ON profile_credentials (account_id, status, updated_at DESC);
CREATE INDEX profile_credentials_network_idx
  ON profile_credentials (account_id, updated_at DESC)
  WHERE status = 'active' AND visibility = 'network';

CREATE TABLE profile_availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  availability text NOT NULL
    CHECK (availability IN ('available', 'limited', 'unavailable')),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  visibility text NOT NULL DEFAULT 'network'
    CHECK (visibility IN ('private', 'network')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  CHECK (ends_on <= starts_on + 366)
);

CREATE INDEX profile_availability_windows_account_idx
  ON profile_availability_windows (account_id, status, starts_on, ends_on);
CREATE INDEX profile_availability_windows_network_idx
  ON profile_availability_windows (account_id, starts_on, ends_on)
  WHERE status = 'active' AND visibility = 'network';

CREATE TABLE profile_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1500),
  trade_code text REFERENCES trades(code),
  project_label text NOT NULL DEFAULT '' CHECK (char_length(project_label) <= 160),
  service_area_city text NOT NULL DEFAULT '' CHECK (char_length(service_area_city) <= 100),
  service_area_region text NOT NULL DEFAULT '' CHECK (char_length(service_area_region) <= 100),
  completed_on date,
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'network')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, upload_id)
);

CREATE INDEX profile_portfolio_items_account_idx
  ON profile_portfolio_items (account_id, status, sort_order, updated_at DESC);
CREATE INDEX profile_portfolio_items_network_idx
  ON profile_portfolio_items (account_id, sort_order, updated_at DESC)
  WHERE status = 'active' AND visibility = 'network';

CREATE TABLE professional_profile_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  subject_type text NOT NULL
    CHECK (subject_type IN ('credential', 'availability_window', 'portfolio_item', 'avatar')),
  subject_id text NOT NULL CHECK (char_length(subject_id) BETWEEN 1 AND 120),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  from_version integer,
  to_version integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX professional_profile_events_account_idx
  ON professional_profile_events (account_id, created_at DESC, id DESC);
CREATE INDEX professional_profile_events_subject_idx
  ON professional_profile_events (subject_type, subject_id, created_at, id);
