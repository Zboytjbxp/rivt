import { ApiError, asyncRoute, validate, z } from "./api.js";

const projectCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  clientName: z.string().trim().max(160).default(""),
  locationText: z.string().trim().max(240).default(""),
  tradeCode: z.string().trim().max(80).default(""),
});

const projectUpdateSchema = projectCreateSchema.partial().extend({
  status: z.enum(["active", "archived"]).optional(),
});

function mapStandaloneProject(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    title: row.title,
    clientName: row.client_name || "",
    locationText: row.location_text || "",
    tradeCode: row.trade_code || "",
    status: row.status,
    photoCount: Number(row.photo_count ?? 0),
    albumId: row.album_id ?? null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const standaloneProjectSelect = `
  SELECT sp.*, pa.id AS album_id, COUNT(ap.id)::int AS photo_count
  FROM standalone_projects sp
  LEFT JOIN photo_albums pa ON pa.standalone_project_id = sp.id
  LEFT JOIN album_photos ap ON ap.album_id = pa.id
`;

export function registerStandaloneProjectRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  app.get("/api/v1/standalone-projects", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const rows = await database.query(
      `${standaloneProjectSelect}
       WHERE sp.account_id = $1
       GROUP BY sp.id, pa.id
       ORDER BY (sp.status = 'active') DESC, sp.updated_at DESC, sp.id DESC
       LIMIT 200`,
      [request.actor.account.id],
    );
    response.json({
      data: { projects: rows.rows.map(mapStandaloneProject) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/standalone-projects", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(projectCreateSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      "standalone-projects.create",
      async (client) => {
        const created = await client.query(
          `INSERT INTO standalone_projects (account_id, title, client_name, location_text, trade_code)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [request.actor.account.id, input.title, input.clientName, input.locationText, input.tradeCode],
        );
        return {
          status: 201,
          body: {
            data: { project: mapStandaloneProject(created.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.patch("/api/v1/standalone-projects/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const projectId = validate(z.uuid(), request.params.id);
    const input = validate(projectUpdateSchema, request.body);
    if (!Object.keys(input).length) throw new ApiError(400, "PROJECT_UPDATE_REQUIRED", "Choose something to update.");
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `standalone-projects.update:${projectId}`,
      async (client) => {
        const updated = await client.query(
          `UPDATE standalone_projects
           SET title = COALESCE($3, title),
               client_name = COALESCE($4, client_name),
               location_text = COALESCE($5, location_text),
               trade_code = COALESCE($6, trade_code),
               status = COALESCE($7, status),
               updated_at = now()
           WHERE id = $1 AND account_id = $2
           RETURNING *`,
          [projectId, request.actor.account.id, input.title ?? null, input.clientName ?? null, input.locationText ?? null, input.tradeCode ?? null, input.status ?? null],
        );
        if (!updated.rowCount) throw new ApiError(404, "STANDALONE_PROJECT_NOT_FOUND", "That standalone project does not exist.");
        return {
          status: 200,
          body: {
            data: { project: mapStandaloneProject(updated.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));
}
