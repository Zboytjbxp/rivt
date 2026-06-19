CREATE TABLE IF NOT EXISTS app_state (
  id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_events (
  id uuid PRIMARY KEY,
  session_id text,
  type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_events_created_at_idx ON app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS app_events_session_id_idx ON app_events (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS uploads (
  id uuid PRIMARY KEY,
  session_id text,
  kind text NOT NULL,
  name text NOT NULL,
  job_id bigint,
  notes text NOT NULL DEFAULT '',
  object_key text,
  original_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uploads_created_at_idx ON uploads (created_at DESC);
CREATE INDEX IF NOT EXISTS uploads_job_id_idx ON uploads (job_id);
CREATE INDEX IF NOT EXISTS uploads_session_id_idx ON uploads (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  email_hash text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  provider text NOT NULL DEFAULT 'email',
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'contractor',
  organization text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS guest_sessions (
  guest_id text PRIMARY KEY,
  session_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS guest_sessions_session_token_idx ON guest_sessions (session_token);
CREATE INDEX IF NOT EXISTS guest_sessions_expires_at_idx ON guest_sessions (expires_at);
