ALTER TABLE uploads
  DROP CONSTRAINT IF EXISTS uploads_storage_scope_check;

ALTER TABLE uploads
  ADD CONSTRAINT uploads_storage_scope_check
  CHECK (storage_scope IN ('legacy', 'project', 'album', 'shop-talk', 'document-brand'));

CREATE TABLE document_brand_profiles (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT '' CHECK (char_length(business_name) <= 160),
  business_email text NOT NULL DEFAULT '' CHECK (char_length(business_email) <= 320),
  business_phone text NOT NULL DEFAULT '' CHECK (char_length(business_phone) <= 40),
  business_address text NOT NULL DEFAULT '' CHECK (char_length(business_address) <= 500),
  website text NOT NULL DEFAULT '' CHECK (char_length(website) <= 500),
  license_number text NOT NULL DEFAULT '' CHECK (char_length(license_number) <= 120),
  estimate_style text NOT NULL DEFAULT 'classic'
    CHECK (estimate_style IN ('classic', 'compact', 'field')),
  invoice_style text NOT NULL DEFAULT 'classic'
    CHECK (invoice_style IN ('classic', 'compact', 'field')),
  show_contact boolean NOT NULL DEFAULT true,
  show_address boolean NOT NULL DEFAULT true,
  show_license boolean NOT NULL DEFAULT true,
  logo_upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tool_records
  DROP CONSTRAINT IF EXISTS tool_records_record_type_check;

ALTER TABLE tool_records
  ADD CONSTRAINT tool_records_record_type_check CHECK (
    record_type IN (
      'payment_record',
      'invoice_template',
      'estimate_template',
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
