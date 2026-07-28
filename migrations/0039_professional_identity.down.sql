DROP TABLE IF EXISTS professional_profile_events;
DROP TABLE IF EXISTS profile_portfolio_items;
DROP TABLE IF EXISTS profile_availability_windows;
DROP TABLE IF EXISTS profile_credentials;

UPDATE profiles
SET avatar_upload_id = NULL
WHERE avatar_upload_id IN (
  SELECT id FROM uploads WHERE storage_scope = 'professional-profile'
);

UPDATE uploads
SET storage_scope = 'legacy',
    upload_status = 'removed'
WHERE storage_scope = 'professional-profile';

ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN ('legacy', 'project', 'album', 'shop-talk', 'document-brand'));
