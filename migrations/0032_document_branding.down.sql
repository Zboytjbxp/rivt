DELETE FROM tool_records WHERE record_type = 'estimate_template';

ALTER TABLE tool_records
  DROP CONSTRAINT IF EXISTS tool_records_record_type_check;

ALTER TABLE tool_records
  ADD CONSTRAINT tool_records_record_type_check CHECK (
    record_type IN (
      'payment_record',
      'invoice_template',
      'invoice_draft',
      'estimate',
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

DROP TABLE IF EXISTS document_brand_profiles;

UPDATE uploads
SET storage_scope = 'legacy'
WHERE storage_scope = 'document-brand';

ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN ('legacy', 'project', 'album', 'shop-talk'));
