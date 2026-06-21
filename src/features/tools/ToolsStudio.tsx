import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Clipboard,
  Copy,
  Download,
  FileText,
  FolderOpen,
  LayoutGrid,
  Plus,
  ReceiptText,
  Scale,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Job } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
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
import "./tools-studio.css";

type ToolMode = "hub" | "calculator" | "estimate" | "invoice" | "materials";

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

interface ToolsStudioProps {
  jobs: Job[];
  paymentRecords: PaymentRecord[];
  mode?: "tools" | "records";
  onNavigate: (destination: PrimaryDestination) => void;
  onOpenJob: (jobId: number) => void;
  onOpenRecords: () => void;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function jobName(job: Job | null) {
  return job ? `${job.title} - ${job.location}` : "Standalone tool";
}

function numericValue(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function ToolCard({
  icon: Icon,
  title,
  summary,
  action,
  featured = false,
  onAction,
}: {
  icon: typeof Calculator;
  title: string;
  summary: string;
  action: string;
  featured?: boolean;
  onAction: () => void;
}) {
  return (
    <button type="button" className={featured ? "v2-tool-launch-card is-featured" : "v2-tool-launch-card"} onClick={onAction}>
      <span className="v2-tool-card-icon"><Icon size={19} /></span>
      <span>
        <strong>{title}</strong>
        <small>{summary}</small>
      </span>
      <em>{action}<ArrowRight size={14} /></em>
    </button>
  );
}

function ToolAppShell({
  eyebrow,
  title,
  description,
  activeJob,
  onBack,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  activeJob: Job | null;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="v2-tools-app" aria-label={title}>
      <header className="v2-tool-app-header">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Tools
        </button>
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <aside title={jobName(activeJob)}>
          <Wrench size={15} />
          <span>{activeJob ? activeJob.title : "No job loaded"}</span>
        </aside>
      </header>
      {children}
    </section>
  );
}

function FieldCalculatorTool({ activeJob }: { activeJob: Job | null }) {
  const [feet, setFeet] = useState(0);
  const [inches, setInches] = useState(0);
  const [sixteenths, setSixteenths] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [spacingRun, setSpacingRun] = useState(96);
  const [spacingCount, setSpacingCount] = useState(5);
  const [wallAngle, setWallAngle] = useState(90);
  const [springAngle, setSpringAngle] = useState(52);

  const decimalInches = Math.max(0, feet * 12 + inches + sixteenths / 16);
  const totalInches = decimalInches * Math.max(1, quantity);
  const totalFeet = totalInches / 12;
  const equalSpacing = spacingRun / Math.max(1, spacingCount + 1);
  const miter = wallAngle / 2;
  const crownMiter = Math.atan(Math.sin((miter * Math.PI) / 180) / Math.tan((springAngle * Math.PI) / 180)) * (180 / Math.PI);
  const crownBevel = Math.asin(Math.cos((springAngle * Math.PI) / 180) * Math.cos((miter * Math.PI) / 180)) * (180 / Math.PI);

  return (
    <div className="v2-tool-workbench v2-calculator-workbench">
      <section className="v2-tool-panel">
        <header>
          <span>Field math</span>
          <h2>Heavy 16th calculator</h2>
        </header>
        <div className="v2-tool-input-grid four">
          <label>Feet<input type="number" value={feet} min="0" onChange={(event) => setFeet(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Inches<input type="number" value={inches} min="0" max="11" onChange={(event) => setInches(Math.max(0, Math.min(11, Number(event.target.value) || 0)))} /></label>
          <label>16ths<input type="number" value={sixteenths} min="0" max="15" onChange={(event) => setSixteenths(Math.max(0, Math.min(15, Number(event.target.value) || 0)))} /></label>
          <label>Qty<input type="number" value={quantity} min="1" onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>
        </div>
        <div className="v2-tool-result-hero">
          <span>Total length</span>
          <strong>{formatNumber(totalFeet, 2)} ft</strong>
          <small>{formatNumber(totalInches, 2)} in across {quantity} piece{quantity === 1 ? "" : "s"}</small>
        </div>
        <div className="v2-tool-input-grid two">
          <label>Run length (in)<input type="number" value={spacingRun} min="1" onChange={(event) => setSpacingRun(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label>Spaces between<input type="number" value={spacingCount} min="1" onChange={(event) => setSpacingCount(Math.max(1, Number(event.target.value) || 1))} /></label>
        </div>
        <div className="v2-tool-result-row">
          <span>Equal spacing</span>
          <strong>{formatNumber(equalSpacing, 3)} in on center</strong>
        </div>
      </section>

      <section className="v2-tool-panel">
        <header>
          <span>Cuts</span>
          <h2>Miter and crown quick check</h2>
        </header>
        <div className="v2-tool-input-grid two">
          <label>Wall angle<input type="number" value={wallAngle} min="1" max="179" onChange={(event) => setWallAngle(Math.max(1, Math.min(179, Number(event.target.value) || 90)))} /></label>
          <label>Spring angle<input type="number" value={springAngle} min="1" max="89" onChange={(event) => setSpringAngle(Math.max(1, Math.min(89, Number(event.target.value) || 52)))} /></label>
        </div>
        <div className="v2-tool-result-grid">
          <article><span>Flat miter</span><strong>{formatNumber(miter, 1)} deg</strong></article>
          <article><span>Crown miter</span><strong>{formatNumber(Math.abs(crownMiter), 1)} deg</strong></article>
          <article><span>Crown bevel</span><strong>{formatNumber(Math.abs(crownBevel), 1)} deg</strong></article>
        </div>
        <p className="v2-tool-note">Use this as a field check. Always verify against the saw, material profile, and site condition before cutting.</p>
        {activeJob ? <p className="v2-tool-note">Loaded from: {activeJob.title}</p> : null}
      </section>
    </div>
  );
}

function EstimateTool({ activeJob }: { activeJob: Job | null }) {
  const [laborHours, setLaborHours] = useState(activeJob?.durationHours ?? 8);
  const [hourlyRate, setHourlyRate] = useState(65);
  const [crewSize, setCrewSize] = useState(1);
  const [materials, setMaterials] = useState(activeJob ? Math.round(activeJob.pay * 0.22) : 250);
  const [subCosts, setSubCosts] = useState(0);
  const [overheadPct, setOverheadPct] = useState(12);
  const [marginPct, setMarginPct] = useState(18);
  const [contingencyPct, setContingencyPct] = useState(7);
  const [copied, setCopied] = useState(false);

  const labor = laborHours * hourlyRate;
  const base = labor + materials + subCosts;
  const overhead = base * (overheadPct / 100);
  const margin = (base + overhead) * (marginPct / 100);
  const contingency = (base + overhead + margin) * (contingencyPct / 100);
  const target = Math.ceil((base + overhead + margin + contingency) / 25) * 25;
  const low = Math.floor((target * 0.92) / 25) * 25;
  const high = Math.ceil((target * 1.12) / 25) * 25;
  const days = Math.max(0.5, laborHours / Math.max(1, crewSize) / 7);

  async function copySummary() {
    const summary = [
      `RIVT estimate${activeJob ? ` - ${activeJob.title}` : ""}`,
      `Target range: ${currency(low)} - ${currency(high)}`,
      `Target price: ${currency(target)}`,
      `Labor: ${formatNumber(laborHours)} hrs at ${currency(hourlyRate)}/hr`,
      `Materials: ${currency(materials)}`,
      `Sub costs: ${currency(subCosts)}`,
      `Timeline: ${formatNumber(days, 1)} working days with ${crewSize} person${crewSize === 1 ? "" : "s"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="v2-tool-workbench">
      <section className="v2-tool-panel">
        <header>
          <span>Estimate</span>
          <h2>Price the work before you post or bid</h2>
        </header>
        <div className="v2-tool-input-grid">
          <label>Labor hours<input type="number" min="0" step="0.5" value={laborHours} onChange={(event) => setLaborHours(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Hourly rate<input type="number" min="0" value={hourlyRate} onChange={(event) => setHourlyRate(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Crew size<input type="number" min="1" value={crewSize} onChange={(event) => setCrewSize(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label>Materials<input type="number" min="0" value={materials} onChange={(event) => setMaterials(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Sub costs<input type="number" min="0" value={subCosts} onChange={(event) => setSubCosts(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Overhead %<input type="number" min="0" value={overheadPct} onChange={(event) => setOverheadPct(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Margin %<input type="number" min="0" value={marginPct} onChange={(event) => setMarginPct(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Contingency %<input type="number" min="0" value={contingencyPct} onChange={(event) => setContingencyPct(Math.max(0, Number(event.target.value) || 0))} /></label>
        </div>
      </section>

      <aside className="v2-tool-panel v2-tool-summary-panel">
        <header>
          <span>Target</span>
          <h2>{currency(low)} - {currency(high)}</h2>
        </header>
        <div className="v2-tool-result-hero">
          <span>Recommended target</span>
          <strong>{currency(target)}</strong>
          <small>{formatNumber(days, 1)} working days estimated</small>
        </div>
        <div className="v2-tool-breakdown">
          <div><span>Labor</span><strong>{currency(labor)}</strong></div>
          <div><span>Materials</span><strong>{currency(materials)}</strong></div>
          <div><span>Overhead</span><strong>{currency(overhead)}</strong></div>
          <div><span>Margin</span><strong>{currency(margin)}</strong></div>
          <div><span>Contingency</span><strong>{currency(contingency)}</strong></div>
        </div>
        <button type="button" className="v2-primary-button" onClick={copySummary}>
          <Copy size={15} />
          {copied ? "Copied" : "Copy estimate"}
        </button>
      </aside>
    </div>
  );
}

interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  rate: number;
}

function InvoiceDraftTool({ activeJob }: { activeJob: Job | null }) {
  const [invoiceNumber, setInvoiceNumber] = useState(activeJob ? `RIVT-${activeJob.id}` : "RIVT-DRAFT");
  const [billTo, setBillTo] = useState(activeJob?.contractor ?? "");
  const [payTo, setPayTo] = useState("");
  const [terms, setTerms] = useState("Due on completion");
  const [paymentMethod, setPaymentMethod] = useState("Direct payment");
  const [taxPct, setTaxPct] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: "labor", description: "Labor", qty: activeJob?.durationHours ?? 8, rate: activeJob ? Math.max(45, Math.round(activeJob.pay / Math.max(1, activeJob.durationHours) * 0.78)) : 65 },
    { id: "materials", description: "Materials", qty: 1, rate: activeJob ? Math.max(50, Math.round(activeJob.pay * 0.2)) : 250 },
  ]);

  const subtotal = lines.reduce((sum, line) => sum + numericValue(line.qty) * numericValue(line.rate), 0);
  const tax = subtotal * (taxPct / 100);
  const total = subtotal + tax;

  const invoiceText = useMemo(() => [
    `RIVT invoice draft ${invoiceNumber}`,
    activeJob ? `Job: ${activeJob.title}` : "Job: unlinked",
    `Bill to: ${billTo || "Not entered"}`,
    `Pay to: ${payTo || "Not entered"}`,
    "",
    ...lines.map((line) => `${line.description || "Line item"} - ${formatNumber(line.qty)} x ${currency(line.rate)} = ${currency(line.qty * line.rate)}`),
    "",
    `Subtotal: ${currency(subtotal)}`,
    `Tax: ${currency(tax)}`,
    `Total due: ${currency(total)}`,
    `Terms: ${terms}`,
    `Payment method: ${paymentMethod}`,
    "RIVT records direct-payment details only. RIVT does not process, escrow, or hold job payments.",
  ].join("\n"), [activeJob, billTo, invoiceNumber, lines, paymentMethod, payTo, subtotal, tax, terms, total]);

  function updateLine(id: string, field: keyof InvoiceLine, value: string | number) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  }

  function addLine() {
    setLines((current) => [...current, { id: crypto.randomUUID(), description: "", qty: 1, rate: 0 }]);
  }

  function removeLine(id: string) {
    setLines((current) => current.length > 1 ? current.filter((line) => line.id !== id) : current);
  }

  async function copyInvoice() {
    try {
      await navigator.clipboard.writeText(invoiceText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadInvoice() {
    const blob = new Blob([invoiceText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNumber.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  return (
    <div className="v2-tool-workbench">
      <section className="v2-tool-panel">
        <header>
          <span>Invoice draft</span>
          <h2>Build a clean direct-payment invoice</h2>
        </header>
        <div className="v2-tool-input-grid two">
          <label>Invoice #<input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label>
          <label>Terms<input value={terms} onChange={(event) => setTerms(event.target.value)} /></label>
          <label>Bill to<input value={billTo} onChange={(event) => setBillTo(event.target.value)} placeholder="Contractor or company" /></label>
          <label>Pay to<input value={payTo} onChange={(event) => setPayTo(event.target.value)} placeholder="Your company or name" /></label>
          <label>Payment method<input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} /></label>
          <label>Tax %<input type="number" min="0" value={taxPct} onChange={(event) => setTaxPct(Math.max(0, Number(event.target.value) || 0))} /></label>
        </div>
        <div className="v2-invoice-lines">
          <div className="v2-invoice-lines-header">
            <span>Line items</span>
            <button type="button" onClick={addLine}><Plus size={14} />Add item</button>
          </div>
          {lines.map((line) => (
            <div className="v2-invoice-line" key={line.id}>
              <input value={line.description} placeholder="Description" onChange={(event) => updateLine(line.id, "description", event.target.value)} />
              <input type="number" min="0" step="0.5" value={line.qty} aria-label={`${line.description || "Line"} quantity`} onChange={(event) => updateLine(line.id, "qty", Number(event.target.value) || 0)} />
              <input type="number" min="0" value={line.rate} aria-label={`${line.description || "Line"} rate`} onChange={(event) => updateLine(line.id, "rate", Number(event.target.value) || 0)} />
              <strong>{currency(line.qty * line.rate)}</strong>
              <button type="button" aria-label={`Remove ${line.description || "line item"}`} onClick={() => removeLine(line.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      <aside className="v2-tool-panel v2-tool-summary-panel">
        <header>
          <span>Total due</span>
          <h2>{currency(total)}</h2>
        </header>
        <div className="v2-tool-breakdown">
          <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
          <div><span>Tax</span><strong>{currency(tax)}</strong></div>
          <div><span>Terms</span><strong>{terms}</strong></div>
          <div><span>Method</span><strong>{paymentMethod}</strong></div>
        </div>
        <p className="v2-tool-note">Email/text delivery is not represented as production-ready in Gate A. Use copy or download for pilot testing.</p>
        <div className="v2-tool-action-row">
          <button type="button" className="v2-primary-button" onClick={copyInvoice}><Copy size={15} />{copied ? "Copied" : "Copy invoice"}</button>
          <button type="button" onClick={downloadInvoice}><Download size={15} />{downloaded ? "Downloaded" : "Download TXT"}</button>
        </div>
      </aside>
    </div>
  );
}

function MaterialsTool({ activeJob }: { activeJob: Job | null }) {
  const [areaLength, setAreaLength] = useState(12);
  const [areaWidth, setAreaWidth] = useState(10);
  const [wastePct, setWastePct] = useState(10);
  const [unitCost, setUnitCost] = useState(3.25);
  const [sheetWidth, setSheetWidth] = useState(48);
  const [sheetHeight, setSheetHeight] = useState(96);
  const [partWidth, setPartWidth] = useState(24);
  const [partHeight, setPartHeight] = useState(18);
  const [partQty, setPartQty] = useState(8);

  const squareFeet = areaLength * areaWidth;
  const withWaste = squareFeet * (1 + wastePct / 100);
  const materialCost = withWaste * unitCost;
  const sheetArea = (sheetWidth * sheetHeight) / 144;
  const partArea = (partWidth * partHeight * partQty) / 144;
  const sheetsNeeded = Math.max(1, Math.ceil(partArea / Math.max(1, sheetArea)));

  return (
    <div className="v2-tool-workbench">
      <section className="v2-tool-panel">
        <header>
          <span>Takeoff</span>
          <h2>Area, waste, and material cost</h2>
        </header>
        <div className="v2-tool-input-grid">
          <label>Length (ft)<input type="number" min="0" value={areaLength} onChange={(event) => setAreaLength(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Width (ft)<input type="number" min="0" value={areaWidth} onChange={(event) => setAreaWidth(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Waste %<input type="number" min="0" value={wastePct} onChange={(event) => setWastePct(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Cost / sq ft<input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(Math.max(0, Number(event.target.value) || 0))} /></label>
        </div>
        <div className="v2-tool-result-grid">
          <article><span>Base area</span><strong>{formatNumber(squareFeet)} sq ft</strong></article>
          <article><span>With waste</span><strong>{formatNumber(withWaste)} sq ft</strong></article>
          <article><span>Material cost</span><strong>{currency(materialCost)}</strong></article>
        </div>
      </section>

      <section className="v2-tool-panel">
        <header>
          <span>Sheet planning</span>
          <h2>Quick sheet count</h2>
        </header>
        <div className="v2-tool-input-grid">
          <label>Sheet W (in)<input type="number" min="1" value={sheetWidth} onChange={(event) => setSheetWidth(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label>Sheet H (in)<input type="number" min="1" value={sheetHeight} onChange={(event) => setSheetHeight(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label>Part W (in)<input type="number" min="1" value={partWidth} onChange={(event) => setPartWidth(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label>Part H (in)<input type="number" min="1" value={partHeight} onChange={(event) => setPartHeight(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label>Part qty<input type="number" min="1" value={partQty} onChange={(event) => setPartQty(Math.max(1, Number(event.target.value) || 1))} /></label>
        </div>
        <div className="v2-tool-result-hero">
          <span>Sheets needed</span>
          <strong>{sheetsNeeded}</strong>
          <small>{formatNumber(partArea)} sq ft of parts on {formatNumber(sheetArea)} sq ft sheets</small>
        </div>
        {activeJob ? <p className="v2-tool-note">Use this takeoff beside {activeJob.title}; save official closeout files in Records.</p> : null}
      </section>
    </div>
  );
}

function projectErrorMessage(error: unknown) {
  if (error instanceof ProjectApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not update the project record.";
}

export function ToolsStudio({ jobs, paymentRecords, mode = "tools", onNavigate, onOpenJob, onOpenRecords }: ToolsStudioProps) {
  const activeJob = jobs.find((job) => job.status !== "Paid / Closed") ?? jobs[0] ?? null;
  const pendingPayments = paymentRecords.filter((record) => record.status === "Payment pending");
  const [activeTool, setActiveTool] = useState<ToolMode>("hub");
  const [activeWork, setActiveWork] = useState<CanonicalActiveWork[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [projectAction, setProjectAction] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCompletion = selectedProject?.completionSubmissions.find((completion) => completion.status === "submitted")
    ?? selectedProject?.completionSubmissions.at(-1)
    ?? null;

  useEffect(() => {
    let cancelled = false;
    listActiveWork()
      .then((items) => {
        if (cancelled) return;
        setActiveWork(items);
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

  async function handleOpenRecord(work: CanonicalActiveWork) {
    setProjectAction(`open:${work.id}`);
    setRecordsError(null);
    setReportPreview(null);
    try {
      setSelectedProject(await openProjectForActiveWork(work.id));
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function refreshSelectedProject() {
    const work = selectedProject ? activeWork.find((item) => item.id === selectedProject.activeWorkId) : null;
    if (work) setSelectedProject(await openProjectForActiveWork(work.id));
  }

  async function handleAddNote() {
    if (!selectedProject) return;
    const body = window.prompt("Add a private project note");
    if (!body?.trim()) return;
    setProjectAction("note");
    setRecordsError(null);
    try {
      await addProjectNote(selectedProject.id, body.trim());
      await refreshSelectedProject();
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
    try {
      await uploadProjectMedia(selectedProject.id, file, "Uploaded from RIVT Records.");
      await refreshSelectedProject();
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmitCompletion() {
    if (!selectedProject) return;
    const note = window.prompt("Completion note for the contractor");
    if (!note?.trim()) return;
    setProjectAction("submit");
    setRecordsError(null);
    try {
      await submitProjectCompletion(
        selectedProject.id,
        note.trim(),
        selectedProject.media.filter((item) => item.status === "stored").map((item) => item.id),
      );
      await refreshSelectedProject();
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  async function handleResolveCompletion(decision: "confirm" | "dispute") {
    if (!selectedProject || !selectedCompletion) return;
    const reason = window.prompt(decision === "confirm" ? "Confirmation note" : "Why are you disputing completion?") ?? "";
    if (decision === "dispute" && !reason.trim()) return;
    setProjectAction(decision);
    setRecordsError(null);
    try {
      await resolveProjectCompletion(selectedProject.id, selectedCompletion.id, decision, reason.trim());
      await refreshSelectedProject();
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
    try {
      const report = await getProjectReport(selectedProject.id);
      setReportPreview(JSON.stringify(report, null, 2));
    } catch (error) {
      setRecordsError(projectErrorMessage(error));
    } finally {
      setProjectAction(null);
    }
  }

  if (mode === "records") {
    return (
      <section className="v2-tools-page" aria-label="Project records">
        <header className="v2-tools-header">
          <div>
            <h1>Records</h1>
            <p>Private closeout packets for accepted work. Photos, notes, completion, and reports are server-backed.</p>
          </div>
          <button type="button" className="v2-primary-button" onClick={() => onNavigate("work")}>
            <FolderOpen size={16} />
            Open work
          </button>
        </header>

        {recordsError ? <p className="v2-record-error" role="alert">{recordsError}</p> : null}

        <div className="v2-records-layout">
          <section className="v2-tools-panel">
            <header>
              <div>
                <span>Accepted work</span>
                <h2>{recordsLoading ? "Loading records..." : `${activeWork.length} private record${activeWork.length === 1 ? "" : "s"}`}</h2>
              </div>
              <button type="button" onClick={() => onNavigate("work")}>Find work</button>
            </header>
            {activeWork.length ? (
              <div className="v2-record-work-list">
                {activeWork.map((work) => (
                  <button key={work.id} type="button" className="v2-record-work-item" onClick={() => void handleOpenRecord(work)} disabled={Boolean(projectAction)}>
                    <span>
                      <strong>{work.job?.title ?? `Work ${work.id.slice(0, 8)}`}</strong>
                      <small>{work.job?.publicLocation.city ?? "Project"} - {work.status}</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <article className="v2-tools-empty">
                <FolderOpen size={20} />
                <strong>No accepted work yet</strong>
                <span>Records unlock after a contractor and tradesperson both accept the work.</span>
              </article>
            )}
          </section>

          <section className="v2-tools-panel v2-record-detail-panel">
            {selectedProject ? (
              <>
                <header>
                  <div>
                    <span>{selectedProject.status.replaceAll("_", " ")}</span>
                    <h2>{selectedProject.job.title}</h2>
                  </div>
                  <button type="button" onClick={() => void handleLoadReport()} disabled={Boolean(projectAction)}>Report</button>
                </header>
                <div className="v2-record-metrics">
                  <article><strong>{selectedProject.entries.length}</strong><span>timeline entries</span></article>
                  <article><strong>{selectedProject.media.filter((item) => item.status === "stored").length}</strong><span>stored files</span></article>
                  <article><strong>{selectedProject.completionSubmissions.length}</strong><span>completion submits</span></article>
                </div>
                <div className="v2-record-actions">
                  <button type="button" onClick={() => void handleAddNote()} disabled={Boolean(projectAction)}>Add note</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(projectAction)}>Upload evidence</button>
                  <button type="button" onClick={() => void handleSubmitCompletion()} disabled={Boolean(projectAction)}>Submit completion</button>
                  {selectedCompletion?.status === "submitted" ? (
                    <>
                      <button type="button" className="v2-primary-button" onClick={() => void handleResolveCompletion("confirm")} disabled={Boolean(projectAction)}>Confirm</button>
                      <button type="button" className="v2-destructive-button" onClick={() => void handleResolveCompletion("dispute")} disabled={Boolean(projectAction)}>Dispute</button>
                    </>
                  ) : null}
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,text/plain" hidden onChange={(event) => void handleFileSelected(event.target.files?.[0] ?? null)} />
                </div>
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
              <article className="v2-tools-empty">
                <FileText size={20} />
                <strong>Select an accepted job</strong>
                <span>Open a record to add closeout evidence, submit completion, or generate the closeout report.</span>
              </article>
            )}
          </section>
        </div>
      </section>
    );
  }

  if (activeTool !== "hub") {
    const toolMeta = {
      calculator: {
        eyebrow: "Calculator app",
        title: "Heavy 16th field calculator",
        description: "Quick length math, spacing, and cut checks without leaving RIVT.",
        node: <FieldCalculatorTool activeJob={activeJob} />,
      },
      estimate: {
        eyebrow: "Estimate app",
        title: "Estimate builder",
        description: "Build a practical target range from labor, material, overhead, and margin assumptions.",
        node: <EstimateTool activeJob={activeJob} />,
      },
      invoice: {
        eyebrow: "Invoice app",
        title: "Invoice draft",
        description: "Create a clean direct-payment invoice draft. Copy or download it for pilot testing.",
        node: <InvoiceDraftTool activeJob={activeJob} />,
      },
      materials: {
        eyebrow: "Materials app",
        title: "Material takeoff",
        description: "Estimate area, waste, material cost, and rough sheet count.",
        node: <MaterialsTool activeJob={activeJob} />,
      },
    }[activeTool];

    return (
      <ToolAppShell
        eyebrow={toolMeta.eyebrow}
        title={toolMeta.title}
        description={toolMeta.description}
        activeJob={activeJob}
        onBack={() => setActiveTool("hub")}
      >
        {toolMeta.node}
      </ToolAppShell>
    );
  }

  return (
    <section className="v2-tools-page" aria-label="Tools">
      <header className="v2-tools-header">
        <div>
          <h1>Tools</h1>
          <p>Standalone field utilities for estimates, invoice drafts, materials, and closeout records.</p>
        </div>
        <button type="button" className="v2-primary-button" onClick={() => activeJob ? onOpenJob(activeJob.id) : onNavigate("work")}>
          <Wrench size={16} />
          {activeJob ? "Use active job" : "Open work"}
        </button>
      </header>

      <section className="v2-tools-command">
        <div>
          <span>Tool apps</span>
          <h2>{activeJob ? `Loaded from ${activeJob.title}` : "Open tools without needing a job first"}</h2>
          <p>These utilities calculate locally in the browser. Server-backed records still live in Records after accepted work.</p>
        </div>
        <article>
          <strong>{activeJob ? activeJob.trade : "Standalone"}</strong>
          <span>{activeJob ? activeJob.location : "No active job selected"}</span>
        </article>
      </section>

      <div className="v2-tool-launch-grid">
        <ToolCard icon={Calculator} title="Heavy 16th" summary="Field length math, equal spacing, miter, and crown checks." action="Open" featured onAction={() => setActiveTool("calculator")} />
        <ToolCard icon={Scale} title="Estimate builder" summary="Labor, material, overhead, margin, and target price range." action="Open" onAction={() => setActiveTool("estimate")} />
        <ToolCard icon={ReceiptText} title="Invoice draft" summary="Line items, totals, terms, and direct-payment note." action="Open" onAction={() => setActiveTool("invoice")} />
        <ToolCard icon={LayoutGrid} title="Material takeoff" summary="Area, waste, material cost, and rough sheet count." action="Open" onAction={() => setActiveTool("materials")} />
        <ToolCard icon={FolderOpen} title="Records" summary="Server-backed closeout packets for accepted work." action="Open" onAction={onOpenRecords} />
      </div>

      <div className="v2-tools-grid">
        <section className="v2-tools-panel">
          <header>
            <div>
              <span>Payment records</span>
              <h2>Direct-payment bookkeeping</h2>
            </div>
            <button type="button" onClick={onOpenRecords}>Records</button>
          </header>
          <div className="v2-tools-records">
            <article>
              <strong>{paymentRecords.length}</strong>
              <span>logged payments</span>
            </article>
            <article>
              <strong>{pendingPayments.length}</strong>
              <span>waiting to close</span>
            </article>
            <article>
              <strong>{activeWork.filter((work) => work.status === "active").length}</strong>
              <span>active closeouts</span>
            </article>
          </div>
        </section>

        <section className="v2-tools-panel">
          <header>
            <div>
              <span>Job shortcuts</span>
              <h2>{jobs.length ? "Open a current work order" : "No jobs yet"}</h2>
            </div>
            <button type="button" onClick={() => onNavigate("work")}>Work</button>
          </header>
          <div className="v2-tools-shortcuts">
            {jobs.slice(0, 3).map((job) => (
              <button key={job.id} type="button" className="v2-tools-shortcut" onClick={() => onOpenJob(job.id)}>
                <span>
                  <strong>{job.title}</strong>
                  <small>{job.trade} - {job.status}</small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
            {jobs.length === 0 ? (
              <article className="v2-tools-empty">
                <Clipboard size={20} />
                <strong>No work orders yet</strong>
                <span>Create or accept work before Records can build a closeout packet.</span>
              </article>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
