INSERT INTO tool_records (
  account_id,
  record_type,
  local_id,
  title,
  status,
  record_date,
  payload
)
SELECT
  customer.account_id,
  'client',
  customer.legacy_local_id,
  left(
    CASE
      WHEN customer.company <> '' THEN customer.name || ' - ' || customer.company
      ELSE customer.name
    END,
    160
  ),
  customer.status,
  customer.created_at::date,
  jsonb_build_object(
    'id', customer.legacy_local_id,
    'name', customer.name,
    'company', customer.company,
    'phone', customer.phone,
    'email', customer.email,
    'billingAddress', customer.billing_address,
    'serviceAddress', customer.service_address,
    'notes', customer.notes,
    'preferredContactMethod', customer.preferred_contact_method,
    'defaultTerms', customer.default_terms,
    'favorite', customer.favorite,
    'status', customer.status,
    'createdAt', customer.created_at,
    'updatedAt', customer.updated_at,
    'lastUsedAt', customer.last_used_at,
    'threadMessages', customer.thread_messages
  )
FROM customers customer
ON CONFLICT (account_id, record_type, local_id) WHERE deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  payload = EXCLUDED.payload,
  updated_at = now();

UPDATE standalone_projects project
SET client_name = left(COALESCE(NULLIF(customer.company, ''), customer.name), 160)
FROM customers customer
WHERE project.customer_id = customer.id
  AND project.client_name = '';

DROP INDEX IF EXISTS standalone_projects_customer_idx;
ALTER TABLE standalone_projects DROP COLUMN IF EXISTS customer_id;

DROP INDEX IF EXISTS tool_records_customer_idx;
ALTER TABLE tool_records DROP COLUMN IF EXISTS customer_id;

DROP TABLE IF EXISTS customers;
