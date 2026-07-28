import { ApiError, asyncRoute, validate, z } from "./api.js";
import { canonicalNewsArticleUrl } from "./news.js";

const preferenceSchema = z.object({
  scope: z.enum(["local", "all"]),
  location: z.string().trim().max(80),
  category: z.string().trim().min(1).max(80),
  trade: z.string().trim().min(1).max(80),
  followedTrades: z.array(z.string().trim().min(1).max(80)).max(80),
  followedTopics: z.array(z.string().trim().min(1).max(120)).max(80),
  expectedVersion: z.number().int().min(0),
});

const savedArticleSchema = z.object({
  url: z.url().max(2048),
  headline: z.string().trim().max(400),
  source: z.string().trim().max(200),
  publishedAt: z.iso.datetime({ offset: true }).nullable().optional().default(null),
  category: z.string().trim().max(80).optional().default(""),
  trades: z.array(z.string().trim().min(1).max(80)).max(80).optional().default([]),
  topics: z.array(z.string().trim().min(1).max(120)).max(80).optional().default([]),
  thumbnailUrl: z.url().max(2048).nullable().optional().default(null),
});

const savedArticleDeleteSchema = z.object({
  url: z.string().trim().min(1).max(2048),
});

function uniqueStrings(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function mapPreference(row) {
  if (!row) return null;
  return {
    scope: row.scope,
    location: row.location || "",
    category: row.category,
    trade: row.trade,
    followedTrades: row.followed_trades ?? [],
    followedTopics: row.followed_topics ?? [],
    version: Number(row.version),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapSavedArticle(row) {
  return {
    id: row.id,
    canonicalUrl: row.canonical_url,
    url: row.article_url,
    headline: row.headline,
    source: row.source,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    category: row.category || "",
    trades: row.trades ?? [],
    topics: row.topics ?? [],
    thumbnailUrl: row.thumbnail_url ?? null,
    savedAt: new Date(row.saved_at).toISOString(),
  };
}

function canonicalOrThrow(value) {
  const canonicalUrl = canonicalNewsArticleUrl(value);
  if (!canonicalUrl) {
    throw new ApiError(422, "TRADE_NEWS_URL_INVALID", "Use a valid HTTP or HTTPS article link.");
  }
  return canonicalUrl;
}

export function registerNewsContinuityRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
}) {
  app.get("/api/v1/trade-news/preferences", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const accountId = request.actor.account.id;
    const [preference, savedArticles] = await Promise.all([
      database.query("SELECT * FROM trade_news_preferences WHERE account_id = $1", [accountId]),
      database.query(
        `SELECT * FROM trade_news_saved_articles
         WHERE account_id = $1
         ORDER BY saved_at DESC, id DESC
         LIMIT 500`,
        [accountId],
      ),
    ]);
    response.json({
      data: {
        preference: mapPreference(preference.rows[0]),
        savedArticles: savedArticles.rows.map(mapSavedArticle),
      },
      meta: { requestId: request.requestId },
    });
  }));

  app.put("/api/v1/trade-news/preferences", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(preferenceSchema, request.body);
    const accountId = request.actor.account.id;
    const saved = await database.query(
      `INSERT INTO trade_news_preferences (
         account_id, scope, location, category, trade, followed_trades, followed_topics
       )
       SELECT $1, $2, $3, $4, $5, $6::text[], $7::text[]
       WHERE $8::integer = 0
       ON CONFLICT (account_id)
       DO UPDATE SET scope = EXCLUDED.scope,
                     location = EXCLUDED.location,
                     category = EXCLUDED.category,
                     trade = EXCLUDED.trade,
                     followed_trades = EXCLUDED.followed_trades,
                     followed_topics = EXCLUDED.followed_topics,
                     version = trade_news_preferences.version + 1,
                     updated_at = now()
       WHERE trade_news_preferences.version = $8
       RETURNING *`,
      [
        accountId,
        input.scope,
        input.location,
        input.category,
        input.trade,
        uniqueStrings(input.followedTrades),
        uniqueStrings(input.followedTopics),
        input.expectedVersion,
      ],
    );
    if (!saved.rowCount) {
      throw new ApiError(409, "TRADE_NEWS_PREFERENCE_CONFLICT", "Trade News choices changed on another device.");
    }
    response.json({
      data: { preference: mapPreference(saved.rows[0]) },
      meta: { requestId: request.requestId },
    });
  }));

  app.put("/api/v1/trade-news/saved-articles", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(savedArticleSchema, request.body);
    const canonicalUrl = canonicalOrThrow(input.url);
    const saved = await database.query(
      `INSERT INTO trade_news_saved_articles (
         account_id, canonical_url, article_url, headline, source, published_at,
         category, trades, topics, thumbnail_url
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::text[], $10)
       ON CONFLICT (account_id, canonical_url)
       DO UPDATE SET article_url = EXCLUDED.article_url,
                     headline = EXCLUDED.headline,
                     source = EXCLUDED.source,
                     published_at = EXCLUDED.published_at,
                     category = EXCLUDED.category,
                     trades = EXCLUDED.trades,
                     topics = EXCLUDED.topics,
                     thumbnail_url = EXCLUDED.thumbnail_url,
                     updated_at = now()
       RETURNING *`,
      [
        request.actor.account.id,
        canonicalUrl,
        input.url,
        input.headline,
        input.source,
        input.publishedAt,
        input.category,
        uniqueStrings(input.trades),
        uniqueStrings(input.topics),
        input.thumbnailUrl,
      ],
    );
    response.json({
      data: { savedArticle: mapSavedArticle(saved.rows[0]) },
      meta: { requestId: request.requestId },
    });
  }));

  app.delete("/api/v1/trade-news/saved-articles", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const { url } = validate(savedArticleDeleteSchema, request.query);
    const canonicalUrl = canonicalOrThrow(url);
    const removed = await database.query(
      `DELETE FROM trade_news_saved_articles
       WHERE account_id = $1 AND canonical_url = $2
       RETURNING id`,
      [request.actor.account.id, canonicalUrl],
    );
    response.json({
      data: { removed: Boolean(removed.rowCount), canonicalUrl },
      meta: { requestId: request.requestId },
    });
  }));
}

export const newsContinuityInternals = {
  mapPreference,
  mapSavedArticle,
  preferenceSchema,
  savedArticleSchema,
  uniqueStrings,
};
