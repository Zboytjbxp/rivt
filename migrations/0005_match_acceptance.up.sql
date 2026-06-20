CREATE TABLE account_blocks (
  blocker_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  blocked_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_account_id, blocked_account_id),
  CHECK (blocker_account_id <> blocked_account_id)
);

CREATE INDEX account_blocks_blocked_idx
  ON account_blocks (blocked_account_id, blocker_account_id);

CREATE TABLE job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'withdrawn', 'shortlisted', 'declined', 'offered')),
  message text NOT NULL DEFAULT '',
  proposed_start_date date,
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_account_id)
);

CREATE INDEX job_applications_job_status_idx
  ON job_applications (job_id, status, created_at DESC, id DESC);
CREATE INDEX job_applications_applicant_idx
  ON job_applications (applicant_account_id, updated_at DESC, id DESC);
CREATE INDEX job_applications_submitted_idx
  ON job_applications (job_id, submitted_at DESC, id DESC)
  WHERE status IN ('submitted', 'shortlisted', 'offered');

CREATE TABLE job_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL
    CHECK (event_type IN ('draft_saved', 'submitted', 'withdrawn', 'shortlisted', 'declined', 'offered')),
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_application_events_application_idx
  ON job_application_events (application_id, occurred_at DESC, id DESC);

CREATE TRIGGER job_application_events_no_update
  BEFORE UPDATE OR DELETE ON job_application_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  contractor_account_id uuid NOT NULL REFERENCES accounts(id),
  recipient_account_id uuid NOT NULL REFERENCES accounts(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  start_date date,
  scope_summary text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contractor_account_id <> recipient_account_id)
);

CREATE INDEX job_offers_job_status_idx
  ON job_offers (job_id, status, created_at DESC, id DESC);
CREATE INDEX job_offers_recipient_idx
  ON job_offers (recipient_account_id, status, created_at DESC, id DESC);
CREATE INDEX job_offers_application_idx
  ON job_offers (application_id, status);
CREATE UNIQUE INDEX job_offers_one_active_offer_per_job_idx
  ON job_offers (job_id)
  WHERE status IN ('pending', 'accepted');

CREATE TABLE job_offer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL
    CHECK (event_type IN ('sent', 'accepted', 'declined', 'cancelled', 'expired')),
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_offer_events_offer_idx
  ON job_offer_events (offer_id, occurred_at DESC, id DESC);

CREATE TRIGGER job_offer_events_no_update
  BEFORE UPDATE OR DELETE ON job_offer_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE active_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES jobs(id),
  offer_id uuid NOT NULL UNIQUE REFERENCES job_offers(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  contractor_account_id uuid NOT NULL REFERENCES accounts(id),
  tradesperson_account_id uuid NOT NULL REFERENCES accounts(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contractor_account_id <> tradesperson_account_id)
);

CREATE INDEX active_work_contractor_idx
  ON active_work (contractor_account_id, status, updated_at DESC, id DESC);
CREATE INDEX active_work_tradesperson_idx
  ON active_work (tradesperson_account_id, status, updated_at DESC, id DESC);
CREATE INDEX active_work_organization_idx
  ON active_work (organization_id, status, updated_at DESC, id DESC);

CREATE TABLE work_participants (
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  participant_role text NOT NULL CHECK (participant_role IN ('contractor', 'tradesperson')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (active_work_id, account_id)
);

CREATE INDEX work_participants_account_idx
  ON work_participants (account_id, active_work_id);

CREATE TABLE work_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL
    CHECK (event_type IN ('active_created', 'reschedule_requested', 'cancel_requested', 'cancelled', 'completed')),
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_status_events_active_work_idx
  ON work_status_events (active_work_id, occurred_at DESC, id DESC);

CREATE TRIGGER work_status_events_no_update
  BEFORE UPDATE OR DELETE ON work_status_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
