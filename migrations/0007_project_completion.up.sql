CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_work_id uuid NOT NULL UNIQUE REFERENCES active_work(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  contractor_account_id uuid NOT NULL REFERENCES accounts(id),
  tradesperson_account_id uuid NOT NULL REFERENCES accounts(id),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completion_submitted', 'confirmed', 'disputed')),
  created_by_account_id uuid NOT NULL REFERENCES accounts(id),
  completion_submitted_at timestamptz,
  confirmed_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contractor_account_id <> tradesperson_account_id)
);

CREATE INDEX projects_contractor_idx
  ON projects (contractor_account_id, status, updated_at DESC, id DESC);
CREATE INDEX projects_tradesperson_idx
  ON projects (tradesperson_account_id, status, updated_at DESC, id DESC);
CREATE INDEX projects_organization_idx
  ON projects (organization_id, status, updated_at DESC, id DESC);

ALTER TABLE uploads
  ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN active_work_id uuid REFERENCES active_work(id) ON DELETE SET NULL,
  ADD COLUMN upload_status text NOT NULL DEFAULT 'stored'
    CHECK (upload_status IN ('pending', 'stored', 'failed', 'rejected', 'removed')),
  ADD COLUMN content_sha256 text,
  ADD COLUMN storage_scope text NOT NULL DEFAULT 'legacy'
    CHECK (storage_scope IN ('legacy', 'project')),
  ADD COLUMN failure_reason text NOT NULL DEFAULT '',
  ADD COLUMN verified_at timestamptz;

CREATE INDEX uploads_account_idx
  ON uploads (account_id, created_at DESC, id DESC)
  WHERE account_id IS NOT NULL;
CREATE INDEX uploads_active_work_idx
  ON uploads (active_work_id, created_at DESC, id DESC)
  WHERE active_work_id IS NOT NULL;
CREATE INDEX uploads_project_content_hash_idx
  ON uploads (content_sha256)
  WHERE storage_scope = 'project' AND content_sha256 IS NOT NULL;
CREATE INDEX uploads_project_status_idx
  ON uploads (storage_scope, upload_status, created_at DESC, id DESC);

CREATE TABLE project_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  entry_type text NOT NULL
    CHECK (entry_type IN ('note', 'media', 'completion_submitted', 'completion_confirmed', 'completion_disputed', 'system')),
  body text NOT NULL DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_entries_project_idx
  ON project_entries (project_id, created_at DESC, id DESC);
CREATE INDEX project_entries_actor_idx
  ON project_entries (actor_account_id, created_at DESC, id DESC);

CREATE TRIGGER project_entries_no_update
  BEFORE UPDATE OR DELETE ON project_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE project_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES project_entries(id) ON DELETE SET NULL,
  upload_id uuid NOT NULL UNIQUE REFERENCES uploads(id) ON DELETE RESTRICT,
  uploader_account_id uuid NOT NULL REFERENCES accounts(id),
  original_name text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  content_sha256 text NOT NULL,
  media_kind text NOT NULL DEFAULT 'photo'
    CHECK (media_kind IN ('photo', 'document', 'other')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'stored', 'failed', 'rejected', 'removed')),
  review_status text NOT NULL DEFAULT 'not_scanned'
    CHECK (review_status IN ('not_scanned', 'accepted', 'rejected')),
  failure_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_media_project_idx
  ON project_media (project_id, created_at DESC, id DESC);
CREATE INDEX project_media_uploader_idx
  ON project_media (uploader_account_id, created_at DESC, id DESC);
CREATE INDEX project_media_content_hash_idx
  ON project_media (project_id, content_sha256, uploader_account_id);

CREATE TABLE project_completion_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submitted_by_account_id uuid NOT NULL REFERENCES accounts(id),
  note text NOT NULL,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_media_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'confirmed', 'disputed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX project_completion_project_idx
  ON project_completion_submissions (project_id, submitted_at DESC, id DESC);
CREATE INDEX project_completion_submitter_idx
  ON project_completion_submissions (submitted_by_account_id, submitted_at DESC, id DESC);

CREATE TABLE project_completion_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES project_completion_submissions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  decision text NOT NULL CHECK (decision IN ('confirmed', 'disputed')),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_completion_resolutions_project_idx
  ON project_completion_resolutions (project_id, created_at DESC, id DESC);
CREATE INDEX project_completion_resolutions_actor_idx
  ON project_completion_resolutions (actor_account_id, created_at DESC, id DESC);

CREATE TRIGGER project_completion_resolutions_no_update
  BEFORE UPDATE OR DELETE ON project_completion_resolutions
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
