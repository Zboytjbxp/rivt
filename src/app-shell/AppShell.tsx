import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  HardHat,
  Home,
  MessageCircle,
  Search,
  Users,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import type { AppShellProps, PrimaryDestination, SearchTarget } from "./types";
import { Avatar } from "../components/ui";
import { apiPath } from "../lib/api";
import { useNetworkStatus } from "./useNetworkStatus";
import "./tokens.css";
import "./app-shell.css";

interface ProfileSearchResult {
  accountId: string;
  displayName: string;
  headline: string;
  locationText: string;
  primaryRole: "contractor" | "tradesperson";
  availabilityStatus: "available" | "limited" | "unavailable";
  trades: Array<{ code: string; name: string; primary: boolean }>;
}

const primaryNavigation: Array<{
  destination: PrimaryDestination;
  label: string;
  icon: typeof Home;
}> = [
  { destination: "home", label: "Home", icon: Home },
  { destination: "work", label: "Work", icon: BriefcaseBusiness },
  { destination: "crew", label: "Crew", icon: Users },
  { destination: "shop-talk", label: "Shop Talk", icon: MessageCircle },
  { destination: "tools", label: "Tools", icon: Wrench },
];

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
  onOpenMessages,
  onOpenNotifications,
  onOpenActiveJob,
  onSearch,
}: AppShellProps) {
  const isOnline = useNetworkStatus();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [peopleResults, setPeopleResults] = useState<ProfileSearchResult[]>([]);
  const [peopleStatus, setPeopleStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [peopleError, setPeopleError] = useState("");
  const peopleSearchRequestRef = useRef(0);

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

  async function fetchPeopleResults(nextValue: string) {
    const normalized = nextValue.trim();
    const requestId = peopleSearchRequestRef.current + 1;
    peopleSearchRequestRef.current = requestId;

    if (isGuest || normalized.length < 2) {
      setPeopleResults([]);
      setPeopleStatus("idle");
      setPeopleError("");
      return;
    }

    setPeopleStatus("loading");
    setPeopleError("");

    try {
      const response = await fetch(apiPath(`/api/v1/profiles?q=${encodeURIComponent(normalized)}&limit=4`), {
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error?.message || "Profile search is unavailable.");
      }
      if (peopleSearchRequestRef.current !== requestId) return;
      setPeopleResults(Array.isArray(body.data?.profiles) ? body.data.profiles : []);
      setPeopleStatus("ready");
    } catch (error) {
      if (peopleSearchRequestRef.current !== requestId) return;
      setPeopleResults([]);
      setPeopleStatus("error");
      setPeopleError(error instanceof Error ? error.message : "Profile search is unavailable.");
    }
  }

  function openSearch() {
    setSearchOpen(true);
    void fetchPeopleResults(searchValue);
  }

  function handleSearchValueChange(nextValue: string) {
    setSearchValue(nextValue);
    void fetchPeopleResults(nextValue);
  }

  function submitSearch(target: SearchTarget = "work") {
    const normalized = searchValue.trim();
    if (!normalized) return;
    onSearch(normalized, target);
    setSearchOpen(false);
  }

  function openProfileResult() {
    onNavigate("crew");
    setSearchOpen(false);
  }

  const normalizedSearch = searchValue.trim();
  const canSubmitSearch = normalizedSearch.length > 0;
  const canSearchPeople = normalizedSearch.length >= 2 && !isGuest;

  return (
    <div className="rivt-v2">
      <a className="v2-skip-link" href="#main-content">Skip to main content</a>

      <aside className="v2-sidebar" aria-label="Primary navigation">
        <button className="v2-brand" type="button" onClick={() => onNavigate("home")} aria-label="RIVT home">
          <img src="/brand/rivt-lockup-light-transparent.png" alt="RIVT" />
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

        {activeJob ? (
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

        <button
          className="v2-sidebar-profile"
          type="button"
          onClick={onOpenAccount}
          aria-label={`Open profile menu for ${profile.name || "RIVT member"}`}
        >
          <Avatar name={profile.name} size="sm" className="v2-avatar" />
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
              submitSearch("work");
            }}
          >
            <Search size={17} />
            <input
              value={searchValue}
              onChange={(event) => handleSearchValueChange(event.target.value)}
              onFocus={openSearch}
              placeholder="Search jobs, answers, crews"
              aria-label="Search jobs, answers, crews"
            />
            <kbd>Ctrl K</kbd>
          </form>

          <div className="v2-topbar-actions">
            <button type="button" className="v2-icon-button v2-mobile-search" aria-label="Search" onClick={openSearch}>
              <Search size={19} />
            </button>
            <button type="button" className="v2-icon-button" aria-label="Messages" onClick={onOpenMessages}>
              <MessageCircle size={19} />
            </button>
            <button type="button" className="v2-icon-button" aria-label="Notifications" onClick={onOpenNotifications}>
              <Bell size={19} />
              {notificationCount > 0 ? <span>{notificationCount > 9 ? "9+" : notificationCount}</span> : null}
            </button>
            <button
              type="button"
              className="v2-account-button"
              onClick={onOpenAccount}
              aria-label={`Open profile menu for ${profile.name || "RIVT member"}`}
            >
              <Avatar name={profile.name} size="sm" className="v2-avatar" />
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
              <button type="button" className="v2-modal-close v2-icon-button" onClick={() => setSearchOpen(false)} aria-label="Close search">
                <X size={18} />
              </button>
              <div className="v2-search-panel-inner">
                <label className="v2-search-panel-input">
                  <Search size={19} />
                  <input
                    autoFocus
                    value={searchValue}
                    onChange={(event) => handleSearchValueChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submitSearch("work");
                      if (event.key === "Escape") setSearchOpen(false);
                    }}
                    placeholder="Search jobs, questions, trades, or tools"
                    aria-label="Search jobs, questions, trades, or tools"
                  />
                </label>

                {normalizedSearch.length === 1 ? (
                  <p className="v2-search-note">Keep typing to search…</p>
                ) : null}
                {canSearchPeople ? (
                  <section className="v2-search-people-results" aria-label="People results">
                    <header>
                      <span>People</span>
                      <small>Public profiles only</small>
                    </header>
                    {peopleStatus === "loading" ? (
                      <div className="v2-search-result-state">Searching profiles...</div>
                    ) : peopleStatus === "error" ? (
                      <div className="v2-search-result-state is-error">{peopleError}</div>
                    ) : peopleResults.length ? (
                      peopleResults.map((person) => (
                        <button key={person.accountId} type="button" className="v2-search-person-result" onClick={openProfileResult}>
                          <Avatar name={person.displayName} size="sm" className="v2-avatar" />
                          <span>
                            <strong>{person.displayName}</strong>
                            <small>{person.headline || (person.primaryRole === "contractor" ? "Contractor" : "Tradesperson")}</small>
                            <small>{[person.trades.map((trade) => trade.name).join(", "), person.locationText].filter(Boolean).join(" · ")}</small>
                          </span>
                          <em>{person.availabilityStatus === "available" ? "Available" : person.availabilityStatus === "limited" ? "Limited" : "Unavailable"}</em>
                        </button>
                      ))
                    ) : peopleStatus === "ready" ? (
                      <div className="v2-search-result-state">No network profiles found for "{normalizedSearch}".</div>
                    ) : null}
                  </section>
                ) : null}

                <div className="v2-search-command-list" aria-label="Search destinations">
                  <button type="button" onClick={() => submitSearch("work")} disabled={!canSubmitSearch}>
                    <BriefcaseBusiness size={18} />
                    <span>
                      <strong>Search work</strong>
                      <small>Jobs, trades, locations, scopes</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => submitSearch("shop-talk")} disabled={!canSubmitSearch}>
                    <MessageCircle size={18} />
                    <span>
                      <strong>Search Trade Talk</strong>
                      <small>Questions, fixes, trade news</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => {
                    onSearch(normalizedSearch || "tools", "tools");
                    setSearchOpen(false);
                  }}>
                    <Wrench size={18} />
                    <span>
                      <strong>Open Tools</strong>
                      <small>Calculator, estimate, invoice, records</small>
                    </span>
                  </button>
                </div>

                <p className="v2-search-note">
                  Only public profiles are shown. Contact details are shared only when both parties are on an active job.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {isGuest ? guestBanner : null}

        {!isOnline && (
          <div className="v2-offline-banner" role="alert" aria-live="polite">
            <WifiOff size={15} />
            <span>No internet connection — some features may be unavailable</span>
          </div>
        )}

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
