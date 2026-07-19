import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Flag,
  FolderOpen,
  LogOut,
  MessageSquareText,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import type { AuthMethod } from "../features/auth/AuthScreens";
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
  adminRoles,
  onOpenProfile,
  onLogout,
  onClose,
  onNavigate,
}: {
  role: Role;
  profile: AccountProfileForPanel;
  adminRoles: string[];
  onOpenProfile: () => void;
  onLogout: () => void;
  onClose: () => void;
  onNavigate: (view: NavLabel) => void;
}) {
  const trapRef = useFocusTrap<HTMLElement>(onClose);
  const displayName = profile.displayName || profile.organization || "RIVT member";
  const accountType = role === "contractor" ? "Contractor" : "Tradesperson";
  const accountDetail = [profile.specialties[0] ?? accountType, profile.location].filter(Boolean).join(" / ");
  return (
    <div className="panel-backdrop rivt-v2" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={trapRef} className="side-panel account-menu-panel" role="dialog" aria-modal="true" aria-label="Account menu">
        <div className="side-panel-header">
          <div>
            <span>{accountType} account</span>
            <h2>Account</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close account menu">
            <X size={18} />
          </button>
        </div>

        <button type="button" className="account-menu-identity" onClick={onOpenProfile}>
          <span className="account-menu-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
          <span className="account-menu-identity-copy">
            <strong>{displayName}</strong>
            <span>{accountDetail}</span>
            <small>{profile.email} / {authMethodLabel(profile.authMethod)}</small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>

        <nav className="account-menu-actions" aria-label="Account destinations">
          <button type="button" onClick={onOpenProfile}>
            <UserRound size={19} />
            <span><strong>Profile</strong><small>Edit your public trade profile</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onNavigate("Settings")}>
            <Settings size={19} />
            <span><strong>Settings</strong><small>Alerts, accessibility, plan, and security</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {adminRoles.length ? (
            <button type="button" onClick={() => onNavigate("Admin")}>
              <Flag size={19} />
              <span><strong>Admin</strong><small>Moderation and support operations</small></span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : null}
        </nav>

        <button type="button" className="account-menu-signout" onClick={onLogout}>
          <LogOut size={18} />
          <span><strong>Sign out</strong><small>Remove this account from this device</small></span>
        </button>
      </aside>
    </div>
  );
}

