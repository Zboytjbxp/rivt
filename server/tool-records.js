import { ApiError, asyncRoute, validate, z } from "./api.js";

const toolRecordTypeSchema = z.enum([
  "payment_record",
  "invoice_template",
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

const toolRecordUpsertSchema = z.object({
  recordType: toolRecordTypeSchema,
  localId: localIdSchema,
  title: z.string().trim().min(1).max(160),
  status: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9 _.-]+$/).default("active"),
  recordDate: z.iso.date().nullable().optional().default(null),
  amountCents: z.number().int().min(0).max(1_000_000_000).nullable().optional().default(null),
  payload: z.object({}).passthrough().default({}),
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
    payload: row.payload ?? {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export function registerToolRecordRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  app.get("/api/v1/tool-records", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const input = validate(toolRecordQuerySchema, request.query);
    const params = [request.actor.account.id];
    let typeClause = "";
    if (input.type) {
      params.push(input.type);
      typeClause = `AND record_type = $${params.length}`;
    }
    const result = await database.query(
      `SELECT *
       FROM tool_records
       WHERE account_id = $1
         AND deleted_at IS NULL
         ${typeClause}
       ORDER BY updated_at DESC, id DESC
       LIMIT 500`,
      params,
    );
    response.json({
      data: { records: result.rows.map(mapToolRecord) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/tool-records", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(toolRecordUpsertSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `tool-records.upsert:${input.recordType}:${input.localId}`,
      async (client) => {
        const upserted = await client.query(
          `INSERT INTO tool_records (
             account_id, record_type, local_id, title, status, record_date, amount_cents, payload
           ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8::jsonb)
           ON CONFLICT (account_id, record_type, local_id) WHERE deleted_at IS NULL
           DO UPDATE SET title = EXCLUDED.title,
                         status = EXCLUDED.status,
                         record_date = EXCLUDED.record_date,
                         amount_cents = EXCLUDED.amount_cents,
                         payload = EXCLUDED.payload,
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
