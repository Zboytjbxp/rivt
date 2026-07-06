import { Copy, FileText } from "lucide-react";
import { useState } from "react";
import { Panel } from "../../components/ui";
import type { Job } from "../../types";
import { getEstimatePriceSignal } from "./priceGuidance";
import { centsToDollars, currency, formatQuantity, toCents } from "./money";

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

export function EstimateTool({
  activeJob,
  onConvertToInvoice,
}: {
  activeJob: Job | null;
  onConvertToInvoice?: (draft: EstimateInvoiceDraft) => void;
}) {
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
  const priceSignal = getEstimatePriceSignal({
    title: activeJob?.title,
    trade: activeJob?.trade ?? null,
    target,
    hourlyRate,
    laborHours,
  });

  async function copySummary() {
    const summary = [
      `RIVT estimate${activeJob ? ` - ${activeJob.title}` : ""}`,
      `Target range: ${currency(low)} - ${currency(high)}`,
      `Target price: ${currency(target)}`,
      `Labor: ${formatQuantity(laborHours)} hrs at ${currency(hourlyRate)}/hr`,
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

  function convertToInvoice() {
    const title = activeJob?.title?.trim() || "Estimate";
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
      billTo: activeJob?.contractor ?? "",
      terms: "Due on completion",
      paymentMethod: "Direct payment",
      lines: draftLines,
      sourceNote: `Converted from estimate total ${currency(target)} (${currency(low)} - ${currency(high)}). Overhead, margin, and contingency are included in the line rates. Review scope, tax, and payment terms before sending.`,
    });
  }

  return (
    <div className="v2-tool-workbench v2-estimate-workbench">
      <Panel className="v2-tool-panel v2-estimate-builder-panel" eyebrow="Estimate" title="Price the work before you post or bid">
        <section className="v2-estimate-hero" aria-label="Estimate target">
          <span>Recommended target</span>
          <strong>{currency(target)}</strong>
          <small>{currency(low)} - {currency(high)} / {formatNumber(days, 1)} working days</small>
          <div className="v2-estimate-hero-actions">
            <button type="button" className="v2-primary-button" onClick={copySummary}>
              <Copy size={15} />
              {copied ? "Copied" : "Copy estimate"}
            </button>
            {onConvertToInvoice ? (
              <button type="button" onClick={convertToInvoice} disabled={target <= 0}>
                <FileText size={15} />
                Convert to invoice
              </button>
            ) : null}
          </div>
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
      </Panel>

      <Panel as="aside" className="v2-tool-panel v2-tool-summary-panel" eyebrow="Target" title={`${currency(low)} - ${currency(high)}`}>
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
      </Panel>
    </div>
  );
}
