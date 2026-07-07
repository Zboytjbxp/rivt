DROP INDEX IF EXISTS communities_audience_active_idx;

ALTER TABLE communities
  DROP CONSTRAINT IF EXISTS communities_audience_check,
  DROP COLUMN IF EXISTS audience;
