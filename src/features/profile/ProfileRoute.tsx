import type { ThemeMode, TrialPlan } from "../../brandConfig";
import type { AccessibilityPreferenceKey, AccessibilityPreferences, TextScale } from "../../app-shell/preferences";
import type { ThemeSource } from "../../app-shell/useAppTheme";
import type { Role, Trade } from "../../types";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProfileHub, type AccountSessionSummary, type ProfileUpdateInput, type SettingsSection } from "./ProfileHub";
import type { SafetyQuizResult } from "./training-data";
import { apiPath, fetchWithTimeout, RIVT_EXPECTED_ACCOUNT_HEADER } from "../../lib/api";

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
  accountId: string;
  view: ProfileRouteView;
  initialSettingsSection?: SettingsSection;
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
  onSetThemeSource: (source: ThemeSource) => void;
  onSetTextScale: (scale: TextScale) => void;
  accessibilityPreferences: AccessibilityPreferences;
  onToggleAccessibility: (key: AccessibilityPreferenceKey) => void;
  onLogout: () => void;
  onSaveProfile: (input: ProfileUpdateInput) => Promise<void>;
  onSetProfileVisibility: (visibility: "private" | "network") => Promise<void>;
  onCurrentSessionRevoked: () => void;
  onActivity: (title: string, detail: string, kind: "info" | "success" | "warning" | "error") => void;
  onQuizComplete: (result: SafetyQuizResult) => void;
  isDemo?: boolean;
}

export function ProfileRoute({
  accountId,
  view,
  initialSettingsSection,
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
  onSetThemeSource,
  onSetTextScale,
  accessibilityPreferences,
  onToggleAccessibility,
  onLogout,
  onSaveProfile,
  onSetProfileVisibility,
  onCurrentSessionRevoked,
  onActivity,
  onQuizComplete,
  isDemo = false,
}: ProfileRouteProps) {
  const [sessions, setSessions] = useState<AccountSessionSummary[]>([]);
  const mountedRef = useRef(true);
  const accountIdRef = useRef(accountId);
  useEffect(() => {
    mountedRef.current = true;
    accountIdRef.current = accountId;
    return () => {
      mountedRef.current = false;
    };
  }, [accountId]);

  const isCurrentAccount = useCallback((originAccountId: string) => (
    mountedRef.current && accountIdRef.current === originAccountId
  ), []);

  const fetchAccountSessions = useCallback(async (signal?: AbortSignal) => {
    const response = await fetchWithTimeout(apiPath("/api/v1/sessions"), {
      credentials: "include",
      headers: { [RIVT_EXPECTED_ACCOUNT_HEADER]: accountId },
      signal,
    });
    const body = await response.json().catch(() => ({})) as {
      data?: { sessions?: AccountSessionSummary[] };
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(body.error?.message || "Sessions could not be loaded.");
    return body.data?.sessions ?? [];
  }, [accountId]);

  useEffect(() => {
    if (isDemo) return;
    const controller = new AbortController();
    let cancelled = false;
    void fetchAccountSessions(controller.signal)
      .then((nextSessions) => { if (!cancelled) setSessions(nextSessions); })
      .catch(() => { if (!cancelled) setSessions([]); });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchAccountSessions, isDemo]);

  async function revokeSession(sessionId: string) {
    const originAccountId = accountId;
    const response = await fetchWithTimeout(apiPath(`/api/v1/sessions/${sessionId}`), {
      method: "DELETE",
      credentials: "include",
      headers: { [RIVT_EXPECTED_ACCOUNT_HEADER]: originAccountId },
    });
    const body = await response.json().catch(() => ({})) as { data?: { current?: boolean }; error?: { message?: string } };
    if (!isCurrentAccount(originAccountId)) return;
    if (!response.ok) throw new Error(body.error?.message || "Session could not be signed out.");
    if (body.data?.current) {
      onCurrentSessionRevoked();
      return;
    }
    const nextSessions = await fetchAccountSessions();
    if (!isCurrentAccount(originAccountId)) return;
    setSessions(nextSessions);
    onActivity("Device signed out", "That RIVT session can no longer access your account.", "success");
  }

  async function revokeOtherSessions() {
    const originAccountId = accountId;
    const response = await fetchWithTimeout(apiPath("/api/v1/sessions/revoke-others"), {
      method: "POST",
      credentials: "include",
      headers: { [RIVT_EXPECTED_ACCOUNT_HEADER]: originAccountId },
    });
    const body = await response.json().catch(() => ({})) as { data?: { revokedCount?: number }; error?: { message?: string } };
    if (!isCurrentAccount(originAccountId)) return;
    if (!response.ok) throw new Error(body.error?.message || "Other sessions could not be signed out.");
    const nextSessions = await fetchAccountSessions();
    if (!isCurrentAccount(originAccountId)) return;
    setSessions(nextSessions);
    onActivity("Other devices signed out", `${body.data?.revokedCount ?? 0} other session${body.data?.revokedCount === 1 ? "" : "s"} revoked.`, "success");
  }

  return (
    <ProfileHub
      key={`${view}:${initialSettingsSection ?? "account"}`}
      accountId={accountId}
      view={view}
      initialSettingsSection={initialSettingsSection}
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
      onSetThemeSource={onSetThemeSource}
      onSetTextScale={onSetTextScale}
      accessibilityPreferences={accessibilityPreferences}
      onToggleAccessibility={onToggleAccessibility}
      onLogout={onLogout}
      onSaveProfile={onSaveProfile}
      onSetProfileVisibility={onSetProfileVisibility}
      onRevokeSession={revokeSession}
      onRevokeOtherSessions={revokeOtherSessions}
      onQuizComplete={onQuizComplete}
      isDemo={isDemo}
    />
  );
}
