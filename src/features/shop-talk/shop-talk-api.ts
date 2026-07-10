import { apiPath, fetchWithTimeout, notifySessionExpired, UPLOAD_REQUEST_TIMEOUT_MS } from "../../lib/api";

export interface ShopTalkPostInput {
  title: string;
  body?: string;
  trade: string;
  flair?: string | null;
  postType?: "question" | "sub-request" | "safety" | "general";
  communitySlug?: string;
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
}

export type ShopTalkReportReason = "spam" | "harassment" | "unsafe_advice" | "misinformation" | "privacy" | "duplicate" | "other";

export interface ShopTalkReportInput {
  targetType: "community" | "post" | "answer";
  targetId: string;
  reasonCode: ShopTalkReportReason;
  note?: string;
}

/**
 * Persist a Shop Talk post to the server. Returns the created post, or null if
 * the API is unavailable so callers can decide whether local-only preview is
 * appropriate for the current auth mode.
 */
export async function createShopTalkPost(input: ShopTalkPostInput): Promise<ServerShopTalkPost | null> {
  try {
    const response = await fetchWithTimeout(apiPath("/api/v1/shop-talk/posts"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    });
    if (response.status === 401) notifySessionExpired();
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { post?: ServerShopTalkPost } } | null;
    return body?.data?.post ?? null;
  } catch {
    return null;
  }
}

export async function uploadShopTalkPostPhoto(postId: string, file: File): Promise<ServerShopTalkPost | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}/media`), {
      method: "POST",
      credentials: "include",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: formData,
    }, UPLOAD_REQUEST_TIMEOUT_MS);
    if (response.status === 401) notifySessionExpired();
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { post?: ServerShopTalkPost } } | null;
    return body?.data?.post ?? null;
  } catch {
    return null;
  }
}

export async function deleteShopTalkPost(postId: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}`), {
      method: "DELETE",
      credentials: "include",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    if (response.status === 401) notifySessionExpired();
    return response.ok;
  } catch {
    return false;
  }
}

/** Fetch recent Shop Talk posts, or null if the API is unavailable. */
export async function fetchShopTalkPosts(communitySlug?: string | null): Promise<ServerShopTalkPost[] | null> {
  try {
    const suffix = communitySlug ? `?community=${encodeURIComponent(communitySlug)}` : "";
    const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts${suffix}`), { credentials: "include" });
    if (response.status === 401) notifySessionExpired();
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { posts?: ServerShopTalkPost[] } } | null;
    return Array.isArray(body?.data?.posts) ? body!.data!.posts! : null;
  } catch {
    return null;
  }
}

export async function createShopTalkAnswer(postId: string, body: string): Promise<ServerShopTalkAnswer | null> {
  try {
    const response = await fetchWithTimeout(apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}/answers`), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ body }),
    });
    if (response.status === 401) notifySessionExpired();
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as { data?: { answer?: ServerShopTalkAnswer } } | null;
    return payload?.data?.answer ?? null;
  } catch {
    return null;
  }
}

export async function verifyShopTalkAnswer(postId: string, answerId: string): Promise<ServerShopTalkAnswer[] | null> {
  try {
    const response = await fetchWithTimeout(
      apiPath(`/api/v1/shop-talk/posts/${encodeURIComponent(postId)}/answers/${encodeURIComponent(answerId)}/verified-fix`),
      {
        method: "POST",
        credentials: "include",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    );
    if (response.status === 401) notifySessionExpired();
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as { data?: { answers?: ServerShopTalkAnswer[] } } | null;
    return Array.isArray(payload?.data?.answers) ? payload!.data!.answers! : null;
  } catch {
    return null;
  }
}

export async function reportShopTalkTarget(input: ShopTalkReportInput): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(apiPath("/api/v1/shop-talk/reports"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    });
    if (response.status === 401) notifySessionExpired();
    return response.ok;
  } catch {
    return false;
  }
}
