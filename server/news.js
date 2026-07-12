import { XMLParser } from "fast-xml-parser";
import { Router } from "express";

const router = Router();
const newsCache = new Map(); // key → { items, fetchedAt }
const NEWS_TTL_MS = 10 * 60 * 1000;
const NEWS_ARTICLE_IMAGE_LIMIT = 18;
const NEWS_CACHE_MAX_ENTRIES = 48;
const NEWS_LOCATION_MAX_LENGTH = 80;
const _xmlParser = new XMLParser({ ignoreAttributes: false, ignoreDeclaration: true });

function _normalizeNewsLocation(value) {
  const location = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (!location) return { ok: true, location: "", cacheKey: "national" };
  if (location.length > NEWS_LOCATION_MAX_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Location must be ${NEWS_LOCATION_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (!/^[\p{L}\p{N}\s.,'-]+$/u.test(location)) {
    return {
      ok: false,
      status: 400,
      error: "Location can only include letters, numbers, spaces, commas, periods, apostrophes, and hyphens.",
    };
  }

  return {
    ok: true,
    location,
    cacheKey: location.toLowerCase(),
  };
}

function _pruneNewsCache(now = Date.now()) {
  for (const [key, value] of newsCache) {
    if (!value || now - value.fetchedAt >= NEWS_TTL_MS) {
      newsCache.delete(key);
    }
  }

  while (newsCache.size > NEWS_CACHE_MAX_ENTRIES) {
    let oldestKey = null;
    let oldestFetchedAt = Infinity;
    for (const [key, value] of newsCache) {
      if ((value?.fetchedAt ?? 0) < oldestFetchedAt) {
        oldestFetchedAt = value.fetchedAt;
        oldestKey = key;
      }
    }
    if (!oldestKey) break;
    newsCache.delete(oldestKey);
  }
}

function _stripHtml(str) {
  return (str ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function _fmtDate(raw) {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).slice(0, 16);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return String(raw).slice(0, 16); }
}

function _urgency(title) {
  const t = (title ?? "").toLowerCase();
  if (/osha|heat illness|heat rule|heat exposure/.test(t)) return "Safety";
  if (/permit|permitting/.test(t))                        return "Permit Alert";
  if (/\bnec\b|national electrical code|building code/.test(t)) return "Code Update";
  if (/hvac|refrigerant|r-410a|epa/.test(t))              return "HVAC";
  if (/labor|workforce|shortage|hiring|wage/.test(t))     return "Labor";
  if (/lien|mechanic.?s lien/.test(t))                   return "Legal Alert";
  if (/law|bill|statute|ordinance|regulation/.test(t))    return "Regulation";
  if (/licens/.test(t))                                   return "Licensing";
  return undefined;
}

function _topicThumbnail({ title = "", source = "", urgency = "" } = {}) {
  const haystack = `${urgency} ${source} ${title}`.toLowerCase();
  if (/osha|heat|safety/.test(haystack)) return "/news/heat-safety.svg";
  if (/\bnec\b|code|electrical/.test(haystack)) return "/news/code-update.svg";
  if (/hvac|refrigerant|r-410a|epa/.test(haystack)) return "/news/hvac-refrigerant.svg";
  if (/permit|jacksonville|inspection|ordinance/.test(haystack)) return "/news/permit-watch.svg";
  if (/license|renewal|dbpr|certification/.test(haystack)) return "/news/license-renewal.svg";
  if (/labor|workforce|shortage|hiring|wage/.test(haystack)) return "/news/workforce-market.svg";
  return "/news/rivt-trade-brief.svg";
}

function _fallbackNewsThumbnail(item) {
  return _topicThumbnail({ title: item.headline ?? item.title, source: item.source, urgency: item.urgency });
}

function _isTradeNewsCandidate(item) {
  const text = `${item.headline ?? ""} ${item.summary ?? ""} ${item.source ?? ""}`.toLowerCase();
  if (/\bhomeowners?\b|\bhome owner\b/.test(text)) return false;
  return /contractor|construction|subcontractor|trade|jobsite|osha|safety|permit|inspection|code|nec|nfpa|hvac|refrigerant|roof|electrical|plumbing|carpentry|concrete|masonry|framing|drywall|demolition|development|infrastructure|renovation|mechanical|lien|licens|labor|workforce|apprentice|skilled/.test(text);
}

const curatedTradeNews = [
  {
    headline: "OSHA expands heat inspections for high-risk outdoor work",
    source: "OSHA",
    date: "Apr 10, 2026",
    summary: "OSHA updated its National Emphasis Program on heat exposure. For contractors, the practical takeaway is simple: document water, rest, shade, acclimatization, and heat-response plans before the first hot-weather site visit.",
    url: "https://www.osha.gov/news/newsreleases/osha-national-news-release/20260410",
    urgency: "Safety",
    thumbnailUrl: "/news/heat-safety.svg",
    curated: true,
  },
  {
    headline: "NFPA previews the biggest changes in the 2026 NEC",
    source: "NFPA",
    date: "Jan 29, 2026",
    summary: "The 2026 National Electrical Code cycle is moving, with changes that can affect planning, estimates, and inspection conversations. Electrical contractors should review updates early instead of waiting until a failed rough-in.",
    url: "https://www.nfpa.org/news-blogs-and-articles/blogs/2026/01/29/2026-nec-key-changes",
    urgency: "Code Update",
    thumbnailUrl: "/news/code-update.svg",
    curated: true,
  },
  {
    headline: "EPA removes the R-410A installation deadline",
    source: "ACHR News",
    date: "May 21, 2026",
    summary: "ACHR News reports that EPA removed the R-410A installation deadline. HVAC contractors still need to watch refrigerant rules closely, but this update changes how some pending equipment installs get scheduled.",
    url: "https://www.achrnews.com/articles/166226-epa-removes-r-410a-installation-deadline",
    urgency: "HVAC",
    thumbnailUrl: "/news/hvac-refrigerant.svg",
    curated: true,
  },
  {
    headline: "ABC says construction must attract 349,000 workers in 2026",
    source: "Associated Builders and Contractors",
    date: "Jan 15, 2026",
    summary: "ABC estimates the industry needs hundreds of thousands of additional workers in 2026. For RIVT users, that is the market signal behind faster crew-building, better profiles, and keeping reliable subs close.",
    url: "https://www.abc.org/News-Media/News-Releases/abc-construction-industry-must-attract-349000-workers-in-2026-despite-macroeconomic-headwinds",
    urgency: "Labor",
    thumbnailUrl: "/news/workforce-market.svg",
    curated: true,
  },
  {
    headline: "Florida electrical contractor renewals and CE reminders",
    source: "DBPR",
    date: "2026",
    summary: "Florida DBPR keeps contractor renewal, continuing education, and board information in one place. Keep this bookmarked before hiring, accepting specialty work, or updating compliance records.",
    url: "https://www2.myfloridalicense.com/electrical-contractors/",
    urgency: "License",
    thumbnailUrl: "/news/license-renewal.svg",
    curated: true,
  },
  {
    headline: "Jacksonville permitting guide for contractors",
    source: "PermitFlow",
    date: "Mar 13, 2026",
    summary: "A contractor-focused look at Jacksonville permitting, review steps, and local process expectations. Useful context before posting work that depends on inspection timing or access to permit records.",
    url: "https://www.permitflow.com/blog/jacksonville-building-permit",
    urgency: "Local",
    thumbnailUrl: "/news/permit-watch.svg",
    curated: true,
    isLocal: true,
  },
];

function _resolvePublicImageUrl(value, baseUrl) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw, baseUrl || undefined);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.username || parsed.password) return null;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "0.0.0.0" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "::ffff:127.0.0.1" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^100\.(6[4-9]|[7-9]\d|1([01]\d|2[0-7]))\./.test(hostname) ||
      /^fc[0-9a-f]{2}:/i.test(hostname) ||
      /^fd[0-9a-f]{2}:/i.test(hostname) ||
      /^fe[89ab][0-9a-f]:/i.test(hostname) ||
      /^::ffff:/i.test(hostname)
    ) {
      return null;
    }

    const href = parsed.href;
    if (/favicon|apple-touch-icon|site-logo|\/logo[.\-/]|sprite|avatar|profile-image/i.test(href)) return null;
    if (/google\.com\/s2\/favicons/i.test(href)) return null;
    if (/\.(ico|svg)(\?|#|$)/i.test(parsed.pathname)) return null;

    return href;
  } catch {
    return null;
  }
}

function _imageCandidateFrom(value, baseUrl, depth = 0) {
  if (!value || depth > 4) return null;
  if (typeof value === "string") return _resolvePublicImageUrl(value, baseUrl);
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = _imageCandidateFrom(item, baseUrl, depth + 1);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof value !== "object") return null;

  for (const key of ["@_url", "@_href", "url", "href", "content", "$t"]) {
    const candidate = _resolvePublicImageUrl(value[key], baseUrl);
    if (candidate) return candidate;
  }
  for (const key of ["media:content", "media:thumbnail", "thumbnail", "image", "enclosure", "itunes:image"]) {
    const candidate = _imageCandidateFrom(value[key], baseUrl, depth + 1);
    if (candidate) return candidate;
  }
  return null;
}

function _htmlImageCandidate(html, baseUrl) {
  const source = String(html ?? "");
  if (!source) return null;

  const imgMatch = source.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
  return _resolvePublicImageUrl(imgMatch?.[1], baseUrl);
}

function _rssThumbnailUrl(item, baseUrl) {
  return (
    _imageCandidateFrom(item?.enclosure, baseUrl) ??
    _imageCandidateFrom(item?.["media:thumbnail"], baseUrl) ??
    _imageCandidateFrom(item?.["media:content"], baseUrl) ??
    _imageCandidateFrom(item?.["media:group"], baseUrl) ??
    _imageCandidateFrom(item?.image, baseUrl) ??
    _imageCandidateFrom(item?.["itunes:image"], baseUrl) ??
    _htmlImageCandidate(item?.description ?? item?.summary ?? item?.["content:encoded"], baseUrl)
  );
}

function _metaContent(html, regexes) {
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match?.[1]) return match[1].replace(/&amp;/g, "&").trim();
  }
  return null;
}

async function _fetchArticleImage(url) {
  const safeUrl = _resolvePublicImageUrl(url);
  if (!safeUrl) return null;

  try {
    const res = await fetch(safeUrl, {
      signal: AbortSignal.timeout(3500),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; RIVTNewsImageBot/1.0; +https://rivt.pro)",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;
    const html = (await res.text()).slice(0, 600_000);
    const candidate = _metaContent(html, [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/i,
    ]);
    return _resolvePublicImageUrl(candidate, res.url);
  } catch {
    return null;
  }
}

async function _enrichNewsImages(items) {
  const candidates = items.slice(0, NEWS_ARTICLE_IMAGE_LIMIT);
  const enriched = await Promise.all(candidates.map(async (item) => {
    const currentIsFallback = !item.thumbnailUrl || item.thumbnailKind === "fallback" || String(item.thumbnailUrl).startsWith("/news/");
    if (!currentIsFallback) return item;

    const articleImage = await _fetchArticleImage(item.url);
    if (articleImage) {
      return { ...item, thumbnailUrl: articleImage, thumbnailKind: "article" };
    }

    return {
      ...item,
      thumbnailUrl: item.thumbnailUrl || _fallbackNewsThumbnail(item),
      thumbnailKind: "fallback",
    };
  }));

  return [
    ...enriched,
    ...items.slice(NEWS_ARTICLE_IMAGE_LIMIT).map((item) => ({
      ...item,
      thumbnailUrl: item.thumbnailUrl || _fallbackNewsThumbnail(item),
      thumbnailKind: item.thumbnailKind ?? "fallback",
    })),
  ];
}

async function _fetchFeed(url, fallbackSource) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RIVTNews/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = _xmlParser.parse(xml);
    const channel = parsed?.rss?.channel ?? parsed?.feed ?? {};
    const raw = channel.item ?? channel.entry ?? [];
    const items = Array.isArray(raw) ? raw : [raw];
    return items.slice(0, 12).map((item, i) => {
      const link = typeof item.link === "string"
        ? item.link
        : item.link?.["@_href"] ?? item.guid ?? "#";
      const headline = _stripHtml(item.title ?? "");
      const source = fallbackSource ?? _stripHtml(channel.title ?? "");
      const thumbnailUrl = _rssThumbnailUrl(item, link);
      return {
        id: Date.now() + i,
        headline,
        source,
        date: _fmtDate(item.pubDate ?? item.published ?? item.updated ?? ""),
        summary: _stripHtml(item.description ?? item.summary ?? item["content:encoded"] ?? "").slice(0, 350),
        url: link,
        urgency: _urgency(headline),
        thumbnailUrl: thumbnailUrl ?? _topicThumbnail({ title: headline, source, urgency: _urgency(headline) }),
        thumbnailKind: thumbnailUrl ? "feed" : "fallback",
      };
    }).filter((item) => item.headline.length > 10 && _isTradeNewsCandidate(item));
  } catch {
    return [];
  }
}

router.get("/api/news", async (request, response) => {
  const normalized = _normalizeNewsLocation(request.query.location);
  if (!normalized.ok) {
    return response.status(normalized.status).json({ ok: false, error: normalized.error });
  }

  _pruneNewsCache();
  const { location, cacheKey } = normalized;
  const forceRefresh = request.query.refresh === "1";
  const cached = newsCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < NEWS_TTL_MS) {
    return response.json({ items: cached.items, fallback: cached.fallback === true, cached: true });
  }

  const [city, state] = location.split(",").map((s) => s.trim());
  const natQ  = "construction+contractor+subcontractor+building+permit+code+OSHA";
  const localQ = city && state
    ? `construction+contractor+${encodeURIComponent(city)}+${encodeURIComponent(state)}`
    : null;

  const [enr, dive, osha, gnNat, gnLocal] = await Promise.allSettled([
    _fetchFeed("https://www.enr.com/rss/news",                                                         "ENR"),
    _fetchFeed("https://www.constructiondive.com/feeds/news/",                                         "Construction Dive"),
    _fetchFeed("https://www.osha.gov/news/newsreleases/trade/rss",                                    "OSHA"),
    _fetchFeed(`https://news.google.com/rss/search?q=${natQ}&hl=en-US&gl=US&ceid=US:en`,             "Google News"),
    localQ
      ? _fetchFeed(`https://news.google.com/rss/search?q=${localQ}&hl=en-US&gl=US&ceid=US:en`, city ? `${city} News` : "Local News")
      : Promise.resolve([]),
  ]);

  const pick = (r) => r.status === "fulfilled" ? r.value : [];
  const localItems = pick(gnLocal).map((item) => ({ ...item, isLocal: true }));
  // Live sources are the product. Curated articles only keep the screen useful during a source outage.
  const liveItems = [...localItems, ...pick(enr), ...pick(dive), ...pick(osha), ...pick(gnNat)];
  const fallback = liveItems.length === 0;
  const all = fallback ? curatedTradeNews : liveItems;

  const seen = new Set();
  const deduped = all.filter((item) => {
    const key = item.headline.toLowerCase().slice(0, 55);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    if (a.isLocal && !b.isLocal) return -1;
    if (!a.isLocal && b.isLocal) return 1;
    if (a.urgency && !b.urgency) return -1;
    if (!a.urgency && b.urgency) return 1;
    return 0;
  });

  const items = (await _enrichNewsImages(deduped.slice(0, 30))).map((item, i) => ({
    ...item,
    id: i + 1,
    thumbnailUrl: item.thumbnailUrl || _fallbackNewsThumbnail(item),
    thumbnailKind: item.thumbnailKind ?? "fallback",
  }));
  newsCache.set(cacheKey, { items, fallback, fetchedAt: Date.now() });
  _pruneNewsCache();
  response.json({ items, fallback });
});
export function createNewsRouter() {
  return router;
}

export const newsInternals = {
  NEWS_CACHE_MAX_ENTRIES,
  NEWS_LOCATION_MAX_LENGTH,
  _normalizeNewsLocation,
  _pruneNewsCache,
  newsCache,
};
