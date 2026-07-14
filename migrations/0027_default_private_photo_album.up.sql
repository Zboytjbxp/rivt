ALTER TABLE photo_albums
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS photo_albums_one_default_per_account_idx
  ON photo_albums (account_id)
  WHERE is_default;

INSERT INTO photo_albums (account_id, name, is_default)
SELECT id, 'Private photos', true
FROM accounts
ON CONFLICT (account_id) WHERE is_default DO NOTHING;
