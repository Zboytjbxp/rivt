ALTER TABLE communities
  ADD COLUMN audience text NOT NULL DEFAULT 'public',
  ADD CONSTRAINT communities_audience_check
    CHECK (audience IN ('public', 'contractors', 'tradespeople'));

CREATE INDEX communities_audience_active_idx
  ON communities (audience, updated_at DESC, id DESC)
  WHERE archived_at IS NULL
    AND moderation_status <> 'hidden';
