ALTER TABLE communities
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden', 'locked'));

ALTER TABLE shop_talk_posts
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden', 'locked'));

ALTER TABLE shop_talk_answers
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden'));

CREATE INDEX communities_moderation_active_idx
  ON communities (moderation_status, updated_at DESC, id DESC)
  WHERE archived_at IS NULL;

CREATE INDEX shop_talk_posts_moderation_recent_idx
  ON shop_talk_posts (moderation_status, created_at DESC, id DESC);

CREATE INDEX shop_talk_answers_moderation_recent_idx
  ON shop_talk_answers (moderation_status, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE shop_talk_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('community', 'post', 'answer')),
  target_id uuid NOT NULL,
  reason_code text NOT NULL
    CHECK (reason_code IN ('spam', 'harassment', 'unsafe_advice', 'misinformation', 'privacy', 'duplicate', 'other')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  target_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewed_by_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shop_talk_reports_status_idx
  ON shop_talk_reports (status, created_at DESC, id DESC);

CREATE INDEX shop_talk_reports_reporter_idx
  ON shop_talk_reports (reporter_account_id, created_at DESC, id DESC);

CREATE INDEX shop_talk_reports_target_idx
  ON shop_talk_reports (target_type, target_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX shop_talk_reports_open_dedupe_idx
  ON shop_talk_reports (reporter_account_id, target_type, target_id, reason_code)
  WHERE status IN ('open', 'reviewing');

CREATE TABLE shop_talk_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES shop_talk_reports(id) ON DELETE SET NULL,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('community', 'post', 'answer')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('dismiss', 'hide', 'lock', 'archive_community', 'restore')),
  reason_code text NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shop_talk_moderation_actions_report_idx
  ON shop_talk_moderation_actions (report_id, occurred_at DESC, id DESC)
  WHERE report_id IS NOT NULL;

CREATE INDEX shop_talk_moderation_actions_target_idx
  ON shop_talk_moderation_actions (target_type, target_id, occurred_at DESC, id DESC);

CREATE INDEX shop_talk_moderation_actions_actor_idx
  ON shop_talk_moderation_actions (actor_account_id, occurred_at DESC, id DESC);

CREATE TRIGGER shop_talk_moderation_actions_no_update
  BEFORE UPDATE OR DELETE ON shop_talk_moderation_actions
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
