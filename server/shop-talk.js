import { ApiError, asyncRoute, validate, z } from "./api.js";

const shopTalkTargetSchema = z.object({
  targetType: z.enum(["thread", "answer"]),
  targetKey: z.string().trim().min(1).max(180).regex(/^[A-Za-z0-9:_-]+$/),
});

const shopTalkReactionBatchSchema = z.object({
  targets: z.array(shopTalkTargetSchema).max(100),
});

const shopTalkReactionSchema = shopTalkTargetSchema.extend({
  reaction: z.enum(["up", "down"]).nullable(),
});

function shopTalkTargetSubject(target) {
  return `${target.targetType}:${target.targetKey}`;
}

function normalizeShopTalkTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    if (target.targetType === "thread" && !target.targetKey.startsWith("post:")) {
      throw new ApiError(422, "SHOP_TALK_TARGET_INVALID", "Thread reactions must reference a Shop Talk post target.");
    }
    if (target.targetType === "answer" && !target.targetKey.startsWith("answer:")) {
      throw new ApiError(422, "SHOP_TALK_TARGET_INVALID", "Answer reactions must reference a Shop Talk answer target.");
    }
    const key = shopTalkTargetSubject(target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapShopTalkReactionRow(row) {
  const upvotes = Number(row.upvotes ?? 0);
  const downvotes = Number(row.downvotes ?? 0);
  return {
    targetType: row.target_type,
    targetKey: row.target_key,
    upvotes,
    downvotes,
    score: upvotes - downvotes,
    viewerReaction: row.viewer_reaction ?? null,
  };
}

async function loadShopTalkReactionAggregates(client, accountId, targets) {
  const uniqueTargets = normalizeShopTalkTargets(targets);
  if (!uniqueTargets.length) return [];

  const params = [accountId];
  const valuesSql = uniqueTargets.map((target, index) => {
    params.push(target.targetType, target.targetKey);
    const baseIndex = index * 2 + 2;
    return `($${baseIndex}::text, $${baseIndex + 1}::text, ${index}::int)`;
  }).join(", ");

  const result = await client.query(
    `WITH requested(target_type, target_key, sort_order) AS (
       VALUES ${valuesSql}
     )
     SELECT requested.target_type,
            requested.target_key,
            count(reactions.id) FILTER (WHERE reactions.reaction = 'up')::int AS upvotes,
            count(reactions.id) FILTER (WHERE reactions.reaction = 'down')::int AS downvotes,
            max(reactions.reaction) FILTER (WHERE reactions.actor_account_id = $1::uuid) AS viewer_reaction
     FROM requested
     LEFT JOIN shop_talk_reactions reactions
       ON reactions.target_type = requested.target_type
      AND reactions.target_key = requested.target_key
     GROUP BY requested.target_type, requested.target_key, requested.sort_order
     ORDER BY requested.sort_order`,
    params,
  );

  return result.rows.map(mapShopTalkReactionRow);
}

async function loadShopTalkReactionSummary(client, accountId) {
  const result = await client.query(
    `SELECT count(*)::int AS reactions_given,
            count(*) FILTER (WHERE reaction = 'up')::int AS upvotes_given,
            count(*) FILTER (WHERE reaction = 'down')::int AS downvotes_given,
            count(DISTINCT target_type || ':' || target_key)::int AS targets_reacted,
            max(updated_at) AS last_reacted_at
     FROM shop_talk_reactions
     WHERE actor_account_id = $1`,
    [accountId],
  );
  const row = result.rows[0] ?? {};
  return {
    reactionsGiven: Number(row.reactions_given ?? 0),
    upvotesGiven: Number(row.upvotes_given ?? 0),
    downvotesGiven: Number(row.downvotes_given ?? 0),
    targetsReacted: Number(row.targets_reacted ?? 0),
    lastReactedAt: row.last_reacted_at ? new Date(row.last_reacted_at).toISOString() : null,
  };
}

export function registerShopTalkRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  app.post("/api/v1/shop-talk/reactions/batch", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const input = validate(shopTalkReactionBatchSchema, request.body);
    const targets = normalizeShopTalkTargets(input.targets);
    const [reactions, reputation] = await Promise.all([
      loadShopTalkReactionAggregates(database, request.actor.account.id, targets),
      loadShopTalkReactionSummary(database, request.actor.account.id),
    ]);
    response.json({
      data: { reactions, reputation },
      meta: { requestId: request.requestId },
    });
  }));

  app.get("/api/v1/shop-talk/reputation/me", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const reputation = await loadShopTalkReactionSummary(database, request.actor.account.id);
    response.json({
      data: { reputation },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/shop-talk/reactions", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(shopTalkReactionSchema, request.body);
    const [target] = normalizeShopTalkTargets([input]);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `shop-talk.reaction:${shopTalkTargetSubject(target)}`,
      async (client) => {
        const existing = await client.query(
          `SELECT id, reaction
           FROM shop_talk_reactions
           WHERE actor_account_id = $1 AND target_type = $2 AND target_key = $3
           FOR UPDATE`,
          [request.actor.account.id, target.targetType, target.targetKey],
        );
        const previousReaction = existing.rows[0]?.reaction ?? null;
        let reactionId = existing.rows[0]?.id ?? null;

        if (input.reaction) {
          const upserted = await client.query(
            `INSERT INTO shop_talk_reactions (
               actor_account_id, target_type, target_key, reaction
             ) VALUES ($1, $2, $3, $4)
             ON CONFLICT (actor_account_id, target_type, target_key)
             DO UPDATE SET reaction = EXCLUDED.reaction,
                           updated_at = CASE
                             WHEN shop_talk_reactions.reaction IS DISTINCT FROM EXCLUDED.reaction THEN now()
                             ELSE shop_talk_reactions.updated_at
                           END
             RETURNING id`,
            [request.actor.account.id, target.targetType, target.targetKey, input.reaction],
          );
          reactionId = upserted.rows[0].id;
        } else if (reactionId) {
          await client.query("DELETE FROM shop_talk_reactions WHERE id = $1", [reactionId]);
        }

        if (previousReaction !== input.reaction) {
          await client.query(
            `INSERT INTO shop_talk_reaction_events (
               reaction_id, actor_account_id, target_type, target_key, event_type,
               previous_reaction, next_reaction, request_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              input.reaction ? reactionId : null,
              request.actor.account.id,
              target.targetType,
              target.targetKey,
              input.reaction ? `set_${input.reaction}` : "cleared",
              previousReaction,
              input.reaction,
              request.requestId,
            ],
          );
          await client.query(
            `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
             VALUES ($1, $2, $3, 'shop_talk_reaction', $4, $5::jsonb)`,
            [
              request.requestId,
              request.actor.account.id,
              input.reaction ? "shop_talk.reaction.set" : "shop_talk.reaction.cleared",
              shopTalkTargetSubject(target),
              JSON.stringify({ previousReaction, nextReaction: input.reaction }),
            ],
          );
        }

        const [reaction] = await loadShopTalkReactionAggregates(client, request.actor.account.id, [target]);
        const reputation = await loadShopTalkReactionSummary(client, request.actor.account.id);
        return {
          status: 200,
          body: {
            data: { reaction, reputation },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));
}
