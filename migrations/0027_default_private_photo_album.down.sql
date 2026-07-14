DROP INDEX IF EXISTS photo_albums_one_default_per_account_idx;

ALTER TABLE photo_albums
  DROP COLUMN IF EXISTS is_default;
