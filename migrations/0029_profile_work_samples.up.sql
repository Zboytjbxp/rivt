CREATE TABLE profile_work_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  album_photo_id uuid NOT NULL REFERENCES album_photos(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 120),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 500),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, album_photo_id),
  UNIQUE (account_id, sort_order)
);

CREATE INDEX profile_work_samples_account_idx
  ON profile_work_samples (account_id, sort_order, created_at);
