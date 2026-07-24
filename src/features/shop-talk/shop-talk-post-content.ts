export interface ShopTalkArticleAttachment {
  url: string;
  domain: string;
  source: string;
  date?: string;
}

export interface ParsedShopTalkPostBody {
  content: string;
  article: ShopTalkArticleAttachment | null;
}

const ARTICLE_URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const ATTRIBUTION_PATTERN = /^Via\s+(.+?)(?:\s+(?:\u00b7|\u2022)\s+(.+))?$/i;

function articleDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "Linked article";
  }
}

export function parseShopTalkPostBody(body: string): ParsedShopTalkPostBody {
  const normalized = body.replace(/\r\n?/g, "\n").trim();
  const urlMatch = normalized.match(ARTICLE_URL_PATTERN);
  if (!urlMatch) return { content: normalized, article: null };

  const url = urlMatch[0].replace(/[),.;]+$/, "");
  const lines = normalized
    .replace(urlMatch[0], "")
    .split("\n")
    .map((line) => line.trim());
  const attributionIndex = lines.findIndex((line) => ATTRIBUTION_PATTERN.test(line));
  const attribution = attributionIndex >= 0 ? lines[attributionIndex].match(ATTRIBUTION_PATTERN) : null;
  if (attributionIndex >= 0) lines.splice(attributionIndex, 1);

  const domain = articleDomain(url);
  return {
    content: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    article: {
      url,
      domain,
      source: attribution?.[1]?.trim() || domain,
      ...(attribution?.[2]?.trim() ? { date: attribution[2].trim() } : {}),
    },
  };
}

export function buildArticleDiscussionBody(
  comment: string,
  article: { source: string; date?: string; url: string },
) {
  const attribution = `Via ${article.source}${article.date ? ` \u00b7 ${article.date}` : ""}`;
  return [comment.trim(), `${attribution}\n${article.url}`].filter(Boolean).join("\n\n");
}
