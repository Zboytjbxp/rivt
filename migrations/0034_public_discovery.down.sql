DROP INDEX IF EXISTS shop_talk_posts_public_web_discovery_idx;

ALTER TABLE shop_talk_answers
  DROP COLUMN IF EXISTS public_web_consent_at;

ALTER TABLE shop_talk_posts
  DROP COLUMN IF EXISTS public_web_published_at,
  DROP COLUMN IF EXISTS public_web_visibility;

DROP INDEX IF EXISTS jobs_public_web_discovery_idx;

ALTER TABLE jobs
  DROP COLUMN IF EXISTS public_web_published_at,
  DROP COLUMN IF EXISTS public_web_visibility;
