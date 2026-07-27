CREATE TABLE IF NOT EXISTS contact_rollback_archive (
  contact_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT 'person'
    CHECK (entity_type IN ('person', 'company')),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 160),
  company text NOT NULL DEFAULT '' CHECK (char_length(company) <= 160),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  favorite boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  linked_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, account_id)
);

CREATE INDEX contacts_account_recent_idx
  ON contacts (
    account_id,
    status,
    favorite DESC,
    last_used_at DESC NULLS LAST,
    updated_at DESC,
    id DESC
  );

CREATE INDEX contacts_account_name_idx
  ON contacts (account_id, lower(name), lower(company));

CREATE UNIQUE INDEX contacts_account_linked_account_idx
  ON contacts (account_id, linked_account_id)
  WHERE linked_account_id IS NOT NULL;

CREATE TABLE contact_roles (
  contact_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('crew', 'subcontractor', 'customer', 'supplier', 'other')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, role),
  FOREIGN KEY (contact_id, account_id)
    REFERENCES contacts(id, account_id) ON DELETE CASCADE
);

CREATE INDEX contact_roles_account_role_idx
  ON contact_roles (account_id, role, updated_at DESC, contact_id);

CREATE TABLE contact_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('email', 'phone', 'website')),
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 80),
  value text NOT NULL CHECK (char_length(trim(value)) BETWEEN 1 AND 500),
  normalized_value text NOT NULL
    CHECK (char_length(trim(normalized_value)) BETWEEN 1 AND 500),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (contact_id, account_id)
    REFERENCES contacts(id, account_id) ON DELETE CASCADE,
  UNIQUE (contact_id, kind, normalized_value)
);

CREATE INDEX contact_methods_account_lookup_idx
  ON contact_methods (account_id, kind, normalized_value, contact_id);

CREATE UNIQUE INDEX contact_methods_one_primary_kind_idx
  ON contact_methods (contact_id, kind)
  WHERE is_primary;

CREATE TABLE contact_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('billing', 'service', 'mailing', 'other')),
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 80),
  address text NOT NULL CHECK (char_length(trim(address)) BETWEEN 1 AND 500),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (contact_id, account_id)
    REFERENCES contacts(id, account_id) ON DELETE CASCADE
);

CREATE INDEX contact_addresses_account_contact_idx
  ON contact_addresses (account_id, contact_id, kind, id);

CREATE UNIQUE INDEX contact_addresses_one_primary_kind_idx
  ON contact_addresses (contact_id, kind)
  WHERE is_primary;

CREATE TABLE contact_tags (
  contact_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tag text NOT NULL
    CHECK (
      char_length(trim(tag)) BETWEEN 1 AND 60
      AND tag = lower(trim(tag))
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag),
  FOREIGN KEY (contact_id, account_id)
    REFERENCES contacts(id, account_id) ON DELETE CASCADE
);

CREATE INDEX contact_tags_account_tag_idx
  ON contact_tags (account_id, tag, contact_id);

CREATE TABLE contact_job_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  relationship_role text NOT NULL
    CHECK (char_length(trim(relationship_role)) BETWEEN 1 AND 80),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (contact_id, account_id)
    REFERENCES contacts(id, account_id) ON DELETE CASCADE,
  UNIQUE (account_id, contact_id, job_id, relationship_role)
);

CREATE INDEX contact_job_links_job_idx
  ON contact_job_links (account_id, job_id, relationship_role, contact_id);

CREATE TABLE contact_project_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  standalone_project_id uuid NOT NULL
    REFERENCES standalone_projects(id) ON DELETE CASCADE,
  relationship_role text NOT NULL
    CHECK (char_length(trim(relationship_role)) BETWEEN 1 AND 80),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (contact_id, account_id)
    REFERENCES contacts(id, account_id) ON DELETE CASCADE,
  UNIQUE (
    account_id,
    contact_id,
    standalone_project_id,
    relationship_role
  )
);

CREATE INDEX contact_project_links_project_idx
  ON contact_project_links (
    account_id,
    standalone_project_id,
    relationship_role,
    contact_id
  );

ALTER TABLE customers
  ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX customers_contact_idx
  ON customers (contact_id)
  WHERE contact_id IS NOT NULL;

ALTER TABLE network_records
  ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX network_records_contact_idx
  ON network_records (account_id, contact_id, record_type)
  WHERE contact_id IS NOT NULL AND deleted_at IS NULL;

INSERT INTO contacts (
  id,
  account_id,
  entity_type,
  name,
  company,
  notes,
  favorite,
  status,
  last_used_at,
  created_at,
  updated_at
)
SELECT
  customer.id,
  customer.account_id,
  CASE WHEN customer.company <> '' THEN 'company' ELSE 'person' END,
  customer.name,
  customer.company,
  customer.notes,
  customer.favorite,
  customer.status,
  customer.last_used_at,
  customer.created_at,
  customer.updated_at
FROM customers customer
ON CONFLICT (id) DO NOTHING;

UPDATE customers
SET contact_id = id
WHERE contact_id IS NULL;

INSERT INTO contact_roles (
  contact_id,
  account_id,
  role,
  status,
  details,
  created_at,
  updated_at
)
SELECT
  customer.contact_id,
  customer.account_id,
  'customer',
  customer.status,
  jsonb_build_object(
    'preferredContactMethod', customer.preferred_contact_method,
    'defaultTerms', customer.default_terms
  ),
  customer.created_at,
  customer.updated_at
FROM customers customer
WHERE customer.contact_id IS NOT NULL
ON CONFLICT (contact_id, role) DO UPDATE SET
  status = EXCLUDED.status,
  details = EXCLUDED.details,
  updated_at = EXCLUDED.updated_at;

INSERT INTO contact_methods (
  contact_id,
  account_id,
  kind,
  label,
  value,
  normalized_value,
  is_primary,
  created_at,
  updated_at
)
SELECT
  customer.contact_id,
  customer.account_id,
  'email',
  'work',
  customer.email,
  lower(trim(customer.email)),
  true,
  customer.created_at,
  customer.updated_at
FROM customers customer
WHERE customer.contact_id IS NOT NULL
  AND trim(customer.email) <> ''
ON CONFLICT (contact_id, kind, normalized_value) DO NOTHING;

INSERT INTO contact_methods (
  contact_id,
  account_id,
  kind,
  label,
  value,
  normalized_value,
  is_primary,
  created_at,
  updated_at
)
SELECT
  customer.contact_id,
  customer.account_id,
  'phone',
  'mobile',
  customer.phone,
  regexp_replace(customer.phone, '[^0-9]', '', 'g'),
  true,
  customer.created_at,
  customer.updated_at
FROM customers customer
WHERE customer.contact_id IS NOT NULL
  AND regexp_replace(customer.phone, '[^0-9]', '', 'g') <> ''
ON CONFLICT (contact_id, kind, normalized_value) DO NOTHING;

INSERT INTO contact_addresses (
  contact_id,
  account_id,
  kind,
  label,
  address,
  is_primary,
  created_at,
  updated_at
)
SELECT
  customer.contact_id,
  customer.account_id,
  'billing',
  'Billing',
  customer.billing_address,
  true,
  customer.created_at,
  customer.updated_at
FROM customers customer
WHERE customer.contact_id IS NOT NULL
  AND trim(customer.billing_address) <> '';

INSERT INTO contact_addresses (
  contact_id,
  account_id,
  kind,
  label,
  address,
  is_primary,
  created_at,
  updated_at
)
SELECT
  customer.contact_id,
  customer.account_id,
  'service',
  'Service',
  customer.service_address,
  true,
  customer.created_at,
  customer.updated_at
FROM customers customer
WHERE customer.contact_id IS NOT NULL
  AND trim(customer.service_address) <> '';

WITH candidate_matches AS (
  SELECT
    record.id AS network_record_id,
    min(method.contact_id::text)::uuid AS contact_id,
    count(DISTINCT method.contact_id) AS match_count
  FROM network_records record
  INNER JOIN contact_methods method
    ON method.account_id = record.account_id
   AND (
     (
       method.kind = 'email'
       AND lower(trim(COALESCE(record.payload->>'email', ''))) <> ''
       AND method.normalized_value =
         lower(trim(COALESCE(record.payload->>'email', '')))
     )
     OR (
       method.kind = 'phone'
       AND regexp_replace(
         COALESCE(record.payload->>'phone', ''),
         '[^0-9]',
         '',
         'g'
       ) <> ''
       AND method.normalized_value = regexp_replace(
         COALESCE(record.payload->>'phone', ''),
         '[^0-9]',
         '',
         'g'
       )
     )
   )
  WHERE record.record_type = 'crew_member'
    AND record.deleted_at IS NULL
  GROUP BY record.id
)
UPDATE network_records record
SET contact_id = candidate.contact_id
FROM candidate_matches candidate
WHERE record.id = candidate.network_record_id
  AND candidate.match_count = 1
  AND record.contact_id IS NULL;

INSERT INTO contacts (
  id,
  account_id,
  entity_type,
  name,
  company,
  notes,
  status,
  created_at,
  updated_at
)
SELECT
  record.id,
  record.account_id,
  CASE
    WHEN trim(COALESCE(record.payload->>'company', '')) <> ''
      THEN 'company'
    ELSE 'person'
  END,
  left(
    COALESCE(
      NULLIF(trim(record.payload->>'name'), ''),
      record.title
    ),
    160
  ),
  left(COALESCE(record.payload->>'company', ''), 160),
  left(COALESCE(record.payload->>'notes', ''), 4000),
  CASE
    WHEN record.status = 'unavailable' THEN 'archived'
    ELSE 'active'
  END,
  record.created_at,
  record.updated_at
FROM network_records record
WHERE record.record_type = 'crew_member'
  AND record.deleted_at IS NULL
  AND record.contact_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE network_records
SET contact_id = id
WHERE record_type = 'crew_member'
  AND deleted_at IS NULL
  AND contact_id IS NULL;

INSERT INTO contact_roles (
  contact_id,
  account_id,
  role,
  status,
  details,
  created_at,
  updated_at
)
SELECT
  record.contact_id,
  record.account_id,
  CASE
    WHEN record.payload->>'type' = 'sub' THEN 'subcontractor'
    ELSE 'crew'
  END,
  'active',
  jsonb_strip_nulls(jsonb_build_object(
    'trade', NULLIF(record.payload->>'trade', ''),
    'license', NULLIF(record.payload->>'license', ''),
    'licenseExpiry', NULLIF(record.payload->>'licenseExpiry', ''),
    'hourlyRate', record.payload->'hourlyRate',
    'availability', COALESCE(
      NULLIF(record.payload->>'availability', ''),
      record.status
    ),
    'currentJobId', NULLIF(record.payload->>'currentJobId', '')
  )),
  record.created_at,
  record.updated_at
FROM network_records record
WHERE record.record_type = 'crew_member'
  AND record.deleted_at IS NULL
  AND record.contact_id IS NOT NULL
ON CONFLICT (contact_id, role) DO UPDATE SET
  status = EXCLUDED.status,
  details = contact_roles.details || EXCLUDED.details,
  updated_at = GREATEST(contact_roles.updated_at, EXCLUDED.updated_at);

INSERT INTO contact_methods (
  contact_id,
  account_id,
  kind,
  label,
  value,
  normalized_value,
  is_primary,
  created_at,
  updated_at
)
SELECT
  record.contact_id,
  record.account_id,
  'email',
  'work',
  record.payload->>'email',
  lower(trim(record.payload->>'email')),
  NOT EXISTS (
    SELECT 1
    FROM contact_methods existing
    WHERE existing.contact_id = record.contact_id
      AND existing.kind = 'email'
      AND existing.is_primary
  ),
  record.created_at,
  record.updated_at
FROM network_records record
WHERE record.record_type = 'crew_member'
  AND record.deleted_at IS NULL
  AND record.contact_id IS NOT NULL
  AND trim(COALESCE(record.payload->>'email', '')) <> ''
ON CONFLICT (contact_id, kind, normalized_value) DO NOTHING;

INSERT INTO contact_methods (
  contact_id,
  account_id,
  kind,
  label,
  value,
  normalized_value,
  is_primary,
  created_at,
  updated_at
)
SELECT
  record.contact_id,
  record.account_id,
  'phone',
  'mobile',
  record.payload->>'phone',
  regexp_replace(record.payload->>'phone', '[^0-9]', '', 'g'),
  NOT EXISTS (
    SELECT 1
    FROM contact_methods existing
    WHERE existing.contact_id = record.contact_id
      AND existing.kind = 'phone'
      AND existing.is_primary
  ),
  record.created_at,
  record.updated_at
FROM network_records record
WHERE record.record_type = 'crew_member'
  AND record.deleted_at IS NULL
  AND record.contact_id IS NOT NULL
  AND regexp_replace(
    COALESCE(record.payload->>'phone', ''),
    '[^0-9]',
    '',
    'g'
  ) <> ''
ON CONFLICT (contact_id, kind, normalized_value) DO NOTHING;

INSERT INTO contacts (
  id,
  account_id,
  entity_type,
  name,
  company,
  notes,
  favorite,
  status,
  linked_account_id,
  last_used_at,
  created_at,
  updated_at
)
SELECT
  archive.contact_id,
  archive.account_id,
  archive.snapshot->>'entityType',
  archive.snapshot->>'name',
  COALESCE(archive.snapshot->>'company', ''),
  COALESCE(archive.snapshot->>'notes', ''),
  COALESCE((archive.snapshot->>'favorite')::boolean, false),
  COALESCE(archive.snapshot->>'status', 'active'),
  NULLIF(archive.snapshot->>'linkedAccountId', '')::uuid,
  NULLIF(archive.snapshot->>'lastUsedAt', '')::timestamptz,
  COALESCE(
    NULLIF(archive.snapshot->>'createdAt', '')::timestamptz,
    now()
  ),
  COALESCE(
    NULLIF(archive.snapshot->>'updatedAt', '')::timestamptz,
    now()
  )
FROM contact_rollback_archive archive
ON CONFLICT (id) DO UPDATE SET
  entity_type = EXCLUDED.entity_type,
  name = EXCLUDED.name,
  company = EXCLUDED.company,
  notes = EXCLUDED.notes,
  favorite = EXCLUDED.favorite,
  status = EXCLUDED.status,
  linked_account_id = EXCLUDED.linked_account_id,
  last_used_at = EXCLUDED.last_used_at,
  updated_at = EXCLUDED.updated_at;

-- A rollback archive is authoritative for contacts that existed only in the
-- canonical directory. Reapplying the migration may have recreated some child
-- rows through the legacy customer/crew backfills, so clear those rows before
-- restoring their stable ids and primary flags from the archive.
DELETE FROM contact_roles
WHERE contact_id IN (
  SELECT contact_id FROM contact_rollback_archive
);

DELETE FROM contact_methods
WHERE contact_id IN (
  SELECT contact_id FROM contact_rollback_archive
);

DELETE FROM contact_addresses
WHERE contact_id IN (
  SELECT contact_id FROM contact_rollback_archive
);

DELETE FROM contact_tags
WHERE contact_id IN (
  SELECT contact_id FROM contact_rollback_archive
);

INSERT INTO contact_roles (
  contact_id,
  account_id,
  role,
  status,
  details,
  created_at,
  updated_at
)
SELECT
  archive.contact_id,
  archive.account_id,
  role_item->>'role',
  COALESCE(role_item->>'status', 'active'),
  COALESCE(role_item->'details', '{}'::jsonb),
  COALESCE(
    NULLIF(role_item->>'createdAt', '')::timestamptz,
    now()
  ),
  COALESCE(
    NULLIF(role_item->>'updatedAt', '')::timestamptz,
    now()
  )
FROM contact_rollback_archive archive
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(archive.snapshot->'roles', '[]'::jsonb)
) role_item
ON CONFLICT (contact_id, role) DO UPDATE SET
  status = EXCLUDED.status,
  details = EXCLUDED.details,
  updated_at = EXCLUDED.updated_at;

INSERT INTO contact_methods (
  id,
  contact_id,
  account_id,
  kind,
  label,
  value,
  normalized_value,
  is_primary,
  created_at,
  updated_at
)
SELECT
  (method_item->>'id')::uuid,
  archive.contact_id,
  archive.account_id,
  method_item->>'kind',
  COALESCE(method_item->>'label', ''),
  method_item->>'value',
  method_item->>'normalizedValue',
  COALESCE((method_item->>'isPrimary')::boolean, false),
  COALESCE(
    NULLIF(method_item->>'createdAt', '')::timestamptz,
    now()
  ),
  COALESCE(
    NULLIF(method_item->>'updatedAt', '')::timestamptz,
    now()
  )
FROM contact_rollback_archive archive
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(archive.snapshot->'methods', '[]'::jsonb)
) method_item
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  normalized_value = EXCLUDED.normalized_value,
  is_primary = EXCLUDED.is_primary,
  updated_at = EXCLUDED.updated_at;

INSERT INTO contact_addresses (
  id,
  contact_id,
  account_id,
  kind,
  label,
  address,
  is_primary,
  created_at,
  updated_at
)
SELECT
  (address_item->>'id')::uuid,
  archive.contact_id,
  archive.account_id,
  address_item->>'kind',
  COALESCE(address_item->>'label', ''),
  address_item->>'address',
  COALESCE((address_item->>'isPrimary')::boolean, false),
  COALESCE(
    NULLIF(address_item->>'createdAt', '')::timestamptz,
    now()
  ),
  COALESCE(
    NULLIF(address_item->>'updatedAt', '')::timestamptz,
    now()
  )
FROM contact_rollback_archive archive
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(archive.snapshot->'addresses', '[]'::jsonb)
) address_item
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  address = EXCLUDED.address,
  is_primary = EXCLUDED.is_primary,
  updated_at = EXCLUDED.updated_at;

INSERT INTO contact_tags (contact_id, account_id, tag, created_at)
SELECT
  archive.contact_id,
  archive.account_id,
  lower(trim(tag_item #>> '{}')),
  now()
FROM contact_rollback_archive archive
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(archive.snapshot->'tags', '[]'::jsonb)
) tag_item
WHERE trim(tag_item #>> '{}') <> ''
ON CONFLICT (contact_id, tag) DO NOTHING;

DROP TABLE contact_rollback_archive;
