import type { ThemeMode, ThemePalette, TrialPlan } from "../../brandConfig";
import type { Role, Trade } from "../../types";
import { ProfileHub, type AccountSessionSummary, type ProfileUpdateInput } from "./ProfileHub";

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
  sessions: AccountSessionSummary[];
  trustReady: boolean;
  recordCount: number;
  trainingProgress: number;
  safetyCertCount: number;
  communityBadges: string[];
  shoutOutCount: number;
  feedbackCount: number;
  themeMode: ThemeMode;
  themePalette: ThemePalette;
  onToggleTheme: () => void;
  onSelectThemePalette: (palette: ThemePalette) => void;
  onLogout: () => void;
  onSaveProfile: (input: ProfileUpdateInput) => Promise<void>;
  onSetProfileVisibility: (visibility: "private" | "network") => Promise<void>;
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeOtherSessions: () => Promise<void>;
}

export function ProfileRoute({
  view,
  role,
  accountProfile,
  canonicalAccount,
  sessions,
  trustReady,
  recordCount,
  trainingProgress,
  safetyCertCount,
  communityBadges,
  shoutOutCount,
  feedbackCount,
  themeMode,
  themePalette,
  onToggleTheme,
  onSelectThemePalette,
  onLogout,
  onSaveProfile,
  onSetProfileVisibility,
  onRevokeSession,
  onRevokeOtherSessions,
}: ProfileRouteProps) {
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
      trustReady={trustReady}
      recordCount={recordCount}
      trainingProgress={trainingProgress}
      safetyCertCount={safetyCertCount}
      communityBadges={communityBadges}
      shoutOutCount={shoutOutCount}
      feedbackCount={feedbackCount}
      themeMode={themeMode}
      themePalette={themePalette}
      onToggleTheme={onToggleTheme}
      onSelectThemePalette={onSelectThemePalette}
      onReviewConsent={() => {}}
      onLogout={onLogout}
      onSaveProfile={onSaveProfile}
      onSetProfileVisibility={onSetProfileVisibility}
      onRevokeSession={onRevokeSession}
      onRevokeOtherSessions={onRevokeOtherSessions}
    />
  );
}
