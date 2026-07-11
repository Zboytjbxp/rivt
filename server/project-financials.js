import { z } from "./api.js";

const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(240),
  quantity: z.number().min(0).max(1_000_000),
  rateCents: z.number().int().min(0).max(1_000_000_000),
  kind: z.enum(["labor", "material", "other", "adjustment"]).default("other"),
});

export const projectInvoiceCreateSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(80),
  billTo: z.string().trim().max(240).default(""),
  payTo: z.string().trim().max(240).default(""),
  terms: z.string().trim().max(400).default(""),
  paymentMethod: z.string().trim().max(240).default(""),
  recipientEmail: z.string().trim().max(320).default(""),
  recipientPhone: z.string().trim().max(80).default(""),
  taxCents: z.number().int().min(0).max(1_000_000_000).default(0),
  lineItems: z.array(invoiceLineSchema).min(1).max(100),
  sourceEstimate: z.object({}).passthrough().default({}),
});

export const projectInvoiceStatusSchema = z.object({
  status: z.enum(["draft", "sent", "void"]),
});

export const projectInvoicePaymentSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_000),
  paymentDate: z.iso.date(),
  method: z.string().trim().max(120).default("Direct payment"),
  note: z.string().trim().max(1000).default(""),
});

export function invoiceSubtotalCents(lineItems) {
  return lineItems.reduce((total, line) => total + Math.round(line.quantity * line.rateCents), 0);
}

export function mapProjectInvoice(row, payments = []) {
  const paidCents = payments.reduce((total, payment) => total + Number(payment.amount_cents ?? payment.amountCents ?? 0), 0);
  const totalCents = Number(row.total_cents ?? row.totalCents ?? 0);
  return {
    id: row.id,
    projectId: row.project_id ?? row.projectId,
    activeWorkId: row.active_work_id ?? row.activeWorkId,
    createdByAccountId: row.created_by_account_id ?? row.createdByAccountId,
    invoiceNumber: row.invoice_number ?? row.invoiceNumber,
    billTo: row.bill_to ?? row.billTo ?? "",
    payTo: row.pay_to ?? row.payTo ?? "",
    terms: row.terms ?? "",
    paymentMethod: row.payment_method ?? row.paymentMethod ?? "",
    recipientEmail: row.recipient_email ?? row.recipientEmail ?? "",
    recipientPhone: row.recipient_phone ?? row.recipientPhone ?? "",
    status: row.status,
    lineItems: row.line_items ?? row.lineItems ?? [],
    sourceEstimate: row.source_estimate ?? row.sourceEstimate ?? {},
    subtotalCents: Number(row.subtotal_cents ?? row.subtotalCents ?? 0),
    taxCents: Number(row.tax_cents ?? row.taxCents ?? 0),
    totalCents,
    paidCents,
    balanceCents: Math.max(0, totalCents - paidCents),
    sentAt: toIso(row.sent_at ?? row.sentAt),
    paidAt: toIso(row.paid_at ?? row.paidAt),
    voidedAt: toIso(row.voided_at ?? row.voidedAt),
    createdAt: toIso(row.created_at ?? row.createdAt),
    updatedAt: toIso(row.updated_at ?? row.updatedAt),
    payments: payments.map(mapProjectInvoicePayment),
  };
}

export function mapProjectInvoicePayment(row) {
  return {
    id: row.id,
    invoiceId: row.invoice_id ?? row.invoiceId,
    projectId: row.project_id ?? row.projectId,
    activeWorkId: row.active_work_id ?? row.activeWorkId,
    recordedByAccountId: row.recorded_by_account_id ?? row.recordedByAccountId,
    amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
    paymentDate: toDate(row.payment_date ?? row.paymentDate),
    method: row.method ?? "",
    note: row.note ?? "",
    createdAt: toIso(row.created_at ?? row.createdAt),
  };
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
