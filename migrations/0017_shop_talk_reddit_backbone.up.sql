ALTER TABLE communities
  ADD COLUMN created_by_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN archived_at timestamptz;

ALTER TABLE community_members
  ADD COLUMN role text NOT NULL DEFAULT 'member',
  ADD CONSTRAINT community_members_role_check
    CHECK (role IN ('member', 'moderator', 'owner'));

UPDATE communities c
SET member_count = counts.member_count,
    updated_at = now()
FROM (
  SELECT communities.id, count(community_members.account_id)::int AS member_count
  FROM communities
  LEFT JOIN community_members ON community_members.community_id = communities.id
  GROUP BY communities.id
) counts
WHERE counts.id = c.id;

ALTER TABLE shop_talk_posts
  ADD COLUMN community_id uuid;

UPDATE shop_talk_posts post
SET community_id = community.id
FROM communities community
WHERE community.slug = CASE lower(post.trade)
  WHEN 'carpentry' THEN 'carpentry-talk'
  WHEN 'electrical' THEN 'electrical-talk'
  WHEN 'plumbing' THEN 'plumbing-talk'
  WHEN 'tile' THEN 'tile-talk'
  WHEN 'cabinetry' THEN 'cabinetry-talk'
  WHEN 'remodeling' THEN 'remodelers'
  WHEN 'remodelers' THEN 'remodelers'
  WHEN 'side work' THEN 'side-work'
  ELSE 'jacksonville-trades'
END;

UPDATE shop_talk_posts
SET community_id = (
  SELECT id FROM communities WHERE slug = 'jacksonville-trades'
)
WHERE community_id IS NULL;

ALTER TABLE shop_talk_posts
  ALTER COLUMN community_id SET NOT NULL,
  ADD CONSTRAINT shop_talk_posts_community_id_fkey
    FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE RESTRICT;

CREATE INDEX communities_created_by_idx
  ON communities (created_by_account_id, created_at DESC)
  WHERE created_by_account_id IS NOT NULL;

CREATE INDEX communities_active_recent_idx
  ON communities (updated_at DESC, id DESC)
  WHERE archived_at IS NULL;

CREATE INDEX shop_talk_posts_community_recent_idx
  ON shop_talk_posts (community_id, created_at DESC, id DESC);

CREATE TABLE shop_talk_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES shop_talk_posts(id) ON DELETE CASCADE,
  author_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  verified_fix boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX shop_talk_answers_post_recent_idx
  ON shop_talk_answers (post_id, verified_fix DESC, created_at ASC, id ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX shop_talk_answers_author_recent_idx
  ON shop_talk_answers (author_account_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX shop_talk_answers_one_verified_fix_per_post_idx
  ON shop_talk_answers (post_id)
  WHERE verified_fix = true AND deleted_at IS NULL;
