CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_work_id uuid NOT NULL UNIQUE REFERENCES active_work(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by_account_id uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversations_job_idx
  ON conversations (job_id, updated_at DESC, id DESC);
CREATE INDEX conversations_organization_idx
  ON conversations (organization_id, updated_at DESC, id DESC);
CREATE INDEX conversations_created_by_idx
  ON conversations (created_by_account_id, created_at DESC, id DESC);

CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  participant_role text NOT NULL CHECK (participant_role IN ('contractor', 'tradesperson')),
  muted_until timestamptz,
  last_read_at timestamptz,
  last_read_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, account_id)
);

CREATE INDEX conversation_participants_account_idx
  ON conversation_participants (account_id, updated_at DESC, conversation_id);
CREATE INDEX conversation_participants_muted_idx
  ON conversation_participants (account_id, muted_until)
  WHERE muted_until IS NOT NULL;

CREATE TABLE conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_account_id uuid NOT NULL REFERENCES accounts(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  kind text NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX conversation_messages_conversation_idx
  ON conversation_messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX conversation_messages_sender_idx
  ON conversation_messages (sender_account_id, created_at DESC, id DESC);

CREATE TABLE message_receipts (
  message_id uuid NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (message_id, account_id)
);

CREATE INDEX message_receipts_account_idx
  ON message_receipts (account_id, read_at, delivered_at DESC);

CREATE TABLE message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES conversation_messages(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES uploads(id),
  original_name text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  size_bytes integer,
  status text NOT NULL DEFAULT 'pending_authorization'
    CHECK (status IN ('pending_authorization', 'attached', 'rejected')),
  created_by_account_id uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_attachments_message_idx
  ON message_attachments (message_id, created_at DESC, id DESC);
CREATE INDEX message_attachments_upload_idx
  ON message_attachments (upload_id)
  WHERE upload_id IS NOT NULL;
CREATE INDEX message_attachments_created_by_idx
  ON message_attachments (created_by_account_id, created_at DESC, id DESC);

CREATE TABLE in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('message', 'work', 'system')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  action_href text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT '',
  source_id uuid,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX in_app_notifications_account_unread_idx
  ON in_app_notifications (account_id, created_at DESC, id DESC)
  WHERE read_at IS NULL;
CREATE INDEX in_app_notifications_account_idx
  ON in_app_notifications (account_id, created_at DESC, id DESC);
CREATE INDEX in_app_notifications_source_idx
  ON in_app_notifications (source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE TABLE notification_preferences (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'push')),
  enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, notification_type, channel)
);

CREATE INDEX notification_preferences_account_idx
  ON notification_preferences (account_id, notification_type);

CREATE TABLE conversation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reporter_account_id uuid NOT NULL REFERENCES accounts(id),
  reported_account_id uuid REFERENCES accounts(id),
  message_id uuid REFERENCES conversation_messages(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'suspicious', 'inappropriate', 'safety')),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversation_reports_conversation_idx
  ON conversation_reports (conversation_id, status, created_at DESC, id DESC);
CREATE INDEX conversation_reports_reporter_idx
  ON conversation_reports (reporter_account_id, created_at DESC, id DESC);
CREATE INDEX conversation_reports_reported_idx
  ON conversation_reports (reported_account_id, created_at DESC, id DESC)
  WHERE reported_account_id IS NOT NULL;
