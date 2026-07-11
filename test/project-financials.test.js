import assert from "node:assert/strict";
import test from "node:test";
import { invoiceSubtotalCents, mapProjectInvoice } from "../server/project-financials.js";

test("project invoice totals use cents-exact line math", () => {
  assert.equal(invoiceSubtotalCents([
    { description: "Labor", quantity: 2.5, rateCents: 6_500 },
    { description: "Materials", quantity: 1, rateCents: 1_299 },
  ]), 17_549);
});

test("project invoice mapping exposes external-payment balance without claiming collection", () => {
  const invoice = mapProjectInvoice({
    id: "invoice-1",
    project_id: "project-1",
    active_work_id: "work-1",
    created_by_account_id: "account-1",
    invoice_number: "RIVT-1",
    status: "sent",
    line_items: [],
    source_estimate: {},
    subtotal_cents: 10_000,
    tax_cents: 500,
    total_cents: 10_500,
    created_at: "2026-07-10T00:00:00.000Z",
    updated_at: "2026-07-10T00:00:00.000Z",
  }, [{
    id: "payment-1",
    invoice_id: "invoice-1",
    project_id: "project-1",
    active_work_id: "work-1",
    recorded_by_account_id: "account-2",
    amount_cents: 4_000,
    payment_date: new Date("2026-07-10T00:00:00.000Z"),
    method: "Check",
    note: "External payment record",
    created_at: "2026-07-10T00:00:00.000Z",
  }]);

  assert.equal(invoice.paidCents, 4_000);
  assert.equal(invoice.balanceCents, 6_500);
  assert.equal(invoice.payments[0].paymentDate, "2026-07-10");
});
