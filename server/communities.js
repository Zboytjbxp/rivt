import { ApiError, asyncRoute, validate, z } from "./api.js";

const communitySlugSchema = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/),
});

const communitiesQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
});

const communityCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().default(""),
  confirmDuplicate: z.boolean().optional().default(false),
});

const reservedCommunitySlugs = new Set([
  "admin",
  "api",
  "help",
  "home",
  "legal",
  "login",
  "messages",
  "mod",
  "moderator",
  "notifications",
  "privacy",
  "profile",
  "rivt",
  "settings",
  "signup",
  "support",
  "terms",
  "tools",
  "work",
]);

function slugifyCommunityName(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function mapCommunityRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    memberCount: Number(row.member_count ?? 0),
    joined: Boolean(row.joined),
    role: row.role ?? null,
    createdByAccountId: row.created_by_account_id ?? null,
  };
}

async function requireCommunity(database, slug) {
  const found = await database.query(
    `SELECT id, slug, name, description, member_count, created_by_account_id
     FROM communities
     WHERE slug = $1 AND archived_at IS NULL`,
    [slug],
  );
  if (!found.rowCount) {
    throw new ApiError(404, "COMMUNITY_NOT_FOUND", "That community does not exist.");
  }
  return found.rows[0];
}

async function withTransaction(database, action) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function registerCommunityRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
}) {
  app.get("/api/v1/communities", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const { q } = validate(communitiesQuerySchema, request.query);
    const params = [request.actor.account.id];
    let searchClause = "";
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      searchClause = `AND (lower(c.name) LIKE $${params.length} OR lower(c.slug) LIKE $${params.length})`;
    }
    const result = await database.query(
      `SELECT c.id, c.slug, c.name, c.description,
              COALESCE(m.cnt, 0) AS member_count,
              c.created_by_account_id,
              vm.role,
              (vm.account_id IS NOT NULL) AS joined
       FROM communities c
       LEFT JOIN (
         SELECT community_id, count(*)::int AS cnt
         FROM community_members
         GROUP BY community_id
       ) m ON m.community_id = c.id
       LEFT JOIN community_members vm
         ON vm.community_id = c.id AND vm.account_id = $1
       WHERE c.archived_at IS NULL
       ${searchClause}
       ORDER BY COALESCE(m.cnt, 0) DESC, c.updated_at DESC, c.id DESC
       LIMIT 100`,
      params,
    );
    response.json({
      data: { communities: result.rows.map(mapCommunityRow) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/communities", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(communityCreateSchema, request.body);
    const slug = slugifyCommunityName(input.name);
    if (!slug || reservedCommunitySlugs.has(slug)) {
      throw new ApiError(422, "COMMUNITY_NAME_UNAVAILABLE", "Choose a more specific community name.");
    }

    const similar = await database.query(
      `SELECT slug, name, description, member_count
       FROM communities
       WHERE archived_at IS NULL
         AND (
           slug = $1
           OR slug LIKE $2
           OR lower(name) LIKE $3
         )
       ORDER BY CASE WHEN slug = $1 THEN 0 ELSE 1 END, member_count DESC, created_at ASC
       LIMIT 5`,
      [slug, `%${slug}%`, `%${input.name.toLowerCase()}%`],
    );

    if (similar.rowCount && !input.confirmDuplicate) {
      response.status(409).json({
        error: {
          code: "COMMUNITY_DUPLICATE_CANDIDATES",
          message: "A similar community already exists. Join it or confirm you want to create a separate one.",
          requestId: request.requestId,
          details: { candidates: similar.rows.map(mapCommunityRow) },
        },
      });
      return;
    }

    const recent = await database.query(
      `SELECT count(*)::int AS created_today
       FROM communities
       WHERE created_by_account_id = $1
         AND created_at > now() - interval '1 day'`,
      [request.actor.account.id],
    );
    if (Number(recent.rows[0]?.created_today ?? 0) >= 1) {
      throw new ApiError(429, "COMMUNITY_CREATE_LIMIT", "You can create one community per day.");
    }

    const created = await withTransaction(database, async (client) => {
      const inserted = await client.query(
        `INSERT INTO communities (slug, name, description, created_by_account_id, member_count)
         VALUES ($1, $2, $3, $4, 1)
         RETURNING id, slug, name, description, member_count, created_by_account_id`,
        [slug, input.name, input.description, request.actor.account.id],
      );
      await client.query(
        `INSERT INTO community_members (community_id, account_id, role)
         VALUES ($1, $2, 'owner')`,
        [inserted.rows[0].id, request.actor.account.id],
      );
      await client.query(
        `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
         VALUES ($1, $2, 'community.created', 'community', $3, $4::jsonb)`,
        [
          request.requestId,
          request.actor.account.id,
          inserted.rows[0].id,
          JSON.stringify({ slug, name: input.name }),
        ],
      );
      return inserted.rows[0];
    });

    response.status(201).json({
      data: { community: mapCommunityRow({ ...created, joined: true, role: "owner" }) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/communities/:slug/join", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const { slug } = validate(communitySlugSchema, request.params);
    const community = await requireCommunity(database, slug);
    await withTransaction(database, async (client) => {
      const inserted = await client.query(
        `INSERT INTO community_members (community_id, account_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (community_id, account_id) DO NOTHING
         RETURNING community_id`,
        [community.id, request.actor.account.id],
      );
      if (inserted.rowCount) {
        await client.query(
          "UPDATE communities SET member_count = member_count + 1, updated_at = now() WHERE id = $1",
          [community.id],
        );
      }
    });
    response.json({
      data: { slug, joined: true },
      meta: { requestId: request.requestId },
    });
  }));

  app.delete("/api/v1/communities/:slug/join", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const { slug } = validate(communitySlugSchema, request.params);
    const community = await requireCommunity(database, slug);
    await withTransaction(database, async (client) => {
      const membership = await client.query(
        "SELECT role FROM community_members WHERE community_id = $1 AND account_id = $2 FOR UPDATE",
        [community.id, request.actor.account.id],
      );
      if (membership.rows[0]?.role === "owner") {
        const owners = await client.query(
          "SELECT count(*)::int AS owner_count FROM community_members WHERE community_id = $1 AND role = 'owner'",
          [community.id],
        );
        if (Number(owners.rows[0]?.owner_count ?? 0) <= 1) {
          throw new ApiError(409, "COMMUNITY_OWNER_REQUIRED", "Add another owner before leaving this community.");
        }
      }
      const deleted = await client.query(
        "DELETE FROM community_members WHERE community_id = $1 AND account_id = $2 RETURNING community_id",
        [community.id, request.actor.account.id],
      );
      if (deleted.rowCount) {
        await client.query(
          "UPDATE communities SET member_count = greatest(member_count - 1, 0), updated_at = now() WHERE id = $1",
          [community.id],
        );
      }
    });
    response.json({
      data: { slug, joined: false },
      meta: { requestId: request.requestId },
    });
  }));
}
