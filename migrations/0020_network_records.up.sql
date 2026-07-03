CREATE TABLE network_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (
    record_type IN (
      'crew_member',
      'crew_invite',
      'network_review'
    )
  ),
  local_id text NOT NULL CHECK (char_length(local_id) BETWEEN 1 AND 120 AND local_id ~ '^[A-Za-z0-9:_-]+$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'active' CHECK (char_length(status) BETWEEN 1 AND 40),
  record_date date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX network_records_account_type_local_active_idx
  ON network_records (account_id, record_type, local_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_records_account_type_updated_idx
  ON network_records (account_id, record_type, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX network_records_account_updated_idx
  ON network_records (account_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;
