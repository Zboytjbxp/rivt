DROP TRIGGER IF EXISTS shop_talk_moderation_actions_no_update ON shop_talk_moderation_actions;
DROP INDEX IF EXISTS shop_talk_moderation_actions_actor_idx;
DROP INDEX IF EXISTS shop_talk_moderation_actions_target_idx;
DROP INDEX IF EXISTS shop_talk_moderation_actions_report_idx;
DROP TABLE IF EXISTS shop_talk_moderation_actions;

DROP INDEX IF EXISTS shop_talk_reports_open_dedupe_idx;
DROP INDEX IF EXISTS shop_talk_reports_target_idx;
DROP INDEX IF EXISTS shop_talk_reports_reporter_idx;
DROP INDEX IF EXISTS shop_talk_reports_status_idx;
DROP TABLE IF EXISTS shop_talk_reports;

DROP INDEX IF EXISTS shop_talk_answers_moderation_recent_idx;
DROP INDEX IF EXISTS shop_talk_posts_moderation_recent_idx;
DROP INDEX IF EXISTS communities_moderation_active_idx;

ALTER TABLE shop_talk_answers
  DROP COLUMN IF EXISTS moderation_status;

ALTER TABLE shop_talk_posts
  DROP COLUMN IF EXISTS moderation_status;

ALTER TABLE communities
  DROP COLUMN IF EXISTS moderation_status;
