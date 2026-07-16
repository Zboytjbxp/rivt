DROP INDEX IF EXISTS profile_rate_cards_trade_idx;
DROP INDEX IF EXISTS profile_rate_cards_account_idx;
DROP TABLE IF EXISTS profile_rate_cards;

ALTER TABLE job_offers
  DROP COLUMN IF EXISTS agreed_unit,
  DROP COLUMN IF EXISTS agreed_amount_cents;

ALTER TABLE job_applications
  DROP CONSTRAINT IF EXISTS job_applications_proposal_pair_check,
  DROP COLUMN IF EXISTS proposed_unit,
  DROP COLUMN IF EXISTS proposed_amount_cents;

ALTER TABLE jobs DROP COLUMN IF EXISTS compensation_type;
