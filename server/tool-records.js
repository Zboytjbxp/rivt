import { createHash } from "node:crypto";
import { ApiError, asyncRoute, validate, z } from "./api.js";

const toolRecordTypeSchema = z.enum([
  "payment_record",
  "invoice_template",
  "estimate_template",
  "invoice_draft",
  "estimate",
  "expense",
  "mileage",
  "time_session",
  "bid",
  "price_book",
  "punch_item",
  "daily_report",
  "safety_check",
  "job_checklist",
  "client",
]);

const ACTIVE_INVOICE_PAYMENT_STATUSES = ["created", "open", "processing"];
const IMMUTABLE_INVOICE_PAYMENT_STATUSES = [
  "processing",
  "paid",
  "partially_refunded",
  "refunded",
  "disputed",
];
const CLIENT_INVOICE_STATUSES = new Set(["draft", "sent"]);

const localIdSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/);

const toolRecordQuerySchema = z.object({
  type: toolRecordTypeSchema.optional(),
});

const toolRecordParamsSchema = z.object({
  recordType: toolRecordTypeSchema,
  localId: localIdSchema,
});

const estimateSendParamsSchema = z.object({
  localId: localIdSchema,
});

const invoiceSendParamsSchema = z.object({
  localId: localIdSchema,
});

const toolRecordUpsertSchema = z.object({
  recordType: toolRecordTypeSchema,
  localId: localIdSchema,
  title: z.string().trim().min(1).max(160),
  status: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9 _.-]+$/).default("active"),
  recordDate: z.iso.date().nullable().optional().default(null),
  amountCents: z.number().int().min(0).max(1_000_000_000).nullable().optional().default(null),
  payload: z.object({}).passthrough().default({}),
  standaloneProjectId: z.uuid().nullable().optional().default(null),
  activeWorkId: z.uuid().nullable().optional().default(null),
  customerId: z.uuid().nullable().optional().default(null),
}).refine((value) => !(value.standaloneProjectId && value.activeWorkId), {
  message: "Choose either standalone work or RIVT work, not both.",
});

function mapToolRecord(row) {
  return {
    id: row.id,
    recordType: row.record_type,
    localId: row.local_id,
    title: row.title,
    status: row.status,
    recordDate: row.record_date ? row.record_date.toISOString().slice(0, 10) : null,
    amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
    standaloneProjectId: row.standalone_project_id ?? null,
    activeWorkId: row.active_work_id ?? null,
    customerId: row.customer_id ?? null,
    payload: row.payload ?? {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stripServerOwnedInvoicePayload(value) {
  const payload = { ...objectValue(value) };
  delete payload.bankPayment;
  delete payload.delivery;
  return payload;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function equivalentInvoicePayload(left, right) {
  return JSON.stringify(canonicalJson(stripServerOwnedInvoicePayload(left)))
    === JSON.stringify(canonicalJson(stripServerOwnedInvoicePayload(right)));
}

function requireVerifiedDeliveryActor(actor) {
  if (actor?.account?.status !== "active") {
    throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "Only an active RIVT account can deliver customer documents.");
  }
  if (!actor.account.emailVerified) {
    throw new ApiError(
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      "Verify your RIVT email before delivering customer documents.",
    );
  }
}

function textValue(value, fallback = "", maxLength = 400) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function integerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function stableDeliveryContentHash({ to, subject, text, html, attachments }) {
  return createHash("sha256")
    .update(JSON.stringify({
      to: String(to ?? "").trim().toLowerCase(),
      subject: String(subject ?? ""),
      text: String(text ?? ""),
      html: String(html ?? ""),
      attachments: Array.isArray(attachments) ? attachments : [],
    }))
    .digest("hex");
}

function expenseCsv(records) {
  const rows = records.map((record) => {
    const payload = objectValue(record.payload);
    return [
      record.record_date ? new Date(record.record_date).toISOString().slice(0, 10) : "",
      textValue(payload.category, "Other", 80),
      (integerValue(record.amount_cents) / 100).toFixed(2),
      textValue(payload.description, record.title, 400),
    ].map(escapeCsv).join(",");
  });
  return [["Date", "Category", "Amount", "Description"].map(escapeCsv).join(","), ...rows].join("\n");
}

function deliveryBrandFallback(actor) {
  return {
    businessName: actor.memberships?.find((membership) => ["owner", "admin"].includes(membership.role))?.organizationName
      || actor.profile.displayName
      || "RIVT member",
    businessEmail: actor.account.email || "",
    businessPhone: actor.profile.phoneE164 || "",
    businessAddress: "",
    website: "",
    licenseNumber: "",
    estimateStyle: "classic",
    invoiceStyle: "classic",
    showContact: true,
    showAddress: true,
    showLicense: true,
  };
}

const emailPalette = {
  accent: "#ff4b00",
  background: "#f5f5f2",
  border: "#deded8",
  ink: "#151515",
  muted: "#5f5f5a",
  paper: "#ffffff",
};

function brandContactParts(brand) {
  const parts = [];
  if (brand.showContact && brand.businessPhone) parts.push(brand.businessPhone);
  if (brand.showContact && brand.businessEmail) parts.push(brand.businessEmail);
  if (brand.showContact && brand.website) parts.push(brand.website);
  if (brand.showAddress && brand.businessAddress) parts.push(brand.businessAddress);
  if (brand.showLicense && brand.licenseNumber) parts.push(`License ${brand.licenseNumber}`);
  return parts;
}

function documentEmailShell({ brand, documentType, documentNumber, body, hasLogo }) {
  const style = documentType === "Estimate" ? brand.estimateStyle : brand.invoiceStyle;
  const logo = hasLogo
    ? `<img src="cid:rivt-document-logo" alt="${escapeHtml(brand.businessName)} logo" style="display:block;max-width:150px;max-height:58px;object-fit:contain;margin:0 0 12px">`
    : "";
  const contact = brandContactParts(brand);
  const contactHtml = contact.length
    ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.5">${contact.map(escapeHtml).join(" &middot; ")}</p>`
    : "";
  const headerStyles = style === "compact"
    ? `background:${emailPalette.paper};color:${emailPalette.ink};border-bottom:3px solid ${emailPalette.accent}`
    : style === "field"
      ? `background:${emailPalette.ink};color:${emailPalette.paper};border-top:5px solid ${emailPalette.accent}`
      : `background:${emailPalette.accent};color:${emailPalette.ink}`;
  const typeStyles = style === "compact"
    ? `color:${emailPalette.muted};font-size:12px;text-transform:uppercase;letter-spacing:.12em`
    : "font-size:12px;text-transform:uppercase;letter-spacing:.12em;opacity:.78";
  return `<!doctype html><html><body style="margin:0;background:${emailPalette.background};color:${emailPalette.ink};font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto;padding:28px"><section style="background:${emailPalette.paper};border:1px solid ${emailPalette.border};border-radius:12px;overflow:hidden"><header style="padding:22px 24px;${headerStyles}">${logo}<strong style="display:block;font-size:20px;letter-spacing:-.01em">${escapeHtml(brand.businessName)}</strong><span style="display:block;margin-top:5px;${typeStyles}">${documentType} ${escapeHtml(documentNumber)}</span>${contactHtml}</header><div style="padding:24px">${body}<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${emailPalette.border};color:${emailPalette.muted};font-size:11px">Created with RIVT.</p></div></section></main></body></html>`;
}

async function hasActiveProEntitlement(database, accountId) {
  const result = await database.query(
    `SELECT EXISTS (
       SELECT 1
       FROM billing_entitlements
       WHERE account_id = $1
         AND plan = 'pro'
         AND status IN ('active', 'trialing')
         AND (active_until IS NULL OR active_until > now())
     ) AS active`,
    [accountId],
  );
  return Boolean(result.rows[0]?.active);
}

function estimateDeliverySnapshot(record, actor, documentBrand = null) {
  const payload = objectValue(record.payload);
  const recipientEmail = textValue(payload.recipientEmail, "", 320).toLowerCase();
  if (!z.email().safeParse(recipientEmail).success) {
    throw new ApiError(422, "ESTIMATE_RECIPIENT_REQUIRED", "Add a valid customer email before sending this estimate.");
  }

  const totalCents = integerValue(record.amount_cents);
  if (totalCents <= 0) {
    throw new ApiError(422, "ESTIMATE_TOTAL_REQUIRED", "Add a price before sending this estimate.");
  }

  const snapshotLines = Array.isArray(payload.customerLines)
    ? payload.customerLines.map((line) => objectValue(line)).map((line) => ({
      description: textValue(line.description, "Estimate scope", 160),
      quantity: Math.max(0.01, Number(line.quantity) || 1),
      totalCents: integerValue(line.totalCents),
    })).filter((line) => line.totalCents > 0)
    : [];
  const lines = snapshotLines.length
    ? snapshotLines
    : [{ description: record.title, quantity: 1, totalCents }];
  const lineTotal = lines.reduce((sum, line) => sum + line.totalCents, 0);
  if (lineTotal !== totalCents) {
    throw new ApiError(409, "ESTIMATE_SNAPSHOT_OUT_OF_DATE", "Save the estimate again before sending it.");
  }

  return {
    recipientEmail,
    recipientName: textValue(payload.recipientName, "there", 160),
    estimateNumber: textValue(payload.estimateNumber, `EST-${record.id.slice(0, 8).toUpperCase()}`, 80),
    title: textValue(payload.scope, record.title, 320),
    note: textValue(payload.customerNote, "", 1_200),
    estimateDate: textValue(payload.estimateDate, record.record_date ? new Date(record.record_date).toISOString().slice(0, 10) : "", 20),
    validThrough: textValue(payload.validThrough, "", 20),
    senderName: textValue(documentBrand?.businessName, textValue(actor.profile.displayName, "RIVT member", 160), 160),
    brand: documentBrand ?? deliveryBrandFallback(actor),
    totalCents,
    lines,
  };
}

function estimateEmailContent(snapshot, attachments = []) {
  const validThrough = snapshot.validThrough ? `Valid through ${snapshot.validThrough}.` : "Review the scope and terms before accepting.";
  const lineText = snapshot.lines.map((line) => `- ${line.description}: ${formatCurrency(line.totalCents)}`).join("\n");
  const text = [
    `Hi ${snapshot.recipientName},`,
    "",
    `${snapshot.senderName} sent you estimate ${snapshot.estimateNumber}.`,
    snapshot.estimateDate ? `Estimate date: ${snapshot.estimateDate}` : "",
    `Scope: ${snapshot.title}`,
    "",
    lineText,
    "",
    `Estimated total: ${formatCurrency(snapshot.totalCents)}`,
    validThrough,
    snapshot.note ? `\nNote: ${snapshot.note}` : "",
    "",
    "This estimate is not a payment request. Contact the sender to discuss changes or confirm acceptance.",
  ].filter(Boolean).join("\n");
  const lineRows = snapshot.lines.map((line) => (
    `<tr><td style="padding:8px 0;border-bottom:1px solid #e7e7e7">${escapeHtml(line.description)}</td><td style="padding:8px 0;border-bottom:1px solid #e7e7e7;text-align:right;font-weight:700">${formatCurrency(line.totalCents)}</td></tr>`
  )).join("");
  const body = `<p style="margin:0 0 16px">Hi ${escapeHtml(snapshot.recipientName)},</p><p style="margin:0 0 6px"><strong>${escapeHtml(snapshot.senderName)}</strong> sent you an estimate for ${escapeHtml(snapshot.title)}.</p>${snapshot.estimateDate ? `<p style="margin:0 0 16px;color:${emailPalette.muted}">Estimate date: ${escapeHtml(snapshot.estimateDate)}</p>` : ""}<table role="presentation" width="100%" style="border-collapse:collapse;margin:18px 0">${lineRows}<tr><td style="padding-top:16px;font-size:17px;font-weight:700">Estimated total</td><td style="padding-top:16px;text-align:right;font-size:20px;font-weight:800">${formatCurrency(snapshot.totalCents)}</td></tr></table><p style="margin:18px 0 0;color:${emailPalette.muted}">${escapeHtml(validThrough)}</p>${snapshot.note ? `<p style="margin:12px 0 0"><strong>Note:</strong> ${escapeHtml(snapshot.note)}</p>` : ""}<p style="margin:24px 0 0;color:${emailPalette.muted};font-size:13px">This is an estimate, not a payment request. Contact the sender to discuss changes or confirm acceptance.</p>`;
  const html = documentEmailShell({
    brand: snapshot.brand,
    documentType: "Estimate",
    documentNumber: snapshot.estimateNumber,
    body,
    hasLogo: attachments.length > 0,
  });
  return { text, html };
}

function invoiceDeliverySnapshot(record, actor, bankPaymentUrl = null, documentBrand = null) {
  const payload = objectValue(record.payload);
  const recipientEmail = textValue(payload.recipientEmail, "", 320).toLowerCase();
  if (!z.email().safeParse(recipientEmail).success) {
    throw new ApiError(422, "INVOICE_RECIPIENT_REQUIRED", "Add a valid customer email before sending this invoice.");
  }

  const totalCents = integerValue(record.amount_cents);
  if (totalCents <= 0) {
    throw new ApiError(422, "INVOICE_TOTAL_REQUIRED", "Add an amount before sending this invoice.");
  }

  const lines = Array.isArray(payload.customerLines)
    ? payload.customerLines.map((line) => objectValue(line)).map((line) => ({
      description: textValue(line.description, "Line item", 160),
      quantity: Math.max(0.01, Number(line.quantity) || 1),
      totalCents: integerValue(line.totalCents),
    })).filter((line) => line.totalCents > 0)
    : [];
  const safeLines = lines.length ? lines : [{ description: record.title, quantity: 1, totalCents }];
  const subtotalCents = safeLines.reduce((sum, line) => sum + line.totalCents, 0);
  if (subtotalCents > totalCents) {
    throw new ApiError(409, "INVOICE_SNAPSHOT_OUT_OF_DATE", "Save the invoice again before sending it.");
  }
  const storedPaymentOptions = objectValue(payload.paymentOptions);
  const hasExplicitPaymentOptions = typeof storedPaymentOptions.bank === "boolean"
    || typeof storedPaymentOptions.outside === "boolean";
  const legacyPaymentMethod = textValue(payload.paymentMethod, "", 320);
  const bankRequested = hasExplicitPaymentOptions
    ? storedPaymentOptions.bank === true
    : Boolean(bankPaymentUrl || /bank payment|ach/i.test(legacyPaymentMethod));
  const outsideRequested = hasExplicitPaymentOptions
    ? storedPaymentOptions.outside === true
    : !bankRequested || Boolean(legacyPaymentMethod && !/^secure bank payment$/i.test(legacyPaymentMethod));
  const outsidePaymentInstructions = outsideRequested
    ? textValue(
      payload.outsidePaymentInstructions,
      legacyPaymentMethod.replace(/^secure bank payment(?:\s+or\s+)?/i, ""),
      320,
    )
    : "";
  if (bankRequested && !bankPaymentUrl) {
    throw new ApiError(409, "INVOICE_PAYMENT_LINK_REQUIRED", "Create a current bank-payment link before sending this invoice.");
  }
  if (outsideRequested && !outsidePaymentInstructions) {
    throw new ApiError(422, "INVOICE_PAYMENT_INSTRUCTIONS_REQUIRED", "Add the direct payment instructions before sending this invoice.");
  }
  if (!bankRequested && !outsideRequested) {
    throw new ApiError(422, "INVOICE_PAYMENT_OPTION_REQUIRED", "Choose at least one payment option before sending this invoice.");
  }
  const paymentOptions = [
    bankRequested ? "Secure bank payment" : "",
    outsideRequested ? outsidePaymentInstructions : "",
  ].filter(Boolean);

  return {
    recipientEmail,
    recipientName: textValue(payload.recipientName, "there", 160),
    invoiceNumber: textValue(payload.invoiceNumber, `RIVT-${record.id.slice(0, 8).toUpperCase()}`, 80),
    issueDate: textValue(payload.issueDate, record.record_date ? new Date(record.record_date).toISOString().slice(0, 10) : "", 20),
    dueDate: textValue(payload.dueDate, "", 20),
    note: textValue(payload.customerNote, "", 1_200),
    workLabel: textValue(payload.workLabel, record.title, 320),
    terms: textValue(payload.terms, "Due on receipt", 160),
    senderName: textValue(payload.payTo, textValue(documentBrand?.businessName, textValue(actor.profile.displayName, "RIVT member", 160), 160), 160),
    brand: documentBrand ?? deliveryBrandFallback(actor),
    paymentMethod: paymentOptions.join(" or "),
    bankPaymentOffered: bankRequested,
    outsidePaymentInstructions,
    bankPaymentUrl,
    totalCents,
    subtotalCents,
    taxCents: Math.max(0, totalCents - subtotalCents),
    lines: safeLines,
  };
}

function invoiceEmailContent(snapshot, attachments = []) {
  const lineText = snapshot.lines.map((line) => `- ${line.description}: ${formatCurrency(line.totalCents)}`).join("\n");
  const text = [
    `Hi ${snapshot.recipientName},`,
    "",
    `${snapshot.senderName} sent you invoice ${snapshot.invoiceNumber}.`,
    snapshot.issueDate ? `Invoice date: ${snapshot.issueDate}` : "",
    snapshot.dueDate ? `Due date: ${snapshot.dueDate}` : "",
    `Work: ${snapshot.workLabel}`,
    "",
    lineText,
    "",
    `Subtotal: ${formatCurrency(snapshot.subtotalCents)}`,
    `Tax: ${formatCurrency(snapshot.taxCents)}`,
    `Total due: ${formatCurrency(snapshot.totalCents)}`,
    `Terms: ${snapshot.terms}`,
    `Payment options: ${snapshot.paymentMethod}`,
    snapshot.note ? `Note: ${snapshot.note}` : "",
    snapshot.bankPaymentUrl ? `Pay securely from a US bank account: ${snapshot.bankPaymentUrl}` : "",
    snapshot.outsidePaymentInstructions ? `Other payment instructions: ${snapshot.outsidePaymentInstructions}` : "",
    "",
    snapshot.bankPaymentUrl ? "Bank payment is handled by Stripe for the sender. RIVT does not hold or protect job funds." : "",
    snapshot.outsidePaymentInstructions ? "Other payment is arranged directly with the sender." : "",
    "Reply to this email with any questions.",
  ].filter(Boolean).join("\n");
  const lineRows = snapshot.lines.map((line) => (
    `<tr><td style="padding:9px 0;border-bottom:1px solid #e7e7e7">${escapeHtml(line.description)}</td><td style="padding:9px 0;border-bottom:1px solid #e7e7e7;text-align:right;font-weight:700">${formatCurrency(line.totalCents)}</td></tr>`
  )).join("");
  const bankPaymentHtml = snapshot.bankPaymentUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(snapshot.bankPaymentUrl)}" style="display:inline-block;padding:13px 18px;border-radius:8px;background:#ff4b00;color:#111111;font-weight:700;text-decoration:none">Pay from a US bank account</a></p>`
    : "";
  const outsidePaymentHtml = snapshot.outsidePaymentInstructions
    ? `<p style="margin:14px 0 0"><strong>Other payment instructions:</strong> ${escapeHtml(snapshot.outsidePaymentInstructions)}</p>`
    : "";
  const boundaryCopy = [
    snapshot.bankPaymentUrl ? "Bank payment is handled by Stripe for the sender. RIVT does not hold or protect job funds." : "",
    snapshot.outsidePaymentInstructions ? "Other payment is arranged directly with the sender." : "",
    "Reply to this email with any questions.",
  ].filter(Boolean).join(" ");
  const body = `<p style="margin:0 0 16px">Hi ${escapeHtml(snapshot.recipientName)},</p><p style="margin:0 0 6px"><strong>${escapeHtml(snapshot.senderName)}</strong> sent you an invoice for ${escapeHtml(snapshot.workLabel)}.</p>${snapshot.issueDate ? `<p style="margin:0;color:${emailPalette.muted}">Invoice date: ${escapeHtml(snapshot.issueDate)}</p>` : ""}${snapshot.dueDate ? `<p style="margin:4px 0 16px;color:${emailPalette.muted}">Due date: ${escapeHtml(snapshot.dueDate)}</p>` : ""}<table role="presentation" width="100%" style="border-collapse:collapse;margin:18px 0">${lineRows}<tr><td style="padding-top:12px">Subtotal</td><td style="padding-top:12px;text-align:right">${formatCurrency(snapshot.subtotalCents)}</td></tr><tr><td style="padding-top:8px">Tax</td><td style="padding-top:8px;text-align:right">${formatCurrency(snapshot.taxCents)}</td></tr><tr><td style="padding-top:16px;font-size:17px;font-weight:700">Total due</td><td style="padding-top:16px;text-align:right;font-size:20px;font-weight:800">${formatCurrency(snapshot.totalCents)}</td></tr></table><p style="margin:18px 0 0"><strong>Terms:</strong> ${escapeHtml(snapshot.terms)}</p><p style="margin:8px 0 0"><strong>Payment options:</strong> ${escapeHtml(snapshot.paymentMethod)}</p>${snapshot.note ? `<p style="margin:12px 0 0"><strong>Note:</strong> ${escapeHtml(snapshot.note)}</p>` : ""}${bankPaymentHtml}${outsidePaymentHtml}<p style="margin:24px 0 0;color:${emailPalette.muted};font-size:13px">${escapeHtml(boundaryCopy)}</p>`;
  const html = documentEmailShell({
    brand: snapshot.brand,
    documentType: "Invoice",
    documentNumber: snapshot.invoiceNumber,
    body,
    hasLogo: attachments.length > 0,
  });
  return { text, html };
}

export function registerToolRecordRoutes({
  app,
  database,
  appOrigin = "http://localhost",
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
  sendTransactionalEmail,
  loadDocumentBrandForDelivery = null,
  createInAppNotification = null,
}) {
  app.get("/api/v1/tool-records/expenses/export.csv", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    if (!await hasActiveProEntitlement(database, request.actor.account.id)) {
      throw new ApiError(403, "PRO_REQUIRED", "Expense CSV export requires an active RIVT Pro subscription.");
    }
    const result = await database.query(
      `SELECT title, record_date, amount_cents, payload
       FROM tool_records
       WHERE account_id = $1
         AND record_type = 'expense'
         AND deleted_at IS NULL
       ORDER BY record_date DESC NULLS LAST, updated_at DESC, id DESC
       LIMIT 500`,
      [request.actor.account.id],
    );
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="rivt-expenses-${new Date().toISOString().slice(0, 10)}.csv"`);
    response.send(expenseCsv(result.rows));
  }));

  app.get("/api/v1/tool-records", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const input = validate(toolRecordQuerySchema, request.query);
    const params = [request.actor.account.id];
    let typeClause = "";
    let historyClause = "";
    let historyDays = null;
    if (input.type) {
      params.push(input.type);
      typeClause = `AND record_type = $${params.length}`;
    }
    if (input.type === "time_session" && !await hasActiveProEntitlement(database, request.actor.account.id)) {
      historyDays = 90;
      historyClause = "AND COALESCE(record_date, created_at::date) >= current_date - 90";
    }
    const result = await database.query(
      `SELECT *
       FROM tool_records
       WHERE account_id = $1
         AND deleted_at IS NULL
         ${typeClause}
         ${historyClause}
       ORDER BY updated_at DESC, id DESC
       LIMIT 500`,
      params,
    );
    response.json({
      data: { records: result.rows.map(mapToolRecord) },
      meta: { requestId: request.requestId, historyDays },
    });
  }));

  app.post("/api/v1/tool-records", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(toolRecordUpsertSchema, request.body);
    if (input.recordType === "payment_record") {
      throw new ApiError(
        410,
        "PAYMENT_RECORD_RETIRED",
        "Manual payment records are retired. Use the invoice and its verified payment status instead.",
      );
    }
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `tool-records.upsert:${input.recordType}:${input.localId}`,
      async (client) => {
        let existingInvoice = null;
        let persistedPayload = input.payload;
        let persistedStatus = input.status;
        if (input.recordType === "invoice_draft") {
          if (!CLIENT_INVOICE_STATUSES.has(input.status)) {
            throw new ApiError(
              422,
              "INVOICE_STATUS_SERVER_OWNED",
              "Payment and delivery states are recorded by RIVT. Save browser edits as a draft.",
            );
          }
          const incomingPayload = stripServerOwnedInvoicePayload(input.payload);
          persistedPayload = incomingPayload;
          persistedStatus = "draft";
          existingInvoice = (await client.query(
            `SELECT *
             FROM tool_records
             WHERE account_id = $1
               AND record_type = 'invoice_draft'
               AND local_id = $2
               AND deleted_at IS NULL
             FOR UPDATE`,
            [request.actor.account.id, input.localId],
          )).rows[0] ?? null;
          if (existingInvoice) {
            if (existingInvoice.status === "paid") {
              throw new ApiError(
                409,
                "INVOICE_PAYMENT_HISTORY_LOCKED",
                "A paid invoice cannot be edited. Start a new invoice for any correction or additional amount.",
              );
            }
            const immutablePayment = (await client.query(
              `SELECT status
               FROM tool_invoice_payment_requests
               WHERE tool_record_id = $1
                 AND status = ANY($2::text[])
               ORDER BY created_at DESC
               LIMIT 1
               FOR UPDATE`,
              [existingInvoice.id, IMMUTABLE_INVOICE_PAYMENT_STATUSES],
            )).rows[0] ?? null;
            if (immutablePayment?.status === "processing") {
              throw new ApiError(
                409,
                "BANK_PAYMENT_PROCESSING",
                "This ACH payment is processing. The invoice cannot be changed until it settles or fails.",
              );
            }
            if (immutablePayment) {
              throw new ApiError(
                409,
                "INVOICE_PAYMENT_HISTORY_LOCKED",
                "This invoice has bank-payment history and cannot be edited. Start a new invoice for a correction or additional amount.",
              );
            }
            const activePayment = (await client.query(
              `SELECT status, amount_cents
               FROM tool_invoice_payment_requests
               WHERE tool_record_id = $1
                 AND status = ANY($2::text[])
               ORDER BY created_at DESC
               LIMIT 1
               FOR UPDATE`,
              [existingInvoice.id, ACTIVE_INVOICE_PAYMENT_STATUSES.filter((status) => status !== "processing")],
            )).rows[0] ?? null;
            if (activePayment && Number(activePayment.amount_cents) !== Number(input.amountCents ?? 0)) {
              throw new ApiError(
                409,
                "BANK_PAYMENT_AMOUNT_CHANGED",
                "Cancel the existing bank-payment link before changing the invoice total.",
              );
            }

            const currentPayload = objectValue(existingInvoice.payload);
            const currentProjectInvoiceId = textValue(currentPayload.projectInvoiceId, "", 80);
            const incomingProjectInvoiceId = textValue(incomingPayload.projectInvoiceId, "", 80);
            if (z.uuid().safeParse(currentProjectInvoiceId).success
              && currentProjectInvoiceId !== incomingProjectInvoiceId) {
              throw new ApiError(
                409,
                "INVOICE_PROJECT_LINK_IMMUTABLE",
                "A saved job invoice cannot be relinked to a different project invoice.",
              );
            }
            persistedPayload = {
              ...incomingPayload,
              ...(currentPayload.bankPayment ? { bankPayment: currentPayload.bankPayment } : {}),
              ...(currentPayload.delivery ? { delivery: currentPayload.delivery } : {}),
            };
            if (
              objectValue(currentPayload.delivery).status === "sent"
              && equivalentInvoicePayload(currentPayload, incomingPayload)
            ) {
              persistedStatus = "sent";
            }
          }
        }
        if (input.standaloneProjectId) {
          const ownedProject = await client.query(
            "SELECT id FROM standalone_projects WHERE id = $1 AND account_id = $2 AND status = 'active'",
            [input.standaloneProjectId, request.actor.account.id],
          );
          if (!ownedProject.rowCount) {
            throw new ApiError(403, "STANDALONE_PROJECT_ACCESS_DENIED", "You cannot save records to that standalone project.");
          }
        }
        if (input.activeWorkId) {
          const participant = await client.query(
            "SELECT 1 FROM work_participants WHERE active_work_id = $1 AND account_id = $2",
            [input.activeWorkId, request.actor.account.id],
          );
          if (!participant.rowCount) {
            throw new ApiError(403, "ACTIVE_WORK_ACCESS_DENIED", "You cannot save records to that RIVT workspace.");
          }
          if (input.recordType === "invoice_draft") {
            const projectInvoiceId = textValue(objectValue(persistedPayload).projectInvoiceId, "", 80);
            if (!z.uuid().safeParse(projectInvoiceId).success) {
              throw new ApiError(
                409,
                "INVOICE_PROJECT_LINK_REQUIRED",
                "Create the job invoice record before saving this draft. No payment amount was changed.",
              );
            }
            const linkedProjectInvoice = (await client.query(
              `SELECT pi.status, pi.total_cents,
                      payment_request.status AS payment_status
               FROM project_invoices pi
               LEFT JOIN LATERAL (
                 SELECT request.status
                 FROM project_invoice_payment_requests request
                 WHERE request.invoice_id = pi.id
                   AND request.status = ANY($4::text[])
                 ORDER BY request.created_at DESC
                 LIMIT 1
               ) payment_request ON true
               WHERE pi.id = $1
                 AND pi.active_work_id = $2
                 AND pi.created_by_account_id = $3
               FOR UPDATE OF pi`,
              [
                projectInvoiceId,
                input.activeWorkId,
                request.actor.account.id,
                IMMUTABLE_INVOICE_PAYMENT_STATUSES,
              ],
            )).rows[0] ?? null;
            if (!linkedProjectInvoice) {
              throw new ApiError(
                409,
                "INVOICE_PROJECT_OUT_OF_DATE",
                "The linked job invoice could not be verified. Reopen the invoice from the job before saving.",
              );
            }
            if (linkedProjectInvoice.status === "void") {
              throw new ApiError(409, "PROJECT_INVOICE_VOID", "A void job invoice cannot be edited.");
            }
            if (linkedProjectInvoice.status === "paid") {
              throw new ApiError(
                409,
                "INVOICE_PAYMENT_HISTORY_LOCKED",
                "A paid job invoice cannot be edited. Start a new invoice for a correction or additional amount.",
              );
            }
            if (linkedProjectInvoice.payment_status === "processing") {
              throw new ApiError(
                409,
                "BANK_PAYMENT_PROCESSING",
                "This ACH payment is processing. The invoice cannot be changed until it settles or fails.",
              );
            }
            if (linkedProjectInvoice.payment_status) {
              throw new ApiError(
                409,
                "INVOICE_PAYMENT_HISTORY_LOCKED",
                "This job invoice has bank-payment history and cannot be edited. Start a new invoice for a correction or additional amount.",
              );
            }
            if (Number(linkedProjectInvoice.total_cents) !== Number(input.amountCents ?? 0)) {
              throw new ApiError(
                409,
                "INVOICE_PROJECT_TOTAL_MISMATCH",
                "The saved draft and job invoice totals differ. Reopen the invoice from the job before saving.",
              );
            }
          }
        }
        if (input.customerId) {
          const ownedCustomer = await client.query(
            "SELECT id FROM customers WHERE id = $1 AND account_id = $2 AND status = 'active'",
            [input.customerId, request.actor.account.id],
          );
          if (!ownedCustomer.rowCount) {
            throw new ApiError(403, "CUSTOMER_ACCESS_DENIED", "You cannot save records to that customer.");
          }
        }
        const supplierContactId = input.recordType === "price_book"
          && typeof input.payload.supplierContactId === "string"
          ? input.payload.supplierContactId.trim()
          : "";
        if (supplierContactId) {
          const parsedSupplierId = z.uuid().safeParse(supplierContactId);
          if (!parsedSupplierId.success) {
            throw new ApiError(400, "SUPPLIER_CONTACT_INVALID", "Choose a valid saved supplier.");
          }
          const ownedSupplier = await client.query(
            `SELECT 1
             FROM contacts contact
             INNER JOIN contact_roles role
               ON role.contact_id = contact.id
              AND role.account_id = contact.account_id
              AND role.role = 'supplier'
              AND role.status = 'active'
             WHERE contact.id = $1
               AND contact.account_id = $2
               AND contact.status = 'active'`,
            [parsedSupplierId.data, request.actor.account.id],
          );
          if (!ownedSupplier.rowCount) {
            throw new ApiError(403, "SUPPLIER_CONTACT_ACCESS_DENIED", "You cannot save prices to that supplier.");
          }
        }
        const upserted = await client.query(
          `INSERT INTO tool_records (
             account_id, record_type, local_id, title, status, record_date, amount_cents, payload,
             standalone_project_id, active_work_id, customer_id
           ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8::jsonb, $9, $10, $11)
           ON CONFLICT (account_id, record_type, local_id) WHERE deleted_at IS NULL
           DO UPDATE SET title = EXCLUDED.title,
                         status = EXCLUDED.status,
                         record_date = EXCLUDED.record_date,
                         amount_cents = EXCLUDED.amount_cents,
                          payload = EXCLUDED.payload,
                          standalone_project_id = EXCLUDED.standalone_project_id,
                          active_work_id = EXCLUDED.active_work_id,
                          customer_id = EXCLUDED.customer_id,
                          updated_at = now()
           RETURNING *`,
          [
            request.actor.account.id,
            input.recordType,
            input.localId,
            input.title,
            persistedStatus,
            input.recordDate,
            input.amountCents,
            JSON.stringify(persistedPayload),
            input.standaloneProjectId,
            input.activeWorkId,
            input.customerId,
          ],
        );
        return {
          status: 200,
          body: {
            data: { record: mapToolRecord(upserted.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.post("/api/v1/estimates/:localId/send", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    requireVerifiedDeliveryActor(request.actor);
    const params = validate(estimateSendParamsSchema, request.params);
    const idempotencyKey = String(request.headers["idempotency-key"] ?? "").trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Use a valid Idempotency-Key for this request.");
    }

    const existing = await database.query(
      `SELECT *
       FROM tool_records
       WHERE account_id = $1
         AND record_type = 'estimate'
         AND local_id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [request.actor.account.id, params.localId],
    );
    if (!existing.rowCount) {
      throw new ApiError(404, "ESTIMATE_NOT_FOUND", "Save this estimate to your RIVT account before sending it.");
    }

    const record = existing.rows[0];
    const existingPayload = objectValue(record.payload);
    const previousDelivery = objectValue(existingPayload.delivery);
    if (previousDelivery.idempotencyKey === idempotencyKey && previousDelivery.status === "sent") {
      response.setHeader("Idempotent-Replayed", "true");
      response.json({
        data: { record: mapToolRecord(record), replayed: true },
        meta: { requestId: request.requestId },
      });
      return;
    }

    const brandDelivery = loadDocumentBrandForDelivery
      ? await loadDocumentBrandForDelivery(request.actor)
      : { brand: deliveryBrandFallback(request.actor), attachments: [] };
    const snapshot = estimateDeliverySnapshot(record, request.actor, brandDelivery.brand);
    const attemptedAt = new Date().toISOString();
    const attemptCount = integerValue(previousDelivery.attemptCount) + 1;
    const message = estimateEmailContent(snapshot, brandDelivery.attachments);
    let delivery;
    try {
      delivery = await sendTransactionalEmail({
        to: snapshot.recipientEmail,
        subject: `${snapshot.senderName} sent estimate ${snapshot.estimateNumber}`,
        ...message,
        attachments: brandDelivery.attachments,
        idempotencyKey: `estimate-${record.id}-${idempotencyKey}`.slice(0, 255),
      });
    } catch (error) {
      const failurePayload = {
        ...existingPayload,
        delivery: {
          ...previousDelivery,
          status: "failed",
          recipientEmail: snapshot.recipientEmail,
          attemptedAt,
          attemptCount,
          lastErrorCode: error instanceof ApiError ? error.code : "EMAIL_DELIVERY_FAILED",
        },
      };
      await database.query(
        `UPDATE tool_records
         SET status = 'delivery_failed', payload = $3::jsonb, updated_at = now()
         WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [request.actor.account.id, record.id, JSON.stringify(failurePayload)],
      );
      throw error;
    }

    const sentPayload = {
      ...existingPayload,
      delivery: {
        status: "sent",
        recipientEmail: snapshot.recipientEmail,
        attemptedAt,
        sentAt: attemptedAt,
        attemptCount,
        provider: delivery.provider,
        providerMessageId: delivery.id,
        idempotencyKey,
        documentFingerprint: textValue(existingPayload.documentFingerprint, "", 20_000),
      },
    };
    const updated = await database.query(
      `UPDATE tool_records
       SET status = 'sent', payload = $3::jsonb, updated_at = now()
       WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [request.actor.account.id, record.id, JSON.stringify(sentPayload)],
    );
    response.json({
      data: { record: mapToolRecord(updated.rows[0]), replayed: false },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/invoices/:localId/send", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    requireVerifiedDeliveryActor(request.actor);
    const params = validate(invoiceSendParamsSchema, request.params);
    const idempotencyKey = String(request.headers["idempotency-key"] ?? "").trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Use a valid Idempotency-Key for this request.");
    }
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `tool-records.invoice.send:${params.localId}`,
      async (client) => {
    const existing = await client.query(
      `SELECT * FROM tool_records
       WHERE account_id = $1 AND record_type = 'invoice_draft' AND local_id = $2 AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [request.actor.account.id, params.localId],
    );
    if (!existing.rowCount) {
      throw new ApiError(404, "INVOICE_NOT_FOUND", "Save this invoice to your RIVT account before sending it.");
    }
    const record = existing.rows[0];
    const payload = objectValue(record.payload);
    const previousDelivery = objectValue(payload.delivery);
    if (previousDelivery.idempotencyKey === idempotencyKey && previousDelivery.status === "sent") {
      return {
        status: 200,
        body: {
          data: { record: mapToolRecord(record), replayed: true },
          meta: { requestId: request.requestId },
        },
      };
    }
    if (record.status === "paid") {
      throw new ApiError(
        409,
        "INVOICE_PAYMENT_HISTORY_LOCKED",
        "This invoice is already paid. Keep it as a payment record instead of sending it as unpaid.",
      );
    }
    const projectInvoiceId = textValue(payload.projectInvoiceId, "", 80);
    let bankPaymentUrl = null;
    let validatedProjectInvoiceId = null;
    if (record.active_work_id && !z.uuid().safeParse(projectInvoiceId).success) {
      throw new ApiError(
        409,
        "INVOICE_PROJECT_LINK_REQUIRED",
        "This RIVT job invoice is not linked to its project record. Save it again before sending.",
      );
    }
    if (record.active_work_id) {
      const lockedProjectInvoice = await client.query(
        `SELECT id
         FROM project_invoices
         WHERE id = $1
           AND active_work_id = $2
           AND created_by_account_id = $3
         FOR UPDATE`,
        [projectInvoiceId, record.active_work_id, request.actor.account.id],
      );
      if (!lockedProjectInvoice.rowCount) {
        throw new ApiError(
          409,
          "INVOICE_PROJECT_OUT_OF_DATE",
          "The linked project invoice could not be verified. Save the invoice again before sending.",
        );
      }
      await client.query(
        `SELECT id
         FROM project_invoice_payment_requests
         WHERE invoice_id = $1
         ORDER BY id
         FOR UPDATE`,
        [projectInvoiceId],
      );
      const paymentLink = await client.query(
        `SELECT pir.id, pir.amount_cents AS request_amount_cents,
                pi.total_cents AS invoice_total_cents, pi.status AS invoice_status,
                payment_lock.status AS payment_lock_status,
                GREATEST(
                  0,
                  pi.total_cents
                    - COALESCE((
                      SELECT sum(payment.amount_cents)
                      FROM project_invoice_payments payment
                      WHERE payment.invoice_id = pi.id
                    ), 0)
                    - COALESCE((
                      SELECT sum(
                        CASE WHEN settled.status IN ('paid', 'partially_refunded')
                          THEN settled.amount_cents - settled.refunded_cents
                          ELSE 0
                        END
                      )
                      FROM project_invoice_payment_requests settled
                      WHERE settled.invoice_id = pi.id
                    ), 0)
                ) AS invoice_balance_cents
         FROM project_invoices pi
         LEFT JOIN LATERAL (
           SELECT request.id, request.amount_cents
           FROM project_invoice_payment_requests request
           WHERE request.invoice_id = pi.id
             AND request.status = 'open'
             AND request.checkout_url LIKE 'https://checkout.stripe.com/%'
           ORDER BY request.created_at DESC
           LIMIT 1
         ) pir ON true
         LEFT JOIN LATERAL (
           SELECT request.status
           FROM project_invoice_payment_requests request
           WHERE request.invoice_id = pi.id
             AND request.status = ANY($4::text[])
           ORDER BY request.created_at DESC
           LIMIT 1
         ) payment_lock ON true
         WHERE pi.id = $1
           AND pi.active_work_id = $2
           AND pi.created_by_account_id = $3
         LIMIT 1
         FOR UPDATE OF pi`,
        [
          projectInvoiceId,
          record.active_work_id,
          request.actor.account.id,
          IMMUTABLE_INVOICE_PAYMENT_STATUSES,
        ],
      );
      if (paymentLink.rowCount) {
        const link = paymentLink.rows[0];
        if (link.invoice_status === "void") {
          throw new ApiError(409, "PROJECT_INVOICE_VOID", "A void project invoice cannot be sent for payment.");
        }
        if (link.payment_lock_status === "processing") {
          throw new ApiError(
            409,
            "BANK_PAYMENT_PROCESSING",
            "This ACH payment is processing. Wait for it to settle or fail before sending another invoice.",
          );
        }
        if (link.payment_lock_status === "disputed") {
          throw new ApiError(
            409,
            "BANK_PAYMENT_DISPUTED",
            "This invoice has a disputed bank payment. Resolve the dispute before sending or changing it.",
          );
        }
        if (link.payment_lock_status) {
          throw new ApiError(
            409,
            "INVOICE_PAYMENT_HISTORY_LOCKED",
            "This invoice has bank-payment history and cannot be sent again as unpaid.",
          );
        }
        if (Number(link.invoice_total_cents) !== Number(record.amount_cents ?? 0)) {
          throw new ApiError(
            409,
            "INVOICE_PROJECT_TOTAL_MISMATCH",
            "The saved invoice and project invoice totals differ. Reconcile them before sending.",
          );
        }
        if (Number(link.invoice_balance_cents) !== Number(record.amount_cents ?? 0)) {
          throw new ApiError(
            409,
            "INVOICE_PROJECT_BALANCE_MISMATCH",
            "This project invoice has payments recorded, but the email still shows the full total due. Reconcile the balance before sending.",
          );
        }
        if (link.id && Number(link.request_amount_cents) !== Number(record.amount_cents ?? 0)) {
          throw new ApiError(
            409,
            "INVOICE_PAYMENT_BALANCE_MISMATCH",
            "This payment link is for a remaining balance, but the email shows the full invoice total. Reconcile the invoice before sending.",
          );
        }
        bankPaymentUrl = link.id ? `${appOrigin}/pay/${link.id}` : null;
        validatedProjectInvoiceId = projectInvoiceId;
      } else {
        throw new ApiError(
          409,
          "INVOICE_PROJECT_OUT_OF_DATE",
          "The linked project invoice could not be verified. Save the invoice again before sending.",
        );
      }
    }
    if (!bankPaymentUrl && !validatedProjectInvoiceId) {
      await client.query(
        `SELECT id
         FROM tool_invoice_payment_requests
         WHERE tool_record_id = $1
         ORDER BY id
         FOR UPDATE`,
        [record.id],
      );
      const paymentLock = (await client.query(
        `SELECT status
         FROM tool_invoice_payment_requests
         WHERE tool_record_id = $1
           AND status = ANY($2::text[])
         ORDER BY created_at DESC
         LIMIT 1`,
        [record.id, IMMUTABLE_INVOICE_PAYMENT_STATUSES],
      )).rows[0] ?? null;
      if (paymentLock?.status === "processing") {
        throw new ApiError(
          409,
          "BANK_PAYMENT_PROCESSING",
          "This ACH payment is processing. Wait for it to settle or fail before sending another invoice.",
        );
      }
      if (paymentLock?.status === "disputed") {
        throw new ApiError(
          409,
          "BANK_PAYMENT_DISPUTED",
          "This invoice has a disputed bank payment. Resolve the dispute before sending or changing it.",
        );
      }
      if (paymentLock) {
        throw new ApiError(
          409,
          "INVOICE_PAYMENT_HISTORY_LOCKED",
          "This invoice has bank-payment history and cannot be sent again as unpaid.",
        );
      }
      const paymentLink = await client.query(
        `SELECT tipr.id, tipr.amount_cents
         FROM tool_invoice_payment_requests tipr
         WHERE tipr.tool_record_id = $1
           AND tipr.status = 'open'
           AND tipr.checkout_url LIKE 'https://checkout.stripe.com/%'
         ORDER BY tipr.created_at DESC
         LIMIT 1`,
        [record.id],
      );
      if (paymentLink.rowCount) {
        const link = paymentLink.rows[0];
        if (Number(link.amount_cents) !== Number(record.amount_cents ?? 0)) {
          throw new ApiError(
            409,
            "INVOICE_PAYMENT_AMOUNT_MISMATCH",
            "The bank-payment link total differs from this invoice. Cancel the old link or restore the matching total.",
          );
        }
        bankPaymentUrl = `${appOrigin}/pay/${link.id}`;
      }
    }
    const brandDelivery = loadDocumentBrandForDelivery
      ? await loadDocumentBrandForDelivery(request.actor)
      : { brand: deliveryBrandFallback(request.actor), attachments: [] };
    const snapshot = invoiceDeliverySnapshot(record, request.actor, bankPaymentUrl, brandDelivery.brand);
    const subject = `${snapshot.senderName} sent invoice ${snapshot.invoiceNumber}`;
    const message = invoiceEmailContent(snapshot, brandDelivery.attachments);
    const contentHash = stableDeliveryContentHash({
      to: snapshot.recipientEmail,
      subject,
      ...message,
      attachments: brandDelivery.attachments,
    });
    const providerIdempotencyKey = `invoice-${record.id}-${contentHash}`.slice(0, 255);
    if (previousDelivery.status === "sent" && previousDelivery.contentHash === contentHash) {
      const replayedRecord = await client.query(
        `UPDATE tool_records
         SET status = 'sent', updated_at = now()
         WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [request.actor.account.id, record.id],
      );
      return {
        status: 200,
        body: {
          data: {
            record: mapToolRecord(replayedRecord.rows[0] ?? record),
            replayed: true,
          },
          meta: { requestId: request.requestId, replayReason: "identical_document" },
        },
      };
    }
    const attemptedAt = new Date().toISOString();
    const attemptCount = integerValue(previousDelivery.attemptCount) + 1;
    let delivery;
    try {
      delivery = await sendTransactionalEmail({
        to: snapshot.recipientEmail,
        subject,
        ...message,
        attachments: brandDelivery.attachments,
        idempotencyKey: providerIdempotencyKey,
      });
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.code : "EMAIL_DELIVERY_UNCONFIRMED";
      const errorMessage = error instanceof ApiError
        ? error.message
        : "RIVT could not confirm email delivery. Retrying this unchanged invoice is safe.";
      const errorStatus = error instanceof ApiError ? error.status : 502;
      const failedPayload = {
        ...payload,
        delivery: {
          ...previousDelivery,
          status: "failed",
          recipientEmail: snapshot.recipientEmail,
          attemptedAt,
          attemptCount,
          lastErrorCode: errorCode,
          contentHash,
          providerIdempotencyKey,
          documentFingerprint: textValue(payload.documentFingerprint, "", 20_000),
        },
      };
      const failed = await client.query(
        `UPDATE tool_records
         SET status = 'delivery_failed',
             payload = $3::jsonb,
             updated_at = now()
         WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [request.actor.account.id, record.id, JSON.stringify(failedPayload)],
      );
      return {
        status: errorStatus,
        body: {
          error: {
            code: errorCode,
            message: errorMessage,
            requestId: request.requestId,
          },
          data: { record: failed.rowCount ? mapToolRecord(failed.rows[0]) : null },
        },
      };
    }
    const sentPayload = JSON.stringify({
      ...payload,
      delivery: {
        status: "sent",
        recipientEmail: snapshot.recipientEmail,
        attemptedAt,
        sentAt: attemptedAt,
        attemptCount,
        provider: delivery.provider,
        providerMessageId: delivery.id,
        idempotencyKey,
        providerIdempotencyKey,
        contentHash,
        documentFingerprint: textValue(payload.documentFingerprint, "", 20_000),
      },
    });
    let updated;
    if (validatedProjectInvoiceId) {
      const projectInvoice = (await client.query(
        `SELECT pi.*, project.organization_id, project.contractor_account_id,
                project.tradesperson_account_id, job.title AS job_title,
                location.city AS public_city, location.region AS public_region
         FROM project_invoices pi
         INNER JOIN projects project ON project.id = pi.project_id
         INNER JOIN jobs job ON job.id = project.job_id
         INNER JOIN job_public_locations location ON location.job_id = job.id
         WHERE pi.id = $1
           AND pi.active_work_id = $2
           AND pi.created_by_account_id = $3`,
        [validatedProjectInvoiceId, record.active_work_id, request.actor.account.id],
      )).rows[0] ?? null;
      if (!projectInvoice || projectInvoice.status === "void" || projectInvoice.status === "paid") {
        throw new ApiError(
          409,
          "INVOICE_PROJECT_OUT_OF_DATE",
          "The project invoice changed before delivery could be recorded. Review its status before trying again.",
        );
      }
      const transitionedToSent = projectInvoice.status === "draft";
      if (transitionedToSent) {
        await client.query(
          `UPDATE project_invoices
           SET status = 'sent', sent_at = COALESCE(sent_at, now()), updated_at = now()
           WHERE id = $1`,
          [validatedProjectInvoiceId],
        );
        await client.query(
          `INSERT INTO project_entries (
             project_id, active_work_id, actor_account_id, entry_type, body, metadata
           ) VALUES ($1, $2, $3, 'system', $4, $5::jsonb)`,
          [
            projectInvoice.project_id,
            projectInvoice.active_work_id,
            request.actor.account.id,
            `Invoice sent: ${projectInvoice.invoice_number}.`,
            JSON.stringify({
              invoiceId: validatedProjectInvoiceId,
              status: "sent",
              source: "project_invoice_email",
            }),
          ],
        );
        await client.query(
          "UPDATE projects SET updated_at = now() WHERE id = $1",
          [projectInvoice.project_id],
        );
        if (createInAppNotification) {
          const recipientAccountId = projectInvoice.contractor_account_id === request.actor.account.id
            ? projectInvoice.tradesperson_account_id
            : projectInvoice.contractor_account_id;
          await createInAppNotification(client, {
            accountId: recipientAccountId,
            type: "work",
            title: "Invoice recorded",
            body: `${projectInvoice.job_title} - ${projectInvoice.public_city}, ${projectInvoice.public_region}`,
            actionHref: `/app/tools/records?activeWork=${projectInvoice.active_work_id}&project=${projectInvoice.project_id}`,
            sourceType: "project_invoice",
            sourceId: validatedProjectInvoiceId,
            priority: "normal",
            metadata: {
              activeWorkId: projectInvoice.active_work_id,
              projectId: projectInvoice.project_id,
              invoiceId: validatedProjectInvoiceId,
            },
          });
        }
        await client.query(
          `INSERT INTO audit_events (
             request_id, actor_account_id, organization_id, action, subject_type, subject_id, metadata
           ) VALUES (
             $1, $2::uuid, $3::uuid, 'project.invoice.status_changed',
             'project_invoice', ($4::uuid)::text, $5::jsonb
           )`,
          [
            request.requestId,
            request.actor.account.id,
            projectInvoice.organization_id,
            validatedProjectInvoiceId,
            JSON.stringify({ status: "sent", source: "invoice_email" }),
          ],
        );
      }
      updated = await client.query(
        `UPDATE tool_records
         SET status = 'sent',
             payload = $3::jsonb,
             updated_at = now()
         WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [request.actor.account.id, record.id, sentPayload],
      );
    } else {
      updated = await client.query(
        `UPDATE tool_records
         SET status = 'sent',
             payload = $3::jsonb,
             updated_at = now()
         WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [request.actor.account.id, record.id, sentPayload],
      );
    }
    if (!updated.rowCount) {
      throw new ApiError(
        409,
        "INVOICE_PROJECT_OUT_OF_DATE",
        "The project invoice changed while the email was being sent. Review its status before trying again.",
      );
    }
    return {
      status: 200,
      body: {
        data: { record: mapToolRecord(updated.rows[0]), replayed: false },
        meta: { requestId: request.requestId },
      },
    };
      },
    );
    if (result.replayed || result.body?.data?.replayed) {
      response.setHeader("Idempotent-Replayed", "true");
    }
    sendIdempotentResult(response, result);
  }));

  app.delete("/api/v1/tool-records/:recordType/:localId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const params = validate(toolRecordParamsSchema, request.params);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `tool-records.delete:${params.recordType}:${params.localId}`,
      async (client) => {
        if (params.recordType === "invoice_draft") {
          const existingInvoice = (await client.query(
            `SELECT id, status, active_work_id, payload
             FROM tool_records
             WHERE account_id = $1
               AND record_type = 'invoice_draft'
               AND local_id = $2
               AND deleted_at IS NULL
             FOR UPDATE`,
            [request.actor.account.id, params.localId],
          )).rows[0] ?? null;
          if (existingInvoice) {
            if (existingInvoice.active_work_id) {
              throw new ApiError(
                409,
                "PROJECT_INVOICE_RECORD_REQUIRED",
                "Job invoices stay in the project financial record. Void the invoice from the job instead of deleting this copy.",
              );
            }
            if (existingInvoice.status === "paid") {
              throw new ApiError(
                409,
                "INVOICE_PAYMENT_HISTORY_LOCKED",
                "A paid invoice cannot be deleted. Keep it as part of the payment record.",
              );
            }
            const immutablePayment = (await client.query(
              `SELECT status
               FROM tool_invoice_payment_requests
               WHERE tool_record_id = $1
                 AND status = ANY($2::text[])
               ORDER BY created_at DESC
               LIMIT 1
               FOR UPDATE`,
              [existingInvoice.id, IMMUTABLE_INVOICE_PAYMENT_STATUSES],
            )).rows[0] ?? null;
            if (immutablePayment?.status === "processing") {
              throw new ApiError(
                409,
                "BANK_PAYMENT_PROCESSING",
                "This ACH payment is processing. The invoice cannot be deleted.",
              );
            }
            if (immutablePayment) {
              throw new ApiError(
                409,
                "INVOICE_PAYMENT_HISTORY_LOCKED",
                "This invoice has bank-payment history and cannot be deleted.",
              );
            }
            const activePayment = (await client.query(
              `SELECT status
               FROM tool_invoice_payment_requests
               WHERE tool_record_id = $1
                 AND status = ANY($2::text[])
               ORDER BY created_at DESC
               LIMIT 1
               FOR UPDATE`,
              [existingInvoice.id, ACTIVE_INVOICE_PAYMENT_STATUSES.filter((status) => status !== "processing")],
            )).rows[0] ?? null;
            if (activePayment) {
              throw new ApiError(
                409,
                "BANK_PAYMENT_LINK_ACTIVE",
                "Cancel the active bank-payment link before deleting this invoice.",
              );
            }
          }
        }
        const deleted = await client.query(
          `UPDATE tool_records
           SET deleted_at = now(), updated_at = now()
           WHERE account_id = $1
             AND record_type = $2
             AND local_id = $3
             AND deleted_at IS NULL
           RETURNING id`,
          [request.actor.account.id, params.recordType, params.localId],
        );
        if (!deleted.rowCount) {
          throw new ApiError(404, "TOOL_RECORD_NOT_FOUND", "That tool record does not exist.");
        }
        return {
          status: 200,
          body: {
            data: { deleted: true },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));
}

export const toolRecordInternals = {
  equivalentInvoicePayload,
  expenseCsv,
  hasActiveProEntitlement,
  invoiceDeliverySnapshot,
  invoiceEmailContent,
  requireVerifiedDeliveryActor,
  stableDeliveryContentHash,
  stripServerOwnedInvoicePayload,
};
