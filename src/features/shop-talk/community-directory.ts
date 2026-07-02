import {
  Briefcase,
  Building2,
  Hammer,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { communitySlug, type ServerCommunity } from "./communities-api";

interface CommunityDisplaySeed {
  name: string;
  meta: string;
  memberCount: number;
  icon: LucideIcon;
  tone: string;
}

export interface CommunityDisplay {
  slug: string;
  name: string;
  meta: string;
  memberCount: number;
  count: string;
  icon: LucideIcon;
  tone: string;
  joined: boolean;
  serverOwned: boolean;
}

const COMMUNITY_SEEDS: CommunityDisplaySeed[] = [
  { name: "Carpentry Talk", meta: "Trim, framing, punch-out", memberCount: 0, icon: Hammer, tone: "#7a4a24" },
  { name: "Electrical Talk", meta: "Code, service, rough-in", memberCount: 0, icon: Zap, tone: "#1c1c1c" },
  { name: "Jacksonville Trades", meta: "Local work and referrals", memberCount: 0, icon: Building2, tone: "#0f6b7a" },
  { name: "Side Work", meta: "Short-term help needed", memberCount: 0, icon: Briefcase, tone: "#1c1c1c" },
  { name: "Cabinetry Talk", meta: "Installs, layout, scribing", memberCount: 0, icon: Hammer, tone: "#6b4a1c" },
  { name: "Tile Talk", meta: "Layout, thinset, lippage", memberCount: 0, icon: Wrench, tone: "#3b2a6b" },
  { name: "Plumbing Talk", meta: "Rough-in, service, code", memberCount: 0, icon: Wrench, tone: "#0f5f6b" },
  { name: "Remodelers", meta: "Whole-home coordination", memberCount: 0, icon: Users, tone: "#444" },
];

const COMMUNITY_META = new Map(
  COMMUNITY_SEEDS.map((community) => [communitySlug(community.name), community]),
);

export function formatMemberCount(memberCount: number) {
  if (memberCount >= 1_000_000) {
    return `${(memberCount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (memberCount >= 1_000) {
    return `${(memberCount / 1_000).toFixed(memberCount >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }
  return String(memberCount);
}

function seedToDisplay(seed: CommunityDisplaySeed): CommunityDisplay {
  return {
    slug: communitySlug(seed.name),
    name: seed.name,
    meta: seed.meta,
    memberCount: seed.memberCount,
    count: formatMemberCount(seed.memberCount),
    icon: seed.icon,
    tone: seed.tone,
    joined: false,
    serverOwned: false,
  };
}

export const fallbackCommunities: CommunityDisplay[] = COMMUNITY_SEEDS.map(seedToDisplay);

export function mapServerCommunity(community: ServerCommunity): CommunityDisplay {
  const fallback = COMMUNITY_META.get(community.slug);
  const memberCount = Number.isFinite(community.memberCount) ? community.memberCount : fallback?.memberCount ?? 0;

  return {
    slug: community.slug,
    name: community.name || fallback?.name || community.slug,
    meta: community.description || fallback?.meta || "Trade community",
    memberCount,
    count: formatMemberCount(memberCount),
    icon: fallback?.icon ?? Users,
    tone: fallback?.tone ?? "#444",
    joined: community.joined,
    serverOwned: true,
  };
}
