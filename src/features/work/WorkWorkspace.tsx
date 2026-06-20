import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  LockKeyhole,
  MapPin,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import type { Job, JobId, Role } from "../../types";
import { difficultyOptions, tradeOptions, workTypeOptions } from "../../data";
import "./work-workspace.css";

type TradeFilter = (typeof tradeOptions)[number];
type DifficultyFilter = (typeof difficultyOptions)[number];
type WorkTypeFilter = (typeof workTypeOptions)[number];
type DetailTab = "overview" | "requirements" | "activity";
type ContractorSection = "open" | "draft" | "paused" | "closed";
type JobAction = "publish" | "pause" | "resume" | "close";

interface WorkWorkspaceProps {
  role: Role;
  jobs: Job[];
  selectedJob: Job | null;
  loading: boolean;
  error: string | null;
  query: string;
  trade: TradeFilter;
  difficulty: DifficultyFilter;
  workType: WorkTypeFilter;
  locationQuery: string;
  verifiedOnly: boolean;
  onQueryChange: (query: string) => void;
  onTradeChange: (trade: TradeFilter) => void;
  onDifficultyChange: (difficulty: DifficultyFilter) => void;
  onWorkTypeChange: (workType: WorkTypeFilter) => void;
  onLocationChange: (location: string) => void;
  onVerifiedChange: (verified: boolean) => void;
  onSelectJob: (jobId: JobId) => void;
  onPostJob: () => void;
  onEditJob: (job: Job) => void;
  onTransition: (job: Job, action: JobAction) => Promise<void>;
  onRetry: () => void;
}

const statusForSection: Record<ContractorSection, Job["status"]> = {
  open: "Open",
  draft: "Draft",
  paused: "Paused",
  closed: "Closed",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function JobRow({ job, selected, role, onSelect }: { job: Job; selected: boolean; role: Role; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={selected ? "v2-job-row is-selected" : "v2-job-row"}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="v2-job-row-main">
        <span className="v2-job-row-meta">{job.trade} · {job.location}</span>
        <strong>{job.title}</strong>
        <span className="v2-job-row-summary">{job.summary}</span>
        <span className="v2-job-row-facts">
          <span>{job.pay > 0 ? money(job.pay) : "Budget not set"}</span>
          <span>{job.durationHours > 0 ? `${job.durationHours}h` : "Duration not set"}</span>
          <span>{job.difficulty}</span>
        </span>
      </span>
      <span className="v2-job-row-aside">
        <span className={`v2-work-status status-${job.status.toLowerCase()}`}>{job.status}</span>
        {role === "tradesperson" && job.match > 0 ? <><strong>{job.match}%</strong><small>match</small></> : null}
        <ChevronRight size={16} />
      </span>
    </button>
  );
}

function JobListSkeleton() {
  return (
    <div className="v2-job-skeleton-list" aria-label="Loading jobs" aria-busy="true">
      {[0, 1, 2].map((item) => <div className="v2-job-skeleton" key={item}><span /><strong /><small /></div>)}
    </div>
  );
}

function DetailFact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return <div className="v2-detail-fact"><Icon size={17} /><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function WorkEmptyState({ role, section, onPostJob }: { role: Role; section: ContractorSection; onPostJob: () => void }) {
  const contractorCopy: Record<ContractorSection, { title: string; body: string }> = {
    open: { title: "No open jobs", body: "Publish a job when you are ready to receive interest from tradespeople." },
    draft: { title: "No drafts", body: "Start a job now and return to finish the scope whenever you are ready." },
    paused: { title: "No paused jobs", body: "Jobs you pause will stay here until you reopen or close them." },
    closed: { title: "No closed jobs", body: "Completed or cancelled postings will stay here for your records." },
  };
  const copy = role === "contractor" ? contractorCopy[section] : { title: "No matching work nearby", body: "Try changing the trade, location, or job requirements." };
  return (
    <div className="v2-work-empty">
      <BriefcaseBusiness size={24} />
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      {role === "contractor" ? <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Create job</button> : null}
    </div>
  );
}

export function WorkWorkspace({
  role,
  jobs,
  selectedJob,
  loading,
  error,
  query,
  trade,
  difficulty,
  workType,
  locationQuery,
  verifiedOnly,
  onQueryChange,
  onTradeChange,
  onDifficultyChange,
  onWorkTypeChange,
  onLocationChange,
  onVerifiedChange,
  onSelectJob,
  onPostJob,
  onEditJob,
  onTransition,
  onRetry,
}: WorkWorkspaceProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [contractorSection, setContractorSection] = useState<ContractorSection>("open");
  const [activeAction, setActiveAction] = useState("");

  const visibleJobs = useMemo(() => role === "contractor"
    ? jobs.filter((job) => job.status === statusForSection[contractorSection])
    : jobs,
  [contractorSection, jobs, role]);

  const activeFilterCount = [
    trade !== "All trades",
    difficulty !== "Any difficulty",
    workType !== "All work types",
    locationQuery.trim().length > 0,
    verifiedOnly,
  ].filter(Boolean).length;

  function selectJob(jobId: JobId) {
    onSelectJob(jobId);
    setDetailTab("overview");
    setMobileDetailOpen(true);
  }

  async function runAction(job: Job, action: JobAction) {
    setActiveAction(`${job.id}:${action}`);
    try {
      await onTransition(job, action);
    } finally {
      setActiveAction("");
    }
  }

  const selectedIsVisible = selectedJob ? visibleJobs.some((job) => job.id === selectedJob.id) : false;
  const detailJob = selectedIsVisible ? selectedJob : visibleJobs[0] ?? null;

  return (
    <section className="v2-work-page" aria-label="Work">
      <header className="v2-work-header">
        <div><h1>Work</h1><p>{role === "contractor" ? "Create and manage your company’s job postings." : "Discover open work from verified trade businesses."}</p></div>
        {role === "contractor" ? <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Create job</button> : null}
      </header>

      {role === "contractor" ? (
        <nav className="v2-section-tabs" aria-label="Job status">
          {(["open", "draft", "paused", "closed"] as const).map((section) => (
            <button key={section} type="button" className={contractorSection === section ? "is-active" : ""} onClick={() => { setContractorSection(section); setMobileDetailOpen(false); }}>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="v2-work-toolbar">
        <label className="v2-list-search"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search work" /></label>
        <button type="button" className={filtersOpen ? "v2-filter-button is-active" : "v2-filter-button"} onClick={() => setFiltersOpen((open) => !open)}>
          <Filter size={16} /> Filters {activeFilterCount ? <span>{activeFilterCount}</span> : null}
        </button>
      </div>

      {filtersOpen ? (
        <section className="v2-filter-panel" aria-label="Work filters">
          <div className="v2-filter-panel-heading"><strong>Filter work</strong><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={18} /></button></div>
          <label><span>Trade</span><select value={trade} onChange={(event) => onTradeChange(event.target.value as TradeFilter)}>{tradeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>Difficulty</span><select value={difficulty} onChange={(event) => onDifficultyChange(event.target.value as DifficultyFilter)}>{difficultyOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>Work type</span><select value={workType} onChange={(event) => onWorkTypeChange(event.target.value as WorkTypeFilter)}>{workTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>City or state</span><input value={locationQuery} onChange={(event) => onLocationChange(event.target.value)} placeholder="Jacksonville, FL" /></label>
          <label className="v2-checkbox-filter"><input type="checkbox" checked={verifiedOnly} onChange={(event) => onVerifiedChange(event.target.checked)} /><span>Insurance required</span></label>
        </section>
      ) : null}

      {error ? <div className="v2-work-error" role="alert"><div><strong>Jobs could not be loaded</strong><span>{error}</span></div><button type="button" onClick={onRetry}><RefreshCw size={16} /> Retry</button></div> : null}

      <div className={mobileDetailOpen ? "v2-work-layout show-detail" : "v2-work-layout"}>
        <section className="v2-work-list" aria-label={`${visibleJobs.length} jobs`}>
          <div className="v2-work-list-heading"><span>{visibleJobs.length} {visibleJobs.length === 1 ? "job" : "jobs"}</span><small>{role === "contractor" ? `${contractorSection} postings` : "Open work"}</small></div>
          {loading ? <JobListSkeleton /> : visibleJobs.length ? visibleJobs.map((job) => (
            <JobRow key={job.id} job={job} role={role} selected={detailJob?.id === job.id} onSelect={() => selectJob(job.id)} />
          )) : <WorkEmptyState role={role} section={contractorSection} onPostJob={onPostJob} />}
        </section>

        {detailJob ? (
          <article className="v2-work-detail" aria-label={detailJob.title}>
            <button type="button" className="v2-detail-back" onClick={() => setMobileDetailOpen(false)}><ArrowLeft size={16} /> All work</button>
            <header className="v2-work-detail-header">
              <div><span className="v2-detail-trade">{detailJob.trade}</span><h2>{detailJob.title}</h2><p><MapPin size={14} /> {detailJob.location} · {detailJob.status === "Draft" ? "Last saved" : "Posted"} {detailJob.posted}</p></div>
              {role === "tradesperson" && detailJob.match > 0 ? <div className="v2-match-score"><strong>{detailJob.match}%</strong><span>match</span></div> : <span className={`v2-work-status status-${detailJob.status.toLowerCase()}`}>{detailJob.status}</span>}
            </header>

            <nav className="v2-detail-tabs" aria-label="Job details">
              {(["overview", "requirements", "activity"] as const).map((tab) => <button key={tab} type="button" className={detailTab === tab ? "is-active" : ""} onClick={() => setDetailTab(tab)}>{tab}</button>)}
            </nav>

            {detailTab === "overview" ? (
              <div className="v2-detail-content">
                <p className="v2-job-description">{detailJob.summary}</p>
                <div className="v2-detail-facts">
                  <DetailFact icon={CircleDollarSign} label="Budget" value={detailJob.pay > 0 ? money(detailJob.pay) : "Not set"} />
                  <DetailFact icon={CalendarClock} label="Estimate" value={detailJob.durationHours > 0 ? `${detailJob.durationHours} hours` : "Not set"} />
                  <DetailFact icon={ShieldCheck} label="Insurance" value={detailJob.insuranceRequired ? "Required" : "Not required"} />
                  <DetailFact icon={BriefcaseBusiness} label="Work type" value={detailJob.workType} />
                </div>
                <section className="v2-detail-section"><h3>Scope</h3><p>{detailJob.canonical?.scopeDescription || "Scope details have not been added yet."}</p></section>
                <section className="v2-privacy-note"><LockKeyhole size={17} /><div><strong>Exact address stays private</strong><span>{role === "contractor" ? "Only your organization can access the saved address in this release." : detailJob.addressPolicy}</span></div></section>
                {role === "contractor" && detailJob.canonical?.privateLocation ? <section className="v2-detail-section"><h3>Private jobsite</h3><p>{detailJob.canonical.privateLocation.addressLine1}{detailJob.canonical.privateLocation.addressLine2 ? `, ${detailJob.canonical.privateLocation.addressLine2}` : ""}<br />{detailJob.canonical.privateLocation.city}, {detailJob.canonical.privateLocation.region} {detailJob.canonical.privateLocation.postalCode}</p></section> : null}
              </div>
            ) : null}

            {detailTab === "requirements" ? (
              <div className="v2-detail-content">
                <section className="v2-detail-section"><h3>Tools</h3>{detailJob.tools.length ? <ul>{detailJob.tools.map((tool) => <li key={tool}><Wrench size={15} /> {tool}</li>)}</ul> : <p>No tools listed.</p>}</section>
                <section className="v2-detail-section"><h3>Materials and site provisions</h3>{detailJob.canonical?.materials.length ? <ul>{detailJob.canonical.materials.map((item) => <li key={item}><FileText size={15} /> {item}</li>)}</ul> : <p>No materials listed.</p>}</section>
                <section className="v2-detail-section"><h3>Completion deliverables</h3>{detailJob.deliverables.length ? <ul>{detailJob.deliverables.map((item) => <li key={item}><Check size={15} /> {item}</li>)}</ul> : <p>No deliverables listed.</p>}</section>
              </div>
            ) : null}

            {detailTab === "activity" ? (
              <div className="v2-detail-content">
                {detailJob.canonical?.events.length ? <ol className="v2-activity-list">{detailJob.canonical.events.map((event) => <li key={event.id}><span /><div><strong>{event.type.replaceAll("_", " ")}</strong><small>{new Date(event.occurredAt).toLocaleString()}</small></div></li>)}</ol> : <p className="v2-muted-copy">No status changes yet.</p>}
              </div>
            ) : null}

            {role === "contractor" && detailJob.status !== "Closed" ? (
              <footer className="v2-work-detail-actions">
                <button type="button" onClick={() => onEditJob(detailJob)}><Pencil size={17} /> Edit</button>
                {detailJob.status === "Draft" ? <button type="button" className="v2-primary-button" disabled={Boolean(activeAction)} onClick={() => void runAction(detailJob, "publish")}><Play size={17} /> Publish</button> : null}
                {detailJob.status === "Open" ? <button type="button" disabled={Boolean(activeAction)} onClick={() => void runAction(detailJob, "pause")}><Pause size={17} /> Pause</button> : null}
                {detailJob.status === "Paused" ? <button type="button" className="v2-primary-button" disabled={Boolean(activeAction)} onClick={() => void runAction(detailJob, "resume")}><Play size={17} /> Reopen</button> : null}
                <button type="button" className="v2-destructive-button" disabled={Boolean(activeAction)} onClick={() => void runAction(detailJob, "close")}><XCircle size={17} /> Close</button>
              </footer>
            ) : null}
          </article>
        ) : <div className="v2-work-detail-placeholder"><BriefcaseBusiness size={28} /><span>Select a job to review its scope.</span></div>}
      </div>
    </section>
  );
}
