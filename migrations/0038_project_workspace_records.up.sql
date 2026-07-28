CREATE TABLE project_workspace_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  record_type text NOT NULL
    CHECK (record_type IN ('checklist', 'milestone', 'change_order', 'note')),
  visibility text NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('shared', 'private')),
  title text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  requested_by text NOT NULL DEFAULT '',
  amount_cents bigint NOT NULL DEFAULT 0,
  due_note text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'open'
    CHECK (state IN ('open', 'done', 'pending', 'paid', 'overdue', 'approved', 'rejected', 'active')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_account_id uuid NOT NULL REFERENCES accounts(id),
  updated_by_account_id uuid NOT NULL REFERENCES accounts(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (visibility = 'shared' OR record_type = 'note'),
  CHECK (
    (record_type = 'checklist' AND state IN ('open', 'done'))
    OR (record_type = 'milestone' AND state IN ('pending', 'paid', 'overdue'))
    OR (record_type = 'change_order' AND state IN ('pending', 'approved', 'rejected'))
    OR (record_type = 'note' AND state = 'active')
  )
);

CREATE INDEX project_workspace_records_project_idx
  ON project_workspace_records (project_id, record_type, archived_at, created_at DESC, id DESC);
CREATE INDEX project_workspace_records_private_idx
  ON project_workspace_records (created_by_account_id, project_id, created_at DESC, id DESC)
  WHERE visibility = 'private' AND archived_at IS NULL;

CREATE TABLE project_workspace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES project_workspace_records(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL
    CHECK (event_type IN ('created', 'updated', 'state_changed', 'archived')),
  prior_version integer,
  next_version integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_workspace_events_project_idx
  ON project_workspace_events (project_id, created_at DESC, id DESC);
CREATE INDEX project_workspace_events_record_idx
  ON project_workspace_events (record_id, created_at DESC, id DESC);

CREATE TRIGGER project_workspace_events_no_update
  BEFORE UPDATE OR DELETE ON project_workspace_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
