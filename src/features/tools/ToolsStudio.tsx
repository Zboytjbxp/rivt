import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  FileText,
  FileUp,
  FolderOpen,
  Image,
  LayoutGrid,
  ListChecks,
  Mail,
  MessageSquare,
  RefreshCw,
  Plus,
  ReceiptText,
  Ruler,
  Scale,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Job } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import { EmptyState, MetricTile, PageHeader, Panel, StatusPill } from "../../components/ui";
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

interface CompletionChecklistState {
  completedOnTime: boolean;
  clientApproved: boolean;
  photosProvided: boolean;
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

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

function formatInchesAsFeet(totalInches: number) {
  const safeInches = Math.max(0, totalInches);
  const feet = Math.floor(safeInches / 12);
  const remainder = safeInches - feet * 12;
  const wholeInches = Math.floor(remainder);
  const sixteenths = Math.round((remainder - wholeInches) * 16);
  const normalizedWhole = sixteenths === 16 ? wholeInches + 1 : wholeInches;
  const normalizedSixteenths = sixteenths === 16 ? 0 : sixteenths;
  const normalizedFeet = normalizedWhole >= 12 ? feet + 1 : feet;
  const normalizedInches = normalizedWhole >= 12 ? normalizedWhole - 12 : normalizedWhole;

  const parts = [];
  if (normalizedFeet) parts.push(`${normalizedFeet} ft`);
  if (normalizedInches || normalizedSixteenths || !parts.length) {
    const divisor = normalizedSixteenths ? gcd(normalizedSixteenths, 16) : 1;
    const fraction = normalizedSixteenths ? ` ${normalizedSixteenths / divisor}/${16 / divisor}` : "";
    parts.push(`${normalizedInches}${fraction} in`);
  }

  return parts.join(" ");
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
  badge,
  output,
  detail,
  featured = false,
  onAction,
}: {
  icon: typeof Calculator;
  title: string;
  summary: string;
  action: string;
  badge: string;
  output: string;
  detail: string;
  featured?: boolean;
  onAction: () => void;
}) {
  return (
    <button type="button" className={featured ? "v2-tool-launch-card is-featured" : "v2-tool-launch-card"} onClick={onAction}>
      <span className="v2-tool-card-icon"><Icon size={19} /></span>
      <span className="v2-tool-card-copy">
        <small>{badge}</small>
        <strong>{title}</strong>
        <small>{summary}</small>
      </span>
      <span className="v2-tool-card-output">
        <strong>{output}</strong>
        <small>{detail}</small>
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
  const [copied, setCopied] = useState(false);

  const decimalInches = Math.max(0, feet * 12 + inches + sixteenths / 16);
  const totalInches = decimalInches * Math.max(1, quantity);
  const totalFeet = totalInches / 12;
  const singleLengthLabel = formatInchesAsFeet(decimalInches);
  const totalLengthLabel = formatInchesAsFeet(totalInches);
  const equalSpacing = spacingRun / Math.max(1, spacingCount + 1);
  const miter = wallAngle / 2;
  const crownMiter = Math.atan(Math.sin((miter * Math.PI) / 180) / Math.tan((springAngle * Math.PI) / 180)) * (180 / Math.PI);
  const crownBevel = Math.asin(Math.cos((springAngle * Math.PI) / 180) * Math.cos((miter * Math.PI) / 180)) * (180 / Math.PI);

  async function copyCalculatorResult() {
    const result = [
      "RIVT Heavy 16th",
      `Each piece: ${singleLengthLabel} (${formatNumber(decimalInches, 3)} in)`,
      `Quantity: ${quantity}`,
      `Total: ${totalLengthLabel} (${formatNumber(totalInches, 3)} in)`,
      `Equal spacing: ${formatNumber(equalSpacing, 3)} in on center`,
      `Flat miter: ${formatNumber(miter, 1)} deg`,
      `Crown: ${formatNumber(Math.abs(crownMiter), 1)} deg miter / ${formatNumber(Math.abs(crownBevel), 1)} deg bevel`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="v2-tool-workbench v2-calculator-workbench">
      <Panel className="v2-tool-panel" eyebrow="Field math" title="Heavy 16th calculator">
        <div className="v2-tool-app-strip" aria-label="Calculator modes">
          <span><Ruler size={15} /> Length</span>
          <span>Spacing</span>
          <span>Cuts</span>
        </div>
        <div className="v2-tool-input-grid four">
          <label>Feet<input type="number" value={feet} min="0" onChange={(event) => setFeet(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Inches<input type="number" value={inches} min="0" max="11" onChange={(event) => setInches(Math.max(0, Math.min(11, Number(event.target.value) || 0)))} /></label>
          <label>16ths<input type="number" value={sixteenths} min="0" max="15" onChange={(event) => setSixteenths(Math.max(0, Math.min(15, Number(event.target.value) || 0)))} /></label>
          <label>Qty<input type="number" value={quantity} min="1" onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>
        </div>
        <div className="v2-tool-result-hero v2-calculator-hero">
          <span>Total length</span>
          <strong>{totalLengthLabel}</strong>
          <small>{formatNumber(totalFeet, 2)} ft / {formatNumber(totalInches, 2)} in across {quantity} piece{quantity === 1 ? "" : "s"}</small>
          <button type="button" onClick={copyCalculatorResult}>
            <Copy size={15} />
            {copied ? "Copied" : "Copy result"}
          </button>
        </div>
        <div className="v2-tool-result-grid compact">
          <article><span>Each piece</span><strong>{singleLengthLabel}</strong></article>
          <article><span>Decimal</span><strong>{formatNumber(decimalInches, 3)} in</strong></article>
          <article><span>Quantity</span><strong>{quantity}</strong></article>
        </div>
        <div className="v2-tool-input-grid two">
          <label>Run length (in)<input type="number" value={spacingRun} min="1" onChange={(event) => setSpacingRun(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label>Spaces between<input type="number" value={spacingCount} min="1" onChange={(event) => setSpacingCount(Math.max(1, Number(event.target.value) || 1))} /></label>
        </div>
        <div className="v2-tool-result-row">
          <span>Equal spacing</span>
          <strong>{formatNumber(equalSpacing, 3)} in on center</strong>
        </div>
      </Panel>

      <Panel className="v2-tool-panel" eyebrow="Cuts" title="Miter and crown quick check">
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
      </Panel>
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
  const marginShare = target > 0 ? Math.min(100, Math.round(((margin + contingency) / target) * 100)) : 0;
  const laborShare = target > 0 ? Math.min(100, Math.round((labor / target) * 100)) : 0;

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
      <Panel className="v2-tool-panel" eyebrow="Estimate" title="Price the work before you post or bid">
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
      </Panel>

      <Panel as="aside" className="v2-tool-panel v2-tool-summary-panel" eyebrow="Target" title={`${currency(low)} - ${currency(high)}`}>
        <div className="v2-tool-result-hero">
          <span>Recommended target</span>
          <strong>{currency(target)}</strong>
          <small>{formatNumber(days, 1)} working days estimated</small>
        </div>
        <div className="v2-estimate-meter" aria-label="Estimate composition">
          <div><span style={{ width: `${laborShare}%` }} /></div>
          <small>{laborShare}% labor load - {marginShare}% margin/contingency cushion</small>
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
      </Panel>
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
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
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
  const emailHref = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(`Invoice ${invoiceNumber}`)}&body=${encodeURIComponent(invoiceText)}`;
  const smsHref = `sms:${encodeURIComponent(recipientPhone)}?body=${encodeURIComponent(`RIVT invoice ${invoiceNumber}: ${currency(total)} due. ${terms}. ${paymentMethod}.`)}`;

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
      <Panel className="v2-tool-panel" eyebrow="Invoice draft" title="Build a clean direct-payment invoice">
        <div className="v2-tool-input-grid two">
          <label>Invoice #<input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label>
          <label>Terms<input value={terms} onChange={(event) => setTerms(event.target.value)} /></label>
          <label>Bill to<input value={billTo} onChange={(event) => setBillTo(event.target.value)} placeholder="Contractor or company" /></label>
          <label>Pay to<input value={payTo} onChange={(event) => setPayTo(event.target.value)} placeholder="Your company or name" /></label>
          <label>Payment method<input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} /></label>
          <label>Tax %<input type="number" min="0" value={taxPct} onChange={(event) => setTaxPct(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Recipient email<input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="name@company.com" /></label>
          <label>Recipient phone<input type="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="+1 904 555 0123" /></label>
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
      </Panel>

      <Panel as="aside" className="v2-tool-panel v2-tool-summary-panel" eyebrow="Total due" title={currency(total)}>
        <div className="v2-tool-breakdown">
          <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
          <div><span>Tax</span><strong>{currency(tax)}</strong></div>
          <div><span>Terms</span><strong>{terms}</strong></div>
          <div><span>Method</span><strong>{paymentMethod}</strong></div>
        </div>
        <p className="v2-tool-note">Email/text delivery is not represented as production-ready in Gate A. These actions open your device's email or SMS draft; RIVT does not send or log delivery yet.</p>
        <div className="v2-invoice-delivery" aria-label="Invoice draft delivery">
          <a href={recipientEmail ? emailHref : undefined} aria-disabled={!recipientEmail} onClick={(event) => { if (!recipientEmail) event.preventDefault(); }}>
            <Mail size={15} />
            Email draft
          </a>
          <a href={recipientPhone ? smsHref : undefined} aria-disabled={!recipientPhone} onClick={(event) => { if (!recipientPhone) event.preventDefault(); }}>
            <MessageSquare size={15} />
            Text draft
          </a>
        </div>
        <div className="v2-tool-action-row">
          <button type="button" className="v2-primary-button" onClick={copyInvoice}><Copy size={15} />{copied ? "Copied" : "Copy invoice"}</button>
          <button type="button" onClick={downloadInvoice}><Download size={15} />{downloaded ? "Downloaded" : "Download TXT"}</button>
        </div>
      </Panel>
    </div>
  );
}

function MaterialsTool({ activeJob }: { activeJob: Job | null }) {
  const materialPresets = [
    { label: "Sheet goods", waste: 10, cost: 3.25, sheetWidth: 48, sheetHeight: 96 },
    { label: "Drywall", waste: 12, cost: 1.85, sheetWidth: 48, sheetHeight: 96 },
    { label: "Flooring", waste: 8, cost: 4.75, sheetWidth: 48, sheetHeight: 48 },
    { label: "Tile", waste: 15, cost: 7.5, sheetWidth: 12, sheetHeight: 24 },
  ];
  const [areaLength, setAreaLength] = useState(12);
  const [areaWidth, setAreaWidth] = useState(10);
  const [wastePct, setWastePct] = useState(10);
  const [unitCost, setUnitCost] = useState(3.25);
  const [sheetWidth, setSheetWidth] = useState(48);
  const [sheetHeight, setSheetHeight] = useState(96);
  const [partWidth, setPartWidth] = useState(24);
  const [partHeight, setPartHeight] = useState(18);
  const [partQty, setPartQty] = useState(8);
  const [presetName, setPresetName] = useState(materialPresets[0].label);

  const squareFeet = areaLength * areaWidth;
  const withWaste = squareFeet * (1 + wastePct / 100);
  const materialCost = withWaste * unitCost;
  const sheetArea = (sheetWidth * sheetHeight) / 144;
  const partArea = (partWidth * partHeight * partQty) / 144;
  const sheetsNeeded = Math.max(1, Math.ceil(partArea / Math.max(1, sheetArea)));
  const wasteAdded = withWaste - squareFeet;

  function applyPreset(preset: (typeof materialPresets)[number]) {
    setPresetName(preset.label);
    setWastePct(preset.waste);
    setUnitCost(preset.cost);
    setSheetWidth(preset.sheetWidth);
    setSheetHeight(preset.sheetHeight);
  }

  return (
    <div className="v2-tool-workbench">
      <Panel className="v2-tool-panel" eyebrow="Takeoff" title="Area, waste, and material cost">
        <div className="v2-tool-preset-row" aria-label="Material presets">
          {materialPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={presetName === preset.label ? "active" : ""}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="v2-tool-input-grid">
          <label>Length (ft)<input type="number" min="0" value={areaLength} onChange={(event) => setAreaLength(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Width (ft)<input type="number" min="0" value={areaWidth} onChange={(event) => setAreaWidth(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Waste %<input type="number" min="0" value={wastePct} onChange={(event) => setWastePct(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Cost / sq ft<input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(Math.max(0, Number(event.target.value) || 0))} /></label>
        </div>
        <div className="v2-tool-result-grid">
          <article><span>Base area</span><strong>{formatNumber(squareFeet)} sq ft</strong></article>
          <article><span>With waste</span><strong>{formatNumber(withWaste)} sq ft</strong></article>
          <article><span>Waste added</span><strong>{formatNumber(wasteAdded)} sq ft</strong></article>
          <article><span>Material cost</span><strong>{currency(materialCost)}</strong></article>
        </div>
      </Panel>

      <Panel className="v2-tool-panel" eyebrow="Sheet planning" title="Quick sheet count">
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
      </Panel>
    </div>
  );
}

function projectErrorMessage(error: unknown) {
  if (error instanceof ProjectApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not update the project record.";
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
  const [recordNotice, setRecordNotice] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [completionChecklist, setCompletionChecklist] = useState<CompletionChecklistState>(defaultCompletionChecklist);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCompletion = selectedProject?.completionSubmissions.find((completion) => completion.status === "submitted")
    ?? selectedProject?.completionSubmissions.at(-1)
    ?? null;
  const storedMedia = selectedProject?.media.filter((item) => item.status === "stored") ?? [];
  const latestEntry = selectedProject?.entries.at(-1) ?? null;
  const actionBusy = Boolean(projectAction);

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

  async function refreshSelectedProject() {
    const work = selectedProject ? activeWork.find((item) => item.id === selectedProject.activeWorkId) : null;
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
          description="Private closeout packets for accepted work. Photos, notes, completion, and reports are server-backed."
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
            title={recordsLoading ? "Loading records..." : `${activeWork.length} private record${activeWork.length === 1 ? "" : "s"}`}
            action={<button type="button" onClick={() => onNavigate("work")}>Find work</button>}
          >
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
              <EmptyState className="v2-tools-empty" icon={<FolderOpen size={20} />} title="No accepted work yet" description="Records unlock after a contractor and tradesperson both accept the work." compact />
            )}
          </Panel>

          <Panel
            className="v2-tools-panel v2-record-detail-panel"
            eyebrow={selectedProject ? recordStatusLabel(selectedProject.status) : "Record detail"}
            title={selectedProject ? selectedProject.job.title : "Select an accepted job"}
            description={selectedProject ? `${selectedProject.job.publicLocation.city}, ${selectedProject.job.publicLocation.region} - Updated ${new Date(selectedProject.updatedAt).toLocaleString()}` : "Open a record to add closeout evidence, submit completion, or generate the closeout report."}
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
                              <small>{item.mediaKind} - {fileSize(item.sizeBytes)}</small>
                            </span>
                          </article>
                        ))}
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
      <PageHeader
        className="v2-tools-header"
        title="Tools"
        description="Standalone field utilities for estimates, invoice drafts, materials, and closeout records."
        actions={<button type="button" className="v2-primary-button" onClick={() => activeJob ? onOpenJob(activeJob.id) : onNavigate("work")}>
          <Wrench size={16} />
          {activeJob ? "Use active job" : "Open work"}
        </button>}
      />

      <section className="v2-tools-command">
        <div>
          <span>Tool apps</span>
          <h2>{activeJob ? `Loaded from ${activeJob.title}` : "Open tools without needing a job first"}</h2>
          <p>These utilities calculate locally in the browser. Server-backed records still live in Records after accepted work.</p>
        </div>
        <MetricTile className="v2-tools-context-metric" value={activeJob ? activeJob.trade : "Standalone"} label={activeJob ? activeJob.location : "No active job selected"} />
      </section>

      <div className="v2-tool-launch-grid">
        <ToolCard
          icon={Calculator}
          title="Heavy 16th"
          badge="Field calculator"
          summary="Length math, equal spacing, miter, and crown checks."
          output="Ft-in-16ths"
          detail="Copy-ready result"
          action="Open"
          featured
          onAction={() => setActiveTool("calculator")}
        />
        <ToolCard
          icon={Scale}
          title="Estimate builder"
          badge="Pricing"
          summary="Labor, material, overhead, margin, and target price range."
          output="Target range"
          detail="Copy estimate"
          action="Open"
          onAction={() => setActiveTool("estimate")}
        />
        <ToolCard
          icon={ReceiptText}
          title="Invoice draft"
          badge="Direct pay"
          summary="Line items, totals, terms, email draft, and text draft."
          output="TXT / draft"
          detail="No fake sending"
          action="Open"
          onAction={() => setActiveTool("invoice")}
        />
        <ToolCard
          icon={LayoutGrid}
          title="Material takeoff"
          badge="Takeoff"
          summary="Area, waste, material cost, presets, and rough sheet count."
          output="Sq ft / sheets"
          detail="Trade presets"
          action="Open"
          onAction={() => setActiveTool("materials")}
        />
        <ToolCard
          icon={FolderOpen}
          title="Records"
          badge="Closeout"
          summary="Server-backed closeout packets for accepted work."
          output={`${activeWork.length}`}
          detail="accepted records"
          action="Open"
          onAction={onOpenRecords}
        />
      </div>

      <div className="v2-tools-grid">
        <Panel
          className="v2-tools-panel"
          eyebrow="Payment records"
          title="Direct-payment bookkeeping"
          action={<button type="button" onClick={onOpenRecords}>Records</button>}
        >
          <div className="v2-tools-records">
            <MetricTile value={paymentRecords.length} label="logged payments" />
            <MetricTile value={pendingPayments.length} label="waiting to close" />
            <MetricTile value={activeWork.filter((work) => work.status === "active").length} label="active closeouts" />
          </div>
        </Panel>

        <Panel
          className="v2-tools-panel"
          eyebrow="Job shortcuts"
          title={jobs.length ? "Open a current work order" : "No jobs yet"}
          action={<button type="button" onClick={() => onNavigate("work")}>Work</button>}
        >
          <div className="v2-tools-shortcuts">
            {jobs.slice(0, 3).map((job) => (
              <button key={job.id} type="button" className="v2-tools-shortcut" onClick={() => onOpenJob(job.id)}>
                <span>
                  <strong>{job.title}</strong>
                  <small>{job.trade} - {job.status}</small>
                </span>
                <StatusPill tone={job.status === "Open" ? "success" : job.status === "Draft" ? "warning" : "neutral"}>{job.status}</StatusPill>
                <ArrowRight size={15} />
              </button>
            ))}
            {jobs.length === 0 ? (
              <EmptyState className="v2-tools-empty" icon={<Clipboard size={20} />} title="No work orders yet" description="Create or accept work before Records can build a closeout packet." compact />
            ) : null}
          </div>
        </Panel>
      </div>
    </section>
  );
}
