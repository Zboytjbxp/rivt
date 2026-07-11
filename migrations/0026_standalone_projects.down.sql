ALTER TABLE tool_records DROP CONSTRAINT IF EXISTS tool_records_record_type_check;
ALTER TABLE tool_records ADD CONSTRAINT tool_records_record_type_check CHECK (
  record_type IN (
    'payment_record',
    'invoice_template',
    'expense',
    'mileage',
    'time_session',
    'bid',
    'price_book',
    'punch_item',
    'daily_report',
    'safety_check',
    'job_checklist',
    'client'
  )
);

DROP INDEX IF EXISTS photo_albums_standalone_project_idx;
ALTER TABLE photo_albums DROP COLUMN IF EXISTS standalone_project_id;

DROP INDEX IF EXISTS tool_records_active_work_idx;
DROP INDEX IF EXISTS tool_records_standalone_project_idx;
ALTER TABLE tool_records
  DROP CONSTRAINT IF EXISTS tool_records_single_context_check,
  DROP COLUMN IF EXISTS active_work_id,
  DROP COLUMN IF EXISTS standalone_project_id;

DROP INDEX IF EXISTS standalone_projects_account_updated_idx;
DROP TABLE IF EXISTS standalone_projects;
