import { apiPath } from "../../lib/api";

export interface ServerCommunity {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  joined: boolean;
  role?: "member" | "moderator" | "owner" | null;
  createdByAccountId?: string | null;
}

export function communitySlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** List communities with the viewer's joined state, or null if the API is unavailable. */
export async function fetchCommunities(query?: string): Promise<ServerCommunity[] | null> {
  try {
    const suffix = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    const response = await fetch(apiPath(`/api/v1/communities${suffix}`), { credentials: "include" });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { communities?: ServerCommunity[] } } | null;
    return Array.isArray(body?.data?.communities) ? body!.data!.communities! : null;
  } catch {
    return null;
  }
}

export interface CreateCommunityResult {
  community?: ServerCommunity;
  duplicateCandidates?: ServerCommunity[];
  error?: string;
}

export async function createCommunity(input: {
  name: string;
  description?: string;
  confirmDuplicate?: boolean;
}): Promise<CreateCommunityResult | null> {
  try {
    const response = await fetch(apiPath("/api/v1/communities"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => null) as {
      data?: { community?: ServerCommunity };
      error?: { code?: string; message?: string; details?: { candidates?: ServerCommunity[] } };
    } | null;
    if (response.status === 409 && body?.error?.code === "COMMUNITY_DUPLICATE_CANDIDATES") {
      return {
        duplicateCandidates: Array.isArray(body.error.details?.candidates) ? body.error.details!.candidates! : [],
        error: body.error.message,
      };
    }
    if (!response.ok) return { error: body?.error?.message || "Community could not be created." };
    return { community: body?.data?.community };
  } catch {
    return null;
  }
}

/** Join or leave a community by slug. Fails silently when the backend is unavailable. */
export async function setCommunityMembership(slug: string, joined: boolean): Promise<boolean> {
  try {
    const response = await fetch(apiPath(`/api/v1/communities/${encodeURIComponent(slug)}/join`), {
      method: joined ? "POST" : "DELETE",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}
