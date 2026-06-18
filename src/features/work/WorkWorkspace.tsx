import { useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  FolderOpen,
  MapPin,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import type { ApplicationRecord, Job, Role, Talent } from "../../types";
import { difficultyOptions, radiusOptions, tradeOptions, workTypeOptions } from "../../data";
import "./work-workspace.css";

type RadiusFilter = (typeof radiusOptions)[number];
type TradeFilter = (typeof tradeOptions)[number];
type DifficultyFilter = (typeof difficultyOptions)[number];
type WorkTypeFilter = (typeof workTypeOptions)[number];
type DetailTab = "overview" | "requirements" | "activity";

interface WorkWorkspaceProps {
  role: Role;
  jobs: Job[];
  selectedJob: Job;
  recommendedTalent?: Talent;
  applicationState?: ApplicationRecord["state"];
  savedSearch: boolean;
  autoMatchEnabled: boolean;
  trade: TradeFilter;
  difficulty: DifficultyFilter;
  workType: WorkTypeFilter;
  radius: RadiusFilter;
  verifiedOnly: boolean;
  onTradeChange: (trade: TradeFilter) => void;
  onDifficultyChange: (difficulty: DifficultyFilter) => void;
  onWorkTypeChange: (workType: WorkTypeFilter) => void;
  onRadiusChange: (radius: RadiusFilter) => void;
  onVerifiedChange: (verified: boolean) => void;
  onSelectJob: (jobId: number) => void;
  onPostJob: () => void;
  onApply: () => void;
  onInvite: () => void;
  onOpenApplications: () => void;
  onOpenMyJobs: () => void;
  onOpenMessages: () => void;
  onOpenRecords: () => void;
  onToggleSavedSearch: () => void;
  onToggleAutoMatch: () => void;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function JobRow({
  job,
  selected,
  onSelect,
}: {
  job: Job;
  selected: boolean;
  onSelect: () => void;
}) {
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
          <span>{money(job.pay)}</span>
          <span>{job.durationHours}h</span>
          <span>{job.difficulty}</span>
        </span>
      </span>
      <span className="v2-job-row-aside">
        <span className={`v2-work-status status-${job.status.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{job.status}</span>
        <strong>{job.match}%</strong>
        <small>match</small>
        <ChevronRight size={16} />
      </span>
    </button>
  );
}

function DetailFact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="v2-detail-fact">
      <Icon size={17} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function WorkEmptyState({ role, onPostJob }: { role: Role; onPostJob: () => void }) {
  return (
    <div className="v2-work-empty">
      <BriefcaseBusiness size={24} />
      <h2>{role === "contractor" ? "No open jobs yet" : "No matching work nearby"}</h2>
      <p>{role === "contractor" ? "Post the work you need help with and start building your crew." : "Try widening the distance or removing a filter."}</p>
      {role === "contractor" ? (
        <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Post work</button>
      ) : null}
    </div>
  );
}

export function WorkWorkspace({
  role,
  jobs,
  selectedJob,
  recommendedTalent,
  applicationState,
  savedSearch,
  autoMatchEnabled,
  trade,
  difficulty,
  workType,
  radius,
  verifiedOnly,
  onTradeChange,
  onDifficultyChange,
  onWorkTypeChange,
  onRadiusChange,
  onVerifiedChange,
  onSelectJob,
  onPostJob,
  onApply,
  onInvite,
  onOpenApplications,
  onOpenMyJobs,
  onOpenMessages,
  onOpenRecords,
  onToggleSavedSearch,
  onToggleAutoMatch,
}: WorkWorkspaceProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [listQuery, setListQuery] = useState("");

  const visibleJobs = jobs.filter((job) => {
    const haystack = `${job.title} ${job.trade} ${job.location} ${job.summary}`.toLowerCase();
    return haystack.includes(listQuery.trim().toLowerCase());
  });

  const activeFilterCount = [
    trade !== "All trades",
    difficulty !== "Any difficulty",
    workType !== "All work types",
    radius !== "Any radius",
    verifiedOnly,
  ].filter(Boolean).length;

  function selectJob(jobId: number) {
    onSelectJob(jobId);
    setDetailTab("overview");
    setMobileDetailOpen(true);
  }

  return (
    <section className="v2-work-page" aria-label="Work">
      <header className="v2-work-header">
        <div>
          <h1>Work</h1>
          <p>{role === "contractor" ? "Post jobs, review applicants, and move active work forward." : "Find work, track applications, and manage active jobs."}</p>
        </div>
        {role === "contractor" ? (
          <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Post work</button>
        ) : null}
      </header>

      <nav className="v2-section-tabs" aria-label="Work sections">
        <button type="button" className="is-active">{role === "contractor" ? "Open jobs" : "Find work"}</button>
        <button type="button" onClick={onOpenApplications}>{role === "contractor" ? "Applicants" : "Applications"}</button>
        <button type="button" onClick={onOpenMyJobs}>Active & completed</button>
      </nav>

      <div className="v2-work-toolbar">
        <label className="v2-list-search">
          <Search size={16} />
          <input value={listQuery} onChange={(event) => setListQuery(event.target.value)} placeholder="Search work" />
        </label>
        <button type="button" className={filtersOpen ? "v2-filter-button is-active" : "v2-filter-button"} onClick={() => setFiltersOpen((open) => !open)}>
          <Filter size={16} /> Filters {activeFilterCount ? <span>{activeFilterCount}</span> : null}
        </button>
        <button type="button" className="v2-text-button" onClick={onToggleSavedSearch}>{savedSearch ? <Check size={15} /> : <Sparkles size={15} />} {savedSearch ? "Alert saved" : "Save alert"}</button>
        <button type="button" className="v2-text-button v2-sort-button" onClick={onToggleAutoMatch}>{autoMatchEnabled ? "Best match" : "Newest"}</button>
      </div>

      {filtersOpen ? (
        <section className="v2-filter-panel" aria-label="Work filters">
          <div className="v2-filter-panel-heading">
            <strong>Filter work</strong>
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={18} /></button>
          </div>
          <label><span>Trade</span><select value={trade} onChange={(event) => onTradeChange(event.target.value as TradeFilter)}>{tradeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>Difficulty</span><select value={difficulty} onChange={(event) => onDifficultyChange(event.target.value as DifficultyFilter)}>{difficultyOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>Work type</span><select value={workType} onChange={(event) => onWorkTypeChange(event.target.value as WorkTypeFilter)}>{workTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>Distance</span><select value={radius} onChange={(event) => onRadiusChange(event.target.value as RadiusFilter)}>{radiusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="v2-checkbox-filter"><input type="checkbox" checked={verifiedOnly} onChange={(event) => onVerifiedChange(event.target.checked)} /><span>Insurance marked</span></label>
        </section>
      ) : null}

      <div className={mobileDetailOpen ? "v2-work-layout show-detail" : "v2-work-layout"}>
        <section className="v2-work-list" aria-label={`${visibleJobs.length} jobs`}>
          <div className="v2-work-list-heading">
            <span>{visibleJobs.length} {visibleJobs.length === 1 ? "job" : "jobs"}</span>
            <small>{autoMatchEnabled ? "Sorted by best match" : "Sorted by newest"}</small>
          </div>
          {visibleJobs.length ? visibleJobs.map((job) => (
            <JobRow key={job.id} job={job} selected={selectedJob.id === job.id} onSelect={() => selectJob(job.id)} />
          )) : <WorkEmptyState role={role} onPostJob={onPostJob} />}
        </section>

        {selectedJob.id ? (
          <article className="v2-work-detail" aria-label={selectedJob.title}>
            <button type="button" className="v2-detail-back" onClick={() => setMobileDetailOpen(false)}><ArrowLeft size={16} /> All work</button>
            <header className="v2-work-detail-header">
              <div>
                <span className="v2-detail-trade">{selectedJob.trade}</span>
                <h2>{selectedJob.title}</h2>
                <p><MapPin size={14} /> {selectedJob.location} · Posted {selectedJob.posted}</p>
              </div>
              <div className="v2-match-score"><strong>{selectedJob.match}%</strong><span>match</span></div>
            </header>

            <nav className="v2-detail-tabs" aria-label="Job details">
              {(["overview", "requirements", "activity"] as const).map((tab) => (
                <button key={tab} type="button" className={detailTab === tab ? "is-active" : ""} onClick={() => setDetailTab(tab)}>{tab}</button>
              ))}
            </nav>

            {detailTab === "overview" ? (
              <div className="v2-detail-content">
                <p className="v2-job-description">{selectedJob.summary}</p>
                <div className="v2-detail-facts">
                  <DetailFact icon={CircleDollarSign} label="Budget" value={money(selectedJob.pay)} />
                  <DetailFact icon={CalendarClock} label="Estimate" value={`${selectedJob.durationHours} hours`} />
                  <DetailFact icon={ShieldCheck} label="Insurance" value={selectedJob.insuranceRequired ? "Required" : "Optional"} />
                  <DetailFact icon={BriefcaseBusiness} label="Work type" value={selectedJob.workType} />
                </div>
                <section className="v2-detail-section">
                  <h3>Scope and expectations</h3>
                  <ul>{selectedJob.deliverables.map((item) => <li key={item}><Check size={15} /> {item}</li>)}</ul>
                </section>
                {recommendedTalent ? (
                  <section className="v2-recommended-person">
                    <span className="v2-avatar" aria-hidden="true">{recommendedTalent.name.charAt(0)}</span>
                    <div><small>Recommended for this job</small><strong>{recommendedTalent.name}</strong><span>{recommendedTalent.trade} · {recommendedTalent.availability}</span></div>
                    <strong>{recommendedTalent.rating}</strong>
                  </section>
                ) : null}
              </div>
            ) : null}

            {detailTab === "requirements" ? (
              <div className="v2-detail-content">
                <section className="v2-detail-section">
                  <h3>Tools</h3>
                  <ul>{selectedJob.tools.map((tool) => <li key={tool}><Wrench size={15} /> {tool}</li>)}</ul>
                </section>
                <section className="v2-detail-section">
                  <h3>Before starting</h3>
                  <ul>{selectedJob.guidance.map((item) => <li key={item}><ShieldCheck size={15} /> {item}</li>)}</ul>
                </section>
                <section className="v2-detail-section">
                  <h3>Watch for</h3>
                  <ul>{selectedJob.risks.map((item) => <li key={item}><FileText size={15} /> {item}</li>)}</ul>
                </section>
              </div>
            ) : null}

            {detailTab === "activity" ? (
              <div className="v2-detail-content">
                <ol className="v2-activity-list">
                  <li><span /><div><strong>Job posted</strong><small>{selectedJob.posted}</small></div></li>
                  <li><span /><div><strong>{selectedJob.applicants} people interested</strong><small>Applications stay attached to this job</small></div></li>
                  <li><span /><div><strong>Current status: {selectedJob.status}</strong><small>Updates appear here as work moves forward</small></div></li>
                </ol>
              </div>
            ) : null}

            <footer className="v2-work-detail-actions">
              <button type="button" className="v2-primary-button" onClick={role === "contractor" ? onInvite : onApply}>
                {role === "contractor" ? <UserCheck size={17} /> : <BriefcaseBusiness size={17} />}
                {role === "contractor" ? (applicationState === "Invited" ? "Crew invited" : "Invite crew") : (applicationState === "Submitted" ? "Application sent" : "Apply now")}
              </button>
              <button type="button" onClick={onOpenMessages}><MessageSquareText size={17} /> Message</button>
              <button type="button" onClick={onOpenRecords}><FolderOpen size={17} /> Records</button>
            </footer>
          </article>
        ) : null}
      </div>
    </section>
  );
}
