import { useState } from "react";
import type { Job } from "../../types";
import { Panel } from "../../components/ui";

function currency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}
export function MaterialsTool({ activeJob }: { activeJob: Job | null }) {
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

