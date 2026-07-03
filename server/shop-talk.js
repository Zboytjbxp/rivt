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

const shopTalkPostsQuerySchema = z.object({
  community: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
});

const shopTalkPostParamsSchema = z.object({
  postId: z.uuid(),
});

const shopTalkAnswerParamsSchema = z.object({
  postId: z.uuid(),
  answerId: z.uuid(),
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

const shopTalkPostCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(4000).optional().default(""),
  trade: z.string().trim().min(1).max(60),
  flair: z.enum(["Question", "Discussion", "Code Talk", "Compliance", "Tip", "Humor"]).nullable().optional(),
  postType: z.enum(["question", "sub-request", "safety", "general"]).optional().default("general"),
  communitySlug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
});

const shopTalkAnswerCreateSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

function defaultCommunitySlugForTrade(trade) {
  switch (String(trade ?? "").trim().toLowerCase()) {
    case "carpentry":
      return "carpentry-talk";
    case "electrical":
      return "electrical-talk";
    case "plumbing":
      return "plumbing-talk";
    case "tile":
      return "tile-talk";
    case "cabinetry":
      return "cabinetry-talk";
    case "remodeling":
    case "remodelers":
      return "remodelers";
    case "side work":
      return "side-work";
    default:
      return "jacksonville-trades";
  }
}

function mapShopTalkAnswerRow(row) {
  return {
    id: row.id,
    author: row.author_name,
    body: row.body,
    verifiedFix: Boolean(row.verified_fix),
    createdAt: row.created_at,
    moderationStatus: row.moderation_status ?? "visible",
  };
}

function mapShopTalkPostRow(row) {
  return {
    id: row.id,
    author: row.author_name,
    trade: row.trade,
    flair: row.flair ?? undefined,
    type: row.post_type,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    moderationStatus: row.moderation_status ?? "visible",
    communityId: row.community_id,
    communitySlug: row.community_slug,
    communityName: row.community_name,
    answers: Array.isArray(row.answers) ? row.answers.map(mapShopTalkAnswerRow) : [],
  };
}

async function requireCommunityForPost(client, slug) {
  const found = await client.query(
    `SELECT id, slug, name, moderation_status
     FROM communities
     WHERE slug = $1
       AND archived_at IS NULL
       AND moderation_status <> 'hidden'`,
    [slug],
  );
  if (!found.rowCount) {
    throw new ApiError(422, "COMMUNITY_REQUIRED", "Choose an active community for this post.");
  }
  if (found.rows[0].moderation_status === "locked") {
    throw new ApiError(409, "COMMUNITY_LOCKED", "This community is locked and cannot receive new posts.");
  }
  return found.rows[0];
}

async function fetchShopTalkPostRows(client, { communitySlug = null } = {}) {
  const params = [];
  let whereClause = `WHERE community.archived_at IS NULL
     AND community.moderation_status <> 'hidden'
     AND post.moderation_status <> 'hidden'`;
  if (communitySlug) {
    params.push(communitySlug);
    whereClause += ` AND community.slug = $${params.length}`;
  }
  const result = await client.query(
    `SELECT post.id,
            post.author_name,
            post.trade,
            post.flair,
            post.post_type,
            post.title,
            post.body,
            post.status,
            post.created_at,
            post.moderation_status,
            post.community_id,
            community.slug AS community_slug,
            community.name AS community_name,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', answer.id,
                  'author_name', answer.author_name,
                  'body', answer.body,
                  'verified_fix', answer.verified_fix,
                  'created_at', answer.created_at,
                  'moderation_status', answer.moderation_status
                )
                ORDER BY answer.verified_fix DESC, answer.created_at ASC, answer.id ASC
              ) FILTER (WHERE answer.id IS NOT NULL),
              '[]'::jsonb
            ) AS answers
     FROM shop_talk_posts post
     JOIN communities community ON community.id = post.community_id
     LEFT JOIN shop_talk_answers answer
       ON answer.post_id = post.id
      AND answer.deleted_at IS NULL
      AND answer.moderation_status <> 'hidden'
     ${whereClause}
     GROUP BY post.id, community.slug, community.name
     ORDER BY post.created_at DESC, post.id DESC
     LIMIT 100`,
    params,
  );
  return result.rows;
}

async function fetchShopTalkAnswerRows(client, postId) {
  const result = await client.query(
    `SELECT id, author_name, body, verified_fix, created_at, moderation_status
     FROM shop_talk_answers
     WHERE post_id = $1
       AND deleted_at IS NULL
       AND moderation_status <> 'hidden'
     ORDER BY verified_fix DESC, created_at ASC, id ASC`,
    [postId],
  );
  return result.rows;
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
  app.get("/api/v1/shop-talk/posts", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const { community } = validate(shopTalkPostsQuerySchema, request.query);
    const rows = await fetchShopTalkPostRows(database, { communitySlug: community ?? null });
    response.json({
      data: { posts: rows.map(mapShopTalkPostRow) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/shop-talk/posts", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(shopTalkPostCreateSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      "shop-talk.post.create",
      async (client) => {
        const profile = await client.query(
          "SELECT display_name FROM profiles WHERE account_id = $1",
          [request.actor.account.id],
        );
        const authorName = (profile.rows[0]?.display_name || "").trim() || "RIVT member";
        const community = await requireCommunityForPost(
          client,
          input.communitySlug ?? defaultCommunitySlugForTrade(input.trade),
        );
        const inserted = await client.query(
          `INSERT INTO shop_talk_posts (
             author_account_id, author_name, community_id, trade, flair, post_type, title, body
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, author_name, community_id, trade, flair, post_type, title, body, status, created_at, moderation_status`,
          [
            request.actor.account.id,
            authorName,
            community.id,
            input.trade,
            input.flair ?? null,
            input.postType,
            input.title,
            input.body,
          ],
        );
        inserted.rows[0].community_slug = community.slug;
        inserted.rows[0].community_name = community.name;
        inserted.rows[0].answers = [];
        return {
          status: 201,
          body: {
            data: { post: mapShopTalkPostRow(inserted.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.get("/api/v1/shop-talk/posts/:postId/answers", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const { postId } = validate(shopTalkPostParamsSchema, request.params);
    const found = await database.query(
      `SELECT post.id
       FROM shop_talk_posts post
       JOIN communities community ON community.id = post.community_id
       WHERE post.id = $1
         AND post.moderation_status <> 'hidden'
         AND community.archived_at IS NULL
         AND community.moderation_status <> 'hidden'`,
      [postId],
    );
    if (!found.rowCount) {
      throw new ApiError(404, "SHOP_TALK_POST_NOT_FOUND", "That Shop Talk post does not exist.");
    }
    const rows = await fetchShopTalkAnswerRows(database, postId);
    response.json({
      data: { answers: rows.map(mapShopTalkAnswerRow) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/shop-talk/posts/:postId/answers", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const { postId } = validate(shopTalkPostParamsSchema, request.params);
    const input = validate(shopTalkAnswerCreateSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `shop-talk.answer.create:${postId}`,
      async (client) => {
        const post = await client.query(
          `SELECT post.id, post.moderation_status, community.moderation_status AS community_moderation_status
           FROM shop_talk_posts post
           JOIN communities community ON community.id = post.community_id
           WHERE post.id = $1
             AND community.archived_at IS NULL
             AND post.moderation_status <> 'hidden'
             AND community.moderation_status <> 'hidden'
           FOR UPDATE OF post`,
          [postId],
        );
        if (!post.rowCount) {
          throw new ApiError(404, "SHOP_TALK_POST_NOT_FOUND", "That Shop Talk post does not exist.");
        }
        if (post.rows[0].moderation_status === "locked" || post.rows[0].community_moderation_status === "locked") {
          throw new ApiError(409, "SHOP_TALK_LOCKED", "This conversation is locked and cannot receive new answers.");
        }
        const profile = await client.query(
          "SELECT display_name FROM profiles WHERE account_id = $1",
          [request.actor.account.id],
        );
        const authorName = (profile.rows[0]?.display_name || "").trim() || "RIVT member";
        const inserted = await client.query(
          `INSERT INTO shop_talk_answers (post_id, author_account_id, author_name, body)
           VALUES ($1, $2, $3, $4)
           RETURNING id, author_name, body, verified_fix, created_at, moderation_status`,
          [postId, request.actor.account.id, authorName, input.body],
        );
        await client.query(
          `UPDATE shop_talk_posts
           SET status = CASE WHEN status = 'Needs a pro answer' THEN 'Open' ELSE status END,
               updated_at = now()
           WHERE id = $1`,
          [postId],
        );
        await client.query(
          `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
           VALUES ($1, $2, 'shop_talk.answer.created', 'shop_talk_answer', $3, $4::jsonb)`,
          [
            request.requestId,
            request.actor.account.id,
            inserted.rows[0].id,
            JSON.stringify({ postId }),
          ],
        );
        return {
          status: 201,
          body: {
            data: { answer: mapShopTalkAnswerRow(inserted.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.post("/api/v1/shop-talk/posts/:postId/answers/:answerId/verified-fix", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const { postId, answerId } = validate(shopTalkAnswerParamsSchema, request.params);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `shop-talk.answer.verify:${postId}:${answerId}`,
      async (client) => {
        const post = await client.query(
          `SELECT post.id, post.author_account_id
           FROM shop_talk_posts post
           JOIN communities community ON community.id = post.community_id
           WHERE post.id = $1
             AND post.moderation_status <> 'hidden'
             AND community.archived_at IS NULL
             AND community.moderation_status <> 'hidden'
           FOR UPDATE OF post`,
          [postId],
        );
        if (!post.rowCount) {
          throw new ApiError(404, "SHOP_TALK_POST_NOT_FOUND", "That Shop Talk post does not exist.");
        }
        if (post.rows[0].author_account_id !== request.actor.account.id) {
          throw new ApiError(403, "SHOP_TALK_VERIFY_FORBIDDEN", "Only the original poster can mark a verified fix.");
        }
        const answer = await client.query(
          `SELECT id
           FROM shop_talk_answers
           WHERE id = $1
             AND post_id = $2
             AND deleted_at IS NULL
             AND moderation_status <> 'hidden'
           FOR UPDATE`,
          [answerId, postId],
        );
        if (!answer.rowCount) {
          throw new ApiError(404, "SHOP_TALK_ANSWER_NOT_FOUND", "That answer does not exist.");
        }
        await client.query(
          `UPDATE shop_talk_answers
           SET verified_fix = false, updated_at = now()
           WHERE post_id = $1 AND verified_fix = true`,
          [postId],
        );
        await client.query(
          `UPDATE shop_talk_answers
           SET verified_fix = true, updated_at = now()
           WHERE id = $1`,
          [answerId],
        );
        await client.query(
          "UPDATE shop_talk_posts SET status = 'Verified Fix', updated_at = now() WHERE id = $1",
          [postId],
        );
        await client.query(
          `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
           VALUES ($1, $2, 'shop_talk.answer.verified_fix', 'shop_talk_answer', $3, $4::jsonb)`,
          [
            request.requestId,
            request.actor.account.id,
            answerId,
            JSON.stringify({ postId }),
          ],
        );
        const answers = await fetchShopTalkAnswerRows(client, postId);
        return {
          status: 200,
          body: {
            data: { answers: answers.map(mapShopTalkAnswerRow) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

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
