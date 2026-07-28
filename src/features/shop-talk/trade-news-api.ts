import {
  apiPath,
  fetchWithTimeout,
  notifySessionExpired,
  RivtApiError,
  type ApiErrorBody,
} from "../../lib/api";
import type { NewsItem } from "./ShopTalkView";

export interface TradeNewsPreferenceRecord {
  scope: "local" | "all";
  location: string;
  category: string;
  trade: string;
  followedTrades: string[];
  followedTopics: string[];
  version: number;
  updatedAt: string;
}

export interface SavedTradeNewsArticle {
  id: string;
  canonicalUrl: string;
  url: string;
  headline: string;
  source: string;
  publishedAt: string | null;
  category: string;
  trades: string[];
  topics: string[];
  thumbnailUrl: string | null;
  savedAt: string;
}

async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) throw new RivtApiError(response.status, body, fallback);
  return body as T;
}

export async function loadTradeNewsContinuity() {
  const response = await fetchWithTimeout(apiPath("/api/v1/trade-news/preferences"), {
    credentials: "include",
  });
  const body = await readResponse<{
    data?: {
      preference?: TradeNewsPreferenceRecord | null;
      savedArticles?: SavedTradeNewsArticle[];
    };
  }>(response, "Trade News choices could not be loaded.");
  return {
    preference: body.data?.preference ?? null,
    savedArticles: Array.isArray(body.data?.savedArticles) ? body.data.savedArticles : [],
  };
}

export async function saveTradeNewsPreference(input: Omit<TradeNewsPreferenceRecord, "version" | "updatedAt"> & {
  expectedVersion: number;
}) {
  const response = await fetchWithTimeout(apiPath("/api/v1/trade-news/preferences"), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readResponse<{ data?: { preference?: TradeNewsPreferenceRecord } }>(
    response,
    "Trade News choices could not be saved.",
  );
  if (!body.data?.preference) throw new Error("RIVT did not return the saved Trade News choices.");
  return body.data.preference;
}

export async function saveTradeNewsArticle(item: NewsItem) {
  const response = await fetchWithTimeout(apiPath("/api/v1/trade-news/saved-articles"), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: item.url,
      headline: item.headline,
      source: item.source,
      publishedAt: item.publishedAt ?? null,
      category: item.category ?? "",
      trades: item.trades ?? [],
      topics: item.topics ?? [],
      thumbnailUrl: item.thumbnailUrl ?? null,
    }),
  });
  const body = await readResponse<{ data?: { savedArticle?: SavedTradeNewsArticle } }>(
    response,
    "That article could not be saved.",
  );
  if (!body.data?.savedArticle) throw new Error("RIVT did not return the saved article.");
  return body.data.savedArticle;
}

export async function saveLegacyTradeNewsUrl(url: string) {
  const response = await fetchWithTimeout(apiPath("/api/v1/trade-news/saved-articles"), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      headline: "",
      source: "",
      publishedAt: null,
      category: "",
      trades: [],
      topics: [],
      thumbnailUrl: null,
    }),
  });
  const body = await readResponse<{ data?: { savedArticle?: SavedTradeNewsArticle } }>(
    response,
    "That device-only saved link could not be moved to your account.",
  );
  if (!body.data?.savedArticle) throw new Error("RIVT did not return the moved saved link.");
  return body.data.savedArticle;
}

export async function removeTradeNewsArticle(url: string) {
  const response = await fetchWithTimeout(
    apiPath(`/api/v1/trade-news/saved-articles?url=${encodeURIComponent(url)}`),
    { method: "DELETE", credentials: "include" },
  );
  await readResponse(response, "That saved article could not be removed.");
}
