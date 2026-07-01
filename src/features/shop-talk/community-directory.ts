import { Briefcase, Building2, Hammer, Users, Wrench, Zap, type LucideIcon } from "lucide-react";

/**
 * Single source of static display metadata for the standard trade
 * communities, shared by Home (TradeFeed) and Shop Talk so the two surfaces
 * can't drift out of sync. Slugs match the seeded rows in
 * migrations/0016_communities.up.sql — live member counts and joined-state
 * come from GET /api/v1/communities and are merged on top of this at runtime.
 */
export interface CommunityDirectoryEntry {
  slug: string;
  name: string;
  meta: string;
  fallbackCount: string;
  icon: LucideIcon;
  tone: string;
}

export const COMMUNITY_DIRECTORY: CommunityDirectoryEntry[] = [
  { slug: "carpentry-talk", name: "Carpentry Talk", meta: "Trim, framing, punch-out", fallbackCount: "124K", icon: Hammer, tone: "#7a4a24" },
  { slug: "electrical-talk", name: "Electrical Talk", meta: "Code, service, rough-in", fallbackCount: "98K", icon: Zap, tone: "#1c1c1c" },
  { slug: "jacksonville-trades", name: "Jacksonville Trades", meta: "Local work and referrals", fallbackCount: "8.7K", icon: Building2, tone: "#0f6b7a" },
  { slug: "side-work", name: "Side Work", meta: "Short-term help needed", fallbackCount: "5.2K", icon: Briefcase, tone: "#1c1c1c" },
  { slug: "cabinetry-talk", name: "Cabinetry Talk", meta: "Installs, layout, scribing", fallbackCount: "6.1K", icon: Hammer, tone: "#6b4a1c" },
  { slug: "tile-talk", name: "Tile Talk", meta: "Layout, thinset, lippage", fallbackCount: "5.3K", icon: Wrench, tone: "#3b2a6b" },
  { slug: "plumbing-talk", name: "Plumbing Talk", meta: "Rough-in, service, code", fallbackCount: "7.6K", icon: Wrench, tone: "#0f5f6b" },
  { slug: "remodelers", name: "Remodelers", meta: "Whole-home coordination", fallbackCount: "4.4K", icon: Users, tone: "#444" },
];

/** Formats a raw member count (e.g. 124301) the same way the fallback strings read ("124K"). */
export function formatMemberCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}
