import { Copy } from "lucide-react";
import { useState } from "react";
import { Panel } from "../../components/ui";
import type { Job } from "../../types";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function EstimateTool({ activeJob }: { activeJob: Job | null }) {
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
