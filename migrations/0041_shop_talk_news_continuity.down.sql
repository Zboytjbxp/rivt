DROP INDEX IF EXISTS shop_talk_posts_active_article_discussion_idx;

ALTER TABLE shop_talk_posts
  DROP CONSTRAINT IF EXISTS shop_talk_posts_article_fields_check,
  DROP COLUMN IF EXISTS article_published_at,
  DROP COLUMN IF EXISTS article_source,
  DROP COLUMN IF EXISTS article_canonical_url,
  DROP COLUMN IF EXISTS article_url;

DROP TABLE IF EXISTS trade_news_saved_articles;
DROP TABLE IF EXISTS trade_news_preferences;

