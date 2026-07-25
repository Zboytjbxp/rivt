CREATE TABLE stripe_connect_accounts (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  country text NOT NULL DEFAULT 'US' CHECK (char_length(country) = 2),
  currency text NOT NULL DEFAULT 'usd' CHECK (char_length(currency) = 3),
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  ach_payments_status text NOT NULL DEFAULT 'unrequested'
    CHECK (ach_payments_status IN ('unrequested', 'pending', 'active', 'inactive')),
  onboarding_status text NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'pending', 'ready', 'restricted')),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_invoice_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES project_invoices(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  merchant_account_id uuid NOT NULL REFERENCES accounts(id),
  stripe_connected_account_id text NOT NULL,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created', 'open', 'processing', 'paid', 'failed', 'expired',
      'disputed', 'partially_refunded', 'refunded'
    )),
  payment_method_type text
    CHECK (payment_method_type IS NULL OR payment_method_type IN ('us_bank_account', 'card', 'unknown')),
  checkout_url text CHECK (checkout_url IS NULL OR char_length(checkout_url) <= 2048),
  expires_at timestamptz,
  failure_code text CHECK (failure_code IS NULL OR char_length(failure_code) <= 120),
  refunded_cents integer NOT NULL DEFAULT 0
    CHECK (refunded_cents >= 0 AND refunded_cents <= amount_cents),
  paid_at timestamptz,
  failed_at timestamptz,
  disputed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_invoice_payment_requests_invoice_idx
  ON project_invoice_payment_requests (invoice_id, created_at DESC, id DESC);
CREATE INDEX project_invoice_payment_requests_merchant_idx
  ON project_invoice_payment_requests (merchant_account_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX project_invoice_payment_requests_one_active_idx
  ON project_invoice_payment_requests (invoice_id)
  WHERE status IN ('created', 'open', 'processing');

CREATE TABLE stripe_connect_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  stripe_connected_account_id text,
  provider_object_id text,
  livemode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER stripe_connect_events_no_update
  BEFORE UPDATE OR DELETE ON stripe_connect_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
