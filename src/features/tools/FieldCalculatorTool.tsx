import { Clipboard, Copy, RotateCcw, Ruler } from "lucide-react";
import { useState } from "react";

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

function formatMetric(value32: number) {
  const millimeters = (value32 / THIRTY_SECONDS_PER_INCH) * 25.4;
  const absMillimeters = Math.abs(millimeters);

  if (absMillimeters >= 1000) {
    return `${formatNumber(millimeters / 1000, 3)} m`;
  }

  if (absMillimeters >= 100) {
    return `${formatNumber(millimeters, 0)} mm`;
  }

  return `${formatNumber(millimeters, 1)} mm`;
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

export function FieldCalculatorTool({ onBack }: { onBack?: () => void }) {
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>("inches");
  const [feetText, setFeetText] = useState("0");
  const [inchesText, setInchesText] = useState("0");
  const [fraction32, setFraction32] = useState(0);
  const [metricEnabled, setMetricEnabled] = useState(false);
  const [accumulator32, setAccumulator32] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [result32, setResult32] = useState<number | null>(null);
  const [historyLabel, setHistoryLabel] = useState("Ready");
  const [copied, setCopied] = useState(false);

  const entryValue32 = valueFromEntry(feetText, inchesText, fraction32);
  const displayValue32 = result32 ?? entryValue32;

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

  function scaleEntry(multiplier: number) {
    const base = result32 ?? entryValue32;
    const next = Math.max(0, Math.round(base * multiplier));
    setEntryFromValue(next);
    setHistoryLabel(`${formatMeasurement(base)} ${multiplier === 2 ? "x2" : "/2"}`);
    setAccumulator32(null);
    setPendingOperator(null);
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
      `Result: ${formatMeasurementLong(displayValue32)}`,
      metricEnabled ? `Metric: ${formatMetric(displayValue32)}` : null,
    ].filter(Boolean).join("\n");

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
          aria-label={onBack ? "Tools" : "Clear calculator"}
          onClick={onBack ?? clearAll}
        >
          {onBack ? "Tools" : <RotateCcw size={18} />}
        </button>
        <div className="heavy-calc-brand">
          <div className="heavy-calc-brand-mark" aria-hidden="true">
            <Ruler size={22} />
          </div>
          <div>
            <strong>THE HEAVY 16TH</strong>
            <span>Fraction calculator</span>
          </div>
        </div>
        <button type="button" className="calc-exit-button" onClick={copyCalculatorResult}>
          <Copy size={15} />
          {copied ? "Copied" : "Copy"}
        </button>
      </header>

      <div className="heavy-calc-shell fraction-calc-shell fraction-only-shell">
        <main className="heavy-calc-main fraction-calc-main length-mode">
          <div className="calc-screen-head">
            <div>
              <span className="fraction-eyebrow">Fractions</span>
              <h2>Heavy 16th calculator</h2>
            </div>
            <button type="button" className="screen-ghost-button" onClick={clearAll}>
              <RotateCcw size={14} />
              Clear
            </button>
          </div>

          <section className="fraction-calc-grid" aria-label="Length calculator">
            <div className="fraction-calc-left">
              <div className="calc-display-stack fraction-display">
                <span className="fraction-history">{historyLabel}</span>
                <strong className="calc-primary-value">{formatMeasurement(displayValue32)}</strong>
                <div className="calc-secondary-row">
                  <span>{metricEnabled ? "Metric" : "Decimal"}</span>
                  <strong>{metricEnabled ? formatMetric(displayValue32) : `${formatNumber(displayValue32 / THIRTY_SECONDS_PER_INCH, 3)} in`}</strong>
                </div>
                <div className="fraction-display-meta">
                  <span>{formatNumber(displayValue32 / THIRTY_SECONDS_PER_INCH, 3)} in</span>
                  <span>{formatNumber(displayValue32 / THIRTY_SECONDS_PER_INCH / 12, 3)} ft</span>
                  <span>{formatMetric(displayValue32)}</span>
                  {pendingOperator ? <span>{pendingOperator} pending</span> : <span>{activeUnit === "feet" ? "Entering feet" : "Entering inches"}</span>}
                </div>
              </div>

              <div className="fraction-unit-row" aria-label="Input unit">
                <button type="button" className={activeUnit === "feet" ? "active unit-feet" : "unit-feet"} onClick={() => setActiveUnit("feet")}>
                  <span>FT</span>
                  <strong>{feetText}</strong>
                </button>
                <button type="button" className={activeUnit === "inches" ? "active unit-inches" : "unit-inches"} onClick={() => setActiveUnit("inches")}>
                  <span>IN</span>
                  <strong>{inchesText}</strong>
                </button>
                <button type="button" className={fraction32 ? "active unit-fraction" : "unit-fraction"} onClick={() => setFraction32(0)}>
                  <span>FRAC</span>
                  <strong>{reduceFraction(fraction32) || "--"}</strong>
                </button>
                <button
                  type="button"
                  className={metricEnabled ? "active unit-metric" : "unit-metric"}
                  aria-pressed={metricEnabled}
                  onClick={() => setMetricEnabled((enabled) => !enabled)}
                >
                  <span>MM</span>
                  <strong>{metricEnabled ? "ON" : "OFF"}</strong>
                </button>
              </div>

              <div className="fraction-action-row" aria-label="Heavy, light, double, and half controls">
                <button type="button" aria-label="Light minus one thirty-second" onClick={() => adjustEntry(-1)}>
                  <strong>L</strong>
                  <small>Light</small>
                </button>
                <button type="button" aria-label="Heavy plus one thirty-second" onClick={() => adjustEntry(1)}>
                  <strong>H</strong>
                  <small>Heavy</small>
                </button>
                <button type="button" aria-label="Divide measurement by two" onClick={() => scaleEntry(0.5)}>
                  <strong>&divide;2</strong>
                  <small>Half</small>
                </button>
                <button type="button" aria-label="Multiply measurement by two" onClick={() => scaleEntry(2)}>
                  <strong>&times;2</strong>
                  <small>Double</small>
                </button>
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

            <aside className="fraction-result-card" aria-label="Result card">
              <Clipboard size={18} />
              <span>Result</span>
              <strong>{formatMeasurement(displayValue32)}</strong>
              <small>{formatNumber(displayValue32 / THIRTY_SECONDS_PER_INCH, 3)} in</small>
              <div>
                <span>Metric</span>
                <b>{formatMetric(displayValue32)}</b>
              </div>
            </aside>
          </section>
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
