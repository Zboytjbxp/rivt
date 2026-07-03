ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN ('legacy', 'project', 'album', 'shop-talk'));

CREATE TABLE shop_talk_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES shop_talk_posts(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL UNIQUE REFERENCES uploads(id) ON DELETE RESTRICT,
  uploader_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  original_name text NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 240),
  mime_type text NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 120),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  content_sha256 text NOT NULL CHECK (char_length(content_sha256) = 64),
  media_kind text NOT NULL DEFAULT 'photo' CHECK (media_kind IN ('photo')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'rejected')),
  review_status text NOT NULL DEFAULT 'not_scanned' CHECK (review_status IN ('not_scanned', 'accepted', 'rejected')),
  failure_reason text NOT NULL DEFAULT '',
  alt_text text NOT NULL DEFAULT '' CHECK (char_length(alt_text) <= 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shop_talk_post_media_post_idx
  ON shop_talk_post_media (post_id, created_at ASC, id ASC)
  WHERE status = 'active';

CREATE INDEX shop_talk_post_media_upload_idx
  ON shop_talk_post_media (upload_id);

CREATE INDEX shop_talk_post_media_uploader_idx
  ON shop_talk_post_media (uploader_account_id, created_at DESC, id DESC);
