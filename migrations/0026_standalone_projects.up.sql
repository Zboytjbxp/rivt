CREATE TABLE standalone_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  client_name text NOT NULL DEFAULT '' CHECK (char_length(client_name) <= 160),
  location_text text NOT NULL DEFAULT '' CHECK (char_length(location_text) <= 240),
  trade_code text NOT NULL DEFAULT '' CHECK (char_length(trade_code) <= 80),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX standalone_projects_account_updated_idx
  ON standalone_projects (account_id, status, updated_at DESC, id DESC);

ALTER TABLE tool_records
  ADD COLUMN standalone_project_id uuid REFERENCES standalone_projects(id) ON DELETE SET NULL,
  ADD COLUMN active_work_id uuid REFERENCES active_work(id) ON DELETE SET NULL,
  ADD CONSTRAINT tool_records_single_context_check
    CHECK (standalone_project_id IS NULL OR active_work_id IS NULL);

CREATE INDEX tool_records_standalone_project_idx
  ON tool_records (standalone_project_id, updated_at DESC, id DESC)
  WHERE standalone_project_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX tool_records_active_work_idx
  ON tool_records (active_work_id, updated_at DESC, id DESC)
  WHERE active_work_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE photo_albums
  ADD COLUMN standalone_project_id uuid REFERENCES standalone_projects(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX photo_albums_standalone_project_idx
  ON photo_albums (standalone_project_id)
  WHERE standalone_project_id IS NOT NULL;

ALTER TABLE tool_records DROP CONSTRAINT tool_records_record_type_check;
ALTER TABLE tool_records ADD CONSTRAINT tool_records_record_type_check CHECK (
  record_type IN (
    'payment_record',
    'invoice_template',
    'invoice_draft',
    'estimate',
    'expense',
    'mileage',
    'time_session',
    'bid',
    'price_book',
    'punch_item',
    'daily_report',
    'safety_check',
    'job_checklist',
    'client'
  )
);
