DROP INDEX IF EXISTS shop_talk_answers_one_verified_fix_per_post_idx;
DROP INDEX IF EXISTS shop_talk_answers_author_recent_idx;
DROP INDEX IF EXISTS shop_talk_answers_post_recent_idx;
DROP TABLE IF EXISTS shop_talk_answers;

DROP INDEX IF EXISTS shop_talk_posts_community_recent_idx;
ALTER TABLE shop_talk_posts
  DROP CONSTRAINT IF EXISTS shop_talk_posts_community_id_fkey,
  DROP COLUMN IF EXISTS community_id;

DROP INDEX IF EXISTS communities_active_recent_idx;
DROP INDEX IF EXISTS communities_created_by_idx;

ALTER TABLE community_members
  DROP CONSTRAINT IF EXISTS community_members_role_check,
  DROP COLUMN IF EXISTS role;

ALTER TABLE communities
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS created_by_account_id;
