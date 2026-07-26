CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  legacy_local_id text NOT NULL
    CHECK (char_length(legacy_local_id) BETWEEN 1 AND 120 AND legacy_local_id ~ '^[A-Za-z0-9:_-]+$'),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 160),
  company text NOT NULL DEFAULT '' CHECK (char_length(company) <= 160),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 320),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 80),
  billing_address text NOT NULL DEFAULT '' CHECK (char_length(billing_address) <= 500),
  service_address text NOT NULL DEFAULT '' CHECK (char_length(service_address) <= 500),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  preferred_contact_method text NOT NULL DEFAULT 'none'
    CHECK (preferred_contact_method IN ('none', 'email', 'phone', 'sms')),
  default_terms text NOT NULL DEFAULT '' CHECK (char_length(default_terms) <= 240),
  favorite boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  thread_messages jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(thread_messages) = 'array'),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, legacy_local_id)
);

CREATE INDEX customers_account_status_recent_idx
  ON customers (account_id, status, favorite DESC, last_used_at DESC NULLS LAST, updated_at DESC);

CREATE INDEX customers_account_email_idx
  ON customers (account_id, lower(email))
  WHERE email <> '';

CREATE INDEX customers_account_phone_idx
  ON customers (account_id, regexp_replace(phone, '[^0-9]', '', 'g'))
  WHERE phone <> '';

INSERT INTO customers (
  account_id,
  legacy_local_id,
  name,
  company,
  email,
  phone,
  billing_address,
  service_address,
  notes,
  preferred_contact_method,
  default_terms,
  favorite,
  status,
  thread_messages,
  created_at,
  updated_at
)
SELECT
  tr.account_id,
  tr.local_id,
  left(COALESCE(NULLIF(trim(tr.payload->>'name'), ''), tr.title), 160),
  left(COALESCE(tr.payload->>'company', ''), 160),
  left(lower(COALESCE(tr.payload->>'email', '')), 320),
  left(COALESCE(tr.payload->>'phone', ''), 80),
  left(COALESCE(tr.payload->>'billingAddress', ''), 500),
  left(COALESCE(tr.payload->>'serviceAddress', ''), 500),
  left(COALESCE(tr.payload->>'notes', ''), 4000),
  CASE
    WHEN tr.payload->>'preferredContactMethod' IN ('none', 'email', 'phone', 'sms')
      THEN tr.payload->>'preferredContactMethod'
    ELSE 'none'
  END,
  left(COALESCE(tr.payload->>'defaultTerms', ''), 240),
  CASE WHEN tr.payload->>'favorite' = 'true' THEN true ELSE false END,
  CASE WHEN tr.status IN ('active', 'archived') THEN tr.status ELSE 'active' END,
  CASE
    WHEN jsonb_typeof(tr.payload->'threadMessages') = 'array'
      THEN tr.payload->'threadMessages'
    ELSE '[]'::jsonb
  END,
  tr.created_at,
  tr.updated_at
FROM tool_records tr
WHERE tr.record_type = 'client'
  AND tr.deleted_at IS NULL
ON CONFLICT (account_id, legacy_local_id) DO NOTHING;

ALTER TABLE tool_records
  ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX tool_records_customer_idx
  ON tool_records (customer_id, updated_at DESC, id DESC)
  WHERE customer_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE standalone_projects
  ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX standalone_projects_customer_idx
  ON standalone_projects (customer_id, updated_at DESC, id DESC)
  WHERE customer_id IS NOT NULL;

UPDATE tool_records tr
SET customer_id = c.id
FROM customers c
WHERE tr.account_id = c.account_id
  AND tr.record_type <> 'client'
  AND tr.deleted_at IS NULL
  AND tr.customer_id IS NULL
  AND NULLIF(tr.payload->>'customerId', '') = c.legacy_local_id;

UPDATE standalone_projects sp
SET customer_id = matched.customer_id
FROM (
  SELECT
    project.id AS project_id,
    min(customer.id::text)::uuid AS customer_id
  FROM standalone_projects project
  INNER JOIN customers customer
    ON customer.account_id = project.account_id
   AND lower(trim(COALESCE(NULLIF(customer.company, ''), customer.name))) = lower(trim(project.client_name))
  WHERE project.client_name <> ''
  GROUP BY project.id
  HAVING count(*) = 1
) matched
WHERE sp.id = matched.project_id;
