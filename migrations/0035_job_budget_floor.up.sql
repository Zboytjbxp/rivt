ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_budget_cents_check;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_budget_cents_check
  CHECK (budget_cents IS NULL OR budget_cents BETWEEN 100 AND 100000000);
