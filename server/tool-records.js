import { ApiError, asyncRoute, validate, z } from "./api.js";

const toolRecordTypeSchema = z.enum([
  "payment_record",
  "invoice_template",
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
    payload: row.payload ?? {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

function estimateDeliverySnapshot(record, actor) {
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
    validThrough: textValue(payload.validThrough, "", 20),
    senderName: textValue(actor.profile.displayName, "RIVT member", 160),
    totalCents,
    lines,
  };
}

function estimateEmailContent(snapshot) {
  const validThrough = snapshot.validThrough ? `Valid through ${snapshot.validThrough}.` : "Review the scope and terms before accepting.";
  const lineText = snapshot.lines.map((line) => `- ${line.description}: ${formatCurrency(line.totalCents)}`).join("\n");
  const text = [
    `Hi ${snapshot.recipientName},`,
    "",
    `${snapshot.senderName} sent you estimate ${snapshot.estimateNumber}.`,
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
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f2;color:#151515;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto;padding:28px"><section style="background:#ffffff;border:1px solid #deded8;border-radius:12px;overflow:hidden"><header style="padding:22px 24px;background:#ff4b00;color:#111111"><strong style="font-size:20px;letter-spacing:0.04em">RIVT ESTIMATE</strong><div style="margin-top:6px;font-size:14px">${escapeHtml(snapshot.estimateNumber)}</div></header><div style="padding:24px"><p style="margin:0 0 16px">Hi ${escapeHtml(snapshot.recipientName)},</p><p style="margin:0 0 16px"><strong>${escapeHtml(snapshot.senderName)}</strong> sent you an estimate for ${escapeHtml(snapshot.title)}.</p><table role="presentation" width="100%" style="border-collapse:collapse;margin:18px 0">${lineRows}<tr><td style="padding-top:16px;font-size:17px;font-weight:700">Estimated total</td><td style="padding-top:16px;text-align:right;font-size:20px;font-weight:800">${formatCurrency(snapshot.totalCents)}</td></tr></table><p style="margin:18px 0 0;color:#5f5f5a">${escapeHtml(validThrough)}</p>${snapshot.note ? `<p style="margin:12px 0 0"><strong>Note:</strong> ${escapeHtml(snapshot.note)}</p>` : ""}<p style="margin:24px 0 0;color:#5f5f5a;font-size:13px">This is an estimate, not a payment request. Contact the sender to discuss changes or confirm acceptance.</p></div></section></main></body></html>`;
  return { text, html };
}

function invoiceDeliverySnapshot(record, actor) {
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

  return {
    recipientEmail,
    recipientName: textValue(payload.recipientName, "there", 160),
    invoiceNumber: textValue(payload.invoiceNumber, `RIVT-${record.id.slice(0, 8).toUpperCase()}`, 80),
    workLabel: textValue(payload.workLabel, record.title, 320),
    terms: textValue(payload.terms, "Due on receipt", 160),
    senderName: textValue(payload.payTo, textValue(actor.profile.displayName, "RIVT member", 160), 160),
    paymentMethod: textValue(payload.paymentMethod, "Direct payment", 160),
    totalCents,
    subtotalCents,
    taxCents: Math.max(0, totalCents - subtotalCents),
    lines: safeLines,
  };
}

function invoiceEmailContent(snapshot) {
  const lineText = snapshot.lines.map((line) => `- ${line.description}: ${formatCurrency(line.totalCents)}`).join("\n");
  const text = [
    `Hi ${snapshot.recipientName},`,
    "",
    `${snapshot.senderName} sent you invoice ${snapshot.invoiceNumber}.`,
    `Work: ${snapshot.workLabel}`,
    "",
    lineText,
    "",
    `Subtotal: ${formatCurrency(snapshot.subtotalCents)}`,
    `Tax: ${formatCurrency(snapshot.taxCents)}`,
    `Total due: ${formatCurrency(snapshot.totalCents)}`,
    `Terms: ${snapshot.terms}`,
    `Payment method: ${snapshot.paymentMethod}`,
    "",
    "Payment is arranged directly with the sender. Reply to this email with any questions.",
  ].join("\n");
  const lineRows = snapshot.lines.map((line) => (
    `<tr><td style="padding:9px 0;border-bottom:1px solid #e7e7e7">${escapeHtml(line.description)}</td><td style="padding:9px 0;border-bottom:1px solid #e7e7e7;text-align:right;font-weight:700">${formatCurrency(line.totalCents)}</td></tr>`
  )).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f2;color:#151515;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto;padding:28px"><section style="background:#ffffff;border:1px solid #deded8;border-radius:12px;overflow:hidden"><header style="padding:22px 24px;background:#ff4b00;color:#111111"><strong style="font-size:20px;letter-spacing:0.04em">RIVT INVOICE</strong><div style="margin-top:6px;font-size:14px">${escapeHtml(snapshot.invoiceNumber)}</div></header><div style="padding:24px"><p style="margin:0 0 16px">Hi ${escapeHtml(snapshot.recipientName)},</p><p style="margin:0 0 16px"><strong>${escapeHtml(snapshot.senderName)}</strong> sent you an invoice for ${escapeHtml(snapshot.workLabel)}.</p><table role="presentation" width="100%" style="border-collapse:collapse;margin:18px 0">${lineRows}<tr><td style="padding-top:12px">Subtotal</td><td style="padding-top:12px;text-align:right">${formatCurrency(snapshot.subtotalCents)}</td></tr><tr><td style="padding-top:8px">Tax</td><td style="padding-top:8px;text-align:right">${formatCurrency(snapshot.taxCents)}</td></tr><tr><td style="padding-top:16px;font-size:17px;font-weight:700">Total due</td><td style="padding-top:16px;text-align:right;font-size:20px;font-weight:800">${formatCurrency(snapshot.totalCents)}</td></tr></table><p style="margin:18px 0 0"><strong>Terms:</strong> ${escapeHtml(snapshot.terms)}</p><p style="margin:8px 0 0"><strong>Payment method:</strong> ${escapeHtml(snapshot.paymentMethod)}</p><p style="margin:24px 0 0;color:#5f5f5a;font-size:13px">Payment is arranged directly with the sender. Reply to this email with any questions.</p></div></section></main></body></html>`;
  return { text, html };
}

export function registerToolRecordRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
  sendTransactionalEmail,
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
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `tool-records.upsert:${input.recordType}:${input.localId}`,
      async (client) => {
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
        }
        const upserted = await client.query(
          `INSERT INTO tool_records (
             account_id, record_type, local_id, title, status, record_date, amount_cents, payload,
             standalone_project_id, active_work_id
           ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8::jsonb, $9, $10)
           ON CONFLICT (account_id, record_type, local_id) WHERE deleted_at IS NULL
           DO UPDATE SET title = EXCLUDED.title,
                         status = EXCLUDED.status,
                         record_date = EXCLUDED.record_date,
                         amount_cents = EXCLUDED.amount_cents,
                         payload = EXCLUDED.payload,
                         standalone_project_id = EXCLUDED.standalone_project_id,
                         active_work_id = EXCLUDED.active_work_id,
                         updated_at = now()
           RETURNING *`,
          [
            request.actor.account.id,
            input.recordType,
            input.localId,
            input.title,
            input.status,
            input.recordDate,
            input.amountCents,
            JSON.stringify(input.payload),
            input.standaloneProjectId,
            input.activeWorkId,
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

    const snapshot = estimateDeliverySnapshot(record, request.actor);
    const attemptedAt = new Date().toISOString();
    const attemptCount = integerValue(previousDelivery.attemptCount) + 1;
    const message = estimateEmailContent(snapshot);
    let delivery;
    try {
      delivery = await sendTransactionalEmail({
        to: snapshot.recipientEmail,
        subject: `${snapshot.senderName} sent estimate ${snapshot.estimateNumber}`,
        ...message,
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
    const params = validate(invoiceSendParamsSchema, request.params);
    const idempotencyKey = String(request.headers["idempotency-key"] ?? "").trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Use a valid Idempotency-Key for this request.");
    }
    const existing = await database.query(
      `SELECT * FROM tool_records
       WHERE account_id = $1 AND record_type = 'invoice_draft' AND local_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [request.actor.account.id, params.localId],
    );
    if (!existing.rowCount) {
      throw new ApiError(404, "INVOICE_NOT_FOUND", "Save this invoice to your RIVT account before sending it.");
    }
    const record = existing.rows[0];
    const payload = objectValue(record.payload);
    const previousDelivery = objectValue(payload.delivery);
    if (previousDelivery.idempotencyKey === idempotencyKey && previousDelivery.status === "sent") {
      response.setHeader("Idempotent-Replayed", "true");
      response.json({ data: { record: mapToolRecord(record), replayed: true }, meta: { requestId: request.requestId } });
      return;
    }
    const snapshot = invoiceDeliverySnapshot(record, request.actor);
    const attemptedAt = new Date().toISOString();
    const attemptCount = integerValue(previousDelivery.attemptCount) + 1;
    let delivery;
    try {
      delivery = await sendTransactionalEmail({
        to: snapshot.recipientEmail,
        subject: `${snapshot.senderName} sent invoice ${snapshot.invoiceNumber}`,
        ...invoiceEmailContent(snapshot),
        idempotencyKey: `invoice-${record.id}-${idempotencyKey}`.slice(0, 255),
      });
    } catch (error) {
      await database.query(
        `UPDATE tool_records SET status = 'delivery_failed', payload = $3::jsonb, updated_at = now()
         WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [request.actor.account.id, record.id, JSON.stringify({ ...payload, delivery: { ...previousDelivery, status: "failed", recipientEmail: snapshot.recipientEmail, attemptedAt, attemptCount, lastErrorCode: error instanceof ApiError ? error.code : "EMAIL_DELIVERY_FAILED" } })],
      );
      throw error;
    }
    const updated = await database.query(
      `UPDATE tool_records SET status = 'sent', payload = $3::jsonb, updated_at = now()
       WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING *`,
      [request.actor.account.id, record.id, JSON.stringify({ ...payload, delivery: { status: "sent", recipientEmail: snapshot.recipientEmail, attemptedAt, sentAt: attemptedAt, attemptCount, provider: delivery.provider, providerMessageId: delivery.id, idempotencyKey } })],
    );
    response.json({ data: { record: mapToolRecord(updated.rows[0]), replayed: false }, meta: { requestId: request.requestId } });
  }));

  app.delete("/api/v1/tool-records/:recordType/:localId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const params = validate(toolRecordParamsSchema, request.params);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `tool-records.delete:${params.recordType}:${params.localId}`,
      async (client) => {
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
  expenseCsv,
  hasActiveProEntitlement,
};
