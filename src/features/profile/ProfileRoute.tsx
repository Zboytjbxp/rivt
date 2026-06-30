import type { ThemeMode, ThemePalette, TrialPlan } from "../../brandConfig";
import type { ThemeSource } from "../../app-shell/useAppTheme";
import type { Role, Trade } from "../../types";
import { useCallback, useEffect, useState } from "react";
import { ProfileHub, type AccountSessionSummary, type ProfileUpdateInput } from "./ProfileHub";
import type { SafetyQuizResult } from "./training-data";
import { apiPath } from "../../lib/api";

export type ProfileRouteView = "Trust & Legal" | "Safety & Training" | "Reviews" | "Feedback" | "Settings";

type AuthMethod = "Google" | "Facebook" | "Apple" | "Email";

interface AccountProfileForProfileRoute {
  email: string;
  displayName: string;
  organization: string;
  location: string;
  specialties: Trade[];
  plan: TrialPlan;
  authMethod: AuthMethod;
}

interface CanonicalAccountForProfileRoute {
  emailVerified: boolean;
  profile: {
    headline: string;
    bio: string;
    visibility: "private" | "network";
    serviceArea: {
      city: string;
      region: string;
      radiusMiles: number;
    };
    availabilityStatus: "available" | "limited" | "unavailable";
    contactEmailVisibility: "private" | "connections";
    phoneE164: string | null;
    phoneVisibility: "private" | "connections";
  };
}

interface ProfileRouteProps {
  view: ProfileRouteView;
  role: Role;
  accountProfile: AccountProfileForProfileRoute;
  canonicalAccount: CanonicalAccountForProfileRoute | null;
  storageUsage: {
    usedBytes: number;
    objectCount: number;
    storageLimitBytes?: number | null;
    storageScope?: string;
    bucket?: string | null;
    region?: string | null;
    endpoint?: string | null;
    objectStorage?: string;
  } | null;
  trustReady: boolean;
  recordCount: number;
  trainingProgress: number;
  safetyCertCount: number;
  safetyQuizResults: Record<string, SafetyQuizResult>;
  communityBadges: string[];
  shoutOutCount: number;
  feedbackCount: number;
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  themePalette: ThemePalette;
  onToggleTheme: () => void;
  onSetThemeSource: (source: ThemeSource) => void;
  onSelectThemePalette: (palette: ThemePalette) => void;
  onLogout: () => void;
  onSaveProfile: (input: ProfileUpdateInput) => Promise<void>;
  onSetProfileVisibility: (visibility: "private" | "network") => Promise<void>;
  onCurrentSessionRevoked: () => void;
  onActivity: (title: string, detail: string, kind: "info" | "success" | "warning" | "error") => void;
  onQuizComplete: (result: SafetyQuizResult) => void;
}

export function ProfileRoute({
  view,
  role,
  accountProfile,
  canonicalAccount,
  storageUsage,
  trustReady,
  recordCount,
  trainingProgress,
  safetyCertCount,
  safetyQuizResults,
  communityBadges,
  shoutOutCount,
  feedbackCount,
  themeMode,
  themeSource,
  themePalette,
  onToggleTheme,
  onSetThemeSource,
  onSelectThemePalette,
  onLogout,
  onSaveProfile,
  onSetProfileVisibility,
  onCurrentSessionRevoked,
  onActivity,
  onQuizComplete,
}: ProfileRouteProps) {
  const [sessions, setSessions] = useState<AccountSessionSummary[]>([]);

  const fetchAccountSessions = useCallback(async () => {
    const response = await fetch(apiPath("/api/v1/sessions"), { credentials: "include" });
    const body = await response.json().catch(() => ({})) as {
      data?: { sessions?: AccountSessionSummary[] };
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(body.error?.message || "Sessions could not be loaded.");
    return body.data?.sessions ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAccountSessions()
      .then((nextSessions) => { if (!cancelled) setSessions(nextSessions); })
      .catch(() => { if (!cancelled) setSessions([]); });
    return () => { cancelled = true; };
  }, [fetchAccountSessions]);

  async function revokeSession(sessionId: string) {
    const response = await fetch(apiPath(`/api/v1/sessions/${sessionId}`), {
      method: "DELETE",
      credentials: "include",
    });
    const body = await response.json().catch(() => ({})) as { data?: { current?: boolean }; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message || "Session could not be signed out.");
    if (body.data?.current) {
      onCurrentSessionRevoked();
      return;
    }
    setSessions(await fetchAccountSessions());
    onActivity("Device signed out", "That RIVT session can no longer access your account.", "success");
  }

  async function revokeOtherSessions() {
    const response = await fetch(apiPath("/api/v1/sessions/revoke-others"), {
      method: "POST",
      credentials: "include",
    });
    const body = await response.json().catch(() => ({})) as { data?: { revokedCount?: number }; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message || "Other sessions could not be signed out.");
    setSessions(await fetchAccountSessions());
    onActivity("Other devices signed out", `${body.data?.revokedCount ?? 0} other session${body.data?.revokedCount === 1 ? "" : "s"} revoked.`, "success");
  }

  return (
    <ProfileHub
      view={view}
      role={role}
      profile={{
        email: accountProfile.email,
        displayName: accountProfile.displayName,
        organization: accountProfile.organization,
        location: accountProfile.location,
        specialties: accountProfile.specialties,
        plan: accountProfile.plan,
        authMethod: accountProfile.authMethod,
      }}
      canonicalProfile={canonicalAccount ? {
        headline: canonicalAccount.profile.headline,
        bio: canonicalAccount.profile.bio,
        serviceAreaCity: canonicalAccount.profile.serviceArea.city,
        serviceAreaRegion: canonicalAccount.profile.serviceArea.region,
        serviceRadiusMiles: canonicalAccount.profile.serviceArea.radiusMiles,
        availabilityStatus: canonicalAccount.profile.availabilityStatus,
        contactEmailVisibility: canonicalAccount.profile.contactEmailVisibility,
        phoneE164: canonicalAccount.profile.phoneE164,
        phoneVisibility: canonicalAccount.profile.phoneVisibility,
        visibility: canonicalAccount.profile.visibility,
        emailVerified: canonicalAccount.emailVerified,
      } : null}
      sessions={sessions}
      storageUsage={storageUsage}
      trustReady={trustReady}
      recordCount={recordCount}
      trainingProgress={trainingProgress}
      safetyCertCount={safetyCertCount}
      safetyQuizResults={safetyQuizResults}
      communityBadges={communityBadges}
      shoutOutCount={shoutOutCount}
      feedbackCount={feedbackCount}
      themeMode={themeMode}
      themeSource={themeSource}
      themePalette={themePalette}
      onToggleTheme={onToggleTheme}
      onSetThemeSource={onSetThemeSource}
      onSelectThemePalette={onSelectThemePalette}
      onReviewConsent={() => {}}
      onLogout={onLogout}
      onSaveProfile={onSaveProfile}
      onSetProfileVisibility={onSetProfileVisibility}
      onRevokeSession={revokeSession}
      onRevokeOtherSessions={revokeOtherSessions}
      onQuizComplete={onQuizComplete}
    />
  );
}
