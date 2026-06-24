ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN ('legacy', 'project'));

UPDATE uploads SET storage_scope = 'project' WHERE storage_scope = 'album';
