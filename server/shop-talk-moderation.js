import { ApiError, asyncRoute, validate, z } from "./api.js";
import { requireAdminRole } from "./reviews-safety.js";

const reportTargetSchema = z.object({
  targetType: z.enum(["community", "post", "answer"]),
  targetId: z.uuid(),
  reasonCode: z.enum(["spam", "harassment", "unsafe_advice", "misinformation", "privacy", "duplicate", "other"]),
  note: z.string().trim().max(1000).optional().default(""),
});

const moderationReportsQuerySchema = z.object({
  status: z.enum(["open", "reviewing", "actioned", "dismissed", "all"]).optional().default("open"),
});

const moderationActionSchema = z.object({
  action: z.enum(["dismiss", "hide", "lock", "archive_community", "restore"]),
  reasonCode: z.string().trim().min(2).max(80),
  reason: z.string().trim().min(1).max(2000),
});

const moderationReportParamsSchema = z.object({
  reportId: z.uuid(),
});

function isoDateTime(value) {
  return value ? new Date(value).toISOString() : null;
}

function mapModerationReport(row) {
  return {
    id: row.id,
    reporterAccountId: row.reporter_account_id,
    reporterName: row.reporter_name ?? "",
    targetType: row.target_type,
    targetId: row.target_id,
    reasonCode: row.reason_code,
    note: row.note || "",
    targetSnapshot: row.target_snapshot ?? {},
    status: row.status,
    reviewedByAccountId: row.reviewed_by_account_id,
    reviewedAt: isoDateTime(row.reviewed_at),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
  };
}

function mapModerationAction(row) {
  return {
    id: row.id,
    reportId: row.report_id,
    actorAccountId: row.actor_account_id,
    targetType: row.target_type,
    targetId: row.target_id,
    action: row.action,
    reasonCode: row.reason_code,
    reason: row.reason,
    metadata: row.metadata ?? {},
    occurredAt: isoDateTime(row.occurred_at),
  };
}

async function loadReportTarget(client, targetType, targetId) {
  if (targetType === "community") {
    const found = await client.query(
      `SELECT id, slug, name, description, moderation_status, archived_at
       FROM communities
       WHERE id = $1`,
      [targetId],
    );
    if (!found.rowCount) {
      throw new ApiError(404, "SHOP_TALK_TARGET_NOT_FOUND", "That community does not exist.");
    }
    const row = found.rows[0];
    return {
      id: row.id,
      label: row.name,
      snapshot: {
        slug: row.slug,
        name: row.name,
        description: row.description,
        moderationStatus: row.moderation_status,
        archivedAt: isoDateTime(row.archived_at),
      },
    };
  }

  if (targetType === "post") {
    const found = await client.query(
      `SELECT post.id, post.title, post.body, post.author_account_id, post.author_name,
              post.moderation_status, community.slug AS community_slug, community.name AS community_name
       FROM shop_talk_posts post
       JOIN communities community ON community.id = post.community_id
       WHERE post.id = $1`,
      [targetId],
    );
    if (!found.rowCount) {
      throw new ApiError(404, "SHOP_TALK_TARGET_NOT_FOUND", "That post does not exist.");
    }
    const row = found.rows[0];
    return {
      id: row.id,
      label: row.title,
      snapshot: {
        title: row.title,
        bodyExcerpt: String(row.body ?? "").slice(0, 240),
        authorAccountId: row.author_account_id,
        authorName: row.author_name,
        communitySlug: row.community_slug,
        communityName: row.community_name,
        moderationStatus: row.moderation_status,
      },
    };
  }

  const found = await client.query(
    `SELECT answer.id, answer.body, answer.author_account_id, answer.author_name,
            answer.moderation_status, answer.verified_fix, post.id AS post_id,
            post.title AS post_title, community.slug AS community_slug,
            community.name AS community_name
     FROM shop_talk_answers answer
     JOIN shop_talk_posts post ON post.id = answer.post_id
     JOIN communities community ON community.id = post.community_id
     WHERE answer.id = $1`,
    [targetId],
  );
  if (!found.rowCount) {
    throw new ApiError(404, "SHOP_TALK_TARGET_NOT_FOUND", "That answer does not exist.");
  }
  const row = found.rows[0];
  return {
    id: row.id,
    label: row.post_title,
    snapshot: {
      postId: row.post_id,
      postTitle: row.post_title,
      bodyExcerpt: String(row.body ?? "").slice(0, 240),
      authorAccountId: row.author_account_id,
      authorName: row.author_name,
      verifiedFix: Boolean(row.verified_fix),
      communitySlug: row.community_slug,
      communityName: row.community_name,
      moderationStatus: row.moderation_status,
    },
  };
}

async function applyModerationAction(client, { targetType, targetId, action }) {
  if (action === "dismiss") {
    return { applied: false };
  }

  if (targetType === "community") {
    if (action === "hide") {
      await client.query("UPDATE communities SET moderation_status = 'hidden', updated_at = now() WHERE id = $1", [targetId]);
      return { applied: true, moderationStatus: "hidden" };
    }
    if (action === "lock") {
      await client.query("UPDATE communities SET moderation_status = 'locked', updated_at = now() WHERE id = $1", [targetId]);
      return { applied: true, moderationStatus: "locked" };
    }
    if (action === "archive_community") {
      await client.query("UPDATE communities SET moderation_status = 'hidden', archived_at = COALESCE(archived_at, now()), updated_at = now() WHERE id = $1", [targetId]);
      return { applied: true, moderationStatus: "hidden", archived: true };
    }
    if (action === "restore") {
      await client.query("UPDATE communities SET moderation_status = 'visible', archived_at = NULL, updated_at = now() WHERE id = $1", [targetId]);
      return { applied: true, moderationStatus: "visible", restored: true };
    }
  }

  if (targetType === "post") {
    if (action === "hide") {
      await client.query("UPDATE shop_talk_posts SET moderation_status = 'hidden', updated_at = now() WHERE id = $1", [targetId]);
      return { applied: true, moderationStatus: "hidden" };
    }
    if (action === "lock") {
      await client.query("UPDATE shop_talk_posts SET moderation_status = 'locked', updated_at = now() WHERE id = $1", [targetId]);
      return { applied: true, moderationStatus: "locked" };
    }
    if (action === "restore") {
      await client.query("UPDATE shop_talk_posts SET moderation_status = 'visible', updated_at = now() WHERE id = $1", [targetId]);
      return { applied: true, moderationStatus: "visible" };
    }
  }

  if (targetType === "answer") {
    if (action === "hide") {
      await client.query(
        `UPDATE shop_talk_answers
         SET moderation_status = 'hidden',
             verified_fix = false,
             updated_at = now()
         WHERE id = $1`,
        [targetId],
      );
      return { applied: true, moderationStatus: "hidden" };
    }
    if (action === "restore") {
      await client.query("UPDATE shop_talk_answers SET moderation_status = 'visible', updated_at = now() WHERE id = $1", [targetId]);
      return { applied: true, moderationStatus: "visible" };
    }
  }

  throw new ApiError(422, "SHOP_TALK_MODERATION_ACTION_INVALID", "That moderation action is not valid for this target.");
}

export function registerShopTalkModerationRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  requireV1AdminActor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
  insertAdminAction,
}) {
  app.post("/api/v1/shop-talk/reports", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(reportTargetSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `shop-talk.report:${input.targetType}:${input.targetId}:${input.reasonCode}`,
      async (client) => {
        const target = await loadReportTarget(client, input.targetType, input.targetId);
        const inserted = await client.query(
          `INSERT INTO shop_talk_reports (
             reporter_account_id, target_type, target_id, reason_code, note, target_snapshot
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT (reporter_account_id, target_type, target_id, reason_code)
             WHERE status IN ('open', 'reviewing')
           DO UPDATE SET note = CASE
               WHEN EXCLUDED.note <> '' THEN EXCLUDED.note
               ELSE shop_talk_reports.note
             END,
             updated_at = now()
           RETURNING *`,
          [
            request.actor.account.id,
            input.targetType,
            input.targetId,
            input.reasonCode,
            input.note,
            JSON.stringify(target.snapshot),
          ],
        );
        await client.query(
          `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
           VALUES ($1, $2, 'shop_talk.reported', 'shop_talk_report', $3, $4::jsonb)`,
          [
            request.requestId,
            request.actor.account.id,
            inserted.rows[0].id,
            JSON.stringify({ targetType: input.targetType, targetId: input.targetId, reasonCode: input.reasonCode, label: target.label }),
          ],
        );
        return {
          status: 201,
          body: {
            data: { report: mapModerationReport(inserted.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.get("/api/v1/admin/shop-talk/reports", requireV1AuthenticatedUser, requireV1AdminActor, asyncRoute(async (request, response) => {
    requireAdminRole(request.admin, ["owner", "support", "moderator"]);
    const { status } = validate(moderationReportsQuerySchema, request.query);
    const params = [];
    const statusClause = status === "all" ? "" : "WHERE report.status = $1";
    if (status !== "all") params.push(status);
    const reports = await database.query(
      `SELECT report.*,
              profile.display_name AS reporter_name
       FROM shop_talk_reports report
       LEFT JOIN profiles profile ON profile.account_id = report.reporter_account_id
       ${statusClause}
       ORDER BY report.created_at DESC, report.id DESC
       LIMIT 100`,
      params,
    );
    response.json({
      data: { reports: reports.rows.map(mapModerationReport) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/admin/shop-talk/reports/:reportId/actions", requireV1AuthenticatedUser, requireV1AdminActor, writeRateLimit, asyncRoute(async (request, response) => {
    requireAdminRole(request.admin, ["owner", "support", "moderator"]);
    const { reportId } = validate(moderationReportParamsSchema, request.params);
    const input = validate(moderationActionSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `admin.shop-talk.report:${reportId}:${input.action}`,
      async (client) => {
        const reportResult = await client.query("SELECT * FROM shop_talk_reports WHERE id = $1 FOR UPDATE", [reportId]);
        if (!reportResult.rowCount) {
          throw new ApiError(404, "SHOP_TALK_REPORT_NOT_FOUND", "That moderation report does not exist.");
        }
        const report = reportResult.rows[0];
        await loadReportTarget(client, report.target_type, report.target_id);
        const actionResult = await applyModerationAction(client, {
          targetType: report.target_type,
          targetId: report.target_id,
          action: input.action,
        });
        const reportStatus = input.action === "dismiss" ? "dismissed" : "actioned";
        await client.query(
          `UPDATE shop_talk_reports
           SET status = $2,
               reviewed_by_account_id = $3,
               reviewed_at = now(),
               updated_at = now()
           WHERE id = $1`,
          [reportId, reportStatus, request.actor.account.id],
        );
        const insertedAction = await client.query(
          `INSERT INTO shop_talk_moderation_actions (
             report_id, actor_account_id, target_type, target_id, action, reason_code, reason, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
           RETURNING *`,
          [
            reportId,
            request.actor.account.id,
            report.target_type,
            report.target_id,
            input.action,
            input.reasonCode,
            input.reason,
            JSON.stringify(actionResult),
          ],
        );
        await insertAdminAction(client, request.actor.account.id, {
          action: `shop_talk.${input.action}`,
          subjectType: `shop_talk_${report.target_type}`,
          subjectId: report.target_id,
          reasonCode: input.reasonCode,
          reason: input.reason,
          metadata: { reportId, ...actionResult },
        });
        const updated = await client.query(
          `SELECT report.*,
                  profile.display_name AS reporter_name
           FROM shop_talk_reports report
           LEFT JOIN profiles profile ON profile.account_id = report.reporter_account_id
           WHERE report.id = $1`,
          [reportId],
        );
        return {
          status: 200,
          body: {
            data: {
              report: mapModerationReport(updated.rows[0]),
              action: mapModerationAction(insertedAction.rows[0]),
            },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));
}
