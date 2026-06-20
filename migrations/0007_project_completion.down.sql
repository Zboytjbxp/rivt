DROP TABLE IF EXISTS project_completion_resolutions;
DROP TABLE IF EXISTS project_completion_submissions;
DROP TABLE IF EXISTS project_media;
DROP TABLE IF EXISTS project_entries;

DROP INDEX IF EXISTS uploads_project_status_idx;
DROP INDEX IF EXISTS uploads_project_content_hash_idx;
DROP INDEX IF EXISTS uploads_active_work_idx;
DROP INDEX IF EXISTS uploads_account_idx;

ALTER TABLE uploads
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS failure_reason,
  DROP COLUMN IF EXISTS storage_scope,
  DROP COLUMN IF EXISTS content_sha256,
  DROP COLUMN IF EXISTS upload_status,
  DROP COLUMN IF EXISTS active_work_id,
  DROP COLUMN IF EXISTS account_id;

DROP TABLE IF EXISTS projects;
