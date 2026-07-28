import { ApiError, asyncRoute, validate, z } from "./api.js";

const recordTypes = ["checklist", "milestone", "change_order", "note"];
const statesByType = {
  checklist: new Set(["open", "done"]),
  milestone: new Set(["pending", "paid", "overdue"]),
  change_order: new Set(["pending", "approved", "rejected"]),
  note: new Set(["active"]),
};

const createSchema = z.object({
  recordType: z.enum(recordTypes),
  visibility: z.enum(["shared", "private"]).default("shared"),
  title: z.string().trim().max(240).default(""),
  details: z.string().trim().max(4000).default(""),
  requestedBy: z.string().trim().max(160).default(""),
  amountCents: z.number().int().min(-100_000_000_00).max(100_000_000_00).default(0),
  dueNote: z.string().trim().max(240).default(""),
  state: z.enum(["open", "done", "pending", "paid", "overdue", "approved", "rejected", "active"]),
});

const updateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  visibility: z.enum(["shared", "private"]).optional(),
  title: z.string().trim().max(240).optional(),
  details: z.string().trim().max(4000).optional(),
  requestedBy: z.string().trim().max(160).optional(),
  amountCents: z.number().int().min(-100_000_000_00).max(100_000_000_00).optional(),
  dueNote: z.string().trim().max(240).optional(),
  state: z.enum(["open", "done", "pending", "paid", "overdue", "approved", "rejected", "active"]).optional(),
});

const archiveSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function mapRecord(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    activeWorkId: row.active_work_id,
    recordType: row.record_type,
    visibility: row.visibility,
    title: row.title || "",
    details: row.details || "",
    requestedBy: row.requested_by || "",
    amountCents: Number(row.amount_cents ?? 0),
    dueNote: row.due_note || "",
    state: row.state,
    version: Number(row.version),
    createdByAccountId: row.created_by_account_id,
    updatedByAccountId: row.updated_by_account_id,
    archivedAt: iso(row.archived_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapEvent(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    recordId: row.record_id,
    recordType: row.record_type,
    actorAccountId: row.actor_account_id,
    actorDisplayName: row.actor_display_name || "Job participant",
    actorRole: row.actor_role || null,
    eventType: row.event_type,
    priorVersion: row.prior_version == null ? null : Number(row.prior_version),
    nextVersion: Number(row.next_version),
    metadata: row.metadata ?? {},
    createdAt: iso(row.created_at),
  };
}

async function loadContext(client, projectId, accountId) {
  const result = await client.query(
    `SELECT pr.id, pr.active_work_id, pr.job_id, pr.organization_id, j.title AS job_title,
            pr.contractor_account_id, pr.tradesperson_account_id,
            CASE
              WHEN pr.contractor_account_id = $2 THEN 'contractor'
              WHEN pr.tradesperson_account_id = $2 THEN 'tradesperson'
            END AS actor_role
     FROM projects pr
     INNER JOIN jobs j ON j.id = pr.job_id
     INNER JOIN work_participants wp ON wp.active_work_id = pr.active_work_id
     WHERE pr.id = $1 AND wp.account_id = $2`,
    [projectId, accountId],
  );
  if (!result.rowCount) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project record not found.");
  return result.rows[0];
}

async function loadRecord(client, projectId, recordId, accountId, { forUpdate = false } = {}) {
  const result = await client.query(
    `SELECT pwr.*
     FROM project_workspace_records pwr
     INNER JOIN work_participants wp ON wp.active_work_id = pwr.active_work_id
     WHERE pwr.project_id = $1
       AND pwr.id = $2
       AND wp.account_id = $3
       AND (pwr.visibility = 'shared' OR pwr.created_by_account_id = $3)
     ${forUpdate ? "FOR UPDATE OF pwr" : ""}`,
    [projectId, recordId, accountId],
  );
  if (!result.rowCount) throw new ApiError(404, "WORKSPACE_RECORD_NOT_FOUND", "That job record was not found.");
  return result.rows[0];
}

function validateRecord(recordType, state, visibility, title, details) {
  if (!statesByType[recordType]?.has(state)) {
    throw new ApiError(422, "WORKSPACE_RECORD_STATE_INVALID", "That status does not apply to this record.");
  }
  if (visibility === "private" && recordType !== "note") {
    throw new ApiError(422, "WORKSPACE_RECORD_VISIBILITY_INVALID", "Only notes can be private.");
  }
  if (recordType === "note" ? !details : !title) {
    throw new ApiError(422, "WORKSPACE_RECORD_CONTENT_REQUIRED", recordType === "note" ? "Enter a note." : "Enter a title.");
  }
}

function requireCreatePermission(context, input) {
  if (input.recordType === "milestone" && context.actor_role !== "contractor") {
    throw new ApiError(403, "MILESTONE_WRITE_FORBIDDEN", "Only the contractor can manage payment milestones.");
  }
  if (input.recordType === "change_order" && input.state !== "pending" && context.actor_role !== "contractor") {
    throw new ApiError(403, "CHANGE_ORDER_DECISION_FORBIDDEN", "Only the contractor can import or decide an approved or rejected change order.");
  }
}

function requireUpdatePermission(context, record, input, accountId) {
  if (record.record_type === "milestone" && context.actor_role !== "contractor") {
    throw new ApiError(403, "MILESTONE_WRITE_FORBIDDEN", "Only the contractor can manage payment milestones.");
  }
  if (record.record_type === "note" && record.created_by_account_id !== accountId) {
    throw new ApiError(403, "NOTE_WRITE_FORBIDDEN", "Only the note author can change this note.");
  }
  if (record.record_type === "change_order") {
    const decidesRequest = input.state && input.state !== record.state && ["approved", "rejected"].includes(input.state);
    if (decidesRequest && context.actor_role !== "contractor") {
      throw new ApiError(403, "CHANGE_ORDER_DECISION_FORBIDDEN", "Only the contractor can approve or reject a change order.");
    }
    if (context.actor_role !== "contractor" && record.created_by_account_id !== accountId) {
      throw new ApiError(403, "CHANGE_ORDER_WRITE_FORBIDDEN", "Only the requester or contractor can change this request.");
    }
    if (context.actor_role !== "contractor" && record.state !== "pending") {
      throw new ApiError(409, "CHANGE_ORDER_ALREADY_DECIDED", "A decided change order cannot be edited.");
    }
  }
}

async function insertEvent(client, context, record, actorAccountId, eventType, priorVersion, metadata = {}) {
  await client.query(
    `INSERT INTO project_workspace_events (
       project_id, active_work_id, record_id, actor_account_id, event_type,
       prior_version, next_version, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      context.id,
      context.active_work_id,
      record.id,
      actorAccountId,
      eventType,
      priorVersion,
      record.version,
      JSON.stringify(metadata),
    ],
  );
}

function recordSnapshot(record) {
  return {
    recordType: record.record_type,
    visibility: record.visibility,
    title: record.title || "",
    details: record.visibility === "private" ? "" : (record.details || ""),
    requestedBy: record.requested_by || "",
    amountCents: Number(record.amount_cents ?? 0),
    dueNote: record.due_note || "",
    state: record.state,
  };
}

async function notifyOtherParticipant(client, context, actorAccountId, createInAppNotification, record, action) {
  if (!createInAppNotification || record.visibility !== "shared") return;
  const accountId = context.contractor_account_id === actorAccountId
    ? context.tradesperson_account_id
    : context.contractor_account_id;
  const noun = record.record_type === "change_order"
    ? "Change order"
    : record.record_type === "milestone"
      ? "Payment milestone"
      : record.record_type === "checklist"
        ? "Punch-list item"
        : "Shared job note";
  await createInAppNotification(client, {
    accountId,
    type: "work",
    title: `${noun} ${action}`,
    body: context.job_title,
    actionHref: `/app/work?activeWork=${context.active_work_id}&job=${context.job_id}`,
    sourceType: "project_workspace_record",
    sourceId: record.id,
    priority: record.record_type === "change_order" ? "high" : "normal",
    metadata: {
      activeWorkId: context.active_work_id,
      jobId: context.job_id,
      projectId: context.id,
      recordId: record.id,
      recordType: record.record_type,
      state: record.state,
    },
  });
}

export function registerWorkspaceRecordRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
  createInAppNotification,
}) {
  app.get("/api/v1/projects/:id/workspace-records", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const projectId = validate(z.uuid(), request.params.id);
    await loadContext(database, projectId, request.actor.account.id);
    const [records, events] = await Promise.all([
      database.query(
        `SELECT * FROM project_workspace_records
         WHERE project_id = $1
           AND (visibility = 'shared' OR created_by_account_id = $2)
         ORDER BY created_at ASC, id ASC`,
        [projectId, request.actor.account.id],
      ),
      database.query(
        `SELECT pwe.*, pwr.record_type, p.display_name AS actor_display_name, wp_actor.participant_role AS actor_role
         FROM project_workspace_events pwe
         INNER JOIN project_workspace_records pwr ON pwr.id = pwe.record_id
         LEFT JOIN profiles p ON p.account_id = pwe.actor_account_id
         LEFT JOIN work_participants wp_actor
           ON wp_actor.active_work_id = pwe.active_work_id
          AND wp_actor.account_id = pwe.actor_account_id
         WHERE pwe.project_id = $1
           AND (pwr.visibility = 'shared' OR pwr.created_by_account_id = $2)
         ORDER BY pwe.created_at DESC, pwe.id DESC
         LIMIT 100`,
        [projectId, request.actor.account.id],
      ),
    ]);
    response.json({
      data: {
        records: records.rows.filter((row) => !row.archived_at).map(mapRecord),
        archivedRecords: records.rows.filter((row) => row.archived_at).map(mapRecord),
        events: events.rows.map(mapEvent),
      },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/projects/:id/workspace-records", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const projectId = validate(z.uuid(), request.params.id);
    const input = validate(createSchema, request.body);
    validateRecord(input.recordType, input.state, input.visibility, input.title, input.details);
    const result = await runIdempotentMutation(request, request.actor.account.id, `workspace-records.create:${projectId}`, async (client) => {
      const context = await loadContext(client, projectId, request.actor.account.id);
      requireCreatePermission(context, input);
      const inserted = await client.query(
        `INSERT INTO project_workspace_records (
           project_id, active_work_id, record_type, visibility, title, details,
           requested_by, amount_cents, due_note, state,
           created_by_account_id, updated_by_account_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
         RETURNING *`,
        [
          projectId,
          context.active_work_id,
          input.recordType,
          input.visibility,
          input.title,
          input.details,
          input.requestedBy,
          input.amountCents,
          input.dueNote,
          input.state,
          request.actor.account.id,
        ],
      );
      await insertEvent(client, context, inserted.rows[0], request.actor.account.id, "created", null, {
        snapshot: recordSnapshot(inserted.rows[0]),
      });
      await notifyOtherParticipant(client, context, request.actor.account.id, createInAppNotification, inserted.rows[0], "added");
      await client.query("UPDATE projects SET updated_at = now() WHERE id = $1", [projectId]);
      return {
        status: 201,
        body: { data: { record: mapRecord(inserted.rows[0]) }, meta: { requestId: request.requestId } },
      };
    });
    sendIdempotentResult(response, result);
  }));

  app.patch("/api/v1/projects/:id/workspace-records/:recordId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const projectId = validate(z.uuid(), request.params.id);
    const recordId = validate(z.uuid(), request.params.recordId);
    const input = validate(updateSchema, request.body);
    if (Object.keys(input).length === 1) throw new ApiError(400, "WORKSPACE_RECORD_UPDATE_REQUIRED", "Choose something to update.");
    const result = await runIdempotentMutation(request, request.actor.account.id, `workspace-records.update:${recordId}`, async (client) => {
      const context = await loadContext(client, projectId, request.actor.account.id);
      const current = await loadRecord(client, projectId, recordId, request.actor.account.id, { forUpdate: true });
      requireUpdatePermission(context, current, input, request.actor.account.id);
      if (Number(current.version) !== input.expectedVersion) {
        throw new ApiError(409, "WORKSPACE_RECORD_CONFLICT", "This record changed on another device.", {
          current: mapRecord(current),
        });
      }
      const next = {
        visibility: input.visibility ?? current.visibility,
        title: input.title ?? current.title,
        details: input.details ?? current.details,
        requestedBy: input.requestedBy ?? current.requested_by,
        amountCents: input.amountCents ?? Number(current.amount_cents),
        dueNote: input.dueNote ?? current.due_note,
        state: input.state ?? current.state,
      };
      validateRecord(current.record_type, next.state, next.visibility, next.title, next.details);
      const updated = await client.query(
        `UPDATE project_workspace_records
         SET visibility = $4, title = $5, details = $6, requested_by = $7,
             amount_cents = $8, due_note = $9, state = $10,
             version = version + 1, updated_by_account_id = $3, updated_at = now()
         WHERE id = $1 AND project_id = $2 AND version = $11 AND archived_at IS NULL
         RETURNING *`,
        [
          recordId,
          projectId,
          request.actor.account.id,
          next.visibility,
          next.title,
          next.details,
          next.requestedBy,
          next.amountCents,
          next.dueNote,
          next.state,
          input.expectedVersion,
        ],
      );
      if (!updated.rowCount) throw new ApiError(409, "WORKSPACE_RECORD_CONFLICT", "This record changed on another device.");
      const eventType = next.state !== current.state ? "state_changed" : "updated";
      await insertEvent(client, context, updated.rows[0], request.actor.account.id, eventType, Number(current.version), {
        fromState: current.state,
        toState: next.state,
        before: recordSnapshot(current),
        after: recordSnapshot(updated.rows[0]),
      });
      await notifyOtherParticipant(client, context, request.actor.account.id, createInAppNotification, updated.rows[0], eventType === "state_changed" ? "updated" : "edited");
      await client.query("UPDATE projects SET updated_at = now() WHERE id = $1", [projectId]);
      return {
        status: 200,
        body: { data: { record: mapRecord(updated.rows[0]) }, meta: { requestId: request.requestId } },
      };
    });
    sendIdempotentResult(response, result);
  }));

  app.delete("/api/v1/projects/:id/workspace-records/:recordId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const projectId = validate(z.uuid(), request.params.id);
    const recordId = validate(z.uuid(), request.params.recordId);
    const input = validate(archiveSchema, request.body);
    const result = await runIdempotentMutation(request, request.actor.account.id, `workspace-records.archive:${recordId}`, async (client) => {
      const context = await loadContext(client, projectId, request.actor.account.id);
      const current = await loadRecord(client, projectId, recordId, request.actor.account.id, { forUpdate: true });
      requireUpdatePermission(context, current, {}, request.actor.account.id);
      if (Number(current.version) !== input.expectedVersion) {
        throw new ApiError(409, "WORKSPACE_RECORD_CONFLICT", "This record changed on another device.", {
          current: mapRecord(current),
        });
      }
      const archived = await client.query(
        `UPDATE project_workspace_records
         SET archived_at = now(), version = version + 1,
             updated_by_account_id = $3, updated_at = now()
         WHERE id = $1 AND project_id = $2 AND version = $4 AND archived_at IS NULL
         RETURNING *`,
        [recordId, projectId, request.actor.account.id, input.expectedVersion],
      );
      if (!archived.rowCount) throw new ApiError(409, "WORKSPACE_RECORD_CONFLICT", "This record changed on another device.");
      await insertEvent(client, context, archived.rows[0], request.actor.account.id, "archived", Number(current.version), {
        snapshot: recordSnapshot(current),
      });
      await notifyOtherParticipant(client, context, request.actor.account.id, createInAppNotification, archived.rows[0], "archived");
      await client.query("UPDATE projects SET updated_at = now() WHERE id = $1", [projectId]);
      return {
        status: 200,
        body: { data: { record: mapRecord(archived.rows[0]) }, meta: { requestId: request.requestId } },
      };
    });
    sendIdempotentResult(response, result);
  }));

  app.post("/api/v1/projects/:id/workspace-records/:recordId/restore", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const projectId = validate(z.uuid(), request.params.id);
    const recordId = validate(z.uuid(), request.params.recordId);
    const input = validate(archiveSchema, request.body);
    const result = await runIdempotentMutation(request, request.actor.account.id, `workspace-records.restore:${recordId}`, async (client) => {
      const context = await loadContext(client, projectId, request.actor.account.id);
      const current = await loadRecord(client, projectId, recordId, request.actor.account.id, { forUpdate: true });
      requireUpdatePermission(context, current, {}, request.actor.account.id);
      if (!current.archived_at) {
        throw new ApiError(409, "WORKSPACE_RECORD_NOT_ARCHIVED", "This record is already active.");
      }
      if (Number(current.version) !== input.expectedVersion) {
        throw new ApiError(409, "WORKSPACE_RECORD_CONFLICT", "This record changed on another device.", {
          current: mapRecord(current),
        });
      }
      const restored = await client.query(
        `UPDATE project_workspace_records
         SET archived_at = NULL, version = version + 1,
             updated_by_account_id = $3, updated_at = now()
         WHERE id = $1 AND project_id = $2 AND version = $4 AND archived_at IS NOT NULL
         RETURNING *`,
        [recordId, projectId, request.actor.account.id, input.expectedVersion],
      );
      if (!restored.rowCount) throw new ApiError(409, "WORKSPACE_RECORD_CONFLICT", "This record changed on another device.");
      await insertEvent(client, context, restored.rows[0], request.actor.account.id, "updated", Number(current.version), {
        action: "restored",
        snapshot: recordSnapshot(restored.rows[0]),
      });
      await notifyOtherParticipant(client, context, request.actor.account.id, createInAppNotification, restored.rows[0], "restored");
      await client.query("UPDATE projects SET updated_at = now() WHERE id = $1", [projectId]);
      return {
        status: 200,
        body: { data: { record: mapRecord(restored.rows[0]) }, meta: { requestId: request.requestId } },
      };
    });
    sendIdempotentResult(response, result);
  }));
}
