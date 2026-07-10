DROP INDEX IF EXISTS push_subscriptions_session_idx;

ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_auth_session_fk,
  DROP COLUMN IF EXISTS auth_session_id;

