DROP INDEX IF EXISTS push_subscriptions_vapid_generation_idx;

ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_vapid_generation_check;

ALTER TABLE push_subscriptions
  DROP COLUMN IF EXISTS vapid_generation;
