ALTER TABLE push_subscriptions
  ADD COLUMN auth_session_id text;

UPDATE push_subscriptions subscription
SET auth_session_id = (
  SELECT session.session_id
  FROM auth_sessions session
  WHERE session.user_id = subscription.account_id
    AND session.revoked_at IS NULL
    AND session.expires_at > now()
  ORDER BY session.last_seen_at DESC, session.created_at DESC
  LIMIT 1
);

DELETE FROM push_subscriptions WHERE auth_session_id IS NULL;

ALTER TABLE push_subscriptions
  ALTER COLUMN auth_session_id SET NOT NULL,
  ADD CONSTRAINT push_subscriptions_auth_session_fk
    FOREIGN KEY (auth_session_id) REFERENCES auth_sessions(session_id) ON DELETE CASCADE;

CREATE INDEX push_subscriptions_session_idx
  ON push_subscriptions (auth_session_id);
