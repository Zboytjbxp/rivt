DROP TRIGGER IF EXISTS messaging_continuity_events_no_update
  ON messaging_continuity_events;

WITH packet_uploads AS (
  SELECT upload_id FROM message_attachments
  WHERE upload_id IS NOT NULL
  UNION
  SELECT upload_id FROM contact_note_attachments
)
UPDATE uploads
SET storage_scope = 'legacy',
    upload_status = 'removed',
    failure_reason = 'Detached by Packet 82 rollback.'
WHERE id IN (SELECT upload_id FROM packet_uploads)
  AND storage_scope IN ('message', 'contact-note');

DROP TABLE IF EXISTS messaging_continuity_events;
DROP TABLE IF EXISTS contact_note_attachments;
DROP TABLE IF EXISTS contact_notes;
DROP TABLE IF EXISTS message_reactions;
DROP TABLE IF EXISTS message_templates;
DROP TABLE IF EXISTS conversation_preferences;

ALTER TABLE message_attachments
  DROP CONSTRAINT IF EXISTS message_attachments_conversation_check,
  DROP COLUMN IF EXISTS conversation_id,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS removed_at,
  DROP COLUMN IF EXISTS version;

ALTER TABLE conversation_messages
  DROP CONSTRAINT IF EXISTS conversation_messages_body_check;

UPDATE conversation_messages
SET body = '[Attachment]'
WHERE body = '';

ALTER TABLE conversation_messages
  ADD CONSTRAINT conversation_messages_body_check
  CHECK (char_length(body) BETWEEN 1 AND 4000);

ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN (
    'legacy', 'project', 'album', 'shop-talk', 'document-brand',
    'professional-profile'
  ));
