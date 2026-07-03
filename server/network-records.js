import { ApiError, asyncRoute, validate, z } from "./api.js";

const networkRecordTypeSchema = z.enum([
  "crew_member",
  "crew_invite",
  "network_review",
]);

const localIdSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/);

const networkRecordQuerySchema = z.object({
  type: networkRecordTypeSchema.optional(),
});

const networkRecordParamsSchema = z.object({
  recordType: networkRecordTypeSchema,
  localId: localIdSchema,
});

const networkRecordUpsertSchema = z.object({
  recordType: networkRecordTypeSchema,
  localId: localIdSchema,
  title: z.string().trim().min(1).max(160),
  status: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9 _.-]+$/).default("active"),
  recordDate: z.iso.date().nullable().optional().default(null),
  payload: z.object({}).passthrough().default({}),
});

function mapNetworkRecord(row) {
  return {
    id: row.id,
    recordType: row.record_type,
    localId: row.local_id,
    title: row.title,
    status: row.status,
    recordDate: row.record_date ? row.record_date.toISOString().slice(0, 10) : null,
    payload: row.payload ?? {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export function registerNetworkRecordRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  app.get("/api/v1/network-records", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const input = validate(networkRecordQuerySchema, request.query);
    const params = [request.actor.account.id];
    let typeClause = "";
    if (input.type) {
      params.push(input.type);
      typeClause = `AND record_type = $${params.length}`;
    }
    const result = await database.query(
      `SELECT *
       FROM network_records
       WHERE account_id = $1
         AND deleted_at IS NULL
         ${typeClause}
       ORDER BY updated_at DESC, id DESC
       LIMIT 500`,
      params,
    );
    response.json({
      data: { records: result.rows.map(mapNetworkRecord) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/network-records", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(networkRecordUpsertSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `network-records.upsert:${input.recordType}:${input.localId}`,
      async (client) => {
        const upserted = await client.query(
          `INSERT INTO network_records (
             account_id, record_type, local_id, title, status, record_date, payload
           ) VALUES ($1, $2, $3, $4, $5, $6::date, $7::jsonb)
           ON CONFLICT (account_id, record_type, local_id) WHERE deleted_at IS NULL
           DO UPDATE SET title = EXCLUDED.title,
                         status = EXCLUDED.status,
                         record_date = EXCLUDED.record_date,
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
            JSON.stringify(input.payload),
          ],
        );
        return {
          status: 200,
          body: {
            data: { record: mapNetworkRecord(upserted.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.delete("/api/v1/network-records/:recordType/:localId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const params = validate(networkRecordParamsSchema, request.params);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `network-records.delete:${params.recordType}:${params.localId}`,
      async (client) => {
        const deleted = await client.query(
          `UPDATE network_records
           SET deleted_at = now(), updated_at = now()
           WHERE account_id = $1
             AND record_type = $2
             AND local_id = $3
             AND deleted_at IS NULL
           RETURNING id`,
          [request.actor.account.id, params.recordType, params.localId],
        );
        if (!deleted.rowCount) {
          throw new ApiError(404, "NETWORK_RECORD_NOT_FOUND", "That network record does not exist.");
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
