WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY account_id, contact_id, job_id, lower(trim(relationship_role))
      ORDER BY is_primary DESC, updated_at DESC, created_at DESC, id DESC
    ) AS position
  FROM contact_job_links
)
DELETE FROM contact_job_links link
USING ranked
WHERE link.id = ranked.id
  AND ranked.position > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY account_id, job_id, lower(trim(relationship_role))
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS position
  FROM contact_job_links
  WHERE is_primary
)
UPDATE contact_job_links link
SET is_primary = false,
    updated_at = now()
FROM ranked
WHERE link.id = ranked.id
  AND ranked.position > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY account_id, contact_id, standalone_project_id, lower(trim(relationship_role))
      ORDER BY is_primary DESC, updated_at DESC, created_at DESC, id DESC
    ) AS position
  FROM contact_project_links
)
DELETE FROM contact_project_links link
USING ranked
WHERE link.id = ranked.id
  AND ranked.position > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY account_id, standalone_project_id, lower(trim(relationship_role))
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS position
  FROM contact_project_links
  WHERE is_primary
)
UPDATE contact_project_links link
SET is_primary = false,
    updated_at = now()
FROM ranked
WHERE link.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX contact_job_links_role_identity_idx
  ON contact_job_links (
    account_id,
    contact_id,
    job_id,
    lower(trim(relationship_role))
  );

CREATE UNIQUE INDEX contact_job_links_one_primary_role_idx
  ON contact_job_links (
    account_id,
    job_id,
    lower(trim(relationship_role))
  )
  WHERE is_primary;

CREATE UNIQUE INDEX contact_project_links_role_identity_idx
  ON contact_project_links (
    account_id,
    contact_id,
    standalone_project_id,
    lower(trim(relationship_role))
  );

CREATE UNIQUE INDEX contact_project_links_one_primary_role_idx
  ON contact_project_links (
    account_id,
    standalone_project_id,
    lower(trim(relationship_role))
  )
  WHERE is_primary;
