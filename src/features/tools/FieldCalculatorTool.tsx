import {
  Clipboard,
  Copy,
  Grip,
  Menu,
  RotateCcw,
  Ruler,
  Scissors,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Job } from "../../types";

type CalculatorMode = "length" | "spacing" | "cuts" | "hardware";
type ActiveUnit = "feet" | "inches";
type Operator = "+" | "-" | "x" | "/";

const THIRTY_SECONDS_PER_INCH = 32;
const FRACTION_BUTTONS = Array.from({ length: 15 }, (_, index) => index + 1);
const RULER_TICKS = [
  { label: "1/16", value: 2 },
  { label: "1/8", value: 4 },
  { label: "3/16", value: 6 },
  { label: "1/4", value: 8 },
  { label: "5/16", value: 10 },
  { label: "3/8", value: 12 },
  { label: "7/16", value: 14 },
  { label: "1/2", value: 16 },
  { label: "9/16", value: 18 },
  { label: "5/8", value: 20 },
  { label: "11/16", value: 22 },
  { label: "3/4", value: 24 },
  { label: "13/16", value: 26 },
  { label: "7/8", value: 28 },
  { label: "15/16", value: 30 },
];

function formatNumber(value: number, digits = 2) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

function reduceFraction(thirtySeconds: number) {
  if (!thirtySeconds) return "";
  const divisor = gcd(thirtySeconds, THIRTY_SECONDS_PER_INCH);
  return `${thirtySeconds / divisor}/${THIRTY_SECONDS_PER_INCH / divisor}`;
}

function fractionLabelFromSixteenth(value: number) {
  return reduceFraction(value * 2);
}

function formatMeasurement(value32: number) {
  const sign = value32 < 0 ? "-" : "";
  const safeValue = Math.abs(Math.round(value32));
  const totalInches = Math.floor(safeValue / THIRTY_SECONDS_PER_INCH);
  const fraction32 = safeValue % THIRTY_SECONDS_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const fraction = reduceFraction(fraction32);

  if (feet > 0) {
    return `${sign}${feet}' ${inches}${fraction ? ` ${fraction}` : ""}"`;
  }

  return `${sign}${inches}${fraction ? ` ${fraction}` : ""}"`;
}

function formatMeasurementLong(value32: number) {
  const inches = value32 / THIRTY_SECONDS_PER_INCH;
  return `${formatMeasurement(value32)} / ${formatNumber(inches, 3)} in`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function valueFromEntry(feetText: string, inchesText: string, fraction32: number) {
  const feet = Math.max(0, Number(feetText) || 0);
  const inches = Math.max(0, Number(inchesText) || 0);
  return Math.round((feet * 12 + inches) * THIRTY_SECONDS_PER_INCH + fraction32);
}

function fieldsFromValue(value32: number) {
  const safeValue = Math.max(0, Math.round(value32));
  const totalInches = Math.floor(safeValue / THIRTY_SECONDS_PER_INCH);
  return {
    feet: String(Math.floor(totalInches / 12)),
    inches: String(totalInches % 12),
    fraction32: safeValue % THIRTY_SECONDS_PER_INCH,
  };
}

function computeOperation(left32: number, operator: Operator, right32: number) {
  if (operator === "+") return left32 + right32;
  if (operator === "-") return left32 - right32;

  const scalar = right32 / THIRTY_SECONDS_PER_INCH;
  if (operator === "x") return Math.round(left32 * scalar);
  if (!scalar) return left32;
  return Math.round(left32 / scalar);
}

export function FieldCalculatorTool({ activeJob, onBack }: { activeJob: Job | null; onBack?: () => void }) {
  const [calculatorMode, setCalculatorMode] = useState<CalculatorMode>("length");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>("inches");
  const [feetText, setFeetText] = useState("0");
  const [inchesText, setInchesText] = useState("0");
  const [fraction32, setFraction32] = useState(0);
  const [pieces, setPieces] = useState(1);
  const [kerfEnabled, setKerfEnabled] = useState(false);
  const [accumulator32, setAccumulator32] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [result32, setResult32] = useState<number | null>(null);
  const [historyLabel, setHistoryLabel] = useState("Ready");
  const [copied, setCopied] = useState(false);

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

  const entryValue32 = valueFromEntry(feetText, inchesText, fraction32);
  const displayValue32 = result32 ?? entryValue32;
  const cutValue32 = Math.max(0, displayValue32 - (kerfEnabled ? 4 : 0));
  const totalValue32 = cutValue32 * Math.max(1, pieces);

  const spacingRun = Math.max(0, displayValue32 / THIRTY_SECONDS_PER_INCH);
  const spacingItems = Math.max(1, spacingCount);
  const availableSpacing = Math.max(0, spacingRun - spacingItems * spacingItemWidth - spacingEndReveal * 2);
  const betweenGap = spacingItems > 1 ? availableSpacing / (spacingItems - 1) : 0;
  const centerToCenter = spacingItems > 1 ? betweenGap + spacingItemWidth : 0;
  const firstCenter = spacingEndReveal + spacingItemWidth / 2;
  const lastCenter = spacingItems > 1 ? spacingRun - spacingEndReveal - spacingItemWidth / 2 : firstCenter;
  const miter = wallAngle / 2;
  const crownMiter = Math.atan(Math.sin((miter * Math.PI) / 180) / Math.tan((springAngle * Math.PI) / 180)) * (180 / Math.PI);
  const crownBevelInput = clamp(Math.cos((springAngle * Math.PI) / 180) * Math.cos((miter * Math.PI) / 180), -1, 1);
  const crownBevel = Math.asin(crownBevelInput) * (180 / Math.PI);
  const hardwareCenterline = hardwareWidth / 2;
  const leftBore = hardwareStyle === "pull" ? hardwareCenterline - hardwareCenter / 2 : hardwareCenterline;
  const rightBore = hardwareStyle === "pull" ? hardwareCenterline + hardwareCenter / 2 : hardwareCenterline;

  const modeSummary = useMemo(() => ({
    length: {
      icon: <Ruler size={18} />,
      label: "Length",
      body: "Add, subtract, split, and copy tape-ready measurements.",
      pill: "Live",
    },
    spacing: {
      icon: <Grip size={18} />,
      label: "Spacing",
      body: "Use the current measurement as the run for balusters, panels, and reveals.",
      pill: "Layout",
    },
    cuts: {
      icon: <Scissors size={18} />,
      label: "Cuts",
      body: "Fast miter and crown checks before you walk to the saw.",
      pill: "Saw",
    },
    hardware: {
      icon: <SlidersHorizontal size={18} />,
      label: "Hardware",
      body: "Centerline and bore marks for cabinet hardware.",
      pill: "Cabinet",
    },
  }), []);

  function setEntryFromValue(nextValue32: number) {
    const fields = fieldsFromValue(nextValue32);
    setFeetText(fields.feet);
    setInchesText(fields.inches);
    setFraction32(fields.fraction32);
    setResult32(null);
  }

  function handleDigit(digit: string) {
    if (result32 !== null && pendingOperator === null) {
      setEntryFromValue(0);
    }

    const setter = activeUnit === "feet" ? setFeetText : setInchesText;
    setter((current) => {
      const clean = current === "0" ? "" : current;
      const next = `${clean}${digit}`.slice(0, activeUnit === "feet" ? 3 : 2);
      return next || "0";
    });
    setResult32(null);
    setCopied(false);
  }

  function handleBackspace() {
    if (fraction32) {
      setFraction32(0);
      setResult32(null);
      return;
    }

    const setter = activeUnit === "feet" ? setFeetText : setInchesText;
    setter((current) => current.length > 1 ? current.slice(0, -1) : "0");
    setResult32(null);
  }

  function clearAll() {
    setFeetText("0");
    setInchesText("0");
    setFraction32(0);
    setPieces(1);
    setAccumulator32(null);
    setPendingOperator(null);
    setResult32(null);
    setHistoryLabel("Ready");
    setCopied(false);
  }

  function adjustEntry(delta32: number) {
    const base = result32 ?? entryValue32;
    setEntryFromValue(Math.max(0, base + delta32));
    setCopied(false);
  }

  function chooseFraction(sixteenth: number) {
    setFraction32(sixteenth * 2);
    setResult32(null);
    setCopied(false);
  }

  function applyOperator(operator: Operator) {
    const current = result32 ?? entryValue32;
    const nextAccumulator = accumulator32 !== null && pendingOperator
      ? computeOperation(accumulator32, pendingOperator, current)
      : current;

    setAccumulator32(nextAccumulator);
    setPendingOperator(operator);
    setHistoryLabel(`${formatMeasurement(nextAccumulator)} ${operator}`);
    setEntryFromValue(0);
    setActiveUnit("inches");
  }

  function evaluate() {
    const current = result32 ?? entryValue32;
    if (accumulator32 === null || !pendingOperator) {
      setResult32(current);
      setHistoryLabel(formatMeasurement(current));
      return;
    }

    const nextResult = computeOperation(accumulator32, pendingOperator, current);
    setResult32(nextResult);
    setHistoryLabel(`${formatMeasurement(accumulator32)} ${pendingOperator} ${formatMeasurement(current)}`);
    setAccumulator32(null);
    setPendingOperator(null);
    setCopied(false);
  }

  async function copyCalculatorResult() {
    const text = [
      "RIVT Heavy 16th",
      `Current: ${formatMeasurementLong(displayValue32)}`,
      `Cut length: ${formatMeasurementLong(cutValue32)}${kerfEnabled ? " after 1/8 in kerf" : ""}`,
      `Pieces: ${pieces}`,
      `Total length: ${formatMeasurementLong(totalValue32)}`,
      `Spacing: ${spacingItems} items, ${formatNumber(betweenGap, 3)} in gap, ${formatNumber(centerToCenter, 3)} in center-to-center`,
      `Cuts: ${cornerType} ${cutSide}, ${formatNumber(miter, 1)} deg flat miter, ${formatNumber(Math.abs(crownMiter), 1)} deg crown miter, ${formatNumber(Math.abs(crownBevel), 1)} deg bevel`,
      `Hardware: ${hardwareStyle}, ${formatNumber(leftBore, 3)} in${hardwareStyle === "pull" ? ` and ${formatNumber(rightBore, 3)} in` : ""} from edge, ${formatNumber(hardwareTopReveal, 3)} in from reference`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="heavy-calc-workbench fraction-calc-workbench" aria-label="Heavy 16th field calculator">
      <h1 className="sr-only">Heavy 16th field calculator</h1>
      <header className="heavy-calc-topbar">
        <button
          type="button"
          className={onBack ? "calc-menu-button calc-tools-button" : "calc-menu-button"}
          aria-label={onBack ? "Tools" : "Toggle calculator tool drawer"}
          aria-expanded={onBack ? undefined : drawerOpen}
          onClick={onBack ?? (() => setDrawerOpen((open) => !open))}
        >
          {onBack ? "Tools" : <Menu size={20} />}
        </button>
        <div className="heavy-calc-brand">
          <div className="heavy-calc-brand-mark" aria-hidden="true">
            <Ruler size={22} />
          </div>
          <div>
            <strong>THE HEAVY 16TH</strong>
            <span>Pro fraction calc</span>
          </div>
        </div>
        <button type="button" className="calc-exit-button" onClick={copyCalculatorResult}>
          <Copy size={15} />
          {copied ? "Copied" : "Copy result"}
        </button>
      </header>

      <div className="heavy-calc-shell fraction-calc-shell">
        <aside className={drawerOpen ? "heavy-calc-drawer is-open" : "heavy-calc-drawer"} aria-label="Calculator tools">
          <div className="drawer-title">
            <span>Pro tools suite</span>
            <strong>Field math that acts like a tool.</strong>
          </div>
          {(["length", "spacing", "cuts", "hardware"] as const).map((mode) => {
            const drawerLabel = {
              length: "Open measurement drawer option",
              spacing: "Open layout drawer option",
              cuts: "Open saw drawer option",
              hardware: "Open cabinet drawer option",
            }[mode];
            return (
            <button
              key={mode}
              type="button"
              className={calculatorMode === mode ? "drawer-entry active" : "drawer-entry"}
              aria-label={drawerLabel}
              aria-pressed={calculatorMode === mode}
              onClick={() => {
                setCalculatorMode(mode);
                setDrawerOpen(false);
              }}
            >
              <span>
                {modeSummary[mode].icon}
                <span>
                  <strong>{modeSummary[mode].label}</strong>
                  <small>{modeSummary[mode].body}</small>
                </span>
              </span>
              <i className="drawer-pill">{modeSummary[mode].pill}</i>
            </button>
          );
          })}

          <div className="drawer-section compact">
            <div className="drawer-section-head">
              <span>Cut modifiers</span>
            </div>
            <label className="drawer-toggle-row">
              <span>Blade kerf 1/8 in</span>
              <button
                type="button"
                className={kerfEnabled ? "drawer-switch on" : "drawer-switch"}
                aria-label="Blade kerf 1/8 inch"
                aria-pressed={kerfEnabled}
                onClick={() => setKerfEnabled((enabled) => !enabled)}
              >
                <i />
              </button>
            </label>
            <label className="drawer-toggle-row">
              <span>Pieces</span>
              <span className="fraction-stepper">
                <button type="button" onClick={() => setPieces((value) => Math.max(1, value - 1))}>-</button>
                <strong>{pieces}</strong>
                <button type="button" onClick={() => setPieces((value) => Math.min(999, value + 1))}>+</button>
              </span>
            </label>
          </div>

          {activeJob ? (
            <div className="drawer-section">
              <div className="drawer-section-head">
                <span>Job context</span>
              </div>
              <p className="fraction-job-context">{activeJob.title}</p>
            </div>
          ) : null}
        </aside>

        <main className={`heavy-calc-main fraction-calc-main ${calculatorMode}-mode`}>
          <div className="calc-screen-head">
            <div>
              <span className="fraction-eyebrow">{modeSummary[calculatorMode].pill}</span>
              <h2>Heavy 16th calculator</h2>
            </div>
            <button type="button" className="screen-ghost-button" onClick={clearAll}>
              <RotateCcw size={14} />
              Clear
            </button>
          </div>

          <div className="fraction-mode-strip" aria-label="Calculator modes">
            {(["length", "spacing", "cuts", "hardware"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={calculatorMode === mode ? "active" : ""}
                aria-pressed={calculatorMode === mode}
                onClick={() => setCalculatorMode(mode)}
              >
                {modeSummary[mode].label}
              </button>
            ))}
          </div>

          {calculatorMode === "length" ? (
            <section className="fraction-calc-grid" aria-label="Length calculator">
              <div className="fraction-calc-left">
                <div className="calc-display-stack fraction-display">
                  <span className="fraction-history">{historyLabel}</span>
                  <strong className="calc-primary-value">{formatMeasurement(displayValue32)}</strong>
                  <div className="calc-secondary-row">
                    <span>Total length</span>
                    <strong>{formatMeasurement(totalValue32)}</strong>
                  </div>
                  <div className="fraction-display-meta">
                    <span>{formatNumber(displayValue32 / THIRTY_SECONDS_PER_INCH, 3)} in</span>
                    <span>{formatNumber(displayValue32 / THIRTY_SECONDS_PER_INCH / 12, 3)} ft</span>
                    {pendingOperator ? <span>{pendingOperator} pending</span> : <span>{activeUnit === "feet" ? "Entering feet" : "Entering inches"}</span>}
                  </div>
                </div>

                <div className="fraction-unit-row" aria-label="Input unit">
                  <button type="button" className={activeUnit === "feet" ? "active" : ""} onClick={() => setActiveUnit("feet")}>
                    <span>FT</span>
                    <strong>{feetText}</strong>
                  </button>
                  <button type="button" className={activeUnit === "inches" ? "active" : ""} onClick={() => setActiveUnit("inches")}>
                    <span>IN</span>
                    <strong>{inchesText}</strong>
                  </button>
                  <button type="button" className={fraction32 ? "active" : ""} onClick={() => setFraction32(0)}>
                    <span>FRAC</span>
                    <strong>{reduceFraction(fraction32) || "--"}</strong>
                  </button>
                </div>

                <div className="fraction-action-row" aria-label="Heavy and light modifiers">
                  <button type="button" onClick={() => adjustEntry(1)}>+ Heavy</button>
                  <button type="button" onClick={() => adjustEntry(-1)}>- Light</button>
                  <button type="button" onClick={() => adjustEntry(-2)}>-1/16</button>
                  <button type="button" onClick={() => adjustEntry(2)}>+1/16</button>
                </div>

                <div className="fraction-strip" aria-label="Sixteenth fractions">
                  {FRACTION_BUTTONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={fraction32 === value * 2 ? "active" : ""}
                      onClick={() => chooseFraction(value)}
                    >
                      {fractionLabelFromSixteenth(value)}
                    </button>
                  ))}
                </div>

                <div className="calc-pad-grid fraction-pad" aria-label="Fraction calculator keypad">
                  {["7", "8", "9"].map((digit) => <button key={digit} type="button" onClick={() => handleDigit(digit)}>{digit}</button>)}
                  <button type="button" className="op" onClick={() => applyOperator("/")}>/</button>
                  {["4", "5", "6"].map((digit) => <button key={digit} type="button" onClick={() => handleDigit(digit)}>{digit}</button>)}
                  <button type="button" className="op" onClick={() => applyOperator("x")}>x</button>
                  {["1", "2", "3"].map((digit) => <button key={digit} type="button" onClick={() => handleDigit(digit)}>{digit}</button>)}
                  <button type="button" className="op" onClick={() => applyOperator("-")}>-</button>
                  <button type="button" className="wide" onClick={() => handleDigit("0")}>0</button>
                  <button type="button" className="op ghost" onClick={handleBackspace} aria-label="Backspace">DEL</button>
                  <button type="button" className="eq" onClick={evaluate}>=</button>
                  <button type="button" className="op plus" onClick={() => applyOperator("+")}>+</button>
                </div>
              </div>

              <aside className="fraction-result-card" aria-label="Field card">
                <Clipboard size={18} />
                <span>Cut card</span>
                <strong>{formatMeasurement(cutValue32)}</strong>
                <small>{kerfEnabled ? "Kerf removed" : "No kerf removed"} / {pieces} piece{pieces === 1 ? "" : "s"}</small>
                <div>
                  <span>Total</span>
                  <b>{formatMeasurement(totalValue32)}</b>
                </div>
                <div>
                  <span>Decimal</span>
                  <b>{formatNumber(totalValue32 / THIRTY_SECONDS_PER_INCH, 3)} in</b>
                </div>
              </aside>
            </section>
          ) : null}

          {calculatorMode === "spacing" ? (
            <section className="fraction-panel-mode" aria-label="Equal spacing calculator">
              <div className="miter-config-card">
                <span>Run from calculator</span>
                <strong>{formatMeasurement(displayValue32)}</strong>
                <p>Use the current length as your opening or panel run.</p>
              </div>
              <div className="fraction-input-grid">
                <label>Items<input type="number" value={spacingCount} min="1" onChange={(event) => setSpacingCount(Math.max(1, Number(event.target.value) || 1))} /></label>
                <label>Item width (in)<input type="number" value={spacingItemWidth} min="0" step="0.125" onChange={(event) => setSpacingItemWidth(Math.max(0, Number(event.target.value) || 0))} /></label>
                <label>End reveal (in)<input type="number" value={spacingEndReveal} min="0" step="0.125" onChange={(event) => setSpacingEndReveal(Math.max(0, Number(event.target.value) || 0))} /></label>
              </div>
              <div className="miter-readout">
                <div><span>Open gap</span><strong>{formatNumber(betweenGap, 3)}</strong></div>
                <div><span>Center-to-center</span><strong>{formatNumber(centerToCenter, 3)}</strong></div>
              </div>
              <div className="fraction-summary-grid">
                <article><span>First center</span><strong>{formatNumber(firstCenter, 3)} in</strong></article>
                <article><span>Last center</span><strong>{formatNumber(lastCenter, 3)} in</strong></article>
                <article><span>Open run</span><strong>{formatNumber(availableSpacing, 3)} in</strong></article>
              </div>
            </section>
          ) : null}

          {calculatorMode === "cuts" ? (
            <section className="fraction-panel-mode" aria-label="Cut angle calculator">
              <div className="miter-setup-grid">
                <label className="miter-value-card emphasis"><span>Wall angle</span><input type="number" value={wallAngle} min="1" max="179" onChange={(event) => setWallAngle(clamp(Number(event.target.value) || 90, 1, 179))} /></label>
                <label className="miter-value-card"><span>Spring angle</span><input type="number" value={springAngle} min="1" max="89" onChange={(event) => setSpringAngle(clamp(Number(event.target.value) || 52, 1, 89))} /></label>
              </div>
              <div className="miter-toggle-row">
                <button type="button" className={cornerType === "inside" ? "choice-pill active" : "choice-pill"} onClick={() => setCornerType("inside")}>Inside</button>
                <button type="button" className={cornerType === "outside" ? "choice-pill active" : "choice-pill"} onClick={() => setCornerType("outside")}>Outside</button>
              </div>
              <div className="miter-toggle-row">
                <button type="button" className={cutSide === "left" ? "choice-pill active" : "choice-pill"} onClick={() => setCutSide("left")}>Left</button>
                <button type="button" className={cutSide === "right" ? "choice-pill active" : "choice-pill"} onClick={() => setCutSide("right")}>Right</button>
              </div>
              <div className="miter-readout">
                <div><span>Flat miter</span><strong>{formatNumber(miter, 1)}</strong></div>
                <div><span>Crown bevel</span><strong>{formatNumber(Math.abs(crownBevel), 1)}</strong></div>
              </div>
              <div className="miter-config-card">
                <span>Saw configuration</span>
                <strong>{cornerType === "inside" ? "Inside corner" : "Outside corner"} / {cutSide} piece</strong>
                <p>Crown miter: {formatNumber(Math.abs(crownMiter), 1)} deg. Verify against your saw, trim profile, and wall condition.</p>
              </div>
            </section>
          ) : null}

          {calculatorMode === "hardware" ? (
            <section className="fraction-panel-mode" aria-label="Hardware layout calculator">
              <div className="miter-toggle-row">
                <button type="button" className={hardwareStyle === "pull" ? "choice-pill active" : "choice-pill"} onClick={() => setHardwareStyle("pull")}>Pull</button>
                <button type="button" className={hardwareStyle === "knob" ? "choice-pill active" : "choice-pill"} onClick={() => setHardwareStyle("knob")}>Knob</button>
              </div>
              <div className="fraction-input-grid">
                <label>Door/drawer width<input type="number" value={hardwareWidth} min="1" step="0.125" onChange={(event) => setHardwareWidth(Math.max(1, Number(event.target.value) || 1))} /></label>
                <label>Center-to-center<input type="number" value={hardwareCenter} min="0" step="0.125" onChange={(event) => setHardwareCenter(Math.max(0, Number(event.target.value) || 0))} /></label>
                <label>From top/reference<input type="number" value={hardwareTopReveal} min="0" step="0.125" onChange={(event) => setHardwareTopReveal(Math.max(0, Number(event.target.value) || 0))} /></label>
              </div>
              <div className="miter-readout">
                <div><span>Centerline</span><strong>{formatNumber(hardwareCenterline, 3)}</strong></div>
                <div><span>Height mark</span><strong>{formatNumber(hardwareTopReveal, 3)}</strong></div>
              </div>
              <div className="fraction-summary-grid">
                <article><span>Left mark</span><strong>{formatNumber(leftBore, 3)} in</strong></article>
                <article><span>Right mark</span><strong>{hardwareStyle === "pull" ? `${formatNumber(rightBore, 3)} in` : "N/A"}</strong></article>
                <article><span>Reference</span><strong>Same edge</strong></article>
              </div>
            </section>
          ) : null}
        </main>

        <aside className="heavy-calc-ruler fraction-ruler" aria-label="Sixteenth tape reference">
          {RULER_TICKS.map((tick) => (
            <button
              key={tick.value}
              type="button"
              className={fraction32 === tick.value ? "ruler-tick major active" : tick.value % 8 === 0 ? "ruler-tick major" : "ruler-tick"}
              onClick={() => setFraction32(tick.value)}
            >
              {tick.label}
            </button>
          ))}
        </aside>
      </div>
    </section>
  );
}
