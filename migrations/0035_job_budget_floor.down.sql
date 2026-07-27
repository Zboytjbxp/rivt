DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM jobs
    WHERE budget_cents BETWEEN 100 AND 4999
  ) THEN
    RAISE EXCEPTION
      'Cannot restore the previous $50 job budget floor while lower-budget jobs exist.';
  END IF;
END
$$;

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_budget_cents_check;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_budget_cents_check
  CHECK (budget_cents IS NULL OR budget_cents BETWEEN 5000 AND 100000000);
