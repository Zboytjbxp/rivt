import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Flag,
  FolderOpen,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  X,
} from "lucide-react";
import { brandConfig, type ThemeMode, type ThemePalette, type TrialPlan } from "../brandConfig";
import { ProfileShowcase } from "../features/profile/ProfileShowcase";
import { ProgressBar, ThemeToggle, type AuthMethod } from "../features/auth/AuthScreens";
import type { ThemeSource } from "./useAppTheme";
import { useFocusTrap } from "./useFocusTrap";
import type { Role, Trade } from "../types";
import type { NavLabel } from "./routes";

export interface ActivityItemForPanel {
  id: number | string;
  title: string;
  detail: string;
  timestamp: string;
  unread: boolean;
  actionLabel?: string;
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
  onOpenItem,
}: {
  items: ActivityItemForPanel[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onNavigate: (view: NavLabel) => void;
  onOpenItem?: (item: ActivityItemForPanel) => void;
}) {
  const trapRef = useFocusTrap<HTMLElement>(onClose);
  return (
    <div className="panel-backdrop rivt-v2" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={trapRef} className="side-panel" role="dialog" aria-modal="true" aria-label="Notifications">
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
          ) : items.map((item) => {
            const className = item.unread ? "activity-item unread" : "activity-item";
            const content = (
              <>
                <span>{item.timestamp}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                {item.actionLabel ? (
                  <em>
                    {item.actionLabel}
                    <ChevronRight size={13} />
                  </em>
                ) : null}
              </>
            );
            return item.actionLabel && onOpenItem ? (
              <button
                key={item.id}
                type="button"
                className={`${className} is-actionable`}
                onClick={() => onOpenItem(item)}
                aria-label={`${item.actionLabel}: ${item.title}`}
              >
                {content}
              </button>
            ) : (
              <article key={item.id} className={className}>
                {content}
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export function AccountPanel({
  role,
  profile,
  recordCount,
  recordGoal,
  trainingProgress,
  safetyCertCount,
  safetyModuleCount,
  themeMode,
  themeSource,
  themePalette,
  adminRoles,
  communityBadges,
  shoutOutCount,
  onToggleTheme,
  onSetThemeSource,
  onSelectThemePalette,
  onLogout,
  onClose,
  onNavigate,
}: {
  role: Role;
  profile: AccountProfileForPanel;
  recordCount: number;
  recordGoal: number;
  trainingProgress: number;
  safetyCertCount: number;
  safetyModuleCount: number;
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  themePalette: ThemePalette;
  adminRoles: string[];
  communityBadges: string[];
  shoutOutCount: number;
  onToggleTheme: () => void;
  onSetThemeSource: (source: ThemeSource) => void;
  onSelectThemePalette: (palette: ThemePalette) => void;
  onLogout: () => void;
  onClose: () => void;
  onNavigate: (view: NavLabel) => void;
}) {
  const trapRef = useFocusTrap<HTMLElement>(onClose);
  return (
    <div className="panel-backdrop rivt-v2" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={trapRef} className="side-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="side-panel-header">
          <div>
            <span>{role === "contractor" ? "Contractor account" : "Tradesperson account"}</span>
            <h2>Profile</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close profile">
            <X size={18} />
          </button>
        </div>

        <ProfileShowcase
          name={profile.displayName || profile.organization || "RIVT member"}
          trade={profile.specialties[0] ?? (role === "contractor" ? "Contractor" : "Tradesperson")}
          location={profile.location}
          shoutOutCount={shoutOutCount}
          safetyCertCount={safetyCertCount}
          onEditProfile={() => onNavigate("Settings")}
          onNavigate={onNavigate}
        />

        <section className="account-standing">
          <div className="account-standing-row">
            <span>Records</span>
            <strong>{recordCount}/{recordGoal}</strong>
          </div>
          <div className="account-standing-row">
            <span>Safety certs</span>
            <strong>{safetyCertCount}/{safetyModuleCount}</strong>
          </div>
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
              themeSource={themeSource}
              onToggleTheme={onToggleTheme}
              onSetThemeSource={onSetThemeSource}
              variant="surface"
            />
          </div>

          <ThemePalettePicker
            selectedPalette={themePalette}
            onSelectPalette={onSelectThemePalette}
          />
        </section>

        <div className="quick-actions">
          {adminRoles.length ? (
            <button type="button" onClick={() => onNavigate("Admin")}>
              <Flag size={15} />
              Admin
            </button>
          ) : null}
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

