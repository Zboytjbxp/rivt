import { ChevronLeft, ChevronRight, Copy, FileText, Mail, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Panel } from "../../components/ui";
import { requestKey } from "../../lib/api";
import type { Job } from "../../types";
import { readPrimaryHourlyRate } from "../../lib/rateCard";
import { getEstimatePriceSignal } from "./priceGuidance";
import { centsToDollars, currency, formatQuantity, toCents } from "./money";
import { fetchToolRecords, sendEstimateByLocalId, upsertToolRecord, type ServerToolRecord } from "./tool-records-api";
import { toolContextLabel, toolContextRecordFields, toolContextStorageId, type ToolWorkContext } from "./tool-work-context";

function formatNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export interface EstimateInvoiceDraftLine {
  description: string;
  qty: number;
  rate: number;
  kind?: "labor" | "material" | "other" | "adjustment";
}

export interface EstimateInvoiceDraft {
  invoiceNumber: string;
  templateName: string;
  billTo: string;
  terms: string;
  paymentMethod: string;
  lines: EstimateInvoiceDraftLine[];
  sourceNote: string;
}

interface EstimatePrefs {
  hourlyRate: number;
  crewSize: number;
  overheadPct: number;
  marginPct: number;
  contingencyPct: number;
}

const estimatePrefsStorageKey = "rivt.estimatePrefs.v1";

interface EstimateDraftState {
  laborHours: number;
  hourlyRate: number;
  crewSize: number;
  materials: number;
  subCosts: number;
  overheadPct: number;
  marginPct: number;
  contingencyPct: number;
  estimateNumber: string;
  recipientName: string;
  recipientEmail: string;
  scope: string;
  validThrough: string;
  customerNote: string;
}

interface EstimateDelivery {
  status: "sent" | "failed";
  recipientEmail: string;
  attemptedAt: string;
  sentAt?: string;
  attemptCount: number;
}

function estimateDraftStorageKey(context: ToolWorkContext) {
  return `rivt.estimateDraft.v2:${toolContextStorageId(context)}`;
}

function readEstimateDraft(context: ToolWorkContext): Partial<EstimateDraftState> {
  try {
    const parsed = JSON.parse(localStorage.getItem(estimateDraftStorageKey(context)) || "{}") as Partial<EstimateDraftState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function clampEstimateNumber(value: unknown, fallback: number, min = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, parsed) : fallback;
}

function futureDate(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function deliveryFromRecord(record: ServerToolRecord | null): EstimateDelivery | null {
  const delivery = record?.payload?.delivery;
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) return null;
  const candidate = delivery as Partial<EstimateDelivery>;
  if (candidate.status !== "sent" && candidate.status !== "failed") return null;
  if (typeof candidate.recipientEmail !== "string" || typeof candidate.attemptedAt !== "string") return null;
  return {
    status: candidate.status,
    recipientEmail: candidate.recipientEmail,
    attemptedAt: candidate.attemptedAt,
    sentAt: typeof candidate.sentAt === "string" ? candidate.sentAt : undefined,
    attemptCount: typeof candidate.attemptCount === "number" && Number.isInteger(candidate.attemptCount) ? candidate.attemptCount : 1,
  };
}

function readEstimatePrefs(): EstimatePrefs {
  const fallback: EstimatePrefs = {
    hourlyRate: readPrimaryHourlyRate(65),
    crewSize: 1,
    overheadPct: 12,
    marginPct: 18,
    contingencyPct: 7,
  };
  try {
    const stored = localStorage.getItem(estimatePrefsStorageKey);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<EstimatePrefs>;
    return {
      hourlyRate: clampEstimateNumber(parsed.hourlyRate, fallback.hourlyRate),
      crewSize: clampEstimateNumber(parsed.crewSize, fallback.crewSize, 1),
      overheadPct: clampEstimateNumber(parsed.overheadPct, fallback.overheadPct),
      marginPct: clampEstimateNumber(parsed.marginPct, fallback.marginPct),
      contingencyPct: clampEstimateNumber(parsed.contingencyPct, fallback.contingencyPct),
    };
  } catch {
    return fallback;
  }
}

export function EstimateTool({
  activeJob,
  workContext,
  onConvertToInvoice,
}: {
  activeJob: Job | null;
  workContext: ToolWorkContext;
  onConvertToInvoice?: (draft: EstimateInvoiceDraft) => void;
}) {
  const [estimatePrefs] = useState(readEstimatePrefs);
  const [initialDraft] = useState(() => readEstimateDraft(workContext));
  const [laborHours, setLaborHours] = useState(initialDraft.laborHours ?? activeJob?.durationHours ?? 8);
  const [hourlyRate, setHourlyRate] = useState(initialDraft.hourlyRate ?? estimatePrefs.hourlyRate);
  const [crewSize, setCrewSize] = useState(initialDraft.crewSize ?? estimatePrefs.crewSize);
  const [materials, setMaterials] = useState(initialDraft.materials ?? (activeJob ? Math.round(activeJob.pay * 0.22) : 250));
  const [subCosts, setSubCosts] = useState(initialDraft.subCosts ?? 0);
  const [overheadPct, setOverheadPct] = useState(initialDraft.overheadPct ?? estimatePrefs.overheadPct);
  const [marginPct, setMarginPct] = useState(initialDraft.marginPct ?? estimatePrefs.marginPct);
  const [contingencyPct, setContingencyPct] = useState(initialDraft.contingencyPct ?? estimatePrefs.contingencyPct);
  const [estimateNumber] = useState(initialDraft.estimateNumber ?? `EST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
  const [recipientName, setRecipientName] = useState(initialDraft.recipientName ?? (workContext.kind === "standalone" ? workContext.project.clientName : activeJob?.contractor ?? ""));
  const [recipientEmail, setRecipientEmail] = useState(initialDraft.recipientEmail ?? "");
  const [scope, setScope] = useState(initialDraft.scope ?? activeJob?.title ?? (workContext.kind === "standalone" ? workContext.project.title : ""));
  const [validThrough, setValidThrough] = useState(initialDraft.validThrough ?? futureDate(30));
  const [customerNote, setCustomerNote] = useState(initialDraft.customerNote ?? "");
  const [saveMessage, setSaveMessage] = useState("Autosaved on this device.");
  const [delivery, setDelivery] = useState<EstimateDelivery | null>(null);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<"price" | "customer" | "review">("price");
  const sendIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(estimatePrefsStorageKey, JSON.stringify({
        hourlyRate,
        crewSize,
        overheadPct,
        marginPct,
        contingencyPct,
      }));
    } catch {
      // Estimate preferences are optional; defaults still work when storage is unavailable.
    }
  }, [contingencyPct, crewSize, hourlyRate, marginPct, overheadPct]);

  useEffect(() => {
    const draft: EstimateDraftState = {
      laborHours, hourlyRate, crewSize, materials, subCosts, overheadPct, marginPct, contingencyPct,
      estimateNumber, recipientName, recipientEmail, scope, validThrough, customerNote,
    };
    try {
      localStorage.setItem(estimateDraftStorageKey(workContext), JSON.stringify(draft));
    } catch {
      // The in-memory draft remains usable when device storage is unavailable.
    }
  }, [contingencyPct, crewSize, customerNote, estimateNumber, hourlyRate, laborHours, marginPct, materials, overheadPct, recipientEmail, recipientName, scope, subCosts, validThrough, workContext]);

  useEffect(() => {
    let active = true;
    void fetchToolRecords("estimate").then((records) => {
      const record = records?.find((candidate) => candidate.localId === `estimate:${toolContextStorageId(workContext)}`) ?? null;
      if (active) setDelivery(deliveryFromRecord(record));
    });
    return () => { active = false; };
  }, [workContext]);

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
  const priceSignal = getEstimatePriceSignal({
    title: activeJob?.title,
    trade: activeJob?.trade ?? null,
    target,
    hourlyRate,
    laborHours,
  });

  const customerLines = (() => {
    const baseLines = [
      { description: "Labor", quantity: Math.max(0.5, laborHours), baseTotal: Math.max(0, labor) },
      { description: "Materials and handling", quantity: 1, baseTotal: Math.max(0, materials) },
      { description: "Specialty costs", quantity: 1, baseTotal: Math.max(0, subCosts) },
    ].filter((line) => line.baseTotal > 0);
    const allocationLines = baseLines.length ? baseLines : [{ description: scope.trim() || "Estimate scope", quantity: 1, baseTotal: target }];
    const baseTotal = allocationLines.reduce((sum, line) => sum + line.baseTotal, 0);
    const targetCents = Math.max(0, toCents(target));
    let allocatedCents = 0;
    return allocationLines.map((line, index) => {
      const totalCents = index === allocationLines.length - 1
        ? targetCents - allocatedCents
        : Math.round(targetCents * (line.baseTotal / Math.max(1, baseTotal)));
      allocatedCents += totalCents;
      return { description: line.description, quantity: line.quantity, totalCents };
    });
  })();

  useEffect(() => {
    sendIdempotencyKeyRef.current = null;
  }, [customerNote, recipientEmail, recipientName, scope, validThrough, target]);

  async function copySummary() {
    const summary = [
      `RIVT estimate - ${toolContextLabel(workContext)}`,
      `Target range: ${currency(low)} - ${currency(high)}`,
      `Target price: ${currency(target)}`,
      `Labor: ${formatQuantity(laborHours)} hrs at ${currency(hourlyRate)}/hr`,
      `Materials: ${currency(materials)}`,
      `Sub costs: ${currency(subCosts)}`,
      `Timeline: ${formatNumber(days, 1)} working days with ${crewSize} person${crewSize === 1 ? "" : "s"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setSaveMessage("Estimate copied.");
    } catch {
      setSaveMessage("Copy failed. Select the estimate text and try again.");
    }
  }

  async function saveDraft(showSuccess = true) {
    const draft: EstimateDraftState = {
      laborHours, hourlyRate, crewSize, materials, subCosts, overheadPct, marginPct, contingencyPct,
      estimateNumber, recipientName, recipientEmail, scope, validThrough, customerNote,
    };
    const record = await upsertToolRecord({
      recordType: "estimate",
      localId: `estimate:${toolContextStorageId(workContext)}`,
      title: (scope.trim() || `${toolContextLabel(workContext)} estimate`).slice(0, 160),
      status: delivery?.status === "sent" ? "sent" : "draft",
      recordDate: new Date().toISOString().slice(0, 10),
      amountCents: toCents(target),
      payload: { ...draft, target, low, high, customerLines, delivery: delivery ?? undefined },
      ...toolContextRecordFields(workContext),
    });
    if (record) {
      setDelivery(deliveryFromRecord(record));
      if (showSuccess) setSaveMessage("Draft saved to your RIVT account.");
    } else if (showSuccess) {
      setSaveMessage("Saved on this device only. Account sync failed.");
    }
    return record;
  }

  async function sendEstimateEmail() {
    if (!recipientEmail.trim()) {
      setSaveMessage("Add the customer email before sending.");
      return;
    }
    if (target <= 0) {
      setSaveMessage("Add a price before sending.");
      return;
    }
    setSending(true);
    const saved = await saveDraft(false);
    if (!saved) {
      setSaveMessage("RIVT could not save this estimate. Check your connection and try again.");
      setSending(false);
      return;
    }
    try {
      const idempotencyKey = sendIdempotencyKeyRef.current ?? requestKey();
      sendIdempotencyKeyRef.current = idempotencyKey;
      const sent = await sendEstimateByLocalId(saved.localId, idempotencyKey);
      const sentDelivery = deliveryFromRecord(sent);
      setDelivery(sentDelivery);
      sendIdempotencyKeyRef.current = null;
      setSaveMessage(sentDelivery?.sentAt ? `Sent to ${sentDelivery.recipientEmail}.` : "Estimate sent.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "RIVT could not send the estimate.");
    } finally {
      setSending(false);
    }
  }

  function convertToInvoice() {
    const title = activeJob?.title?.trim() || (workContext.kind === "standalone" ? workContext.project.title : "Estimate");
    const targetCents = Math.max(0, toCents(target));
    const baseLines = [
      {
        description: `${title} labor`,
        qty: Math.max(0.5, laborHours),
        baseTotal: Math.max(0, labor),
        kind: "labor" as const,
      },
      {
        description: `${title} materials and handling`,
        qty: 1,
        baseTotal: Math.max(0, materials),
        kind: "material" as const,
      },
      {
        description: `${title} specialty costs`,
        qty: 1,
        baseTotal: Math.max(0, subCosts),
        kind: "other" as const,
      },
    ].filter((line) => line.baseTotal > 0);

    const allocationLines = baseLines.length
      ? baseLines
      : [{ description: `${title} scope`, qty: 1, baseTotal: target, kind: "other" as const }];

    const baseTotal = allocationLines.reduce((sum, line) => sum + line.baseTotal, 0);
    let allocatedCents = 0;
    const draftLines: EstimateInvoiceDraftLine[] = allocationLines.map((line, index) => {
      const isLast = index === allocationLines.length - 1;
      const lineCents = isLast
        ? targetCents - allocatedCents
        : Math.round(targetCents * (line.baseTotal / Math.max(1, baseTotal)));
      allocatedCents += lineCents;
      return {
        description: line.description,
        qty: line.qty,
        rate: centsToDollars(lineCents) / Math.max(0.5, line.qty),
        kind: line.kind,
      };
    });

    onConvertToInvoice?.({
      invoiceNumber: `RIVT-${Date.now().toString(36).toUpperCase()}`,
      templateName: `${title} invoice`,
      billTo: activeJob?.contractor ?? (workContext.kind === "standalone" ? workContext.project.clientName : ""),
      terms: "Due on completion",
      paymentMethod: "Direct payment",
      lines: draftLines,
      sourceNote: `Converted from estimate total ${currency(target)} (${currency(low)} - ${currency(high)}). Overhead, margin, and contingency are included in the line rates. Review scope, tax, and payment terms before sending.`,
    });
  }

  return (
    <div className={`v2-tool-workbench v2-estimate-workbench is-${step}`}>
      <nav className="v2-tool-flow-nav" aria-label="Estimate steps">
        {(["price", "customer", "review"] as const).map((item, index) => (
          <button key={item} type="button" aria-current={step === item ? "step" : undefined} onClick={() => setStep(item)}>
            <span>{index + 1}</span>{item === "price" ? "Price" : item === "customer" ? "Customer" : "Review"}
          </button>
        ))}
      </nav>

      <Panel className="v2-tool-panel v2-estimate-builder-panel" eyebrow={`Step ${step === "price" ? 1 : step === "customer" ? 2 : 3} of 3`} title={step === "price" ? "Price the work" : step === "customer" ? "Add the customer" : "Review and send"}>
        {step === "price" ? <>
          <section className="v2-estimate-hero" aria-label="Estimate target">
            <span>Recommended target</span>
            <strong>{currency(target)}</strong>
            <small>{currency(low)} - {currency(high)} / {formatNumber(days, 1)} working days</small>
          </section>
          <div className="v2-estimate-quick-stats" aria-label="Estimate quick stats">
            <article><span>Labor</span><strong>{currency(labor)}</strong></article>
            <article><span>Material</span><strong>{currency(materials)}</strong></article>
            <article><span>Cushion</span><strong>{marginShare}%</strong></article>
          </div>
          <div className="v2-tool-input-grid v2-estimate-input-grid">
            <label>Labor hours<input type="number" min="0" step="0.5" value={laborHours} onChange={(event) => setLaborHours(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Hourly rate<input type="number" min="0" value={hourlyRate} onChange={(event) => setHourlyRate(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Crew size<input type="number" min="1" value={crewSize} onChange={(event) => setCrewSize(Math.max(1, Number(event.target.value) || 1))} /></label>
            <label>Materials<input type="number" min="0" value={materials} onChange={(event) => setMaterials(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Sub costs<input type="number" min="0" value={subCosts} onChange={(event) => setSubCosts(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Overhead %<input type="number" min="0" value={overheadPct} onChange={(event) => setOverheadPct(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Margin %<input type="number" min="0" value={marginPct} onChange={(event) => setMarginPct(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Contingency %<input type="number" min="0" value={contingencyPct} onChange={(event) => setContingencyPct(Math.max(0, Number(event.target.value) || 0))} /></label>
          </div>
        </> : null}

        {step === "customer" ? <section className="v2-estimate-delivery" aria-labelledby="estimate-delivery-title">
          <div>
            <span>Customer copy</span>
            <strong id="estimate-delivery-title">{recipientEmail.trim() ? "Customer details ready" : "Who should receive this?"}</strong>
          </div>
          <div className="v2-tool-input-grid v2-estimate-delivery-grid">
            <label>Customer name<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Customer or company" /></label>
            <label>Customer email<input type="email" inputMode="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="name@example.com" /></label>
            <label>Estimate number<input value={estimateNumber} readOnly aria-label="Estimate number" /></label>
            <label>Valid through<input type="date" value={validThrough} onChange={(event) => setValidThrough(event.target.value)} /></label>
            <label className="is-wide">Scope<textarea value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Describe the work covered by this estimate." rows={3} /></label>
            <label className="is-wide">Customer note<textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Optional note, exclusions, or next steps." rows={3} /></label>
          </div>
        </section> : null}

        {step === "review" ? <section className="v2-estimate-delivery" aria-labelledby="estimate-review-title">
          <div>
            <span>Customer copy</span>
            <strong id="estimate-review-title">{recipientEmail.trim() ? `Ready for ${recipientEmail}` : "Add an email before sending"}</strong>
            <small>RIVT emails this estimate. It does not request payment or claim online approval.</small>
          </div>
          <article className="v2-estimate-customer-preview" aria-label="Customer estimate preview">
            <span>Customer receives</span>
            <strong>{scope.trim() || "Estimate scope"}</strong>
            <div>{customerLines.map((line) => <p key={line.description}><span>{line.description}</span><b>{currency(centsToDollars(line.totalCents))}</b></p>)}</div>
            <footer><span>Estimated total</span><strong>{currency(target)}</strong></footer>
          </article>
          <button type="button" className="v2-secondary-button v2-tool-inline-action" onClick={() => void copySummary()}><Copy size={18} />Copy estimate</button>
          {delivery?.status === "sent" ? <p className="v2-estimate-delivery-status is-sent">Sent to {delivery.recipientEmail} {delivery.sentAt ? `on ${new Date(delivery.sentAt).toLocaleString()}` : ""}. Confirm acceptance, then convert it to an invoice when the work is ready.</p> : null}
          {delivery?.status === "failed" ? <p className="v2-estimate-delivery-status is-failed">The last delivery did not complete. Check the recipient email and try again.</p> : null}
        </section> : null}
      </Panel>

      {step === "review" ? <Panel as="aside" className="v2-tool-panel v2-tool-summary-panel" eyebrow="Internal check" title={`${currency(low)} - ${currency(high)}`}>
        <section className={`v2-price-signal is-${priceSignal.tone}`} aria-label="Pricing signal">
          <div>
            <span>Pricing signal</span>
            <strong>{priceSignal.verdict}</strong>
          </div>
          <p>{priceSignal.label}: {priceSignal.rangeLabel}</p>
          <small>{priceSignal.basisLabel}</small>
          <em>{priceSignal.note}</em>
        </section>
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
      </Panel> : null}
      <div className="v2-tool-action-dock" aria-label="Estimate actions">
        <span><strong>{currency(target)}</strong><small>{saveMessage}</small></span>
        {step !== "price" ? <button type="button" onClick={() => setStep(step === "review" ? "customer" : "price")} aria-label="Previous estimate step"><ChevronLeft size={18} /></button> : null}
        <button type="button" onClick={() => void saveDraft()} aria-label="Save estimate" title="Save estimate"><Save size={18} /><span>Save</span></button>
        {step === "price" ? <button type="button" className="v2-primary-button" onClick={() => setStep("customer")}><span>Customer</span><ChevronRight size={18} /></button> : null}
        {step === "customer" ? <button type="button" className="v2-primary-button" onClick={() => setStep("review")}><span>Review</span><ChevronRight size={18} /></button> : null}
        {step === "review" && onConvertToInvoice ? <button type="button" onClick={convertToInvoice} disabled={target <= 0} aria-label="Convert to invoice" title="Convert to invoice"><FileText size={18} /><span>Invoice</span></button> : null}
        {step === "review" ? <button type="button" className="v2-primary-button" onClick={() => void sendEstimateEmail()} disabled={sending || target <= 0 || !recipientEmail.trim()}><Mail size={18} /><span>{sending ? "Sending" : delivery?.status === "sent" ? "Send again" : "Send"}</span></button> : null}
      </div>
    </div>
  );
}
