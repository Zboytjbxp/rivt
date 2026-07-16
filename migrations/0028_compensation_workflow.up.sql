ALTER TABLE jobs
  ADD COLUMN compensation_type text NOT NULL DEFAULT 'fixed'
    CHECK (compensation_type IN ('fixed', 'hourly', 'open_to_offers', 'request_quotes'));

UPDATE jobs
SET compensation_type = CASE WHEN budget_unit = 'hourly' THEN 'hourly' ELSE 'fixed' END;

ALTER TABLE job_applications
  ADD COLUMN proposed_amount_cents integer CHECK (proposed_amount_cents IS NULL OR proposed_amount_cents > 0),
  ADD COLUMN proposed_unit text CHECK (proposed_unit IS NULL OR proposed_unit IN ('fixed', 'hourly')),
  ADD CONSTRAINT job_applications_proposal_pair_check
    CHECK ((proposed_amount_cents IS NULL) = (proposed_unit IS NULL));

ALTER TABLE job_offers
  ADD COLUMN agreed_amount_cents integer CHECK (agreed_amount_cents IS NULL OR agreed_amount_cents > 0),
  ADD COLUMN agreed_unit text CHECK (agreed_unit IS NULL OR agreed_unit IN ('fixed', 'hourly'));

UPDATE job_offers offer
SET agreed_amount_cents = job.budget_cents,
    agreed_unit = job.budget_unit
FROM jobs job
WHERE job.id = offer.job_id
  AND offer.agreed_amount_cents IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM job_offers
    WHERE agreed_amount_cents IS NULL OR agreed_unit IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing offers require a job budget before compensation migration';
  END IF;
END $$;

ALTER TABLE job_offers
  ALTER COLUMN agreed_amount_cents SET NOT NULL,
  ALTER COLUMN agreed_unit SET NOT NULL;

CREATE TABLE profile_rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  trade_code text NOT NULL REFERENCES trades(code),
  hourly_rate_cents integer CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents > 0),
  day_rate_cents integer CHECK (day_rate_cents IS NULL OR day_rate_cents > 0),
  minimum_charge_cents integer CHECK (minimum_charge_cents IS NULL OR minimum_charge_cents >= 0),
  visibility text NOT NULL DEFAULT 'applications'
    CHECK (visibility IN ('network', 'applications', 'private')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, trade_code),
  CHECK (hourly_rate_cents IS NOT NULL OR day_rate_cents IS NOT NULL OR minimum_charge_cents IS NOT NULL)
);

CREATE INDEX profile_rate_cards_account_idx ON profile_rate_cards(account_id, updated_at DESC);
CREATE INDEX profile_rate_cards_trade_idx ON profile_rate_cards(trade_code, visibility);
