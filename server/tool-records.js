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
