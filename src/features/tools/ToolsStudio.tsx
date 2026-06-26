import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Car,
  ClipboardList,
  Camera,
  CheckCircle2,
  Clipboard,
  Circle,
  Clock,
  CloudSun,
  Copy,
  Download,
  FileText,
  FileUp,
  FolderOpen,
  Image,
  LayoutGrid,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Package2,
  RefreshCw,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Share2,
  Shield,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { usePro, getIsPro } from "../pro/usePro";
import { UpgradeModal } from "../pro/UpgradeModal";
import { getReportUrl, buildReportFromStorage } from "../report/reportUtils";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Job } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import { EmptyState, MetricTile, PageHeader, Panel, StatusPill } from "../../components/ui";
import { listActiveWork, type CanonicalActiveWork } from "../work/job-api";
import {
  addProjectNote,
  getProject,
  getProjectReport,
  openProjectForActiveWork,
  ProjectApiError,
  resolveProjectCompletion,
  submitProjectCompletion,
  uploadProjectMedia,
  type ProjectMedia,
  type ProjectRecord,
} from "./project-api";
import { FieldCalculatorTool } from "./FieldCalculatorTool";
import { EstimateTool } from "./EstimateTool";
import {
  AlbumApiError,
  createAlbum,
  getAlbum,
  listAlbums,
  uploadAlbumPhoto,
  type AlbumDetail,
  type AlbumPhoto,
  type PhotoAlbum,
} from "./album-api";
import "./tools-studio.css";

type ToolMode = "hub" | "calculator" | "estimate" | "invoice" | "materials" | "daily-log" | "job-photos" | "time-tracker" | "expense-logger" | "earnings" | "bid-builder" | "mileage" | "price-book" | "safety-checklist" | "tax-estimator" | "punch-list";

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

function ShareReportButton({ jobTitle }: { jobTitle: string }) {
  const [copied, setCopied] = useState(false);
  const isPro = getIsPro();

  async function handleShare() {
    if (!isPro) return;
    const data = buildReportFromStorage(jobTitle);
    const url = getReportUrl(data);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
      window.prompt("Copy this link to share with your client:", url);
    }
  }

  return (
    <button
      type="button"
      className={`v2-share-report-btn${!isPro ? " is-locked" : ""}`}
      onClick={() => void handleShare()}
      title={isPro ? "Copy client report link" : "Pro feature"}
    >
      {isPro ? <Share2 size={14} /> : <Lock size={14} />}
      {copied ? "Link copied!" : "Share report"}
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

interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  rate: number;
}

interface InvoiceTemplate {
  id: string;
  name: string;
  savedAt: string;
  invoiceNumber: string;
  billTo: string;
  payTo: string;
  terms: string;
  paymentMethod: string;
  recipientEmail: string;
  recipientPhone: string;
  taxPct: number;
  lines: InvoiceLine[];
}

const invoiceTemplateStorageKey = "rivt.invoiceTemplates.v1";

function readInvoiceTemplates() {
  try {
    const stored = localStorage.getItem(invoiceTemplateStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as InvoiceTemplate[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
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
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(readInvoiceTemplates);
  const [templateName, setTemplateName] = useState(activeJob ? `${activeJob.title} invoice` : "Standard invoice");
  const [templateNotice, setTemplateNotice] = useState("");
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

  function persistTemplates(nextTemplates: InvoiceTemplate[], notice: string) {
    const limited = nextTemplates.slice(0, 8);
    setTemplates(limited);
    setTemplateNotice(notice);
    try {
      localStorage.setItem(invoiceTemplateStorageKey, JSON.stringify(limited));
    } catch {
      setTemplateNotice("Template could not be saved on this device.");
    }
  }

  function saveTemplate() {
    const cleanName = templateName.trim() || "Invoice template";
    const template: InvoiceTemplate = {
      id: crypto.randomUUID(),
      name: cleanName,
      savedAt: new Date().toISOString(),
      invoiceNumber,
      billTo,
      payTo,
      terms,
      paymentMethod,
      recipientEmail,
      recipientPhone,
      taxPct,
      lines: lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
    };
    persistTemplates([template, ...templates.filter((item) => item.name.toLowerCase() !== cleanName.toLowerCase())], "Template saved on this device.");
  }

  function loadTemplate(template: InvoiceTemplate) {
    setTemplateName(template.name);
    setInvoiceNumber(template.invoiceNumber);
    setBillTo(template.billTo);
    setPayTo(template.payTo);
    setTerms(template.terms);
    setPaymentMethod(template.paymentMethod);
    setRecipientEmail(template.recipientEmail);
    setRecipientPhone(template.recipientPhone);
    setTaxPct(template.taxPct);
    setLines(template.lines.length ? template.lines.map((line) => ({ ...line, id: crypto.randomUUID() })) : [{ id: crypto.randomUUID(), description: "", qty: 1, rate: 0 }]);
    setTemplateNotice(`Loaded ${template.name}.`);
  }

  function deleteTemplate(templateId: string) {
    persistTemplates(templates.filter((template) => template.id !== templateId), "Template removed from this device.");
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

  function printInvoice() {
    window.print();
  }

  return (
    <div className="v2-tool-workbench v2-invoice-workbench">
      <Panel className="v2-tool-panel v2-invoice-builder-panel" eyebrow="Invoice draft" title="Build an invoice">
        <section className="v2-invoice-template-bar" aria-label="Invoice templates">
          <label>Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Standard labor invoice" /></label>
          <button type="button" className="v2-primary-button" onClick={saveTemplate}><FileText size={14} />Save template</button>
          <small>Templates are saved to this browser only — they won't appear on other devices.</small>
        </section>
        {templateNotice ? <p className="v2-record-notice" role="status">{templateNotice}</p> : null}
        {templates.length ? (
          <div className="v2-invoice-template-list" aria-label="Saved invoice templates">
            {templates.map((template) => (
              <article key={template.id}>
                <span>
                  <strong>{template.name}</strong>
                  <small>Saved {new Date(template.savedAt).toLocaleDateString()}</small>
                </span>
                <button type="button" onClick={() => loadTemplate(template)}>Load</button>
                <button type="button" aria-label={`Delete ${template.name}`} onClick={() => deleteTemplate(template.id)}><Trash2 size={14} /></button>
              </article>
            ))}
          </div>
        ) : null}
        <section className="v2-invoice-builder-section" aria-label="Invoice details">
          <h3>Invoice details</h3>
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
        </section>
        <div className="v2-invoice-lines" aria-label="Invoice line items">
          <div className="v2-invoice-lines-header">
            <span>Line items</span>
            <button type="button" onClick={addLine}><Plus size={14} />Add item</button>
          </div>
          {lines.map((line) => (
            <div className="v2-invoice-line" key={line.id}>
              <input aria-label="Line description" value={line.description} placeholder="Description" onChange={(event) => updateLine(line.id, "description", event.target.value)} />
              <input type="number" min="0" step="0.5" value={line.qty} aria-label={`${line.description || "Line"} quantity`} onChange={(event) => updateLine(line.id, "qty", Number(event.target.value) || 0)} />
              <input type="number" min="0" value={line.rate} aria-label={`${line.description || "Line"} rate`} onChange={(event) => updateLine(line.id, "rate", Number(event.target.value) || 0)} />
              <strong>{currency(line.qty * line.rate)}</strong>
              <button type="button" aria-label={`Remove ${line.description || "line item"}`} onClick={() => removeLine(line.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </Panel>

      <aside className="v2-invoice-side-stack">
        <Panel className="v2-tool-panel v2-tool-summary-panel v2-invoice-summary-panel" eyebrow="Total due" title={currency(total)}>
          <div className="v2-tool-breakdown">
            <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
            <div><span>Tax</span><strong>{currency(tax)}</strong></div>
            <div><span>Terms</span><strong>{terms}</strong></div>
            <div><span>Method</span><strong>{paymentMethod}</strong></div>
          </div>
          <p className="v2-tool-note">Tapping Email or Text opens a draft in your own email or messaging app. RIVT does not send on your behalf.</p>
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
            <button type="button" onClick={printInvoice}><FileText size={15} />Print</button>
          </div>
        </Panel>

        <Panel className="v2-tool-panel v2-invoice-preview-panel" eyebrow="Preview" title="Printable invoice">
          <article className="v2-invoice-print-preview" aria-label="Printable invoice preview">
            <header>
              <div>
                <strong>RIVT</strong>
                <span>Invoice draft</span>
              </div>
              <aside>
                <span>Invoice</span>
                <strong>{invoiceNumber || "RIVT-DRAFT"}</strong>
              </aside>
            </header>
            <section className="v2-invoice-preview-meta">
              <div><span>Bill to</span><strong>{billTo || "Contractor / company"}</strong></div>
              <div><span>Pay to</span><strong>{payTo || "Your company / name"}</strong></div>
              <div><span>Job</span><strong>{activeJob?.title ?? "Unlinked work"}</strong></div>
              <div><span>Terms</span><strong>{terms}</strong></div>
            </section>
            <table>
              <thead>
                <tr><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.description || "Line item"}</td>
                    <td>{formatNumber(line.qty)}</td>
                    <td>{currency(line.rate)}</td>
                    <td>{currency(line.qty * line.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <section className="v2-invoice-preview-totals">
              <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
              <div><span>Tax</span><strong>{currency(tax)}</strong></div>
              <div><span>Total due</span><strong>{currency(total)}</strong></div>
            </section>
            <footer>
              <span>{paymentMethod}</span>
              <p>RIVT generates this invoice for your records. Payments are collected directly between you and the client — not through RIVT.</p>
            </footer>
          </article>
        </Panel>
      </aside>
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

const dailyLogStorageKey = "rivt.dailyLogDraft.v1";
const dailyLogChecklist = [
  "Photos captured",
  "Scope change noted",
  "Safety condition checked",
  "Materials staged",
  "Contractor/customer updated",
] as const;

type DailyLogChecklistItem = (typeof dailyLogChecklist)[number];

interface DailyLogDraft {
  date: string;
  site: string;
  trade: string;
  weather: string;
  crewCount: number;
  hours: number;
  completed: string;
  blockers: string;
  materials: string;
  safety: string;
  nextStep: string;
  checklist: Record<DailyLogChecklistItem, boolean>;
}

function defaultDailyLogDraft(activeJob: Job | null): DailyLogDraft {
  return {
    date: new Date().toISOString().slice(0, 10),
    site: activeJob ? `${activeJob.title} - ${activeJob.location}` : "",
    trade: activeJob?.trade ?? "",
    weather: "",
    crewCount: 1,
    hours: activeJob?.durationHours ?? 8,
    completed: "",
    blockers: "",
    materials: "",
    safety: "",
    nextStep: "",
    checklist: dailyLogChecklist.reduce((items, label) => ({ ...items, [label]: false }), {} as Record<DailyLogChecklistItem, boolean>),
  };
}

function DailyLogTool({ activeJob, activeWork }: { activeJob: Job | null; activeWork: CanonicalActiveWork[] }) {
  const [draft, setDraft] = useState<DailyLogDraft>(() => defaultDailyLogDraft(activeJob));
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);
  const [wxData, setWxData] = useState<{ temp: number; condition: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem("rivt.lastWeather.v1") ?? "null") as { temp: number; condition: string } | null; } catch { return null; }
  });

  useEffect(() => {
    if (wxData) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true&temperature_unit=fahrenheit`)
        .then((r) => r.json())
        .then((data: { current_weather?: { temperature: number; weathercode: number } }) => {
          const cw = data.current_weather;
          if (!cw) return;
          const codes: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 51: "Drizzle", 61: "Rain", 71: "Snow", 80: "Showers", 95: "Thunderstorm" };
          const condition = codes[cw.weathercode] ?? "Partly cloudy";
          const wx = { temp: Math.round(cw.temperature), condition };
          setWxData(wx);
          try { localStorage.setItem("rivt.lastWeather.v1", JSON.stringify(wx)); } catch {}
        }).catch(() => {});
    }, () => {});
  }, [wxData]);

  const completedChecks = dailyLogChecklist.filter((item) => draft.checklist[item]).length;
  const recordWork = activeWork.find((work) => work.status === "active") ?? activeWork[0] ?? null;
  const recordWorkLabel = recordWork?.job?.title ?? activeJob?.title ?? "Accepted work";
  const dailyLogText = useMemo(() => [
    `RIVT daily log - ${draft.date || "undated"}`,
    `Site/job: ${draft.site || "Not entered"}`,
    `Trade: ${draft.trade || "Not entered"}`,
    `Weather: ${draft.weather || "Not entered"}`,
    `Crew: ${draft.crewCount || 0} person${draft.crewCount === 1 ? "" : "s"} / ${formatNumber(draft.hours)} hours`,
    "",
    "Work completed:",
    draft.completed || "Not entered",
    "",
    "Blockers / changes:",
    draft.blockers || "None entered",
    "",
    "Materials / equipment:",
    draft.materials || "Not entered",
    "",
    "Safety note:",
    draft.safety || "Not entered",
    "",
    "Next step:",
    draft.nextStep || "Not entered",
    "",
    "Checklist:",
    ...dailyLogChecklist.map((item) => `${draft.checklist[item] ? "[x]" : "[ ]"} ${item}`),
    "",
    "Device-local draft. Save official closeout evidence in RIVT Records for accepted work.",
  ].join("\n"), [draft]);

  function updateDraft<K extends keyof DailyLogDraft>(key: K, value: DailyLogDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function toggleChecklist(item: DailyLogChecklistItem) {
    setDraft((current) => ({
      ...current,
      checklist: { ...current.checklist, [item]: !current.checklist[item] },
    }));
    setNotice("");
  }

  function saveLocalDraft() {
    try {
      localStorage.setItem(dailyLogStorageKey, JSON.stringify(draft));
      setNotice("Daily log draft saved on this device.");
    } catch {
      setNotice("Daily log draft could not be saved on this device.");
    }
  }

  function loadLocalDraft() {
    try {
      const stored = localStorage.getItem(dailyLogStorageKey);
      if (!stored) {
        setNotice("No daily log draft found on this device.");
        return;
      }
      const parsed = JSON.parse(stored) as Partial<DailyLogDraft>;
      setDraft({
        ...defaultDailyLogDraft(activeJob),
        ...parsed,
        checklist: { ...defaultDailyLogDraft(activeJob).checklist, ...(parsed.checklist ?? {}) },
      });
      setNotice("Loaded the last daily log draft on this device.");
    } catch {
      setNotice("Daily log draft could not be loaded.");
    }
  }

  async function copyDailyLog() {
    try {
      await navigator.clipboard.writeText(dailyLogText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadDailyLog() {
    const blob = new Blob([dailyLogText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rivt-daily-log-${draft.date || "draft"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  async function saveToRecords() {
    if (!recordWork) {
      setNotice("Accepted work is required before RIVT can save this daily log to server-backed Records.");
      return;
    }
    setSavingRecord(true);
    setNotice("");
    try {
      const project = await openProjectForActiveWork(recordWork.id);
      await addProjectNote(project.id, dailyLogText);
      setNotice("Daily log saved to the server-backed Records timeline.");
    } catch (error) {
      setNotice(projectErrorMessage(error));
    } finally {
      setSavingRecord(false);
    }
  }

  return (
    <div className="v2-tool-workbench v2-daily-log-workbench">
      <Panel className="v2-tool-panel" eyebrow="Daily log" title="Capture the jobsite while it is fresh">
        <div className="v2-tool-input-grid three">
          <label>Date<input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label>
          <label>Trade<input value={draft.trade} onChange={(event) => updateDraft("trade", event.target.value)} placeholder="Electrical, HVAC, Carpentry..." /></label>
          <label>Weather
            <span className="v2-daily-log-weather-row">
              <input value={draft.weather} onChange={(event) => updateDraft("weather", event.target.value)} placeholder="Hot, rain delay, dry..." />
              <button
                type="button"
                className="v2-daily-log-wx-btn"
                title={wxData ? `Fill: ${wxData.temp}°F, ${wxData.condition}` : "Fetching weather…"}
                disabled={!wxData}
                onClick={() => {
                  if (!wxData) return;
                  updateDraft("weather", `${wxData.temp}°F, ${wxData.condition}`);
                }}
              >
                <CloudSun size={14} />
                Fill weather
              </button>
            </span>
          </label>
          <label>Site / job<input value={draft.site} onChange={(event) => updateDraft("site", event.target.value)} placeholder="Job name or address nickname" /></label>
          <label>Crew count<input type="number" min="0" value={draft.crewCount} onChange={(event) => updateDraft("crewCount", Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Hours<input type="number" min="0" step="0.5" value={draft.hours} onChange={(event) => updateDraft("hours", Math.max(0, Number(event.target.value) || 0))} /></label>
        </div>
        <div className="v2-daily-log-notes">
          <label>Work completed<textarea value={draft.completed} onChange={(event) => updateDraft("completed", event.target.value)} placeholder="What got done today? Include rough quantities, rooms, panels, fixtures, walls, or areas." rows={4} /></label>
          <label>Blockers / changes<textarea value={draft.blockers} onChange={(event) => updateDraft("blockers", event.target.value)} placeholder="Delays, missing material, access issues, scope changes, inspection items..." rows={3} /></label>
          <label>Materials / equipment<textarea value={draft.materials} onChange={(event) => updateDraft("materials", event.target.value)} placeholder="Material staged, returns needed, tools left on site, rental equipment..." rows={3} /></label>
          <label>Safety note<textarea value={draft.safety} onChange={(event) => updateDraft("safety", event.target.value)} placeholder="Hazards, PPE, lockout/tagout, ladder/scaffold note, heat plan..." rows={3} /></label>
          <label>Next step<textarea value={draft.nextStep} onChange={(event) => updateDraft("nextStep", event.target.value)} placeholder="What should happen next and who owns it?" rows={3} /></label>
        </div>
      </Panel>

      <aside className="v2-daily-log-side">
        <Panel className="v2-tool-panel v2-tool-summary-panel" eyebrow="Daily log" title="Preview">
          <div className="v2-tool-result-grid compact">
            <article><span>Crew hours</span><strong>{formatNumber(draft.crewCount * draft.hours)}h</strong></article>
            <article><span>Checklist</span><strong>{completedChecks}/{dailyLogChecklist.length}</strong></article>
            <article><span>Mode</span><strong>{recordWork ? "Records-ready" : "Local draft"}</strong></article>
          </div>
          <div className={recordWork ? "v2-daily-log-record-target is-ready" : "v2-daily-log-record-target"}>
            <span>{recordWork ? "Accepted work target" : "No accepted work loaded"}</span>
            <strong>{recordWork ? recordWorkLabel : "Use local draft or open Records after a hire"}</strong>
            <small>{recordWork ? "This log can be added to the private project timeline." : "Server-backed Records are available after a job is accepted by both sides."}</small>
          </div>
          <div className="v2-daily-log-checklist" aria-label="Daily log checklist">
            {dailyLogChecklist.map((item) => (
              <button key={item} type="button" className={draft.checklist[item] ? "active" : ""} aria-pressed={draft.checklist[item]} onClick={() => toggleChecklist(item)}>
                <CheckCircle2 size={15} />
                {item}
              </button>
            ))}
          </div>
          <pre className="v2-daily-log-preview">{dailyLogText}</pre>
          {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={() => void saveToRecords()} disabled={savingRecord || !recordWork}>
              <FolderOpen size={15} />
              {savingRecord ? "Saving" : "Save to Records"}
            </button>
            <button type="button" className="v2-primary-button" onClick={copyDailyLog}><Copy size={15} />{copied ? "Copied" : "Copy daily log"}</button>
            <button type="button" onClick={downloadDailyLog}><Download size={15} />{downloaded ? "Downloaded" : "Download TXT"}</button>
            <button type="button" onClick={saveLocalDraft}><FileText size={15} />Save local draft</button>
            <button type="button" onClick={loadLocalDraft}><RefreshCw size={15} />Load last draft</button>
          </div>
          <p className="v2-tool-note">
            {recordWork
              ? "Save to Records writes a private project timeline note through RIVT's authenticated Records API. Copy/download/local draft remain available for field backup."
              : "Without accepted work this stays a device-local field note. Accepted-work closeouts, uploads, and official records stay in server-backed Records."}
          </p>
        </Panel>
      </aside>
    </div>
  );
}

type PhotoView = "gallery" | "detail" | "compare-a" | "compare-b" | "compare-view";
type JobPhotosMode = "albums" | "album-detail" | "active-job";

interface UnifiedPhoto {
  id: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
  signedUrl: string | null;
}

function photoFromProjectMedia(m: ProjectMedia): UnifiedPhoto {
  return { id: m.id, originalName: m.originalName, sizeBytes: m.sizeBytes, createdAt: m.createdAt, signedUrl: m.signedUrl ?? null };
}

function photoFromAlbumPhoto(p: AlbumPhoto): UnifiedPhoto {
  return { id: p.id, originalName: p.originalName, sizeBytes: p.sizeBytes, createdAt: p.createdAt, signedUrl: p.signedUrl };
}

function albumErrorMessage(error: unknown) {
  if (error instanceof AlbumApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not complete the request.";
}

function CameraCapture({ onCapture, onClose }: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [captureCount, setCaptureCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [lastSnapUrl, setLastSnapUrl] = useState<string | null>(null);
  const lastSnapRef = useRef<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then((s) => {
      stream = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    }).catch((err: unknown) => {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Check your browser or app settings."
          : "Camera could not be started."
      );
    });
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (lastSnapRef.current) URL.revokeObjectURL(lastSnapRef.current);
    };
  }, []);

  function shoot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (lastSnapRef.current) URL.revokeObjectURL(lastSnapRef.current);
      const url = URL.createObjectURL(blob);
      lastSnapRef.current = url;
      setLastSnapUrl(url);
      onCapture(blob);
      setCaptureCount((n) => n + 1);
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="v2-camera-overlay">
      {flash && <div className="v2-camera-flash" aria-hidden="true" />}
      <button type="button" className="v2-camera-close" onClick={onClose}>Done</button>
      {error ? (
        <div className="v2-camera-error">
          <strong>Camera unavailable</strong>
          <p>{error}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="v2-camera-feed"
          playsInline
          muted
          autoPlay
          onLoadedMetadata={() => setReady(true)}
        />
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
      <div className="v2-camera-controls">
        <button
          type="button"
          className="v2-camera-shutter"
          onClick={shoot}
          disabled={!ready || !!error}
          aria-label="Take photo"
        />
      </div>
      {lastSnapUrl && (
        <img
          key={lastSnapUrl}
          src={lastSnapUrl}
          alt="Last photo taken"
          className="v2-camera-last-snap"
        />
      )}
      {captureCount > 0 && (
        <span className="v2-camera-badge">{captureCount} {captureCount === 1 ? "photo" : "photos"}</span>
      )}
    </div>
  );
}

function PhotoGallery({
  title,
  subtitle,
  photos,
  uploading,
  uploadError,
  onBack,
  onUploadFiles,
  onFileRef,
}: {
  title: string;
  subtitle: string;
  photos: UnifiedPhoto[];
  uploading: boolean;
  uploadError: string;
  onBack: () => void;
  onUploadFiles: (files: FileList | null) => Promise<void>;
  onFileRef: (ref: HTMLInputElement | null) => void;
}) {
  const [photoView, setPhotoView] = useState<PhotoView>("gallery");
  const [selectedPhoto, setSelectedPhoto] = useState<UnifiedPhoto | null>(null);
  const [compareA, setCompareA] = useState<UnifiedPhoto | null>(null);
  const [compareB, setCompareB] = useState<UnifiedPhoto | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { onFileRef(fileRef.current); }, [onFileRef]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const count = files.length;
    setPendingCount((prev) => prev + count);
    try {
      await onUploadFiles(files);
    } finally {
      setPendingCount((prev) => Math.max(0, prev - count));
    }
  }

  function handleCapturePhoto(blob: Blob) {
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    const dt = new DataTransfer();
    dt.items.add(file);
    void handleUpload(dt.files);
  }

  function startCompare() { setCompareA(null); setCompareB(null); setPhotoView("compare-a"); }

  function pickForCompare(photo: UnifiedPhoto) {
    if (photoView === "compare-a") { setCompareA(photo); setPhotoView("compare-b"); }
    else { setCompareB(photo); setPhotoView("compare-view"); }
  }

  if (photoView === "detail" && selectedPhoto) {
    return (
      <div className="v2-job-photos-workbench">
        <div className="v2-job-photos-toolbar">
          <button type="button" onClick={() => { setPhotoView("gallery"); setSelectedPhoto(null); }}>
            <ArrowLeft size={15} />All photos
          </button>
          <div className="v2-job-photos-toolbar-meta">
            <strong>{selectedPhoto.originalName}</strong>
            <small>{new Date(selectedPhoto.createdAt).toLocaleString()} · {fileSize(selectedPhoto.sizeBytes)}</small>
          </div>
          {selectedPhoto.signedUrl ? (
            <a href={selectedPhoto.signedUrl} download={selectedPhoto.originalName} className="v2-btn-secondary" rel="noreferrer">
              <Download size={15} />Download
            </a>
          ) : null}
        </div>
        {selectedPhoto.signedUrl ? (
          <figure className="v2-job-photo-full">
            <img src={selectedPhoto.signedUrl} alt={selectedPhoto.originalName} />
          </figure>
        ) : null}
      </div>
    );
  }

  if (photoView === "compare-a" || photoView === "compare-b") {
    const label = photoView === "compare-a" ? "Pick the Before photo" : "Now pick the After photo";
    const excludeId = photoView === "compare-b" ? compareA?.id : undefined;
    return (
      <div className="v2-job-photos-workbench">
        <div className="v2-job-photos-toolbar">
          <button type="button" onClick={() => setPhotoView("gallery")}><ArrowLeft size={15} />Back</button>
          <span className="v2-job-photos-pick-label">{label}</span>
        </div>
        <div className="v2-job-photos-grid">
          {photos.filter((p) => p.id !== excludeId).map((photo) => (
            <button key={photo.id} type="button" className="v2-job-photo-thumb" onClick={() => pickForCompare(photo)}>
              {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalName} loading="lazy" /> : <span className="v2-job-photo-placeholder"><Camera size={18} /></span>}
              <span className="v2-job-photo-meta"><small>{new Date(photo.createdAt).toLocaleDateString()}</small></span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (photoView === "compare-view" && compareA && compareB) {
    return (
      <div className="v2-job-photos-workbench">
        <div className="v2-job-photos-toolbar">
          <button type="button" onClick={() => setPhotoView("gallery")}><ArrowLeft size={15} />All photos</button>
          <span>Before / after</span>
          <button type="button" onClick={startCompare}><RefreshCw size={14} />New compare</button>
        </div>
        <div className="v2-job-photos-compare-grid">
          {([["Before", compareA], ["After", compareB]] as const).map(([lbl, photo]) => (
            <figure key={lbl} className="v2-job-photo-compare-frame">
              <span className="v2-job-photo-compare-label">{lbl}</span>
              {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalName} /> : null}
              <figcaption>{new Date(photo.createdAt).toLocaleDateString()}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="v2-job-photos-workbench">
      {showCamera && (
        <CameraCapture
          onCapture={handleCapturePhoto}
          onClose={() => setShowCamera(false)}
        />
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} aria-hidden="true"
        onChange={(e) => { const files = e.target.files; if (e.target) e.target.value = ""; void handleUpload(files); }} />

      <div className="v2-job-photos-actions-bar">
        <div className="v2-job-photos-stats">
          <button type="button" className="v2-job-photos-back-link" onClick={onBack}><ArrowLeft size={14} />Albums</button>
          <span className="v2-job-photos-separator">·</span>
          <strong>{photos.length}</strong>
          <span>{photos.length === 1 ? "photo" : "photos"}</span>
          <span className="v2-job-photos-separator">·</span>
          <span className="v2-job-photos-job-name">{title}</span>
        </div>
        <div className="v2-tool-action-row">
          <button type="button" className="v2-primary-button" onClick={() => setShowCamera(true)}>
            <Camera size={15} />Camera
          </button>
          <button type="button" className="v2-primary-button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <FileUp size={15} />Upload
          </button>
          {photos.length >= 2 ? (
            <button type="button" onClick={startCompare}><Image size={15} />Compare</button>
          ) : null}
        </div>
      </div>

      {subtitle ? <p className="v2-job-photos-subtitle">{subtitle}</p> : null}
      {uploadError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{uploadError}</p> : null}

      {photos.length === 0 && pendingCount === 0 ? (
        <div className="v2-job-photos-empty">
          <Camera size={28} />
          <strong>No photos yet</strong>
          <p>Take a photo on site or upload from your device.</p>
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={() => setShowCamera(true)}>
              <Camera size={15} />Take first photo
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <FileUp size={15} />Upload
            </button>
          </div>
        </div>
      ) : (
        <div className="v2-job-photos-grid">
          {photos.map((photo) => (
            <button key={photo.id} type="button" className="v2-job-photo-thumb"
              onClick={() => { setSelectedPhoto(photo); setPhotoView("detail"); }}>
              {photo.signedUrl
                ? <img src={photo.signedUrl} alt={photo.originalName} loading="lazy" />
                : <span className="v2-job-photo-placeholder"><Camera size={18} /></span>}
              <span className="v2-job-photo-meta">
                <small>{new Date(photo.createdAt).toLocaleDateString()}</small>
              </span>
            </button>
          ))}
          {Array.from({ length: pendingCount }).map((_, i) => (
            <div key={`pending-${i}`} className="v2-job-photo-thumb v2-job-photo-pending">
              <span className="v2-job-photo-placeholder"><Loader2 size={18} className="v2-photo-spinner" /></span>
              <span className="v2-job-photo-meta"><small>Uploading…</small></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobPhotosTool({ activeWork }: { activeWork: CanonicalActiveWork[] }) {
  const recordWork = activeWork.find((w) => w.status === "active") ?? activeWork[0] ?? null;

  // Albums mode state
  const [mode, setMode] = useState<JobPhotosMode>("albums");
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [albumsError, setAlbumsError] = useState("");
  const [openAlbum, setOpenAlbum] = useState<AlbumDetail | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [albumUploading, setAlbumUploading] = useState(false);
  const [albumUploadError, setAlbumUploadError] = useState("");
  const albumFileRef = useRef<HTMLInputElement | null>(null);

  // Active-job mode state
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [jobUploading, setJobUploading] = useState(false);
  const [jobUploadError, setJobUploadError] = useState("");
  const jobFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAlbums()
      .then((items) => { if (!cancelled) setAlbums(items); })
      .catch((err: unknown) => { if (!cancelled) setAlbumsError(albumErrorMessage(err)); })
      .finally(() => { if (!cancelled) setAlbumsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function openAlbumById(albumId: string) {
    setAlbumLoading(true);
    try {
      const detail = await getAlbum(albumId);
      setOpenAlbum(detail);
      setMode("album-detail");
    } catch (err) {
      setAlbumsError(albumErrorMessage(err));
    } finally {
      setAlbumLoading(false);
    }
  }

  async function handleCreateAlbum() {
    const name = newAlbumName.trim();
    if (!name) return;
    setCreatingAlbum(true);
    try {
      const album = await createAlbum(name);
      setAlbums((prev) => [album, ...prev]);
      setNewAlbumName("");
      setShowNewAlbum(false);
      await openAlbumById(album.id);
    } catch (err) {
      setAlbumsError(albumErrorMessage(err));
    } finally {
      setCreatingAlbum(false);
    }
  }

  async function handleAlbumFiles(files: FileList | null) {
    if (!files?.length || !openAlbum) return;
    setAlbumUploading(true);
    setAlbumUploadError("");
    const newPhotos: AlbumPhoto[] = [];
    for (const file of Array.from(files)) {
      try {
        newPhotos.push(await uploadAlbumPhoto(openAlbum.id, file));
      } catch (err) {
        setAlbumUploadError(albumErrorMessage(err));
        break;
      }
    }
    if (newPhotos.length) {
      setOpenAlbum((prev) => prev ? {
        ...prev,
        photoCount: prev.photoCount + newPhotos.length,
        photos: [...prev.photos, ...newPhotos],
      } : prev);
    }
    setAlbumUploading(false);
    if (albumFileRef.current) albumFileRef.current.value = "";
  }

  async function openActiveJob() {
    if (!recordWork) return;
    setProjectLoading(true);
    setProjectError("");
    try {
      setProject(await openProjectForActiveWork(recordWork.id));
      setMode("active-job");
    } catch (err) {
      setProjectError(projectErrorMessage(err));
    } finally {
      setProjectLoading(false);
    }
  }

  async function handleJobFiles(files: FileList | null) {
    if (!files?.length || !project) return;
    setJobUploading(true);
    setJobUploadError("");
    for (const file of Array.from(files)) {
      try {
        await uploadProjectMedia(project.id, file, "");
      } catch (err) {
        setJobUploadError(projectErrorMessage(err));
        break;
      }
    }
    try { setProject(await getProject(project.id)); } catch { /* best-effort */ }
    setJobUploading(false);
    if (jobFileRef.current) jobFileRef.current.value = "";
  }

  // ── Active-job gallery ───────────────────────────────────────────────────
  if (mode === "active-job" && project) {
    const jobPhotos = project.media
      .filter((m) => m.mediaKind === "photo" && m.status !== "removed" && m.signedUrl)
      .map(photoFromProjectMedia);
    return (
      <PhotoGallery
        title={recordWork?.job?.title ?? "Active job"}
        subtitle=""
        photos={jobPhotos}
        uploading={jobUploading}
        uploadError={jobUploadError}
        onBack={() => setMode("albums")}
        onUploadFiles={handleJobFiles}
        onFileRef={(r) => { jobFileRef.current = r; }}
      />
    );
  }

  // ── Album detail gallery ─────────────────────────────────────────────────
  if (mode === "album-detail" && openAlbum) {
    const albumPhotos = openAlbum.photos.map(photoFromAlbumPhoto);
    return (
      <PhotoGallery
        title={openAlbum.name}
        subtitle=""
        photos={albumPhotos}
        uploading={albumUploading}
        uploadError={albumUploadError}
        onBack={() => { setMode("albums"); setOpenAlbum(null); }}
        onUploadFiles={handleAlbumFiles}
        onFileRef={(r) => { albumFileRef.current = r; }}
      />
    );
  }

  // ── Albums list (home screen) ────────────────────────────────────────────
  return (
    <div className="v2-job-photos-workbench">
      <div className="v2-job-photos-albums-header">
        <div>
          <h2 className="v2-job-photos-albums-title">Job Photos</h2>
          <p className="v2-job-photos-albums-sub">Document any job — marketplace or not. Albums are private to your account.</p>
        </div>
        <button type="button" className="v2-primary-button" onClick={() => setShowNewAlbum(true)}>
          <Plus size={15} />New album
        </button>
      </div>

      {showNewAlbum ? (
        <div className="v2-job-photos-new-album">
          <input
            type="text"
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            placeholder="Album name — e.g. Johnson deck, Main St kitchen reno…"
            maxLength={140}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateAlbum(); if (e.key === "Escape") { setShowNewAlbum(false); setNewAlbumName(""); } }}
          />
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={() => void handleCreateAlbum()} disabled={creatingAlbum || !newAlbumName.trim()}>
              {creatingAlbum ? "Creating…" : "Create album"}
            </button>
            <button type="button" onClick={() => { setShowNewAlbum(false); setNewAlbumName(""); }}>Cancel</button>
          </div>
        </div>
      ) : null}

      {albumsError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{albumsError}</p> : null}

      {recordWork ? (
        <div className="v2-job-photos-active-job-card">
          <div className="v2-job-photos-active-job-info">
            <span className="v2-job-photos-active-badge">Active job</span>
            <strong>{recordWork.job?.title ?? "Accepted work"}</strong>
            <small>Photos stored in your private project record</small>
          </div>
          <button
            type="button"
            className="v2-primary-button"
            onClick={() => void openActiveJob()}
            disabled={projectLoading}
          >
            <Camera size={15} />
            {projectLoading ? "Opening…" : "Open"}
          </button>
          {projectError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{projectError}</p> : null}
        </div>
      ) : null}

      {albumsLoading ? (
        <p className="v2-job-photos-loading">Loading albums…</p>
      ) : albums.length === 0 && !showNewAlbum ? (
        <div className="v2-job-photos-empty">
          <Camera size={28} />
          <strong>No albums yet</strong>
          <p>Create an album for any job — even ones you found outside RIVT. Your photos are stored privately on your account.</p>
          <button type="button" className="v2-primary-button" onClick={() => setShowNewAlbum(true)}>
            <Plus size={15} />Create first album
          </button>
        </div>
      ) : (
        <div className="v2-job-photos-album-list">
          {albums.map((album) => (
            <button
              key={album.id}
              type="button"
              className="v2-job-photos-album-row"
              onClick={() => void openAlbumById(album.id)}
              disabled={albumLoading}
            >
              <span className="v2-job-photos-album-icon"><Camera size={17} /></span>
              <span className="v2-job-photos-album-copy">
                <strong>{album.name}</strong>
                <small>{album.photoCount} {album.photoCount === 1 ? "photo" : "photos"} · {new Date(album.updatedAt).toLocaleDateString()}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mileage Logger ───────────────────────────────────────────────────────────

const IRS_RATE_2025 = 0.70;
const mileageKey = "rivt.mileage.v1";

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
  try { localStorage.setItem(mileageKey, JSON.stringify(entries.slice(0, 500))); } catch {}
}

function MileageLoggerTool({ activeJob }: { activeJob: Job | null }) {
  const [entries, setEntries] = useState<MileageEntry[]>(readMileage);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(activeJob?.location ?? "");
  const [jobRef, setJobRef] = useState(activeJob?.title ?? "");
  const [miles, setMiles] = useState("");
  const [purpose, setPurpose] = useState("Job travel");
  const [notice, setNotice] = useState("");

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
    setEntries(next);
    persistMileage(next);
    setFrom("");
    setMiles("");
    setNotice("Trip logged.");
    setTimeout(() => setNotice(""), 2500);
  }

  function removeEntry(id: string) {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    persistMileage(next);
  }

  const thisYear = new Date().getFullYear().toString();
  const yearEntries = entries.filter((e) => e.date.startsWith(thisYear));
  const yearMiles = yearEntries.reduce((sum, e) => sum + e.miles, 0);
  const yearDeduction = yearMiles * IRS_RATE_2025;
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
        <button type="button" className="v2-primary-button" disabled={!miles || parseFloat(miles) <= 0} onClick={addEntry}><Car size={14} />Log trip</button>
        {entries.length ? (
          <div className="v2-mileage-list">
            {entries.map((e) => (
              <article key={e.id} className="v2-mileage-entry">
                <div className="v2-mileage-entry-head">
                  <strong>{e.miles.toFixed(1)} mi</strong>
                  <span>{e.date}</span>
                  <span className="v2-mileage-deduction">{currency(e.miles * IRS_RATE_2025)} deduction</span>
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
            <div><span>Total deductible</span><strong>{currency(totalMiles * IRS_RATE_2025)}</strong></div>
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
  try { localStorage.setItem(priceBookKey, JSON.stringify(entries.slice(0, 200))); } catch {}
}

function PriceBookTool() {
  const [entries, setEntries] = useState<PriceEntry[]>(readPriceBook);

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
        setEntries(seededEntries);
        persistPriceBook(seededEntries);
        localStorage.setItem("rivt.priceBookSeeded.v1", "1");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const filtered = entries.filter((e) => !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()) || e.supplier.toLowerCase().includes(search.toLowerCase()));

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
    setEntries(next);
    persistPriceBook(next);
    setName(""); setUnit(""); setPrice(""); setSupplier(""); setNotes("");
    setNotice(existingIndex >= 0 ? "Price updated." : "Price saved.");
    setTimeout(() => setNotice(""), 2500);
  }

  function removeEntry(id: string) {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    persistPriceBook(next);
  }

  async function copyPrice(entry: PriceEntry) {
    const text = `${entry.name}: ${currency(entry.price)}/${entry.unit}${entry.supplier ? ` (${entry.supplier})` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(""), 2000);
    } catch {}
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
  try { localStorage.setItem(safetyLogKey, JSON.stringify(logs.slice(0, 200))); } catch {}
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
    try { localStorage.setItem(TAX_EST_KEY, JSON.stringify(next)); } catch {}
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
          <select value={input.filingStatus} onChange={e => { const next = { ...input, filingStatus: e.target.value as TaxEstimatorInput["filingStatus"] }; setInput(next); try { localStorage.setItem(TAX_EST_KEY, JSON.stringify(next)); } catch {} }}>
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

const PUNCH_KEY = "rivt.punchLists.v1";

interface PunchItem {
  id: string; description: string; location: string;
  status: "open" | "in-progress" | "done"; assignee: string; createdAt: string;
}
interface PunchList { id: string; jobName: string; createdAt: string; items: PunchItem[] }

function readPunchLists(): PunchList[] {
  try { return JSON.parse(localStorage.getItem(PUNCH_KEY) ?? "[]") as PunchList[]; } catch { return []; }
}
function writePunchLists(lists: PunchList[]) {
  try { localStorage.setItem(PUNCH_KEY, JSON.stringify(lists)); } catch {}
}

function PunchListTool() {
  const { isPro } = usePro();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [lists, setLists] = useState<PunchList[]>(readPunchLists);
  const [activeListId, setActiveListId] = useState<string | null>(() => readPunchLists()[0]?.id ?? null);
  const [newJobName, setNewJobName] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
  const [addingItem, setAddingItem] = useState(false);
  const [itemDraft, setItemDraft] = useState({ description: "", location: "", assignee: "" });

  const activeList = lists.find(l => l.id === activeListId) ?? null;
  const visibleItems = activeList?.items.filter(i => statusFilter === "all" ? true : statusFilter === "open" ? i.status !== "done" : i.status === "done") ?? [];
  const doneCount = activeList?.items.filter(i => i.status === "done").length ?? 0;

  function createList() {
    if (!newJobName.trim()) return;
    if (!isPro && lists.length >= 1) { setUpgradeOpen(true); setNewJobName(""); return; }
    const list: PunchList = { id: `pl_${Date.now()}`, jobName: newJobName.trim(), createdAt: new Date().toISOString(), items: [] };
    const next = [...lists, list];
    setLists(next); writePunchLists(next);
    setActiveListId(list.id); setNewJobName("");
  }

  function cycleStatus(itemId: string) {
    if (!activeList) return;
    const cycle: PunchItem["status"][] = ["open", "in-progress", "done"];
    const next = lists.map(l => l.id !== activeList.id ? l : {
      ...l, items: l.items.map(i => i.id !== itemId ? i : { ...i, status: cycle[(cycle.indexOf(i.status) + 1) % 3] })
    });
    setLists(next); writePunchLists(next);
  }

  function addItem() {
    if (!activeList || !itemDraft.description.trim()) return;
    const item: PunchItem = { id: `pi_${Date.now()}`, ...itemDraft, status: "open", createdAt: new Date().toISOString() };
    const next = lists.map(l => l.id !== activeList.id ? l : { ...l, items: [...l.items, item] });
    setLists(next); writePunchLists(next);
    setItemDraft({ description: "", location: "", assignee: "" }); setAddingItem(false);
  }

  const statusIcon = (s: PunchItem["status"]) =>
    s === "done" ? <CheckCircle2 size={16} color="var(--v2-success)" /> :
    s === "in-progress" ? <Clock size={16} color="var(--v2-warning, #f59e0b)" /> :
    <Circle size={16} color="var(--v2-text-muted)" />;

  return (
    <div className="v2-punch-workbench">
      <aside className="v2-punch-sidebar">
        <header>
          <span>Job lists</span>
          <button type="button" className="v2-primary-button" onClick={() => setNewJobName(" ")}>+ New</button>
        </header>
        {newJobName !== "" && (
          <div className="v2-punch-new-list">
            <input autoFocus placeholder="Job name" value={newJobName.trim()} onChange={e => setNewJobName(e.target.value)} onKeyDown={e => e.key === "Enter" && createList()} />
            <button type="button" className="v2-primary-button" onClick={createList}>Create</button>
          </div>
        )}
        {lists.map(l => {
          const done = l.items.filter(i => i.status === "done").length;
          return (
            <button key={l.id} type="button" className={`v2-punch-list-row${l.id === activeListId ? " active" : ""}`} onClick={() => setActiveListId(l.id)}>
              <strong>{l.jobName}</strong>
              <small>{done} / {l.items.length} done</small>
            </button>
          );
        })}
        {lists.length === 0 && <p className="v2-punch-empty-hint">Create a list for each job.</p>}
      </aside>

      <main className="v2-punch-items">
        {activeList ? (
          <>
            <header>
              <div>
                <strong>{activeList.jobName}</strong>
                <small>{doneCount} of {activeList.items.length} items done</small>
              </div>
              <div className="v2-punch-filter-tabs">
                {(["all", "open", "done"] as const).map(f => (
                  <button key={f} type="button" className={statusFilter === f ? "active" : ""} onClick={() => setStatusFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </header>
            {activeList.items.length > 0 && (
              <div className="v2-punch-progress">
                <div className="v2-punch-progress-fill" style={{ width: `${activeList.items.length ? (doneCount / activeList.items.length) * 100 : 0}%` }} />
              </div>
            )}
            <div className="v2-punch-item-list">
              {visibleItems.map(item => (
                <div key={item.id} className={`v2-punch-item${item.status === "done" ? " is-done" : ""}`}>
                  <button type="button" className="v2-punch-status-btn" onClick={() => cycleStatus(item.id)} title="Click to change status">
                    {statusIcon(item.status)}
                  </button>
                  <div>
                    <strong>{item.description}</strong>
                    {item.location && <small><MapPin size={11} /> {item.location}</small>}
                    {item.assignee && <small>→ {item.assignee}</small>}
                  </div>
                </div>
              ))}
              {visibleItems.length === 0 && <p className="v2-punch-empty-hint">No {statusFilter !== "all" ? statusFilter : ""} items.</p>}
            </div>
            {addingItem ? (
              <div className="v2-punch-add-form">
                <input autoFocus placeholder="Description*" value={itemDraft.description} onChange={e => setItemDraft(p => ({ ...p, description: e.target.value }))} />
                <input placeholder="Location (optional)" value={itemDraft.location} onChange={e => setItemDraft(p => ({ ...p, location: e.target.value }))} />
                <input placeholder="Assignee (optional)" value={itemDraft.assignee} onChange={e => setItemDraft(p => ({ ...p, assignee: e.target.value }))} />
                <div className="v2-punch-add-actions">
                  <button type="button" className="v2-primary-button" onClick={addItem}>Add item</button>
                  <button type="button" onClick={() => setAddingItem(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className="v2-punch-add-btn" onClick={() => setAddingItem(true)}>+ Add item</button>
            )}
          </>
        ) : (
          <div className="v2-punch-no-list">
            <ClipboardList size={28} />
            <strong>No list selected</strong>
            <p>Create a punch list for each job to track deficiencies and final walkthrough items.</p>
          </div>
        )}
      </main>
      {upgradeOpen && <UpgradeModal reason="Multiple punch lists" onClose={() => setUpgradeOpen(false)} />}
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
  const [notice, setNotice] = useState("");

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
    setLogs(next);
    persistSafetyLogs(next);
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

const timeTrackerKey = "rivt.timeSessions.v1";

interface TimeSession {
  id: string;
  jobId: number | null;
  jobTitle: string;
  startedAt: string;
  endedAt: string | null;
  notes: string;
}

function readTimeSessions(): TimeSession[] {
  try {
    const stored = localStorage.getItem(timeTrackerKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as TimeSession[];
    return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
  } catch { return []; }
}

function persistTimeSessions(sessions: TimeSession[]) {
  try { localStorage.setItem(timeTrackerKey, JSON.stringify(sessions.slice(0, 100))); } catch {}
}

// ── Bid Builder ───────────────────────────────────────────────────────────────

interface DefaultBidLine { description: string; qty: number; unit: string; unitPrice: number; }

function getDefaultBidLines(trade: string | null, overrideDurationHours?: number, overridePay?: number): DefaultBidLine[] {
  const hrs = overrideDurationHours ?? 8;
  const payBase = overridePay ? Math.round(overridePay * 0.2) || 250 : 250;

  const defaults: Record<string, DefaultBidLine[]> = {
    Electrician: [
      { description: "Labor – rough-in", qty: hrs, unit: "hr", unitPrice: 90 },
      { description: "Labor – trim-out", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 90 },
      { description: "12/2 Romex wire", qty: 100, unit: "ft", unitPrice: 0.65 },
      { description: "Panel / breakers", qty: 1, unit: "lot", unitPrice: 200 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 175 },
    ],
    Plumber: [
      { description: "Labor – rough-in", qty: hrs, unit: "hr", unitPrice: 85 },
      { description: "Labor – trim-out", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 85 },
      { description: "Copper pipe", qty: 50, unit: "ft", unitPrice: 3.50 },
      { description: "PVC fittings", qty: 1, unit: "lot", unitPrice: 120 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 150 },
    ],
    Carpenter: [
      { description: "Labor – framing", qty: hrs, unit: "hr", unitPrice: 75 },
      { description: "Labor – finish work", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 80 },
      { description: "Lumber", qty: 100, unit: "bd ft", unitPrice: 1.20 },
      { description: "Hardware & fasteners", qty: 1, unit: "lot", unitPrice: 80 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 100 },
    ],
    HVAC: [
      { description: "Labor – install", qty: hrs, unit: "hr", unitPrice: 95 },
      { description: "Labor – startup & test", qty: 2, unit: "hr", unitPrice: 95 },
      { description: "Equipment", qty: 1, unit: "ea", unitPrice: 2500 },
      { description: "Refrigerant R-410A", qty: 5, unit: "lb", unitPrice: 45 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 200 },
    ],
    "General Contractor": [
      { description: "Labor – general", qty: hrs, unit: "hr", unitPrice: 70 },
      { description: "Subcontractor allowance", qty: 1, unit: "lot", unitPrice: 1000 },
      { description: "Materials allowance", qty: 1, unit: "lot", unitPrice: payBase },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 200 },
    ],
    Painter: [
      { description: "Labor – prep & masking", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 55 },
      { description: "Labor – paint", qty: hrs, unit: "hr", unitPrice: 55 },
      { description: "Paint", qty: 5, unit: "gal", unitPrice: 45 },
      { description: "Primer", qty: 1, unit: "gal", unitPrice: 35 },
      { description: "Supplies", qty: 1, unit: "lot", unitPrice: 50 },
    ],
    Mason: [
      { description: "Labor", qty: hrs, unit: "hr", unitPrice: 80 },
      { description: "Block / brick", qty: 100, unit: "ea", unitPrice: 2.50 },
      { description: "Mortar mix", qty: 5, unit: "bag", unitPrice: 12 },
      { description: "Sand", qty: 0.5, unit: "ton", unitPrice: 80 },
    ],
    Welder: [
      { description: "Labor", qty: hrs, unit: "hr", unitPrice: 90 },
      { description: "Filler wire / rod", qty: 10, unit: "lb", unitPrice: 8 },
      { description: "Shielding gas", qty: 1, unit: "tank", unitPrice: 60 },
      { description: "Steel material", qty: 1, unit: "lot", unitPrice: payBase },
    ],
    Roofer: [
      { description: "Labor – tear-off", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 65 },
      { description: "Labor – install", qty: hrs, unit: "hr", unitPrice: 65 },
      { description: "Architectural shingles", qty: 20, unit: "sq", unitPrice: 150 },
      { description: "Felt underlayment", qty: 10, unit: "sq", unitPrice: 25 },
      { description: "Flashing & accessories", qty: 1, unit: "lot", unitPrice: 120 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 125 },
    ],
    Landscaper: [
      { description: "Labor", qty: hrs, unit: "hr", unitPrice: 45 },
      { description: "Plants & materials", qty: 1, unit: "lot", unitPrice: 300 },
      { description: "Mulch", qty: 5, unit: "cu yd", unitPrice: 55 },
      { description: "Equipment rental", qty: 1, unit: "day", unitPrice: 150 },
    ],
  };

  return (defaults[trade ?? ""] ?? [
    { description: "Labor", qty: hrs, unit: "hr", unitPrice: 65 },
    { description: "Materials", qty: 1, unit: "lot", unitPrice: payBase },
  ]);
}

function readTradForBid(): string | null {
  try { return JSON.parse(localStorage.getItem("rivt.profile.v1") ?? "null")?.primaryTrade ?? null; }
  catch { return null; }
}

interface BidLineItem {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

interface SavedBid {
  id: string;
  name: string;
  jobRef: string;
  markupPct: number;
  notes: string;
  lines: BidLineItem[];
  savedAt: string;
}

const bidStorageKey = "rivt.bids.v1";

function readSavedBids(): SavedBid[] {
  try {
    const stored = localStorage.getItem(bidStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedBid[];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch { return []; }
}

function BidBuilderTool({ activeJob }: { activeJob: Job | null }) {
  const [lines, setLines] = useState<BidLineItem[]>(() =>
    getDefaultBidLines(readTradForBid(), activeJob?.durationHours, activeJob?.pay).map(l => ({ ...l, id: crypto.randomUUID() }))
  );
  const [markupPct, setMarkupPct] = useState(15);
  const [bidName, setBidName] = useState(activeJob ? `${activeJob.title} bid` : "New bid");
  const [jobRef, setJobRef] = useState(activeJob?.title ?? "");
  const [notes, setNotes] = useState("");
  const [savedBids, setSavedBids] = useState<SavedBid[]>(readSavedBids);
  const [notice, setNotice] = useState("");

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const markup = subtotal * (markupPct / 100);
  const total = subtotal + markup;

  function addLine() {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), description: "", qty: 1, unit: "ea", unitPrice: 0 }]);
  }

  function updateLine(id: string, field: keyof BidLineItem, value: string | number) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);
  }

  function saveBid() {
    const bid: SavedBid = {
      id: crypto.randomUUID(),
      name: bidName.trim() || "Bid",
      jobRef: jobRef.trim(),
      markupPct,
      notes: notes.trim(),
      lines: lines.map((l) => ({ ...l, id: crypto.randomUUID() })),
      savedAt: new Date().toISOString(),
    };
    const next = [bid, ...savedBids.filter((b) => b.name.toLowerCase() !== bid.name.toLowerCase())].slice(0, 10);
    setSavedBids(next);
    try { localStorage.setItem(bidStorageKey, JSON.stringify(next)); } catch {}
    setNotice("Bid saved to this device.");
    setTimeout(() => setNotice(""), 3000);
  }

  function loadBid(bid: SavedBid) {
    setBidName(bid.name);
    setJobRef(bid.jobRef);
    setMarkupPct(bid.markupPct);
    setNotes(bid.notes);
    setLines(bid.lines.length ? bid.lines.map((l) => ({ ...l, id: crypto.randomUUID() })) : [{ id: crypto.randomUUID(), description: "", qty: 1, unit: "ea", unitPrice: 0 }]);
    setNotice(`Loaded "${bid.name}".`);
    setTimeout(() => setNotice(""), 3000);
  }

  function deleteBid(id: string) {
    const next = savedBids.filter((b) => b.id !== id);
    setSavedBids(next);
    try { localStorage.setItem(bidStorageKey, JSON.stringify(next)); } catch {}
  }

  return (
    <div className="v2-tool-workbench v2-bid-workbench">
      <Panel className="v2-tool-panel v2-bid-builder-panel" eyebrow="Bid / quote" title="Build a bid">
        {savedBids.length ? (
          <div className="v2-bid-saved-list">
            {savedBids.map((bid) => (
              <article key={bid.id} className="v2-bid-saved-item">
                <span>
                  <strong>{bid.name}</strong>
                  <small>{bid.jobRef || "No job ref"} · {new Date(bid.savedAt).toLocaleDateString()}</small>
                </span>
                <button type="button" onClick={() => loadBid(bid)}>Load</button>
                <button type="button" aria-label={`Delete ${bid.name}`} onClick={() => deleteBid(bid.id)}><Trash2 size={14} /></button>
              </article>
            ))}
          </div>
        ) : null}
        {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
        <div className="v2-tool-input-grid two">
          <label>Bid name<input value={bidName} onChange={(e) => setBidName(e.target.value)} placeholder="Roof replacement bid" /></label>
          <label>Job / client ref<input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Smith Residence, Job #42…" /></label>
        </div>
        <div className="v2-bid-line-table">
          <div className="v2-bid-line-header">
            <span>Description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Total</span><span />
          </div>
          {lines.map((line) => (
            <div key={line.id} className="v2-bid-line">
              <input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} placeholder="Item" aria-label="Description" />
              <input type="number" min="0" step="0.5" value={line.qty} onChange={(e) => updateLine(line.id, "qty", Number(e.target.value) || 0)} aria-label="Quantity" />
              <input value={line.unit} onChange={(e) => updateLine(line.id, "unit", e.target.value)} placeholder="hr" aria-label="Unit" />
              <input type="number" min="0" value={line.unitPrice} onChange={(e) => updateLine(line.id, "unitPrice", Number(e.target.value) || 0)} aria-label="Unit price" />
              <strong>{currency(line.qty * line.unitPrice)}</strong>
              <button type="button" aria-label="Remove line" onClick={() => removeLine(line.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="v2-bid-add-line" onClick={addLine}><Plus size={14} />Add line</button>
        </div>
        <div className="v2-bid-markup">
          <label>
            <span>Markup / overhead: {markupPct}%</span>
            <input type="range" min="0" max="50" step="1" value={markupPct} onChange={(e) => setMarkupPct(Number(e.target.value))} />
          </label>
        </div>
        <label>Notes for client<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Payment terms, exclusions, validity period…" /></label>
        <button type="button" className="v2-primary-button" onClick={saveBid}><FileText size={14} />Save bid to device</button>
      </Panel>

      <aside className="v2-bid-summary-stack">
        <Panel className="v2-tool-panel v2-tool-summary-panel" eyebrow="Bid total" title={currency(total)}>
          <div className="v2-tool-breakdown">
            <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
            <div><span>Markup ({markupPct}%)</span><strong>{currency(markup)}</strong></div>
            <div><span>Total</span><strong>{currency(total)}</strong></div>
          </div>
          <div className="v2-bid-line-summary-list">
            {lines.map((l) => l.qty * l.unitPrice > 0 ? (
              <div key={l.id} className="v2-bid-line-summary">
                <span>{l.description || "Line"} ({l.qty} {l.unit})</span>
                <strong>{currency(l.qty * l.unitPrice)}</strong>
              </div>
            ) : null)}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

function TimeTrackerTool({ activeJob, jobs }: { activeJob: Job | null; jobs: Job[] }) {
  const { isPro } = usePro();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [sessions, setSessions] = useState<TimeSession[]>(readTimeSessions);
  const [running, setRunning] = useState<TimeSession | null>(
    () => readTimeSessions().find((s) => !s.endedAt) ?? null,
  );
  const [elapsed, setElapsed] = useState(0);
  const [jobId, setJobId] = useState<number | null>(activeJob?.id ?? null);
  const [clockNotes, setClockNotes] = useState("");

  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const start = new Date(running.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  function clockIn() {
    if (running) return;
    const job = jobs.find((j) => j.id === jobId) ?? null;
    const session: TimeSession = {
      id: crypto.randomUUID(),
      jobId: job?.id ?? null,
      jobTitle: job?.title ?? "Standalone",
      startedAt: new Date().toISOString(),
      endedAt: null,
      notes: "",
    };
    const next = [session, ...sessions];
    setSessions(next);
    setRunning(session);
    persistTimeSessions(next);
  }

  function clockOut() {
    if (!running) return;
    const ended: TimeSession = { ...running, endedAt: new Date().toISOString(), notes: clockNotes.trim() };
    const next = sessions.map((s) => s.id === running.id ? ended : s);
    setSessions(next);
    setRunning(null);
    setClockNotes("");
    persistTimeSessions(next);
  }

  function deleteSession(sessionId: string) {
    const next = sessions.filter((s) => s.id !== sessionId);
    setSessions(next);
    if (running?.id === sessionId) setRunning(null);
    persistTimeSessions(next);
  }

  function hoursFor(s: TimeSession): number {
    const end = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
    return (end - new Date(s.startedAt).getTime()) / 3600000;
  }

  const cutoffDate = isPro ? null : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const visibleSessions = cutoffDate ? sessions.filter(s => s.startedAt >= cutoffDate) : sessions;
  const completed = visibleSessions.filter((s) => s.endedAt);
  const totalHours = completed.reduce((sum, s) => sum + hoursFor(s), 0);

  const last7Days = getLast7Days();
  const today = new Date().toISOString().slice(0, 10);
  const hoursPerDay: Record<string, number> = {};
  for (const day of last7Days) {
    hoursPerDay[day] = completed
      .filter((s) => s.startedAt.slice(0, 10) === day)
      .reduce((sum, s) => sum + hoursFor(s), 0);
  }
  const maxH = Math.max(...Object.values(hoursPerDay), 1);

  return (
    <div className="v2-tool-workbench">
      <Panel className="v2-tool-panel" eyebrow="Time tracker" title="Clock in / clock out">
        <div className="v2-tool-input-grid">
          <label className="is-wide">Job
            <select value={jobId ?? ""} onChange={(e) => setJobId(Number(e.target.value) || null)} disabled={!!running}>
              <option value="">Standalone / no job</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </label>
        </div>
        <div className="v2-time-clock">
          {running ? (
            <>
              <span className="v2-time-clock-label">Clocked in · {running.jobTitle}</span>
              <strong className="v2-time-clock-display">{formatHms(elapsed)}</strong>
              <label>Notes<textarea value={clockNotes} onChange={(e) => setClockNotes(e.target.value)} rows={2} placeholder="What are you working on?" /></label>
              <button type="button" className="v2-destructive-button" onClick={clockOut}>Clock out</button>
            </>
          ) : (
            <>
              <span className="v2-time-clock-label">Ready to clock in</span>
              <strong className="v2-time-clock-display">00:00:00</strong>
              <button type="button" className="v2-primary-button" onClick={clockIn}>Clock in</button>
            </>
          )}
        </div>
      </Panel>
      <Panel className="v2-tool-panel" eyebrow={`${completed.length} sessions`} title={`${formatNumber(totalHours, 1)} total hours`}>
        <div className="v2-tt-weekly-chart">
          <header><span>This week</span></header>
          <svg viewBox="0 0 280 90" aria-hidden="true">
            {last7Days.map((day, i) => {
              const h = hoursPerDay[day] ?? 0;
              const barH = Math.max(2, (h / maxH) * 60);
              const x = 20 + i * 38;
              const isToday = day === today;
              return (
                <g key={day}>
                  <rect x={x} y={88 - barH} width={26} height={barH}
                    fill={isToday ? "var(--v2-accent)" : "var(--v2-surface-muted)"}
                    stroke="var(--v2-border)" strokeWidth="1" rx="3" />
                  <text x={x + 13} y={85} textAnchor="middle" fontSize="9" fill="var(--v2-text-muted)">
                    {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"][i]}
                  </text>
                  {h > 0 && <text x={x + 13} y={83 - barH} textAnchor="middle" fontSize="8" fill="var(--v2-text-muted)">{h.toFixed(1)}</text>}
                </g>
              );
            })}
          </svg>
        </div>
        {!isPro && sessions.length > visibleSessions.length && (
          <p className="v2-tool-note" style={{fontSize: 12}}>
            Showing 90-day history. <button type="button" style={{background:'none',border:'none',color:'var(--v2-accent)',cursor:'pointer',padding:0,fontSize:12,textDecoration:'underline'}} onClick={() => setUpgradeOpen(true)}>Upgrade for full history</button>
          </p>
        )}
        {completed.length ? (
          <div className="v2-time-session-list">
            {completed.slice(0, 15).map((s) => (
              <article key={s.id} className="v2-time-session">
                <div>
                  <strong>{s.jobTitle}</strong>
                  <small>{new Date(s.startedAt).toLocaleDateString()} · {formatNumber(hoursFor(s), 1)}h</small>
                  {s.notes ? <span>{s.notes}</span> : null}
                </div>
                <button type="button" aria-label="Delete session" onClick={() => deleteSession(s.id)}><Trash2 size={13} /></button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState className="v2-tools-empty" icon={<Clock size={20} />} title="No sessions yet" description="Clock in to start tracking time against a job." compact />
        )}
      </Panel>
      {upgradeOpen && <UpgradeModal reason="Full time history" onClose={() => setUpgradeOpen(false)} />}
    </div>
  );
}

// ── Expense Logger ────────────────────────────────────────────────────────────

const expenseLogKey = "rivt.expenses.v1";

type ExpenseCategory = "Materials" | "Tools" | "Mileage" | "Subcontractor" | "Permit" | "Other";
const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Materials", "Tools", "Mileage", "Subcontractor", "Permit", "Other"];

interface ExpenseEntry {
  id: string;
  jobId: number | null;
  jobTitle: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
}

function readExpenses(): ExpenseEntry[] {
  try {
    const stored = localStorage.getItem(expenseLogKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ExpenseEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 200) : [];
  } catch { return []; }
}

function persistExpenses(entries: ExpenseEntry[]) {
  try { localStorage.setItem(expenseLogKey, JSON.stringify(entries.slice(0, 200))); } catch {}
}

function exportExpensesCSV(expenses: ExpenseEntry[]) {
  const header = "Date,Category,Amount,Description";
  const rows = expenses.map((e) =>
    [e.date, e.category, e.amount, (e.description ?? "").replace(/,/g, ";")].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rivt-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExpenseLoggerTool({ activeJob, jobs }: { activeJob: Job | null; jobs: Job[] }) {
  const { isPro } = usePro();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(readExpenses);
  const [jobId, setJobId] = useState<number | null>(activeJob?.id ?? null);
  const [category, setCategory] = useState<ExpenseCategory>("Materials");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notice, setNotice] = useState("");

  function addExpense() {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0 || !description.trim()) return;
    const job = jobs.find((j) => j.id === jobId) ?? null;
    const entry: ExpenseEntry = {
      id: crypto.randomUUID(),
      jobId,
      jobTitle: job?.title ?? "Standalone",
      category,
      amount: amt,
      description: description.trim(),
      date,
    };
    const next = [entry, ...expenses];
    setExpenses(next);
    persistExpenses(next);
    setAmount("");
    setDescription("");
    setNotice("Expense logged.");
    setTimeout(() => setNotice(""), 3000);
  }

  function deleteExpense(expenseId: string) {
    const next = expenses.filter((e) => e.id !== expenseId);
    setExpenses(next);
    persistExpenses(next);
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
  })).filter((c) => c.total > 0);

  return (
    <div className="v2-tool-workbench v2-expense-workbench">
      <Panel className="v2-tool-panel" eyebrow="Log expense" title="Track job costs">
        <div className="v2-tool-input-grid two">
          <label>Job
            <select value={jobId ?? ""} onChange={(e) => setJobId(Number(e.target.value) || null)}>
              <option value="">Standalone / no job</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </label>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Category
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Amount ($)<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
          <label className="is-wide">Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Material, rental, mileage description..." /></label>
        </div>
        {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
        <div className="v2-tool-action-row">
          <button type="button" className="v2-primary-button" disabled={!(parseFloat(amount) > 0) || !description.trim()} onClick={addExpense}><Plus size={15} />Log expense</button>
          <button type="button" disabled={expenses.length === 0} onClick={() => isPro ? exportExpensesCSV(expenses) : setUpgradeOpen(true)}>
            <Download size={15} />Export CSV{!isPro && <Lock size={11} style={{marginLeft: 4}} />}
          </button>
        </div>
      </Panel>
      <aside className="v2-invoice-side-stack">
        {upgradeOpen && <UpgradeModal reason="Export CSV" onClose={() => setUpgradeOpen(false)} />}
        <Panel className="v2-tool-panel v2-tool-summary-panel" eyebrow="Total spent" title={currency(total)}>
          {byCategory.length ? (
            <div className="v2-tool-breakdown">
              {byCategory.map(({ cat, total: catTotal }) => <div key={cat}><span>{cat}</span><strong>{currency(catTotal)}</strong></div>)}
            </div>
          ) : <p className="v2-tool-note">No expenses logged yet.</p>}
        </Panel>
        <Panel className="v2-tool-panel" eyebrow={`${expenses.length} logged`} title="Expenses">
          {expenses.length ? (
            <div className="v2-expense-list">
              {expenses.slice(0, 12).map((e) => (
                <article key={e.id} className="v2-expense-item">
                  <div>
                    <strong>{e.description}</strong>
                    <small>{e.category} · {e.jobTitle} · {e.date}</small>
                  </div>
                  <div className="v2-expense-item-right">
                    <strong>{currency(e.amount)}</strong>
                    <button type="button" aria-label="Delete" onClick={() => deleteExpense(e.id)}><Trash2 size={13} /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState className="v2-tools-empty" icon={<ReceiptText size={20} />} title="No expenses yet" description="Log materials, tool rentals, mileage, and other job costs." compact />}
        </Panel>
      </aside>
    </div>
  );
}

// ── Earnings Dashboard ────────────────────────────────────────────────────────

function EarningsDashboardTool({ jobs, paymentRecords }: { jobs: Job[]; paymentRecords: PaymentRecord[] }) {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");

  const now = new Date();
  const cutoff = period === "week"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    : period === "month"
    ? new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    : null;

  const allPaid = paymentRecords.filter((r) => r.status === "Paid / Closed");
  const periodPaid = cutoff ? allPaid.filter((r) => new Date(r.date) >= cutoff) : allPaid;
  const totalEarned = periodPaid.reduce((sum, r) => sum + r.amount, 0);
  const avgJobSize = periodPaid.length ? totalEarned / periodPaid.length : 0;
  const pending = paymentRecords.filter((r) => r.status === "Payment pending");

  const tradeTotals: Record<string, number> = {};
  for (const r of periodPaid) {
    const job = jobs.find((j) => j.id === r.jobId);
    if (job) tradeTotals[job.trade] = (tradeTotals[job.trade] ?? 0) + r.amount;
  }
  const topTrade = Object.entries(tradeTotals).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";

  return (
    <div className="v2-tool-workbench v2-earnings-workbench">
      <Panel className="v2-tool-panel" eyebrow="Earnings" title="Income summary">
        <div className="v2-earnings-period-tabs" role="group" aria-label="Period">
          {(["week", "month", "all"] as const).map((p) => (
            <button key={p} type="button" className={period === p ? "is-active" : ""} onClick={() => setPeriod(p)}>
              {p === "week" ? "Last 7 days" : p === "month" ? "Last 30 days" : "All time"}
            </button>
          ))}
        </div>
        <div className="v2-tool-result-grid">
          <article><span>Total earned</span><strong>{currency(totalEarned)}</strong></article>
          <article><span>Jobs completed</span><strong>{periodPaid.length}</strong></article>
          <article><span>Avg job size</span><strong>{currency(avgJobSize)}</strong></article>
          <article><span>Top trade</span><strong>{topTrade}</strong></article>
        </div>
        {pending.length ? (
          <div className="v2-earnings-pending-bar">
            <strong>{pending.length} pending</strong>
            <span>{currency(pending.reduce((sum, r) => sum + r.amount, 0))} awaiting close-out</span>
          </div>
        ) : null}
      </Panel>
      <Panel className="v2-tool-panel" eyebrow={`${periodPaid.length} completed`} title="Payment history">
        {periodPaid.length ? (
          <div className="v2-earnings-list">
            {periodPaid.slice(0, 15).map((r) => (
              <article key={r.id} className="v2-earnings-item">
                <div>
                  <strong>{r.jobTitle}</strong>
                  <small>{r.date} · {r.worker} · {r.method}</small>
                </div>
                <strong>{currency(r.amount)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState className="v2-tools-empty" icon={<TrendingUp size={20} />} title="No completed payments in this period" description="Closed-out payment records will appear here." compact />
        )}
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
        setActiveWork(Array.isArray(items) ? items : []);
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
        description: "Build an invoice draft. Copy, download, or send it from your own email or text.",
        node: <InvoiceDraftTool activeJob={activeJob} />,
      },
      "daily-log": {
        eyebrow: "Daily log",
        title: "Daily log",
        description: "Capture crew hours, site notes, blockers, safety, and next steps before the details disappear.",
        node: <DailyLogTool activeJob={activeJob} activeWork={activeWork} />,
      },
      materials: {
        eyebrow: "Materials app",
        title: "Material takeoff",
        description: "Estimate area, waste, material cost, and rough sheet count.",
        node: <MaterialsTool activeJob={activeJob} />,
      },
      "job-photos": {
        eyebrow: "Site documentation",
        title: "Job Photos",
        description: "Capture, organize, and compare job-site photos tied to your active project record.",
        node: <JobPhotosTool activeWork={activeWork} />,
      },
      "time-tracker": {
        eyebrow: "Time tracker",
        title: "Time tracker",
        description: "Clock in and out per job. Track hours across all active and recent work.",
        node: <TimeTrackerTool activeJob={activeJob} jobs={jobs} />,
      },
      "expense-logger": {
        eyebrow: "Expense logger",
        title: "Expense logger",
        description: "Log materials, tool rentals, mileage, and subcontractor costs by job.",
        node: <ExpenseLoggerTool activeJob={activeJob} jobs={jobs} />,
      },
      earnings: {
        eyebrow: "Earnings",
        title: "Earnings dashboard",
        description: "Weekly and monthly income summary: total earned, jobs completed, top trade, average job size.",
        node: <EarningsDashboardTool jobs={jobs} paymentRecords={paymentRecords} />,
      },
      "bid-builder": {
        eyebrow: "Bid / quote",
        title: "Bid builder",
        description: "Line-item bids with labor, materials, overhead markup, client notes, and save-to-device.",
        node: <BidBuilderTool activeJob={activeJob} />,
      },
      mileage: {
        eyebrow: "Mileage log",
        title: "Mileage logger",
        description: "Log job site trips and calculate your IRS 2025 standard mileage deduction ($0.70/mile).",
        node: <MileageLoggerTool activeJob={activeJob} />,
      },
      "price-book": {
        eyebrow: "Price book",
        title: "Material price book",
        description: "Save common material prices for quick lookup when building estimates and bids.",
        node: <PriceBookTool />,
      },
      "safety-checklist": {
        eyebrow: "Safety",
        title: "Field safety checklist",
        description: "Pre-built daily site check across PPE, fall protection, electrical, tools, and emergency readiness.",
        node: <SafetyChecklistTool activeJob={activeJob} />,
      },
      "tax-estimator": {
        eyebrow: "Tax planning",
        title: "Tax estimator",
        description: "Estimate quarterly self-employment tax payments based on your projected annual income.",
        node: <TaxEstimatorTool />,
      },
      "punch-list": {
        eyebrow: "Closeout",
        title: "Punch list",
        description: "Track deficiencies and outstanding items for final walkthrough and sign-off.",
        node: <PunchListTool />,
      },
    }[activeTool];

    if (!toolMeta) return null;

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
        description="Estimate, invoice, daily log, and material takeoff tools."
        actions={<button type="button" className="v2-primary-button" onClick={() => activeJob ? onOpenJob(activeJob.id) : onNavigate("work")}>
          <Wrench size={16} />
          {activeJob ? "Use active job" : "Open work"}
        </button>}
      />

      <section className="v2-tools-command">
        <div>
          <span>Tool apps</span>
          <h2>{activeJob ? `Loaded from ${activeJob.title}` : "Open tools without needing a job first"}</h2>
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
          icon={Clipboard}
          title="Daily log"
          badge="Daily log"
          summary="Crew hours, site notes, blockers, safety, and next steps."
          output="Today"
          detail="Device draft"
          action="Open"
          onAction={() => setActiveTool("daily-log")}
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
          icon={Camera}
          title="Job Photos"
          badge="Site docs"
          summary="Capture, organize, and compare job-site photos by project."
          output="Cloud storage"
          detail="Per project"
          action="Open"
          onAction={() => setActiveTool("job-photos")}
        />
        <ToolCard
          icon={Clock}
          title="Time tracker"
          badge="Time"
          summary="Clock in and out per job. Tracks hours and auto-fills invoice labor line."
          output="Hours"
          detail="Per job"
          action="Open"
          onAction={() => setActiveTool("time-tracker")}
        />
        <ToolCard
          icon={ReceiptText}
          title="Expense logger"
          badge="Costs"
          summary="Log materials, tool rentals, mileage, and subcontractor costs."
          output="Totals"
          detail="By category"
          action="Open"
          onAction={() => setActiveTool("expense-logger")}
        />
        <ToolCard
          icon={TrendingUp}
          title="Earnings"
          badge="Income"
          summary="Weekly and monthly income summary, top trade, and avg job size."
          output="By period"
          detail="Payment history"
          action="Open"
          onAction={() => setActiveTool("earnings")}
        />
        <ToolCard
          icon={ClipboardList}
          title="Bid builder"
          badge="Bid / quote"
          summary="Line-item bids with labor, materials, markup, and client notes."
          output="Total w/ markup"
          detail="Save to device"
          action="Open"
          onAction={() => setActiveTool("bid-builder")}
        />
        <ToolCard
          icon={Car}
          title="Mileage logger"
          badge="Mileage"
          summary="Log job site trips and calculate your IRS 2025 deduction at $0.70/mile."
          output="$/mi deduction"
          detail="Year-to-date"
          action="Open"
          onAction={() => setActiveTool("mileage")}
        />
        <ToolCard
          icon={Package2}
          title="Price book"
          badge="Materials"
          summary="Save and search common material prices for estimates and bids."
          output="Prices"
          detail="Copy to clipboard"
          action="Open"
          onAction={() => setActiveTool("price-book")}
        />
        <ToolCard
          icon={Shield}
          title="Safety checklist"
          badge="Safety"
          summary="Daily site check across PPE, fall, electrical, tools, and emergency readiness."
          output="Sign-off log"
          detail="Trade checklists"
          action="Open"
          onAction={() => setActiveTool("safety-checklist")}
        />
        <ToolCard
          icon={TrendingDown}
          title="Tax estimator"
          badge="Finance"
          summary="Estimate quarterly self-employment taxes based on projected annual income."
          output="Quarterly"
          detail="SE + federal"
          action="Open"
          onAction={() => setActiveTool("tax-estimator")}
        />
        <ToolCard
          icon={ClipboardList}
          title="Punch list"
          badge="Closeout"
          summary="Track deficiencies and outstanding items for final walkthrough and sign-off."
          output="By job"
          detail="Status tracking"
          action="Open"
          onAction={() => setActiveTool("punch-list")}
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

      <div className="v2-share-report-row">
        <ShareReportButton jobTitle={activeJob?.title ?? "Current job"} />
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
