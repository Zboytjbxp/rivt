import { useEffect, useMemo, useState } from "react";
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
import { EmptyState, StatusPill } from "../../components/ui";
import {
  acceptOffer,
  cancelActiveWork,
  declineApplication,
  declineOffer,
  getJob,
  listActiveWork,
  listJobApplications,
  listMyApplications,
  listOffers,
  requestWorkReschedule,
  saveApplicationDraft,
  sendOffer,
  shortlistApplication,
  submitApplication,
  toJobViewModel,
  withdrawApplication,
  type CanonicalActiveWork,
  type CanonicalApplication,
  type CanonicalOffer,
} from "./job-api";
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
  onJobLoaded: (job: Job) => void;
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

function statusTone(status: Job["status"]) {
  if (status === "Open") return "success";
  if (status === "Paused" || status === "Draft") return "warning";
  if (status === "Closed") return "neutral";
  return "info";
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
        <StatusPill tone={statusTone(job.status)} className={`v2-work-status status-${job.status.toLowerCase()}`}>{job.status}</StatusPill>
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
    <EmptyState
      className="v2-work-empty"
      icon={<BriefcaseBusiness size={24} />}
      title={copy.title}
      description={copy.body}
      action={role === "contractor" ? <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Create job</button> : null}
    />
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
  onJobLoaded,
  onRetry,
}: WorkWorkspaceProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [contractorSection, setContractorSection] = useState<ContractorSection>("open");
  const [activeAction, setActiveAction] = useState("");
  const [matchRefreshKey, setMatchRefreshKey] = useState(0);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState<{ kind: "reschedule" | "cancel"; target: CanonicalActiveWork } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [matchApplications, setMatchApplications] = useState<CanonicalApplication[]>([]);
  const [matchOffers, setMatchOffers] = useState<CanonicalOffer[]>([]);
  const [matchActiveWork, setMatchActiveWork] = useState<CanonicalActiveWork[]>([]);
  const [applicationMessage, setApplicationMessage] = useState("I am interested in this work and can confirm tools, timing, and site requirements.");
  const [demoAppliedJobs, setDemoAppliedJobs] = useState<Set<JobId>>(new Set());

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

  async function handleSaveDraft(job: Job) {
    const jobId = job.canonical?.id;
    if (!jobId) return;
    await runMatchAction(`draft:${jobId}`, async () => {
      await saveApplicationDraft(jobId, { message: applicationMessage });
    });
  }

  async function handleSubmitApplication(job: Job) {
    const jobId = job.canonical?.id;
    if (!jobId) return;
    await runMatchAction(`apply:${jobId}`, async () => {
      await submitApplication(jobId, { message: applicationMessage });
    });
  }

  async function handleWithdraw(application: CanonicalApplication) {
    await runMatchAction(`withdraw:${application.id}`, async () => {
      await withdrawApplication(application.id);
    });
  }

  async function handleShortlist(application: CanonicalApplication) {
    await runMatchAction(`shortlist:${application.id}`, async () => {
      await shortlistApplication(application.id);
    });
  }

  async function handleDeclineApplication(application: CanonicalApplication) {
    await runMatchAction(`decline:${application.id}`, async () => {
      await declineApplication(application.id);
    });
  }

  async function handleSendOffer(job: Job, application: CanonicalApplication) {
    await runMatchAction(`offer:${application.id}`, async () => {
      await sendOffer(application.id, {
        startDate: job.canonical?.preferredStartDate ?? null,
        scopeSummary: job.canonical?.scopeDescription || job.summary,
        message: `Offer for ${job.title}. Accept to unlock the exact jobsite and active work record.`,
      });
    });
  }

  async function handleAcceptOffer(offer: CanonicalOffer) {
    await runMatchAction(`accept:${offer.id}`, async () => {
      await acceptOffer(offer.id, "Confirmed in RIVT.");
      await refreshDetailJob();
    });
  }

  async function handleDeclineOffer(offer: CanonicalOffer) {
    await runMatchAction(`decline-offer:${offer.id}`, async () => {
      await declineOffer(offer.id);
    });
  }

  function openReasonPrompt(kind: "reschedule" | "cancel", target: CanonicalActiveWork) {
    setReasonText("");
    setReasonPrompt({ kind, target });
  }

  async function submitReason() {
    if (!reasonPrompt || !reasonText.trim()) return;
    const { kind, target } = reasonPrompt;
    const reason = reasonText.trim();
    setReasonPrompt(null);
    if (kind === "reschedule") {
      await runMatchAction(`reschedule:${target.id}`, async () => {
        await requestWorkReschedule(target.id, reason);
      });
    } else {
      await runMatchAction(`cancel:${target.id}`, async () => {
        await cancelActiveWork(target.id, reason);
      });
    }
  }

  const selectedIsVisible = selectedJob ? visibleJobs.some((job) => job.id === selectedJob.id) : false;
  const detailJob = selectedIsVisible ? selectedJob : visibleJobs[0] ?? null;
  const canonicalJobId = detailJob?.canonical?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    async function loadMatchState() {
      if (!canonicalJobId) {
        setMatchApplications([]);
        setMatchOffers([]);
        setMatchActiveWork([]);
        return;
      }
      setMatchLoading(true);
      setMatchError(null);
      try {
        if (role === "contractor") {
          const [applicationsForJob, active] = await Promise.all([
            listJobApplications(canonicalJobId),
            listActiveWork(),
          ]);
          if (cancelled) return;
          setMatchApplications(applicationsForJob);
          setMatchOffers([]);
          setMatchActiveWork(active.filter((item) => item.jobId === canonicalJobId));
        } else {
          const [applicationsForUser, offersForUser, active] = await Promise.all([
            listMyApplications(),
            listOffers(),
            listActiveWork(),
          ]);
          if (cancelled) return;
          setMatchApplications(applicationsForUser.filter((item) => item.jobId === canonicalJobId));
          setMatchOffers(offersForUser.filter((item) => item.jobId === canonicalJobId));
          setMatchActiveWork(active.filter((item) => item.jobId === canonicalJobId));
        }
      } catch (cause) {
        if (!cancelled) {
          setMatchApplications([]);
          setMatchOffers([]);
          setMatchActiveWork([]);
          setMatchError(cause instanceof Error ? cause.message : "Hiring state could not be loaded.");
        }
      } finally {
        if (!cancelled) setMatchLoading(false);
      }
    }
    void loadMatchState();
    return () => {
      cancelled = true;
    };
  }, [canonicalJobId, matchRefreshKey, role]);

  async function refreshDetailJob() {
    if (!canonicalJobId) return;
    try {
      onJobLoaded(toJobViewModel(await getJob(canonicalJobId)));
    } catch {
      onRetry();
    }
  }

  async function runMatchAction(key: string, action: () => Promise<void>) {
    setActiveAction(key);
    setMatchError(null);
    try {
      await action();
      setMatchRefreshKey((current) => current + 1);
    } catch (cause) {
      setMatchError(cause instanceof Error ? cause.message : "That hiring action could not be completed.");
      throw cause;
    } finally {
      setActiveAction("");
    }
  }

  const currentApplication = canonicalJobId
    ? matchApplications.find((application) => application.jobId === canonicalJobId)
    : undefined;
  const pendingOffer = canonicalJobId
    ? matchOffers.find((offer) => offer.jobId === canonicalJobId && offer.status === "pending")
    : undefined;
  const acceptedOffer = canonicalJobId
    ? matchOffers.find((offer) => offer.jobId === canonicalJobId && offer.status === "accepted")
    : undefined;
  const activeWork = canonicalJobId
    ? matchActiveWork.find((work) => work.jobId === canonicalJobId)
    : undefined;

  return (
    <section className="v2-work-page" aria-label="Work">
      {reasonPrompt && (
        <div className="v2-reason-backdrop" onClick={() => setReasonPrompt(null)}>
          <div className="v2-reason-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{reasonPrompt.kind === "reschedule" ? "Request a reschedule" : "Cancel active work"}</h3>
            <p>{reasonPrompt.kind === "reschedule" ? "Let the other party know why the schedule needs to change." : "Explain the reason for cancellation. Both parties will see this."}</p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={3}
              placeholder={reasonPrompt.kind === "reschedule" ? "e.g. Site not ready until next week" : "e.g. Scope changed — work no longer needed"}
              autoFocus
            />
            <div className="v2-reason-actions">
              <button type="button" onClick={() => setReasonPrompt(null)}>Go back</button>
              <button
                type="button"
                className={reasonPrompt.kind === "cancel" ? "v2-destructive-button" : "v2-primary-button"}
                disabled={!reasonText.trim()}
                onClick={() => void submitReason()}
              >
                {reasonPrompt.kind === "reschedule" ? "Send request" : "Cancel work"}
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="v2-work-header">
        <div><h1>Work</h1><p>{role === "contractor" ? "Post and manage jobs." : "Find open work nearby."}</p></div>
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
          {loading ? <JobListSkeleton /> : visibleJobs.length ? (
            <>
              {visibleJobs.map((job) => (
                <JobRow key={job.id} job={job} role={role} selected={detailJob?.id === job.id} onSelect={() => selectJob(job.id)} />
              ))}
              <div className="v2-work-end-of-feed">
                {role === "tradesperson" ? "That's all open work in your area" : `All ${contractorSection.toLowerCase()} postings shown`}
              </div>
            </>
          ) : <WorkEmptyState role={role} section={contractorSection} onPostJob={onPostJob} />}
        </section>

        {detailJob ? (
          <article className="v2-work-detail" aria-label={detailJob.title}>
            <button type="button" className="v2-detail-back" onClick={() => setMobileDetailOpen(false)}><ArrowLeft size={16} /> All work</button>
            <header className="v2-work-detail-header">
              <div><span className="v2-detail-trade">{detailJob.trade}</span><h2>{detailJob.title}</h2><p><MapPin size={14} /> {detailJob.location} · {detailJob.status === "Draft" ? "Last saved" : "Posted"} {detailJob.posted}</p></div>
              {role === "tradesperson" && detailJob.match > 0 ? <div className="v2-match-score"><strong>{detailJob.match}%</strong><span>match</span></div> : <StatusPill tone={statusTone(detailJob.status)} className={`v2-work-status status-${detailJob.status.toLowerCase()}`}>{detailJob.status}</StatusPill>}
            </header>

            <nav className="v2-detail-tabs" aria-label="Job details">
              {(["overview", "requirements", "activity"] as const).map((tab) => <button key={tab} type="button" className={detailTab === tab ? "is-active" : ""} onClick={() => setDetailTab(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}
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
                <section className="v2-match-panel" aria-label="Hiring workflow">
                  <div className="v2-match-panel-heading">
                    <div>
                      <span>{role === "contractor" ? "Applicants" : "Your hiring status"}</span>
                      <h3>{role === "contractor" ? "Move one real applicant to active work" : "Apply, accept, and unlock the jobsite"}</h3>
                    </div>
                    {matchLoading ? <small>Loading...</small> : null}
                  </div>
                  {matchError ? <p className="v2-match-error" role="alert">{matchError}</p> : null}
                  {activeWork ? (
                    <div className="v2-active-work-card">
                      <div>
                        <span>Active work</span>
                        <strong>{activeWork.status === "active" ? "Accepted and active" : activeWork.status}</strong>
                        <small>Started {new Date(activeWork.startedAt).toLocaleString()}</small>
                      </div>
                      <div className="v2-match-actions">
                        {activeWork.status === "active" ? (
                          <>
                            <button type="button" disabled={Boolean(activeAction)} onClick={() => openReasonPrompt("reschedule", activeWork)}>Request reschedule</button>
                            <button type="button" className="v2-destructive-button" disabled={Boolean(activeAction)} onClick={() => openReasonPrompt("cancel", activeWork)}>Cancel work</button>
                          </>
                        ) : null}
                      </div>
                      {activeWork.events.length ? (
                        <ol className="v2-mini-timeline">
                          {activeWork.events.slice(0, 4).map((event) => { const label = event.type.replaceAll("_", " "); return <li key={event.id}><strong>{label.charAt(0).toUpperCase() + label.slice(1)}</strong><small>{event.reason || new Date(event.occurredAt).toLocaleString()}</small></li>; })}
                        </ol>
                      ) : null}
                    </div>
                  ) : role === "contractor" ? (
                    matchApplications.length ? (
                      <div className="v2-applicant-list">
                        {matchApplications.map((application) => (
                          <article className="v2-applicant-card" key={application.id}>
                            <div>
                              <span>{application.status}</span>
                              <strong>{application.applicant?.displayName || "Tradesperson"}</strong>
                              <small>{application.applicant?.headline || `${application.applicant?.serviceArea.city ?? ""}, ${application.applicant?.serviceArea.region ?? ""}`}</small>
                              {application.message ? <p>{application.message}</p> : null}
                            </div>
                            <div className="v2-match-actions">
                              {application.status === "submitted" ? <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleShortlist(application)}>Shortlist</button> : null}
                              {["submitted", "shortlisted"].includes(application.status) ? (
                                <>
                                  <button type="button" className="v2-primary-button" disabled={Boolean(activeAction)} onClick={() => void handleSendOffer(detailJob, application)}>Send offer</button>
                                  <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleDeclineApplication(application)}>Decline</button>
                                </>
                              ) : <small>{application.status === "offered" ? "Offer sent" : "No action needed"}</small>}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="v2-match-empty"><strong>No applicants yet</strong><span>{detailJob.status === "Open" ? "Tradespeople who apply will appear here." : `This job is ${detailJob.status.toLowerCase()} — publish it to start receiving applicants.`}</span></div>
                    )
                  ) : pendingOffer ? (
                    <div className="v2-offer-card">
                      <div>
                        <span>You have an offer</span>
                        <strong>{pendingOffer.startDate ? `Proposed start: ${pendingOffer.startDate}` : "No start date set yet"}</strong>
                        <p>{pendingOffer.message || pendingOffer.scopeSummary}</p>
                      </div>
                      <div className="v2-match-actions">
                        <button type="button" className="v2-primary-button" disabled={Boolean(activeAction)} onClick={() => void handleAcceptOffer(pendingOffer)}>Accept work</button>
                        <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleDeclineOffer(pendingOffer)}>Decline</button>
                      </div>
                    </div>
                  ) : acceptedOffer ? (
                    <div className="v2-match-empty"><strong>Offer accepted</strong><span>The active work record is being prepared.</span></div>
                  ) : currentApplication && currentApplication.status !== "withdrawn" ? (
                    <div className="v2-offer-card">
                      <div>
                        <span>{currentApplication.status}</span>
                        <strong>{currentApplication.status === "draft" ? "Draft saved" : "Application submitted"}</strong>
                        <p>{currentApplication.message || "Your application is on file for this job."}</p>
                      </div>
                      {["draft", "submitted", "shortlisted"].includes(currentApplication.status) ? (
                        <div className="v2-match-actions">
                          {currentApplication.status === "draft" ? <button type="button" className="v2-primary-button" disabled={Boolean(activeAction)} onClick={() => void handleSubmitApplication(detailJob)}>Submit</button> : null}
                          <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleWithdraw(currentApplication)}>Withdraw</button>
                        </div>
                      ) : null}
                    </div>
                  ) : demoAppliedJobs.has(detailJob.id) ? (
                    <div className="v2-offer-card">
                      <div>
                        <span>submitted</span>
                        <strong>Application submitted</strong>
                        <p>{applicationMessage || "Your application is on file for this job."}</p>
                      </div>
                      <div className="v2-match-actions">
                        <button type="button" onClick={() => setDemoAppliedJobs((prev) => { const next = new Set(prev); next.delete(detailJob.id); return next; })}>Withdraw</button>
                      </div>
                    </div>
                  ) : (
                    <div className="v2-apply-box">
                      {detailJob.status !== "Open" && (
                        <p className="v2-match-note">This job is {detailJob.status.toLowerCase()} and not accepting applications right now.</p>
                      )}
                      <label>
                        <span>Message to contractor</span>
                        <textarea value={applicationMessage} onChange={(event) => setApplicationMessage(event.target.value)} rows={4} disabled={detailJob.status !== "Open"} />
                      </label>
                      <div className="v2-match-actions">
                        {detailJob.canonical ? (
                          <button type="button" disabled={Boolean(activeAction) || detailJob.status !== "Open"} onClick={() => void handleSaveDraft(detailJob)}>Save draft</button>
                        ) : null}
                        <button
                          type="button"
                          className="v2-primary-button"
                          disabled={Boolean(activeAction) || detailJob.status !== "Open"}
                          onClick={detailJob.canonical
                            ? () => void handleSubmitApplication(detailJob)
                            : () => setDemoAppliedJobs((prev) => new Set([...prev, detailJob.id]))
                          }
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </section>
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
                {detailJob.canonical?.events.length ? <ol className="v2-activity-list">{detailJob.canonical.events.map((event) => { const label = event.type.replaceAll("_", " "); return <li key={event.id}><span /><div><strong>{label.charAt(0).toUpperCase() + label.slice(1)}</strong><small>{new Date(event.occurredAt).toLocaleString()}</small></div></li>; })}</ol> : <p className="v2-muted-copy">No activity yet for this job.</p>}
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
        ) : (
          <article className="v2-work-detail-placeholder">
            <BriefcaseBusiness size={32} />
            <strong>{role === "tradesperson" ? "Select a job to see details" : "Select a posting to review it"}</strong>
            <span>{role === "tradesperson" ? "Tap any job to see scope, budget, and apply" : "Manage scope, applicants, and job status here"}</span>
          </article>
        )}
      </div>
    </section>
  );
}
