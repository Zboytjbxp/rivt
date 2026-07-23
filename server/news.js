import { XMLParser } from "fast-xml-parser";
import { Router } from "express";

const router = Router();
const newsCache = new Map(); // key → { items, fetchedAt }
const NEWS_TTL_MS = 10 * 60 * 1000;
const NEWS_ARTICLE_IMAGE_LIMIT = 18;
const NEWS_CACHE_MAX_ENTRIES = 48;
const NEWS_LOCATION_MAX_LENGTH = 80;
const NEWS_MAX_AGE_DAYS = 90;
const NEWS_RESOURCE_AGE_DAYS = 548;
const NEWS_PRIORITY_MAX_SHARE = 0.25;
const NEWS_CATEGORY_MAX_SHARE = 0.4;
const NEWS_CLUSTER_CATEGORY_RATIO = 0.4;
const NEWS_CLUSTER_DEFAULT_RATIO = 0.48;
const DAY_MS = 86_400_000;
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

function _cleanHeadline(rawTitle, source = "") {
  const title = _stripHtml(rawTitle);
  const separators = [...title.matchAll(/\s(?:-|—|\|)\s/g)];
  const last = separators.at(-1);
  if (!last) return title;

  const head = title.slice(0, last.index).trim();
  const tail = title.slice((last.index ?? 0) + last[0].length).trim();
  if (!head || !tail || tail.length > 80 || tail.split(/\s+/).length > 10) return title;

  const normalizedTail = tail.toLowerCase().replace(/^www\./, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const normalizedSource = _stripHtml(source).toLowerCase().replace(/^www\./, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const matchesSource = normalizedSource && (
    normalizedTail === normalizedSource
    || normalizedSource.includes(normalizedTail)
    || normalizedTail.includes(normalizedSource)
  );
  const looksLikeDomain = /^[\w.-]+\.(?:com|org|net|gov|news|co)$/i.test(tail);
  const looksLikeSourceName = /^[A-Z0-9][\p{L}\p{N}&.'’/-]*(?:\s+[A-Z0-9][\p{L}\p{N}&.'’/-]*){0,9}$/u.test(tail);
  return matchesSource || looksLikeDomain || looksLikeSourceName ? head : title;
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
  const concreteBuildSignal = /\b(build|building|construct|constructs|develop|development|redevelop|groundbreak|civic center|complex|campus|expansion|mixed-use|secures?\b.*\bto build)\b/.test(text);
  const projectNounOrValue = /\b(project|center|complex|campus|tower|facility|development|redevelopment|expansion|park|housing|hotel|hospital|school|stadium)\b|\$\s?\d/.test(text);
  const permitPolicySignal = /\bpermit(?:s|ting)?\b/.test(text)
    && /\b(reform|requirement|waive|waiver|drop|drops|dropped|dropping|eliminat\w*|ordinance|rule|code|threshold|streamlin\w*)\b/.test(text);
  if (concreteBuildSignal && projectNounOrValue && !permitPolicySignal) return "Projects";
  if (/code|permit|inspection|ordinance|regulation|licens|nec|nfpa/.test(text)) return "Codes";
  if (/labor|workforce|apprentice|union|wage|hiring/.test(text)) return "Labor";
  if (/tool|equipment|product|material/.test(text)) return "Tools";
  if (/project|development|infrastructure|contract award|groundbreak/.test(text)) return "Projects";
  if (/business|econom|market|finance|insurance|merger|company/.test(text)) return "Business";
  return "Construction";
}

function _topics(item, hint = "") {
  const text = `${item?.headline ?? ""} ${item?.summary ?? ""}`.toLowerCase();
  const concreteBuildSignal = /\b(build|building|construct|constructs|develop|development|redevelop|groundbreak|civic center|complex|campus|expansion|mixed-use|secures?\b.*\bto build)\b/.test(text);
  const projectNounOrValue = /\b(project|center|complex|campus|tower|facility|development|redevelopment|expansion|park|housing|hotel|hospital|school|stadium)\b|\$\s?\d/.test(text);
  const permitPolicySignal = /\bpermit(?:s|ting)?\b/.test(text)
    && /\b(reform|requirement|waive|waiver|drop|drops|dropped|dropping|eliminat\w*|ordinance|rule|code|threshold|streamlin\w*)\b/.test(text);
  const concreteProject = concreteBuildSignal && projectNounOrValue && !permitPolicySignal;
  const topics = [
    ...(concreteProject ? [["Projects & development", /[\s\S]/]] : []),
    ["Safety & OSHA", /osha|safety|injury|fatal|fall protection|heat illness|ppe|hazard|recall/],
    ["Codes & standards", /building code|electrical code|\bnec\b|\bnfpa\b|standard|code update/],
    ...(!concreteProject ? [["Permits & inspections", /permit|inspection|building official/]] : []),
    ["Licensing & regulation", /licens|regulation|rulemaking|\brule\b|ordinance|legislation|statute/],
    ["Labor & workforce", /labor|workforce|apprentice|union|wage|hiring|employment|benefit/],
    ["Tools & equipment", /tool|equipment|machinery|product launch/],
    ["Materials & supply chain", /material|supply chain|shortage|tariff|lumber|steel price/],
    ["Business & finance", /business|econom|market|finance|insurance|merger|acquisition|bankrupt/],
    ["Legal & contracts", /lawsuit|court|legal|lien|contract award|settlement/],
    ...(!concreteProject ? [["Projects & development", /project|development|infrastructure|groundbreak|construction start|bid opportunity/]] : []),
    ["Technology", /software|technology|artificial intelligence|\bai\b|robot|drone|bim/],
    ["Weather & jobsite", /hurricane|storm|flood|weather|heat wave|wildfire/],
    ["Company & people", /appoint|promotion|company news|leadership|executive/],
  ].filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
  if (hint === "Safety" && !topics.includes("Safety & OSHA")) topics.unshift("Safety & OSHA");
  if (hint === "Codes" && !topics.includes("Codes & standards")) topics.unshift("Codes & standards");
  if (hint === "Projects" && !topics.includes("Projects & development")) topics.unshift("Projects & development");
  return topics.length ? topics : ["Industry news"];
}

function _publishedAtTime(item) {
  const time = Date.parse(item?.publishedAt ?? "");
  return Number.isFinite(time) ? time : 0;
}

function _ageDays(item, now = Date.now()) {
  const published = _publishedAtTime(item);
  return published ? Math.max(0, (now - published) / DAY_MS) : Infinity;
}

function _impact(item, now = Date.now()) {
  const text = `${item?.headline ?? ""} ${item?.summary ?? ""}`.toLowerCase();
  const ageDays = _ageDays(item, now);
  if (!Number.isFinite(ageDays)) {
    return { level: "routine", reason: "No confirmed publication date; RIVT does not rank it as urgent." };
  }

  let level = "routine";
  let reason = "Current industry coverage; check the original source before changing work.";
  const effective = text.match(/\beffective(?:\s+date)?\s+(?:on\s+)?([a-z]{3,9}\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  const deadline = text.match(/\bdeadline(?:\s+is|\s+of|\s+on)?\s+([a-z]{3,9}\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  const fine = text.match(/(?:fine[sd]?|penalt(?:y|ies)|cited|citation)[^$.]{0,32}(\$[\d,.]+\s*(?:k|m|million|billion)?)/i);
  const recall = /\b(?:product|equipment|material|tool)?\s*recall(?:ed|s|ing)?\b/i.test(text);
  const enforcement = /\b(?:osha|department of labor|regulator)[^.!?]{0,80}\b(?:cites?|fines?|penalt|enforcement|settlement)\b/i.test(text);
  const adoptedRule = /\b(?:adopts?|adopted|finalizes?|approved|new)\b[^.!?]{0,70}\b(?:rule|code|standard|requirement)\b/i.test(text);
  const licensingChange = /\blicens(?:e|ing|ure)\b[^.!?]{0,70}\b(?:renewal|deadline|change|requirement|effective)\b/i.test(text);

  if (recall || /effective immediately|stop[- ]work order|emergency order|mandatory evacuation/i.test(text)) {
    level = "critical";
    reason = recall ? "Product or equipment recall affecting trade work." : "Names an immediate jobsite or compliance action.";
  } else if (effective || deadline || fine || enforcement || adoptedRule || licensingChange) {
    level = "high";
    if (effective) reason = `Names an effective date: ${effective[1]}.`;
    else if (deadline) reason = `Names a deadline: ${deadline[1]}.`;
    else if (fine) reason = `Reports an enforcement amount: ${fine[1]}.`;
    else if (licensingChange) reason = "Names a licensing renewal, deadline, or requirement change.";
    else if (enforcement) reason = "Reports a regulator citation, fine, enforcement action, or settlement.";
    else reason = "Reports an adopted or finalized rule, code, standard, or requirement.";
  } else if (/project|contract award|wage|labor|market|equipment|material/.test(text)) {
    level = "medium";
    reason = "Current project, workforce, purchasing, or business signal.";
  }

  if (ageDays > 90 && (level === "critical" || level === "high")) level = "medium";
  else if (ageDays > 30 && level === "critical") level = "high";
  else if (ageDays > 30 && level === "high") level = "medium";
  return { level, reason: reason.slice(0, 120) };
}

function _applyPriorityScarcity(items, maxShare = NEWS_PRIORITY_MAX_SHARE) {
  const prioritized = items
    .filter((item) => item.impactLevel === "critical" || item.impactLevel === "high")
    .sort((a, b) => _relevanceScore(b) - _relevanceScore(a));
  const cap = Math.floor(items.length * maxShare);
  const keep = new Set(prioritized.slice(0, cap));
  return items.map((item) => (
    (item.impactLevel === "critical" || item.impactLevel === "high") && !keep.has(item)
      ? { ...item, impactLevel: "medium" }
      : item
  ));
}

function _isOfficialResource(item, now = Date.now()) {
  return Boolean(item?.resourceCandidate) && (
    !_publishedAtTime(item) || _ageDays(item, now) > NEWS_RESOURCE_AGE_DAYS
  );
}

function _partitionNewsAndResources(items, now = Date.now()) {
  const resources = [];
  const news = [];
  const seenResources = new Set();
  for (const item of items) {
    if (_isOfficialResource(item, now)) {
      const url = _canonicalArticleUrl(item.url);
      if (url && !seenResources.has(url) && resources.length < 4) {
        seenResources.add(url);
        resources.push({ title: item.headline, source: item.source, url });
      }
      continue;
    }
    if (_publishedAtTime(item) && _ageDays(item, now) <= NEWS_MAX_AGE_DAYS) news.push(item);
  }
  return { news, resources };
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

function _significantTitleTokens(value) {
  const stop = new Set(["after", "from", "into", "with", "that", "this", "will", "construction", "contractor", "update", "news"]);
  return _normalizedTitle(value).split(" ").filter((token) => token.length > 3 && !stop.has(token));
}

function _publishedTime(item) {
  const time = Date.parse(item?.publishedAt ?? "");
  return Number.isFinite(time) ? time : 0;
}

function _relevanceScore(item, now = Date.now()) {
  const ageDays = Math.max(0, (now - _publishedTime(item)) / DAY_MS);
  const freshness = _publishedTime(item) ? Math.max(0, 42 - ageDays) : 0;
  const tradeHits = (`${item.headline} ${item.summary}`.match(/contractor|construction|trade|jobsite|permit|code|safety|labor|tool|project|jacksonville|florida/gi) ?? []).length;
  return freshness + Math.min(tradeHits, 8) * 3 + (item.isLocal ? 30 : 0) + (item.urgency ? 6 : 0);
}

function _dedupeAndDiversify(items, limit = 30) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const seenTitlePrefixes = new Set();
  const unique = items.filter((item) => {
    const canonicalUrl = _canonicalArticleUrl(item.url);
    const titleKey = _normalizedTitle(item.headline);
    const significant = _significantTitleTokens(item.headline);
    const prefixKey = significant.slice(0, 8).join(" ");
    if (
      !canonicalUrl
      || titleKey.length < 12
      || seenUrls.has(canonicalUrl)
      || seenTitles.has(titleKey)
      || (significant.length >= 5 && seenTitlePrefixes.has(prefixKey))
    ) return false;
    seenUrls.add(canonicalUrl);
    seenTitles.add(titleKey);
    if (significant.length >= 5) seenTitlePrefixes.add(prefixKey);
    item.canonicalUrl = canonicalUrl;
    return true;
  }).sort((a, b) => _relevanceScore(b) - _relevanceScore(a));

  const selected = [];
  const sourceCounts = new Map();
  const categoryCounts = new Map();
  const categoryCap = Math.max(1, Math.ceil(Math.min(limit, unique.length) * NEWS_CATEGORY_MAX_SHARE));
  const selectItem = (item) => {
    selected.push(item);
    const source = String(item.source || "Unknown").toLowerCase();
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  };
  for (const category of ["Safety", "Codes", "Labor", "Tools", "Business", "Projects", "Construction"]) {
    const item = unique.find((candidate) => candidate.category === category && !selected.includes(candidate));
    if (!item) continue;
    selectItem(item);
    if (selected.length === limit) return selected;
  }
  for (const maxPerSource of [3, 6, Infinity]) {
    for (const item of unique) {
      if (selected.includes(item)) continue;
      const source = String(item.source || "Unknown").toLowerCase();
      if ((sourceCounts.get(source) ?? 0) >= maxPerSource) continue;
      const categoryAtCap = (categoryCounts.get(item.category) ?? 0) >= categoryCap;
      const hasUnusedOtherCategory = unique.some((candidate) => (
        !selected.includes(candidate)
        && candidate.category !== item.category
        && (sourceCounts.get(String(candidate.source || "Unknown").toLowerCase()) ?? 0) < maxPerSource
      ));
      if (categoryAtCap && hasUnusedOtherCategory) continue;
      selectItem(item);
      if (selected.length === limit) return selected;
    }
  }
  return selected;
}

function _stemClusterToken(token) {
  let stem = token;
  if (stem.length > 6 && stem.endsWith("ing")) stem = stem.slice(0, -3);
  else if (stem.length > 5 && stem.endsWith("ed")) stem = stem.slice(0, -2);
  else if (stem.length > 5 && stem.endsWith("es")) stem = stem.slice(0, -1);
  else if (stem.length > 4 && stem.endsWith("s")) stem = stem.slice(0, -1);
  stem = stem.replace(/([b-df-hj-np-tv-z])\1$/i, "$1");
  if (stem.length > 4 && stem.endsWith("e")) stem = stem.slice(0, -1);
  return stem;
}

function _clusterKeyTokens(item) {
  return new Set(_significantTitleTokens(item?.headline).map(_stemClusterToken).filter((token) => token.length > 3));
}

function _storyEntities(item) {
  const text = `${item?.headline ?? ""} ${item?.summary ?? ""}`;
  const entities = new Set();
  for (const match of text.matchAll(/\b(?:(CS)\/)?(HB|SB)\s?(\d{1,4})\b/gi)) {
    entities.add(`${match[1] ? "CS/" : ""}${match[2].toUpperCase()} ${match[3]}`);
  }
  for (const match of text.matchAll(/\b([A-Z][\p{L}\p{N}'’-]+(?:\s+[A-Z][\p{L}\p{N}'’-]+){0,5}\s+Act)\b/gu)) {
    entities.add(match[1].toLowerCase().replace(/\s+/g, " "));
  }
  if (
    /\bflorida\b/i.test(text)
    && /\bpermit(?:s|ting)?\b/i.test(text)
    && (/\b(?:HB|CS\/HB)\s?803\b/i.test(text) || /\b(?:small|home|residential|renovation)\b/i.test(text))
    && /\b(?:remove|removes|removed|drop|drops|dropped|goodbye|cut|cuts|law|reform|change|changes)\b/i.test(text)
  ) {
    entities.add("florida-hb-803-permit-reform");
  }
  return entities;
}

function _clusterStories(items) {
  const clusters = [];
  for (const item of items) {
    const tokens = _clusterKeyTokens(item);
    const entities = _storyEntities(item);
    const match = clusters.find((cluster) => {
      if ([...entities].some((entity) => cluster.entities.has(entity))) return true;
      const overlap = [...tokens].filter((token) => cluster.tokens.has(token)).length;
      const denominator = Math.max(tokens.size, cluster.tokens.size, 1);
      const sameCategoryAndGeography = item.category === cluster.primary.category
        && item.geography === cluster.primary.geography;
      const threshold = sameCategoryAndGeography ? NEWS_CLUSTER_CATEGORY_RATIO : NEWS_CLUSTER_DEFAULT_RATIO;
      return overlap >= 3 && overlap / denominator >= threshold;
    });
    if (!match) {
      clusters.push({ primary: item, tokens, entities, sources: new Set([item.source]) });
      continue;
    }
    match.sources.add(item.source);
    for (const token of tokens) match.tokens.add(token);
    for (const entity of entities) match.entities.add(entity);
    const itemOfficial = item.sourceKind === "official";
    const primaryOfficial = match.primary.sourceKind === "official";
    if ((itemOfficial && !primaryOfficial) || (itemOfficial === primaryOfficial && _relevanceScore(item) > _relevanceScore(match.primary))) {
      match.primary = item;
    }
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

async function _fetchFeed(
  url,
  fallbackSource,
  categoryHint = "",
  isLocal = false,
  geography = isLocal ? "local" : "national",
  resourceCandidate = false,
) {
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
      const itemSource = typeof item.source === "string" ? item.source : item.source?.["#text"];
      const source = _stripHtml(itemSource ?? fallbackSource ?? channel.title ?? "Unknown source");
      const headline = _cleanHeadline(item.title ?? "", source);
      const thumbnailUrl = _rssThumbnailUrl(item, link);
      const publishedAt = item.pubDate ?? item.published ?? item.updated ?? "";
      const summary = _stripHtml(item.description ?? item.summary ?? item["content:encoded"] ?? "").slice(0, 350);
      const urgency = _urgency(headline);
      const topics = _topics({ headline, summary }, categoryHint);
      const impact = _impact({ headline, summary, publishedAt });
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
        resourceCandidate,
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
    return response.json({ items: cached.items, resources: cached.resources ?? [], fallback: cached.fallback === true, cached: true });
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
      _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(`site:jacksonville.gov construction permits contractors ${city}`)}&hl=en-US&gl=US&ceid=US:en`, "Jacksonville official notices", "", true, "local", true),
      _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(`site:floridabuilding.org building code contractors ${state}`)}&hl=en-US&gl=US&ceid=US:en`, "Florida Building Commission", "Codes", true, "local", true),
      _fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(`site:myfloridalicense.com contractor licensing ${state}`)}&hl=en-US&gl=US&ceid=US:en`, "Florida licensing", "Codes", true, "local", true),
    ] : []),
  ];
  const settledFeeds = await Promise.allSettled(feedRequests);

  const pick = (r) => r.status === "fulfilled" ? r.value : [];
  const liveItems = settledFeeds.flatMap(pick);
  const scopedItems = location ? liveItems.filter((item) => item.isLocal) : liveItems;
  const { news, resources } = _partitionNewsAndResources(scopedItems);
  const fallback = news.length === 0;
  const ranked = _clusterStories(_dedupeAndDiversify(news, 45))
    .sort((a, b) => _relevanceScore(b) - _relevanceScore(a))
    .slice(0, 30);
  const honestPriority = _applyPriorityScarcity(ranked);
  const items = (await _enrichNewsImages(honestPriority)).map((item, i) => ({
    ...item,
    id: i + 1,
    thumbnailUrl: item.thumbnailUrl || undefined,
    thumbnailKind: item.thumbnailKind,
  }));
  newsCache.set(cacheKey, { items, resources, fallback, fetchedAt: Date.now() });
  _pruneNewsCache();
  response.json({ items, resources, fallback });
});
export function createNewsRouter() {
  return router;
}

export const newsInternals = {
  NEWS_CACHE_MAX_ENTRIES,
  NEWS_LOCATION_MAX_LENGTH,
  _canonicalArticleUrl,
  _category,
  _cleanHeadline,
  _dedupeAndDiversify,
  _normalizeNewsLocation,
  _impact,
  _applyPriorityScarcity,
  _isOfficialResource,
  _partitionNewsAndResources,
  _topics,
  _clusterStories,
  _clusterKeyTokens,
  _storyEntities,
  _normalizedTitle,
  _fetchFeed,
  _pruneNewsCache,
  _resolvePublicImageUrl,
  _rssThumbnailUrl,
  _trades,
  newsCache,
};
