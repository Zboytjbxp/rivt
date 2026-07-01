import { apiPath } from "../../lib/api";

export interface ShopTalkPostInput {
  title: string;
  body?: string;
  trade: string;
  flair?: string | null;
  postType?: "question" | "sub-request" | "safety" | "general";
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
}

/**
 * Persist a Shop Talk post to the server. Returns the created post, or null if
 * the API is unavailable (e.g. offline / no backend) so callers can degrade
 * gracefully to local-only behavior.
 */
export async function createShopTalkPost(input: ShopTalkPostInput): Promise<ServerShopTalkPost | null> {
  try {
    const response = await fetch(apiPath("/api/v1/shop-talk/posts"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { post?: ServerShopTalkPost } } | null;
    return body?.data?.post ?? null;
  } catch {
    return null;
  }
}

/** Fetch recent Shop Talk posts, or null if the API is unavailable. */
export async function fetchShopTalkPosts(): Promise<ServerShopTalkPost[] | null> {
  try {
    const response = await fetch(apiPath("/api/v1/shop-talk/posts"), { credentials: "include" });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { posts?: ServerShopTalkPost[] } } | null;
    return Array.isArray(body?.data?.posts) ? body!.data!.posts! : null;
  } catch {
    return null;
  }
}
