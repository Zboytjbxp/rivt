import { useState, type ReactNode } from "react";
import type { Job } from "../../types";
import { Panel } from "../../components/ui";

export type MaterialsView = "takeoff" | "sheets" | "library";

interface MaterialsToolProps {
  activeJob: Job | null;
  initialView?: MaterialsView;
  priceLibrary: ReactNode;
}

const materialPresets = [
  { label: "Sheet goods", waste: 10, sheetWidth: 48, sheetHeight: 96 },
  { label: "Drywall", waste: 12, sheetWidth: 48, sheetHeight: 96 },
  { label: "Flooring", waste: 8, sheetWidth: 48, sheetHeight: 48 },
  { label: "Tile", waste: 15, sheetWidth: 12, sheetHeight: 24 },
];

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

export function MaterialsTool({ activeJob, initialView = "takeoff", priceLibrary }: MaterialsToolProps) {
  const [view, setView] = useState<MaterialsView>(initialView);
  const [areaLength, setAreaLength] = useState(12);
  const [areaWidth, setAreaWidth] = useState(10);
  const [wastePct, setWastePct] = useState(10);
  const [unitCost, setUnitCost] = useState(0);
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
  const sheetsNeeded = partArea > 0 ? Math.ceil(partArea / Math.max(1, sheetArea)) : 0;
  const wasteAdded = withWaste - squareFeet;

  function applyPreset(preset: (typeof materialPresets)[number]) {
    setPresetName(preset.label);
    setWastePct(preset.waste);
    setSheetWidth(preset.sheetWidth);
    setSheetHeight(preset.sheetHeight);
  }

  return (
    <div className="v2-materials-app">
      <nav className="v2-materials-tabs" aria-label="Materials views">
        <button type="button" className={view === "takeoff" ? "is-active" : ""} aria-pressed={view === "takeoff"} onClick={() => setView("takeoff")}>Takeoff</button>
        <button type="button" className={view === "sheets" ? "is-active" : ""} aria-pressed={view === "sheets"} onClick={() => setView("sheets")}>Sheets</button>
        <button type="button" className={view === "library" ? "is-active" : ""} aria-pressed={view === "library"} onClick={() => setView("library")}>Price library</button>
      </nav>

      {activeJob ? <p className="v2-materials-context">Using alongside <strong>{activeJob.title}</strong></p> : null}

      {view === "takeoff" ? (
        <Panel className="v2-tool-panel v2-materials-mode" eyebrow="Takeoff" title="Area, waste, and cost">
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
          <div className="v2-tool-input-grid two">
            <label>Length (ft)<input inputMode="decimal" type="number" min="0" value={areaLength} onChange={(event) => setAreaLength(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Width (ft)<input inputMode="decimal" type="number" min="0" value={areaWidth} onChange={(event) => setAreaWidth(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Waste %<input inputMode="decimal" type="number" min="0" value={wastePct} onChange={(event) => setWastePct(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Cost / sq ft<input inputMode="decimal" type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(Math.max(0, Number(event.target.value) || 0))} /></label>
          </div>
          <div className="v2-tool-result-grid">
            <article><span>Base area</span><strong>{formatNumber(squareFeet)} sq ft</strong></article>
            <article><span>With waste</span><strong>{formatNumber(withWaste)} sq ft</strong></article>
            <article><span>Waste added</span><strong>{formatNumber(wasteAdded)} sq ft</strong></article>
            <article><span>Material cost</span><strong>{currency(materialCost)}</strong></article>
          </div>
          {unitCost === 0 ? <p className="v2-tool-note">Enter your current cost per square foot. RIVT does not guess supplier pricing.</p> : null}
        </Panel>
      ) : null}

      {view === "sheets" ? (
        <Panel className="v2-tool-panel v2-materials-mode" eyebrow="Sheet planning" title="Quick sheet count">
          <div className="v2-tool-input-grid two">
            <label>Sheet width (in)<input inputMode="decimal" type="number" min="1" value={sheetWidth} onChange={(event) => setSheetWidth(Math.max(1, Number(event.target.value) || 1))} /></label>
            <label>Sheet height (in)<input inputMode="decimal" type="number" min="1" value={sheetHeight} onChange={(event) => setSheetHeight(Math.max(1, Number(event.target.value) || 1))} /></label>
            <label>Part width (in)<input inputMode="decimal" type="number" min="1" value={partWidth} onChange={(event) => setPartWidth(Math.max(1, Number(event.target.value) || 1))} /></label>
            <label>Part height (in)<input inputMode="decimal" type="number" min="1" value={partHeight} onChange={(event) => setPartHeight(Math.max(1, Number(event.target.value) || 1))} /></label>
            <label>Part quantity<input inputMode="numeric" type="number" min="1" value={partQty} onChange={(event) => setPartQty(Math.max(1, Number(event.target.value) || 1))} /></label>
          </div>
          <div className="v2-tool-result-hero">
            <span>Sheets needed</span>
            <strong>{sheetsNeeded}</strong>
            <small>{formatNumber(partArea)} sq ft of parts on {formatNumber(sheetArea)} sq ft sheets</small>
          </div>
        </Panel>
      ) : null}

      {view === "library" ? <div className="v2-materials-library">{priceLibrary}</div> : null}
    </div>
  );
}
