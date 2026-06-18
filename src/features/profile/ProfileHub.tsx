import {
  BadgeCheck,
  Bell,
  CreditCard,
  GraduationCap,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
} from "lucide-react";
import { brandConfig, type ThemeMode, type ThemePalette } from "../../brandConfig";
import type { Role, Trade } from "../../types";
import "./profile-hub.css";

interface AccountProfile {
  email: string;
  displayName: string;
  organization: string;
  location: string;
  specialties: Trade[];
  plan: string;
  authMethod: string;
}

interface ProfileHubProps {
  view: "Trust & Legal" | "Safety & Training" | "Reviews" | "Feedback" | "Settings";
  role: Role;
  profile: AccountProfile;
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
  onReviewConsent: () => void;
  onLogout: () => void;
}

const themePaletteOrder = Object.keys(brandConfig.theme.palettes) as ThemePalette[];

export function ProfileHub({
  view,
  role,
  profile,
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
  onReviewConsent,
  onLogout,
}: ProfileHubProps) {
  return (
    <section className="v2-profile-page" aria-label={view}>
      <header className="v2-profile-header">
        <div>
          <h1>{view === "Settings" ? "Profile" : view}</h1>
          <p>{brandConfig.tagline}</p>
        </div>
        <div className="v2-profile-header-actions">
          <button type="button" className="v2-primary-button" onClick={onReviewConsent}>
            <ShieldCheck size={16} />
            {trustReady ? "Consent on file" : "Review consent"}
          </button>
          <button type="button" className="v2-secondary-button" onClick={onLogout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <div className="v2-profile-grid">
        <section className="v2-profile-panel v2-profile-summary">
          <div className="v2-profile-avatar" aria-hidden="true">
            {profile.displayName.trim().charAt(0).toUpperCase() || "R"}
          </div>
          <div>
            <span>{role === "contractor" ? "Contractor profile" : "Tradesperson profile"}</span>
            <h2>{profile.organization || profile.displayName}</h2>
            <p>{profile.location}</p>
            <div className="v2-profile-specialties">
              {profile.specialties.length
                ? profile.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)
                : <span>No specialties added yet</span>}
            </div>
          </div>
        </section>

        <section className="v2-profile-panel">
          <header>
            <span>Account</span>
            <strong>Basics and access</strong>
          </header>
          <div className="v2-profile-facts">
            <article><Mail size={16} /><strong>{profile.email}</strong><span>Email</span></article>
            <article><CreditCard size={16} /><strong>{profile.plan}</strong><span>Plan</span></article>
            <article><UserCheck size={16} /><strong>{profile.authMethod}</strong><span>Signup method</span></article>
            <article><BadgeCheck size={16} /><strong>{trustReady ? "Ready" : "Needs review"}</strong><span>Trust</span></article>
          </div>
        </section>

        <section className="v2-profile-panel">
          <header>
            <span>Themes</span>
            <strong>Tool-inspired appearance</strong>
          </header>
          <div className="v2-profile-theme-row">
            <button type="button" className="v2-theme-toggle" onClick={onToggleTheme}>
              <Bell size={16} />
              {themeMode === "dark" ? "Dark mode" : "Light mode"}
            </button>
            <div className="v2-theme-palettes">
              {themePaletteOrder.map((palette) => (
                <button
                  key={palette}
                  type="button"
                  className={palette === themePalette ? "is-selected" : ""}
                  onClick={() => onSelectThemePalette(palette)}
                  aria-label={`Use ${brandConfig.theme.palettes[palette].label} theme`}
                >
                  <span aria-hidden="true" style={{ background: `linear-gradient(135deg, ${brandConfig.theme.palettes[palette].swatches[0]}, ${brandConfig.theme.palettes[palette].swatches[1]})` }} />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="v2-profile-panel">
          <header>
            <span>Trust</span>
            <strong>Readiness and records</strong>
          </header>
          <div className="v2-profile-list">
            <article><ShieldCheck size={16} /><span>Consent {trustReady ? "ready" : "pending"}</span></article>
            <article><CreditCard size={16} /><span>{recordCount} records saved</span></article>
            <article><Sparkles size={16} /><span>{communityBadges.length} community badge{communityBadges.length === 1 ? "" : "s"}</span></article>
          </div>
        </section>

        <section className="v2-profile-panel">
          <header>
            <span>Training</span>
            <strong>Safety and proof</strong>
          </header>
          <div className="v2-profile-list">
            <article><GraduationCap size={16} /><span>{trainingProgress}% complete</span></article>
            <article><BadgeCheck size={16} /><span>{safetyCertCount} safety cert{safetyCertCount === 1 ? "" : "s"}</span></article>
            <article><Star size={16} /><span>{shoutOutCount} shout-out{shoutOutCount === 1 ? "" : "s"}</span></article>
          </div>
        </section>

        <section className="v2-profile-panel v2-profile-panel-wide">
          <header>
            <span>Community</span>
            <strong>Profile signals</strong>
          </header>
          <div className="v2-profile-badge-row">
            {communityBadges.length ? communityBadges.map((badge) => <span key={badge}>{badge}</span>) : <span>New contributor</span>}
          </div>
          <p className="v2-profile-note">
            {feedbackCount > 0
              ? `${feedbackCount} feedback note${feedbackCount === 1 ? "" : "s"} captured during beta testing.`
              : "Feedback stays in the profile hub so the app does not feel like a separate admin tool."}
          </p>
        </section>
      </div>
    </section>
  );
}
