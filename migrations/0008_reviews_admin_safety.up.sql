ALTER TABLE consent_acceptances
  ADD COLUMN actor_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

UPDATE consent_acceptances
SET actor_account_id = account_id
WHERE actor_account_id IS NULL;

ALTER TABLE consent_acceptances
  ALTER COLUMN actor_account_id SET NOT NULL;

CREATE INDEX consent_acceptances_actor_idx
  ON consent_acceptances (actor_account_id, accepted_at DESC, id DESC);

ALTER TABLE consent_acceptances
  DROP CONSTRAINT IF EXISTS consent_acceptances_context_check;

ALTER TABLE consent_acceptances
  ADD CONSTRAINT consent_acceptances_context_check
  CHECK (context IN ('signup', 'profile', 'job_post', 'application', 'offer_acceptance', 'review_submission', 'stop_work'));

CREATE TABLE work_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  reviewer_account_id uuid NOT NULL REFERENCES accounts(id),
  reviewee_account_id uuid NOT NULL REFERENCES accounts(id),
  reviewer_role text NOT NULL CHECK (reviewer_role IN ('contractor', 'tradesperson')),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'disputed', 'resolved', 'hidden')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  disputed_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewer_account_id <> reviewee_account_id),
  UNIQUE (active_work_id, reviewer_account_id, reviewee_account_id)
);

CREATE INDEX work_reviews_active_work_idx
  ON work_reviews (active_work_id, submitted_at DESC, id DESC);
CREATE INDEX work_reviews_reviewer_idx
  ON work_reviews (reviewer_account_id, submitted_at DESC, id DESC);
CREATE INDEX work_reviews_reviewee_status_idx
  ON work_reviews (reviewee_account_id, status, submitted_at DESC, id DESC);
CREATE INDEX work_reviews_public_reputation_idx
  ON work_reviews (reviewee_account_id, submitted_at DESC, id DESC)
  WHERE status IN ('approved', 'resolved');

CREATE TABLE review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES work_reviews(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL
    CHECK (event_type IN ('submitted', 'approved', 'disputed', 'response_added', 'resolved', 'hidden')),
  note text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_events_review_idx
  ON review_events (review_id, occurred_at DESC, id DESC);
CREATE INDEX review_events_actor_idx
  ON review_events (actor_account_id, occurred_at DESC, id DESC);

CREATE TRIGGER review_events_no_update
  BEFORE UPDATE OR DELETE ON review_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_account_id uuid NOT NULL REFERENCES accounts(id),
  reported_account_id uuid REFERENCES accounts(id),
  subject_type text NOT NULL
    CHECK (subject_type IN ('account', 'job', 'conversation', 'message', 'active_work', 'project')),
  subject_id text NOT NULL,
  reason text NOT NULL
    CHECK (reason IN ('spam', 'harassment', 'suspicious', 'inappropriate', 'safety', 'payment', 'other')),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'dismissed', 'action_taken')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX safety_reports_status_idx
  ON safety_reports (status, created_at DESC, id DESC);
CREATE INDEX safety_reports_reporter_idx
  ON safety_reports (reporter_account_id, created_at DESC, id DESC);
CREATE INDEX safety_reports_reported_idx
  ON safety_reports (reported_account_id, created_at DESC, id DESC)
  WHERE reported_account_id IS NOT NULL;
CREATE INDEX safety_reports_subject_idx
  ON safety_reports (subject_type, subject_id, created_at DESC, id DESC);

CREATE TABLE unsafe_work_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  reporter_account_id uuid NOT NULL REFERENCES accounts(id),
  condition_type text NOT NULL
    CHECK (condition_type IN ('unsafe_condition', 'stop_work', 'near_miss', 'site_access', 'other')),
  severity text NOT NULL DEFAULT 'needs_review'
    CHECK (severity IN ('needs_review', 'urgent', 'resolved')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX unsafe_work_reports_work_idx
  ON unsafe_work_reports (active_work_id, created_at DESC, id DESC);
CREATE INDEX unsafe_work_reports_reporter_idx
  ON unsafe_work_reports (reporter_account_id, created_at DESC, id DESC);
CREATE INDEX unsafe_work_reports_status_idx
  ON unsafe_work_reports (status, created_at DESC, id DESC);

CREATE TABLE unsafe_work_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unsafe_report_id uuid NOT NULL REFERENCES unsafe_work_reports(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL CHECK (event_type IN ('opened', 'acknowledged', 'resolved', 'note_added')),
  note text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX unsafe_work_report_events_report_idx
  ON unsafe_work_report_events (unsafe_report_id, occurred_at DESC, id DESC);

CREATE TRIGGER unsafe_work_report_events_no_update
  BEFORE UPDATE OR DELETE ON unsafe_work_report_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by_account_id uuid NOT NULL REFERENCES accounts(id),
  subject_account_id uuid REFERENCES accounts(id),
  active_work_id uuid REFERENCES active_work(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  category text NOT NULL
    CHECK (category IN ('appeal', 'unsafe_condition', 'account', 'review', 'payment', 'technical', 'other')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_cases_opened_by_idx
  ON support_cases (opened_by_account_id, created_at DESC, id DESC);
CREATE INDEX support_cases_subject_idx
  ON support_cases (subject_account_id, created_at DESC, id DESC)
  WHERE subject_account_id IS NOT NULL;
CREATE INDEX support_cases_status_idx
  ON support_cases (status, created_at DESC, id DESC);
CREATE INDEX support_cases_work_idx
  ON support_cases (active_work_id, created_at DESC, id DESC)
  WHERE active_work_id IS NOT NULL;

CREATE TABLE support_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_case_id uuid NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL CHECK (event_type IN ('opened', 'user_note', 'internal_note', 'status_changed')),
  visibility text NOT NULL DEFAULT 'user' CHECK (visibility IN ('user', 'internal')),
  note text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_case_events_case_idx
  ON support_case_events (support_case_id, occurred_at DESC, id DESC);
CREATE INDEX support_case_events_actor_idx
  ON support_case_events (actor_account_id, occurred_at DESC, id DESC);

CREATE TRIGGER support_case_events_no_update
  BEFORE UPDATE OR DELETE ON support_case_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE admin_role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'support', 'moderator')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_by_account_id uuid REFERENCES accounts(id),
  reason text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (account_id, role)
);

CREATE INDEX admin_role_grants_account_idx
  ON admin_role_grants (account_id, status, role);
CREATE INDEX admin_role_grants_active_role_idx
  ON admin_role_grants (role, granted_at DESC, id DESC)
  WHERE status = 'active';

CREATE TABLE admin_action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  action text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  reason_code text NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_action_events_actor_idx
  ON admin_action_events (actor_account_id, occurred_at DESC, id DESC);
CREATE INDEX admin_action_events_subject_idx
  ON admin_action_events (subject_type, subject_id, occurred_at DESC, id DESC);

CREATE TRIGGER admin_action_events_no_update
  BEFORE UPDATE OR DELETE ON admin_action_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE account_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  imposed_by_account_id uuid NOT NULL REFERENCES accounts(id),
  restriction_type text NOT NULL
    CHECK (restriction_type IN ('warning', 'mutation_restricted', 'timeout_24h', 'suspension', 'ban')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lifted', 'expired')),
  reason_code text NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  lifted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_restrictions_account_active_idx
  ON account_restrictions (account_id, restriction_type, created_at DESC, id DESC)
  WHERE status = 'active';
CREATE INDEX account_restrictions_status_idx
  ON account_restrictions (status, created_at DESC, id DESC);

CREATE TABLE account_restriction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restriction_id uuid NOT NULL REFERENCES account_restrictions(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL CHECK (event_type IN ('imposed', 'lifted', 'expired', 'note_added')),
  reason_code text NOT NULL,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_restriction_events_restriction_idx
  ON account_restriction_events (restriction_id, occurred_at DESC, id DESC);

CREATE TRIGGER account_restriction_events_no_update
  BEFORE UPDATE OR DELETE ON account_restriction_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
