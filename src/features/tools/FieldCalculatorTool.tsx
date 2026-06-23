import { Copy, Ruler } from "lucide-react";
import { useState } from "react";
import { Panel } from "../../components/ui";
import type { Job } from "../../types";

type CalculatorMode = "length" | "spacing" | "cuts" | "hardware";

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

export function FieldCalculatorTool({ activeJob }: { activeJob: Job | null }) {
  const [calculatorMode, setCalculatorMode] = useState<CalculatorMode>("length");
  const [feet, setFeet] = useState(0);
  const [inches, setInches] = useState(0);
  const [sixteenths, setSixteenths] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [spacingRun, setSpacingRun] = useState(96);
  const [spacingCount, setSpacingCount] = useState(5);
  const [spacingItemWidth, setSpacingItemWidth] = useState(1.5);
  const [spacingEndReveal, setSpacingEndReveal] = useState(2);
  const [wallAngle, setWallAngle] = useState(90);
  const [springAngle, setSpringAngle] = useState(52);
  const [cornerType, setCornerType] = useState<"inside" | "outside">("inside");
  const [cutSide, setCutSide] = useState<"left" | "right">("left");
  const [hardwareWidth, setHardwareWidth] = useState(24);
  const [hardwareCenter, setHardwareCenter] = useState(5);
  const [hardwareTopReveal, setHardwareTopReveal] = useState(2.5);
  const [hardwareStyle, setHardwareStyle] = useState<"pull" | "knob">("pull");
  const [copied, setCopied] = useState(false);

  const decimalInches = Math.max(0, feet * 12 + inches + sixteenths / 16);
  const totalInches = decimalInches * Math.max(1, quantity);
  const totalFeet = totalInches / 12;
  const singleLengthLabel = formatInchesAsFeet(decimalInches);
  const totalLengthLabel = formatInchesAsFeet(totalInches);
  const spacingItems = Math.max(1, spacingCount);
  const availableSpacing = Math.max(0, spacingRun - spacingItems * spacingItemWidth - spacingEndReveal * 2);
  const betweenGap = spacingItems > 1 ? availableSpacing / (spacingItems - 1) : 0;
  const centerToCenter = spacingItems > 1 ? betweenGap + spacingItemWidth : 0;
  const firstCenter = spacingEndReveal + spacingItemWidth / 2;
  const lastCenter = spacingItems > 1 ? spacingRun - spacingEndReveal - spacingItemWidth / 2 : firstCenter;
  const miter = wallAngle / 2;
  const crownMiter = Math.atan(Math.sin((miter * Math.PI) / 180) / Math.tan((springAngle * Math.PI) / 180)) * (180 / Math.PI);
  const crownBevel = Math.asin(Math.cos((springAngle * Math.PI) / 180) * Math.cos((miter * Math.PI) / 180)) * (180 / Math.PI);
  const hardwareCenterline = hardwareWidth / 2;
  const leftBore = hardwareStyle === "pull" ? hardwareCenterline - hardwareCenter / 2 : hardwareCenterline;
  const rightBore = hardwareStyle === "pull" ? hardwareCenterline + hardwareCenter / 2 : hardwareCenterline;
  const activeModeLabel = {
    length: "Length",
    spacing: "Equal spacing",
    cuts: "Cut angles",
    hardware: "Hardware layout",
  }[calculatorMode];

  async function copyCalculatorResult() {
    const result = [
      `RIVT Heavy 16th - ${activeModeLabel}`,
      `Each piece: ${singleLengthLabel} (${formatNumber(decimalInches, 3)} in)`,
      `Quantity: ${quantity}`,
      `Total: ${totalLengthLabel} (${formatNumber(totalInches, 3)} in)`,
      `Spacing: ${spacingItems} items, ${formatNumber(betweenGap, 3)} in between, ${formatNumber(centerToCenter, 3)} in center-to-center`,
      `Cuts: ${cornerType} ${cutSide}, ${formatNumber(miter, 1)} deg flat miter, ${formatNumber(Math.abs(crownMiter), 1)} deg crown miter, ${formatNumber(Math.abs(crownBevel), 1)} deg bevel`,
      `Hardware: ${hardwareStyle}, marks at ${formatNumber(leftBore, 3)} in${hardwareStyle === "pull" ? ` and ${formatNumber(rightBore, 3)} in` : ""}, ${formatNumber(hardwareTopReveal, 3)} in from reference edge`,
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
          {([
            ["length", "Length"],
            ["spacing", "Spacing"],
            ["cuts", "Cuts"],
            ["hardware", "Hardware"],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={calculatorMode === mode ? "active" : ""}
              aria-pressed={calculatorMode === mode}
              onClick={() => setCalculatorMode(mode)}
            >
              {mode === "length" ? <Ruler size={15} /> : null}
              {label}
            </button>
          ))}
        </div>

        {calculatorMode === "length" ? (
          <section className="v2-tool-mode-panel" aria-label="Length calculator">
            <div className="v2-tool-input-grid four">
              <label>Feet<input type="number" value={feet} min="0" onChange={(event) => setFeet(Math.max(0, Number(event.target.value) || 0))} /></label>
              <label>Inches<input type="number" value={inches} min="0" max="11" onChange={(event) => setInches(Math.max(0, Math.min(11, Number(event.target.value) || 0)))} /></label>
              <label>16ths<input type="number" value={sixteenths} min="0" max="15" onChange={(event) => setSixteenths(Math.max(0, Math.min(15, Number(event.target.value) || 0)))} /></label>
              <label>Qty<input type="number" value={quantity} min="1" onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>
            </div>
            <div className="v2-tool-result-hero">
              <span>Total length</span>
              <strong>{totalLengthLabel}</strong>
              <small>{formatNumber(totalFeet, 2)} ft / {formatNumber(totalInches, 2)} in across {quantity} piece{quantity === 1 ? "" : "s"}</small>
            </div>
            <div className="v2-tool-result-grid compact">
              <article><span>Each piece</span><strong>{singleLengthLabel}</strong></article>
              <article><span>Decimal</span><strong>{formatNumber(decimalInches, 3)} in</strong></article>
              <article><span>Quantity</span><strong>{quantity}</strong></article>
            </div>
          </section>
        ) : null}

        {calculatorMode === "spacing" ? (
          <section className="v2-tool-mode-panel" aria-label="Equal spacing calculator">
            <div className="v2-tool-input-grid four">
              <label>Run length (in)<input type="number" value={spacingRun} min="1" onChange={(event) => setSpacingRun(Math.max(1, Number(event.target.value) || 1))} /></label>
              <label>Items<input type="number" value={spacingCount} min="1" onChange={(event) => setSpacingCount(Math.max(1, Number(event.target.value) || 1))} /></label>
              <label>Item width (in)<input type="number" value={spacingItemWidth} min="0" step="0.125" onChange={(event) => setSpacingItemWidth(Math.max(0, Number(event.target.value) || 0))} /></label>
              <label>End reveal (in)<input type="number" value={spacingEndReveal} min="0" step="0.125" onChange={(event) => setSpacingEndReveal(Math.max(0, Number(event.target.value) || 0))} /></label>
            </div>
            <div className="v2-tool-result-hero">
              <span>Equal spacing</span>
              <strong>{formatNumber(betweenGap, 3)} in</strong>
              <small>{formatNumber(centerToCenter, 3)} in center-to-center across {spacingItems} item{spacingItems === 1 ? "" : "s"}</small>
            </div>
            <div className="v2-tool-result-grid compact">
              <article><span>First center</span><strong>{formatNumber(firstCenter, 3)} in</strong></article>
              <article><span>Last center</span><strong>{formatNumber(lastCenter, 3)} in</strong></article>
              <article><span>Open gap</span><strong>{formatNumber(availableSpacing)} in</strong></article>
            </div>
          </section>
        ) : null}

        {calculatorMode === "cuts" ? (
          <section className="v2-tool-mode-panel" aria-label="Cut angle calculator">
            <div className="v2-tool-preset-row" aria-label="Cut presets">
              {[90, 45, 22.5, 135].map((angle) => (
                <button key={angle} type="button" className={wallAngle === angle ? "active" : ""} onClick={() => setWallAngle(angle)}>
                  {angle} deg
                </button>
              ))}
            </div>
            <div className="v2-tool-toggle-row" aria-label="Cut orientation">
              <button type="button" className={cornerType === "inside" ? "active" : ""} onClick={() => setCornerType("inside")}>Inside</button>
              <button type="button" className={cornerType === "outside" ? "active" : ""} onClick={() => setCornerType("outside")}>Outside</button>
              <button type="button" className={cutSide === "left" ? "active" : ""} onClick={() => setCutSide("left")}>Left</button>
              <button type="button" className={cutSide === "right" ? "active" : ""} onClick={() => setCutSide("right")}>Right</button>
            </div>
            <div className="v2-tool-input-grid two">
              <label>Wall angle<input type="number" value={wallAngle} min="1" max="179" onChange={(event) => setWallAngle(Math.max(1, Math.min(179, Number(event.target.value) || 90)))} /></label>
              <label>Spring angle<input type="number" value={springAngle} min="1" max="89" onChange={(event) => setSpringAngle(Math.max(1, Math.min(89, Number(event.target.value) || 52)))} /></label>
            </div>
            <div className="v2-tool-result-grid">
              <article><span>Flat miter</span><strong>{formatNumber(miter, 1)} deg</strong></article>
              <article><span>Crown miter</span><strong>{formatNumber(Math.abs(crownMiter), 1)} deg</strong></article>
              <article><span>Crown bevel</span><strong>{formatNumber(Math.abs(crownBevel), 1)} deg</strong></article>
            </div>
            <p className="v2-tool-note">{cornerType} corner, {cutSide} piece. Verify against the saw, material profile, and site condition before cutting.</p>
          </section>
        ) : null}

        {calculatorMode === "hardware" ? (
          <section className="v2-tool-mode-panel" aria-label="Hardware layout calculator">
            <div className="v2-tool-toggle-row" aria-label="Hardware type">
              <button type="button" className={hardwareStyle === "pull" ? "active" : ""} onClick={() => setHardwareStyle("pull")}>Pull</button>
              <button type="button" className={hardwareStyle === "knob" ? "active" : ""} onClick={() => setHardwareStyle("knob")}>Knob</button>
            </div>
            <div className="v2-tool-input-grid three">
              <label>Door/drawer width<input type="number" value={hardwareWidth} min="1" step="0.125" onChange={(event) => setHardwareWidth(Math.max(1, Number(event.target.value) || 1))} /></label>
              <label>Center-to-center<input type="number" value={hardwareCenter} min="0" step="0.125" onChange={(event) => setHardwareCenter(Math.max(0, Number(event.target.value) || 0))} /></label>
              <label>From top/reference<input type="number" value={hardwareTopReveal} min="0" step="0.125" onChange={(event) => setHardwareTopReveal(Math.max(0, Number(event.target.value) || 0))} /></label>
            </div>
            <div className="v2-tool-result-hero">
              <span>Centerline</span>
              <strong>{formatNumber(hardwareCenterline, 3)} in</strong>
              <small>{hardwareStyle === "pull" ? "Mark both bore points from the same edge." : "Mark one centered bore point."}</small>
            </div>
            <div className="v2-tool-result-grid compact">
              <article><span>Left mark</span><strong>{formatNumber(leftBore, 3)} in</strong></article>
              <article><span>Right mark</span><strong>{hardwareStyle === "pull" ? `${formatNumber(rightBore, 3)} in` : "N/A"}</strong></article>
              <article><span>Height mark</span><strong>{formatNumber(hardwareTopReveal, 3)} in</strong></article>
            </div>
          </section>
        ) : null}
      </Panel>

      <Panel className="v2-tool-panel v2-tool-field-card" eyebrow="Field card" title={activeModeLabel}>
        <div className="v2-tool-result-row">
          <span>Total length</span>
          <strong>{totalLengthLabel}</strong>
        </div>
        <div className="v2-tool-result-row">
          <span>Spacing</span>
          <strong>{formatNumber(betweenGap, 3)} in gap / {formatNumber(centerToCenter, 3)} in centers</strong>
        </div>
        <div className="v2-tool-result-row">
          <span>Cuts</span>
          <strong>{formatNumber(miter, 1)} deg miter / {formatNumber(Math.abs(crownBevel), 1)} deg bevel</strong>
        </div>
        <div className="v2-tool-result-row">
          <span>Hardware</span>
          <strong>{formatNumber(leftBore, 3)} in{hardwareStyle === "pull" ? ` / ${formatNumber(rightBore, 3)} in` : ""}</strong>
        </div>
        <button type="button" className="v2-primary-button" onClick={copyCalculatorResult}>
          <Copy size={15} />
          {copied ? "Copied" : "Copy result"}
        </button>
        <p className="v2-tool-note">Treat this as a field card, not stamped engineering. Confirm measurements on the material before cutting or drilling.</p>
        {activeJob ? <p className="v2-tool-note">Loaded from: {activeJob.title}</p> : null}
      </Panel>
    </div>
  );
}
