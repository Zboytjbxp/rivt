import {
  BadgeCheck,
  Bell,
  CreditCard,
  GraduationCap,
  LogOut,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { brandConfig, type ThemeMode, type ThemePalette } from "../../brandConfig";
import { tradeOptions } from "../../data";
import type { Role, Trade } from "../../types";
import { Avatar, MetricTile, PageHeader } from "../../components/ui";
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

export interface AccountSessionSummary {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface ProfileUpdateInput {
  displayName: string;
  headline: string;
  bio: string;
  serviceAreaCity: string;
  serviceAreaRegion: string;
  serviceRadiusMiles: number;
  availabilityStatus: "available" | "limited" | "unavailable";
  contactEmailVisibility: "private" | "connections";
  phoneE164: string | null;
  phoneVisibility: "private" | "connections";
  specialties: Trade[];
}

interface CanonicalProfileDetails extends Omit<ProfileUpdateInput, "displayName" | "specialties"> {
  visibility: "private" | "network";
  emailVerified: boolean;
}

interface ProfileHubProps {
  view: "Trust & Legal" | "Safety & Training" | "Reviews" | "Feedback" | "Settings";
  role: Role;
  profile: AccountProfile;
  canonicalProfile: CanonicalProfileDetails | null;
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
  onReviewConsent: () => void;
  onLogout: () => void;
  onSaveProfile: (input: ProfileUpdateInput) => Promise<void>;
  onSetProfileVisibility: (visibility: "private" | "network") => Promise<void>;
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeOtherSessions: () => Promise<void>;
}

const themePaletteOrder = Object.keys(brandConfig.theme.palettes) as ThemePalette[];

export function ProfileHub({
  view,
  role,
  profile,
  canonicalProfile,
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
  onReviewConsent,
  onLogout,
  onSaveProfile,
  onSetProfileVisibility,
  onRevokeSession,
  onRevokeOtherSessions,
}: ProfileHubProps) {
  const [draft, setDraft] = useState<ProfileUpdateInput>({
    displayName: profile.displayName,
    headline: canonicalProfile?.headline ?? "",
    bio: canonicalProfile?.bio ?? "",
    serviceAreaCity: canonicalProfile?.serviceAreaCity ?? "",
    serviceAreaRegion: canonicalProfile?.serviceAreaRegion ?? "",
    serviceRadiusMiles: canonicalProfile?.serviceRadiusMiles ?? 25,
    availabilityStatus: canonicalProfile?.availabilityStatus ?? "available",
    contactEmailVisibility: canonicalProfile?.contactEmailVisibility ?? "private",
    phoneE164: canonicalProfile?.phoneE164 ?? null,
    phoneVisibility: canonicalProfile?.phoneVisibility ?? "private",
    specialties: profile.specialties,
  });
  const [actionState, setActionState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [actionMessage, setActionMessage] = useState("");

  async function saveProfile() {
    setActionState("saving");
    setActionMessage("");
    try {
      await onSaveProfile(draft);
      setActionState("saved");
      setActionMessage("Profile saved.");
    } catch (error) {
      setActionState("error");
      setActionMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    }
  }

  async function runAccountAction(action: () => Promise<void>) {
    setActionState("saving");
    setActionMessage("");
    try {
      await action();
      setActionState("saved");
      setActionMessage("Account security updated.");
    } catch (error) {
      setActionState("error");
      setActionMessage(error instanceof Error ? error.message : "Account security could not be updated.");
    }
  }

  function toggleSpecialty(specialty: Trade) {
    setDraft((current) => ({
      ...current,
      specialties: current.specialties.includes(specialty)
        ? current.specialties.filter((item) => item !== specialty)
        : [...current.specialties, specialty],
    }));
  }

  return (
    <section className="v2-profile-page" aria-label={view}>
      <PageHeader
        className="v2-profile-header"
        title={view === "Settings" ? "Profile" : view}
        description={brandConfig.tagline}
        actions={
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
        }
      />

      <div className="v2-profile-grid">
        <section className="v2-profile-panel v2-profile-summary">
          <Avatar name={profile.displayName || profile.organization || "RIVT member"} size="lg" className="v2-profile-avatar" />
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
            <MetricTile icon={<Mail size={16} />} value={profile.email} label="Email" />
            <MetricTile icon={<CreditCard size={16} />} value={profile.plan} label="Plan" />
            <MetricTile icon={<UserCheck size={16} />} value={profile.authMethod} label="Signup method" />
            <MetricTile icon={<BadgeCheck size={16} />} value={trustReady ? "Ready" : "Needs review"} label="Trust" />
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
            <article><BadgeCheck size={16} /><span>{safetyCertCount} safety module{safetyCertCount === 1 ? "" : "s"}</span></article>
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

        {view === "Settings" && canonicalProfile ? (
          <section className="v2-profile-panel v2-profile-panel-wide v2-profile-editor">
            <header>
              <span>Profile details</span>
              <strong>How the network sees you</strong>
            </header>
            <div className="v2-profile-form-grid">
              <label><span>Display name</span><input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
              <label><span>Headline</span><input value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} placeholder="Commercial electrician available for service work" /></label>
              <label className="is-wide"><span>About</span><textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} rows={4} placeholder="Experience, specialties, and the kind of work you take." /></label>
              <label><span>Service area city</span><input value={draft.serviceAreaCity} onChange={(event) => setDraft({ ...draft, serviceAreaCity: event.target.value })} /></label>
              <label><span>State or region</span><input value={draft.serviceAreaRegion} onChange={(event) => setDraft({ ...draft, serviceAreaRegion: event.target.value })} /></label>
              <label><span>Service radius</span><select value={draft.serviceRadiusMiles} onChange={(event) => setDraft({ ...draft, serviceRadiusMiles: Number(event.target.value) })}>{[10, 25, 50, 75, 100].map((miles) => <option key={miles} value={miles}>{miles} miles</option>)}</select></label>
              <label><span>Availability</span><select value={draft.availabilityStatus} onChange={(event) => setDraft({ ...draft, availabilityStatus: event.target.value as ProfileUpdateInput["availabilityStatus"] })}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></label>
              <label><span>Phone (optional)</span><input value={draft.phoneE164 ?? ""} onChange={(event) => setDraft({ ...draft, phoneE164: event.target.value || null })} placeholder="+19045551234" /></label>
              <label><span>Contact visibility</span><select value={draft.contactEmailVisibility} onChange={(event) => setDraft({ ...draft, contactEmailVisibility: event.target.value as ProfileUpdateInput["contactEmailVisibility"] })}><option value="private">Private</option><option value="connections">Connections only</option></select></label>
              <label><span>Phone visibility</span><select value={draft.phoneVisibility} onChange={(event) => setDraft({ ...draft, phoneVisibility: event.target.value as ProfileUpdateInput["phoneVisibility"] })}><option value="private">Private</option><option value="connections">Connections only</option></select></label>
            </div>
            <div className="v2-profile-trade-picker" aria-label="Trade specialties">
              {tradeOptions.filter((trade) => trade !== "All trades").map((trade) => (
                <button key={trade} type="button" className={draft.specialties.includes(trade as Trade) ? "is-selected" : ""} onClick={() => toggleSpecialty(trade as Trade)}>{trade}</button>
              ))}
            </div>
            <div className="v2-profile-editor-actions">
              <div>
                <strong>{canonicalProfile.emailVerified ? "Email verified" : "Email verification pending"}</strong>
                <span>{canonicalProfile.visibility === "network" ? "Visible to the RIVT network" : "Private until you publish"}</span>
              </div>
              <button type="button" className="v2-secondary-button" onClick={() => void runAccountAction(() => onSetProfileVisibility(canonicalProfile.visibility === "network" ? "private" : "network"))}>
                {canonicalProfile.visibility === "network" ? "Make private" : "Publish profile"}
              </button>
              <button type="button" className="v2-primary-button" onClick={() => void saveProfile()} disabled={actionState === "saving" || !draft.displayName.trim() || !draft.specialties.length}>
                {actionState === "saving" ? "Saving..." : "Save profile"}
              </button>
            </div>
          </section>
        ) : null}

        {view === "Settings" ? (
          <section className="v2-profile-panel v2-profile-panel-wide v2-profile-sessions">
            <header>
              <span>Security</span>
              <strong>Signed-in devices</strong>
            </header>
            <div className="v2-session-list">
              {sessions.length ? sessions.map((session) => (
                <article key={session.id}>
                  <MonitorSmartphone size={18} />
                  <div><strong>{session.deviceLabel}{session.current ? " · This device" : ""}</strong><span>Last active {new Date(session.lastSeenAt).toLocaleString()}</span></div>
                  {!session.current ? <button type="button" className="v2-secondary-button" onClick={() => void runAccountAction(() => onRevokeSession(session.id))}>Sign out</button> : null}
                </article>
              )) : <p className="v2-profile-note">No active device sessions were returned.</p>}
            </div>
            {sessions.some((session) => !session.current) ? (
              <button type="button" className="v2-secondary-button v2-revoke-others" onClick={() => void runAccountAction(onRevokeOtherSessions)}>Sign out other devices</button>
            ) : null}
            {actionMessage ? <p className={`v2-profile-action-message is-${actionState}`} role="status">{actionMessage}</p> : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}
