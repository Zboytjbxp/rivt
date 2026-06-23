CREATE TABLE IF NOT EXISTS photo_albums (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 140),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photo_albums_account_idx ON photo_albums (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS album_photos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id   UUID        NOT NULL REFERENCES photo_albums(id) ON DELETE CASCADE,
  upload_id  UUID        NOT NULL REFERENCES uploads(id),
  caption    TEXT        NOT NULL DEFAULT '' CHECK (char_length(caption) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS album_photos_album_idx ON album_photos (album_id, created_at DESC);
