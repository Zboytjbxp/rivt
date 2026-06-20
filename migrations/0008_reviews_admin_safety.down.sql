DROP TABLE IF EXISTS account_restriction_events;
DROP TABLE IF EXISTS account_restrictions;
DROP TABLE IF EXISTS admin_action_events;
DROP TABLE IF EXISTS admin_role_grants;
DROP TABLE IF EXISTS support_case_events;
DROP TABLE IF EXISTS support_cases;
DROP TABLE IF EXISTS unsafe_work_report_events;
DROP TABLE IF EXISTS unsafe_work_reports;
DROP TABLE IF EXISTS safety_reports;
DROP TABLE IF EXISTS review_events;
DROP TABLE IF EXISTS work_reviews;

ALTER TABLE consent_acceptances
  DROP CONSTRAINT IF EXISTS consent_acceptances_context_check;

DELETE FROM consent_acceptances
WHERE context IN ('review_submission', 'stop_work');

ALTER TABLE consent_acceptances
  ADD CONSTRAINT consent_acceptances_context_check
  CHECK (context IN ('signup', 'profile', 'job_post', 'application', 'offer_acceptance'));

DROP INDEX IF EXISTS consent_acceptances_actor_idx;

ALTER TABLE consent_acceptances
  DROP COLUMN IF EXISTS actor_account_id;
