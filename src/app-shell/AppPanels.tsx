import {
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CreditCard,
  Flag,
  FolderOpen,
  GraduationCap,
  LogOut,
  Mail,
  MessageSquareText,
  ShieldCheck,
  ThumbsUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { brandConfig, type ThemeMode, type ThemePalette, type TrialPlan } from "../brandConfig";
import { ProgressBar, ThemeToggle, type AuthMethod } from "../features/auth/AuthScreens";
import type { Role, Trade } from "../types";
import type { NavLabel } from "./routes";

export interface ActivityItemForPanel {
  id: number | string;
  title: string;
  detail: string;
  timestamp: string;
  unread: boolean;
  kind?: "info" | "success" | "warning" | "error";
}

export interface AppToastForPanel {
  id: number;
  title: string;
  detail: string;
  kind: "info" | "success" | "warning" | "error";
  timestamp: string;
}

interface AccountProfileForPanel {
  email: string;
  displayName: string;
  organization: string;
  location: string;
  specialties: Trade[];
  plan: TrialPlan;
  authMethod: AuthMethod;
}

const themePaletteOptions = Object.entries(brandConfig.theme.palettes) as Array<
  [ThemePalette, (typeof brandConfig.theme.palettes)[ThemePalette]]
>;

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "TC";
}

function avatarTone(name: string) {
  const palette = ["stone", "slate", "graphite", "smoke", "ember", "steel"];
  const seed = name
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function Avatar({
  name,
  photoSrc,
  size = "md",
  className = "",
}: {
  name: string;
  photoSrc?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = getInitials(name);
  return (
    <div className={`avatar avatar-${size} avatar-${avatarTone(name)} ${className}`.trim()}>
      {photoSrc ? <img src={photoSrc} alt={name} /> : <span>{initials}</span>}
    </div>
  );
}

export function ActivityToast({
  activity,
  onDismiss,
}: {
  activity: AppToastForPanel | ActivityItemForPanel;
  onDismiss: () => void;
}) {
  const kind = activity.kind ?? "info";
  return (
    <aside className={`activity-toast ${kind}`} role="status" aria-live="polite">
      {kind === "success" ? <BadgeCheck size={18} /> : kind === "warning" ? <Flag size={18} /> : kind === "error" ? <X size={18} /> : <ShieldCheck size={18} />}
      <div>
        <strong>{activity.title}</strong>
        <span>{activity.detail}</span>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss update">
        <X size={15} />
      </button>
    </aside>
  );
}

export function ActivityPanel({
  items,
  onClose,
  onMarkAllRead,
  onNavigate,
}: {
  items: ActivityItemForPanel[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onNavigate: (view: NavLabel) => void;
}) {
  return (
    <div className="panel-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel" role="dialog" aria-modal="true" aria-label="Notifications">
        <div className="side-panel-header">
          <div>
            <span>Recent activity</span>
            <h2>Notifications</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close notifications">
            <X size={18} />
          </button>
        </div>

        <div className="quick-actions">
          <button type="button" onClick={onMarkAllRead}>
            <BadgeCheck size={15} />
            Mark read
          </button>
          <button type="button" onClick={() => onNavigate("Messages")}>
            <MessageSquareText size={15} />
            Messages
          </button>
          <button type="button" onClick={() => onNavigate("Records")}>
            <FolderOpen size={15} />
            Records
          </button>
        </div>

        <div className="activity-list">
          {items.length === 0 ? (
            <article className="empty-panel-state">
              <Bell size={20} />
              <strong>No activity yet</strong>
              <span>Use any feature in the app and activity will appear here.</span>
            </article>
          ) : items.map((item) => (
            <article key={item.id} className={item.unread ? "activity-item unread" : "activity-item"}>
              <span>{item.timestamp}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function AccountPanel({
  role,
  profile,
  trustReady,
  recordCount,
  recordGoal,
  trainingProgress,
  safetyCertCount,
  safetyModuleCount,
  themeMode,
  themePalette,
  communityBadges,
  shoutOutCount,
  onToggleTheme,
  onSelectThemePalette,
  onLogout,
  onClose,
  onNavigate,
}: {
  role: Role;
  profile: AccountProfileForPanel;
  trustReady: boolean;
  recordCount: number;
  recordGoal: number;
  trainingProgress: number;
  safetyCertCount: number;
  safetyModuleCount: number;
  themeMode: ThemeMode;
  themePalette: ThemePalette;
  communityBadges: string[];
  shoutOutCount: number;
  onToggleTheme: () => void;
  onSelectThemePalette: (palette: ThemePalette) => void;
  onLogout: () => void;
  onClose: () => void;
  onNavigate: (view: NavLabel) => void;
}) {
  return (
    <div className="panel-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="side-panel-header">
          <div>
            <span>{role === "contractor" ? "Contractor account" : "Tradesperson account"}</span>
            <h2>Account</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close account">
            <X size={18} />
          </button>
        </div>

        <div className="account-profile-card">
          <Avatar name={profile.displayName} size="lg" className="user-avatar" />
          <div>
            <strong>{profile.displayName || profile.organization || "RIVT member"}</strong>
            {profile.organization && profile.organization !== profile.displayName && (
              <span className="account-org-name">{profile.organization}</span>
            )}
            <span>{profile.location}</span>
            {profile.specialties.length > 0 && (
              <div className="account-chip-row account-specialty-chips">
                {profile.specialties.map((specialty) => (
                  <strong key={specialty}>{specialty}</strong>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="account-stat-grid">
          <InfoItem icon={Mail} label="Email" value={profile.email} />
          <InfoItem icon={CreditCard} label="Plan" value={profile.plan} />
          <InfoItem icon={ShieldCheck} label="Trust" value={trustReady ? "Ready" : "Pending"} />
          <InfoItem icon={FolderOpen} label="Records" value={`${recordCount}/${recordGoal}`} />
          <InfoItem icon={GraduationCap} label="Safety" value={`${safetyCertCount}/${safetyModuleCount}`} />
          <InfoItem icon={ThumbsUp} label="Shout-outs" value={`${shoutOutCount}`} />
        </div>

        <section className="account-standing">
          <div className="account-standing-row">
            <span>Training</span>
            <ProgressBar value={trainingProgress} />
          </div>
          <div className="account-standing-row">
            <span>Community</span>
            <div className="account-chip-row">
              {communityBadges.length
                ? communityBadges.map((badge) => <strong key={badge}>{badge}</strong>)
                : <strong>New contributor</strong>}
            </div>
          </div>
        </section>

        <section className="account-section theme-settings-section">
          <div className="settings-section-heading">
            <span>Themes</span>
            <strong>Tool-inspired appearance</strong>
            <small>Choose a jobsite palette. Names are inspired, not official brand skins.</small>
          </div>

          <div className="theme-mode-row">
            <span>Mode</span>
            <ThemeToggle
              themeMode={themeMode}
              onToggleTheme={onToggleTheme}
              variant="surface"
            />
          </div>

          <ThemePalettePicker
            selectedPalette={themePalette}
            onSelectPalette={onSelectThemePalette}
          />
        </section>

        <div className="quick-actions">
          <button type="button" onClick={() => onNavigate("Settings")}>
            <ShieldCheck size={15} />
            Settings
          </button>
          <button type="button" className="account-signout-btn" onClick={onLogout}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}

function ThemePalettePicker({
  selectedPalette,
  onSelectPalette,
}: {
  selectedPalette: ThemePalette;
  onSelectPalette: (palette: ThemePalette) => void;
}) {
  return (
    <div className="theme-palette-grid" aria-label="Theme palettes">
      {themePaletteOptions.map(([paletteId, palette]) => (
        <button
          key={paletteId}
          type="button"
          className={paletteId === selectedPalette ? "palette-option selected" : "palette-option"}
          aria-label={`Use ${palette.label} theme`}
          aria-pressed={paletteId === selectedPalette}
          onClick={() => onSelectPalette(paletteId)}
        >
          <span className="palette-swatch-row" aria-hidden="true">
            {palette.swatches.map((color) => (
              <i key={color} style={{ background: color }} />
            ))}
          </span>
          <span className="palette-copy">
            <strong>{palette.label}</strong>
            <small>{palette.inspiration}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon | typeof BriefcaseBusiness;
  label: string;
  value: string;
}) {
  return (
    <div className="info-item">
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
