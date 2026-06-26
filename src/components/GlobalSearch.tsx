import { useEffect, useRef, useState } from "react";
import { Navigation, Wrench, X } from "lucide-react";
import "./GlobalSearch.css";

export interface SearchableJob {
  id: number;
  title: string;
  trade: string;
  location: string;
  status: string;
}

export interface GlobalSearchProps {
  jobs: SearchableJob[];
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

const TOOLS = [
  "Time tracker",
  "Expense logger",
  "Tax estimator",
  "Punch list",
  "Job photos",
  "Daily log",
  "Bid builder",
  "Mileage tracker",
  "Price book",
  "Safety checklist",
];

const NAV_ITEMS = [
  "Home",
  "Work/Jobs",
  "Crew",
  "Shop Talk",
  "Tools",
  "Messages",
  "Reviews",
  "Settings",
];

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export function GlobalSearch({ jobs, open, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!open) return null;

  const trimmed = query.trim();

  const matchedJobs = trimmed
    ? jobs.filter(
        (job) =>
          matches(job.title, trimmed) ||
          matches(job.trade, trimmed) ||
          matches(job.location, trimmed),
      ).slice(0, 5)
    : [];

  const matchedTools = trimmed
    ? TOOLS.filter((tool) => matches(tool, trimmed))
    : [];

  const matchedNav = trimmed
    ? NAV_ITEMS.filter((item) => matches(item, trimmed))
    : NAV_ITEMS;

  const hasResults =
    matchedJobs.length > 0 || matchedTools.length > 0 || matchedNav.length > 0;

  function handleJobClick(job: SearchableJob) {
    onNavigate("Marketplace");
    onClose();
  }

  function handleToolClick() {
    onNavigate("Tools");
    onClose();
  }

  function handleNavClick(label: string) {
    // Map display labels back to route-compatible labels
    const navMap: Record<string, string> = {
      "Work/Jobs": "Marketplace",
      "Crew": "My Crew",
    };
    onNavigate(navMap[label] ?? label);
    onClose();
  }

  return (
    <div
      className="v2-global-search-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="v2-global-search-card">
        <div className="v2-global-search-header">
          <input
            ref={inputRef}
            className="v2-global-search-input"
            type="search"
            placeholder="Search jobs, tools, pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
          <button
            className="v2-global-search-close"
            type="button"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        <div className="v2-global-search-body">
          {!trimmed ? (
            <div className="v2-global-search-section">
              <p className="v2-global-search-section-label">Quick links</p>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="v2-global-search-row"
                  onClick={() => handleNavClick(item)}
                >
                  <span className="v2-global-search-row-icon">
                    <Navigation size={14} aria-hidden="true" />
                  </span>
                  <span className="v2-global-search-row-content">
                    <span className="v2-global-search-row-title">{item}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : !hasResults ? (
            <p className="v2-global-search-empty">
              No results for &ldquo;{trimmed}&rdquo;
            </p>
          ) : (
            <>
              {matchedJobs.length > 0 && (
                <div className="v2-global-search-section">
                  <p className="v2-global-search-section-label">Jobs</p>
                  {matchedJobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      className="v2-global-search-row"
                      onClick={() => handleJobClick(job)}
                    >
                      <span className="v2-global-search-row-icon">
                        <Wrench size={14} aria-hidden="true" />
                      </span>
                      <span className="v2-global-search-row-content">
                        <span className="v2-global-search-row-title">
                          {job.title}
                        </span>
                        <span className="v2-global-search-row-sub">
                          {job.location}
                        </span>
                      </span>
                      <span className="v2-global-search-badge">{job.trade}</span>
                    </button>
                  ))}
                </div>
              )}

              {matchedTools.length > 0 && (
                <div className="v2-global-search-section">
                  <p className="v2-global-search-section-label">Tools</p>
                  {matchedTools.map((tool) => (
                    <button
                      key={tool}
                      type="button"
                      className="v2-global-search-row"
                      onClick={handleToolClick}
                    >
                      <span className="v2-global-search-row-icon">
                        <Wrench size={14} aria-hidden="true" />
                      </span>
                      <span className="v2-global-search-row-content">
                        <span className="v2-global-search-row-title">{tool}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {matchedNav.length > 0 && (
                <div className="v2-global-search-section">
                  <p className="v2-global-search-section-label">Navigation</p>
                  {matchedNav.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="v2-global-search-row"
                      onClick={() => handleNavClick(item)}
                    >
                      <span className="v2-global-search-row-icon">
                        <Navigation size={14} aria-hidden="true" />
                      </span>
                      <span className="v2-global-search-row-content">
                        <span className="v2-global-search-row-title">{item}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="v2-global-search-hint">
          Press <kbd>⌘K</kbd> to search &middot; <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
