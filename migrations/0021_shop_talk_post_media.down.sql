DROP INDEX IF EXISTS shop_talk_post_media_uploader_idx;
DROP INDEX IF EXISTS shop_talk_post_media_upload_idx;
DROP INDEX IF EXISTS shop_talk_post_media_post_idx;

DROP TABLE IF EXISTS shop_talk_post_media;

ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

UPDATE uploads SET storage_scope = 'legacy' WHERE storage_scope = 'shop-talk';

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN ('legacy', 'project', 'album'));
