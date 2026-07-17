import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  LayoutList,
  LockKeyhole,
  MessageCircle,
  MapPin,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
  X,
  XCircle,
  Bookmark,
  BookmarkPlus,
  Copy,
  DollarSign,
  ListTodo,
  Phone,
  StickyNote,
  Zap,
  ClipboardCheck,
  Navigation,
} from "lucide-react";
import type { Job, JobId, Role } from "../../types";
import { difficultyOptions, tradeOptions, workTypeOptions } from "../../data";
import { EmptyState, StatusPill } from "../../components/ui";
import { useFocusTrap } from "../../app-shell/useFocusTrap";
import { usePersona } from "../persona/usePersona";
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
  type CompensationUnit,
} from "./job-api";
import "./work-workspace.css";
import { JobDetailHub } from "../jobs/JobDetailHub";
import { getProjectForActiveWork, type ProjectRecord } from "../tools/project-api";
import { JobCloseoutPanel } from "./JobCloseoutPanel";

type TradeFilter = (typeof tradeOptions)[number];
type DifficultyFilter = (typeof difficultyOptions)[number];
type WorkTypeFilter = (typeof workTypeOptions)[number];
type DetailTab = "overview" | "requirements" | "activity" | "changes" | "checklist" | "payments" | "notes" | "contacts";
type WorkspaceTab = "today" | "job" | "activity" | "money" | "more";
type WorkStage = "browse" | "hiring" | "active" | "archive";
type ContractorSection = "open" | "draft" | "paused" | "closed" | "pipeline" | "calendar" | "templates";
type JobAction = "publish" | "pause" | "resume" | "close";

interface WorkWorkspaceProps {
  role: Role;
  jobs: Job[];
  activeWorkRecords?: CanonicalActiveWork[];
  focusedActiveWorkId?: string | null;
  openDetailOnMount?: boolean;
  openCloseoutOnMount?: boolean;
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
  onOpenPeople: () => void;
  onEditJob: (job: Job) => void;
  onTransition: (job: Job, action: JobAction) => Promise<void>;
  onJobLoaded: (job: Job) => void;
  onOpenTool: (tool: "daily-log" | "estimate" | "invoice" | "job-photos", activeWorkId?: string) => void;
  onOpenActiveWorkWorkspace: (activeWorkId: string, fallbackJobId?: string | null) => void;
  onOpenActiveWorkMessages: (activeWorkId: string) => void;
  onRetry: () => void;
  onOfferAccepted?: (activeWork: CanonicalActiveWork) => void;
  onActiveWorkChanged?: () => void;
}

const statusForSection: Partial<Record<ContractorSection, Job["status"]>> = {
  open: "Open",
  draft: "Draft",
  paused: "Paused",
  closed: "Closed",
};

function hasText(value: unknown, minLength = 1) {
  return typeof value === "string" && value.trim().length >= minLength;
}

function formatBlockerList(items: string[]) {
  if (items.length <= 3) return items.join(", ");
  return `${items.slice(0, 3).join(", ")} and ${items.length - 3} more`;
}

function formatPublishReadiness(items: string[]) {
  const shortLabels = items.map((item) => {
    if (item.startsWith("short summary")) return "summary";
    if (item.startsWith("detailed scope")) return "scope";
    if (item === "public city and state") return "city/state";
    if (item === "exact jobsite address") return "address";
    if (item === "future application deadline") return "deadline";
    if (item === "server-backed draft record") return "saved draft";
    return item;
  });
  return `Add ${formatBlockerList(shortLabels)} before publishing.`;
}

function getPublishBlockers(job: Job) {
  const blockers: string[] = [];
  const canonical = job.canonical;
  const privateLocation = canonical?.privateLocation;

  if (!canonical?.id) blockers.push("server-backed draft record");
  if (!hasText(job.title)) blockers.push("job title");
  if (!hasText(canonical?.tradeCode)) blockers.push("trade");
  if (!hasText(job.summary, 20)) blockers.push("short summary (20+ characters)");
  if (!hasText(canonical?.scopeDescription, 20)) blockers.push("detailed scope (20+ characters)");
  if (["fixed", "hourly"].includes(canonical?.compensationType ?? "fixed") && (!Number.isFinite(job.pay) || job.pay <= 0)) blockers.push("pay");
  if (!Number.isFinite(job.durationHours) || job.durationHours <= 0) blockers.push("duration");
  if (!hasText(canonical?.publicLocation?.city) || !hasText(canonical?.publicLocation?.region)) {
    blockers.push("public city and state");
  }
  if (
    !privateLocation ||
    !hasText(privateLocation.addressLine1) ||
    !hasText(privateLocation.city) ||
    !hasText(privateLocation.region) ||
    !hasText(privateLocation.postalCode)
  ) {
    blockers.push("exact jobsite address");
  }
  if (canonical?.applicationDeadline) {
    const deadline = new Date(canonical.applicationDeadline);
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now()) {
      blockers.push("future application deadline");
    }
  }

  return blockers;
}

function normalizeOfferDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const directMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (directMatch) return directMatch[0];
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function offerStartDateFor(job: Job, application: CanonicalApplication) {
  return normalizeOfferDate(application.proposedStartDate) ?? normalizeOfferDate(job.canonical?.preferredStartDate);
}

function formatOfferStartDate(value: string | null) {
  if (!value) return "No start date set";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function compensationLabel(job: Job) {
  const type = job.canonical?.compensationType ?? "fixed";
  if (type === "request_quotes") return "Request quotes";
  if (type === "open_to_offers") return job.pay > 0 ? `${money(job.pay)} target · open to offers` : "Open to offers";
  if (type === "hourly") return job.pay > 0 ? `${money(job.pay)}/hr` : "Hourly rate not set";
  return job.pay > 0 ? money(job.pay) : "Price not set";
}

function compensationAmount(offer: CanonicalOffer) {
  if (!offer.agreedCompensation) return "Terms not set";
  const amount = money(offer.agreedCompensation.amountCents / 100);
  return offer.agreedCompensation.unit === "hourly" ? `${amount}/hr` : amount;
}

// ── Change Order Tracker ──────────────────────────────────────────────────────

const changeOrderKey = "rivt.changeOrders.v1";

type ChangeOrderStatus = "pending" | "approved" | "rejected";

interface ChangeOrder {
  id: string;
  jobId: number;
  description: string;
  requestedBy: string;
  costDelta: number;
  status: ChangeOrderStatus;
  createdAt: string;
}

function readChangeOrders(jobId: number): ChangeOrder[] {
  try {
    const stored = localStorage.getItem(changeOrderKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ChangeOrder[];
    return Array.isArray(parsed) ? parsed.filter((c) => c.jobId === jobId) : [];
  } catch { return []; }
}

function persistChangeOrders(jobId: number, updated: ChangeOrder[]) {
  try {
    const stored = localStorage.getItem(changeOrderKey);
    const all: ChangeOrder[] = stored ? (JSON.parse(stored) as ChangeOrder[]) : [];
    const others = Array.isArray(all) ? all.filter((c) => c.jobId !== jobId) : [];
    localStorage.setItem(changeOrderKey, JSON.stringify([...others, ...updated].slice(0, 200)));
  } catch { /* noop */ }
}

function BudgetTracker({ jobId, budget }: { jobId: number; budget: number }) {
  const expenses = useMemo(() => {
    try {
      const stored = localStorage.getItem("rivt.expenses.v1");
      if (!stored) return [] as Array<{ jobId: number | null; amount: number; category: string; description: string; date: string }>;
      const parsed = JSON.parse(stored) as Array<{ jobId: number | null; amount: number; category: string; description: string; date: string }>;
      return Array.isArray(parsed) ? parsed.filter((e) => e.jobId === jobId) : [];
    } catch { return []; }
  }, [jobId]);

  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget - spent;
  const pct = Math.min(100, budget > 0 ? Math.round((spent / budget) * 100) : 0);
  const over = spent > budget;

  return (
    <div className="v2-budget-tracker">
      <div className="v2-budget-bar-wrap">
        <div className="v2-budget-bar">
          <div className={over ? "v2-budget-bar-fill is-over" : "v2-budget-bar-fill"} style={{ width: `${pct}%` }} />
        </div>
        <span>{pct}%</span>
      </div>
      <div className="v2-budget-facts">
        <div><span>Budget</span><strong>{money(budget)}</strong></div>
        <div><span>Logged costs</span><strong>{money(spent)}</strong></div>
        <div className={over ? "is-over" : ""}><span>Remaining</span><strong>{over ? `${money(Math.abs(remaining))} over` : money(remaining)}</strong></div>
      </div>
      {expenses.length ? (
        <div className="v2-budget-expenses">
          {expenses.slice(0, 4).map((e, i) => (
            <div key={i} className="v2-budget-expense-row">
              <span>{e.description}</span>
              <small>{e.category} · {e.date}</small>
              <strong>{money(e.amount)}</strong>
            </div>
          ))}
          {expenses.length > 4 ? <small className="v2-muted-copy">and {expenses.length - 4} more · open Expense Logger in Tools</small> : null}
        </div>
      ) : <p className="v2-muted-copy">No costs logged yet. Use the Expense Logger in Tools to track spending.</p>}
    </div>
  );
}

function ChangeOrderTracker({ jobId, jobTitle }: { jobId: number; jobTitle: string }) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>(() => readChangeOrders(jobId));
  const [description, setDescription] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [costDelta, setCostDelta] = useState("");
  const [notice, setNotice] = useState("");

  function addChangeOrder() {
    if (!description.trim()) return;
    const co: ChangeOrder = {
      id: crypto.randomUUID(),
      jobId,
      description: description.trim(),
      requestedBy: requestedBy.trim() || "Not specified",
      costDelta: parseFloat(costDelta) || 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const next = [co, ...changeOrders];
    setChangeOrders(next);
    persistChangeOrders(jobId, next);
    setDescription("");
    setRequestedBy("");
    setCostDelta("");
    setNotice("Change order logged.");
    setTimeout(() => setNotice(""), 3000);
  }

  function updateStatus(id: string, status: ChangeOrderStatus) {
    const next = changeOrders.map((co) => co.id === id ? { ...co, status } : co);
    setChangeOrders(next);
    persistChangeOrders(jobId, next);
  }

  function deleteChangeOrder(id: string) {
    const next = changeOrders.filter((co) => co.id !== id);
    setChangeOrders(next);
    persistChangeOrders(jobId, next);
  }

  const approvedDelta = changeOrders.filter((co) => co.status === "approved").reduce((sum, co) => sum + co.costDelta, 0);

  return (
    <div className="v2-change-orders">
      <div className="v2-change-order-form">
        <h3>Log a change order for {jobTitle}</h3>
        <div className="v2-change-order-inputs">
          <label className="is-wide">What changed
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Describe the scope change or addition..." />
          </label>
          <label>Requested by<input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Owner, GC, inspector..." /></label>
          <label>Cost delta ($)<input type="number" value={costDelta} onChange={(e) => setCostDelta(e.target.value)} placeholder="0 (negative = reduction)" /></label>
        </div>
        {notice ? <p className="v2-match-error" style={{ color: "var(--v2-accent)" }} role="status">{notice}</p> : null}
        <button type="button" className="v2-primary-button" disabled={!description.trim()} onClick={addChangeOrder}><Plus size={14} />Log change order</button>
      </div>
      {approvedDelta !== 0 ? (
        <div className="v2-co-approved-delta">
          <span>Approved scope delta</span>
          <strong className={approvedDelta < 0 ? "is-negative" : ""}>{approvedDelta > 0 ? "+" : ""}{money(approvedDelta)}</strong>
        </div>
      ) : null}
      {changeOrders.length ? (
        <div className="v2-change-order-list">
          {changeOrders.map((co) => (
            <article key={co.id} className={`v2-co-card co-status-${co.status}`}>
              <div className="v2-co-card-header">
                <span className={`v2-co-pill co-status-${co.status}`}>{co.status}</span>
                <small>{new Date(co.createdAt).toLocaleDateString()}</small>
                <button type="button" aria-label="Delete" onClick={() => deleteChangeOrder(co.id)}><Trash2 size={13} /></button>
              </div>
              <p>{co.description}</p>
              <div className="v2-co-meta">
                <span>By: {co.requestedBy}</span>
                {co.costDelta !== 0 ? <strong className={co.costDelta < 0 ? "is-negative" : ""}>{co.costDelta > 0 ? "+" : ""}{money(co.costDelta)}</strong> : null}
              </div>
              {co.status === "pending" ? (
                <div className="v2-co-actions">
                  <button type="button" className="v2-primary-button" onClick={() => updateStatus(co.id, "approved")}>Approve</button>
                  <button type="button" onClick={() => updateStatus(co.id, "rejected")}>Reject</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : <p className="v2-muted-copy">No change orders logged for this job yet.</p>}
    </div>
  );
}

interface PipelineEntry {
  jobId: number;
  jobTitle: string;
  app: CanonicalApplication;
}

function PipelineBoard({ openJobs, onOpenJob }: { openJobs: Job[]; onOpenJob: (jobId: JobId) => void }) {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const canonicalJobs = openJobs.filter((j) => j.canonical?.id);
    if (!canonicalJobs.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.allSettled(
      canonicalJobs.map((j) =>
        listJobApplications(j.canonical!.id).then((apps) =>
          apps.map((app): PipelineEntry => ({ jobId: j.id, jobTitle: j.title, app }))
        )
      )
    ).then((results) => {
      setEntries(results.flatMap((r) => r.status === "fulfilled" ? r.value : []));
    }).finally(() => setLoading(false));
  }, [openJobs]);

  const STAGES = ["submitted", "shortlisted", "offered"] as const;
  const STAGE_LABELS: Record<string, string> = { submitted: "Applied", shortlisted: "Shortlisted", offered: "Offered" };

  return (
    <div className="v2-pipeline-board">
      <div className="v2-pipeline-board-header">
        <div>
          <h2>Applicant pipeline</h2>
          <p>All applicants across your open jobs, grouped by stage.</p>
        </div>
        {loading ? <small>Loading applicants…</small> : <small>{entries.length} total applicant{entries.length !== 1 ? "s" : ""}</small>}
      </div>
      {!loading && entries.length === 0 ? (
        <div className="v2-work-empty" style={{ textAlign: "center", padding: "48px 24px" }}>
          <Users size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <strong>No applicants across open jobs yet</strong>
          <span style={{ display: "block", marginTop: 8, color: "var(--v2-text-muted)", fontSize: 13 }}>Tradespeople who apply to your published jobs will appear here by stage.</span>
        </div>
      ) : (
        <div className="v2-pipeline-columns">
          {STAGES.map((stage) => {
            const stageEntries = entries.filter((e) => e.app.status === stage);
            return (
              <div key={stage} className="v2-pipeline-column">
                <div className="v2-pipeline-col-header">
                  <strong>{STAGE_LABELS[stage]}</strong>
                  <span className="v2-pipeline-count">{stageEntries.length}</span>
                </div>
                <div className="v2-pipeline-col-body">
                  {stageEntries.map(({ app, jobId, jobTitle }) => (
                    <button type="button" key={app.id} className="v2-pipeline-card" onClick={() => onOpenJob(jobId)}>
                      <div className="v2-pipeline-card-avatar">{(app.applicant?.displayName || "?")[0].toUpperCase()}</div>
                      <div>
                        <strong>{app.applicant?.displayName || "Tradesperson"}</strong>
                        <small>{jobTitle}</small>
                        {app.applicant?.headline ? <span>{app.applicant.headline}</span> : null}
                      </div>
                    </button>
                  ))}
                  {stageEntries.length === 0 ? <p className="v2-pipeline-empty">None yet</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CAL_MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const CAL_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function WorkCalendar({ jobs }: { jobs: Job[] }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const display = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const firstDay = display.getDay();
  const daysInMonth = new Date(display.getFullYear(), display.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const openJobs = jobs.filter((j) => j.status === "Open");
  const draftJobs = jobs.filter((j) => j.status === "Draft");
  const pausedJobs = jobs.filter((j) => j.status === "Paused");
  const closedJobs = jobs.filter((j) => j.status === "Closed");

  return (
    <div className="v2-work-calendar">
      <div className="v2-work-cal-header">
        <button type="button" onClick={() => setOffset((o) => o - 1)}>‹</button>
        <strong>{CAL_MONTHS[display.getMonth()]} {display.getFullYear()}</strong>
        <button type="button" onClick={() => setOffset((o) => o + 1)}>›</button>
      </div>
      <div className="v2-work-cal-weekdays">
        {CAL_DAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="v2-work-cal-grid">
        {cells.map((day, i) => {
          const isToday = day !== null && offset === 0 && day === now.getDate();
          return (
            <div key={i} className={`v2-work-cal-cell${day ? "" : " is-empty"}${isToday ? " is-today" : ""}`}>
              {day ? <span>{day}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="v2-work-cal-jobs">
        <h3>Active jobs</h3>
        {[
          ...openJobs.map((j) => ({ job: j, cls: "open" })),
          ...draftJobs.map((j) => ({ job: j, cls: "draft" })),
          ...pausedJobs.map((j) => ({ job: j, cls: "paused" })),
          ...closedJobs.map((j) => ({ job: j, cls: "closed" })),
        ].map(({ job, cls }) => (
          <div key={job.id} className={`v2-work-cal-job-row cal-status-${cls}`}>
            <span className="v2-work-cal-dot" />
            <div>
              <strong>{job.title}</strong>
              <small>{job.location} · {job.status} · {job.trade}</small>
            </div>
          </div>
        ))}
        {!jobs.length ? <p className="v2-muted-copy">No jobs yet.</p> : null}
      </div>
    </div>
  );
}

// ── Contractor Stats Bar ──────────────────────────────────────────────────────

const savedSearchKey = "rivt.savedSearches.v1";

interface SavedSearch {
  id: string;
  label: string;
  query: string;
  trade: string;
  difficulty: string;
  workType: string;
  location: string;
  createdAt: string;
}

function readSavedSearches(): SavedSearch[] {
  try {
    const stored = localStorage.getItem(savedSearchKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedSearch[];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch { return []; }
}

function persistSavedSearches(searches: SavedSearch[]) {
  try { localStorage.setItem(savedSearchKey, JSON.stringify(searches.slice(0, 10))); } catch { /* noop */ }
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

function readChecklist(jobId: number): ChecklistItem[] {
  try {
    const stored = localStorage.getItem(`rivt.checklist.${jobId}.v1`);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ChecklistItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistChecklist(jobId: number, items: ChecklistItem[]) {
  try { localStorage.setItem(`rivt.checklist.${jobId}.v1`, JSON.stringify(items)); } catch { /* noop */ }
}

function JobChecklist({ jobId }: { jobId: number }) {
  const [items, setItems] = useState<ChecklistItem[]>(() => readChecklist(jobId));
  const [newText, setNewText] = useState("");

  function addItem() {
    if (!newText.trim()) return;
    const item: ChecklistItem = {
      id: crypto.randomUUID(),
      text: newText.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    };
    const next = [...items, item];
    setItems(next);
    persistChecklist(jobId, next);
    setNewText("");
  }

  function toggleItem(id: string) {
    const next = items.map((i) => i.id === id ? { ...i, done: !i.done } : i);
    setItems(next);
    persistChecklist(jobId, next);
  }

  function deleteItem(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    persistChecklist(jobId, next);
  }

  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="v2-job-checklist">
      {items.length > 0 ? (
        <div className="v2-checklist-progress">
          <div className="v2-checklist-bar">
            <div className="v2-checklist-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span>{doneCount}/{items.length} done</span>
        </div>
      ) : null}
      <div className="v2-checklist-add">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
          placeholder="Add a punch list item…"
        />
        <button type="button" className="v2-primary-button" disabled={!newText.trim()} onClick={addItem}>
          <Plus size={14} />Add
        </button>
      </div>
      {items.length ? (
        <div className="v2-checklist-list">
          {items.map((item) => (
            <div key={item.id} className={`v2-checklist-item${item.done ? " is-done" : ""}`}>
              <button type="button" className="v2-checklist-check" onClick={() => toggleItem(item.id)} aria-pressed={item.done}>
                <Check size={13} />
              </button>
              <span>{item.text}</span>
              <button type="button" className="v2-checklist-delete" aria-label="Delete item" onClick={() => deleteItem(item.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="v2-muted-copy">No checklist items yet. Add punch list items above.</p>
      )}
    </div>
  );
}

// ── Payment Milestones ────────────────────────────────────────────────────────

type MilestoneStatus = "pending" | "paid" | "overdue";

interface PaymentMilestone {
  id: string;
  label: string;
  amount: number;
  dueNote: string;
  status: MilestoneStatus;
  createdAt: string;
}

function readMilestones(jobId: number): PaymentMilestone[] {
  try {
    const stored = localStorage.getItem(`rivt.milestones.${jobId}.v1`);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as PaymentMilestone[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistMilestones(jobId: number, items: PaymentMilestone[]) {
  try { localStorage.setItem(`rivt.milestones.${jobId}.v1`, JSON.stringify(items)); } catch { /* noop */ }
}

function PaymentMilestones({ jobId, jobPay }: { jobId: number; jobPay: number }) {
  const [milestones, setMilestones] = useState<PaymentMilestone[]>(() => readMilestones(jobId));
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dueNote, setDueNote] = useState("");

  function addMilestone() {
    if (!label.trim()) return;
    const m: PaymentMilestone = {
      id: crypto.randomUUID(),
      label: label.trim(),
      amount: parseFloat(amount) || 0,
      dueNote: dueNote.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const next = [...milestones, m];
    setMilestones(next);
    persistMilestones(jobId, next);
    setLabel("");
    setAmount("");
    setDueNote("");
  }

  function markStatus(id: string, status: MilestoneStatus) {
    const next = milestones.map((m) => m.id === id ? { ...m, status } : m);
    setMilestones(next);
    persistMilestones(jobId, next);
  }

  function deleteMilestone(id: string) {
    const next = milestones.filter((m) => m.id !== id);
    setMilestones(next);
    persistMilestones(jobId, next);
  }

  const totalScheduled = milestones.reduce((sum, m) => sum + m.amount, 0);
  const totalPaid = milestones.filter((m) => m.status === "paid").reduce((sum, m) => sum + m.amount, 0);

  function moneyMs(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

  return (
    <div className="v2-payment-milestones">
      {milestones.length > 0 ? (
        <div className="v2-milestone-summary">
          {jobPay > 0 ? <div><span>Job budget</span><strong>{moneyMs(jobPay)}</strong></div> : null}
          <div><span>Scheduled</span><strong>{moneyMs(totalScheduled)}</strong></div>
          <div><span>Collected</span><strong className="is-paid">{moneyMs(totalPaid)}</strong></div>
        </div>
      ) : null}
      <div className="v2-milestone-form">
        <h3>Add milestone</h3>
        <div className="v2-milestone-inputs">
          <label>Label<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Deposit, Midpoint, Final…" /></label>
          <label>Amount ($)<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
          <label>Due when<input value={dueNote} onChange={(e) => setDueNote(e.target.value)} placeholder="On signing, 50% complete…" /></label>
        </div>
        <button type="button" className="v2-primary-button" disabled={!label.trim()} onClick={addMilestone}><DollarSign size={14} />Add milestone</button>
      </div>
      {milestones.length ? (
        <div className="v2-milestone-list">
          {milestones.map((m) => (
            <article key={m.id} className={`v2-milestone-card ms-status-${m.status}`}>
              <div className="v2-milestone-card-head">
                <span className={`v2-ms-pill ms-status-${m.status}`}>{m.status}</span>
                <strong>{m.label}</strong>
                <strong>{moneyMs(m.amount)}</strong>
                <button type="button" aria-label="Delete milestone" onClick={() => deleteMilestone(m.id)}><Trash2 size={13} /></button>
              </div>
              {m.dueNote ? <small>{m.dueNote}</small> : null}
              {m.status === "pending" ? (
                <div className="v2-milestone-actions">
                  <button type="button" className="v2-primary-button" onClick={() => markStatus(m.id, "paid")}><Check size={13} />Mark paid</button>
                  <button type="button" onClick={() => markStatus(m.id, "overdue")}>Mark overdue</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : <p className="v2-muted-copy">No payment milestones set. Add deposit, midpoint, and final amounts above.</p>}
    </div>
  );
}

// ── Job Notes ─────────────────────────────────────────────────────────────────

interface JobNote {
  id: string;
  text: string;
  createdAt: string;
}

function readJobNotes(jobId: number): JobNote[] {
  try {
    const stored = localStorage.getItem(`rivt.notes.${jobId}.v1`);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as JobNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistJobNotes(jobId: number, notes: JobNote[]) {
  try { localStorage.setItem(`rivt.notes.${jobId}.v1`, JSON.stringify(notes.slice(0, 100))); } catch { /* noop */ }
}

function JobNotes({ jobId }: { jobId: number }) {
  const [notes, setNotes] = useState<JobNote[]>(() => readJobNotes(jobId));
  const [text, setText] = useState("");

  function addNote() {
    if (!text.trim()) return;
    const note: JobNote = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString() };
    const next = [note, ...notes];
    setNotes(next);
    persistJobNotes(jobId, next);
    setText("");
  }

  function deleteNote(id: string) {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    persistJobNotes(jobId, next);
  }

  return (
    <div className="v2-job-notes">
      <div className="v2-job-note-form">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Add a note, decision, or field observation…" />
        <button type="button" className="v2-primary-button" disabled={!text.trim()} onClick={addNote}><StickyNote size={14} />Add note</button>
      </div>
      {notes.length ? (
        <div className="v2-job-note-list">
          {notes.map((note) => (
            <article key={note.id} className="v2-job-note-card">
              <div className="v2-job-note-card-head">
                <small>{new Date(note.createdAt).toLocaleString()}</small>
                <button type="button" aria-label="Delete note" onClick={() => deleteNote(note.id)}><Trash2 size={13} /></button>
              </div>
              <p>{note.text}</p>
            </article>
          ))}
        </div>
      ) : <p className="v2-muted-copy">No notes yet. Add field notes, decisions, and observations above.</p>}
    </div>
  );
}

// ── Site Contacts ─────────────────────────────────────────────────────────────

const CONTACT_ROLES = ["GC", "Owner", "Inspector", "Supplier", "Sub", "Other"] as const;
type ContactRole = (typeof CONTACT_ROLES)[number];

interface SiteContact {
  id: string;
  role: ContactRole;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

function readSiteContacts(jobId: number): SiteContact[] {
  try {
    const stored = localStorage.getItem(`rivt.contacts.${jobId}.v1`);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SiteContact[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistSiteContacts(jobId: number, contacts: SiteContact[]) {
  try { localStorage.setItem(`rivt.contacts.${jobId}.v1`, JSON.stringify(contacts.slice(0, 50))); } catch { /* noop */ }
}

function SiteContacts({ jobId }: { jobId: number }) {
  const [contacts, setContacts] = useState<SiteContact[]>(() => readSiteContacts(jobId));
  const [role, setRole] = useState<ContactRole>("GC");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [_copiedId, setCopiedId] = useState("");

  function addContact() {
    if (!name.trim()) return;
    const contact: SiteContact = {
      id: crypto.randomUUID(),
      role,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
    };
    const next = [...contacts, contact];
    setContacts(next);
    persistSiteContacts(jobId, next);
    setName(""); setPhone(""); setEmail(""); setNotes("");
  }

  function removeContact(id: string) {
    const next = contacts.filter((c) => c.id !== id);
    setContacts(next);
    persistSiteContacts(jobId, next);
  }

  async function copyContact(c: SiteContact) {
    const text = [c.name, c.role, c.phone, c.email, c.notes].filter(Boolean).join(" · ");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(""), 2000);
    } catch { /* noop */ }
  }

  return (
    <div className="v2-site-contacts">
      <div className="v2-site-contact-form">
        <div className="v2-site-contact-inputs">
          <label>Role
            <select value={role} onChange={(e) => setRole(e.target.value as ContactRole)}>
              {CONTACT_ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name or company" /></label>
          <label>Phone<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 904 555 0123" /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
        </div>
        <input className="v2-site-contact-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (hours, gate code, preferred contact method…)" />
        <button type="button" className="v2-primary-button" disabled={!name.trim()} onClick={addContact}><Plus size={14} />Add contact</button>
      </div>
      {contacts.length ? (
        <div className="v2-site-contact-list">
          {contacts.map((c) => (
            <article key={c.id} className="v2-site-contact-card">
              <div className="v2-site-contact-card-head">
                <span className="v2-contact-role-pill">{c.role}</span>
                <strong>{c.name}</strong>
                <button type="button" title="Copy contact" onClick={() => void copyContact(c)}>
                  <Copy size={13} />
                </button>
                <button type="button" aria-label="Delete contact" onClick={() => removeContact(c.id)}><Trash2 size={13} /></button>
              </div>
              <div className="v2-site-contact-links">
                {c.phone ? <a href={`tel:${c.phone}`} className="v2-contact-link"><Phone size={13} />{c.phone}</a> : null}
                {c.email ? <a href={`mailto:${c.email}`} className="v2-contact-link">{c.email}</a> : null}
              </div>
              {c.notes ? <small>{c.notes}</small> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="v2-muted-copy">No site contacts yet. Add GC, owner, inspector, and supplier contacts here for quick access on the job.</p>
      )}
    </div>
  );
}

// ── Job Templates ─────────────────────────────────────────────────────────────

const jobTemplateKey = "rivt.jobTemplates.v1";

interface JobTemplate {
  id: string;
  name: string;
  title: string;
  trade: string;
  summary: string;
  workType: string;
  durationHours: number;
  pay: number;
  tools: string[];
  deliverables: string[];
  savedAt: string;
}

function readJobTemplates(): JobTemplate[] {
  try {
    const stored = localStorage.getItem(jobTemplateKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as JobTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistJobTemplates(templates: JobTemplate[]) {
  try { localStorage.setItem(jobTemplateKey, JSON.stringify(templates.slice(0, 20))); } catch { /* noop */ }
}

function saveJobAsTemplate(job: Job): string {
  const template: JobTemplate = {
    id: crypto.randomUUID(),
    name: `${job.title} template`,
    title: job.title,
    trade: job.trade,
    summary: job.summary,
    workType: job.workType,
    durationHours: job.durationHours,
    pay: job.pay,
    tools: job.tools,
    deliverables: job.deliverables,
    savedAt: new Date().toISOString(),
  };
  const existing = readJobTemplates();
  const next = [template, ...existing.filter((t) => t.title !== job.title)].slice(0, 20);
  persistJobTemplates(next);
  return template.name;
}

function JobTemplates({ onPostJob }: { onPostJob: () => void }) {
  const [templates, setTemplates] = useState<JobTemplate[]>(readJobTemplates);
  const [selected, setSelected] = useState<JobTemplate | null>(null);
  const [copiedId, setCopiedId] = useState("");

  function deleteTemplate(id: string) {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    persistJobTemplates(next);
    if (selected?.id === id) setSelected(null);
  }

  async function copyTemplate(t: JobTemplate) {
    const text = [
      `Job: ${t.title}`,
      `Trade: ${t.trade}`,
      `Work type: ${t.workType}`,
      `Duration: ${t.durationHours}h`,
      t.pay > 0 ? `Budget: $${t.pay}` : "",
      `Summary: ${t.summary}`,
      t.tools.length ? `Tools: ${t.tools.join(", ")}` : "",
      t.deliverables.length ? `Deliverables: ${t.deliverables.join(", ")}` : "",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(""), 2000);
    } catch { /* noop */ }
  }

  function moneyT(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

  if (!templates.length) {
    return (
      <div className="v2-templates-empty">
        <FileText size={32} />
        <strong>No templates yet</strong>
        <span>Save any job posting as a template using the "Save as template" button in the job detail footer. Templates let you quickly re-post similar work.</span>
        <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={16} />Create a job first</button>
      </div>
    );
  }

  return (
    <div className="v2-templates-layout">
      <div className="v2-templates-list">
        {templates.map((t) => (
          <button key={t.id} type="button" className={`v2-template-row${selected?.id === t.id ? " is-selected" : ""}`} onClick={() => setSelected(t)}>
            <div>
              <strong>{t.name}</strong>
              <small>{t.trade} · {t.workType} · {t.durationHours}h{t.pay > 0 ? ` · ${moneyT(t.pay)}` : ""}</small>
            </div>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
      {selected ? (
        <article className="v2-template-detail">
          <div className="v2-template-detail-head">
            <div>
              <span className="v2-detail-trade">{selected.trade}</span>
              <h3>{selected.title}</h3>
            </div>
            <div className="v2-template-detail-actions">
              <button type="button" onClick={() => void copyTemplate(selected)}>{copiedId === selected.id ? <Check size={14} /> : <Copy size={14} />} Copy details</button>
              <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={14} />Post new job</button>
              <button type="button" className="v2-destructive-button" onClick={() => deleteTemplate(selected.id)}><Trash2 size={14} />Delete</button>
            </div>
          </div>
          <p>{selected.summary}</p>
          <div className="v2-detail-facts">
            <DetailFact icon={CircleDollarSign} label="Budget" value={selected.pay > 0 ? moneyT(selected.pay) : "Not set"} />
            <DetailFact icon={CalendarClock} label="Duration" value={selected.durationHours > 0 ? `${selected.durationHours} hours` : "Not set"} />
            <DetailFact icon={BriefcaseBusiness} label="Work type" value={selected.workType} />
          </div>
          {selected.tools.length ? <section className="v2-detail-section"><h3>Tools</h3><ul>{selected.tools.map((t) => <li key={t}><Wrench size={14} /> {t}</li>)}</ul></section> : null}
          {selected.deliverables.length ? <section className="v2-detail-section"><h3>Deliverables</h3><ul>{selected.deliverables.map((d) => <li key={d}><Check size={14} /> {d}</li>)}</ul></section> : null}
          <p className="v2-muted-copy" style={{ marginTop: 16 }}>Saved {new Date(selected.savedAt).toLocaleDateString()}. Click "Post new job" to create a fresh posting, then copy the details from here.</p>
        </article>
      ) : (
        <div className="v2-template-detail-placeholder">
          <FileText size={28} />
          <span>Select a template to preview it</span>
        </div>
      )}
    </div>
  );
}

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
    <div className={["v2-job-row", selected ? "is-selected" : ""].filter(Boolean).join(" ")}>
      <div className="v2-job-row-content">
        <button
          type="button"
          className="v2-job-row-inner"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <span className="v2-job-row-main">
            <span className="v2-job-row-meta">{job.trade} · {job.location}</span>
            <strong>{job.title}</strong>
            <span className="v2-job-row-summary">{job.summary}</span>
            <span className="v2-job-row-facts">
              <span>{compensationLabel(job)}</span>
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
        <div className="v2-job-row-footer">
          {role !== "contractor" && job.status === "Open" ? (
            <button
              type="button"
              className="v2-quick-apply-btn"
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
            >
              <Zap size={12} />View & apply
            </button>
          ) : null}
        </div>
      </div>
    </div>
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
    pipeline: { title: "No applicants yet", body: "Tradespeople who apply to your open jobs will appear here by stage." },
    calendar: { title: "No jobs yet", body: "Create and publish jobs to see them on the calendar." },
    templates: { title: "No templates yet", body: "Save a job as a template to quickly re-post similar work." },
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

function numericJobIdFromCanonicalId(jobId: string) {
  const parsed = Number.parseInt(jobId.replaceAll("-", "").slice(0, 12), 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeWorkSummaryJob(work: CanonicalActiveWork): Job | null {
  if (!work.job) return null;
  const location = [work.job.publicLocation.city, work.job.publicLocation.region].filter(Boolean).join(", ");
  return {
    id: numericJobIdFromCanonicalId(work.jobId),
    title: work.job.title,
    contractor: work.job.organization.name,
    trade: "General Labor",
    location,
    state: work.job.publicLocation.region,
    distance: 0,
    pay: 0,
    durationHours: 0,
    workType: "Side work",
    difficulty: "Moderate",
    insuranceRequired: false,
    tools: [],
    trustRequirement: "Legal agreement required",
    addressPolicy: "Exact address is shared only after an accepted work relationship.",
    posted: "Active",
    match: 0,
    rating: 0,
    reviewCount: 0,
    applicants: 0,
    status: "Scheduled",
    summary: "Accepted active work.",
    guidance: [],
    risks: [],
    deliverables: [],
    matchFactors: [],
  };
}

export function WorkWorkspace({
  role,
  jobs,
  activeWorkRecords = [],
  focusedActiveWorkId = null,
  openDetailOnMount = false,
  openCloseoutOnMount = false,
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
  onOpenPeople,
  onEditJob,
  onTransition,
  onJobLoaded,
  onOpenTool,
  onOpenActiveWorkWorkspace,
  onOpenActiveWorkMessages,
  onRetry,
  onOfferAccepted,
  onActiveWorkChanged,
}: WorkWorkspaceProps) {
  const persona = usePersona();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() => Boolean(openDetailOnMount));
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(() => focusedActiveWorkId ? "today" : "job");
  const [workspaceArrivalVisible, setWorkspaceArrivalVisible] = useState(() => Boolean(openDetailOnMount && focusedActiveWorkId));
  const [workStage, setWorkStage] = useState<WorkStage>(() => focusedActiveWorkId ? "active" : "browse");
  const [contractorSection, setContractorSection] = useState<ContractorSection>("open");
  const [activeAction, setActiveAction] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [matchRefreshKey, setMatchRefreshKey] = useState(0);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState<{ kind: "reschedule" | "cancel"; target: CanonicalActiveWork } | null>(null);
  const reasonTrapRef = useFocusTrap<HTMLDivElement>(() => setReasonPrompt(null), reasonPrompt != null);
  const [reasonText, setReasonText] = useState("");
  const [matchApplications, setMatchApplications] = useState<CanonicalApplication[]>([]);
  const [matchOffers, setMatchOffers] = useState<CanonicalOffer[]>([]);
  const [matchActiveWork, setMatchActiveWork] = useState<CanonicalActiveWork[]>([]);
  const [stageApplications, setStageApplications] = useState<CanonicalApplication[]>([]);
  const [stageOffers, setStageOffers] = useState<CanonicalOffer[]>([]);
  const [stageHiringLoading, setStageHiringLoading] = useState(false);
  const [stageHiringError, setStageHiringError] = useState<string | null>(null);
  const [applicationMessage, setApplicationMessage] = useState("I am interested in this work and can confirm tools, timing, and site requirements.");
  const [applicationProposal, setApplicationProposal] = useState<{ jobId: string; amount: string; unit: CompensationUnit } | null>(null);
  const [offerDraft, setOfferDraft] = useState<{ applicationId: string; amount: string; unit: CompensationUnit } | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(readSavedSearches);
  const [savedSearchNotice, setSavedSearchNotice] = useState("");
  const [saveTemplateNotice, setSaveTemplateNotice] = useState("");
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [closeoutOpen, setCloseoutOpen] = useState(() => Boolean(openCloseoutOnMount));
  const [addressCopied, setAddressCopied] = useState(false);
  const detailHydrationRequests = useRef<Set<string>>(new Set());
  const workLayoutRef = useRef<HTMLDivElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);

  const visibleJobs = useMemo(() => {
    if (role !== "contractor") return workStage === "browse" ? jobs : [];
    if (workStage === "active") return [];
    if (workStage === "browse") return jobs.filter((job) => job.status === "Open");
    const status = statusForSection[contractorSection];
    return status ? jobs.filter((job) => job.status === status) : jobs;
  }, [contractorSection, jobs, role, workStage]);
  const activeWorkReady = useMemo(
    () => activeWorkRecords.filter((work) => work.status === "active"),
    [activeWorkRecords],
  );
  const focusedActiveWorkRecord = useMemo(
    () => (focusedActiveWorkId ? activeWorkRecords.find((work) => work.id === focusedActiveWorkId) ?? null : null),
    [activeWorkRecords, focusedActiveWorkId],
  );
  const primaryActiveWorkRecord = focusedActiveWorkRecord?.status === "active"
    ? focusedActiveWorkRecord
    : activeWorkReady[0] ?? null;
  const activeStageWorkRecord = focusedActiveWorkRecord?.status === "active"
    ? focusedActiveWorkRecord
    : activeWorkReady[0] ?? null;
  const focusedActiveJob = useMemo(() => {
    if (!focusedActiveWorkRecord) return null;
    const jobId = focusedActiveWorkRecord.jobId;
    return jobs.find((job) => job.canonical?.id === jobId || String(job.id) === jobId)
      ?? activeWorkSummaryJob(focusedActiveWorkRecord);
  }, [focusedActiveWorkRecord, jobs]);
  const activeStageJob = useMemo(() => {
    if (!activeStageWorkRecord) return null;
    return jobs.find((job) => job.canonical?.id === activeStageWorkRecord.jobId || String(job.id) === activeStageWorkRecord.jobId)
      ?? activeWorkSummaryJob(activeStageWorkRecord);
  }, [activeStageWorkRecord, jobs]);

  const activeFilterCount = [
    trade !== "All trades",
    difficulty !== "Any difficulty",
    workType !== "All work types",
    locationQuery.trim().length > 0,
    verifiedOnly,
  ].filter(Boolean).length;

  function selectWorkStage(stage: WorkStage) {
    setWorkStage(stage);
    setFiltersOpen(false);
    setMobileDetailOpen(stage === "active" && Boolean(activeStageWorkRecord));
    setWorkspaceTab(stage === "active" ? "today" : "job");
    setActionError(null);
    if (stage === "browse") setContractorSection("open");
    if (stage === "hiring" && !["draft", "pipeline", "calendar", "templates"].includes(contractorSection)) setContractorSection("draft");
    if (stage === "archive" && !["paused", "closed"].includes(contractorSection)) setContractorSection("closed");
  }

  function revealJobWorkspace(moveFocus = false) {
    window.requestAnimationFrame(() => {
      workLayoutRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      if (moveFocus) detailHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  function selectJob(jobId: JobId, revealWorkspace = false) {
    const selected = jobs.find((job) => job.id === jobId);
    const active = selected
      ? activeWorkRecords.some((work) => work.status === "active" && (work.jobId === selected.canonical?.id || work.jobId === String(selected.id)))
      : false;
    onSelectJob(jobId);
    setDetailTab("overview");
    setWorkspaceTab(active ? "today" : "job");
    setActionError(null);
    setMobileDetailOpen(true);
    if (revealWorkspace) revealJobWorkspace();
  }

  function openActiveWorkJob(work: CanonicalActiveWork) {
    // Use the route-level handoff so URL, hydration, selected job, and the
    // visible workspace agree even after the original job is closed to browsing.
    onOpenActiveWorkWorkspace(work.id, work.jobId);
  }

  async function openCanonicalJob(jobId: string) {
    const existing = jobs.find((job) => job.canonical?.id === jobId);
    setWorkStage("browse");
    if (existing) {
      selectJob(existing.id, true);
      return;
    }
    try {
      const loaded = toJobViewModel(await getJob(jobId));
      onJobLoaded(loaded);
      onSelectJob(loaded.id);
      setDetailTab("overview");
      setWorkspaceTab("job");
      setMobileDetailOpen(true);
      revealJobWorkspace();
    } catch (cause) {
      setStageHiringError(cause instanceof Error ? cause.message : "That job could not be opened.");
    }
  }

  async function runAction(job: Job, action: JobAction) {
    setActionError(null);
    if (action === "publish") {
      const blockers = getPublishBlockers(job);
      if (blockers.length > 0) {
        setActionError(`Finish before publishing: ${formatBlockerList(blockers)}.`);
        return;
      }
    }
    setActiveAction(`${job.id}:${action}`);
    try {
      await onTransition(job, action);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "This action failed. Refresh and try again.");
    } finally {
      setActiveAction("");
    }
  }

  async function handleSaveDraft(job: Job) {
    const jobId = job.canonical?.id;
    if (!jobId) return;
    const proposal = applicationProposal?.jobId === jobId ? applicationProposal : null;
    await runMatchAction(`draft:${jobId}`, async () => {
      await saveApplicationDraft(jobId, {
        message: applicationMessage,
        proposedAmountCents: proposal?.amount ? Math.round(Number(proposal.amount) * 100) : null,
        proposedUnit: proposal?.amount ? proposal.unit : null,
      });
    });
  }

  async function handleSubmitApplication(job: Job) {
    const jobId = job.canonical?.id;
    if (!jobId) return;
    const proposal = applicationProposal?.jobId === jobId ? applicationProposal : null;
    await runMatchAction(`apply:${jobId}`, async () => {
      await submitApplication(jobId, {
        message: applicationMessage,
        proposedAmountCents: proposal?.amount ? Math.round(Number(proposal.amount) * 100) : null,
        proposedUnit: proposal?.amount ? proposal.unit : null,
      });
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

  async function sendFinalOffer(job: Job, application: CanonicalApplication, amount: number, unit: CompensationUnit) {
    if (!Number.isFinite(amount) || amount <= 0) {
      setMatchError("Enter the final agreed pay before sending this offer.");
      return;
    }
    const startDate = offerStartDateFor(job, application);
    await runMatchAction(`offer:${application.id}`, async () => {
      await sendOffer(application.id, {
        startDate,
        scopeSummary: job.canonical?.scopeDescription || job.summary,
        message: `Offer for ${job.title}. Accept to unlock the exact jobsite and active work record.`,
        agreedAmountCents: Math.round(amount * 100),
        agreedUnit: unit,
      });
      setOfferDraft(null);
    });
  }

  async function handleSendOffer(job: Job, application: CanonicalApplication) {
    if (!offerDraft || offerDraft.applicationId !== application.id) {
      setMatchError("Set the final agreed pay before sending this offer.");
      return;
    }
    await sendFinalOffer(job, application, Number(offerDraft.amount), offerDraft.unit);
  }

  async function handleHireAtListedPrice(job: Job, application: CanonicalApplication) {
    await sendFinalOffer(job, application, job.pay, "fixed");
  }

  function prepareOffer(job: Job, application: CanonicalApplication) {
    const matchingRate = application.applicant?.rates.find((rate) => rate.tradeCode === job.canonical?.tradeCode)?.hourlyRateCents;
    const proposal = application.proposal;
    const unit = proposal?.unit ?? (job.canonical?.compensationType === "hourly" ? "hourly" : matchingRate ? "hourly" : "fixed");
    const cents = proposal?.amountCents ?? (job.pay > 0 ? job.pay * 100 : matchingRate ?? 0);
    setOfferDraft({ applicationId: application.id, amount: cents ? String(cents / 100) : "", unit });
    setMatchError(null);
  }

  async function handleAcceptOffer(offer: CanonicalOffer) {
    await runMatchAction(`accept:${offer.id}`, async () => {
      const accepted = await acceptOffer(offer.id, "Confirmed in RIVT.");
      setMatchOffers((current) => current.map((candidate) => (
        candidate.id === offer.id ? accepted.offer : candidate
      )));
      setMatchActiveWork((current) => [
        accepted.activeWork,
        ...current.filter((candidate) => candidate.id !== accepted.activeWork.id),
      ]);
      setWorkspaceTab("today");
      onOfferAccepted?.(accepted.activeWork);
      await refreshDetailJob();
      onActiveWorkChanged?.();
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
        onActiveWorkChanged?.();
      });
    } else {
      await runMatchAction(`cancel:${target.id}`, async () => {
        await cancelActiveWork(target.id, reason);
        onActiveWorkChanged?.();
      });
    }
  }

  function saveCurrentSearch() {
    if (!query.trim() && trade === "All trades" && difficulty === "Any difficulty" && workType === "All work types" && !locationQuery.trim()) return;
    const label = [query.trim(), trade !== "All trades" ? trade : "", locationQuery.trim()].filter(Boolean).join(" · ") || "Saved search";
    const search: SavedSearch = {
      id: crypto.randomUUID(),
      label,
      query,
      trade,
      difficulty,
      workType,
      location: locationQuery,
      createdAt: new Date().toISOString(),
    };
    const next = [search, ...savedSearches.filter((s) => s.label !== label)].slice(0, 10);
    setSavedSearches(next);
    persistSavedSearches(next);
    setSavedSearchNotice("Search saved.");
    setTimeout(() => setSavedSearchNotice(""), 2500);
  }

  function loadSavedSearch(s: SavedSearch) {
    onQueryChange(s.query);
    onTradeChange(s.trade as TradeFilter);
    onDifficultyChange(s.difficulty as DifficultyFilter);
    onWorkTypeChange(s.workType as WorkTypeFilter);
    onLocationChange(s.location);
  }

  function deleteSavedSearch(id: string) {
    const next = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(next);
    persistSavedSearches(next);
  }

  const selectedIsVisible = selectedJob ? visibleJobs.some((job) => job.id === selectedJob.id) : false;
  const detailJob = workStage === "active" || focusedActiveJob
    ? (focusedActiveJob ?? activeStageJob)
    : (selectedIsVisible ? selectedJob : visibleJobs[0] ?? null);
  const canonicalJobId = detailJob?.canonical?.id ?? null;
  const applicationAmount = applicationProposal?.jobId === canonicalJobId ? applicationProposal.amount : "";
  const applicationUnit = applicationProposal?.jobId === canonicalJobId
    ? applicationProposal.unit
    : detailJob?.canonical?.compensationType === "hourly" ? "hourly" : "fixed";
  const needsPrivateDetailHydration = Boolean(focusedActiveWorkRecord)
    && Boolean(canonicalJobId)
    && Boolean(detailJob?.canonical)
    && !detailJob?.canonical?.privateLocation;

  useEffect(() => {
    const focusedJobId = focusedActiveWorkRecord?.jobId ?? null;
    if (!focusedJobId || jobs.some((job) => job.canonical?.id === focusedJobId)) return;
    let cancelled = false;
    getJob(focusedJobId)
      .then((job) => {
        if (!cancelled) onJobLoaded(toJobViewModel(job));
      })
      .catch(() => {
        // The active-work summary still keeps the workspace on the right job.
      });
    return () => {
      cancelled = true;
    };
  }, [focusedActiveWorkRecord, jobs, onJobLoaded]);

  useEffect(() => {
    if (!canonicalJobId || !needsPrivateDetailHydration || detailHydrationRequests.current.has(canonicalJobId)) return;
    let cancelled = false;
    detailHydrationRequests.current.add(canonicalJobId);
    getJob(canonicalJobId)
      .then((job) => {
        if (!cancelled) onJobLoaded(toJobViewModel(job));
      })
      .catch(() => {
        detailHydrationRequests.current.delete(canonicalJobId);
      });
    return () => {
      cancelled = true;
    };
  }, [canonicalJobId, needsPrivateDetailHydration, onJobLoaded]);

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
  const activeWork = focusedActiveWorkId
    ? matchActiveWork.find((work) => work.id === focusedActiveWorkId) ?? matchActiveWork.find((work) => work.jobId === canonicalJobId)
    : canonicalJobId
      ? matchActiveWork.find((work) => work.jobId === canonicalJobId)
      : undefined;

  const focusedJobTitle = detailJob?.title ?? "";

  const activeWorkspace = Boolean(activeWork && activeWork.status === "active");
  const activePrivateLocation = activeWork?.job?.privateLocation ?? detailJob?.canonical?.privateLocation;
  const activeAddress = activePrivateLocation
    ? [activePrivateLocation.addressLine1, activePrivateLocation.addressLine2, `${activePrivateLocation.city}, ${activePrivateLocation.region} ${activePrivateLocation.postalCode}`]
      .filter(Boolean)
      .join(", ")
    : "";
  const currentActiveProject = activeProject?.activeWorkId === activeWork?.id ? activeProject : null;
  const completionStatus = currentActiveProject?.status ?? (activeWork?.status === "completed" ? "confirmed" : "open");
  const lifecycleLabel = completionStatus === "completion_submitted"
    ? "Completion review"
    : completionStatus === "confirmed"
      ? "Completed"
      : completionStatus === "disputed"
        ? "Closeout changes"
        : activeWork?.status === "cancelled"
          ? "Cancelled"
          : "Active";
  const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = activeWorkspace
    ? [
      { id: "today", label: "Today" },
      { id: "job", label: "Job" },
      { id: "money", label: "Money" },
      { id: "more", label: "More" },
    ]
    : [
      { id: "job", label: "Job" },
      { id: "activity", label: "Activity" },
      { id: "money", label: "Money" },
      { id: "more", label: "More" },
    ];

  function openWorkspaceTab(tab: WorkspaceTab) {
    setWorkspaceTab(tab);
    if (tab === "today" || tab === "job") setDetailTab("overview");
    if (tab === "activity") setDetailTab("activity");
    if (tab === "money") setDetailTab("payments");
    if (tab === "more") setDetailTab("notes");
  }

  async function copyActiveAddress() {
    if (!activeAddress) return;
    try {
      await navigator.clipboard.writeText(activeAddress);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1800);
    } catch {
      setAddressCopied(false);
    }
  }

  useEffect(() => {
    if (!activeWork?.id) return;
    let cancelled = false;
    getProjectForActiveWork(activeWork.id)
      .then((project) => {
        if (!cancelled) setActiveProject(project);
      })
      .catch(() => {
        if (!cancelled) setActiveProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWork?.id]);

  useEffect(() => {
    if (!openDetailOnMount || !focusedJobTitle) return;
    const timeout = window.setTimeout(() => {
      setWorkspaceArrivalVisible(true);
      revealJobWorkspace(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [focusedJobTitle, openDetailOnMount]);

  useEffect(() => {
    if (!focusedActiveWorkId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWorkStage(focusedActiveWorkRecord && focusedActiveWorkRecord.status !== "active" ? "archive" : "active");
    setMobileDetailOpen(true);
    setWorkspaceTab(focusedActiveWorkRecord?.status === "active" ? "today" : "job");
  }, [focusedActiveWorkId, focusedActiveWorkRecord]);

  useEffect(() => {
    if (role !== "tradesperson" || workStage !== "hiring") return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStageHiringLoading(true);
    setStageHiringError(null);
    Promise.all([listMyApplications(), listOffers()])
      .then(([applications, offers]) => {
        if (cancelled) return;
        setStageApplications(applications.filter((application) => application.status !== "withdrawn"));
        setStageOffers(offers);
      })
      .catch((cause) => {
        if (!cancelled) setStageHiringError(cause instanceof Error ? cause.message : "Applications could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setStageHiringLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchRefreshKey, role, workStage]);

  const workPageClassName = [
    "v2-work-page",
    role === "contractor" ? "is-contractor" : "",
    `is-${workStage}`,
    focusedActiveWorkId && mobileDetailOpen ? "is-focused-workspace" : "",
  ].filter(Boolean).join(" ");
  const workStages: Array<{ id: WorkStage; label: string; count?: number }> = [
    { id: "browse", label: "Browse" },
    { id: "hiring", label: role === "contractor" ? "Hiring" : "Applications" },
    { id: "active", label: "Active", count: activeWorkReady.length },
    { id: "archive", label: "Archive" },
  ];
  const showBrowseControls = workStage === "browse";
  const showContractorHiringJobs = role === "contractor" && workStage === "hiring" && contractorSection === "draft";
  const showArchiveJobs = role === "contractor" && workStage === "archive";
  const showJobLayout = showBrowseControls || showContractorHiringJobs || showArchiveJobs || workStage === "active" || Boolean(focusedActiveJob);

  return (
    <section className={workPageClassName} aria-label="Work">
      {reasonPrompt && (
        <div className="v2-reason-backdrop" onClick={() => setReasonPrompt(null)}>
          <div ref={reasonTrapRef} className="v2-reason-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
        <div><h1>Work</h1><p>{role === "contractor" ? "Find people, hire, and run accepted work." : "Find work, track applications, and run accepted jobs."}</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {role === "contractor" && (workStage === "browse" || workStage === "hiring") ? (
            <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Post job</button>
          ) : null}
        </div>
      </header>

      <nav className="v2-work-stage-switcher" aria-label="Work stages">
        {workStages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className={workStage === stage.id ? "is-active" : ""}
            aria-current={workStage === stage.id ? "page" : undefined}
            onClick={() => selectWorkStage(stage.id)}
          >
            <span>{stage.label}</span>
            {stage.count ? <small>{stage.count}</small> : null}
          </button>
        ))}
      </nav>

      {role === "contractor" && (workStage === "browse" || workStage === "hiring") ? (
        <button
          type="button"
          className="v2-work-create-fab"
          data-action="post-job"
          onClick={onPostJob}
          aria-label="Post job"
        >
          <Plus size={20} aria-hidden="true" />
          <span>Post job</span>
        </button>
      ) : null}

      {workStage === "browse" ? (
        <div className="v2-work-browse-actions">
          <button type="button" className="v2-secondary-button" onClick={onOpenPeople}><Users size={17} /> Find people</button>
          {primaryActiveWorkRecord ? (
            <button type="button" className="v2-active-work-shortcut" onClick={() => selectWorkStage("active")}>
              <span>Active now</span>
              <strong>{primaryActiveWorkRecord.job?.title ?? "Accepted work"}</strong>
              <ChevronRight size={17} />
            </button>
          ) : null}
        </div>
      ) : null}

      {role === "contractor" && workStage === "hiring" ? (
        <>
          <nav className="v2-section-tabs" aria-label="Hiring views">
            {(["draft", "pipeline", "templates", "calendar"] as ContractorSection[]).map((section) => {
              const sectionLabel: Partial<Record<ContractorSection, string>> = { draft: "Drafts", pipeline: "Applicants", calendar: "Schedule", templates: "Templates" };
              return <button key={section} type="button" className={contractorSection === section ? "is-active" : ""} onClick={() => { setContractorSection(section); setMobileDetailOpen(false); }}>{sectionLabel[section]}</button>;
            })}
          </nav>
          <label className="v2-mobile-work-select">
            <span>Hiring</span>
            <select value={contractorSection} onChange={(event) => { setContractorSection(event.target.value as ContractorSection); setMobileDetailOpen(false); }}>
              <option value="draft">Drafts</option>
              <option value="pipeline">Applicant pipeline</option>
              <option value="templates">Templates</option>
              <option value="calendar">Schedule</option>
            </select>
          </label>
        </>
      ) : null}

      {role === "contractor" && workStage === "archive" ? (
        <nav className="v2-section-tabs" aria-label="Archive views">
          {(["closed", "paused"] as ContractorSection[]).map((section) => (
            <button key={section} type="button" className={contractorSection === section ? "is-active" : ""} onClick={() => { setContractorSection(section); setMobileDetailOpen(false); }}>
              {section === "closed" ? "Closed" : "Paused"}
            </button>
          ))}
        </nav>
      ) : null}

      {showBrowseControls ? <div className="v2-work-toolbar">
        <label className="v2-list-search"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search work" /></label>
        <button type="button" className={filtersOpen ? "v2-filter-button is-active" : "v2-filter-button"} onClick={() => setFiltersOpen((open) => !open)}>
          <Filter size={16} /> Filters {activeFilterCount ? <span>{activeFilterCount}</span> : null}
        </button>
        {role === "tradesperson" ? (
          <button type="button" className="v2-filter-button" title="Save current search" onClick={saveCurrentSearch}>
            <BookmarkPlus size={16} />
          </button>
        ) : null}
      </div> : null}

      {showBrowseControls && savedSearchNotice ? <p className="v2-saved-search-notice" role="status">{savedSearchNotice}</p> : null}

      {showBrowseControls && role === "tradesperson" && savedSearches.length > 0 ? (
        <div className="v2-saved-searches">
          <span className="v2-saved-searches-label"><Bookmark size={13} />Saved searches</span>
          <div className="v2-saved-search-chips">
            {savedSearches.map((s) => (
              <span key={s.id} className="v2-saved-search-chip">
                <button type="button" onClick={() => loadSavedSearch(s)}>{s.label}</button>
                <button type="button" aria-label={`Remove ${s.label}`} onClick={() => deleteSavedSearch(s.id)}><X size={11} /></button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {showBrowseControls && filtersOpen ? (
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

      {role === "contractor" && workStage === "hiring" && contractorSection === "pipeline" ? (
        <PipelineBoard openJobs={jobs.filter((j) => j.status === "Open")} onOpenJob={(jobId) => { setWorkStage("browse"); selectJob(jobId, true); }} />
      ) : role === "contractor" && workStage === "hiring" && contractorSection === "calendar" ? (
        <WorkCalendar jobs={jobs} />
      ) : role === "contractor" && workStage === "hiring" && contractorSection === "templates" ? (
        <JobTemplates onPostJob={onPostJob} />
      ) : null}

      {role === "tradesperson" && workStage === "hiring" ? (
        <section className="v2-stage-panel" aria-label="Applications and offers">
          <header><div><span>Hiring</span><h2>Applications and offers</h2></div>{stageHiringLoading ? <small>Loading...</small> : null}</header>
          {stageHiringError ? <p className="v2-match-error" role="alert">{stageHiringError}</p> : null}
          {!stageHiringLoading && !stageApplications.length && !stageOffers.length ? (
            <EmptyState icon={<BriefcaseBusiness size={24} />} title="No applications yet" description="Jobs you apply to and offers you receive will stay here." />
          ) : (
            <div className="v2-stage-record-list">
              {stageOffers.map((offer) => (
                <button type="button" key={offer.id} onClick={() => void openCanonicalJob(offer.jobId)}>
                  <span>{offer.status === "pending" ? "Offer needs you" : "Offer"}</span>
                  <strong>{jobs.find((job) => job.canonical?.id === offer.jobId)?.title ?? "Open job"}</strong>
                  <small>{offer.status}{offer.startDate ? ` - starts ${offer.startDate}` : ""}</small>
                  <ChevronRight size={18} />
                </button>
              ))}
              {stageApplications.map((application) => (
                <button type="button" key={application.id} onClick={() => void openCanonicalJob(application.jobId)}>
                  <span>Application</span>
                  <strong>{jobs.find((job) => job.canonical?.id === application.jobId)?.title ?? "Open job"}</strong>
                  <small>{application.status}</small>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {role === "tradesperson" && workStage === "archive" ? (
        <section className="v2-stage-panel" aria-label="Work archive">
          <header><div><span>Archive</span><h2>Past work</h2></div></header>
          {activeWorkRecords.filter((work) => work.status !== "active").length ? (
            <div className="v2-stage-record-list">
              {activeWorkRecords.filter((work) => work.status !== "active").map((work) => (
                <button type="button" key={work.id} onClick={() => openActiveWorkJob(work)}>
                  <span>{work.status}</span>
                  <strong>{work.job?.title ?? "Accepted work"}</strong>
                  <small>{[work.job?.publicLocation.city, work.job?.publicLocation.region].filter(Boolean).join(", ") || "Work record"}</small>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          ) : <EmptyState icon={<BriefcaseBusiness size={24} />} title="No past work yet" description="Completed and cancelled work will stay here." />}
        </section>
      ) : null}

      <div ref={workLayoutRef} className={mobileDetailOpen ? "v2-work-layout show-detail" : "v2-work-layout"} style={showJobLayout ? undefined : { display: "none" }}>
        <section className="v2-work-list" aria-label={workStage === "active" ? `${activeWorkReady.length} active jobs` : `${visibleJobs.length} jobs`}>
          <div className="v2-work-list-heading">
            <span>{workStage === "active" ? `${activeWorkReady.length} active` : `${visibleJobs.length} ${visibleJobs.length === 1 ? "job" : "jobs"}`}</span>
            <div className="v2-work-list-heading-actions">
              <small>{workStage === "active" ? "Accepted work" : role === "contractor" ? `${contractorSection} postings` : (persona?.jobSectionLabel ?? "Open work")}</small>
            </div>
          </div>
          {workStage === "active" ? (
            activeWorkReady.length ? (
              <div className="v2-active-work-index">
                {activeWorkReady.map((work) => (
                  <button type="button" key={work.id} className={activeStageWorkRecord?.id === work.id ? "is-selected" : ""} onClick={() => openActiveWorkJob(work)}>
                    <span>Active work</span>
                    <strong>{work.job?.title ?? "Accepted work"}</strong>
                    <small>{[work.job?.publicLocation.city, work.job?.publicLocation.region].filter(Boolean).join(", ") || "Workspace ready"}</small>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            ) : <EmptyState icon={<BriefcaseBusiness size={24} />} title="No active work" description="Accepted offers become job workspaces here." />
          ) : loading ? <JobListSkeleton /> : visibleJobs.length ? (
            <>
              {visibleJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  role={role}
                  selected={detailJob?.id === job.id}
                  onSelect={() => selectJob(job.id)}
                />
              ))}
              <div className="v2-work-end-of-feed">
                {role === "tradesperson" ? "That's all open work in your area" : `All ${contractorSection.toLowerCase()} postings shown`}
              </div>
            </>
          ) : <WorkEmptyState role={role} section={contractorSection} onPostJob={onPostJob} />}
        </section>

        {detailJob ? (
          <article className="v2-work-detail" aria-label={detailJob.title}>
            <button type="button" className="v2-detail-back" onClick={() => setMobileDetailOpen(false)}><ArrowLeft size={16} /> {workStage === "active" ? "Active work" : workStage === "archive" ? "Archive" : "All work"}</button>
            <header className="v2-work-detail-header">
              <div><span className="v2-detail-trade">{detailJob.trade}</span><h2 ref={detailHeadingRef} tabIndex={-1}>{detailJob.title}</h2><p><MapPin size={14} /> {detailJob.location} · {activeWork ? `${role === "contractor" ? "Contractor" : "Tradesperson"} workspace` : `${detailJob.status === "Draft" ? "Last saved" : "Posted"} ${detailJob.posted}`}</p></div>
              {activeWork ? <StatusPill tone={completionStatus === "confirmed" ? "success" : completionStatus === "disputed" ? "danger" : "warning"} className="v2-work-status">{lifecycleLabel}</StatusPill> : role === "tradesperson" && detailJob.match > 0 ? <div className="v2-match-score"><strong>{detailJob.match}%</strong><span>match</span></div> : <StatusPill tone={statusTone(detailJob.status)} className={`v2-work-status status-${detailJob.status.toLowerCase()}`}>{detailJob.status}</StatusPill>}
            </header>

            {activeWork && workspaceTab === "today" && workspaceArrivalVisible ? (
              <section className="v2-workspace-arrival" role="status">
                <div>
                  <span>Job workspace open</span>
                  <strong>{detailJob.title}</strong>
                  <small>Start with photos, a daily log, or the job thread.</small>
                </div>
                <button type="button" onClick={() => setWorkspaceArrivalVisible(false)} aria-label="Dismiss workspace message"><X size={17} /></button>
              </section>
            ) : null}

            <nav className="v2-detail-tabs" aria-label="Job workspace">
              {workspaceTabs.map((tab) => (
                <button key={tab.id} type="button" className={workspaceTab === tab.id ? "is-active" : ""} onClick={() => openWorkspaceTab(tab.id)}>{tab.label}</button>
              ))}
            </nav>
            <label className="v2-mobile-work-select v2-mobile-detail-select">
              <span>Workspace</span>
              <select value={workspaceTab} onChange={(event) => openWorkspaceTab(event.target.value as WorkspaceTab)}>
                {workspaceTabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
              </select>
            </label>

            {workspaceTab === "job" ? (
              <nav className="v2-workspace-subnav" aria-label="Job information">
                <button type="button" className={detailTab === "overview" ? "is-active" : ""} onClick={() => setDetailTab("overview")}>Summary</button>
                <button type="button" className={detailTab === "requirements" ? "is-active" : ""} onClick={() => setDetailTab("requirements")}>Requirements</button>
              </nav>
            ) : null}

            {workspaceTab === "more" ? (
              <nav className="v2-workspace-subnav" aria-label="More job records">
                {(["changes", "checklist", "notes", "contacts"] as const).map((tab) => {
                  const labels: Record<typeof tab, string> = { changes: "Changes", checklist: "Checklist", notes: "Notes", contacts: "Contacts" };
                  return <button key={tab} type="button" className={detailTab === tab ? "is-active" : ""} onClick={() => setDetailTab(tab)}>{labels[tab]}</button>;
                })}
              </nav>
            ) : null}

            {detailTab === "overview" ? (
              <div className={activeWork && workspaceTab === "today" ? "v2-detail-content is-active-today" : "v2-detail-content"}>
                <p className="v2-job-description">{detailJob.summary}</p>
                <div className="v2-detail-facts">
                  <DetailFact icon={CircleDollarSign} label="Pay" value={compensationLabel(detailJob)} />
                  <DetailFact icon={CalendarClock} label="Estimate" value={detailJob.durationHours > 0 ? `${detailJob.durationHours} hours` : "Not set"} />
                  <DetailFact icon={ShieldCheck} label="Insurance" value={detailJob.insuranceRequired ? "Required" : "Not required"} />
                  <DetailFact icon={BriefcaseBusiness} label="Work type" value={detailJob.workType} />
                </div>
                <section className="v2-detail-section"><h3>Scope</h3><p>{detailJob.canonical?.scopeDescription || "Scope details have not been added yet."}</p></section>
                {detailJob.pay > 0 ? (
                  <section className="v2-detail-section">
                    <h3>Budget tracker</h3>
                    <BudgetTracker jobId={detailJob.id} budget={detailJob.pay} />
                  </section>
                ) : null}
                {!activeWork ? <section className="v2-privacy-note"><LockKeyhole size={17} /><div><strong>Exact address stays private</strong><span>{role === "contractor" ? "Only your organization can access the saved address until work is accepted." : detailJob.addressPolicy}</span></div></section> : null}
                <section className={activeWork && workspaceTab === "today" ? "v2-match-panel is-today" : "v2-match-panel"} aria-label={activeWork ? "Active work workflow" : "Hiring workflow"}>
                  <div className="v2-match-panel-heading">
                    <div>
                      <span>{activeWork ? role === "contractor" ? "Manage work" : "Do the work" : role === "contractor" ? "Applicants" : "Your hiring status"}</span>
                      <h3>{activeWork ? role === "contractor" ? "Track progress and approve closeout" : "Document the job and submit closeout" : role === "contractor" ? "Move one real applicant to active work" : "Apply, accept, and unlock the jobsite"}</h3>
                    </div>
                    {matchLoading ? <small>Loading...</small> : null}
                  </div>
                  {matchError ? <p className="v2-match-error" role="alert">{matchError}</p> : null}
                  {activeWork ? (
                    <div className="v2-active-work-card">
                      <div>
                        <span>{role === "contractor" ? "Contractor workspace" : "Tradesperson workspace"}</span>
                        <strong>{lifecycleLabel}</strong>
                        <small>Started {new Date(activeWork.startedAt).toLocaleString()}</small>
                      </div>
                      <p className="v2-active-work-explain">
                        The public listing stopped accepting applicants when the offer was accepted. This private job workspace remains {activeWork.status}.
                      </p>
                      <section className="v2-active-jobsite" aria-label="Exact jobsite">
                        <div>
                          <span>Jobsite</span>
                          <h3>{activeAddress || "Address unavailable"}</h3>
                          <p>{activePrivateLocation?.accessNotes || (activeAddress ? "The exact address is visible only to this job's participants." : "Ask the contractor to add the exact address before arriving.")}</p>
                        </div>
                        {activeAddress ? <div className="v2-active-jobsite-actions"><button type="button" onClick={() => void copyActiveAddress()}><Copy size={16} />{addressCopied ? "Copied" : "Copy"}</button><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeAddress)}`} target="_blank" rel="noreferrer"><Navigation size={16} />Directions</a></div> : null}
                      </section>
                      <div className="v2-active-work-daily-actions" aria-label="Daily job actions">
                        <button type="button" disabled={Boolean(activeAction)} onClick={() => onOpenActiveWorkMessages(activeWork.id)}><MessageCircle size={16} />{role === "contractor" ? "Job thread" : "Messages"}</button>
                        <button type="button" disabled={Boolean(activeAction)} onClick={() => onOpenTool("job-photos", activeWork.id)}><Camera size={16} />{role === "contractor" ? "Photos" : "Add photos"}</button>
                        <button type="button" disabled={Boolean(activeAction)} onClick={() => onOpenTool("daily-log", activeWork.id)}><FileText size={16} />{role === "contractor" ? "Logs" : "Daily log"}</button>
                      </div>
                      <div className="v2-active-work-money-actions" aria-label="Job money tools">
                        <span>Money</span>
                        <div>
                          <button type="button" disabled={Boolean(activeAction)} onClick={() => onOpenTool("invoice", activeWork.id)}>{role === "contractor" ? "Invoices & payments" : "Create invoice"}</button>
                        </div>
                      </div>
                      <section className={`v2-active-work-closeout is-${role}`}>
                        <div><ClipboardCheck size={19} /><div><span>Closeout</span><strong>{role === "contractor" ? completionStatus === "completion_submitted" ? "Completion is ready for review" : completionStatus === "confirmed" ? "Completion confirmed" : completionStatus === "disputed" ? "Changes were requested" : "Waiting for the tradesperson" : completionStatus === "completion_submitted" ? "Completion sent to contractor" : completionStatus === "confirmed" ? "Work confirmed" : completionStatus === "disputed" ? "Closeout needs an update" : "Submit when the job is complete"}</strong><small>{role === "contractor" ? completionStatus === "completion_submitted" ? "Review the completion summary, then confirm or request changes." : completionStatus === "open" ? "The tradesperson sends a completion summary; photos are optional." : "The closeout history stays attached to this job." : completionStatus === "completion_submitted" ? "You can review what you sent while you wait." : completionStatus === "open" ? "Describe what you completed. Photos are optional." : "Open closeout to review its status and history."}</small></div></div>
                        <button type="button" className={(completionStatus === "completion_submitted" && role === "contractor") || (["open", "disputed"].includes(completionStatus) && role === "tradesperson") ? "v2-primary-button" : "v2-secondary-button"} disabled={!currentActiveProject} onClick={() => setCloseoutOpen(true)}>{role === "contractor" ? completionStatus === "completion_submitted" ? "Review completion" : "View closeout" : completionStatus === "open" ? "Submit completion" : completionStatus === "disputed" ? "Update closeout" : "View closeout"}</button>
                      </section>
                      {activeWork.status === "active" ? (
                        <details className="v2-active-work-controls">
                          <summary>Job controls</summary>
                          <div>
                            <button type="button" disabled={Boolean(activeAction)} onClick={() => openReasonPrompt("reschedule", activeWork)}>Request reschedule</button>
                            <button type="button" className="v2-destructive-button" disabled={Boolean(activeAction)} onClick={() => openReasonPrompt("cancel", activeWork)}>Cancel work</button>
                          </div>
                        </details>
                      ) : null}
                      {activeWork.events.length ? (
                        <ol className="v2-mini-timeline">
                          {activeWork.events.slice(0, 4).map((event) => { const label = event.type.replaceAll("_", " "); return <li key={event.id}><strong>{label.charAt(0).toUpperCase() + label.slice(1)}</strong><small>{event.reason || new Date(event.occurredAt).toLocaleString()}</small></li>; })}
                        </ol>
                      ) : null}
                    </div>
                  ) : role === "contractor" ? (
                    matchApplications.length ? (
                      <div className="v2-applicant-list">
                        {matchApplications.map((application) => {
                          const offerStartDate = offerStartDateFor(detailJob, application);
                          const confirmsListedFixedPrice = detailJob.canonical?.compensationType === "fixed" && !application.proposal;
                          return (
                            <article className="v2-applicant-card" key={application.id}>
                              <div>
                                <span>{application.status}</span>
                                <strong>{application.applicant?.displayName || "Tradesperson"}</strong>
                                <small>{application.applicant?.headline || `${application.applicant?.serviceArea.city ?? ""}, ${application.applicant?.serviceArea.region ?? ""}`}</small>
                                <small className="v2-offer-start-note">Offer start: {formatOfferStartDate(offerStartDate)}</small>
                                {application.proposal ? <small className="v2-offer-start-note">Proposed pay: {application.proposal.unit === "hourly" ? `${money(application.proposal.amountCents / 100)}/hr` : money(application.proposal.amountCents / 100)}</small> : null}
                                {application.applicant?.rates.filter((rate) => rate.tradeCode === detailJob.canonical?.tradeCode).map((rate) => (
                                  <small className="v2-offer-start-note" key={rate.tradeCode}>Shared rate: {rate.hourlyRateCents ? `${money(rate.hourlyRateCents / 100)}/hr` : "See rate card"}{rate.minimumChargeCents ? ` · ${money(rate.minimumChargeCents / 100)} minimum` : ""}</small>
                                ))}
                                {application.message ? <p>{application.message}</p> : null}
                              </div>
                              <div className="v2-match-actions">
                                {application.status === "submitted" ? <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleShortlist(application)}>Shortlist</button> : null}
                                {["submitted", "shortlisted"].includes(application.status) ? (
                                  <>
                                    {confirmsListedFixedPrice ? (
                                      <div className="v2-fixed-hire-action">
                                        <small>The applicant chose this listed price. They will confirm once more before the private job workspace opens.</small>
                                        <button type="button" className="v2-primary-button" disabled={Boolean(activeAction) || detailJob.pay <= 0} onClick={() => void handleHireAtListedPrice(detailJob, application)}>Hire at {money(detailJob.pay)}</button>
                                      </div>
                                    ) : offerDraft?.applicationId === application.id ? (
                                      <div className="v2-offer-terms">
                                        <strong>Final offer</strong>
                                        <div>
                                          <label><span>Amount</span><input type="number" min="1" inputMode="decimal" value={offerDraft.amount} onChange={(event) => setOfferDraft({ ...offerDraft, amount: event.target.value })} /></label>
                                          <label><span>Paid</span><select value={offerDraft.unit} onChange={(event) => setOfferDraft({ ...offerDraft, unit: event.target.value as CompensationUnit })}><option value="fixed">Fixed total</option><option value="hourly">Per hour</option></select></label>
                                        </div>
                                        <small>This is the final amount the tradesperson will accept before work becomes active.</small>
                                        <div><button type="button" onClick={() => setOfferDraft(null)}>Cancel</button><button type="button" className="v2-primary-button" disabled={Boolean(activeAction)} onClick={() => void handleSendOffer(detailJob, application)}>Send offer</button></div>
                                      </div>
                                    ) : <button type="button" className="v2-primary-button" disabled={Boolean(activeAction)} onClick={() => prepareOffer(detailJob, application)}>Set final offer</button>}
                                    <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleDeclineApplication(application)}>Decline</button>
                                  </>
                                ) : <small>{application.status === "offered" ? "Offer sent" : "No action needed"}</small>}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="v2-match-empty"><strong>No applicants yet</strong><span>{detailJob.status === "Open" ? "Tradespeople who apply will appear here." : `This job is ${detailJob.status.toLowerCase()} — publish it to start receiving applicants.`}</span></div>
                    )
                  ) : pendingOffer ? (
                    <div className="v2-offer-card">
                      <div>
                        <span>You have an offer</span>
                        <strong>{pendingOffer.startDate ? `Proposed start: ${pendingOffer.startDate}` : "No start date set yet"}</strong>
                        <strong>{compensationAmount(pendingOffer)}</strong>
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
                  ) : (
                    <div className="v2-apply-box">
                      {detailJob.status !== "Open" && (
                        <p className="v2-match-note">This job is {detailJob.status.toLowerCase()} and not accepting applications right now.</p>
                      )}
                      {!detailJob.canonical && (
                        <p className="v2-match-note">Applications require a server-backed published job. This local draft cannot receive applications yet.</p>
                      )}
                      <label>
                        <span>Message to contractor</span>
                        <textarea value={applicationMessage} onChange={(event) => setApplicationMessage(event.target.value)} rows={4} disabled={detailJob.status !== "Open" || !detailJob.canonical} />
                      </label>
                      {["open_to_offers", "request_quotes"].includes(detailJob.canonical?.compensationType ?? "fixed") ? (
                        <div className="v2-application-proposal">
                          <strong>Your proposed pay</strong>
                          <div>
                  <label><span>Amount</span><input type="number" min="1" inputMode="decimal" value={applicationAmount} onChange={(event) => canonicalJobId && setApplicationProposal({ jobId: canonicalJobId, amount: event.target.value, unit: applicationUnit })} placeholder="Enter your price" /></label>
                  <label><span>Paid</span><select value={applicationUnit} onChange={(event) => canonicalJobId && setApplicationProposal({ jobId: canonicalJobId, amount: applicationAmount, unit: event.target.value as CompensationUnit })}><option value="fixed">Fixed total</option><option value="hourly">Per hour</option></select></label>
                          </div>
                          <small>This is a proposal. Work starts only after both sides accept the final offer.</small>
                        </div>
                      ) : null}
                      <div className="v2-match-actions">
                        {detailJob.canonical ? (
                          <button type="button" disabled={Boolean(activeAction) || detailJob.status !== "Open"} onClick={() => void handleSaveDraft(detailJob)}>Save draft</button>
                        ) : null}
                        <button
                          type="button"
                          className="v2-primary-button"
                          disabled={Boolean(activeAction) || detailJob.status !== "Open" || !detailJob.canonical || (["open_to_offers", "request_quotes"].includes(detailJob.canonical?.compensationType ?? "fixed") && (!Number.isFinite(Number(applicationAmount)) || Number(applicationAmount) <= 0))}
                          onClick={() => void handleSubmitApplication(detailJob)}
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

            {detailTab === "changes" ? (
              <div className="v2-detail-content">
                <ChangeOrderTracker jobId={detailJob.id} jobTitle={detailJob.title} />
              </div>
            ) : null}

            {detailTab === "checklist" ? (
              <div className="v2-detail-content">
                <section className="v2-detail-section">
                  <h3><ListTodo size={16} />Punch list</h3>
                  <p className="v2-muted-copy" style={{ marginBottom: 16 }}>Track completion tasks per job. Items are saved to this device.</p>
                  <JobChecklist jobId={detailJob.id} />
                </section>
              </div>
            ) : null}

            {detailTab === "payments" ? (
              <div className="v2-detail-content">
                <section className="v2-detail-section">
                  <h3><DollarSign size={16} />Payment milestones</h3>
                  <p className="v2-muted-copy" style={{ marginBottom: 16 }}>Track deposit, progress, and final payments. Saved to this device.</p>
                  <PaymentMilestones jobId={detailJob.id} jobPay={detailJob.pay} />
                </section>
              </div>
            ) : null}

            {detailTab === "notes" ? (
              <div className="v2-detail-content">
                <section className="v2-detail-section">
                  <h3><StickyNote size={16} />Job notes</h3>
                  <p className="v2-muted-copy" style={{ marginBottom: 16 }}>Private field notes, decisions, and observations. Saved to this device.</p>
                  <JobNotes jobId={detailJob.id} />
                </section>
              </div>
            ) : null}

            {detailTab === "contacts" ? (
              <div className="v2-detail-content">
                <section className="v2-detail-section">
                  <h3><Phone size={16} />Site contacts</h3>
                  <p className="v2-muted-copy" style={{ marginBottom: 16 }}>GC, owner, inspector, supplier contacts for this job. Tap a phone number to call.</p>
                  <SiteContacts jobId={detailJob.id} />
                </section>
              </div>
            ) : null}

            {(() => {
              const similarJobs = jobs
                .filter((j) => j.id !== detailJob.id && j.trade === detailJob.trade && j.status === "Open")
                .slice(0, 3);
              if (similarJobs.length === 0) return null;
              return (
                <div className="v2-similar-jobs">
                  <h3>Similar {detailJob.trade} jobs</h3>
                  <div className="v2-similar-jobs-list">
                    {similarJobs.map((j) => (
                      <div key={j.id} className="v2-similar-job-card">
                        <div className="v2-similar-job-info">
                          <strong>{j.title}</strong>
                          <span><MapPin size={12} />{j.location}</span>
                          <span>{compensationLabel(j)}</span>
                        </div>
                        <button
                          type="button"
                          className="v2-similar-job-open-btn"
                          onClick={() => selectJob(j.id)}
                        >
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {role === "contractor" && detailJob.status !== "Closed" ? (() => {
              const publishBlockers = detailJob.status === "Draft" ? getPublishBlockers(detailJob) : [];
              return (
                <>
                  {actionError ? (
                    <div className="v2-work-action-error" role="alert">
                      <strong>Action blocked</strong>
                      <span>{actionError}</span>
                    </div>
                  ) : null}
                  {publishBlockers.length > 0 ? (
                    <div className="v2-publish-readiness" role="status">
                      <div>
                        <strong>Draft is not publish-ready</strong>
                        <span>{formatPublishReadiness(publishBlockers)}</span>
                      </div>
                      <button type="button" className="v2-secondary-button" onClick={() => onEditJob(detailJob)}>
                        <Pencil size={16} /> Fix draft
                      </button>
                    </div>
                  ) : null}
                  <footer className="v2-work-detail-actions">
                    <button type="button" onClick={() => onEditJob(detailJob)}><Pencil size={17} /> Edit</button>
                    <button type="button" title="Save as template" onClick={() => {
                      const templateName = saveJobAsTemplate(detailJob);
                      setSaveTemplateNotice(`Saved as "${templateName}"`);
                      setTimeout(() => setSaveTemplateNotice(""), 3000);
                    }}><FileText size={17} /> Template</button>
                    <button type="button" style={{ color: "var(--v2-accent)" }} onClick={() => setDetailJobId(String(detailJob.id))}><LayoutList size={17} /> Full Detail</button>
                    {detailJob.status === "Draft" ? (
                      <button
                        type="button"
                        className="v2-primary-button"
                        disabled={Boolean(activeAction) || publishBlockers.length > 0}
                        title={publishBlockers.length > 0 ? `Finish before publishing: ${formatBlockerList(publishBlockers)}` : "Publish job"}
                        onClick={() => void runAction(detailJob, "publish")}
                      >
                        <Play size={17} /> Publish
                      </button>
                    ) : null}
                    {detailJob.status === "Open" ? <button type="button" disabled={Boolean(activeAction)} onClick={() => void runAction(detailJob, "pause")}><Pause size={17} /> Pause</button> : null}
                    {detailJob.status === "Paused" ? <button type="button" className="v2-primary-button" disabled={Boolean(activeAction)} onClick={() => void runAction(detailJob, "resume")}><Play size={17} /> Reopen</button> : null}
                    <button type="button" className="v2-destructive-button" disabled={Boolean(activeAction)} onClick={() => void runAction(detailJob, "close")}><XCircle size={17} /> Close</button>
                  </footer>
                </>
              );
            })() : (
              <footer className="v2-work-detail-actions">
                <button type="button" style={{ color: "var(--v2-accent)" }} onClick={() => setDetailJobId(String(detailJob.id))}><LayoutList size={17} /> Full Detail</button>
              </footer>
            )}
            {saveTemplateNotice ? <p className="v2-saved-search-notice" role="status" style={{ padding: "8px 16px" }}>{saveTemplateNotice}</p> : null}
          </article>
        ) : (
          <article className="v2-work-detail-placeholder">
            <BriefcaseBusiness size={32} />
            <strong>{role === "tradesperson" ? "Select a job to see details" : "Select a posting to review it"}</strong>
            <span>{role === "tradesperson" ? "Tap any job to see scope, budget, and apply" : "Manage scope, applicants, and job status here"}</span>
          </article>
        )}
      </div>

      {detailJobId && (
        <JobDetailHub jobId={detailJobId} onClose={() => setDetailJobId(null)} />
      )}

      {currentActiveProject && closeoutOpen ? (
        <JobCloseoutPanel
          key={`${currentActiveProject.id}:${currentActiveProject.status}`}
          open
          role={role}
          project={currentActiveProject}
          onClose={() => setCloseoutOpen(false)}
          onOpenPhotos={() => activeWork && onOpenTool("job-photos", activeWork.id)}
          onProjectChange={setActiveProject}
          onLifecycleChange={onActiveWorkChanged}
        />
      ) : null}


    </section>
  );
}
