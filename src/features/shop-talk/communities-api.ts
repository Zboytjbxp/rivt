import { apiPath } from "../../lib/api";

export interface ServerCommunity {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  joined: boolean;
}

export function communitySlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** List communities with the viewer's joined state, or null if the API is unavailable. */
export async function fetchCommunities(): Promise<ServerCommunity[] | null> {
  try {
    const response = await fetch(apiPath("/api/v1/communities"), { credentials: "include" });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { communities?: ServerCommunity[] } } | null;
    return Array.isArray(body?.data?.communities) ? body!.data!.communities! : null;
  } catch {
    return null;
  }
}

/** Join or leave a community by slug. Fails silently when the backend is unavailable. */
export async function setCommunityMembership(slug: string, joined: boolean): Promise<void> {
  try {
    await fetch(apiPath(`/api/v1/communities/${encodeURIComponent(slug)}/join`), {
      method: joined ? "POST" : "DELETE",
      credentials: "include",
    });
  } catch {
    /* graceful: offline / no backend */
  }
}
