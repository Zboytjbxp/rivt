CREATE TABLE IF NOT EXISTS contact_rollback_archive (
  contact_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  archived_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO contact_rollback_archive (
  contact_id,
  account_id,
  snapshot,
  archived_at
)
SELECT
  contact.id,
  contact.account_id,
  jsonb_build_object(
    'entityType', contact.entity_type,
    'name', contact.name,
    'company', contact.company,
    'notes', contact.notes,
    'favorite', contact.favorite,
    'status', contact.status,
    'linkedAccountId', contact.linked_account_id,
    'lastUsedAt', contact.last_used_at,
    'createdAt', contact.created_at,
    'updatedAt', contact.updated_at,
    'roles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'role', role.role,
        'status', role.status,
        'details', role.details,
        'createdAt', role.created_at,
        'updatedAt', role.updated_at
      ) ORDER BY role.role)
      FROM contact_roles role
      WHERE role.contact_id = contact.id
    ), '[]'::jsonb),
    'methods', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', method.id,
        'kind', method.kind,
        'label', method.label,
        'value', method.value,
        'normalizedValue', method.normalized_value,
        'isPrimary', method.is_primary,
        'createdAt', method.created_at,
        'updatedAt', method.updated_at
      ) ORDER BY method.kind, method.is_primary DESC, method.id)
      FROM contact_methods method
      WHERE method.contact_id = contact.id
    ), '[]'::jsonb),
    'addresses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', address.id,
        'kind', address.kind,
        'label', address.label,
        'address', address.address,
        'isPrimary', address.is_primary,
        'createdAt', address.created_at,
        'updatedAt', address.updated_at
      ) ORDER BY address.kind, address.is_primary DESC, address.id)
      FROM contact_addresses address
      WHERE address.contact_id = contact.id
    ), '[]'::jsonb),
    'tags', COALESCE((
      SELECT jsonb_agg(tag.tag ORDER BY tag.tag)
      FROM contact_tags tag
      WHERE tag.contact_id = contact.id
    ), '[]'::jsonb)
  ),
  now()
FROM contacts contact
ON CONFLICT (contact_id) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  snapshot = EXCLUDED.snapshot,
  archived_at = EXCLUDED.archived_at;

DROP INDEX IF EXISTS network_records_contact_idx;
ALTER TABLE network_records DROP COLUMN IF EXISTS contact_id;

DROP INDEX IF EXISTS customers_contact_idx;
ALTER TABLE customers DROP COLUMN IF EXISTS contact_id;

DROP TABLE IF EXISTS contact_project_links;
DROP TABLE IF EXISTS contact_job_links;
DROP TABLE IF EXISTS contact_tags;
DROP TABLE IF EXISTS contact_addresses;
DROP TABLE IF EXISTS contact_methods;
DROP TABLE IF EXISTS contact_roles;
DROP TABLE IF EXISTS contacts;
