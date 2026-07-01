import { useCallback, useEffect, useState } from "react";
import { COMMUNITY_DIRECTORY, formatMemberCount, type CommunityDirectoryEntry } from "./community-directory";
import { fetchCommunities, setCommunityMembership, type ServerCommunity } from "./communities-api";

const LOCAL_JOINED_KEY = "rivt.joinedCommunities.v1";

function readLocalJoined(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LOCAL_JOINED_KEY) ?? "[]") as string[]); }
  catch { return new Set(); }
}

function persistLocalJoined(next: Set<string>) {
  try { localStorage.setItem(LOCAL_JOINED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
}

export interface CommunityDirectoryItem extends CommunityDirectoryEntry {
  memberCount: string;
  joined: boolean;
}

/**
 * Merges the static community directory with live server state
 * (GET /api/v1/communities). Falls back to localStorage-tracked joins when
 * the server is unreachable (guest/offline), and lets the server's joined
 * flag win once it has responded — so join/leave persist across devices for
 * authenticated sessions without duplicating count math client-side.
 */
export function useCommunityDirectory() {
  const [live, setLive] = useState<ServerCommunity[] | null>(null);
  const [localJoined, setLocalJoined] = useState<Set<string>>(readLocalJoined);

  const refresh = useCallback(async () => {
    const list = await fetchCommunities();
    if (list) setLive(list);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const communities: CommunityDirectoryItem[] = COMMUNITY_DIRECTORY.map((entry) => {
    const liveEntry = live?.find((c) => c.slug === entry.slug);
    return {
      ...entry,
      memberCount: liveEntry ? formatMemberCount(liveEntry.memberCount) : entry.fallbackCount,
      joined: liveEntry ? liveEntry.joined : localJoined.has(entry.slug),
    };
  });

  async function toggleJoin(slug: string) {
    const current = communities.find((c) => c.slug === slug);
    const nextJoined = !(current?.joined ?? false);
    setLocalJoined((prev) => {
      const next = new Set(prev);
      if (nextJoined) next.add(slug); else next.delete(slug);
      persistLocalJoined(next);
      return next;
    });
    await setCommunityMembership(slug, nextJoined);
    void refresh(); // reconcile with the server's authoritative count/joined state
  }

  return { communities, toggleJoin };
}
