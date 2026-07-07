import type { TrialPlan } from "../brandConfig";
import type { difficultyOptions, tradeOptions, workTypeOptions } from "../data";
import type { AuthMethod } from "../features/auth/AuthScreens";
import type { Role, Trade } from "../types";

export type TradeFilter = (typeof tradeOptions)[number];
export type DifficultyFilter = (typeof difficultyOptions)[number];
export type WorkTypeFilter = (typeof workTypeOptions)[number];

export interface AccountProfile {
  email: string;
  displayName: string;
  organization: string;
  location: string;
  specialties: Trade[];
  plan: TrialPlan;
  authMethod: AuthMethod;
}

export interface AuthUser {
  id: string;
  email: string;
  provider: string;
  display_name: string;
  role: Role | "pending";
  organization: string;
  location: string;
  email_verified: boolean;
  account_status: "onboarding" | "active" | "suspended" | "closed";
  onboarding_status: "draft" | "complete";
}

export interface CanonicalAccount {
  id: string;
  status: "onboarding" | "active" | "suspended" | "closed";
  primaryRole: Role | "pending";
  email: string;
  provider: "email" | "google" | "facebook" | "apple";
  emailVerified: boolean;
  profile: {
    displayName: string;
    headline: string;
    bio: string;
    locationText: string;
    visibility: "private" | "network";
    onboardingStatus: "draft" | "complete";
    serviceArea: {
      city: string;
      region: string;
      countryCode: string;
      radiusMiles: number;
    };
    availabilityStatus: "available" | "limited" | "unavailable";
    contactEmailVisibility: "private" | "connections";
    phoneE164: string | null;
    phoneVisibility: "private" | "connections";
    avatarUploadId: string | null;
    trades: Array<{ code: string; name: string; primary: boolean }>;
  };
  organizations: Array<{ id: string; name: string; role: "owner" | "admin" | "member" }>;
  adminRoles: string[];
  capabilities: {
    canCompleteOnboarding: boolean;
    canPostWork: boolean;
    canApplyToWork: boolean;
    canPublishProfile: boolean;
  };
}

export interface ActivityItem {
  id: number | string;
  title: string;
  detail: string;
  timestamp: string;
  unread: boolean;
  actionLabel?: string;
  kind?: "info" | "success" | "warning" | "error";
}

export interface AppToast {
  id: number;
  title: string;
  detail: string;
  kind: "info" | "success" | "warning" | "error";
  timestamp: string;
}

export interface FeedbackItem {
  id: number;
  category: "Bug" | "Confusing" | "Feature" | "Pricing" | "Other";
  message: string;
  timestamp: string;
}

export interface PaymentRecord {
  id: number;
  jobId: number;
  jobTitle: string;
  worker: string;
  amount: number;
  method: string;
  status: "Payment pending" | "Paid / Closed";
  date: string;
}

export interface ShoutOut {
  id: number;
  from: string;
  to: string;
  trade: Trade;
  message: string;
  createdAt: string;
}
