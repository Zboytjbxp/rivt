CREATE TABLE billing_customers (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_price_id text,
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_end timestamptz,
  last_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_subscriptions_account_idx
  ON billing_subscriptions (account_id, updated_at DESC);

CREATE INDEX billing_subscriptions_customer_idx
  ON billing_subscriptions (stripe_customer_id);

CREATE TABLE billing_entitlements (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status text NOT NULL DEFAULT 'inactive',
  source text NOT NULL DEFAULT 'stripe',
  stripe_subscription_id text,
  active_until timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
