CREATE TABLE project_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  created_by_account_id uuid NOT NULL REFERENCES accounts(id),
  invoice_number text NOT NULL CHECK (char_length(invoice_number) BETWEEN 1 AND 80),
  bill_to text NOT NULL DEFAULT '' CHECK (char_length(bill_to) <= 240),
  pay_to text NOT NULL DEFAULT '' CHECK (char_length(pay_to) <= 240),
  terms text NOT NULL DEFAULT '' CHECK (char_length(terms) <= 400),
  payment_method text NOT NULL DEFAULT '' CHECK (char_length(payment_method) <= 240),
  recipient_email text NOT NULL DEFAULT '' CHECK (char_length(recipient_email) <= 320),
  recipient_phone text NOT NULL DEFAULT '' CHECK (char_length(recipient_phone) <= 80),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(line_items) = 'array'),
  source_estimate jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_estimate) = 'object'),
  subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents integer NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0 AND total_cents = subtotal_cents + tax_cents),
  sent_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, invoice_number)
);

CREATE INDEX project_invoices_project_idx
  ON project_invoices (project_id, created_at DESC, id DESC);
CREATE INDEX project_invoices_active_work_idx
  ON project_invoices (active_work_id, status, updated_at DESC, id DESC);

CREATE TABLE project_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES project_invoices(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  active_work_id uuid NOT NULL REFERENCES active_work(id) ON DELETE CASCADE,
  recorded_by_account_id uuid NOT NULL REFERENCES accounts(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  payment_date date NOT NULL,
  method text NOT NULL DEFAULT '' CHECK (char_length(method) <= 120),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_invoice_payments_invoice_idx
  ON project_invoice_payments (invoice_id, payment_date DESC, created_at DESC, id DESC);
CREATE INDEX project_invoice_payments_project_idx
  ON project_invoice_payments (project_id, created_at DESC, id DESC);

CREATE TRIGGER project_invoice_payments_no_update
  BEFORE UPDATE OR DELETE ON project_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
