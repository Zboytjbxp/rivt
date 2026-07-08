import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Car,
  CheckCircle2,
  CheckSquare,
  Clipboard,
  Copy,
  Download,
  FileText,
  FileUp,
  FolderOpen,
  Image,
  ListChecks,
  Package2,
  RefreshCw,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Job } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import { EmptyState, MetricTile, PageHeader, Panel } from "../../components/ui";
import { readPrimaryHourlyRate } from "../../lib/rateCard";
import { listActiveWork, type CanonicalActiveWork } from "../work/job-api";
import {
  addProjectNote,
  getProjectReport,
  openProjectForActiveWork,
  ProjectApiError,
  resolveProjectCompletion,
  submitProjectCompletion,
  uploadProjectMedia,
  type ProjectRecord,
} from "./project-api";
import { FieldCalculatorTool } from "./FieldCalculatorTool";
import { EstimateTool, type EstimateInvoiceDraft } from "./EstimateTool";
import { InvoiceDraftTool } from "./InvoiceDraftTool";
import { MaterialsTool } from "./MaterialsTool";
import { DailyLogTool } from "./DailyLogTool";
import { JobPhotosTool } from "./JobPhotosTool";
import { TimeTrackerTool } from "./TimeTrackerTool";
import { BidBuilderTool } from "./BidBuilderTool";
import { ExpenseLoggerTool } from "./ExpenseLoggerTool";
import { EarningsDashboardTool } from "./EarningsDashboardTool";
import { deleteToolRecordByLocalId, fetchToolRecords, upsertToolRecord, type ServerToolRecord } from "./tool-records-api";
import "./tools-studio.css";

export type ToolMode = "hub" | "calculator" | "estimate" | "invoice" | "materials" | "daily-log" | "job-photos" | "time-tracker" | "expense-logger" | "earnings" | "bid-builder" | "mileage" | "price-book" | "safety-checklist" | "tax-estimator" | "punch-list" | "contracts" | "job-checklist" | "payments" | "daily-report" | "tax-summary";

interface PaymentRecord {
  id: number;
  jobId: number;
  jobTitle: string;
  worker: string;
  amount: number;
  method: string;
  status: "Payment pending" | "Paid / Closed";
  date: string;
}

interface CompletionChecklistState {
  completedOnTime: boolean;
  clientApproved: boolean;
  photosProvided: boolean;
}

interface ToolsStudioProps {
  jobs: Job[];
  paymentRecords: PaymentRecord[];
  mode?: "tools" | "records";
  openTool?: ToolMode | null;
  focusedActiveWorkId?: string | null;
  activeWorkRecords?: CanonicalActiveWork[];
  onOpenToolConsumed?: () => void;
  onToolChange?: (tool: ToolMode) => void;
  onImmersiveChange?: (immersive: boolean) => void;
  onNavigate: (destination: PrimaryDestination) => void;
}

type LaunchableToolMode = Exclude<ToolMode, "hub">;
type ToolIcon = typeof Calculator;
const recentToolsStorageKey = "rivt.recentTools.v1";

interface ToolLauncher {
  mode: LaunchableToolMode;
  icon: ToolIcon;
  title: string;
  summary: string;
}

interface ToolGroup {
  label: string;
  title: string;
  tools: ToolLauncher[];
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function fileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${formatNumber(sizeBytes / 1024, 1)} KB`;
  return `${formatNumber(sizeBytes / 1024 / 1024, 1)} MB`;
}

function recordStatusLabel(status: ProjectRecord["status"]) {
  return status.replaceAll("_", " ");
}

const defaultCompletionChecklist: CompletionChecklistState = {
  completedOnTime: true,
  clientApproved: false,
  photosProvided: false,
};

function ToolCard({
  icon: Icon,
  title,
  summary,
  featured = false,
  onAction,
}: {
  icon: typeof Calculator;
  title: string;
  summary: string;
  featured?: boolean;
  onAction: () => void;
}) {
  return (
    <button
      type="button"
      className={featured ? "v2-tool-launch-card is-featured" : "v2-tool-launch-card"}
      onClick={onAction}
      aria-label={`Open ${title}`}
    >
      <span className="v2-tool-card-icon"><Icon size={19} /></span>
      <span className="v2-tool-card-copy">
        <strong>{title}</strong>
        <small>{summary}</small>
      </span>
      <em aria-hidden="true"><ArrowRight size={14} /></em>
    </button>
  );
}

function ToolMiniCard({
  icon: Icon,
  title,
  summary,
  onAction,
}: {
  icon: ToolIcon;
  title: string;
  summary: string;
  onAction: () => void;
}) {
  return (
    <button type="button" className="v2-tool-mini-card" onClick={onAction}>
      <span className="v2-tool-mini-icon"><Icon size={16} /></span>
      <span>
        <strong>{title}</strong>
        <small>{summary}</small>
      </span>
      <ArrowRight size={14} />
    </button>
  );
}

function ToolLauncherSection({
  group,
  onOpen,
}: {
  group: ToolGroup;
  onOpen: (tool: LaunchableToolMode) => void;
}) {
  return (
    <details className="v2-tool-group" aria-label={group.title}>
      <summary className="v2-tool-group-summary">
        <span className="v2-tool-group-header">
          <strong>{group.title}</strong>
          <small>{group.tools.length} tools</small>
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </summary>
      <div className="v2-tool-mini-grid">
        {group.tools.map((tool) => (
          <ToolMiniCard
            key={tool.mode}
            icon={tool.icon}
            title={tool.title}
            summary={tool.summary}
            onAction={() => onOpen(tool.mode)}
          />
        ))}
      </div>
    </details>
  );
}

function ToolAppShell({
  title,
  compact = false,
  onBack,
  swipeHandlers,
  children,
}: {
  title: string;
  compact?: boolean;
  onBack: () => void;
  swipeHandlers?: ToolSwipeHandlers;
  children: ReactNode;
}) {
  return (
    <section className={compact ? "v2-tools-app is-compact is-fullscreen-tool" : "v2-tools-app"} aria-label={title} {...swipeHandlers}>
      <header className={compact ? "v2-tool-app-header is-compact" : "v2-tool-app-header"}>
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          All tools
        </button>
        <div>
          <h1>{title}</h1>
        </div>
      </header>
      {children}
    </section>
  );
}

type ToolSwipeHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
};

function shouldIgnoreToolSwipe(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("button, a, input, textarea, select, [contenteditable='true'], [role='button']"));
}

function allToolLaunchers(): ToolLauncher[] {
  return [...PRIMARY_TOOL_LAUNCHERS, ...TOOL_GROUPS.flatMap((group) => group.tools)];
}

function readRecentTools(): LaunchableToolMode[] {
  try {
    const stored = localStorage.getItem(recentToolsStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(allToolLaunchers().map((tool) => tool.mode));
    return parsed.filter((mode): mode is LaunchableToolMode => typeof mode === "string" && allowed.has(mode as LaunchableToolMode)).slice(0, 4);
  } catch {
    return [];
  }
}

function persistRecentTools(tools: LaunchableToolMode[]) {
  try {
    localStorage.setItem(recentToolsStorageKey, JSON.stringify(tools.slice(0, 4)));
  } catch {
    // Recent tools are a convenience only.
  }
}

const MILEAGE_RATE_PER_MILE = 0.70;
const MILEAGE_RATE_LABEL = "$0.70/mi";
const mileageKey = "rivt.mileage.v1";

const PRIMARY_TOOL_LAUNCHERS: ToolLauncher[] = [
  {
    mode: "calculator",
    icon: Calculator,
    title: "Heavy 16th",
    summary: "Fractions and cut math.",
  },
  {
    mode: "estimate",
    icon: Scale,
    title: "Estimate",
    summary: "Build a price range.",
  },
  {
    mode: "invoice",
    icon: ReceiptText,
    title: "Invoice",
    summary: "Draft and export.",
  },
  {
    mode: "daily-log",
    icon: Clipboard,
    title: "Daily log",
    summary: "Notes, labor, blockers.",
  },
  {
    mode: "job-photos",
    icon: FolderOpen,
    title: "Camera",
    summary: "Live jobsite feed.",
  },
];

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: "Money",
    title: "Money",
    tools: [
      { mode: "bid-builder", icon: FileText, title: "Bid builder", summary: "Line-item bids." },
      { mode: "payments", icon: ReceiptText, title: "Payment tracker", summary: "Invoices and balances." },
      { mode: "expense-logger", icon: ReceiptText, title: "Expenses", summary: "Job costs by category." },
      { mode: "mileage", icon: Car, title: "Mileage", summary: "Job travel log." },
      { mode: "earnings", icon: Download, title: "Earnings", summary: "Paid work summary." },
      { mode: "tax-summary", icon: FileUp, title: "Tax summary", summary: "Exportable estimate." },
      { mode: "tax-estimator", icon: Scale, title: "Tax estimator", summary: "Quarterly estimate." },
    ],
  },
  {
    label: "Site",
    title: "Site",
    tools: [
      { mode: "materials", icon: Package2, title: "Materials", summary: "Area, waste, rough cost." },
      { mode: "daily-report", icon: FileText, title: "Daily report", summary: "Weather, crew, issues." },
      { mode: "punch-list", icon: ListChecks, title: "Punch list", summary: "Open items and fixes." },
      { mode: "safety-checklist", icon: Shield, title: "Safety checklist", summary: "Daily site check." },
      { mode: "job-checklist", icon: CheckSquare, title: "Job checklists", summary: "Trade-specific steps." },
      { mode: "time-tracker", icon: RefreshCw, title: "Time tracker", summary: "Clock jobs and tasks." },
    ],
  },
  {
    label: "Business",
    title: "Business",
    tools: [
      { mode: "price-book", icon: Search, title: "Price book", summary: "Save common prices." },
      { mode: "contracts", icon: FileText, title: "Contracts", summary: "Scope and terms drafts." },
    ],
  },
];

interface MileageEntry {
  id: string;
  date: string;
  from: string;
  to: string;
  jobRef: string;
  miles: number;
  purpose: string;
}

function readMileage(): MileageEntry[] {
  try {
    const stored = localStorage.getItem(mileageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as MileageEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistMileage(entries: MileageEntry[]) {
  try { localStorage.setItem(mileageKey, JSON.stringify(entries.slice(0, 500))); } catch { /* noop */ }
}

function isMileageEntry(value: unknown): value is MileageEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MileageEntry>;
  return typeof candidate.id === "string"
    && typeof candidate.date === "string"
    && typeof candidate.from === "string"
    && typeof candidate.to === "string"
    && typeof candidate.jobRef === "string"
    && typeof candidate.miles === "number"
    && typeof candidate.purpose === "string";
}

function mileageFromServer(record: ServerToolRecord): MileageEntry | null {
  if (!isMileageEntry(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    date: record.payload.date || record.recordDate || new Date().toISOString().slice(0, 10),
    miles: typeof record.payload.miles === "number" ? record.payload.miles : 0,
  };
}

function mileageToServerInput(entry: MileageEntry) {
  return {
    recordType: "mileage" as const,
    localId: entry.id,
    title: entry.jobRef || entry.purpose || "Mileage trip",
    status: "active",
    recordDate: entry.date || null,
    amountCents: null,
    payload: { ...entry },
  };
}

function MileageLoggerTool({ activeJob }: { activeJob: Job | null }) {
  const [entries, setEntries] = useState<MileageEntry[]>(readMileage);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(activeJob?.location ?? "");
  const [jobRef, setJobRef] = useState(activeJob?.title ?? "");
  const [miles, setMiles] = useState("");
  const [purpose, setPurpose] = useState("Job travel");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("mileage").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(mileageFromServer).filter((entry): entry is MileageEntry => Boolean(entry));
      if (mapped.length) {
        setEntries(mapped);
        persistMileage(mapped);
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readMileage();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((entry) => upsertToolRecord(mileageToServerInput(entry)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local mileage trips synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New mileage trips sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function persistMileageEntries(next: MileageEntry[], changedEntry?: MileageEntry) {
    setEntries(next);
    persistMileage(next);
    if (!changedEntry) return;
    void upsertToolRecord(mileageToServerInput(changedEntry)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function addEntry() {
    if (!miles || parseFloat(miles) <= 0) return;
    const entry: MileageEntry = {
      id: crypto.randomUUID(),
      date,
      from: from.trim(),
      to: to.trim(),
      jobRef: jobRef.trim(),
      miles: parseFloat(miles),
      purpose: purpose.trim() || "Job travel",
    };
    const next = [entry, ...entries];
    persistMileageEntries(next, entry);
    setFrom("");
    setMiles("");
    setNotice("Trip logged.");
    setTimeout(() => setNotice(""), 2500);
  }

  function removeEntry(id: string) {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    persistMileage(next);
    void deleteToolRecordByLocalId("mileage", id).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device only. Could not sync deletion.");
    });
  }

  const thisYear = new Date().getFullYear().toString();
  const yearEntries = entries.filter((e) => e.date.startsWith(thisYear));
  const yearMiles = yearEntries.reduce((sum, e) => sum + e.miles, 0);
  const yearDeduction = yearMiles * MILEAGE_RATE_PER_MILE;
  const totalMiles = entries.reduce((sum, e) => sum + e.miles, 0);

  return (
    <div className="v2-tool-workbench v2-mileage-workbench">
      <Panel className="v2-tool-panel" eyebrow="Trip log" title="Log mileage">
        <div className="v2-tool-input-grid three">
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>From<input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Shop, home, supplier…" /></label>
          <label>To<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Job site address…" /></label>
          <label>Job / client<input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Job name or client" /></label>
          <label>Miles<input type="number" min="0.1" step="0.1" value={miles} onChange={(e) => setMiles(e.target.value)} placeholder="0.0" /></label>
          <label>Purpose<input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Job travel, supply run…" /></label>
        </div>
        {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
        <p className="v2-record-notice" role="status">{syncMessage}</p>
        <button type="button" className="v2-primary-button" disabled={!miles || parseFloat(miles) <= 0} onClick={addEntry}><Car size={14} />Log trip</button>
        {entries.length ? (
          <div className="v2-mileage-list">
            {entries.map((e) => (
              <article key={e.id} className="v2-mileage-entry">
                <div className="v2-mileage-entry-head">
                  <strong>{e.miles.toFixed(1)} mi</strong>
                  <span>{e.date}</span>
                  <span className="v2-mileage-deduction">{currency(e.miles * MILEAGE_RATE_PER_MILE)} deduction</span>
                  <button type="button" aria-label="Delete trip" onClick={() => removeEntry(e.id)}><Trash2 size={13} /></button>
                </div>
                <div className="v2-mileage-entry-meta">
                  {e.from ? <small>From: {e.from}</small> : null}
                  {e.to ? <small>To: {e.to}</small> : null}
                  {e.jobRef ? <small>{e.jobRef}</small> : null}
                  {e.purpose !== "Job travel" ? <small>{e.purpose}</small> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="v2-muted-copy">No trips logged yet. Each trip builds your tax deduction record.</p>}
      </Panel>

      <aside className="v2-mileage-summary">
        <Panel className="v2-tool-panel v2-tool-summary-panel" eyebrow={`${new Date().getFullYear()} deduction`} title={currency(yearDeduction)}>
          <div className="v2-tool-breakdown">
            <div><span>Miles this year</span><strong>{yearMiles.toFixed(1)} mi</strong></div>
            <div><span>IRS rate (2025)</span><strong>$0.70/mi</strong></div>
            <div><span>Deductible</span><strong>{currency(yearDeduction)}</strong></div>
          </div>
        </Panel>
        <Panel className="v2-tool-panel" eyebrow="All time" title={`${totalMiles.toFixed(1)} mi`}>
          <div className="v2-tool-breakdown">
            <div><span>Total trips</span><strong>{entries.length}</strong></div>
            <div><span>Total deductible</span><strong>{currency(totalMiles * MILEAGE_RATE_PER_MILE)}</strong></div>
          </div>
        </Panel>
      </aside>
    </div>
  );
}

// ── Material Price Book ───────────────────────────────────────────────────────

function getDefaultPriceBook(trade: string | null): Array<{ name: string; unit: string; price: number; supplier: string }> {
  const catalog: Record<string, Array<{ name: string; unit: string; price: number; supplier: string }>> = {
    Electrician: [
      { name: "12/2 Romex wire", unit: "ft", price: 0.65, supplier: "" },
      { name: "14/2 Romex wire", unit: "ft", price: 0.48, supplier: "" },
      { name: "Single-pole breaker 15A", unit: "ea", price: 12, supplier: "" },
      { name: "GFCI outlet", unit: "ea", price: 18, supplier: "" },
      { name: "Junction box", unit: "ea", price: 4, supplier: "" },
      { name: "Wire nuts (bag)", unit: "bag", price: 8, supplier: "" },
      { name: "EMT conduit 1/2\"", unit: "ft", price: 0.90, supplier: "" },
      { name: "Outlet / switch plate", unit: "ea", price: 2, supplier: "" },
    ],
    Plumber: [
      { name: "Copper pipe 3/4\"", unit: "ft", price: 3.50, supplier: "" },
      { name: "PVC pipe 3\"", unit: "ft", price: 1.20, supplier: "" },
      { name: "Ball valve 1/2\"", unit: "ea", price: 12, supplier: "" },
      { name: "P-trap", unit: "ea", price: 8, supplier: "" },
      { name: "Wax ring", unit: "ea", price: 6, supplier: "" },
      { name: "Sharkbite coupling 3/4\"", unit: "ea", price: 14, supplier: "" },
      { name: "Supply line 12\"", unit: "ea", price: 5, supplier: "" },
      { name: "Teflon tape", unit: "roll", price: 2, supplier: "" },
    ],
    Carpenter: [
      { name: "2x4x8 stud", unit: "ea", price: 6.50, supplier: "" },
      { name: "2x6x8", unit: "ea", price: 9.00, supplier: "" },
      { name: "OSB 4x8 sheet", unit: "ea", price: 28, supplier: "" },
      { name: "3/4\" plywood 4x8", unit: "ea", price: 55, supplier: "" },
      { name: "16d sinker nails 5lb", unit: "box", price: 18, supplier: "" },
      { name: "Construction adhesive", unit: "tube", price: 8, supplier: "" },
      { name: "Door hinge (pair)", unit: "pair", price: 7, supplier: "" },
      { name: "2.5\" deck screws 5lb", unit: "box", price: 16, supplier: "" },
    ],
    HVAC: [
      { name: "R-410A refrigerant", unit: "lb", price: 45, supplier: "" },
      { name: "Capacitor 45/5 MFD", unit: "ea", price: 25, supplier: "" },
      { name: "Contactor 40A", unit: "ea", price: 18, supplier: "" },
      { name: "16x25x1 air filter", unit: "ea", price: 8, supplier: "" },
      { name: "HVAC duct tape", unit: "roll", price: 22, supplier: "" },
      { name: "Condensate line 3/4\"", unit: "ft", price: 0.40, supplier: "" },
      { name: "Blower motor", unit: "ea", price: 85, supplier: "" },
    ],
    Roofer: [
      { name: "Architectural shingles", unit: "sq", price: 150, supplier: "" },
      { name: "15# felt underlayment", unit: "roll", price: 45, supplier: "" },
      { name: "Ice & water shield", unit: "sq", price: 85, supplier: "" },
      { name: "Ridge cap bundle", unit: "bundle", price: 65, supplier: "" },
      { name: "Roofing nails 1-3/4\" 5lb", unit: "box", price: 18, supplier: "" },
      { name: "Step flashing", unit: "ea", price: 3, supplier: "" },
    ],
    Painter: [
      { name: "Interior latex paint", unit: "gal", price: 45, supplier: "" },
      { name: "Exterior paint", unit: "gal", price: 52, supplier: "" },
      { name: "Primer", unit: "gal", price: 35, supplier: "" },
      { name: "9\" roller cover", unit: "ea", price: 4, supplier: "" },
      { name: "Painter's tape 1.5\"", unit: "roll", price: 7, supplier: "" },
      { name: "Drop cloth 9x12", unit: "ea", price: 12, supplier: "" },
    ],
    Mason: [
      { name: "CMU block 8x8x16", unit: "ea", price: 2.50, supplier: "" },
      { name: "Mortar mix 60lb", unit: "bag", price: 12, supplier: "" },
      { name: "Mason sand", unit: "ton", price: 80, supplier: "" },
      { name: "Rebar #4", unit: "ft", price: 1.50, supplier: "" },
      { name: "Brick (standard)", unit: "ea", price: 0.85, supplier: "" },
    ],
    Welder: [
      { name: "ER70S-6 MIG wire 10lb", unit: "spool", price: 28, supplier: "" },
      { name: "Argon/CO2 75/25 mix", unit: "tank", price: 60, supplier: "" },
      { name: "4.5\" grinding disc", unit: "ea", price: 5, supplier: "" },
      { name: "Anti-spatter spray", unit: "can", price: 12, supplier: "" },
      { name: "Welding rod 7018 10lb", unit: "box", price: 22, supplier: "" },
    ],
    Landscaper: [
      { name: "Triple-mix topsoil", unit: "cu yd", price: 65, supplier: "" },
      { name: "Hardwood mulch", unit: "cu yd", price: 55, supplier: "" },
      { name: "Grass seed premium", unit: "50lb", price: 45, supplier: "" },
      { name: "Lawn fertilizer", unit: "bag", price: 38, supplier: "" },
      { name: "Landscape fabric", unit: "sq ft", price: 0.18, supplier: "" },
      { name: "River rock", unit: "ton", price: 120, supplier: "" },
    ],
  };
  return catalog[trade ?? ""] ?? [];
}

const priceBookKey = "rivt.priceBook.v1";

interface PriceEntry {
  id: string;
  name: string;
  unit: string;
  price: number;
  supplier: string;
  notes: string;
  updatedAt: string;
}

function readPriceBook(): PriceEntry[] {
  try {
    const stored = localStorage.getItem(priceBookKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as PriceEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistPriceBook(entries: PriceEntry[]) {
  try { localStorage.setItem(priceBookKey, JSON.stringify(entries.slice(0, 200))); } catch { /* noop */ }
}

function isPriceEntry(value: unknown): value is PriceEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PriceEntry>;
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.unit === "string"
    && typeof candidate.price === "number"
    && typeof candidate.supplier === "string"
    && typeof candidate.notes === "string"
    && typeof candidate.updatedAt === "string";
}

function priceEntryFromServer(record: ServerToolRecord): PriceEntry | null {
  if (!isPriceEntry(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    name: record.payload.name || record.title,
    price: typeof record.payload.price === "number" ? record.payload.price : (record.amountCents ?? 0) / 100,
    updatedAt: record.payload.updatedAt || record.updatedAt || new Date().toISOString(),
  };
}

function priceEntryToServerInput(entry: PriceEntry) {
  return {
    recordType: "price_book" as const,
    localId: entry.id,
    title: entry.name || "Price book item",
    status: "active",
    recordDate: entry.updatedAt.slice(0, 10),
    amountCents: Math.round(Math.max(0, entry.price) * 100),
    payload: { ...entry },
  };
}

function PriceBookTool() {
  const [entries, setEntries] = useState<PriceEntry[]>(readPriceBook);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");

  useEffect(() => {
    const trade = (() => { try { return JSON.parse(localStorage.getItem("rivt.profile.v1") ?? "null")?.primaryTrade ?? null; } catch { return null; } })();
    const seeded = localStorage.getItem("rivt.priceBookSeeded.v1");
    if (!seeded && entries.length === 0 && trade) {
      const defaults = getDefaultPriceBook(trade);
      if (defaults.length) {
        const seededEntries: PriceEntry[] = defaults.map(d => ({
          id: crypto.randomUUID(),
          name: d.name,
          unit: d.unit,
          price: d.price,
          supplier: d.supplier,
          notes: "Pre-loaded for your trade",
          updatedAt: new Date().toISOString(),
        }));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEntries(seededEntries);
        persistPriceBook(seededEntries);
        void Promise.all(seededEntries.map((entry) => upsertToolRecord(priceEntryToServerInput(entry)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Starter price book synced to your RIVT account."
            : "Couldn't sync - starter prices saved on this device only.");
        });
        localStorage.setItem("rivt.priceBookSeeded.v1", "1");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("price_book").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(priceEntryFromServer).filter((entry): entry is PriceEntry => Boolean(entry));
      if (mapped.length) {
        setEntries(mapped);
        persistPriceBook(mapped);
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readPriceBook();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((entry) => upsertToolRecord(priceEntryToServerInput(entry)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local price book synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New price book items sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const filtered = entries.filter((e) => !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()) || e.supplier.toLowerCase().includes(search.toLowerCase()));

  function persistPriceEntries(next: PriceEntry[], changedEntry?: PriceEntry) {
    setEntries(next);
    persistPriceBook(next);
    if (!changedEntry) return;
    void upsertToolRecord(priceEntryToServerInput(changedEntry)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function addEntry() {
    if (!name.trim() || !price) return;
    const existingIndex = entries.findIndex((e) => e.name.toLowerCase() === name.trim().toLowerCase());
    const entry: PriceEntry = {
      id: existingIndex >= 0 ? entries[existingIndex].id : crypto.randomUUID(),
      name: name.trim(),
      unit: unit.trim() || "ea",
      price: parseFloat(price) || 0,
      supplier: supplier.trim(),
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    const next = existingIndex >= 0
      ? entries.map((e, i) => i === existingIndex ? entry : e)
      : [entry, ...entries];
    persistPriceEntries(next, entry);
    setName(""); setUnit(""); setPrice(""); setSupplier(""); setNotes("");
    setNotice(existingIndex >= 0 ? "Price updated." : "Price saved.");
    setTimeout(() => setNotice(""), 2500);
  }

  function removeEntry(id: string) {
    const next = entries.filter((e) => e.id !== id);
    persistPriceEntries(next);
    void deleteToolRecordByLocalId("price_book", id).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device only. Could not sync deletion.");
    });
  }

  async function copyPrice(entry: PriceEntry) {
    const text = `${entry.name}: ${currency(entry.price)}/${entry.unit}${entry.supplier ? ` (${entry.supplier})` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(""), 2000);
    } catch { /* noop */ }
  }

  return (
    <div className="v2-tool-workbench v2-price-book-workbench">
      <Panel className="v2-tool-panel" eyebrow="Add price" title="Material price book">
        <div className="v2-tool-input-grid two">
          <label>Material / item<input value={name} onChange={(e) => setName(e.target.value)} placeholder="2x6x8 lumber, 12/2 Romex, conduit…" /></label>
          <label>Unit<input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ea, ft, sq ft, sheet, lb…" /></label>
          <label>Price ($)<input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></label>
          <label>Supplier<input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Home Depot, local yard…" /></label>
          <label className="is-wide">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="SKU, grade, size spec, date checked…" /></label>
        </div>
        {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
        <p className="v2-record-notice" role="status">{syncMessage}</p>
        <button type="button" className="v2-primary-button" disabled={!name.trim() || !price} onClick={addEntry}><Package2 size={14} />Save price</button>
      </Panel>

      <Panel className="v2-tool-panel v2-price-book-list-panel" eyebrow={`${entries.length} items`} title="Saved prices">
        <label className="v2-list-search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search materials…" /></label>
        {filtered.length ? (
          <div className="v2-price-book-list">
            {filtered.map((entry) => (
              <article key={entry.id} className="v2-price-entry">
                <div className="v2-price-entry-head">
                  <strong>{entry.name}</strong>
                  <span className="v2-price-tag">{currency(entry.price)}/{entry.unit}</span>
                  <button type="button" title="Copy price" onClick={() => void copyPrice(entry)}>
                    {copiedId === entry.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  </button>
                  <button type="button" aria-label={`Delete ${entry.name}`} onClick={() => removeEntry(entry.id)}><Trash2 size={14} /></button>
                </div>
                {(entry.supplier || entry.notes) ? (
                  <div className="v2-price-entry-meta">
                    {entry.supplier ? <small>{entry.supplier}</small> : null}
                    {entry.notes ? <small>{entry.notes}</small> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : entries.length ? (
          <p className="v2-muted-copy">No matches for "{search}".</p>
        ) : (
          <p className="v2-muted-copy">No prices saved yet. Add common materials to speed up estimates and bids.</p>
        )}
      </Panel>
    </div>
  );
}

// ── Field Safety Checklist ────────────────────────────────────────────────────

const SAFETY_CATEGORIES: Record<string, string[]> = {
  "PPE": ["Hard hat worn", "Safety glasses on", "High-vis vest on", "Gloves available", "Steel-toed boots"],
  "Fall Protection": ["Harness inspected", "Anchor points secured", "Ladder secured top and bottom", "Guardrails in place"],
  "Electrical": ["GFCI protection confirmed", "Lockout/tagout verified", "Cords inspected", "No water near electrical"],
  "Tools & Equipment": ["Tools inspected before use", "Guards in place", "No damaged cords/hoses", "SDS accessible"],
  "Site Access": ["Work area barricaded", "Signage posted", "Overhead hazards marked", "Emergency exit clear"],
  "Emergency": ["First aid kit located", "Emergency contacts posted", "Nearest hospital identified", "Fire extinguisher accessible"],
};

const ALL_SAFETY_ITEMS = Object.values(SAFETY_CATEGORIES).flat();

interface SafetyLog {
  id: string;
  date: string;
  jobRef: string;
  completedBy: string;
  checks: Record<string, boolean>;
  notes: string;
  signedAt: string;
}

const safetyLogKey = "rivt.safetyLogs.v1";

function readSafetyLogs(): SafetyLog[] {
  try {
    const stored = localStorage.getItem(safetyLogKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SafetyLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistSafetyLogs(logs: SafetyLog[]) {
  try { localStorage.setItem(safetyLogKey, JSON.stringify(logs.slice(0, 200))); } catch { /* noop */ }
}

function isSafetyLog(value: unknown): value is SafetyLog {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SafetyLog>;
  return typeof candidate.id === "string"
    && typeof candidate.date === "string"
    && typeof candidate.jobRef === "string"
    && typeof candidate.completedBy === "string"
    && typeof candidate.checks === "object"
    && candidate.checks !== null
    && typeof candidate.notes === "string"
    && typeof candidate.signedAt === "string";
}

function safetyLogFromServer(record: ServerToolRecord): SafetyLog | null {
  if (!isSafetyLog(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    jobRef: record.payload.jobRef || record.title,
    date: record.payload.date || record.recordDate || new Date().toISOString().slice(0, 10),
    signedAt: record.payload.signedAt || record.updatedAt || new Date().toISOString(),
  };
}

function safetyLogToServerInput(log: SafetyLog) {
  return {
    recordType: "safety_check" as const,
    localId: log.id,
    title: log.jobRef || "Safety check",
    status: "signed",
    recordDate: log.date || null,
    amountCents: null,
    payload: { ...log },
  };
}

// ── Tax Estimator ───────────────────────────────────────────────────────────

const TAX_EST_KEY = "rivt.taxEstimator.v1";
interface TaxEstimatorInput { income: number; filingStatus: "single" | "mfj" | "hoh" }

function calcTax(income: number) {
  const seTax = income * 0.9235 * 0.153;
  const taxable = Math.max(0, income - 14600);
  let fedTax = 0;
  if (taxable > 0) fedTax += Math.min(taxable, 11600) * 0.10;
  if (taxable > 11600) fedTax += Math.min(taxable - 11600, 35550) * 0.12;
  if (taxable > 47150) fedTax += Math.min(taxable - 47150, 53375) * 0.22;
  if (taxable > 100525) fedTax += (taxable - 100525) * 0.24;
  return { seTax, fedTax, totalAnnual: seTax + fedTax, quarterly: (seTax + fedTax) / 4 };
}

function TaxEstimatorTool() {
  const [input, setInput] = useState<TaxEstimatorInput>(() => {
    try { return JSON.parse(localStorage.getItem(TAX_EST_KEY) ?? "null") as TaxEstimatorInput ?? { income: 60000, filingStatus: "single" }; }
    catch { return { income: 60000, filingStatus: "single" }; }
  });
  const [incomeDraft, setIncomeDraft] = useState(String(input.income));

  function compute() {
    const income = Math.max(0, Number(incomeDraft) || 0);
    const next = { ...input, income };
    setInput(next);
    try { localStorage.setItem(TAX_EST_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }

  const result = calcTax(input.income);
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <Panel className="v2-tool-panel v2-tax-estimator-panel" eyebrow="Tax planning" title="Tax estimator">
      <div className="v2-tax-hero">
        <small>Estimated quarterly payment</small>
        <strong>{fmt(result.quarterly)}</strong>
      </div>
      <div className="v2-tax-inputs">
        <label>
          Annual income ($)
          <input type="number" value={incomeDraft} min={0} onChange={e => setIncomeDraft(e.target.value)} onBlur={compute} />
        </label>
        <label>
          Filing status
          <select value={input.filingStatus} onChange={e => { const next = { ...input, filingStatus: e.target.value as TaxEstimatorInput["filingStatus"] }; setInput(next); try { localStorage.setItem(TAX_EST_KEY, JSON.stringify(next)); } catch { /* noop */ } }}>
            <option value="single">Single</option>
            <option value="mfj">Married filing jointly</option>
            <option value="hoh">Head of household</option>
          </select>
        </label>
      </div>
      <table className="v2-tax-breakdown">
        <tbody>
          <tr><td>Self-employment tax</td><td>{fmt(result.seTax)}</td></tr>
          <tr><td>Federal income tax</td><td>{fmt(result.fedTax)}</td></tr>
          <tr className="v2-tax-total"><td>Total annual</td><td>{fmt(result.totalAnnual)}</td></tr>
          <tr className="v2-tax-quarterly"><td>Quarterly payment</td><td>{fmt(result.quarterly)}</td></tr>
        </tbody>
      </table>
      <p className="v2-tax-disclaimer">Estimate only. Consult a tax professional for your specific situation. Based on 2025 rates.</p>
    </Panel>
  );
}

// ── Punch List ───────────────────────────────────────────────────────────────

const PUNCH_V2_KEY = "rivt.punchList.v1";

const PUNCH_CATEGORIES = ["Electrical", "Plumbing", "Framing", "Finish", "Other"] as const;
type PunchCategory = typeof PUNCH_CATEGORIES[number];

interface PunchV2Item {
  id: string;
  jobId: string;
  description: string;
  category: PunchCategory;
  photoUrl?: string;
  createdAt: string;
  resolvedAt?: string;
}

function readPunchV2(): PunchV2Item[] {
  try {
    const stored = localStorage.getItem(PUNCH_V2_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as PunchV2Item[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistPunchV2(items: PunchV2Item[]) {
  try { localStorage.setItem(PUNCH_V2_KEY, JSON.stringify(items)); } catch { /* noop */ }
}

function isPunchV2Item(value: unknown): value is PunchV2Item {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PunchV2Item>;
  return typeof candidate.id === "string"
    && typeof candidate.jobId === "string"
    && typeof candidate.description === "string"
    && PUNCH_CATEGORIES.includes(candidate.category as PunchCategory)
    && typeof candidate.createdAt === "string"
    && (candidate.photoUrl === undefined || typeof candidate.photoUrl === "string")
    && (candidate.resolvedAt === undefined || typeof candidate.resolvedAt === "string");
}

function punchItemFromServer(record: ServerToolRecord): PunchV2Item | null {
  if (!isPunchV2Item(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    description: record.payload.description || record.title,
    createdAt: record.payload.createdAt || record.updatedAt || new Date().toISOString(),
  };
}

function punchItemToServerInput(item: PunchV2Item) {
  return {
    recordType: "punch_item" as const,
    localId: item.id,
    title: item.description || "Punch item",
    status: item.resolvedAt ? "resolved" : "open",
    recordDate: item.createdAt.slice(0, 10),
    amountCents: null,
    payload: { ...item },
  };
}

function readSavedJobsV1(): Array<{ id: number; title: string }> {
  try {
    const raw = localStorage.getItem("rivt.jobs.v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ id: number; title: string }>;
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch { return []; }
}

function PunchListTool() {
  const [items, setItems] = useState<PunchV2Item[]>(readPunchV2);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<PunchCategory>("Other");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedJobs] = useState<Array<{ id: number; title: string }>>(readSavedJobsV1);

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("punch_item").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(punchItemFromServer).filter((item): item is PunchV2Item => Boolean(item));
      if (mapped.length) {
        setItems(mapped);
        persistPunchV2(mapped);
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readPunchV2();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((item) => upsertToolRecord(punchItemToServerInput(item)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local punch items synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New punch items sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function persistPunchItems(next: PunchV2Item[], changedItem?: PunchV2Item) {
    setItems(next);
    persistPunchV2(next);
    if (!changedItem) return;
    void upsertToolRecord(punchItemToServerInput(changedItem)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  const jobLabel = (id: string) => {
    if (!id) return "All jobs";
    const j = savedJobs.find((jb) => String(jb.id) === id);
    return j ? j.title : id;
  };

  function addItem() {
    if (!desc.trim()) return;
    const item: PunchV2Item = {
      id: crypto.randomUUID(),
      jobId: selectedJobId,
      description: desc.trim(),
      category,
      photoUrl,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...items];
    persistPunchItems(next, item);
    setDesc("");
    setPhotoUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setNotice("Item added.");
    setTimeout(() => setNotice(""), 2000);
  }

  function resolveItem(id: string) {
    const next = items.map((i) => i.id === id ? { ...i, resolvedAt: new Date().toISOString() } : i);
    const changed = next.find((i) => i.id === id);
    persistPunchItems(next, changed);
  }

  function deleteItem(id: string) {
    const next = items.filter((i) => i.id !== id);
    persistPunchItems(next);
    void deleteToolRecordByLocalId("punch_item", id).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device only. Could not sync deletion.");
    });
  }

  function exportReport() {
    const lines: string[] = ["RIVT PUNCH LIST REPORT", `Generated: ${new Date().toLocaleString()}`, ""];
    const open = items.filter((i) => !i.resolvedAt);
    const resolved = items.filter((i) => i.resolvedAt);
    lines.push(`OPEN ITEMS (${open.length})`);
    lines.push("─".repeat(40));
    for (const item of open) {
      lines.push(`[${item.category}] ${item.description}`);
      lines.push(`  Job: ${jobLabel(item.jobId) || "Unassigned"}`);
      lines.push(`  Added: ${new Date(item.createdAt).toLocaleDateString()}`);
      lines.push("");
    }
    lines.push(`RESOLVED ITEMS (${resolved.length})`);
    lines.push("─".repeat(40));
    for (const item of resolved) {
      lines.push(`[${item.category}] ${item.description}`);
      lines.push(`  Job: ${jobLabel(item.jobId) || "Unassigned"}`);
      lines.push(`  Resolved: ${item.resolvedAt ? new Date(item.resolvedAt).toLocaleDateString() : "—"}`);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `punch-list-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const openItems = items.filter((i) => !i.resolvedAt);
  const resolvedItems = items.filter((i) => !!i.resolvedAt);

  const CATEGORY_COLORS: Record<PunchCategory, string> = {
    Electrical: "var(--v2-warning, #f59e0b)",
    Plumbing: "#3b82f6",
    Framing: "#8b5cf6",
    Finish: "var(--v2-success)",
    Other: "var(--v2-text-muted)",
  };

  function renderItem(item: PunchV2Item, resolved: boolean) {
    return (
      <article key={item.id} className={`v2-punchv2-item${resolved ? " is-resolved" : ""}`}>
        <div className="v2-punchv2-item-head">
          <span className="v2-punchv2-badge" style={{ borderColor: CATEGORY_COLORS[item.category], color: CATEGORY_COLORS[item.category] }}>{item.category}</span>
          <span className="v2-punchv2-desc">{item.description}</span>
        </div>
        <div className="v2-punchv2-item-meta">
          <small>{jobLabel(item.jobId) || "Unassigned"} · {new Date(item.createdAt).toLocaleDateString()}</small>
          {resolved && item.resolvedAt && <small className="v2-punchv2-resolved-date">Resolved {new Date(item.resolvedAt).toLocaleDateString()}</small>}
        </div>
        {item.photoUrl && (
          <img src={item.photoUrl} alt="Deficiency photo" className="v2-punchv2-photo" />
        )}
        <div className="v2-punchv2-item-actions">
          {!resolved && (
            <button type="button" className="v2-primary-button" onClick={() => resolveItem(item.id)}>
              <CheckCircle2 size={13} /> Mark resolved
            </button>
          )}
          <button type="button" className="v2-destructive-button" onClick={() => deleteItem(item.id)}>
            <Trash2 size={13} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="v2-tool-workbench v2-punchv2-workbench">
      <Panel className="v2-tool-panel" eyebrow="Add deficiency" title="New punch list item">
        <div className="v2-tool-input-grid">
          <label>Job
            <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
              <option value="">— Select job (optional) —</option>
              {savedJobs.map((j) => <option key={j.id} value={String(j.id)}>{j.title}</option>)}
            </select>
          </label>
          <label>Category
            <select value={category} onChange={(e) => setCategory(e.target.value as PunchCategory)}>
              {PUNCH_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="is-wide">Description *
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe the deficiency…" />
          </label>
          <label>Photo (optional)
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") setPhotoUrl(reader.result);
              };
              reader.readAsDataURL(file);
            }} />
          </label>
          {photoUrl && <img src={photoUrl} alt="Preview" className="v2-punchv2-preview" />}
        </div>
        {notice && <p className="v2-record-notice" role="status">{notice}</p>}
        <p className="v2-record-notice" role="status">{syncMessage}</p>
        <button type="button" className="v2-primary-button" disabled={!desc.trim()} onClick={addItem}>
          <Plus size={14} /> Add item
        </button>
      </Panel>

      <Panel className="v2-tool-panel" eyebrow={`${openItems.length} open · ${resolvedItems.length} resolved`} title="Punch list"
        action={<button type="button" onClick={exportReport}><Download size={14} /> Export</button>}
      >
        <section className="v2-punchv2-section">
          <h3 className="v2-punchv2-section-title">Open items ({openItems.length})</h3>
          {openItems.length ? openItems.map((i) => renderItem(i, false)) : <p className="v2-muted-copy">No open items.</p>}
        </section>
        <section className="v2-punchv2-section">
          <h3 className="v2-punchv2-section-title">Resolved ({resolvedItems.length})</h3>
          {resolvedItems.length ? resolvedItems.map((i) => renderItem(i, true)) : <p className="v2-muted-copy">No resolved items yet.</p>}
        </section>
      </Panel>
    </div>
  );
}

function SafetyChecklistTool({ activeJob }: { activeJob: Job | null }) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_SAFETY_ITEMS.map((item) => [item, false]))
  );
  const [jobRef, setJobRef] = useState(activeJob?.title ?? "");
  const [completedBy, setCompletedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [logs, setLogs] = useState<SafetyLog[]>(readSafetyLogs);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("safety_check").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(safetyLogFromServer).filter((log): log is SafetyLog => Boolean(log));
      if (mapped.length) {
        setLogs(mapped);
        persistSafetyLogs(mapped);
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readSafetyLogs();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((log) => upsertToolRecord(safetyLogToServerInput(log)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local safety checks synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New safety checks sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function persistSafetyEntries(next: SafetyLog[], changedLog?: SafetyLog) {
    setLogs(next);
    persistSafetyLogs(next);
    if (!changedLog) return;
    void upsertToolRecord(safetyLogToServerInput(changedLog)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function toggleCheck(item: string) {
    setChecks((prev) => ({ ...prev, [item]: !prev[item] }));
  }

  function checkAll() { setChecks(Object.fromEntries(ALL_SAFETY_ITEMS.map((i) => [i, true]))); }
  function clearAll() { setChecks(Object.fromEntries(ALL_SAFETY_ITEMS.map((i) => [i, false]))); }

  function signOff() {
    const log: SafetyLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      jobRef: jobRef.trim(),
      completedBy: completedBy.trim() || "On-site crew",
      checks: { ...checks },
      notes: notes.trim(),
      signedAt: new Date().toISOString(),
    };
    const next = [log, ...logs];
    persistSafetyEntries(next, log);
    clearAll();
    setNotes("");
    setNotice("Site check signed off and saved.");
    setTimeout(() => setNotice(""), 3000);
  }

  const checkedCount = Object.values(checks).filter(Boolean).length;
  const totalItems = ALL_SAFETY_ITEMS.length;
  const pct = Math.round((checkedCount / totalItems) * 100);

  return (
    <div className="v2-tool-workbench v2-safety-workbench">
      <Panel className="v2-tool-panel v2-safety-checklist-panel" eyebrow="Daily site check" title="Field safety checklist">
        <div className="v2-safety-meta-inputs">
          <label>Job / site<input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Job name or site address" /></label>
          <label>Completed by<input value={completedBy} onChange={(e) => setCompletedBy(e.target.value)} placeholder="Your name" /></label>
        </div>
        <div className="v2-safety-check-controls">
          <span>{checkedCount}/{totalItems} checked</span>
          <button type="button" onClick={checkAll}>Check all</button>
          <button type="button" onClick={clearAll}>Clear all</button>
        </div>
        {Object.entries(SAFETY_CATEGORIES).map(([category, items]) => (
          <div key={category} className="v2-safety-category">
            <h3>{category}</h3>
            <div className="v2-safety-items">
              {items.map((item) => (
                <label key={item} className={`v2-safety-item${checks[item] ? " is-checked" : ""}`}>
                  <input type="checkbox" checked={checks[item]} onChange={() => toggleCheck(item)} />
                  {item}
                </label>
              ))}
            </div>
          </div>
        ))}
        <label>Notes / hazards<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Site-specific hazards, exceptions, or additional notes…" /></label>
        {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
        <p className="v2-record-notice" role="status">{syncMessage}</p>
        <button type="button" className="v2-primary-button" onClick={signOff}><Shield size={14} />Sign off site check</button>
      </Panel>

      <aside className="v2-safety-summary">
        <Panel className="v2-tool-panel v2-tool-summary-panel" eyebrow="Today's check" title={`${checkedCount}/${totalItems}`}>
          <div className="v2-safety-progress-bar">
            <div className="v2-safety-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="v2-tool-breakdown">
            {Object.entries(SAFETY_CATEGORIES).map(([cat, items]) => {
              const catChecked = items.filter((i) => checks[i]).length;
              return <div key={cat}><span>{cat}</span><strong>{catChecked}/{items.length}</strong></div>;
            })}
          </div>
        </Panel>
        {logs.length ? (
          <Panel className="v2-tool-panel" eyebrow={`${logs.length} sign-offs`} title="Sign-off history">
            <div className="v2-safety-log-list">
              {logs.slice(0, 6).map((log) => {
                const done = Object.values(log.checks).filter(Boolean).length;
                const total = Object.values(log.checks).length;
                return (
                  <article key={log.id} className="v2-safety-log-item">
                    <strong>{log.date} · {log.jobRef || "No job ref"}</strong>
                    <small>{done}/{total} · {log.completedBy}</small>
                  </article>
                );
              })}
            </div>
          </Panel>
        ) : null}
      </aside>
    </div>
  );
}

// ── Time Tracker ─────────────────────────────────────────────────────────────

// ── Bid Builder ───────────────────────────────────────────────────────────────

interface PaymentTrackerRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  invoiceDate: string;
  invoiceAmount: number;
  paidDate?: string;
  paidAmount?: number;
  status: "invoiced" | "partial" | "paid" | "overdue";
  notes?: string;
}

// ── Contract Templates Tool ───────────────────────────────────────────────────

const CONTRACT_TEMPLATES = [
  {
    id: "scope",
    name: "Scope of Work",
    fields: ["contractorName", "clientName", "projectAddress", "startDate", "completionDate", "scopeDescription", "totalAmount"],
    labels: ["Your Name/Company", "Client Name", "Project Address", "Start Date", "Completion Date", "Scope of Work Description", "Total Contract Amount ($)"],
    body: (v: Record<string,string>) => `SCOPE OF WORK AGREEMENT

Contractor: ${v.contractorName}
Client: ${v.clientName}
Project Address: ${v.projectAddress}

This agreement confirms that ${v.contractorName} ("Contractor") will perform the following work at the above address:

SCOPE:
${v.scopeDescription}

TIMELINE: Work to begin ${v.startDate} and be substantially complete by ${v.completionDate}.

PAYMENT: Total contract amount is $${v.totalAmount}. Payment due upon completion unless otherwise agreed in writing.

Both parties agree to the terms above.

Contractor Signature: _______________________  Date: _______
Client Signature: ___________________________  Date: _______`,
  },
  {
    id: "change-order",
    name: "Change Order",
    fields: ["contractorName", "clientName", "projectAddress", "changeDescription", "additionalCost", "newCompletionDate"],
    labels: ["Your Name/Company", "Client Name", "Project Address", "Description of Change", "Additional Cost ($)", "Revised Completion Date"],
    body: (v: Record<string,string>) => `CHANGE ORDER

Contractor: ${v.contractorName}
Client: ${v.clientName}
Project Address: ${v.projectAddress}

This change order modifies the original contract as follows:

CHANGE DESCRIPTION:
${v.changeDescription}

ADDITIONAL COST: $${v.additionalCost}
REVISED COMPLETION DATE: ${v.newCompletionDate}

This change order must be signed by both parties before work begins.

Contractor Signature: _______________________  Date: _______
Client Signature: ___________________________  Date: _______`,
  },
  {
    id: "payment-terms",
    name: "Payment Terms",
    fields: ["contractorName", "clientName", "projectAddress", "totalAmount", "depositAmount", "depositDueDate", "finalPaymentTrigger"],
    labels: ["Your Name/Company", "Client Name", "Project Address", "Total Amount ($)", "Deposit Amount ($)", "Deposit Due Date", "Final Payment Trigger (e.g., 'upon final inspection')"],
    body: (v: Record<string,string>) => `PAYMENT TERMS AGREEMENT

Contractor: ${v.contractorName}
Client: ${v.clientName}
Project: ${v.projectAddress}

TOTAL CONTRACT VALUE: $${v.totalAmount}

PAYMENT SCHEDULE:
1. Deposit: $${v.depositAmount} due by ${v.depositDueDate}
2. Final Payment: Remaining balance due ${v.finalPaymentTrigger}

Late payments are subject to 1.5% monthly interest. Contractor reserves the right to stop work if payments are not received as scheduled.

Contractor Signature: _______________________  Date: _______
Client Signature: ___________________________  Date: _______`,
  },
  {
    id: "lien-waiver",
    name: "Lien Waiver",
    fields: ["contractorName", "clientName", "projectAddress", "paymentAmount", "paymentDate", "workDescription"],
    labels: ["Your Name/Company", "Client/Owner Name", "Property Address", "Payment Amount ($)", "Payment Date", "Work Performed"],
    body: (v: Record<string,string>) => `CONDITIONAL LIEN WAIVER AND RELEASE

For valuable consideration of $${v.paymentAmount} received on ${v.paymentDate}, ${v.contractorName} ("Claimant") hereby waives and releases any lien, claim, or right against:

Property: ${v.projectAddress}
Owner: ${v.clientName}

For work and materials furnished through the above date:
${v.workDescription}

This waiver is conditioned upon actual receipt and clearance of the payment described above.

Claimant Signature: _______________________  Date: _______
Printed Name: _____________________________`,
  },
  {
    id: "sub-agreement",
    name: "Subcontractor Agreement",
    fields: ["gcName", "subName", "projectAddress", "tradeScope", "startDate", "completionDate", "subAmount", "paymentTerms"],
    labels: ["General Contractor Name", "Subcontractor Name", "Project Address", "Trade/Scope of Work", "Start Date", "Completion Date", "Subcontract Amount ($)", "Payment Terms"],
    body: (v: Record<string,string>) => `SUBCONTRACTOR AGREEMENT

General Contractor: ${v.gcName}
Subcontractor: ${v.subName}
Project: ${v.projectAddress}

SCOPE: ${v.subName} agrees to perform the following work:
${v.tradeScope}

TIMELINE: ${v.startDate} through ${v.completionDate}
SUBCONTRACT AMOUNT: $${v.subAmount}
PAYMENT TERMS: ${v.paymentTerms}

Subcontractor agrees to: maintain appropriate insurance, comply with all safety requirements, obtain required permits, and complete work per applicable codes.

GC Signature: __________________________  Date: _______
Sub Signature: _________________________  Date: _______`,
  },
];

function ContractTemplateTool() {
  const [selectedTemplateId, setSelectedTemplateId] = useState("scope");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const template = CONTRACT_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? CONTRACT_TEMPLATES[0];

  function handleFieldChange(field: string, value: string) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }

  function generateContract() {
    const values: Record<string, string> = {};
    for (const field of template.fields) {
      values[field] = formValues[field] ?? "";
    }
    setGenerated(template.body(values));
  }

  async function handleCopy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  return (
    <div className="v2-tool-panel" style={{ maxWidth: 720 }}>
      <div className="v2-contract-templates">
        {CONTRACT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`v2-contract-template-pill${selectedTemplateId === t.id ? " is-active" : ""}`}
            onClick={() => { setSelectedTemplateId(t.id); setGenerated(null); setFormValues({}); }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {generated ? (
        <>
          <textarea className="v2-contract-output" readOnly value={generated} />
          <div className="v2-contract-actions">
            <button type="button" className="v2-contract-copy-btn" onClick={() => void handleCopy()}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <button type="button" className="v2-contract-print-btn" onClick={() => window.print()}>Print</button>
            <button type="button" className="v2-contract-edit-btn" onClick={() => setGenerated(null)}>Edit</button>
          </div>
        </>
      ) : (
        <>
          <div className="v2-contract-form">
            {template.fields.map((field, i) => (
              <div key={field} className="v2-contract-field">
                <label>{template.labels[i]}
                  {field === "scopeDescription" || field === "changeDescription" || field === "workDescription" || field === "tradeScope" ? (
                    <textarea
                      value={formValues[field] ?? ""}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      rows={3}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formValues[field] ?? ""}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                    />
                  )}
                </label>
              </div>
            ))}
          </div>
          <button type="button" className="v2-contract-generate-btn" onClick={generateContract}>
            Generate Contract
          </button>
        </>
      )}
    </div>
  );
}

// ── Job Checklists Tool ───────────────────────────────────────────────────────

const JOB_CHECKLISTS: Record<string, Record<string, string[]>> = {
  "Electrician": {
    "Rough-In Inspection": [
      "Permit posted and visible","Panel/sub-panel location confirmed","Wire gauge correct for circuit load","All boxes secured and at correct height","Wire stapled per code (every 4.5ft, within 12in of box)","Proper wire protection through studs (nail plates)","AFCI/GFCI locations marked","Smoke detector wiring roughed in","No wire splices outside of boxes","Inspector access confirmed"
    ],
    "Panel Upgrade": [
      "Old panel de-energized and tagged out","New panel properly grounded","All circuits labeled","Main breaker sized correctly","Ground rods driven and bonded","Neutral and ground buses separated","Arc fault breakers installed where required","Panel cover fits flush","Final torque on lugs verified","City inspection scheduled"
    ],
    "Service Call": [
      "Customer complaint documented","Circuit tested with multimeter","GFCI outlets checked and reset","Breaker tested (not tripped internally)","Connections inspected for heat damage","Neutral connections tightened","Issue root cause identified","Fix verified before leaving","Customer signed off","Invoice/receipt provided"
    ],
  },
  "Plumber": {
    "Rough-In": [
      "Permit pulled and posted","DWV slope verified (1/4in per foot)","Vent stack locations confirmed","P-traps roughed in at correct height","Water supply lines roughed in","Pressure test passed (air or water)","Pipe supports installed per code","Cleanout locations accessible","No ABS/PVC mixed without adapter","Inspector walkthrough complete"
    ],
    "Fixture Install": [
      "Water shut-offs functional","Supply lines correct length and material","Toilet flange at finished floor level","Toilet wax ring new and seated","Sink drain aligned with rough-in","P-trap fully assembled (no over-tightening)","Faucet connections hand-tight + 1/4 turn","All fixtures caulked at wall","Test flush (toilet) 3 times","Check under sink for drips 10 min"
    ],
    "Water Heater": [
      "Old unit drained and disconnected","New unit properly strapped (seismic if required)","T&P relief valve installed and piped to floor","Expansion tank installed (closed systems)","Correct gas line size / electrical amperage","Flue/venting correct gauge and slope","Anode rod checked","Thermostat set to 120°F","First-hour rating confirmed with customer","Permit finaled"
    ],
  },
  "HVAC": {
    "Equipment Startup": [
      "Electrical disconnect installed and labeled","Refrigerant line set leak-checked","Correct refrigerant type and charge","Static pressure measured and within spec","Airflow balanced (each register measured)","Thermostat wired and programmed","Drain line flushed and clear","Filter installed (correct size and direction)","Outdoor unit level and clear of debris","Customer walkthrough complete"
    ],
    "Annual Maintenance": [
      "Filter replaced","Coil cleaned (indoor and outdoor)","Drain pan and line clear","Refrigerant level checked","Capacitors tested","Contactors inspected for pitting","Blower wheel clean","Belt (if applicable) tension and condition","All electrical connections tight","System cycled on heat and cool"
    ],
  },
  "Carpenter": {
    "Framing Inspection": [
      "Stud spacing correct (16in or 24in OC)","Headers sized for spans","King studs and trimmers doubled","Top plate doubled","Fire blocking installed","Engineered lumber stamped and approved","Beam bearing correct","Floor joist hangers properly nailed","Shear panel nailing pattern correct","Inspector approved"
    ],
    "Cabinet Install": [
      "Wall studs located and marked","Level line snapped at 34.5in (base) and 54in (upper)","Upper cabinets installed first","Screws into studs (min 2 per cabinet)","All cabinets level and plumb","Doors adjusted (hinges aligned)","Drawer slides fully engaged","Filler strips cut and installed","Hardware installed and aligned","Customer walkthrough signed off"
    ],
  },
  "General Contractor": {
    "Pre-Construction": [
      "Permit approved and posted","Utility locates called (811)","Temporary power/water arranged","Site access and staging area confirmed","Subcontractor schedule finalized","Material delivery dates confirmed","Existing conditions documented (photos)","Neighbor notification completed if needed","Porta-potty ordered if needed","Safety plan communicated to all subs"
    ],
    "Rough Framing Closeout": [
      "Framing inspection passed","MEP rough-ins complete and inspected","Insulation inspection passed","Window and door flashing complete","Roof sheathing and underlayment complete","All penetrations fire-blocked","Temporary bracing removed","Site clean for drywall delivery","Schedule confirmed with drywall crew","Owner updated on timeline"
    ],
    "Project Closeout": [
      "Punch list complete","Final inspections passed (all trades)","Certificate of occupancy received","Final cleaning complete","All subcontractors paid","Lien waivers collected from all subs","As-built drawings updated","Owner manual and warranties provided","Keys and codes transferred","Final photos taken"
    ],
  },
};

const checklistStorageKey = "rivt.checklists.v1";

function readChecklistsFromStorage(): Record<string, Record<string, boolean>> {
  try {
    const stored = localStorage.getItem(checklistStorageKey);
    if (!stored) return {};
    return JSON.parse(stored) as Record<string, Record<string, boolean>>;
  } catch { return {}; }
}

function saveChecklistsToStorage(data: Record<string, Record<string, boolean>>) {
  try { localStorage.setItem(checklistStorageKey, JSON.stringify(data)); } catch { /* noop */ }
}

function checklistRecordLocalId(storageKey: string) {
  const normalized = storageKey
    .trim()
    .replace(/[^A-Za-z0-9:_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (normalized || "default-checklist").slice(0, 120);
}

interface StoredChecklistRecord {
  storageKey: string;
  trade: string;
  jobType: string;
  jobId: string;
  checks: Record<string, boolean>;
  updatedAt: string;
}

function parseChecklistStorageKey(storageKey: string) {
  const [trade = "", jobType = "", jobId = "default"] = storageKey.split(":");
  return { trade, jobType, jobId };
}

function isStoredChecklistRecord(value: unknown): value is StoredChecklistRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredChecklistRecord>;
  return typeof candidate.storageKey === "string"
    && typeof candidate.trade === "string"
    && typeof candidate.jobType === "string"
    && typeof candidate.jobId === "string"
    && typeof candidate.checks === "object"
    && candidate.checks !== null
    && typeof candidate.updatedAt === "string";
}

function checklistRecordFromServer(record: ServerToolRecord): StoredChecklistRecord | null {
  if (!isStoredChecklistRecord(record.payload)) return null;
  return {
    ...record.payload,
    updatedAt: record.payload.updatedAt || record.updatedAt || new Date().toISOString(),
  };
}

function checklistRecordToServerInput(storageKey: string, checks: Record<string, boolean>) {
  const parsed = parseChecklistStorageKey(storageKey);
  const payload: StoredChecklistRecord = {
    storageKey,
    trade: parsed.trade,
    jobType: parsed.jobType,
    jobId: parsed.jobId,
    checks,
    updatedAt: new Date().toISOString(),
  };
  return {
    recordType: "job_checklist" as const,
    localId: checklistRecordLocalId(storageKey),
    title: `${parsed.trade || "Job"} ${parsed.jobType || "checklist"}`.trim(),
    status: "active",
    recordDate: payload.updatedAt.slice(0, 10),
    amountCents: null,
    payload: { ...payload } as Record<string, unknown>,
  };
}

function getActiveJobId(): string {
  try {
    const stored = localStorage.getItem("rivt.jobs.v1");
    if (!stored) return "default";
    const jobs = JSON.parse(stored) as Array<{ id: string; status?: string }>;
    const active = jobs.find((j) => j.status === "active" || j.status === "Open");
    return active?.id ?? "default";
  } catch { return "default"; }
}

function JobChecklistTool() {
  const trades = Object.keys(JOB_CHECKLISTS);
  const [selectedTrade, setSelectedTrade] = useState(trades[0]);
  const jobTypes = Object.keys(JOB_CHECKLISTS[selectedTrade] ?? {});
  const [selectedJobType, setSelectedJobType] = useState(jobTypes[0]);
  const activeJobId = getActiveJobId();
  const storageKey = `${selectedTrade}:${selectedJobType}:${activeJobId}`;
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");

  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const all = readChecklistsFromStorage();
    return all[storageKey] ?? {};
  });

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("job_checklist").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(checklistRecordFromServer).filter((record): record is StoredChecklistRecord => Boolean(record));
      if (mapped.length) {
        const all = mapped.reduce<Record<string, Record<string, boolean>>>((records, record) => {
          records[record.storageKey] = record.checks;
          return records;
        }, {});
        saveChecklistsToStorage(all);
        setChecks(all[storageKey] ?? {});
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readChecklistsFromStorage();
      const snapshotEntries = Object.entries(localSnapshot);
      if (snapshotEntries.length) {
        void Promise.all(snapshotEntries.map(([key, value]) => upsertToolRecord(checklistRecordToServerInput(key, value)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local job checklists synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New job checklist progress syncs to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, [storageKey]);

  useEffect(() => {
    const all = readChecklistsFromStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecks(all[storageKey] ?? {});
  }, [storageKey]);

  const items = JOB_CHECKLISTS[selectedTrade]?.[selectedJobType] ?? [];
  const completedCount = items.filter((item) => checks[item]).length;

  function toggleItem(item: string) {
    const next = { ...checks, [item]: !checks[item] };
    setChecks(next);
    const all = readChecklistsFromStorage();
    all[storageKey] = next;
    saveChecklistsToStorage(all);
    void upsertToolRecord(checklistRecordToServerInput(storageKey, next)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function resetChecklist() {
    if (!window.confirm("Reset all items on this checklist?")) return;
    const next: Record<string, boolean> = {};
    setChecks(next);
    const all = readChecklistsFromStorage();
    all[storageKey] = next;
    saveChecklistsToStorage(all);
    void upsertToolRecord(checklistRecordToServerInput(storageKey, next)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function handleTradeChange(trade: string) {
    setSelectedTrade(trade);
    const firstJobType = Object.keys(JOB_CHECKLISTS[trade] ?? {})[0] ?? "";
    setSelectedJobType(firstJobType);
  }

  const pct = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <div className="v2-tool-panel" style={{ maxWidth: 720 }}>
      <div className="v2-contract-templates">
        {trades.map((trade) => (
          <button
            key={trade}
            type="button"
            className={`v2-contract-template-pill${selectedTrade === trade ? " is-active" : ""}`}
            onClick={() => handleTradeChange(trade)}
          >
            {trade}
          </button>
        ))}
      </div>
      <div className="v2-contract-templates">
        {Object.keys(JOB_CHECKLISTS[selectedTrade] ?? {}).map((jt) => (
          <button
            key={jt}
            type="button"
            className={`v2-contract-template-pill${selectedJobType === jt ? " is-active" : ""}`}
            onClick={() => setSelectedJobType(jt)}
          >
            {jt}
          </button>
        ))}
      </div>
      <div className="v2-checklist-progress">
        <span className="v2-checklist-progress-label">{completedCount} of {items.length} complete</span>
        <div className="v2-checklist-progress-bar-wrap">
          <div className="v2-checklist-progress-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="v2-checklist-items">
        {items.map((item) => (
          <div
            key={item}
            className={`v2-checklist-item${checks[item] ? " is-checked" : ""}`}
            onClick={() => toggleItem(item)}
            role="checkbox"
            aria-checked={checks[item] ?? false}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") toggleItem(item); }}
          >
            <div className="v2-checklist-item-check">
              {checks[item] && <CheckSquare size={14} color="#fff" />}
            </div>
            <span className="v2-checklist-item-text">{item}</span>
          </div>
        ))}
      </div>
      <p className="v2-record-notice" role="status">{syncMessage}</p>
      <button type="button" className="v2-checklist-reset-btn" onClick={resetChecklist}>Reset Checklist</button>
    </div>
  );
}

// ── Payment Tracker Tool ──────────────────────────────────────────────────────

const paymentsTrackerKey = "rivt.payments.v1";

function readPaymentTrackerRecords(): PaymentTrackerRecord[] {
  try {
    const stored = localStorage.getItem(paymentsTrackerKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as PaymentTrackerRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function savePaymentTrackerRecords(records: PaymentTrackerRecord[]) {
  try { localStorage.setItem(paymentsTrackerKey, JSON.stringify(records)); } catch { /* noop */ }
}

function isPaymentTrackerRecord(value: unknown): value is PaymentTrackerRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PaymentTrackerRecord>;
  return typeof candidate.id === "string"
    && typeof candidate.jobId === "string"
    && typeof candidate.jobTitle === "string"
    && typeof candidate.invoiceDate === "string"
    && typeof candidate.invoiceAmount === "number"
    && ["invoiced", "partial", "paid", "overdue"].includes(String(candidate.status));
}

function paymentRecordFromServer(record: ServerToolRecord): PaymentTrackerRecord | null {
  const payload = record.payload;
  if (!isPaymentTrackerRecord(payload)) return null;
  return {
    ...payload,
    id: record.localId,
    jobTitle: payload.jobTitle || record.title,
    invoiceDate: payload.invoiceDate || record.recordDate || new Date().toISOString().slice(0, 10),
    invoiceAmount: typeof payload.invoiceAmount === "number" ? payload.invoiceAmount : (record.amountCents ?? 0) / 100,
  };
}

function paymentRecordToServerInput(record: PaymentTrackerRecord) {
  return {
    recordType: "payment_record" as const,
    localId: record.id,
    title: record.jobTitle || "Standalone invoice",
    status: record.status,
    recordDate: record.invoiceDate || null,
    amountCents: Math.round(Math.max(0, record.invoiceAmount) * 100),
    payload: { ...record },
  };
}

function readLocalJobsForPayments(): Array<{ id: string; title: string }> {
  try {
    const stored = localStorage.getItem("rivt.jobs.v1");
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Array<{ id: string; title: string }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function getDisplayStatus(record: PaymentTrackerRecord): PaymentTrackerRecord["status"] {
  if (record.status === "invoiced") {
    const invoiceDate = new Date(record.invoiceDate);
    const daysDiff = (Date.now() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) return "overdue";
  }
  return record.status;
}

function PaymentTrackerTool() {
  const [records, setRecords] = useState<PaymentTrackerRecord[]>(readPaymentTrackerRecords);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const localJobs = readLocalJobsForPayments();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    jobId: localJobs[0]?.id ?? "",
    invoiceAmount: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const totalInvoiced = records.reduce((sum, r) => sum + r.invoiceAmount, 0);
  const received = records.filter((r) => r.status === "paid").reduce((sum, r) => sum + (r.paidAmount ?? 0), 0);
  const outstanding = totalInvoiced - received;

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("payment_record").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(paymentRecordFromServer).filter((record): record is PaymentTrackerRecord => Boolean(record));
      if (mapped.length) {
        setRecords(mapped);
        savePaymentTrackerRecords(mapped);
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readPaymentTrackerRecords();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((record) => upsertToolRecord(paymentRecordToServerInput(record)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local payment records synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New payment records sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function persistRecords(next: PaymentTrackerRecord[], changedRecord?: PaymentTrackerRecord) {
    setRecords(next);
    savePaymentTrackerRecords(next);
    if (!changedRecord) return;
    void upsertToolRecord(paymentRecordToServerInput(changedRecord)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function saveInvoice() {
    const job = localJobs.find((j) => j.id === form.jobId);
    const record: PaymentTrackerRecord = {
      id: crypto.randomUUID(),
      jobId: form.jobId,
      jobTitle: job?.title ?? "Standalone",
      invoiceDate: form.invoiceDate,
      invoiceAmount: parseFloat(form.invoiceAmount) || 0,
      status: "invoiced",
      notes: form.notes || undefined,
    };
    const next = [record, ...records];
    persistRecords(next, record);
    setShowForm(false);
    setForm({ jobId: localJobs[0]?.id ?? "", invoiceAmount: "", invoiceDate: new Date().toISOString().slice(0, 10), notes: "" });
  }

  function markPaid(id: string) {
    let changed: PaymentTrackerRecord | undefined;
    const next = records.map((r) => {
      if (r.id !== id) return r;
      changed = {
        ...r,
        paidDate: new Date().toISOString().slice(0, 10),
        paidAmount: r.invoiceAmount,
        status: "paid" as const,
      };
      return changed;
    });
    persistRecords(next, changed);
  }

  function deleteRecord(id: string) {
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    savePaymentTrackerRecords(next);
    void deleteToolRecordByLocalId("payment_record", id).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device only. Could not sync deletion.");
    });
  }

  const sorted = [...records].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

  function statusBadgeClass(status: PaymentTrackerRecord["status"]) {
    return `v2-payment-badge ${status}`;
  }

  function daysSince(dateStr: string) {
    // eslint-disable-next-line react-hooks/purity
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    return days === 0 ? "Today" : `${days}d ago`;
  }

  return (
    <div className="v2-tool-panel" style={{ maxWidth: 720 }}>
      <div className="v2-payment-summary">
        <div className="v2-payment-stat">
          <div className="v2-payment-stat-value">${totalInvoiced.toLocaleString()}</div>
          <div className="v2-payment-stat-label">Total Invoiced</div>
        </div>
        <div className="v2-payment-stat">
          <div className="v2-payment-stat-value">${received.toLocaleString()}</div>
          <div className="v2-payment-stat-label">Received</div>
        </div>
        <div className="v2-payment-stat">
          <div className="v2-payment-stat-value">${outstanding.toLocaleString()}</div>
          <div className="v2-payment-stat-label">Outstanding</div>
        </div>
      </div>

      <button type="button" className="v2-payment-add-btn" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "+ Add Invoice"}
      </button>
      <p className="v2-record-notice" role="status">{syncMessage}</p>

      {showForm && (
        <div className="v2-payment-form">
          <select
            value={form.jobId}
            onChange={(e) => setForm((f) => ({ ...f, jobId: e.target.value }))}
          >
            <option value="">Standalone / no job</option>
            {localJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Invoice amount ($)"
            value={form.invoiceAmount}
            onChange={(e) => setForm((f) => ({ ...f, invoiceAmount: e.target.value }))}
          />
          <input
            type="date"
            value={form.invoiceDate}
            onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="v2-payment-form-btns">
            <button type="button" className="v2-payment-save-btn" onClick={saveInvoice} disabled={!form.invoiceAmount}>Save Invoice</button>
            <button type="button" className="v2-payment-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="v2-payment-list">
        {sorted.map((record) => {
          const displayStatus = getDisplayStatus(record);
          return (
            <div key={record.id} className="v2-payment-row">
              <div className="v2-payment-row-top">
                <span className="v2-payment-job-name">{record.jobTitle}</span>
                <span className="v2-payment-amount">${record.invoiceAmount.toLocaleString()}</span>
              </div>
              <div className="v2-payment-row-meta">
                <span className={statusBadgeClass(displayStatus)}>{displayStatus}</span>
                <span>{daysSince(record.invoiceDate)}</span>
                {record.notes && <span>{record.notes}</span>}
              </div>
              {record.status !== "paid" && (
                <div className="v2-payment-row-actions">
                  <button type="button" className="v2-payment-paid-btn" onClick={() => markPaid(record.id)}>Mark Paid</button>
                  <button type="button" className="v2-payment-delete-btn" onClick={() => deleteRecord(record.id)}>Delete</button>
                </div>
              )}
              {record.status === "paid" && (
                <div className="v2-payment-row-actions">
                  <button type="button" className="v2-payment-delete-btn" onClick={() => deleteRecord(record.id)}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
        {records.length === 0 && <p className="v2-muted-copy">No invoices tracked yet. Add your first invoice above.</p>}
      </div>
    </div>
  );
}

// ── Daily Report ──────────────────────────────────────────────────────────────

const DAILY_REPORTS_KEY = "rivt.dailyReports.v1";

const WEATHER_OPTIONS = ["Clear", "Partly Cloudy", "Overcast", "Rain", "Hot"] as const;
type WeatherOption = typeof WEATHER_OPTIONS[number];

interface DailyReport {
  id: string;
  date: string;
  jobId: string;
  jobTitle: string;
  weather: WeatherOption;
  temperature: string;
  crewOnSite: number;
  workCompleted: string;
  issues: string;
  materialsUsed: string;
  visitors: string;
  savedAt: string;
}

function readDailyReports(): DailyReport[] {
  try {
    const stored = localStorage.getItem(DAILY_REPORTS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as DailyReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistDailyReports(reports: DailyReport[]) {
  try { localStorage.setItem(DAILY_REPORTS_KEY, JSON.stringify(reports.slice(0, 365))); } catch { /* noop */ }
}

function isDailyReport(value: unknown): value is DailyReport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DailyReport>;
  return typeof candidate.id === "string"
    && typeof candidate.date === "string"
    && typeof candidate.jobId === "string"
    && typeof candidate.jobTitle === "string"
    && WEATHER_OPTIONS.includes(candidate.weather as WeatherOption)
    && typeof candidate.temperature === "string"
    && typeof candidate.crewOnSite === "number"
    && typeof candidate.workCompleted === "string"
    && typeof candidate.issues === "string"
    && typeof candidate.materialsUsed === "string"
    && typeof candidate.visitors === "string"
    && typeof candidate.savedAt === "string";
}

function dailyReportFromServer(record: ServerToolRecord): DailyReport | null {
  if (!isDailyReport(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    jobTitle: record.payload.jobTitle || record.title,
    date: record.payload.date || record.recordDate || new Date().toISOString().slice(0, 10),
    savedAt: record.payload.savedAt || record.updatedAt || new Date().toISOString(),
  };
}

function dailyReportToServerInput(report: DailyReport) {
  return {
    recordType: "daily_report" as const,
    localId: report.id,
    title: report.jobTitle || "Daily report",
    status: "complete",
    recordDate: report.date || null,
    amountCents: null,
    payload: { ...report },
  };
}

function formatDailyReport(r: DailyReport): string {
  return [
    `RIVT DAILY SITE REPORT`,
    `Date: ${r.date}`,
    `Job: ${r.jobTitle || "Unspecified"}`,
    `Weather: ${r.weather} · ${r.temperature || "—"}`,
    `Crew on site: ${r.crewOnSite}`,
    ``,
    `WORK COMPLETED`,
    r.workCompleted || "—",
    ``,
    `ISSUES / DELAYS`,
    r.issues || "None",
    ``,
    `MATERIALS USED`,
    r.materialsUsed || "—",
    ``,
    `VISITORS ON SITE`,
    r.visitors || "None",
  ].join("\n");
}

function DailyReportTool() {
  const [reports, setReports] = useState<DailyReport[]>(readDailyReports);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [jobId, setJobId] = useState("");
  const [weather, setWeather] = useState<WeatherOption>("Clear");
  const [temperature, setTemperature] = useState("");
  const [crewOnSite, setCrewOnSite] = useState("1");
  const [workCompleted, setWorkCompleted] = useState("");
  const [issues, setIssues] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [visitors, setVisitors] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedJobs] = useState<Array<{ id: number; title: string }>>(readSavedJobsV1);

  const selectedJobTitle = savedJobs.find((j) => String(j.id) === jobId)?.title ?? jobId;

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("daily_report").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(dailyReportFromServer).filter((report): report is DailyReport => Boolean(report));
      if (mapped.length) {
        setReports(mapped);
        persistDailyReports(mapped);
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readDailyReports();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((report) => upsertToolRecord(dailyReportToServerInput(report)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local daily reports synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New daily reports sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function persistDailyReportEntries(next: DailyReport[], changedReport?: DailyReport) {
    setReports(next);
    persistDailyReports(next);
    if (!changedReport) return;
    void upsertToolRecord(dailyReportToServerInput(changedReport)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function saveReport() {
    const report: DailyReport = {
      id: crypto.randomUUID(),
      date,
      jobId,
      jobTitle: selectedJobTitle,
      weather,
      temperature: temperature.trim(),
      crewOnSite: Math.max(0, parseInt(crewOnSite, 10) || 0),
      workCompleted: workCompleted.trim(),
      issues: issues.trim(),
      materialsUsed: materialsUsed.trim(),
      visitors: visitors.trim(),
      savedAt: new Date().toISOString(),
    };
    const next = [report, ...reports];
    persistDailyReportEntries(next, report);
    setWorkCompleted("");
    setIssues("");
    setMaterialsUsed("");
    setVisitors("");
    setNotice("Report saved.");
    setTimeout(() => setNotice(""), 2500);
  }

  async function copyReport(report: DailyReport) {
    try {
      await navigator.clipboard.writeText(formatDailyReport(report));
      setCopiedId(report.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* noop */ }
  }

  function exportAll() {
    const text = reports.map(formatDailyReport).join("\n\n" + "═".repeat(50) + "\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rivt-daily-reports-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="v2-tool-workbench v2-daily-report-workbench">
      <Panel className="v2-tool-panel" eyebrow="New entry" title="Daily site report">
        <div className="v2-tool-input-grid two">
          <label>Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>Job
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">— Select job —</option>
              {savedJobs.map((j) => <option key={j.id} value={String(j.id)}>{j.title}</option>)}
            </select>
          </label>
          <label>Weather
            <select value={weather} onChange={(e) => setWeather(e.target.value as WeatherOption)}>
              {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <label>Temperature
            <input value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="e.g. 78°F" />
          </label>
          <label>Crew on site
            <input type="number" min="0" value={crewOnSite} onChange={(e) => setCrewOnSite(e.target.value)} />
          </label>
          <div />
          <label className="is-wide">Work completed
            <textarea rows={3} value={workCompleted} onChange={(e) => setWorkCompleted(e.target.value)} placeholder="Summarize work done today…" />
          </label>
          <label className="is-wide">Issues / delays
            <textarea rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="Blockers, weather delays, material shortages…" />
          </label>
          <label className="is-wide">Materials used
            <textarea rows={2} value={materialsUsed} onChange={(e) => setMaterialsUsed(e.target.value)} placeholder="List materials consumed today…" />
          </label>
          <label className="is-wide">Visitors on site
            <textarea rows={2} value={visitors} onChange={(e) => setVisitors(e.target.value)} placeholder="Inspectors, owner, subcontractors… (optional)" />
          </label>
        </div>
        {notice && <p className="v2-record-notice" role="status">{notice}</p>}
        <p className="v2-record-notice" role="status">{syncMessage}</p>
        <button type="button" className="v2-primary-button" onClick={saveReport} disabled={!workCompleted.trim()}>
          <FileText size={14} /> Save report
        </button>
      </Panel>

      <Panel className="v2-tool-panel" eyebrow={`${reports.length} reports`} title="Past reports"
        action={reports.length ? <button type="button" onClick={exportAll}><Download size={14} /> Export all</button> : undefined}
      >
        {reports.length ? (
          <div className="v2-daily-report-list">
            {reports.map((r) => (
              <article key={r.id} className="v2-daily-report-row">
                <div className="v2-daily-report-summary">
                  <strong>{r.date}</strong>
                  <span>{r.jobTitle || "No job"} · {r.weather} {r.temperature ? `· ${r.temperature}` : ""} · {r.crewOnSite} crew</span>
                  <div className="v2-daily-report-actions">
                    <button type="button" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      {expandedId === r.id ? "Collapse" : "Expand"}
                    </button>
                    <button type="button" onClick={() => void copyReport(r)}>
                      {copiedId === r.id ? <CheckCircle2 size={13} /> : <Copy size={13} />} Copy
                    </button>
                  </div>
                </div>
                {expandedId === r.id && (
                  <div className="v2-daily-report-detail">
                    <pre>{formatDailyReport(r)}</pre>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="v2-muted-copy">No reports yet. Save your first daily site report above.</p>
        )}
      </Panel>
    </div>
  );
}

// ── Tax Summary ────────────────────────────────────────────────────────────────

type TaxTimeSession = {
  startedAt: string;
  endedAt: string | null;
};

type TaxExpenseEntry = {
  date: string;
  amount: number;
};

function readTaxTimeSessions(): TaxTimeSession[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("rivt.timeSessions.v1") ?? "[]") as TaxTimeSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readTaxExpenses(): TaxExpenseEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("rivt.expenses.v1") ?? "[]") as TaxExpenseEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isTaxTimeSession(value: unknown): value is TaxTimeSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TaxTimeSession>;
  return typeof candidate.startedAt === "string" && (candidate.endedAt === null || typeof candidate.endedAt === "string");
}

function isTaxExpenseEntry(value: unknown): value is TaxExpenseEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TaxExpenseEntry>;
  return typeof candidate.date === "string" && typeof candidate.amount === "number";
}

function taxTimeSessionFromServer(record: ServerToolRecord): TaxTimeSession | null {
  return isTaxTimeSession(record.payload) ? record.payload : null;
}

function taxExpenseFromServer(record: ServerToolRecord): TaxExpenseEntry | null {
  return isTaxExpenseEntry(record.payload) ? record.payload : null;
}

function TaxSummaryTool() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [timeSessions, setTimeSessions] = useState<TaxTimeSession[]>(readTaxTimeSessions);
  const [expenses, setExpenses] = useState<TaxExpenseEntry[]>(readTaxExpenses);
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>(readMileage);
  const [recordSource, setRecordSource] = useState("Using saved records on this device.");
  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  }, []);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchToolRecords("time_session"),
      fetchToolRecords("expense"),
      fetchToolRecords("mileage"),
    ]).then(([serverSessions, serverExpenses, serverMileage]) => {
      if (cancelled) return;
      const mappedSessions = serverSessions?.map(taxTimeSessionFromServer).filter((session): session is TaxTimeSession => Boolean(session)) ?? [];
      const mappedExpenses = serverExpenses?.map(taxExpenseFromServer).filter((expense): expense is TaxExpenseEntry => Boolean(expense)) ?? [];
      const mappedMileage = serverMileage?.map(mileageFromServer).filter((entry): entry is MileageEntry => Boolean(entry)) ?? [];
      if (mappedSessions.length) setTimeSessions(mappedSessions);
      if (mappedExpenses.length) setExpenses(mappedExpenses);
      if (mappedMileage.length) setMileageEntries(mappedMileage);
      if (serverSessions || serverExpenses || serverMileage) {
        setRecordSource(mappedSessions.length || mappedExpenses.length || mappedMileage.length
          ? "Using synced RIVT account records."
          : "No synced time, expense, or mileage records yet.");
        return;
      }
      setRecordSource("Using saved records on this device. Sign in with network access to sync.");
    });
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    const yearStr = String(selectedYear);

    // Gross income from time sessions × hourly rate
    const hourlyRate = readPrimaryHourlyRate(65);
    const grossIncome = timeSessions
      .filter((s) => s.endedAt && s.startedAt.startsWith(yearStr))
      .reduce((sum, s) => {
        const hrs = (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 3600000;
        return sum + hrs * hourlyRate;
      }, 0);

    // Business expenses
    const totalExpenses = expenses
      .filter((e) => e.date && e.date.startsWith(yearStr))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Estimated mileage deduction using the shared mileage-tool rate.
    const totalMiles = mileageEntries
      .filter((m) => m.date && m.date.startsWith(yearStr))
      .reduce((sum, m) => sum + (Number(m.miles) || 0), 0);
    const mileageDeduction = totalMiles * MILEAGE_RATE_PER_MILE;

    const netProfit = Math.max(0, grossIncome - totalExpenses - mileageDeduction);
    const seTax = netProfit * 0.9235 * 0.153;
    const quarterlyPayment = seTax / 4;

    return { grossIncome, totalExpenses, mileageDeduction, totalMiles, netProfit, seTax, quarterlyPayment };
  }, [expenses, mileageEntries, selectedYear, timeSessions]);

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  function getSummaryText() {
    return [
      `RIVT TAX SUMMARY — ${selectedYear}`,
      ``,
      `Gross Revenue:        ${fmt(summary.grossIncome)}`,
      `Business Expenses:    ${fmt(summary.totalExpenses)}`,
      `Mileage Deduction:    ${fmt(summary.mileageDeduction)} (${summary.totalMiles.toFixed(1)} mi @ ${MILEAGE_RATE_LABEL})`,
      `Net Profit:           ${fmt(summary.netProfit)}`,
      ``,
      `SE Tax Estimate:      ${fmt(summary.seTax)}`,
      `Quarterly Payment:    ${fmt(summary.quarterlyPayment)}`,
      ``,
      `This is an estimate only. Consult a tax professional.`,
    ].join("\n");
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(getSummaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  function exportCSV() {
    const rows = [
      ["Category", "Amount"],
      ["Gross Revenue", summary.grossIncome.toFixed(2)],
      ["Business Expenses", summary.totalExpenses.toFixed(2)],
      [`Mileage Deduction (${summary.totalMiles.toFixed(1)} mi)`, summary.mileageDeduction.toFixed(2)],
      ["Net Profit", summary.netProfit.toFixed(2)],
      ["SE Tax Estimate (15.3% × 92.35%)", summary.seTax.toFixed(2)],
      ["Quarterly Payment", summary.quarterlyPayment.toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rivt-tax-summary-${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="v2-tool-workbench v2-tax-summary-workbench">
      <Panel className="v2-tool-panel" eyebrow="Tax year" title="Tax summary">
        <div className="v2-tax-summary-year">
          <label>Tax year
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>

        <div className="v2-tax-summary-grid">
          <div className="v2-tax-summary-card">
            <small>Gross Revenue</small>
            <strong>{fmt(summary.grossIncome)}</strong>
          </div>
          <div className="v2-tax-summary-card">
            <small>Business Expenses</small>
            <strong>{fmt(summary.totalExpenses)}</strong>
          </div>
          <div className="v2-tax-summary-card">
            <small>Mileage Deduction</small>
            <strong>{fmt(summary.mileageDeduction)}</strong>
            <span className="v2-tax-summary-sub">{summary.totalMiles.toFixed(1)} mi @ {MILEAGE_RATE_LABEL}</span>
          </div>
          <div className="v2-tax-summary-card v2-tax-summary-card--highlight">
            <small>Net Profit</small>
            <strong>{fmt(summary.netProfit)}</strong>
          </div>
          <div className="v2-tax-summary-card v2-tax-summary-card--accent">
            <small>SE Tax Estimate</small>
            <strong>{fmt(summary.seTax)}</strong>
            <span className="v2-tax-summary-sub">15.3% × 92.35% × net profit</span>
          </div>
          <div className="v2-tax-summary-card v2-tax-summary-card--accent">
            <small>Quarterly Payment</small>
            <strong>{fmt(summary.quarterlyPayment)}</strong>
            <span className="v2-tax-summary-sub">SE tax ÷ 4</span>
          </div>
        </div>

        <p className="v2-record-notice" role="status">{recordSource}</p>
        <p className="v2-tax-disclaimer">This is an estimate only. Consult a tax professional.</p>

        <div className="v2-tax-summary-actions">
          <button type="button" className="v2-primary-button" onClick={() => void copySummary()}>
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} Copy summary
          </button>
          <button type="button" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </Panel>
    </div>
  );
}

function projectErrorMessage(error: unknown) {
  if (error instanceof ProjectApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not update the project record.";
}

function focusedActiveWorkFirst(items: CanonicalActiveWork[], focusedActiveWorkId: string | null) {
  if (!focusedActiveWorkId) return items;
  return [...items].sort((a, b) => {
    if (a.id === focusedActiveWorkId) return -1;
    if (b.id === focusedActiveWorkId) return 1;
    return 0;
  });
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

function resolveActiveToolJob(jobs: Job[], orderedActiveWork: CanonicalActiveWork[], focusedActiveWorkId: string | null) {
  const focusedWork = focusedActiveWorkId
    ? orderedActiveWork.find((work) => work.id === focusedActiveWorkId) ?? null
    : null;
  const focusedJobId = focusedWork?.jobId ?? focusedWork?.job?.id ?? null;
  if (focusedJobId) {
    const exactJob = jobs.find((job) => job.canonical?.id === focusedJobId || String(job.id) === focusedJobId);
    if (exactJob) return exactJob;
    const fallback = focusedWork ? activeWorkSummaryJob(focusedWork) : null;
    if (fallback) return fallback;
  }
  return jobs.find((job) => job.status !== "Paid / Closed") ?? jobs[0] ?? null;
}

export function ToolsStudio({ jobs, paymentRecords, mode = "tools", openTool = null, focusedActiveWorkId = null, activeWorkRecords = [], onOpenToolConsumed, onToolChange, onImmersiveChange, onNavigate }: ToolsStudioProps) {
  const requestedTool = mode === "tools" && openTool ? openTool : null;
  const [localActiveTool, setLocalActiveTool] = useState<ToolMode>("hub");
  const activeTool = requestedTool ?? localActiveTool;
  const [recentTools, setRecentTools] = useState(readRecentTools);
  const [fetchedActiveWork, setFetchedActiveWork] = useState<CanonicalActiveWork[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [projectAction, setProjectAction] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState<string | null>(null);
  const [recordNotice, setRecordNotice] = useState<string | null>(null);
  const [convertedEstimateDraft, setConvertedEstimateDraft] = useState<EstimateInvoiceDraft | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [completionChecklist, setCompletionChecklist] = useState<CompletionChecklistState>(defaultCompletionChecklist);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoOpenedRecordRef = useRef<string | null>(null);
  const toolSwipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const selectedCompletion = selectedProject?.completionSubmissions.find((completion) => completion.status === "submitted")
    ?? selectedProject?.completionSubmissions.at(-1)
    ?? null;
  const storedMedia = selectedProject?.media.filter((item) => item.status === "stored") ?? [];
  const latestEntry = selectedProject?.entries.at(-1) ?? null;
  const actionBusy = Boolean(projectAction);
  const recentToolLaunchers = useMemo(() => {
    const primaryModes = new Set(PRIMARY_TOOL_LAUNCHERS.map((tool) => tool.mode));
    const byMode = new Map(allToolLaunchers().map((tool) => [tool.mode, tool]));
    return recentTools
      .map((tool) => byMode.get(tool))
      .filter((tool): tool is ToolLauncher => {
        if (!tool) {
          return false;
        }
        return !primaryModes.has(tool.mode);
      });
  }, [recentTools]);
  const activeWork = activeWorkRecords.length ? activeWorkRecords : fetchedActiveWork;
  const orderedActiveWork = useMemo(
    () => focusedActiveWorkFirst(activeWork, focusedActiveWorkId),
    [activeWork, focusedActiveWorkId],
  );
  const activeJob = useMemo(
    () => resolveActiveToolJob(jobs, orderedActiveWork, focusedActiveWorkId),
    [focusedActiveWorkId, jobs, orderedActiveWork],
  );

  function setActiveTool(tool: ToolMode, options: { keepConvertedInvoice?: boolean } = {}) {
    if (!onToolChange) {
      onOpenToolConsumed?.();
    }
    if (tool !== "hub") {
      setRecentTools((current) => {
        const next = [tool, ...current.filter((item) => item !== tool)].slice(0, 4);
        persistRecentTools(next);
        return next;
      });
    }
    if (!options.keepConvertedInvoice) {
      setConvertedEstimateDraft(null);
    }
    setLocalActiveTool(tool);
    onToolChange?.(tool);
  }

  function openToolFromHub(tool: LaunchableToolMode) {
    setActiveTool(tool);
  }

  function handleConvertEstimateToInvoice(draft: EstimateInvoiceDraft) {
    setConvertedEstimateDraft(draft);
    setActiveTool("invoice", { keepConvertedInvoice: true });
  }

  useEffect(() => {
    const immersive = mode === "tools" && activeTool !== "hub";
    onImmersiveChange?.(immersive);
    return () => onImmersiveChange?.(false);
  }, [activeTool, mode, onImmersiveChange]);

  useEffect(() => {
    const root = document.documentElement;
    const immersive = mode === "tools" && activeTool !== "hub";
    if (immersive) {
      root.setAttribute("data-rivt-immersive-tool", activeTool);
    } else {
      root.removeAttribute("data-rivt-immersive-tool");
    }
    return () => {
      root.removeAttribute("data-rivt-immersive-tool");
    };
  }, [activeTool, mode]);

  const toolSwipeHandlers: ToolSwipeHandlers = {
    onPointerDown(event) {
      const isEdgeSwipe = event.clientX <= 32;
      if ((event.pointerType === "mouse" && !isEdgeSwipe) || (!isEdgeSwipe && shouldIgnoreToolSwipe(event.target))) return;
      toolSwipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    },
    onPointerUp(event) {
      const start = toolSwipeStartRef.current;
      toolSwipeStartRef.current = null;
      if (!start || start.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      if (deltaX > 78 && Math.abs(deltaY) < 58) {
        setActiveTool("hub");
      }
    },
    onPointerCancel() {
      toolSwipeStartRef.current = null;
    },
  };

  useEffect(() => {
    let cancelled = false;
    listActiveWork()
      .then((items) => {
        if (cancelled) return;
        setFetchedActiveWork(Array.isArray(items) ? items : []);
      })
      .catch((error: unknown) => {
        if (!cancelled) setRecordsError(error instanceof Error ? error.message : "Could not load active work.");
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function resetRecordForms(project: ProjectRecord | null = selectedProject) {
    const hasStoredMedia = Boolean(project?.media.some((item) => item.status === "stored"));
    setNoteDraft("");
    setUploadNotes("");
    setCompletionNote("");
    setResolutionNote("");
    setReportPreview(null);
    setCompletionChecklist({ ...defaultCompletionChecklist, photosProvided: hasStoredMedia });
  }

  async function handleOpenRecord(work: CanonicalActiveWork) {
    setProjectAction(`open:${work.id}`);
    setRecordsError(null);
    setRecordNotice(null);
    setReportPreview(null);
    try {
      const project = await openProjectForActiveWork(work.id);
      setSelectedProject(project);
      resetRecordForms(project);
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  useEffect(() => {
    if (mode !== "records" || recordsLoading || projectAction) return;
    const work = focusedActiveWorkId
      ? orderedActiveWork.find((item) => item.id === focusedActiveWorkId) ?? null
      : orderedActiveWork.length === 1
        ? orderedActiveWork[0]
        : null;
    if (!work || autoOpenedRecordRef.current === work.id) return;
    if (selectedProject?.activeWorkId === work.id) return;
    autoOpenedRecordRef.current = work.id;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setProjectAction(`open:${work.id}`);
      setRecordsError(null);
      setRecordNotice(null);
      setReportPreview(null);
      openProjectForActiveWork(work.id)
        .then((project) => {
          if (cancelled) return;
          const hasStoredMedia = project.media.some((item) => item.status === "stored");
          setSelectedProject(project);
          setNoteDraft("");
          setUploadNotes("");
          setCompletionNote("");
          setResolutionNote("");
          setReportPreview(null);
          setCompletionChecklist({ ...defaultCompletionChecklist, photosProvided: hasStoredMedia });
        })
        .catch((error) => {
          if (!cancelled) setRecordsError(projectErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setProjectAction(null);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [focusedActiveWorkId, mode, orderedActiveWork, projectAction, recordsLoading, selectedProject]);

  async function refreshSelectedProject() {
    const work = selectedProject ? orderedActiveWork.find((item) => item.id === selectedProject.activeWorkId) : null;
    if (work) setSelectedProject(await openProjectForActiveWork(work.id));
  }

  async function handleAddNote() {
    if (!selectedProject) return;
    const body = noteDraft.trim();
    if (!body) return;
    setProjectAction("note");
    setRecordsError(null);
    setRecordNotice(null);
    try {
      await addProjectNote(selectedProject.id, body);
      await refreshSelectedProject();
      setNoteDraft("");
      setRecordNotice("Private note added to the project timeline.");
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function handleFileSelected(file: File | null) {
    if (!selectedProject || !file) return;
    setProjectAction("upload");
    setRecordsError(null);
    setRecordNotice(null);
    try {
      await uploadProjectMedia(selectedProject.id, file, uploadNotes.trim() || "Uploaded from RIVT Records.");
      await refreshSelectedProject();
      setUploadNotes("");
      setCompletionChecklist((current) => ({ ...current, photosProvided: true }));
      setRecordNotice(`${file.name} was added to the project record.`);
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmitCompletion() {
    if (!selectedProject) return;
    const note = completionNote.trim();
    if (!note) return;
    setProjectAction("submit");
    setRecordsError(null);
    setRecordNotice(null);
    try {
      await submitProjectCompletion(
        selectedProject.id,
        note,
        storedMedia.map((item) => item.id),
        {
          ...completionChecklist,
          photosProvided: completionChecklist.photosProvided || storedMedia.length > 0,
        },
      );
      await refreshSelectedProject();
      setCompletionNote("");
      setRecordNotice("Completion submitted. The other party can now confirm or dispute it.");
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function handleResolveCompletion(decision: "confirm" | "dispute") {
    if (!selectedProject || !selectedCompletion) return;
    const reason = resolutionNote.trim();
    if (decision === "dispute" && !reason.trim()) return;
    setProjectAction(decision);
    setRecordsError(null);
    setRecordNotice(null);
    try {
      await resolveProjectCompletion(selectedProject.id, selectedCompletion.id, decision, reason);
      await refreshSelectedProject();
      setResolutionNote("");
      setRecordNotice(decision === "confirm" ? "Completion confirmed and recorded." : "Completion dispute recorded.");
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function handleLoadReport() {
    if (!selectedProject) return;
    setProjectAction("report");
    setRecordsError(null);
    setRecordNotice(null);
    try {
      const report = await getProjectReport(selectedProject.id);
      setReportPreview(JSON.stringify(report, null, 2));
      setRecordNotice("Closeout report loaded from server records.");
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  if (mode === "records") {
    return (
      <section className="v2-tools-page" aria-label="Project records">
        <PageHeader
          className="v2-tools-header"
          title="Records"
          actions={<button type="button" className="v2-primary-button" onClick={() => onNavigate("work")}>
            <FolderOpen size={16} />
            Open work
          </button>}
        />

        {recordsError ? <p className="v2-record-error" role="alert">{recordsError}</p> : null}

        <div className="v2-records-layout">
          <Panel
            className="v2-tools-panel"
            eyebrow="Accepted work"
            title={recordsLoading ? "Loading records..." : `${orderedActiveWork.length} private record${orderedActiveWork.length === 1 ? "" : "s"}`}
            action={!recordsLoading && orderedActiveWork.length === 0 ? <button type="button" onClick={() => onNavigate("work")}>Find work</button> : undefined}
          >
            {orderedActiveWork.length ? (
              <div className="v2-record-work-list">
                {orderedActiveWork.map((work) => (
                  <button
                    key={work.id}
                    type="button"
                    className={selectedProject?.activeWorkId === work.id ? "v2-record-work-item is-active" : "v2-record-work-item"}
                    onClick={() => void handleOpenRecord(work)}
                    disabled={Boolean(projectAction)}
                  >
                    <span>
                      <strong>{work.job?.title ?? `Work ${work.id.slice(0, 8)}`}</strong>
                      <small>{work.job?.publicLocation.city ?? "Project"} - {work.status}</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState className="v2-tools-empty" icon={<FolderOpen size={20} />} title="No accepted work yet" description="Records unlock after a contractor and tradesperson both accept the work." compact />
            )}
          </Panel>

          <Panel
            className="v2-tools-panel v2-record-detail-panel"
            eyebrow={selectedProject ? recordStatusLabel(selectedProject.status) : "Record detail"}
            title={selectedProject ? selectedProject.job.title : "Select an accepted job"}
            action={selectedProject ? (
              <div className="v2-record-header-actions">
                <button type="button" onClick={() => void refreshSelectedProject()} disabled={actionBusy}>
                  <RefreshCw size={14} />
                  Refresh
                </button>
                <button type="button" onClick={() => void handleLoadReport()} disabled={actionBusy}>
                  <Clipboard size={14} />
                  Report
                </button>
              </div>
            ) : undefined}
          >
            {selectedProject ? (
              <>
                {recordNotice ? <p className="v2-record-notice" role="status">{recordNotice}</p> : null}
                <div className="v2-record-metrics">
                  <MetricTile value={selectedProject.entries.length} label="timeline entries" />
                  <MetricTile value={storedMedia.length} label="stored files" />
                  <MetricTile value={selectedCompletion?.status ?? "open"} label="completion status" />
                </div>

                <div className="v2-record-workspace">
                  <section className="v2-record-card">
                    <header>
                      <span><FileText size={16} /> Field notebook</span>
                      <small>Private timeline note</small>
                    </header>
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="What changed on site? Access issue, material condition, measurement, weather, or owner approval..."
                      rows={5}
                    />
                    <button type="button" className="v2-primary-button" onClick={() => void handleAddNote()} disabled={actionBusy || !noteDraft.trim()}>
                      Add note
                    </button>
                  </section>

                  <section className="v2-record-card">
                    <header>
                      <span><FileUp size={16} /> Evidence</span>
                      <small>Photos, PDFs, or closeout files</small>
                    </header>
                    <textarea
                      value={uploadNotes}
                      onChange={(event) => setUploadNotes(event.target.value)}
                      placeholder="Optional upload note, for example: before photo, signed scope, completion photo..."
                      rows={3}
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={actionBusy}>
                      Upload file
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf,text/plain" hidden onChange={(event) => void handleFileSelected(event.target.files?.[0] ?? null)} />
                    {storedMedia.length ? (
                      <div className="v2-record-media-list" aria-label="Stored evidence">
                        {storedMedia.slice(0, 6).map((item) => (
                          <article key={item.id}>
                            <Image size={16} />
                            <span>
                              <strong>{item.originalName}</strong>
                              <small>{item.mediaKind} · {fileSize(item.sizeBytes)}</small>
                            </span>
                          </article>
                        ))}
                        {storedMedia.length > 6 && (
                          <p className="v2-tool-note">and {storedMedia.length - 6} more file{storedMedia.length - 6 === 1 ? "" : "s"}</p>
                        )}
                      </div>
                    ) : (
                      <p className="v2-tool-note">No stored evidence yet. Upload photos or files before submitting completion when possible.</p>
                    )}
                  </section>

                  <section className="v2-record-card">
                    <header>
                      <span><ListChecks size={16} /> Submit completion</span>
                      <small>Creates the reviewable closeout step</small>
                    </header>
                    <textarea
                      value={completionNote}
                      onChange={(event) => setCompletionNote(event.target.value)}
                      placeholder="Summarize what was completed and anything the other party should review..."
                      rows={4}
                    />
                    <div className="v2-record-checklist">
                      <label>
                        <input
                          type="checkbox"
                          checked={completionChecklist.completedOnTime}
                          onChange={(event) => setCompletionChecklist((current) => ({ ...current, completedOnTime: event.target.checked }))}
                        />
                        Completed on time
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={completionChecklist.clientApproved}
                          onChange={(event) => setCompletionChecklist((current) => ({ ...current, clientApproved: event.target.checked }))}
                        />
                        Client/contractor approved
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={completionChecklist.photosProvided}
                          onChange={(event) => setCompletionChecklist((current) => ({ ...current, photosProvided: event.target.checked }))}
                        />
                        Photos or proof provided
                      </label>
                    </div>
                    <button type="button" className="v2-primary-button" onClick={() => void handleSubmitCompletion()} disabled={actionBusy || !completionNote.trim()}>
                      Submit completion
                    </button>
                  </section>

                  <section className="v2-record-card">
                    <header>
                      <span><CheckCircle2 size={16} /> Review completion</span>
                      <small>{selectedCompletion ? `Latest: ${selectedCompletion.status}` : "Waiting on a submission"}</small>
                    </header>
                    {selectedCompletion ? (
                      <>
                        <p className="v2-tool-note">{selectedCompletion.note}</p>
                        {selectedCompletion.status === "submitted" ? (
                          <>
                            <textarea
                              value={resolutionNote}
                              onChange={(event) => setResolutionNote(event.target.value)}
                              placeholder="Optional confirmation note, or required dispute reason..."
                              rows={3}
                            />
                            <div className="v2-record-resolution-actions">
                              <button type="button" className="v2-primary-button" onClick={() => void handleResolveCompletion("confirm")} disabled={actionBusy}>Confirm</button>
                              <button type="button" className="v2-destructive-button" onClick={() => void handleResolveCompletion("dispute")} disabled={actionBusy || !resolutionNote.trim()}>Dispute</button>
                            </div>
                          </>
                        ) : (
                          <p className="v2-tool-note">Resolved {selectedCompletion.resolvedAt ? new Date(selectedCompletion.resolvedAt).toLocaleString() : "in timeline"}.</p>
                        )}
                      </>
                    ) : (
                      <p className="v2-tool-note">No completion has been submitted for this record yet.</p>
                    )}
                  </section>
                </div>

                {latestEntry ? (
                  <div className="v2-record-latest">
                    <strong>Latest update</strong>
                    <span>{latestEntry.body || latestEntry.entryType.replaceAll("_", " ")}</span>
                    <small>{new Date(latestEntry.createdAt).toLocaleString()}</small>
                  </div>
                ) : null}

                <ol className="v2-record-timeline">
                  {selectedProject.entries.slice().reverse().map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.entryType.replaceAll("_", " ")}</strong>
                      <span>{entry.body || "Record updated"}</span>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                    </li>
                  ))}
                </ol>
                {reportPreview ? <pre className="v2-record-report">{reportPreview}</pre> : null}
              </>
            ) : (
              <EmptyState className="v2-tools-empty" icon={<FileText size={20} />} title="Select an accepted job" description="Open a record to add closeout evidence, submit completion, or generate the closeout report." />
            )}
          </Panel>
        </div>
      </section>
    );
  }

  if (activeTool !== "hub") {
    if (activeTool === "calculator") {
      return (
        <section className="v2-tools-app is-calculator-fullscreen" aria-label="Heavy 16th field calculator">
          <div className="v2-tools-swipe-surface" {...toolSwipeHandlers}>
            <FieldCalculatorTool onBack={() => setActiveTool("hub")} />
          </div>
        </section>
      );
    }

    const toolMeta = {
      estimate: {
        title: "Estimate builder",
        node: <EstimateTool activeJob={activeJob} onConvertToInvoice={handleConvertEstimateToInvoice} />,
      },
      invoice: {
        title: "Invoice draft",
        node: <InvoiceDraftTool activeJob={activeJob} estimateDraft={convertedEstimateDraft} />,
      },
      "daily-log": {
        title: "Daily log",
        node: <DailyLogTool activeJob={activeJob} activeWork={orderedActiveWork} />,
      },
      materials: {
        title: "Material takeoff",
        node: <MaterialsTool activeJob={activeJob} />,
      },
      "job-photos": {
        title: "Camera",
        node: <JobPhotosTool activeWork={orderedActiveWork} autoOpenActiveJob={requestedTool === "job-photos" && Boolean(focusedActiveWorkId)} />,
      },
      "time-tracker": {
        title: "Time tracker",
        node: <TimeTrackerTool activeJob={activeJob} jobs={jobs} />,
      },
      "expense-logger": {
        title: "Expense logger",
        node: <ExpenseLoggerTool activeJob={activeJob} jobs={jobs} />,
      },
      earnings: {
        title: "Earnings dashboard",
        node: <EarningsDashboardTool jobs={jobs} paymentRecords={paymentRecords} />,
      },
      "bid-builder": {
        title: "Bid builder",
        node: <BidBuilderTool activeJob={activeJob} />,
      },
      mileage: {
        title: "Mileage logger",
        node: <MileageLoggerTool activeJob={activeJob} />,
      },
      "price-book": {
        title: "Material price book",
        node: <PriceBookTool />,
      },
      "safety-checklist": {
        title: "Field safety checklist",
        node: <SafetyChecklistTool activeJob={activeJob} />,
      },
      "tax-estimator": {
        title: "Tax estimator",
        node: <TaxEstimatorTool />,
      },
      "punch-list": {
        title: "Punch list",
        node: <PunchListTool />,
      },
      contracts: {
        title: "Contract templates",
        node: <ContractTemplateTool />,
      },
      "job-checklist": {
        title: "Job checklists",
        node: <JobChecklistTool />,
      },
      payments: {
        title: "Payment tracker",
        node: <PaymentTrackerTool />,
      },
      "daily-report": {
        title: "Daily site report",
        node: <DailyReportTool />,
      },
      "tax-summary": {
        title: "Annual tax summary",
        node: <TaxSummaryTool />,
      },
    }[activeTool];

    if (!toolMeta) return null;

    return (
      <ToolAppShell
        title={toolMeta.title}
        compact
        onBack={() => setActiveTool("hub")}
        swipeHandlers={toolSwipeHandlers}
      >
        {toolMeta.node}
      </ToolAppShell>
    );
  }

  return (
    <section className="v2-tools-page" aria-label="Tools">
      <PageHeader
        className="v2-tools-header"
        title="Tools"
      />

      <div className="v2-tool-section-stack">
        {recentToolLaunchers.length ? (
          <section className="v2-tool-section v2-tool-recent-section" aria-label="Recent tools">
            <div className="v2-tool-section-header">
              <span>Recent</span>
              <strong>Pick up where you left off</strong>
            </div>
            <div className="v2-tool-mini-grid">
              {recentToolLaunchers.map((tool) => (
                <ToolMiniCard
                  key={tool.mode}
                  icon={tool.icon}
                  title={tool.title}
                  summary={tool.summary}
                  onAction={() => openToolFromHub(tool.mode)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="v2-tool-section" aria-label="Field tools">
          <div className="v2-tool-launch-grid">
            {PRIMARY_TOOL_LAUNCHERS.map((tool, index) => (
              <ToolCard
                key={tool.mode}
                icon={tool.icon}
                title={tool.title}
                summary={tool.summary}
                featured={index === 0}
                onAction={() => openToolFromHub(tool.mode)}
              />
            ))}
          </div>
        </section>

        <div className="v2-tool-group-grid" aria-label="More tools">
          {TOOL_GROUPS.map((group) => (
            <ToolLauncherSection key={group.label} group={group} onOpen={openToolFromHub} />
          ))}
        </div>

        <p className="v2-tools-storage-note">
          Drafts save on this device. Records and photos sync to cloud storage.
        </p>
      </div>

    </section>
  );
}
