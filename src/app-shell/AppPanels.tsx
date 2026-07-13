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
import type { ThemeMode, TrialPlan } from "../brandConfig";
import { ThemeStudio } from "../components/ThemeStudio";
import { ProfileShowcase } from "../features/profile/ProfileShowcase";
import { ProgressBar, type AuthMethod } from "../features/auth/AuthScreens";
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
  kind?: "info" | "success" | "warning" | "error";
  actionLabel?: string;
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

function authMethodLabel(method: AuthMethod) {
  if (method === "Google") return "Google sign-in";
  if (method === "Email") return "Email sign-in";
  return "Pilot access";
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
  onOpenItem,
  onNavigate,
}: {
  items: ActivityItemForPanel[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenItem?: (item: ActivityItemForPanel) => void;
  onNavigate: (view: NavLabel) => void;
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
            const className = [
              "activity-item",
              item.unread ? "unread" : "",
              item.actionLabel ? "is-actionable" : "",
            ].filter(Boolean).join(" ");
            const content = (
              <>
                <span>{item.timestamp}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                {item.actionLabel ? (
                  <small className="activity-item-action">
                    {item.actionLabel}
                    <ChevronRight size={15} aria-hidden="true" />
                  </small>
                ) : null}
              </>
            );
            return item.actionLabel && onOpenItem ? (
              <button
                key={item.id}
                type="button"
                className={className}
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
  adminRoles,
  communityBadges,
  shoutOutCount,
  onSetThemeSource,
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
  adminRoles: string[];
  communityBadges: string[];
  shoutOutCount: number;
  onSetThemeSource: (source: ThemeSource) => void;
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

        <section className="account-section">
          <div className="settings-section-heading">
            <span>This device</span>
            <strong>Signed in here as {profile.displayName || profile.organization || "RIVT member"}</strong>
            <small>{profile.email} • {authMethodLabel(profile.authMethod)}</small>
          </div>
          <p className="account-note">
            Sign out before handing this phone or browser to someone else.
          </p>
        </section>

        <section className="account-section theme-settings-section">
          <ThemeStudio
            variant="compact"
            themeMode={themeMode}
            themeSource={themeSource}
            onSetThemeSource={onSetThemeSource}
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

