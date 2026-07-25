ALTER TABLE stripe_connect_accounts
  ADD COLUMN stripe_account_api_version text NOT NULL DEFAULT 'v1'
    CHECK (stripe_account_api_version IN ('v1', 'v2')),
  ADD COLUMN stripe_dashboard text NOT NULL DEFAULT 'express'
    CHECK (stripe_dashboard IN ('express', 'full', 'none'));

ALTER TABLE stripe_connect_accounts
  DROP CONSTRAINT stripe_connect_accounts_ach_payments_status_check,
  ADD CONSTRAINT stripe_connect_accounts_ach_payments_status_check
    CHECK (ach_payments_status IN (
      'unrequested', 'pending', 'active', 'inactive', 'restricted', 'unsupported'
    ));
