CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_by_account_id uuid NOT NULL REFERENCES accounts(id),
  title text NOT NULL,
  trade_code text NOT NULL REFERENCES trades(code),
  summary text NOT NULL DEFAULT '',
  scope_description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paused', 'closed')),
  difficulty text NOT NULL DEFAULT 'moderate'
    CHECK (difficulty IN ('easy', 'moderate', 'challenging', 'advanced', 'expert')),
  work_type text NOT NULL DEFAULT 'side_work'
    CHECK (work_type IN ('side_work', 'emergency', 'multi_day', 'inspection_prep')),
  budget_cents integer CHECK (budget_cents IS NULL OR budget_cents BETWEEN 5000 AND 100000000),
  budget_unit text NOT NULL DEFAULT 'fixed'
    CHECK (budget_unit IN ('fixed', 'hourly')),
  duration_hours numeric(7,2)
    CHECK (duration_hours IS NULL OR duration_hours > 0),
  preferred_start_date date,
  application_deadline timestamptz,
  insurance_required boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  published_at timestamptz,
  paused_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_organization_updated_idx
  ON jobs (organization_id, updated_at DESC, id DESC);
CREATE INDEX jobs_discovery_idx
  ON jobs (published_at DESC, id DESC)
  WHERE status = 'open';
CREATE INDEX jobs_trade_region_filter_idx
  ON jobs (trade_code, status, published_at DESC);

CREATE TABLE job_public_locations (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  city text NOT NULL,
  region text NOT NULL,
  country_code text NOT NULL DEFAULT 'US',
  postal_prefix text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_public_locations_region_idx
  ON job_public_locations (country_code, region, city);

CREATE TABLE job_private_locations (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  address_line1 text NOT NULL DEFAULT '',
  address_line2 text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT 'US',
  access_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('tool', 'material', 'deliverable', 'certification')),
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, kind, value)
);

CREATE INDEX job_requirements_job_idx
  ON job_requirements (job_id, kind, sort_order, id);

CREATE TABLE job_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  event_type text NOT NULL
    CHECK (event_type IN ('draft_created', 'draft_updated', 'published', 'paused', 'resumed', 'closed')),
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_status_events_job_idx
  ON job_status_events (job_id, occurred_at DESC, id DESC);

CREATE TRIGGER job_status_events_no_update
  BEFORE UPDATE OR DELETE ON job_status_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
