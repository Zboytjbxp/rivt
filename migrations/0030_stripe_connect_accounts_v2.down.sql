UPDATE stripe_connect_accounts
SET ach_payments_status = 'inactive'
WHERE ach_payments_status IN ('restricted', 'unsupported');

ALTER TABLE stripe_connect_accounts
  DROP CONSTRAINT stripe_connect_accounts_ach_payments_status_check,
  ADD CONSTRAINT stripe_connect_accounts_ach_payments_status_check
    CHECK (ach_payments_status IN ('unrequested', 'pending', 'active', 'inactive'));

ALTER TABLE stripe_connect_accounts
  DROP COLUMN stripe_dashboard,
  DROP COLUMN stripe_account_api_version;
