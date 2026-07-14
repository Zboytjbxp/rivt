import type { ReactNode } from "react";
import type { Role } from "../types";

export type PrimaryDestination = "home" | "work" | "crew" | "shop-talk" | "camera" | "tools" | "messages";
export type SearchTarget = "work" | "shop-talk" | "tools";

export interface ProfileSearchResult {
  accountId: string;
  displayName: string;
  headline: string;
  locationText: string;
  primaryRole: "contractor" | "tradesperson";
  availabilityStatus: "available" | "limited" | "unavailable";
  trades: Array<{ code: string; name: string; primary: boolean }>;
}

export interface ShellProfile {
  name: string;
  subtitle: string;
  location: string;
}

export interface ShellJobContext {
  title: string;
  trade: string;
  location: string;
  status: string;
}

export interface AppShellProps {
  activeDestination: PrimaryDestination | null;
  role: Role;
  profile: ShellProfile;
  activeJob: ShellJobContext | null;
  notificationCount: number;
  messageCount?: number;
  isGuest: boolean;
  mobileNavHidden?: boolean;
  children: ReactNode;
  guestBanner?: ReactNode;
  onNavigate: (destination: PrimaryDestination) => void;
  onOpenAccount: () => void;
  onOpenMessages: () => void;
  onOpenNotifications: () => void;
  onOpenActiveJob: () => void;
  onSearch: (query: string, target?: SearchTarget) => void;
  onOpenProfileResult?: (profile: ProfileSearchResult) => void;
}
