ALTER TABLE jobs
  ADD COLUMN public_web_visibility text NOT NULL DEFAULT 'members'
    CHECK (public_web_visibility IN ('members', 'public')),
  ADD COLUMN public_web_published_at timestamptz;

CREATE INDEX jobs_public_web_discovery_idx
  ON jobs (published_at DESC, id DESC)
  WHERE status = 'open'
    AND public_web_visibility = 'public'
    AND published_at IS NOT NULL;

ALTER TABLE shop_talk_posts
  ADD COLUMN public_web_visibility text NOT NULL DEFAULT 'members'
    CHECK (public_web_visibility IN ('members', 'public')),
  ADD COLUMN public_web_published_at timestamptz;

CREATE INDEX shop_talk_posts_public_web_discovery_idx
  ON shop_talk_posts (created_at DESC, id DESC)
  WHERE public_web_visibility = 'public'
    AND moderation_status <> 'hidden';

ALTER TABLE shop_talk_answers
  ADD COLUMN public_web_consent_at timestamptz;
