import type { ReactNode } from "react";
import type { Role } from "../types";

export type PrimaryDestination = "home" | "work" | "crew" | "shop-talk" | "tools" | "messages";

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
  isGuest: boolean;
  children: ReactNode;
  guestBanner?: ReactNode;
  onNavigate: (destination: PrimaryDestination) => void;
  onOpenAccount: () => void;
  onOpenMessages: () => void;
  onOpenNotifications: () => void;
  onOpenActiveJob: () => void;
  onSearch: (query: string) => void;
}
