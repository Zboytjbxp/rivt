import { useEffect, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  HardHat,
  Home,
  Inbox,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import type { AppShellProps, PrimaryDestination } from "./types";
import "./tokens.css";
import "./app-shell.css";

const primaryNavigation: Array<{
  destination: PrimaryDestination;
  label: string;
  icon: typeof Home;
}> = [
  { destination: "home", label: "Home", icon: Home },
  { destination: "work", label: "Work", icon: BriefcaseBusiness },
  { destination: "network", label: "Network", icon: Users },
  { destination: "inbox", label: "Inbox", icon: Inbox },
  { destination: "tools", label: "Tools", icon: Wrench },
];

function InitialAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "R";
  return <span className="v2-avatar" aria-hidden="true">{initial}</span>;
}

export function AppShell({
  activeDestination,
  role,
  profile,
  activeJob,
  notificationCount,
  isGuest,
  children,
  guestBanner,
  onNavigate,
  onOpenAccount,
  onOpenNotifications,
  onOpenActiveJob,
  onSearch,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    function handleCommandSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }

    window.addEventListener("keydown", handleCommandSearch);
    return () => window.removeEventListener("keydown", handleCommandSearch);
  }, []);

  function submitSearch() {
    const normalized = searchValue.trim();
    if (!normalized) return;
    onSearch(normalized);
    setSearchOpen(false);
  }

  return (
    <div className="rivt-v2">
      <a className="v2-skip-link" href="#main-content">Skip to main content</a>

      <aside className="v2-sidebar" aria-label="Primary navigation">
        <button className="v2-brand" type="button" onClick={() => onNavigate("home")} aria-label="RIVT home">
          <img src="/brand/rivt-lockup-dark-transparent.png" alt="RIVT" />
        </button>

        <nav className="v2-primary-nav">
          {primaryNavigation.map(({ destination, label, icon: Icon }) => (
            <button
              key={destination}
              type="button"
              className={activeDestination === destination ? "is-active" : ""}
              aria-current={activeDestination === destination ? "page" : undefined}
              onClick={() => onNavigate(destination)}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {activeJob && activeDestination !== "work" && activeDestination !== "home" ? (
          <button className="v2-job-context" type="button" onClick={onOpenActiveJob}>
            <span className="v2-job-context-icon"><HardHat size={17} /></span>
            <span className="v2-job-context-copy">
              <small>Active job</small>
              <strong>{activeJob.title}</strong>
              <span>{activeJob.location}</span>
            </span>
            <span className="v2-job-status">{activeJob.status}</span>
          </button>
        ) : null}

        <button className="v2-sidebar-profile" type="button" onClick={onOpenAccount}>
          <InitialAvatar name={profile.name} />
          <span>
            <strong>{profile.name || "RIVT member"}</strong>
            <small>{role === "contractor" ? "Contractor" : "Tradesperson"}</small>
          </span>
          <ChevronDown size={16} />
        </button>
      </aside>

      <div className="v2-workspace">
        <header className="v2-topbar">
          <button className="v2-mobile-brand" type="button" onClick={() => onNavigate("home")} aria-label="RIVT home">
            <img src="/brand/rivt-lockup-light-transparent.png" alt="RIVT" />
          </button>

          <form
            className={searchOpen ? "v2-search is-open" : "v2-search"}
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <Search size={17} />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search jobs, people, or tools"
              aria-label="Search jobs, people, or tools"
            />
            <kbd>Ctrl K</kbd>
          </form>

          <div className="v2-topbar-actions">
            <button type="button" className="v2-icon-button v2-mobile-search" aria-label="Search" onClick={() => setSearchOpen(true)}>
              <Search size={19} />
            </button>
            <button type="button" className="v2-icon-button" aria-label="Notifications" onClick={onOpenNotifications}>
              <Bell size={19} />
              {notificationCount > 0 ? <span>{Math.min(notificationCount, 9)}</span> : null}
            </button>
            <button type="button" className="v2-account-button" onClick={onOpenAccount}>
              <InitialAvatar name={profile.name} />
              <span className="v2-account-copy">
                <strong>{profile.name || "RIVT member"}</strong>
                <small>{profile.location}</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        {searchOpen ? (
          <div className="v2-search-scrim" role="presentation" onClick={() => setSearchOpen(false)}>
            <div className="v2-search-panel" role="dialog" aria-label="Search RIVT" onClick={(event) => event.stopPropagation()}>
              <Search size={19} />
              <input
                autoFocus
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch();
                  if (event.key === "Escape") setSearchOpen(false);
                }}
                placeholder="Search jobs, people, messages, and tools"
              />
              <button type="button" onClick={() => setSearchOpen(false)}>Cancel</button>
            </div>
          </div>
        ) : null}

        {isGuest ? guestBanner : null}

        <main id="main-content" className="v2-main">
          {children}
        </main>
      </div>

      <nav className="v2-mobile-nav" aria-label="Primary navigation">
        {primaryNavigation.map(({ destination, label, icon: Icon }) => (
          <button
            key={destination}
            type="button"
            className={activeDestination === destination ? "is-active" : ""}
            aria-current={activeDestination === destination ? "page" : undefined}
            onClick={() => onNavigate(destination)}
          >
            <Icon size={19} strokeWidth={1.9} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
