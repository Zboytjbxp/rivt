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

function _category(item, hint = "") {
  if (hint) return hint;
  const text = `${item?.headline ?? ""} ${item?.summary ?? ""}`.toLowerCase();
  if (/osha|safety|injury|fatal|heat|ppe|hazard/.test(text)) return "Safety";
  if (/code|permit|inspection|ordinance|regulation|licens|nec|nfpa/.test(text)) return "Codes";
  if (/labor|workforce|apprentice|union|wage|hiring/.test(text)) return "Labor";
  if (/tool|equipment|product|material/.test(text)) return "Tools";
  if (/project|development|infrastructure|contract award|groundbreak/.test(text)) return "Projects";
  if (/business|econom|market|finance|insurance|merger|company/.test(text)) return "Business";
  return "Construction";
}

function _topics(item, hint = "") {
  const text = `${item?.headline ?? ""} ${item?.summary ?? ""}`.toLowerCase();
  const topics = [
    ["Safety & OSHA", /osha|safety|injury|fatal|fall protection|heat illness|ppe|hazard|recall/],
    ["Codes & standards", /building code|electrical code|\bnec\b|\bnfpa\b|standard|code update/],
    ["Permits & inspections", /permit|inspection|building official/],
    ["Licensing & regulation", /licens|regulation|rulemaking|\brule\b|ordinance|legislation|statute/],
    ["Labor & workforce", /labor|workforce|apprentice|union|wage|hiring|employment|benefit/],
    ["Tools & equipment", /tool|equipment|machinery|product launch/],
    ["Materials & supply chain", /material|supply chain|shortage|tariff|lumber|steel price/],
    ["Business & finance", /business|econom|market|finance|insurance|merger|acquisition|bankrupt/],
    ["Legal & contracts", /lawsuit|court|legal|lien|contract award|settlement/],
    ["Projects & development", /project|development|infrastructure|groundbreak|construction start|bid opportunity/],
    ["Technology", /software|technology|artificial intelligence|\bai\b|robot|drone|bim/],
    ["Weather & jobsite", /hurricane|storm|flood|weather|heat wave|wildfire/],
    ["Company & people", /appoint|promotion|company news|leadership|executive/],
  ].filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
  if (hint === "Safety" && !topics.includes("Safety & OSHA")) topics.unshift("Safety & OSHA");
  if (hint === "Codes" && !topics.includes("Codes & standards")) topics.unshift("Codes & standards");
  if (hint === "Projects" && !topics.includes("Projects & development")) topics.unshift("Projects & development");
  return topics.length ? topics : ["Industry news"];
}

function _impact(item) {
  const text = `${item?.headline ?? ""} ${item?.summary ?? ""}`.toLowerCase();
  if (/recall|fatal|emergency|effective immediately|stop work|evacuat|hurricane warning/.test(text)) {
    return { level: "critical", reason: "Urgent safety, recall, or jobsite disruption language appears in the source." };
  }
  if (/osha|fine|penalt|deadline|effective date|code update|rule|licens|permit change|shortage/.test(text)) {
    return { level: "high", reason: "The source describes enforcement, compliance, deadline, or supply impact." };
  }
  if (/project|contract award|wage|labor|market|equipment|material/.test(text)) {
    return { level: "medium", reason: "The source may affect project, workforce, purchasing, or business decisions." };
  }
  return { level: "routine", reason: "Industry awareness; review the original source before changing field or business practices." };
}

function _sourceKind(item) {
  try {
    const host = new URL(item?.url ?? "").hostname.toLowerCase();
    if (host.endsWith(".gov") || host === "osha.gov" || host.endsWith(".osha.gov")) return "official";
  } catch {
    // Source URL is validated elsewhere.
  }
  return /\.gov\b|OSHA|building commission|department|city of|county|state of|licensing board/i.test(item?.source ?? "")
    ? "official"
    : "publisher";
}

function _trades(item) {
  const text = `${item?.headline ?? ""} ${item?.summary ?? ""}`.toLowerCase();
  const matches = [
    ["Electrical", /\belectric(?:al|ian|ians)?\b|\bnec\b|low voltage/],
    ["Plumbing", /\bplumb(?:ing|er|ers)?\b|pipefitt|water heater/],
    ["HVAC", /\bhvac\b|refrigerant|air condition|heat pump/],
    ["Carpentry", /carpentr|woodwork|millwork/],
    ["Cabinetry", /cabinet|casework/],
    ["Painting/Finishing", /paint|coating|finishing/],
    ["Welding", /weld|metal fabrication/],
    ["Roofing", /roof|shingle/],
    ["Flooring", /flooring|floor cover/],
    ["Drywall", /drywall|gypsum/],
    ["Concrete/Masonry", /concrete|masonry|brick|block wall/],
    ["Landscaping", /landscap|irrigation/],
    ["Tile", /\btile\b/],
    ["Insulation", /insulat/],
    ["Framing", /\bframing\b|\bframer/],
    ["Demolition", /demolition|\bdemo\b/],
    ["Excavation", /excavat|trench/],
    ["Fencing", /\bfenc(?:e|ing)\b/],
    ["Gutters", /\bgutter/],
    ["Windows/Doors", /\bwindow|\bdoor/],
    ["Siding", /\bsiding\b/],
    ["Driveways/Pavers", /driveway|paver/],
    ["Pool/Spa", /\bpool\b|\bspa\b/],
    ["Fire Suppression", /fire suppression|sprinkler system/],
    ["Solar", /\bsolar\b|photovoltaic/],
    ["Security Systems", /security system|access control/],
  ].filter(([, pattern]) => pattern.test(text)).map(([trade]) => trade);
  return matches.length ? matches : ["General construction"];
}

function _canonicalArticleUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
  } catch {
    return "";
  }
}

function _normalizedTitle(value) {
  return _stripHtml(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function _publishedTime(item) {
  const time = Date.parse(item?.publishedAt ?? item?.date ?? "");
  return Number.isFinite(time) ? time : 0;
}

function _relevanceScore(item, now = Date.now()) {
  const ageDays = Math.max(0, (now - _publishedTime(item)) / 86_400_000);
  const freshness = _publishedTime(item) ? Math.max(0, 42 - ageDays) : 0;
  const tradeHits = (`${item.headline} ${item.summary}`.match(/contractor|construction|trade|jobsite|permit|code|safety|labor|tool|project|jacksonville|florida/gi) ?? []).length;
  return freshness + Math.min(tradeHits, 8) * 3 + (item.isLocal ? 30 : 0) + (item.urgency ? 6 : 0);
}

function _dedupeAndDiversify(items, limit = 30) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const unique = items.filter((item) => {
    const canonicalUrl = _canonicalArticleUrl(item.url);
    const titleKey = _normalizedTitle(item.headline);
    if (!canonicalUrl || titleKey.length < 12 || seenUrls.has(canonicalUrl) || seenTitles.has(titleKey)) return false;
    seenUrls.add(canonicalUrl);
    seenTitles.add(titleKey);
    item.canonicalUrl = canonicalUrl;
    return true;
  }).sort((a, b) => _relevanceScore(b) - _relevanceScore(a));

  const selected = [];
  const sourceCounts = new Map();
  for (const category of ["Safety", "Codes", "Labor", "Tools", "Business", "Projects", "Construction"]) {
    const item = unique.find((candidate) => candidate.category === category && !selected.includes(candidate));
    if (!item) continue;
    selected.push(item);
    const source = String(item.source || "Unknown").toLowerCase();
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    if (selected.length === limit) return selected;
  }
  for (const maxPerSource of [3, 6, Infinity]) {
    for (const item of unique) {
      if (selected.includes(item)) continue;
      const source = String(item.source || "Unknown").toLowerCase();
      if ((sourceCounts.get(source) ?? 0) >= maxPerSource) continue;
      selected.push(item);
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
      if (selected.length === limit) return selected;
    }
  }
  return selected;
}

function _clusterKeyTokens(item) {
  const stop = new Set(["after", "from", "into", "with", "that", "this", "will", "construction", "contractor", "update", "news"]);
  return new Set(_normalizedTitle(item?.headline).split(" ").filter((token) => token.length > 3 && !stop.has(token)));
}

function _clusterStories(items) {
  const clusters = [];
  for (const item of items) {
    const tokens = _clusterKeyTokens(item);
    const match = clusters.find((cluster) => {
      const overlap = [...tokens].filter((token) => cluster.tokens.has(token)).length;
      const denominator = Math.max(tokens.size, cluster.tokens.size, 1);
      return overlap >= 3 && overlap / denominator >= 0.48;
    });
    if (!match) {
      clusters.push({ primary: item, tokens, sources: new Set([item.source]) });
      continue;
    }
    match.sources.add(item.source);
    if (_relevanceScore(item) > _relevanceScore(match.primary)) match.primary = item;
  }
  return clusters.map(({ primary, sources }) => ({
    ...primary,
    relatedSourceCount: sources.size,
    relatedSources: [...sources],
  }));
}

function _isTradeNewsCandidate(item) {
  const text = `${item.headline ?? ""} ${item.summary ?? ""} ${item.source ?? ""}`.toLowerCase();
  if (/\bhomeowners?\b|\bhome owner\b/.test(text)) return false;
  return /contractor|construction|subcontractor|trade|jobsite|osha|safety|permit|inspection|code|nec|nfpa|hvac|refrigerant|roof|electrical|plumbing|carpentry|concrete|masonry|framing|drywall|demolition|development|infrastructure|renovation|mechanical|lien|licens|labor|workforce|apprentice|skilled/.test(text);
}

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

async function _readBoundedText(response, maxBytes = 600_000) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) return null;
  if (!response.body?.getReader) {
    const text = await response.text();
    return Buffer.byteLength(text) <= maxBytes ? text : null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function _fetchArticleImage(url) {
  const safeUrl = _resolvePublicImageUrl(url);
  if (!safeUrl) return null;

  try {
    let requestUrl = safeUrl;
    let res;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      res = await fetch(requestUrl, {
        signal: AbortSignal.timeout(3500),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (compatible; RIVTNewsImageBot/1.0; +https://rivt.pro)",
        },
        redirect: "manual",
      });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      const redirected = _resolvePublicImageUrl(res.headers.get("location"), requestUrl);
      if (!redirected || redirects === 3) return null;
      requestUrl = redirected;
    }
    if (!res) return null;
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;
    const html = await _readBoundedText(res);
    if (!html) return null;
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
    return _resolvePublicImageUrl(candidate, requestUrl);
  } catch {
    return null;
  }
}

async function _enrichNewsImages(items) {
  const candidates = items.slice(0, NEWS_ARTICLE_IMAGE_LIMIT);
  const enriched = await Promise.all(candidates.map(async (item) => {
    if (item.thumbnailUrl) return item;

    const articleImage = await _fetchArticleImage(item.url);
    if (articleImage) {
      return { ...item, thumbnailUrl: articleImage, thumbnailKind: "article" };
    }

    return { ...item, thumbnailUrl: undefined, thumbnailKind: undefined };
  }));

  return [
    ...enriched,
    ...items.slice(NEWS_ARTICLE_IMAGE_LIMIT),
  ];
}

async function _fetchFeed(url, fallbackSource, categoryHint = "", isLocal = false, geography = isLocal ? "local" : "national") {
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
      const itemSource = typeof item.source === "string" ? item.source : item.source?.["#text"];
      const source = _stripHtml(itemSource ?? fallbackSource ?? channel.title ?? "Unknown source");
      const thumbnailUrl = _rssThumbnailUrl(item, link);
      const publishedAt = item.pubDate ?? item.published ?? item.updated ?? "";
      const summary = _stripHtml(item.description ?? item.summary ?? item["content:encoded"] ?? "").slice(0, 350);
      const urgency = _urgency(headline);
      const topics = _topics({ headline, summary }, categoryHint);
      const impact = _impact({ headline, summary });
      return {
        id: Date.now() + i,
        headline,
        source,
        date: _fmtDate(publishedAt),
        publishedAt,
        summary,
        url: link,
        urgency,
        category: _category({ headline, summary }, categoryHint),
        topics,
        trades: _trades({ headline, summary }),
        impactLevel: impact.level,
        impactReason: impact.reason,
        sourceKind: _sourceKind({ source, url: link }),
        geography,
        isLocal,
        thumbnailUrl: thumbnailUrl ?? undefined,
        thumbnailKind: thumbnailUrl ? "feed" : undefined,
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
    ? `construction contractor skilled trades permits projects ${city} ${state}`
    : null;

  const topicalFeeds = [
    ["construction contractor skilled trades", "Construction"],
    ["construction OSHA jobsite safety", "Safety"],
    ["building code permits contractor", "Codes"],
    ["construction labor workforce apprenticeship", "Labor"],
    ["construction tools equipment", "Tools"],
    ["construction business contractors", "Business"],
    ["construction projects infrastructure", "Projects"],
    ["construction product recalls contractors", "Safety"],
    ["construction permits inspections licensing", "Codes"],
    ["construction materials supply chain tariffs", "Business"],
    ["construction technology software BIM equipment", "Tools"],
    ["roofing electrical plumbing HVAC trade news", "Construction"],
  ];
  const feedRequests = [
    _fetchFeed("https://www.enr.com/rss/news", "ENR"),
    _fetchFeed("https://www.constructiondive.com/feeds/news/", "Construction Dive"),
    _fetchFeed("https://www.osha.gov/news/newsreleases.xml", "OSHA", "Safety"),
    ...topicalFeeds.map(([query, category]) => _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`, "Google News", category)),
    _fetchFeed(`https://news.google.com/rss/search?q=${natQ}&hl=en-US&gl=US&ceid=US:en`, "Google News"),
    _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent("global construction infrastructure skilled trades")}&hl=en-US&gl=US&ceid=US:en`, "Global construction", "Projects", false, "global"),
    ...(localQ ? [
      _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(localQ)}&hl=en-US&gl=US&ceid=US:en`, `${city} / ${state}`, "", true),
      _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(`contractor construction permits projects ${state}`)}&hl=en-US&gl=US&ceid=US:en`, `${state} trades`, "", true),
      _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(`site:jacksonville.gov construction permits contractors ${city}`)}&hl=en-US&gl=US&ceid=US:en`, "Jacksonville official notices", "", true),
      _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(`site:floridabuilding.org building code contractors ${state}`)}&hl=en-US&gl=US&ceid=US:en`, "Florida Building Commission", "Codes", true),
      _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(`site:myfloridalicense.com contractor licensing ${state}`)}&hl=en-US&gl=US&ceid=US:en`, "Florida licensing", "Codes", true),
    ] : []),
  ];
  const settledFeeds = await Promise.allSettled(feedRequests);

  const pick = (r) => r.status === "fulfilled" ? r.value : [];
  const liveItems = settledFeeds.flatMap(pick);
  const scopedItems = location ? liveItems.filter((item) => item.isLocal) : liveItems;
  const fallback = scopedItems.length === 0;
  const ranked = _clusterStories(_dedupeAndDiversify(scopedItems, 45)).slice(0, 30);
  const items = (await _enrichNewsImages(ranked)).map((item, i) => ({
    ...item,
    id: i + 1,
    thumbnailUrl: item.thumbnailUrl || undefined,
    thumbnailKind: item.thumbnailKind,
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
  _canonicalArticleUrl,
  _dedupeAndDiversify,
  _normalizeNewsLocation,
  _impact,
  _topics,
  _clusterStories,
  _pruneNewsCache,
  _resolvePublicImageUrl,
  _rssThumbnailUrl,
  _trades,
  newsCache,
};
