ALTER TABLE push_subscriptions
  ADD COLUMN vapid_generation text;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_vapid_generation_check
  CHECK (
    vapid_generation IS NULL
    OR vapid_generation ~ '^[0-9a-f]{64}$'
  );

CREATE INDEX push_subscriptions_vapid_generation_idx
  ON push_subscriptions (vapid_generation)
  WHERE vapid_generation IS NOT NULL;
