import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  HardHat,
  X,
} from "lucide-react";
import type { AppShellProps, PrimaryDestination, ProfileSearchResult, SearchTarget, ShellSearchItem } from "./types";
import { Avatar, DialogBackdrop, DialogSurface } from "../components/ui";
import { apiPath, fetchWithTimeout } from "../lib/api";
import {
  CameraDestinationIcon,
  HomeDestinationIcon,
  MessagesCommandIcon,
  NotificationsCommandIcon,
  SearchCommandIcon,
  ShopTalkDestinationIcon,
  ToolsDestinationIcon,
  WorkDestinationIcon,
  type AppIconProps,
} from "./app-icons";
import type { ComponentType } from "react";
import "./tokens.css";
import "./app-shell.css";

const primaryNavigation: Array<{
  destination: PrimaryDestination;
  label: string;
  icon: ComponentType<AppIconProps>;
}> = [
  { destination: "home", label: "Home", icon: HomeDestinationIcon },
  { destination: "work", label: "Work", icon: WorkDestinationIcon },
  { destination: "camera", label: "Camera", icon: CameraDestinationIcon },
  { destination: "shop-talk", label: "Shop Talk", icon: ShopTalkDestinationIcon },
  { destination: "tools", label: "Tools", icon: ToolsDestinationIcon },
];
const SEARCH_RECENTS_KEY = "rivt.search.recent.v1";
const searchableTools: Array<ShellSearchItem & { keywords: string }> = [
  { id: "calculator", title: "Field calculator", subtitle: "Tape fractions, metric, and saved measurements", keywords: "calculator tape measure fractions math metric" },
  { id: "job-photos", title: "Camera", subtitle: "Job photos, private albums, and field proof", keywords: "camera photos album proof" },
  { id: "estimate", title: "Estimate builder", subtitle: "Scope, labor, materials, and customer review", keywords: "estimate bid quote pricing" },
  { id: "invoice", title: "Invoice", subtitle: "Drafts, receivables, and payment records", keywords: "invoice billing receivables payment" },
  { id: "expense-logger", title: "Expense logger", subtitle: "Costs, receipt records, and CSV export", keywords: "expense receipt cost csv" },
  { id: "daily-log", title: "Daily log", subtitle: "Progress, blockers, safety, and crew notes", keywords: "daily log report jobsite notes" },
];

type RecentSearch = { query: string; target: SearchTarget };

function readRecentSearches(): RecentSearch[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_RECENTS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RecentSearch => (
      Boolean(item)
      && typeof item.query === "string"
      && ["work", "shop-talk", "tools"].includes(String(item.target))
    )).slice(0, 5);
  } catch {
    return [];
  }
}

export function AppShell({
  activeDestination,
  role,
  profile,
  activeJob,
  searchJobs = [],
  searchPosts = [],
  notificationCount,
  messageCount = 0,
  isGuest,
  mobileNavHidden = false,
  children,
  guestBanner,
  onNavigate,
  onOpenAccount,
  onOpenMessages,
  onOpenNotifications,
  onOpenActiveJob,
  onSearch,
  onOpenProfileResult,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [peopleResults, setPeopleResults] = useState<ProfileSearchResult[]>([]);
  const [peopleStatus, setPeopleStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [peopleError, setPeopleError] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(readRecentSearches);
  const peopleSearchRequestRef = useRef(0);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeDestination]);

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
      const response = await fetchWithTimeout(apiPath(`/api/v1/profiles?q=${encodeURIComponent(normalized)}&limit=4`), {
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
    rememberSearch(normalized, target);
    onSearch(normalized, target);
    setSearchOpen(false);
  }

  function rememberSearch(query: string, target: SearchTarget) {
    const next = [
      { query, target },
      ...recentSearches.filter((item) => item.query.toLowerCase() !== query.toLowerCase() || item.target !== target),
    ].slice(0, 5);
    setRecentSearches(next);
    try {
      localStorage.setItem(SEARCH_RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Recent searches stay in memory when device storage is unavailable.
    }
  }

  function openLocalResult(item: ShellSearchItem, target: SearchTarget) {
    const query = target === "tools" ? item.id : item.title;
    rememberSearch(query, target);
    onSearch(query, target);
    setSearchOpen(false);
  }

  function openProfileResult(person: ProfileSearchResult) {
    if (onOpenProfileResult) {
      onOpenProfileResult(person);
    } else {
      onNavigate("work");
    }
    setSearchOpen(false);
  }

  const normalizedSearch = searchValue.trim();
  const canSubmitSearch = normalizedSearch.length > 0;
  const canSearchPeople = normalizedSearch.length >= 2 && !isGuest;
  const normalizedSearchLower = normalizedSearch.toLowerCase();
  const localJobResults = normalizedSearch.length >= 2
    ? searchJobs.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalizedSearchLower)).slice(0, 3)
    : [];
  const localPostResults = normalizedSearch.length >= 2
    ? searchPosts.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalizedSearchLower)).slice(0, 3)
    : [];
  const localToolResults = normalizedSearch.length >= 2
    ? searchableTools.filter((item) => `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase().includes(normalizedSearchLower)).slice(0, 3)
    : [];

  function profileRateSummary(person: ProfileSearchResult) {
    const rate = person.rateCards?.[0];
    if (!rate) return "";
    if (rate.hourlyRateCents) return `${rate.tradeName}: $${(rate.hourlyRateCents / 100).toLocaleString()}/hr`;
    if (rate.dayRateCents) return `${rate.tradeName}: $${(rate.dayRateCents / 100).toLocaleString()}/day`;
    if (rate.minimumChargeCents) return `${rate.tradeName}: $${(rate.minimumChargeCents / 100).toLocaleString()} minimum`;
    return "";
  }

  return (
    <div className={mobileNavHidden ? "rivt-v2 is-mobile-nav-hidden" : "rivt-v2"}>
      <a className="v2-skip-link" href="#main-content">Skip to main content</a>

      <aside className="v2-sidebar" aria-label="Primary navigation">
        <button className="v2-brand" type="button" onClick={() => onNavigate("home")} aria-label="RIVT home">
          <span className="v2-brand-mark" aria-hidden="true" />
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
              <Icon active={activeDestination === destination} aria-hidden="true" />
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
            <span className="v2-mobile-brand-mark" aria-hidden="true" />
          </button>

          <form
            className={searchOpen ? "v2-search is-open" : "v2-search"}
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch("work");
            }}
          >
            <SearchCommandIcon size={18} aria-hidden="true" />
            <input
              value={searchValue}
              onChange={(event) => handleSearchValueChange(event.target.value)}
              onFocus={openSearch}
              placeholder="Search jobs, answers, people"
              aria-label="Search jobs, answers, people"
            />
            <kbd>Ctrl K</kbd>
          </form>

          <div className="v2-topbar-actions">
            <button type="button" className="v2-icon-button v2-mobile-search" aria-label="Search" title="Search" onClick={openSearch}>
              <SearchCommandIcon aria-hidden="true" />
            </button>
            <button type="button" className="v2-icon-button" aria-label="Messages" title="Messages" onClick={onOpenMessages}>
              <MessagesCommandIcon aria-hidden="true" />
              {messageCount > 0 ? <span>{messageCount > 9 ? "9+" : messageCount}</span> : null}
            </button>
            <button type="button" className="v2-icon-button" aria-label="Notifications" title="Notifications" onClick={onOpenNotifications}>
              <NotificationsCommandIcon aria-hidden="true" />
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
          <DialogBackdrop className="v2-search-scrim" onClose={() => setSearchOpen(false)}>
            <DialogSurface className="v2-search-panel" label="Search RIVT" onClose={() => setSearchOpen(false)}>
              <button type="button" className="v2-modal-close v2-icon-button" onClick={() => setSearchOpen(false)} aria-label="Close search" title="Close search">
                <X size={18} />
              </button>
              <div className="v2-search-panel-inner">
                <label className="v2-search-panel-input">
                  <SearchCommandIcon aria-hidden="true" />
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
                {!normalizedSearch && recentSearches.length ? (
                  <section className="v2-search-result-group" aria-label="Recent searches">
                    <header><span>Recent on this device</span><small>Private to this browser</small></header>
                    {recentSearches.map((item) => (
                      <button
                        key={`${item.target}-${item.query}`}
                        type="button"
                        className="v2-search-local-result"
                        onClick={() => {
                          onSearch(item.query, item.target);
                          setSearchOpen(false);
                        }}
                      >
                        <SearchCommandIcon size={18} aria-hidden="true" />
                        <span>
                          <strong>{item.query}</strong>
                          <small>{item.target === "shop-talk" ? "Shop Talk" : item.target === "tools" ? "Tools" : "Work"}</small>
                        </span>
                      </button>
                    ))}
                  </section>
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
                        <button key={person.accountId} type="button" className="v2-search-person-result" onClick={() => openProfileResult(person)}>
                          <Avatar name={person.displayName} size="sm" className="v2-avatar" />
                          <span>
                            <strong>{person.displayName}</strong>
                            <small>{person.headline || (person.primaryRole === "contractor" ? "Contractor" : "Tradesperson")}</small>
                            <small>{[person.trades.map((trade) => trade.name).join(", "), person.locationText].filter(Boolean).join(" · ")}</small>
                            {profileRateSummary(person) ? <small className="v2-search-person-rate">{profileRateSummary(person)}</small> : null}
                          </span>
                          <em>{person.availabilityStatus === "available" ? "Available" : person.availabilityStatus === "limited" ? "Limited" : "Unavailable"}</em>
                        </button>
                      ))
                    ) : peopleStatus === "ready" ? (
                      <div className="v2-search-result-state">No network profiles found for "{normalizedSearch}".</div>
                    ) : null}
                  </section>
                ) : null}

                {localJobResults.length ? (
                  <section className="v2-search-result-group" aria-label="Work results">
                    <header><span>Work</span><small>Jobs in your current work list</small></header>
                    {localJobResults.map((item) => (
                      <button key={item.id} type="button" className="v2-search-local-result" onClick={() => openLocalResult(item, "work")}>
                        <WorkDestinationIcon aria-hidden="true" />
                        <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                      </button>
                    ))}
                  </section>
                ) : null}
                {localPostResults.length ? (
                  <section className="v2-search-result-group" aria-label="Shop Talk results">
                    <header><span>Shop Talk</span><small>Questions and discussions</small></header>
                    {localPostResults.map((item) => (
                      <button key={item.id} type="button" className="v2-search-local-result" onClick={() => openLocalResult(item, "shop-talk")}>
                        <ShopTalkDestinationIcon aria-hidden="true" />
                        <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                      </button>
                    ))}
                  </section>
                ) : null}
                {localToolResults.length ? (
                  <section className="v2-search-result-group" aria-label="Tool results">
                    <header><span>Tools</span><small>Open the tool directly</small></header>
                    {localToolResults.map((item) => (
                      <button key={item.id} type="button" className="v2-search-local-result" onClick={() => openLocalResult(item, "tools")}>
                        <ToolsDestinationIcon aria-hidden="true" />
                        <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                      </button>
                    ))}
                  </section>
                ) : null}

                <div className="v2-search-command-list" aria-label="Search destinations">
                  <button type="button" onClick={() => submitSearch("work")} disabled={!canSubmitSearch}>
                    <WorkDestinationIcon aria-hidden="true" />
                    <span>
                      <strong>Search work</strong>
                      <small>Jobs, trades, locations, scopes</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => submitSearch("shop-talk")} disabled={!canSubmitSearch}>
                    <ShopTalkDestinationIcon aria-hidden="true" />
                    <span>
                      <strong>Search Shop Talk</strong>
                      <small>Questions, fixes, trade news</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => {
                    const query = normalizedSearch || "tools";
                    rememberSearch(query, "tools");
                    onSearch(query, "tools");
                    setSearchOpen(false);
                  }}>
                    <ToolsDestinationIcon aria-hidden="true" />
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
            </DialogSurface>
          </DialogBackdrop>
        ) : null}

        {isGuest ? guestBanner : null}

        <main id="main-content" className="v2-main" data-destination={activeDestination}>
          {children}
        </main>
      </div>

      <nav className={mobileNavHidden ? "v2-mobile-nav is-hidden" : "v2-mobile-nav"} aria-label="Primary navigation" aria-hidden={mobileNavHidden ? "true" : undefined}>
          {primaryNavigation.map(({ destination, label, icon: Icon }) => (
          <button
            key={destination}
            type="button"
              className={activeDestination === destination ? "is-active" : ""}
            aria-current={activeDestination === destination ? "page" : undefined}
            onClick={() => onNavigate(destination)}
            tabIndex={mobileNavHidden ? -1 : undefined}
          >
            <Icon active={activeDestination === destination} size={23} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
