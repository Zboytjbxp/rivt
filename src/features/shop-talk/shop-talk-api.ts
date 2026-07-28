import {
  apiPath,
  fetchWithTimeout,
  notifySessionExpired,
  RivtApiError,
  type ApiErrorBody,
  UPLOAD_REQUEST_TIMEOUT_MS,
} from "../../lib/api";

export interface ShopTalkPostInput {
  title: string;
  body?: string;
  trade: string;
  flair?: string | null;
  postType?: "question" | "sub-request" | "safety" | "general";
  communitySlug?: string;
  webVisibility?: "members" | "public";
  article?: {
    url: string;
    source: string;
    publishedAt?: string | null;
  } | null;
}

export interface ServerShopTalkAnswer {
  id: string;
  author: string;
  body: string;
  verifiedFix: boolean;
  createdAt: string;
  moderationStatus?: string;
}

export interface ServerShopTalkMedia {
  id: string;
  uploadId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  mediaKind: "photo";
  reviewStatus?: string;
  altText?: string;
  signedUrl?: string | null;
  createdAt: string;
}

export interface ServerShopTalkPost {
  id: string;
  authorAccountId?: string;
  author: string;
  trade: string;
  flair?: string;
  type?: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  moderationStatus?: string;
  communityId?: string;
  communitySlug?: string;
  communityName?: string;
  communityAudience?: "public" | "contractors" | "tradespeople";
  answers?: ServerShopTalkAnswer[];
  media?: ServerShopTalkMedia[];
  thumbnailUrl?: string | null;
  thumbnailAlt?: string | null;
  viewerCanDelete?: boolean;
  webVisibility?: "members" | "public";
  publicWebPublishedAt?: string | null;
  articleUrl?: string | null;
  articleCanonicalUrl?: string | null;
  articleSource?: string | null;
  articlePublishedAt?: string | null;
}

export interface ShopTalkArticleDiscussion {
  canonicalUrl: string;
  post: ServerShopTalkPost;
}

export type ShopTalkReportReason = "spam" | "harassment" | "unsafe_advice" | "misinformation" | "privacy" | "duplicate" | "other";

export interface ShopTalkReportInput {
  targetType: "community" | "post" | "answer";
  targetId: string;
  reasonCode: ShopTalkReportReason;
  note?: string;
}

async function readShopTalkResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) throw new RivtApiError(response.status, body, fallbackMessage);
  return body as T;
}

/** Persist a Shop Talk post to the server. */
export async function createShopTalkPost(input: ShopTalkPostInput): Promise<ServerShopTalkPost | null> {
  const response = await fetchWithTimeout(apiPath("/api/v1/shop-talk/posts"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  const body = await readShopTalkResponse<{ data?: { post?: ServerShopTalkPost } }>(response, "RIVT could not save that post.");
  return body.data?.post ?? null;
}

export async function uploadShopTalkPostPhoto(
  postId: string,
  file: File,
  publicVisibilityAcknowledged = false,
): Promise<ServerShopTalkPost | null> {
  const formData = new FormData();
  formData.append("file", file);
  if (publicVisibilityAcknowledged) formData.append("publicVisibilityAcknowledged", "true");
  const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}/media`), {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: formData,
  }, UPLOAD_REQUEST_TIMEOUT_MS);
  const body = await readShopTalkResponse<{ data?: { post?: ServerShopTalkPost } }>(response, "RIVT could not upload that photo.");
  return body.data?.post ?? null;
}

export async function deleteShopTalkPost(postId: string): Promise<boolean> {
  const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}`), {
    method: "DELETE",
    credentials: "include",
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  await readShopTalkResponse(response, "RIVT could not delete that post.");
  return true;
}

export async function setShopTalkPostVisibility(
  postId: string,
  webVisibility: "members" | "public",
  mediaAcknowledged = false,
): Promise<ServerShopTalkPost | null> {
  const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}/visibility`), {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ webVisibility, mediaAcknowledged }),
  });
  const body = await readShopTalkResponse<{ data?: { post?: ServerShopTalkPost } }>(
    response,
    "RIVT could not change that post's public visibility.",
  );
  return body.data?.post ?? null;
}

/** Fetch the newest visible Shop Talk posts. */
export async function fetchShopTalkPosts(communitySlug?: string | null): Promise<ServerShopTalkPost[]> {
  const suffix = communitySlug ? `?community=${encodeURIComponent(communitySlug)}` : "";
  const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts${suffix}`), { credentials: "include" });
  const body = await readShopTalkResponse<{ data?: { posts?: ServerShopTalkPost[] } }>(response, "Shop Talk could not be loaded.");
  return Array.isArray(body.data?.posts) ? body.data.posts : [];
}

/** Fetch one visible post for exact notification and shared-link destinations. */
export async function fetchShopTalkPost(postId: string): Promise<ServerShopTalkPost | null> {
  const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}`), { credentials: "include" });
  const body = await readShopTalkResponse<{ data?: { post?: ServerShopTalkPost } }>(response, "That Shop Talk post could not be opened.");
  return body.data?.post ?? null;
}

export async function findShopTalkArticleDiscussions(urls: string[]): Promise<ShopTalkArticleDiscussion[]> {
  if (!urls.length) return [];
  const response = await fetchWithTimeout(apiPath("/api/v1/shop-talk/article-discussions/lookup"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: urls.slice(0, 50) }),
  });
  const body = await readShopTalkResponse<{ data?: { discussions?: ShopTalkArticleDiscussion[] } }>(
    response,
    "Article discussions could not be checked.",
  );
  return Array.isArray(body.data?.discussions) ? body.data.discussions : [];
}

export async function createShopTalkAnswer(
  postId: string,
  body: string,
  publicVisibilityAcknowledged = false,
): Promise<ServerShopTalkAnswer | null> {
  const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}/answers`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ body, publicVisibilityAcknowledged }),
  });
  const payload = await readShopTalkResponse<{ data?: { answer?: ServerShopTalkAnswer } }>(response, "RIVT could not save that answer.");
  return payload.data?.answer ?? null;
}

export async function verifyShopTalkAnswer(postId: string, answerId: string): Promise<ServerShopTalkAnswer[] | null> {
  const response = await fetchWithTimeout(
    apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}/answers/${encodeURIComponent(answerId)}/verified-fix`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    },
  );
  const payload = await readShopTalkResponse<{ data?: { answers?: ServerShopTalkAnswer[] } }>(response, "RIVT could not mark that answer as a Verified Fix.");
  return Array.isArray(payload.data?.answers) ? payload.data.answers : null;
}

export async function reportShopTalkTarget(input: ShopTalkReportInput): Promise<boolean> {
  const response = await fetchWithTimeout(apiPath("/api/v1/shop-talk/reports"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  await readShopTalkResponse(response, "RIVT could not send that report.");
  return true;
}
