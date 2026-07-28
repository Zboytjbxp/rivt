ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN (
    'legacy', 'project', 'album', 'shop-talk', 'document-brand',
    'professional-profile', 'message', 'contact-note'
  ));

ALTER TABLE conversation_messages
  DROP CONSTRAINT IF EXISTS conversation_messages_body_check;

ALTER TABLE conversation_messages
  ADD CONSTRAINT conversation_messages_body_check
  CHECK (char_length(body) BETWEEN 0 AND 4000);

ALTER TABLE message_attachments
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN removed_at timestamptz,
  ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  ADD COLUMN conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE;

UPDATE message_attachments attachment
SET conversation_id = message.conversation_id
FROM conversation_messages message
WHERE message.id = attachment.message_id
  AND attachment.conversation_id IS NULL;

ALTER TABLE message_attachments
  ADD CONSTRAINT message_attachments_conversation_check
  CHECK (message_id IS NOT NULL OR conversation_id IS NOT NULL);

CREATE INDEX message_attachments_conversation_idx
  ON message_attachments (conversation_id, created_by_account_id, status, created_at DESC);
CREATE INDEX message_attachments_expiry_idx
  ON message_attachments (expires_at)
  WHERE status = 'pending_authorization' AND removed_at IS NULL;

CREATE TABLE conversation_preferences (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, conversation_id)
);

CREATE INDEX conversation_preferences_account_idx
  ON conversation_preferences (account_id, archived, pinned, updated_at DESC);

CREATE TABLE message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_templates_account_idx
  ON message_templates (account_id, archived_at, sort_order, updated_at DESC);

CREATE TABLE message_reactions (
  message_id uuid NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, account_id)
);

CREATE INDEX message_reactions_message_idx
  ON message_reactions (message_id, emoji, updated_at DESC);

CREATE TABLE contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_notes_contact_idx
  ON contact_notes (account_id, contact_id, archived_at, occurred_at DESC, id DESC);

CREATE TABLE contact_note_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES contact_notes(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE RESTRICT,
  original_name text NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 240),
  mime_type text NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 120),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, upload_id)
);

CREATE INDEX contact_note_attachments_note_idx
  ON contact_note_attachments (note_id, removed_at, created_at, id);

CREATE TABLE messaging_continuity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  subject_type text NOT NULL CHECK (
    subject_type IN (
      'conversation_preference', 'message_template', 'message_reaction',
      'message_attachment', 'contact_note', 'contact_note_attachment'
    )
  ),
  subject_id text NOT NULL CHECK (char_length(subject_id) BETWEEN 1 AND 120),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  from_version integer,
  to_version integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messaging_continuity_events_account_idx
  ON messaging_continuity_events (account_id, created_at DESC, id DESC);
CREATE INDEX messaging_continuity_events_subject_idx
  ON messaging_continuity_events (subject_type, subject_id, created_at, id);

CREATE TRIGGER messaging_continuity_events_no_update
  BEFORE UPDATE OR DELETE ON messaging_continuity_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
