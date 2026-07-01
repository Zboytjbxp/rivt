import { ApiError, asyncRoute, validate, z } from "./api.js";

const communitySlugSchema = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/),
});

function mapCommunityRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    memberCount: Number(row.member_count ?? 0),
    joined: Boolean(row.joined),
  };
}

async function requireCommunityId(database, slug) {
  const found = await database.query("SELECT id FROM communities WHERE slug = $1", [slug]);
  if (!found.rowCount) {
    throw new ApiError(404, "COMMUNITY_NOT_FOUND", "That community does not exist.");
  }
  return found.rows[0].id;
}

export function registerCommunityRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
}) {
  app.get("/api/v1/communities", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const result = await database.query(
      `SELECT c.id, c.slug, c.name, c.description,
              c.member_count + COALESCE(m.cnt, 0) AS member_count,
              (vm.account_id IS NOT NULL) AS joined
       FROM communities c
       LEFT JOIN (
         SELECT community_id, count(*)::int AS cnt
         FROM community_members
         GROUP BY community_id
       ) m ON m.community_id = c.id
       LEFT JOIN community_members vm
         ON vm.community_id = c.id AND vm.account_id = $1
       ORDER BY c.member_count DESC, c.id DESC`,
      [request.actor.account.id],
    );
    response.json({
      data: { communities: result.rows.map(mapCommunityRow) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/communities/:slug/join", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const { slug } = validate(communitySlugSchema, request.params);
    const communityId = await requireCommunityId(database, slug);
    await database.query(
      `INSERT INTO community_members (community_id, account_id)
       VALUES ($1, $2)
       ON CONFLICT (community_id, account_id) DO NOTHING`,
      [communityId, request.actor.account.id],
    );
    response.json({
      data: { slug, joined: true },
      meta: { requestId: request.requestId },
    });
  }));

  app.delete("/api/v1/communities/:slug/join", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const { slug } = validate(communitySlugSchema, request.params);
    const communityId = await requireCommunityId(database, slug);
    await database.query(
      "DELETE FROM community_members WHERE community_id = $1 AND account_id = $2",
      [communityId, request.actor.account.id],
    );
    response.json({
      data: { slug, joined: false },
      meta: { requestId: request.requestId },
    });
  }));
}
