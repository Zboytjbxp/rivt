CREATE TABLE tool_invoice_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_record_id uuid NOT NULL REFERENCES tool_records(id) ON DELETE CASCADE,
  merchant_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
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

CREATE INDEX tool_invoice_payment_requests_record_idx
  ON tool_invoice_payment_requests (tool_record_id, created_at DESC, id DESC);

CREATE INDEX tool_invoice_payment_requests_merchant_idx
  ON tool_invoice_payment_requests (merchant_account_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX tool_invoice_payment_requests_one_active_idx
  ON tool_invoice_payment_requests (tool_record_id)
  WHERE status IN ('created', 'open', 'processing');
